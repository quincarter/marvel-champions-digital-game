/**
 * Keyboard and gamepad focus for a screen whose stops are just its controls:
 * Title/Setup, the villain-phase walkthrough and Game Over.
 *
 * The Board and the choice sheet each carry their own route because their
 * stops are cards that move between zones and rows. These screens are simpler —
 * a stop is a control with a rect and something it does — so they share this.
 * The *order* is still stated by the screen (`view/screen-focus.ts`, or a
 * screen's own action list), never taken from the order of its draw calls.
 *
 * Same conventions as everywhere else: arrows and Tab walk the route, Enter or
 * Space presses, `I` reads (where a stop has something to read), Escape backs
 * out, and the ring is the selection ring drawn static — a pulse means "the game
 * is waiting for you", and focus is not a prompt.
 */

import type Phaser from "phaser";
import { McSelectionRing } from "../ui/widgets.js";
import { stepKey } from "../view/focus.js";
import type { GamepadIntent } from "../view/gamepad.js";
import type { Rect } from "../view/layout.js";
import { bindGamepad, bindKeyboard } from "./board/input.js";

export interface FocusStop {
  /**
   * Where the ring frames this stop. A function rather than a fixed `Rect`
   * for a row inside a scrolling list (`ui/virtual-list.ts`): its on-screen
   * position depends on the list's current scroll offset, which
   * `ensureVisible` below may just have changed, so the rect has to be read
   * *after* that runs rather than captured once when the stop was built.
   */
  readonly rect: Rect | (() => Rect);
  /** What Enter does. A control that can't be used right now does nothing — exactly what a tap on it does. */
  readonly activate: () => void;
  /** What `I` does, when the stop shows a card. */
  readonly inspect?: () => void;
  /**
   * Called right after this stop takes focus, before the ring is drawn — a
   * row inside a virtualized list scrolls itself fully into view here
   * (`McVirtualList.scrollIntoView`), so arrowing onto an off-screen row
   * brings it on screen instead of leaving the ring nowhere a player can see.
   */
  readonly ensureVisible?: () => void;
}

export interface FocusRouteOptions {
  /** True while something above this screen (a sheet, a text field) owns the keyboard and pad. */
  readonly blocked?: () => boolean;
  /** Escape or B. Without one, it just drops focus. */
  readonly onCancel?: () => void;
  /** Page Up/Down (or a pad's shoulder buttons), forwarded as-is — the screen decides what "a page" means (a virtualized list, usually). No-op when omitted. */
  readonly onPage?: (direction: 1 | -1) => void;
  /** Home/End, forwarded as-is. No-op when omitted. */
  readonly onHomeEnd?: (edge: "home" | "end") => void;
}

export class FocusRoute {
  readonly #scene: Phaser.Scene;
  readonly #onCancel: (() => void) | undefined;
  readonly #onPage: ((direction: 1 | -1) => void) | undefined;
  readonly #onHomeEnd: ((edge: "home" | "end") => void) | undefined;
  #order: readonly string[] = [];
  #stops: ReadonlyMap<string, FocusStop> = new Map();
  #focus: string | null = null;
  #ring: McSelectionRing | null = null;
  #ringColor: number | undefined;

  /**
   * Binds the scene's keyboard and pad. Both listeners live on the scene's own
   * input plugins, which drop them when the scene shuts down, so there is
   * nothing to unbind.
   */
  constructor(scene: Phaser.Scene, options: FocusRouteOptions = {}) {
    this.#scene = scene;
    this.#onCancel = options.onCancel;
    this.#onPage = options.onPage;
    this.#onHomeEnd = options.onHomeEnd;
    const binding = { blocked: options.blocked ?? (() => false), onIntent: (intent: GamepadIntent) => this.#onIntent(intent) };
    bindKeyboard(scene, binding);
    bindGamepad(scene, binding);
  }

  get focused(): string | null {
    return this.#focus;
  }

  /**
   * This rebuild's route and controls. Call it last in a rebuild, after the
   * scene has cleared and redrawn its display list, so the ring sits over the
   * control it frames. Focus survives by key; a key that left the route is dropped.
   *
   * `ringColor` is for a ground the red ring would vanish into — Game Over's
   * Hero Red loss screen.
   */
  set(order: readonly string[], stops: ReadonlyMap<string, FocusStop>, ringColor?: number): void {
    this.#order = order.filter((key) => stops.has(key));
    this.#stops = stops;
    this.#ringColor = ringColor;
    this.#drawRing();
  }

  #onIntent(intent: GamepadIntent): void {
    switch (intent) {
      case "next":
      case "previous":
        this.#focus = stepKey(this.#order, this.#focus, intent === "next" ? 1 : -1);
        if (this.#focus) this.#stops.get(this.#focus)?.ensureVisible?.();
        this.#drawRing();
        break;
      case "activate":
        if (this.#focus) this.#stops.get(this.#focus)?.activate();
        break;
      case "inspect":
        if (this.#focus) this.#stops.get(this.#focus)?.inspect?.();
        break;
      case "pageNext":
      case "pagePrevious":
        this.#onPage?.(intent === "pageNext" ? 1 : -1);
        this.#drawRing();
        break;
      case "home":
      case "end":
        this.#onHomeEnd?.(intent);
        this.#drawRing();
        break;
      case "cancel":
        if (this.#onCancel) {
          this.#onCancel();
        } else {
          this.#focus = null;
          this.#drawRing();
        }
        break;
    }
  }

  #drawRing(): void {
    // Destroying a ring whose graphics a display-list sweep already took is safe.
    this.#ring?.destroy();
    this.#ring = null;
    if (this.#focus !== null && !this.#order.includes(this.#focus)) this.#focus = null;
    const stop = this.#focus === null ? undefined : this.#stops.get(this.#focus);
    if (!stop) return;
    this.#ring = new McSelectionRing(this.#scene, this.#ringColor);
    this.#ring.show(typeof stop.rect === "function" ? stop.rect() : stop.rect, "static", true);
  }
}
