import { html, LitElement, nothing, type TemplateResult } from "lit";
import { glyphLabelShift, type McButtonKind } from "@mc/ui";
import {
  DECKS_EVENT,
  type DecksAction,
  type DecksActionButton,
  type DecksEvent,
  type FilterChip,
} from "../decks.types.js";

/** What a plain button of the screen needs beyond its model: how it looks and the stop it is. */
export interface DecksButtonLook {
  readonly kind: McButtonKind;
  /** The focus stop's key; left out, the action's own name. */
  readonly stop?: string;
  readonly selected?: boolean;
  readonly display?: boolean;
  readonly hug?: boolean;
  readonly size?: number;
}

/**
 * The base of Decks & Collection's elements: one way to speak to the scene (`mc-decks`, typed) and one way to draw a plain
 * button with its pad glyph hung on it. A press goes through `mc-button` (a tap, never the lift that ends a swipe; Enter on
 * its stop is `click()`), so a control here has no pointer handling of its own.
 */
export abstract class DecksElement extends LitElement {
  protected emit(detail: DecksEvent): void {
    this.dispatchEvent(new CustomEvent<DecksEvent>(DECKS_EVENT, { detail, bubbles: true, composed: true }));
  }

  protected act(action: DecksAction): void {
    this.emit({ type: "action", action });
  }

  /** A plain button: dimmed with its reason as the tooltip while it cannot act, and still pressable (the screen says why). */
  protected button(spec: DecksActionButton, look: DecksButtonLook): TemplateResult {
    const reason = spec.disabled ?? "";
    return html`<div class="ctl" style=${`--mc-label-shift:${glyphLabelShift(spec.glyph ?? undefined)}px`}>
      <mc-button
        kind=${look.kind}
        data-stop=${look.stop ?? spec.action}
        style=${look.size ? `--mc-button-size:${look.size}px` : ""}
        .label=${spec.label}
        .reason=${reason}
        ?disabled=${reason !== ""}
        ?pressable=${reason !== ""}
        ?selected=${look.selected ?? false}
        ?display=${look.display ?? false}
        ?hug=${look.hug ?? false}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.act(spec.action);
        }}
      ></mc-button>
      ${spec.glyph ? html`<mc-glyph-hint .glyph=${spec.glyph}></mc-glyph-hint>` : nothing}
    </div>`;
  }

  /** A row of filter chips of one list: each is a stop `<prefix>:<chip id>`. */
  protected chips(list: "deck" | "pool", chips: readonly FilterChip[], prefix: string): TemplateResult {
    return html`${chips.map(
      (chip) =>
        html`<mc-filter-chip
          class="chip"
          data-key=${`chip:${chip.id}`}
          data-stop=${`${prefix}:${chip.id}`}
          hug
          size=${11}
          .label=${chip.label}
          .value=${chip.id}
          .tint=${chip.tint}
          ?selected=${chip.selected}
          @mc-activate=${(event: Event) => {
            event.stopPropagation();
            this.emit({ type: "chip", list, id: chip.id });
          }}
        ></mc-filter-chip>`,
    )}`;
  }
}
