import type { NextAuthOptions } from "next-auth";
import CredentialsProviderModule from "next-auth/providers/credentials";

import { VendorApprovalStatus, UserRole } from "@/generated/prisma/client";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/validation";
import {
  ensureDemoData,
  isDemoCredentialEmail
} from "@/lib/demo/ensure-demo-data";
import { prisma } from "@/lib/prisma";

const CredentialsProvider =
  (
    CredentialsProviderModule as unknown as {
      default?: typeof CredentialsProviderModule;
    }
  ).default ?? CredentialsProviderModule;

export const authOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "YeON Credentials",
      credentials: {
        email: {
          label: "이메일",
          type: "email"
        },
        password: {
          label: "비밀번호",
          type: "password"
        }
      },
      async authorize(
        credentials?: Record<"email" | "password", string>
      ) {
        const email = normalizeEmail(credentials?.email ?? "");
        const password = credentials?.password ?? "";

        if (!email || !password) {
          throw new Error("이메일과 비밀번호를 모두 입력해 주세요.");
        }

        if (isDemoCredentialEmail(email)) {
          try {
            await ensureDemoData(prisma);
          } catch (err) {
            console.error("[ensureDemoData] seed failed, skipping:", err);
          }
        }

        const user = await prisma.user.findUnique({
          where: {
            email
          }
        });

        if (!user) {
          throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        const isValidPassword = await verifyPassword(password, user.passwordHash);

        if (!isValidPassword) {
          throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        if (!user.isActive) {
          throw new Error("비활성화된 계정입니다.");
        }

        if (!user.phoneVerifiedAt) {
          throw new Error("휴대폰 인증이 완료되지 않은 계정입니다.");
        }

        if (
          user.role === UserRole.VENDOR &&
          user.vendorApprovalStatus === VendorApprovalStatus.REJECTED
        ) {
          throw new Error("승인 거절된 업체 계정입니다.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          companyName: user.companyName,
          vendorApprovalStatus: user.vendorApprovalStatus
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.phone = user.phone ?? null;
        token.companyName = user.companyName ?? null;
        token.vendorApprovalStatus = user.vendorApprovalStatus;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role =
          token.role === UserRole.ADMIN ||
          token.role === UserRole.VENDOR
            ? token.role
            : UserRole.GENERAL;
        session.user.phone = typeof token.phone === "string" ? token.phone : null;
        session.user.companyName =
          typeof token.companyName === "string"
            ? token.companyName
            : null;
        session.user.vendorApprovalStatus =
          token.vendorApprovalStatus === VendorApprovalStatus.APPROVED ||
          token.vendorApprovalStatus === VendorApprovalStatus.PENDING ||
          token.vendorApprovalStatus === VendorApprovalStatus.REJECTED
            ? token.vendorApprovalStatus
            : VendorApprovalStatus.NOT_APPLICABLE;
      }

      return session;
    }
  }
} satisfies NextAuthOptions;
