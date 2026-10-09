/**
 * The threat zone: the main scheme (and, for Tower Defense, its own extra main scheme — MC21 p. 10: "Both main
 * schemes are active each round" — `BoardModel.extraMainSchemes`) and every side scheme in play.
 *
 * Where the rows go is `view/scheme-list-layout.ts`'s decision. When they do not all fit the panel the main scheme
 * stays pinned at the top and the side schemes scroll under it in a clipped region (wheel, drag or touch, and
 * keyboard focus brings a scheme into view), so a row is never drawn outside the panel.
 */

import { drawArt } from "../../art/card-art.js";
import { countTween } from "../../ui/bound-tween.js";
import { McScrollRegion } from "../../ui/scroll-region.js";
import { ink, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { label, paintPanel, paintThreatMeter } from "../../ui/widgets.js";
import { counterNote, type BoardModel, type SchemePanel } from "../../view/board-model.js";
import { CARD_ASPECT, type Rect } from "../../view/layout.js";
import { fullyVisible, schemeListLayout, visibleSlice, type SchemeListLayout } from "../../view/scheme-list-layout.js";
import { VariableListScroll } from "../../view/variable-list-scroll.js";
import { threatFromValue } from "../../view/threat-motion.js";
import { drawFootStrip } from "./character-panel.js";
import { FOOT_STRIP_HEIGHT, footStripLayout } from "../../view/foot-strip-layout.js";
import type { BoardDrawContext } from "./context.js";
import { dimAlpha, focusKey, targetState } from "./selection.js";
import type { InstanceId } from "@mc/engine";

/**
 * The schemes column's scroll position and what it last scrolled to, kept by the scene across draws (a board redraw
 * rebuilds the region, and the position has to survive it, the way the hand's does).
 */
export class SchemeScrollState {
  readonly scroll = new VariableListScroll();
  /** The focused card the last scrolling draw saw, so a wheel scroll is not undone by the next redraw. */
  lastFocus: InstanceId | null = null;
  /** The open target list the last scrolling draw saw, as a key. */
  lastTargets: string | null = null;
}

export function drawSchemes(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", "rest");

  // Tower Defense's own second main scheme is drawn like the first, pinned above the side schemes.
  const all = [model.mainScheme, ...model.extraMainSchemes, ...model.sideSchemes];
  const list = schemeListLayout(rect, {
    mains: 1 + model.extraMainSchemes.length,
    sides: model.sideSchemes.length,
    tabbed: ctx.tabbed,
  });

  const scrolling = list.rows.filter((row) => !row.pinned);
  if (!list.viewport || !list.scrolls || scrolling.length === 0) {
    for (const row of list.rows) drawScheme(ctx, row.rect, all[row.index]!);
    return;
  }
  for (const row of list.rows) if (row.pinned) drawScheme(ctx, row.rect, all[row.index]!);
  drawScrollingRows(ctx, list, list.viewport, all);
}

/** The rows that scroll: drawn once at scroll 0 into a clipped region that moves them, with a hint at a cut edge. */
function drawScrollingRows(
  ctx: BoardDrawContext,
  list: SchemeListLayout,
  viewport: Rect,
  all: readonly SchemePanel[],
): void {
  const { scene, schemeScroll: state } = ctx;
  const rows = list.rows.filter((row) => !row.pinned);
  const ids = rows.map((row) => all[row.index]!.instanceId);

  // What to bring into view before drawing: the focused scheme, and the targets of a target prompt that just opened.
  if (state.lastFocus !== ctx.focusedCard) {
    state.lastFocus = ctx.focusedCard;
    const at = ctx.focusedCard ? ids.indexOf(ctx.focusedCard) : -1;
    if (at >= 0) state.scroll.scrollIntoView(at, list.heights, viewport.height);
  }
  const selection = ctx.controller.selection;
  const targets = selection.kind === "targeting" ? selection.action.targets : null;
  const targetKey = targets ? targets.join(",") : null;
  if (targetKey !== state.lastTargets) {
    state.lastTargets = targetKey;
    const wanted = targets ? rows.filter((_row, at) => targets.includes(ids[at]!)) : [];
    state.scroll.clamp(list.heights, viewport.height);
    const shown = wanted.some((row) => fullyVisible(row.rect, state.scroll.offsetPx, viewport));
    if (wanted.length > 0 && !shown) state.scroll.scrollIntoView(wanted[0]!.scrollIndex, list.heights, viewport.height);
  }

  // Where each scrolling row is right now: its rect, clipped to the viewport, is the tap, focus and ring rect, and a
  // row wholly scrolled off has none, so a ring or a beat is never drawn out of the panel.
  let armed = false;
  let hint: ((offset: number) => void) | null = null;
  const place = (offset: number): void => {
    rows.forEach((row, at) => {
      const id = ids[at]!;
      const slice = visibleSlice(row.rect, offset, viewport);
      const key = focusKey({ kind: "card", instanceId: id });
      if (slice) {
        ctx.frame.hitRects.set(id, slice);
        ctx.frame.focusRects.set(key, slice);
      } else {
        ctx.frame.hitRects.delete(id);
        ctx.frame.focusRects.delete(key);
      }
    });
    hint?.(offset);
    if (armed) ctx.onSchemeScroll();
  };

  const region = new McScrollRegion(scene, {
    rect: viewport,
    heights: list.heights,
    scroll: state.scroll,
    clipInteractive: true,
    onScroll: place,
  });
  ctx.frame.regions.push(region);
  const before = scene.children.list.length;
  for (const row of rows) drawScheme(ctx, row.rect, all[row.index]!);
  region.content.add(scene.children.list.slice(before));
  hint = drawScrollHint(ctx, viewport, list.heights);
  region.syncInteractivity();
  place(state.scroll.offsetPx);
  armed = true;
}

/**
 * A fade and a chevron on whichever edge of the schemes viewport has more rows past it: under the
 * last visible row while there are more below, under the pinned scheme once the list has been scrolled.
 */
function drawScrollHint(ctx: BoardDrawContext, viewport: Rect, heights: readonly number[]): (offset: number) => void {
  const { scene } = ctx;
  const total = heights.reduce((sum, height) => sum + height, 0);
  const maxOffset = Math.max(0, total - viewport.height);
  const band = 14;
  const g = scene.add.graphics();
  const style = { ...textStyle({ ...typeRole.label, size: 16 }, surface.ink.hex), fontStyle: "bold" };
  const down = scene.add
    .text(viewport.x + viewport.width - 16, viewport.y + viewport.height - 9, "", style)
    .setOrigin(0.5);
  const up = scene.add.text(viewport.x + viewport.width - 16, viewport.y + 9, "", style).setOrigin(0.5);
  return (offset) => {
    const more = offset < maxOffset - 0.5;
    const back = offset > 0.5;
    g.clear();
    // A stepped ramp of bars rather than a gradient fill, the same choice as the tabbed hand's hint: the strip
    // beside it is a masked layer, and a gradient drawn next to one blanked the board in headless GPU runs.
    const steps = 6;
    const step = band / steps;
    for (let i = 0; i < steps; i++) {
      const alpha = 0.2 + (0.75 * (i + 1)) / steps;
      g.fillStyle(surface.card.hex, alpha);
      if (more) g.fillRect(viewport.x, viewport.y + viewport.height - band + i * step, viewport.width, step);
      if (back) g.fillRect(viewport.x, viewport.y + band - (i + 1) * step, viewport.width, step);
    }
    down.setText(more ? "▾" : "").setVisible(more);
    up.setText(back ? "▴" : "").setVisible(back);
  };
}

/**
 * The threat meter's own rect within a scheme panel's `rect` — a pure function of the panel geometry (same
 * art-column math `drawScheme` uses for its own `textLeft`), exported so guided mode's thwart-step preview
 * (`scenes/board/guide-mount.ts`, `docs/guided-mode.md` §5.1 tile D01) can line an overlay up with the real meter
 * without duplicating this layout math or reaching into `drawScheme`'s own locals.
 */
export function schemeMeterRect(rect: Rect): Rect {
  const artWidth =
    rect.width >= 170
      ? Math.round(Math.min(Math.max(96, Math.round((rect.height - 6) * CARD_ASPECT)), rect.width * 0.3))
      : 0;
  const textLeft = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
  const textWidth = rect.x + rect.width - 8 - textLeft;
  return { x: textLeft, y: rect.y + rect.height - 26, width: textWidth, height: 18 };
}

/**
 * A scheme with the design's threat meter: fill is always Hero Red. The art
 * sits in a column on the left with a 3px rule beside it, which is how the
 * Long Table canvas frames a scheme. Returns the bottom edge it drew to.
 */
export function drawScheme(ctx: BoardDrawContext, rect: Rect, scheme: SchemePanel): number {
  const { scene } = ctx;
  const selection = ctx.controller.selection;
  ctx.frame.hitRects.set(scheme.instanceId, rect);
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", targetState(selection, scheme.instanceId));

  const dim = dimAlpha(selection, scheme.instanceId);
  // The art column earns its place whenever the name and the meter still fit
  // beside it. The old threshold was tuned for the long table and silently
  // dropped the main scheme's card on every narrower panel.
  // ...and the column widens with a taller row, so a grown row shows a bigger card, not the same 96px one.
  const artWidth =
    rect.width >= 170
      ? Math.round(Math.min(Math.max(96, Math.round((rect.height - 6) * CARD_ASPECT)), rect.width * 0.3))
      : 0;
  if (artWidth > 0) {
    const column: Rect = { x: rect.x + 3, y: rect.y + 3, width: artWidth, height: rect.height - 6 };
    const frame = scene.add.graphics();
    frame.fillStyle(surface.parchment.hex, dim).fillRect(column.x, column.y, column.width, column.height);
    const key = ctx.art.request(scene, scheme.art);
    if (!drawArt(scene, key, column, { alpha: dim, focusY: 0.3 })) {
      label(
        scene,
        column.x + column.width / 2,
        column.y + column.height / 2,
        "art",
        typeRole.label,
        surface.ink.hex,
        ink.meta * dim,
      ).setOrigin(0.5);
    }
    const rule = scene.add.graphics();
    rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
  }

  const textLeft = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
  const textWidth = rect.x + rect.width - 8 - textLeft;
  scene.add
    .text(textLeft, rect.y + 6, scheme.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
    .setWordWrapWidth(textWidth)
    .setMaxLines(2);
  label(scene, textLeft, rect.y + 30, scheme.subtitle, typeRole.label, surface.ink.hex, ink.label * dim);

  const meter = schemeMeterRect(rect);

  // A printed Hero/Alter-Ego Action or resource ability on the scheme itself
  // (The Grand Collection's "discard 1 card from The Collection", the Milano's
  // exhaust-to-remove-threat abilities printed on several cycle 2 schemes) —
  // the same `▶` affordance a character panel's foot strip gives its own
  // usable ability, drawn only where it fits above the threat meter.
  const abilityLine = ctx.controller.abilityLine(scheme.instanceId);
  // Counters the scheme itself holds (En Sabah Nur's Pyramid: "place 1 power counter here") get their own line, so
  // the tally that drives the scenario is on the table and not only in Inspect.
  let abilityTop = rect.y + 48;
  const counterText = counterNote(scheme.counters);
  if (counterText && abilityTop + 14 <= schemeMeterRect(rect).y - 2) {
    label(scene, textLeft, abilityTop, counterText, typeRole.label, surface.ink.hex, ink.meta * dim);
    abilityTop += 14;
  }
  // A name that does not fit one row wraps to two lines when the room above the meter allows, and only otherwise is
  // fitted to one row (the full text is the Inspect pop-up's).
  const wrapped = abilityLine ? footStripLayout(abilityLine, textWidth).height : FOOT_STRIP_HEIGHT;
  const abilityHeight = abilityTop + wrapped <= meter.y - 4 ? wrapped : FOOT_STRIP_HEIGHT;
  if (abilityLine && abilityTop + abilityHeight <= meter.y - 4) {
    drawFootStrip(
      scene,
      { x: textLeft, y: abilityTop, width: textWidth, height: abilityHeight },
      abilityLine,
      "ability",
      dim,
    );
  }
  const mg = scene.add.graphics();
  const meterText = scene.add
    .text(
      meter.x + meter.width / 2,
      meter.y + meter.height / 2 - 1,
      "",
      textStyle(typeRole.statSmall, surface.ink.hex, dim),
    )
    .setOrigin(0.5)
    .setFontSize(13);

  // Redrawn as a whole from `threat` each time this is called, so a `threatPlaced`/`threatRemoved` tween's
  // `onUpdate` (below) can slide the fill and count the number together the same way `McHpPlate.update()` re-runs
  // its own `redraw()`.
  const paintMeter = (threat: number): void => paintThreatMeter(mg, meterText, meter, scheme, threat, dim);

  const tick = ctx.motion.threatTick(scheme.instanceId);
  if (tick) {
    // Tied to the meter's graphics, for the same reason as the HP plates' counters (`ui/bound-tween.ts`).
    countTween(scene, mg, {
      from: threatFromValue(scheme.threat, tick.tick),
      to: scheme.threat,
      durationMs: tick.remainingMs,
      onStep: paintMeter,
    });
  } else {
    paintMeter(scheme.threat);
  }

  ctx.makeTapTarget(rect, scheme.instanceId, () => ctx.controller.onCharacterTap(scheme.instanceId));
  return rect.y + rect.height;
}
