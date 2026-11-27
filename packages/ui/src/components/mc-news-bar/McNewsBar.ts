import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitOneLine } from "../../shared/fit.js";
import { onTap } from "../../shared/tap.js";
import "../mc-glyph/mc-glyph.js";
import { McNewsBarStyles } from "./mc-news-bar.styles.js";
import type { NewsBarModel } from "./mc-news-bar.types.js";

/**
 * # News bar
 * The slim strip across the top of the Title that says what is new, with a link to read more. All of it is one tap
 * target (`mc-press`, by the tap rule). A key or pad glyph shows beside the link while the bar has focus, if the message
 * leaves it room.
 *
 * @element mc-news-bar
 * @fires mc-press - The strip was tapped.
 */
export class McNewsBar extends LitElement {
  static override styles = [ThemeStyles, McNewsBarStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: NewsBarModel | null;
  #stopTap: (() => void) | null = null;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.model = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopTap = onTap(this, () =>
      this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true })),
    );
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTap?.();
    this.#stopTap = null;
    this.#resize?.disconnect();
    this.#resize = null;
  }

  override updated(): void {
    this.#fit();
  }

  #fit(): void {
    const message = this.renderRoot.querySelector<HTMLElement>(".message");
    if (!message) return;
    fitOneLine(message);
    // The glyph keeps off the message: drawn only where the words leave it room.
    const glyph = this.renderRoot.querySelector<HTMLElement>("mc-glyph");
    const words = message.querySelector<HTMLElement>("span");
    if (!glyph || !words) return;
    glyph.hidden = false;
    if (words.offsetWidth + glyph.offsetWidth + 10 > message.clientWidth) glyph.hidden = true;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="bar">
      <div class="tag">${m.tag}</div>
      <div class="message"><span>${m.message}</span></div>
      ${
        m.glyph
          ? html`<mc-glyph
              .specs=${m.glyph.specs}
              .height=${m.glyph.height}
              .ground=${m.glyph.ground}
              .openness=${m.glyph.openness}
              ?still=${m.glyph.still ?? false}
            ></mc-glyph>`
          : nothing
      }
      <div class="link">${m.link}</div>
    </div>`;
  }
}
