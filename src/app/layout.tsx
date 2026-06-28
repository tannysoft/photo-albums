import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Albums",
  description: "Select and download your photos",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
