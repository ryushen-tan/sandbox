import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Socket } from "socket.io-client"

import type { ReelItem } from "../types"
import { useFaceAnalysis } from "../hooks/useFaceAnalysis"
import { useSmileSocket } from "../hooks/useSmileSocket"
import { useWebcam } from "../../battle/hooks/useWebcam"
import { useWebRTC } from "../../battle/hooks/useWebRTC"
import { useHealthBar } from "../../battle/hooks/useHealthBar"
import { HealthBar } from "../../battle/components/HealthBar"
import { EndScreen } from "../../battle/components/EndScreen"
import { getSocket } from "../../battle/socket"

export type BattleProps = {
  socket: Socket
  isHost: boolean
  isEnded: boolean
  won: boolean
  onLeave: () => void
}

type ScrollReelsProps = {
  items: ReelItem[]
  battle?: BattleProps
}

type PlayableReelItem = ReelItem & {
  videoSrc: string
}

type FeedReelItem = PlayableReelItem & {
  feedId: string
}

type FeedState = {
  feedItems: FeedReelItem[]
  remainingItems: PlayableReelItem[]
}

const MIN_REEL_DURATION_MS = 5000
const REEL_DURATION_SPREAD_MS = 2000
const REEL_START_TIME_SECONDS = 1
const UP_NEXT_BUFFER_SIZE = 3

function getRandomReelDuration() {
  return MIN_REEL_DURATION_MS + Math.random() * REEL_DURATION_SPREAD_MS
}

function hasVideoSrc(item: ReelItem): item is PlayableReelItem {
  return Boolean(item.videoSrc)
}

function shuffleItems(items: PlayableReelItem[], avoidFirstItemId?: string) {
  const shuffledItems = [...items]

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledItems[index], shuffledItems[randomIndex]] = [shuffledItems[randomIndex], shuffledItems[index]]
  }

  if (shuffledItems.length > 1 && shuffledItems[0]?.id === avoidFirstItemId) {
    ;[shuffledItems[0], shuffledItems[1]] = [shuffledItems[1], shuffledItems[0]]
  }

  return shuffledItems
}

function createFeedItem(item: PlayableReelItem): FeedReelItem {
  return {
    ...item,
    feedId: `${item.id}-${crypto.randomUUID()}`,
  }
}

function appendNonRepeatingItems(
  feedItems: FeedReelItem[],
  sourceItems: PlayableReelItem[],
  remainingItems: PlayableReelItem[],
  count: number
): FeedState {
  const nextFeedItems = [...feedItems]
  let nextRemainingItems = remainingItems.filter((item) => sourceItems.some((sourceItem) => sourceItem.id === item.id))

  for (let index = 0; index < count; index += 1) {
    const previousItemId = nextFeedItems.at(-1)?.id
    if (!nextRemainingItems.length) {
      nextRemainingItems = shuffleItems(sourceItems, previousItemId)
    }

    const nextItem = nextRemainingItems.shift()
    if (!nextItem) break

    nextFeedItems.push(createFeedItem(nextItem))
  }

  return {
    feedItems: nextFeedItems,
    remainingItems: nextRemainingItems,
  }
}

function createInitialFeedState(items: PlayableReelItem[]): FeedState {
  return appendNonRepeatingItems([], items, shuffleItems(items), UP_NEXT_BUFFER_SIZE + 1)
}

function ensureFeedBuffer(
  feedItems: FeedReelItem[],
  activeIndex: number,
  sourceItems: PlayableReelItem[],
  remainingItems: PlayableReelItem[]
): FeedState {
  const upcomingItems = feedItems.length - activeIndex - 1
  const missingItems = UP_NEXT_BUFFER_SIZE - upcomingItems

  if (missingItems <= 0) {
    return {
      feedItems,
      remainingItems,
    }
  }

  return appendNonRepeatingItems(feedItems, sourceItems, remainingItems, missingItems)
}

