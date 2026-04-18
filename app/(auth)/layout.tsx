import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-glow backdrop-blur sm:p-8">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-accent/20 via-white/0 to-primary/10" />
        <div className="space-y-5">
          <Link className="inline-flex items-center gap-4" href="/">
            <div className="relative h-16 w-16 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 p-2 shadow-sm">
              <Image
                alt="YeON logo"
                className="object-contain"
                fill
                priority
                sizes="64px"
                src="/yeon-logo.png"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">YeON · 緣</p>
              <p className="font-[var(--font-display)] text-2xl font-semibold text-foreground">YeON</p>
              <p className="text-sm text-muted-foreground">사람과 마음을 잇다</p>
            </div>
          </Link>

          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
            NextAuth Credentials · U01 · U02 · U03
          </Badge>

          <div className="space-y-3">
            <h1 className="font-[var(--font-display)] text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              사람과 마음을 잇는 서비스의 첫 인상을,
              <br className="hidden sm:block" /> 따뜻하고 신뢰감 있게 정리했습니다.
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              Step 2에서는 일반/업체 회원가입, mock 인증번호 발송, Credentials 로그인, 보호된 내 계정 화면까지만
              구현합니다. 관리자용 과도한 대시보드 대신, 브랜드 톤이 느껴지는 서비스형 인증 경험에 집중했습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-border/70 bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">U01</p>
              <p className="mt-2 text-sm font-medium text-foreground">일반 사용자 회원가입</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">U02</p>
              <p className="mt-2 text-sm font-medium text-foreground">업체 사용자 회원가입</p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">U03</p>
              <p className="mt-2 text-sm font-medium text-foreground">로그인 및 인증</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-dashed border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
            인증번호는 실제 SMS API 대신 서버 콘솔에 출력됩니다. 업체 계정은 가입 직후 `승인 대기` 상태가 되며,
            Step 2에서는 상태 확인까지만 제공합니다. 브랜드 의미인 `緣`처럼, 관계의 시작이 부드럽게 느껴지도록
            여백과 곡선형 카드 톤을 유지했습니다.
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-glow backdrop-blur sm:p-7">
        {children}
      </section>
    </main>
  );
}
