import { flipOffset, type McFirstPlayerToken } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { t, tPlural } from "../../../i18n/translate.js";
import { appSession } from "../../../session.js";
import { flightFrom } from "../../../view/first-player-token-flip.js";
import { effectiveTokenMotion } from "../../../view/first-player-token-motion.js";
import type { SetupMode } from "../shared/setup-events.types.js";
import { SetupRelay } from "../shared/setup-relay.js";
import type { SeatingInput, TokenProbe } from "./mc-setup-seating.types.js";
import { McSetupSeatingStyles } from "./mc-setup-seating.styles.js";

const TOKEN_URL = `${import.meta.env.BASE_URL}assets/first-player-token.svg`;

/** Whether the player (or the system) asks for less motion: the token then fades in at its new seat. */
const prefersLess = (): boolean =>
  appSession().settings.reducedMotion || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

/**
 * # Setup seating section
 * The Seating section: one seat (`mc-setup-seat`) per seated deck and a Random control (on the header line when wide, a
 * dashed cell in the row on a phone). The first player token (`mc-first-player-token`) is one element that this section
 * moves into the first player's `token` slot; when the first player changes it flies FLIP-style from the old seat to the
 * new one (a rect is read only for that). The token takes no press: the seat under it is the control. In a room the
 * players bring their own heroes, so only a note about the seats shows.
 *
 * @element mc-setup-seating
 * @prop input - What it shows (`SeatingInput`).
 * @attr mode - wide | phone.
 * @attr onink - The ground is ink: the heading is drawn in paper.
 * @fires mc-setup - `seat-pick` `{ index }`, `seat-roll`.
 */
export class McSetupSeating extends LitElement {
  static override styles = McSetupSeatingStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
    onink: { type: Boolean },
  };

  declare input: SeatingInput | null;
  declare mode: SetupMode;
  declare onink: boolean;
  #token: McFirstPlayerToken | null = null;
  /** Where the token was drawn just before this update, for the flight to its new seat. */
  #before: DOMRect | null = null;
  #index: number | null = null;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    this.onink = false;
    new SetupRelay(this);
  }

  protected override willUpdate(): void {
    this.#before = this.#token?.isConnected ? this.#token.getBoundingClientRect() : null;
  }

  protected override updated(_changed: PropertyValues): void {
    void this.#placeToken();
  }

  override disconnectedCallback(): void {
    this.#token?.rest();
    this.#token?.remove();
    this.#token = null;
    this.#index = null;
    super.disconnectedCallback();
  }

  #seatElements(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>("mc-setup-seat")];
  }

  /** Moves the token into the first player's slot, and flies it from where it was when that is another seat. */
  async #placeToken(): Promise<void> {
    const input = this.input;
    const seats = this.#seatElements();
    const at = input && !input.room ? input.seats.findIndex((seat) => seat.selected) : -1;
    const target = at >= 0 ? seats[at] : undefined;
    if (!target || !input) {
      this.#token?.rest();
      this.#token?.remove();
      this.#index = null;
      return;
    }
    const token =
      this.#token ??
      (() => {
        const made = document.createElement("mc-first-player-token") as McFirstPlayerToken;
        made.src = TOKEN_URL;
        made.label = t("tableSetup.firstTokenLabel");
        made.slot = "token";
        return (this.#token = made);
      })();
    token.label = t("tableSetup.firstTokenLabel");
    const before = this.#before;
    const moved = this.#index !== null && this.#index !== at;
    this.#index = at;
    if (token.parentElement === target) return;
    target.append(token);
    if (!moved || !before) return;
    // The seat's own slot is drawn once it has rendered: measure the new rest then.
    await (target as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const after = token.getBoundingClientRect();
    const style = effectiveTokenMotion(appSession().settings);
    const reduced = prefersLess() && style !== "instant";
    token.fly(reduced ? null : flightFrom(style, flipOffset(before, after)), reduced);
  }

  /** What an e2e reads: which seat holds the token, its drawn body (its flight transform included), its resting box and whether it flies. */
  probe(): TokenProbe | null {
    const token = this.#token;
    if (!token?.isConnected || this.#index === null) return null;
    const body = token.renderRoot.querySelector<HTMLElement>(".token");
    return { index: this.#index, drawn: body ?? token, at: token, flying: token.flying };
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const phone = this.mode === "phone";
    const heading = t(phone ? "tableSetup.firstPlayerHead" : "tableSetup.seating");
    if (input.room)
      return html`<mc-section-heading label=${heading} ?onink=${this.onink}></mc-section-heading>
        <div class="note">${tPlural("room.setup.seatsNote", input.seats.length)}</div>`;
    const random = html`<mc-chip
      class=${phone ? "random" : ""}
      .stop=${"first-player:random"}
      label=${t("tableSetup.random")}
      .action=${{ type: "seat-roll" } as const}
    ></mc-chip>`;
    return html`<mc-section-heading label=${heading} ?onink=${this.onink}>
        ${phone ? nothing : random}
      </mc-section-heading>
      <div class="seats" style=${`--seats:${input.seats.length + (phone ? 1 : 0)}`}>
        ${input.seats.map(
          (seat) =>
            html`<mc-setup-seat
              .stop=${`first-player:${seat.index}`}
              .mode=${this.mode}
              .input=${{ seat, picture: input.pictures.get(seat.index) ?? null }}
              .action=${{ type: "seat-pick", index: seat.index } as const}
            ></mc-setup-seat>`,
        )}
        ${phone ? random : nothing}
      </div>`;
  }
}
