import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { EventStatus, EventType, PrismaClient, QuoteStatus, ReservationStatus } from "../generated/prisma/client";
import type { Prisma } from "../generated/prisma/client";
import { demoAccountCredentials } from "../lib/demo/ensure-demo-data";
import { generateStep3MockAIRecommendation } from "../lib/mocks/step3-ai-recommendation";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

const day = 24 * 60 * 60 * 1000;
function plusDays(n: number) { return new Date(Date.now() + n * day); }
function asJson(v: unknown) { return v as unknown as Prisma.InputJsonValue; }

async function upsertScenarioPlans(plannerId: string) {
  const weddingPlanData = {
    ownerId: plannerId,
    title: "봄빛 가든 웨딩",
    type: EventType.WEDDING,
    status: EventStatus.PLANNING,
    hostName: "김연우",
    honoreeName: "김연우 · 최하준",
    venueName: "모먼트 가든",
    region: "서울",
    scheduledAt: plusDays(45),
    guestTarget: 160,
    budget: 4_800_000,
    description: "따뜻한 정원 결혼식을 위한 메인 행사 플랜입니다.",
    aiRecommendation: generateStep3MockAIRecommendation({
      budget: 4_800_000,
      guestCount: 160,
      region: "서울",
      eventType: EventType.WEDDING,
      description: "소프트 로즈와 샴페인 톤, 가족 중심 동선, 자연광 포토존"
    })
  };

  const funeralPlanData = {
    ownerId: plannerId,
    title: "가족 장례 안내",
    type: EventType.FUNERAL,
    status: EventStatus.PUBLISHED,
    hostName: "김연우",
    honoreeName: "故 김정훈",
    venueName: "한결 추모관",
    region: "인천",
    scheduledAt: plusDays(12),
    guestTarget: 48,
    budget: 2_500_000,
    description: "조용하고 안정적인 조문 동선과 안내가 중요한 가족 장례 일정입니다.",
    aiRecommendation: generateStep3MockAIRecommendation({
      budget: 2_500_000,
      guestCount: 48,
      region: "인천",
      eventType: EventType.FUNERAL,
      description: "차분한 안내, 주차 동선, 접객 인력 최소화, 정보 전달 명확성"
    })
  };

  const weddingPlan = await prisma.eventPlan.upsert({
    where: { slug: "spring-garden-wedding" },
    update: weddingPlanData,
    create: {
      slug: "spring-garden-wedding",
      ...weddingPlanData
    }
  });

  const funeralPlan = await prisma.eventPlan.upsert({
    where: { slug: "family-funeral-guidance" },
    update: funeralPlanData,
    create: {
      slug: "family-funeral-guidance",
      ...funeralPlanData
    }
  });

  return { weddingPlan, funeralPlan };
}

async function main() {
  const stateArg = process.argv.find(a => a.startsWith("--state="))?.replace("--state=", "") ?? "C";
  const state = stateArg.toUpperCase() as "A" | "B" | "C" | "D";

  const planner = await prisma.user.findUniqueOrThrow({ where: { email: demoAccountCredentials.planner } });
  const venueVendor = await prisma.user.findUniqueOrThrow({ where: { email: demoAccountCredentials.venue } });
  const funeralVendor = await prisma.user.findUniqueOrThrow({ where: { email: demoAccountCredentials.memorial } });
  const { weddingPlan, funeralPlan } = await upsertScenarioPlans(planner.id);

  const venueModules = await prisma.vendorServiceModule.findMany({ where: { vendorId: venueVendor.id, isActive: true }, orderBy: { sortOrder: "asc" } });
  const funeralModules = await prisma.vendorServiceModule.findMany({ where: { vendorId: funeralVendor.id, isActive: true }, orderBy: { sortOrder: "asc" } });

  if (venueModules.length === 0 || funeralModules.length === 0) {
    throw new Error("Missing VendorServiceModules. Run npm run db:seed before scenario seed.");
  }

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
