"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SignupRole = "GENERAL" | "VENDOR";

type SignupFormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  verificationCode: string;
  companyName: string;
  location: string;
  bio: string;
};

const initialFormState: SignupFormState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  passwordConfirm: "",
  verificationCode: "",
  companyName: "",
  location: "",
  bio: ""
};

export function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>("GENERAL");
  const [form, setForm] = useState<SignupFormState>(initialFormState);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isVendor = role === "VENDOR";

  function updateField<K extends keyof SignupFormState>(
    field: K,
    value: SignupFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));

    if (field === "name" || field === "email" || field === "phone") {
      setNotice(null);
    }
  }

  async function handleRequestCode() {
    setNotice(null);
    setIsRequestingCode(true);

    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        role
      })
    });

    const data = (await response.json()) as {
      message?: string;
    };

    setIsRequestingCode(false);

    if (!response.ok) {
      setNotice({
        tone: "error",
        message: data.message ?? "인증번호 요청에 실패했습니다."
      });

      return;
    }

    setNotice({
      tone: "success",
      message: data.message ?? "인증번호를 요청했습니다."
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (form.password !== form.passwordConfirm) {
      setNotice({
        tone: "error",
        message: "비밀번호 확인이 일치하지 않습니다."
      });

      return;
    }

    if (!form.verificationCode.trim()) {
      setNotice({
        tone: "error",
        message: "인증번호를 입력해 주세요."
      });

      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...form,
        role
      })
    });

    const data = (await response.json()) as {
      message?: string;
    };

    if (!response.ok) {
      setIsSubmitting(false);
      setNotice({
        tone: "error",
        message: data.message ?? "회원가입 처리에 실패했습니다."
      });

      return;
    }

    const loginResult = await signIn("credentials", {
      email: form.email,
      password: form.password,
      callbackUrl: "/account",
      redirect: false
    });

    setIsSubmitting(false);

    if (loginResult?.error) {
      router.push(`/login?registered=1&email=${encodeURIComponent(form.email)}`);
      return;
    }

    router.push(loginResult?.url ?? "/account");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2 rounded-3xl border border-border/70 bg-muted/40 p-2">
        <button
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
            !isVendor
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => {
            setRole("GENERAL");
            setNotice(null);
          }}
          type="button"
        >
          일반 사용자
        </button>
        <button
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
            isVendor
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => {
            setRole("VENDOR");
            setNotice(null);
          }}
          type="button"
        >
          업체 사용자
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signup-name">이름</Label>
          <Input
            id="signup-name"
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="이름을 입력해 주세요"
            required
            value={form.name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">이메일</Label>
          <Input
            autoComplete="email"
            id="signup-email"
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={form.email}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-phone">휴대폰 번호</Label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            autoComplete="tel"
            id="signup-phone"
            inputMode="numeric"
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="01012345678"
            required
            value={form.phone}
          />
          <Button
            className="w-full sm:w-auto"
            disabled={isRequestingCode}
            onClick={handleRequestCode}
            type="button"
            variant="outline"
          >
            {isRequestingCode ? "발송 중..." : "인증번호 발송"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          실제 문자 API 대신 서버 콘솔에 mock 인증번호가 출력됩니다.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-code">인증번호</Label>
        <Input
          id="signup-code"
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => updateField("verificationCode", event.target.value)}
          placeholder="6자리 인증번호"
          required
          value={form.verificationCode}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signup-password">비밀번호</Label>
          <Input
            autoComplete="new-password"
            id="signup-password"
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="8자 이상"
            required
            type="password"
            value={form.password}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password-confirm">비밀번호 확인</Label>
          <Input
            autoComplete="new-password"
            id="signup-password-confirm"
            onChange={(event) => updateField("passwordConfirm", event.target.value)}
            placeholder="비밀번호를 다시 입력해 주세요"
            required
            type="password"
            value={form.passwordConfirm}
          />
        </div>
      </div>

      {isVendor ? (
        <div className="space-y-4 rounded-[1.75rem] border border-amber-200 bg-amber-50/70 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">업체 가입 추가 정보</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Step 2에서는 승인 상태만 기록하고, 관리자 승인 UI는 아직 구현하지 않았습니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-company">업체명</Label>
            <Input
              id="signup-company"
              onChange={(event) => updateField("companyName", event.target.value)}
              placeholder="예: 모먼트 가든"
              required={isVendor}
              value={form.companyName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-location">활동 지역</Label>
            <Input
              id="signup-location"
              onChange={(event) => updateField("location", event.target.value)}
              placeholder="예: 서울 강남구"
              required={isVendor}
              value={form.location}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-bio">업체 소개</Label>
            <Textarea
              id="signup-bio"
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder="제공 서비스나 강점을 간단히 적어 주세요"
              value={form.bio}
            />
          </div>
        </div>
      ) : null}

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
        {isSubmitting ? "가입 처리 중..." : isVendor ? "업체 계정 만들기" : "회원가입"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있다면{" "}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/login">
          로그인
        </Link>
        으로 이동해 주세요.
      </p>
    </form>
  );
}
