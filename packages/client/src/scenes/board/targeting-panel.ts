/**
 * The targeting panel (docs/phase4-screen-gaps.md §3 "W5"; design canvases D09 "Targeting", L06 "Inspect & target").
 *
 * Drawn over the whole table while `BoardController`'s target-select mode is open — the board stays visible under a
 * scrim (D09's own caption: "overlay · board stays legible, only legal targets stay lit"), and the panel itself
 * carries the title bar, the legal-target tiles, the "why not the others?" reasoning, and — at tablet landscape
 * (L06) — the source card's own inspector rail. Every number on it came from `view/targeting-panel.ts`'s
 * `TargetingPanel`, which is itself built from the engine's own `preview()`/`blockedTargets`; this file only lays
 * that data out and wires the taps.
 */

import { appSession } from "../../session.js";
import { inputDevice } from "../../platform/input-device.js";
import { cancelLabel } from "../../view/glyph-placement.js";
import { glyphSetOf } from "../../view/input-mode.js";
import type Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import { drawArt } from "../../art/card-art.js";
import { accent, border, hit, ink, surface, typeRole } from "../../tokens.js";
import { onTap } from "../../ui/tap.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fitText, fitWrapped, label, McButton, paintPanel } from "../../ui/widgets.js";
import { McScrollRegion } from "../../ui/scroll-region.js";
import type { Rect } from "../../view/layout.js";
import { focusSliceOf, fullyVisible, visibleSlice } from "../../view/scheme-list-layout.js";
import { targetingLayout, type TargetingLayout, type TileText } from "../../view/targeting-layout.js";
import { VariableListScroll } from "../../view/variable-list-scroll.js";
import {
  touchWorded,
  type ExcludedGroup,
  type MultiPick,
  type TargetingPanel,
  type TargetOption,
} from "../../view/targeting-panel.js";
import type { BoardDrawContext } from "./context.js";
import { registerPickGlyph, registerPickMore } from "./pick-hints.js";
import { focusKey } from "./selection.js";

/** The height of a candidate's pick glyph on a tile (the hint size setting scales it). */
const PICK_GLYPH_HEIGHT = 22;

/** Which target tile is currently hovered or focused, so its confirm line draws — the one piece of state this draw needs that outlives a single draw call. */
export interface TargetingHover {
  readonly hoveredId: InstanceId | null;
  setHovered(id: InstanceId | null): void;
}

/** The footer a multi-pick panel keeps for its count, preview and Confirm. */
const FOOTER_HEIGHT = 60;

/**
 * The tiles' scroll when they outrun the panel (seven Tech upgrades for Repurpose on a phone), kept by the Board across
 * the redraws a hover, a pick or a new state makes, and reset when the panel asks about a different set of cards.
 */
export class TargetingScrollState {
  readonly scroll = new VariableListScroll();
  /** The candidates the last draw showed, as a key: a new question starts at the top. */
  lastOptions: string | null = null;
  /** The focused tile the last draw saw, so a wheel scroll is not undone by the next redraw. */
  lastFocus: InstanceId | null = null;

  /** The panel closed or its tiles fit: the next question that scrolls starts at the top. */
  forget(): void {
    this.lastOptions = null;
    this.lastFocus = null;
    this.scroll.reset();
  }
}

