/**
 * The threat zone: the main scheme (and, for Tower Defense, its own extra main scheme — MC21 p. 10: "Both main
 * schemes are active each round" — `BoardModel.extraMainSchemes`) and every side scheme in play.
 *
 * Where the rows go is `view/scheme-list-layout.ts`'s decision. When they do not all fit the panel the main scheme
 * stays pinned at the top and the side schemes scroll under it in a clipped region (wheel, drag or touch, and
 * keyboard focus brings a scheme into view), so a row is never drawn outside the panel. Under the Large schemes
 * setting (`largeSchemeListLayout`) every scheme is a large card and the whole list scrolls, mains included.
 */

import { cardRectInRow } from "../../view/card-hover.js";
import { drawArt } from "../../art/card-art.js";
import { countTween } from "../../ui/bound-tween.js";
import { McScrollRegion } from "../../ui/scroll-region.js";
import { ink, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { fitWrapped, label, paintPanel, paintThreatMeter } from "../../ui/widgets.js";
import { counterNote, scenarioAreaTag, type BoardModel, type SchemePanel } from "../../view/board-model.js";
import { CARD_ASPECT, type Rect } from "../../view/layout.js";
import {
  focusSliceOf,
  fullyVisible,
  largeSchemeListLayout,
  schemeListLayout,
  schemeRowGeometry,
  visibleSlice,
  type LargeSchemeShape,
  type SchemeListLayout,
} from "../../view/scheme-list-layout.js";
import { VariableListScroll } from "../../view/variable-list-scroll.js";
import { threatFromValue } from "../../view/threat-motion.js";
import { drawFootStrip } from "./character-panel.js";
import { FOOT_STRIP_HEIGHT, footStripLayout } from "../../view/foot-strip-layout.js";
import type { BoardDrawContext } from "./context.js";
import { dimAlpha, focusKey, targetState } from "./selection.js";
import { drawTuckedRow } from "./tucked-row.js";
import { addTapTarget } from "./tap-target.js";
import type { InstanceId } from "@mc/engine";
import type { RowDrag } from "../../view/hand-scroll.js";
import { McButton, fitText } from "../../ui/widgets.js";
import { schemeStackLayout, stackOrder } from "../../view/scheme-list-layout.js";
import { StackSwipe, schemePickIds, stackFlip, stackFrontAfter, stackShowsEligible } from "../../view/scheme-stack.js";

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
  /** Stack schemes: the scheme at the front of the stack (null: the main scheme). */
  stackFront: InstanceId | null = null;
  /** The open target list the stack last brought a target forward for, as a key. */
  stackTargets: string | null = null;
  /** The swipe on the stack's front card, kept across the redraw a flip makes mid-drag. */
  readonly swipe = new StackSwipe();
}

export function drawSchemes(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", "rest");

  // Tower Defense's own second main scheme is drawn like the first, pinned above the side schemes.
  const all = [model.mainScheme, ...model.extraMainSchemes, ...model.sideSchemes];
  const counts = {
    mains: 1 + model.extraMainSchemes.length,
    sides: model.sideSchemes.length,
    // Room for the scenario area lines (`SchemeAreaNote`) between the subtitle and the meter.
    mainExtra: (model.mainScheme.areaNotes?.length ?? 0) * (FOOT_STRIP_HEIGHT + 3),
  };
  // Stack schemes: one large card at the front, the rest behind it like a deck (a lone scheme is just the large card).
  // A prompt that can pick a scheme hidden past the stack's bands lists every scheme instead, for as long as it is up.
  if (ctx.schemeStack && all.length > 1 && drawSchemeStack(ctx, rect, all)) return;
  // Large schemes: every scheme as a large card, scrolling inside this panel; the table's layout is the same either way.
  const large =
    ctx.largeSchemes || ctx.schemeStack
      ? largeSchemeListLayout(rect, {
          mains: counts.mains,
          sides: counts.sides,
          infoExtra: Math.max(...all.map((scheme) => largeInfoExtra(ctx, scheme))),
        })
      : null;
  const list = large ?? schemeListLayout(rect, { ...counts, tabbed: ctx.tabbed, scale: ctx.cardScale });
  const shape = large?.shape ?? null;

  const scrolling = list.rows.filter((row) => !row.pinned);
  if (!list.viewport || !list.scrolls || scrolling.length === 0) {
    for (const row of list.rows) drawScheme(ctx, row.rect, all[row.index]!, shape);
    return;
  }
  for (const row of list.rows) if (row.pinned) drawScheme(ctx, row.rect, all[row.index]!, shape);
  drawScrollingRows(ctx, list, list.viewport, all, shape);
}

