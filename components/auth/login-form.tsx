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
  { label: "일반 사용자", email: "planner@yeon.local" },
  { label: "웨딩 파트너", email: "venue@yeon.local" },
  { label: "장례 파트너", email: "memorial@yeon.local" },
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
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email" className="text-xs font-semibold text-[#2c3455]">이메일</Label>
          <Input
            autoComplete="email"
            disabled={isSubmitting}
            id="login-email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            className="rounded-xl border-[#e5e2da] bg-white text-xs h-10 transition-[border-color,box-shadow] duration-150 focus-visible:ring-1 focus-visible:ring-[#c4977a]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password" className="text-xs font-semibold text-[#2c3455]">비밀번호</Label>
          <Input
            autoComplete="current-password"
            disabled={isSubmitting}
            id="login-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력해 주세요"
            required
            type="password"
            value={password}
            className="rounded-xl border-[#e5e2da] bg-white text-xs h-10 transition-[border-color,box-shadow] duration-150 focus-visible:ring-1 focus-visible:ring-[#c4977a]"
          />
        </div>
      </div>

      {notice ? (
        <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
          notice.tone === "success"
            ? "border-emerald-100 bg-emerald-50/50 text-emerald-800"
            : "border-rose-100 bg-rose-50/50 text-rose-800"
        }`}>
          {notice.tone === "success"
            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />}
          <span className="leading-relaxed">{notice.message}</span>
        </div>
      ) : null}

      <Button
        className="h-11 w-full rounded-xl bg-[#2c3455] text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1e2645]"
        disabled={isSubmitting}
        size="full"
        type="submit"
      >
        {isSubmitting ? "로그인 중..." : "로그인"}
      </Button>

      <p className="text-center text-xs text-[#8c8275]">
        아직 계정이 없다면{" "}
        <Link className="font-semibold text-[#2c3455] underline underline-offset-4 hover:text-[#c4977a]" href="/signup">
          회원가입
        </Link>
      </p>

      {/* Demo sandbox — quiet text links */}
      <div className="border-t border-[#e5e2da]/70 pt-5">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c8275]">
          데모 간편 접속
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
          {DEMO_ACCOUNTS.map((account, i) => (
            <span key={account.email} className="inline-flex items-center gap-4">
              {i > 0 && <span className="text-[#d8d2c7]">·</span>}
              <button
                className="font-medium text-[#2c3455] transition-colors duration-150 hover:text-[#c4977a] disabled:pointer-events-none disabled:opacity-50"
                disabled={isSubmitting}
                onClick={() => fillDemo(account.email)}
                type="button"
              >
                {account.label}
              </button>
            </span>
          ))}
        </div>
      </div>
    </form>
  );
}