export function drawTargetingPanel(
  ctx: BoardDrawContext,
  viewport: Rect,
  panel: TargetingPanel,
  hover: TargetingHover,
  focused: InstanceId | null,
  top = 0,
  scrollState: TargetingScrollState = new TargetingScrollState(),
): void {
  const { scene } = ctx;
  // A panel that picks several tiles keeps a strip at the bottom for the count and Confirm; the tiles lay out above it.
  const bounds: Rect = panel.multi ? { ...viewport, height: viewport.height - FOOTER_HEIGHT } : viewport;
  // Tiles are as tall as their own text needs: measure it at the width a tile will have, then lay out again.
  const hideExcluded = panel.hideExcluded ?? false;
  const probe = targetingLayout(bounds, panel.options.length, undefined, top, hideExcluded);
  const layoutAt = (width: number): TargetingLayout =>
    targetingLayout(
      bounds,
      panel.options.length,
      measureTileText(scene, panel, width, !panel.multi),
      top,
      hideExcluded,
    );
  let layout = layoutAt(probe.tileSize.width);
  // Scrolling tiles give up the scrollbar's strip: measure their text again at the width they are drawn.
  if (layout.tileSize.width < probe.tileSize.width - 0.5) layout = layoutAt(layout.tileSize.width);
  // The tile that reads as the default answer (the asking seat) until something else is hovered or focused.
  const active = hover.hoveredId ?? focused ?? panel.defaultId ?? null;

  // The scrim: dims the table without hiding it — legible, not blacked out. On a narrow layout the tiles and the
  // heading stack straight over the tab bar and the cards behind it, whose labels then read through the heading, so
  // there it is nearly opaque.
  const narrow = layout.formFactor === "phone" || layout.formFactor === "phoneLandscape";
  scene.add
    .graphics()
    .fillStyle(surface.ink.hex, narrow ? 1 : 0.62)
    .fillRect(viewport.x, viewport.y, viewport.width, viewport.height);

  drawTitleBar(ctx, layout.titleBar, layout.cancelButton, panel, layout.formFactor);

  const headingText = scene.add
    .text(
      layout.heading.x,
      layout.heading.y,
      panel.heading ?? `${panel.options.length} LEGAL TARGET${panel.options.length === 1 ? "" : "S"}`,
      textStyle(typeRole.label, surface.paper.hex),
    )
    .setLetterSpacing(1.2);
  scene.add
    .graphics()
    .fillStyle(surface.paper.hex, 0.4)
    .fillRect(
      layout.heading.x + 200,
      layout.heading.y + layout.heading.height / 2,
      Math.max(0, layout.heading.width - 200),
      border.detail,
    );

  const touch = scene.sys.game.device.input.touch;
  // Each tile's pick glyph is registered after the tiles are drawn: a glyph made while they draw would be swept into
  // the scrolling container and moved by the scroll twice (its place already follows the scroll).
  const glyphs: (() => void)[] = [];
  const drawTiles = (offset: () => number): void =>
    panel.options.forEach((option, index) => {
      drawTargetTile(
        ctx,
        layout.tiles[index]!,
        layout.artHeight,
        option,
        active === option.instanceId,
        hover,
        panel.multi ?? null,
        touch,
        offset,
        glyphs,
      );
    });
  if (layout.scrolls) drawScrollingTiles(ctx, layout, panel, scrollState, focused, drawTiles, glyphs);
  else {
    scrollState.forget();
    drawTiles(() => 0);
    for (const register of glyphs) register();
  }

  // More candidates than a page of buttons: the hint that turns the page follows the heading's words.
  registerPickMore(ctx, PICK_GLYPH_HEIGHT - 4, () => ({
    x: headingText.x + headingText.width + 14,
    y: layout.heading.y + layout.heading.height / 2,
  }));
  if (!panel.hideExcluded) drawExcludedPanel(ctx, layout.excluded, panel.excluded);
  if (panel.multi) {
    drawFooter(
      ctx,
      { x: viewport.x, y: viewport.y + viewport.height - FOOTER_HEIGHT, width: viewport.width, height: FOOTER_HEIGHT },
      panel.multi,
    );
  }

  if (layout.inspectorRail) drawInspectorRail(ctx, layout.inspectorRail, panel.source);
}

