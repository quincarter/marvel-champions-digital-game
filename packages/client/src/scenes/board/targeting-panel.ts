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

import type { InstanceId } from "@mc/engine";
import { drawArt } from "../../art/card-art.js";
import { accent, border, hit, ink, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { fitText, label, McButton, paintPanel } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import { targetingLayout, TARGETING_GAP } from "../../view/targeting-layout.js";
import type { ExcludedGroup, TargetingPanel, TargetOption } from "../../view/targeting-panel.js";
import type { BoardDrawContext } from "./context.js";
import { focusKey } from "./selection.js";

/** Which target tile is currently hovered or focused, so its confirm line draws — the one piece of state this draw needs that outlives a single draw call. */
export interface TargetingHover {
  readonly hoveredId: InstanceId | null;
  setHovered(id: InstanceId | null): void;
}

export function drawTargetingPanel(
  ctx: BoardDrawContext,
  viewport: Rect,
  panel: TargetingPanel,
  hover: TargetingHover,
  focused: InstanceId | null,
): void {
  const { scene } = ctx;
  const layout = targetingLayout(viewport, panel.options.length);

  // The scrim: dims the table without hiding it — legible, not blacked out.
  scene.add
    .graphics()
    .fillStyle(surface.ink.hex, 0.62)
    .fillRect(viewport.x, viewport.y, viewport.width, viewport.height);

  drawTitleBar(ctx, layout.titleBar, layout.cancelButton, panel);

  scene.add
    .text(
      layout.heading.x,
      layout.heading.y,
      `${panel.options.length} LEGAL TARGET${panel.options.length === 1 ? "" : "S"}`,
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
    drawTargetTile(ctx, tile, option, hover.hoveredId === option.instanceId || focused === option.instanceId, hover);
  });

  drawExcludedPanel(ctx, layout.excluded, panel.excluded);

  if (layout.inspectorRail) drawInspectorRail(ctx, layout.inspectorRail, panel.source);
}

function drawTitleBar(ctx: BoardDrawContext, bar: Rect, cancelRect: Rect, panel: TargetingPanel): void {
  const { scene } = ctx;
  scene.add.graphics().fillStyle(accent.heroRed.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);

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
    // A word-wrap would keep the first line and *silently drop* the rest once it hit one line — losing exactly the
    // stat ("— Attack 2") that makes this label worth having, on the narrowest bars. `fitText` (`ui/widgets.ts`,
    // already how every `McButton` label avoids the same fate) shrinks the font first and only drops characters,
    // with an ellipsis, once even the caption floor doesn't fit.
    fitText(source, sourceWidth, typeRole.emphasis.size);
  }

  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "secondary",
      label: "Cancel · Esc",
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
  option: TargetOption,
  active: boolean,
  hover: TargetingHover,
): void {
  const { scene } = ctx;
  if (rect.width <= 0 || rect.height <= 0) return;
  paintPanel(scene.add.graphics(), rect, "card", "selected");

  const pad = 8;
  const artHeight = Math.max(0, Math.min(rect.height * 0.48, rect.width * 1.05));
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
  const confirmReserve = active ? 30 : 0;
  const bodyBottom = rect.y + rect.height - pad - confirmReserve;
  if (option.lines.length > 0 && bodyBottom > bodyTop) {
    scene.add
      .text(rect.x + pad, bodyTop, option.lines.join("\n"), textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setWordWrapWidth(rect.width - pad * 2)
      .setLineSpacing(2);
  }

  if (active) {
    scene.add
      .graphics()
      .fillStyle(surface.ink.hex, 0.25)
      .fillRect(rect.x + border.object, rect.y + rect.height - pad - 26, rect.width - border.object * 2, 22);
    scene.add
      .text(
        rect.x + pad,
        rect.y + rect.height - pad - 22,
        option.confirmLine,
        textStyle(typeRole.label, accent.heroRed.hex),
      )
      .setWordWrapWidth(rect.width - pad * 2)
      .setMaxLines(1);
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
