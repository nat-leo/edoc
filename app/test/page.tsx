import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function LandingPage() {
  return (
    <main className="min-h-screen px-6 sm:px-20 lg:px-16">
      <header className="py-6">
        <h1 className="text-center text-xl">edoc.ai</h1>
      </header>

      <div className="h-[calc(100vh-80px)] grid place-items-center">
        <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center">
          {/* left */}
          <section className="text-center p-6">
            <h2 className="text-2xl font-semibold">Timed Assessment</h2>
            <div className="text-muted-foreground">
              <p>This is a timed assessment, you'll have one hour to complete the questions. This is just practice, so don't stress out about it and try your best! <br/><br/> Learning comes from finding the answers to what you didn't know. Good Luck!</p>
            </div>
          </section>

          {/* vertical separator (md+) */}
          <>
            {/* mobile: horizontal */}
            <Separator className="block md:hidden w-full my-6" />
            {/* md+: vertical */}
            <Separator orientation="vertical" className="hidden md:block h-full mx-6" />
          </>

          {/* right */}
          <section className="p-6 flex justify-center">
            <div className="w-full max-w-sm space-y-3">
              <Button className="w-full" variant="outline">Question 1</Button>
              <Button className="w-full" variant="outline">Question 2</Button>
              <Button className="w-full" variant="outline">Question 3</Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