function drawTitleBar(
  ctx: BoardDrawContext,
  bar: Rect,
  cancelRect: Rect,
  panel: TargetingPanel,
  formFactor: string,
): void {
  const { scene } = ctx;
  scene.add.graphics().fillStyle(accent.heroRed.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);

  const narrow = formFactor === "phone" || formFactor === "phoneLandscape" || formFactor === "tabletPortrait";
  if (narrow) {
    // The title and its source each wrap to what they need, never clipped: "Energy Transfer: choose a target" takes
    // two lines rather than "cho…". Separate texts, so the title stays its own line for a screen reader.
    const room = Math.max(60, cancelRect.x - 12 - (bar.x + 12));
    const title = scene.add
      .text(bar.x + 12, bar.y + 6, panel.title, textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0, 0)
      .setLetterSpacing(1);
    fitWrapped(title, room, 2, typeRole.barTitle.size);
    const source = scene.add
      .text(bar.x + 12, title.y + title.height + 2, panel.source.label, textStyle(typeRole.emphasis, surface.paper.hex))
      .setOrigin(0, 0);
    fitWrapped(source, room, 2, typeRole.emphasis.size);
  } else {
    const title = scene.add
      .text(bar.x + 16, bar.y + bar.height / 2, panel.title, textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    const sourceLeft = bar.x + 16 + title.width + 16;
    const sourceRight = cancelRect.x - 12;
    const sourceWidth = sourceRight - sourceLeft;
    if (sourceWidth > 40) {
      const source = scene.add
        .text(sourceLeft, bar.y + bar.height / 2, panel.source.label, textStyle(typeRole.emphasis, surface.paper.hex))
        .setOrigin(0, 0.5);
      // `fitText` shrinks the font first and only drops characters once even the caption floor doesn't fit.
      fitText(source, sourceWidth, typeRole.emphasis.size);
    }
  }

  // Desktop and tablet landscape only: a phone button has no room for the Esc hint or its glyph.
  const hinted = formFactor === "desktop" || formFactor === "tabletLandscape";
  // Until a key or pad has been used (`glyphSetOf` null) the old "Cancel · Esc" text stays; after, a B / Esc glyph
  // sits beside the word instead and the label is just "Cancel" (`view/glyph-placement.ts#cancelLabel`).
  const settings = appSession().settings;
  const cancelButton = new McButton(scene, {
    kind: "secondary",
    label: cancelLabel(hinted, glyphSetOf(inputDevice(), settings.inputGlyphs, settings.glyphSource)),
    type: typeRole.label,
    rect: cancelRect,
    onClick: () => ctx.controller.cancel(),
  });
  ctx.frame.buttons.push(cancelButton);
  if (hinted) {
    // Scene-scoped: the hints drop this listener at the next redraw and at shutdown, and it only touches the button
    // when the label actually changes.
    ctx.hints.onSnapshot((snapshot) => {
      const label = cancelLabel(
        true,
        glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource),
      );
      if (cancelButton.container.active && label !== cancelButton.label) cancelButton.update({ label });
    });
    ctx.hints.button(cancelButton, ["cancel"], "paper");
  }
  ctx.frame.focusRects.set(focusKey({ kind: "cancel" }), cancelRect);
}

/**
 * One legal target: an art band (D09's own tiles carry one, even as a placeholder), the name, its worded outcome,
 * and — while hovered or focused — the confirm line pinned to the bottom edge. Every tile reads as "selected"
 * (a red border, `paintPanel`'s own `card`/`selected` skin) regardless of hover, since every one of these is a real,
 * legal choice — the pulsing ring (`BoardScene#drawTargetRings`, keyed off the same `hitRects` this sets) is what
 * marks "awaiting your tap" on top of it.
 */