/**
 * The lines a scheme draws between its subtitle and its meter (counters, area notes, tucked cards, a printed ability),
 * as the room they take under a large card drawn above its text, so the setting never hides one of them.
 */
function largeInfoExtra(ctx: BoardDrawContext, scheme: SchemePanel): number {
  let extra = 0;
  if (counterNote(scheme.counters)) extra += 14;
  extra += (scheme.areaNotes?.length ?? 0) * (FOOT_STRIP_HEIGHT + 3);
  if (scheme.tuckedCount > 0 && scheme.tuckedLabel) extra += (scheme.targetNote ? 14 : 0) + FOOT_STRIP_HEIGHT + 3;
  if (ctx.controller.abilityLine(scheme.instanceId)) extra += FOOT_STRIP_HEIGHT + 2;
  return extra;
}

/** Where in a sideways scheme scan its name band sits, as `drawArt`'s `focusY` for a band cut across the card. */
const STACK_NAME_BAND = 0.1;

/**
 * Stack schemes (Quin, 2026-11-18): the schemes stacked like a deck. The front one is the large card, with its meter
 * and lines; behind it up to three more show their printed name bands. A band is the scheme's own tap, focus, hover
 * and target rect: tapped it comes to the front (or, in a target prompt, it is the target). The front card fans every
 * scheme out (`scenes/scheme-fan.ts`), a sideways swipe on it flips through them, and the header's arrows do the same.
 * A target prompt that opens with targets in the stack brings the first of them to the front (`view/scheme-stack.ts`);
 * the other answers the table takes on a card (dividing power, picking a source) do not move the stack, and a band
 * still answers them.
 *
 * A pad or keyboard reaches the same: A on a band brings it forward and A on the front card opens the fan, which lists
 * every scheme, those past the three bands too (`BoardDrawContext.activateCard`). Inspect stays on its own button.
 */
