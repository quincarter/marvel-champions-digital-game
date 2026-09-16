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
import type { InputText as RexInputText, TextArea as RexTextArea, TextAreaInput as RexTextAreaInput } from "phaser4-rex-plugins/templates/ui/ui-components";
import { accent, border, hit, ink, minType, selectionRing, signal, statHue, status, surface, typeRole, type TypeSpec } from "../tokens.js";
import { pointInRect } from "../view/drag-gesture.js";
import { ribbonHeight, type Rect } from "../view/layout.js";
// The only rexUI import in the app. See ui/rex.ts for why the components
// are constructed directly instead of through `RexUIPlugin`.
import { addInputText, addTextArea, addTextAreaInput } from "./rex.js";
import { caseOf, cssOf, fontFamilyOf, skin, textStyle, type WidgetKind, type WidgetState } from "./theme.js";

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

/**
 * 45° hatching clipped to `rect` — the design's "why this is gone" texture
 * (Components.dc.html section 05: a status hatches the control it cancels,
 * and Tough hatches the HP bar as armour). Lines of `x + y = k`, each clipped
 * to the rect by hand, because a Graphics object has no clip of its own.
 */
export function hatchRect(
  g: Phaser.GameObjects.Graphics,
  rect: Rect,
  color: number,
  alpha: number,
  spacing = 8,
  thickness = 3,
): void {
  const { x, y, width, height } = rect;
  if (width <= 0 || height <= 0) return;
  g.lineStyle(thickness, color, alpha);
  for (let k = spacing / 2; k < width + height; k += spacing) {
    const startX = Math.max(0, k - height);
    const endX = Math.min(width, k);
    if (endX <= startX) continue;
    g.lineBetween(x + startX, y + (k - startX), x + endX, y + (k - endX));
  }
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
  /** A status hue to hatch the button in: the status that cancels what it does. */
  readonly hatch?: number;
  /**
   * A viewport this button must be visually inside of to respond to a click —
   * for a button reparented into a `McVirtualList` row layer, which clips
   * what's *drawn* but not what Phaser hit-tests (`ui/virtual-list.ts`'s doc
   * comment). A row scrolled fully or partly out of the list's own rect would
   * otherwise still be clickable in the part that isn't visible. Read fresh
   * on every click (a function, not a value) since the list's rect can change
   * between this button being built and being clicked (a resize, a scroll).
   * Null means "no viewport, always eligible" (the default: a button that
   * isn't inside a scrolling list).
   */
  readonly clip?: () => Rect | null;
  /**
   * True while a drag gesture over this button's list should swallow the
   * click that ends it — the `McVirtualList` doc comment's "tap vs drag":
   * releasing a pointer after dragging the list must not also activate
   * whatever the pointer happens to be over.
   */
  readonly suppressClick?: () => boolean;
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
    this.#zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.#options.enabled === false) return;
      if (this.#options.suppressClick?.()) return;
      const clip = this.#options.clip?.() ?? null;
      if (clip && !pointInRect(pointer.x, pointer.y, clip)) return;
      this.#options.onClick();
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
    if (this.#options.hatch !== undefined) {
      hatchRect(this.#graphics, { x: rect.x + 2, y: rect.y + 2, width: rect.width - 4, height: rect.height - 4 }, this.#options.hatch, 0.55, 10, 4);
      this.#graphics.lineStyle(3, this.#options.hatch, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
    }

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

  /**
   * `color` overrides the ring's red for the one ground it would disappear into:
   * a focus ring on Game Over's Hero Red loss screen.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly color?: number,
  ) {
    this.graphics = scene.add.graphics();
  }

  show(rect: Rect, mode: "static" | "pulse", reducedMotion: boolean): void {
    const { offset, width, glowWidth, glowAlpha } = selectionRing;
    const color = { hex: this.color ?? selectionRing.color.hex };
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

  /** Every display-list object this tile drew, for a caller that reparents a row into its own container (`ui/virtual-list.ts`). */
  get objects(): readonly Phaser.GameObjects.GameObject[] {
    return this.#objects;
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

/** How wide the scroll track (and its thumb) draws, on either ground. */
const SCROLL_TRACK_WIDTH = 6;
/** Padding inside a scroll panel, and the gap reserved for its slider. */
const SCROLL_PADDING_X = 4;
const SCROLL_SLIDER_GAP = 6;

export interface McScrollPanelOptions {
  readonly rect: Rect;
  readonly text: string;
  /** Defaults to `typeRole.body` — rules text's own role. */
  readonly type?: TypeSpec;
  readonly color?: number;
  readonly alpha?: number;
  /** The ground the panel sits on, so the track and thumb read against it. */
  readonly onInk?: boolean;
}

/**
 * Long rules text that scrolls instead of overflowing its panel or being
 * truncated (PLAN.md Phase 4's Inspect scroll panel).
 *
 * Backed by rexUI's `TextArea`, which is a genuine "hard by hand" case: it
 * virtualizes lines (only the visible ones are live `Text` objects), tracks a
 * scroll position, and answers wheel and drag input — none of which the widget
 * layer's native Graphics/Zone approach gets for free the way a button or a
 * card tile does. The text itself is a plain Phaser `Text` styled through the
 * same `textStyle`/`caseOf` every other widget uses, so only the scrolling
 * machinery is rexUI's; the track and thumb are flat rectangles in the
 * design's own colors, not rexUI's default look.
 *
 * Deliberately plain text, not rexUI's `BBCodeText`: card rules text prints
 * literal bracket tokens (`[energy]`, `[mental]`, …), which `BBCodeText` would
 * read as markup. A uniform style is the trade for that safety — see the
 * report for what that costs the printed-text/flavor styling in Inspect.
 */
export class McScrollPanel {
  readonly panel: RexTextArea;
  readonly #text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, options: McScrollPanelOptions) {
    const { rect } = options;
    const type = options.type ?? typeRole.body;
    const onInk = options.onInk ?? false;
    const textColor = options.color ?? (onInk ? surface.paper.hex : surface.ink.hex);
    const trackFill = onInk ? surface.paper.hex : surface.ink.hex;

    const textObject = scene.add.text(0, 0, "", textStyle(type, textColor, options.alpha ?? 1));
    if (type.letterSpacing) textObject.setLetterSpacing(type.letterSpacing);


    const track = scene.add.rectangle(0, 0, SCROLL_TRACK_WIDTH, 10, trackFill, onInk ? 0.22 : 0.14).setOrigin(0.5);
    const thumb = scene.add.rectangle(0, 0, SCROLL_TRACK_WIDTH, 40, trackFill, onInk ? 0.9 : 0.8).setOrigin(0.5);

    this.#text = textObject;
    this.panel = addTextArea(scene, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        origin: 0,
        text: textObject,
        content: options.text,
        /**
         * Mask the overflow, don't crop it.
         *
         * rexUI computes the wrap width itself and it is correct — but for a
         * plain Phaser `Text` it then defaults to `textCrop`, i.e. clipping via
         * `setCrop`, and that crop came out far narrower than the wrapped text
         * it was clipping: card rules text rendered as a single line reading
         * "If this stage is completed, the player" and simply stopped, with the
         * wrapped remainder cropped away. `textCrop: false` selects rexUI's
         * geometry-mask path instead, which clips to the block it actually
         * measured.
         */
        textCrop: false,
        space: { left: SCROLL_PADDING_X, right: SCROLL_PADDING_X, top: 2, bottom: 2, sliderX: SCROLL_SLIDER_GAP },
        slider: { track, thumb, width: SCROLL_TRACK_WIDTH },
      mouseWheelScroller: true,
    } as RexTextArea.IConfig).layout();
  }

  setText(text: string): void {
    this.panel.setText(text);
  }

  /** Repositions and resizes in place, for a scene that redraws on every state change. */
  layout(rect: Rect): void {
    this.panel.setPosition(rect.x, rect.y);
    this.panel.setMinSize(rect.width, rect.height);
    this.panel.layout();
  }

  destroy(): void {
    this.panel.destroy();
  }
}


export interface McTextInputOptions {
  readonly rect: Rect;
  readonly value: string;
  /** Defaults to `typeRole.mono` — the design's "specs, tokens" role, which a seed is. */
  readonly type?: TypeSpec;
  readonly placeholder?: string;
  readonly maxLength?: number;
  /** Restricts *keystrokes* to digits rather than rejecting the whole field on blur. */
  readonly numeric?: boolean;
  readonly onChange?: (value: string) => void;
}

/**
 * A DOM-backed text field: rexUI's `InputText`, the app's one DOM element
 * (PLAN.md Phase 4, "Text input ... is the only DOM in the app"). It is styled
 * to the design tokens through CSS rather than left at rexUI's defaults, and
 * its focus state reuses `McSelectionRing` — the same ring a card or a focused
 * control gets everywhere else — so it doesn't read as a foreign control next
 * to the native widgets beside it.
 */
export class McTextInput {
  readonly #input: RexInputText;
  readonly #ring: McSelectionRing;
  #rect: Rect;
  #onChange: ((value: string) => void) | undefined;
  #numeric: boolean;

  constructor(scene: Phaser.Scene, options: McTextInputOptions) {
    this.#rect = options.rect;
    this.#onChange = options.onChange;
    this.#numeric = options.numeric ?? false;
    const { rect } = options;
    const type = options.type ?? typeRole.mono;
    const s = skin("secondary", "rest");

    this.#ring = new McSelectionRing(scene);

    this.#input = addInputText(scene, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      origin: 0,
      // A numeric HTML input strips leading zeros and lets the browser reject
      // partial input in ways that don't match "filter every keystroke", so
      // the filtering below does the numeric job and the element stays text.
      type: "text",
      text: options.value,
      placeholder: options.placeholder ?? "",
      ...(options.maxLength !== undefined ? { maxLength: options.maxLength } : {}),
      align: "left",
      fontFamily: fontFamilyOf(type),
      fontSize: `${type.size}px`,
      color: cssOf(s.text, 1),
      backgroundColor: cssOf(s.fill, 1),
      borderColor: cssOf(s.stroke, 1),
      borderWidth: `${s.strokeWidth}px`,
      borderStyle: "solid",
      borderRadius: "0px",
      outline: "none",
      paddingLeft: "10px",
      paddingRight: "10px",
    } as RexInputText.IConfig);

    /**
     * `origin: 0` in the config above is not enough.
     *
     * rexUI's sizer-based widgets read `origin` from their config, but
     * `InputText` extends Phaser's `DOMElement`, which positions by its
     * *centre* and ignores that key — so the field rendered centred on the
     * rect's top-left corner and hung off the left edge of the screen. Every
     * other widget here is top-left anchored, and `layout()` below feeds it
     * top-left rects, so the origin has to be set on the object itself.
     */
    this.#input.setOrigin(0, 0);

    this.#input.on("textchange", () => {
      const raw = this.#input.text;
      const filtered = this.#numeric ? raw.replace(/[^0-9]/g, "") : raw;
      if (filtered !== raw) this.#input.setText(filtered);
      this.#onChange?.(filtered);
    });
    this.#input.on("focus", () => this.#ring.show(this.#rect, "static", true));
    this.#input.on("blur", () => this.#ring.hide());

    // Enter or Escape leaves the field and hands the keyboard back to the
    // screen's focus route. The event stops here, so the same key press doesn't
    // reach Phaser's window listener and also press whatever the route has focused.
    (this.#input.node as HTMLElement).addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.stopPropagation();
      this.#input.setBlur();
    });
  }

  /** True while the player is typing in the field — a screen's keyboard route stands aside. */
  get focused(): boolean {
    return this.#input.isFocused;
  }

  /** Puts the caret in the field, for a keyboard or pad user who pressed Enter on it. */
  focus(): void {
    this.#input.setFocus();
  }

  /** The underlying DOM game object, so a scene can detach it from a full
   * child-list sweep instead of destroying and recreating it — tearing down a
   * DOM `<input>` mid-keystroke blurs it and drops focus and cursor position,
   * which a Graphics-backed widget never has to worry about. */
  get gameObject(): Phaser.GameObjects.GameObject {
    return this.#input;
  }

  get value(): string {
    return this.#input.text;
  }

  setValue(value: string): void {
    this.#input.setText(value);
  }

  /** Repositions and resizes in place, for a scene that redraws on every state change. */
  layout(rect: Rect): void {
    this.#rect = rect;
    this.#input.setPosition(rect.x, rect.y);
    this.#input.resize(rect.width, rect.height);
    if (this.#input.isFocused) this.#ring.show(rect, "static", true);
  }

  destroy(): void {
    this.#ring.destroy();
    this.#input.destroy();
  }
}

