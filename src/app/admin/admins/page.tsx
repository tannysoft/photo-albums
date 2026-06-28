"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, useAuth } from "@/lib/useAuth";

interface AdminRecord {
  email: string;
  addedBy: string;
  addedAt: number;
}

export default function AdminsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [owners, setOwners] = useState<string[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [me, setMe] = useState("");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/admin/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await apiFetch("/api/admins");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      setOwners(data.owners ?? []);
      setAdmins(data.admins ?? []);
      setMe(data.me ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดรายชื่อไม่สำเร็จ");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: password || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "เพิ่มไม่สำเร็จ");
      setEmail("");
      setPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(target: string) {
    if (!confirm(`ลบสิทธิ์ admin ของ ${target}?`)) return;
    setError("");
    try {
      const res = await apiFetch(`/api/admins/${encodeURIComponent(target)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      setAdmins((prev) => prev.filter((a) => a.email !== target));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        กำลังโหลด…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        ← กลับไปหน้าอัลบั้ม
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">จัดการ Admin</h1>
      <p className="mt-1 text-sm text-neutral-500">
        ผู้ที่อยู่ในรายชื่อนี้สามารถสร้างอัลบั้มและอัปโหลดรูปได้
      </p>

      {/* Add form */}
      <form
        onSubmit={addAdmin}
        className="mt-6 space-y-3 rounded-xl border border-neutral-800 bg-neutral-950 p-5"
      >
        <h2 className="text-sm font-medium text-neutral-300">เพิ่ม Admin ใหม่</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          />
          <input
            type="text"
            placeholder="รหัสผ่านเริ่มต้น (ถ้ายังไม่มีบัญชี)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {saving ? "กำลังเพิ่ม…" : "เพิ่ม"}
          </button>
        </div>
        <p className="text-xs text-neutral-600">
          ใส่รหัสผ่านถ้าต้องการให้ระบบสร้างบัญชีใหม่ให้เลย — ถ้าผู้ใช้มีบัญชีอยู่แล้ว
          เว้นว่างไว้ได้
        </p>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-800">
        {fetching ? (
          <p className="p-5 text-sm text-neutral-500">กำลังโหลด…</p>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {owners.map((o) => (
              <li
                key={o}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <span className="truncate text-sm">
                  {o}
                  {o === me && (
                    <span className="ml-2 text-xs text-neutral-500">(คุณ)</span>
                  )}
                </span>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-400">
                  เจ้าของระบบ
                </span>
              </li>
            ))}
            {admins.map((a) => (
              <li
                key={a.email}
                className="flex items-center justify-between gap-3 px-5 py-3.5"
              >
                <span className="truncate text-sm">
                  {a.email}
                  {a.email === me && (
                    <span className="ml-2 text-xs text-neutral-500">(คุณ)</span>
                  )}
                </span>
                <button
                  onClick={() => removeAdmin(a.email)}
                  className="shrink-0 rounded-lg border border-red-900/60 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-950/40"
                >
                  ลบสิทธิ์
                </button>
              </li>
            ))}
            {!owners.length && !admins.length && (
              <li className="px-5 py-4 text-sm text-neutral-500">
                ยังไม่มีรายชื่อ
              </li>
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
