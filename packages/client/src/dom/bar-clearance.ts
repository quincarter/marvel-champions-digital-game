/**
 * Where the dark mode tab leaves an ink top bar's title room (`ui/campaign-chrome.ts`'s `sheetThemeFor`, the one rule
 * every panel bar follows), for a screen whose bar is an `mc-top-bar` element: how far the title drops and where it must
 * end. The same numbers `dom/sheet-top-bar.ts` used, so a screen moved to elements keeps its title where it was.
 */
import type Phaser from "phaser";
import { hit } from "../tokens.js";
import { CAMPAIGN_TOP_BAR, estimateBangersWidth, sheetThemeFor } from "../ui/campaign-chrome.js";

export interface BarClearanceInput {
  readonly width: number;
  readonly phone: boolean;
  /** The Back button's words (a phone's is the bare arrow). */
  readonly back: string;
  /** The title, already in capitals. */
  readonly title: string;
  /** The small label at the right edge, or "". */
  readonly right: string;
}

export function barClearance(
  scene: Phaser.Scene,
  input: BarClearanceInput,
): { readonly drop: number; readonly maxRight: number } {
  const pad = input.phone ? 12 : 22;
  const backWidth = input.back
    ? Math.max(input.phone ? hit.target : 64, estimateBangersWidth(input.back, 22) + 26)
    : 0;
  const x = pad + (input.back ? backWidth + 14 : 0);
  const rightWidth = input.right ? input.right.length * 7.5 + 16 : 0;
  const size = input.phone ? 22 : 28;
  const barHeight = input.phone ? CAMPAIGN_TOP_BAR.phone : CAMPAIGN_TOP_BAR.wide;
  const room = input.width - pad - rightWidth - x;
  const { drop, maxRight } = sheetThemeFor(scene, {
    width: input.width,
    textLeft: x,
    textRight: x + Math.min(room, estimateBangersWidth(input.title, size)),
    textTop: barHeight / 2 - size / 2,
    textHeight: size,
    barHeight,
  });
  return { drop, maxRight: maxRight ?? 0 };
}
