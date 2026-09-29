/**
 * `McGuideCallout` (guided mode G4a, `docs/guided-mode.md` §4): the anchored yellow guide callout used
 * on phone and tablet portrait — a `GUIDE` stamp, a step label, an optional close ×, a Bangers title, an
 * `McTermText` body sharing one `McTooltip`, an optional secondary/primary action pair (or a "do this to
 * continue" hint line in the primary's place, for a step that waits on a board action instead of a
 * button), an optional `nudge` line above the action row, and an arrow toward the thing it's teaching.
 * `docs/guided-mode.md` §4's G4b (`McGuidePanel`, the desktop/tablet-landscape side rail) and G4c
 * (spotlight + tags) are separate boxes; this widget draws the callout alone, with no board wiring.
 *
 * **Two exits, always** (§3.10 "never locked in"): the top row always carries "Skip this step"
 * (`onSkip`, `content.skipLabel` overrides the label text only — the control itself is unconditional
 * whenever `onSkip` is wired) and "Stop tutorial" (`onStop`), right-aligned via
 * `guideCalloutExitsLayoutOf`. Content must not be able to hide either while a lesson is running — that's
 * enforced by the guide controller always wiring both callbacks, not by this widget refusing to draw
 * without them.
 *
 * **Stop is a confirm, not a one-tap exit** (guided mode G11 fix wave 2, `docs/guided-mode.md` §4 G11:
 * "the phone and portrait × stops the tutorial in one tap, with no label"). The top-row × still reads as
 * a plain close glyph, so the first tap never stops anything: it asks the owner (`content.confirmingStop`,
 * set by `scenes/board/guide-mount.ts`) to redraw the *whole top row* as an inline "Stop the tutorial?
 * [Stop] [Keep going]" question instead — same row height, title/body underneath unmoved. `onStopRequest`
 * is the first-tap callback; `onStop` only fires from the confirm row's own "Stop", and `onStopCancel`
 * from "Keep going". Pause's own "Stop tutorial" (`BoardScene.stopGuide`) is a different control entirely
 * and stays a direct stop, unaffected by any of this.
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
 * **Keyboard.** `focusNext`/`activateFocused`/`blur` cycle the callout's own buttons only (close, skip,
 * stop, secondary, primary, in that reading order) — the body's terms have their own independent
 * hover/tap path and aren't part of this cycle. `activatePrimary()` is the Enter shortcut: it fires the
 * primary action directly regardless of what's focused, the same "N always advances" shape the parked
 * prototype's `coachKeyFor` used (`ui/coach-state.ts`). `handleEscape()` follows that prototype's gotcha
 * (`docs/guided-mode.md` §7): Phaser 4 runs each scene's keyboard handlers in scene-start order, so this
 * widget can't `stopPropagation` an Escape away from the scene under it — the host scene's own keyboard
 * binding must call `handleEscape()` first and skip its own handling when it returns `true`.
 *
 * **The Escape contract** (§3.10): `handleEscape()` never returns without acting. It closes an open
 * tooltip first (matching `McTooltip.handleEscape()`'s own contract); once there's none left open, it
 * calls `onSkip` — Escape always counts the step as skipped, never as "stop the tutorial", since Stop is
 * a deliberate click/tap on its own control, not an accidental key press.
 */
