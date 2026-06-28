import { notFound } from "next/navigation";
import { getAlbumBySlug, listPhotos } from "@/lib/data";
import { publicUrl } from "@/lib/r2";
import type { PublicPhoto } from "@/lib/types";
import Gallery from "./Gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  return { title: album ? `${album.title} — Photo Albums` : "Album" };
}

export default async function PublicAlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) notFound();

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
      slug={slug}
      title={album.title}
      description={album.description}
      photos={publicPhotos}
    />
  );
}
