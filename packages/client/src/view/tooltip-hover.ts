/**
 * Where a hover-opened glossary tooltip (`ui/tooltip.ts`) stays open. A dotted term's hit zone
 * (`ui/term-text.ts#addTerm`) is grown to at least `hit.target` tall around its word, so a mouse coming in from
 * above or below opens the tooltip while it's still outside the word's own label. Holding only over the label
 * closed it on the very next move, and the zone never fired `pointerover` again while the mouse stayed inside it:
 * the tooltip flickered and never stayed. So the hold area is the word grown the same way, plus the corridor
 * between it and the panel, so moving toward "RULES GLOSSARY ▸" never crosses a gap that closes it.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

/** The rects a pointer can be over while the tooltip stays open (the panel itself is checked separately). */
export function tooltipHoldRects(anchor: Rect, panel: Rect): readonly Rect[] {
  const height = Math.max(hit.target, anchor.height);
  const grown: Rect = { x: anchor.x, y: anchor.y + anchor.height / 2 - height / 2, width: anchor.width, height };
  const top = Math.min(grown.y + grown.height, panel.y + panel.height);
  const bottom = Math.max(grown.y, panel.y);
  const corridor: Rect = { x: anchor.x, y: Math.min(top, bottom), width: anchor.width, height: Math.abs(bottom - top) };
  return [grown, corridor];
}
