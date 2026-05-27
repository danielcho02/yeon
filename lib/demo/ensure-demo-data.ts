import {
  EventStatus,
  EventType,
  Prisma,
  ReservationStatus,
  TransactionStatus,
  UserRole,
  VendorApprovalStatus,
  type PrismaClient
} from "../../generated/prisma/client";

import { hashPassword } from "../auth/password";
import { generateStep3MockAIRecommendation } from "../mocks/step3-ai-recommendation";

const day = 24 * 60 * 60 * 1000;

export const demoAccountCredentials = {
  planner: "planner@yeon.local",
  venue: "venue@yeon.local",
  catering: "catering@yeon.local",
  memorial: "memorial@yeon.local",
  guest: "guest@yeon.local",
  admin: "admin@yeon.local"
} as const;

export const demoAccountPassword = "demo1234";

function plusDays(days: number) {
  return new Date(Date.now() + days * day);
}

export function isDemoCredentialEmail(email: string) {
  return Object.values(demoAccountCredentials).includes(
    email as (typeof demoAccountCredentials)[keyof typeof demoAccountCredentials]
  );
}

async function ensureVendorService(
  prisma: PrismaClient,
  data: {
    vendorId: string;
    eventType: string;
    module: string;
    catalogKey?: string | null;
    pricingType?: string;
    name: string;
    description?: string;
    basePrice: number;
    maxGuests?: number;
  }
) {
  const existing = data.catalogKey
    ? await prisma.vendorService.findFirst({
        where: { vendorId: data.vendorId, catalogKey: data.catalogKey },
        select: { id: true }
      })
    : await prisma.vendorService.findFirst({
        where: {
          vendorId: data.vendorId,
          eventType: data.eventType,
          module: data.module,
          name: data.name,
          catalogKey: null
        },
        select: { id: true }
      });

  if (existing) return existing;

  return prisma.vendorService.create({
    data: {
      vendorId: data.vendorId,
      eventType: data.eventType,
      module: data.module,
      catalogKey: data.catalogKey ?? null,
      pricingType: data.pricingType ?? "FLAT",
      name: data.name,
      description: data.description ?? null,
      basePrice: data.basePrice,
      maxGuests: data.maxGuests ?? null,
      isActive: true
    }
  });
}

async function ensureReservation(
  prisma: PrismaClient,
  data: {
    eventPlanId: string;
    vendorId: string;
    serviceName: string;
    serviceCategory: string | null;
    description: string | null;
    serviceDate: Date | null;
    guestCount: number | null;
    quotedAmount: number | null;
    confirmedAmount: number | null;
    selectedServiceOptions?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    status: ReservationStatus;
    notes: string | null;
  }
) {
  const existing = await prisma.reservation.findFirst({
    where: {
      eventPlanId: data.eventPlanId,
      vendorId: data.vendorId,
      serviceName: data.serviceName
    },
    select: { id: true }
  });

  if (existing) {
    return prisma.reservation.findUniqueOrThrow({ where: { id: existing.id } });
  }

  return prisma.reservation.create({ data });
}

