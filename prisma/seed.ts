import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient, UserRole, VendorApprovalStatus } from "../generated/prisma/client";

import { hashPassword } from "../lib/auth/password";
import { generateMockAIRecommendation } from "../lib/mocks/ai-recommendation";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db"
  })
});

const day = 24 * 60 * 60 * 1000;

function plusDays(days: number) {
  return new Date(Date.now() + days * day);
}

async function main() {
  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.post.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.eventPlan.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword("demo1234");

  const planner = await prisma.user.create({
    data: {
      email: "planner@yeon.local",
      name: "김연우",
      passwordHash,
      role: UserRole.GENERAL,
      phone: "010-1111-2222",
      phoneVerifiedAt: new Date(),
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 마포구",
      bio: "가족 행사를 차분하게 준비하는 대표 사용자 샘플입니다."
    }
  });

  const venueVendor = await prisma.user.create({
    data: {
      email: "venue@yeon.local",
      name: "박하린",
      companyName: "모먼트 가든",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-3333-4444",
      phoneVerifiedAt: new Date(),
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "서울 강남구",
      bio: "웨딩과 프라이빗 가족연을 위한 공간 연출 전문 업체입니다."
    }
  });

  const ceremonyVendor = await prisma.user.create({
    data: {
      email: "catering@yeon.local",
      name: "이도윤",
      companyName: "온담 케이터링",
      passwordHash,
      role: UserRole.VENDOR,
      phone: "010-5555-6666",
      phoneVerifiedAt: new Date(),
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      location: "경기 성남시",
      bio: "경조사 규모에 맞춘 한식·양식 케이터링 패키지를 제공합니다."
    }
  });

  const guest = await prisma.user.create({
    data: {
      email: "guest@yeon.local",
      name: "정서윤",
      passwordHash,
      role: UserRole.GENERAL,
      phone: "010-7777-8888",
      phoneVerifiedAt: new Date(),
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 서초구",
      bio: "초대 응답과 후기 흐름을 테스트하기 위한 일반 사용자입니다."
    }
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@yeon.local",
      name: "운영 관리자",
      passwordHash,
      role: UserRole.ADMIN,
      phone: "010-9999-0000",
      phoneVerifiedAt: new Date(),
      vendorApprovalStatus: VendorApprovalStatus.NOT_APPLICABLE,
      location: "서울 중구",
      bio: "운영자 계정 샘플입니다."
    }
  });

  const springWedding = await prisma.eventPlan.create({
    data: {
      ownerId: planner.id,
      title: "봄빛 가든 웨딩",
      slug: "spring-garden-wedding",
      type: "WEDDING",
      status: "PLANNING",
      hostName: "김연우",
      honoreeName: "김연우 · 최하준",
      venueName: "모먼트 가든",
      region: "서울",
      scheduledAt: plusDays(45),
      guestTarget: 160,
      budget: 4800000,
      description: "가족과 가까운 지인을 위한 정원형 웨딩 준비 플랜입니다.",
      aiRecommendation: generateMockAIRecommendation({
        budget: 4800000,
        guestCount: 160,
        region: "서울",
        eventType: "웨딩"
      })
    }
  });

  const remembrance = await prisma.eventPlan.create({
    data: {
      ownerId: planner.id,
      title: "가족 추모 모임",
      slug: "family-remembrance-gathering",
      type: "MEMORIAL",
      status: "PUBLISHED",
      hostName: "김연우",
      honoreeName: "故 김정훈",
      venueName: "한결 메모리얼 홀",
      region: "인천",
      scheduledAt: plusDays(12),
      guestTarget: 48,
      budget: 1350000,
      description: "가족 중심의 조용한 추모 모임을 위한 간소 플랜입니다.",
      aiRecommendation: generateMockAIRecommendation({
        budget: 1350000,
        guestCount: 48,
        region: "인천",
        eventType: "추모 모임"
      })
    }
  });

  const venueReservation = await prisma.reservation.create({
    data: {
      eventPlanId: springWedding.id,
      vendorId: venueVendor.id,
      serviceName: "가든 홀 대관",
      serviceCategory: "VENUE",
      description: "야외 예식과 실내 피로연을 함께 운영하는 패키지",
      serviceDate: plusDays(45),
      guestCount: 160,
      quotedAmount: 2200000,
      confirmedAmount: 2100000,
      status: "CONFIRMED",
      notes: "우천 시 실내 전환 옵션 포함"
    }
  });

  const cateringReservation = await prisma.reservation.create({
    data: {
      eventPlanId: springWedding.id,
      vendorId: ceremonyVendor.id,
      serviceName: "식음 케이터링",
      serviceCategory: "CATERING",
      description: "코스형 한식·양식 혼합 메뉴 제안",
      serviceDate: plusDays(45),
      guestCount: 160,
      quotedAmount: 1400000,
      status: "PENDING",
      notes: "채식 옵션 12인분 포함 검토 중"
    }
  });

  await prisma.transaction.create({
    data: {
      reservationId: venueReservation.id,
      payerId: planner.id,
      amount: 2100000,
      status: "SUCCEEDED",
      method: "MOCK",
      gatewayReference: "mock_txn_20260419_001",
      paidAt: plusDays(-1)
    }
  });

  await prisma.post.createMany({
    data: [
      {
        authorId: planner.id,
        eventPlanId: springWedding.id,
        title: "예식장 확정 안내",
        slug: "venue-confirmed-notice",
        excerpt: "가든 홀 대관이 확정되어 하객 안내 준비를 시작합니다.",
        content: "예식장과 기본 동선이 확정되어 모바일 초대장 문안 작업을 시작합니다.",
        category: "NOTICE",
        isPublished: true,
        publishedAt: plusDays(-2)
      },
      {
        authorId: planner.id,
        eventPlanId: remembrance.id,
        title: "추모 모임 일정 공유",
        slug: "memorial-schedule-share",
        excerpt: "가족 중심 일정과 주차 안내를 공유합니다.",
        content: "참석 여부를 모바일 초대장으로 받고, 소규모 다과 준비만 진행합니다.",
        category: "STORY",
        isPublished: true,
        publishedAt: plusDays(-1)
      }
    ]
  });

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

  await prisma.invitation.createMany({
    data: [
      {
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
      },
      {
        eventPlanId: springWedding.id,
        senderId: planner.id,
        recipientName: "최민재",
        recipientPhone: "010-1234-9876",
        recipientEmail: "guest2@yeon.local",
        message: "웨딩 초대장을 확인해 주세요.",
        rsvpStatus: "SENT",
        invitationCode: "INV-SPRING-002",
        sentAt: plusDays(-2)
      },
      {
        eventPlanId: remembrance.id,
        senderId: planner.id,
        recipientName: "윤하늘",
        recipientPhone: "010-6543-2109",
        recipientEmail: "guest3@yeon.local",
        message: "가족 추모 모임 일정 안내입니다.",
        rsvpStatus: "VIEWED",
        invitationCode: "INV-MEM-001",
        sentAt: plusDays(-1),
        viewedAt: plusDays(-1)
      }
    ]
  });

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.eventPlan.count(),
    prisma.reservation.count(),
    prisma.post.count(),
    prisma.review.count(),
    prisma.transaction.count(),
    prisma.invitation.count()
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
        demoAccounts: {
          planner: "planner@yeon.local / demo1234",
          vendor: "venue@yeon.local / demo1234",
          admin: `${admin.email} / demo1234`
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
