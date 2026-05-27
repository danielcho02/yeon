"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, Heart, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getEventTypeLabel,
  mvpQuoteEventTypes,
  quoteServiceModules,
  type MvpQuoteEventType
} from "@/lib/step3.shared";
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
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportedEventTypes, setSupportedEventTypes] = useState<MvpQuoteEventType[]>([]);
  const [supportedServiceModules, setSupportedServiceModules] = useState<string[]>([]);

  const isVendor = role === "VENDOR";

  function updateField<K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) {
    setForm((c) => ({ ...c, [field]: value }));
    if (field === "name" || field === "companyName" || field === "email" || field === "phone") {
      setNotice(null);
    }
  }

  function toggleSupportedEventType(eventType: MvpQuoteEventType) {
    setSupportedEventTypes((current) => {
      if (current.includes(eventType)) {
        const next = current.filter((type) => type !== eventType);
        const allowedModules = next.flatMap((type) =>
          quoteServiceModules[type].map((module) => module.value)
        );
        setSupportedServiceModules((modules) =>
          modules.filter((module) => allowedModules.includes(module))
        );
        return next;
      }

      return [...current, eventType];
    });
    setNotice(null);
  }

  function toggleSupportedServiceModule(moduleValue: string) {
    setSupportedServiceModules((current) =>
      current.includes(moduleValue)
        ? current.filter((module) => module !== moduleValue)
        : [...current, moduleValue]
    );
    setNotice(null);
  }

  async function handleRequestCode() {
    setNotice(null);
    setIsRequestingCode(true);
    const accountName = isVendor ? form.companyName : form.name;

    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName, email: form.email, phone: form.phone, role })
    });

    const data = (await response.json()) as { message?: string };
    setIsRequestingCode(false);

    if (!response.ok) {
      setNotice({ tone: "error", message: data.message ?? "인증번호 요청에 실패했습니다." });
      return;
    }
    setNotice({ tone: "success", message: data.message ?? "인증번호를 서버 콘솔에서 확인해 주세요." });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (form.password !== form.passwordConfirm) {
      setNotice({ tone: "error", message: "비밀번호 확인이 일치하지 않습니다." });
      return;
    }

    if (!form.verificationCode.trim()) {
      setNotice({ tone: "error", message: "인증번호를 입력해 주세요." });
      return;
    }

    if (isVendor && supportedEventTypes.length === 0) {
      setNotice({ tone: "error", message: "지원 행사 유형을 하나 이상 선택해 주세요." });
      return;
    }

    if (isVendor && supportedServiceModules.length === 0) {
      setNotice({ tone: "error", message: "지원 서비스 모듈을 하나 이상 선택해 주세요." });
      return;
    }

    setIsSubmitting(true);
    const accountName = isVendor ? form.companyName : form.name;

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        name: accountName,
        role,
        supportedEventTypes: isVendor ? supportedEventTypes : [],
        supportedServiceModules: isVendor ? supportedServiceModules : []
      })
    });

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setIsSubmitting(false);
      setNotice({ tone: "error", message: data.message ?? "회원가입 처리에 실패했습니다." });
      return;
    }

    const loginResult = await signIn("credentials", {
      email: form.email,
      password: form.password,
      callbackUrl: isVendor ? "/vendor/dashboard" : "/plans",
      redirect: false
    });

    setIsSubmitting(false);

    if (loginResult?.error) {
      router.push(`/login?registered=1&email=${encodeURIComponent(form.email)}`);
      return;
    }

    router.push(loginResult?.url ?? (isVendor ? "/vendor/dashboard" : "/plans"));
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {/* Role selection */}
      <div className="grid grid-cols-2 gap-2.5">
        <RoleToggle
          active={!isVendor}
          icon={Users}
          label="일반 사용자"
          description="경조사 준비"
          onClick={() => { setRole("GENERAL"); setNotice(null); }}
          accentClass="border-primary/30 bg-primary/5 ring-1 ring-primary/10"
          iconActiveClass="bg-primary text-primary-foreground shadow-[0_4px_12px_-2px_rgba(54,67,101,0.4)]"
        />
        <RoleToggle
          active={isVendor}
          icon={Building2}
          label="업체 사용자"
          description="서비스 제공"
          onClick={() => { setRole("VENDOR"); setNotice(null); }}
          accentClass="border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-100"
          iconActiveClass="bg-indigo-900 text-white shadow-[0_4px_12px_-2px_rgba(45,62,112,0.45)]"
        />
      </div>

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          {isVendor ? (
            <>
              <Label htmlFor="signup-company-name">업체명</Label>
              <Input
                id="signup-company-name"
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="예: 모먼트 가든"
                required
                value={form.companyName}
              />
            </>
          ) : (
            <>
              <Label htmlFor="signup-name">이름</Label>
              <Input
                id="signup-name"
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="이름을 입력해 주세요"
                required
                value={form.name}
              />
            </>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">이메일</Label>
          <Input
            autoComplete="email"
            id="signup-email"
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={form.email}
          />
        </div>
      </div>

      {/* Phone + verification */}
      <div className="space-y-2">
        <Label htmlFor="signup-phone">휴대폰 번호</Label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            autoComplete="tel"
            id="signup-phone"
            inputMode="numeric"
            onChange={(e) => updateField("phone", e.target.value)}
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
        <p className="text-xs text-muted-foreground/55">
          인증번호는 서버 콘솔(터미널)에 출력됩니다.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-code">인증번호</Label>
        <Input
          id="signup-code"
          inputMode="numeric"
          maxLength={6}
          onChange={(e) => updateField("verificationCode", e.target.value)}
          placeholder="6자리 인증번호"
          required
          value={form.verificationCode}
        />
      </div>

      {/* Password */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signup-password">비밀번호</Label>
          <Input
            autoComplete="new-password"
            id="signup-password"
            onChange={(e) => updateField("password", e.target.value)}
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
            onChange={(e) => updateField("passwordConfirm", e.target.value)}
            placeholder="비밀번호 재입력"
            required
            type="password"
            value={form.passwordConfirm}
          />
        </div>
      </div>

      {/* Vendor-only fields */}
      {isVendor ? (
        <div className="space-y-4 rounded-[1.5rem] border border-indigo-200/60 bg-indigo-50/40 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Heart className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">업체 추가 정보</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                가입 후 운영팀 승인을 거쳐 업체 워크스페이스가 활성화됩니다.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-location">활동 지역</Label>
            <Input
              id="signup-location"
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="예: 서울 강남구"
              required={isVendor}
              value={form.location}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-bio">업체 소개</Label>
            <Textarea
              id="signup-bio"
              onChange={(e) => updateField("bio", e.target.value)}
              placeholder="제공 서비스나 강점을 간단히 적어 주세요"
              value={form.bio}
            />
          </div>

          <div className="space-y-3">
            <Label>지원 행사 유형</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {mvpQuoteEventTypes.map((eventType) => (
                <label
                  key={eventType}
                  className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/70 px-3.5 py-3 text-sm font-medium text-foreground"
                >
                  <input
                    checked={supportedEventTypes.includes(eventType)}
                    onChange={() => toggleSupportedEventType(eventType)}
                    type="checkbox"
                  />
                  {getEventTypeLabel(eventType)}
                </label>
              ))}
            </div>
          </div>

          {supportedEventTypes.length > 0 && (
            <div className="space-y-3">
              <Label>지원 서비스 모듈</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {supportedEventTypes.flatMap((eventType) =>
                  quoteServiceModules[eventType].map((module) => (
                    <label
                      key={`${eventType}-${module.value}`}
                      className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/70 px-3.5 py-3 text-sm font-medium text-foreground"
                    >
                      <input
                        checked={supportedServiceModules.includes(module.value)}
                        onChange={() => toggleSupportedServiceModule(module.value)}
                        type="checkbox"
                      />
                      {getEventTypeLabel(eventType)} · {module.label}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {notice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          notice.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {notice.message}
        </div>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} size="full" type="submit">
        {isSubmitting ? "처리 중..." : isVendor ? "업체 계정 만들기" : "회원가입"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있다면{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/login">
          로그인
        </Link>
        하세요.
      </p>
    </form>
  );
}

function RoleToggle({
  active,
  icon: Icon,
  label,
  description,
  onClick,
  accentClass,
  iconActiveClass
}: {
  active: boolean;
  icon: typeof Users;
  label: string;
  description: string;
  onClick: () => void;
  accentClass: string;
  iconActiveClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all duration-200",
        active
          ? accentClass
          : "border-border/50 bg-white/60 hover:border-border hover:bg-white/90 hover:shadow-sm"
      )}
    >
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
        active ? iconActiveClass : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className={cn("text-sm font-bold", active ? "text-foreground" : "text-muted-foreground")}>{label}</p>
        <p className="text-xs text-muted-foreground/65">{description}</p>
      </div>
    </button>
  );
}
