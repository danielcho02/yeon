import { revalidatePath } from "next/cache";

import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { generateStep3MockAIRecommendation } from "@/lib/mocks/step3-ai-recommendation";
import { prisma } from "@/lib/prisma";
import {
  normalizePositiveInt,
  parseDateOnlyToKst
} from "@/lib/step3.shared";
import { buildEventPlanSlug, parseMvpEventType } from "@/lib/step3.server";

function revalidatePlanViews(planId: string) {
  revalidatePath("/account");
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
  revalidatePath("/vendor/dashboard");
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (session.user.role !== UserRole.GENERAL) {
    return Response.json(
      { error: "일반 사용자만 행사 준비 화면을 생성할 수 있습니다." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const type = parseMvpEventType(body.type);
  const region = typeof body.region === "string" ? body.region.trim() : "";
  const scheduledAt =
    typeof body.scheduledAt === "string" && body.scheduledAt
      ? parseDateOnlyToKst(body.scheduledAt)
      : null;
  const guestTarget = normalizePositiveInt(body.guestTarget);
  const budget = normalizePositiveInt(body.budget);
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const planId = typeof body.planId === "string" ? body.planId : "";

  if (!title || !type || !region) {
    return Response.json(
      { error: "행사명, wedding/funeral 유형, 지역은 필수입니다." },
      { status: 400 }
    );
  }

  const recommendation = generateStep3MockAIRecommendation({
    budget,
    guestCount: guestTarget,
    region,
    eventType: type,
    description
  });

  if (planId) {
    const ownedPlan = await prisma.eventPlan.findFirst({
      where: {
        id: planId,
        ownerId: session.user.id
      },
      select: {
        id: true
      }
    });

    if (!ownedPlan) {
      return Response.json({ error: "수정할 행사 계획을 찾을 수 없습니다." }, { status: 404 });
    }

    const updatedPlan = await prisma.eventPlan.update({
      where: {
        id: ownedPlan.id
      },
      data: {
        title,
        type,
        region,
        scheduledAt,
        guestTarget,
        budget,
        description: description || null,
        status: "PLANNING",
        aiRecommendation: recommendation
      },
      select: {
        id: true
      }
    });

    revalidatePlanViews(updatedPlan.id);

    return Response.json({
      planId: updatedPlan.id,
      recommendation
    });
  }

  const createdPlan = await prisma.eventPlan.create({
    data: {
      ownerId: session.user.id,
      title,
      slug: buildEventPlanSlug(title),
      type,
      region,
      scheduledAt,
      guestTarget,
      budget,
      description: description || null,
      status: "PLANNING",
      aiRecommendation: recommendation
    },
    select: {
      id: true
    }
  });

  revalidatePlanViews(createdPlan.id);

  return Response.json({
    planId: createdPlan.id,
    recommendation
  });
}
