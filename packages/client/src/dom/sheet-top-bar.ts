/**
 * The ink top bar of the campaign-style screens (`ui/campaign-chrome.ts`'s `drawTopBar`) built as parts of an
 * `mc-sheet`: a boxed back button (with its Cancel glyph on a keyboard or pad), the Bangers title and a small
 * right-aligned label. The same numbers, so a screen moved to a panel keeps its bar where it was.
 */
import { hit, ink, surface, typeRole } from "../tokens.js";
import { bangers, estimateBangersWidth } from "../ui/campaign-chrome.js";
import type { Rect } from "../view/layout.js";
import type { SheetBuilder } from "./sheet-builder.js";
import type { SheetGlyphs } from "./sheet-glyphs.js";

export interface SheetTopBarOptions {
  /** The screen's width, whether it is a phone layout and the bar's height (`campaignFrame`). */
  readonly frame: { readonly width: number; readonly phone: boolean; readonly topBar: number };
  /** "◂ TITLE": a boxed paper-on-ink button. Omit for no back button. */
  readonly backLabel?: string;
  /** The back button's key in the sheet. */
  readonly backKey?: string;
  readonly title: string;
  /** The small uppercase label at the right edge ("12 OF 64 OPEN"). */
  readonly right?: string;
  /**
   * A long title on a phone: smaller and lower, clear of the dark mode tab that hangs from the top edge (20px, centered:
   * `view/theme-button.ts`), which a 22px title centered in the 52px bar would run under.
   */
  readonly titleBelowTab?: boolean;
}

export interface SheetTopBar {
  readonly height: number;
  readonly backRect: Rect | null;
}

export function sheetTopBar(b: SheetBuilder, glyphs: SheetGlyphs, options: SheetTopBarOptions): SheetTopBar {
  const { frame } = options;
  const height = frame.topBar;
  b.box({ x: 0, y: 0, width: frame.width, height }, { fill: surface.ink.hex });
  const pad = frame.phone ? 12 : 22;
  let x = pad;
  let backRect: Rect | null = null;
  if (options.backLabel) {
    const labelWidth = Math.max(frame.phone ? hit.target : 64, estimateBangersWidth(options.backLabel, 22) + 26);
    backRect = {
      x,
      y: (height - hit.target) / 2,
      width: frame.phone && options.backLabel.length <= 2 ? hit.target : labelWidth,
      height: hit.target,
    };
    glyphs.button(b, {
      key: options.backKey ?? "back",
      rect: backRect,
      label: options.backLabel,
      look: "onInk",
      type: typeRole.backLabel,
      ids: ["cancel"],
      ground: "ink",
    });
    x += backRect.width + 14;
  }
  let rightWidth = 0;
  if (options.right) {
    const right = options.right.toUpperCase();
    rightWidth = b.measure(right, typeRole.label, { letterSpacing: 1.1 }).width + 16;
    b.text(frame.width - pad, height / 2, right, typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.meta,
      origin: [1, 0.5],
      letterSpacing: 1.1,
    });
  }
  const below = options.titleBelowTab === true && frame.phone;
  b.text(x, below ? 40 : height / 2, options.title.toUpperCase(), bangers(below ? 16 : frame.phone ? 22 : 28), {
    color: surface.paper.hex,
    origin: [0, 0.5],
    letterSpacing: 1,
    fitWidth: frame.width - pad - rightWidth - x,
  });
  return { height, backRect };
}
