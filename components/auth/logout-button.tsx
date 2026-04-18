"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { Button, type ButtonProps } from "@/components/ui/button";

type LogoutButtonProps = ButtonProps & {
  callbackUrl?: string;
};

export function LogoutButton({
  callbackUrl = "/",
  children = "로그아웃",
  disabled,
  ...props
}: LogoutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    await signOut({ callbackUrl });
  }

  return (
    <Button
      disabled={disabled || isPending}
      onClick={handleLogout}
      {...props}
    >
      {isPending ? "로그아웃 중..." : children}
    </Button>
  );
}
