import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient, UserRole, VendorApprovalStatus } from "../generated/prisma/client";
import { demoAccountCredentials } from "../lib/demo/ensure-demo-data";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db"
  })
});

const created = {
  notificationIds: [] as string[],
  activityLogId: ""
};

function numberFromSqlite(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10);
  return 0;
}

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    tableName
  );
  return rows.length === 1;
}

async function scalarCount(sql: string, ...values: unknown[]) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: unknown }>>(sql, ...values);
  return numberFromSqlite(rows[0]?.count);
}

async function main() {
  const checks: Record<string, boolean | number> = {};

  const [planner, venue, catering] = await Promise.all([
    prisma.user.findUnique({ where: { email: demoAccountCredentials.planner } }),
    prisma.user.findUnique({ where: { email: demoAccountCredentials.venue } }),
    prisma.user.findUnique({ where: { email: demoAccountCredentials.catering } })
  ]);

  assert.ok(planner, "planner demo account is missing");
  assert.ok(venue, "venue demo account is missing");
  assert.ok(catering, "catering demo account is missing");
  assert.equal(planner.role, UserRole.GENERAL);
  assert.equal(venue.role, UserRole.VENDOR);
  assert.equal(catering.role, UserRole.VENDOR);
  assert.equal(venue.vendorApprovalStatus, VendorApprovalStatus.APPROVED);
  assert.equal(catering.vendorApprovalStatus, VendorApprovalStatus.APPROVED);
  checks.demo_accounts_ready = true;

  const [weddingPlans, funeralPlans, activeVendors, perGuestModules] = await Promise.all([
    prisma.eventPlan.count({ where: { ownerId: planner.id, type: "WEDDING" } }),
    prisma.eventPlan.count({ where: { ownerId: planner.id, type: "FUNERAL" } }),
    prisma.user.count({
      where: {
        role: UserRole.VENDOR,
        isActive: true,
        vendorApprovalStatus: VendorApprovalStatus.APPROVED
      }
    }),
    prisma.vendorServiceModule.count({ where: { pricingType: "PER_GUEST" } })
  ]);

  assert.ok(weddingPlans >= 1, "seed must include at least one WEDDING plan");
  assert.ok(funeralPlans >= 1, "seed must include at least one FUNERAL plan");
  assert.ok(activeVendors >= 2, "seed must include at least two approved vendors");
  assert.ok(perGuestModules >= 1, "seed must include PER_GUEST modules");
  checks.wedding_plans = weddingPlans;
  checks.funeral_plans = funeralPlans;
  checks.active_vendors = activeVendors;
  checks.per_guest_modules = perGuestModules;

  checks.notification_table_exists = await tableExists("Notification");
  checks.activity_log_table_exists = await tableExists("ActivityLog");
  assert.equal(checks.notification_table_exists, true);
  assert.equal(checks.activity_log_table_exists, true);

  const legacyCancelledReservations = await scalarCount(
    "SELECT COUNT(*) AS count FROM Reservation WHERE status = ?",
    "CANCELLED"
  );
  assert.equal(legacyCancelledReservations, 0, "Reservation.status must use CANCELED, not CANCELLED");
  checks.legacy_cancelled_reservations = legacyCancelledReservations;

  const notification = await prisma.notification.create({
    data: {
      userId: planner.id,
      type: "LAUNCH_READINESS_SMOKE",
      title: "Launch readiness smoke",
      message: "Notification table write check",
      href: "/plans",
      metadata: { script: "launch-readiness-smoke" }
    }
  });
  created.notificationIds.push(notification.id);

  const vendorNotification = await prisma.notification.create({
    data: {
      userId: venue.id,
      type: "LAUNCH_READINESS_SMOKE",
      title: "Launch readiness vendor smoke",
      message: "Notification owner scoping check",
      href: "/vendor/dashboard",
      metadata: { script: "launch-readiness-smoke" }
    }
  });
  created.notificationIds.push(vendorNotification.id);

  const plannerUnreadBefore = await prisma.notification.count({
    where: { userId: planner.id, readAt: null, id: notification.id }
  });
  assert.equal(plannerUnreadBefore, 1);

  const markPlannerRead = await prisma.notification.updateMany({
    where: { userId: planner.id, id: notification.id, readAt: null },
    data: { readAt: new Date() }
  });
  assert.equal(markPlannerRead.count, 1);

  const crossUserReadAttempt = await prisma.notification.updateMany({
    where: { userId: planner.id, id: vendorNotification.id, readAt: null },
    data: { readAt: new Date() }
  });
  assert.equal(crossUserReadAttempt.count, 0);

  const markVendorAllRead = await prisma.notification.updateMany({
    where: { userId: venue.id, readAt: null, id: { in: created.notificationIds } },
    data: { readAt: new Date() }
  });
  assert.equal(markVendorAllRead.count, 1);
  checks.notification_read_scope_enforced = true;
  checks.notification_mark_all_scope_enforced = true;

  const activityLog = await prisma.activityLog.create({
    data: {
      actorId: planner.id,
      planId: null,
      vendorId: venue.id,
      type: "LAUNCH_READINESS_SMOKE",
      message: "Activity log table write check",
      metadata: { script: "launch-readiness-smoke" }
    }
  });
  created.activityLogId = activityLog.id;
  checks.workflow_event_writes = true;

  console.log("[launch-readiness-smoke] success");
  console.log(JSON.stringify(checks, null, 2));
}

main()
  .catch((error) => {
    console.error("[launch-readiness-smoke] failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (created.notificationIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: created.notificationIds } } });
    }
    if (created.activityLogId) {
      await prisma.activityLog.deleteMany({ where: { id: created.activityLogId } });
    }
    await prisma.$disconnect();
  });
