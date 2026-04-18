/* eslint-disable no-var */
import { randomInt } from "node:crypto";

import { UserRole } from "@/generated/prisma/client";
import { formatPhoneNumber, getSignupVerificationKey, normalizeEmail } from "@/lib/auth/validation";

type SignupVerificationEntry = {
  code: string;
  createdAt: number;
  expiresAt: number;
  email: string;
  phone: string;
  role: UserRole;
};

declare global {
  var __yeonSignupVerificationStore:
    | Map<string, SignupVerificationEntry>
    | undefined;
}

const verificationStore =
  globalThis.__yeonSignupVerificationStore ??
  new Map<string, SignupVerificationEntry>();

if (!globalThis.__yeonSignupVerificationStore) {
  globalThis.__yeonSignupVerificationStore = verificationStore;
}

const CODE_TTL_MS = 5 * 60 * 1000;

function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of verificationStore.entries()) {
    if (entry.expiresAt <= now) {
      verificationStore.delete(key);
    }
  }
}

export function issueSignupVerificationCode(params: {
  email: string;
  phone: string;
  role: UserRole;
}) {
  cleanupExpiredEntries();

  const code = randomInt(100000, 1000000).toString();
  const key = getSignupVerificationKey(params);
  const entry: SignupVerificationEntry = {
    code,
    createdAt: Date.now(),
    expiresAt: Date.now() + CODE_TTL_MS,
    email: normalizeEmail(params.email),
    phone: formatPhoneNumber(params.phone),
    role: params.role
  };

  verificationStore.set(key, entry);

  return {
    code,
    expiresAt: new Date(entry.expiresAt)
  };
}

export function consumeSignupVerificationCode(params: {
  email: string;
  phone: string;
  role: UserRole;
  code: string;
}) {
  cleanupExpiredEntries();

  const key = getSignupVerificationKey(params);
  const entry = verificationStore.get(key);

  if (!entry) {
    return {
      ok: false as const,
      message: "인증번호를 먼저 요청해 주세요."
    };
  }

  if (entry.expiresAt <= Date.now()) {
    verificationStore.delete(key);

    return {
      ok: false as const,
      message: "인증번호 유효 시간이 지났습니다. 다시 요청해 주세요."
    };
  }

  if (entry.code !== params.code.trim()) {
    return {
      ok: false as const,
      message: "인증번호가 올바르지 않습니다."
    };
  }

  verificationStore.delete(key);

  return {
    ok: true as const
  };
}
