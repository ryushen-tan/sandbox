import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpRight, Pause, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ReelItem } from "../types"

type ScrollReelsProps = {
  items: ReelItem[]
}

export function ScrollReels({ items }: ScrollReelsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const reelRefs = useRef<Array<HTMLElement | null>>([])
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])

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
    if (!isPlaying || !activeItem || activeItem.videoSrc) return

    const timeout = window.setTimeout(() => {
      scrollToIndex(activeIndex + 1)
    }, activeItem.durationMs ?? 12000)

    return () => window.clearTimeout(timeout)
  }, [activeIndex, activeItem, isPlaying, scrollToIndex])

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return

      if (index === activeIndex && isPlaying) {
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    })
  }, [activeIndex, isPlaying])

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
                  autoPlay={isPlaying && index === activeIndex}
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

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-5 pt-28">
                <p className="text-sm font-medium text-orange-200">{item.creator}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">{item.title}</h2>
                <p className="mt-2 max-w-xs text-sm leading-5 text-stone-300">
                  Keep the Instagram URL for attribution/opening, and use a direct MP4/CDN URL for playback.
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <aside className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/55 p-2 shadow-2xl backdrop-blur">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="rounded-full"
          onClick={() => setIsPlaying((value) => !value)}
          aria-label={isPlaying ? "Pause auto-scroll" : "Resume auto-scroll"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </Button>
        <Button type="button" variant="secondary" className="rounded-full" onClick={() => scrollToIndex(activeIndex + 1)}>
          Next reel
        </Button>
        <Button type="button" variant="ghost" className="rounded-full text-stone-100 hover:text-stone-950" asChild>
          <a href={activeItem.instagramUrl} target="_blank" rel="noreferrer">
            Open <ArrowUpRight />
          </a>
        </Button>
      </aside>
    </main>
  )
}
