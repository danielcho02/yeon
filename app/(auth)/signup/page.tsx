import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import { getServerAuthSession } from "@/lib/auth/session";

export default async function SignupPage() {
  const session = await getServerAuthSession();

  if (session?.user?.id) {
    redirect("/account");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-[var(--font-display)] text-2xl font-semibold text-foreground">
          회원가입
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          일반 사용자와 업체 사용자 가입 흐름을 하나의 화면에서 처리합니다. 업체 계정은 생성 후 승인 상태가
          `대기`로 표시됩니다.
        </p>
      </div>

      <SignupForm />
    </div>
  );
}
