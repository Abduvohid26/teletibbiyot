import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Notification, NotificationChannel, Prisma, UserRole } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { BRAND } from '@ishifo/shared';

/**
 * Bildirishnoma turi — klient shundan ikonka, ovoz, "qo'ng'iroq" oynasi va
 * bosilganda qayerga o'tishni aniqlaydi.
 */
export type NotificationType =
  | 'info'
  | 'consultation_queued'
  | 'consultation_started'
  | 'consultation_completed'
  | 'consultation_cancelled'
  | 'emergency'
  | 'report_ready'
  | 'consilium_invite'
  | 'consilium_call'
  | 'consilium_removed'
  | 'consilium_left'
  | 'consilium_joined'
  | 'consilium_opinion'
  | 'second_opinion'
  | 'appointment'
  | 'device_offline'
  | 'ai_unavailable';

export interface NotifyOptions {
  consultationId?: string;
  entityType?: string;
  entityId?: string;
  channels?: NotificationChannel[];
  type?: NotificationType;
  /** Qo'ng'iroq oynasi uchun: callerName, patientName, status ... */
  data?: Record<string, unknown>;
}

type NotificationPublisher = (userId: string, notification: Notification) => void;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;
  private eskizToken: string | null = null;
  private eskizTokenExpiresAt = 0;
  /** Socket orqali real vaqtda yetkazish (VideoGateway ulaydi) */
  private publisher: NotificationPublisher | null = null;
  /** Admin ogohlantirishlari takrorlanib ketmasligi uchun: kalit → oxirgi vaqt */
  private readonly adminThrottle = new Map<string, number>();

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

  setPublisher(publisher: NotificationPublisher) {
    this.publisher = publisher;
  }

  /** Tashqi push provayder (hozircha log). In-app yozuvni notifyUsers yaratadi. */
  async sendPush(userId: string, title: string, body: string) {
    const provider = this.config.get('PUSH_PROVIDER') || 'mock';
    if (provider === 'mock') {
      this.logger.debug(`[PUSH] In-app yuborildi: ${userId} | ${title}`);
      return true;
    }

    this.logger.log(`[PUSH ${provider}] User: ${userId} | ${title}`);
    return true;
  }

  async createInApp(
    userId: string,
    title: string,
    body: string,
    options: NotifyOptions = {},
  ) {
    const row = await this.prisma.notification.create({
      data: {
        userId,
        channel: NotificationChannel.IN_APP,
        title,
        body,
        type: options.type ?? 'info',
        data: (options.data ?? undefined) as Prisma.InputJsonValue | undefined,
        consultationId: options.consultationId,
        entityType: options.entityType ?? (options.consultationId ? 'Consultation' : undefined),
        entityId: options.entityId ?? options.consultationId,
      },
    });
    try {
      this.publisher?.(userId, row);
    } catch (err) {
      this.logger.warn(`Bildirishnomani real vaqtda yuborib bo'lmadi: ${err}`);
    }
    return row;
  }

  async notifyUsers(
    userIds: string[],
    title: string,
    body: string,
    options: NotifyOptions = {},
  ) {
    const channels = options.channels ?? [NotificationChannel.IN_APP];
    const results = [];

    // Bir xil foydalanuvchiga bitta voqea ikki marta bormasin
    for (const userId of [...new Set(userIds.filter(Boolean))]) {
      // Ilgari PUSH kanali ham in-app yozardi — FAVQULODDA xabar ikki marta chiqardi
      if (channels.includes(NotificationChannel.IN_APP) || channels.includes(NotificationChannel.PUSH)) {
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

  /**
   * Administratorlarga tizim ogohlantirishi — bemor ma'lumotisiz (admin klinik
   * ma'lumotni ko'rmaydi). `throttleKey` bir xil bo'lsa `throttleMs` ichida qayta yuborilmaydi.
   */
  async notifyAdmins(
    title: string,
    body: string,
    options: NotifyOptions & { throttleKey?: string; throttleMs?: number } = {},
  ) {
    const { throttleKey, throttleMs = 30 * 60_000, ...rest } = options;
    if (throttleKey) {
      const last = this.adminThrottle.get(throttleKey) ?? 0;
      if (Date.now() - last < throttleMs) return [];
      this.adminThrottle.set(throttleKey, Date.now());
    }
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });
    return this.notifyUsers(admins.map((a) => a.id), title, body, rest);
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
      await this.notifyUsers(doctorIds, 'Yangi bemor yuborildi', `${patientName} (${utCode}) — «Qabul qilish» ni bosing`, {
        consultationId,
        type: 'consultation_queued',
        data: { patientName, utCode },
      });
    }
  }

  async notifyConsultationStarted(utOperatorIds: string[], patientName: string, doctorName: string, consultationId: string) {
    await this.notifyUsers(
      utOperatorIds,
      'Shifokor sizni kutmoqda',
      `${doctorName} ${patientName} bo'yicha qabulni boshladi — video aloqaga ulaning`,
      {
        consultationId,
        type: 'consultation_started',
        data: { callerName: doctorName, patientName },
      },
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
      await this.notifyUsers(userIds, 'FAVQULODDA holat', `${patientName} (${utCode}) — zudlik bilan qabul qiling`, {
        consultationId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        type: 'emergency',
        data: { patientName, utCode },
      });
      await this.sendSmsToUsers(userIds, smsText);
    }
  }

  async notifyReportReady(userIds: string[], patientName: string, consultationId: string) {
    await this.notifyUsers(userIds, 'Tashxis tayyor', `${patientName} — yakuniy xulosa (PDF) yuklab olish mumkin`, {
      consultationId,
      type: 'report_ready',
      data: { patientName },
    });
  }

  async notifySecondOpinionRequested(doctorId: string, patientName: string, consultationId: string) {
    await this.notifyUsers([doctorId], 'Ikkinchi fikr so\'rovi', `${patientName} bo'yicha ikkinchi fikr kerak`, {
      consultationId,
      type: 'second_opinion',
    });
  }

  async notifySecondOpinionPool(doctorIds: string[], patientName: string, consultationId: string) {
    await this.notifyUsers(
      doctorIds,
      'Ochiq ikkinchi fikr so\'rovi',
      `${patientName} bo'yicha ikkinchi fikr kerak — javob berish uchun konsultatsiyani oching`,
      { consultationId, type: 'second_opinion' },
    );
  }
}
