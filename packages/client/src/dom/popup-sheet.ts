/**
 * The panel of a small pop-up scene (the End turn confirm, Concede, Ask for a change, Room chat) as an `mc-sheet`
 * over the canvas: its dim scrim, its box, text and buttons are all DOM parts built at the layout rects the scene
 * always used, so the look is the Phaser one. The region is an `overlay` (`DomRegion`): the panel of the scene it
 * opens over (Pause) stays shown under the pop-up's scrim instead of hiding, and the pop-up stacks above it.
 *
 * The scene keeps its navigation, focus route (stops at the same rects, ring `domFocusRing`), its Phaser press shield
 * and any `McTextInput`, which it leaves a hole for (`mount`'s `holes`).
 *
 * Every pop-up enters and leaves the way Pause does (`ui/transitions.ts`: `overlayEnterMs` / `overlayExitMs`, Quad
 * ease out / in), centrally here: the scrim fades with the panel and the box slides up from the bottom edge, and back
 * down on the way out (`close`, which the scene calls instead of stopping at once). Under reduced motion it just
 * appears and goes. On a touch layout a pop-up with a back-out path draws a grab handle on its box's top edge; a
 * downward drag from the handle moves the box and, past a quarter of its height or in a flick, answers as Cancel does.
 * A sheet that follows an anchor of its own (`follow`) keeps its own motion and gets none of this.
 */
import "@mc/ui";
import { cancelPressesWithin, type McSheet } from "@mc/ui";
import type Phaser from "phaser";
import { appSession } from "../session.js";
import { motion, surface } from "../tokens.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { ringMotion } from "./dom-ring.js";
import { ActivationGate } from "./activation-gate.js";
import { DomRegion, renderNow, type Followed } from "./dom-region.js";
import { HANDLE_TARGET_HEIGHT, SNAP_BACK_MS, SWIPE_SLOP, slideDistance, swipeOutcome } from "./popup-motion.js";
import { SheetBuilder, sheetColor } from "./sheet-builder.js";

/** The key of the grab handle's touch target; a tap on it does nothing. */
const GRAB_KEY = "__grab";

/** The keys of pop-up scenes playing their exit. */
const LEAVING = new Set<string>();

export interface PopupSheetOptions {
  /**
   * The pop-up's back-out path (the one Escape / B takes). Given, a touch layout draws the grab handle and a swipe
   * down from it calls this; absent (a pop-up that must be answered), the box cannot be swiped away.
   */
  readonly onDismiss?: () => void;
  /**
   * Called with the box's slide (game px below its place, 0 at rest) each time it changes: a Phaser or DOM field the
   * scene keeps over the panel (`McTextInput.slide`) moves with the box, and the hole it is seen through moves too.
   */
  readonly onSlide?: (dy: number) => void;
}

interface Drag {
  readonly id: number;
  readonly y0: number;
  dragging: boolean;
  prev: { y: number; t: number };
  last: { y: number; t: number };
}

export class PopupSheet {
  readonly #scene: Phaser.Scene;
  readonly #onActivate: (key: string) => void;
  readonly #onHover: ((key: string, over: boolean) => void) | undefined;
  readonly #onDismiss: (() => void) | undefined;
  readonly #onSlide: ((dy: number) => void) | undefined;
  #region: DomRegion<McSheet> | null = null;
  #followed: Followed | null = null;
  /** One activation a frame, none once the scene stops or turns its input off (a second Send/Concede/Confirm tap). */
  readonly #gate: ActivationGate;
  /** The box's slide (game px below its place) and the panel's fade, tweened; `DomRegion` reads `alpha` each frame. */
  readonly #m = { y: 0, alpha: 1 };
  readonly #anchor: Followed;
  /** Whether this sheet runs the slide itself (it has no anchor of its own). */
  #moving = false;
  #leaving = false;
  #forwarding = false;
  #travel = 0;
  #boxHeight = 0;
  #box: Rect | null = null;
  #width = 0;
  #drag: Drag | null = null;

