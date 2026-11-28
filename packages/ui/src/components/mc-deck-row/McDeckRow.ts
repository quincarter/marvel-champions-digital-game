import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { watchCard } from "../../shared/card-events.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import "../mc-picture-tile/mc-picture-tile.js";
import { McDeckRowStyles } from "./mc-deck-row.styles.js";
import type { DeckPickDetail, DeckRowStatus, McDeckRowModel } from "./mc-deck-row.types.js";

const MARKS: Readonly<Record<DeckRowStatus, string>> = { ok: "✓", warning: "!", blocked: "✕", locked: "" };
const HAS_MARK = /^\s*[✓!✕]/u;

/** The verdict as shown: with its mark in front, so a state is never only a colour. */
export function verdictOf(model: McDeckRowModel): { readonly status: DeckRowStatus; readonly text: string } {
  const status = model.status ?? (model.legal ? "ok" : "blocked");
  const mark = model.mark ?? MARKS[status];
  const text = HAS_MARK.test(model.verdict) || mark === "" ? model.verdict : `${mark} ${model.verdict}`;
  return { status, text };
}

/**
 * # Deck row
 * One deck on a list: its hero picture (a mouse over it opens the card popover, a hold inspects), its name, aspect stamps,
 * where it came from, whether it is legal in words, and the action button. A disabled deck keeps its button, dimmed, with
 * the reason as its tooltip; pressing it does nothing. The button is the row's one focus stop, `deck:<deck id>`.
 *
 * @element mc-deck-row
 * @prop model - The deck (`McDeckRowModel`).
 * @fires mc-deck-pick - `{ deckId }` (`DeckPickDetail`): the action button was pressed on an enabled row.
 */
export class McDeckRow extends LitElement {
  static override styles = [ThemeStyles, McDeckRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: McDeckRowModel | null;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.model = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  protected override updated(): void {
    const thumb = this.renderRoot.querySelector<HTMLElement>(".thumb");
    if (!thumb || this.#unwatch) return;
    // Bound once: `render` keeps the same thumb element for the life of the row.
    this.#unwatch = watchCard(thumb, () => {
      const cardId = this.model?.cardId;
      return cardId ? { cardId, face: { kind: "hero" } } : null;
    });
  }

  #press = (event: Event): void => {
    event.stopPropagation();
    const row = this.model;
    if (!row || row.disabled !== null) return;
    this.dispatchEvent(
      new CustomEvent<DeckPickDetail>("mc-deck-pick", {
        detail: { deckId: row.deckId },
        bubbles: true,
        composed: true,
      }),
    );
  };

  override render() {
    const row = this.model;
    if (!row) return nothing;
    const verdict = verdictOf(row);
    return html`<div class="row">
      <mc-picture-tile class="thumb" .picture=${row.picture} .ground=${"parchment"}></mc-picture-tile>
      <div class="words">
        <span class="name">${row.name}</span>
        ${
          row.stamps.length > 0
            ? html`<span class="stamps"
                >${row.stamps.map(
                  (stamp) =>
                    html`<span class="stamp" style=${`--stamp-fill:${stamp.fill};--stamp-ink:${stamp.ink}`}
                      >${stamp.label}</span
                    >`,
                )}</span
              >`
            : nothing
        }
        <span class="source">${row.source}</span>
        <span class="verdict" data-status=${verdict.status}>${verdict.text}</span>
      </div>
      <mc-button
        class="act"
        kind=${row.disabled === null ? "primary" : "secondary"}
        label=${row.seatLabel}
        ?disabled=${row.disabled !== null}
        reason=${row.disabled ?? ""}
        data-stop=${`deck:${row.deckId}`}
        @mc-press=${this.#press}
      ></mc-button>
    </div>`;
  }
}