export async function ensureDemoData(prisma: PrismaClient) {
  const passwordHash = await hashPassword(demoAccountPassword);

  // ── Users ────────────────────────────────────────────────────────────────

  const planner = await prisma.user.upsert({
    where: { email: demoAccountCredentials.planner },
    update: {
      name: "김연우",
      passwordHash,
      role: UserRole.GENERAL,
      phone: "010-1111-2222",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 마포구",
      bio: "가족 행사와 중요한 순간을 차분하게 준비하는 대표 사용자 샘플입니다."
    },
    create: {
      email: demoAccountCredentials.planner,
      name: "김연우",
      passwordHash,
      role: UserRole.GENERAL,
      phone: "010-1111-2222",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 마포구",
      bio: "가족 행사와 중요한 순간을 차분하게 준비하는 대표 사용자 샘플입니다."
    }
  });

  // venue vendor — WEDDING, module: venue
  const venueVendor = await prisma.user.upsert({
    where: { email: demoAccountCredentials.venue },
    update: {
      name: "모먼트 가든",
      companyName: "모먼트 가든",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-3333-4444",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "서울 강남구",
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["venue"],
      bio: "웨딩과 프라이빗 가족연을 위한 공간 연출 전문 업체입니다."
    },
    create: {
      email: demoAccountCredentials.venue,
      name: "모먼트 가든",
      companyName: "모먼트 가든",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-3333-4444",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "서울 강남구",
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["venue"],
      bio: "웨딩과 프라이빗 가족연을 위한 공간 연출 전문 업체입니다."
    }
  });

  // floral vendor — WEDDING, module: floral (formerly catering@yeon.local)
  const cateringVendor = await prisma.user.upsert({
    where: { email: demoAccountCredentials.catering },
    update: {
      name: "오르세 플로럴",
      companyName: "오르세 플로럴",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-5555-6666",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "서울 성동구",
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["floral"],
      bio: "웨딩 부케·예식장 꽃장식 전문, 화이트·보타니컬 스타일 시그니처"
    },
    create: {
      email: demoAccountCredentials.catering,
      name: "오르세 플로럴",
      companyName: "오르세 플로럴",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-5555-6666",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "서울 성동구",
      supportedEventTypes: [EventType.WEDDING],
      supportedServiceModules: ["floral"],
      bio: "웨딩 부케·예식장 꽃장식 전문, 화이트·보타니컬 스타일 시그니처"
    }
  });

  // memorial vendor — FUNERAL, modules: funeralHall, altarFloral, hearse
  const memorialVendor = await prisma.user.upsert({
    where: { email: demoAccountCredentials.memorial },
    update: {
      name: "한결 의전",
      companyName: "한결 의전",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-2222-4545",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "인천 남동구",
      supportedEventTypes: [EventType.FUNERAL],
      supportedServiceModules: ["funeralHall", "altarFloral", "hearse"],
      bio: "장례 진행 동선과 조문 안내를 돕는 의전 운영 전문 업체입니다."
    },
    create: {
      email: demoAccountCredentials.memorial,
      name: "한결 의전",
      companyName: "한결 의전",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-2222-4545",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "인천 남동구",
      supportedEventTypes: [EventType.FUNERAL],
      supportedServiceModules: ["funeralHall", "altarFloral", "hearse"],
      bio: "장례 진행 동선과 조문 안내를 돕는 의전 운영 전문 업체입니다."
    }
  });

  const guest = await prisma.user.upsert({
    where: { email: demoAccountCredentials.guest },
    update: {
      name: "정서윤",
      passwordHash,
      role: UserRole.GENERAL,
      phone: "010-7777-8888",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 서초구",
      bio: "초대 응답과 후기 흐름을 테스트하기 위한 일반 사용자입니다."
    },
    create: {
      email: demoAccountCredentials.guest,
      name: "정서윤",
      passwordHash,
      role: UserRole.GENERAL,
      phone: "010-7777-8888",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 서초구",
      bio: "초대 응답과 후기 흐름을 테스트하기 위한 일반 사용자입니다."
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: demoAccountCredentials.admin },
    update: {
      name: "운영 관리자",
      passwordHash,
      role: UserRole.ADMIN,
      phone: "010-9999-0000",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 중구",
      bio: "운영자 계정 샘플입니다."
    },
    create: {
      email: demoAccountCredentials.admin,
      name: "운영 관리자",
      passwordHash,
      role: UserRole.ADMIN,
      phone: "010-9999-0000",
      phoneVerifiedAt: new Date(),
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 중구",
      bio: "운영자 계정 샘플입니다."
    }
  });

  // ── Vendor Services (카탈로그 항목 단위) ─────────────────────────────────

  // 모먼트 가든 — WEDDING · venue
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: "venue_hall",
    name: "예식홀 기본 대관",
    description: "200인 기준 야외·실내 겸용, 우천 시 실내 전환 포함",
    basePrice: 1_500_000
  });
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: "venue_sound",
    name: "음향/조명 시스템",
    description: "프로 PA 시스템 + LED 스팟 조명",
    basePrice: 350_000
  });
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: "venue_photo",
    name: "포토존 설치",
    description: "웰컴 보드 + 플로럴 아치 포토존 1세트",
    basePrice: 200_000
  });
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: "venue_bridal",
    name: "신부 대기실 이용",
    description: "전용 브라이덜 룸 + 헤어메이크업 조명 세팅",
    basePrice: 150_000
  });
  // 모먼트 가든 — 식대 항목 (venue 모듈 내)
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: "catering_meal",
    pricingType: "PER_GUEST",
    name: "기본 식대",
    description: "한식·양식 혼합 코스 메뉴, 1인 기준",
    basePrice: 35_000
  });
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: "catering_drink",
    pricingType: "PER_GUEST",
    name: "음료 패키지",
    description: "소프트드링크·주스·물 포함, 1인 기준",
    basePrice: 8_000
  });
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: "catering_cake",
    name: "웨딩 케이크",
    description: "4단 웨딩 케이크 + 커팅 도구 세트",
    basePrice: 280_000
  });
  // 커스텀 항목 (catalogKey 없음)
  await ensureVendorService(prisma, {
    vendorId: venueVendor.id,
    eventType: "WEDDING",
    module: "venue",
    catalogKey: null,
    name: "웨딩 테이블 코디네이션",
    description: "피로연 테이블 전체 꽃·소품 코디 세팅 (10테이블 기준)",
    basePrice: 450_000
  });

  // 오르세 플로럴 — WEDDING · floral
  await ensureVendorService(prisma, {
    vendorId: cateringVendor.id,
    eventType: "WEDDING",
    module: "floral",
    catalogKey: "floral_bouquet",
    name: "신부 부케",
    description: "계절꽃 핸드타이드 부케, 화이트·크림 톤",
    basePrice: 180_000
  });
  await ensureVendorService(prisma, {
    vendorId: cateringVendor.id,
    eventType: "WEDDING",
    module: "floral",
    catalogKey: "floral_ceremony",
    name: "예식장 꽃장식",
    description: "버진로드·제단·양쪽 스탠드 꽃장식 풀세트",
    basePrice: 650_000
  });
  await ensureVendorService(prisma, {
    vendorId: cateringVendor.id,
    eventType: "WEDDING",
    module: "floral",
    catalogKey: "floral_table",
    name: "피로연 테이블 장식",
    description: "테이블당 센터피스 (10테이블 기준)",
    basePrice: 350_000
  });
  await ensureVendorService(prisma, {
    vendorId: cateringVendor.id,
    eventType: "WEDDING",
    module: "floral",
    catalogKey: "floral_boutonniere",
    name: "신랑 부토니에",
    description: "매칭 부케 컬러 코디네이션",
    basePrice: 35_000
  });

  // 한결 의전 — FUNERAL · funeralHall
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "funeralHall",
    catalogKey: "funeral_hall_1d",
    name: "빈소 기본 1일",
    description: "빈소 공간 1일 운영 (조문 접수 포함)",
    basePrice: 400_000
  });
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "funeralHall",
    catalogKey: "funeral_hall_2d",
    name: "빈소 기본 2일",
    description: "빈소 공간 2일 운영 (조문 접수 포함)",
    basePrice: 700_000
  });
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "funeralHall",
    catalogKey: "funeral_hall_3d",
    name: "빈소 기본 3일",
    description: "빈소 공간 3일 운영 (조문 접수 포함)",
    basePrice: 950_000
  });
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "funeralHall",
    catalogKey: "funeral_food",
    pricingType: "PER_GUEST",
    name: "문상객 식사",
    description: "조문객 1인 식사 (국밥·반찬 세트)",
    basePrice: 12_000
  });
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "funeralHall",
    catalogKey: "funeral_staff",
    name: "장례 지도사",
    description: "전문 장례 지도사 1인 (진행 전체 동행)",
    basePrice: 300_000
  });

  // 한결 의전 — FUNERAL · altarFloral
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "altarFloral",
    catalogKey: "altar_basic",
    name: "기본 제단꽃 세트",
    description: "영정 사진 액자, 국화 꽃 장식, 향초 포함",
    basePrice: 380_000
  });
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "altarFloral",
    catalogKey: "altar_premium",
    name: "프리미엄 제단꽃 세트",
    description: "백합·카네이션 혼합 대형 제단꽃 + 좌우 스탠드 화환",
    basePrice: 680_000
  });
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "altarFloral",
    catalogKey: "altar_wreath",
    name: "근조 화환 (기본 3개)",
    description: "국화 근조 화환 3개 세트",
    basePrice: 250_000
  });
  // 커스텀 항목
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "altarFloral",
    catalogKey: null,
    name: "추모 사진 액자 대여",
    description: "고인 사진 확대 출력 + 고급 액자 대여 (A3 사이즈)",
    basePrice: 80_000
  });

  // 한결 의전 — FUNERAL · hearse
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "hearse",
    catalogKey: "hearse_local",
    name: "시내 운구 (50km 이내)",
    description: "수도권·인천 기준 편도 운구 차량 1대",
    basePrice: 350_000
  });
  await ensureVendorService(prisma, {
    vendorId: memorialVendor.id,
    eventType: "FUNERAL",
    module: "hearse",
    catalogKey: "hearse_long",
    name: "장거리 운구 (100km 이상)",
    description: "충청·경기 외곽 이상 편도, 운전 기사 포함",
    basePrice: 650_000
  });

  // ── Event Plans ──────────────────────────────────────────────────────────

  const springWedding = await prisma.eventPlan.upsert({
    where: { slug: "spring-garden-wedding" },
    update: {},
    create: {
      ownerId: planner.id,
      title: "봄빛 가든 웨딩",
      slug: "spring-garden-wedding",
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
    }
  });

  const familyFuneral = await prisma.eventPlan.upsert({
    where: { slug: "family-funeral-guidance" },
    update: {},
    create: {
      ownerId: planner.id,
      title: "가족 장례 안내",
      slug: "family-funeral-guidance",
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
    }
  });

  // ── Reservations ────────────────────────────────────────────────────────

  // 모먼트 가든 예약: 예식홀 + 음향 + 포토존 + 식대 선택
  const venueReservation = await ensureReservation(prisma, {
    eventPlanId: springWedding.id,
    vendorId: venueVendor.id,
    serviceName: "venue — 모먼트 가든",
    serviceCategory: "venue",
    description: "예식홀 대관 + 음향/조명 + 포토존 + 식대·음료 패키지",
    serviceDate: plusDays(45),
    guestCount: 160,
    quotedAmount: 9_730_000,
    confirmedAmount: 9_730_000,
    selectedServiceOptions: [
      { catalogKey: "venue_hall",     name: "예식홀 기본 대관",  price: 1_500_000, pricingType: "FLAT"      },
      { catalogKey: "venue_sound",    name: "음향/조명 시스템",   price:   350_000, pricingType: "FLAT"      },
      { catalogKey: "venue_photo",    name: "포토존 설치",        price:   200_000, pricingType: "FLAT"      },
      { catalogKey: "catering_meal",  name: "기본 식대",          price:    35_000, pricingType: "PER_GUEST", quantity: 160, subtotal: 5_600_000 },
      { catalogKey: "catering_drink", name: "음료 패키지",        price:     8_000, pricingType: "PER_GUEST", quantity: 160, subtotal: 1_280_000 },
      { catalogKey: "catering_cake",  name: "웨딩 케이크",        price:   280_000, pricingType: "FLAT"      }
    ],
    status: ReservationStatus.CONFIRMED,
    notes: "우천 시 실내 전환 옵션 별도 조율"
  });

  // 오르세 플로럴 견적 요청: 부케 + 예식장 꽃장식 + 테이블 장식 (대기 중)
  const cateringReservation = await ensureReservation(prisma, {
    eventPlanId: springWedding.id,
    vendorId: cateringVendor.id,
    serviceName: "floral — 오르세 플로럴",
    serviceCategory: "floral",
    description: "신부 부케 + 예식장 꽃장식 + 피로연 테이블 장식",
    serviceDate: plusDays(45),
    guestCount: null,
    quotedAmount: 1_180_000,
    confirmedAmount: null,
    selectedServiceOptions: [
      { catalogKey: "floral_bouquet",   name: "신부 부케",         price: 180_000, pricingType: "FLAT" },
      { catalogKey: "floral_ceremony",  name: "예식장 꽃장식",     price: 650_000, pricingType: "FLAT" },
      { catalogKey: "floral_table",     name: "피로연 테이블 장식", price: 350_000, pricingType: "FLAT" }
    ],
    status: ReservationStatus.PENDING,
    notes: "화이트·크림 컬러 통일, 부케 리스 추가 여부 상담 요청"
  });

  // 모먼트 가든 추가 문의: 브라이덜 룸
  const venueInquiryReservation = await ensureReservation(prisma, {
    eventPlanId: springWedding.id,
    vendorId: venueVendor.id,
    serviceName: "venue — 모먼트 가든 (신부 대기실)",
    serviceCategory: "venue",
    description: "신부 대기실 이용 + 테이블 코디네이션 추가 문의",
    serviceDate: plusDays(45),
    guestCount: null,
    quotedAmount: 600_000,
    confirmedAmount: null,
    selectedServiceOptions: [
      { catalogKey: "venue_bridal", name: "신부 대기실 이용", price: 150_000, pricingType: "FLAT" },
      { catalogKey: null, name: "웨딩 테이블 코디네이션", price: 450_000, pricingType: "FLAT" }
    ],
    status: ReservationStatus.PENDING,
    notes: "브라이덜 샤워 애프터 세션 가능 여부 확인 요청"
  });

  // 한결 의전 예약: 빈소 3일 + 제단꽃 기본 + 시내 운구 선택
  const memorialReservation = await ensureReservation(prisma, {
    eventPlanId: familyFuneral.id,
    vendorId: memorialVendor.id,
    serviceName: "funeralHall+altarFloral+hearse — 한결 의전",
    serviceCategory: "funeralHall",
    description: "빈소 3일 + 문상객 식사 + 기본 제단꽃 + 시내 운구 선택",
    serviceDate: plusDays(12),
    guestCount: 48,
    quotedAmount: 2_186_000,
    confirmedAmount: 2_186_000,
    selectedServiceOptions: [
      { catalogKey: "funeral_hall_3d", name: "빈소 기본 3일", price: 950_000, pricingType: "FLAT" },
      { catalogKey: "funeral_food", name: "문상객 식사", price: 12_000, pricingType: "PER_GUEST", quantity: 48, subtotal: 576_000 },
      { catalogKey: "funeral_staff", name: "장례 지도사", price: 300_000, pricingType: "FLAT" },
      { catalogKey: "altar_basic", name: "기본 제단꽃 세트", price: 380_000, pricingType: "FLAT" },
      { catalogKey: "hearse_local", name: "시내 운구 (50km 이내)", price: 350_000, pricingType: "FLAT" }
    ],
    status: ReservationStatus.CONFIRMED,
    notes: "안내 표지와 조문 순서 브리핑 포함"
  });

  // ── Transactions ────────────────────────────────────────────────────────

  await prisma.transaction.upsert({
    where: { reservationId: venueReservation.id },
    update: {
      payerId: planner.id,
      amount: 9_730_000,
      status: TransactionStatus.SUCCEEDED,
      method: "MOCK",
      gatewayReference: "mock_txn_20260419_001",
      paidAt: plusDays(-1)
    },
    create: {
      reservationId: venueReservation.id,
      payerId: planner.id,
      amount: 9_730_000,
      status: TransactionStatus.SUCCEEDED,
      method: "MOCK",
      gatewayReference: "mock_txn_20260419_001",
      paidAt: plusDays(-1)
    }
  });

  // ── Posts ────────────────────────────────────────────────────────────────

  await prisma.post.upsert({
    where: { slug: "venue-confirmed-notice" },
    update: {
      authorId: planner.id,
      eventPlanId: springWedding.id,
      title: "예식장 확정 안내",
      excerpt: "가든 홀 대관이 확정되어 하객 안내 준비를 시작합니다.",
      content: "예식장과 기본 동선이 확정되어 모바일 초대장 문안 작업을 시작합니다.",
      category: "NOTICE",
      isPublished: true,
      publishedAt: plusDays(-2)
    },
    create: {
      authorId: planner.id,
      eventPlanId: springWedding.id,
      title: "예식장 확정 안내",
      slug: "venue-confirmed-notice",
      excerpt: "가든 홀 대관이 확정되어 하객 안내 준비를 시작합니다.",
      content: "예식장과 기본 동선이 확정되어 모바일 초대장 문안 작업을 시작합니다.",
      category: "NOTICE",
      isPublished: true,
      publishedAt: plusDays(-2)
    }
  });

  await prisma.post.upsert({
    where: { slug: "funeral-schedule-share" },
    update: {
      authorId: planner.id,
      eventPlanId: familyFuneral.id,
      title: "장례 일정 및 안내 공유",
      excerpt: "조문 시간과 주차 안내를 간단히 정리했습니다.",
      content: "조문객 동선을 줄이기 위해 주차 및 접객 안내를 먼저 전달합니다.",
      category: "STORY",
      isPublished: true,
      publishedAt: plusDays(-1)
    },
    create: {
      authorId: planner.id,
      eventPlanId: familyFuneral.id,
      title: "장례 일정 및 안내 공유",
      slug: "funeral-schedule-share",
      excerpt: "조문 시간과 주차 안내를 간단히 정리했습니다.",
      content: "조문객 동선을 줄이기 위해 주차 및 접객 안내를 먼저 전달합니다.",
      category: "STORY",
      isPublished: true,
      publishedAt: plusDays(-1)
    }
  });

  // ── Reviews ──────────────────────────────────────────────────────────────

  const existingReview = await prisma.review.findFirst({
    where: { authorId: planner.id, reservationId: venueReservation.id },
    select: { id: true }
  });

  if (existingReview) {
    await prisma.review.update({
      where: { id: existingReview.id },
      data: {
        vendorId: venueVendor.id,
        eventPlanId: springWedding.id,
        rating: 5,
        title: "동선 관리가 편했던 공간",
        content: "현장 응대가 빠르고 우천 대안까지 명확해서 일정 설계가 수월했습니다."
      }
    });
  } else {
    await prisma.review.create({
      data: {
        authorId: planner.id,
        vendorId: venueVendor.id,
        eventPlanId: springWedding.id,
        reservationId: venueReservation.id,
        rating: 5,
        title: "동선 관리가 편했던 공간",
        content: "현장 응대가 빠르고 우천 대안까지 명확해서 일정 설계가 수월했습니다."
      }
    });
  }

  // ── Invitations ──────────────────────────────────────────────────────────

  await prisma.invitation.upsert({
    where: { invitationCode: "INV-SPRING-001" },
    update: {
      eventPlanId: springWedding.id,
      senderId: planner.id,
      recipientId: guest.id,
      recipientName: guest.name,
      recipientPhone: guest.phone,
      recipientEmail: guest.email,
      message: "모바일 초대장 테스트를 위해 먼저 공유드려요.",
      rsvpStatus: "RSVP_ACCEPTED",
      attendees: 2,
      sentAt: plusDays(-3),
      viewedAt: plusDays(-3),
      respondedAt: plusDays(-2)
    },
    create: {
      eventPlanId: springWedding.id,
      senderId: planner.id,
      recipientId: guest.id,
      recipientName: guest.name,
      recipientPhone: guest.phone,
      recipientEmail: guest.email,
      message: "모바일 초대장 테스트를 위해 먼저 공유드려요.",
      rsvpStatus: "RSVP_ACCEPTED",
      attendees: 2,
      invitationCode: "INV-SPRING-001",
      sentAt: plusDays(-3),
      viewedAt: plusDays(-3),
      respondedAt: plusDays(-2)
    }
  });

  await prisma.invitation.upsert({
    where: { invitationCode: "INV-SPRING-002" },
    update: {
      eventPlanId: springWedding.id,
      senderId: planner.id,
      recipientName: "최민재",
      recipientPhone: "010-1234-9876",
      recipientEmail: "guest2@yeon.local",
      message: "웨딩 초대장을 확인해 주세요.",
      rsvpStatus: "SENT",
      attendees: null,
      sentAt: plusDays(-2),
      viewedAt: null,
      respondedAt: null
    },
    create: {
      eventPlanId: springWedding.id,
      senderId: planner.id,
      recipientName: "최민재",
      recipientPhone: "010-1234-9876",
      recipientEmail: "guest2@yeon.local",
      message: "웨딩 초대장을 확인해 주세요.",
      rsvpStatus: "SENT",
      invitationCode: "INV-SPRING-002",
      sentAt: plusDays(-2)
    }
  });

  await prisma.invitation.upsert({
    where: { invitationCode: "INV-FUNERAL-001" },
    update: {
      eventPlanId: familyFuneral.id,
      senderId: planner.id,
      recipientName: "윤하늘",
      recipientPhone: "010-6543-2109",
      recipientEmail: "guest3@yeon.local",
      message: "가족 장례 일정과 조문 안내를 전달드립니다.",
      rsvpStatus: "VIEWED",
      attendees: null,
      sentAt: plusDays(-1),
      viewedAt: plusDays(-1),
      respondedAt: null
    },
    create: {
      eventPlanId: familyFuneral.id,
      senderId: planner.id,
      recipientName: "윤하늘",
      recipientPhone: "010-6543-2109",
      recipientEmail: "guest3@yeon.local",
      message: "가족 장례 일정과 조문 안내를 전달드립니다.",
      rsvpStatus: "VIEWED",
      invitationCode: "INV-FUNERAL-001",
      sentAt: plusDays(-1),
      viewedAt: plusDays(-1)
    }
  });

  return {
    users: { planner, venueVendor, cateringVendor, memorialVendor, guest, admin },
    plans: { springWedding, familyFuneral },
    reservations: { venueReservation, cateringReservation, venueInquiryReservation, memorialReservation }
  };
}
