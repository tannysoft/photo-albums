// Firestore data access (server-only) for albums and photos.
import "server-only";
import { adminDb } from "./firebaseAdmin";
import type { Album, Photo } from "./types";

const ALBUMS = "albums";
const PHOTOS = "photos";

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
