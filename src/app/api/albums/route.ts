import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/firebaseAdmin";
import { createAlbum, listAlbums } from "@/lib/data";
import { handle } from "@/lib/apiRoute";

export const runtime = "nodejs";

export const GET = handle(async (req) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ albums: await listAlbums() });
});

export const POST = handle(async (req) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = (body?.title ?? "").trim();
  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const album = await createAlbum({ title, description: body?.description });
  return NextResponse.json({ album }, { status: 201 });
});
