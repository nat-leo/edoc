"use client"

import * as React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type TopicTag = { name: string; slug: string }
type Problem = {
  id: number
  title: string
  titleSlug: string
  difficulty: "EASY" | "MEDIUM" | "HARD"
  paidOnly: boolean
  acRate: number
  topicTags: TopicTag[]
}

type ApiResponse = {
  data?: {
    problemsetQuestionListV2?: {
      questions?: Problem[]
    }
  }
}

export default function ProblemFeedPage() {
  const LIMIT = 100

  const [items, setItems] = React.useState<Problem[]>([])
  const [skip, setSkip] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const sentinelRef = React.useRef<HTMLDivElement | null>(null)

  const loadMore = React.useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/problem?limit=${LIMIT}&skip=${skip}`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = (await res.json()) as ApiResponse
      const next = json.data?.problemsetQuestionListV2?.questions ?? []

      setItems((prev) => [...prev, ...next])
      setSkip((prev) => prev + LIMIT)

      // since API doesn't return hasMore, infer it:
      setHasMore(next.length === LIMIT)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [LIMIT, skip, loading, hasMore])

  React.useEffect(() => {
    if (items.length === 0) loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { root: null, rootMargin: "300px", threshold: 0 }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  return (
    <div className="space-y-4">
      {items.map((p) => (
        <Card key={`${p.id}-${p.titleSlug}`}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="truncate">{p.title}</span>
              <Badge variant="secondary">{p.difficulty}</Badge>
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-2">
              {p.topicTags?.slice(0, 4).map((t) => (
                <Badge key={t.slug} variant="outline">
                  {t.name}
                </Badge>
              ))}
              {p.paidOnly ? <Badge variant="destructive">Paid</Badge> : null}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Acceptance: {(p.acRate * 100).toFixed(1)}%
            </p>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" asChild>
                <Link href={`/problems/${p.titleSlug}`}>Open</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href={`/recommendations?seed=${p.titleSlug}`}>See more</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <div ref={sentinelRef} />

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!hasMore && items.length > 0 && (
        <p className="text-sm text-muted-foreground">You’re all caught up.</p>
      )}
    </div>
  )
}
