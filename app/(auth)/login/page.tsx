import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function readSearchParam(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
}

function isInternalPath(value: string | undefined) {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}

function resolveLoginDestination(role: string | undefined, callbackUrl: string | undefined) {
  const safeCallback = isInternalPath(callbackUrl) ? callbackUrl : undefined;

  if (role === "VENDOR") {
    return safeCallback?.startsWith("/vendor") || safeCallback === "/account"
      ? safeCallback
      : "/vendor/dashboard";
  }

  if (role === "ADMIN") {
    return safeCallback ?? "/account";
  }

  return safeCallback?.startsWith("/vendor") ? "/plans" : safeCallback ?? "/plans";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: {
    callbackUrl?: string | string[];
    email?: string | string[];
    error?: string | string[];
    registered?: string | string[];
  };
}) {
  const callbackUrl = readSearchParam(searchParams?.callbackUrl);
  const session = await getServerAuthSession();

  if (session?.user?.id) {
    // Validate the session user actually exists in the DB.
    // After db:seed, the JWT may hold a stale CUID that no longer exists.
    // If the user doesn't exist, we must NOT redirect — show the login page
    // so the user can re-authenticate and get a fresh JWT.
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true }
    });

    if (dbUser && dbUser.isActive) {
      redirect(resolveLoginDestination(session.user.role, callbackUrl));
    }
    // If dbUser is null or inactive, fall through to show login form.
    // The stale JWT will be replaced when the user logs in again.
  }

  const initialEmail = readSearchParam(searchParams?.email);
  const initialError = readSearchParam(searchParams?.error);
  const registered = readSearchParam(searchParams?.registered) === "1";

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground/50">Sign in</p>
        <h2 className="font-[var(--font-display)] text-2xl font-bold text-foreground">
          다시 오셨군요
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          이메일과 비밀번호를 입력해 계속 진행하세요.
        </p>
      </div>

      <LoginForm
        callbackUrl={callbackUrl}
        initialEmail={initialEmail}
        initialError={initialError}
        registered={registered}
      />
    </div>
  );
}
