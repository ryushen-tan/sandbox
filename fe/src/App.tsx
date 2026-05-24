import { useEffect, useRef, useState } from 'react'
import { Button } from "@/components/ui/button"
import { ScrollReels } from "@/features/scroll-reels/components/ScrollReels"
import { reels } from "@/features/scroll-reels/data/reels"
import { WaitingRoom } from "@/features/battle/components/WaitingRoom"
import { useRoom } from "@/features/battle/hooks/useRoom"
import { getSocket } from "@/features/battle/socket"
import { routes } from "@/routes/paths"

function Lobby({
  onCreateRoom,
  onJoinRoom,
  error,
}: {
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
  error: string | null
}) {
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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-6 text-center text-foreground">
      <div className="max-w-xl space-y-3">
        <p className="text-sm font-medium text-muted-foreground">React + Tailwind CSS + shadcn/ui</p>
        <h1 className="text-4xl font-semibold tracking-tight">Don't Laugh.</h1>
        <p className="text-muted-foreground">
          Watch reels. Keep a straight face. Last one standing wins.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button
          className="w-full"
          onClick={onCreateRoom}
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
            onKeyDown={(e) => e.key === 'Enter' && code.length === 4 && onJoinRoom(code)}
            placeholder="X X X X"
            maxLength={4}
            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-center font-mono text-lg uppercase tracking-[0.3em] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <Button
            variant="outline"
            onClick={() => code.length === 4 && onJoinRoom(code)}
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
  const { phase, error, createRoom, joinRoom, reset } = useRoom()
  const socket = useRef(getSocket()).current
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Sync URL with battle phase
  useEffect(() => {
    const target = phase.type === 'battle' || phase.type === 'ended' ? routes.scrollReels : routes.home
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target)
      setPath(target)
    }
  }, [phase.type])

  // Battle/ended → scroll reels with battle overlay
  if (phase.type === 'battle' || phase.type === 'ended') {
    return (
      <ScrollReels
        items={reels}
        battle={{
          socket,
          isHost: phase.type === 'battle' ? phase.isHost : false,
          isEnded: phase.type === 'ended',
          won: phase.type === 'ended' ? phase.won : false,
          onLeave: () => {
            reset()
            window.history.pushState({}, '', routes.home)
            setPath(routes.home)
          },
        }}
      />
    )
  }

  // Direct visit to /scroll-reels while idle → solo mode
  if (path === routes.scrollReels && phase.type === 'idle') {
    return <ScrollReels items={reels} />
  }

  // Waiting for opponent
  if (phase.type === 'waiting') {
    return <WaitingRoom code={phase.code} onCancel={reset} />
  }

  // Idle → lobby
  return <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} />
}

export default App
