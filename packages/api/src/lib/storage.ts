import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { mkdir, writeFile, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { env } from '../config/env.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  url: string;
  thumbnailUrl: string;
  key: string;
}

// ─── Storage driver interface ────────────────────────────────────────────────
interface StorageDriver {
  put(objectKey: string, body: Buffer, contentType: string): Promise<void>;
  remove(objectKey: string): Promise<void>;
  publicUrl(objectKey: string): string;
}

// ─── Disk driver (local dev — no external services) ──────────────────────────
class DiskStorageDriver implements StorageDriver {
  async put(objectKey: string, body: Buffer): Promise<void> {
    const filePath = join(env.UPLOAD_DIR, objectKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
  }

  async remove(objectKey: string): Promise<void> {
    const filePath = join(env.UPLOAD_DIR, objectKey);
    await rm(filePath, { force: true });
  }

  publicUrl(objectKey: string): string {
    return `${env.PUBLIC_UPLOAD_BASE_URL}/${objectKey}`;
  }
}

// ─── S3 driver (dev / production — real AWS S3 or MinIO via S3_ENDPOINT) ──────
class S3StorageDriver implements StorageDriver {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: env.S3_REGION,
      // Blank endpoint = real AWS S3. Set S3_ENDPOINT to use MinIO/localstack.
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
      // If keys are provided, use them; otherwise fall back to the instance/role
      // credentials chain (recommended on App Runner / ECS via IAM role).
      ...(env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } }
        : {}),
    });
  }

  async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async remove(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
  }

  publicUrl(objectKey: string): string {
    // Prefer a CloudFront/custom base URL when provided (production).
    if (env.S3_PUBLIC_BASE_URL) return `${env.S3_PUBLIC_BASE_URL}/${objectKey}`;
    if (env.S3_ENDPOINT) return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${objectKey}`;
    return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${objectKey}`;
  }
}

// ─── Select driver based on env ──────────────────────────────────────────────
const driver: StorageDriver =
  env.STORAGE_DRIVER === 'disk' ? new DiskStorageDriver() : new S3StorageDriver();

// ─── Public API (unchanged signatures — routes stay the same) ────────────────
export async function uploadProductImage(
  buffer: Buffer,
  mimeType: string,
  _originalName: string,
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error('File too large. Maximum size is 5 MB.');
  }

  const key = randomUUID();

  const fullBuffer = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  const thumbBuffer = await sharp(buffer)
    .resize({ width: 300, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const fullKey = `products/${key}/full.webp`;
  const thumbKey = `products/${key}/thumb.webp`;

  await driver.put(fullKey, fullBuffer, 'image/webp');
  await driver.put(thumbKey, thumbBuffer, 'image/webp');

  return {
    url: driver.publicUrl(fullKey),
    thumbnailUrl: driver.publicUrl(thumbKey),
    key,
  };
}

export async function deleteProductImage(key: string): Promise<void> {
  await driver.remove(`products/${key}/full.webp`);
  await driver.remove(`products/${key}/thumb.webp`);
}
