import { PRESS_EVENT, onTap, type PressDetail } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { TitleFooterInput } from "./mc-title-footer.types.js";
import { McTitleFooterStyles } from "./mc-title-footer.styles.js";

/**
 * # Title footer
 * The footer line: the card-pool note, the release notes link (and Discord where the top row has no room for its icon)
 * and the build version. Each link is a focus stop by its key; a tap, and the focus route pressing it, raise
 * `mc-pressed` with that key as the action.
 *
 * @element mc-title-footer
 * @prop input - What it says (`TitleFooterInput`).
 * @fires mc-pressed - `PressDetail`, its `action` the link key.
 */
export class McTitleFooter extends LitElement {
  static override styles = McTitleFooterStyles;

  static override properties: PropertyDeclarations = { input: { attribute: false } };

  declare input: TitleFooterInput | null;
  readonly #bound = new WeakSet<Element>();

  constructor() {
    super();
    this.input = null;
  }

  #press(key: string): void {
    this.dispatchEvent(
      new CustomEvent<PressDetail>(PRESS_EVENT, {
        detail: { action: key, hold: false },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override updated(): void {
    for (const link of this.renderRoot.querySelectorAll<HTMLElement>(".link")) {
      if (this.#bound.has(link)) continue;
      this.#bound.add(link);
      const key = (): string => link.dataset.stop ?? "";
      onTap(link, () => this.#press(key()));
      link.addEventListener("click", (event) => {
        if (event.detail === 0) this.#press(key());
      });
    }
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`${input.aside ? html`<div class="aside">${input.aside}</div>` : nothing}
      <div class="line">
        <span class="note">${input.note}</span>
        <div class="right">
          ${input.links.map(
            (link) =>
              html`<div class="link" role="link" tabindex="-1" data-stop=${link.key}><span>${link.label}</span></div>`,
          )}
          <span class="version">${input.version}</span>
        </div>
      </div>`;
  }
}
