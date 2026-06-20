import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { dirname, join } from 'path';
import type { Readable } from 'stream';

export interface StoredObject {
  key: string;
  checksumSha256: string;
  sizeBytes: number;
}

export interface StoredObjectContent {
  key: string;
  buffer: Buffer;
  contentType: string;
  sizeBytes: number;
}

type StorageDriver = 'local' | 's3' | 'firebase';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;
  private readonly localRoot: string;
  private readonly s3Bucket?: string;
  private readonly s3Client?: S3Client;
  private readonly firebaseBucketName?: string;

  constructor(private readonly config: ConfigService) {
    const explicit = this.config.get<string>('STORAGE_DRIVER')?.toLowerCase();
    const firebaseBucket = this.config.get<string>('FIREBASE_STORAGE_BUCKET');
    const s3Bucket = this.config.get<string>('AWS_S3_BUCKET');
    const s3AccessKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const s3SecretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (explicit === 'firebase' || (!explicit && firebaseBucket)) {
      this.driver = 'firebase';
      this.firebaseBucketName = firebaseBucket;
      this.localRoot = '';
      this.logger.log(
        `Storage driver: Firebase Storage${firebaseBucket ? ` (${firebaseBucket})` : ''}`,
      );
    } else if (explicit === 's3' || (!explicit && s3Bucket && s3AccessKey && s3SecretKey)) {
      this.driver = 's3';
      this.s3Bucket = s3Bucket;
      this.s3Client = new S3Client({
        region: this.config.get<string>('AWS_REGION') ?? 'ap-south-1',
        credentials: {
          accessKeyId: s3AccessKey!,
          secretAccessKey: s3SecretKey!,
        },
      });
      this.localRoot = '';
      this.logger.log('Storage driver: S3');
    } else if (explicit === 'local' || !explicit) {
      this.driver = 'local';
      this.localRoot =
        this.config.get<string>('STORAGE_LOCAL_PATH') ?? join(process.cwd(), 'storage');
      this.logger.log(`Storage driver: local (${this.localRoot})`);
    } else {
      throw new Error(`Unknown STORAGE_DRIVER: ${explicit}`);
    }
  }

  async putObject(key: string, buffer: Buffer, contentType: string): Promise<StoredObject> {
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    if (this.driver === 'firebase') {
      const bucket = this.getFirebaseBucket();
      await bucket.file(key).save(buffer, {
        contentType,
        resumable: false,
        metadata: { cacheControl: 'private, max-age=3600' },
      });
    } else if (this.driver === 's3') {
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    } else {
      const filePath = join(this.localRoot, key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer);
    }

    return {
      key,
      checksumSha256,
      sizeBytes: buffer.length,
    };
  }

  async getObject(key: string): Promise<StoredObjectContent> {
    if (this.driver === 'firebase') {
      const bucket = this.getFirebaseBucket();
      const file = bucket.file(key);
      const [exists] = await file.exists();
      if (!exists) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Stored file not found' });
      }

      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      return {
        key,
        buffer,
        contentType: metadata.contentType ?? this.guessContentType(key),
        sizeBytes: buffer.length,
      };
    }

    if (this.driver === 's3') {
      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
        }),
      );

      const body = response.Body;
      if (!body) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Stored file not found' });
      }

      const buffer = await this.streamToBuffer(body as Readable);
      return {
        key,
        buffer,
        contentType: response.ContentType ?? this.guessContentType(key),
        sizeBytes: buffer.length,
      };
    }

    const filePath = join(this.localRoot, key);
    try {
      await access(filePath, constants.F_OK);
    } catch {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Stored file not found' });
    }

    const buffer = await readFile(filePath);
    return {
      key,
      buffer,
      contentType: this.guessContentType(key),
      sizeBytes: buffer.length,
    };
  }

  createReadStream(key: string): Readable {
    if (this.driver !== 'local') {
      throw new Error('Streaming is only supported for local storage; use getObject');
    }

    const filePath = join(this.localRoot, key);
    return createReadStream(filePath);
  }

  private getFirebaseBucket() {
    if (!getApps().length) {
      throw new Error(
        'Firebase Admin is not initialized. Configure FIREBASE_* before using Firebase Storage.',
      );
    }

    const bucketName = this.firebaseBucketName;
    if (!bucketName) {
      throw new Error('FIREBASE_STORAGE_BUCKET is required when STORAGE_DRIVER=firebase');
    }

    return getStorage().bucket(bucketName);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private guessContentType(key: string): string {
    if (key.endsWith('.epub')) return 'application/epub+zip';
    if (key.endsWith('.pdf')) return 'application/pdf';
    if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
    if (key.endsWith('.png')) return 'image/png';
    if (key.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  }
}
