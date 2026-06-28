"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicPhoto } from "@/lib/types";

const PAGE_SIZE = 36; // photos rendered per batch (infinite scroll)

export default function Gallery({
  slug,
  title,
  description,
  photos,
}: {
  slug: string;
  title: string;
  description?: string;
  photos: PublicPhoto[];
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadingOne, setDownloadingOne] = useState(false);
  const [lightbox, setLightbox] = useState<PublicPhoto | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: "add" | "remove"; moved: boolean } | null>(
    null
  );
  // Set when a drag-select happened, so the click that follows doesn't undo it.
  const suppressClickRef = useRef(false);

  const allSelected = selected.size === photos.length && photos.length > 0;

  const applyTo = useCallback((id: string, mode: "add" | "remove") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "add") next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Infinite scroll: load the next batch when the sentinel nears the viewport.
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

  // End any in-progress drag selection globally.
  useEffect(() => {
    const end = () => (dragRef.current = null);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  function enterSelect() {
    setSelectMode(true);
  }
  function cancelSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id)));
  }

  // Click / tap to select (works on both desktop and mobile).
  function onTileClick(photo: PublicPhoto) {
    // Ignore the click synthesized at the end of a drag-select.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (selectMode) toggle(photo.id);
    else setLightbox(photo);
  }

  // Optional mouse drag-to-select (iPhone-style swipe). A plain click is left
  // to onTileClick; we only start dragging once the pointer actually moves.
  function onTilePointerDown(e: React.PointerEvent, photo: PublicPhoto) {
    if (!selectMode || e.pointerType !== "mouse") return;
    suppressClickRef.current = false;
    dragRef.current = {
      mode: selected.has(photo.id) ? "remove" : "add",
      moved: false,
    };
  }
  function onGridPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const id = el?.closest<HTMLElement>("[data-photo-id]")?.dataset.photoId;
    if (!id) return;
    // First movement turns this into a drag — suppress the trailing click.
    if (!drag.moved) {
      drag.moved = true;
      suppressClickRef.current = true;
    }
    applyTo(id, drag.mode);
  }

  async function download() {
    if (!selected.size || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, photoIds: [...selected] }),
      });
      if (!res.ok) throw new Error("download failed");

      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        // Single photo → presigned attachment URL.
        const { url } = await res.json();
        triggerDownload(url);
      } else {
        // Multiple → ZIP blob.
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${title || "album"}.zip`);
        URL.revokeObjectURL(url);
      }
    } catch {
      alert("ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDownloading(false);
    }
  }

  // Download the single photo currently shown in the lightbox.
  async function downloadOne(photo: PublicPhoto) {
    if (downloadingOne) return;
    setDownloadingOne(true);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, photoIds: [photo.id] }),
      });
      if (!res.ok) throw new Error("download failed");
      const { url } = await res.json();
      triggerDownload(url, photo.fileName);
    } catch {
      alert("ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDownloadingOne(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-neutral-400">{description}</p>
          )}
          <p className="mt-1 text-sm text-neutral-500">{photos.length} รูป</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {selectMode && (
            <button
              onClick={toggleSelectAll}
              className="rounded-full border border-neutral-700 px-3.5 py-1.5 text-sm transition hover:bg-neutral-900"
            >
              {allSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
            </button>
          )}
          <button
            onClick={selectMode ? cancelSelect : enterSelect}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            {selectMode ? "ยกเลิก" : "เลือก"}
          </button>
        </div>
      </header>

      {photos.length === 0 ? (
        <p className="mt-16 text-center text-neutral-500">
          ยังไม่มีรูปในอัลบั้มนี้
        </p>
      ) : (
        <>
        <div
          onPointerMove={onGridPointerMove}
          className="columns-2 gap-1.5 sm:columns-3 sm:gap-2 md:columns-4"
        >
          {photos.slice(0, visibleCount).map((p) => {
            const isSel = selected.has(p.id);
            return (
              <button
                key={p.id}
                data-photo-id={p.id}
                onClick={() => onTileClick(p)}
                onPointerDown={(e) => onTilePointerDown(e, p)}
                className="group relative mb-1.5 block w-full break-inside-avoid overflow-hidden rounded-lg bg-neutral-900 focus:outline-none sm:mb-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbUrl}
                  alt={p.fileName}
                  loading="lazy"
                  draggable={false}
                  width={p.width}
                  height={p.height}
                  className={`h-auto w-full transition ${
                    isSel ? "brightness-75" : ""
                  }`}
                />
                {selectMode && (
                  <span
                    className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs ${
                      isSel
                        ? "border-sky-400 bg-sky-500 text-white"
                        : "border-white/80 bg-black/30"
                    }`}
                  >
                    {isSel ? "✓" : ""}
                  </span>
                )}
              </button>
            );
          })}
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

      {/* Bottom action bar */}
      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <span className="text-sm text-neutral-300">
              เลือกแล้ว {selected.size} รูป
            </span>
            <button
              onClick={download}
              disabled={!selected.size || downloading}
              className="rounded-full bg-sky-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-40"
            >
              {downloading ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลด"}
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.fileName}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />

          {/* Top bar: close + download */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(null);
              }}
              aria-label="ปิด"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white backdrop-blur transition hover:bg-white/20"
            >
              ✕
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadOne(lightbox);
              }}
              disabled={downloadingOne}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {downloadingOne ? (
                "กำลังเตรียมไฟล์…"
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  ดาวน์โหลด
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function triggerDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
