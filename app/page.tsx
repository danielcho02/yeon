import Link from "next/link";
import { CalendarDays, Database, MapPin, PartyPopper, UsersRound } from "lucide-react";

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
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth/session";

const eventTypeLabels: Record<string, string> = {
  WEDDING: "웨딩",
  FUNERAL: "장례",
  BIRTHDAY: "생일",
  BABY_SHOWER: "베이비샤워",
  HOUSEWARMING: "집들이",
  FIRST_BIRTHDAY: "돌잔치",
  MEMORIAL: "추모",
  ETC: "기타"
};

const statusLabels: Record<string, string> = {
  DRAFT: "초안",
  PLANNING: "기획 중",
  PUBLISHED: "공개",
  COMPLETED: "완료",
  CANCELLED: "취소",
  PENDING: "대기",
  CONFIRMED: "확정",
  SENT: "발송",
  VIEWED: "열람",
  RSVP_ACCEPTED: "참석",
  RSVP_DECLINED: "불참",
  APPROVED: "승인",
  REJECTED: "거절",
  NOT_APPLICABLE: "해당 없음"
};

const statusTone: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PLANNING: "bg-primary/10 text-primary",
  PUBLISHED: "bg-accent/15 text-accent",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-primary/10 text-primary",
  SENT: "bg-primary/10 text-primary",
  VIEWED: "bg-sky-100 text-sky-700",
  RSVP_ACCEPTED: "bg-emerald-100 text-emerald-700",
  RSVP_DECLINED: "bg-rose-100 text-rose-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  NOT_APPLICABLE: "bg-muted text-muted-foreground"
};

const plannedFolders = [
  ["app/", "App Router 엔트리와 단계별 화면을 둡니다. Step 2부터 `(auth)` 세그먼트를 확장합니다."],
  ["components/ui/", "shadcn/ui 컴포넌트를 누적하는 위치입니다."],
  ["components/features/", "행사 플랜, 초대장, 예약 등 도메인 단위 UI를 확장할 자리입니다."],
  ["lib/auth/", "비밀번호 해시, NextAuth 옵션, 권한 헬퍼를 모읍니다."],
  ["lib/mocks/", "결제, AI 추천, 알림용 로컬 mock 함수를 둡니다."],
  ["prisma/", "SQLite 스키마, 마이그레이션, 시드 데이터를 관리합니다."],
  ["types/", "NextAuth 세션 확장과 도메인 타입 보강에 사용합니다."]
] as const;

const setupCommands = [
  "npm install",
  "npx prisma migrate dev --name init",
  "npx prisma db seed",
  "npm run dev"
];

type ReadyHomeData = {
  ready: true;
  stats: {
    users: number;
    eventPlans: number;
    reservations: number;
    invitations: number;
  };
  eventPlans: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    scheduledAt: Date | null;
    budget: number | null;
    guestTarget: number | null;
    owner: {
      name: string;
    };
  }>;
  vendors: Array<{
    id: string;
    name: string;
    companyName: string | null;
    location: string | null;
    bio: string | null;
    vendorApprovalStatus: string;
    _count: {
      vendorReservations: number;
      receivedReviews: number;
    };
  }>;
  posts: Array<{
    id: string;
    title: string;
    category: string;
    isPublished: boolean;
    publishedAt: Date | null;
    author: {
      name: string;
    };
  }>;
  invitations: Array<{
    id: string;
    recipientName: string;
    rsvpStatus: string;
    sentAt: Date | null;
    eventPlan: {
      title: string;
    };
  }>;
};

type PendingHomeData = {
  ready: false;
  message: string;
};