function drawSchemeStack(ctx: BoardDrawContext, rect: Rect, all: readonly SchemePanel[]): boolean {
  const { scene, schemeScroll: state } = ctx;
  const ids = all.map((scheme) => scheme.instanceId);
  const selection = ctx.controller.selection;
  const decided = stackFrontAfter({
    ids,
    front: state.stackFront,
    targets: selection.kind === "targeting" ? selection.action.targets : null,
    lastTargetsKey: state.stackTargets,
  });
  state.stackFront = decided.front;
  state.stackTargets = decided.targetsKey;
  const frontIndex = Math.max(0, decided.front ? ids.indexOf(decided.front) : 0);
  const order = stackOrder(all, frontIndex);
  const infoExtra = Math.max(...all.map((scheme) => largeInfoExtra(ctx, scheme)));
  const stack = schemeStackLayout(rect, all.length, infoExtra);
  // A decision that answers on the table (a target, divided power, a cost or a discard) and can pick a scheme the stack
  // hides past the bands it actually draws is answered on the full list instead (Codex review on PR #831, review on
  // #834): there every scheme is a focus stop. A decision asked on a sheet of its own picks no scheme and keeps the stack.
  const eligible = schemePickIds(selection.kind, ids, (id) => targetState(selection, id) !== "unavailable");
  if (
    !stackShowsEligible(
      order.map((scheme) => scheme.instanceId),
      eligible,
      stack.behind.length,
    )
  )
    return false;
  const bringForward = (id: InstanceId): void => {
    state.stackFront = id;
    ctx.requestDraw();
  };
  const flip = (step: 1 | -1): void => {
    const next = stackFlip(ids, state.stackFront, step);
    if (next) bringForward(next);
  };
  const fan = (): void => ctx.openSchemeFan(order, bringForward);

  // The header: which card of how many is at the front, the arrows, and Fan out.
  const { header } = stack;
  const buttonType = { ...typeRole.label, size: 12 };
  const arrowType = { ...typeRole.label, size: 18 };
  const fanWidth = Math.min(96, Math.max(64, header.width * 0.28));
  const arrow = 34;
  const fanRect: Rect = {
    x: header.x + header.width - fanWidth,
    y: header.y + 2,
    width: fanWidth,
    height: header.height - 4,
  };
  const nextRect: Rect = { ...fanRect, x: fanRect.x - 6 - arrow, width: arrow };
  const prevRect: Rect = { ...nextRect, x: nextRect.x - 4 - arrow };
  const count = label(
    scene,
    header.x,
    header.y + header.height / 2,
    `SCHEMES · ${frontIndex + 1} OF ${all.length}`,
    typeRole.label,
    surface.ink.hex,
    ink.label,
  ).setOrigin(0, 0.5);
  fitText(count, Math.max(20, prevRect.x - header.x - 6), typeRole.label.size);
  ctx.frame.buttons.push(
    new McButton(scene, { kind: "secondary", label: "◂", type: arrowType, rect: prevRect, onClick: () => flip(-1) }),
    new McButton(scene, { kind: "secondary", label: "▸", type: arrowType, rect: nextRect, onClick: () => flip(1) }),
    new McButton(scene, { kind: "secondary", label: "Fan out", type: buttonType, rect: fanRect, onClick: fan }),
  );

  // The cards behind, deepest first so each nearer one covers it.
  const behind = stack.behind.map((slot, at) => ({ slot, scheme: order[at + 1]! }));
  for (const { slot, scheme } of [...behind].reverse()) {
    const dim = dimAlpha(selection, scheme.instanceId);
    const frame = scene.add.graphics();
    paintPanel(
      frame,
      { x: slot.card.x - 3, y: slot.card.y - 3, width: slot.card.width + 6, height: slot.card.height + 6 },
      "card",
      targetState(selection, scheme.instanceId),
    );
    frame.fillStyle(surface.parchment.hex, dim).fillRect(slot.card.x, slot.card.y, slot.card.width, slot.card.height);
    // Only the band above the card in front shows, so the band is cut from the scan where a scheme prints its name.
    drawArt(scene, ctx.art.request(scene, scheme.art), slot.peek, {
      alpha: dim,
      fit: "cover",
      focusY: STACK_NAME_BAND,
    });
  }
  // The front card, whole, over them. A swipe flips as soon as it has travelled far enough (`StackSwipe`), so a slow
  // swipe that rests before it lifts still flips.
  const front = order[0]!;
  drawScheme(ctx, stack.front.rect, front, stack.front.shape, {
    onTap: fan,
    drag: {
      onDrag: (deltaX) => {
        const step = state.swipe.step(deltaX, scene.time.now);
        if (step !== 0) flip(step);
      },
      onDragEnd: () => state.swipe.end(),
    },
  });
  ctx.frame.cardActivate.set(front.instanceId, fan);
  // The bands take their taps after the front card is wired, each above the card in front of it. A band's popover is
  // the front card's size: the band is the same card, only further back.
  const frontArt = ctx.frame.hoverSizeRects.get(front.instanceId);
  for (const { slot, scheme } of behind) {
    ctx.frame.hitRects.set(scheme.instanceId, slot.peek);
    ctx.frame.hoverSizeRects.set(scheme.instanceId, frontArt ?? slot.card);
    ctx.frame.cardActivate.set(scheme.instanceId, () => bringForward(scheme.instanceId));
    ctx.makeTapTarget(slot.peek, scheme.instanceId, () => bringForward(scheme.instanceId));
  }
  return true;
}

