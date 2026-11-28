import { html, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPress } from "@mc/ui";
import type { BriefingCard, BriefingDetail } from "../briefing.types.js";
import { McBriefingInspectChipStyles } from "./mc-briefing-inspect-chip.styles.js";

/**
 * # Briefing inspect chip
 * A quiet full-size button that opens one card in Inspect: the "Inspect" chip on a mission row, a carried-in card name. A tap
 * or a hold (the pad Inspect) raises `mc-pressed` with `{ type: "inspect", cardId, name }`, which the owning section turns
 * into `mc-briefing`. It answers nothing. Its focus stop is the `stop` it is given.
 *
 * @element mc-briefing-inspect-chip
 * @attr label - The words, already translated (a card name keeps its case).
 * @prop card - The card it opens.
 * @fires mc-pressed - `PressDetail` whose `action` is the inspect detail.
 */
export class McBriefingInspectChip extends McPress {
  static override styles = [McBriefingInspectChipStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    label: { type: String },
    card: { attribute: false },
  };

  declare label: string;
  declare card: BriefingCard | null;

  constructor() {
    super();
    this.label = "";
    this.card = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("card")) {
      const detail: BriefingDetail | null = this.card ? { type: "inspect", ...this.card } : null;
      this.action = detail;
      this.holdAction = detail;
    }
  }

  override render() {
    return html`<span class="chip">${this.label}</span>`;
  }
}
