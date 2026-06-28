import { NextResponse } from "next/server";
import sharp from "sharp";
import { verifyAdmin } from "@/lib/firebaseAdmin";
import { addPhoto, getAlbum } from "@/lib/data";
import { putObject } from "@/lib/r2";
import { handle } from "@/lib/apiRoute";

export const runtime = "nodejs";
// Allow larger request bodies for photo uploads.
export const maxDuration = 60;

const THUMB_WIDTH = 600; // px — long edge for grid thumbnails

function extFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic" || contentType === "image/heif")
    return "jpg"; // converted below
  return "jpg";
}

export const POST = handle(async (req) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const albumId = String(form.get("albumId") ?? "");
  const file = form.get("file");

  if (!albumId)
    return NextResponse.json({ error: "albumId is required" }, { status: 400 });
  if (!(file instanceof File))
    return NextResponse.json({ error: "file is required" }, { status: 400 });

  const album = await getAlbum(albumId);
  if (!album)
    return NextResponse.json({ error: "Album not found" }, { status: 404 });

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const pipeline = sharp(inputBuffer, { failOn: "none" }).rotate(); // honor EXIF orientation
  const meta = await pipeline.metadata();

  // Normalize HEIC/HEIF to JPEG so browsers can display it.
  const isHeic = /heic|heif/i.test(file.type);
  let fullBuffer: Buffer;
  let contentType = file.type || "image/jpeg";
  if (isHeic) {
    fullBuffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
    contentType = "image/jpeg";
  } else {
    fullBuffer = inputBuffer;
  }

  // Thumbnail: always JPEG, resized to a sane grid size.
  const thumbBuffer = await sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: THUMB_WIDTH,
      height: THUMB_WIDTH,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75 })
    .toBuffer();

  const id = crypto.randomUUID();
  const ext = extFor(contentType);
  const key = `albums/${albumId}/${id}.${ext}`;
  const thumbKey = `albums/${albumId}/${id}_thumb.jpg`;

  await Promise.all([
    putObject(key, fullBuffer, contentType),
    putObject(thumbKey, thumbBuffer, "image/jpeg"),
  ]);

  const photo = await addPhoto({
    albumId,
    fileName: file.name || `${id}.${ext}`,
    key,
    thumbKey,
    contentType,
    size: fullBuffer.length,
    width: meta.width,
    height: meta.height,
    downloadCount: 0,
    createdAt: Date.now(),
  });

  return NextResponse.json({ photo }, { status: 201 });
});
