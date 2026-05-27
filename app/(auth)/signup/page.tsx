import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import { getServerAuthSession } from "@/lib/auth/session";

export default async function SignupPage() {
  const session = await getServerAuthSession();

  if (session?.user?.id) {
    redirect("/account");
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground/50">Create account</p>
        <h2 className="font-[var(--font-display)] text-2xl font-bold text-foreground">
          YeON 시작하기
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          역할을 선택하고 계정을 만들면 바로 시작할 수 있습니다.
        </p>
      </div>

      <SignupForm />
    </div>
  );
}
