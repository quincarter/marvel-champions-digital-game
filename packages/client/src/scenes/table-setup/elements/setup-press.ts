/**
 * The base of every pressable Set up the table element: a tap on it (never the lift that ends a swipe) raises its event,
 * and the screen's focus route presses it through `press()`. `stop` names its focus stop (`data-stop`); a press-and-hold
 * (or a right-click) inspects where an element offers it. It takes no keyboard focus itself: the route owns the keys,
 * and a focus that lands on it (a screen reader) reaches the route through `bindStopFocus` (`dom/element-stops.ts`).
 */
import { LitElement, type PropertyDeclarations } from "lit";
import { onHold, onTap } from "@mc/ui/tap";
import { setupEvent, type SetupEventDetail } from "./setup-events.types.js";

export abstract class SetupPress extends LitElement {
  static override properties: PropertyDeclarations = {
    stop: { type: String, reflect: true, attribute: "data-stop" },
    disabled: { type: Boolean, reflect: true },
  };

  /** The focus stop's key (`difficulty:expert`, `modular:bomb_scare`). */
  declare stop: string;
  declare disabled: boolean;
  #stopTap: (() => void) | null = null;
  #stopHold: (() => void) | null = null;

  constructor() {
    super();
    this.stop = "";
    this.disabled = false;
  }

  /** What a tap does. */
  protected abstract act(): SetupEventDetail | null;

  /** What a hold does; none by default. */
  protected hold(): SetupEventDetail | null {
    return null;
  }

  /** Raises `detail` (null: nothing to say). */
  protected say(detail: SetupEventDetail | null): void {
    if (detail) this.dispatchEvent(setupEvent(detail));
  }

  /** The route's Enter (or a tap): does what a tap on it does. */
  press(): void {
    if (!this.disabled) this.say(this.act());
  }

  /** The route's Inspect, or a hold. */
  inspect(): void {
    this.say(this.hold());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) this.setAttribute("role", "button");
    this.#stopTap = onTap(this, () => this.press(), { enabled: () => !this.disabled });
    // Only an element that offers an Inspect is timed for a hold (a hold that ends is not a tap).
    if (this.hold() !== null) this.#stopHold = onHold(this, () => this.inspect());
    // Focusable by a click or a screen reader, never by Tab: the focus route owns the keyboard.
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "-1");
  }

  override disconnectedCallback(): void {
    this.#stopTap?.();
    this.#stopHold?.();
    super.disconnectedCallback();
  }

  /** `element.click()` (what the focus route does to a stop) presses it, as a tap does. */
  override click(): void {
    this.press();
  }
}
