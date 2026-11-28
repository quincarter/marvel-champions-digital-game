import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { ControlGlyph } from "../../shared/popup.types.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { onThemeTabChange, themeTab } from "../../shared/theme-tab.js";
import { titleClearance } from "../../shared/title-clearance.js";
import type { PressDetail } from "../../shared/press/press.types.js";
import type { HintGlyph } from "../mc-hint-button/mc-hint-button.types.js";
import { McTopBarStyles } from "./mc-top-bar.styles.js";
import { TOP_BAR_CLOSE_ACTION } from "./mc-top-bar.types.js";

/** The panel layer around a node, climbing out of shadow roots, or null (a bar made outside one). */
function layerOf(from: Node): HTMLElement | null {
  for (let node: Node | null = from; node; node = node.parentNode ?? (node as ShadowRoot).host ?? null) {
    if (node instanceof HTMLElement && node.hasAttribute("data-mc-layer")) return node;
  }
  return null;
}

/**
 * # Top bar
 * The one ink bar across the top of every screen: a boxed Back button (with its Cancel glyph while a keyboard or pad is
 * in use) or a drawn close ×, the Bangers title (with an optional small subtitle under it), a small uppercase caption at
 * the right and a slot for what sits at the right end.
 *
 * It keeps its title clear of the dark mode tab by one rule (`titleClearance`, fed by the shared `themeTab` the theme
 * button publishes): on a wide bar the title sits beside Back when the whole of it ends before the tab, else, and always
 * on a narrow bar (a phone), it drops to its own row under the tab. A title is never shrunk, truncated or run under the
 * tab, so the bar grows taller when it drops: give it a `min-height` (`--mc-top-bar-height`), never a fixed height. A
 * bar finds where it sits in the panel layer (`[data-mc-layer]`, the client's `#mc-ui`), so it can sit anywhere in a screen.
 *
 * A tap on Back (or on the close ×) raises `mc-press` (a focus stop's `click()` on the `back` / `close` stop raises it
 * too).
 *
 * @element mc-top-bar
 * @attr variant - `back` (a boxed Back button, the default) or `close` (a drawn ×, as the learning screens have).
 * @attr back-label - The Back button word, or the close × 's accessible name; no control when empty.
 * @attr back-stop - The `data-stop` key of that control ("back", or "close" in the close variant).
 * @attr back-name - The control's accessible name when its label is a bare arrow ("◂"); the label otherwise.
 * @attr heading - The page title, already translated.
 * @attr eyebrow - A small uppercase line over the title, already translated.
 * @attr subtitle - A small line under the title, already translated.
 * @attr right - The small caption at the right edge, already translated.
 * @attr compact - A phone's smaller bar (a 22px title, 12px padding, a glyph-less Back).
 * @attr italic - The title set in italics (Seats, Decks).
 * @attr tone - `ink` (the ink bar, the default) or `paper` (no ground of its own: a page heading on the paper, as the Deck builder's).
 * @prop backGlyph - The Back button's glyph (`HintGlyph`), or null. In the close variant, the glyph (`ControlGlyph`) hung
 *   after the title.
 * @slot end - What sits at the bar's right end (a button, a progress strip): it keeps its own width.
 * @cssprop --mc-top-bar-height - The bar's minimum height (60px, 52px compact).
 * @cssprop --mc-top-bar-title-size - The title's size (28px, 22px compact).
 * @fires mc-press - A tap on Back or the close ×.
 */
export class McTopBar extends LitElement {
  static override styles = [ThemeStyles, McTopBarStyles];

  static override properties: PropertyDeclarations = {
    variant: { type: String, reflect: true },
    backLabel: { type: String, attribute: "back-label" },
    backStop: { type: String, attribute: "back-stop" },
    backName: { type: String, attribute: "back-name" },
    heading: { type: String },
    eyebrow: { type: String },
    subtitle: { type: String },
    right: { type: String },
    compact: { type: Boolean, reflect: true },
    italic: { type: Boolean, reflect: true },
    tone: { type: String, reflect: true },
    backGlyph: { attribute: false },
  };

  declare variant: "back" | "close";
  declare backLabel: string;
  declare backStop: string;
  declare backName: string;
  declare heading: string;
  declare eyebrow: string;
  declare subtitle: string;
  declare right: string;
  declare compact: boolean;
  declare italic: boolean;
  declare tone: "ink" | "paper";
  declare backGlyph: HintGlyph | ControlGlyph | null;
  #resize: ResizeObserver | null = null;
  #offTab: (() => void) | null = null;
  readonly #measure = (): void => this.#place();

