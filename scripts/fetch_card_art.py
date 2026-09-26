#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "beautifulsoup4",
#     "curl-cffi",
#     "numpy",
#     "pillow",
# ]
# ///
"""
Card art upgrader: replaces scans in assets/card-art/bundles/cards/ with better
copies from Hall of Heroes (hallofheroeslcg.com).

Two commands:

  audit   Score every local scan for the Fantasy Flight Games diamond watermark
          (the "FF stamp" on the preview images some sets were first scanned
          from) and list the stamped ones. Offline.

  fetch   Scrape the Hall of Heroes page of each pack, match every card image on
          it to a card code, and replace the local scan when the download is an
          improvement: unstamped, the same orientation and shape, and either
          larger or replacing a stamped scan. Packs with stamped scans go first.

A replacement keeps the local file's name and format, since card records point
at that exact path (`/bundles/cards/<code>.png` or `.jpg`). Each replacement is
recorded in assets/card-art/hall-of-heroes-manifest.tsv.

  uv run scripts/fetch_card_art.py audit
  uv run scripts/fetch_card_art.py fetch --stamped-only
  uv run scripts/fetch_card_art.py fetch --packs mts sm --dry-run
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse

import numpy as np
from bs4 import BeautifulSoup
from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = REPO_ROOT / "assets" / "card-art" / "bundles" / "cards"
MANIFEST = REPO_ROOT / "assets" / "card-art" / "hall-of-heroes-manifest.tsv"
RAW_DIR = REPO_ROOT / "packages" / "content" / "raw" / "marvelcdb"
TEMPLATE_DIR = Path(__file__).resolve().parent / "card-art"

HOH = "https://hallofheroeslcg.com"

# Each pack's Hall of Heroes page (the ones packages/content/src/data/*/packs.ts and the manifest already cite). A box
# page links its encounter-card page ("<slug>-encounters-and-mods"), which is followed automatically. Packs missing
# here are looked up by name on the /browse/ index.
PACK_PAGES: dict[str, str] = {
    "angel": "angel-warren-worthington-iii",
    "ant": "ant-man",
    "aoa": "the-age-of-apocalypse",
    "aos": "agents-of-shield",
    "bkw": "natasha-romanoff-black-widow",
    "bp": "black-panther-shuri",
    "cap": "captain-america",
    "core": "core-set-2",
    "cw": "civil-war",
    "cyclops": "scott-summers-cyclops",
    "deadpool": "deadpool",
    "drax": "drax-2",
    "drs": "stephen-strange-doctor-strange",
    "falcon": "falcon-sam-wilson",
    "fne": "fear-no-evil",
    "gam": "gamora",
    "gambit": "gambit-remy-lebeau",
    "gmw": "galaxys-most-wanted",
    "gob": "green-goblin",
    "hlk": "bruce-banner-hulk",
    "hood": "the-hood",
    "iceman": "iceman-bobby-drake",
    "ironheart": "ironheart-riri-williams",
    "jj": "jessica-jones",
    "jubilee": "jubilee-jubilation-lee",
    "luke_cage": "luke-cage",
    "magneto": "magneto-erik-lehnsherr",
    "mojo": "mojo-mania",
    "msm": "ms-marvel",
    "mts": "the-mad-titans-shadow",
    "ncrawler": "nightcrawler-kurt-wagner",
    "nebu": "nebula",
    "next_evol": "next-evolution",
    "nova": "sam-alexander-nova",
    "psylocke": "psylocke-betsy-braddock",
    "qsv": "quicksilver",
    "rogue": "rogue-anna-marie",
    "ron": "ronan-the-accuser",
    "scw": "scarlet-witch",
    "silk": "silk-cindy-moon",
    "sm": "sinister-motives",
    "spdr": "peni-parker-sp-dr",
    "spiderham": "spider-ham-peter-porker",
    "stld": "peter-quill-star-lord",
    "storm": "ororo-munroe-storm",
    "synthezoid": "synthezoid-smackdown",
    "thor": "thor",
    "toafk": "the-once-and-future-kang",
    "trors": "the-rise-of-red-skull",
    "tt": "trickster-takeover",
    "twc": "wrecking-crew",
    "valk": "brunnhilde-valkyrie",
    "vision": "vision",
    "vnm": "venom",
    "warm": "war-machine",
    "winter": "winter-soldier-bucky-barnes",
    "wolv": "logan-wolverine",
    "wonder_man": "simon-williams-wonder-man",
    "wsp": "wasp",
    "x23": "x-23-laura-kinney",
}

# Watermark detection. The templates are the FFG diamond as it sits on a stamped scan, isolated by averaging the
# high-pass detail of every stamped Mad Titan's Shadow scan and subtracting the same average over clean scans of the
# same layout. A scan's score is its normalized correlation with the template inside the diamond. Stamped scans score
# 0.26-0.50 (all 177 MTS scans, 2026-09-26), clean ones 0.18 or less.
DETECT_SIZE = (365, 522)  # portrait (w, h); landscape is the transpose
STAMP_THRESHOLD = 0.22

# A download counts as larger when its long edge beats the local scan's by this factor.
UPGRADE_FACTOR = 1.05
# Replacements are scaled down to this long edge; the best local scans are ~1045px.
MAX_EDGE = 1100


# --------------------------------------------------------------------------- local card data


@dataclass(frozen=True)
class Card:
    code: str
    pack: str
    name: str


def load_cards() -> dict[str, Card]:
    """Every card record in the raw MarvelCDB cache, linked faces included, by code."""
    cards: dict[str, Card] = {}
    for path in sorted(RAW_DIR.glob("*.json")):
        raw = json.loads(path.read_text())
        stack = list(raw["cards"])
        while stack:
            c = stack.pop()
            cards.setdefault(c["code"], Card(c["code"], raw["pack"], c["name"]))
            if c.get("linked_card"):
                stack.append(c["linked_card"])
    return cards


def pack_names() -> dict[str, str]:
    names = {}
    for path in sorted(RAW_DIR.glob("*.json")):
        raw = json.loads(path.read_text())
        if raw["cards"]:
            names[raw["pack"]] = raw["cards"][0]["pack_name"]
    return names


def local_scans() -> dict[str, Path]:
    """The art folder's files by code (`21010.png` -> `21010`)."""
    return {p.stem: p for p in sorted(CARDS_DIR.iterdir()) if p.suffix in (".png", ".jpg", ".jpeg", ".webp")}


