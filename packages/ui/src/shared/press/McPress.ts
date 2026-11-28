import { LitElement, type PropertyDeclarations, type PropertyValues } from "lit";
import { onHold, onTap } from "../tap.js";
import { PRESS_EVENT, type PressDetail } from "./press.types.js";

/**
 * The base of every pressable control: a tap on it (never the lift that ends a swipe) raises `mc-pressed` with its
 * `action`, and the screen's focus route presses it through `press()` / `click()`. `stop` names its focus stop
 * (`data-stop`); a press-and-hold (or the route's Inspect) raises `holdAction` where an element has one. It takes no
 * keyboard focus itself: the route owns the keys, and a focus that lands on it (a screen reader) reaches the route
 * through `bindStopFocus` in the client.
 */
export abstract class McPress extends LitElement {
  static override properties: PropertyDeclarations = {
    stop: { type: String, reflect: true, attribute: "data-stop" },
    disabled: { type: Boolean, reflect: true },
    action: { attribute: false },
    holdAction: { attribute: false },
  };

  /** The focus stop's key (`difficulty:expert`, `modular:bomb_scare`). */
  declare stop: string;
  declare disabled: boolean;
  /** What a tap raises (null: nothing). */
  declare action: unknown;
  /** What a hold or the route's Inspect raises (null: none). */
  declare holdAction: unknown;
  #stopTap: (() => void) | null = null;
  #stopHold: (() => void) | null = null;

  constructor() {
    super();
    this.stop = "";
    this.disabled = false;
    this.action = null;
    this.holdAction = null;
  }

  /** What a tap raises; a control that is sometimes inert (a locked row) overrides it. */
  protected tapAction(): unknown {
    return this.action;
  }

  #say(action: unknown, hold: boolean): void {
    if (action === null || action === undefined) return;
    this.dispatchEvent(
      new CustomEvent<PressDetail>(PRESS_EVENT, { detail: { action, hold }, bubbles: true, composed: true }),
    );
  }

  /** The route's Enter (or a tap): does what a tap on it does. */
  press(): void {
    if (!this.disabled) this.#say(this.tapAction(), false);
  }

  /** The route's Inspect, or a hold. */
  inspect(): void {
    this.#say(this.holdAction, true);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) this.setAttribute("role", "button");
    this.#stopTap = onTap(this, () => this.press(), { enabled: () => !this.disabled });
    this.#armHold();
    // Focusable by a click or a screen reader, never by Tab: the focus route owns the keyboard.
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "-1");
  }

  /** Only a control that offers an Inspect is timed for a hold (a hold that ends is not a tap). */
  #armHold(): void {
    const wants = this.holdAction !== null && this.holdAction !== undefined;
    if (wants && !this.#stopHold) this.#stopHold = onHold(this, () => this.inspect());
    else if (!wants && this.#stopHold) {
      this.#stopHold();
      this.#stopHold = null;
    }
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("holdAction") && this.isConnected) this.#armHold();
  }

  override disconnectedCallback(): void {
    this.#stopTap?.();
    this.#stopHold?.();
    this.#stopHold = null;
    super.disconnectedCallback();
  }

  /** `element.click()` (what the focus route does to a stop) presses it, as a tap does. */
  override click(): void {
    this.press();
  }
}
