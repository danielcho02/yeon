"use server";

import path from "path";
import { promises as fs } from "fs";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, actionSuccess, getActionError } from "@/lib/errors";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { mapMobileCard, requireGeneralUser } from "./_utils";

import type { ActionResult } from "@/types/common";
import type { FuneralCardContent, MobileCardData, WeddingCardContent } from "@/types/invitation";

const weddingContentSchema = z.object({
  groomName: z.string().min(1, "신랑 이름을 입력해 주세요."),
  brideName: z.string().min(1, "신부 이름을 입력해 주세요."),
  groomFamilyDesc: z.string().optional(),
  brideFamilyDesc: z.string().optional(),
  date: z.string().min(1, "날짜를 입력해 주세요."),
  time: z.string().optional(),
  venue: z.string().min(1, "장소를 입력해 주세요."),
  venueAddress: z.string().optional(),
  venueMapUrl: z.string().url().optional().or(z.literal("")),
  greeting: z.string().optional(),
  contactInfo: z.string().optional(),
  accountInfo: z.string().optional(),
  imageUrl: z.string().optional(),
});

const funeralContentSchema = z.object({
  deceasedName: z.string().min(1, "고인 성함을 입력해 주세요."),
  funeralHall: z.string().min(1, "장례식장을 입력해 주세요."),
  funeralHallAddress: z.string().optional(),
  departureDatetime: z.string().optional(),
  burialPlace: z.string().optional(),
  chiefMourners: z.string().optional(),
  visitingHours: z.string().optional(),
  visitingInfo: z.string().optional(),
  accountInfo: z.string().optional(),
  imageUrl: z.string().optional(),
});

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function revalidateMobileCardViews(planId: string) {
  revalidatePath(`/plans/${planId}/mobile-card`);
  revalidatePath(`/plans/${planId}/mobile-card/edit`);
  revalidatePath(`/plans/${planId}/mobile-card/preview`);
  revalidatePath(`/plans/${planId}`);
}

