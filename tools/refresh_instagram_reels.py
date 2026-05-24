from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LINKS_FILE = ROOT / "fe/src/features/scroll-reels/data/instagram-reel-links.txt"
OUTPUT_FILE = ROOT / "fe/src/features/scroll-reels/data/reels.ts"
DEFAULT_ENDPOINT = (
    "https://instasnapdown.lovable.app/_serverFn/"
    "e80308a7168d2e2e92209932c93600c1d823bcbd8779b0ef75c15b9a4e8dc376"
)


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


def server_fn_payload(url: str) -> bytes:
    payload = {
        "t": {
            "t": 10,
            "i": 0,
            "p": {
                "k": ["data"],
                "v": [
                    {
                        "t": 10,
                        "i": 1,
                        "p": {"k": ["url"], "v": [{"t": 1, "s": url}]},
                        "o": 0,
                    }
                ],
            },
            "o": 0,
        },
        "f": 63,
        "m": [],
    }
    return json.dumps(payload).encode()


def decode_tagged(value: Any) -> Any:
    if isinstance(value, list):
        return [decode_tagged(item) for item in value]
    if not isinstance(value, dict):
        return value

    payload = value.get("p")
    if isinstance(payload, dict) and "k" in payload and "v" in payload:
        return {
            key: decode_tagged(payload["v"][index])
            for index, key in enumerate(payload["k"])
            if index < len(payload["v"])
        }

    if "a" in value and isinstance(value["a"], list):
        return [decode_tagged(item) for item in value["a"]]

    if "s" in value:
        return value["s"]

    return {key: decode_tagged(item) for key, item in value.items()}


def fetch_record(url: str, fallback: ReelRecord | None) -> ReelRecord:
    endpoint = os.environ.get("INSTASNAPDOWN_ENDPOINT", DEFAULT_ENDPOINT)
    request = urllib.request.Request(
        endpoint,
        data=server_fn_payload(url),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://instasnapdown.lovable.app",
            "Referer": "https://instasnapdown.lovable.app/",
            "User-Agent": "Mozilla/5.0",
            "x-tsr-serverfn": "true",
        },
        method="POST",
    )

    base = fallback or ReelRecord(
        id=reel_id(url),
        title="Curate slot",
        creator="@replace-this",
        instagram_url=canonical_url(url),
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            decoded = decode_tagged(json.loads(response.read().decode()))
    except Exception as error:
        base.error = str(error)
        return base

    media = decoded.get("result", {}).get("media", []) if isinstance(decoded, dict) else []
    video = next((item for item in media if item.get("type") == "video" and item.get("url")), None)
    if not video:
        base.error = "No video media returned"
        return base

    base.video_src = video["url"]
    base.poster_src = video.get("thumbnail") or base.poster_src
    base.error = None
    return base


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


def main() -> int:
    links = read_links()
    if not links:
        print(f"No reel links found in {LINKS_FILE}")
        return 1

    existing = existing_records()
    results: dict[str, ReelRecord] = {}
    max_workers = min(8, len(links))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(fetch_record, url, existing.get(shortcode_for(url))): url
            for url in links
        }
        for future in as_completed(futures):
            url = futures[future]
            record = future.result()
            results[shortcode_for(url)] = record
            status = "updated" if record.video_src and not record.error else f"kept fallback ({record.error})"
            print(f"{shortcode_for(url)}: {status}")

    ordered = [results[shortcode_for(url)] for url in links]
    write_reels(ordered)

    failures = [record for record in ordered if record.error]
    if failures:
        print(f"Completed with {len(failures)} unresolved reel(s).")
        return 1

    print(f"Wrote {len(ordered)} reel(s) to {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
