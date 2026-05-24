import { useEffect, useRef, useState } from 'react'
import { Button } from "@/components/ui/button"
import { ScrollReelsPage } from "@/pages/ScrollReelsPage"
import { WaitingRoom } from "@/features/battle/components/WaitingRoom"
import { BattleScreen } from "@/features/battle/components/BattleScreen"
import { useRoom } from "@/features/battle/hooks/useRoom"
import { getSocket } from "@/features/battle/socket"
import { routes } from "@/routes/paths"

function HomePage() {
  const { phase, error, createRoom, joinRoom, reset } = useRoom()
  const socket = useRef(getSocket()).current
  const [finalHp, setFinalHp] = useState({ mine: 100, opponent: 100 })
  const [code, setCode] = useState('')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = getSocket()
    setConnected(s.connected)
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    return () => {
      s.off('connect')
      s.off('disconnect')
    }
  }, [])

  if (phase.type === 'waiting') {
    return <WaitingRoom code={phase.code} onCancel={reset} />
  }

  if (phase.type === 'battle' || phase.type === 'ended') {
    return (
      <BattleScreen
        socket={socket}
        isHost={phase.type === 'battle' ? phase.isHost : false}
        onEnd={() => {}}
        finalHp={finalHp}
        onFinalHpChange={setFinalHp}
      />
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-6 text-center text-foreground">
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

      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">PvP Battle</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          className="w-full"
          onClick={createRoom}
          disabled={!connected}
        >
          {connected ? 'Create Room' : 'Connecting…'}
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or join</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 4 && joinRoom(code)}
            placeholder="X X X X"
            maxLength={4}
            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-center font-mono text-lg uppercase tracking-[0.3em] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <Button
            variant="outline"
            onClick={() => code.length === 4 && joinRoom(code)}
            disabled={code.length !== 4 || !connected}
          >
            Join
          </Button>
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-center gap-2 pt-1">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground animate-pulse'}`} />
          <span className="text-xs text-muted-foreground">
            {connected ? 'Connected to server' : 'Waiting for server…'}
          </span>
        </div>
      </div>
    </main>
  )
}

function App() {
  const path = window.location.pathname
  if (path === routes.scrollReels) return <ScrollReelsPage />
  return <HomePage />
}

export default App