def pack_of(code: str, cards: dict[str, Card]) -> str:
    card = cards.get(code) or cards.get(code.rstrip("ab"))
    return card.pack if card else "?"


# --------------------------------------------------------------------------- watermark detection


class StampDetector:
    def __init__(self) -> None:
        self.templates = {}
        for orient in ("portrait", "landscape"):
            # Luminance is the template (offset by 128), alpha marks the diamond it covers.
            la = np.asarray(Image.open(TEMPLATE_DIR / f"ffg-watermark-{orient}.png").convert("LA"), dtype=np.float64)
            mask = la[..., 1] > 0
            v = la[..., 0][mask] - 128.0
            self.templates[orient] = (mask, (v - v.mean()) / v.std())

    def score(self, img: Image.Image) -> float:
        landscape = img.width > img.height
        mask, tmpl = self.templates["landscape" if landscape else "portrait"]
        size = DETECT_SIZE[::-1] if landscape else DETECT_SIZE
        gray = img.convert("L").resize(size, Image.Resampling.BILINEAR)
        detail = np.asarray(gray, np.float64) - np.asarray(gray.filter(ImageFilter.GaussianBlur(6)), np.float64)
        v = detail[mask]
        return float((((v - v.mean()) / (v.std() + 1e-6)) * tmpl).mean())

    def stamped(self, img: Image.Image) -> bool:
        return self.score(img) > STAMP_THRESHOLD


# --------------------------------------------------------------------------- image handling


