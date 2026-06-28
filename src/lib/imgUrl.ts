// Client-safe R2 object URL resolver (mirrors lib/r2.ts publicUrl).
const PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || ""
).replace(/\/$/, "");

export function imgUrl(key: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${key}`;
  return `/api/r2/${key.split("/").map(encodeURIComponent).join("/")}`;
}
