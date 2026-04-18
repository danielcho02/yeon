import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth/session";

const roleLabels = {
  GENERAL: "일반 사용자",
  VENDOR: "업체 사용자",
  ADMIN: "관리자"
} as const;

const approvalMeta = {
  NOT_APPLICABLE: {
    label: "본인 인증 완료",
    tone: "bg-primary/10 text-primary",
    description: "일반 사용자 계정으로 인증이 완료된 상태입니다."
  },
  PENDING: {
    label: "업체 승인 대기",
    tone: "bg-amber-100 text-amber-700",
    description:
      "Step 2에서는 승인 상태만 기록합니다. 관리자 승인 UI는 다음 단계에서 확장합니다."
  },
  APPROVED: {
    label: "업체 승인 완료",
    tone: "bg-emerald-100 text-emerald-700",
    description: "로그인과 계정 접근이 가능한 승인 완료 상태입니다."
  },
  REJECTED: {
    label: "승인 거절",
    tone: "bg-rose-100 text-rose-700",
    description: "운영 판단으로 승인 거절된 상태입니다."
  }
} as const;

export default async function AccountPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      companyName: true,
      location: true,
      bio: true,
      createdAt: true,
      phoneVerifiedAt: true,
      vendorApprovalStatus: true
    }
  });

  if (!user) {
    redirect("/login?callbackUrl=/account");
  }

  const approval = approvalMeta[user.vendorApprovalStatus];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-glow backdrop-blur sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge className={approval.tone}>{approval.label}</Badge>
            <div className="space-y-2">
              <h1 className="font-[var(--font-display)] text-3xl font-semibold text-foreground">
                {user.name}님 계정
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">{approval.description}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              홈으로
            </Link>
            <LogoutButton variant="default">로그아웃</LogoutButton>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>NextAuth 세션과 Prisma 사용자 정보를 함께 확인합니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <InfoItem label="회원 유형" value={roleLabels[user.role]} />
            <InfoItem label="이메일" value={user.email} />
            <InfoItem label="휴대폰" value={user.phone ?? "미등록"} />
            <InfoItem label="가입일" value={formatDate(user.createdAt)} />
            <InfoItem label="인증 완료 시각" value={formatDate(user.phoneVerifiedAt)} />
            <InfoItem label="활동 지역" value={user.location ?? "미입력"} />
            {user.role === "VENDOR" ? (
              <InfoItem label="업체명" value={user.companyName ?? "미입력"} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2 상태</CardTitle>
            <CardDescription>Step 3 이후 기능으로 넘길 항목은 아직 노출하지 않았습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-border/70 bg-muted/40 p-4">
              <p className="text-sm font-medium text-foreground">현재 구현 범위</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                회원가입, mock 인증번호 발송, Credentials 로그인, 보호된 계정 페이지까지 구현되어 있습니다.
              </p>
            </div>

            {user.bio ? (
              <div className="rounded-3xl border border-border/70 bg-white p-4">
                <p className="text-sm font-medium text-foreground">소개</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{user.bio}</p>
              </div>
            ) : null}

            {user.role === "VENDOR" ? (
              <div className="rounded-3xl border border-border/70 bg-white p-4">
                <p className="text-sm font-medium text-foreground">업체 승인 안내</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  신규 업체 가입은 `승인 대기`로 저장됩니다. 현재 단계에서는 관리자 승인 UI를 만들지 않고 상태만 노출합니다.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function InfoItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white/90 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