def autocrop(img: Image.Image, threshold: int = 240, min_fraction: float = 0.02) -> Image.Image:
    """
    Trims white or transparent margins. A row or column is margin while fewer than `min_fraction` of its pixels are
    ink, so a few stray JPEG-noise pixels on the edge don't defeat the crop the way a single `any()` would.
    """
    rgba = np.asarray(img.convert("RGBA"))
    ink = np.any(rgba[..., :3] < threshold, axis=2) & (rgba[..., 3] > 16)
    rows = np.flatnonzero(ink.mean(axis=1) >= min_fraction)
    cols = np.flatnonzero(ink.mean(axis=0) >= min_fraction)
    if rows.size == 0 or cols.size == 0:
        return img
    return img.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1))


def aspect(img: Image.Image) -> float:
    return max(img.size) / min(img.size)


def save_like(img: Image.Image, dest: Path) -> None:
    """Writes `img` in the format `dest`'s extension names, scaled down to MAX_EDGE."""
    if max(img.size) > MAX_EDGE:
        img = img.copy()
        img.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
    suffix = dest.suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        img.convert("RGB").save(dest, format="JPEG", quality=92, optimize=True)
    elif suffix == ".webp":
        img.save(dest, format="WEBP", quality=92)
    else:
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "transparency" in img.info or img.mode in ("LA", "PA") else "RGB")
        img.save(dest, format="PNG", optimize=True)


# --------------------------------------------------------------------------- scraping


class Http:
    def __init__(self, delay: float) -> None:
        from curl_cffi import requests  # imported here so `audit` runs without network deps loaded

        self.session = requests.Session(impersonate="chrome120")
        self.delay = delay

    def get(self, url: str, timeout: int = 30) -> bytes | None:
        for attempt in range(4):
            try:
                res = self.session.get(url, timeout=timeout)
                time.sleep(self.delay)
                if res.status_code == 200:
                    return res.content
                if res.status_code in (404, 410):
                    return None
            except Exception as e:  # network errors: retry with backoff
                print(f"    ! {url}: {e}", file=sys.stderr)
            time.sleep(2 ** (attempt + 1))
        return None


WP_SUFFIX = re.compile(r"(-\d+x\d+|-scaled|-e\d{10,}|-\d{1,2})$")
CODE_RE = re.compile(r"^(\d{5}[a-z]?)$")


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def original_url(img_tag, page_url: str) -> str | None:
    """The full-size upload behind an <img>, preferring WordPress/Jetpack's original-file attributes."""
    src = (
        img_tag.get("data-orig-file")
        or img_tag.get("data-large-file")
        or img_tag.get("data-lazy-src")
        or img_tag.get("data-src")
        or img_tag.get("src")
    )
    if not src or src.startswith("data:"):
        return None
    url = urljoin(page_url, src.split("?")[0])
    # Jetpack CDN (i0.wp.com/hallofheroeslcg.com/...) -> the origin file.
    url = re.sub(r"^https?://i\d\.wp\.com/", "https://", url)
    # WordPress resized variants: 21010-300x419.jpg -> 21010.jpg
    path = urlparse(url).path
    stem, dot, ext = path.rpartition("/")[2].rpartition(".")
    base = re.sub(r"-\d+x\d+$", "", stem)
    return url[: len(url) - len(path)] + path[: len(path) - len(stem) - 1 - len(ext)] + base + dot + ext


def match_code(url: str, alt: str, pack: str, by_name: dict[str, list[Card]]) -> str | None:
    """Card code for an image: its file name when that is a code (Hall of Heroes' usual naming), else a unique name."""
    stem = urlparse(url).path.rpartition("/")[2].rpartition(".")[0].lower()
    for _ in range(3):
        if m := CODE_RE.match(stem):
            return m.group(1)
        stem = WP_SUFFIX.sub("", stem)
    for text in (alt, stem):
        hits = [c for c in by_name.get(slug(text), []) if c.pack == pack]
        if len(hits) == 1:
            return hits[0].code
    return None


