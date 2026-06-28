import { notFound } from "next/navigation";
import { getAlbumBySlug, listPhotos, incrementAlbumView } from "@/lib/data";
import { publicUrl } from "@/lib/r2";
import type { PublicPhoto } from "@/lib/types";
import Gallery from "./Gallery";

export const dynamic = "force-dynamic";

// Route params with non-ASCII (e.g. Thai) characters may arrive percent-encoded
// in some runtimes. Decoding is idempotent for our slugs (which never contain a
// literal "%"), so this is safe whether or not the param was already decoded.
function decodeSlug(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const album = await getAlbumBySlug(decodeSlug(slug));
  return { title: album ? `${album.title} — Photo Albums` : "Album" };
}

export default async function PublicAlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decodedSlug = decodeSlug(slug);
  const album = await getAlbumBySlug(decodedSlug);
  if (!album) notFound();

  await incrementAlbumView(album.id);
  const photos = await listPhotos(album.id);
  const publicPhotos: PublicPhoto[] = photos.map((p) => ({
    id: p.id,
    fileName: p.fileName,
    url: publicUrl(p.key),
    thumbUrl: publicUrl(p.thumbKey),
    width: p.width,
    height: p.height,
  }));

  return (
    <Gallery
      slug={decodedSlug}
      title={album.title}
      description={album.description}
      photos={publicPhotos}
    />
  );
}
