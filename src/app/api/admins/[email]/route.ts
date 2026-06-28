import { NextResponse } from "next/server";
import { verifyAdmin, ownerAdminEmails } from "@/lib/firebaseAdmin";
import { removeAdmin } from "@/lib/data";
import { handle } from "@/lib/apiRoute";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ email: string }> };

export const DELETE = handle<Ctx>(async (req, { params }) => {
  const me = await verifyAdmin(req);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await params;
  const target = decodeURIComponent(email).toLowerCase();

  // Owner admins (from ADMIN_EMAILS) are permanent and cannot be removed here.
  if (ownerAdminEmails().includes(target))
    return NextResponse.json(
      { error: "ลบเจ้าของระบบไม่ได้" },
      { status: 400 }
    );

  await removeAdmin(target);
  return NextResponse.json({ ok: true });
});
