import { headers } from "next/headers";
import { getServerSession } from "next-auth";

import { authOptions } from "./auth-options";

export async function getServerAuthSession() {
  headers();
  return getServerSession(authOptions);
}