def pack_pages(http: Http, pack: str, names: dict[str, str]) -> list[str]:
    if pack in PACK_PAGES:
        return [f"{HOH}/{PACK_PAGES[pack]}/"]
    html = http.get(f"{HOH}/browse/")
    if not html or pack not in names:
        return []
    want = slug(names[pack])
    for a in BeautifulSoup(html, "html.parser").find_all("a", href=True):
        if slug(a.get_text()) == want and a["href"].startswith(HOH):
            return [a["href"]]
    return []


def page_images(http: Http, page_url: str) -> list[tuple[str, str]]:
    """(original image URL, alt text) for every image on the page and on its linked encounters page."""
    seen: dict[str, str] = {}
    queue, visited = [page_url], set()
    base_slug = urlparse(page_url).path.strip("/")
    while queue:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        html = http.get(url)
        if not html:
            print(f"    ! could not load {url}")
            continue
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all("img"):
            if src := original_url(tag, url):
                seen.setdefault(src, tag.get("alt") or "")
        for a in soup.find_all("a", href=True):
            href = a["href"].split("#")[0].split("?")[0]
            linked = urlparse(href).path.strip("/")
            if href.startswith(HOH) and linked != base_slug and linked.startswith(base_slug + "-"):
                queue.append(href if href.endswith("/") else href + "/")
    return list(seen.items())


# --------------------------------------------------------------------------- manifest


def read_manifest() -> tuple[list[str], dict[str, list[str]]]:
    header, rows = [], {}
    if MANIFEST.exists():
        for line in MANIFEST.read_text().splitlines():
            if line.startswith("#") or line.startswith("code\t"):
                header.append(line)
            elif line.strip():
                cols = line.split("\t")
                rows[cols[0]] = cols
    return header, rows


def write_manifest(rows: dict[str, list[str]]) -> None:
    lines = [
        "# Card images fetched from Hall of Heroes (hallofheroeslcg.com) by scripts/fetch_card_art.py: scans MarvelCDB",
        "# does not publish, and better copies of ones it does (larger, or free of the FFG preview watermark).",
        "# Saved over bundles/cards/<code>.<ext> in the local file's format, scaled to at most a 1100px long edge.",
        "# Rows fetched on 2026-09-19 or earlier were scaled to a 419px long edge.",
        "code\tpack\tname\tsource_page\timage_url\tfetched",
    ]
    for code in sorted(rows):
        cols = rows[code] + [""] * (6 - len(rows[code]))
        lines.append("\t".join(cols[:6]))
    MANIFEST.write_text("\n".join(lines) + "\n")


# --------------------------------------------------------------------------- commands


def audit(args: argparse.Namespace) -> list[tuple[float, str, str]]:
    cards, detector = load_cards(), StampDetector()
    results = []
    for code, path in local_scans().items():
        with Image.open(path) as img:
            s = detector.score(img)
        if args.verbose or s > STAMP_THRESHOLD:
            results.append((s, code, pack_of(code, cards)))
    results.sort(reverse=True)
    stamped = [r for r in results if r[0] > STAMP_THRESHOLD]
    if args.command == "audit":
        by_pack: dict[str, list[str]] = {}
        for _, code, pack in stamped:
            by_pack.setdefault(pack, []).append(code)
        for pack, codes in sorted(by_pack.items(), key=lambda kv: -len(kv[1])):
            print(f"{pack:12} {len(codes):4}  {' '.join(sorted(codes))}")
        print(f"\n{len(stamped)} stamped scans")
        if args.verbose:
            for s, code, pack in results[len(stamped) : len(stamped) + 20]:
                print(f"  next highest: {code} ({pack}) {s:.3f}")
    return stamped


