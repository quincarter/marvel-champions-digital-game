/**
 * Composite buttons the Saga/Cover/Roster screens (C00b/C01/C02) share: a left-aligned title with an optional
 * subtitle and chevron ("READ ISSUE #3 / Taskmaster · …"), and a dark grid tile ("VOL. 2 / GALAXY'S MOST WANTED /
 * WIN VOL. 1 TO OPEN"). Built on `McButton` for the state matrix, hover and click handling it already implements —
 * this only adds the extra left-aligned text `McButton`'s own centered label doesn't cover, parented into the same
 * container so it moves and destroys with the button.
 */
import Phaser from "phaser";
import { ink, signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { bangers } from "./campaign-chrome.js";
import { textStyle, type WidgetKind } from "./theme.js";
import { dashedRect, McButton, paintDotGrid } from "./widgets.js";

export interface CampaignActionButtonOptions {
  readonly kind: WidgetKind;
  readonly rect: Rect;
  readonly title: string;
  readonly subtitle?: string;
  readonly chevron?: boolean;
  readonly enabled?: boolean;
  readonly reason?: string;
  readonly onClick: () => void;
  readonly titleSize?: number;
}

/** A row button: Bangers or bold title top-left, an optional secondary line beneath, an optional trailing "▸". */
export function campaignActionButton(scene: Phaser.Scene, options: CampaignActionButtonOptions): McButton {
  const button = new McButton(scene, {
    kind: options.kind,
    label: "",
    type: typeRole.body,
    rect: options.rect,
    ...(options.enabled !== undefined ? { enabled: options.enabled } : {}),
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
    onClick: options.onClick,
  });
  const onDark = options.kind === "onInk" || options.kind === "primary";
  const dim = options.enabled === false ? ink.disabled : 1;
  const textColor = onDark ? surface.paper.hex : surface.ink.hex;
  const pad = 16;
  const { rect } = options;
  const titleSize = options.titleSize ?? (options.kind === "primary" ? 22 : 18);
  const titleY = options.subtitle ? rect.y + pad - 2 : rect.y + rect.height / 2;
  const title = scene.add
    .text(rect.x + pad, titleY, options.title.toUpperCase(), textStyle(bangers(titleSize), textColor, dim))
    .setOrigin(0, options.subtitle ? 0 : 0.5);
  button.container.add(title);
  if (options.subtitle) {
    const subtitle = scene.add
      .text(rect.x + pad, rect.y + rect.height - pad - 2, options.subtitle, {
        ...textStyle(typeRole.emphasis, textColor, dim * ink.secondary),
        fontSize: "12px",
      })
      .setOrigin(0, 1);
    button.container.add(subtitle);
  }
  if (options.chevron) {
    const chevron = scene.add
      .text(rect.x + rect.width - 14, rect.y + rect.height / 2, "▸", textStyle(bangers(20), textColor, dim))
      .setOrigin(1, 0.5);
    button.container.add(chevron);
  }
  return button;
}

export interface CampaignTileOptions {
  readonly rect: Rect;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly chip: string;
  /** The dashed-yellow "you're almost here" highlight for the very next volume to open. */
  readonly highlighted?: boolean;
  readonly onClick: () => void;
}

/** A dark grid tile on the shelf: box code, a huge "VOL. N", the box's name and a status chip. Always clickable — the shelf features whatever tile is tapped, sealed or not. */
export function campaignTile(
  scene: Phaser.Scene,
  options: CampaignTileOptions,
): {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  readonly zone: Phaser.GameObjects.Zone;
} {
  const { rect } = options;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics();
  g.fillStyle(0x0b0906, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  objects.push(g);
  objects.push(paintDotGrid(scene, rect, "ink", { spacing: 8, radius: 1, alpha: 0.16 }));
  const border = scene.add.graphics();
  if (options.highlighted) dashedRect(border, rect, 2, signal.caution.hex);
  else
    border
      .lineStyle(1, surface.paper.hex, 0.25)
      .strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
  objects.push(border);

  const eyebrow = scene.add
    .text(
      rect.x + 12,
      rect.y + 12,
      options.eyebrow.toUpperCase(),
      textStyle(typeRole.label, surface.paper.hex, ink.meta),
    )
    .setLetterSpacing(1);
  objects.push(eyebrow);

  const titleSize = Math.min(38, rect.width * 0.19);
  const title = scene.add.text(rect.x + 12, rect.y + rect.height - 76, options.title.toUpperCase(), {
    ...textStyle(bangers(titleSize, 0.85), surface.paper.hex),
    wordWrap: { width: rect.width - 24, useAdvancedWrap: true },
  });
  objects.push(title);

  if (options.subtitle) {
    const subtitle = scene.add.text(rect.x + 12, title.y + title.height + 2, options.subtitle.toUpperCase(), {
      ...textStyle(bangers(13, 1), surface.paper.hex),
      wordWrap: { width: rect.width - 24, useAdvancedWrap: true },
    });
    objects.push(subtitle);
  }

  const chipY = rect.y + rect.height - 32;
  const chipLabel = scene.add
    .text(
      0,
      0,
      options.chip.toUpperCase(),
      textStyle(typeRole.label, options.highlighted ? surface.ink.hex : surface.paper.hex, 1),
    )
    .setLetterSpacing(1);
  const chipRect: Rect = { x: rect.x + 12, y: chipY, width: chipLabel.width + 16, height: 20 };
  const chipBg = scene.add.graphics();
  if (options.highlighted)
    chipBg.fillStyle(signal.caution.hex, 1).fillRect(chipRect.x, chipRect.y, chipRect.width, chipRect.height);
  else
    chipBg
      .lineStyle(1, surface.paper.hex, 0.55)
      .strokeRect(chipRect.x + 0.5, chipRect.y + 0.5, chipRect.width - 1, chipRect.height - 1);
  chipLabel.setPosition(chipRect.x + 8, chipRect.y + chipRect.height / 2).setOrigin(0, 0.5);
  objects.push(chipBg, chipLabel);

  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true })
    .on("pointerup", () => options.onClick());
  objects.push(zone);
  return { objects, zone };
}
