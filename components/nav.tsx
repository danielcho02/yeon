import Image from "next/image";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { buttonVariants } from "@/components/ui/button";
import { getServerAuthSession } from "@/lib/auth/session";

export async function Nav() {
  const session = await getServerAuthSession();
  const user = session?.user;
  const role = user?.role;

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative h-8 w-[52px] overflow-hidden transition-transform duration-200 group-hover:scale-105">
            <Image src="/yeon-logo.png" alt="YeON" fill className="object-contain" />
          </div>
          <div className="leading-none">
            <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">YeON</p>
            <p className="font-[var(--font-display)] text-sm font-semibold text-foreground">사람과 마음을 잇다</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {!user && (
            <>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/login">로그인</Link>
              <Link className={buttonVariants({ variant: "default", size: "sm" })} href="/signup">회원가입</Link>
            </>
          )}

          {user && role === "GENERAL" && (
            <>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/planner">행사 플래너</Link>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/account">내 계정</Link>
              <LogoutButton size="sm" variant="ghost">로그아웃</LogoutButton>
            </>
          )}

          {user && role === "VENDOR" && (
            <>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/vendor/dashboard">업체 대시보드</Link>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/account">내 계정</Link>
              <LogoutButton size="sm" variant="ghost">로그아웃</LogoutButton>
            </>
          )}

          {user && role === "ADMIN" && (
            <>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/account">내 계정</Link>
              <LogoutButton size="sm" variant="ghost">로그아웃</LogoutButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
