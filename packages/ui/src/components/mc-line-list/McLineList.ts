import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { LineListGroup } from "./mc-line-list.types.js";

const styles = css`
  :host {
    display: block;
  }
  :host([dark]) {
    color: var(--mc-text-paper);
  }
  .group {
    padding-bottom: 4px;
  }
  .title {
    height: 14px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 12px;
    text-transform: uppercase;
    opacity: 0.5;
  }
  .entry {
    display: flex;
    height: 16px;
    font-size: var(--mc-small-11, 11px);
    line-height: 16px;
  }
  .name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .quantity {
    width: 40px;
    padding-right: 10px;
    text-align: right;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    opacity: 0.75;
  }
`;

/**
 * # Line list
 * Titled groups of one-line entries, each with its count at the right: a deck's cards by group. Read-only.
 *
 * @element mc-line-list
 */
export class McLineList extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = {
    groups: { attribute: false },
    dark: { type: Boolean, reflect: true },
  };

  declare groups: readonly LineListGroup[];
  /** Paper words, for a list on an ink panel. */
  declare dark: boolean;

  constructor() {
    super();
    this.groups = [];
    this.dark = false;
  }

  /** The entries that name a card, with their elements: where a hover popover is wanted. */
  hoverEntries(): { readonly cardId: string; readonly element: HTMLElement }[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>("[data-hover]")].map((element) => ({
      cardId: element.dataset.hover!,
      element,
    }));
  }

  override render() {
    return html`${this.groups.map(
      (group) =>
        html`<div class="group">
          <div class="title">${group.label}</div>
          ${group.entries.map(
            (entry) =>
              html`<div class="entry" data-hover=${entry.hover ?? nothing}>
                <span class="name">${entry.name}</span><span class="quantity">${entry.quantity}</span>
              </div>`,
          )}
        </div>`,
    )}`;
  }
}
