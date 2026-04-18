import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "YeON | Step 1 Setup",
  description:
    "YeON MVP Step 1: Next.js 14, Prisma SQLite schema, seed data, and a seed-backed home dashboard."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-background font-[var(--font-body)] text-foreground">
        {children}
      </body>
    </html>
  );
}
