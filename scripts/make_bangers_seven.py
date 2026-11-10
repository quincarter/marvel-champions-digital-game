"""Build the crossed-7 face that sits over Bangers' own 7 (issue #660).

Bangers draws a 7 as a narrow slanted stem under a short top bar, so at a glance a 7 reads as a 1 ("7 / 14" HP read
"1 / 14"). This takes the 7 from the @fontsource Bangers latin file, adds a crossbar through its stem in Bangers' own
slant, and writes a one-glyph woff2 that `packages/client/src/fonts/bangers-seven.css` declares as another `Bangers`
face for U+0037 only. Every other character still comes from @fontsource's files.

Bangers is SIL OFL 1.1 with no Reserved Font Name; the modified face is renamed "Bangers Seven" inside the file and
ships with the OFL beside it.

Needs fonttools, brotli and skia-pathops:

    python -m pip install fonttools brotli skia-pathops
    python scripts/make_bangers_seven.py
"""

from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import ttProgram
import pathops

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "packages/client/node_modules/@fontsource/bangers/files/bangers-latin-400-normal.woff2"
OUT = ROOT / "packages/client/src/fonts/bangers-seven.woff2"

# The crossbar, in font units (1000 per em; Bangers' cap height is 721). Its bottom and top sit a little under the
# middle of the 7's stem, clear of the top bar (which starts at 534). Its ends lean like the top bar's left end
# (31 across for 176 up), so the bar shares the face's slant. It reaches ~90 units out past each side of the stem.
BAR_BOTTOM, BAR_TOP = 285, 375
SLANT = 31 / 176
BAR_LEFT, BAR_RIGHT = 42, 392


def crossbar() -> pathops.Path:
    lean = (BAR_TOP - BAR_BOTTOM) * SLANT
    bar = pathops.Path()
    pen = bar.getPen()
    # Clockwise, as TrueType outer contours are.
    pen.moveTo((BAR_LEFT, BAR_BOTTOM))
    pen.lineTo((BAR_LEFT + lean, BAR_TOP))
    pen.lineTo((BAR_RIGHT + lean, BAR_TOP))
    pen.lineTo((BAR_RIGHT, BAR_BOTTOM))
    pen.closePath()
    return bar


def main() -> None:
    font = TTFont(SOURCE)
    glyph_set = font.getGlyphSet()
    name = font.getBestCmap()[ord("7")]

    recording = DecomposingRecordingPen(glyph_set)
    glyph_set[name].draw(recording)
    seven = pathops.Path()
    recording.replay(seven.getPen())

    crossed = pathops.op(seven, crossbar(), pathops.PathOp.UNION, fix_winding=True)

    tt_pen = TTGlyphPen(glyph_set)
    crossed.draw(tt_pen)
    glyph = tt_pen.glyph()
    # The source hints were written for the old outline; an unhinted glyph is right for the new one.
    glyph.program = ttProgram.Program()
    glyph.program.fromBytecode(b"")
    font["glyf"][name] = glyph
    font["glyf"][name].recalcBounds(font["glyf"])
    advance, _ = font["hmtx"][name]
    font["hmtx"][name] = (advance, glyph.xMin)

    options = Options()
    options.flavor = "woff2"
    options.layout_features = []
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=[ord("7")])
    subsetter.subset(font)

    names = font["name"]
    for record in names.names:
        if record.nameID in (1, 4, 16, 18):
            names.setName("Bangers Seven", record.nameID, record.platformID, record.platEncID, record.langID)
        elif record.nameID == 6:
            names.setName("BangersSeven-Regular", record.nameID, record.platformID, record.platEncID, record.langID)
        elif record.nameID == 3:
            names.setName("Bangers Seven (crossed 7, issue #660)", 3, record.platformID, record.platEncID, record.langID)

    font.flavor = "woff2"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
