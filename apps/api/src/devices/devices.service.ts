import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/access-control.service';
import { hasGlobalMtAccess, isAdmin, isMtStaff, isUtRole } from '../common/roles.constants';
import { createDeviceAdapter, DeviceAdapter } from './device.adapter';

@Injectable()
export class DevicesService {
  private readonly adapter: DeviceAdapter;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.adapter = createDeviceAdapter(config);
  }

  getDeviceMode() {
    return {
      mode: this.adapter.mode,
      simulated: this.adapter.isSimulated(),
      message: this.adapter.isSimulated()
        ? 'Simulyator rejimi — haqiqiy qurilmalar ulanmagan'
        : 'Real rejim — qurilmalar gateway orqali ulanadi',
    };
  }

  assertFacilityAccess(user: AuthUser, facilityId: string) {
    if (hasGlobalMtAccess(user.role) || isMtStaff(user.role)) return;
    if (isAdmin(user.role)) return;
    if (isUtRole(user.role)) {
      if (user.facilityId !== facilityId) {
        throw new ForbiddenException('Bu muassasa qurilmalariga kirish huquqi yo\'q');
      }
      return;
    }
    throw new ForbiddenException('Kirish huquqi yo\'q');
  }

  async getByFacility(facilityId: string, user: AuthUser) {
    this.assertFacilityAccess(user, facilityId);

    let devices = await this.prisma.deviceStatus.findMany({
      where: { facilityId },
    });

    if (devices.length === 0) {
      devices = await this.seedDefaultDevices(facilityId);
    }

    return devices.map((d) => ({
      ...d,
      deviceMode: this.adapter.mode,
      simulated: this.adapter.isSimulated(),
    }));
  }

  private async seedDefaultDevices(facilityId: string) {
    const defaults = this.adapter.getDefaultDevices();
    if (defaults.length === 0) return [];

    await this.prisma.deviceStatus.createMany({
      data: defaults.map((d) => ({
        name: d.name,
        type: d.type,
        connected: d.connected,
        status: d.status,
        facilityId,
      })),
    });

    return this.prisma.deviceStatus.findMany({ where: { facilityId } });
  }

  async updateStatus(id: string, connected: boolean, status: string, user: AuthUser) {
    const device = await this.prisma.deviceStatus.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Qurilma topilmadi');

    if (isUtRole(user.role)) {
      if (user.facilityId !== device.facilityId) {
        throw new ForbiddenException('Bu qurilmani yangilash huquqi yo\'q');
      }
    } else if (!hasGlobalMtAccess(user.role) && !isMtStaff(user.role) && !isAdmin(user.role)) {
      throw new ForbiddenException('Kirish huquqi yo\'q');
    }

    return this.prisma.deviceStatus.update({
      where: { id },
      data: { connected, status, lastCheck: new Date() },
    });
  }

  async ingestTelemetry(
    deviceId: string,
    metricType: string,
    value: number,
    user: AuthUser,
    unit?: string,
    raw?: Record<string, unknown>,
  ) {
    const device = await this.prisma.deviceStatus.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Qurilma topilmadi');
    this.assertFacilityAccess(user, device.facilityId);

    await this.prisma.deviceTelemetry.create({
      data: {
        deviceId,
        metricType,
        value,
        unit,
        raw: raw as object | undefined,
      },
    });

    return this.prisma.deviceStatus.update({
      where: { id: deviceId },
      data: { connected: true, status: 'good', lastTelemetryAt: new Date(), lastCheck: new Date() },
    });
  }

  async getTelemetry(deviceId: string, user: AuthUser, limit = 50) {
    const device = await this.prisma.deviceStatus.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Qurilma topilmadi');
    this.assertFacilityAccess(user, device.facilityId);

    return this.prisma.deviceTelemetry.findMany({
      where: { deviceId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }
}
