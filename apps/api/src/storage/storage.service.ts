import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'crypto';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'application/dicom',
]);

const ALLOWED_EXT = [
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif',
  '.heic', '.heif', '.dcm', '.dicom',
];

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client | null = null;
  private bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('S3_BUCKET') || 'ishifo';
  }

  async onModuleInit() {
    const endpoint = this.config.get('S3_ENDPOINT');
    if (!endpoint) return;

    const accessKey = this.config.get('S3_ACCESS_KEY');
    const secretKey = this.config.get('S3_SECRET_KEY');
    const isProd = this.config.get('NODE_ENV') === 'production';

    if (isProd && (!accessKey || !secretKey)) {
      throw new Error('Production: S3_ACCESS_KEY va S3_SECRET_KEY majburiy');
    }

    try {
      const url = new URL(endpoint);
      const useSSL = this.config.get('S3_USE_SSL') === 'true' || url.protocol === 'https:';
      this.client = new Minio.Client({
        endPoint: url.hostname,
        port: url.port ? parseInt(url.port) : useSSL ? 443 : 80,
        useSSL,
        accessKey: accessKey || 'minioadmin',
        secretKey: secretKey || 'minioadmin123',
      });

      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket yaratildi: ${this.bucket}`);
      }
    } catch (err) {
      if (isProd) {
        throw new Error(`MinIO majburiy (production): ${err instanceof Error ? err.message : err}`);
      }
      this.logger.warn(`MinIO ulanmadi: ${err}`);
      this.client = null;
    }
  }

  isAvailable() {
    return !!this.client;
  }

  validateFile(file: Express.Multer.File) {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Error(`Ruxsat etilmagan fayl turi: ${ext}`);
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      if (file.mimetype !== 'application/octet-stream') {
        throw new Error(`Ruxsat etilmagan MIME: ${file.mimetype}`);
      }
    }
  }

  async upload(file: Express.Multer.File, folder = 'attachments') {
    if (!this.client) throw new Error('Fayl saqlash xizmati mavjud emas');
    this.validateFile(file);

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${randomUUID()}-${safeName}`;
    await this.client.putObject(this.bucket, key, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    return {
      key,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
    };
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string) {
    if (!this.client) throw new Error('Fayl saqlash xizmati mavjud emas');
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return key;
  }

  async getPresignedUrl(key: string, expirySeconds = 3600) {
    if (!this.client) throw new Error('Fayl saqlash xizmati mavjud emas');
    return this.client.presignedGetObject(this.bucket, this.resolveKey(key), expirySeconds);
  }

  async deleteObject(key: string) {
    if (!this.client || !key) return false;
    try {
      await this.client.removeObject(this.bucket, this.resolveKey(key));
      return true;
    } catch (err) {
      this.logger.warn(`S3 o'chirish xatosi (${key}): ${err}`);
      return false;
    }
  }

  /** Faylni to'liq xotiraga yuklamasdan oqim (stream) sifatida qaytaradi. */
  async getObjectStream(
    key: string,
  ): Promise<{ stream: NodeJS.ReadableStream; contentType: string; contentLength?: number }> {
    if (!this.client) throw new Error('Fayl saqlash xizmati mavjud emas');
    const resolved = this.resolveKey(key);
    let contentType = 'application/octet-stream';
    let contentLength: number | undefined;
    try {
      const stat = await this.client.statObject(this.bucket, resolved);
      contentType = stat.metaData?.['content-type'] || contentType;
      contentLength = stat.size;
    } catch {
      /* default */
    }
    const stream = await this.client.getObject(this.bucket, resolved);
    return { stream, contentType, contentLength };
  }

  async getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!this.client) throw new Error('Fayl saqlash xizmati mavjud emas');
    const resolved = this.resolveKey(key);
    const stream = await this.client.getObject(this.bucket, resolved);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    let contentType = 'application/octet-stream';
    try {
      const stat = await this.client.statObject(this.bucket, resolved);
      contentType = stat.metaData?.['content-type'] || contentType;
    } catch {
      /* default */
    }
    return { buffer: Buffer.concat(chunks), contentType };
  }

  /** fileUrl may be legacy full URL or storage key */
  resolveKey(fileUrl: string): string {
    if (!fileUrl.includes('://')) return fileUrl;
    const parts = fileUrl.split(`/${this.bucket}/`);
    return parts[1] || fileUrl;
  }
}
