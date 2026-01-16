import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <main className="min-h-screen grid grid-rows-[1fr_auto_1fr] p-6 px-6 sm:px-20 lg:px-16 ">
      {/* (top spacer) */}
        <div className="text-center">
          <h1 className="text-xl">edoc.ai</h1>
        </div>

        {/* perfectly centered text */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold">Let's get started.</h1>
          <div className="text-muted-foreground">
            <p>Testing yourself is the best way to discover gaps in your knowledge. If you fail, and I should really be saying when you fail, you'll be in a state of mind that makes corrections stick.<br/><br/>Be an Active Learner. You got this!</p>
          </div>
        </div>

        {/* content halfway between center-text and bottom */}
        <div className="grid place-items-center">
          <div className="w-full max-w-md flex justify-center gap-20">
            <Button variant="ghost">
              <Link href="/learn">
                Learn
              </Link>
            </Button>
            <Button>
              <Link href="/test">
                Test me
              </Link>
            </Button>
          </div>
        </div>
    </main>
  );
}