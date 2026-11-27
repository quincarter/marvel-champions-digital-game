/**
 * The issue pips of a campaign (the Saga's featured card, the Cover): one box per issue, a filled light one for an issue
 * done, the red one (ringed in light) for the issue up next, an outlined one for the rest. Drawn as `mc-sheet` parts on an
 * ink panel (`ui/campaign-chrome.ts`'s Phaser `issuePips` is gone with the Phaser Saga and Cover).
 */
import { accent } from "../tokens.js";
import type { PipState } from "../ui/campaign-chrome.js";
import type { Rect } from "../view/layout.js";
import type { SheetBuilder } from "./sheet-builder.js";

/**
 * A paper-light that dark mode leaves alone (it is no token): the pips sit on an ink panel that is dark in both modes, so
 * a `paper` fill, which dark mode turns dark, would vanish on it.
 */
const PIP_LIGHT = 0xf4efe4;

export function drawIssuePips(b: SheetBuilder, rect: Rect, pips: readonly PipState[]): void {
  const gap = 5;
  const count = Math.max(1, pips.length);
  const width = (rect.width - gap * (count - 1)) / count;
  pips.forEach((state, index) => {
    const x = rect.x + index * (width + gap);
    if (state === "done") b.box({ x, y: rect.y, width, height: rect.height }, { fill: PIP_LIGHT });
    else if (state === "current") {
      b.box({ x: x - 2, y: rect.y - 2, width: width + 4, height: rect.height + 4 }, { fill: PIP_LIGHT });
      b.box({ x, y: rect.y, width, height: rect.height }, { fill: accent.heroRed.hex });
    } else
      b.box(
        { x: x + 1, y: rect.y + 1, width: width - 2, height: rect.height - 2 },
        { stroke: PIP_LIGHT, strokeWidth: 2, alpha: 0.35 },
      );
  });
}
