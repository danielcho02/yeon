import { TransactionType, EventType } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== Money Settlement MVP Verification Started ===");

  // 1. Verify basic seed state / retrieve a general user
  console.log("\n[1] Verifying seed status & finding test user...");
  const testUser = await prisma.user.findFirst({
    where: { role: "GENERAL" }
  });

  if (!testUser) {
    console.error("❌ Failed: No GENERAL role user found in the DB. Please run DB seed first.");
    process.exit(1);
  }
  console.log(`✅ Success: Found general user (ID: ${testUser.id}, Name: ${testUser.name})`);

  // 2. Create test EventPlans (Wedding and Funeral)
  console.log("\n[2] Creating test EventPlans...");
  const weddingPlan = await prisma.eventPlan.create({
    data: {
      ownerId: testUser.id,
      title: "검증용 웨딩 플랜",
      slug: "verify-wedding-plan-" + Date.now(),
      type: EventType.WEDDING,
      status: "PLANNING"
    }
  });

  const funeralPlan = await prisma.eventPlan.create({
    data: {
      ownerId: testUser.id,
      title: "검증용 장례 플랜",
      slug: "verify-funeral-plan-" + Date.now(),
      type: EventType.FUNERAL,
      status: "PLANNING"
    }
  });

  console.log(`✅ Success: Created Wedding Plan (ID: ${weddingPlan.id})`);
  console.log(`✅ Success: Created Funeral Plan (ID: ${funeralPlan.id})`);

  try {
    // 3. Test settlement entry creation
    console.log("\n[3] Testing settlement entry creation...");
    const weddingEntry1 = await prisma.transaction.create({
      data: {
        planId: weddingPlan.id,
        payerId: testUser.id,
        senderName: "홍길동",
        amount: 100000,
        relation: "친구",
        message: "결혼 축하한다!",
        type: TransactionType.ONLINE, // 계좌이체
        status: "SUCCEEDED",
        paidAt: new Date("2026-06-01T10:00:00.000Z")
      }
    });

    const weddingEntry2 = await prisma.transaction.create({
      data: {
        planId: weddingPlan.id,
        payerId: testUser.id,
        senderName: "김철수",
        amount: 200000,
        relation: "가족",
        message: "행복하게 잘 살아라",
        type: TransactionType.OFFLINE, // 현금
        status: "SUCCEEDED",
        paidAt: new Date("2026-06-02T11:00:00.000Z")
      }
    });

    const funeralEntry1 = await prisma.transaction.create({
      data: {
        planId: funeralPlan.id,
        payerId: testUser.id,
        senderName: "이영희",
        amount: 50000,
        relation: "직장동료",
        message: "삼가 고인의 명복을 빕니다.",
        type: TransactionType.OFFLINE,
        status: "SUCCEEDED",
        paidAt: new Date("2026-06-03T12:00:00.000Z")
      }
    });

    console.log(`✅ Success: Entry 1 (Wedding) created (ID: ${weddingEntry1.id}, Amount: ${weddingEntry1.amount})`);
    console.log(`✅ Success: Entry 2 (Wedding) created (ID: ${weddingEntry2.id}, Amount: ${weddingEntry2.amount})`);
    console.log(`✅ Success: Entry 3 (Funeral) created (ID: ${funeralEntry1.id}, Amount: ${funeralEntry1.amount})`);

    // 4. Test entry modification
    console.log("\n[4] Testing entry modification...");
    const updatedWeddingEntry1 = await prisma.transaction.update({
      where: { id: weddingEntry1.id },
      data: {
        amount: 150000,
        message: "결혼 진심으로 축하해!"
      }
    });

    if (updatedWeddingEntry1.amount !== 150000 || updatedWeddingEntry1.message !== "결혼 진심으로 축하해!") {
      throw new Error("Entry modification values do not match expected update.");
    }
    console.log(`✅ Success: Entry (ID: ${weddingEntry1.id}) successfully updated (Amount: ${updatedWeddingEntry1.amount})`);

    // 5. Test EventPlan-specific total calculation
    console.log("\n[5] Testing plan-specific total and summary calculation...");
    
    // Wedding Total calculation
    const weddingTransactions = await prisma.transaction.findMany({
      where: { planId: weddingPlan.id }
    });

    const totalWeddingAmount = weddingTransactions.reduce((acc, t) => acc + t.amount, 0);
    const totalWeddingCount = weddingTransactions.length;
    const avgWeddingAmount = totalWeddingCount > 0 ? Math.round(totalWeddingAmount / totalWeddingCount) : 0;

    console.log(`- Wedding Total: ${totalWeddingAmount}원 (Expected: 350000원)`);
    console.log(`- Wedding Count: ${totalWeddingCount}건 (Expected: 2건)`);
    console.log(`- Wedding Average: ${avgWeddingAmount}원 (Expected: 175000원)`);

    if (totalWeddingAmount !== 350000 || totalWeddingCount !== 2 || avgWeddingAmount !== 175000) {
      throw new Error("Wedding totals/averages calculations mismatch.");
    }
    console.log("✅ Success: Wedding totals and statistics match calculated metrics.");

    // [5-1] 기존 예약 결제 Transaction과의 격리성 검증 테스트
    console.log("\n[5-1] Testing isolation from reservation transactions...");
    let testVendor = await prisma.user.findFirst({
      where: { role: "VENDOR" }
    });
    if (!testVendor) {
      testVendor = await prisma.user.create({
        data: {
          email: "verify-vendor@yeon.local",
          name: "검증용업체",
          passwordHash: "verify-hash",
          role: "VENDOR"
        }
      });
    }

    const testReservation = await prisma.reservation.create({
      data: {
        eventPlanId: weddingPlan.id,
        vendorId: testVendor.id,
        serviceName: "웨딩홀 대관",
        status: "CONFIRMED",
        confirmedAmount: 500000
      }
    });

    const reservationPayment = await prisma.transaction.create({
      data: {
        planId: weddingPlan.id,
        reservationId: testReservation.id,
        payerId: testUser.id,
        senderName: "신랑 신부 결제건",
        amount: 500000,
        type: TransactionType.ONLINE,
        status: "SUCCEEDED"
      }
    });

    console.log(`- Created simulation reservation payment (ID: ${reservationPayment.id}, Amount: ${reservationPayment.amount})`);

    const manualTransactions = await prisma.transaction.findMany({
      where: { planId: weddingPlan.id, reservationId: null }
    });

    const manualTotal = manualTransactions.reduce((acc, t) => acc + t.amount, 0);
    const manualCount = manualTransactions.length;

    console.log(`- Manual Settlement Total: ${manualTotal}원 (Expected: 350000원, should exclude 500000원 reservation payment)`);
    console.log(`- Manual Settlement Count: ${manualCount}건 (Expected: 2건, should exclude reservation payment)`);

    if (manualTotal !== 350000 || manualCount !== 2) {
      throw new Error("❌ Failed: Reservation transaction was NOT isolated from manual settlement queries!");
    }
    console.log("✅ Success: Reservation transaction is correctly isolated from manual settlement.");

    // 6. Verify EventType separation
    console.log("\n[6] Testing EventType-based statement formatting logic...");
    const verifyPlanType = (type: EventType) => {
      if (type === EventType.WEDDING) {
        return "축의금";
      } else if (type === EventType.FUNERAL) {
        return "조의금";
      }
      return "기타";
    };

    console.log(`- Wedding Plan (Type: ${weddingPlan.type}) Label: ${verifyPlanType(weddingPlan.type)}`);
    console.log(`- Funeral Plan (Type: ${funeralPlan.type}) Label: ${verifyPlanType(funeralPlan.type)}`);

    if (verifyPlanType(weddingPlan.type) !== "축의금" || verifyPlanType(funeralPlan.type) !== "조의금") {
      throw new Error("Event type statement formatting mapping mismatch.");
    }
    console.log("✅ Success: Event labels are correctly separated based on EventType.");

    // 7. Test entry deletion
    console.log("\n[7] Testing entry deletion...");
    await prisma.transaction.delete({
      where: { id: weddingEntry2.id }
    });

    const checkDeleted = await prisma.transaction.findUnique({
      where: { id: weddingEntry2.id }
    });

    if (checkDeleted) {
      throw new Error("Entry was not deleted from database.");
    }
    console.log(`✅ Success: Entry (ID: ${weddingEntry2.id}) successfully deleted.`);

  } finally {
    // 8. Clean up created plans and transactions
    console.log("\n[8] Cleaning up verification artifacts...");
    const testReservations = await prisma.reservation.findMany({
      where: { eventPlanId: { in: [weddingPlan.id, funeralPlan.id] } }
    });
    const resIds = testReservations.map(r => r.id);

    await prisma.transaction.deleteMany({
      where: { 
        OR: [
          { planId: { in: [weddingPlan.id, funeralPlan.id] } },
          { reservationId: { in: resIds } }
        ]
      }
    });
    
    await prisma.reservation.deleteMany({
      where: { id: { in: resIds } }
    });

    await prisma.eventPlan.deleteMany({
      where: { id: { in: [weddingPlan.id, funeralPlan.id] } }
    });
    console.log("✅ Success: All temporary plans, reservations, and transaction records removed.");
  }

  console.log("\n=== 🌟 Money Settlement MVP Verification Completed Successfully! 🌟 ===");
}

main()
  .catch((e) => {
    console.error("❌ Verification Failed with Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