export async function createMobileCard(
  planId: string
): Promise<ActionResult<MobileCardData>> {
  try {
    const user = await requireGeneralUser();

    const plan = await withPrismaRetry(() =>
      prisma.eventPlan.findFirst({
        where: { id: planId, ownerId: user.id },
        include: {
          reservations: {
            where: { status: "CONFIRMED" },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
          mobileCard: true,
        },
      })
    );

    if (!plan) return actionError("플랜을 찾을 수 없습니다.", "NOT_FOUND");
    if (plan.mobileCard) return actionError("이미 모바일 카드가 존재합니다.", "ALREADY_EXISTS");

    const confirmedReservation = plan.reservations[0];
    if (!confirmedReservation) {
      return actionError(
        "업체 최종 확정 후 생성 가능합니다.",
        "NO_CONFIRMED_RESERVATION"
      );
    }

    const cardType = plan.type === "WEDDING" ? "WEDDING" : "FUNERAL";

    const defaultContent: WeddingCardContent | FuneralCardContent =
      cardType === "WEDDING"
        ? {
            groomName: "",
            brideName: "",
            date: confirmedReservation.serviceDate
              ? confirmedReservation.serviceDate.toISOString().split("T")[0]
              : "",
            venue: plan.venueName ?? "",
            venueAddress: plan.region ?? "",
            greeting: "",
          }
        : {
            deceasedName: "",
            funeralHall: plan.venueName ?? "",
            funeralHallAddress: plan.region ?? "",
            departureDatetime: confirmedReservation.serviceDate
              ? confirmedReservation.serviceDate.toISOString()
              : "",
          };

    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.mobileCard.findUnique({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const card = await withPrismaRetry(() =>
      prisma.mobileCard.create({
        data: {
          planId,
          sourceReservationId: confirmedReservation.id,
          ownerId: user.id,
          cardType,
          slug,
          content: defaultContent as object,
          isPublished: false,
          viewCount: 0,
        },
      })
    );

    revalidateMobileCardViews(planId);
    return actionSuccess(mapMobileCard(card));
  } catch (error) {
    return actionError(getActionError(error), "CREATE_FAILED");
  }
}

export async function updateMobileCard(
  cardId: string,
  rawContent: unknown
): Promise<ActionResult<MobileCardData>> {
  try {
    const user = await requireGeneralUser();

    const card = await withPrismaRetry(() =>
      prisma.mobileCard.findFirst({
        where: { id: cardId, ownerId: user.id },
      })
    );
    if (!card) return actionError("카드를 찾을 수 없습니다.", "NOT_FOUND");

    let content: WeddingCardContent | FuneralCardContent;
    if (card.cardType === "WEDDING") {
      const parsed = weddingContentSchema.safeParse(rawContent);
      if (!parsed.success) {
        return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.", "VALIDATION");
      }
      content = parsed.data;
    } else {
      const parsed = funeralContentSchema.safeParse(rawContent);
      if (!parsed.success) {
        return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.", "VALIDATION");
      }
      content = parsed.data;
    }

    const updated = await withPrismaRetry(() =>
      prisma.mobileCard.update({
        where: { id: cardId },
        data: { content: content as object },
      })
    );

    revalidateMobileCardViews(card.planId);
    return actionSuccess(mapMobileCard(updated));
  } catch (error) {
    return actionError(getActionError(error), "UPDATE_FAILED");
  }
}

export async function publishMobileCard(
  cardId: string
): Promise<ActionResult<MobileCardData>> {
  try {
    const user = await requireGeneralUser();

    const card = await withPrismaRetry(() =>
      prisma.mobileCard.findFirst({
        where: { id: cardId, ownerId: user.id },
      })
    );
    if (!card) return actionError("카드를 찾을 수 없습니다.", "NOT_FOUND");

    const updated = await withPrismaRetry(() =>
      prisma.mobileCard.update({
        where: { id: cardId },
        data: { isPublished: true },
      })
    );

    // TODO(alarm-tab): onMobileCardPublished(card.planId, card.cardType, card.slug)
    revalidateMobileCardViews(card.planId);
    return actionSuccess(mapMobileCard(updated));
  } catch (error) {
    return actionError(getActionError(error), "PUBLISH_FAILED");
  }
}

export async function getMobileCardByPlanId(
  planId: string
): Promise<ActionResult<MobileCardData | null>> {
  try {
    const user = await requireGeneralUser();

    const card = await withPrismaRetry(() =>
      prisma.mobileCard.findFirst({
        where: { planId, ownerId: user.id },
      })
    );

    return actionSuccess(card ? mapMobileCard(card) : null);
  } catch (error) {
    return actionError(getActionError(error), "FETCH_FAILED");
  }
}

export async function getPublicMobileCard(
  slug: string
): Promise<ActionResult<MobileCardData | null>> {
  try {
    const card = await withPrismaRetry(() =>
      prisma.mobileCard.findFirst({
        where: { slug, isPublished: true },
      })
    );

    if (!card) return actionSuccess(null);

    // TODO(alarm-tab): onCardViewed(slug, card.viewCount + 1)
    await withPrismaRetry(() =>
      prisma.mobileCard.update({
        where: { id: card.id },
        data: { viewCount: { increment: 1 } },
      })
    );

    return actionSuccess(mapMobileCard(card));
  } catch (error) {
    return actionError(getActionError(error), "FETCH_FAILED");
  }
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SAFE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadMobileCardImage(
  formData: FormData
): Promise<ActionResult<{ imageUrl: string }>> {
  try {
    await requireGeneralUser();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return actionError("파일을 선택해 주세요.", "INVALID_FILE");
    }

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return actionError("JPG, PNG, WebP 파일만 업로드 가능합니다.", "INVALID_TYPE");
    }

    if (file.size > MAX_FILE_SIZE) {
      return actionError("파일 크기는 5MB 이하여야 합니다.", "FILE_TOO_LARGE");
    }

    const ext = SAFE_EXTENSIONS[file.type] ?? "jpg";
    // 원본 파일명 사용 금지 — path traversal 방지
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "mobile-cards");

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

    return actionSuccess({ imageUrl: `/uploads/mobile-cards/${fileName}` });
  } catch (error) {
    return actionError(getActionError(error), "UPLOAD_FAILED");
  }
}
