import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ReelItem } from "../types"
import { useWebcam } from "../hooks/useWebcam"

type ScrollReelsProps = {
  items: ReelItem[]
}

const MIN_REEL_DURATION_MS = 3000
const REEL_DURATION_SPREAD_MS = 2000

function getRandomReelDuration() {
  return MIN_REEL_DURATION_MS + Math.random() * REEL_DURATION_SPREAD_MS
}

export function ScrollReels({ items }: ScrollReelsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const reelRefs = useRef<Array<HTMLElement | null>>([])
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const webcamRef = useRef<HTMLVideoElement>(null)
  useWebcam(webcamRef)

  const activeItem = items[activeIndex]
  const progressSegments = useMemo(
    () => items.map((item, index) => ({ id: item.id, isActive: index === activeIndex })),
    [activeIndex, items]
  )

  const scrollToIndex = useCallback((index: number) => {
    const nextIndex = (index + items.length) % items.length
    reelRefs.current[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "start" })
    setActiveIndex(nextIndex)
  }, [items.length])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const focusedEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (!focusedEntry) return

        const index = Number((focusedEntry.target as HTMLElement).dataset.reelIndex)
        if (Number.isFinite(index)) setActiveIndex(index)
      },
      { threshold: [0.65, 0.8, 0.95] }
    )

    reelRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [items])

  useEffect(() => {
    if (!activeItem) return

    const timeout = window.setTimeout(() => {
      scrollToIndex(activeIndex + 1)
    }, getRandomReelDuration())

    return () => window.clearTimeout(timeout)
  }, [activeIndex, activeItem, scrollToIndex])

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return

      if (index === activeIndex) {
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    })
  }, [activeIndex])

  if (!items.length) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-zinc-950 text-zinc-100">
        No reels configured.
      </main>
    )
  }

  return (
    <main className="relative h-svh overflow-hidden bg-[#080806] text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,122,41,0.22),transparent_30%),radial-gradient(circle_at_90%_70%,rgba(226,36,91,0.22),transparent_28%)]" />
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

      <div className="relative z-10 h-svh snap-y snap-mandatory overflow-y-auto scroll-smooth">
        {items.map((item, index) => (
          <section
            key={item.id}
            ref={(node) => {
              reelRefs.current[index] = node
            }}
            data-reel-index={index}
            className="grid h-svh snap-start place-items-center px-4 py-20"
          >
            <div className="relative aspect-[9/16] h-[min(78svh,780px)] overflow-hidden rounded-[2rem] border border-white/15 bg-black shadow-2xl shadow-orange-950/30">
              {item.videoSrc ? (
                <video
                  key={item.id}
                  ref={(node) => {
                    videoRefs.current[index] = node
                  }}
                  className="h-full w-full object-cover"
                  src={item.videoSrc}
                  poster={item.posterSrc}
                  autoPlay={index === activeIndex}
                  muted
                  playsInline
                  controls={false}
                  preload={index === activeIndex ? "auto" : "metadata"}
                  onEnded={() => scrollToIndex(index + 1)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.18),transparent_45%)] p-8 text-center">
                  <p className="text-xs uppercase tracking-[0.45em] text-orange-200">Needs MP4</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">Instagram blocks embeds here.</p>
                  <p className="mt-3 text-sm leading-6 text-stone-300">
                    Add a direct <code className="rounded bg-white/10 px-1.5 py-0.5">videoSrc</code> MP4 URL for native
                    autoplay and end-of-video scrolling.
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <aside className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-5 py-2 text-sm text-stone-300 shadow-2xl backdrop-blur">
        empty bar
      </aside>

      {/* Camera PiP — bottom right */}
      <div className="absolute bottom-5 right-5 z-30 h-36 w-24 overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/60">
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
