import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  EventType,
  ModuleCategory,
  PrismaClient,
  UserRole,
  VendorApprovalStatus
} from "../generated/prisma/client";

import {
  demoAccountCredentials,
  demoAccountPassword,
  ensureDemoData
} from "../lib/demo/ensure-demo-data";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});


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

  const venueVendor = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.venue }
  });
  const floralVendor = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.catering }
  });
  const funeralVendor = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.memorial }
  });

  await prisma.user.update({
    where: { id: venueVendor.id },
    data: {
      name: "모먼트 가든",
      companyName: "모먼트 가든",
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["venue", "floral"],
      bio: "가든 웨딩과 프라이빗 예식을 운영하는 예식장입니다.",
      location: "서울 강남구"
    }
  });

  await prisma.user.update({
    where: { id: floralVendor.id },
    data: {
      name: "오르세 플로럴",
      companyName: "오르세 플로럴",
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["floral"],
      bio: "웨딩 부케·예식장 꽃장식 전문, 화이트·보타니컬 스타일 시그니처",
      location: "서울 성동구",
      isActive: false
    }
  });

  await prisma.user.update({
    where: { id: funeralVendor.id },
    data: {
      name: "한결 의전",
      companyName: "한결 의전",
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      supportedEventTypes: [EventType.FUNERAL],
      supportedServiceModules: ["funeralHall", "altarFloral", "hearse"],
      bio: "장례 진행 동선과 조문 안내를 돕는 의전 운영 전문 업체입니다.",
      location: "인천 남동구"
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
      isBaseIncluded: true,
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
    },
    {
      name: "웰컴 사인보드 커스텀 제작",
      category: ModuleCategory.DECORATION,
      price: 180_000,
      description: "행사명과 동선을 반영한 현장 사인보드 제작",
      sortOrder: 7
    },
    {
      name: "야외 버진로드 런너 추가",
      category: ModuleCategory.DECORATION,
      price: 220_000,
      description: "잔디 및 야외 동선용 추가 런너 설치",
      sortOrder: 8
    }
  ]);

  const floralModules = await createVendorModules(floralVendor.id, [
    {
      name: "신부 부케",
      category: ModuleCategory.DECORATION,
      price: 180_000,
      description: "계절꽃 핸드타이드 부케, 화이트·크림 톤",
      isBaseIncluded: true,
      sortOrder: 1
    },
    {
      name: "예식장 꽃장식",
      category: ModuleCategory.DECORATION,
      price: 650_000,
      description: "버진로드·메인 아치·양쪽 스탠드 꽃장식 풀세트",
      sortOrder: 2
    },
    {
      name: "피로연 테이블 장식",
      category: ModuleCategory.DECORATION,
      price: 350_000,
      description: "테이블당 센터피스 10테이블 기준",
      sortOrder: 3
    },
    {
      name: "신랑 부토니에",
      category: ModuleCategory.DECORATION,
      price: 35_000,
      description: "부케와 같은 컬러 톤의 부토니에",
      sortOrder: 4
    }
  ]);

  const funeralModules = await createVendorModules(funeralVendor.id, [
    {
      name: "빈소 기본 3일",
      category: ModuleCategory.FUNERAL_HALL,
      price: 950_000,
      description: "빈소 공간 3일 운영과 조문 접수 지원",
      isBaseIncluded: true,
      sortOrder: 1
    },
    {
      name: "문상객 식사",
      category: ModuleCategory.MEAL,
      price: 12_000,
      pricingType: "PER_GUEST",
      description: "국밥·반찬 세트 1인",
      sortOrder: 2
    },
    {
      name: "장례 지도사",
      category: ModuleCategory.OBITUARY,
      price: 300_000,
      description: "전문 장례 지도사 1인, 절차 안내 전체 동행",
      sortOrder: 3
    },
    {
      name: "기본 제단꽃 세트",
      category: ModuleCategory.WREATH,
      price: 380_000,
      description: "영정 사진 액자, 국화 꽃 장식, 향초 포함",
      sortOrder: 4
    },
    {
      name: "시내 운구",
      category: ModuleCategory.TRANSPORT,
      price: 350_000,
      description: "수도권·인천 기준 편도 운구 차량 1대",
      sortOrder: 5
    },
    {
      name: "추모 동선 안내 사인물",
      category: ModuleCategory.OBITUARY,
      price: 90_000,
      description: "빈소 내 조문 동선 및 안내 표지 세트",
      sortOrder: 6
    }
  ]);

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
