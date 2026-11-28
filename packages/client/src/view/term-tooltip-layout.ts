/**
 * Where a glossary term's tooltip panel goes (`ui/tooltip.ts`'s `show`, as pure numbers): 280 px wide, centered on the
 * term and clamped inside the viewport, above the term when there is room and below it when there is not, with an arrow
 * pointing at the term's own center. `scenes/how-to-win.ts` draws it as part of its Lit panel from these rects.
 */
import type { Rect } from "./layout.js";

export const TIP_WIDTH = 280;
export const TIP_PAD = 12;
export const TIP_GAP = 10;
export const TIP_ARROW = 8;
export const TIP_RULE = 3;
/** The gap between the title and the definition, and between the definition and the link. */
export const TIP_TITLE_GAP = 6;
export const TIP_LINK_GAP = 8;

export interface TermTooltipLayout {
  readonly panel: Rect;
  /** Flipped below the term (the arrow points up at it). */
  readonly below: boolean;
  /** The arrow's tip x, clamped to sit on the panel. */
  readonly tipX: number;
  readonly title: { readonly x: number; readonly y: number };
  readonly definition: { readonly x: number; readonly y: number };
  readonly link: Rect;
}

/** The panel's height for text of these three heights. */
export function termTooltipHeight(titleHeight: number, definitionHeight: number, linkHeight: number): number {
  return TIP_PAD + titleHeight + TIP_TITLE_GAP + definitionHeight + TIP_LINK_GAP + linkHeight + TIP_PAD + TIP_RULE;
}

export function termTooltipLayout(
  anchor: Rect,
  viewport: Rect,
  heights: { readonly title: number; readonly definition: number; readonly link: number },
  linkWidth: number,
): TermTooltipLayout {
  const height = termTooltipHeight(heights.title, heights.definition, heights.link);
  const center = anchor.x + anchor.width / 2;
  const x = Math.max(viewport.x + 4, Math.min(center - TIP_WIDTH / 2, viewport.x + viewport.width - TIP_WIDTH - 4));
  const need = height + TIP_GAP + TIP_ARROW;
  const below = anchor.y - viewport.y < need;
  const y = below ? anchor.y + anchor.height + TIP_GAP + TIP_ARROW : anchor.y - TIP_GAP - TIP_ARROW - height;
  const panel: Rect = { x, y, width: TIP_WIDTH, height };
  const titleAt = { x: x + TIP_PAD, y: y + TIP_PAD };
  const definitionAt = { x: x + TIP_PAD, y: titleAt.y + heights.title + TIP_TITLE_GAP };
  const linkY = definitionAt.y + heights.definition + TIP_LINK_GAP;
  return {
    panel,
    below,
    tipX: Math.max(x + TIP_ARROW, Math.min(center, x + TIP_WIDTH - TIP_ARROW)),
    title: titleAt,
    definition: definitionAt,
    link: { x: x + TIP_PAD, y: linkY, width: linkWidth, height: Math.max(heights.link, 20) },
  };
}
