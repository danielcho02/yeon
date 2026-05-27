export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Noto_Serif_KR, Space_Grotesk } from "next/font/google";

import "./globals.css";

const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YeON | 사람과 마음을 잇다",
  description: "결혼식과 장례식 — AI 추천, 업체 연결, 예약 확정까지 하나의 흐름으로 정리하는 경조사 준비 서비스"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSerifKR.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-background font-[var(--font-body)] text-foreground">
        {children}
      </body>
    </html>
  );
}
