export type UserRole = "USER" | "VENDOR" | "ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
}

export interface VendorProfileData {
  id: string;
  userId: string;
  businessNumber: string;
  companyName: string;
  category: string;
  description: string | null;
  location: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
}
