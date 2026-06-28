"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, useAuth } from "@/lib/useAuth";
import type { Album } from "@/lib/types";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/admin/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await apiFetch("/api/albums");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      setAlbums(data.albums ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดอัลบั้มไม่สำเร็จ");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (data.album) {
        setTitle("");
        router.push(`/admin/albums/${data.album.id}`);
      }
    } finally {
      setCreating(false);
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">อัลบั้มทั้งหมด</h1>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <span className="hidden sm:inline">{user.email}</span>
          <Link
            href="/admin/admins"
            className="rounded-lg border border-neutral-800 px-3 py-1.5 transition hover:bg-neutral-900"
          >
            จัดการ Admin
          </Link>
          <button
            onClick={logout}
            className="rounded-lg border border-neutral-800 px-3 py-1.5 transition hover:bg-neutral-900"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      <form onSubmit={createAlbum} className="mb-8 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่ออัลบั้มใหม่ เช่น Wedding คุณA & คุณB"
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-50"
        >
          + สร้างอัลบั้ม
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {fetching ? (
        <p className="text-neutral-500">กำลังโหลดอัลบั้ม…</p>
      ) : albums.length === 0 ? (
        <p className="text-neutral-500">ยังไม่มีอัลบั้ม สร้างอัลบั้มแรกได้เลย</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/albums/${a.id}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-neutral-600"
              >
                <h2 className="truncate font-medium">{a.title}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {a.photoCount} รูป
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
