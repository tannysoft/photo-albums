// Cloudflare R2 access via the S3-compatible API.
import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const R2_BUCKET = process.env.R2_BUCKET || "photo-albums";
/** Optional public base URL (custom domain / r2.dev) for direct image serving. */
export const R2_PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || ""
).replace(/\/$/, "");

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId ?? "",
    secretAccessKey: secretAccessKey ?? "",
  },
});

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Stream an object out of R2 (used by the zip download route). */
export async function getObjectStream(key: string) {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );
  return res.Body as NodeJS.ReadableStream;
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (!keys.length) return;
  // DeleteObjects handles max 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      })
    );
  }
}

/**
 * Presigned GET URL for a private object. `downloadName` forces a
 * Content-Disposition: attachment so the browser downloads instead of viewing.
 */
export async function presignGet(
  key: string,
  opts: { downloadName?: string; expiresIn?: number } = {}
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ...(opts.downloadName
      ? {
          ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
            opts.downloadName
          )}"`,
        }
      : {}),
  });
  return getSignedUrl(r2, command, { expiresIn: opts.expiresIn ?? 3600 });
}

/**
 * Resolve a public-facing URL for an object key. Uses the public base URL when
 * configured (cacheable, fast); otherwise routes through our presign endpoint.
 */
export function publicUrl(key: string): string {
  if (R2_PUBLIC_BASE_URL) return `${R2_PUBLIC_BASE_URL}/${key}`;
  return `/api/r2/${key.split("/").map(encodeURIComponent).join("/")}`;
}