export interface McMultilineInputOptions {
  readonly rect: Rect;
  readonly value: string;
  /** Defaults to `typeRole.mono` — a pasted decklist is data, not prose. */
  readonly type?: TypeSpec;
  readonly placeholder?: string;
  readonly onChange?: (value: string) => void;
}

/**
 * A multi-line, wrapped, scrollable text field for pasting a decklist (PLAN.md
 * Phase 9's paste importer) — `McTextInput`'s sibling for the one case a
 * single-line DOM `<input>` cannot serve. A real decklist is several dozen
 * lines, and pasting multi-line text into a single-line field is browsers'
 * own territory to mangle: Chromium and Firefox both strip the newlines on the
 * way in, which silently turns a legible decklist into one unparsable line
 * before this app's code ever sees it (`@mc/content`'s `parseDecklistText`
 * splits on `\r?\n`). `McTextInput` cannot be fixed to avoid that; only a
 * field that actually accepts more than one line can.
 *
 * Backed by rexUI's `TextAreaInput`, canvas-rendered rather than a second kind
 * of visible DOM control (see `ui/rex.ts`), so this still honours "`McTextInput`
 * is the app's only DOM element" (PLAN.md Phase 4) in spirit: a hidden native
 * text-edit element captures keystrokes and paste exactly as `InputText`'s
 * does, and nothing here is a second *visible* DOM field beside it.
 */
