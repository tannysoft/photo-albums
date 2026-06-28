import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Photo Albums</h1>
      <p className="max-w-md text-neutral-400">
        ระบบส่งมอบรูปให้ลูกค้าเลือกและดาวน์โหลด — เปิดอัลบั้มจากลิงก์ที่ได้รับ
        หรือเข้าสู่แดชบอร์ดสำหรับผู้ดูแล
      </p>
      <Link
        href="/admin"
        className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
      >
        เข้าสู่ Dashboard
      </Link>
    </main>
  );
}
