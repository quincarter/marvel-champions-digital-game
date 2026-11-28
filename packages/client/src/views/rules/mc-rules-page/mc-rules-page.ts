import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchField } from "@mc/ui";
import "../../../components/rules/mc-rules-header/mc-rules-header.js";
import "../../../components/rules/mc-rules-tabs/mc-rules-tabs.js";
import "../../../components/rules/mc-rules-glossary/mc-rules-glossary.js";
import "../../../components/rules/mc-rules-villain-phase/mc-rules-villain-phase.js";
import "../../../components/rules/mc-rules-card-list/mc-rules-card-list.js";
import { rulesEvent } from "../../../components/rules/shared/rules-events.types.js";
import { McRulesPageStyles } from "./mc-rules-page.styles.js";
import type { RulesPageModel } from "./mc-rules-page.types.js";

/**
 * # Rules reference (page)
 * The whole screen as one element that only composes, in the shared `mc-reader` frame (`@mc/ui`, with no contents pane):
 * the ink header with the scope toggle, the tab rail and, on the Glossary, the search field, then the tab's body: the
 * glossary grid, the villain phase steps or the card list. The scene mounts it in a `DomRegion`, sets `model` and listens
 * for `mc-rules`.
 *
 * @element mc-rules-page
 * @prop model - `RulesPageModel`.
 * @fires mc-rules - `RulesEventDetail`, from any section.
 */
export class McRulesPage extends LitElement {
  static override styles = [ThemeStyles, McRulesPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: RulesPageModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The search field, for its caret (the scene's Escape and pad rules). */
  get searchField(): McSearchField | null {
    return this.renderRoot.querySelector("mc-search-field");
  }

  /** The tab body's scrolling element: the stick and paging move it. */
  get scroller(): HTMLElement | null {
    const body = this.renderRoot.querySelector<HTMLElement & { scroller: HTMLElement | null }>(
      "mc-rules-glossary, mc-rules-villain-phase, mc-rules-card-list",
    );
    return body?.scroller ?? null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-reader no-side pane="main">
      <mc-rules-header
        slot="bar"
        .backLabel=${m.header.backLabel}
        .heading=${m.header.heading}
        .backGlyph=${m.header.backGlyph}
        .titleDrop=${m.header.titleDrop}
        .titleMax=${m.header.titleMax}
        .caption=${m.header.caption}
        .toggle=${m.header.toggle}
      ></mc-rules-header>
      <div slot="toolbar" class="toolbar">
        <mc-rules-tabs .tabs=${m.tabs} .selected=${m.tab}></mc-rules-tabs>
        ${
          m.search
            ? html`<mc-search-field
                data-stop="search"
                .value=${m.search.query}
                .placeholder=${m.search.placeholder}
                @mc-search=${(event: CustomEvent<{ value: string }>) => {
                  event.stopPropagation();
                  this.dispatchEvent(rulesEvent({ type: "search", value: event.detail.value }));
                }}
                @mc-search-focus=${(event: CustomEvent<{ focused: boolean }>) => {
                  event.stopPropagation();
                  this.dispatchEvent(rulesEvent({ type: "search-focus", focused: event.detail.focused }));
                }}
              ></mc-search-field>`
            : nothing
        }
      </div>
      <div slot="main" class="body">
        ${m.glossary ? html`<mc-rules-glossary .entries=${m.glossary.entries} .empty=${m.glossary.empty}></mc-rules-glossary>` : nothing}
        ${
          m.villain
            ? html`<mc-rules-villain-phase
                .steps=${m.villain.steps}
                .citation=${m.villain.citation}
              ></mc-rules-villain-phase>`
            : nothing
        }
        ${
          m.cards
            ? html`<mc-rules-card-list
                .items=${m.cards.items}
                .empty=${m.cards.empty}
                .cardScale=${m.cards.cardScale}
                .caption=${m.cards.caption}
              ></mc-rules-card-list>`
            : nothing
        }
      </div>
    </mc-reader>`;
  }
}

if (!customElements.get("mc-rules-page")) {
  customElements.define("mc-rules-page", McRulesPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-page": McRulesPage;
  }
}
