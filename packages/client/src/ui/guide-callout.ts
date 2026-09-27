/**
 * `McGuideCallout` (guided mode G4a, `docs/guided-mode.md` §4): the anchored yellow guide callout used
 * on phone and tablet portrait — a `GUIDE` stamp, a step label, an optional "SKIP LESSON" link, an
 * optional close ×, a Bangers title, an `McTermText` body sharing one `McTooltip`, an optional
 * secondary/primary action pair (or a "do this to continue" hint line in the primary's place, for a
 * step that waits on a board action instead of a button), and an arrow toward the thing it's teaching.
 * `docs/guided-mode.md` §4's G4b (`McGuidePanel`, the desktop/tablet-landscape side rail) and G4c
 * (spotlight + tags) are separate boxes; this widget draws the callout alone, with no board wiring.
 *
 * **Layout is a full rebuild.** `update()` tears down and redraws every child rather than diffing,
 * matching `McTermText`'s own `#layout` — a guide step changes rarely enough (once per Tab/board event,
 * never per frame) that this is simpler than incremental updates and still cheap. The callout measures
 * its own title/body height by laying them out at the origin first, then asks `guideCalloutLayoutOf`
 * (`view/guide-callout-model.ts`) where to actually draw, and repositions everything once.
 *
 * **The tooltip is this widget's own.** The spec calls for "one shared `McTooltip`" because a guide
 * callout only ever has one `McTermText` body — unlike the term-text dev demo (`scenes/term-text-demo.ts`),
 * which exercises two blocks sharing a tooltip to prove that coordination path works. `setTermsEnabled`
 * doesn't come up here for the same reason: there's nothing else to coordinate against.
 *
 * **Keyboard.** `focusNext`/`activateFocused`/`blur` cycle the callout's own buttons only (skip, close,
 * secondary, primary, in that reading order) — the body's terms have their own independent hover/tap
 * path and aren't part of this cycle. `activatePrimary()` is the Enter shortcut: it fires the primary
 * action directly regardless of what's focused, the same "N always advances" shape the parked prototype's
 * `coachKeyFor` used (`ui/coach-state.ts`). `handleEscape()` follows that prototype's gotcha
 * (`docs/guided-mode.md` §7): Phaser 4 runs each scene's keyboard handlers in scene-start order, so this
 * widget can't `stopPropagation` an Escape away from the scene under it — the host scene's own keyboard
 * binding must call `handleEscape()` first and skip its own handling when it returns `true`. It closes
 * an open tooltip first (matching `McTooltip.handleEscape()`'s own contract), and only once that reports
 * nothing to close does it treat Escape as "close/skip the callout" (`onClose` if given, else `onSkip`).
 */
import Phaser from "phaser";
import { border, hit, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { guideCalloutLayoutOf, type GuideCalloutSide } from "../view/guide-callout-model.js";
import { tooltipContentOf, type TermTextTerm } from "../view/term-text-model.js";
import { McButton } from "./widgets.js";
import { McTermText } from "./term-text.js";
import { McTooltip } from "./tooltip.js";
import { textStyle } from "./theme.js";

const PAD = 20;
const MAX_WIDTH = 400;
const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 13 };
const STAMP_TYPE: TypeSpec = { ...typeRole.label, size: 10 };
const TITLE_TYPE: TypeSpec = { ...typeRole.barTitle };

export interface McGuideCalloutContent {
  /** "STEP 1 OF 3". Omit for a step-less surface (an opportunistic tip). */
  readonly stepLabel?: string | null;
  readonly title: string;
  /** `McTermText` markup — see `view/term-text-model.ts`'s header for `[[id]]` / `[[id|label]]`. */
  readonly body: string;
  /** The top-right "SKIP LESSON" link's label. Omit/null to hide it. */
  readonly skipLabel?: string | null;
  /** Draws the top-right close ×. Mutually exclusive with `skipLabel` on every design tile, but not enforced here. */
  readonly showClose?: boolean;
  readonly secondaryLabel?: string | null;
  /** Omit/null together with `continueHint` to show neither action row. */
  readonly primaryLabel?: string | null;
  /** Shown instead of the primary button, for a step that waits on a board action ("Flip to alter-ego to continue"). */
  readonly continueHint?: string | null;
  /** Which side of the anchor the callout prefers. Default `"below"`. */
  readonly preferredSide?: "above" | "below";
}

export interface McGuideCalloutOptions {
  readonly onPrimary?: () => void;
  readonly onSecondary?: () => void;
  readonly onSkip?: () => void;
  readonly onClose?: () => void;
  /** "RULES GLOSSARY ▸" on a body term's tooltip — the host owns the actual scene launch (`SCENES.rules`). */
  readonly onOpenGlossary?: (query: string) => void;
}

interface FocusTarget {
  readonly rect: Rect;
  readonly activate: () => void;
}

