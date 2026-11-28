import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitOneLine } from "../../shared/fit.js";
import type { HintGlyph } from "../mc-hint-button/mc-hint-button.types.js";
import { McTopBarStyles } from "./mc-top-bar.styles.js";

/**
 * # Top bar
 * The ink bar across the top of a setup-flow screen: a boxed Back button (with its Cancel glyph while a keyboard or pad
 * is in use), the Bangers title and a small uppercase label at the right edge. The dark mode tab hangs from the top
 * centre of the screen: the screen says how far the title drops to clear it (`title-drop`) or where it must end
 * (`title-max-right`), as the client's `sheetThemeFor` rule works them out.
 *
 * The bar fills the height its parent gives it. A tap on Back raises `mc-press` (the inner button's; a focus stop's
 * `click()` on the `back` button raises it too).
 *
 * @element mc-top-bar
 * @attr back-label - The Back button word; no button when empty.
 * @attr back-stop - The `data-stop` key of the Back button ("back").
 * @attr heading - The page title, already translated.
 * @attr right - The small label at the right edge, already translated.
 * @attr compact - A phone's smaller bar (a 22px title, 12px padding, a glyph-less Back).
 * @attr title-drop - How far the title drops (px) to sit under the dark mode tab.
 * @attr title-max-right - Where the title must end (px from the bar's left edge); 0 for no limit.
 * @prop backGlyph - The Back button's glyph (`HintGlyph`), or null.
 * @slot end - A control at the bar's right end (a button such as "Your stats"): it keeps its own width.
 * @fires mc-press - A tap on Back.
 */
export class McTopBar extends LitElement {
  static override styles = [ThemeStyles, McTopBarStyles];

  static override properties: PropertyDeclarations = {
    backLabel: { type: String, attribute: "back-label" },
    backStop: { type: String, attribute: "back-stop" },
    heading: { type: String },
    right: { type: String },
    compact: { type: Boolean, reflect: true },
    titleDrop: { type: Number, attribute: "title-drop" },
    titleMaxRight: { type: Number, attribute: "title-max-right" },
    backGlyph: { attribute: false },
  };

  declare backLabel: string;
  declare backStop: string;
  declare heading: string;
  declare right: string;
  declare compact: boolean;
  declare titleDrop: number;
  declare titleMaxRight: number;
  declare backGlyph: HintGlyph | null;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.backLabel = "";
    this.backStop = "back";
    this.heading = "";
    this.right = "";
    this.compact = false;
    this.titleDrop = 0;
    this.titleMaxRight = 0;
    this.backGlyph = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  protected override updated(): void {
    this.style.setProperty("--mc-title-drop", `${this.titleDrop}px`);
    this.#fit();
  }

  /** The title ends before the dark mode tab (`title-max-right`) and shrinks to fit the room it has. */
  #fit(): void {
    const title = this.renderRoot.querySelector<HTMLElement>(".title");
    if (!title) return;
    title.style.maxWidth = "";
    if (this.titleMaxRight > 0) {
      const room = this.titleMaxRight - (title.getBoundingClientRect().left - this.getBoundingClientRect().left);
      title.style.maxWidth = `${Math.max(40, room)}px`;
    }
    fitOneLine(title);
  }

  override render() {
    return html`<div class="bar">
      ${
        this.backLabel
          ? html`<mc-hint-button
              class="back"
              data-stop=${this.backStop}
              kind="onInk"
              display
              hug
              .label=${this.backLabel}
              .glyph=${this.compact ? null : this.backGlyph}
            ></mc-hint-button>`
          : nothing
      }
      <span class="title">${this.heading}</span>
      ${this.right ? html`<span class="right">${this.right}</span>` : nothing}
      <span class="end"><slot name="end"></slot></span>
    </div>`;
  }
}
