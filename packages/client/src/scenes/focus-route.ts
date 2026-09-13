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
  readonly rect: Rect;
  /** What Enter does. A control that can't be used right now does nothing — exactly what a tap on it does. */
  readonly activate: () => void;
  /** What `I` does, when the stop shows a card. */
  readonly inspect?: () => void;
}

export interface FocusRouteOptions {
  /** True while something above this screen (a sheet, a text field) owns the keyboard and pad. */
  readonly blocked?: () => boolean;
  /** Escape or B. Without one, it just drops focus. */
  readonly onCancel?: () => void;
}

export class FocusRoute {
  readonly #scene: Phaser.Scene;
  readonly #onCancel: (() => void) | undefined;
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
        this.#drawRing();
        break;
      case "activate":
        if (this.#focus) this.#stops.get(this.#focus)?.activate();
        break;
      case "inspect":
        if (this.#focus) this.#stops.get(this.#focus)?.inspect?.();
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
    this.#ring.show(stop.rect, "static", true);
  }
}
