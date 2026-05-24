import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

const MAX_HP = 100
const DRAIN_PER_MS = 10 / 1000   // 10 HP/sec → dead in 10s of sustained smiling
const TICK_MS = 50                // smooth animation
const EMIT_MS = 400               // how often we tell opponent our HP

export function useHealthBar(
  socket: Socket,
  smileDetected: boolean,
  active: boolean,
) {
  const [hp, setHp] = useState(MAX_HP)
  const [opponentHp, setOpponentHp] = useState(MAX_HP)
  const hpRef = useRef(MAX_HP)
  const smileRef = useRef(smileDetected)
  const defeatedRef = useRef(false)
  const lastTickRef = useRef(Date.now())

  useEffect(() => { smileRef.current = smileDetected }, [smileDetected])

  // Receive opponent health from server
  useEffect(() => {
    socket.on('opponent-health', ({ hp: opp }: { hp: number }) => setOpponentHp(opp))
    return () => { socket.off('opponent-health') }
  }, [socket])

  // Drain + emit loop — only runs while match is active
  useEffect(() => {
    if (!active) return

    hpRef.current = MAX_HP
    defeatedRef.current = false
    lastTickRef.current = Date.now()
    setHp(MAX_HP)
    setOpponentHp(MAX_HP)

    const drain = setInterval(() => {
      if (!smileRef.current || defeatedRef.current) {
        lastTickRef.current = Date.now()
        return
      }
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      hpRef.current = Math.max(0, hpRef.current - DRAIN_PER_MS * delta)
      setHp(hpRef.current)

      if (hpRef.current <= 0 && !defeatedRef.current) {
        defeatedRef.current = true
        socket.emit('player-defeated')
      }
    }, TICK_MS)

    const emit = setInterval(() => {
      socket.emit('health-update', { hp: Math.round(hpRef.current) })
    }, EMIT_MS)

    return () => { clearInterval(drain); clearInterval(emit) }
  }, [active, socket])

  return { hp, opponentHp }
}