/** The rows that scroll: drawn once at scroll 0 into a clipped region that moves them, with a hint at a cut edge. */
function drawScrollingRows(
  ctx: BoardDrawContext,
  list: SchemeListLayout,
  viewport: Rect,
  all: readonly SchemePanel[],
  shape: LargeSchemeShape | null,
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
      // A row scrolled out of view keeps a focus strip at the viewport's edge, so the D-pad reaches it (focus there
      // scrolls it in, above), but no tap rect (Codex review on PR #834).
      ctx.frame.focusRects.set(key, focusSliceOf(row.rect, offset, viewport));
      if (slice) ctx.frame.hitRects.set(id, slice);
      else ctx.frame.hitRects.delete(id);
    });
    hint?.(offset);
    if (armed) ctx.onRegionScroll();
  };

  const region = new McScrollRegion(scene, {
    rect: viewport,
    heights: list.heights,
    scroll: state.scroll,
    clipInteractive: true,
    onScroll: place,
  });
  ctx.frame.regions.push(region);
  if (list.heights.reduce((sum, height) => sum + height, 0) > viewport.height) ctx.frame.innerScroll.push(viewport);
  const before = scene.children.list.length;
  for (const row of rows) drawScheme(ctx, row.rect, all[row.index]!, shape);
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
/**
 * The art column's width in a scheme row, 0 when the row is too narrow for it. It widens with a taller row, so a grown
 * row shows a bigger card. Above Fit to screen (`cardScale` > 1) the column takes the scheme's own sideways shape, so
 * the larger Card size shows the whole card larger instead of fitting it into a portrait column.
 */
export function schemeArtWidth(rect: Rect, cardScale = 1): number {
  if (rect.width < 170) return 0;
  // Also a row 160px tall or more (an ultrawide's tall column; the 1440x900 table tops out at 150): a 120px portrait strip
  // beside a card-sized row wastes the room.
  const grown = cardScale > 1 || rect.height >= 160;
  const shaped = Math.round((rect.height - 6) * (grown ? 1 / CARD_ASPECT : CARD_ASPECT));
  return Math.round(Math.min(Math.max(96, shaped), rect.width * (grown ? 0.5 : 0.3)));
}

/** `large`: the Large schemes setting's card shape for this row (`largeSchemeListLayout`), null for the usual row. */
export function schemeMeterRect(rect: Rect, cardScale = 1, large: LargeSchemeShape | null = null): Rect {
  const { text } = schemeRowGeometry(rect, schemeArtWidth(rect, cardScale), large);
  // A short row (a side scheme at 52px) keeps a slimmer meter so its name and "SIDE SCHEME · WRECKER" stay above it.
  if (!large && schemeRowIsCompact(rect, cardScale)) {
    return {
      x: text.x,
      y: rect.y + rect.height - COMPACT_METER_HEIGHT - 4,
      width: text.width,
      height: COMPACT_METER_HEIGHT,
    };
  }
  return { x: text.x, y: rect.y + rect.height - 26, width: text.width, height: 18 };
}

/** The slim meter of a compact row. */
const COMPACT_METER_HEIGHT = 14;

/** A row too short for a name, its subtitle and the full-size meter one above the other (56px at Fit to screen). */
export function schemeRowIsCompact(rect: Rect, cardScale = 1): boolean {
  return rect.height < 60 * Math.max(1, cardScale);
}

/**
 * A scheme with the design's threat meter: fill is always Hero Red. The art
 * sits in a column on the left with a 3px rule beside it, which is how the
 * Long Table canvas frames a scheme. Returns the bottom edge it drew to.
 */
