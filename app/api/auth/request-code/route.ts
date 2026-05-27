import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendMockSignupVerificationCode } from "@/lib/mocks/auth-verification";
import { issueSignupVerificationCode } from "@/lib/auth/verification-store";
import {
  formatPhoneNumber,
  isValidEmail,
  isValidPhoneNumber,
  normalizeEmail,
  parseSignupRole
} from "@/lib/auth/validation";
import { UserRole } from "@/generated/prisma/client";

type RequestCodeBody = {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestCodeBody;
    const name = body.name?.trim() ?? "";
    const email = normalizeEmail(body.email ?? "");
    const phone = formatPhoneNumber(body.phone ?? "");
    const role = parseSignupRole(body.role ?? "");

    if (name.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          message:
            role === UserRole.VENDOR
              ? "업체명은 2자 이상 입력해 주세요."
              : "이름은 2자 이상 입력해 주세요."
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          message: "올바른 이메일을 입력해 주세요."
        },
        { status: 400 }
      );
    }

    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        {
          ok: false,
          message: "휴대폰 번호는 010으로 시작하는 11자리 숫자로 입력해 주세요."
        },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }]
      },
      select: {
        id: true
      }
    });

    if (existingUser) {
      return NextResponse.json(
        {
          ok: false,
          message: "이미 가입된 이메일 또는 휴대폰 번호입니다."
        },
        { status: 409 }
      );
    }

    const { code, expiresAt } = issueSignupVerificationCode({
      email,
      phone,
      role
    });

    await sendMockSignupVerificationCode({
      code,
      email,
      expiresAt,
      name,
      phone,
      role
    });

    return NextResponse.json({
      ok: true,
      message:
        "인증번호를 발송했습니다. 개발 환경에서는 서버 콘솔에 표시된 코드를 입력해 주세요."
    });
  } catch (error) {
    console.error("Failed to request signup verification code");
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "인증번호 요청에 실패했습니다."
      },
      { status: 500 }
    );
  }
}
