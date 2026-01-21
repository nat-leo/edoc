// components/firebase/SessionCookieSync.tsx
"use client";

import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useEffect } from "react";

export function SessionCookieSync() {
  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        document.cookie = `__session=${encodeURIComponent(idToken)}; Path=/; SameSite=Lax`;
      } else {
        document.cookie = `__session=; Path=/; Max-Age=0; Path=/; SameSite=Lax`;
      }
      // reload so server-rendered components see updated auth
      window.location.reload();
    });
  }, []);

  return null;
}
