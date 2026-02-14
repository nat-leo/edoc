"use client"

import * as React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Problem = {
  title: string
  titleSlug: string
  difficulty: string
}

type ApiResponse = { problems: Problem[]; count: number }

export default function ProblemFeedPage() {
  const [items, setItems] = React.useState<Problem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/problems", { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ApiResponse
        setItems(json.problems ?? [])
      } catch (e: any) {
        setError(e?.message ?? "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  return (
    <div className="space-y-4">
      {items.map((p) => (
        <Card key={p.titleSlug}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span className="truncate">{p.title}</span>
              <Badge variant="secondary">{p.difficulty}</Badge>
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {/* Placeholder for future metadata */}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" asChild>
                <Link href={`/problems/${p.titleSlug}`}>Open</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No problems found.</p>
      )}
    </div>
  )
}
