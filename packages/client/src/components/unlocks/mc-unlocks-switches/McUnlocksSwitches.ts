import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { UnlocksEventDetail, UnlocksSwitchInput } from "../unlocks.types.js";
import { UNLOCKS_EVENT } from "../unlocks.types.js";
import { McUnlocksSwitchesStyles } from "./mc-unlocks-switches.styles.js";

/**
 * # Unlocks switches
 * The two switches above the list: "Unlock everything" (stop `row:all`) and the print-and-play opt-in (stop `row:pnp`),
 * each an `mc-switch-row`.
 *
 * @element mc-unlocks-switches
 * @prop all - `UnlocksSwitchInput`.
 * @prop printAndPlay - `UnlocksSwitchInput`.
 * @fires mc-unlocks - `{ type: "all" }` or `{ type: "pnp" }`.
 */
export class McUnlocksSwitches extends LitElement {
  static override styles = [McUnlocksSwitchesStyles];

  static override properties: PropertyDeclarations = {
    all: { attribute: false },
    printAndPlay: { attribute: false },
  };

  declare all: UnlocksSwitchInput | null;
  declare printAndPlay: UnlocksSwitchInput | null;

  constructor() {
    super();
    this.all = null;
    this.printAndPlay = null;
    new FeatureRelay<UnlocksEventDetail>(this, UNLOCKS_EVENT);
  }

  #row(stop: string, input: UnlocksSwitchInput | null, action: UnlocksEventDetail) {
    if (!input) return nothing;
    return html`<mc-switch-row
      .stop=${stop}
      .titleText=${input.title}
      .detail=${input.detail}
      .state=${input.state}
      ?on=${input.on}
      .action=${action}
    ></mc-switch-row>`;
  }

  override render() {
    return html`${this.#row("row:all", this.all, { type: "all" })}${this.#row("row:pnp", this.printAndPlay, { type: "pnp" })}`;
  }
}
