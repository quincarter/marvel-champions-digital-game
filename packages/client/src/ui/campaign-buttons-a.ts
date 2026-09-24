/**
 * Composite buttons the Saga/Cover/Roster screens (C00b/C01/C02) share: a left-aligned title with an optional
 * subtitle and chevron ("READ ISSUE #3 / Taskmaster · …"), and a dark grid tile ("VOL. 2 / GALAXY'S MOST WANTED /
 * WIN VOL. 1 TO OPEN"). Built on `McButton` for the state matrix, hover and click handling it already implements —
 * this only adds the extra left-aligned text `McButton`'s own centered label doesn't cover, parented into the same
 * container so it moves and destroys with the button.
 */
import Phaser from "phaser";
import type { Picture } from "../art/pictures.js";
import { accent, ink, signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { bangers, drawPicture } from "./campaign-chrome.js";
import { cssOf, skin, textStyle, type WidgetKind } from "./theme.js";
import { McButton, paintDotGrid } from "./widgets.js";

export interface CampaignActionButtonOptions {
  readonly kind: WidgetKind;
  readonly rect: Rect;
  readonly title: string;
  readonly subtitle?: string;
  /** "emphasis" (default, the roster picker's "Aggression + Justice") or "label" (Cover's small caps "CAMPAIGN LOG · HEROES & WORLD"). */
  readonly subtitleStyle?: "emphasis" | "label";
  readonly chevron?: boolean;
  readonly enabled?: boolean;
  readonly reason?: string;
  readonly onClick: () => void;
  readonly titleSize?: number;
}

/**
 * A row button: Bangers or bold title top-left, an optional secondary line beneath, an optional trailing "▸".
 *
 * The label/subtitle/chevron are plain `Text` objects layered over `McButton`'s own (empty) label — so their
 * colour has to track hover itself, or a "secondary"/"card" row on a light ground goes ink-on-ink invisible the
 * moment the fill inverts to ink on hover (found on the roster picker: a hovered row's name vanished under the
 * pointer). Read from the same `Zone` `McButton` already built (its last child), so this never double-hit-tests.
 */
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
  // Captured now, before this function appends its own title/subtitle/chevron — `McButton`'s zone is its last
  // child only until those are added, and reading `.at(-1)` after that would grab a text object instead.
  const zone = button.container.list.at(-1) as Phaser.GameObjects.Zone | undefined;
  const padX = 16;
  const { rect } = options;
  const titleSize = options.titleSize ?? (options.kind === "primary" ? 22 : 18);
  const hasSubtitle = Boolean(options.subtitle);
  const subtitleStyle = options.subtitleStyle ?? "emphasis";
  // Laid out top-down: title first, subtitle right under it (never centered as one block) — so a tight rect
  // shrinks the button's own vertical centering rather than letting the two lines collide.
  const blockHeight = hasSubtitle ? titleSize + 18 : titleSize;
  const top = rect.y + Math.max(8, (rect.height - blockHeight) / 2);
  const title = scene.add
    .text(
      rect.x + padX,
      hasSubtitle ? top : rect.y + rect.height / 2,
      options.title.toUpperCase(),
      textStyle(bangers(titleSize), 0),
    )
    .setOrigin(0, hasSubtitle ? 0 : 0.5);
  button.container.add(title);
  let subtitle: Phaser.GameObjects.Text | null = null;
  if (options.subtitle) {
    subtitle =
      subtitleStyle === "label"
        ? scene.add
            .text(
              rect.x + padX,
              title.y + title.height + 3,
              options.subtitle.toUpperCase(),
              textStyle(typeRole.label, 0),
            )
            .setLetterSpacing(1)
        : scene.add.text(rect.x + padX, title.y + title.height + 2, options.subtitle, {
            ...textStyle(typeRole.emphasis, 0),
            fontSize: "12px",
          });
    subtitle.setOrigin(0, 0);
    button.container.add(subtitle);
  }
  let chevron: Phaser.GameObjects.Text | null = null;
  if (options.chevron) {
    chevron = scene.add
      .text(rect.x + rect.width - 14, rect.y + rect.height / 2, "▸", textStyle(bangers(20), 0))
      .setOrigin(1, 0.5);
    button.container.add(chevron);
  }

  const applyState = (state: "rest" | "hover" | "unavailable"): void => {
    const buttonSkin = skin(options.kind, state);
    title.setColor(cssOf(buttonSkin.text, buttonSkin.textAlpha));
    subtitle?.setColor(
      cssOf(
        buttonSkin.text,
        subtitleStyle === "label" ? buttonSkin.textAlpha * ink.meta : buttonSkin.textAlpha * ink.secondary,
      ),
    );
    chevron?.setColor(cssOf(buttonSkin.text, buttonSkin.textAlpha));
  };
  applyState(options.enabled === false ? "unavailable" : "rest");
  if (options.enabled !== false) {
    zone?.on("pointerover", () => applyState("hover"));
    zone?.on("pointerout", () => applyState("rest"));
  }
  return button;
}

