import { ThemeStyles, type McCreditsList } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { creditsEvent } from "../../../components/credits/shared/credits-events.types.js";
import { McCreditsPageStyles } from "./mc-credits-page.styles.js";
import type { CreditsPageModel } from "./mc-credits-page.types.js";

/**
 * # Art & Credits (page)
 * The whole screen as one element that only composes: the ink top bar (Back and the title) over `mc-credits-list`, the
 * read-only scrolling list of the fan-project notice and who made what. Nothing in the list is a control, so a swipe that
 * lifts over a row fires nothing. The scene mounts it, sets `model` and hears `mc-credits`.
 *
 * Needs `@mc/ui` defined (`mc-top-bar`, `mc-credits-list`).
 *
 * @element mc-credits-page
 * @prop model - `CreditsPageModel`.
 * @attr phone - Set from the model: the phone's bar and gutters.
 * @fires mc-credits - `{ type: "back" }`.
 */
export class McCreditsPage extends LitElement {
  static override styles = [ThemeStyles, McCreditsPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: CreditsPageModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  /** The list's scrolling element, for paging, the right stick and keeping a focused entry in view. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McCreditsList>("mc-credits-list")?.scroller ?? null;
  }

  /** The element drawn for row `index`, for the focus ring. */
  rowElement(index: number): HTMLElement | null {
    return this.renderRoot.querySelector<McCreditsList>("mc-credits-list")?.rowElement(index) ?? null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-top-bar
        class="bar"
        .heading=${m.bar.title}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${m.bar.backGlyph}
        .titleDrop=${m.bar.titleDrop}
        .titleMaxRight=${m.bar.titleMaxRight}
        ?compact=${m.phone}
        @mc-press=${() => this.dispatchEvent(creditsEvent({ type: "back" }))}
      ></mc-top-bar>
      <div class="body"><mc-credits-list .rows=${m.rows} ?phone=${m.phone}></mc-credits-list></div>`;
  }
}