async function getHomeData(): Promise<ReadyHomeData | PendingHomeData> {
  try {
    const [users, eventPlans, reservations, invitations, featuredPlans, featuredVendors, latestPosts, latestInvites] =
      await Promise.all([
        prisma.user.count(),
        prisma.eventPlan.count(),
        prisma.reservation.count(),
        prisma.invitation.count(),
        prisma.eventPlan.findMany({
          take: 3,
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            scheduledAt: true,
            budget: true,
            guestTarget: true,
            owner: {
              select: {
                name: true
              }
            }
          }
        }),
        prisma.user.findMany({
          where: {
            role: "VENDOR"
          },
          take: 3,
          orderBy: {
            createdAt: "asc"
          },
          select: {
            id: true,
            name: true,
            companyName: true,
            location: true,
            bio: true,
            vendorApprovalStatus: true,
            _count: {
              select: {
                vendorReservations: true,
                receivedReviews: true
              }
            }
          }
        }),
        prisma.post.findMany({
          take: 3,
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            title: true,
            category: true,
            isPublished: true,
            publishedAt: true,
            author: {
              select: {
                name: true
              }
            }
          }
        }),
        prisma.invitation.findMany({
          take: 4,
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            recipientName: true,
            rsvpStatus: true,
            sentAt: true,
            eventPlan: {
              select: {
                title: true
              }
            }
          }
        })
      ]);

    return {
      ready: true,
      stats: {
        users,
        eventPlans,
        reservations,
        invitations
      },
      eventPlans: featuredPlans,
      vendors: featuredVendors,
      posts: latestPosts,
      invitations: latestInvites
    };
  } catch {
    return {
      ready: false,
      message:
        "데이터베이스가 아직 준비되지 않았습니다. 마이그레이션과 시드를 실행하면 이 화면에 샘플 데이터가 표시됩니다."
    };
  }
}

