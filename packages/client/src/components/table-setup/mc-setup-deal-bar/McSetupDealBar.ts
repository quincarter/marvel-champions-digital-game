import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { t } from "../../../i18n/translate.js";
import type { SetupMode } from "../shared/setup-events.types.js";
import { SetupRelay } from "../shared/setup-relay.js";
import type { DealBarInput } from "./mc-setup-deal-bar.types.js";
import { McSetupDealBarStyles } from "./mc-setup-deal-bar.styles.js";

/**
 * # Setup deal bar
 * The one red action of Set up the table, "Deal it out" (in a room "Back to the room"), with the status line over it. On
 * the compact page it is the pinned ink footer and also carries the one summary line. It waits (dimmed, no press) while the
 * game is being made or something blocks the deal; a blocked deal says why as the button's tooltip and in the summary line.
 *
 * @element mc-setup-deal-bar
 * @prop input - What it shows (`DealBarInput`).
 * @attr mode - wide | phone.
 * @fires mc-setup - `deal`.
 */
export class McSetupDealBar extends LitElement {
  static override styles = McSetupDealBarStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: DealBarInput | null;
  declare mode: SetupMode;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    new SetupRelay(this);
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const label = input.starting ? t("tableSetup.dealing") : input.room ? t("room.setupDone") : t("tableSetup.deal");
    const waiting = input.starting || input.blocked !== null;
    return html`${this.mode === "phone" ? html`<div class="label line">${input.footerLine}</div>` : nothing}
      ${input.status.length > 0 ? html`<div class="status">${input.status}</div>` : nothing}
      <mc-chip
        class="deal"
        .stop=${"deal-it-out"}
        label=${label}
        ?disabled=${waiting}
        title=${input.blocked ?? ""}
        .action=${{ type: "deal" } as const}
      ></mc-chip>`;
  }
}
