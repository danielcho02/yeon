import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getServerAuthSession } from "@/lib/auth/session";

function readSearchParam(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
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
  const session = await getServerAuthSession();

  if (session?.user?.id) {
    redirect("/account");
  }

  const callbackUrl = readSearchParam(searchParams?.callbackUrl);
  const initialEmail = readSearchParam(searchParams?.email);
  const initialError = readSearchParam(searchParams?.error);
  const registered = readSearchParam(searchParams?.registered) === "1";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-[var(--font-display)] text-2xl font-semibold text-foreground">
          로그인
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          이메일과 비밀번호로 로그인한 뒤, 보호된 내 계정 화면에서 회원 유형과 승인 상태를 확인할 수 있습니다.
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