  /** `onActivate` hears a button's key when it is tapped; `onHover`, a mouse moving onto or off a tracked tap area. */
  constructor(
    scene: Phaser.Scene,
    onActivate: (key: string) => void,
    onHover?: (key: string, over: boolean) => void,
    options: PopupSheetOptions = {},
  ) {
    this.#scene = scene;
    this.#onActivate = onActivate;
    this.#onHover = onHover;
    this.#onDismiss = options.onDismiss;
    this.#onSlide = options.onSlide;
    const m = this.#m;
    ringMotion.set(scene, m);
    this.#anchor = {
      x: 0,
      y: 0,
      get alpha() {
        return m.alpha;
      },
      active: true,
    };
    this.#gate = new ActivationGate(scene);
    scene.events.once("shutdown", () => {
      this.#gate.destroy();
      this.#region = null;
    });
  }

  /**
   * Rises and fades with an invisible Phaser anchor the scene's `OverlayMotion` tweens (as `scenes/pause.ts` does).
   * Call it before the first `mount`: an anchored sheet has that one motion owner and never starts the built-in
   * slide. Taken after a mount, it stops a built-in entrance already running and hands the box to the anchor.
   */
  follow(anchor: Followed | null): void {
    this.#followed = anchor;
    if (anchor && this.#moving) {
      this.#scene.tweens.killTweensOf(this.#m);
      this.#moving = false;
      this.#m.y = 0;
      this.#m.alpha = 1;
      this.#region?.element.removeAttribute("popup");
      this.#apply();
    }
    this.#region?.follow(anchor);
  }

  /** True from the moment `close` is called: the pop-up is leaving and takes no answer. */
  get leaving(): boolean {
    return this.#leaving;
  }

  /** Whether the scene with this key is playing a pop-up's exit (it is still active, but takes no answer). */
  static isLeaving(key: string): boolean {
    return LEAVING.has(key);
  }

  /**
   * Plays the exit (the box slides back down, the scrim fades) with the scene's input, keyboard and pad off, then
   * stops the scene and calls `after` (what the answer did). Once only: a call while already leaving is ignored.
   * Immediate under reduced motion, before the first draw and for a sheet with an anchor of its own. If the scene is
   * stopped or restarted from outside mid-exit, `after` still runs, once, at that shutdown.
   */
  close(after?: () => void): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.#after = after ?? null;
    const scene = this.#scene;
    const key = scene.sys.settings.key;
    LEAVING.add(key);
    this.#setTakingInput(false);
    // A press or slider drag already down on the leaving panel must change nothing more while it slides away.
    const element = this.#region?.element;
    if (element) {
      element.cancelHolds();
      cancelPressesWithin(element);
    }
    scene.events.once("shutdown", () => {
      LEAVING.delete(key);
      scene.input.enabled = true;
      if (scene.input.keyboard) scene.input.keyboard.enabled = true;
      this.#finish(false);
    });
    if (!this.#moving || appSession().settings.reducedMotion) {
      this.#finish(true);
      return;
    }
    scene.tweens.killTweensOf(this.#m);
    scene.tweens.add({
      targets: this.#m,
      y: this.#travel,
      alpha: 0,
      duration: motion.overlayExitMs,
      ease: "Quad.easeIn",
      onUpdate: () => this.#apply(),
      onComplete: () => this.#finish(true),
    });
  }

  #after: (() => void) | null = null;

  /** Runs the pending answer once; `stop` also stops the scene (the exit finished, rather than the scene going). */
  #finish(stop: boolean): void {
    const after = this.#after;
    this.#after = null;
    if (stop && this.#leaving) this.#scene.scene.stop();
    after?.();
  }

  #setTakingInput(on: boolean): void {
    this.#scene.input.enabled = on;
    if (this.#scene.input.keyboard) this.#scene.input.keyboard.enabled = on;
  }

  /**
   * Takes back an exit still playing (a notice arrived for a pop-up that was closing): the box slides back in and the
   * scene takes input again. Returns the pending `after` for the caller to run, or null when it is not leaving.
   */
  cancelExit(): (() => void) | null {
    if (!this.#leaving) return null;
    const pending = this.#after ?? (() => {});
    this.#after = null;
    this.#leaving = false;
    LEAVING.delete(this.#scene.sys.settings.key);
    this.#setTakingInput(true);
    this.springBack();
    return pending;
  }

  /** The panel element once mounted (to reach a part, e.g. to scroll a region). */
  get element(): McSheet | null {
    return this.#region?.element ?? null;
  }

  /** An element inside the panel, in game coordinates (it follows a scrolling region's scroll). */
  rectOf(target: Element): Rect | null {
    return this.#region?.rectOf(target) ?? null;
  }

  /** Passes the mouse over the panel on to Phaser's canvas, for a pop-up that shows the card hover popover. Once. */
  forwardMouseMoves(): void {
    if (this.#forwarding || !this.#region) return;
    this.#forwarding = true;
    this.#region.forwardMouseMoves();
  }

  /** A builder over the whole screen, with the dim scrim (Phaser's `void`, at 0.7 unless `scrim` says) already laid. */
  begin(width: number, height: number, scrim = 0.7): SheetBuilder {
    const builder = new SheetBuilder(this.#scene.game, { x: 0, y: 0 }, isDesktopType);
    builder.box({ x: 0, y: 0, width, height }, { fill: surface.void.hex, fillAlpha: scrim });
    return builder;
  }

  /** Hands the built parts to the panel (made on first use) and renders them now, so stops can be read this frame. */
  mount(
    builder: SheetBuilder,
    width: number,
    height: number,
    /** Rects left out of the panel (a field, a card hover popover); a function is read each frame. */
    holes: readonly Rect[] | (() => readonly Rect[]) = [],
  ): void {
    this.#width = width;
    this.#measure(builder, width, height);
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        const { key } = (event as CustomEvent<{ key: string }>).detail;
        if (key === GRAB_KEY || !this.#gate.take()) return;
        this.#onActivate(key);
      });
      if (this.#onHover) {
        element.addEventListener("mc-hover", (event) => {
          const { key, over } = (event as CustomEvent<{ key: string; over: boolean }>).detail;
          this.#onHover?.(key, over);
        });
      }
      this.#region = new DomRegion(this.#scene, element, { x: 0, y: 0, width, height }, { overlay: true });
      if (this.#followed) this.#region.follow(this.#followed);
      else this.#enter(element);
    }
    const region = this.#region;
    this.#addHandle(builder, width, height);
    region.setRect({ x: 0, y: 0, width, height });
    // A field's hole travels with the box, or the box would be cut where the field is not.
    if (typeof holes === "function") region.setHoles(holes);
    else region.setHoles(holes.length === 0 ? holes : () => holes.map((hole) => ({ ...hole, y: hole.y + this.#m.y })));
    region.element.nodes = builder.nodes;
    renderNow(region.element);
    this.#onSlide?.(this.#m.y);
    const grab = region.element.elementOf(GRAB_KEY);
    if (grab) grab.style.touchAction = "none";
  }

  /** The box is the first part after the scrim: its top sets how far it slides, its height what a drag must pass. */
  #measure(builder: SheetBuilder, width: number, height: number): void {
    const part = builder.nodes[1];
    const sized = part?.kind === "box" && part.rect.width < width;
    this.#box = sized ? part.rect : null;
    this.#travel = slideDistance(height, sized ? part.rect.y : null);
    this.#boxHeight = sized ? part.rect.height : height * 0.3;
  }

  #apply(): void {
    this.#region?.element.style.setProperty("--mc-popup-slide", `${this.#m.y}px`);
    this.#onSlide?.(this.#m.y);
  }

  /** Starts the entrance (the box slides up from the bottom edge, the panel fades in) and listens for the handle. */
  #enter(element: McSheet): void {
    this.#moving = true;
    element.setAttribute("popup", "");
    this.#region?.follow(this.#anchor);
    if (!appSession().settings.reducedMotion) {
      this.#m.y = this.#travel;
      this.#m.alpha = 0;
      this.#apply();
      this.#scene.tweens.add({
        targets: this.#m,
        y: 0,
        alpha: 1,
        duration: motion.overlayEnterMs,
        ease: "Quad.easeOut",
        onUpdate: () => this.#apply(),
      });
    }
    element.addEventListener("pointerdown", (event) => this.#down(event));
    element.addEventListener("pointermove", (event) => this.#move(event));
    element.addEventListener("pointerup", (event) => this.#up(event));
    element.addEventListener("pointercancel", () => this.#release(false));
  }

  /** The grab handle: a short bar on the box's top edge with a target at least 44px tall, on touch layouts only. */
  #addHandle(builder: SheetBuilder, width: number, height: number): void {
    const box = this.#box;
    if (!this.#moving || !this.#onDismiss || !box || formFactorFor(width, height) === "desktop") return;
    const cx = box.x + box.width / 2;
    builder.svg(
      { x: cx - 20, y: box.y + 6, width: 40, height: 6 },
      [40, 6],
      [
        {
          k: "rect",
          x: 0.5,
          y: 0.5,
          w: 39,
          h: 5,
          rx: 2.5,
          fill: sheetColor(surface.ink.hex, "fill"),
          alpha: 0.5,
          stroke: sheetColor(surface.paper.hex, "fill"),
          sw: 1,
        },
      ],
    );
    const target = Math.min(box.width, 120);
    builder.tap(GRAB_KEY, { x: cx - target / 2, y: box.y - 10, width: target, height: HANDLE_TARGET_HEIGHT });
  }

  #down(event: PointerEvent): void {
    if (event.pointerType === "mouse" || !this.#moving || this.#leaving || this.#drag || !this.#region) return;
    const onHandle = event.composedPath().some((node) => (node as HTMLElement).dataset?.key === GRAB_KEY);
    if (!onHandle) return;
    const shown = this.#region.element.getBoundingClientRect().width;
    this.#scale = this.#width > 0 && shown > 0 ? shown / this.#width : 1;
    const now = event.timeStamp;
    this.#drag = {
      id: event.pointerId,
      y0: event.clientY,
      dragging: false,
      prev: { y: event.clientY, t: now },
      last: { y: event.clientY, t: now },
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }
  #scale = 1;

  #move(event: PointerEvent): void {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.id || this.#leaving) return;
    const dy = (event.clientY - drag.y0) / this.#scale;
    if (!drag.dragging) {
      if (Math.abs(dy) < SWIPE_SLOP) return;
      drag.dragging = true;
      this.#scene.tweens.killTweensOf(this.#m);
      this.#m.alpha = 1;
      this.#apply();
      // The finger is moving the box, not pressing: nothing under it may fire when it lifts (the tap rule).
      const element = this.#region?.element;
      if (element) {
        element.cancelHolds();
        cancelPressesWithin(element);
      }
    }
    if (event.timeStamp - drag.last.t >= 50) drag.prev = drag.last;
    drag.last = { y: event.clientY, t: event.timeStamp };
    this.#m.y = Math.max(0, dy);
    this.#apply();
    event.preventDefault();
  }

  #up(event: PointerEvent): void {
    if (this.#drag && event.pointerId === this.#drag.id) this.#release(true);
  }

  #release(lifted: boolean): void {
    const drag = this.#drag;
    this.#drag = null;
    if (!drag?.dragging) return;
    const dt = drag.last.t - drag.prev.t;
    const velocity = dt > 0 ? (drag.last.y - drag.prev.y) / this.#scale / dt : 0;
    const outcome = swipeOutcome({
      dy: this.#m.y,
      boxHeight: this.#boxHeight,
      velocity,
      canDismiss: lifted && this.#onDismiss !== undefined && !this.#leaving,
    });
    if (outcome === "dismiss") {
      this.#onDismiss?.();
      return;
    }
    this.springBack();
  }

  /** Puts the box back in its place (a drag that did not dismiss, or a notice that gave way to the next). */
  springBack(): void {
    if (appSession().settings.reducedMotion) {
      this.#m.y = 0;
      this.#apply();
      return;
    }
    this.#scene.tweens.killTweensOf(this.#m);
    this.#scene.tweens.add({
      targets: this.#m,
      y: 0,
      alpha: 1,
      duration: SNAP_BACK_MS,
      ease: "Quad.easeOut",
      onUpdate: () => this.#apply(),
    });
  }
}