export function ScrollReels({ items, battle }: ScrollReelsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [failedItemIds, setFailedItemIds] = useState<Set<string>>(() => new Set())
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [feedState, setFeedState] = useState<FeedState>(() => createInitialFeedState(items.filter(hasVideoSrc)))
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const programmaticTargetIndexRef = useRef<number | null>(null)
  const reelRefs = useRef<Array<HTMLElement | null>>([])
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const webcamRef = useRef<HTMLVideoElement>(null)
  const oppVideoRef = useRef<HTMLVideoElement>(null)

  const { isReady, stream } = useWebcam(webcamRef)
  const { smileDetected, faceDetected, isLoading } = useFaceAnalysis(webcamRef, isReady)
  useSmileSocket(smileDetected)

  // Battle hooks — always called, only active when battle is present and ongoing
  const fallbackSocket = useRef(getSocket()).current
  const battleSocket = battle?.socket ?? fallbackSocket
  const battleActive = !!battle && !battle.isEnded
  const isHost = battle?.isHost ?? false

  const { remoteStream } = useWebRTC(battleSocket, isHost, battleActive, stream)
  const { hp, opponentHp } = useHealthBar(battleSocket, smileDetected, battleActive)

  useEffect(() => {
    if (oppVideoRef.current && remoteStream) {
      oppVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const [finalHp, setFinalHp] = useState({ mine: 100, opponent: 100 })
  useEffect(() => {
    if (battleActive) {
      setFinalHp({ mine: hp, opponent: opponentHp })
    }
  }, [hp, opponentHp, battleActive])

  const playableSourceItems = useMemo(
    () => items.filter(hasVideoSrc).filter((item) => !failedItemIds.has(item.id)),
    [failedItemIds, items]
  )
  const feedItems = feedState.feedItems
  const activeItem = feedItems[activeIndex]
  const progressSegments = useMemo(
    () =>
      feedItems
        .slice(activeIndex, activeIndex + UP_NEXT_BUFFER_SIZE + 1)
        .map((item, index) => ({ id: item.feedId, isActive: index === 0 })),
    [activeIndex, feedItems]
  )

  const scrollToIndex = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, index)

      setFeedState((currentState) =>
        ensureFeedBuffer(
          currentState.feedItems,
          nextIndex,
          playableSourceItems,
          currentState.remainingItems
        )
      )
      programmaticTargetIndexRef.current = nextIndex
      setActiveIndex(nextIndex)
    },
    [playableSourceItems]
  )

  const scrollToNext = useCallback(() => {
    scrollToIndex(activeIndex + 1)
  }, [activeIndex, scrollToIndex])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        const focusedEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (!focusedEntry) return

        const index = Number((focusedEntry.target as HTMLElement).dataset.reelIndex)
        if (Number.isFinite(index)) {
          const programmaticTargetIndex = programmaticTargetIndexRef.current
          if (programmaticTargetIndex !== null && index !== programmaticTargetIndex) return

          if (programmaticTargetIndex === index) {
            programmaticTargetIndexRef.current = null
          }

          setActiveIndex((currentIndex) => (currentIndex === index ? currentIndex : index))
          setFeedState((currentState) =>
            ensureFeedBuffer(
              currentState.feedItems,
              index,
              playableSourceItems,
              currentState.remainingItems
            )
          )
        }
      },
      { root: scrollContainer, threshold: [0.65, 0.8, 0.95] }
    )

    reelRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [feedItems, playableSourceItems])

  useEffect(() => {
    if (!activeItem) return

    const timeout = window.setTimeout(() => {
      scrollToNext()
    }, getRandomReelDuration())

    return () => window.clearTimeout(timeout)
  }, [activeItem, scrollToNext])

  useEffect(() => {
    const targetReel = reelRefs.current[activeIndex]
    const scrollContainer = scrollContainerRef.current
    if (!targetReel || !scrollContainer) return

    scrollContainer.scrollTo({ top: targetReel.offsetTop, behavior: "smooth" })
  }, [activeIndex, feedItems.length])

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return

      if (index === activeIndex) {
        video.muted = !isAudioEnabled

        if (video.readyState > 0 && video.currentTime < REEL_START_TIME_SECONDS) {
          video.currentTime = REEL_START_TIME_SECONDS
        }

        void video.play().catch(() => {
          video.muted = true
          setIsAudioEnabled(false)
          void video.play().catch(() => undefined)
        })
      } else {
        video.pause()
      }
    })
  }, [activeIndex, isAudioEnabled])

  useEffect(() => {
    for (let index = activeIndex + 1; index <= activeIndex + UP_NEXT_BUFFER_SIZE; index += 1) {
      videoRefs.current[index]?.load()
    }
  }, [activeIndex, feedItems])

  const enableAudio = useCallback(() => {
    setIsAudioEnabled(true)

    const activeVideo = videoRefs.current[activeIndex]
    if (!activeVideo) return

    activeVideo.muted = false
    void activeVideo.play().catch(() => undefined)
  }, [activeIndex])

  if (!feedItems.length) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-zinc-950 text-zinc-100">
        No playable reels configured.
      </main>
    )
  }

  return (
    <main className="relative h-svh overflow-hidden bg-[#080806] text-stone-50" onClick={enableAudio}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-stone-400">Experimental</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Scroll Reels</h1>
        </div>
        <div className="flex gap-1.5">
          {progressSegments.map((segment) => (
            <span
              key={segment.id}
              className={`h-1.5 rounded-full transition-all ${
                segment.isActive ? "w-10 bg-stone-50" : "w-3 bg-stone-50/30"
              }`}
            />
          ))}
        </div>
      </header>

      <div ref={scrollContainerRef} className="relative z-10 h-svh snap-y snap-mandatory overflow-y-auto scroll-smooth">
        {feedItems.map((item, index) => (
          <section
            key={item.feedId}
            ref={(node) => {
              reelRefs.current[index] = node
            }}
            data-reel-index={index}
            className="grid h-svh snap-start place-items-center px-4 py-20"
          >
            <div className="relative aspect-[9/16] h-[min(78svh,780px)] overflow-hidden rounded-[2rem] border border-white/15 bg-black shadow-2xl shadow-black/50">
              <video
                key={item.id}
                ref={(node) => {
                  videoRefs.current[index] = node
                }}
                className="h-full w-full object-cover"
                src={item.videoSrc}
                poster={item.posterSrc}
                autoPlay={index === activeIndex}
                muted={!isAudioEnabled}
                playsInline
                controls={false}
                preload={index >= activeIndex && index <= activeIndex + UP_NEXT_BUFFER_SIZE ? "auto" : "metadata"}
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget
                  if (index === activeIndex && video.currentTime < REEL_START_TIME_SECONDS) {
                    video.currentTime = REEL_START_TIME_SECONDS
                  }
                }}
                onEnded={scrollToNext}
                onError={() => {
                  setFailedItemIds((current) => new Set(current).add(item.id))
                  scrollToNext()
                }}
              />
            </div>
          </section>
        ))}
      </div>

      {/* Health bars — only during active battle */}
      {battleActive && (
        <>
          <HealthBar hp={opponentHp} label="OPP" side="left" />
          <HealthBar hp={hp} label="YOU" side="right" />
        </>
      )}

      {/* Status bar */}
      <aside className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2.5 rounded-full border border-white/10 bg-black/60 px-5 py-2.5 shadow-2xl backdrop-blur-md transition-all duration-300">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${
            isLoading || !faceDetected
              ? 'bg-stone-500'
              : smileDetected
              ? 'bg-red-400 shadow-sm shadow-red-400/60'
              : 'bg-emerald-400 shadow-sm shadow-emerald-400/60'
          }`}
        />
        <span className="text-sm font-medium text-stone-300">
          {isLoading
            ? 'Initializing…'
            : !faceDetected
            ? 'No face detected'
            : smileDetected
            ? 'Smile detected'
            : 'Straight face'}
        </span>
      </aside>

      {/* Opponent camera PiP — bottom left (battle only) */}
      {battle && (
        <div className="absolute bottom-5 left-5 z-30 h-72 w-48 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/70">
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
      )}

      {/* My camera PiP — bottom right */}
      <div className="absolute bottom-5 right-5 z-30 h-72 w-48 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/70">
        <video
          ref={webcamRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover scale-x-[-1]"
        />
        {battle && (
          <div className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-stone-400 backdrop-blur">
            You
          </div>
        )}
      </div>

      {/* End screen overlay */}
      {battle?.isEnded && (
        <EndScreen
          won={battle.won}
          myHp={finalHp.mine}
          opponentHp={finalHp.opponent}
          onPlayAgain={battle.onLeave}
          onLeave={battle.onLeave}
        />
      )}
    </main>
  )
}
