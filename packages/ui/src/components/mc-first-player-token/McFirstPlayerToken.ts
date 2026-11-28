import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McFirstPlayerTokenStyles } from "./mc-first-player-token.styles.js";
import type { TokenFlight } from "./mc-first-player-token.types.js";
import { flightKeyframes } from "./token-motion.js";

/** A fade to the new place for the player who asks for less motion: short, and nothing else moves. */
const REDUCED_FADE_MS = 160;

/**
 * # First player token
 * The physical game's token, resting on whoever is first player, with a soft shadow on the table under it. It fills the box
 * its owner places it in (the host's width and height are its size) and never takes a press: the seat under it is the control.
 *
 * When the owner moves the box to another seat it calls `fly(from, flight)` with where the token was (an offset from its new
 * rest) and the sampled flight: the token is already at its new place and the animation (Web Animations, transform and
 * opacity only) carries it from the old one, the way FLIP does. With reduced motion it fades in at the new place instead.
 *
 * @element mc-first-player-token
 * @attr src - The token art's URL; with none, or one that fails, a red disc says "1st".
 * @attr label - The disc's words ("1st"), already translated.
 */
export class McFirstPlayerToken extends LitElement {
  static override styles = [ThemeStyles, McFirstPlayerTokenStyles];

  static override properties: PropertyDeclarations = {
    src: { type: String },
    label: { type: String },
    failed: { state: true },
  };

  declare src: string;
  declare label: string;
  declare failed: boolean;
  #running: Animation[] = [];

  constructor() {
    super();
    this.src = "";
    this.label = "1st";
    this.failed = false;
  }

  /** Whether a flight is playing now. */
  get flying(): boolean {
    return this.#running.some((a) => a.playState === "running");
  }

  /** Stops any flight in progress; the token rests where it is placed. */
  rest(): void {
    for (const a of this.#running) a.cancel();
    this.#running = [];
  }

  /** Plays `flight` (null: place without a flight); `reduced` fades in at the new place instead of moving. */
  fly(flight: TokenFlight | null, reduced: boolean): void {
    this.rest();
    const token = this.renderRoot.querySelector<HTMLElement>(".token");
    const shadow = this.renderRoot.querySelector<HTMLElement>(".shadow");
    if (!token || !shadow || typeof token.animate !== "function") return;
    if (reduced) {
      for (const el of [token, shadow]) {
        this.#running.push(
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE_MS, easing: "ease-out" }),
        );
      }
      return;
    }
    if (!flight || flight.frames.length < 2 || flight.durationMs <= 0) return;
    const keys = flightKeyframes(flight);
    const options = { duration: flight.durationMs, easing: "linear" } as const;
    this.#running.push(token.animate(keys.token, options), shadow.animate(keys.shadow, options));
  }

  override disconnectedCallback(): void {
    this.rest();
    super.disconnectedCallback();
  }

  override render() {
    return html`<div class="shadow" aria-hidden="true"></div>
      <div class="token" role="img" aria-label=${this.label}>
        ${
          this.src && !this.failed
            ? html`<img src=${this.src} alt="" draggable="false" @error=${() => (this.failed = true)} />`
            : html`<span class="disc">${this.label}</span>`
        }
      </div>`;
  }
}
