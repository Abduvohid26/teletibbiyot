import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { handlePrismaUniqueError } from '../common/prisma.util';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService, AuthUser } from '../common/access-control.service';
import { FieldCryptoService } from '../common/field-crypto.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { Gender, Prisma } from '@prisma/client';
import { isAdmin, isMtStaff, isUtRole } from '../common/roles.constants';
import { validatePinfl, normalizePinfl } from '../common/pinfl.util';
import { buildPatientSearchOr, normalizePhoneForLookup } from '../common/patient-search.util';
import { isAccessDeniedScope } from '../common/access-scope.constants';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private access: AccessControlService,
    private audit: AuditService,
    private crypto: FieldCryptoService,
  ) {}

  private encryptPinflForLookup(pinfl: string) {
    return this.crypto.isEnabled() ? this.crypto.encryptDeterministic(normalizePinfl(pinfl)) : normalizePinfl(pinfl);
  }

  private normalizePhoneForLookup(phone: string) {
    return normalizePhoneForLookup(phone);
  }

  private encryptPhoneForLookup(phone: string) {
    const normalized = this.normalizePhoneForLookup(phone);
    return this.crypto.isEnabled() ? this.crypto.encryptDeterministic(normalized) : normalized;
  }

  private mapPatient<T extends Record<string, unknown>>(patient: T): T {
    return this.crypto.unprotectPatient(patient) as T;
  }

  async create(dto: CreatePatientDto, user?: AuthUser, ip?: string) {
    const data = { ...dto };
    if (data.pinfl) {
      const check = validatePinfl(data.pinfl);
      if (!check.valid) throw new BadRequestException(check.error);
      data.pinfl = normalizePinfl(data.pinfl);
      const lookup = this.encryptPinflForLookup(data.pinfl);
      const dup = await this.prisma.patient.findUnique({ where: { pinfl: lookup } });
      if (dup) throw new BadRequestException('Bu PINFL bilan bemor allaqachon mavjud');
    }
    const protectedData = this.crypto.protectPatientFields(data as Record<string, unknown>) as unknown as CreatePatientDto;
    try {
      const patient = await this.prisma.patient.create({
        data: { ...protectedData, birthDate: new Date(protectedData.birthDate) },
      });
      if (user) {
        await this.audit.log({
          userId: user.id,
          action: 'CREATE_PATIENT',
          entity: 'Patient',
          entityId: patient.id,
          ipAddress: ip,
          details: { fullName: patient.fullName },
        });
      }
      return this.mapPatient(patient as Record<string, unknown>);
    } catch (error) {
      handlePrismaUniqueError(error);
    }
  }

  async update(id: string, dto: UpdatePatientDto, user: AuthUser) {
    await this.assertCanModify(id, user);
    const data: Prisma.PatientUpdateInput = { ...dto };
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate);
    if (dto.pinfl) {
      const check = validatePinfl(dto.pinfl);
      if (!check.valid) throw new BadRequestException(check.error);
      data.pinfl = normalizePinfl(dto.pinfl);
    }
    const protectedData = this.crypto.protectPatientFields(data as Record<string, unknown>) as Prisma.PatientUpdateInput;
    if (dto.pinfl) {
      protectedData.pinfl = this.encryptPinflForLookup(dto.pinfl);
    }
    if (dto.phone) {
      protectedData.phone = this.encryptPhoneForLookup(dto.phone);
    }
    try {
      const patient = await this.prisma.patient.update({ where: { id }, data: protectedData });
      return this.mapPatient(patient as Record<string, unknown>);
    } catch (error) {
      handlePrismaUniqueError(error);
    }
  }

  async findByPinfl(pinfl: string, user: AuthUser) {
    const normalized = normalizePinfl(pinfl);
    const check = validatePinfl(normalized);
    if (!check.valid) throw new BadRequestException(check.error);

    const lookup = this.encryptPinflForLookup(normalized);
    const patient = await this.prisma.patient.findUnique({
      where: { pinfl: lookup },
      include: { _count: { select: { consultations: true } } },
    });
    if (!patient) throw new NotFoundException('PINFL bo\'yicha bemor topilmadi');
    await this.findOne(patient.id, user);
    return this.mapPatient(patient as Record<string, unknown>);
  }

  private buildSearchWhere(search: string | undefined): Prisma.PatientWhereInput | undefined {
    if (!search?.trim()) return undefined;
    return { OR: buildPatientSearchOr(search.trim(), this.crypto) };
  }

  async findAll(query: PatientQueryDto, user: AuthUser) {
    const scopeFilter = this.access.patientFilter(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const skip = (page - 1) * limit;

    const conditions: Prisma.PatientWhereInput[] = [];
    if (scopeFilter) conditions.push(scopeFilter);
    const searchWhere = this.buildSearchWhere(query.search);
    if (searchWhere) conditions.push(searchWhere);
    if (query.gender) conditions.push({ gender: query.gender as Gender });
    if (query.region) conditions.push({ region: { equals: query.region, mode: 'insensitive' } });
    if (query.district) conditions.push({ district: { equals: query.district, mode: 'insensitive' } });

    const where: Prisma.PatientWhereInput = conditions.length > 1 ? { AND: conditions } : (conditions[0] ?? {});

    const orderBy = query.sortBy === 'fullName'
      ? { fullName: (query.sortOrder ?? 'asc') as 'asc' | 'desc' }
      : { createdAt: (query.sortOrder ?? 'desc') as 'asc' | 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { _count: { select: { consultations: true } } },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      items: items.map((p) => this.mapPatient(p as Record<string, unknown>)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        consultations: {
          include: {
            aiAnalysis: true,
            finalDiagnosis: true,
            utFacility: true,
            mtDoctor: { select: { id: true, fullName: true, specialty: true } },
            clinicalRecord: { select: { complaints: true, vitalSigns: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { consultations: true } },
      },
    });
    if (!patient) throw new NotFoundException('Bemor topilmadi');

    const scope = this.access.patientFilter(user);
    if (isAccessDeniedScope(scope)) {
      throw new ForbiddenException('Bu bemorga kirish huquqi yo\'q');
    }
    if (scope) {
      const allowed = await this.prisma.patient.count({ where: { id, AND: [scope] } });
      if (!allowed) throw new ForbiddenException('Bu bemorga kirish huquqi yo\'q');
    }

    return this.mapPatient(patient as Record<string, unknown>);
  }

  private async assertCanModify(id: string, user: AuthUser) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException('Bemor topilmadi');

    if (isAdmin(user.role) || isMtStaff(user.role)) return;

    if (isUtRole(user.role)) {
      if (!user.facilityId) throw new ForbiddenException('Muassasa biriktirilmagan');
      const count = await this.prisma.consultation.count({
        where: { patientId: id, utId: user.facilityId },
      });
      if (!count) throw new ForbiddenException('Bu bemorni tahrirlash huquqi yo\'q');
      return;
    }

    throw new ForbiddenException('Bemor ma\'lumotlarini tahrirlash huquqi yo\'q');
  }
}
