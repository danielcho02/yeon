import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  EventType,
  ModuleCategory,
  Prisma,
  PrismaClient,
  QuoteStatus,
  ReservationStatus,
  UserRole,
  VendorApprovalStatus
} from "../generated/prisma/client";

import {
  demoAccountCredentials,
  demoAccountPassword,
  ensureDemoData
} from "../lib/demo/ensure-demo-data";

import type { QuoteResponseModules } from "../types/quote";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

const day = 24 * 60 * 60 * 1000;

function plusDays(days: number) {
  return new Date(Date.now() + days * day);
}

function asJson(value: QuoteResponseModules): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

async function createVendorModules(
  vendorId: string,
  modules: Array<{
    name: string;
    category: ModuleCategory;
    price: number;
    pricingType?: "FLAT" | "PER_GUEST";
    description: string;
    isBaseIncluded?: boolean;
    sortOrder: number;
  }>
) {
  const created = [];

  for (const module of modules) {
    created.push(
      await prisma.vendorServiceModule.create({
        data: {
          vendorId,
          name: module.name,
          category: module.category,
          price: module.price,
          pricingType: module.pricingType ?? "FLAT",
          description: module.description,
          isBaseIncluded: module.isBaseIncluded ?? false,
          sortOrder: module.sortOrder,
          isActive: true
        }
      })
    );
  }

  return created;
}