export function drawScheme(
  ctx: BoardDrawContext,
  rect: Rect,
  scheme: SchemePanel,
  large: LargeSchemeShape | null = null,
  /** The stack's front card: a tap fans the schemes out instead of opening Inspect, and a sideways swipe flips. */
  tap?: { readonly onTap: () => void; readonly drag?: RowDrag },
): number {
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
  // Large schemes sizes the card itself, beside the text or above it (`schemeRowGeometry`).
  const artWidth = schemeArtWidth(rect, ctx.cardScale);
  const geometry = schemeRowGeometry(rect, artWidth, large);
  const { text } = geometry;
  ctx.frame.hoverSizeRects.set(scheme.instanceId, large && geometry.art ? geometry.art : cardRectInRow(rect, artWidth));
  if (large) ctx.frame.largeSchemeShapes.set(scheme.instanceId, large);
  let artDrawn = false;
  if (geometry.art) {
    const column = geometry.art;
    const frame = scene.add.graphics();
    frame.fillStyle(surface.parchment.hex, dim).fillRect(column.x, column.y, column.width, column.height);
    const key = ctx.art.request(scene, scheme.art);
    artDrawn = drawArt(scene, key, column, { alpha: dim, focusY: 0.3 }) !== null;
    if (!artDrawn) {
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
    // The 3px rule between the card and the text: beside it, or under it for a large card drawn above the text.
    if (geometry.above)
      rule.fillStyle(surface.ink.hex, dim).fillRect(rect.x + 3, column.y + column.height, rect.width - 6, 3);
    else rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
  }

  const textLeft = text.x;
  const textWidth = text.width;
  const meter = schemeMeterRect(rect, ctx.cardScale, large);
  const compact = !large && schemeRowIsCompact(rect, ctx.cardScale);
  // The name and the subtitle (with whose game area it is in, Kang's per-player areas) stack above the meter: each wraps
  // whole words into the room that is left, and the subtitle starts under however many lines the name took, so a long
  // name never lands on "MAIN SCHEME 2" and the meter never covers "SIDE SCHEME · WRECKER".
  const nameText = scene.add
    .text(textLeft, text.y + (compact ? 3 : 6), scheme.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
    .setWordWrapWidth(textWidth);
  const nameLines = text.height >= 78 * (large ? 1 : Math.max(1, ctx.cardScale)) ? 2 : 1;
  fitWrapped(nameText, textWidth, nameLines, typeRole.rowTitle.size);
  // A large card drawn above its text already shows the name, once its scan is up; the subtitle starts the text under
  // it instead. Until then (or with no scan at all) the name stays, and a line of the subtitle gives way to it.
  const nameShown = !(geometry.above && artDrawn);
  if (!nameShown) nameText.setVisible(false);
  const subtitleTop = nameShown ? nameText.y + Math.ceil(nameText.height) + 1 : text.y + 6;
  const subtitleText = label(
    scene,
    textLeft,
    subtitleTop,
    scheme.areaLabel ? `${scheme.subtitle} · ${scheme.areaLabel}` : scheme.subtitle,
    typeRole.label,
    surface.ink.hex,
    ink.label * dim,
  );
  fitWrapped(subtitleText, textWidth, meter.y - 1 - subtitleTop >= 26 ? 2 : 1, typeRole.label.size);
  // The name standing in for a scan not up yet takes the subtitle's line under a large card when both don't fit.
  if (geometry.above && nameShown && subtitleTop + subtitleText.height > meter.y) subtitleText.setVisible(false);

  // A printed Hero/Alter-Ego Action or resource ability on the scheme itself
  // (The Grand Collection's "discard 1 card from The Collection", the Milano's
  // exhaust-to-remove-threat abilities printed on several cycle 2 schemes) —
  // the same `▶` affordance a character panel's foot strip gives its own
  // usable ability, drawn only where it fits above the threat meter.
  const abilityLine = ctx.controller.abilityLine(scheme.instanceId);
  // Counters the scheme itself holds (En Sabah Nur's Pyramid: "place 1 power counter here") get their own line, so
  // the tally that drives the scenario is on the table and not only in Inspect.
  let abilityTop = Math.max(text.y + (geometry.above ? 0 : 48), subtitleTop + Math.ceil(subtitleText.height) + 2);
  const counterText = counterNote(scheme.counters);
  if (counterText && abilityTop + 14 <= meter.y - 2) {
    label(scene, textLeft, abilityTop, counterText, typeRole.label, surface.ink.hex, ink.meta * dim);
    abilityTop += 14;
  }
  // A scenario area the scheme loses on (The Grand Collection's "at least 5 per hero cards in The Collection"): its
  // count against that limit, here beside the scheme rather than only on the encounter piles' column, which a phone
  // keeps on another tab. It comes before the ability line, which gives way when the row is short. Tapping it opens
  // the area's cards.
  const areaTargets: (() => void)[] = [];
  for (const note of scheme.areaNotes ?? []) {
    if (abilityTop + FOOT_STRIP_HEIGHT > meter.y - 2) break;
    const strip: Rect = { x: textLeft, y: abilityTop, width: textWidth, height: FOOT_STRIP_HEIGHT };
    drawFootStrip(scene, strip, note.caption, note.urgent ? "threat" : "note", dim, scenarioAreaTag(note));
    abilityTop += FOOT_STRIP_HEIGHT + 3;
    const first = note.instanceIds[0];
    // Not a card's own target (`makeTapTarget`): the pile tile keeps the card's focus ring, and a target prompt
    // answers on the cards themselves, not on this line.
    const open = first ? (): void => ctx.inspect(first, note.instanceIds) : null;
    if (open) areaTargets.push(() => addTapTarget(scene, strip, { onTap: open, onInspect: open }));
  }
  // Cards tucked under the scheme (Negative Zone Prison's defeated allies): the engine's target, then a row of card
  // backs under their label, or the label alone as a strip where the panel has no room for the row. Each back opens
  // Inspect (which follows the engine's visibility answer); the strip opens the first.
  let tuckedTargets: (() => void) | null = null;
  if (scheme.tuckedCount > 0 && scheme.tuckedLabel) {
    if (scheme.targetNote && abilityTop + 14 <= meter.y - 2) {
      label(scene, textLeft, abilityTop, scheme.targetNote, typeRole.label, surface.ink.hex, ink.meta * dim);
      abilityTop += 14;
    }
    const room: Rect = { x: textLeft, y: abilityTop, width: textWidth, height: meter.y - 4 - abilityTop };
    const row = drawTuckedRow(ctx, room, scheme, dim, scheme.tuckedLabel);
    if (row.height > 0) {
      abilityTop += row.height + 4;
      tuckedTargets = row.addTapTargets;
    } else if (abilityTop + FOOT_STRIP_HEIGHT <= meter.y - 2) {
      const strip: Rect = { x: textLeft, y: abilityTop, width: textWidth, height: FOOT_STRIP_HEIGHT };
      drawFootStrip(scene, strip, scheme.tuckedLabel, "note", dim);
      abilityTop += FOOT_STRIP_HEIGHT + 3;
      const siblings = scheme.tucked.map((card) => card.instanceId);
      tuckedTargets = () =>
        ctx.makeTapTarget(strip, scheme.tucked[0]!.instanceId, () =>
          ctx.inspect(scheme.tucked[0]!.instanceId, siblings),
        );
    }
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
  const paintMeter = (threat: number): void =>
    paintThreatMeter(mg, meterText, meter, scheme, threat, dim, null, compact ? 10 : undefined);

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

  ctx.makeTapTarget(
    rect,
    scheme.instanceId,
    tap?.onTap ?? (() => ctx.controller.onCharacterTap(scheme.instanceId)),
    tap?.drag,
  );
  tuckedTargets?.();
  for (const target of areaTargets) target();
  return rect.y + rect.height;
}
