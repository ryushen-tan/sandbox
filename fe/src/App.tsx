import { ScrollReelsPage } from "@/pages/ScrollReelsPage"
import { routes } from "@/routes/paths"
import { Battle } from "@/features/battle"

function App() {
  const path = window.location.pathname

  if (path === routes.scrollReels) return <ScrollReelsPage />
  if (path === routes.battle) return <Battle />

  // Home — land on the battle lobby by default
  return <Battle />
}

export default App