async function seedModularQuoteData() {
  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.quoteResponse.deleteMany();
  await prisma.quoteRequest.deleteMany();
  await prisma.vendorServiceModule.deleteMany();

  const planner = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.planner }
  });
  const venueVendor = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.venue }
  });
  const cateringVendor = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.catering }
  });
  const studioVendor = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.memorial }
  });
  const weddingPlan = await prisma.eventPlan.findUniqueOrThrow({
    where: { slug: "spring-garden-wedding" }
  });
  const funeralPlan = await prisma.eventPlan.findUniqueOrThrow({
    where: { slug: "family-funeral-guidance" }
  });

  await prisma.user.update({
    where: { id: venueVendor.id },
    data: {
      name: "모먼트 가든",
      companyName: "모먼트 가든",
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["venue"],
      bio: "가든 웨딩과 프라이빗 예식을 운영하는 예식장입니다.",
      location: "서울 강남구"
    }
  });

  await prisma.user.update({
    where: { id: cateringVendor.id },
    data: {
      name: "테이블앤코 케이터링",
      companyName: "테이블앤코 케이터링",
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      supportedEventTypes: [EventType.WEDDING, EventType.FUNERAL],
      supportedServiceModules: ["venue", "funeralHall"],
      bio: "웨딩 피로연과 조문객 식사를 모두 지원하는 케이터링 업체입니다.",
      location: "서울 성동구"
    }
  });

  await prisma.user.update({
    where: { id: studioVendor.id },
    data: {
      name: "블루필름 스튜디오",
      companyName: "블루필름 스튜디오",
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["studio"],
      bio: "본식 스냅, 영상, 앨범 제작을 제공하는 스튜디오입니다.",
      location: "서울 마포구"
    }
  });

  const venueModules = await createVendorModules(venueVendor.id, [
    {
      name: "가든 예식홀 대관",
      category: ModuleCategory.VENUE,
      price: 1_800_000,
      description: "야외 가든과 실내 홀 동시 사용",
      isBaseIncluded: true,
      sortOrder: 1
    },
    {
      name: "신부 대기실",
      category: ModuleCategory.VENUE,
      price: 250_000,
      description: "전용 대기실과 웰컴 드링크",
      sortOrder: 2
    },
    {
      name: "음향·조명 패키지",
      category: ModuleCategory.DECORATION,
      price: 450_000,
      description: "마이크, 스피커, 무대 조명",
      isBaseIncluded: true,
      sortOrder: 3
    },
    {
      name: "플라워 버진로드",
      category: ModuleCategory.DECORATION,
      price: 750_000,
      description: "계절 생화 버진로드 장식",
      sortOrder: 4
    },
    {
      name: "하객 식사 1인",
      category: ModuleCategory.CATERING,
      price: 42_000,
      pricingType: "PER_GUEST",
      description: "한식·양식 혼합 코스 1인",
      sortOrder: 5
    },
    {
      name: "모바일 청첩장 기본형",
      category: ModuleCategory.INVITATION,
      price: 120_000,
      description: "사진 8장과 지도 링크 포함",
      sortOrder: 6
    }
  ]);

  const cateringModules = await createVendorModules(cateringVendor.id, [
    {
      name: "프리미엄 웨딩 뷔페",
      category: ModuleCategory.CATERING,
      price: 55_000,
      pricingType: "PER_GUEST",
      description: "스테이크 라이브 스테이션 포함 1인",
      isBaseIncluded: true,
      sortOrder: 1
    },
    {
      name: "음료 바",
      category: ModuleCategory.CATERING,
      price: 9_000,
      pricingType: "PER_GUEST",
      description: "논알코올 음료와 커피 1인",
      sortOrder: 2
    },
    {
      name: "웨딩 케이크",
      category: ModuleCategory.CATERING,
      price: 320_000,
      description: "3단 커스텀 케이크",
      sortOrder: 3
    },
    {
      name: "조문객 식사",
      category: ModuleCategory.MEAL,
      price: 15_000,
      pricingType: "PER_GUEST",
      description: "국밥·반찬 세트 1인",
      isBaseIncluded: true,
      sortOrder: 4
    },
    {
      name: "장례 접객 스태프",
      category: ModuleCategory.CEREMONY,
      price: 280_000,
      description: "접객 안내 인력 2인",
      sortOrder: 5
    }
  ]);

  const studioModules = await createVendorModules(studioVendor.id, [
    {
      name: "본식 스냅 2인 작가",
      category: ModuleCategory.PHOTO,
      price: 1_200_000,
      description: "본식 전체 촬영과 원본 제공",
      isBaseIncluded: true,
      sortOrder: 1
    },
    {
      name: "웨딩 영상",
      category: ModuleCategory.PHOTO,
      price: 900_000,
      description: "하이라이트 영상 1편",
      sortOrder: 2
    },
    {
      name: "앨범 제작",
      category: ModuleCategory.PHOTO,
      price: 380_000,
      description: "30페이지 프리미엄 앨범",
      sortOrder: 3
    },
    {
      name: "야외 촬영",
      category: ModuleCategory.PHOTO,
      price: 650_000,
      description: "서울 근교 야외 로케이션 1곳",
      sortOrder: 4
    },
    {
      name: "드레스 리터칭",
      category: ModuleCategory.DRESS,
      price: 180_000,
      description: "촬영 컷 색감·드레스 라인 보정",
      sortOrder: 5
    }
  ]);

  const venuePending = await prisma.quoteRequest.create({
    data: {
      planId: weddingPlan.id,
      vendorId: venueVendor.id,
      requirements: "가든 예식홀과 기본 장식 견적을 요청합니다.",
      selectedModules: venueModules.slice(0, 3).map((module) => module.id),
      preferredDate: plusDays(45),
      budget: 4_000_000,
      status: QuoteStatus.PENDING
    }
  });

  await prisma.reservation.create({
    data: {
      eventPlanId: weddingPlan.id,
      vendorId: venueVendor.id,
      quoteRequestId: venuePending.id,
      serviceName: "가든 예식홀 대관 외 2개",
      serviceCategory: "VENUE",
      serviceDate: plusDays(45),
      guestCount: 160,
      quotedAmount: 4_000_000,
      confirmedAmount: null,
      selectedServiceOptions: venueModules.slice(0, 3).map((module) => ({
        catalogKey: module.id,
        name: module.name,
        price: module.price,
        pricingType: "FLAT"
      })),
      status: ReservationStatus.PENDING,
      notes: "가든 예식홀과 기본 장식 견적을 요청합니다."
    }
  });

  const studioResponded = await prisma.quoteRequest.create({
    data: {
      planId: weddingPlan.id,
      vendorId: studioVendor.id,
      requirements: "본식 스냅과 영상 촬영 패키지가 필요합니다.",
      selectedModules: studioModules.slice(0, 3).map((module) => module.id),
      preferredDate: plusDays(45),
      budget: 2_500_000,
      status: QuoteStatus.RESPONDED
    }
  });
  const studioResponse = await prisma.quoteResponse.create({
    data: {
      requestId: studioResponded.id,
      vendorId: studioVendor.id,
      basePrice: 1_200_000,
      modules: asJson({
        basePackage: {
          name: "스냅 기본 패키지",
          price: 1_200_000,
          description: "본식 스냅 2인 작가"
        },
        includedModules: [
          {
            id: studioModules[1].id,
            name: studioModules[1].name,
            category: studioModules[1].category,
            price: studioModules[1].price
          }
        ],
        optionalModules: [
          {
            id: studioModules[2].id,
            name: studioModules[2].name,
            category: studioModules[2].category,
            price: studioModules[2].price
          }
        ],
        excludedModules: []
      }),
      totalPrice: 2_100_000,
      note: "촬영 원본은 2주 내 전달됩니다."
    }
  });

  await prisma.reservation.create({
    data: {
      eventPlanId: weddingPlan.id,
      vendorId: studioVendor.id,
      quoteRequestId: studioResponded.id,
      quoteResponseId: studioResponse.id,
      serviceName: "스냅 기본 패키지",
      serviceCategory: "PHOTO",
      serviceDate: plusDays(45),
      guestCount: 160,
      quotedAmount: 2_100_000,
      confirmedAmount: null,
      status: ReservationStatus.PENDING,
      notes: "촬영 원본은 2주 내 전달됩니다."
    }
  });

  const cateringAccepted = await prisma.quoteRequest.create({
    data: {
      planId: weddingPlan.id,
      vendorId: cateringVendor.id,
      requirements: "160명 기준 식사와 음료 견적을 받고 싶습니다.",
      selectedModules: cateringModules.slice(0, 3).map((module) => module.id),
      preferredDate: plusDays(45),
      budget: 9_000_000,
      status: QuoteStatus.ACCEPTED
    }
  });
  const acceptedResponse = await prisma.quoteResponse.create({
    data: {
      requestId: cateringAccepted.id,
      vendorId: cateringVendor.id,
      basePrice: 8_800_000,
      modules: asJson({
        basePackage: {
          name: "160인 웨딩 케이터링",
          price: 8_800_000,
          description: "프리미엄 뷔페 160인"
        },
        includedModules: [
          {
            id: cateringModules[1].id,
            name: cateringModules[1].name,
            category: cateringModules[1].category,
            price: 1_440_000
          }
        ],
        optionalModules: [
          {
            id: cateringModules[2].id,
            name: cateringModules[2].name,
            category: cateringModules[2].category,
            price: cateringModules[2].price
          }
        ],
        excludedModules: []
      }),
      totalPrice: 10_240_000,
      note: "음료 바는 인원 확정 후 최종 조정 가능합니다."
    }
  });

  await prisma.quoteRequest.create({
    data: {
      planId: funeralPlan.id,
      vendorId: cateringVendor.id,
      requirements: "조문객 50명 기준 식사와 접객 스태프 견적이 필요합니다.",
      selectedModules: cateringModules.slice(3, 5).map((module) => module.id),
      preferredDate: plusDays(12),
      budget: 1_500_000,
      status: QuoteStatus.CANCELED
    }
  });

  const funeralResponded = await prisma.quoteRequest.create({
    data: {
      planId: funeralPlan.id,
      vendorId: cateringVendor.id,
      requirements: "장례식장 식사만 별도 견적을 요청합니다.",
      selectedModules: [cateringModules[3].id],
      preferredDate: plusDays(12),
      budget: 900_000,
      status: QuoteStatus.RESPONDED
    }
  });
  await prisma.quoteResponse.create({
    data: {
      requestId: funeralResponded.id,
      vendorId: cateringVendor.id,
      basePrice: 750_000,
      modules: asJson({
        basePackage: {
          name: "조문객 식사 50인",
          price: 750_000,
          description: "국밥·반찬 세트 50인"
        },
        includedModules: [],
        optionalModules: [
          {
            id: cateringModules[4].id,
            name: cateringModules[4].name,
            category: cateringModules[4].category,
            price: cateringModules[4].price
          }
        ],
        excludedModules: []
      }),
      totalPrice: 750_000,
      note: "당일 10명 단위 증감 가능합니다."
    }
  });

  await prisma.reservation.create({
    data: {
      eventPlanId: weddingPlan.id,
      vendorId: cateringVendor.id,
      quoteRequestId: cateringAccepted.id,
      quoteResponseId: acceptedResponse.id,
      serviceName: "160인 웨딩 케이터링",
      serviceCategory: "CATERING",
      serviceDate: plusDays(45),
      guestCount: 160,
      quotedAmount: 10_240_000,
      confirmedAmount: null,
      status: ReservationStatus.PENDING,
      notes: "견적 수락 완료, 업체 최종 확정 대기"
    }
  });

  const funeralResponse = await prisma.quoteResponse.findFirstOrThrow({
    where: { requestId: funeralResponded.id }
  });

  await prisma.reservation.create({
    data: {
      eventPlanId: funeralPlan.id,
      vendorId: cateringVendor.id,
      quoteRequestId: funeralResponded.id,
      quoteResponseId: funeralResponse.id,
      serviceName: "조문객 식사 50인",
      serviceCategory: "MEAL",
      serviceDate: plusDays(12),
      guestCount: 50,
      quotedAmount: 750_000,
      confirmedAmount: null,
      status: ReservationStatus.PENDING,
      notes: "당일 10명 단위 증감 가능합니다."
    }
  });
}

