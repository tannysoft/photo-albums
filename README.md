# Photo Albums

ระบบส่งมอบรูปให้ลูกค้า — ลูกค้าเปิดอัลบั้มผ่านลิงก์ เลือกรูปแบบ iPhone แล้วกดดาวน์โหลด
(เลือกหลายรูปได้เป็น ZIP) พร้อม Dashboard สำหรับผู้ดูแลในการสร้างอัลบั้มและอัปโหลดรูป

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Firebase (Auth + Firestore) · Cloudflare R2 · sharp

## คุณสมบัติ

- **ลูกค้า** (`/a/[slug]`): ไม่ต้องล็อกอิน, แตะ "เลือก" → เลือกรูป (แตะทีละรูป / ลากเลือกด้วยเมาส์ / เลือกทั้งหมด) → ดาวน์โหลด รูปเดียวโหลดตรง หลายรูปรวมเป็น ZIP
- **Admin** (`/admin`): ล็อกอินด้วย Firebase Auth (Email/Password) → สร้างอัลบั้ม, อัปโหลดรูปทีละหลายไฟล์, ลบรูป/อัลบั้ม, คัดลอกลิงก์แชร์
- รูปต้นฉบับ + thumbnail (สร้างด้วย `sharp` ตอนอัปโหลด) เก็บใน Cloudflare R2; รองรับ HEIC (แปลงเป็น JPEG)

## ตั้งค่า

1. `cp .env.example .env.local` แล้วกรอกค่าให้ครบ
2. **Firebase**: สร้างโปรเจกต์ → เปิดใช้ Authentication (Email/Password) และ Firestore Database → คัดลอกค่า Web SDK + สร้าง Service Account key สำหรับฝั่ง server
3. สร้างผู้ใช้ admin ใน Firebase Authentication (เพิ่มอีเมลใน `ADMIN_EMAILS` ถ้าต้องการจำกัดสิทธิ์)
4. **Cloudflare R2**: สร้าง bucket → สร้าง API Token (Access Key/Secret) → กรอกใน `.env.local`
   - ถ้าต่อ public custom domain / r2.dev เข้ากับ bucket ให้ตั้ง `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` เพื่อเสิร์ฟรูปตรง (เร็ว/แคชได้)
   - ถ้าเว้นว่าง ระบบจะเสิร์ฟผ่าน presigned URL redirect (`/api/r2/...`) ใช้กับ bucket แบบ private ได้ทันที

## รันงาน

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## โครงสร้าง

```
src/
  app/
    a/[slug]/          # หน้าอัลบั้มสาธารณะ (server) + Gallery.tsx (client เลือก/ดาวน์โหลด)
    admin/             # Dashboard (login, รายการอัลบั้ม, รายละเอียด+อัปโหลด)
    api/
      albums/          # CRUD อัลบั้ม (ต้องเป็น admin)
      photos/[id]/     # ลบรูป (admin)
      upload/          # รับไฟล์ → สร้าง thumbnail → ขึ้น R2 → บันทึก Firestore (admin)
      r2/[...key]/     # redirect ไป presigned URL (เสิร์ฟรูป private bucket)
      download/        # public: รูปเดียว=presigned, หลายรูป=ZIP stream
  lib/                 # firebase, firebaseAdmin, r2, data (Firestore), types, useAuth
```

## Firestore index

การดึงรูปในอัลบั้มใช้ query `where("albumId","==") + orderBy("createdAt")`
ซึ่งต้องมี **composite index** ครั้งแรกที่รัน Firestore จะ throw พร้อมลิงก์สร้าง index
ให้กดสร้างตามลิงก์นั้น (collection `photos`: `albumId` Asc, `createdAt` Asc)
หรือเพิ่มใน `firestore.indexes.json` เอง

## หมายเหตุการ deploy

- API ที่ใช้ `sharp`/`archiver`/`firebase-admin` ต้องรันบน Node.js runtime (ตั้งไว้แล้วใน route)
- การอัปโหลด/ZIP ไฟล์ใหญ่ควร deploy บนแพลตฟอร์มที่ไม่จำกัด body/timeout เข้มงวด
  (เช่น VPS/Container, Cloudflare Containers, Railway) — บน Vercel ดู limit ของ request body
