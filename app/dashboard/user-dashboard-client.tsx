"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { signOut } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Curriculum } from "@/components/curriculum";
import { ProblemCard } from "@/components/problem-card";
import { Separator } from "@/components/ui/separator";
import { ContributionActivityMonitor } from "@/components/contribution-activity-monitor";

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

type RecentSubmission = {
  id: string;
  problemId: string;
  status: string;
  languageId: number | null;
  judge0Token: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type LatestSubmissionApiResponse = {
  userUuid?: string;
  mostRecentAttempted?: RecentSubmission | null;
  mostRecentCompleted?: RecentSubmission | null;
  error?: string;
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "queued" || status === "running") return "secondary";
  if (status === "compile_error" || status === "runtime_error" || status === "failed") return "destructive";
  return "outline";
}

function labelFromStatus(status: string) {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toReadableDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export function UserDashboardClient({ userUid, userEmail }: UserDashboardClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProblem, setRecentProblem] = useState<RecentSubmission | null>(null);
  const [recentProblemLoading, setRecentProblemLoading] = useState(true);
  const [recentProblemError, setRecentProblemError] = useState<string | null>(null);

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

  const loadRecentProblem = useCallback(async () => {
    setRecentProblemLoading(true);
    setRecentProblemError(null);

    try {
      const params = new URLSearchParams({ userUuid: userUid });
      const res = await fetch(`/api/submit?${params.toString()}`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login?redirectTo=/dashboard");
        return;
      }

      const json = (await res.json()) as LatestSubmissionApiResponse;
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setRecentProblem(json.mostRecentAttempted ?? json.mostRecentCompleted ?? null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setRecentProblemError(err.message);
      } else {
        setRecentProblemError("Failed to load recent problem");
      }
      setRecentProblem(null);
    } finally {
      setRecentProblemLoading(false);
    }
  }, [router, userUid]);

  useEffect(() => {
    void loadRecentProblem();
  }, [loadRecentProblem]);

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
              <ContributionActivityMonitor />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Most Recent Problem</CardTitle>
            <CardDescription>Pick up where you left off</CardDescription>
          </CardHeader>
          <CardContent>
            {recentProblemError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load recent problem</AlertTitle>
                <AlertDescription>{recentProblemError}</AlertDescription>
              </Alert>
            ) : recentProblemLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading recent problem...</p>
            ) : recentProblem ? (
              <ProblemCard
                title={recentProblem.problemId}
                badge={<Badge variant={statusBadgeVariant(recentProblem.status)}>{labelFromStatus(recentProblem.status)}</Badge>}
                content={
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    Last activity: {toReadableDate(recentProblem.updatedAt ?? recentProblem.createdAt)}
                  </p>
                }
                actions={
                  <Button asChild className="w-full">
                    <Link href={`/problems/${recentProblem.problemId}`}>Resume Problem</Link>
                  </Button>
                }
                footerClassName="w-full"
              />
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                No submissions yet. Start a problem to see your recent activity.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Curriculum</CardTitle>
            <CardDescription>Continue learning tracks from your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Curriculum />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
