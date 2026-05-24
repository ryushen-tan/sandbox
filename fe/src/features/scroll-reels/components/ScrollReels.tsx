import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ReelItem } from "../types"
import { useWebcam } from "../hooks/useWebcam"
import { useFaceAnalysis } from "../hooks/useFaceAnalysis"
import { useSmileSocket } from "../hooks/useSmileSocket"

type ScrollReelsProps = {
  items: ReelItem[]
}

type PlayableReelItem = ReelItem & {
  videoSrc: string
}

type FeedReelItem = PlayableReelItem & {
  feedId: string
}

const MIN_REEL_DURATION_MS = 3000
const REEL_DURATION_SPREAD_MS = 2000
const REEL_START_TIME_SECONDS = 3
const UP_NEXT_BUFFER_SIZE = 3

function getRandomReelDuration() {
  return MIN_REEL_DURATION_MS + Math.random() * REEL_DURATION_SPREAD_MS
}

function hasVideoSrc(item: ReelItem): item is PlayableReelItem {
  return Boolean(item.videoSrc)
}

function pickRandomItem(items: PlayableReelItem[], avoidItemId?: string) {
  if (items.length <= 1) return items[0]

  let item = items[Math.floor(Math.random() * items.length)]
  if (item.id === avoidItemId) {
    item = items[(items.findIndex((candidate) => candidate.id === item.id) + 1) % items.length]
  }

  return item
}

function createFeedItem(item: PlayableReelItem): FeedReelItem {
  return {
    ...item,
    feedId: `${item.id}-${crypto.randomUUID()}`,
  }
}

function appendRandomItems(feedItems: FeedReelItem[], sourceItems: PlayableReelItem[], count: number) {
  const nextFeedItems = [...feedItems]

  for (let index = 0; index < count; index += 1) {
    const previousItemId = nextFeedItems.at(-1)?.id
    const nextItem = pickRandomItem(sourceItems, previousItemId)
    if (!nextItem) break

    nextFeedItems.push(createFeedItem(nextItem))
  }

  return nextFeedItems
}

function createInitialFeed(items: PlayableReelItem[]) {
  return appendRandomItems([], items, UP_NEXT_BUFFER_SIZE + 1)
}

function ensureFeedBuffer(feedItems: FeedReelItem[], activeIndex: number, sourceItems: PlayableReelItem[]) {
  const remainingItems = feedItems.length - activeIndex - 1
  const missingItems = UP_NEXT_BUFFER_SIZE - remainingItems

  if (missingItems <= 0) return feedItems

  return appendRandomItems(feedItems, sourceItems, missingItems)
}

export function ScrollReels({ items }: ScrollReelsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [failedItemIds, setFailedItemIds] = useState<Set<string>>(() => new Set())
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [feedItems, setFeedItems] = useState<FeedReelItem[]>(() => createInitialFeed(items.filter(hasVideoSrc)))
  const reelRefs = useRef<Array<HTMLElement | null>>([])
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const webcamRef = useRef<HTMLVideoElement>(null)
  const { isReady } = useWebcam(webcamRef)
  const { smileDetected, faceDetected, isLoading } = useFaceAnalysis(webcamRef, isReady)
  useSmileSocket(smileDetected)

  const playableSourceItems = useMemo(
    () => items.filter(hasVideoSrc).filter((item) => !failedItemIds.has(item.id)),
    [failedItemIds, items]
  )
  const activeItem = feedItems[activeIndex]
  const progressSegments = useMemo(
    () =>
      feedItems
        .slice(activeIndex, activeIndex + UP_NEXT_BUFFER_SIZE + 1)
        .map((item, index) => ({ id: item.feedId, isActive: index === 0 })),
    [activeIndex, feedItems]
  )

  const scrollToIndex = useCallback((index: number) => {
    setFeedItems((currentItems) => ensureFeedBuffer(currentItems, index, playableSourceItems))
    setActiveIndex(index)
  }, [playableSourceItems])

  const scrollToNext = useCallback(() => {
    scrollToIndex(activeIndex + 1)
  }, [activeIndex, scrollToIndex])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const focusedEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (!focusedEntry) return

        const index = Number((focusedEntry.target as HTMLElement).dataset.reelIndex)
        if (Number.isFinite(index)) {
          setActiveIndex(index)
          setFeedItems((currentItems) => ensureFeedBuffer(currentItems, index, playableSourceItems))
        }
      },
      { threshold: [0.65, 0.8, 0.95] }
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
    reelRefs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "start" })
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,122,41,0.22),transparent_30%),radial-gradient(circle_at_90%_70%,rgba(226,36,91,0.22),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-stone-400">Experimental</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Scroll Reels</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="pointer-events-auto rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-stone-200 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            PvP
          </a>
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
        </div>
      </header>

      <div className="relative z-10 h-svh snap-y snap-mandatory overflow-y-auto scroll-smooth">
        {feedItems.map((item, index) => (
          <section
            key={item.feedId}
            ref={(node) => {
              reelRefs.current[index] = node
            }}
            data-reel-index={index}
            className="grid h-svh snap-start place-items-center px-4 py-20"
          >
            <div className="relative aspect-[9/16] h-[min(78svh,780px)] overflow-hidden rounded-[2rem] border border-white/15 bg-black shadow-2xl shadow-orange-950/30">
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

      {/* Camera PiP — bottom right */}
      <div className="absolute bottom-5 right-5 z-30 h-72 w-48 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/70">
        <video
          ref={webcamRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover scale-x-[-1]"
        />
      </div>
    </main>
  )
}
