/**
 * The aspect chip's tip (`ui/aspect-tip.ts`'s panel) as parts of an `mc-sheet`, for a screen whose chips are a Lit
 * panel: the aspect's name, tagline and short tip, an "Aspects ▸" link to its lesson, on an ink plate with a caution
 * rule and an arrow toward the chip's "i". The same numbers, so the tip sits where the Phaser one did: below the
 * segment by default, above where there is no room below, clamped inside the screen.
 */
import { border, ink, signal, surface, typeRole } from "../tokens.js";
import type { AspectTipContent } from "../view/aspect-tip-model.js";
import type { Rect } from "../view/layout.js";
import type { SheetBuilder } from "./sheet-builder.js";

export const TIP_WIDTH = 220;
const PAD = 10;
const GAP = 8;
const ARROW = 7;
/** The key of the tip's lesson link (a tap on it opens the aspect's lesson). */
export const TIP_LINK_KEY = "aspect-tip-link";

export interface TipPlacement {
  /** The plate. */
  readonly panel: Rect;
  /** Where the arrow's point is: x along the plate's edge, which edge. */
  readonly arrowX: number;
  readonly above: boolean;
  /** The plate and its arrow, the region the sheet covers. */
  readonly bounds: Rect;
}

/**
 * Where the tip sits for a chip segment at `anchor` inside `viewport` (the placement math `ui/tooltip.ts` uses): centered on
 * the segment and clamped to the viewport, below it unless there is no room, then above.
 */
export function tipPlacement(anchor: Rect, contentHeight: number, viewport: Rect): TipPlacement {
  const centerX = anchor.x + anchor.width / 2;
  const x = Math.max(viewport.x + 4, Math.min(centerX - TIP_WIDTH / 2, viewport.x + viewport.width - TIP_WIDTH - 4));
  const clearBelow = anchor.y + anchor.height;
  const spaceBelow = viewport.y + viewport.height - clearBelow;
  const above = spaceBelow < contentHeight + GAP + ARROW;
  const y = above ? anchor.y - GAP - ARROW - contentHeight : clearBelow + GAP + ARROW;
  const panel: Rect = { x, y, width: TIP_WIDTH, height: contentHeight };
  const arrowX = Math.max(panel.x + ARROW, Math.min(centerX, panel.x + panel.width - ARROW));
  const bounds: Rect = above
    ? { x: panel.x, y: panel.y, width: panel.width, height: panel.height + ARROW }
    : { x: panel.x, y: panel.y - ARROW, width: panel.width, height: panel.height + ARROW };
  return { panel, arrowX, above, bounds };
}

/** The words of a tip, measured and laid out: how tall the plate is and where each part sits inside it. */
export function tipLayoutOf(
  b: SheetBuilder,
  content: AspectTipContent,
): {
  readonly height: number;
  readonly link: string;
  readonly title: number;
  readonly tagline: number;
  readonly tip: number;
  readonly linkHeight: number;
} {
  const wrap = TIP_WIDTH - PAD * 2;
  const title = b.measure(content.title, typeRole.sectionHeader, { size: 16 }).height;
  const tagline = b.measure(content.tagline, typeRole.body, { wrapWidth: wrap }).height;
  const tip = b.measure(content.tipLine, typeRole.body, { wrapWidth: wrap }).height;
  const link = content.linkAvailable ? content.linkLabel : `${content.linkLabel} · ${content.linkReason}`;
  const linkHeight = b.measure(link, typeRole.label).height;
  return { height: PAD + title + 6 + tagline + 6 + tip + 8 + linkHeight + PAD, link, title, tagline, tip, linkHeight };
}

/**
 * Draws the tip into `b`, whose origin is `placement.bounds`' top left (so the sheet covers only the plate and its arrow:
 * a tip must not take the presses of the screen around it). Returns the link's rect when it is a live link.
 */
export function drawAspectTip(
  b: SheetBuilder,
  placement: TipPlacement,
  content: AspectTipContent,
  layout: ReturnType<typeof tipLayoutOf>,
): Rect | null {
  const { panel, arrowX, above } = placement;
  const wrap = TIP_WIDTH - PAD * 2;
  b.box(panel, { fill: surface.ink.hex });
  b.box({ x: panel.x, y: panel.y + panel.height - 3, width: panel.width, height: 3 }, { fill: signal.caution.hex });
  b.box(panel, { stroke: surface.ink.hex, strokeWidth: border.detail });
  const by = above ? panel.y + panel.height : panel.y;
  b.poly(
    above
      ? [
          [arrowX - ARROW, by],
          [arrowX + ARROW, by],
          [arrowX, by + ARROW],
        ]
      : [
          [arrowX - ARROW, by],
          [arrowX + ARROW, by],
          [arrowX, by - ARROW],
        ],
    { fill: surface.ink.hex },
  );
  let y = panel.y + PAD;
  b.text(panel.x + PAD, y, content.title, typeRole.sectionHeader, { size: 16, color: surface.paper.hex });
  y += layout.title + 6;
  b.text(panel.x + PAD, y, content.tagline, typeRole.body, {
    color: surface.paper.hex,
    alpha: ink.secondary,
    wrapWidth: wrap,
  });
  y += layout.tagline + 6;
  b.text(panel.x + PAD, y, content.tipLine, typeRole.body, { color: surface.paper.hex, wrapWidth: wrap });
  y += layout.tip + 8;
  b.text(panel.x + PAD, y, layout.link, typeRole.label, {
    color: content.linkAvailable ? signal.caution.hex : surface.paper.hex,
    alpha: content.linkAvailable ? 1 : ink.disabled,
  });
  if (!content.linkAvailable) return null;
  // A target a thumb can hit: the link's own line and the plate's padding round it, the plate's whole width.
  const rect: Rect = { x: panel.x, y: y - 12, width: panel.width, height: layout.linkHeight + 12 + PAD };
  b.tap(TIP_LINK_KEY, rect);
  return rect;
}
