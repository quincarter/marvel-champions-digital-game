import { html, LitElement, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { CIVIL_WAR_EVENT, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilFootStyles } from "./mc-civil-foot.styles.js";

const act = (action: string): CivilWarEventDetail => ({ type: "act", action });

/**
 * # Civil War foot
 * The sticky foot: Random and Random and blind (secondary) and Continue to heroes (primary, or the seal button in a
 * Competitive room). Continue is dimmed with the reason in words while the build has a problem; a tap on it still says why.
 *
 * @element mc-civil-foot
 * @attr start-label - The primary button's words.
 * @attr start-reason - Why Continue is unavailable, or empty.
 * @attr can-start - The build can start.
 * @fires mc-civil-war - `{ type: "act", action }` for `civil:random`, `civil:random-blind` and `civil:start`.
 */
export class McCivilFoot extends LitElement {
  static override styles = [McCivilFootStyles];

  static override properties: PropertyDeclarations = {
    startLabel: { type: String, attribute: "start-label" },
    startReason: { type: String, attribute: "start-reason" },
    canStart: { type: Boolean, attribute: "can-start" },
  };

  declare startLabel: string;
  declare startReason: string;
  declare canStart: boolean;

  constructor() {
    super();
    this.startLabel = "";
    this.startReason = "";
    this.canStart = false;
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  #button(stop: string, label: string, kind: "primary" | "secondary", disabled = false, reason = "") {
    return html`<mc-hint-button
      kind=${kind}
      data-stop=${stop}
      .label=${label}
      ?disabled=${disabled}
      pressable
      .reason=${reason}
      @mc-press=${(event: Event) => {
        event.stopPropagation();
        this.dispatchEvent(
          new CustomEvent<CivilWarEventDetail>(CIVIL_WAR_EVENT, { detail: act(stop), bubbles: true, composed: true }),
        );
      }}
    ></mc-hint-button>`;
  }

  override render() {
    return html`${this.#button("civil:random", "Random", "secondary")}${this.#button("civil:random-blind", "Random and blind", "secondary")}${this.#button(
      "civil:start",
      this.startLabel,
      "primary",
      !this.canStart,
      this.startReason,
    )}`;
  }
}
