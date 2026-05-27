export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, MapPin, Search, Star } from "lucide-react";

import { Nav } from "@/components/nav";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getEventTypeLabel,
  parseMvpQuoteEventType,
  vendorSupportsAnyServiceModule
} from "@/lib/step3.shared";

const regionOptions = [
  { value: "", label: "전체 지역" },
  { value: "서울", label: "서울" },
  { value: "경기", label: "경기" },
  { value: "인천", label: "인천" },
  { value: "부산", label: "부산" },
  { value: "대구", label: "대구" },
];

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; q?: string; type?: string; planId?: string }>;
}) {
  const session = await getServerAuthSession();
  if (session?.user?.role === UserRole.VENDOR) {
    redirect("/vendor/dashboard");
  }

  const { region = "", q = "", type = "", planId = "" } = await searchParams;
  const planContext =
    session?.user?.id && planId
      ? await prisma.eventPlan.findFirst({
          where: {
            id: planId,
            ownerId: session.user.id,
            type: { in: ["WEDDING", "FUNERAL"] }
          },
          select: { id: true, type: true }
        })
      : null;
  const contextType = planContext?.type ?? parseMvpQuoteEventType(type);
  const contextHrefSuffix = planContext
    ? `planId=${planContext.id}`
    : contextType
      ? `type=${contextType}`
      : "";

  const vendors = await prisma.user.findMany({
    where: {
      role: "VENDOR",
      isActive: true,
      vendorApprovalStatus: "APPROVED",
      ...(region && { location: { contains: region } }),
      ...(q
        ? {
            OR: [
              q ? { companyName: { contains: q } } : {},
              q ? { bio: { contains: q } } : {},
              q ? { name: { contains: q } } : {},
            ].filter((o) => Object.keys(o).length > 0),
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      bio: true,
      location: true,
      supportedEventTypes: true,
      supportedServiceModules: true,
      _count: { select: { receivedReviews: true } },
      receivedReviews: {
        select: { rating: true },
        take: 100,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const contextVendors = contextType
    ? vendors.filter((vendor) => vendorSupportsAnyServiceModule(vendor, contextType))
    : vendors;

  const vendorsWithRating = contextVendors.map((v) => {
    const ratings = v.receivedReviews.map((r) => r.rating);
    const avg = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;
    return { ...v, avgRating: avg, reviewCount: v._count.receivedReviews };
  });

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8">
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground sm:text-3xl">업체 찾기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {contextType
              ? `${getEventTypeLabel(contextType)} 지원 업체를 찾아보세요`
              : "검증된 경조사 전문 업체를 찾아보세요"}
          </p>
        </div>

        {/* Filters */}
        <form method="GET" className="mb-8 flex flex-wrap items-center gap-3">
          {planContext ? (
            <input name="planId" type="hidden" value={planContext.id} />
          ) : contextType ? (
            <input name="type" type="hidden" value={contextType} />
          ) : null}

          {/* Region filter */}
          <select
            name="region"
            defaultValue={region}
            className="rounded-2xl border border-input bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {regionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Keyword search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              name="q"
              type="text"
              defaultValue={q}
              placeholder="업체명 또는 키워드"
              className="w-full rounded-2xl border border-input bg-white py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            검색
          </button>

          {(region || q) && (
            <Link
              href={contextHrefSuffix ? `/vendors?${contextHrefSuffix}` : "/vendors"}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              초기화
            </Link>
          )}
        </form>

        {/* Results */}
        {vendorsWithRating.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-white/60 py-20 text-center">
            <Building2 className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="font-[var(--font-display)] text-base font-semibold text-foreground">검색 결과가 없습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">다른 조건으로 검색해보세요.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendorsWithRating.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/vendors/${vendor.id}${contextHrefSuffix ? `?${contextHrefSuffix}` : ""}`}
                className="group flex flex-col rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  {vendor.avgRating !== null ? (
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {vendor.avgRating}
                      <span className="text-muted-foreground/60">({vendor.reviewCount})</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">리뷰 없음</span>
                  )}
                </div>

                <h2 className="mb-1 font-[var(--font-display)] text-base font-bold text-foreground">
                  {vendor.companyName ?? vendor.name}
                </h2>

                {vendor.bio && (
                  <p className="mb-3 text-xs leading-5 text-muted-foreground line-clamp-2">{vendor.bio}</p>
                )}

                {vendor.location && (
                  <div className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {vendor.location}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
