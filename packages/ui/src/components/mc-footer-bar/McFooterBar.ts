import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import { McFooterBarStyles } from "./mc-footer-bar.styles.js";
import type { FooterBarModel } from "./mc-footer-bar.types.js";

/**
 * # Footer bar
 * The Title's footer line: a quiet note at the left, the build version and underlined links at the right. A phone's
 * footer has no room for all of it, so the note goes when it would touch the links. Each link is a tap target
 * (`mc-activate`, by the tap rule).
 *
 * @element mc-footer-bar
 * @fires mc-activate - `detail.key`: a link was tapped.
 */
export class McFooterBar extends LitElement {
  static override styles = [ThemeStyles, McFooterBarStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    ground: { type: String, reflect: true },
  };

  declare model: FooterBarModel | null;
  /** The ground the footer sits on: its words are ink on paper, paper on ink. */
  declare ground: "ink" | "paper";
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.model = null;
    this.ground = "paper";
  }

  /** The element drawn for a link's key (its touch target, for a focus stop's rect). */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
    }
    void document.fonts?.ready.then(() => {
      if (this.isConnected) this.#fit();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  override updated(): void {
    this.#fit();
  }

  /** The note leaves when it would run within 8px of the first link's target (the Phaser footer's own rule). */
  #fit(): void {
    const note = this.renderRoot.querySelector<HTMLElement>(".note");
    const right = this.renderRoot.querySelector<HTMLElement>(".right");
    if (!note || !right) return;
    note.hidden = false;
    const first = [...right.children].reduce<number>(
      (left, child) => Math.min(left, (child as HTMLElement).offsetLeft),
      Number.POSITIVE_INFINITY,
    );
    const taken = right.offsetLeft + (Number.isFinite(first) ? first : 0);
    // `taken` is the first link's box, 6px of padding before its text: the note keeps 8px clear of the text less that 6.
    if (note.offsetLeft + note.offsetWidth + 8 > taken) note.hidden = true;
  }

  #activate(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="note">${m.note}</div>
      ${m.aside ? html`<div class="aside">${m.aside}</div>` : nothing}
      <div class="right">
        <div class="version">${m.version}</div>
        ${m.links.map(
          (link) =>
            html`<div class="link" data-key=${link.key} ${tapped(() => this.#activate(link.key))}>
              <span>${link.label}</span>
            </div>`,
        )}
      </div>`;
  }
}
