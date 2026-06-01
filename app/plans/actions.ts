"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EventStatus, UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { generateMockAIRecommendation } from "@/lib/mocks/ai-recommendation";
import { prisma } from "@/lib/prisma";
import { buildEventPlanSlug, parseMvpEventType } from "@/lib/step3.server";
import { normalizePositiveInt, parseDateOnlyToKst } from "@/lib/step3.shared";

function revalidatePlanViews(id?: string) {
  revalidatePath("/account");
  revalidatePath("/plans");
  if (id) revalidatePath(`/plans/${id}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");
}

export async function createPlan(formData: FormData) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/planner?create=1");
  if (session.user.role !== UserRole.GENERAL) {
    redirect(session.user.role === UserRole.VENDOR ? "/vendor/dashboard" : "/account");
  }

  const title = formData.get("title")?.toString().trim() ?? "";
  const type  = formData.get("type")?.toString() ?? "";
  const parsedType = parseMvpEventType(type);
  if (!title || !parsedType) redirect("/planner?create=1");

  const budget      = normalizePositiveInt(formData.get("budget"));
  const guestTarget = normalizePositiveInt(formData.get("guestTarget"));
  const scheduledAtRaw = formData.get("scheduledAt")?.toString() ?? "";
  const region      = formData.get("region")?.toString().trim() || null;
  const hostName    = formData.get("hostName")?.toString().trim() || null;
  const venueName   = formData.get("venueName")?.toString().trim() || null;
  const description = formData.get("description")?.toString().trim() || null;

  const plan = await prisma.eventPlan.create({
    data: {
      ownerId:     session.user.id,
      title,
      slug:        buildEventPlanSlug(title),
      type:        parsedType,
      status:      EventStatus.PLANNING,
      hostName,
      venueName,
      description,
      region,
      budget,
      guestTarget,
      scheduledAt: scheduledAtRaw ? parseDateOnlyToKst(scheduledAtRaw) : null,
      aiRecommendation: generateMockAIRecommendation({
        budget,
        guestCount: guestTarget,
        region,
        eventType: parsedType,
      }),
    },
  });

  revalidatePlanViews(plan.id);
  redirect(`/planner/${parsedType === "WEDDING" ? "wedding" : "funeral"}?planId=${plan.id}`);
}

export async function updatePlan(id: string, formData: FormData) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.GENERAL) {
    redirect(session.user.role === UserRole.VENDOR ? "/vendor/dashboard" : "/account");
  }

  const existing = await prisma.eventPlan.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true },
  });
  if (!existing) redirect("/plans");

  const title = formData.get("title")?.toString().trim() ?? "";
  if (!title) redirect(`/plans/${id}/edit`);

  const type        = formData.get("type")?.toString() ?? "";
  const parsedType = parseMvpEventType(type);
  if (!parsedType) redirect(`/plans/${id}/edit`);
  const budget      = normalizePositiveInt(formData.get("budget"));
  const guestTarget = normalizePositiveInt(formData.get("guestTarget"));
  const scheduledAtRaw = formData.get("scheduledAt")?.toString() ?? "";
  const region      = formData.get("region")?.toString().trim() || null;
  const hostName    = formData.get("hostName")?.toString().trim() || null;
  const venueName   = formData.get("venueName")?.toString().trim() || null;
  const description = formData.get("description")?.toString().trim() || null;

  await prisma.eventPlan.update({
    where: { id },
    data: {
      title,
      type:        parsedType,
      scheduledAt: scheduledAtRaw ? parseDateOnlyToKst(scheduledAtRaw) : null,
      budget,
      guestTarget,
      region,
      hostName,
      venueName,
      description,
    },
  });

  revalidatePlanViews(id);
  redirect(`/plans/${id}`);
}

export async function deletePlan(id: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.GENERAL) {
    redirect(session.user.role === UserRole.VENDOR ? "/vendor/dashboard" : "/account");
  }

  const existing = await prisma.eventPlan.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true },
  });
  if (!existing) redirect("/plans");

  await prisma.eventPlan.delete({ where: { id } });

  revalidatePlanViews(id);
  redirect("/plans");
}
