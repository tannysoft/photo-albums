"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, useAuth } from "@/lib/useAuth";

interface AlbumStat {
  id: string;
  title: string;
  slug: string;
  photoCount: number;
  views: number;
  downloads: number;
}
interface TopPhotoStat {
  id: string;
  fileName: string;
  thumbUrl: string;
  albumTitle: string;
  downloadCount: number;
}
interface Stats {
  totals: { albums: number; photos: number; views: number; downloads: number };
  albums: AlbumStat[];
  topPhotos: TopPhotoStat[];
}

export default function StatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/admin/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await apiFetch("/api/stats");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดสถิติไม่สำเร็จ");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  function exportCsv() {
    if (!stats) return;
    const rows = [
      ["อัลบั้ม", "จำนวนรูป", "ยอดเข้าชม", "ยอดดาวน์โหลด"],
      ...stats.albums.map((a) => [
        a.title,
        String(a.photoCount),
        String(a.views),
        String(a.downloads),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    // BOM so Excel reads Thai (UTF-8) correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "photo-albums-stats.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      <Link
        href="/admin"
        className="text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        ← กลับไปหน้าอัลบั้ม
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">สถิติ</h1>
        <button
          onClick={exportCsv}
          disabled={!stats}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm transition hover:bg-neutral-900 disabled:opacity-50"
        >
          ดาวน์โหลด CSV
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {fetching || !stats ? (
        <p className="mt-8 text-neutral-500">กำลังโหลดสถิติ…</p>
      ) : (
        <>
          {/* Totals */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="อัลบั้ม" value={stats.totals.albums} />
            <Stat label="รูปทั้งหมด" value={stats.totals.photos} />
            <Stat label="ยอดเข้าชม" value={stats.totals.views} />
            <Stat label="ยอดดาวน์โหลด" value={stats.totals.downloads} />
          </div>

          {/* Per-album table */}
          <h2 className="mt-10 mb-3 text-lg font-medium">ต่ออัลบั้ม</h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900/60 text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">อัลบั้ม</th>
                  <th className="px-4 py-2.5 text-right font-medium">รูป</th>
                  <th className="px-4 py-2.5 text-right font-medium">เข้าชม</th>
                  <th className="px-4 py-2.5 text-right font-medium">ดาวน์โหลด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {stats.albums.map((a) => (
                  <tr key={a.id} className="transition hover:bg-neutral-900/40">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/albums/${a.id}`}
                        className="hover:underline"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-400">
                      {a.photoCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-400">
                      {a.views}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {a.downloads}
                    </td>
                  </tr>
                ))}
                {stats.albums.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-neutral-500">
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Top downloaded photos */}
          <h2 className="mt-10 mb-3 text-lg font-medium">รูปที่ถูกโหลดมากสุด</h2>
          {stats.topPhotos.length === 0 ? (
            <p className="text-neutral-500">ยังไม่มีการดาวน์โหลด</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {stats.topPhotos.map((p) => (
                <div
                  key={p.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-neutral-900"
                  title={`${p.albumTitle} · ${p.fileName}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl}
                    alt={p.fileName}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                    ⬇ {p.downloadCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}
