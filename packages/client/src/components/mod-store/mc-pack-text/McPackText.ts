import { html, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { keepScroll, restoreScroll } from "../shared/list-scroll.js";
import { McPackTextStyles } from "./mc-pack-text.styles.js";
import type { McPackTextProps } from "./mc-pack-text.types.js";

/**
 * # Pack text
 * The scrolling text of a pack's page in a parchment box: the load status when the pack is installed (whether it is
 * working, or why it is not), the description, credits, permission and requirement, as paragraphs. Native scrolling; where
 * it was scrolled to is kept by `listId`.
 *
 * @element mc-pack-text
 */
export class McPackText extends ModStoreElement implements McPackTextProps {
  static override styles = [ThemeStyles, McPackTextStyles];

  static override properties: PropertyDeclarations = {
    body: { type: String },
    listId: { type: String, attribute: "list-id" },
  };

  declare body: string;
  declare listId: string;

  constructor() {
    super();
    this.body = "";
    this.listId = "";
  }

  /** The native scroller: what the pad's stick and paging move. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("listId")) restoreScroll(this.listId, this.scroller);
  }

  override render() {
    return html`<div
      class="scroller text"
      data-key="list:text"
      @scroll=${(event: Event) => keepScroll(this.listId, (event.target as HTMLElement).scrollTop)}
    >
      <span class="body">${this.body}</span>
    </div>`;
  }
}
