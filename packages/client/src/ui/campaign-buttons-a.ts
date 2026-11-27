/**
 * Composite buttons the Roster screen (C02) shares: a left-aligned title with an optional
 * subtitle and chevron ("READ ISSUE #3 / Taskmaster · …"). The Saga and the Cover draw theirs as `mc-button` rows in a
 * panel. Built on `McButton` for the state matrix, hover and click handling it already implements —
 * this only adds the extra left-aligned text `McButton`'s own centered label doesn't cover, parented into the same
 * container so it moves and destroys with the button.
 */
import Phaser from "phaser";
import { ink, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { bangers } from "./campaign-chrome.js";
import { cssOf, skin, textStyle, type WidgetKind } from "./theme.js";
import { McButton } from "./widgets.js";

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
 * color has to track hover itself, or a "secondary"/"card" row on a light ground goes ink-on-ink invisible the
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
    // `onHover` rather than the zone's own `pointerover`/`pointerout`: a touch's hover ends without a `pointerout`,
    // and the text below must leave its hover colors when the button does (#272).
    onHover: (over) => {
      if (options.enabled !== false) applyState(over ? "hover" : "rest");
    },
  });
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
  return button;
}
