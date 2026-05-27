"use client";

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  callbackUrl?: string;
  initialEmail?: string;
  initialError?: string;
  registered?: boolean;
};

function mapAuthErrorMessage(error?: string | null) {
  if (!error) return "";
  if (error === "CredentialsSignin") return "이메일 또는 비밀번호를 확인해 주세요.";
  if (error === "AccessDenied") return "로그인 권한이 없습니다.";
  return error;
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

const DEMO_ACCOUNTS = [
  { label: "일반 사용자", email: "planner@yeon.local", description: "결혼 준비 체험", hoverClass: "hover:border-primary/30 hover:bg-primary/3" },
  { label: "웨딩 업체", email: "venue@yeon.local", description: "웨딩홀 업체", hoverClass: "hover:border-rose-300 hover:bg-rose-50/50" },
  { label: "장례 업체", email: "memorial@yeon.local", description: "장례 의전 업체", hoverClass: "hover:border-indigo-300 hover:bg-indigo-50/50" },
] as const;

export function LoginForm({
  callbackUrl,
  initialEmail = "",
  initialError,
  registered = false
}: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState(() => {
    if (initialError) return { tone: "error" as const, message: mapAuthErrorMessage(initialError) };
    if (registered) return { tone: "success" as const, message: "회원가입이 완료되었습니다. 로그인해 주세요." };
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loginWithCredentials(nextEmail: string, nextPassword: string) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setNotice(null);

    try {
      const result = await signIn("credentials", {
        email: nextEmail,
        password: nextPassword,
        callbackUrl,
        redirect: false
      });

      if (!result?.ok || result.error) {
        setNotice({ tone: "error", message: mapAuthErrorMessage(result?.error) });
        return;
      }

      const session = await getSession();
      const role = (session?.user as { role?: string } | null)?.role;
      window.location.assign(resolveLoginDestination(role, callbackUrl));
    } catch {
      setNotice({ tone: "error", message: "로그인 요청 중 문제가 발생했습니다. 다시 시도해 주세요." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loginWithCredentials(email, password);
  }

  function fillDemo(demoEmail: string) {
    const demoPassword = "demo1234";
    setEmail(demoEmail);
    setPassword(demoPassword);
    void loginWithCredentials(demoEmail, demoPassword);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">이메일</Label>
          <Input
            autoComplete="email"
            disabled={isSubmitting}
            id="login-email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">비밀번호</Label>
          <Input
            autoComplete="current-password"
            disabled={isSubmitting}
            id="login-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력해 주세요"
            required
            type="password"
            value={password}
          />
        </div>
      </div>

      {notice ? (
        <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
          notice.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {notice.tone === "success"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} size="full" type="submit">
        {isSubmitting ? "로그인 중..." : "로그인"}
      </Button>

      {/* Demo accounts */}
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white/93 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/45">
              데모 계정으로 체험
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              className={`rounded-xl border border-border/50 bg-white/70 px-2 py-2.5 text-center transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${account.hoverClass}`}
              disabled={isSubmitting}
              key={account.email}
              onClick={() => fillDemo(account.email)}
              type="button"
            >
              <p className="text-[11px] font-semibold text-foreground">{account.label}</p>
              <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/55">{account.email.split("@")[0]}</p>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          비밀번호:{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground">demo1234</code>
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        아직 계정이 없다면{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/signup">
          회원가입
        </Link>
        하세요.
      </p>
    </form>
  );
}