export type CampaignTileStatus = "done" | "live" | "fresh" | "sealed";

export interface CampaignTileOptions {
  readonly rect: Rect;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly chip: string;
  readonly status: CampaignTileStatus;
  /** A dimmed thumbnail behind the text, when this volume has villain art. */
  readonly art?: Picture | null;
  /** Called once the art texture finishes loading, so the caller can redraw with it in place. */
  readonly onArtReady?: () => void;
  /** The red ring — this is the currently featured tile. */
  readonly selected?: boolean;
  readonly onClick: () => void;
}

const TILE_CHIP_COLOR: Readonly<Record<CampaignTileStatus, { readonly fill: number | null; readonly text: number }>> = {
  done: { fill: signal.heal.hex, text: surface.paper.hex },
  live: { fill: accent.heroRed.hex, text: surface.paper.hex },
  fresh: { fill: signal.caution.hex, text: surface.ink.hex },
  sealed: { fill: null, text: surface.paper.hex },
};

/**
 * A dark grid tile on the shelf ("ALL VOLUMES ───"): box code, a huge "VOL. N", the box's name, a status chip
 * (colour by status; an outline for sealed) and — when the box has villain art — a dimmed thumbnail behind it all.
 * Always clickable, so the shelf can feature any volume tapped, sealed or not; `selected` draws the red ring
 * around whichever tile is currently featured.
 */
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
  objects.push(paintDotGrid(scene, rect, "ink", { spacing: 6, radius: 1, alpha: 0.1 }));

  if (options.art) {
    const image = drawPicture(scene, options.art, rect, () => options.onArtReady?.(), { focusY: 0.15, alpha: 0.5 });
    if (image) objects.push(image);
  }

  const eyebrow = scene.add
    .text(
      rect.x + 11,
      rect.y + 9,
      options.eyebrow.toUpperCase(),
      textStyle(typeRole.label, surface.paper.hex, ink.meta),
    )
    .setLetterSpacing(1);
  objects.push(eyebrow);

  const chipColor = TILE_CHIP_COLOR[options.status];
  const chipY = rect.y + rect.height - 29;
  const titleSize = Math.min(46, rect.width * 0.24);

  // Laid out bottom-up (chip, then subtitle, then title) so a two-line box name never collides with the chip below
  // it — text height is only known once the object exists, so this measures each before placing the one above it.
  let subtitle: Phaser.GameObjects.Text | null = null;
  if (options.subtitle) {
    subtitle = scene.add.text(rect.x + 11, 0, options.subtitle.toUpperCase(), {
      ...textStyle(bangers(Math.min(20, rect.width * 0.1), 1), surface.paper.hex),
      wordWrap: { width: rect.width - 22, useAdvancedWrap: true },
    });
    subtitle.setY(chipY - 9 - subtitle.height);
    objects.push(subtitle);
  }
  const title = scene.add.text(rect.x + 11, 0, options.title.toUpperCase(), {
    ...textStyle(bangers(titleSize, 1), surface.paper.hex),
  });
  title.setY((subtitle ? subtitle.y : chipY - 6) - 2 - title.height);
  objects.push(title);

  const chipBg = scene.add.graphics();
  const chipLabel = scene.add
    .text(0, 0, options.chip.toUpperCase(), textStyle(typeRole.label, chipColor.text, 1))
    .setLetterSpacing(0.9);
  const chipRect: Rect = { x: rect.x + 11, y: chipY, width: chipLabel.width + 14, height: 19 };
  if (chipColor.fill !== null)
    chipBg.fillStyle(chipColor.fill, 1).fillRect(chipRect.x, chipRect.y, chipRect.width, chipRect.height);
  else
    chipBg
      .lineStyle(1.5, surface.paper.hex, 0.45)
      .strokeRect(chipRect.x + 0.75, chipRect.y + 0.75, chipRect.width - 1.5, chipRect.height - 1.5);
  chipLabel.setPosition(chipRect.x + 7, chipRect.y + chipRect.height / 2).setOrigin(0, 0.5);
  // `chipBg` was created (and so added) before `chipLabel` — drawn first, so the label sits on top of the fill.
  objects.push(chipBg, chipLabel);

  if (options.status === "sealed") {
    const dim = scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex, 0.4).setOrigin(0, 0);
    objects.push(dim);
  }
  if (options.selected) {
    const ring = scene.add.graphics();
    ring.lineStyle(4, accent.heroRed.hex, 1).strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    ring.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10);
    objects.push(ring);
  }

  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true })
    .on("pointerup", () => options.onClick());
  objects.push(zone);
  return { objects, zone };
}
