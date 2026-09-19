"""Writes resources/icon.png and the splash into every icon/splash slot the
Capacitor iOS and Android projects already have, at each slot's existing size.

`@capacitor/assets` does the same job but needs sharp's native build, which
this pnpm setup blocks; this needs only Pillow. Rerun after `cap add`.
Run from packages/client: python3 resources/apply-native-assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICON = Image.open(ROOT / "resources/icon.png").convert("RGBA")
VOID = (0x0E, 0x0C, 0x0A, 255)
RED = "#C8102E"


def fit(img, size):
    return img.resize(size, Image.LANCZOS)


def splash(size):
    w, h = size
    ground = Image.new("RGBA", size, VOID)
    side = int(min(w, h) * 0.3)
    ground.paste(fit(ICON, (side, side)), ((w - side) // 2, (h - side) // 2))
    return ground


def round_icon(size):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size[0] - 1, size[1] - 1), fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(fit(ICON, size), (0, 0), mask)
    return out


def foreground(size):
    # Adaptive icons crop to the middle 66%: keep the art inside that zone,
    # over the red background color set in ic_launcher_background.xml.
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    inner = int(size[0] * 0.62)
    out.paste(fit(ICON, (inner, inner)), ((size[0] - inner) // 2, (size[1] - inner) // 2))
    return out


def write(path, make):
    size = Image.open(path).size
    img = make(size)
    (img.convert("RGB") if path.name.startswith(("AppIcon", "splash")) else img).save(path)


ios = ROOT / "ios/App/App/Assets.xcassets"
for p in (ios / "AppIcon.appiconset").glob("*.png"):
    write(p, lambda s: fit(ICON, s))
for p in (ios / "Splash.imageset").glob("*.png"):
    write(p, splash)

res = ROOT / "android/app/src/main/res"
for p in res.glob("mipmap-*/ic_launcher.png"):
    write(p, lambda s: fit(ICON, s))
for p in res.glob("mipmap-*/ic_launcher_round.png"):
    write(p, round_icon)
for p in res.glob("mipmap-*/ic_launcher_foreground.png"):
    write(p, foreground)
for p in res.glob("drawable*/splash.png"):
    write(p, splash)
bg = res / "values/ic_launcher_background.xml"
bg.write_text(bg.read_text().replace("#FFFFFF", RED))
print("native icons and splash screens updated")