def fetch(args: argparse.Namespace) -> None:
    cards, names, detector = load_cards(), pack_names(), StampDetector()
    scans = local_scans()
    by_name: dict[str, list[Card]] = {}
    for c in cards.values():
        by_name.setdefault(slug(c.name), []).append(c)

    print("[+] Auditing local scans for the FFG watermark...")
    stamped_codes = {code for _, code, _ in audit(args)}
    stamped_packs = sorted({pack_of(c, cards) for c in stamped_codes} - {"?"})
    print(f"    {len(stamped_codes)} stamped scans in {', '.join(stamped_packs) or 'no packs'}")

    if args.packs:
        packs = args.packs
    elif args.stamped_only:
        packs = stamped_packs
    else:
        packs = stamped_packs + sorted(set(names) - set(stamped_packs))

    http = Http(args.delay)
    header, manifest = read_manifest()
    stats = {"replaced": 0, "added": 0, "kept": 0, "stamped": 0, "unmatched": 0}
    today = date.today().isoformat()

    for pack in packs:
        pages = pack_pages(http, pack, names)
        if not pages:
            print(f"\n[-] {pack}: no Hall of Heroes page known")
            continue
        print(f"\n[+] {pack}: {pages[0]}")
        done: set[str] = set()
        for url, alt in page_images(http, pages[0]):
            code = match_code(url, alt, pack, by_name)
            if not code or pack_of(code, cards) != pack:
                if code is None and re.search(r"\.(jpe?g|png|webp)$", url, re.I):
                    stats["unmatched"] += 1
                    if args.verbose:
                        print(f"    ? unmatched {url} ({alt!r})")
                continue
            if code in done or (args.stamped_only and code not in stamped_codes):
                continue
            local = scans.get(code)
            if local is None and not args.fill_missing:
                continue
            data = http.get(url)
            if not data:
                continue
            try:
                new = autocrop(Image.open(io.BytesIO(data)))
                new.load()
            except Exception as e:
                print(f"    ! {code}: unreadable image ({e})")
                continue
            if detector.stamped(new):
                stats["stamped"] += 1
                print(f"    - {code}: Hall of Heroes copy is stamped too")
                continue
            if local is not None:
                with Image.open(local) as old:
                    old_size, old_aspect, old_landscape = old.size, aspect(old), old.width > old.height
                if (new.width > new.height) != old_landscape or abs(aspect(new) - old_aspect) > 0.06:
                    print(f"    - {code}: shape {new.size} doesn't match local {old_size}; skipped")
                    continue
                bigger = max(new.size) >= max(old_size) * UPGRADE_FACTOR
                if not (bigger or code in stamped_codes):
                    stats["kept"] += 1
                    continue
            dest = local or CARDS_DIR / f"{code}.png"
            verb = "replace" if local else "add"
            print(f"    + {code}: {verb} {dest.name} {'' if local is None else old_size} -> {new.size}")
            done.add(code)
            stats["replaced" if local else "added"] += 1
            if not args.dry_run:
                save_like(new, dest)
                manifest[code] = [code, pack, cards[code].name, pages[0], url, today]

    if not args.dry_run:
        write_manifest(manifest)
    print(
        f"\n[=] {stats['replaced']} replaced, {stats['added']} added, {stats['kept']} kept (no better copy), "
        f"{stats['stamped']} stamped downloads rejected, {stats['unmatched']} images not matched to a card"
        + (" (dry run: nothing written)" if args.dry_run else "")
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    a = sub.add_parser("audit", help="list local scans carrying the FFG watermark")
    a.add_argument("-v", "--verbose", action="store_true", help="also show the highest-scoring clean scans")
    f = sub.add_parser("fetch", help="replace local scans with better Hall of Heroes copies")
    f.add_argument("--packs", nargs="+", help="MarvelCDB pack codes to fetch (default: stamped packs first, then all)")
    f.add_argument("--stamped-only", action="store_true", help="only replace scans carrying the FFG watermark")
    f.add_argument("--fill-missing", action="store_true", help="also add art for cards with no local scan")
    f.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    f.add_argument("--delay", type=float, default=0.5, help="seconds between requests (default 0.5)")
    f.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()
    audit(args) if args.command == "audit" else fetch(args)


if __name__ == "__main__":
    main()
