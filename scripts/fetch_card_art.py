#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "beautifulsoup4",
#     "curl-cffi",
#     "numpy",
#     "pillow",
#     "scipy",
# ]
# ///
"""
Card art upgrader: replaces scans in assets/card-art/bundles/cards/ with better
copies from Hall of Heroes (hallofheroeslcg.com).

Four commands:

  audit   Score every local scan for the Fantasy Flight Games diamond watermark
          (the "FF stamp" on the preview images some sets were first scanned
          from) and list the stamped ones. Offline.

  trim    Crop white padding off local scans in place, making the corners
          outside the card's rounded edge transparent (PNG) or frame-coloured
          (JPEG). Offline.

  fetch   Scrape the Hall of Heroes page of each pack, match every card image on
          it to a card code, and replace the local scan when the download is an
          improvement: unstamped, the same orientation and shape, and either
          larger or replacing a stamped scan. Packs with stamped scans go first.
          Hall of Heroes pads its card images with a white border; every
          download is trimmed the same way as `trim` before it is saved.
          `--fill-missing` also adds art for any card the scraped pack has no
          local scan for at all (not just replacements).

          Matching is by filename-as-code or by name (`match_code`) first.
          Some pack pages (Mad Titan's Shadow's box and encounters pages) give
          neither: every image is named by its own per-encounter-set sequence
          (`e1.jpg`, `t7b.jpg`...) with empty alt text, not by card code or
          name. Whatever `match_code` can't place falls back to `match_by_art`:
          a perceptual hash (`phash`) of each remaining candidate against every
          remaining local scan in the pack, resolved by Hungarian assignment
          and only kept where the match is both close and unambiguous. This
          only works for a *replacement* (it needs the existing local scan as
          the reference to match against) — `--fill-missing` still needs a
          name/filename hit for a card with no local scan at all.

  missing Fetches exactly the scans `pnpm --filter @mc/client build` reports as
          referenced by the card pool but absent from the folder — asking the
          build for that list (`vite-card-art.ts`'s own warning) rather than
          restating it here, so the two can't drift. Hall of Heroes is the
          source: it doesn't carry the FFG diamond watermark, and a pack page
          often names a stage/side's B-face separately from MarvelCDB's own
          `imagesrc` (e.g. `kang-7b-kangs-arrival.png`), which `fetch` and the
          generic pack scrape below can miss. A code Hall of Heroes genuinely
          doesn't carry falls back to MarvelCDB's own `imagesrc`/`backimagesrc`
          — audited for the watermark and trimmed the same way, but that is
          necessary, not sufficient: MarvelCDB has served the *wrong face* at
          the *right filename* before (two records can share a filename stem —
          see `_marvelcdb_url_for`), so every MarvelCDB fallback needs a human
          look at the saved file, not just a clean `audit` score, before it's
          trusted. A card only available stamped is left missing (the client's
          generated frame is the correct fallback) rather than saved anyway.
          An external URL in the list (a bad card record, not a missing scan)
          is reported and left alone — that is a `packages/content` data bug,
          not something this script can fetch its way out of.

A replacement or an addition keeps the exact local path a card record names
(`/bundles/cards/<code>.png` or `.jpg`), since that is what `imageRef()` points
at. Each one is recorded in assets/card-art/hall-of-heroes-manifest.tsv.

  uv run scripts/fetch_card_art.py audit
  uv run scripts/fetch_card_art.py trim --dry-run
  uv run scripts/fetch_card_art.py fetch --stamped-only
  uv run scripts/fetch_card_art.py fetch --packs mts sm --dry-run
  uv run scripts/fetch_card_art.py missing
  uv run scripts/fetch_card_art.py missing --dry-run -v
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse

import numpy as np
from bs4 import BeautifulSoup
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.fft import dctn
from scipy.optimize import linear_sum_assignment

REPO_ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = REPO_ROOT / "assets" / "card-art" / "bundles" / "cards"
MANIFEST = REPO_ROOT / "assets" / "card-art" / "hall-of-heroes-manifest.tsv"
RAW_DIR = REPO_ROOT / "packages" / "content" / "raw" / "marvelcdb"
TEMPLATE_DIR = Path(__file__).resolve().parent / "card-art"

HOH = "https://hallofheroeslcg.com"
MARVELCDB_BASE = "https://marvelcdb.com"

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
# Padding is any pixel at least this light on every channel (and near-grey) that connects to the image's edge.
PAD_WHITE = 225
# A trimmed card's long/short edge ratio must land here (a printed card is 88x63mm, 1.40; local scans run 1.39-1.45).
CARD_ASPECT = (1.34, 1.50)

# Art-hash matching (see `phash`/`match_by_art`): a Hungarian assignment is only trusted when the winning pair's
# Hamming distance is small in absolute terms (distinct card art differs by 20+ of the 64 bits; the same art with a
# stamp or a different crop differs by well under this) and clearly better than that code's next-best remote
# candidate, so a code with no real match on the page isn't forced onto whatever remote image is merely "closest".
HASH_MAX_DISTANCE = 10
HASH_MARGIN = 6


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


def card_for(code: str, cards: dict[str, Card]) -> Card | None:
    """The card record a filename stem belongs to. Most codes are literal, but MarvelCDB's own image filenames
    are sometimes lettered beyond the card's real code (`26002a.jpg`/`26002b.png` for plain code `26002`,
    `07001b.png` for plain code `07001`) — stripping a trailing a/b falls back to the base code in that case."""
    return cards.get(code) or cards.get(code.rstrip("ab"))


def pack_of(code: str, cards: dict[str, Card]) -> str:
    card = card_for(code, cards)
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


# --------------------------------------------------------------------------- art matching


def phash(img: Image.Image) -> int:
    """
    A 64-bit perceptual hash of a (trimmed) card image: the sign of its low-frequency DCT coefficients, which is
    unaffected by JPEG noise, a small watermark, or being cropped slightly differently, but differs sharply between
    two different pieces of card art. Used to match a Hall of Heroes image to a local card code on pages that give
    the matcher nothing else to go on (no code-shaped filename, no alt text) — see `match_by_art`.
    """
    small = img.convert("L").resize((32, 32), Image.Resampling.LANCZOS)
    coeffs = dctn(np.asarray(small, dtype=np.float64), norm="ortho")[:8, :8]
    bits = coeffs > np.median(coeffs)
    h = 0
    for b in bits.flat:
        h = (h << 1) | int(b)
    return h


def hamming(a: int, b: int) -> int:
    return int(bin(a ^ b).count("1"))


def match_by_art(
    local_hashes: dict[str, int], remote: list[tuple[str, str, int]]
) -> dict[str, tuple[str, str]]:
    """
    Assigns Hall of Heroes images to local card codes within one pack by art content alone, for pages whose filenames
    and alt text carry no usable card identity (Mad Titan's Shadow numbers every image `e1.jpg`, `t7b.jpg`, etc. by
    its own per-encounter-set sequence, not by card code or name). `remote` is `(url, alt, phash)` triples already
    downloaded, trimmed, and confirmed unstamped by the caller.

    A Hungarian assignment (`scipy.optimize.linear_sum_assignment`) over the full local-code x remote-image distance
    matrix finds the globally cheapest one-to-one pairing, rather than greedily matching each code to whatever is
    nearest first (which can steal an image that was a better match for a different code). Only pairs clearing both
    `HASH_MAX_DISTANCE` and `HASH_MARGIN` are returned — a code genuinely absent from the page (not every card gets
    photographed on every pack page) should come back unmatched, not paired with the least-bad leftover image.
    """
    codes = list(local_hashes)
    if not codes or not remote:
        return {}
    cost = np.array([[hamming(local_hashes[c], h) for _, _, h in remote] for c in codes], dtype=np.float64)
    rows, cols = linear_sum_assignment(cost)
    out: dict[str, tuple[str, str]] = {}
    for r, c in zip(rows, cols):
        dist = cost[r, c]
        if dist > HASH_MAX_DISTANCE:
            continue
        rest = np.delete(cost[r], c)
        if rest.size and rest.min() - dist < HASH_MARGIN:
            continue
        out[codes[r]] = remote[c][:2]
    return out


# --------------------------------------------------------------------------- image handling


def background_mask(img: Image.Image) -> np.ndarray:
    """
    The padding around a card: near-white or transparent pixels connected to the image's edge. Flood-filling from the
    edge, instead of treating every light pixel as padding, keeps white areas inside the card (text boxes, a white
    costume) from being eaten, and it also covers the corners outside the card's rounded edge.
    """
    rgba = np.asarray(img.convert("RGBA")).astype(np.int16)
    rgb = rgba[..., :3]
    light = (rgb.min(axis=2) >= PAD_WHITE) & (np.ptp(rgb, axis=2) <= 24)
    candidate = light | (rgba[..., 3] < 16)
    labels, _ = ndimage.label(candidate)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    return np.isin(labels, edge[edge > 0])


def trim(img: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]] | None:
    """
    Crops the padding off a card image and makes the corners outside its rounded edge transparent. Returns the card
    and the (top, right, bottom, left) padding removed, or None when what's left isn't card-shaped (a crop that went
    wrong), so the caller can skip the image rather than save a mangled card.

    The crop box is where the card covers at least a fifth of a row or column, so a JPEG speck in the padding, or the
    narrow first rows of a rounded corner, don't hold it open.
    """
    bg = background_mask(img)
    card = ~bg
    rows = np.flatnonzero(card.mean(axis=1) >= 0.2)
    cols = np.flatnonzero(card.mean(axis=0) >= 0.2)
    if rows.size == 0 or cols.size == 0:
        return None
    top, bottom, left, right = int(rows[0]), int(rows[-1]) + 1, int(cols[0]), int(cols[-1]) + 1
    if not CARD_ASPECT[0] <= max(right - left, bottom - top) / min(right - left, bottom - top) <= CARD_ASPECT[1]:
        return None
    rgba = np.array(img.convert("RGBA"))
    # One pixel wider than the padding itself, to drop the light JPEG fringe along the rounded corners.
    rgba[..., 3] = np.where(ndimage.binary_dilation(bg), 0, rgba[..., 3])
    cropped = Image.fromarray(rgba[top:bottom, left:right], "RGBA")
    return cropped, (top, img.width - right, img.height - bottom, left)


def aspect(img: Image.Image) -> float:
    return max(img.size) / min(img.size)


def flatten(img: Image.Image) -> Image.Image:
    """
    An RGBA card on an opaque background, for formats without transparency. The background is the median colour of
    the card's own outer edge, so the corners outside its rounded edge blend into its frame instead of showing white.
    """
    rgba = np.asarray(img)
    ring = np.concatenate([rgba[4], rgba[-5], rgba[:, 4], rgba[:, -5]])
    ring = ring[ring[:, 3] > 200][:, :3]
    fill = tuple(int(c) for c in np.median(ring, axis=0)) if ring.size else (0, 0, 0)
    base = Image.new("RGB", img.size, fill)
    base.paste(img, mask=img.getchannel("A"))
    return base


def save_like(img: Image.Image, dest: Path, max_edge: int | None = MAX_EDGE) -> None:
    """
    Writes a trimmed RGBA card in the format `dest`'s extension names, scaled down to `max_edge`. PNG and WebP keep the
    transparent corners; JPEG gets them filled by `flatten`.
    """
    if max_edge and max(img.size) > max_edge:
        img = img.copy()
        img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    suffix = dest.suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        flatten(img).save(dest, format="JPEG", quality=92, optimize=True)
    elif suffix == ".webp":
        img.save(dest, format="WEBP", quality=92)
    else:
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


# Explicit filename -> code overrides for pages where neither the filename-as-code rule nor alt/name matching can
# work at all: Mad Titan's Shadow numbers every image by its own per-encounter-set sequence (`e1.jpg`, `t7a.jpg`...)
# with empty alt text, and `match_by_art` (the generic content-hash fallback) can't tell apart a villain's identical
# artwork printed at 3 difficulty stages, or one main scheme's two faces, from each other. Each entry here was
# confirmed by reading the MarvelCDB collector number Hall of Heroes' own scan prints in the card's bottom corner
# (e.g. `e1.jpg` -> "EBONY MAW (1/22) ... 71"), not guessed from position — Hall of Heroes' gallery order does not
# reliably follow card-code order (`the-mad-titans-shadow-encounters-and-mods`'s "Tower Defense" section runs
# 21092-21099 before looping back for card 21100 onward). Covers every Mad Titan's Shadow villain stage and main
# scheme face; see the `card-data-pipeline` handoff notes for the 2026-09-26 audit this closed out.
PACK_FILENAME_CODES: dict[str, dict[str, str]] = {
    "mts": {
        "e1": "21071",  # Ebony Maw, stage 1
        "e2": "21072",  # Ebony Maw, stage 2
        "e3": "21073",  # Ebony Maw, stage 3
        "e4a": "21074",  # Attack on Knowhere (main scheme 1)
        "e5a": "21075",  # The Power Stone (main scheme 2)
        "t1": "21092",  # Proxima Midnight, stage 1
        "t2": "21093",  # Proxima Midnight, stage 2
        "t3": "21094",  # Proxima Midnight, stage 3
        "t4": "21095",  # Corvus Glaive, stage 1
        "t5": "21096",  # Corvus Glaive, stage 2
        "t6": "21097",  # Corvus Glaive, stage 3
        "t7a": "21098",  # Under Siege (main scheme 1)
        "t8a": "21099",  # The Armies of Thanos (main scheme 2)
        "t1-1": "21111",  # Thanos, stage 1 - distinct upload from Tower Defense's "t1"
        "t2-1": "21112",  # Thanos, stage 2 - distinct upload from Tower Defense's "t2"
        "t3-1": "21113",  # Thanos, stage 3 - distinct upload from Tower Defense's "t3"
        "t4a": "21114",  # The Infinity Stones (Thanos main scheme 1) - distinct upload from Tower Defense's "t4"
        "t5a": "21115",  # Balance the Scales (Thanos main scheme 2) - distinct upload from Tower Defense's "t5"
        "h1a": "21136a",  # Hela, stage 1
        "h2a": "21137a",  # Hela, stage 2
        "h3a": "21138",  # Odin's Torment (Hela main scheme)
        "l1": "21160",  # Loki, stage 1
        "l2": "21161",  # Loki, stage 2
        "l3": "21162",  # Loki, stage 3
        "l4": "21163",  # Loki, stage 4
        "l5": "21164",  # Loki, stage 5
        "l6a": "21165",  # All Hail King Loki (main scheme)
        "c1a": "21180a",  # Secure the Landing Pad (campaign side scheme)
        "c13a": "21186a",  # Find the Norn Stones (campaign side scheme)
        "c17a": "21187a",  # Norn Stone (campaign upgrade)
        "c19a": "21189a",  # Open the Dungeons (campaign side scheme)
    },
}


def match_code(url: str, alt: str, pack: str, by_name: dict[str, list[Card]]) -> str | None:
    """Card code for an image: its file name when that is a code (Hall of Heroes' usual naming), else a unique name,
    else a `PACK_FILENAME_CODES` override for a page too cryptic for either."""
    stem = urlparse(url).path.rpartition("/")[2].rpartition(".")[0].lower()
    if override := PACK_FILENAME_CODES.get(pack, {}).get(stem):
        return override
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
    stats = {"replaced": 0, "added": 0, "kept": 0, "stamped": 0, "untrimmed": 0, "unmatched": 0}
    today = date.today().isoformat()

    def prepare(url: str, code: str) -> tuple[Image.Image, tuple[int, int, int, int]] | None:
        """Downloads and trims one candidate, or None (and a printed reason + stats bump) if it can't be used."""
        data = http.get(url)
        if not data:
            return None
        try:
            trimmed = trim(Image.open(io.BytesIO(data)))
        except Exception as e:
            print(f"    ! {code}: unreadable image ({e})")
            return None
        if trimmed is None:
            stats["untrimmed"] += 1
            print(f"    - {code}: not card-shaped once the padding is trimmed; skipped ({url})")
            return None
        new, padding = trimmed
        if detector.stamped(new):
            stats["stamped"] += 1
            print(f"    - {code}: Hall of Heroes copy is stamped too")
            return None
        return new, padding

    def consider(code: str, url: str, new: Image.Image, padding: tuple[int, int, int, int], pack: str) -> bool:
        """Saves `new` over `code`'s local scan (or adds it) if it clears the size/shape bar. Returns whether it did."""
        local = scans.get(code)
        if local is not None:
            with Image.open(local) as old:
                old_size, old_aspect, old_landscape = old.size, aspect(old), old.width > old.height
            if (new.width > new.height) != old_landscape or abs(aspect(new) - old_aspect) > 0.06:
                print(f"    - {code}: shape {new.size} doesn't match local {old_size}; skipped")
                return False
            bigger = max(new.size) >= max(old_size) * UPGRADE_FACTOR
            if not (bigger or code in stamped_codes):
                stats["kept"] += 1
                return False
        dest = local or CARDS_DIR / f"{code}.png"
        verb = "replace" if local else "add"
        print(f"    + {code}: {verb} {dest.name} {'' if local is None else old_size} -> {new.size}, trimmed {padding}")
        stats["replaced" if local else "added"] += 1
        if not args.dry_run:
            save_like(new, dest)
            manifest[code] = [code, pack, cards[code].name, pages[0], url, today]
        return True

    for pack in packs:
        pages = pack_pages(http, pack, names)
        if not pages:
            print(f"\n[-] {pack}: no Hall of Heroes page known")
            continue
        print(f"\n[+] {pack}: {pages[0]}")
        done: set[str] = set()
        leftover: list[tuple[str, str]] = []
        for url, alt in page_images(http, pages[0]):
            code = match_code(url, alt, pack, by_name)
            if not code or pack_of(code, cards) != pack:
                if re.search(r"\.(jpe?g|png|webp)$", url, re.I):
                    leftover.append((url, alt))
                    if code is None:
                        stats["unmatched"] += 1
                        if args.verbose:
                            print(f"    ? unmatched {url} ({alt!r})")
                continue
            if code in done or (args.stamped_only and code not in stamped_codes):
                continue
            local = scans.get(code)
            if local is None and not args.fill_missing:
                continue
            prepared = prepare(url, code)
            if prepared and consider(code, url, *prepared, pack):
                done.add(code)

        # Art-hash fallback (see `match_by_art`): pages like Mad Titan's Shadow's number every image by its own
        # per-encounter-set sequence (`e1.jpg`, `t7b.jpg`...), not by card code or name, so `match_code` above leaves
        # almost everything unmatched. Whatever it *did* leave over (`leftover`) still might be the very art a
        # not-yet-`done` code needs; match by content instead of name for those only.
        wanted = (stamped_codes if args.stamped_only else set(scans)) & {c for c in cards if pack_of(c, cards) == pack}
        wanted -= done
        if leftover and wanted:
            local_hashes: dict[str, int] = {}
            for code in wanted:
                if code not in scans:
                    continue
                with Image.open(scans[code]) as img:
                    local_hashes[code] = phash(img)
            remote: list[tuple[str, str, int]] = []
            prepared_by_url: dict[str, tuple[Image.Image, tuple[int, int, int, int]]] = {}
            for url, alt in leftover:
                prepared = prepare(url, f"(art-match candidate) {url}")
                if prepared:
                    prepared_by_url[url] = prepared
                    remote.append((url, alt, phash(prepared[0])))
            matches = match_by_art(local_hashes, remote)
            if matches:
                print(f"    [art-match] {len(matches)} candidate(s) matched by content, no usable filename/alt text")
            for code, (url, _alt) in matches.items():
                if consider(code, url, *prepared_by_url[url], pack):
                    done.add(code)

    if not args.dry_run:
        write_manifest(manifest)
    print(
        f"\n[=] {stats['replaced']} replaced, {stats['added']} added, {stats['kept']} kept (no better copy), "
        f"{stats['stamped']} stamped downloads rejected, {stats['untrimmed']} not card-shaped after trimming, "
        f"{stats['unmatched']} images not matched to a card"
        + (" (dry run: nothing written)" if args.dry_run else "")
    )


MISSING_HEADER = re.compile(r"pool references are not in assets/card-art/[^\n]*:\n((?:  .*\n?)+)")


def pool_missing_paths() -> list[str]:
    """
    Exactly what `pnpm --filter @mc/client build` warns is missing (`vite-card-art.ts`'s own message): a relative
    path under `assets/card-art/` for a normal gap, or a full URL when the gap is actually a bad card record (an
    `imageRef`/`ArtRef` that never should have pointed off-origin in the first place — see the module docstring).
    Asking the build instead of restating its logic here means the two cannot drift.
    """
    # `vite build` directly, not `pnpm --filter @mc/client build` (which runs `tsc --noEmit` first): the card-art
    # summary comes from the Vite plugin alone, and a typecheck failure elsewhere in the monorepo (mid-edit in
    # another package) would otherwise take this down with it for a reason that has nothing to do with art.
    result = subprocess.run(
        ["npx", "vite", "build"],
        cwd=REPO_ROOT / "packages" / "client",
        capture_output=True,
        text=True,
        check=False,
    )
    output = result.stdout + result.stderr
    m = MISSING_HEADER.search(output)
    if not m:
        if "card art:" not in output:
            print(output[-4000:], file=sys.stderr)
            raise RuntimeError("client build did not report a card-art summary at all; see output above")
        return []
    return [line.strip() for line in m.group(1).splitlines() if line.strip()]


def missing(args: argparse.Namespace) -> None:
    cards, names, detector = load_cards(), pack_names(), StampDetector()

    print("[+] Asking the client build which scans the pool needs...")
    paths = pool_missing_paths()
    bad_records = [p for p in paths if p.startswith("http")]
    for p in bad_records:
        print(f"    ! {p}: a card record points off-origin instead of naming a missing local scan; fix that")
        print("      record in packages/content (ingest/curation), not here — this script only fills real gaps.")
    wanted = [p for p in paths if not p.startswith("http")]
    if not wanted:
        print("\n[=] nothing to fetch" + (f" ({len(bad_records)} bad record(s) reported above)" if bad_records else ""))
        return

    by_pack: dict[str, list[tuple[str, str]]] = {}  # pack -> [(stem, filename)]
    unresolved: list[str] = []
    for relpath in wanted:
        filename = relpath.rsplit("/", 1)[-1]
        stem = filename.rsplit(".", 1)[0]
        pack = pack_of(stem, cards)
        if pack == "?":
            unresolved.append(relpath)
            continue
        by_pack.setdefault(pack, []).append((stem, filename))
    for relpath in unresolved:
        print(f"    ? {relpath}: no card record matches this code; skipped")

    by_name: dict[str, list[Card]] = {}
    for c in cards.values():
        by_name.setdefault(slug(c.name), []).append(c)

    http = Http(args.delay)
    header, manifest = read_manifest()
    today = date.today().isoformat()
    found: list[str] = []
    still_missing: list[str] = list(unresolved)

    for pack, wants in sorted(by_pack.items()):
        want_by_stem = dict(wants)
        remaining = set(want_by_stem)
        pages = pack_pages(http, pack, names)
        print(f"\n[+] {pack}: need {', '.join(want_by_stem[s] for s in sorted(remaining))}")
        if pages:
            print(f"    Hall of Heroes: {pages[0]}")
            for url, alt in page_images(http, pages[0]):
                if not remaining:
                    break
                candidate = match_code(url, alt, pack, by_name)
                if candidate not in remaining:
                    continue
                filename = want_by_stem[candidate]
                if _fetch_one(http, detector, url, CARDS_DIR / filename, args, candidate, "Hall of Heroes"):
                    remaining.discard(candidate)
                    found.append(filename)
                    if not args.dry_run:
                        card = card_for(candidate, cards)
                        manifest[candidate] = [candidate, pack, card.name if card else candidate, pages[0], url, today]
        else:
            print(f"    - {pack}: no Hall of Heroes page known")

        # MarvelCDB fallback for whatever Hall of Heroes didn't have (or didn't have unstamped).
        for stem in sorted(remaining):
            card = card_for(stem, cards)
            url = _marvelcdb_url_for(want_by_stem[stem])
            if not url:
                print(f"    ? {stem}: not found on MarvelCDB either ({want_by_stem[stem]})")
                still_missing.append(want_by_stem[stem])
                continue
            filename = want_by_stem[stem]
            if _fetch_one(http, detector, url, CARDS_DIR / filename, args, stem, "MarvelCDB"):
                remaining.discard(stem)
                found.append(filename)
                # The watermark score is not the only thing that can be wrong with a MarvelCDB fallback: two
                # records can share a filename stem (see `_marvelcdb_url_for`), and this project's own history
                # includes a run that matched the *right* stem but the *wrong* face byte-for-byte. Unstamped is
                # necessary, not sufficient — look at the saved file before trusting it.
                print(f"      MarvelCDB fallback, not Hall of Heroes: look at {filename} yourself before committing it")
                if not args.dry_run:
                    manifest[stem] = [stem, pack, card.name if card else stem, "https://marvelcdb.com", url, today]
            else:
                still_missing.append(filename)

    if not args.dry_run:
        write_manifest(manifest)
    print(
        f"\n[=] {len(found)} fetched, {len(still_missing)} still missing"
        + (f": {', '.join(sorted(still_missing))}" if still_missing else "")
        + (" (dry run: nothing written)" if args.dry_run else "")
    )


def _marvelcdb_url_for(filename: str) -> str | None:
    """
    MarvelCDB's own `imagesrc`/`backimagesrc` for a full filename (stem *and* extension), absolute. Only a
    fallback: Hall of Heroes is tried first, since MarvelCDB's own scans are the ones `fetch` exists to replace
    (stamped previews).

    Matched on the whole filename, not just the stem: MarvelCDB's own filenames aren't always the card's code
    (`26002a.jpg`/`26002b.png` for plain code `26002`), and worse, two *different* records can share a filename
    stem but not its extension — `07001`'s front is `07001b.png` and `07001b`'s own front is also under `07001b`,
    but as `.jpg`. Matching on the stem alone would silently hand back whichever of the two `json.load` happens to
    visit first, which is exactly how the first version of this fetched `11007a.jpg` as a byte-identical copy of
    the unrelated `11007a.png` it was standing in next to.
    """
    for path in sorted(RAW_DIR.glob("*.json")):
        raw = json.loads(path.read_text())
        stack = list(raw["cards"])
        while stack:
            c = stack.pop()
            for src in (c.get("imagesrc"), c.get("backimagesrc")):
                if src and src.rsplit("/", 1)[-1] == filename:
                    return MARVELCDB_BASE + src
            if c.get("linked_card"):
                stack.append(c["linked_card"])
    return None


def _fetch_one(
    http: Http,
    detector: StampDetector,
    url: str,
    dest: Path,
    args: argparse.Namespace,
    code: str,
    source_name: str,
) -> bool:
    """Downloads, trims and (unless `--dry-run`) saves one missing scan. Returns whether it worked."""
    data = http.get(url)
    if not data:
        return False
    try:
        trimmed = trim(Image.open(io.BytesIO(data)))
    except Exception as e:
        print(f"    ! {code}: unreadable image from {source_name} ({e})")
        return False
    if trimmed is None:
        print(f"    - {code}: {source_name} copy isn't card-shaped once trimmed; skipped ({url})")
        return False
    new, padding = trimmed
    if detector.stamped(new):
        print(f"    - {code}: {source_name} copy is stamped; skipped ({url})")
        return False
    print(f"    + {code}: {dest.name} <- {source_name} {new.size}, trimmed {padding}")
    if not args.dry_run:
        save_like(new, dest)
    return True


def trim_local(args: argparse.Namespace) -> None:
    """Crops white padding off the local scans in place (the photographed ones carry it)."""
    changed = 0
    for code, path in local_scans().items():
        with Image.open(path) as img:
            img.load()
        trimmed = trim(img)
        if trimmed is None:
            continue
        card, padding = trimmed
        if max(padding) < max(3, 0.01 * max(img.size)):
            continue
        changed += 1
        print(f"    {path.name}: {img.size} -> {card.size}, trimmed {padding}")
        if not args.dry_run:
            save_like(card, path, max_edge=None)
    print(f"\n[=] {changed} scans {'would be ' if args.dry_run else ''}trimmed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    a = sub.add_parser("audit", help="list local scans carrying the FFG watermark")
    a.add_argument("-v", "--verbose", action="store_true", help="also show the highest-scoring clean scans")
    t = sub.add_parser("trim", help="crop white padding off local scans in place")
    t.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    f = sub.add_parser("fetch", help="replace local scans with better Hall of Heroes copies")
    f.add_argument("--packs", nargs="+", help="MarvelCDB pack codes to fetch (default: stamped packs first, then all)")
    f.add_argument("--stamped-only", action="store_true", help="only replace scans carrying the FFG watermark")
    f.add_argument("--fill-missing", action="store_true", help="also add art for cards with no local scan")
    f.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    f.add_argument("--delay", type=float, default=0.5, help="seconds between requests (default 0.5)")
    f.add_argument("-v", "--verbose", action="store_true")
    m = sub.add_parser("missing", help="fetch exactly the scans the client build reports as missing")
    m.add_argument("--dry-run", action="store_true", help="report what would be fetched without writing")
    m.add_argument("--delay", type=float, default=0.5, help="seconds between requests (default 0.5)")
    m.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()
    {"audit": audit, "trim": trim_local, "fetch": fetch, "missing": missing}[args.command](args)


if __name__ == "__main__":
    main()
