from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LINKS_FILE = ROOT / "fe/src/features/scroll-reels/data/instagram-reel-links.txt"
OUTPUT_FILE = ROOT / "fe/src/features/scroll-reels/data/reels.ts"
DEFAULT_ENDPOINT = "https://statusdownloader.com/api/fetch"


@dataclass
class ReelRecord:
    id: str
    title: str
    creator: str
    instagram_url: str
    video_src: str | None = None
    poster_src: str | None = None
    error: str | None = None


def shortcode_for(url: str) -> str:
    match = re.search(r"instagram\.com/(?:reel|reels|p|tv)/([^/?#]+)/?", url)
    if not match:
        raise ValueError(f"Not an Instagram media URL: {url}")
    return match.group(1)


def canonical_url(url: str) -> str:
    return f"https://www.instagram.com/reel/{shortcode_for(url)}/"


def reel_id(url: str) -> str:
    shortcode = shortcode_for(url).lower()
    return re.sub(r"[^a-z0-9]+", "-", shortcode).strip("-")


def read_links() -> list[str]:
    links: list[str] = []
    seen: set[str] = set()

    for raw_line in LINKS_FILE.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        url = canonical_url(line)
        key = shortcode_for(url)
        if key not in seen:
            links.append(url)
            seen.add(key)

    return links


def extract_field(block: str, field: str) -> str | None:
    match = re.search(rf'{field}:\s*"([^"]+)"', block)
    return match.group(1) if match else None


def existing_records() -> dict[str, ReelRecord]:
    if not OUTPUT_FILE.exists():
        return {}

    records: dict[str, ReelRecord] = {}
    content = OUTPUT_FILE.read_text()
    for block in re.findall(r"\{[^{}]*instagramUrl:\s*\"[^\"]+\"[^{}]*\}", content, re.S):
        instagram_url = extract_field(block, "instagramUrl")
        if not instagram_url:
            continue

        key = shortcode_for(instagram_url)
        if key in records:
            continue

        title = extract_field(block, "title") or "Curate slot"
        if re.fullmatch(r"Curate slot \d{2}", title):
            title = "Curate slot"

        records[key] = ReelRecord(
            id=reel_id(instagram_url),
            title=title,
            creator=extract_field(block, "creator") or "@replace-this",
            instagram_url=canonical_url(instagram_url),
            video_src=extract_field(block, "videoSrc"),
            poster_src=extract_field(block, "posterSrc"),
        )

    return records


def request_payload(url: str) -> str:
    return json.dumps({"url": url}, separators=(",", ":"))


def is_image_url(url: str | None) -> bool:
    if not url:
        return False
    return any(extension in url.lower() for extension in [".jpg", ".jpeg", ".png", ".webp"])


def parse_response(payload: dict[str, Any], record: ReelRecord) -> ReelRecord:
    if not payload.get("success"):
        record.error = str(payload.get("error") or payload.get("message") or payload)
        return record

    media_url = payload.get("mediaUrl")
    if not isinstance(media_url, str) or not media_url:
        record.error = f"No mediaUrl returned: {json.dumps(payload)[:300]}"
        return record

    media_type = payload.get("mediaType")
    if media_type and media_type != "video":
        record.error = f"Unsupported mediaType: {media_type}"
        return record

    title = payload.get("title")
    if isinstance(title, str) and title and record.title == "Curate slot":
        record.title = title

    thumbnail_url = payload.get("thumbnailUrl")
    if is_image_url(thumbnail_url):
        record.poster_src = thumbnail_url

    record.video_src = media_url
    record.error = None
    return record


def fetch_record(url: str, fallback: ReelRecord | None, endpoint: str) -> ReelRecord:
    record = fallback or ReelRecord(
        id=reel_id(url),
        title="Curate slot",
        creator="@replace-this",
        instagram_url=canonical_url(url),
    )

    try:
        completed = subprocess.run(
            [
                "curl",
                endpoint,
                "-sS",
                "-X",
                "POST",
                "-H",
                "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0",
                "-H",
                "Accept: */*",
                "-H",
                "Accept-Language: en-CA,en-US;q=0.9,en;q=0.8",
                "-H",
                "Referer: https://statusdownloader.com/instagram-story-downloader",
                "-H",
                "Content-Type: application/json",
                "-H",
                "Origin: https://statusdownloader.com",
                "-H",
                "Sec-Fetch-Dest: empty",
                "-H",
                "Sec-Fetch-Mode: cors",
                "-H",
                "Sec-Fetch-Site: same-origin",
                "--data-raw",
                request_payload(url),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=45,
        )
        stdout = completed.stdout.strip()
        if not stdout:
            record.error = "Empty response"
            return record

        return parse_response(json.loads(stdout), record)
    except Exception as error:
        record.error = str(error)
        return record


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_reels(records: list[ReelRecord]) -> None:
    lines = ['import type { ReelItem } from "../types"', "", "export const reels: ReelItem[] = ["]

    for index, record in enumerate(records, start=1):
        title = record.title if record.title != "Curate slot" else f"Curate slot {index:02d}"
        lines.extend(
            [
                "  {",
                f"    id: {ts_string(record.id)},",
                f"    title: {ts_string(title)},",
                f"    creator: {ts_string(record.creator)},",
                f"    instagramUrl: {ts_string(record.instagram_url)},",
            ]
        )
        if record.video_src:
            lines.append(f"    videoSrc: {ts_string(record.video_src)},")
        if record.poster_src:
            lines.append(f"    posterSrc: {ts_string(record.poster_src)},")
        if not record.video_src:
            lines.append("    durationMs: 12000,")
        lines.append("  },")

    lines.append("]")
    OUTPUT_FILE.write_text("\n".join(lines) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh Instagram reel MP4 URLs through StatusDownloader.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print statuses without writing reels.ts.")
    parser.add_argument("--limit", type=int, help="Only process the first N links.")
    parser.add_argument("--url", action="append", help="Process this URL instead of instagram-reel-links.txt.")
    parser.add_argument("--workers", type=int, default=4, help="Parallel worker count.")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    links = [canonical_url(url) for url in args.url] if args.url else read_links()
    if args.limit:
        links = links[: args.limit]

    if not links:
        print(f"No reel links found in {LINKS_FILE}")
        return 1

    existing = existing_records()
    results: dict[str, ReelRecord] = {}

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(fetch_record, url, existing.get(shortcode_for(url)), args.endpoint): url
            for url in links
        }
        for future in as_completed(futures):
            url = futures[future]
            record = future.result()
            results[shortcode_for(url)] = record
            status = "updated" if record.video_src and not record.error else f"kept fallback ({record.error})"
            print(f"{shortcode_for(url)}: {status}")

    ordered = [results[shortcode_for(url)] for url in links]
    failures = [record for record in ordered if record.error]

    if not args.dry_run:
        write_reels(ordered)

    if failures:
        print(f"Completed with {len(failures)} unresolved reel(s).")
        return 1

    if args.dry_run:
        print(f"Dry run fetched {len(ordered)} reel(s).")
    else:
        print(f"Wrote {len(ordered)} reel(s) to {OUTPUT_FILE}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
