import { NextResponse } from "next/server";
import archiver from "archiver";
import { Readable } from "node:stream";
import { getAlbumBySlug, getPhotos } from "@/lib/data";
import { getObjectStream, presignGet } from "@/lib/r2";
import { handle } from "@/lib/apiRoute";
import type { Photo } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Public download endpoint. Body: { slug, photoIds: string[] }.
 * Photos are validated to belong to the album identified by `slug`.
 * One photo → redirect to a presigned attachment URL. Many → stream a ZIP.
 */
export const POST = handle(async (req) => {
  const body = await req.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const photoIds: string[] = Array.isArray(body?.photoIds) ? body.photoIds : [];

  if (!slug || !photoIds.length)
    return NextResponse.json(
      { error: "slug and photoIds required" },
      { status: 400 }
    );

  const album = await getAlbumBySlug(slug);
  if (!album)
    return NextResponse.json({ error: "Album not found" }, { status: 404 });

  // Only allow photos that actually belong to this album.
  const photos = (await getPhotos(photoIds)).filter(
    (p) => p.albumId === album.id
  );
  if (!photos.length)
    return NextResponse.json({ error: "No valid photos" }, { status: 400 });

  if (photos.length === 1) {
    const url = await presignGet(photos[0].key, {
      downloadName: photos[0].fileName,
    });
    return NextResponse.json({ url });
  }

  return streamZip(photos, `${album.title || "album"}.zip`);
});

function streamZip(photos: Photo[], zipName: string): Response {
  const archive = archiver("zip", { zlib: { level: 0 } }); // photos already compressed
  const seen = new Map<string, number>();

  // Append each object stream as it's pulled from R2.
  (async () => {
    try {
      for (const p of photos) {
        const stream = await getObjectStream(p.key);
        archive.append(stream as Readable, {
          name: uniqueName(seen, p.fileName),
        });
      }
      await archive.finalize();
    } catch (err) {
      archive.abort();
      console.error("zip error", err);
    }
  })();

  const webStream = Readable.toWeb(archive) as unknown as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        zipName
      )}"`,
    },
  });
}

/** Avoid clobbering files that share a name within the same ZIP. */
function uniqueName(seen: Map<string, number>, name: string): string {
  const count = seen.get(name) ?? 0;
  seen.set(name, count + 1);
  if (count === 0) return name;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name} (${count})`;
  return `${name.slice(0, dot)} (${count})${name.slice(dot)}`;
}
