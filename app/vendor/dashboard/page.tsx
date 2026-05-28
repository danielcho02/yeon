export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { VendorWorkspace } from "@/components/features/planning/vendor-workspace";
import type { ReservationItem } from "@/components/features/planning/workspace-types";
import { Nav } from "@/components/nav";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getVendorSupportedEventTypes,
  getVendorSupportedServiceModules
} from "@/lib/step3.shared";
import { VendorOnboardingForm } from "./onboarding-form";
import { ServiceManager } from "./service-manager";

export default async function VendorDashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) redirect("/login?callbackUrl=/vendor/dashboard");
  if (session.user.role !== "VENDOR") redirect("/plans");

  const vendorId = session.user.id;

  const [vendor, rawReservations, vendorServices] = await Promise.all([
    prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        companyName: true,
        name: true,
        supportedEventTypes: true,
        supportedServiceModules: true
      }
    }),
    prisma.reservation.findMany({
      where: { vendorId },
      select: {
        id: true,
        serviceName: true,
        serviceCategory: true,
        serviceDate: true,
        guestCount: true,
        quotedAmount: true,
        confirmedAmount: true,
        vendorConfirmationDueAt: true,
        notes: true,
        status: true,
        quoteRequestId: true,
        quoteResponseId: true,
        quoteRequest: {
          select: {
            status: true
          }
        },
        selectedServiceOptions: true,
        eventPlan: {
          select: {
            id: true,
            title: true,
            type: true,
            region: true,
            scheduledAt: true,
            hostName: true,
            honoreeName: true
          }
        },
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.vendorService.findMany({
      where: { vendorId },
      select: {
        id: true,
        eventType: true,
        module: true,
        catalogKey: true,
        pricingType: true,
        name: true,
        description: true,
        basePrice: true,
        isActive: true
      },
      orderBy: [{ eventType: "asc" }, { module: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const supportedEventTypes = getVendorSupportedEventTypes({
    supportedEventTypes: vendor?.supportedEventTypes
  });
  const supportedServiceModules = getVendorSupportedServiceModules({
    supportedServiceModules: vendor?.supportedServiceModules
  });

  if (supportedEventTypes.length === 0) {
    return <VendorOnboardingForm />;
  }

  const reservations: ReservationItem[] = rawReservations.map((r) => ({
    id: r.id,
    serviceName: r.serviceName,
    serviceCategory: r.serviceCategory,
    serviceDate: r.serviceDate?.toISOString() ?? null,
    guestCount: r.guestCount,
    quotedAmount: r.quotedAmount,
    confirmedAmount: r.confirmedAmount,
    vendorConfirmationDueAt: r.vendorConfirmationDueAt?.toISOString() ?? null,
    notes: r.notes,
    status: r.status as ReservationItem["status"],
    quoteRequestId: r.quoteRequestId,
    quoteResponseId: r.quoteResponseId,
    quoteRequestStatus: r.quoteRequest?.status ?? null,
    selectedServiceOptions: r.selectedServiceOptions as ReservationItem["selectedServiceOptions"] ?? null,
    eventPlan: {
      id: r.eventPlan.id,
      title: r.eventPlan.title,
      type: r.eventPlan.type ?? undefined,
      region: r.eventPlan.region,
      scheduledAt: r.eventPlan.scheduledAt?.toISOString() ?? null,
      hostName: r.eventPlan.hostName,
      honoreeName: r.eventPlan.honoreeName
    },
    vendor: {
      id: r.vendor.id,
      name: r.vendor.name,
      companyName: r.vendor.companyName,
      location: r.vendor.location
    }
  }));

  const companyName = vendor?.companyName ?? vendor?.name ?? "업체 대시보드";

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground/55">
            Vendor Dashboard
          </p>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground sm:text-3xl">
            {companyName}
          </h1>
        </div>

        <VendorWorkspace
          viewerName={session.user.name ?? vendor?.name ?? "업체"}
          viewerEmail={session.user.email ?? ""}
          companyName={companyName}
          reservations={reservations}
          supportedEventTypes={supportedEventTypes}
        />

        <section className="mt-10">
          <h2 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">
            내 서비스 관리
          </h2>
          <div className="rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm">
            <ServiceManager
              supportedEventTypes={supportedEventTypes}
              supportedModules={supportedServiceModules}
              existingServices={vendorServices}
            />
          </div>
        </section>

      </main>
    </div>
  );
}
