"""Builds the Steam library artwork that install-for-steam.sh gives the game's non-Steam shortcut, from the title
screen wallpapers in art/title/ and the app icon. Run it again after changing a source picture and commit the output.

    python scripts/linux/make-steam-art.py

Writes scripts/linux/steam-art/ (sizes are Steam's library asset sizes):
  icon.png      512x512   the app icon (the shortcut's icon)
  portrait.jpg  600x900   the library grid capsule
  wide.jpg      920x430   the wide capsule (Recent games, Big Picture)
  hero.jpg      1920x620  the banner across the top of the game's page
  logo.png      transparent, drawn over the hero
Needs Pillow.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
TITLE = ROOT / "art" / "title"
OUT = Path(__file__).resolve().parent / "steam-art"


def logo() -> Image.Image:
    # The "MARVEL CHAMPIONS / THE CARD GAME" lockup sits on a black panel in the middle of the wide wallpaper. White on
    # black, so its brightness is its alpha: the letters stay, the panel goes. The MARVEL box (white with black letters
    # there) is drawn solid instead, as the red box with white letters.
    src = Image.open(TITLE / "wallpaper-4-wide.webp").convert("L").crop((781, 327, 1019, 456))
    big = src.resize((src.width * 3, src.height * 3), Image.LANCZOS)
    alpha = big.point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 1.4)))
    out = Image.new("RGBA", big.size, (255, 255, 255, 0))
    out.putalpha(alpha)
    box = (21 * 3, 0, 222 * 3, 82 * 3)
    lum = big.crop(box)
    red, white = Image.new("RGB", lum.size, (236, 29, 36)), Image.new("RGB", lum.size, (255, 255, 255))
    out.paste(Image.composite(red, white, lum).convert("RGBA"), box[:2])
    return out


def wide() -> Image.Image:
    src = Image.open(TITLE / "wallpaper-4-wide.webp").convert("RGB")
    # The panels without the black border around them, cut to Steam's 920:430.
    left, top, right, bottom = 215, 66, 1584, 723
    height = round((right - left) * 430 / 920)
    top += (bottom - top - height) // 2
    return src.crop((left, top, right, top + height)).resize((920, 430), Image.LANCZOS)


def portrait(mark: Image.Image) -> Image.Image:
    src = Image.open(TITLE / "wallpaper-portrait.jpg").convert("RGB")
    base = ImageOps.fit(src, (600, 900), Image.LANCZOS, centering=(0.5, 0.0)).convert("RGBA")
    # A dark band along the bottom so the white logo reads over the street.
    shade = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shade)
    for y in range(600, 900):
        draw.line([(0, y), (600, y)], fill=(0, 0, 0, min(220, int((y - 600) * 1.1))))
    base = Image.alpha_composite(base, shade)
    m = mark.resize((520, round(mark.height * 520 / mark.width)), Image.LANCZOS)
    base.alpha_composite(m, ((600 - m.width) // 2, 900 - m.height - 36))
    return base.convert("RGB")


def hero() -> Image.Image:
    src = Image.open(TITLE / "wallpaper-1.jpg").convert("RGB")
    return ImageOps.fit(src, (1920, 620), Image.LANCZOS, centering=(0.5, 0.12))


def main() -> None:
    OUT.mkdir(exist_ok=True)
    mark = logo()
    mark.save(OUT / "logo.png", optimize=True)
    # Steam takes .jpg as well as .png for library art; the paintings are far smaller as JPEG.
    wide().save(OUT / "wide.jpg", quality=90, optimize=True)
    portrait(mark).save(OUT / "portrait.jpg", quality=90, optimize=True)
    hero().save(OUT / "hero.jpg", quality=90, optimize=True)
    Image.open(ROOT / "packages" / "client" / "src-tauri" / "icons" / "icon.png").save(OUT / "icon.png", optimize=True)
    for f in sorted(OUT.glob("*.*")):
        print(f"{f.name}: {Image.open(f).size}, {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
