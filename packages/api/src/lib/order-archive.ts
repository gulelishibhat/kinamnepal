import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { env } from '../config/env.js';

/**
 * Writes a JSON snapshot of a completed order to durable storage so orders are
 * retained independently of the database (audit / backup / offline access).
 *
 *   - dev/production (STORAGE_DRIVER=s3) → S3 object: orders/<orderNumber>.json
 *   - local          (STORAGE_DRIVER=disk) → file:  <UPLOAD_DIR>/orders/<orderNumber>.json
 *
 * Fire-and-forget: never throws to the caller so order completion is never
 * blocked by an archive failure.
 */

let s3: S3Client | null = null;
function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
      ...(env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } }
        : {}),
    });
  }
  return s3;
}

export function archiveOrder(orderNumber: string, snapshot: unknown): void {
  const key = `orders/${orderNumber}.json`;
  const body = JSON.stringify(snapshot, null, 2);

  void (async () => {
    try {
      if (env.STORAGE_DRIVER === 'disk') {
        const filePath = join(env.UPLOAD_DIR, key);
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, body, 'utf8');
      } else {
        await getS3().send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: body,
            ContentType: 'application/json',
          }),
        );
      }
    } catch (err) {
      // Never block order flow on archive failure — just log it.
      console.error(`[order-archive] failed to archive ${orderNumber}:`, err);
    }
  })();
}
