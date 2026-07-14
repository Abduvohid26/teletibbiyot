import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { StartupValidationService } from '../common/startup-validation.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
        {
          provide: StorageService,
          useValue: { isAvailable: jest.fn().mockReturnValue(true) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'development';
              if (key === 'REDIS_URL') return 'redis://localhost:6379';
              if (key === 'S3_ENDPOINT') return 'http://localhost:9000';
              return undefined;
            }),
          },
        },
        {
          provide: StartupValidationService,
          useValue: { getChecks: jest.fn().mockReturnValue([]) },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok health payload', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.services?.database).toBe('up');
  });

  it('returns live probe', () => {
    expect(controller.live()).toEqual({ live: true });
  });
});
