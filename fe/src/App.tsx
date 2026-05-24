import { Button } from "@/components/ui/button"
import { ScrollReelsPage } from "@/pages/ScrollReelsPage"
import { Battle } from "@/features/battle"
import { routes } from "@/routes/paths"

function App() {
  const path = window.location.pathname

  if (path === routes.scrollReels) return <ScrollReelsPage />
  if (path === routes.battle) return <Battle />

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="max-w-xl space-y-3">
        <p className="text-sm font-medium text-muted-foreground">React + Tailwind CSS + shadcn/ui</p>
        <h1 className="text-4xl font-semibold tracking-tight">Project scaffold is ready.</h1>
        <p className="text-muted-foreground">
          Start filling in the prepared folders under <code className="rounded bg-muted px-1 py-0.5">src</code>.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <a href={routes.scrollReels}>Open scroll reels</a>
        </Button>
        <Button asChild variant="outline">
          <a href={routes.battle}>PvP Battle</a>
        </Button>
      </div>
    </main>
  )
}

export default App
