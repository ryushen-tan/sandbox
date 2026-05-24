interface EndScreenProps {
  won: boolean
  myHp: number
  opponentHp: number
  onPlayAgain: () => void
  onLeave: () => void
}

export function EndScreen({ won, myHp, opponentHp, onPlayAgain, onLeave }: EndScreenProps) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/80 backdrop-blur-sm">
      {/* Result */}
      <div className="text-center">
        <p className="text-7xl">{won ? '🏆' : '💀'}</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight text-stone-50">
          {won ? 'You Win!' : 'You Lost'}
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          {won ? 'They cracked first.' : 'You smiled too much.'}
        </p>
      </div>

      {/* Final HP comparison */}
      <div className="flex items-end gap-6 rounded-2xl border border-white/10 bg-white/5 px-8 py-5 backdrop-blur">
        {[
          { label: 'You', hp: myHp, highlight: won },
          { label: 'Opponent', hp: opponentHp, highlight: !won },
        ].map(({ label, hp, highlight }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-stone-500">{label}</span>
            <div className="relative h-24 w-3 overflow-hidden rounded-full border border-white/10 bg-white/5">
              <div
                className={`absolute bottom-0 w-full rounded-full transition-all ${
                  hp > 60 ? 'bg-emerald-400' : hp > 30 ? 'bg-amber-400' : 'bg-red-500'
                }`}
                style={{ height: `${Math.max(0, hp)}%` }}
              />
            </div>
            <span className={`font-mono text-xs ${highlight ? 'text-stone-200' : 'text-stone-600'}`}>
              {Math.ceil(Math.max(0, hp))} HP
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onPlayAgain}
          className="rounded-xl bg-stone-50 px-6 py-2.5 text-sm font-semibold text-stone-900 transition-opacity hover:opacity-90"
        >
          Play Again
        </button>
        <button
          onClick={onLeave}
          className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm text-stone-400 transition-all hover:bg-white/10"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
