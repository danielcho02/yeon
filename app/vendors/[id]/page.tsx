import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, MapPin, Phone, Star } from "lucide-react";

import { Nav } from "@/components/nav";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { mvpEventTypes } from "@/lib/step3.server";
import {
  getEventTypeLabel,
  getQuoteServiceModuleLabel,
  getVendorSupportedServiceModules,
  parseMvpQuoteEventType,
  vendorSupportsAnyServiceModule
} from "@/lib/step3.shared";
import { QuoteRequestModal } from "./quote-request-modal";

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ type?: string; planId?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getServerAuthSession();

  if (session?.user?.role === UserRole.VENDOR) {
    redirect("/vendor/dashboard");
  }

  const planContext =
    session?.user?.id && query?.planId
      ? await prisma.eventPlan.findFirst({
          where: {
            id: query.planId,
            ownerId: session.user.id,
            type: { in: mvpEventTypes }
          },
          select: { id: true, type: true }
        })
      : null;
  const contextType = planContext?.type ?? parseMvpQuoteEventType(query?.type);
  const contextHrefSuffix = planContext
    ? `planId=${planContext.id}`
    : contextType
      ? `type=${contextType}`
      : "";

  const vendor = await prisma.user.findFirst({
    where: {
      id,
      role: UserRole.VENDOR,
      isActive: true,
      vendorApprovalStatus: "APPROVED"
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      bio: true,
      location: true,
      phone: true,
      supportedEventTypes: true,
      supportedServiceModules: true,
      receivedReviews: {
        where: { isPublished: true },
        select: { rating: true, title: true, content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      vendorServices: {
        where: { isActive: true },
        select: {
          id: true,
          eventType: true,
          module: true,
          catalogKey: true,
          pricingType: true,
          name: true,
          description: true,
          basePrice: true,
          maxGuests: true,
          isActive: true,
        },
        orderBy: [{ eventType: "asc" }, { module: "asc" }, { basePrice: "asc" }],
      },
    },
  });

  if (!vendor) notFound();
  if (contextType && !vendorSupportsAnyServiceModule(vendor, contextType)) notFound();

  const ratings = vendor.receivedReviews.map((r) => r.rating);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  // Fetch user's plans for quote request modal
  const plans = session?.user?.id && session.user.role === UserRole.GENERAL
    ? await prisma.eventPlan.findMany({
        where: {
          ownerId: session.user.id,
          type: contextType ?? { in: mvpEventTypes }
        },
        select: { id: true, title: true, type: true, budget: true, guestTarget: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const displayName = vendor.companyName ?? vendor.name;
  const vendorSupportedServiceModules = getVendorSupportedServiceModules(vendor);
  const detailPath = `/vendors/${vendor.id}${contextHrefSuffix ? `?${contextHrefSuffix}` : ""}`;

  const displayServices = contextType
    ? vendor.vendorServices.filter((s) => s.eventType === contextType)
    : vendor.vendorServices;

  const servicesByType: Record<string, typeof displayServices> = {};
  for (const svc of displayServices) {
    (servicesByType[svc.eventType] ??= []).push(svc);
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/vendors${contextHrefSuffix ? `?${contextHrefSuffix}` : ""}`}
            className="hover:text-foreground transition-colors"
          >
            업체 찾기
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{displayName}</span>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
          {/* Main info */}
          <section className="rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm sm:p-8">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground">{displayName}</h1>
                <div className="mt-2 flex items-center gap-3">
                  {avgRating !== null ? (
                    <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      {avgRating}
                      <span className="text-xs font-normal text-muted-foreground/60">
                        ({ratings.length}개 리뷰)
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">리뷰 없음 (—)</span>
                  )}
                </div>
              </div>
            </div>

            {vendor.bio && (
              <div className="mb-5 rounded-2xl border border-border/40 bg-muted/30 p-4">
                <p className="text-sm leading-6 text-muted-foreground">{vendor.bio}</p>
              </div>
            )}

            <div className="space-y-3">
              {vendor.location && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {vendor.location}
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  {vendor.phone}
                </div>
              )}
            </div>
          </section>

          {/* Quote CTA */}
          <div className="flex flex-col gap-5">
            <section className="rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm">
              <h2 className="mb-3 font-[var(--font-display)] text-base font-bold text-foreground">견적 요청</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                {displayName}에 직접 견적을 요청하세요. 업체가 검토 후 연락드립니다.
              </p>
              {session?.user?.role === UserRole.GENERAL ? (
                <QuoteRequestModal
                  vendorId={vendor.id}
                  vendorName={displayName}
                  fallbackEventType={contextType ?? undefined}
                  plans={plans}
                  supportedServiceModules={vendorSupportedServiceModules}
                  services={vendor.vendorServices}
                />
              ) : (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(detailPath)}`}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  로그인 후 견적 요청
                </Link>
              )}
            </section>
          </div>
        </div>

        {/* Services & Pricing */}
        <section className="mt-5 rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm sm:p-8">
          <h2 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">
            서비스 · 가격
          </h2>
          {displayServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              등록된 서비스 정보가 없습니다. 견적 요청으로 문의해 주세요.
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(servicesByType).map(([eventType, svcs]) => (
                <div key={eventType}>
                  {!contextType && (
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">
                      {getEventTypeLabel(eventType)}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {svcs.map((svc) => (
                      <div
                        key={svc.id}
                        className="rounded-2xl border border-border/40 bg-white/70 p-4"
                      >
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {svc.name}
                          </p>
                          <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {getQuoteServiceModuleLabel({
                              eventType: svc.eventType,
                              serviceCategory: svc.module,
                            })}
                          </span>
                        </div>
                        {svc.description && (
                          <p className="mb-2 text-xs leading-5 text-muted-foreground/80">
                            {svc.description}
                          </p>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-primary">
                            {svc.basePrice.toLocaleString()}원
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {svc.pricingType === "PER_GUEST" ? "/ 인당" : ""}
                            {svc.maxGuests ? ` / 최대 ${svc.maxGuests}인` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        {vendor.receivedReviews.length > 0 && (
          <section className="mt-5 rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm sm:p-8">
            <h2 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">
              리뷰 ({ratings.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {vendor.receivedReviews.map((review, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-white/70 p-4">
                  <div className="mb-2 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted/40"}`}
                      />
                    ))}
                  </div>
                  {review.title && (
                    <p className="mb-1 text-sm font-semibold text-foreground">{review.title}</p>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground line-clamp-3">{review.content}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
