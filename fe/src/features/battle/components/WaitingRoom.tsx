interface WaitingRoomProps {
  code: string
  onCancel: () => void
}

export function WaitingRoom({ code, onCancel }: WaitingRoomProps) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-10 overflow-hidden bg-[#080806] px-6 text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,122,41,0.12),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />

      <div className="relative flex flex-col items-center gap-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-stone-500">Waiting for opponent</p>
          <p className="mt-2 text-sm text-stone-600">Share this code with your friend</p>
        </div>

        {/* Room code display */}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-10 py-6 backdrop-blur">
          <p className="font-mono text-5xl font-bold tracking-[0.4em] text-stone-50">{code}</p>
        </div>

        {/* Spinner */}
        <div className="flex items-center gap-2.5 text-stone-500">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-500 [animation-delay:-0.3s]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-500 [animation-delay:-0.15s]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-500" />
        </div>
      </div>

      <button
        onClick={onCancel}
        className="relative rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm text-stone-500 transition-all hover:bg-white/10 hover:text-stone-300"
      >
        Cancel
      </button>
    </main>
  )
}
