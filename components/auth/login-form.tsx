"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
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
  if (!error) {
    return "";
  }

  if (error === "CredentialsSignin") {
    return "이메일 또는 비밀번호를 확인해 주세요.";
  }

  if (error === "AccessDenied") {
    return "로그인 권한이 없습니다.";
  }

  return error;
}

export function LoginForm({
  callbackUrl = "/account",
  initialEmail = "",
  initialError,
  registered = false
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState(() => {
    if (initialError) {
      return {
        tone: "error" as const,
        message: mapAuthErrorMessage(initialError)
      };
    }

    if (registered) {
      return {
        tone: "success" as const,
        message: "회원가입이 완료되었습니다. 방금 만든 계정으로 로그인해 주세요."
      };
    }

    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false
    });

    setIsSubmitting(false);

    if (!result?.ok || result.error) {
      setNotice({
        tone: "error",
        message: mapAuthErrorMessage(result?.error)
      });

      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="login-email">이메일</Label>
        <Input
          autoComplete="email"
          id="login-email"
          onChange={(event) => setEmail(event.target.value)}
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
          id="login-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호를 입력해 주세요"
          required
          type="password"
          value={password}
        />
      </div>

      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} size="full" type="submit">
        {isSubmitting ? "로그인 중..." : "로그인"}
      </Button>

      <div className="rounded-3xl border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Step 2 데모 계정</p>
        <p className="mt-2">일반 사용자: `planner@yeon.local / demo1234`</p>
        <p>업체 사용자: `venue@yeon.local / demo1234`</p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        아직 계정이 없다면{" "}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/signup">
          회원가입
        </Link>
        으로 이동해 주세요.
      </p>
    </form>
  );
}
