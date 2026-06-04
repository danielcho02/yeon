import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  EventStatus,
  EventType,
  PrismaClient,
  ReservationRequestStatus,
  ReservationStatus,
  UserRole,
  VendorApprovalStatus
} from "../generated/prisma/client";
import {
  approveReservationCancellationRequest,
  approveReservationChangeRequest,
  cancelReservation,
  rejectReservationCancellationRequest,
  rejectReservationChangeRequest,
  requestChange
} from "../app/actions/reservation";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

const runId = `u06-${Date.now()}`;

type Fixture = {
  plannerId: string;
  vendorId: string;
  planId: string;
};

type ScriptActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

function expectSuccess<T>(result: ScriptActionResult<T>, label: string) {
  if (!result.success) {
    throw new Error(`${label}: ${result.error}`);
  }

  return result.data;
}

function expectFailure<T>(result: ScriptActionResult<T>, label: string) {
  assert.equal(result.success, false, label);
}

function usePlannerSession(fixture: Fixture) {
  process.env.YEON_VERIFY_ACTION_AUTH = "1";
  process.env.YEON_VERIFY_ACTION_USER_ID = fixture.plannerId;
  process.env.YEON_VERIFY_ACTION_USER_ROLE = UserRole.GENERAL;
}

function useVendorSession(fixture: Fixture) {
  process.env.YEON_VERIFY_ACTION_AUTH = "1";
  process.env.YEON_VERIFY_ACTION_USER_ID = fixture.vendorId;
  process.env.YEON_VERIFY_ACTION_USER_ROLE = UserRole.VENDOR;
}

function clearVerifySession() {
  delete process.env.YEON_VERIFY_ACTION_AUTH;
  delete process.env.YEON_VERIFY_ACTION_USER_ID;
  delete process.env.YEON_VERIFY_ACTION_USER_ROLE;
}

async function createFixture(): Promise<Fixture> {
  const planner = await prisma.user.create({
    data: {
      email: `${runId}-planner@example.com`,
      name: "U06 Planner",
      passwordHash: "verify-only",
      role: UserRole.GENERAL
    }
  });

  const vendor = await prisma.user.create({
    data: {
      email: `${runId}-vendor@example.com`,
      name: "U06 Vendor",
      passwordHash: "verify-only",
      role: UserRole.VENDOR,
      companyName: "U06 Vendor Co.",
      vendorApprovalStatus: VendorApprovalStatus.APPROVED
    }
  });

  const plan = await prisma.eventPlan.create({
    data: {
      ownerId: planner.id,
      title: "U06 Verification Plan",
      slug: `${runId}-plan`,
      type: EventType.WEDDING,
      status: EventStatus.PLANNING,
      scheduledAt: new Date("2026-07-01T12:00:00.000Z"),
      guestTarget: 80,
      budget: 5_000_000
    }
  });

  return {
    plannerId: planner.id,
    vendorId: vendor.id,
    planId: plan.id
  };
}

async function createReservation(
  fixture: Fixture,
  status: ReservationStatus,
  serviceDate = "2026-07-01T12:00:00.000Z"
) {
  return prisma.reservation.create({
    data: {
      eventPlanId: fixture.planId,
      vendorId: fixture.vendorId,
      serviceName: "U06 Verification Reservation",
      serviceCategory: "VENUE",
      serviceDate: new Date(serviceDate),
      guestCount: 80,
      quotedAmount: 5_000_000,
      confirmedAmount: status === ReservationStatus.CONFIRMED ? 5_000_000 : null,
      selectedServiceOptions: [
        {
          catalogKey: "venue-basic",
          name: "기본 대관",
          price: 5_000_000,
          pricingType: "FLAT",
          quantity: 1,
          subtotal: 5_000_000
        }
      ],
      status
    }
  });
}

async function assertReservationSnapshot(
  reservationId: string,
  expected: {
    serviceDate: string;
    guestCount: number;
    quotedAmount: number;
    status: ReservationStatus;
  },
  label: string
) {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId }
  });

  assert.equal(reservation.serviceDate?.toISOString(), expected.serviceDate, `${label}: serviceDate`);
  assert.equal(reservation.guestCount, expected.guestCount, `${label}: guestCount`);
  assert.equal(reservation.quotedAmount, expected.quotedAmount, `${label}: quotedAmount`);
  assert.equal(reservation.status, expected.status, `${label}: status`);
}

async function verifyChangeApproval(fixture: Fixture) {
  const reservation = await createReservation(fixture, ReservationStatus.CONFIRMED);

  usePlannerSession(fixture);
  const createResult = await requestChange(reservation.id, {
    reservedDate: "2026-07-10",
    guestCount: 95,
    notes: "변경 승인 검증 메모",
    reason: "일정과 인원 변경",
    selectedServiceOptions: [
        {
          catalogKey: "venue-premium",
          name: "프리미엄 대관",
          price: 5_500_000,
          pricingType: "FLAT",
          quantity: 1,
          subtotal: 5_500_000
        }
      ]
  });
  const changeRequest = expectSuccess(createResult, "requestChange must create change request");

  await assertReservationSnapshot(
    reservation.id,
    {
      serviceDate: "2026-07-01T12:00:00.000Z",
      guestCount: 80,
      quotedAmount: 5_000_000,
      status: ReservationStatus.CONFIRMED
    },
    "change request must not mutate reservation immediately"
  );

  useVendorSession(fixture);
  expectSuccess(
    await approveReservationChangeRequest(changeRequest.id),
    "approveReservationChangeRequest must approve"
  );

  const updated = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservation.id }
  });
  assert.equal(updated.serviceDate?.toISOString(), "2026-07-10T03:00:00.000Z");
  assert.equal(updated.guestCount, 95);
  assert.equal(updated.status, ReservationStatus.CONFIRMED);
}

