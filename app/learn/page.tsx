// app/home/page.tsx
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl p-6 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <Badge variant="secondary">Home</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose a path: simulate an interview, or drill a skill with deliberate
            practice.
          </p>
        </header>

        {/* Quick search + progress */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Quick search</CardTitle>
              <CardDescription>
                Search problems, topics, companies, or notes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="e.g. two pointers, graph BFS, Stripe, LC 167..." />
                <Button asChild>
                  <Link href="/problems">Browse</Link>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Tip: you can route search to <code className="font-mono">/problems</code>{" "}
                with query params once wired.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">This week</CardTitle>
              <CardDescription>Stay consistent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Weekly goal</span>
                <span className="font-medium">3 / 7 sessions</span>
              </div>
              <Progress value={43} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Streak</span>
                <span className="font-medium">5 days</span>
              </div>
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/progress">View progress</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Main chooser */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">
              What are you doing today?
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Adaptive</Badge>
              <Badge variant="outline">Timed</Badge>
              <Badge variant="outline">Targeted</Badge>
            </div>
          </div>

          <Tabs defaultValue="interview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="interview">Practice interview</TabsTrigger>
              <TabsTrigger value="deliberate">Deliberate practice</TabsTrigger>
            </TabsList>

            {/* Practice Interview */}
            <TabsContent value="interview">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Interview session</CardTitle>
                    <CardDescription>
                      Simulate pressure: timed prompts + follow-ups.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>Timed</Badge>
                      <Badge variant="secondary">Follow-ups</Badge>
                      <Badge variant="secondary">Rubric</Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Track</Label>
                        <Select defaultValue="dsa">
                          <SelectTrigger>
                            <SelectValue placeholder="Select track" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dsa">DSA</SelectItem>
                            <SelectItem value="system">System Design</SelectItem>
                            <SelectItem value="behavioral">Behavioral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select defaultValue="medium">
                          <SelectTrigger>
                            <SelectValue placeholder="Select difficulty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" asChild>
                        <Link href="/session/interview">Start session</Link>
                      </Button>
                      <Button variant="secondary" className="flex-1" asChild>
                        <Link href="/session/continue">Continue</Link>
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Continue should restore your last session state (timer,
                      notes, attempts) once wired.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommended next</CardTitle>
                    <CardDescription>
                      Based on recent misses and time-to-solve.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Graphs: BFS shortest path</span>
                        <Badge variant="secondary">Recommended</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You tend to overuse DFS where BFS is optimal; practice 2
                        targeted BFS prompts.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1" asChild>
                        <Link href="/practice/graphs-bfs">Do this drill</Link>
                      </Button>
                      <Button variant="outline" className="flex-1" asChild>
                        <Link href="/recommendations">See more</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Deliberate Practice */}
            <TabsContent value="deliberate">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Deliberate practice</CardTitle>
                    <CardDescription>
                      Choose a skill → drill until it’s automatic.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>Targeted</Badge>
                      <Badge variant="secondary">Spaced repetition</Badge>
                      <Badge variant="secondary">Weakness-first</Badge>
                    </div>

                    <div className="space-y-2">
                      <Label>Focus area</Label>
                      <Select defaultValue="two-pointers">
                        <SelectTrigger>
                          <SelectValue placeholder="Select a skill" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="two-pointers">Two pointers</SelectItem>
                          <SelectItem value="sliding-window">Sliding window</SelectItem>
                          <SelectItem value="dp">Dynamic programming</SelectItem>
                          <SelectItem value="graphs">Graphs</SelectItem>
                          <SelectItem value="trees">Trees</SelectItem>
                          <SelectItem value="sql">SQL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Set size</Label>
                        <Select defaultValue="10">
                          <SelectTrigger>
                            <SelectValue placeholder="Select set size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select defaultValue="mixed">
                          <SelectTrigger>
                            <SelectValue placeholder="Select difficulty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button className="w-full" asChild>
                      <Link href="/session/practice">Start practice</Link>
                    </Button>

                    <p className="text-xs text-muted-foreground">
                      This should generate a tailored queue, not a random list.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Weak areas</CardTitle>
                    <CardDescription>
                      What to fix first to raise your baseline.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">DP: state definition</span>
                        <Badge variant="outline">Needs work</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Binary search: invariants</span>
                        <Badge variant="outline">Needs work</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">SQL: window functions</span>
                        <Badge variant="outline">Needs work</Badge>
                      </div>
                    </div>

                    <Button variant="secondary" className="w-full" asChild>
                      <Link href="/diagnostics">Run diagnostics</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* Footer shortcuts */}
        <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Tip: keep the home page fast—render summaries here, load heavy data on
            demand.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">Docs</Link>
            </Button>
          </div>
        </footer>
      </div>
    </main>
  )
}