export default async function HomePage() {
  const session = await getServerAuthSession();
  const data = await getHomeData();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/84 px-5 py-5 shadow-glow backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">YeON · 緣</p>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-foreground">사람과 마음을 잇다</h1>
          <p className="text-sm text-muted-foreground">
            따뜻하고 부드러운 브랜드 톤 위에 회원가입과 인증 흐름을 올린 Step 2입니다.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {session?.user ? (
            <>
              <Link className={buttonVariants({ variant: "outline" })} href="/account">
                {session.user.name}님 계정
              </Link>
              <LogoutButton variant="default">로그아웃</LogoutButton>
            </>
          ) : (
            <>
              <Link className={buttonVariants({ variant: "outline" })} href="/login">
                로그인
              </Link>
              <Link className={buttonVariants({ variant: "accent" })} href="/signup">
                회원가입
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-glow backdrop-blur">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.25fr_0.85fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              YeON Step 2 · Auth Onboarding
            </Badge>
            <div className="space-y-4">
              <h1 className="font-[var(--font-display)] text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                일반 사용자와 업체 사용자의 가입부터 로그인까지,
                <br className="hidden sm:block" /> 브랜드 톤으로 연결한 인증 경험입니다.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Next.js 14 App Router, Prisma + SQLite 구조 위에 NextAuth Credentials 인증을 얹고, 일반 사용자
                회원가입, 업체 사용자 회원가입, 로그인과 보호된 계정 화면까지 Step 2 범위 안에서 구현했습니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroStat
                icon={Database}
                label="DB State"
                value={data.ready ? "Ready" : "Pending"}
              />
              <HeroStat
                icon={PartyPopper}
                label="Verification"
                value="Mock Code Flow"
              />
              <HeroStat
                icon={UsersRound}
                label="Auth Mode"
                value="Credentials"
              />
              <HeroStat
                icon={CalendarDays}
                label="Current Scope"
                value="U01 · U02 · U03"
              />
            </div>
          </div>

          <Card className="border-primary/10 bg-primary/5">
            <CardHeader>
              <CardTitle>Step 2 빠른 진입</CardTitle>
              <CardDescription>
                로그인과 회원가입 첫인상이 브랜드답게 보이도록 곡선형 카드, 여백, 차분한 네이비와 로즈골드 톤으로
                정리했습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Link className={buttonVariants({ variant: "accent" })} href="/signup">
                  일반/업체 회원가입
                </Link>
                <Link className={buttonVariants({ variant: "outline" })} href="/login">
                  로그인
                </Link>
              </div>
              <div className="rounded-3xl border border-primary/10 bg-white/85 p-4 text-sm leading-6 text-muted-foreground">
                개발 환경에서는 인증번호가 서버 콘솔에 출력됩니다. 신규 업체 계정은 가입 후 `승인 대기` 상태로 저장되며,
                계정 페이지에서 상태를 확인할 수 있습니다.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          {data.ready ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="사용자" value={`${data.stats.users}명`} />
                <SummaryCard label="행사 플랜" value={`${data.stats.eventPlans}건`} />
                <SummaryCard label="예약" value={`${data.stats.reservations}건`} />
                <SummaryCard label="초대장" value={`${data.stats.invitations}건`} />
              </section>

              <Card>
                <CardHeader>
                  <CardTitle>행사 플랜 샘플</CardTitle>
                  <CardDescription>U01~U10 확장을 고려해 이벤트, 예산, 일정, 초대장 연결 구조를 먼저 잡았습니다.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {data.eventPlans.map((plan) => (
                    <article key={plan.id} className="rounded-3xl border bg-white/90 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{eventTypeLabels[plan.type] ?? plan.type}</Badge>
                            <Badge className={statusTone[plan.status] ?? "bg-muted text-muted-foreground"}>
                              {statusLabels[plan.status] ?? plan.status}
                            </Badge>
                          </div>
                          <h3 className="text-lg font-semibold">{plan.title}</h3>
                          <p className="text-sm text-muted-foreground">담당자: {plan.owner.name}</p>
                        </div>
                        <div className="rounded-2xl bg-muted/70 px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">예산</p>
                          <p className="text-base font-semibold">{formatCurrency(plan.budget)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>{formatDate(plan.scheduledAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UsersRound className="h-4 w-4" />
                          <span>목표 하객 {plan.guestTarget ?? 0}명</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>입점 업체 샘플</CardTitle>
                  <CardDescription>역할 기반 사용자 구조에 승인 상태를 더해 업체 가입 흐름을 최소 범위로 확장했습니다.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.vendors.map((vendor) => (
                    <article key={vendor.id} className="rounded-3xl border bg-white/90 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{vendor.companyName ?? vendor.name}</h3>
                          <p className="text-sm text-muted-foreground">{vendor.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline">Vendor</Badge>
                          <Badge className={statusTone[vendor.vendorApprovalStatus] ?? "bg-muted text-muted-foreground"}>
                            {statusLabels[vendor.vendorApprovalStatus] ?? vendor.vendorApprovalStatus}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{vendor.location ?? "지역 정보 준비 중"}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{vendor.bio ?? "소개 문구 없음"}</p>
                      <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          예약 {vendor._count.vendorReservations}건
                        </Badge>
                        <Badge className="bg-accent/15 text-accent hover:bg-accent/15">
                          리뷰 {vendor._count.receivedReviews}건
                        </Badge>
                      </div>
                    </article>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>데이터베이스 준비 안내</CardTitle>
                <CardDescription>{data.message}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {setupCommands.map((command) => (
                  <div
                    key={command}
                    className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-3 font-mono text-sm"
                  >
                    {command}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>폴더 구조 제안</CardTitle>
              <CardDescription>Step 2에서 회원가입/로그인과 서버 액션을 자연스럽게 확장할 수 있도록 최소 구조만 잡았습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {plannedFolders.map(([path, description]) => (
                <div key={path} className="rounded-2xl border bg-white/90 px-4 py-4">
                  <p className="font-mono text-sm font-medium text-foreground">{path}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {data.ready && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>최신 게시글 샘플</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.posts.map((post) => (
                    <article key={post.id} className="rounded-2xl border bg-white/90 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{post.category}</Badge>
                        <Badge className={post.isPublished ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                          {post.isPublished ? "공개" : "비공개"}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-base font-semibold">{post.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        작성자 {post.author.name} · {formatDate(post.publishedAt)}
                      </p>
                    </article>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>초대장 샘플</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.invitations.map((invitation) => (
                    <article key={invitation.id} className="rounded-2xl border bg-white/90 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold">{invitation.recipientName}</h3>
                        <Badge className={statusTone[invitation.rsvpStatus] ?? "bg-muted text-muted-foreground"}>
                          {statusLabels[invitation.rsvpStatus] ?? invitation.rsvpStatus}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{invitation.eventPlan.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">발송일 {formatDate(invitation.sentAt)}</p>
                    </article>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-[var(--font-display)] text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