async function main() {
  await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL");
  await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 10000");

  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.post.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.quoteResponse.deleteMany();
  await prisma.quoteRequest.deleteMany();
  await prisma.eventPlan.deleteMany();
  await prisma.vendorServiceOption.deleteMany();
  await prisma.vendorService.deleteMany();
  await prisma.vendorServiceModule.deleteMany();
  await prisma.user.deleteMany();

  await ensureDemoData(prisma);
  await seedModularQuoteData();

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.eventPlan.count(),
    prisma.reservation.count(),
    prisma.post.count(),
    prisma.review.count(),
    prisma.transaction.count(),
    prisma.invitation.count(),
    prisma.vendorServiceModule.count(),
    prisma.quoteRequest.count(),
    prisma.quoteResponse.count()
  ]);

  console.log("Seed complete");
  console.log(
    JSON.stringify(
      {
        users: counts[0],
        eventPlans: counts[1],
        reservations: counts[2],
        posts: counts[3],
        reviews: counts[4],
        transactions: counts[5],
        invitations: counts[6],
        vendorServiceModules: counts[7],
        quoteRequests: counts[8],
        quoteResponses: counts[9],
        demoAccounts: {
          planner: `${demoAccountCredentials.planner} / ${demoAccountPassword}`,
          vendor: `${demoAccountCredentials.venue} / ${demoAccountPassword}`,
          admin: `${demoAccountCredentials.admin} / ${demoAccountPassword}`
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Seed failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
