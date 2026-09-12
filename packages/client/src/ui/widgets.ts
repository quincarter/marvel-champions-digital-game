/**
 * The `Mc*` widget layer.
 *
 * Scenes never draw a rectangle or reach for rexUI directly (PLAN.md Phase 4):
 * they build widgets, and these widgets implement the design system's state
 * matrix through `skin`. Keeping scenes on the wrappers is what leaves the
 * toolkit swappable — PhaserJSX was set aside as a later candidate precisely
 * because this seam exists.
 *
 * Depth here is border weight and ground swaps only: there is no shadow in the
 * system except the red selection ring, which `McSelectionRing` owns.
 */

import Phaser from "phaser";
import { accent, border, hit, ink, minType, selectionRing, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { caseOf, cssOf, skin, textStyle, type WidgetKind, type WidgetState } from "./theme.js";

/** Draws a rect with the design's border model into an existing Graphics. */
export function paintPanel(g: Phaser.GameObjects.Graphics, rect: Rect, kind: WidgetKind, state: WidgetState): void {
  const s = skin(kind, state);
  g.fillStyle(s.fill, s.fillAlpha);
  g.fillRect(rect.x, rect.y, rect.width, rect.height);
  g.lineStyle(s.strokeWidth, s.stroke, s.fillAlpha);
  if (s.dashed) dashedRect(g, rect, s.strokeWidth);
  else g.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

/** A dashed outline: the system's mark for a slot that isn't filled yet. */
export function dashedRect(g: Phaser.GameObjects.Graphics, rect: Rect, width: number): void {
  const step = border.dashSegment + border.dashGap;
  const line = (x1: number, y1: number, x2: number, y2: number): void => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / length;
    const dy = (y2 - y1) / length;
    for (let at = 0; at < length; at += step) {
      const end = Math.min(at + border.dashSegment, length);
      g.lineBetween(x1 + dx * at, y1 + dy * at, x1 + dx * end, y1 + dy * end);
    }
  };
  g.lineStyle(width, skin("quiet", "rest").stroke, 1);
  line(rect.x, rect.y, rect.x + rect.width, rect.y);
  line(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height);
  line(rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height);
  line(rect.x, rect.y + rect.height, rect.x, rect.y);
}

export interface McButtonOptions {
  readonly kind: WidgetKind;
  readonly label: string;
  readonly type: TypeSpec;
  readonly rect: Rect;
  readonly onClick: () => void;
  /** Shown as the "Why illegal?" line when the button is unavailable. */
  readonly reason?: string;
  readonly enabled?: boolean;
  readonly selected?: boolean;
  /** Drawn beside the label, e.g. the "2" on the Attack button. */
  readonly value?: string;
}

/**
 * A button. Hover swaps ground and ink; it never moves or scales, per the
 * design system. An unavailable button stays exactly where it is and drops to
 * 40% ink rather than disappearing.
 */
export class McButton {
  readonly container: Phaser.GameObjects.Container;
  readonly #graphics: Phaser.GameObjects.Graphics;
  readonly #label: Phaser.GameObjects.Text;
  readonly #value: Phaser.GameObjects.Text | null;
  readonly #zone: Phaser.GameObjects.Zone;
  #options: McButtonOptions;
  #hovered = false;

  constructor(scene: Phaser.Scene, options: McButtonOptions) {
    this.#options = options;
    const { rect } = options;
    this.#graphics = scene.add.graphics();
    this.#label = scene.add
      .text(0, 0, caseOf(options.type, options.label), textStyle(options.type, 0))
      .setOrigin(0.5, 0.5);
    if (options.type.letterSpacing) this.#label.setLetterSpacing(options.type.letterSpacing);
    this.#value = options.value
      ? scene.add.text(0, 0, options.value, textStyle(options.type, 0)).setOrigin(0.5, 0.5)
      : null;

    this.#zone = scene.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      // Every control is at least the design's 44px touch target.
      .setInteractive({ useHandCursor: true });
    this.#zone.on("pointerover", () => {
      this.#hovered = true;
      this.redraw();
    });
    this.#zone.on("pointerout", () => {
      this.#hovered = false;
      this.redraw();
    });
    this.#zone.on("pointerup", () => {
      if (this.#options.enabled !== false) this.#options.onClick();
    });

    this.container = scene.add.container(0, 0, [this.#graphics, this.#label, ...(this.#value ? [this.#value] : []), this.#zone]);
    this.redraw();
  }

  /** The minimum height a control of this kind may be drawn at. */
  static minHeight(kind: WidgetKind): number {
    return kind === "primary" ? hit.primary : hit.target;
  }

  update(options: Partial<McButtonOptions>): void {
    this.#options = { ...this.#options, ...options };
    const { rect } = this.#options;
    this.#zone.setPosition(rect.x, rect.y).setSize(rect.width, rect.height);
    this.#zone.input?.hitArea.setSize(rect.width, rect.height);
    this.redraw();
  }

  get state(): WidgetState {
    if (this.#options.enabled === false) return "unavailable";
    if (this.#options.selected) return "selected";
    return this.#hovered ? "hover" : "rest";
  }

  get reason(): string | null {
    return this.#options.enabled === false ? (this.#options.reason ?? null) : null;
  }

  redraw(): void {
    const { rect, type } = this.#options;
    const state = this.state;
    const s = skin(this.#options.kind, state);
    this.#graphics.clear();
    paintPanel(this.#graphics, rect, this.#options.kind, state);

    const hasValue = this.#value !== null;
    this.#label
      .setText(caseOf(type, this.#options.label))
      .setColor(cssOf(s.text, s.textAlpha))
      .setPosition(rect.x + rect.width / 2 - (hasValue ? 10 : 0), rect.y + rect.height / 2);
    // No label ever runs past its own control: a button that says
    // "REMOVE THIS SEA" is worse than one that says it a point smaller.
    fitText(this.#label, rect.width - (hasValue ? 40 : 16), type.size);
    this.#value?.setColor(cssOf(s.text, s.textAlpha)).setPosition(rect.x + rect.width - 16, rect.y + rect.height / 2);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

/**
 * The red selection ring — the only shadow in the system. Static means a
 * committed choice; pulsing means the board is awaiting a tap.
 */
export class McSelectionRing {
  readonly graphics: Phaser.GameObjects.Graphics;
  #tween: Phaser.Tweens.Tween | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }

  show(rect: Rect, mode: "static" | "pulse", reducedMotion: boolean): void {
    const { offset, width, color, glowWidth, glowAlpha } = selectionRing;
    const outer: Rect = {
      x: rect.x - offset,
      y: rect.y - offset,
      width: rect.width + offset * 2,
      height: rect.height + offset * 2,
    };
    this.graphics.clear().setVisible(true).setAlpha(1);
    this.graphics.lineStyle(glowWidth, color.hex, glowAlpha);
    this.graphics.strokeRect(outer.x - 2, outer.y - 2, outer.width + 4, outer.height + 4);
    this.graphics.lineStyle(width, color.hex, 1);
    this.graphics.strokeRect(outer.x, outer.y, outer.width, outer.height);

    this.#tween?.remove();
    this.#tween = null;
    if (mode === "pulse" && !reducedMotion) {
      this.#tween = this.scene.tweens.add({
        targets: this.graphics,
        alpha: { from: 1, to: 0.45 },
        duration: selectionRing.pulseMs,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  hide(): void {
    this.#tween?.remove();
    this.#tween = null;
    this.graphics.clear().setVisible(false);
  }

  destroy(): void {
    this.#tween?.remove();
    this.graphics.destroy();
  }
}

/**
 * A dot grid, which marks the table felt and nothing else.
 *
 * Drawn as one `spacing`-sized texture and tiled. Filling a 1280×800 table at
 * the design's 6px spacing means ~28,000 dots; as individual `fillCircle`
 * calls in a Graphics object that overwhelms the renderer and the table draws
 * at the wrong size. One tiled texture is a single draw call at any size.
 */
export function paintDotGrid(
  scene: Phaser.Scene,
  rect: Rect,
  on: "paper" | "ink",
  spec: { readonly spacing: number; readonly radius: number; readonly alpha: number },
): Phaser.GameObjects.TileSprite {
  const key = `mc-dots-${on}-${spec.spacing}-${spec.radius}-${spec.alpha}`;
  if (!scene.textures.exists(key)) {
    // `addToScene: false` keeps the stencil out of the display list.
    const stencil = scene.make.graphics(undefined, false);
    stencil.fillStyle(on === "paper" ? surface.ink.hex : surface.paper.hex, spec.alpha);
    stencil.fillCircle(spec.spacing / 2, spec.spacing / 2, spec.radius);
    stencil.generateTexture(key, spec.spacing, spec.spacing);
    stencil.destroy();
  }
  return scene.add.tileSprite(rect.x, rect.y, rect.width, rect.height, key).setOrigin(0, 0);
}

/** A label in the design's 9/800 uppercase style, at the ink ladder's label step. */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  spec: TypeSpec,
  color: number,
  alpha: number = ink.label,
): Phaser.GameObjects.Text {
  const object = scene.add.text(x, y, caseOf(spec, text), textStyle(spec, color, alpha));
  if (spec.letterSpacing) object.setLetterSpacing(spec.letterSpacing);
  return object;
}

export interface McTabsOptions {
  readonly rect: Rect;
  readonly tabs: readonly { readonly id: string; readonly label: string; readonly badge?: number }[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}

/**
 * The phone board's zone rail.
 *
 * A recessed parchment strip of equal cells; the active one is an ink fill, not
 * an underline, because the design system's `rail` skin says so and an
 * underline is invisible at 390px. A cell can carry a change badge, which is
 * how a card landing on a tab you aren't looking at still reads.
 */
export class McTabs {
  readonly #buttons: McButton[] = [];
  readonly #badges: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, options: McTabsOptions) {
    const { rect, tabs, activeId } = options;
    const rail = scene.add.graphics();
    paintPanel(rail, rect, "rail", "rest");

    const cellWidth = rect.width / Math.max(1, tabs.length);
    tabs.forEach((tab, index) => {
      const cell: Rect = { x: rect.x + index * cellWidth, y: rect.y, width: cellWidth, height: rect.height };
      this.#buttons.push(
        new McButton(scene, {
          kind: "rail",
          label: tab.label,
          type: { ...typeRole.label, size: Math.max(minType.phoneLabel, typeRole.label.size) },
          rect: cell,
          selected: tab.id === activeId,
          onClick: () => options.onSelect(tab.id),
        }),
      );

      if (tab.badge && tab.badge > 0 && tab.id !== activeId) {
        // A count, not a dot: "3 changed" is a different message from "changed".
        const badge = scene.add.graphics();
        badge.fillStyle(accent.heroRed.hex, 1).fillRect(cell.x + cell.width - 18, cell.y + 4, 14, 14);
        const text = scene.add
          .text(cell.x + cell.width - 11, cell.y + 11, String(Math.min(9, tab.badge)), textStyle(typeRole.label, surface.paper.hex))
          .setOrigin(0.5);
        this.#badges.push(badge, text);
      }
    });
  }

  destroy(): void {
    for (const button of this.#buttons) button.destroy();
    for (const badge of this.#badges) badge.destroy();
  }
}

export interface McCardTileOptions {
  readonly rect: Rect;
  readonly label: string;
  /** How much of the tile the card occupies. The caption takes what's left. */
  readonly artHeight: number;
  readonly selected?: boolean;
  /** False dims the tile in place and refuses the tap. "Dim, don't hide." */
  readonly enabled?: boolean;
  readonly onClick: () => void;
  /**
   * A press-and-hold or a right-click, when the tile has somewhere to send one.
   * A tile is a thumbnail, so reading the card it shows needs a second gesture.
   */
  readonly onInspect?: () => void;
  /**
   * Paints the card into the slot. Returns false when there is no scan, so the
   * tile can say so itself — the widget layer never reaches for the art module.
   */
  readonly paintArt: (slot: Rect) => boolean;
}

/**
 * How long a press has to last before it inspects instead of choosing. The same
 * threshold the board and the choice sheet use, so the gesture means one thing
 * everywhere in the app.
 */
export const INSPECT_HOLD_MS = 420;

/**
 * A card as a choosable thing: the scan above, its name below, one border
 * around both.
 *
 * Drawn as a single control rather than an art block with a button under it.
 * Two stacked rectangles read as two controls, and the one carrying the border
 * looked like the only clickable half — which is exactly how the Title screen's
 * scenario and hero pickers were coming out.
 *
 * The caption is fitted to the tile rather than allowed to run past it: at
 * three across on a phone, "Captain Marvel (Leadership)" is wider than its own
 * cell, and a label that overlaps its neighbour is worse than a shortened one.
 */
export class McCardTile {
  readonly #objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, options: McCardTileOptions) {
    const { rect, artHeight, selected = false, enabled = true } = options;
    const state: WidgetState = !enabled ? "unavailable" : selected ? "selected" : "rest";
    const alpha = enabled ? 1 : ink.illegal;

    const frame = scene.add.graphics();
    paintPanel(frame, rect, "card", state);
    this.#objects.push(frame);

    const artSlot: Rect = {
      x: rect.x + border.object,
      y: rect.y + border.object,
      width: rect.width - border.object * 2,
      height: Math.max(0, artHeight - border.object),
    };
    if (artSlot.height > 0) {
      const ground = scene.add.graphics();
      ground.fillStyle(surface.parchment.hex, alpha).fillRect(artSlot.x, artSlot.y, artSlot.width, artSlot.height);
      this.#objects.push(ground);
      if (!options.paintArt(artSlot)) {
        this.#objects.push(
          label(scene, artSlot.x + artSlot.width / 2, artSlot.y + artSlot.height / 2, "art", typeRole.label, surface.ink.hex, ink.meta).setOrigin(0.5),
        );
      }
      // A rule between the card and its name, the same 2px detail weight the
      // stat tiles use — so the caption reads as part of this tile.
      const rule = scene.add.graphics();
      rule.fillStyle(surface.ink.hex, alpha).fillRect(artSlot.x, artSlot.y + artSlot.height, artSlot.width, border.detail);
      this.#objects.push(rule);
    }

    // The caption strip: ink-filled when chosen, so selection reads from across
    // the room without the art changing colour.
    const captionTop = rect.y + artHeight;
    const captionHeight = rect.y + rect.height - captionTop - border.object;
    if (selected) {
      const strip = scene.add.graphics();
      strip.fillStyle(surface.ink.hex, 1).fillRect(rect.x + border.object, captionTop, rect.width - border.object * 2, captionHeight);
      this.#objects.push(strip);
    }

    const text = scene.add
      .text(rect.x + rect.width / 2, captionTop + captionHeight / 2, options.label, textStyle(typeRole.rowTitle, selected ? surface.paper.hex : surface.ink.hex, alpha))
      .setOrigin(0.5);
    fitText(text, rect.width - 12);
    this.#objects.push(text);

    const zone = scene.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    let held: Phaser.Time.TimerEvent | null = null;
    let inspected = false;
    const cancelHold = (): void => {
      held?.remove();
      held = null;
    };
    const inspect = (): void => {
      inspected = true;
      options.onInspect?.();
    };

    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      inspected = false;
      // A tile you cannot choose can still be read: that is how the player
      // finds out *why* it is unavailable.
      if (!options.onInspect) return;
      if (pointer.rightButtonDown()) {
        inspect();
        return;
      }
      held = scene.time.delayedCall(INSPECT_HOLD_MS, inspect);
    });
    zone.on("pointerout", cancelHold);
    zone.on("pointerup", () => {
      cancelHold();
      // A hold already did something; the release must not also act on it.
      if (inspected) return;
      if (enabled) options.onClick();
    });
    this.#objects.push(zone);
  }

  destroy(): void {
    for (const object of this.#objects) object.destroy();
  }
}

/**
 * The smallest a caption is allowed to shrink to before it starts being clipped
 * instead. The design's phone-label floor: below this the text stops being
 * readable, and a shortened readable name beats a complete unreadable one.
 */
export const CAPTION_FLOOR = minType.phoneLabel;

/**
 * How tall a card tile's caption strip is.
 *
 * Not the 44px touch target: the *whole tile* is the control, and the tile is
 * always taller than that, so spending 44px on a one-line caption only steals
 * height from the card it is captioning.
 */
export const CAPTION_HEIGHT = 26;

/**
 * Shrinks a label to fit, then clips it with an ellipsis if shrinking alone
 * isn't enough. Down to the design's phone-label floor and no further: below
 * that the text stops being readable, and a shorter readable name beats a
 * complete unreadable one.
 */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number, startSize: number = typeRole.rowTitle.size): void {
  const full = text.text;
  for (let size = startSize; size >= CAPTION_FLOOR; size -= 1) {
    text.setFontSize(size);
    if (text.width <= maxWidth) return;
  }
  let trimmed = full;
  while (trimmed.length > 1 && text.width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
    text.setText(`${trimmed.trimEnd()}…`);
  }
}