async function verifyChangeRejection(fixture: Fixture) {
  const reservation = await createReservation(
    fixture,
    ReservationStatus.PENDING,
    "2026-07-02T12:00:00.000Z"
  );

  usePlannerSession(fixture);
  const createResult = await requestChange(reservation.id, {
    reservedDate: "2026-07-12",
    guestCount: 70,
    reason: "거절 검증"
  });
  const changeRequest = expectSuccess(
    createResult,
    "requestChange must create request for rejection"
  );

  useVendorSession(fixture);
  expectSuccess(
    await rejectReservationChangeRequest(changeRequest.id, "기존 일정 유지"),
    "rejectReservationChangeRequest must reject"
  );

  await assertReservationSnapshot(
    reservation.id,
    {
      serviceDate: "2026-07-02T12:00:00.000Z",
      guestCount: 80,
      quotedAmount: 5_000_000,
      status: ReservationStatus.PENDING
    },
    "rejected change request must keep reservation"
  );
}

async function verifyCancellationApproval(fixture: Fixture) {
  const reservation = await createReservation(
    fixture,
    ReservationStatus.CONFIRMED,
    "2026-07-03T12:00:00.000Z"
  );

  usePlannerSession(fixture);
  const createResult = await cancelReservation(reservation.id, "취소 승인 검증");
  const cancellationRequest = expectSuccess(
    createResult,
    "cancelReservation must create cancellation request"
  );

  const beforeApproval = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservation.id }
  });
  assert.equal(beforeApproval.status, ReservationStatus.CONFIRMED);

  useVendorSession(fixture);
  expectSuccess(
    await approveReservationCancellationRequest(cancellationRequest.id),
    "approveReservationCancellationRequest must approve"
  );

  const afterApproval = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservation.id }
  });
  assert.equal(afterApproval.status, ReservationStatus.CANCELED);
}

async function verifyCancellationRejection(fixture: Fixture) {
  const reservation = await createReservation(
    fixture,
    ReservationStatus.PENDING,
    "2026-07-04T12:00:00.000Z"
  );

  usePlannerSession(fixture);
  const createResult = await cancelReservation(reservation.id, "취소 거절 검증");
  const cancellationRequest = expectSuccess(
    createResult,
    "cancelReservation must create request for rejection"
  );

  useVendorSession(fixture);
  expectSuccess(
    await rejectReservationCancellationRequest(cancellationRequest.id, "계약 조건 유지"),
    "rejectReservationCancellationRequest must reject"
  );

  await assertReservationSnapshot(
    reservation.id,
    {
      serviceDate: "2026-07-04T12:00:00.000Z",
      guestCount: 80,
      quotedAmount: 5_000_000,
      status: ReservationStatus.PENDING
    },
    "rejected cancellation request must keep reservation"
  );
}

async function verifyPendingRequestPolicy(fixture: Fixture) {
  const reservation = await createReservation(
    fixture,
    ReservationStatus.CONFIRMED,
    "2026-07-05T12:00:00.000Z"
  );

  usePlannerSession(fixture);
  const firstResult = await requestChange(reservation.id, {
    reason: "대기 요청"
  });
  expectSuccess(firstResult, "first pending request must be created");

  const secondChangeResult = await requestChange(reservation.id, {
    reason: "두 번째 변경 요청"
  });
  expectFailure(secondChangeResult, "second change request must be blocked");

  const secondCancelResult = await cancelReservation(reservation.id, "두 번째 취소 요청");
  expectFailure(secondCancelResult, "second cancellation request must be blocked");

  const [pendingChangeCount, pendingCancellationCount] = await Promise.all([
    prisma.reservationChangeRequest.count({
      where: { reservationId: reservation.id, status: ReservationRequestStatus.PENDING }
    }),
    prisma.reservationCancellationRequest.count({
      where: { reservationId: reservation.id, status: ReservationRequestStatus.PENDING }
    })
  ]);
  assert.equal(
    pendingChangeCount + pendingCancellationCount,
    1,
    "one reservation must have only one pending request in application policy"
  );
}

async function cleanup() {
  const [users, plans] = await Promise.all([
    prisma.user.findMany({
      where: { email: { startsWith: runId } },
      select: { id: true }
    }),
    prisma.eventPlan.findMany({
      where: { slug: `${runId}-plan` },
      select: { id: true }
    })
  ]);
  const userIds = users.map((user) => user.id);
  const planIds = plans.map((plan) => plan.id);

  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { planId: { in: planIds } },
        { vendorId: { in: userIds } }
      ]
    }
  });
  await prisma.notification.deleteMany({
    where: { user: { email: { startsWith: runId } } }
  });
  await prisma.reservationCancellationRequest.deleteMany({
    where: { planner: { email: { startsWith: runId } } }
  });
  await prisma.reservationChangeRequest.deleteMany({
    where: { planner: { email: { startsWith: runId } } }
  });
  await prisma.reservation.deleteMany({
    where: { eventPlan: { slug: `${runId}-plan` } }
  });
  await prisma.eventPlan.deleteMany({
    where: { slug: `${runId}-plan` }
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: runId } }
  });
}

async function main() {
  try {
    const fixture = await createFixture();
    await verifyChangeApproval(fixture);
    await verifyChangeRejection(fixture);
    await verifyCancellationApproval(fixture);
    await verifyCancellationRejection(fixture);
    await verifyPendingRequestPolicy(fixture);
    console.log("[verify-reservation-change-cancel] PASS");
  } finally {
    await cleanup();
  }
}

main()
  .catch((error) => {
    console.error("[verify-reservation-change-cancel] FAIL:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
