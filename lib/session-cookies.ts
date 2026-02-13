// components/firebase/SessionCookieSync.tsx
"use client";

import { useEffect, useRef } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import { auth } from "@/lib/firebase";

export function SessionCookieSync() {
  const router = useRouter();
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      const uid = user?.uid ?? null;

      // Only sync when auth state actually changes
      if (uid === lastUid.current) return;
      lastUid.current = uid;

      if (user) {
        const idToken = await user.getIdToken();
        await fetch("/api/session/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } else {
        await fetch("/api/session/logout", { method: "POST" });
      }

      // Re-render server components to pick up new HttpOnly cookie
      router.refresh();
    });
  }, [router]);

  return null;
}
