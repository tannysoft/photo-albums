import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/firebaseAdmin";
import { getPhotos, deletePhoto } from "@/lib/data";
import { deleteObjects } from "@/lib/r2";
import { handle } from "@/lib/apiRoute";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle<Ctx>(async (req, { params }) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [photo] = await getPhotos([id]);
  if (!photo)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteObjects([photo.key, photo.thumbKey]);
  await deletePhoto(photo);
  return NextResponse.json({ ok: true });
});