export class McMultilineInput {
  readonly #input: RexTextAreaInput;
  readonly #ring: McSelectionRing;
  #rect: Rect;
  #focused = false;

  constructor(scene: Phaser.Scene, options: McMultilineInputOptions) {
    this.#rect = options.rect;
    const { rect } = options;
    const type = options.type ?? typeRole.mono;
    const s = skin("secondary", "rest");

    this.#ring = new McSelectionRing(scene);

    this.#input = addTextAreaInput(scene, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      origin: 0,
      text: {
        style: {
          fontFamily: fontFamilyOf(type),
          fontSize: `${type.size}px`,
          color: cssOf(s.text, 1),
        },
        background: {
          color: cssOf(s.fill, 1),
          stroke: cssOf(s.stroke, 1),
          strokeThickness: s.strokeWidth,
        },
        wrap: { mode: "word" },
        onFocus: () => {
          this.#focused = true;
          this.#ring.show(this.#rect, "static", true);
        },
        onBlur: () => {
          this.#focused = false;
          this.#ring.hide();
        },
      },
      space: { left: 10, right: 10, top: 8, bottom: 8 },
      content: options.value,
    } as unknown as ConstructorParameters<typeof RexTextAreaInput>[1]).layout();

    if (options.onChange) {
      const onChange = options.onChange;
      this.#input.on("textchange", (text: string) => onChange(text));
    }
  }

  /** True while the player is typing — a screen's keyboard route stands aside, the same convention as `McTextInput.focused`. */
  get focused(): boolean {
    return this.#focused;
  }

  /**
   * Puts the caret in the field, for a keyboard or pad user who pressed Enter
   * on it — the same job `McTextInput.focus()` does. `TextAreaInput`'s own
   * type declarations expose no public "open the editor" call (only
   * `setText`/`setReadOnly`/scrolling), so this reaches for its inner
   * `CanvasInput` child's `open()` the same way `TextAreaInput.js` itself
   * does internally, defensively: if a future rexUI version changes that
   * shape, a keyboard user simply has to click the field instead, rather than
   * this throwing.
   */
  focus(): void {
    const child = (this.#input as unknown as { childrenMap?: { child?: { open?: () => void } } }).childrenMap?.child;
    child?.open?.();
  }

  get value(): string {
    return this.#input.text;
  }

  setValue(value: string): void {
    this.#input.setText(value);
  }

  /**
   * Every display-list object this field draws with, root first, so a scene can
   * detach all of them from a full child-list sweep and hand them back after.
   *
   * Unlike `McTextInput` (one DOM element), rexUI's `TextAreaInput` is a sizer:
   * its `GridSizer` and the `CanvasInput` that renders the text are separate
   * entries in the scene's display list. Detaching only the root left those two
   * out of the list after the first rebuild, so the field kept taking keystrokes
   * but drew nothing.
   */
  get gameObjects(): readonly Phaser.GameObjects.GameObject[] {
    const root = this.#input as unknown as Phaser.GameObjects.GameObject & { getAllChildren(): Phaser.GameObjects.GameObject[] };
    return [root, ...root.getAllChildren()];
  }

  /** Repositions and resizes in place, for a scene that redraws on every state change. */
  layout(rect: Rect): void {
    this.#rect = rect;
    this.#input.setPosition(rect.x, rect.y);
    this.#input.setMinSize(rect.width, rect.height);
    this.#input.layout();
    if (this.#focused) this.#ring.show(rect, "static", true);
  }

  destroy(): void {
    this.#ring.destroy();
    this.#input.destroy();
  }
}

/** A stat the card draws as a starburst. HP is not one; it gets `McHpPlate`. */
export type StatKey = keyof typeof statHue;

export interface McStatBadgeOptions {
  /** Centre of the starburst, in scene coordinates. */
  readonly cx: number;
  readonly cy: number;
  /** Starburst diameter. The label ribbon hangs below it; `badgeExtent` says how far. */
  readonly size: number;
  readonly stat: StatKey;
  /** The engine's number, already modified; "—" for a printed dash. */
  readonly value: string;
  /** Additive modifiers on the stat, drawn as a signed chip. */
  readonly bonus?: number;
  readonly alpha?: number;
}

/** Points on the starburst: enough to read as the printed splat at badge size without becoming a circle. */
const BURST_POINTS = 10;
const BURST_INNER = 0.78;

/**
 * One stat, drawn the way the printed card draws it: a coloured starburst
 * holding the number, with the stat's name on an ink ribbon beneath.
 *
 * It replaced four boxed tiles crammed into the ~110px text column beside the
 * card, where "THW ATK DEF" collapsed into overlapping fragments and the
 * number was the smallest thing on the panel. A player already reads these
 * shapes as these stats from the card, so the live number goes into the same
 * shape rather than a new one.
 *
 * **It draws the engine's number, not the card's.** The scan still prints the
 * base value; this is where a modified value shows, and a buff or penalty gets
 * a signed chip ("+1") rather than only a colour change, because colour never
 * carries meaning alone in this design.
 *
 * One container, so a card-shaped panel that turns sideways when exhausted
 * turns its badges with it, and `update()` changes the number in place for a
 * future animation pass. It registers nothing on an emitter that outlives the
 * scene, so destroying the container is the whole cleanup.
 */
export class McStatBadge {
  readonly container: Phaser.GameObjects.Container;
  readonly #burst: Phaser.GameObjects.Graphics;
  readonly #ribbon: Phaser.GameObjects.Graphics;
  readonly #number: Phaser.GameObjects.Text;
  readonly #label: Phaser.GameObjects.Text;
  readonly #chip: Phaser.GameObjects.Graphics;
  readonly #chipText: Phaser.GameObjects.Text;
  #options: McStatBadgeOptions;

  constructor(scene: Phaser.Scene, options: McStatBadgeOptions) {
    this.#options = options;
    this.#burst = scene.add.graphics();
    this.#ribbon = scene.add.graphics();
    this.#number = scene.add.text(0, 0, "", textStyle(typeRole.stat, surface.paper.hex)).setOrigin(0.5, 0.5);
    this.#label = scene.add.text(0, 0, "", textStyle(typeRole.label, surface.paper.hex)).setOrigin(0.5, 0.5);
    if (typeRole.label.letterSpacing) this.#label.setLetterSpacing(typeRole.label.letterSpacing);
    this.#chip = scene.add.graphics();
    this.#chipText = scene.add.text(0, 0, "", textStyle(typeRole.label, surface.paper.hex)).setOrigin(0.5, 0.5);
    this.container = scene.add.container(options.cx, options.cy, [
      this.#burst,
      this.#ribbon,
      this.#number,
      this.#label,
      this.#chip,
      this.#chipText,
    ]);
    this.redraw();
  }

  update(options: Partial<McStatBadgeOptions>): void {
    this.#options = { ...this.#options, ...options };
    this.redraw();
  }

  redraw(): void {
    const { cx, cy, size, stat, value, bonus = 0, alpha = 1 } = this.#options;
    this.container.setPosition(cx, cy);
    const radius = size / 2;

    const burst = Array.from({ length: BURST_POINTS * 2 }, (_unused, index) => {
      const reach = index % 2 === 0 ? radius : radius * BURST_INNER;
      const angle = -Math.PI / 2 + (index * Math.PI) / BURST_POINTS;
      // Phaser 4 types `fillPoints` as `Vector2[]`; a plain `{x, y}` is not accepted.
      return new Phaser.Math.Vector2(Math.cos(angle) * reach, Math.sin(angle) * reach);
    });
    this.#burst.clear();
    this.#burst.fillStyle(statHue[stat].hex, alpha).fillPoints(burst, true);
    this.#burst.lineStyle(2, surface.ink.hex, alpha).strokePoints(burst, true, true);

    // White with an ink outline, as the card prints it: legible on any hue.
    this.#number
      .setText(value)
      .setFontSize(Math.max(CAPTION_FLOOR + 2, Math.round(size * 0.52)))
      .setColor(cssOf(surface.paper.hex, alpha))
      .setStroke(cssOf(surface.ink.hex, alpha), Math.max(2, Math.round(size * 0.09)))
      .setPosition(0, -size * 0.03);

    const ribbon = ribbonHeight(size);
    const ribbonWidth = Math.round(size * 0.94);
    const ribbonTop = size * 0.34;
    this.#ribbon.clear();
    this.#ribbon.fillStyle(surface.ink.hex, alpha).fillRect(-ribbonWidth / 2, ribbonTop, ribbonWidth, ribbon);
    const labelSize = Math.max(CAPTION_FLOOR, Math.min(typeRole.label.size + 1, Math.round(ribbon * 0.74)));
    this.#label.setText(caseOf(typeRole.label, stat)).setColor(cssOf(surface.paper.hex, alpha));
    fitText(this.#label, ribbonWidth - 2, labelSize);
    this.#label.setPosition(0, ribbonTop + ribbon / 2);

    const signed = bonus === 0 ? "" : `${bonus > 0 ? "+" : "\u2212"}${Math.abs(bonus)}`;
    this.#chip.clear();
    this.#chipText.setVisible(signed !== "");
    if (signed) {
      this.#chipText
        .setText(signed)
        .setFontSize(Math.max(CAPTION_FLOOR, Math.round(size * 0.28)))
        .setColor(cssOf(surface.paper.hex, alpha));
      const chipWidth = Math.ceil(this.#chipText.width) + 6;
      const chipHeight = Math.ceil(this.#chipText.height) + 2;
      const chipX = radius * 0.62;
      const chipY = -radius * 0.74;
      this.#chip
        .fillStyle(bonus > 0 ? signal.heal.hex : surface.ink.hex, alpha)
        .fillRect(chipX - chipWidth / 2, chipY - chipHeight / 2, chipWidth, chipHeight);
      this.#chip.lineStyle(1.5, surface.paper.hex, alpha).strokeRect(chipX - chipWidth / 2, chipY - chipHeight / 2, chipWidth, chipHeight);
      this.#chipText.setPosition(chipX, chipY);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

export interface McHpPlateOptions {
  readonly rect: Rect;
  readonly current: number;
  readonly max: number;
  /** Additive modifiers on maximum hit points, drawn as a signed chip. */
  readonly bonus?: number;
  readonly alpha?: number;
  /**
   * The character has a tough status. Drawn *over* the plate as hatched
   * armour, never beside it: it is protection, not a wound (Components.dc.html
   * section 05).
   */
  readonly tough?: boolean;
}

/**
 * Hit points as the most prominent number on a character panel.
 *
 * HP was a 17px "9/11" in the last of four equal boxes. It is the number a
 * player checks most and the one that ends the game, so it gets a full-width
 * plate: the current value large, the maximum beside it smaller, and a meter
 * along the foot so "how hurt" reads before the digits do.
 */
export class McHpPlate {
  readonly container: Phaser.GameObjects.Container;
  readonly #graphics: Phaser.GameObjects.Graphics;
  readonly #caption: Phaser.GameObjects.Text;
  readonly #current: Phaser.GameObjects.Text;
  readonly #max: Phaser.GameObjects.Text;
  readonly #chip: Phaser.GameObjects.Graphics;
  readonly #chipText: Phaser.GameObjects.Text;
  #options: McHpPlateOptions;

  constructor(scene: Phaser.Scene, options: McHpPlateOptions) {
    this.#options = options;
    this.#graphics = scene.add.graphics();
    this.#caption = scene.add.text(0, 0, caseOf(typeRole.label, "hp"), textStyle(typeRole.label, surface.ink.hex)).setOrigin(0, 0.5);
    if (typeRole.label.letterSpacing) this.#caption.setLetterSpacing(typeRole.label.letterSpacing);
    this.#current = scene.add.text(0, 0, "", textStyle(typeRole.stat, surface.ink.hex)).setOrigin(0, 0.5);
    this.#max = scene.add.text(0, 0, "", textStyle(typeRole.statSmall, surface.ink.hex)).setOrigin(0, 0.5);
    this.#chip = scene.add.graphics();
    this.#chipText = scene.add.text(0, 0, "", textStyle(typeRole.label, surface.paper.hex)).setOrigin(0.5, 0.5);
    this.container = scene.add.container(options.rect.x, options.rect.y, [
      this.#graphics,
      this.#caption,
      this.#current,
      this.#max,
      this.#chip,
      this.#chipText,
    ]);
    this.redraw();
  }

  update(options: Partial<McHpPlateOptions>): void {
    this.#options = { ...this.#options, ...options };
    this.redraw();
  }

  redraw(): void {
    const { rect, current, max, bonus = 0, alpha = 1, tough = false } = this.#options;
    const { width, height } = rect;
    this.container.setPosition(rect.x, rect.y);

    const meter = Math.max(3, Math.round(height * 0.14));
    const body = height - meter - 3;
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.#graphics.clear();
    this.#graphics.fillStyle(surface.paper.hex, alpha).fillRect(0, 0, width, height);
    if (tough) hatchRect(this.#graphics, { x: 0, y: 0, width, height }, status.tough.hex, alpha * 0.28, 9, 3);
    this.#graphics.fillStyle(surface.parchment.hex, alpha).fillRect(2, height - meter - 2, width - 4, meter);
    this.#graphics.fillStyle(signal.heal.hex, alpha).fillRect(2, height - meter - 2, (width - 4) * ratio, meter);
    if (tough) {
      const track: Rect = { x: 2, y: height - meter - 2, width: width - 4, height: meter };
      this.#graphics.fillStyle(surface.ink.hex, alpha * 0.9).fillRect(track.x, track.y, track.width, track.height);
      hatchRect(this.#graphics, track, status.tough.hex, alpha, 6, 3);
    }
    this.#graphics.lineStyle(2, surface.ink.hex, alpha).strokeRect(0, 0, width, height);
    if (tough) this.#graphics.lineStyle(3, status.tough.hex, alpha).strokeRect(2.5, 2.5, width - 5, height - 5);

    const mid = body / 2 + 1;
    this.#caption.setColor(cssOf(surface.ink.hex, ink.label * alpha)).setPosition(6, mid);

    const signed = bonus === 0 ? "" : `${bonus > 0 ? "+" : "\u2212"}${Math.abs(bonus)}`;
    this.#chip.clear();
    this.#chipText.setVisible(signed !== "");
    let chipWidth = 0;
    if (signed) {
      this.#chipText
        .setText(signed)
        .setFontSize(Math.max(CAPTION_FLOOR, Math.round(body * 0.42)))
        .setColor(cssOf(surface.paper.hex, alpha));
      chipWidth = Math.ceil(this.#chipText.width) + 6;
    }

    // The current value as large as the plate allows, shrinking only until the
    // whole reading ("HP 9/11 +2") fits.
    const left = 6 + Math.ceil(this.#caption.width) + 6;
    this.#current.setText(String(current)).setColor(cssOf(surface.ink.hex, alpha));
    this.#max.setText(`/${max}`).setColor(cssOf(surface.ink.hex, ink.meta * alpha));
    let big = Math.max(CAPTION_FLOOR + 2, Math.round(body * 0.86));
    for (;;) {
      this.#current.setFontSize(big);
      this.#max.setFontSize(Math.max(CAPTION_FLOOR, Math.round(big * 0.58)));
      const used = left + this.#current.width + 2 + this.#max.width + (chipWidth > 0 ? chipWidth + 6 : 0);
      if (used <= width - 6 || big <= CAPTION_FLOOR + 2) break;
      big -= 1;
    }
    this.#current.setPosition(left, mid);
    this.#max.setPosition(left + this.#current.width + 2, mid + big * 0.14);

    if (signed) {
      const chipHeight = Math.ceil(this.#chipText.height) + 2;
      const chipX = width - 4 - chipWidth / 2;
      this.#chip
        .fillStyle(bonus > 0 ? signal.heal.hex : surface.ink.hex, alpha)
        .fillRect(chipX - chipWidth / 2, mid - chipHeight / 2, chipWidth, chipHeight);
      this.#chipText.setPosition(chipX, mid);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
