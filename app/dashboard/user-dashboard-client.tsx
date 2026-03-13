"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type UserRecord = {
  id: string;
  [key: string]: unknown;
};

type UsersApiResponse = {
  items?: UserRecord[];
  error?: string;
};

type UserDashboardClientProps = {
  userUid: string;
  userEmail: string;
};

export function UserDashboardClient({ userUid, userEmail }: UserDashboardClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryRecord = useMemo(() => items[0] ?? null, [items]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login?redirectTo=/dashboard");
        return;
      }

      const json = (await res.json()) as UsersApiResponse;
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load user data");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleCreateProfile() {
    setPendingCreate(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userUid,
          displayName: "",
          bio: "",
          plan: "free",
        }),
      });

      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create profile");
      }
    } finally {
      setPendingCreate(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login?redirectTo=/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">User Dashboard</CardTitle>
                <CardDescription>Private page backed by `/api/users`</CardDescription>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void loadUsers()} disabled={loading}>
                  Refresh
                </Button>
                <Button variant="destructive" onClick={() => void handleSignOut()}>
                  Sign out
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">UID: {userUid}</Badge>
              <Badge variant="secondary">{userEmail || "No email on account"}</Badge>
            </div>

            <Separator />

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Request failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {loading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading your data...</p>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  No profile record exists yet for this user.
                </p>
                <Button className="mt-3" onClick={() => void handleCreateProfile()} disabled={pendingCreate}>
                  {pendingCreate ? "Creating..." : "Create Profile Record"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Primary Record</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Document ID: {primaryRecord?.id}</p>
                  <pre className="mt-3 overflow-x-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-950">
                    {JSON.stringify(primaryRecord, null, 2)}
                  </pre>
                </div>

                {items.length > 1 ? (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">Additional Records: {items.length - 1}</p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
