import { NextResponse } from "next/server";
import { presignGet } from "@/lib/r2";

export const runtime = "nodejs";

type Params = { params: Promise<{ key: string[] }> };

/**
 * Public image proxy: redirects to a short-lived presigned URL so a private R2
 * bucket can still serve thumbnails/full images directly to the browser.
 * Used only when NEXT_PUBLIC_R2_PUBLIC_BASE_URL is not configured.
 */
export async function GET(req: Request, { params }: Params) {
  const { key } = await params;
  const objectKey = key.map(decodeURIComponent).join("/");
  const url = new URL(req.url);
  const downloadName = url.searchParams.get("download") || undefined;

  const signed = await presignGet(objectKey, {
    downloadName,
    expiresIn: 3600,
  });
  return NextResponse.redirect(signed, {
    headers: { "Cache-Control": "private, max-age=600" },
  });
}
