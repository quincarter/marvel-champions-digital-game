import { McPress, watchCard } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import type { SetupMode } from "../shared/setup-events.types.js";
import type { SeatInput } from "./mc-setup-seat.types.js";
import { McSetupSeatStyles } from "./mc-setup-seat.styles.js";

/**
 * # Setup seat
 * One seat of the table, itself the control that makes it first player: the hero's picture, its name and "First player" /
 * "Seat N" (wide), or a compact chip (phone) with "YOU" / "S2" over the hero's name. It leaves a `token` slot, the spot
 * where the first player token rests: the seating section puts the token into the first player's slot. A mouse over the
 * hero's picture raises the card hover for the identity card (`watchCard`).
 *
 * @element mc-setup-seat
 * @prop input - The seat and its picture (`SeatInput`).
 * @attr mode - wide | phone.
 * @attr selected - It holds the first player token.
 * @prop action - What a tap raises (`mc-pressed`).
 * @slot token - The first player token, when this seat holds it.
 */
export class McSetupSeat extends McPress {
  static override styles = McSetupSeatStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    input: { attribute: false },
    mode: { type: String, reflect: true },
    selected: { type: Boolean, reflect: true },
  };

  declare input: SeatInput | null;
  declare mode: SetupMode;
  declare selected: boolean;
  #watched: HTMLElement | null = null;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    this.selected = false;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("input")) this.selected = this.input?.seat.selected ?? false;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const avatar = this.renderRoot.querySelector<HTMLElement>(".avatar");
    if (avatar === this.#watched) return;
    this.#unwatch?.();
    this.#watched = avatar;
    this.#unwatch = avatar
      ? watchCard(avatar, () => {
          const id = this.input?.seat.identityCardId;
          return id ? { cardId: id } : null;
        })
      : null;
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = null;
    this.#watched = null;
    super.disconnectedCallback();
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const { seat, picture } = input;
    const phone = this.mode === "phone";
    return html`<div class="card">
      <span class="spot"><slot name="token"></slot></span>
      <div class="avatar">
        <mc-picture-tile .picture=${picture} frame="1.5" ground="ink"></mc-picture-tile>
      </div>
      <div class="text">
        <div class="name">${phone ? seat.chipLabel : seat.name}</div>
        <div class="label">${phone ? seat.name : seat.meta}</div>
      </div>
    </div>`;
  }
}
