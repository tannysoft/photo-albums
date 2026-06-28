import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/firebaseAdmin";
import { getStats } from "@/lib/data";
import { handle } from "@/lib/apiRoute";

export const runtime = "nodejs";

export const GET = handle(async (req) => {
  if (!(await verifyAdmin(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getStats());
});
