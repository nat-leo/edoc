"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  signInWithGoogle,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from "@/lib/auth";


// Optional icons (if you have lucide-react)
// import { Eye, EyeOff, Github, Chrome } from "lucide-react";

type AuthMode = "signin" | "signup";

type AuthPageProps = {
  className?: string;

  /**
   * Where to send the user after successful auth.
   * In real apps, this is often the original "returnTo" URL.
   */
  redirectTo?: string;

  /**
   * If you want to wire in your own handlers (recommended),
   * pass them in. If omitted, the component will no-op with TODOs.
   */
  onSignIn?: (payload: { email: string; password: string; remember: boolean }) => Promise<void>;
  onSignUp?: (payload: { email: string; password: string }) => Promise<void>;
  onOAuth?: (provider: "google" | "github") => Promise<void>;
};

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirectTo = sp.get("redirectTo") ?? "/";

  return (
    <AuthPage
      redirectTo={redirectTo}
      onOAuth={async (provider) => {
        if (provider === "google") {
          await signInWithGoogle();
          router.push(redirectTo);
          router.refresh();
          return;
        }
        throw new Error("GitHub not wired yet.");
      }}
      onSignIn={async ({ email, password, remember }) => {
        await signInWithEmailPassword({ email, password, remember });
        router.push(redirectTo);
        router.refresh();
      }}
      onSignUp={async ({ email, password }) => {
        await signUpWithEmailPassword({ email, password });
        // You can auto-redirect or force them to sign in after verifying email
        router.push(redirectTo);
        router.refresh();
      }}
    />
  );
}

export function AuthPage({
  className,
  redirectTo = "/",
  onSignIn,
  onSignUp,
  onOAuth,
}: AuthPageProps) {
  const [mode, setMode] = React.useState<AuthMode>("signin");

  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sign in fields
  const [emailIn, setEmailIn] = React.useState("");
  const [passIn, setPassIn] = React.useState("");
  const [remember, setRemember] = React.useState(true);

  // Sign up fields
  const [emailUp, setEmailUp] = React.useState("");
  const [passUp, setPassUp] = React.useState("");
  const [agree, setAgree] = React.useState(false);

  function validateEmail(email: string) {
    // minimal client-side check; server must still validate
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validateEmail(emailIn)) return setError("Please enter a valid email.");
    if (passIn.length < 8) return setError("Password must be at least 8 characters.");

    setPending(true);
    try {
      if (onSignIn) {
        await onSignIn({ email: emailIn, password: passIn, remember });
      } else {
        // TODO: Wire to your auth API
        // await fetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ emailIn, passIn, remember }) })
        console.log("TODO sign-in:", { emailIn, passIn, remember, redirectTo });
      }
      // TODO: redirect to `redirectTo` (router.push), or rely on server redirect
    } catch (err: any) {
      setError(err?.message ?? "Sign in failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validateEmail(emailUp)) return setError("Please enter a valid email.");
    if (passUp.length < 8) return setError("Password must be at least 8 characters.");
    if (!agree) return setError("You must accept the Terms to continue.");

    setPending(true);
    try {
      if (onSignUp) {
        await onSignUp({ email: emailUp, password: passUp });
      } else {
        // TODO: Wire to your auth API
        console.log("TODO sign-up:", { emailUp, passUp, redirectTo });
      }
      // TODO: handle “verify email” step vs direct sign-in
    } catch (err: any) {
      setError(err?.message ?? "Sign up failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setPending(true);
    try {
      if (onOAuth) {
        await onOAuth(provider);
      } else {
        // TODO: Kick off OAuth (often a redirect)
        console.log("TODO oauth:", provider, { redirectTo });
      }
    } catch (err: any) {
      setError(err?.message ?? `Could not continue with ${provider}.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("min-h-[calc(100vh-2rem)] w-full flex items-center justify-center p-4", className)}>
      <div className="w-full max-w-md">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Tabs value={mode} onValueChange={(v) => setMode(v as AuthMode)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              {/* Shared social auth */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuth("google")}
                  disabled={pending}
                >
                  {/* <Chrome className="mr-2 h-4 w-4" /> */}
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuth("github")}
                  disabled={pending}
                >
                  {/* <Github className="mr-2 h-4 w-4" /> */}
                  GitHub
                </Button>
              </div>

              <div className="my-4 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailIn">Email</Label>
                    <Input
                      id="emailIn"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={emailIn}
                      onChange={(e) => setEmailIn(e.target.value)}
                      disabled={pending}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="passIn">Password</Label>
                      <Link href="/forgot-password" className="text-sm underline underline-offset-4">
                        Forgot?
                      </Link>
                    </div>

                    <div className="relative">
                      <Input
                        id="passIn"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={passIn}
                        onChange={(e) => setPassIn(e.target.value)}
                        disabled={pending}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword((s) => !s)}
                        disabled={pending}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {/* {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} */}
                        {showPassword ? "Hide" : "Show"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={remember}
                        onCheckedChange={(v) => setRemember(Boolean(v))}
                        disabled={pending}
                      />
                      Remember me
                    </label>

                    <span className="text-xs text-muted-foreground">
                      Redirect after login: <span className="font-mono">{redirectTo}</span>
                    </span>
                  </div>

                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailUp">Email</Label>
                    <Input
                      id="emailUp"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={emailUp}
                      onChange={(e) => setEmailUp(e.target.value)}
                      disabled={pending}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passUp">Password</Label>
                    <Input
                      id="passUp"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={passUp}
                      onChange={(e) => setPassUp(e.target.value)}
                      disabled={pending}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Tip: encourage stronger passwords server-side (zxcvbn / policy) and avoid leaking rules in errors.
                    </p>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={agree}
                      onCheckedChange={(v) => setAgree(Boolean(v))}
                      disabled={pending}
                    />
                    <span>
                      I agree to the{" "}
                      <Link href="/terms" className="underline underline-offset-4">
                        Terms
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="underline underline-offset-4">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>

                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? "Creating account…" : "Create account"}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    By signing up, you may need to verify your email before signing in.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Having trouble?{" "}
              <Link href="/support" className="underline underline-offset-4">
                Contact support
              </Link>
              .
            </p>
          </CardFooter>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Protected by standard security controls (rate limits, audit logs, etc.) — once you wire them in.
        </p>
      </div>
    </div>
  );
}
