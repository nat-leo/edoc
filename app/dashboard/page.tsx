import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth } from "@/lib/firebase-admin";

import { UserDashboardClient } from "./user-dashboard-client";

async function getSessionUser() {
  const token = (await cookies()).get("__session")?.value;
  if (!token) {
    return null;
  }

  try {
    return await adminAuth.verifySessionCookie(token, true);
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  return <UserDashboardClient userUid={user.uid} userEmail={user.email ?? ""} />;
}
