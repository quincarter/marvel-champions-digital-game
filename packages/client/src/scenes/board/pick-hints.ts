/**
 * The glyphs of a direct pick on the Board (`view/pick-assign.ts`): the button or key that picks each candidate of the
 * "Who attacks?" bar and of the targeting panel, and the "more" hint when there are more candidates than one page of
 * slots. Registered as the bar or panel draws; what each one shows is asked of the controller on every apply, so paging
 * moves the glyphs without a redraw (`BoardScene#pagePicks` refreshes the hints).
 */

import type Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import type { CustomSpecs } from "../../ui/glyph-hints.js";
import { textStyle } from "../../ui/theme.js";
import { surface, typeRole } from "../../tokens.js";
import { pickGlyphSpecs, pickMoreGlyphSpecs, type GlyphSpec } from "../../view/input-glyph-model.js";
import { pickMoreText, pickSlotOfIndex, pickSlotsOf, pickWindow } from "../../view/pick-assign.js";
import type { BoardDrawContext } from "./context.js";

/** What a candidate's glyph shows now: its slot's button on this page, or nothing when it is on another page. */
export function pickSpecsOf(ctx: BoardDrawContext, id: InstanceId): CustomSpecs {
  return (set, snapshot, _layer, held): readonly GlyphSpec[] | null => {
    const ids = ctx.controller.pickIds();
    const index = ids?.indexOf(id) ?? -1;
    if (ids === null || index < 0) return null;
    // A pad never pages: slot n is always the nth candidate, and past the sixteenth there is no combo.
    const window = pickWindow(ids.length, set === "pad" ? 0 : ctx.controller.pickOffset(), pickSlotsOf(set));
    const slot = pickSlotOfIndex(window, index);
    return slot === null ? null : pickGlyphSpecs(slot, snapshot.state, snapshot.settings, set === "pad" ? held : null);
  };
}

/** A candidate's glyph at a point of its own (a tile's corner). Not on the tabbed phone layouts, which have no glyphs. */
export function registerPickGlyph(
  ctx: BoardDrawContext,
  id: InstanceId,
  height: number,
  place: (size: { width: number; height: number }) => { x: number; y: number } | null,
): void {
  if (ctx.tabbed) return;
  ctx.hints.custom(pickSpecsOf(ctx, id), height, place, { ground: "ink" });
}

/**
 * "more ▸ 1/2" with the glyphs that turn the page, shown only while there is more than one page. `place` gets the
 * glyph's full width and the word's, and returns the glyph's left edge and vertical center.
 */
export function registerPickMore(
  ctx: BoardDrawContext,
  height: number,
  place: (size: { full: number; height: number; wordWidth: number }) => { x: number; y: number } | null,
  color: number = surface.paper.hex,
): void {
  if (ctx.tabbed) return;
  const word: Phaser.GameObjects.Text = ctx.scene.add
    .text(0, 0, "", textStyle(typeRole.label, color))
    .setOrigin(0, 0.5)
    .setVisible(false);
  ctx.hints.custom(
    (set, snapshot) => {
      // Only the keyboard pages: a pad has a combo per candidate (`view/pick-assign.ts`).
      if (set === "pad") return null;
      const ids = ctx.controller.pickIds();
      if (ids === null) return null;
      const window = pickWindow(ids.length, ctx.controller.pickOffset(), pickSlotsOf(set));
      if (!window.paged) return null;
      const text = pickMoreText(window);
      if (word.text !== text) word.setText(text);
      return pickMoreGlyphSpecs(snapshot.state, snapshot.settings);
    },
    height,
    ({ full, height: shown }) => place({ full, height: shown, wordWidth: word.width }),
    { ground: "ink", word },
  );
}
