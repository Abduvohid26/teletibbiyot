import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { BRAND } from '@ishifo/shared';

export interface NotifyOptions {
  consultationId?: string;
  entityType?: string;
  entityId?: string;
  channels?: NotificationChannel[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;
  private eskizToken: string | null = null;
  private eskizTokenExpiresAt = 0;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const host = this.config.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(this.config.get('SMTP_PORT') || '587'),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
      this.logger.log('SMTP notification xizmati yoqildi');
    }
  }

  async sendEmail(to: string, subject: string, text: string) {
    if (!this.transporter) {
      const isProd = this.config.get('NODE_ENV') === 'production';
      if (isProd) {
        this.logger.warn(`[EMAIL] SMTP sozlanmagan — ${to}: ${subject}`);
      } else {
        this.logger.debug(`[EMAIL mock] To: ${to} | ${subject}`);
      }
      return false;
    }
    const from = this.config.get('SMTP_FROM') || BRAND.emailFrom;
    await this.transporter.sendMail({ from, to, subject, text });
    return true;
  }

  async sendSms(phone: string, text: string) {
    const provider = this.config.get('SMS_PROVIDER') || 'mock';
    if (provider === 'mock') {
      const isProd = this.config.get('NODE_ENV') === 'production';
      if (isProd) {
        this.logger.warn(`[SMS] SMS_PROVIDER=mock — ${phone}: ${text.slice(0, 40)}...`);
      } else {
        this.logger.debug(`[SMS mock] To: ${phone} | ${text}`);
      }
      return false;
    }

    if (provider === 'eskiz') {
      return this.sendEskizSms(phone, text);
    }

    this.logger.log(`[SMS ${provider}] To: ${phone}`);
    return true;
  }

  async sendSmsToUsers(userIds: string[], text: string) {
    if (!userIds.length) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, phone: { not: null } },
      select: { phone: true },
    });
    await Promise.all(
      users
        .filter((u) => u.phone)
        .map((u) => this.sendSms(u.phone!, text).catch(() => false)),
    );
  }

  private async getEskizToken(): Promise<string | null> {
    if (this.eskizToken && Date.now() < this.eskizTokenExpiresAt) {
      return this.eskizToken;
    }

    const email = this.config.get('ESKIZ_EMAIL');
    const password = this.config.get('ESKIZ_PASSWORD');
    if (!email || !password) {
      this.logger.warn('Eskiz SMS: ESKIZ_EMAIL/ESKIZ_PASSWORD sozlanmagan');
      return null;
    }

    const tokenRes = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!tokenRes.ok) throw new Error('Eskiz auth xato');
    const { data } = (await tokenRes.json()) as { data: { token: string } };
    this.eskizToken = data.token;
    this.eskizTokenExpiresAt = Date.now() + 25 * 60 * 1000;
    return this.eskizToken;
  }

  private async sendEskizSms(phone: string, text: string): Promise<boolean> {
    const from = this.config.get('ESKIZ_FROM') || '4546';

    try {
      const token = await this.getEskizToken();
      if (!token) return false;

      const normalized = phone.replace(/\D/g, '');
      const mobile = normalized.startsWith('998') ? normalized : `998${normalized.replace(/^0/, '')}`;

      const smsRes = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile_number: mobile, message: text.slice(0, 160), from }),
      });
      if (!smsRes.ok) throw new Error('Eskiz yuborish xato');
      this.logger.log(`Eskiz SMS yuborildi: ${mobile}`);
      return true;
    } catch (err) {
      this.logger.error(`Eskiz SMS xato: ${err}`);
      return false;
    }
  }

  async sendPush(userId: string, title: string, body: string) {
    const provider = this.config.get('PUSH_PROVIDER') || 'mock';
    if (provider === 'mock') {
      this.logger.debug(`[PUSH mock] User: ${userId} | ${title}`);
      return false;
    }
    this.logger.log(`[PUSH ${provider}] User: ${userId}`);
    return true;
  }

  async createInApp(
    userId: string,
    title: string,
    body: string,
    options: NotifyOptions = {},
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        channel: NotificationChannel.IN_APP,
        title,
        body,
        consultationId: options.consultationId,
        entityType: options.entityType,
        entityId: options.entityId,
      },
    });
  }

  async notifyUsers(
    userIds: string[],
    title: string,
    body: string,
    options: NotifyOptions = {},
  ) {
    const channels = options.channels ?? [NotificationChannel.IN_APP];
    const results = [];

    for (const userId of userIds) {
      if (channels.includes(NotificationChannel.IN_APP)) {
        results.push(await this.createInApp(userId, title, body, options));
      }
      if (channels.includes(NotificationChannel.PUSH)) {
        await this.sendPush(userId, title, body);
      }
    }

    return results;
  }

  async getUserNotifications(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async notifyConsultationQueued(doctorEmails: string[], patientName: string, utCode: string, doctorIds: string[] = [], consultationId?: string) {
    const subject = `[${BRAND.name}] Yangi konsultatsiya navbatda — ${utCode}`;
    const text = `Yangi bemor konsultatsiyasi navbatga qo'shildi.\n\nBemor: ${patientName}\nUT: ${utCode}\n\n${BRAND.name} tizimiga kiring va "Boshlash" tugmasini bosing.`;
    await Promise.all(
      doctorEmails.map((email) =>
        this.sendEmail(email, subject, text).catch((err) => {
          this.logger.warn(`Email yuborilmadi (${email}): ${err instanceof Error ? err.message : 'xatolik'}`);
        }),
      ),
    );
    if (doctorIds.length) {
      await this.notifyUsers(doctorIds, 'Yangi konsultatsiya navbatda', `${patientName} (${utCode}) — boshlash kerak`, {
        consultationId,
        entityType: 'Consultation',
        entityId: consultationId,
      });
    }
  }

  async notifyConsultationStarted(utOperatorIds: string[], patientName: string, doctorName: string, consultationId: string) {
    await this.notifyUsers(
      utOperatorIds,
      'Shifokor konsultatsiyani boshladi',
      `${doctorName} ${patientName} bilan video aloqaga tayyor. /ut/vitals sahifasida kuting.`,
      { consultationId, entityType: 'Consultation', entityId: consultationId },
    );
  }

  async notifyEmergencyTriage(emails: string[], patientName: string, utCode: string, userIds: string[] = [], consultationId?: string) {
    const subject = `[${BRAND.name}] FAVQULODDA — ${patientName} (${utCode})`;
    const text = `FAVQULODDA xavf darajasi aniqlangan!\n\nBemor: ${patientName}\nUT: ${utCode}\n\nZudlik bilan konsultatsiyani boshlang.`;
    const smsText = `${BRAND.name} FAVQULODDA: ${patientName} (${utCode}). Zudlik bilan konsultatsiyani boshlang.`;
    await Promise.all(
      emails.map((email) =>
        this.sendEmail(email, subject, text).catch((err) => {
          this.logger.warn(`Email yuborilmadi (${email}): ${err instanceof Error ? err.message : 'xatolik'}`);
        }),
      ),
    );
    if (userIds.length) {
      await this.notifyUsers(userIds, 'FAVQULODDA triage', `${patientName} (${utCode}) — zudlik bilan boshlang`, {
        consultationId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      });
      await this.sendSmsToUsers(userIds, smsText);
    }
  }

  async notifyReportReady(userIds: string[], patientName: string, consultationId: string) {
    await this.notifyUsers(userIds, 'Konsultatsiya hisoboti tayyor', `${patientName} uchun yakuniy hisobot yuklab olish mumkin`, {
      consultationId,
    });
  }

  async notifySecondOpinionRequested(doctorId: string, patientName: string, consultationId: string) {
    await this.notifyUsers([doctorId], 'Ikkinchi fikr so\'rovi', `${patientName} bo'yicha ikkinchi fikr kerak`, { consultationId });
  }

  async notifySecondOpinionPool(doctorIds: string[], patientName: string, consultationId: string) {
    await this.notifyUsers(
      doctorIds,
      'Ochiq ikkinchi fikr so\'rovi',
      `${patientName} bo'yicha ikkinchi fikr kerak — javob berish uchun konsultatsiyani oching`,
      { consultationId },
    );
  }
}
