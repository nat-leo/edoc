import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  const expiresIn = 5 * 24 * 60 * 60 * 1000; // 5 days
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("__session", sessionCookie, {
    httpOnly: true,
    secure: false, // won't send cookies if true - must be over HTTPS
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(expiresIn / 1000),
  });

  return res;
}
