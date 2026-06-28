export default function AlbumNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">ไม่พบอัลบั้ม</h1>
      <p className="text-neutral-500">
        ลิงก์อาจไม่ถูกต้องหรืออัลบั้มถูกลบไปแล้ว
      </p>
    </main>
  );
}
