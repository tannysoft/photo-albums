// Firestore data access (server-only) for albums and photos.
import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { publicUrl } from "./r2";
import type { Album, Photo } from "./types";

const ALBUMS = "albums";
const PHOTOS = "photos";
const ADMINS = "admins";

export interface AdminRecord {
  email: string;
  addedBy: string;
  addedAt: number;
}

export async function listAdmins(): Promise<AdminRecord[]> {
  const snap = await adminDb.collection(ADMINS).orderBy("addedAt", "asc").get();
  return snap.docs.map((d) => d.data() as AdminRecord);
}

export async function addAdmin(email: string, addedBy: string): Promise<void> {
  const e = email.toLowerCase();
  await adminDb
    .collection(ADMINS)
    .doc(e)
    .set({ email: e, addedBy, addedAt: Date.now() }, { merge: true });
}

export async function removeAdmin(email: string): Promise<void> {
  await adminDb.collection(ADMINS).doc(email.toLowerCase()).delete();
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9฀-๿]+/g, "-") // keep Thai chars + alnum
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  // Short random suffix keeps links unguessable and avoids collisions.
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : suffix;
}

export async function listAlbums(): Promise<Album[]> {
  const snap = await adminDb
    .collection(ALBUMS)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Album);
}

export async function getAlbum(id: string): Promise<Album | null> {
  const doc = await adminDb.collection(ALBUMS).doc(id).get();
  return doc.exists ? ({ id: doc.id, ...doc.data() }) as Album : null;
}

export async function getAlbumBySlug(slug: string): Promise<Album | null> {
  const snap = await adminDb
    .collection(ALBUMS)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Album;
}

export async function createAlbum(input: {
  title: string;
  description?: string;
}): Promise<Album> {
  const now = Date.now();
  const album: Omit<Album, "id"> = {
    title: input.title,
    description: input.description ?? "",
    slug: slugify(input.title),
    photoCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await adminDb.collection(ALBUMS).add(album);
  return { id: ref.id, ...album };
}

export async function updateAlbum(
  id: string,
  patch: Partial<Pick<Album, "title" | "description" | "coverPhotoId">>
): Promise<void> {
  await adminDb
    .collection(ALBUMS)
    .doc(id)
    .update({ ...patch, updatedAt: Date.now() });
}

export async function deleteAlbum(id: string): Promise<void> {
  await adminDb.collection(ALBUMS).doc(id).delete();
}

/** Best-effort increment of an album's public view counter. */
export async function incrementAlbumView(albumId: string): Promise<void> {
  try {
    await adminDb
      .collection(ALBUMS)
      .doc(albumId)
      .update({ viewCount: FieldValue.increment(1) });
  } catch {
    /* never let analytics break the page */
  }
}

export interface AlbumStat {
  id: string;
  title: string;
  slug: string;
  photoCount: number;
  views: number;
  downloads: number;
}

export interface TopPhotoStat {
  id: string;
  fileName: string;
  thumbUrl: string;
  albumTitle: string;
  downloadCount: number;
}

export interface Stats {
  totals: { albums: number; photos: number; views: number; downloads: number };
  albums: AlbumStat[];
  topPhotos: TopPhotoStat[];
}

/** Aggregate analytics across all albums and photos (admin dashboard). */
export async function getStats(): Promise<Stats> {
  const [albumsSnap, photosSnap] = await Promise.all([
    adminDb.collection(ALBUMS).get(),
    adminDb.collection(PHOTOS).get(),
  ]);
  const albums = albumsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Album);
  const photos = photosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Photo);

  const titleById = new Map(albums.map((a) => [a.id, a.title]));
  const downloadsByAlbum = new Map<string, number>();
  for (const p of photos) {
    downloadsByAlbum.set(
      p.albumId,
      (downloadsByAlbum.get(p.albumId) ?? 0) + (p.downloadCount ?? 0)
    );
  }

  const albumStats: AlbumStat[] = albums
    .map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      photoCount: a.photoCount ?? 0,
      views: a.viewCount ?? 0,
      downloads: downloadsByAlbum.get(a.id) ?? 0,
    }))
    .sort((x, y) => y.downloads - x.downloads);

  const topPhotos: TopPhotoStat[] = photos
    .filter((p) => (p.downloadCount ?? 0) > 0)
    .sort((x, y) => (y.downloadCount ?? 0) - (x.downloadCount ?? 0))
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      fileName: p.fileName,
      thumbUrl: publicUrl(p.thumbKey),
      albumTitle: titleById.get(p.albumId) ?? "—",
      downloadCount: p.downloadCount ?? 0,
    }));

  return {
    totals: {
      albums: albums.length,
      photos: photos.length,
      views: albums.reduce((s, a) => s + (a.viewCount ?? 0), 0),
      downloads: photos.reduce((s, p) => s + (p.downloadCount ?? 0), 0),
    },
    albums: albumStats,
    topPhotos,
  };
}

export async function listPhotos(albumId: string): Promise<Photo[]> {
  const snap = await adminDb
    .collection(PHOTOS)
    .where("albumId", "==", albumId)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Photo);
}

export async function getPhotos(ids: string[]): Promise<Photo[]> {
  if (!ids.length) return [];
  const refs = ids.map((id) => adminDb.collection(PHOTOS).doc(id));
  const docs = await adminDb.getAll(...refs);
  return docs
    .filter((d) => d.exists)
    .map((d) => ({ id: d.id, ...d.data() }) as Photo);
}

export async function addPhoto(photo: Omit<Photo, "id">): Promise<Photo> {
  const ref = await adminDb.collection(PHOTOS).add(photo);
  await bumpPhotoCount(photo.albumId, 1);
  return { id: ref.id, ...photo };
}

/** Atomically increment the download counter for the given photos. */
export async function incrementDownloads(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = adminDb.batch();
  for (const id of ids) {
    batch.update(adminDb.collection(PHOTOS).doc(id), {
      downloadCount: FieldValue.increment(1),
    });
  }
  await batch.commit();
}

export async function deletePhoto(photo: Photo): Promise<void> {
  await adminDb.collection(PHOTOS).doc(photo.id).delete();
  await bumpPhotoCount(photo.albumId, -1);
}

async function bumpPhotoCount(albumId: string, delta: number): Promise<void> {
  const ref = adminDb.collection(ALBUMS).doc(albumId);
  await adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return;
    const current = (doc.data()?.photoCount ?? 0) as number;
    tx.update(ref, {
      photoCount: Math.max(0, current + delta),
      updatedAt: Date.now(),
    });
  });
}
