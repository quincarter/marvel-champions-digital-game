/**
 * The Filters button on Scenario select and Take your seats, where the chips are folded away
 * (`view/filters-layout.ts`: while a controller is in use, or below the width breakpoint). It sits where the layout
 * puts it (`filtersButton`), shows how many filters are set, opens and shuts the chips, and wears the Y glyph while a
 * pad is in use. On a wide screen a View glyph with "Inspect" sits beside it, since Y is the filters' on a pad.
 */

import type Phaser from "phaser";
import { ink, surface, typeRole } from "../tokens.js";
import type { GlyphHints } from "../ui/glyph-hints.js";
import { McButton, label } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import type { FocusStop } from "./focus-route.js";

const INSPECT_WIDTH = 104;
const GAP = 8;

/** The search field's rect with room cut from its right end for the Inspect hint beside the button (pad, wide only). */
export function searchRectForInspectHint(search: Rect, show: boolean): Rect {
  return show && search.height > 0 ? { ...search, width: search.width - INSPECT_WIDTH - GAP } : search;
}

export function drawFiltersControl(
  scene: Phaser.Scene,
  hints: GlyphHints,
  rect: Rect,
  text: string,
  inspectHint: boolean,
  onToggle: () => void,
  buttons: McButton[],
  stops: Map<string, FocusStop>,
): void {
  const button = new McButton(scene, {
    kind: "secondary",
    label: text,
    type: typeRole.rowTitle,
    rect,
    onClick: onToggle,
  });
  buttons.push(button);
  stops.set("filters-toggle", { rect, activate: onToggle });
  hints.button(button, ["inspect"], "paper", { when: (set) => set === "pad" });
  if (!inspectHint) return;
  // View opens the Inspect sheet here, because Y is the filters' (the keyboard's Inspect key is unchanged).
  const word = label(scene, 0, 0, "Inspect", typeRole.label, surface.ink.hex, ink.label).setOrigin(0, 0.5);
  hints.inline(rect.x - GAP - INSPECT_WIDTH + 4, rect.y + rect.height / 2, ["peek"], 16, {
    ground: "paper",
    word,
    when: (set) => set === "pad",
  });
}
