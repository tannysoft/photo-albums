import { NextResponse } from "next/server";
import {
  verifyAdmin,
  ownerAdminEmails,
  adminAuth,
} from "@/lib/firebaseAdmin";
import { listAdmins, addAdmin } from "@/lib/data";
import { handle } from "@/lib/apiRoute";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GET = handle(async (req) => {
  const me = await verifyAdmin(req);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    owners: ownerAdminEmails(),
    admins: await listAdmins(),
    me: me.email,
  });
});

export const POST = handle(async (req) => {
  const me = await verifyAdmin(req);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = body?.password ? String(body.password) : "";

  if (!EMAIL_RE.test(email))
    return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });

  // Optionally create a Firebase Auth account so the new admin can sign in.
  if (password) {
    if (password.length < 6)
      return NextResponse.json(
        { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
        { status: 400 }
      );
    try {
      await adminAuth.createUser({ email, password });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/email-already-exists") throw e; // already exists is fine
    }
  }

  await addAdmin(email, me.email);
  return NextResponse.json({ ok: true }, { status: 201 });
});
