import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { watchCard } from "../../shared/card-events.js";
import { onHold, onTap } from "../../shared/tap.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import "../mc-media-row/mc-media-row.js";
import "../mc-picture-tile/mc-picture-tile.js";
import { McDeckRowStyles } from "./mc-deck-row.styles.js";
import type { DeckInspectDetail, DeckPickDetail, DeckRowStatus, McDeckRowModel } from "./mc-deck-row.types.js";

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
 * With `model.listing` it is a list entry instead (an `mc-media-row` deck look under one press target, the stop
 * `deck:<deck id>`): a tap anywhere on it raises `mc-deck-pick`, a hold or Inspect `mc-deck-inspect`, and the picture still
 * opens the card popover.
 *
 * @element mc-deck-row
 * @prop model - The deck (`McDeckRowModel`).
 * @fires mc-deck-pick - `{ deckId }` (`DeckPickDetail`): the action button was pressed on an enabled row, or a listed row tapped.
 * @fires mc-deck-inspect - `{ deckId }` (`DeckInspectDetail`): a listed row held, or Inspect on its stop.
 */
export class McDeckRow extends LitElement {
  static override styles = [ThemeStyles, McDeckRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: McDeckRowModel | null;
  #unwatch: (() => void) | null = null;
  #unpress: (() => void) | null = null;
  #pressed: HTMLElement | null = null;

  constructor() {
    super();
    this.model = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
    this.#unpress?.();
    this.#unpress = null;
    this.#pressed = null;
  }

  /** The route's Inspect on a listed row's stop. */
  inspect(): void {
    this.#say("mc-deck-inspect");
  }

  #say(name: "mc-deck-pick" | "mc-deck-inspect"): void {
    const deckId = this.model?.deckId;
    if (deckId === undefined) return;
    this.dispatchEvent(
      new CustomEvent<DeckPickDetail | DeckInspectDetail>(name, { detail: { deckId }, bubbles: true, composed: true }),
    );
  }

  /** A listed row's press target, bound once per element (`render` keeps it while the row is listed). */
  #bindListing(): void {
    const target = this.renderRoot.querySelector<HTMLElement>(".listing");
    if (target === this.#pressed) return;
    this.#unpress?.();
    this.#unpress = null;
    this.#pressed = target;
    if (!target) return;
    const stopTap = onTap(target, () => this.#say("mc-deck-pick"));
    const stopHold = onHold(target, () => this.#say("mc-deck-inspect"));
    // `click()` from the focus route (Enter on the stop) has no pointer behind it (`detail` 0): it presses.
    const click = (event: MouseEvent): void => {
      if (event.detail === 0) this.#say("mc-deck-pick");
    };
    target.addEventListener("click", click);
    this.#unpress = () => {
      stopTap();
      stopHold();
      target.removeEventListener("click", click);
    };
  }

  protected override updated(): void {
    this.#bindListing();
    if (this.#unwatch) return;
    const listed = this.renderRoot.querySelector<HTMLElement & { updateComplete: Promise<boolean> }>("mc-media-row");
    if (listed) {
      // A listed row's picture is the media row's own tile, which draws after this element does.
      void listed.updateComplete.then(() => {
        const tile = listed.shadowRoot?.querySelector<HTMLElement>("mc-picture-tile");
        if (tile && !this.#unwatch) this.#unwatch = this.#watchTile(tile);
      });
      return;
    }
    const thumb = this.renderRoot.querySelector<HTMLElement>(".thumb");
    // Bound once: `render` keeps the same thumb element for the life of the row.
    if (thumb) this.#unwatch = this.#watchTile(thumb);
  }

  #watchTile(tile: HTMLElement): () => void {
    return watchCard(tile, () => {
      const cardId = this.model?.cardId;
      return cardId ? { cardId, face: { kind: "hero" } } : null;
    });
  }

  #press = (event: Event): void => {
    event.stopPropagation();
    const row = this.model;
    if (!row || row.disabled !== null) return;
    this.#say("mc-deck-pick");
  };

  #listing(row: McDeckRowModel) {
    const media = row.listing!;
    return html`<div class="listing" role="button" tabindex="-1" data-stop=${`deck:${row.deckId}`}>
      <mc-media-row
        look="deck"
        .heading=${media.heading}
        .meta=${media.meta ?? ""}
        .foot=${media.foot ?? ""}
        .badge=${media.badge ?? ""}
        .src=${media.src ?? ""}
        .retry=${media.retry ?? ""}
        .focusX=${media.focusX ?? 0.5}
        .focusY=${media.focusY ?? 0.3}
        .focusCentered=${media.focusCentered ?? false}
        .artWidth=${media.artWidth ?? 0}
        .stamps=${media.stamps ?? []}
        .group=${media.group ?? ""}
        .groupHeight=${media.groupHeight ?? 16}
        .selected=${media.selected ?? false}
        .alert=${media.alert ?? false}
        .dim=${media.dim ?? false}
      ></mc-media-row>
    </div>`;
  }

  override render() {
    const row = this.model;
    if (!row) return nothing;
    if (row.listing) return this.#listing(row);
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
