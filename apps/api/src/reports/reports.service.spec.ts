import { Readable } from 'stream';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';

/**
 * streamReport: so'ralgan tildagi Konsilium PDF saqlanmagan bo'lsa — asosiy (boshqa til)
 * fayl EMAS, aynan o'sha tilda tayyorlangan PDF qaytishi kerak.
 */
describe('ReportsService.streamReport — til bo‘yicha PDF', () => {
  const consultationId = '215ab83d-46b4-46c1-b3f3-6ab795a35cc2';
  const user = { id: 'op-1', role: UserRole.UT_OPERATOR, facilityId: 'fac-1' };
  const report = {
    id: 'rep-1',
    fileKey: `reports/${consultationId}/tashxis-215ab83d-uz.pdf`,
    fileName: 'tashxis-215ab83d-uz.pdf',
  };

  function makeService(existing: string[]) {
    const prisma = {
      consultation: {
        findUnique: jest.fn().mockResolvedValue({ id: consultationId, utId: 'fac-1', mtDoctorId: 'd1', status: 'COMPLETED' }),
      },
      consultationReport: { findUnique: jest.fn().mockResolvedValue(report) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const storage = {
      objectExists: jest.fn(async (key: string) => existing.includes(key)),
      getObjectStream: jest.fn(async (key: string) => ({ stream: Readable.from([key]), contentType: 'application/pdf' })),
    };
    const access = { assertConsultationAccess: jest.fn().mockResolvedValue(undefined) };
    const ai = {
      buildAnalysisPdf: jest.fn(async (_id: string, _u: unknown, locale: string) => ({
        buffer: Buffer.from(`generated-${locale}`),
        fileName: `tashxis-215ab83d-${locale}.pdf`,
      })),
    };
    const service = new ReportsService(
      prisma as never,
      storage as never,
      {} as never,
      access as never,
      {} as never,
      ai as never,
    );
    return { service, storage, ai };
  }

  it('saqlangan til fayli bo‘lsa — o‘sha fayl uzatiladi', async () => {
    const ruKey = `reports/${consultationId}/tashxis-215ab83d-ru.pdf`;
    const { service, storage, ai } = makeService([ruKey]);

    const res = await service.streamReport(consultationId, user, undefined, 'ru');

    expect(res.fileName).toBe('tashxis-215ab83d-ru.pdf');
    expect(storage.getObjectStream).toHaveBeenCalledWith(ruKey);
    expect(ai.buildAnalysisPdf).not.toHaveBeenCalled();
  });

  it('til fayli yo‘q bo‘lsa — asosiy (uz) emas, o‘sha tilda tayyorlanadi', async () => {
    const { service, storage, ai } = makeService([]);

    const res = await service.streamReport(consultationId, user, undefined, 'en');

    expect(res.fileName).toBe('tashxis-215ab83d-en.pdf');
    expect(ai.buildAnalysisPdf).toHaveBeenCalledWith(consultationId, user, 'en');
    expect(storage.getObjectStream).not.toHaveBeenCalled();
  });

  it('asosiy til so‘ralsa — hisobotdagi fayl qaytadi', async () => {
    const { service, storage } = makeService([]);

    const res = await service.streamReport(consultationId, user, undefined, 'uz');

    expect(res.fileName).toBe(report.fileName);
    expect(storage.getObjectStream).toHaveBeenCalledWith(report.fileKey);
  });
});