  constructor() {
    super();
    this.variant = "back";
    this.backLabel = "";
    this.backStop = "";
    this.backName = "";
    this.heading = "";
    this.eyebrow = "";
    this.subtitle = "";
    this.right = "";
    this.compact = false;
    this.italic = false;
    this.tone = "ink";
    this.backGlyph = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(this.#measure);
      this.#resize.observe(this);
    }
    this.#offTab = onThemeTabChange(this.#measure);
    // The title's width changes when the display face arrives.
    if (typeof document !== "undefined") document.fonts?.addEventListener?.("loadingdone", this.#measure);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
    this.#offTab?.();
    this.#offTab = null;
    if (typeof document !== "undefined") document.fonts?.removeEventListener?.("loadingdone", this.#measure);
  }

  protected override updated(): void {
    this.#place();
  }

  /** Asks the shared rule where the title goes now, and sets `dropped` and the first row's height to match. */
  #place(): void {
    const bar = this.renderRoot.querySelector<HTMLElement>(".bar");
    const sizer = this.renderRoot.querySelector<HTMLElement>(".sizer");
    if (!bar || !sizer) return;
    const style = getComputedStyle(bar);
    const gap = parseFloat(style.columnGap) || 0;
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padRight = parseFloat(style.paddingRight) || 0;
    const barWidth = this.clientWidth;
    const origin = this.#origin();
    const tab = themeTab();
    const lead = this.renderRoot.querySelector<HTMLElement>(".lead");
    const tail = ["right", "end"]
      .map((cls) => this.renderRoot.querySelector<HTMLElement>(`.${cls}`))
      .reduce((room, item) => (item && item.offsetWidth > 0 ? room + item.offsetWidth + gap : room), 0);
    const result = titleClearance({
      barWidth,
      titleLeft: padLeft + (lead ? lead.offsetWidth + gap : 0),
      titleWidth: sizer.offsetWidth,
      rowRight: barWidth - padRight - tail,
      tab: tab ? { left: tab.left - origin.x, right: tab.right - origin.x, bottom: tab.bottom - origin.y } : null,
    });
    this.toggleAttribute("dropped", result.dropped);
    this.style.setProperty("--mc-top-bar-first-row", `${result.firstRow}px`);
  }

  /** Where this bar sits in the panel layer (px from its top-left): the tab's box is published in the layer's px. */
  #origin(): { x: number; y: number } {
    const layer = layerOf(this);
    if (!layer) return { x: 0, y: 0 };
    const box = this.getBoundingClientRect();
    const base = layer.getBoundingClientRect();
    const scale = base.width / (layer.offsetWidth || 1) || 1;
    return { x: (box.left - base.left) / scale, y: (box.top - base.top) / scale };
  }

  #pressed(event: Event): void {
    const detail = (event as CustomEvent<PressDetail>).detail;
    if (detail?.action !== TOP_BAR_CLOSE_ACTION) return;
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
  }

  #lead() {
    if (!this.backLabel) return nothing;
    if (this.variant === "close") {
      return html`<div class="lead ctl">
        <mc-chip
          class="close"
          label="×"
          aria-label=${this.backName || this.backLabel}
          .stop=${this.backStop || "close"}
          .action=${TOP_BAR_CLOSE_ACTION}
          @mc-pressed=${(event: Event) => this.#pressed(event)}
        ></mc-chip>
      </div>`;
    }
    return html`<mc-hint-button
      class="lead back"
      aria-label=${this.backName || nothing}
      data-stop=${this.backStop || "back"}
      kind="onInk"
      display
      hug
      .label=${this.backLabel}
      .glyph=${this.compact ? null : (this.backGlyph as HintGlyph | null)}
    ></mc-hint-button>`;
  }

  override render() {
    const closeGlyph = this.variant === "close" ? (this.backGlyph as ControlGlyph | null) : null;
    return html`<div class="bar">
      <span class="strut"></span>
      ${this.#lead()}
      <div class="titles">
        ${this.eyebrow ? html`<div class="eyebrow">${this.eyebrow}</div>` : nothing}
        <div class="line">
          <h1 class="title">${this.heading}</h1>
          ${closeGlyph ? html`<span class="after"><mc-glyph-hint .glyph=${closeGlyph}></mc-glyph-hint></span>` : nothing}
        </div>
        ${this.subtitle ? html`<div class="subtitle">${this.subtitle}</div>` : nothing}
      </div>
      <span class="title sizer" aria-hidden="true">${this.heading}</span>
      ${this.right ? html`<span class="right">${this.right}</span>` : nothing}
      <span class="end" @slotchange=${this.#measure}><slot name="end"></slot></span>
    </div>`;
  }
}
