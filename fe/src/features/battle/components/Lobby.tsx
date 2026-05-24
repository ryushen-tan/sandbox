import { useState } from 'react'

interface LobbyProps {
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
  error: string | null
}

export function Lobby({ onCreateRoom, onJoinRoom, error }: LobbyProps) {
  const [code, setCode] = useState('')

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-10 overflow-hidden bg-[#080806] px-6 text-stone-50">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,122,41,0.15),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(226,36,91,0.15),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />

      {/* Header */}
      <div className="relative text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-stone-500">PvP</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight">Don't Laugh</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-stone-500">
          Watch reels. Keep a straight face.<br />Smile and your health drains. Last one standing wins.
        </p>
      </div>

      {/* Actions */}
      <div className="relative flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onCreateRoom}
          className="w-full rounded-xl bg-stone-50 px-5 py-3 text-sm font-semibold text-stone-900 transition-opacity hover:opacity-90 active:opacity-75"
        >
          Create Room
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-stone-600">or join</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="XXXX"
            maxLength={4}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.3em] text-stone-50 outline-none placeholder:text-stone-700 focus:border-white/25 focus:bg-white/8"
          />
          <button
            onClick={() => code.length === 4 && onJoinRoom(code)}
            disabled={code.length !== 4}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-stone-300 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Join
          </button>
        </div>

        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}
      </div>
    </main>
  )
}