/** The anchored yellow guide callout. */
export class McGuideCallout {
  readonly container: Phaser.GameObjects.Container;
  readonly #scene: Phaser.Scene;
  readonly #options: McGuideCalloutOptions;
  readonly #tooltip: McTooltip;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #body: McTermText | null = null;
  #focusables: FocusTarget[] = [];
  #focusIndex = -1;
  readonly #focusRing: Phaser.GameObjects.Graphics;
  #primaryLabel: string | null = null;

  constructor(scene: Phaser.Scene, options: McGuideCalloutOptions = {}) {
    this.#scene = scene;
    this.#options = options;
    this.container = scene.add.container(0, 0);
    this.#tooltip = new McTooltip(scene);
    this.#focusRing = scene.add.graphics();
  }

  /** Redraws the callout for `content`, anchored at `anchorRect` (or centered near the bottom when `null`) within `viewport`. */
  update(content: McGuideCalloutContent, anchorRect: Rect | null, viewport: Rect): void {
    this.#tooltip.hide();
    this.#teardown();

    const scene = this.#scene;
    const width = Math.min(MAX_WIDTH, viewport.width - 32);
    const innerWidth = width - PAD * 2;
    const objects: Phaser.GameObjects.GameObject[] = [];

    // --- Top row: GUIDE stamp + step label (left), skip/close (right). Measured, positioned once the box height is known. ---
    const stampWidth = STAMP_TYPE.size * 5;
    const stampHeight = 20;
    const stamp = scene.add.graphics();
    const stampLabel = scene.add.text(0, 0, "GUIDE", textStyle(STAMP_TYPE, surface.paper.hex)).setOrigin(0, 0.5);
    const stepLabel = content.stepLabel
      ? scene.add.text(0, 0, content.stepLabel.toUpperCase(), textStyle(STAMP_TYPE, surface.ink.hex))
      : null;

    let skipLabel: Phaser.GameObjects.Text | null = null;
    let skipUnderline: Phaser.GameObjects.Graphics | null = null;
    let skipZone: Phaser.GameObjects.Zone | null = null;
    if (content.skipLabel) {
      skipLabel = scene.add.text(0, 0, content.skipLabel.toUpperCase(), textStyle(STAMP_TYPE, surface.ink.hex));
      skipUnderline = scene.add.graphics();
    }
    let closeLabel: Phaser.GameObjects.Text | null = null;
    let closeZone: Phaser.GameObjects.Zone | null = null;
    if (content.showClose) {
      closeLabel = scene.add
        .text(0, 0, "×", { ...textStyle(TITLE_TYPE, surface.ink.hex), fontSize: "24px" })
        .setOrigin(0.5, 0.5);
    }

    // --- Title (Bangers). ---
    const title = scene.add
      .text(0, 0, content.title.toUpperCase(), textStyle(TITLE_TYPE, surface.ink.hex))
      .setWordWrapWidth(innerWidth, true);

    // --- Body (McTermText, sharing this callout's own tooltip). ---
    const body = new McTermText(scene, {
      x: 0,
      y: 0,
      width: innerWidth,
      text: content.body,
      color: surface.ink.hex,
      onTermOpen: (term, rect) => this.#openTooltip(term, rect, viewport),
      onTermClose: () => this.#tooltip.hide(),
    });
    this.#body = body;

    // --- Action row: secondary + primary, or a "do this to continue" hint line. ---
    const hasButtons = Boolean(content.secondaryLabel || content.primaryLabel);
    const buttonRowHeight = hasButtons ? hit.target : 0;
    let continueHint: Phaser.GameObjects.Text | null = null;
    if (!hasButtons && content.continueHint) {
      continueHint = scene.add
        .text(0, 0, content.continueHint, { ...textStyle(typeRole.emphasis, surface.ink.hex), fontStyle: "italic" })
        .setWordWrapWidth(innerWidth, true);
    }
    const hintRowHeight = continueHint ? continueHint.height : 0;

    // --- Measure total height. ---
    let y = PAD;
    y += stampHeight + 10;
    y += title.height + 10;
    y += body.height + (hasButtons || continueHint ? 16 : 0);
    y += buttonRowHeight + hintRowHeight;
    y += PAD;
    const height = y;

    const layout = guideCalloutLayoutOf({
      viewport,
      anchor: anchorRect,
      width,
      height,
      preferredSide: content.preferredSide ?? "below",
    });
    const { rect } = layout;

    // --- Panel + arrow. ---
    const panel = scene.add.graphics();
    paintCalloutPanel(panel, rect, layout.side, layout.arrowX);
    objects.push(panel);

    // --- Position everything at the final rect. ---
    let cy = rect.y + PAD;
    stamp.fillStyle(surface.ink.hex, 1).fillRect(rect.x + PAD, cy - stampHeight / 2, stampWidth, stampHeight);
    stampLabel.setPosition(rect.x + PAD + 8, cy);
    objects.push(stamp, stampLabel);
    if (stepLabel) {
      stepLabel.setPosition(rect.x + PAD + stampWidth + 10, cy - stepLabel.height / 2);
      objects.push(stepLabel);
    }

    const focusables: FocusTarget[] = [];
    if (skipLabel && skipUnderline) {
      skipLabel.setPosition(rect.x + rect.width - PAD - skipLabel.width, cy - skipLabel.height / 2);
      skipUnderline
        .lineStyle(1.5, surface.ink.hex, 1)
        .lineBetween(
          skipLabel.x,
          skipLabel.y + skipLabel.height,
          skipLabel.x + skipLabel.width,
          skipLabel.y + skipLabel.height,
        );
      skipZone = makeLinkZone(scene, skipLabel, () => this.#options.onSkip?.());
      objects.push(skipLabel, skipUnderline, skipZone);
      focusables.push({
        rect: { x: skipLabel.x, y: skipLabel.y, width: skipLabel.width, height: skipLabel.height },
        activate: () => this.#options.onSkip?.(),
      });
    }
    if (closeLabel) {
      closeLabel.setPosition(rect.x + rect.width - PAD - 8, cy);
      closeZone = makeLinkZone(scene, closeLabel, () => this.#options.onClose?.());
      objects.push(closeLabel, closeZone);
      focusables.push({
        rect: { x: closeLabel.x - 12, y: closeLabel.y - 12, width: 24, height: 24 },
        activate: () => this.#options.onClose?.(),
      });
    }
    cy += stampHeight + 10;

    title.setPosition(rect.x + PAD, cy);
    objects.push(title);
    cy += title.height + 10;

    body.container.setPosition(rect.x + PAD, cy);
    objects.push(body.container);
    cy += body.height + (hasButtons || continueHint ? 16 : 0);

    this.#primaryLabel = content.primaryLabel ?? null;
    if (hasButtons) {
      const gap = 12;
      const hasBoth = Boolean(content.secondaryLabel) && Boolean(content.primaryLabel);
      const secondaryWidth = hasBoth ? (innerWidth - gap) / 2 : innerWidth;
      const primaryWidth = hasBoth ? (innerWidth - gap) / 2 : innerWidth;
      let bx = rect.x + PAD;
      if (content.secondaryLabel) {
        const secondaryRect: Rect = { x: bx, y: cy, width: secondaryWidth, height: hit.target };
        const secondary = new McButton(scene, {
          kind: "secondary",
          label: content.secondaryLabel,
          type: BUTTON_TYPE,
          rect: secondaryRect,
          tint: { fill: surface.paper.hex, ink: surface.ink.hex },
          onClick: () => this.#options.onSecondary?.(),
        });
        objects.push(secondary.container);
        focusables.push({ rect: secondaryRect, activate: () => this.#options.onSecondary?.() });
        bx += secondaryWidth + gap;
      }
      if (content.primaryLabel) {
        const primaryRect: Rect = { x: bx, y: cy, width: primaryWidth, height: hit.target };
        const primary = new McButton(scene, {
          kind: "primary",
          label: content.primaryLabel,
          type: BUTTON_TYPE,
          rect: primaryRect,
          tint: { fill: surface.ink.hex, ink: surface.paper.hex },
          onClick: () => this.#options.onPrimary?.(),
        });
        objects.push(primary.container);
        focusables.push({ rect: primaryRect, activate: () => this.#options.onPrimary?.() });
      }
    } else if (continueHint) {
      continueHint.setPosition(rect.x + PAD, cy);
      objects.push(continueHint);
    }

    this.#focusables = focusables;
    this.#focusIndex = -1;
    this.#focusRing.clear();

    this.#objects = objects;
    this.container.add(objects);
    this.container.add(this.#focusRing);
    this.#scene.children.bringToTop(this.container);
  }

  #openTooltip(term: TermTextTerm, anchorRect: Rect, viewport: Rect): void {
    const content = tooltipContentOf(term);
    if (!content) return;
    this.#body?.setTermsEnabled((id) => id === term.id);
    this.#tooltip.show(
      anchorRect,
      content,
      viewport,
      () => this.#options.onOpenGlossary?.(content.title),
      () => this.#body?.setTermsEnabled(() => true),
    );
  }

  /** Every focusable control's own on-screen rect plus the open tooltip's link rect, if any — a headless click-through's only way to find canvas-drawn controls (`scenes/guide-callout-demo.ts`'s dev-only hook). */
  debugRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } {
    return { focusables: this.#focusables.map((f) => f.rect), tooltipLink: this.#tooltip.linkRect };
  }

  /**
   * Every term the body resolved, in reading order, for a headless test to hover/tap by rect (mirrors
   * `McTermText.debugTermRects`) — offset by the body's own container position, since `McTermText` is
   * always constructed at the origin here and repositioned as a whole once the callout's own box is laid
   * out, so its term rects are local to that container rather than the screen.
   */
  debugTermRects(): readonly { readonly id: string; readonly rect: Rect }[] {
    const body = this.#body;
    if (!body) return [];
    const dx = body.container.x;
    const dy = body.container.y;
    return body.debugTermRects().map(({ id, rect }) => ({ id, rect: { ...rect, x: rect.x + dx, y: rect.y + dy } }));
  }

  /** Tab-cycles the callout's own buttons (skip, close, secondary, primary) — not the body's terms. */
  focusNext(direction: 1 | -1 = 1): boolean {
    if (this.#focusables.length === 0) return false;
    this.#focusIndex = (this.#focusIndex + direction + this.#focusables.length) % this.#focusables.length;
    this.#drawFocusRing();
    return true;
  }

  /** Activates whichever button keyboard focus (`focusNext`) is currently on, if any. */
  activateFocused(): void {
    this.#focusables[this.#focusIndex]?.activate();
  }

  /** The Enter shortcut: fires the primary action directly, regardless of Tab focus. No-op with no primary. */
  activatePrimary(): void {
    if (this.#primaryLabel) this.#options.onPrimary?.();
  }

  /** Clears keyboard focus and its ring. */
  blur(): void {
    this.#focusIndex = -1;
    this.#focusRing.clear();
  }

  #drawFocusRing(): void {
    this.#focusRing.clear();
    const target = this.#focusables[this.#focusIndex];
    if (!target) return;
    this.#focusRing
      .lineStyle(border.control, surface.ink.hex, 1)
      .strokeRect(target.rect.x - 3, target.rect.y - 3, target.rect.width + 6, target.rect.height + 6);
  }

  /**
   * The host scene's own Escape handling (see the module header's "Keyboard" section): closes an open
   * tooltip first, and only once there's none left open treats Escape as closing (or skipping) the
   * callout itself. Returns whether Escape did anything, so the host's own binding knows to skip its own
   * handling for this key.
   */
  handleEscape(): boolean {
    if (this.#tooltip.handleEscape()) return true;
    if (this.#options.onClose) {
      this.#options.onClose();
      return true;
    }
    if (this.#options.onSkip) {
      this.#options.onSkip();
      return true;
    }
    return false;
  }

  #teardown(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
    this.#body?.destroy();
    this.#body = null;
  }

  destroy(): void {
    this.#teardown();
    this.#tooltip.destroy();
    this.#focusRing.destroy();
    this.container.destroy(true);
  }
}

/** A zone at least `hit.target` on a side, centered on `label`, for a link-styled control with no button chrome. */
function makeLinkZone(
  scene: Phaser.Scene,
  label: Phaser.GameObjects.Text,
  onClick: () => void,
): Phaser.GameObjects.Zone {
  const w = Math.max(label.width, hit.target);
  const h = Math.max(label.height, hit.target);
  const zone = scene.add
    .zone(label.x + label.width / 2 - w / 2, label.y + label.height / 2 - h / 2, w, h)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerup", onClick);
  return zone;
}

const ARROW_SIZE = 10;

/** The yellow ink-bordered panel and its arrow toward the anchor, mirroring `McTooltip#draw`'s own shape. */
function paintCalloutPanel(
  g: Phaser.GameObjects.Graphics,
  rect: Rect,
  side: GuideCalloutSide,
  arrowX: number | null,
): void {
  g.fillStyle(signal.caution.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
  if (side === "center" || arrowX === null) return;
  g.fillStyle(signal.caution.hex, 1);
  const tipX = arrowX;
  if (side === "below") {
    // The callout sits below its anchor, so the arrow points up at the top edge.
    g.fillTriangle(tipX - ARROW_SIZE, rect.y, tipX + ARROW_SIZE, rect.y, tipX, rect.y - ARROW_SIZE);
    g.lineStyle(border.object, surface.ink.hex, 1);
    g.lineBetween(tipX - ARROW_SIZE, rect.y, tipX, rect.y - ARROW_SIZE);
    g.lineBetween(tipX, rect.y - ARROW_SIZE, tipX + ARROW_SIZE, rect.y);
  } else {
    // The callout sits above its anchor, so the arrow points down at the bottom edge.
    const by = rect.y + rect.height;
    g.fillTriangle(tipX - ARROW_SIZE, by, tipX + ARROW_SIZE, by, tipX, by + ARROW_SIZE);
    g.lineStyle(border.object, surface.ink.hex, 1);
    g.lineBetween(tipX - ARROW_SIZE, by, tipX, by + ARROW_SIZE);
    g.lineBetween(tipX, by + ARROW_SIZE, tipX + ARROW_SIZE, by);
  }
}
