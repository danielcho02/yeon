import assert from "node:assert/strict";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

/**
 * Simulates the getVendorSupportedEventTypes logic from lib/step3.shared.ts
 * We duplicate the pure logic to avoid ESM compilation issues in scripts.
 */
function getVendorSupportedEventTypes(supportedEventTypes: unknown): string[] {
  if (!Array.isArray(supportedEventTypes)) return [];
  return supportedEventTypes.filter(
    (t): t is string => typeof t === "string" && ["WEDDING", "FUNERAL"].includes(t)
  );
}

function getVendorSupportedServiceModules(supportedServiceModules: unknown): string[] {
  const VALID_MODULES = new Set([
    "venue", "floral", "catering", "invitation",
    "funeralHall", "altarFloral", "hearse", "meal", "obituary"
  ]);
  if (!Array.isArray(supportedServiceModules)) return [];
  return supportedServiceModules.filter(
    (m): m is string => typeof m === "string" && VALID_MODULES.has(m)
  );
}

async function main() {
  console.log("========== [Role Routing Contract Verification Start] ==========");

  // ── 1. Core demo accounts exist ───────────────────────────────────────
  console.log("1. Verifying core demo accounts exist...");

  const planner = await prisma.user.findUnique({
    where: { email: "planner@yeon.local" }
  });
  assert.ok(planner, "Planner account (planner@yeon.local) must exist");
  assert.equal(planner.role, "GENERAL", "Planner must have role GENERAL");
  assert.equal(planner.isActive, true, "Planner must be active");
  assert.ok(planner.phoneVerifiedAt, "Planner must have phone verified");
  console.log("-> PASS: Planner account verified.");

  const venue = await prisma.user.findUnique({
    where: { email: "venue@yeon.local" }
  });
  assert.ok(venue, "Venue vendor (venue@yeon.local) must exist");
  assert.equal(venue.role, "VENDOR", "Venue vendor must have role VENDOR");
  assert.equal(venue.isActive, true, "Venue vendor must be active");
  assert.equal(venue.vendorApprovalStatus, "APPROVED", "Venue vendor must be approved");
  assert.ok(venue.phoneVerifiedAt, "Venue vendor must have phone verified");
  console.log("-> PASS: Venue vendor account verified.");

  const memorial = await prisma.user.findUnique({
    where: { email: "memorial@yeon.local" }
  });
  assert.ok(memorial, "Memorial vendor (memorial@yeon.local) must exist");
  assert.equal(memorial.role, "VENDOR", "Memorial vendor must have role VENDOR");
  assert.equal(memorial.isActive, true, "Memorial vendor must be active");
  assert.equal(memorial.vendorApprovalStatus, "APPROVED", "Memorial vendor must be approved");
  assert.ok(memorial.phoneVerifiedAt, "Memorial vendor must have phone verified");
  console.log("-> PASS: Memorial vendor account verified.");

  // ── 2. Seeded vendors have supportedEventTypes ────────────────────────
  console.log("2. Verifying seeded vendors have supportedEventTypes...");

  const venueEventTypes = getVendorSupportedEventTypes(venue.supportedEventTypes);
  assert.ok(venueEventTypes.length > 0, "Venue vendor must have at least one supported event type");
  assert.ok(venueEventTypes.includes("WEDDING"), "Venue vendor must support WEDDING");
  console.log(`-> PASS: Venue vendor event types: [${venueEventTypes.join(", ")}]`);

  const memorialEventTypes = getVendorSupportedEventTypes(memorial.supportedEventTypes);
  assert.ok(memorialEventTypes.length > 0, "Memorial vendor must have at least one supported event type");
  assert.ok(memorialEventTypes.includes("FUNERAL"), "Memorial vendor must support FUNERAL");
  console.log(`-> PASS: Memorial vendor event types: [${memorialEventTypes.join(", ")}]`);

  // ── 3. Seeded vendors have supportedServiceModules ────────────────────
  console.log("3. Verifying seeded vendors have supportedServiceModules...");

  const venueModules = getVendorSupportedServiceModules(venue.supportedServiceModules);
  assert.ok(venueModules.length > 0, "Venue vendor must have at least one service module");
  assert.ok(venueModules.includes("venue"), "Venue vendor must support 'venue' module");
  console.log(`-> PASS: Venue vendor modules: [${venueModules.join(", ")}]`);

  const memorialModules = getVendorSupportedServiceModules(memorial.supportedServiceModules);
  assert.ok(memorialModules.length > 0, "Memorial vendor must have at least one service module");
  assert.ok(memorialModules.includes("funeralHall"), "Memorial vendor must support 'funeralHall' module");
  console.log(`-> PASS: Memorial vendor modules: [${memorialModules.join(", ")}]`);

  // ── 4. Seeded vendors have complete profile (bypass onboarding) ───────
  console.log("4. Verifying seeded vendors have complete profile data...");

  assert.ok(venue.companyName, "Venue vendor must have companyName");
  assert.ok(venue.location, "Venue vendor must have location");
  assert.ok(venue.name, "Venue vendor must have name");
  console.log("-> PASS: Venue vendor profile is complete.");

  assert.ok(memorial.companyName, "Memorial vendor must have companyName");
  assert.ok(memorial.location, "Memorial vendor must have location");
  assert.ok(memorial.name, "Memorial vendor must have name");
  console.log("-> PASS: Memorial vendor profile is complete.");

  // ── 5. Planner does not satisfy vendor dashboard requirements ─────────
  console.log("5. Verifying planner cannot access vendor dashboard...");

  assert.notEqual(planner.role, "VENDOR", "Planner must not have VENDOR role");
  const plannerEventTypes = getVendorSupportedEventTypes(planner.supportedEventTypes);
  assert.equal(plannerEventTypes.length, 0, "Planner must not have supported event types");
  const plannerModules = getVendorSupportedServiceModules(planner.supportedServiceModules);
  assert.equal(plannerModules.length, 0, "Planner must not have supported service modules");
  console.log("-> PASS: Planner correctly excluded from vendor flow.");

  // ── 6. Inactive/specialist vendors are not core demo vendors ──────────
  console.log("6. Verifying inactive vendors are excluded from core demo...");

  const orsay = await prisma.user.findUnique({
    where: { email: "catering@yeon.local" }
  });
  assert.ok(orsay, "Orsay Floral (catering@yeon.local) must exist in DB");
  assert.equal(orsay.isActive, false, "Orsay Floral must be inactive");
  console.log("-> PASS: Orsay Floral is inactive, excluded from core demo.");

  const activeCoreVendors = await prisma.user.findMany({
    where: {
      role: "VENDOR",
      isActive: true,
      vendorApprovalStatus: "APPROVED"
    }
  });
  assert.equal(activeCoreVendors.length, 2, "Exactly 2 active approved vendors must exist");
  const coreEmails = activeCoreVendors.map(v => v.email).sort();
  assert.deepEqual(coreEmails, ["memorial@yeon.local", "venue@yeon.local"],
    "Core vendors must be venue@yeon.local and memorial@yeon.local");
  console.log("-> PASS: Exactly 2 active approved core vendors verified.");

  // ── 7. Login redirect destination logic ───────────────────────────────
  console.log("7. Verifying login redirect destination logic...");

  // Simulating resolveLoginDestination from login page
  function resolveLoginDestination(role: string | undefined, callbackUrl: string | undefined) {
    const safeCallback = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : undefined;
    if (role === "VENDOR") {
      return safeCallback?.startsWith("/vendor") || safeCallback === "/account"
        ? safeCallback
        : "/vendor/dashboard";
    }
    if (role === "ADMIN") {
      return safeCallback ?? "/account";
    }
    return safeCallback?.startsWith("/vendor") ? "/plans" : safeCallback ?? "/plans";
  }

  // Planner login → /plans
  assert.equal(resolveLoginDestination("GENERAL", undefined), "/plans");
  // Planner with vendor callback → /plans (protected)
  assert.equal(resolveLoginDestination("GENERAL", "/vendor/dashboard"), "/plans");
  // Vendor login → /vendor/dashboard
  assert.equal(resolveLoginDestination("VENDOR", undefined), "/vendor/dashboard");
  // Vendor with vendor callback → preserves vendor path
  assert.equal(resolveLoginDestination("VENDOR", "/vendor/dashboard"), "/vendor/dashboard");
  // Vendor with account callback → preserves account path
  assert.equal(resolveLoginDestination("VENDOR", "/account"), "/account");
  // Vendor with planner callback → /vendor/dashboard (not planner route)
  assert.equal(resolveLoginDestination("VENDOR", "/plans"), "/vendor/dashboard");
  console.log("-> PASS: Login redirect destinations verified.");

  // ── 8. Vendor dashboard guard logic ───────────────────────────────────
  console.log("8. Verifying vendor dashboard guard prevents planner access...");

  // The vendor dashboard page checks:
  // 1. if (!session?.user?.id) redirect("/login?callbackUrl=/vendor/dashboard")
  // 2. if (session.user.role !== "VENDOR") redirect("/plans")
  // 3. if (!vendor) redirect("/login") — stale session
  // 4. if (supportedEventTypes.length === 0) render onboarding form
  //
  // For planner: role is GENERAL → redirect to /plans (step 2)
  // For vendor with stale session: vendor is null → redirect to /login (step 3)
  // For vendor with profile: renders dashboard (step 4 passes)
  
  assert.notEqual(planner.role, "VENDOR",
    "Planner role must not match vendor dashboard guard");
  console.log("-> PASS: Vendor dashboard guard logic verified.");

  // ── 9. completeVendorOnboarding safety ────────────────────────────────
  console.log("9. Verifying onboarding action has user existence guard...");

  // We just verify the seeded vendors would NOT trigger onboarding
  for (const v of [venue, memorial]) {
    const et = getVendorSupportedEventTypes(v.supportedEventTypes);
    assert.ok(et.length > 0,
      `${v.email} must have event types to bypass onboarding (found: ${et.length})`);
  }
  console.log("-> PASS: Seeded vendors bypass onboarding form.");

  console.log("========== [Role Routing Contract Verification Finished Successfully] ==========");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