function drawTargetTile(
  ctx: BoardDrawContext,
  rect: Rect,
  artBand: number,
  option: TargetOption,
  active: boolean,
  hover: TargetingHover,
  multi: MultiPick | null,
  touch: boolean,
  /** How far the tiles are scrolled (0 when they fit): the rings, focus and glyphs follow the tile on screen. */
  offset: () => number,
  /** Where the tile leaves its pick glyph's registration, for the caller to run once every tile is drawn. */
  glyphs: (() => void)[],
): void {
  const { scene } = ctx;
  if (rect.width <= 0 || rect.height <= 0) return;
  // A multi-pick tile reads as picked or not (red border, and the words below: never the color alone).
  const picked = multi?.picked.has(option.instanceId) ?? false;
  paintPanel(scene.add.graphics(), rect, "card", multi && !picked ? "rest" : "selected");

  const pad = 8;
  const artHeight = Math.max(0, Math.min(artBand, rect.height - 40));
  if (artHeight > 24) {
    const artRect: Rect = {
      x: rect.x + border.object,
      y: rect.y + border.object,
      width: rect.width - border.object * 2,
      height: artHeight - border.object,
    };
    const key = ctx.art.request(scene, option.art);
    if (!drawArt(scene, key, artRect, { fit: "cover" })) {
      scene.add
        .graphics()
        .fillStyle(surface.parchment.hex, 1)
        .fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
      label(
        scene,
        artRect.x + artRect.width / 2,
        artRect.y + artRect.height / 2,
        "art",
        typeRole.label,
        surface.ink.hex,
        ink.meta,
      ).setOrigin(0.5);
    }
    scene.add
      .graphics()
      .fillStyle(surface.ink.hex, 1)
      .fillRect(artRect.x, artRect.y + artRect.height, artRect.width, border.detail);
  }

  const captionTop = artHeight > 24 ? rect.y + artHeight + 6 : rect.y + pad;
  const name = scene.add
    .text(rect.x + pad, captionTop, option.name, textStyle(typeRole.rowTitle, surface.ink.hex))
    .setWordWrapWidth(rect.width - pad * 2)
    .setMaxLines(2);

  const bodyTop = name.y + name.height + 6;
  // A multi-pick tile says it is picked with its badge; a hover line over its stats would only hide them.
  const showConfirmLine = active && !multi;
  const confirmReserve = showConfirmLine ? 30 : 0;
  const bodyBottom = rect.y + rect.height - pad - confirmReserve;
  if (option.lines.length > 0 && bodyBottom > bodyTop) {
    scene.add
      .text(rect.x + pad, bodyTop, option.lines.join("\n"), textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setWordWrapWidth(rect.width - pad * 2)
      .setLineSpacing(2);
  }

  if (showConfirmLine) {
    scene.add
      .graphics()
      .fillStyle(surface.ink.hex, 0.25)
      .fillRect(rect.x + border.object, rect.y + rect.height - pad - 26, rect.width - border.object * 2, 22);
    scene.add
      .text(
        rect.x + pad,
        rect.y + rect.height - pad - 22,
        touchWorded(option.confirmLine, touch),
        textStyle(typeRole.label, accent.heroRed.hex),
      )
      .setWordWrapWidth(rect.width - pad * 2)
      .setMaxLines(1);
  }

  if (picked) {
    const badge = scene.add
      .text(rect.x + rect.width - pad, rect.y + pad, "✓ PICKED", textStyle(typeRole.label, surface.paper.hex))
      .setOrigin(1, 0)
      .setPadding(5, 2, 5, 2)
      .setBackgroundColor(cssOf(accent.heroRed.hex));
    badge.setDepth(2);
  }

  // Inside a scrolling list `drawScrollingTiles` keeps the tap, ring and focus rects where the tile is on screen.
  ctx.frame.hitRects.set(option.instanceId, rect);
  ctx.frame.focusRects.set(focusKey({ kind: "card", instanceId: option.instanceId }), rect);
  // The button (or number key) that picks this tile outright, on the art's lower right corner above the name; none
  // while the tile is scrolled out of the list.
  glyphs.push(() =>
    registerPickGlyph(ctx, option.instanceId, PICK_GLYPH_HEIGHT, ({ width, height }) => {
      const y = (artHeight > 24 ? rect.y + artHeight - height / 2 - 6 : rect.y + height / 2 + 8) - offset();
      const shown = ctx.frame.hitRects.get(option.instanceId);
      if (!shown || y - height / 2 < shown.y || y + height / 2 > shown.y + shown.height) return null;
      return { x: rect.x + rect.width - width - 8, y };
    }),
  );

  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  // A touch has no hover, and the hover redraw rebuilds every zone on the board: from a finger it would race its own
  // tap. Only a mouse hovers.
  zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch) hover.setHovered(option.instanceId);
  });
  zone.on("pointerout", (pointer: Phaser.Input.Pointer) => {
    if (!pointer.wasTouch && hover.hoveredId === option.instanceId) hover.setHovered(null);
  });
  // The same press path as a button (`ui/tap.ts`): a tap that straddles a redraw still commits.
  onTap(zone, () => ctx.controller.tapInMode(option.instanceId), `target:${option.instanceId}`);
}

