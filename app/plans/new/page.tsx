import { redirect } from "next/navigation";

import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { parseMvpQuoteEventType } from "@/lib/step3.shared";

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const session = await getServerAuthSession();
  const params = await searchParams;
  const contextType = parseMvpQuoteEventType(params?.type);
  const destination = contextType
    ? `/planner/${contextType === "WEDDING" ? "wedding" : "funeral"}?create=1`
    : "/planner?create=1";

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  }

  if (session.user.role === UserRole.VENDOR) {
    redirect("/vendor/dashboard");
  }

  redirect(destination);
}
