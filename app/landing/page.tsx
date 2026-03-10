"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";

import { LoginForm } from "@/app/login/page";
import {
  onAuthStateChanged,
  signInWithEmailPassword,
  signInWithGoogle,
  signUpWithEmailPassword,
} from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(setUser);
  }, []);

  if (user === undefined) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginForm
        redirectTo="/landing"
        onOAuth={async (provider) => {
          if (provider !== "google") throw new Error("GitHub not wired yet.");
          await signInWithGoogle();
          router.push("/landing");
          router.refresh();
        }}
        onSignIn={async ({ email, password, remember }) => {
          await signInWithEmailPassword({ email, password, remember });
          router.push("/landing");
          router.refresh();
        }}
        onSignUp={async ({ email, password }) => {
          await signUpWithEmailPassword({ email, password });
          router.push("/landing");
          router.refresh();
        }}
      />
    );
  }

  const name = user.displayName?.trim() || user.email?.trim() || "User";

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <h1 className="text-3xl font-semibold">Hello, {name}</h1>
    </main>
  );
}
