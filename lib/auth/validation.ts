import { UserRole } from "@/generated/prisma/client";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function formatPhoneNumber(phone: string) {
  const digits = normalizePhone(phone);

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone.trim();
}

export function isValidEmail(email: string) {
  return emailRegex.test(normalizeEmail(email));
}

export function isValidPhoneNumber(phone: string) {
  const digits = normalizePhone(phone);

  return digits.length === 11 && digits.startsWith("01");
}

export function isValidPassword(password: string) {
  return password.trim().length >= 8;
}

export function parseSignupRole(role: string) {
  return role === UserRole.VENDOR ? UserRole.VENDOR : UserRole.GENERAL;
}

export function getSignupVerificationKey(params: {
  role: UserRole;
  email: string;
  phone: string;
}) {
  return `${params.role}:${normalizeEmail(params.email)}:${formatPhoneNumber(params.phone)}`;
}