import Phaser from "phaser";
import { border, hit, signal, statHue, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import {
  guideCalloutExitsLayoutOf,
  guideCalloutLayoutOf,
  guideCalloutStopConfirmLayoutOf,
  type GuideCalloutSide,
} from "../view/guide-callout-model.js";
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
/** Padding on each side of the `GUIDE` ink stamp's own label, sizing the box to the measured text (mirrors `ui/guide-panel.ts`'s own `STAMP_PAD`). */
const STAMP_PAD = 8;

export interface McGuideCalloutContent {
  /** "STEP 1 OF 3". Omit for a step-less surface (an opportunistic tip). */
  readonly stepLabel?: string | null;
  readonly title: string;
  /** `McTermText` markup — see `view/term-text-model.ts`'s header for `[[id]]` / `[[id|label]]`. */
  readonly body: string;
  /**
   * Overrides the "Skip this step" exit's own label text (§3.10 "never locked in" — the control itself
   * is unconditional whenever `onSkip` is wired, this only renames it). Kept for content that already
   * passes the older "Skip lesson" wording; new content should leave this unset.
   */
  readonly skipLabel?: string | null;
  /** Draws the top-right close ×. Mutually exclusive with `skipLabel` on every design tile, but not enforced here. */
  readonly showClose?: boolean;
  readonly secondaryLabel?: string | null;
  /** Omit/null together with `continueHint` to show neither action row. */
  readonly primaryLabel?: string | null;
  /** Shown instead of the primary button, for a step that waits on a board action ("Flip to alter-ego to continue"). */
  readonly continueHint?: string | null;
  /**
   * A small line above the action row — G5c's soft-gate release fills it with "Want to do something
   * else? Skip this step" (`docs/guided-mode.md` §3.10). Omit/null to hide it.
   */
  readonly nudge?: string | null;
  /** Which side of the anchor the callout prefers. Default `"below"`. */
  readonly preferredSide?: "above" | "below";
  /**
   * True while the "Stop tutorial" × has been tapped once and is awaiting confirmation (guided mode G11 fix
   * wave 2, `docs/guided-mode.md` §4 G11: "the phone and portrait × stops the tutorial in one tap, with no
   * label"). The owner (`scenes/board/guide-mount.ts`) holds this as plain state across frames — this widget is
   * rebuilt fresh every draw, so it has nowhere of its own to remember a tap. While true, the top row swaps its
   * normal stamp/skip/× contents for an inline "Stop the tutorial? [Stop] [Keep going]" row instead of drawing
   * the rest of the step underneath a silent, one-tap exit.
   */
  readonly confirmingStop?: boolean;
}

export interface McGuideCalloutOptions {
  readonly onPrimary?: () => void;
  readonly onSecondary?: () => void;
  /** "Skip this step" (§3.10). Always shown, right-aligned in the top row, whenever this is wired. */
  readonly onSkip?: () => void;
  /**
   * "Stop tutorial" (§3.10) — the confirm row's own "Stop" button, the tutorial actually ending. Always shown,
   * right-aligned in the top row next to Skip (as a × when not confirming, or the inline confirm row's "Stop"
   * button once `content.confirmingStop` is true), whenever this is wired.
   */
  readonly onStop?: () => void;
  /**
   * The × was tapped once, not yet confirmed — asks the owner to redraw with `content.confirmingStop: true`
   * (guided mode G11 fix wave 2). Falls back to calling `onStop` directly when unset, so a caller that never
   * wires `confirmingStop` (the dev demo, `scenes/guide-callout-demo.ts`) keeps the older one-tap behavior.
   */
  readonly onStopRequest?: () => void;
  /** "Keep going" — the confirm row's own cancel button, asking the owner to redraw with `confirmingStop: false`. */
  readonly onStopCancel?: () => void;
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

    // --- Top row: GUIDE stamp + step label (left), the two §3.10 exits + optional close (right) — or, once the
    // × has been tapped once, the inline "Stop the tutorial?" confirm row in place of all of it (guided mode G11
    // fix wave 2: "the phone and portrait × stops the tutorial in one tap, with no label"). Same row height
    // (`stampHeight`) either way, so the confirm row never shifts the title/body underneath it. Measured,
    // positioned once the box height is known.
    const confirmingStop = Boolean(content.confirmingStop && this.#options.onStop);
    const stampHeight = 20;
    const stamp = confirmingStop ? null : scene.add.graphics();
    // Sized to the measured "GUIDE" label plus `STAMP_PAD` on each side, not a fixed guess that can overflow.
    const stampLabel = confirmingStop
      ? null
      : scene.add.text(0, 0, "GUIDE", textStyle(STAMP_TYPE, surface.paper.hex)).setOrigin(0, 0.5);
    const stampWidth = stampLabel?.width ? stampLabel.width + STAMP_PAD * 2 : 0;
    const stepLabel =
      !confirmingStop && content.stepLabel
        ? scene.add.text(0, 0, content.stepLabel.toUpperCase(), textStyle(STAMP_TYPE, surface.ink.hex))
        : null;

    // "Skip this step" — always drawn whenever `onSkip` is wired (§3.10 "never locked in"); `content.skipLabel`
    // only overrides the text, for content still passing the older "Skip lesson" wording. Hidden while
    // confirming Stop — that row has its own two exits (Stop/Keep going) and nothing else fits beside them.
    let skipLabel: Phaser.GameObjects.Text | null = null;
    let skipUnderline: Phaser.GameObjects.Graphics | null = null;
    let skipZone: Phaser.GameObjects.Zone | null = null;
    if (!confirmingStop && this.#options.onSkip) {
      const label = content.skipLabel ?? "Skip this step";
      skipLabel = scene.add.text(0, 0, label.toUpperCase(), textStyle(STAMP_TYPE, surface.ink.hex));
      skipUnderline = scene.add.graphics();
    }
    // "Stop tutorial" — always drawn whenever `onStop` is wired, right beside Skip. Drawn as a small ×
    // glyph (accessible label "Stop tutorial" — see `debugRects`/focus order for how a non-visual client
    // would announce it) rather than spelled out, since the top row is already carrying the `GUIDE` stamp,
    // step label and "Skip this step" — spelling out "Stop tutorial" too doesn't fit a 390px phone. The first
    // tap never stops anything outright: it only asks the owner to redraw with `confirmingStop: true`
    // (`onStopRequest`, falling back to `onStop` directly for a caller that never wires the confirm state).
    let stopLabel: Phaser.GameObjects.Text | null = null;
    let stopZone: Phaser.GameObjects.Zone | null = null;
    if (!confirmingStop && this.#options.onStop) {
      stopLabel = scene.add
        .text(0, 0, "×", { ...textStyle(STAMP_TYPE, surface.ink.hex), fontSize: "20px" })
        .setOrigin(0.5, 0.5);
    }
    let closeLabel: Phaser.GameObjects.Text | null = null;
    let closeZone: Phaser.GameObjects.Zone | null = null;
    if (!confirmingStop && content.showClose) {
      closeLabel = scene.add
        .text(0, 0, "×", { ...textStyle(TITLE_TYPE, surface.ink.hex), fontSize: "24px" })
        .setOrigin(0.5, 0.5);
    }

    // --- The inline "Stop the tutorial?" confirm row (replaces the whole top row above, same height). ---
    let confirmQuestion: Phaser.GameObjects.Text | null = null;
    let confirmStopLabel: Phaser.GameObjects.Text | null = null;
    let confirmKeepGoingLabel: Phaser.GameObjects.Text | null = null;
    let confirmKeepGoingUnderline: Phaser.GameObjects.Graphics | null = null;
    if (confirmingStop) {
      confirmQuestion = scene.add.text(
        0,
        0,
        "Stop the tutorial?",
        textStyle({ ...typeRole.label, size: 12 }, surface.ink.hex),
      );
      // Red, matching the ATK stat badge's own hue (`statHue.atk`) — the one place in this palette a
      // destructive action is ever singled out — so "Stop" reads distinct from "Keep going" by more than word
      // choice alone (colorblind-safe: the two also carry different labels and different underline treatment).
      confirmStopLabel = scene.add.text(0, 0, "STOP", textStyle(STAMP_TYPE, statHue.atk.hex));
      confirmKeepGoingLabel = scene.add.text(0, 0, "KEEP GOING", textStyle(STAMP_TYPE, surface.ink.hex));
      confirmKeepGoingUnderline = scene.add.graphics();
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

    // --- Nudge line, above the action row (G5c fills it after a soft-gate release). ---
    let nudge: Phaser.GameObjects.Text | null = null;
    if (content.nudge) {
      nudge = scene.add
        .text(0, 0, content.nudge, { ...textStyle({ ...typeRole.body, size: 11 }, surface.ink.hex, 0.7) })
        .setWordWrapWidth(innerWidth, true);
    }
    const nudgeRowHeight = nudge ? nudge.height + 8 : 0;

    // --- Measure total height. ---
    let y = PAD;
    y += stampHeight + 10;
    y += title.height + 10;
    y += body.height + (hasButtons || continueHint ? 16 : 0);
    y += nudgeRowHeight;
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
    const focusables: FocusTarget[] = [];

    if (confirmingStop && confirmQuestion && confirmStopLabel && confirmKeepGoingLabel && confirmKeepGoingUnderline) {
      // The inline confirm row: right-aligned Stop/Keep going (mirroring the normal row's own exits), the
      // question filling whatever's left on the left — same right-alignment shape `guideCalloutExitsLayoutOf`
      // already uses, so this never overflows a 390px phone either (`guideCalloutStopConfirmLayoutOf`'s own
      // header).
      const confirm = guideCalloutStopConfirmLayoutOf({
        rect,
        pad: PAD,
        rowCenterY: cy,
        stopLabelWidth: confirmStopLabel.width,
        keepGoingLabelWidth: confirmKeepGoingLabel.width,
      });
      confirmQuestion.setWordWrapWidth(confirm.questionWidth, true);
      confirmQuestion.setPosition(rect.x + PAD, cy - confirmQuestion.height / 2);
      objects.push(confirmQuestion);

      confirmKeepGoingLabel.setPosition(
        confirm.keepGoing.x + (confirm.keepGoing.width - confirmKeepGoingLabel.width) / 2,
        cy - confirmKeepGoingLabel.height / 2,
      );
      confirmKeepGoingUnderline
        .lineStyle(1.5, surface.ink.hex, 1)
        .lineBetween(
          confirmKeepGoingLabel.x,
          confirmKeepGoingLabel.y + confirmKeepGoingLabel.height,
          confirmKeepGoingLabel.x + confirmKeepGoingLabel.width,
          confirmKeepGoingLabel.y + confirmKeepGoingLabel.height,
        );
      const keepGoingZone = makeZoneAt(scene, confirm.keepGoing, () => this.#options.onStopCancel?.());
      objects.push(confirmKeepGoingLabel, confirmKeepGoingUnderline, keepGoingZone);
      focusables.push({ rect: confirm.keepGoing, activate: () => this.#options.onStopCancel?.() });

      confirmStopLabel.setPosition(confirm.stop.x + confirm.stop.width / 2, confirm.stop.y + confirm.stop.height / 2);
      confirmStopLabel.setOrigin(0.5, 0.5);
      const stopConfirmZone = makeZoneAt(scene, confirm.stop, () => this.#options.onStop?.());
      objects.push(confirmStopLabel, stopConfirmZone);
      focusables.push({ rect: confirm.stop, activate: () => this.#options.onStop?.() });
    } else if (stamp && stampLabel) {
      stamp.fillStyle(surface.ink.hex, 1).fillRect(rect.x + PAD, cy - stampHeight / 2, stampWidth, stampHeight);
      stampLabel.setPosition(rect.x + PAD + STAMP_PAD, cy);
      objects.push(stamp, stampLabel);
      if (stepLabel) {
        stepLabel.setPosition(rect.x + PAD + stampWidth + 10, cy - stepLabel.height / 2);
        objects.push(stepLabel);
      }

      // The two §3.10 exits, right-aligned via the pure layout function so their hit areas (≥ `hit.target`
      // on a side) never overlap each other, even on a 390px phone.
      const exits = guideCalloutExitsLayoutOf({
        rect,
        pad: PAD,
        rowCenterY: cy,
        skipLabelWidth: skipLabel?.width ?? 0,
        stopLabelWidth: stopLabel?.width ?? 0,
      });
      if (skipLabel && skipUnderline) {
        skipLabel.setPosition(exits.skip.x + (exits.skip.width - skipLabel.width) / 2, cy - skipLabel.height / 2);
        skipUnderline
          .lineStyle(1.5, surface.ink.hex, 1)
          .lineBetween(
            skipLabel.x,
            skipLabel.y + skipLabel.height,
            skipLabel.x + skipLabel.width,
            skipLabel.y + skipLabel.height,
          );
        skipZone = makeZoneAt(scene, exits.skip, () => this.#options.onSkip?.());
        objects.push(skipLabel, skipUnderline, skipZone);
        focusables.push({ rect: exits.skip, activate: () => this.#options.onSkip?.() });
      }
      if (stopLabel) {
        // Stop's own hit area is fixed by `guideCalloutExitsLayoutOf` from `hit.target` alone — it doesn't
        // depend on Skip's width, so it's the same rect whether or not Skip is shown. The first tap only
        // requests the confirm row (`onStopRequest`), never stops outright — see this widget's own header.
        const stopRect = exits.stop;
        stopLabel.setPosition(stopRect.x + stopRect.width / 2, stopRect.y + stopRect.height / 2);
        stopZone = makeZoneAt(scene, stopRect, () => (this.#options.onStopRequest ?? this.#options.onStop)?.());
        objects.push(stopLabel, stopZone);
        focusables.push({ rect: stopRect, activate: () => (this.#options.onStopRequest ?? this.#options.onStop)?.() });
      }
      if (closeLabel) {
        // Close sits further left of the two exits when both are present, so it never overlaps them.
        const closeInset = (skipLabel ? exits.skip.width + 6 : 0) + (stopLabel ? exits.stop.width + 6 : 0);
        closeLabel.setPosition(rect.x + rect.width - PAD - 8 - closeInset, cy);
        closeZone = makeLinkZone(scene, closeLabel, () => this.#options.onClose?.());
        objects.push(closeLabel, closeZone);
        focusables.push({
          rect: { x: closeLabel.x - 12, y: closeLabel.y - 12, width: 24, height: 24 },
          activate: () => this.#options.onClose?.(),
        });
      }
    }
    cy += stampHeight + 10;

    title.setPosition(rect.x + PAD, cy);
    objects.push(title);
    cy += title.height + 10;

    body.container.setPosition(rect.x + PAD, cy);
    objects.push(body.container);
    cy += body.height + (hasButtons || continueHint || nudge ? 16 : 0);

    if (nudge) {
      nudge.setPosition(rect.x + PAD, cy);
      objects.push(nudge);
      cy += nudge.height + 8;
    }

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
   * The host scene's own Escape handling (see the module header's "Keyboard" and "The Escape contract"
   * sections, `docs/guided-mode.md` §3.10): closes an open tooltip first; once there's none left open,
   * Escape always counts the step as skipped, via `onSkip` — never `onClose` (Escape isn't "stop", it's
   * the fast way to move past one step). This never returns without acting when either callback exists.
   */
  handleEscape(): boolean {
    if (this.#tooltip.handleEscape()) return true;
    if (this.#options.onSkip) {
      this.#options.onSkip();
      return true;
    }
    if (this.#options.onClose) {
      this.#options.onClose();
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

/** A zone at an already-computed rect (`guideCalloutExitsLayoutOf`'s own output) — unlike `makeLinkZone`, this doesn't recenter on a label, since the exits' rects are already the final, non-overlapping layout. */
function makeZoneAt(scene: Phaser.Scene, rect: Rect, onClick: () => void): Phaser.GameObjects.Zone {
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
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