/**
 * The tiles when they outrun `layout.targets`: drawn once at the list's top into a clipped region that moves them (a
 * wheel, or a drag on the tiles; the scrollbar only shows where the list is, as in the schemes column, since
 * `McScrollRegion`'s thumb takes no drag), so every candidate can be reached. A tile's tap, ring and focus rect is the
 * part of it on screen, a tile scrolled out has no tap, and a drag that ends over a tile never presses it (the region
 * holds its controls inert while it moves; issue #227's rule). A focused tile, and a new question's first tile, are
 * brought into view.
 */
function drawScrollingTiles(
  ctx: BoardDrawContext,
  layout: TargetingLayout,
  panel: TargetingPanel,
  state: TargetingScrollState,
  focused: InstanceId | null,
  drawTiles: (offset: () => number) => void,
  glyphs: readonly (() => void)[],
): void {
  const { scene } = ctx;
  const viewport = layout.targets;
  const ids = panel.options.map((option) => option.instanceId);
  const key = ids.join(",");
  if (state.lastOptions !== key) {
    state.lastOptions = key;
    state.lastFocus = null;
    state.scroll.reset();
  }
  if (state.lastFocus !== focused) {
    state.lastFocus = focused;
    const at = focused ? ids.indexOf(focused) : -1;
    if (at >= 0 && !fullyVisible(layout.tiles[at]!, state.scroll.offsetPx, viewport))
      state.scroll.scrollIntoView(layout.lineOf[at]!, layout.lineHeights, viewport.height);
  }
  state.scroll.clamp(layout.lineHeights, viewport.height);

  let armed = false;
  let hint: ((offset: number) => void) | null = null;
  const place = (offset: number): void => {
    ids.forEach((id, at) => {
      const tile = layout.tiles[at]!;
      const slice = visibleSlice(tile, offset, viewport);
      ctx.frame.focusRects.set(focusKey({ kind: "card", instanceId: id }), focusSliceOf(tile, offset, viewport));
      if (slice) ctx.frame.hitRects.set(id, slice);
      else ctx.frame.hitRects.delete(id);
    });
    hint?.(offset);
    if (armed) {
      ctx.onRegionScroll();
      // The tiles' pick glyphs follow them; the tabbed phone layouts draw none.
      if (!ctx.tabbed) ctx.hints.refresh();
    }
  };

  const region = new McScrollRegion(scene, {
    rect: viewport,
    heights: layout.lineHeights,
    scroll: state.scroll,
    clipInteractive: true,
    onScroll: place,
  });
  ctx.frame.regions.push(region);
  ctx.frame.innerScroll.push(viewport);
  const before = scene.children.list.length;
  drawTiles(() => state.scroll.offsetPx);
  region.content.add(scene.children.list.slice(before));
  hint = drawMoreHint(ctx, viewport, layout.lineHeights);
  region.syncInteractivity();
  place(state.scroll.offsetPx);
  // Outside the scrolling container, and placed against the on-screen slices `place` just noted.
  for (const register of glyphs) register();
  armed = true;
}

/**
 * "▾ more" under the last tile on screen while there are more below, and "▴" once the list is scrolled: the cue that
 * the list goes on, with the scrollbar beside it.
 */
