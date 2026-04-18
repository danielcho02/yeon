import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

import type { UserRole, VendorApprovalStatus } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      phone: string | null;
      companyName: string | null;
      vendorApprovalStatus: VendorApprovalStatus;
    };
  }

  interface User extends DefaultUser {
    role: UserRole;
    phone: string | null;
    companyName: string | null;
    vendorApprovalStatus: VendorApprovalStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: UserRole;
    phone?: string | null;
    companyName?: string | null;
    vendorApprovalStatus?: VendorApprovalStatus;
  }
}
