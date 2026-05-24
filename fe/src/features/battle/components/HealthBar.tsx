interface HealthBarProps {
  hp: number
  label: string
  side: 'left' | 'right'
}

function barColor(hp: number) {
  if (hp > 60) return 'bg-emerald-400'
  if (hp > 30) return 'bg-amber-400'
  return 'bg-red-500'
}

export function HealthBar({ hp, label, side }: HealthBarProps) {
  const clamped = Math.max(0, Math.min(100, hp))

  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        {label}
      </span>

      {/* Bar track */}
      <div className="relative h-52 w-2.5 overflow-hidden rounded-full border border-white/10 bg-white/5">
        {/* Fill — grows from bottom */}
        <div
          className={`absolute bottom-0 w-full rounded-full transition-all duration-100 ${barColor(clamped)}`}
          style={{ height: `${clamped}%` }}
        />
      </div>

      <span className="font-mono text-[10px] text-stone-500">{Math.ceil(clamped)}</span>
    </div>
  )
}