function drawMoreHint(ctx: BoardDrawContext, viewport: Rect, heights: readonly number[]): (offset: number) => void {
  const { scene } = ctx;
  const total = heights.reduce((sum, height) => sum + height, 0);
  const maxOffset = Math.max(0, total - viewport.height);
  const band = 18;
  const g = scene.add.graphics();
  const style = { ...textStyle({ ...typeRole.label, size: 16 }, surface.paper.hex), fontStyle: "bold" };
  const center = viewport.x + viewport.width / 2;
  const down = scene.add.text(center, viewport.y + viewport.height - 10, "", style).setOrigin(0.5);
  const up = scene.add.text(center, viewport.y + 10, "", style).setOrigin(0.5);
  return (offset) => {
    const more = offset < maxOffset - 0.5;
    const back = offset > 0.5;
    g.clear();
    // Stepped bars, not a gradient: the strip beside them is masked, and a gradient next to a masked layer blanked the
    // board in headless GPU runs (`schemes.ts`'s hint does the same).
    const steps = 6;
    const step = band / steps;
    for (let i = 0; i < steps; i++) {
      const alpha = 0.15 + (0.75 * (i + 1)) / steps;
      g.fillStyle(surface.ink.hex, alpha);
      if (more) g.fillRect(viewport.x, viewport.y + viewport.height - band + i * step, viewport.width, step);
      if (back) g.fillRect(viewport.x, viewport.y + band - (i + 1) * step, viewport.width, step);
    }
    down.setText(more ? "▾ more" : "").setVisible(more);
    up.setText(back ? "▴" : "").setVisible(back);
  };
}

/**
 * The multi-pick footer: the running count and the live preview on the left, Confirm on the right. Confirm is dim until
 * the count is one the cost takes, and says why on its own face.
 */
function drawFooter(ctx: BoardDrawContext, rect: Rect, multi: MultiPick): void {
  const { scene } = ctx;
  scene.add.graphics().fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  scene.add.graphics().fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);
  const buttonWidth = Math.max(96, Math.min(140, rect.width * 0.28));
  const textWidth = rect.width - buttonWidth - 36;
  const summary = scene.add
    .text(rect.x + 14, rect.y + 10, multi.summary, textStyle(typeRole.barTitle, surface.paper.hex))
    .setLetterSpacing(1);
  fitText(summary, textWidth, typeRole.barTitle.size);
  const second = multi.preview ?? multi.reason;
  if (second) {
    const line = scene.add.text(rect.x + 14, rect.y + 34, second, textStyle(typeRole.emphasis, surface.paper.hex));
    fitText(line, textWidth, typeRole.emphasis.size);
  }
  const confirmRect: Rect = {
    x: rect.x + rect.width - buttonWidth - 14,
    y: rect.y + (rect.height - hit.target) / 2 + 1,
    width: buttonWidth,
    height: hit.target,
  };
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "secondary",
      label: multi.confirmLabel,
      type: typeRole.label,
      rect: confirmRect,
      enabled: multi.canConfirm,
      ...(multi.reason ? { reason: multi.reason } : {}),
      onClick: () => void ctx.controller.confirmPick(),
    }),
  );
  ctx.frame.focusRects.set(focusKey({ kind: "confirm" }), confirmRect);
}

/**
 * "Why not the others?" — grouped by the engine's own reason, honestly empty when nothing was excluded.
 *
 * The panel behind the text hugs the content rather than filling all of `rect` (`layout.excluded`'s own doc comment:
 * "never zero height", not "always full height") — one excluded group reads as a short note, not a black rectangle
 * the size of the whole side column. Its final height is known only once every line has been laid out, so the text
 * is drawn first at a depth above the background, and the background — sized to that measured content — is drawn
 * last; `setDepth` (not draw order) is what still puts it behind text that already exists.
 */
