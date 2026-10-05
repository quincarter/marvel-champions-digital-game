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

import type Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import { drawArt } from "../../art/card-art.js";
import { accent, border, hit, ink, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fitText, fitWrapped, label, McButton, paintPanel } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import { targetingLayout, TARGETING_GAP, type TileText } from "../../view/targeting-layout.js";
import {
  touchWorded,
  type ExcludedGroup,
  type MultiPick,
  type TargetingPanel,
  type TargetOption,
} from "../../view/targeting-panel.js";
import type { BoardDrawContext } from "./context.js";
import { focusKey } from "./selection.js";

/** Which target tile is currently hovered or focused, so its confirm line draws — the one piece of state this draw needs that outlives a single draw call. */
export interface TargetingHover {
  readonly hoveredId: InstanceId | null;
  setHovered(id: InstanceId | null): void;
}

/** The footer a multi-pick panel keeps for its count, preview and Confirm. */
const FOOTER_HEIGHT = 60;

export function drawTargetingPanel(
  ctx: BoardDrawContext,
  viewport: Rect,
  panel: TargetingPanel,
  hover: TargetingHover,
  focused: InstanceId | null,
): void {
  const { scene } = ctx;
  // A panel that picks several tiles keeps a strip at the bottom for the count and Confirm; the tiles lay out above it.
  const bounds: Rect = panel.multi ? { ...viewport, height: viewport.height - FOOTER_HEIGHT } : viewport;
  // Tiles are as tall as their own text needs: measure it at the width a tile will have, then lay out again.
  const probe = targetingLayout(bounds, panel.options.length);
  const layout = targetingLayout(
    bounds,
    panel.options.length,
    measureTileText(scene, panel, probe.tileSize.width, !panel.multi),
  );
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

  scene.add
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

  const wide = layout.formFactor === "desktop" || layout.formFactor === "tabletLandscape";
  const touch = scene.sys.game.device.input.touch;
  panel.options.forEach((option, index) => {
    const tile: Rect = wide
      ? {
          x: layout.targets.x + index * (layout.tileSize.width + TARGETING_GAP),
          y: layout.targets.y,
          width: layout.tileSize.width,
          height: layout.tileSize.height,
        }
      : {
          x: layout.targets.x,
          y: layout.targets.y + index * (layout.tileSize.height + TARGETING_GAP),
          width: layout.tileSize.width,
          height: layout.tileSize.height,
        };
    drawTargetTile(
      ctx,
      tile,
      layout.artHeight,
      option,
      active === option.instanceId,
      hover,
      panel.multi ?? null,
      touch,
    );
  });

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

  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "secondary",
      // The Esc hint is for a keyboard, and a phone button 84 px wide cannot hold it without clipping.
      label: formFactor === "desktop" || formFactor === "tabletLandscape" ? "Cancel · Esc" : "Cancel",
      type: typeRole.label,
      rect: cancelRect,
      onClick: () => ctx.controller.cancel(),
    }),
  );
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

  ctx.frame.hitRects.set(option.instanceId, rect);
  ctx.frame.focusRects.set(focusKey({ kind: "card", instanceId: option.instanceId }), rect);

  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerover", () => hover.setHovered(option.instanceId));
  zone.on("pointerout", () => {
    if (hover.hoveredId === option.instanceId) hover.setHovered(null);
  });
  zone.on("pointerup", () => ctx.controller.tapInMode(option.instanceId));
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
      onClick: () => void ctx.controller.confirmInPlayCost(),
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
  zone.on("pointerup", () => ctx.inspect(source.instanceId));
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
