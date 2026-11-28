import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { FilterChip } from "@mc/ui";
import { SeatsElement } from "../SeatsElement.js";
import { McSeatsChipsStyles } from "./mc-seats-chips.styles.js";

/** The aspect an `aspect:<name>` chip id names: the key of its "i" stop and its tip. */
const aspectOf = (id: string): string => id.replace(/^aspect:/, "");

/** The one chip whose "i" a tip belongs to, as the element a tip points at. */
interface TipChipHost extends HTMLElement {
  readonly updateComplete: Promise<boolean>;
  readonly infoElement: HTMLElement | null;
}

/**
 * # Seats filter chips
 * The quick-filter chips of Take your seats (the aspects, deck sources, Playable now): wrapped rows on a wide screen, or
 * one row that scrolls sideways (`rail`) on a narrow one. An aspect chip also carries an "i" segment that opens its tip.
 * Each chip is an `mc-tip-chip`; the body is the stop `hero-chip:<chip id>` and the "i" `hero-chip-info:<aspect>`.
 *
 * @element mc-seats-chips
 * @prop chips - The chips, in order (`FilterChip`).
 * @prop rail - One sideways row instead of wrapped rows.
 * @fires mc-seats - `{ type: "chip", id }` or `{ type: "chip-info", id }`.
 */
export class McSeatsChips extends SeatsElement {
  static override styles = [McSeatsChipsStyles];

  static override properties: PropertyDeclarations = {
    chips: { attribute: false },
    rail: { type: Boolean, reflect: true },
  };

  declare chips: readonly FilterChip[];
  declare rail: boolean;

  constructor() {
    super();
    this.chips = [];
    this.rail = false;
  }

  /** Every part here is a chip raising its own events: nothing carries `data-action`. */
  protected override act(): void {}

  /** The "i" segment of the chip `id`, once drawn: where its tip points. Null when the chip has none or is not shown. */
  async infoElementOf(id: string): Promise<HTMLElement | null> {
    await this.updateComplete;
    const chip = this.renderRoot.querySelector<TipChipHost>(`mc-tip-chip[data-id="${CSS.escape(id)}"]`);
    if (!chip) return null;
    await chip.updateComplete;
    return chip.infoElement;
  }

  override render() {
    if (this.chips.length === 0) return nothing;
    return html`<div class="bar" role="group">
      ${repeat(
        this.chips,
        (chip) => chip.id,
        (chip) =>
          html`<mc-tip-chip
            data-id=${chip.id}
            .label=${chip.label}
            .count=${chip.count}
            .value=${chip.id}
            .mark=${chip.mark ?? true}
            .tint=${chip.tint}
            .stop=${`hero-chip:${chip.id}`}
            .infoLabel=${chip.info?.label ?? ""}
            .infoOpen=${chip.info?.open ?? false}
            .infoStop=${`hero-chip-info:${aspectOf(chip.id)}`}
            .reason=${typeof chip.disabled === "string" ? chip.disabled : ""}
            ?selected=${chip.selected}
            ?disabled=${chip.disabled !== undefined && chip.disabled !== false}
            @mc-activate=${(event: Event) => {
              event.stopPropagation();
              this.emit({ type: "chip", id: chip.id });
            }}
            @mc-info=${(event: Event) => {
              event.stopPropagation();
              this.emit({ type: "chip-info", id: chip.id });
            }}
          ></mc-tip-chip>`,
      )}
    </div>`;
  }
}
