import { NextResponse } from "next/server";

import {
  UserRole,
  VendorApprovalStatus
} from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { consumeSignupVerificationCode } from "@/lib/auth/verification-store";
import {
  formatPhoneNumber,
  isValidEmail,
  isValidPassword,
  isValidPhoneNumber,
  normalizeEmail,
  parseSignupRole
} from "@/lib/auth/validation";
import { prisma } from "@/lib/prisma";

type SignupBody = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  passwordConfirm?: string;
  verificationCode?: string;
  role?: string;
  companyName?: string;
  location?: string;
  bio?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const role = parseSignupRole(body.role ?? "");
    const name = body.name?.trim() ?? "";
    const email = normalizeEmail(body.email ?? "");
    const phone = formatPhoneNumber(body.phone ?? "");
    const password = body.password ?? "";
    const passwordConfirm = body.passwordConfirm ?? "";
    const verificationCode = body.verificationCode?.trim() ?? "";
    const companyName = body.companyName?.trim() ?? "";
    const location = body.location?.trim() ?? "";
    const bio = body.bio?.trim() ?? "";

    if (name.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          message: "이름은 2자 이상 입력해 주세요."
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

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          message: "비밀번호는 8자 이상 입력해 주세요."
        },
        { status: 400 }
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        {
          ok: false,
          message: "비밀번호 확인이 일치하지 않습니다."
        },
        { status: 400 }
      );
    }

    if (!verificationCode) {
      return NextResponse.json(
        {
          ok: false,
          message: "인증번호를 입력해 주세요."
        },
        { status: 400 }
      );
    }

    if (role === UserRole.VENDOR && !companyName) {
      return NextResponse.json(
        {
          ok: false,
          message: "업체명은 필수 입력입니다."
        },
        { status: 400 }
      );
    }

    if (role === UserRole.VENDOR && !location) {
      return NextResponse.json(
        {
          ok: false,
          message: "업체 활동 지역을 입력해 주세요."
        },
        { status: 400 }
      );
    }

    const verificationResult = consumeSignupVerificationCode({
      email,
      phone,
      role,
      code: verificationCode
    });

    if (!verificationResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: verificationResult.message
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

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        phone,
        phoneVerifiedAt: new Date(),
        companyName: role === UserRole.VENDOR ? companyName : null,
        location: location || null,
        bio: bio || null,
        vendorApprovalStatus:
          role === UserRole.VENDOR
            ? VendorApprovalStatus.PENDING
            : VendorApprovalStatus.NOT_APPLICABLE
      }
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          role === UserRole.VENDOR
            ? "업체 계정이 생성되었습니다. 현재 승인 대기 상태이며 로그인 후 상태를 확인할 수 있습니다."
            : "회원가입이 완료되었습니다. 바로 로그인됩니다.",
        user: {
          email: user.email,
          role: user.role,
          vendorApprovalStatus: user.vendorApprovalStatus
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to sign up user");
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "회원가입 처리에 실패했습니다."
      },
      { status: 500 }
    );
  }
}
