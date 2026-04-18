import { UserRole } from "@/generated/prisma/client";

type MockVerificationPayload = {
  code: string;
  email: string;
  expiresAt: Date;
  name: string;
  phone: string;
  role: UserRole;
};

export async function sendMockSignupVerificationCode(payload: MockVerificationPayload) {
  console.log("[Mock Verification] signup verification requested");
  console.log(
    JSON.stringify(
      {
        role: payload.role,
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        code: payload.code,
        expiresAt: payload.expiresAt.toISOString()
      },
      null,
      2
    )
  );
}
