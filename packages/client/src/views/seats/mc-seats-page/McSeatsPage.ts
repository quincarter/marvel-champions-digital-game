import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { SEATS_EVENT, type SeatsEvent, type SeatsPageModel } from "../../../components/seats/seats.types.js";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import "../../../components/seats/mc-hero-decks-sheet/mc-hero-decks-sheet.js";
import "../../../components/seats/mc-seats-detail/mc-seats-detail.js";
import "../../../components/seats/mc-seats-filters/mc-seats-filters.js";
import "../../../components/seats/mc-seats-hints/mc-seats-hints.js";
import "../../../components/seats/mc-seats-footer/mc-seats-footer.js";
import "../../../components/seats/mc-seats-notice/mc-seats-notice.js";
import "../../../components/seats/mc-seats-roster/mc-seats-roster.js";
import "../../../components/seats/mc-seats-table/mc-seats-table.js";
import { McSeatsPageStyles } from "./mc-seats-page.styles.js";

/**
 * # Take your seats
 * The page: it only composes the sections and holds no state. Header, then the main column (the seats and their Team-Up
 * pairs, the same-name notice, the filters and the hero roster, which takes every remaining pixel and scrolls natively) and,
 * wide, the ink detail column with the two ways on at its foot; narrow, the sticky ink footer takes their place. The Pick a
 * deck sheet covers the page while `model.decks` is set. Layout is CSS: `model.wide` (the scene's form factor, which also
 * words the seats) only picks which of the two arrangements applies.
 *
 * @element mc-seats-page
 * @prop model - What the page shows (`SeatsPageModel`).
 * @fires mc-seats - every section's event, as it bubbles.
 */
export class McSeatsPage extends LitElement {
  static override styles = [ThemeStyles, McSeatsPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    wide: { type: Boolean, reflect: true },
  };

  declare model: SeatsPageModel | null;
  declare wide: boolean;

  constructor() {
    super();
    this.model = null;
    this.wide = false;
  }

  override willUpdate(): void {
    this.wide = this.model?.wide ?? false;
  }

  /** The section the scene reads back from (the roster's scroller, the filters' search field), by its tag. */
  section<T extends HTMLElement = HTMLElement>(tag: string): T | null {
    return this.renderRoot.querySelector<T>(tag);
  }

  #say(detail: SeatsEvent): void {
    this.dispatchEvent(new CustomEvent<SeatsEvent>(SEATS_EVENT, { detail, bubbles: true, composed: true }));
  }

  override render() {
    const page = this.model;
    if (!page) return nothing;
    const wide = page.wide ?? false;
    return html`
      <mc-top-bar
        class="header"
        italic
        .heading=${page.header.title}
        .right=${page.header.step}
        .backLabel=${page.header.backLabel}
        .backGlyph=${hintGlyphOf(page.header.backGlyph)}
        ?compact=${!wide}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.#say({ type: "action", action: "back" });
        }}
      ></mc-top-bar>
      <main class="main">
        <mc-seats-table
          class="table"
          .seats=${page.seats}
          .pairs=${page.pairs}
          .summary=${page.summary}
          ?compact=${!wide}
        ></mc-seats-table>
        <mc-seats-notice class="notice" .text=${page.notice ?? ""}></mc-seats-notice>
        ${wide && page.hints ? html`<mc-seats-hints class="hints" .model=${page.hints}></mc-seats-hints>` : nothing}
        <mc-seats-filters class="filters" .model=${page.filters}></mc-seats-filters>
        <mc-seats-roster class="roster" .model=${page.roster}></mc-seats-roster>
      </main>
      ${wide ? html`<mc-seats-detail class="detail" .model=${page.detail}></mc-seats-detail>` : nothing}
      <mc-seats-footer class="footer" ?wide=${wide} .model=${page.footer}></mc-seats-footer>
      ${page.decks ? html`<mc-hero-decks-sheet class="decks" .model=${page.decks}></mc-hero-decks-sheet>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-seats-page": McSeatsPage;
  }
}
