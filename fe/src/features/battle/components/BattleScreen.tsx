import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { reels } from '../../scroll-reels/data/reels'
import { useFaceAnalysis } from '../../scroll-reels/hooks/useFaceAnalysis'
import { useWebcam } from '../hooks/useWebcam'
import { useWebRTC } from '../hooks/useWebRTC'
import { useHealthBar } from '../hooks/useHealthBar'
import { HealthBar } from './HealthBar'
import { EndScreen } from './EndScreen'

interface BattleScreenProps {
  socket: Socket
  isHost: boolean
  onEnd: (won: boolean) => void
  finalHp: { mine: number; opponent: number }
  onFinalHpChange: (hp: { mine: number; opponent: number }) => void
}

const MIN_DURATION = 3500
const SPREAD = 2000

export function BattleScreen({ socket, isHost, onEnd, finalHp, onFinalHpChange }: BattleScreenProps) {
  // ── Reels ────────────────────────────────────────────────────────────────
  const [reelIndex, setReelIndex] = useState(0)
  const reelVideoRef = useRef<HTMLVideoElement>(null)
  const reel = reels[reelIndex % reels.length]

  useEffect(() => {
    const t = setTimeout(
      () => setReelIndex((i) => i + 1),
      MIN_DURATION + Math.random() * SPREAD,
    )
    return () => clearTimeout(t)
  }, [reelIndex])

  // ── Camera + face analysis ───────────────────────────────────────────────
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const oppVideoRef = useRef<HTMLVideoElement>(null)
  const { isReady, stream } = useWebcam(myVideoRef)
  const { smileDetected, faceDetected, isLoading } = useFaceAnalysis(myVideoRef, isReady)

  // ── WebRTC (opponent video) ──────────────────────────────────────────────
  const { remoteStream } = useWebRTC(socket, isHost, true, stream)

  useEffect(() => {
    if (oppVideoRef.current && remoteStream) {
      oppVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // ── Health ───────────────────────────────────────────────────────────────
  const { hp, opponentHp } = useHealthBar(socket, smileDetected, true)

  // Keep parent in sync so EndScreen has the final values
  useEffect(() => {
    onFinalHpChange({ mine: hp, opponent: opponentHp })
  }, [hp, opponentHp, onFinalHpChange])

  // ── End screen ───────────────────────────────────────────────────────────
  const [ended, setEnded] = useState(false)
  const [won, setWon] = useState(false)

  useEffect(() => {
    socket.on('match-ended', ({ won: w }: { won: boolean }) => {
      setWon(w)
      setEnded(true)
      onEnd(w)
    })
    return () => { socket.off('match-ended') }
  }, [socket, onEnd])

  const handlePlayAgain = useCallback(() => {
    window.location.reload()
  }, [])

  const handleLeave = useCallback(() => {
    window.location.href = '/'
  }, [])

  // ── Status label ─────────────────────────────────────────────────────────
  const statusText = isLoading
    ? 'Initializing…'
    : !faceDetected
    ? 'No face detected'
    : smileDetected
    ? '😄 Smile detected — draining!'
    : 'Straight face'

  const dotColor = isLoading || !faceDetected
    ? 'bg-stone-500'
    : smileDetected
    ? 'bg-red-400 shadow-sm shadow-red-400/60'
    : 'bg-emerald-400 shadow-sm shadow-emerald-400/60'

  return (
    <main className="relative h-svh overflow-hidden bg-[#080806] text-stone-50">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,122,41,0.22),transparent_30%),radial-gradient(circle_at_90%_70%,rgba(226,36,91,0.22),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />

      {/* Reel video — full screen background */}
      <div className="absolute inset-0 z-0">
        {reel?.videoSrc ? (
          <video
            key={reel.id}
            ref={reelVideoRef}
            src={reel.videoSrc}
            poster={reel.posterSrc}
            autoPlay
            muted
            playsInline
            loop
            className="h-full w-full object-cover opacity-60"
            onEnded={() => setReelIndex((i) => i + 1)}
          />
        ) : (
          <div className="h-full w-full bg-stone-900" />
        )}
        {/* darken for readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Health bars */}
      <HealthBar hp={opponentHp} label="OPP" side="left" />
      <HealthBar hp={hp} label="YOU" side="right" />

      {/* Opponent PiP — bottom left */}
      <div className="absolute bottom-20 left-3 z-30 h-52 w-36 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/70">
        <video
          ref={oppVideoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover scale-x-[-1]"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-xs text-stone-500">Connecting…</span>
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-stone-400 backdrop-blur">
          Opponent
        </div>
      </div>

      {/* My PiP — bottom right */}
      <div className="absolute bottom-20 right-3 z-30 h-52 w-36 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/70">
        <video
          ref={myVideoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover scale-x-[-1]"
        />
        <div className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-stone-400 backdrop-blur">
          You
        </div>
      </div>

      {/* Status bar — bottom center */}
      <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 flex items-center gap-2.5 rounded-full border border-white/10 bg-black/60 px-5 py-2.5 shadow-2xl backdrop-blur-md">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${dotColor}`} />
        <span className="text-sm font-medium text-stone-300">{statusText}</span>
      </div>

      {/* End screen overlay */}
      {ended && (
        <EndScreen
          won={won}
          myHp={finalHp.mine}
          opponentHp={finalHp.opponent}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
        />
      )}
    </main>
  )
}
