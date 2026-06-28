import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/firebaseAdmin";
import {
  deleteAlbum,
  deletePhoto,
  getAlbum,
  listPhotos,
  updateAlbum,
} from "@/lib/data";
import { deleteObjects } from "@/lib/r2";
import { handle } from "@/lib/apiRoute";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (req, { params }) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const album = await getAlbum(id);
  if (!album)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const photos = await listPhotos(id);
  return NextResponse.json({ album, photos });
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await updateAlbum(id, {
    title: body?.title,
    description: body?.description,
    coverPhotoId: body?.coverPhotoId,
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle<Ctx>(async (req, { params }) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Remove all R2 objects for this album, then the Firestore docs.
  const photos = await listPhotos(id);
  await deleteObjects(photos.flatMap((p) => [p.key, p.thumbKey]));
  await Promise.all(photos.map((p) => deletePhoto(p)));
  await deleteAlbum(id);
  return NextResponse.json({ ok: true });
});
