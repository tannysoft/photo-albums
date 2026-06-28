"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, useAuth } from "@/lib/useAuth";
import { imgUrl } from "@/lib/imgUrl";
import type { Album, Photo } from "@/lib/types";

const PAGE_SIZE = 36; // photos rendered per batch (infinite scroll)
const ROW_HEIGHT = 160; // target row height (px); lower = more photos per row

export default function AlbumDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const fileInput = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/admin/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await apiFetch(`/api/albums/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAlbum(data.album);
        setPhotos(data.photos ?? []);
      }
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (album) setShareUrl(`${window.location.origin}/a/${album.slug}`);
  }, [album]);

  // Infinite scroll: reveal the next batch as the sentinel nears the viewport.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, photos.length));
        }
      },
      { rootMargin: "800px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [photos.length, visibleCount]);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append("albumId", id);
      fd.append("file", files[i]);
      try {
        const res = await apiFetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const { photo } = await res.json();
          setPhotos((prev) => [...prev, photo]);
          setVisibleCount((c) => c + 1); // keep new uploads visible
        }
      } catch {
        /* keep going on individual failures */
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("ลบรูปนี้?")) return;
    const res = await apiFetch(`/api/photos/${photoId}`, { method: "DELETE" });
    if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  async function deleteAlbum() {
    if (!confirm("ลบทั้งอัลบั้มและรูปทั้งหมด? ย้อนกลับไม่ได้")) return;
    const res = await apiFetch(`/api/albums/${id}`, { method: "DELETE" });
    if (res.ok) router.replace("/admin");
  }

  function copyShare() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        กำลังโหลด…
      </main>
    );
  }

  if (!album) {
    return (
      <main className="flex min-h-screen items-center justify-center text-neutral-500">
        ไม่พบอัลบั้ม
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/admin"
        className="text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        ← กลับไปหน้าอัลบั้ม
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{album.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {photos.length} รูป · เข้าชม {album.viewCount ?? 0} ครั้ง ·
            ดาวน์โหลดรวม{" "}
            {photos.reduce((sum, p) => sum + (p.downloadCount ?? 0), 0)} ครั้ง
          </p>
        </div>
        <button
          onClick={deleteAlbum}
          className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950/40"
        >
          ลบอัลบั้ม
        </button>
      </header>

      {/* Share link */}
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
        <span className="text-sm text-neutral-500">ลิงก์สำหรับลูกค้า:</span>
        <a
          href={shareUrl}
          target="_blank"
          className="flex-1 truncate text-sm text-sky-400 hover:underline"
        >
          {shareUrl}
        </a>
        <button
          onClick={copyShare}
          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm transition hover:bg-neutral-700"
        >
          {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
        </button>
      </div>

      {/* Upload */}
      <div className="mt-5">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={onFilesSelected}
          disabled={uploading}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200 ${
            uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading
            ? `กำลังอัปโหลด ${progress.done}/${progress.total}…`
            : "+ อัปโหลดรูป"}
        </label>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <p className="mt-10 text-neutral-500">ยังไม่มีรูปในอัลบั้มนี้</p>
      ) : (
        <>
        <div className="mt-6 flex flex-wrap gap-2">
          {photos.slice(0, visibleCount).map((p) => {
            const ar = p.width && p.height ? p.width / p.height : 1;
            return (
            <div
              key={p.id}
              style={{ flexGrow: ar, flexBasis: `${ar * ROW_HEIGHT}px` }}
              className="group relative overflow-hidden rounded-lg bg-neutral-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl(p.thumbKey)}
                alt={p.fileName}
                loading="lazy"
                width={p.width}
                height={p.height}
                className="block h-auto w-full"
              />
              <button
                onClick={() => deletePhoto(p.id)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-1 text-xs opacity-0 transition group-hover:opacity-100"
              >
                ลบ
              </button>
              {/* Download count (admin-only view) */}
              <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {p.downloadCount ?? 0}
              </span>
            </div>
            );
          })}
          {/* Absorbs leftover space so the last row keeps natural sizes. */}
          <span aria-hidden style={{ flexGrow: 999, flexBasis: 0 }} />
        </div>

        {/* Infinite-scroll sentinel + progress */}
        {visibleCount < photos.length && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-8 text-sm text-neutral-500"
          >
            กำลังโหลดเพิ่ม… ({visibleCount}/{photos.length})
          </div>
        )}
        </>
      )}
    </main>
  );
}
