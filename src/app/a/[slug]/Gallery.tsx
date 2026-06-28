"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicPhoto } from "@/lib/types";

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
  const [lightbox, setLightbox] = useState<PublicPhoto | null>(null);
  const dragRef = useRef<{ mode: "add" | "remove" } | null>(null);

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

  function onTileClick(photo: PublicPhoto) {
    if (selectMode) toggle(photo.id);
    else setLightbox(photo);
  }

  // Mouse drag-to-select (iPhone-style swipe selection on desktop).
  function onTilePointerDown(e: React.PointerEvent, photo: PublicPhoto) {
    if (!selectMode || e.pointerType !== "mouse") return;
    const mode: "add" | "remove" = selected.has(photo.id) ? "remove" : "add";
    dragRef.current = { mode };
    applyTo(photo.id, mode);
  }
  function onGridPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tile = el?.closest<HTMLElement>("[data-photo-id]");
    const id = tile?.dataset.photoId;
    if (id) applyTo(id, dragRef.current.mode);
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
        <div
          onPointerMove={onGridPointerMove}
          className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 lg:grid-cols-6"
        >
          {photos.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <button
                key={p.id}
                data-photo-id={p.id}
                onClick={() => onTileClick(p)}
                onPointerDown={(e) => onTilePointerDown(e, p)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-900 focus:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbUrl}
                  alt={p.fileName}
                  loading="lazy"
                  draggable={false}
                  className={`h-full w-full object-cover transition ${
                    isSel ? "scale-95 brightness-75" : ""
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
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white"
          >
            ✕
          </button>
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