function drawExcludedPanel(ctx: BoardDrawContext, rect: Rect, groups: readonly ExcludedGroup[]): void {
  const { scene } = ctx;
  if (rect.width <= 0 || rect.height <= 0) return;
  const pad = 12;
  const title = scene.add
    .text(rect.x + pad, rect.y + pad, "WHY NOT THE OTHERS?", textStyle(typeRole.rowTitle, surface.paper.hex))
    .setLetterSpacing(1)
    .setDepth(1);

  let y = title.y + title.height + 10;
  const bottom = rect.y + rect.height - 8;
  if (groups.length === 0) {
    const line = scene.add
      .text(
        rect.x + pad,
        y,
        "Nothing else in play was excluded.",
        textStyle(typeRole.body, surface.paper.hex, ink.secondary),
      )
      .setWordWrapWidth(rect.width - pad * 2)
      .setDepth(1);
    y = line.y + line.height;
  } else {
    for (const group of groups) {
      if (y >= bottom - 14) break;
      const line = scene.add
        .text(
          rect.x + pad,
          y,
          `${group.names.join(", ")} — ${group.label}`,
          textStyle(typeRole.body, surface.paper.hex, ink.secondary),
        )
        .setWordWrapWidth(rect.width - pad * 2)
        .setDepth(1);
      y += line.height + 8;
    }
  }

  const contentHeight = Math.min(rect.height, y + pad - rect.y);
  paintPanel(scene.add.graphics(), { x: rect.x, y: rect.y, width: rect.width, height: contentHeight }, "onInk", "rest");
}

/** The source card beside the target list — tablet landscape only (L06's "inspector rail replaces the phone sheet"). */
function drawInspectorRail(ctx: BoardDrawContext, rect: Rect, source: TargetingPanel["source"]): void {
  const { scene } = ctx;
  if (rect.width <= 0 || rect.height <= 0) return;
  paintPanel(scene.add.graphics(), rect, "onInk", "rest");
  const pad = 12;
  scene.add
    .text(rect.x + pad, rect.y + pad, "INSPECTOR", textStyle(typeRole.rowTitle, surface.paper.hex))
    .setLetterSpacing(1);

  const artHeight = Math.min(rect.height * 0.4, rect.width * 1.2);
  const artRect: Rect = { x: rect.x + pad, y: rect.y + pad + 24, width: rect.width - pad * 2, height: artHeight };
  const key = ctx.art.request(scene, source.art);
  if (!drawArt(scene, key, artRect, { fit: "contain" })) {
    scene.add
      .graphics()
      .fillStyle(surface.parchment.hex, 1)
      .fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
  }

  const name = scene.add
    .text(rect.x + pad, artRect.y + artRect.height + 10, source.name, textStyle(typeRole.rowTitle, surface.paper.hex))
    .setWordWrapWidth(rect.width - pad * 2)
    .setMaxLines(2);

  const openHint = scene.add
    .text(
      rect.x + pad,
      name.y + name.height + 12,
      "Tap to read the full card ▸",
      textStyle(typeRole.label, surface.paper.hex, ink.secondary),
    )
    .setWordWrapWidth(rect.width - pad * 2);

  const hitRect: Rect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: Math.min(rect.height, openHint.y + openHint.height + pad - rect.y),
  };
  const zone = scene.add
    .zone(hitRect.x, hitRect.y, hitRect.width, Math.max(hit.target, hitRect.height))
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  onTap(zone, () => ctx.inspect(source.instanceId), `source:${source.instanceId}`);
}

/**
 * The tallest tile's text — its name and outcome lines wrapped at the tile's width — so the layout can size the tiles to
 * their content (`view/targeting-layout.ts`'s `TileText`).
 */
function measureTileText(
  scene: Phaser.Scene,
  panel: TargetingPanel,
  tileWidth: number,
  withConfirm: boolean,
): TileText {
  const pad = 8;
  let tallest = 0;
  for (const option of panel.options) {
    const name = scene.add
      .text(0, 0, option.name, textStyle(typeRole.rowTitle, surface.ink.hex))
      .setWordWrapWidth(tileWidth - pad * 2)
      .setMaxLines(2);
    let height = name.height + 6;
    name.destroy();
    if (option.lines.length > 0) {
      const body = scene.add
        .text(0, 0, option.lines.join("\n"), textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setWordWrapWidth(tileWidth - pad * 2)
        .setLineSpacing(2);
      height += body.height;
      body.destroy();
    }
    tallest = Math.max(tallest, height);
  }
  return { textHeight: tallest, confirmReserve: withConfirm ? 30 : 0 };
}
