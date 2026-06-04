import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, QuoteStatus, ReservationStatus } from "../generated/prisma/client";
import type { Prisma } from "../generated/prisma/client";
import { demoAccountCredentials } from "../lib/demo/ensure-demo-data";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

const day = 24 * 60 * 60 * 1000;
function plusDays(n: number) { return new Date(Date.now() + n * day); }
function asJson(v: unknown) { return v as unknown as Prisma.InputJsonValue; }

async function main() {
  const stateArg = process.argv.find(a => a.startsWith("--state="))?.replace("--state=", "") ?? "C";
  const state = stateArg.toUpperCase() as "A" | "B" | "C" | "D";

  const venueVendor = await prisma.user.findUniqueOrThrow({ where: { email: demoAccountCredentials.venue } });
  const funeralVendor = await prisma.user.findUniqueOrThrow({ where: { email: demoAccountCredentials.memorial } });
  const weddingPlan = await prisma.eventPlan.findUniqueOrThrow({ where: { slug: "spring-garden-wedding" } });
  const funeralPlan = await prisma.eventPlan.findUniqueOrThrow({ where: { slug: "family-funeral-guidance" } });

  const venueModules = await prisma.vendorServiceModule.findMany({ where: { vendorId: venueVendor.id, isActive: true }, orderBy: { sortOrder: "asc" } });
  const funeralModules = await prisma.vendorServiceModule.findMany({ where: { vendorId: funeralVendor.id, isActive: true }, orderBy: { sortOrder: "asc" } });

  // Guard: don't create duplicate active requests
  const existingVenue = await prisma.quoteRequest.findFirst({
    where: { planId: weddingPlan.id, vendorId: venueVendor.id, status: { in: ["PENDING", "RESPONDED", "ACCEPTED"] } }
  });
  const existingFuneral = await prisma.quoteRequest.findFirst({
    where: { planId: funeralPlan.id, vendorId: funeralVendor.id, status: { in: ["PENDING", "RESPONDED", "ACCEPTED"] } }
  });

  if (existingVenue || existingFuneral) {
    console.log(`[seed-demo-scenario] Active QuoteRequests already exist. Run npm run db:seed first to reset.`);
    process.exit(1);
  }

  // State A: QuoteRequest(PENDING) only
  const venueReqStatus = state === "A" ? QuoteStatus.PENDING : QuoteStatus.RESPONDED;
  const funeralReqStatus = state === "A" ? QuoteStatus.PENDING : QuoteStatus.RESPONDED;

  const venueReq = await prisma.quoteRequest.create({
    data: {
      planId: weddingPlan.id,
      vendorId: venueVendor.id,
      requirements: "가든 예식홀과 기본 장식 견적을 요청합니다.",
      selectedModules: venueModules.slice(0, 3).map(m => m.id),
      preferredDate: plusDays(45),
      budget: 4_000_000,
      status: venueReqStatus
    }
  });

  const funeralReq = await prisma.quoteRequest.create({
    data: {
      planId: funeralPlan.id,
      vendorId: funeralVendor.id,
      requirements: "장례 기본 준비 견적을 요청합니다.",
      selectedModules: funeralModules.slice(0, 2).map(m => m.id),
      preferredDate: plusDays(12),
      budget: 1_500_000,
      status: funeralReqStatus
    }
  });

  if (state === "A") {
    console.log(`[seed-demo-scenario] State A complete: 2 QuoteRequests(PENDING), 0 QuoteResponses, 0 Reservations`);
    return;
  }

  // State B: QuoteResponse added, status RESPONDED, NO Reservation
  const venueResp = await prisma.quoteResponse.create({
    data: {
      requestId: venueReq.id,
      vendorId: venueVendor.id,
      basePrice: 2_500_000,
      modules: asJson({
        basePackage: { name: "모먼트 가든 웨딩 패키지", price: 2_500_000, description: "가든 예식홀 대관, 음향·조명 패키지, 신부 대기실 포함" },
        includedModules: venueModules.slice(0, 3).map((module) => ({
          id: module.id,
          name: module.name,
          category: module.category,
          price: 0
        })),
        optionalModules: [],
        excludedModules: []
      }),
      totalPrice: 2_500_000,
      note: "하객 식사(1인 42,000원)와 모바일 청첩장은 별도 추가 가능합니다."
    }
  });

  const funeralResp = await prisma.quoteResponse.create({
    data: {
      requestId: funeralReq.id,
      vendorId: funeralVendor.id,
      basePrice: 1_250_000,
      modules: asJson({
        basePackage: { name: "한결 의전 기본 패키지", price: 1_250_000, description: "빈소 기본 3일 + 문상객 식사 50인" },
        includedModules: funeralModules.slice(0, 2).map((module) => ({
          id: module.id,
          name: module.name,
          category: module.category,
          price: 0
        })),
        optionalModules: [],
        excludedModules: []
      }),
      totalPrice: 1_250_000,
      note: "당일 10명 단위 증감 가능합니다."
    }
  });

  if (state === "B") {
    console.log(`[seed-demo-scenario] State B complete: 2 QuoteRequests(RESPONDED), 2 QuoteResponses, 0 Reservations`);
    return;
  }

  // State C: QuoteRequest ACCEPTED + Reservation(PENDING) — canonical create-at-accept
  await prisma.quoteRequest.update({ where: { id: venueReq.id }, data: { status: QuoteStatus.ACCEPTED } });
  await prisma.quoteRequest.update({ where: { id: funeralReq.id }, data: { status: QuoteStatus.ACCEPTED } });

  const dueAt = plusDays(2);

  const venueRes = await prisma.reservation.create({
    data: {
      eventPlanId: weddingPlan.id,
      vendorId: venueVendor.id,
      quoteRequestId: venueReq.id,
      quoteResponseId: venueResp.id,
      serviceName: "모먼트 가든 웨딩 패키지",
      serviceCategory: "VENUE",
      serviceDate: plusDays(45),
      guestCount: 160,
      quotedAmount: 2_500_000,
      confirmedAmount: null,
      vendorConfirmationDueAt: dueAt,
      selectedServiceOptions: asJson(venueModules.slice(0, 3).map(m => ({ catalogKey: m.id, name: m.name, price: m.price, pricingType: m.pricingType }))),
      status: ReservationStatus.PENDING,
      notes: "견적 수락 완료, 업체 최종 확정 대기"
    }
  });

  const funeralRes = await prisma.reservation.create({
    data: {
      eventPlanId: funeralPlan.id,
      vendorId: funeralVendor.id,
      quoteRequestId: funeralReq.id,
      quoteResponseId: funeralResp.id,
      serviceName: "한결 의전 기본 패키지",
      serviceCategory: "FUNERAL_HALL",
      serviceDate: plusDays(12),
      guestCount: 50,
      quotedAmount: 1_250_000,
      confirmedAmount: null,
      vendorConfirmationDueAt: dueAt,
      selectedServiceOptions: asJson(funeralModules.slice(0, 2).map(m => ({ catalogKey: m.id, name: m.name, price: m.price, pricingType: m.pricingType }))),
      status: ReservationStatus.PENDING,
      notes: "견적 수락 완료, 업체 최종 확정 대기"
    }
  });

  if (state === "C") {
    console.log(`[seed-demo-scenario] State C complete: 2 QuoteRequests(ACCEPTED), 2 QuoteResponses, 2 Reservations(PENDING)`);
    return;
  }

  // State D: Reservation CONFIRMED
  await prisma.reservation.update({ where: { id: venueRes.id }, data: { status: ReservationStatus.CONFIRMED, confirmedAmount: venueRes.quotedAmount } });
  await prisma.reservation.update({ where: { id: funeralRes.id }, data: { status: ReservationStatus.CONFIRMED, confirmedAmount: funeralRes.quotedAmount } });

  console.log(`[seed-demo-scenario] State D complete: 2 QuoteRequests(ACCEPTED), 2 QuoteResponses, 2 Reservations(CONFIRMED)`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
