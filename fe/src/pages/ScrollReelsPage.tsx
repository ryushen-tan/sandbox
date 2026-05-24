import { ScrollReels } from "@/features/scroll-reels/components/ScrollReels"
import { reels } from "@/features/scroll-reels/data/reels"

export function ScrollReelsPage() {
  return <ScrollReels items={reels} />
}
