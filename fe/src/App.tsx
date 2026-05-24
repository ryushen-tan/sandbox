import { Button } from "@/components/ui/button"
import { ScrollReelsPage } from "@/pages/ScrollReelsPage"
import { routes } from "@/routes/paths"

function App() {
  if (window.location.pathname === routes.scrollReels) {
    return <ScrollReelsPage />
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="max-w-xl space-y-3">
        <p className="text-sm font-medium text-muted-foreground">React + Tailwind CSS + shadcn/ui</p>
        <h1 className="text-4xl font-semibold tracking-tight">Project scaffold is ready.</h1>
        <p className="text-muted-foreground">
          Start filling in the prepared folders under <code className="rounded bg-muted px-1 py-0.5">src</code>.
        </p>
      </div>
      <Button asChild>
        <a href={routes.scrollReels}>Open scroll reels</a>
      </Button>
    </main>
  )
}

export default App
