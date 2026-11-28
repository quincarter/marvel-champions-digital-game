import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../../../components/table-setup/mc-setup-deal-bar/mc-setup-deal-bar.js";
import "../../../components/table-setup/mc-setup-difficulty/mc-setup-difficulty.js";
import "../../../components/table-setup/mc-setup-encounter/mc-setup-encounter.js";
import "../../../components/table-setup/mc-setup-modulars/mc-setup-modulars.js";
import "../../../components/table-setup/mc-setup-seating/mc-setup-seating.js";
import "../../../components/table-setup/mc-setup-summary/mc-setup-summary.js";
import "../../../components/table-setup/mc-setup-top-bar/mc-setup-top-bar.js";
import type { McSetupSeating } from "../../../components/table-setup/mc-setup-seating/McSetupSeating.js";
import type { McSetupSummary } from "../../../components/table-setup/mc-setup-summary/McSetupSummary.js";
import type { SetupMode } from "../../../components/table-setup/shared/setup-events.types.js";
import type { TableSetupPageInput } from "./mc-table-setup-page.types.js";
import { TableSetupPageStyles } from "./mc-table-setup-page.styles.js";

/**
 * # Set up the table (page)
 * Step 4 of 4: the whole screen, composed of its sections and nothing else. Difficulty, Modular sets, Seating and the
 * encounter deck run down a natively scrolling body; the game summary (the seed, the watch toggle, the villain) and the
 * deal bar sit in the ink sidebar beside it (wide) or follow the body, with the deal bar pinned as the footer (phone,
 * which a tablet in portrait is too). It decides nothing: every change is the sections' own `mc-setup` event, which
 * bubbles through it to the scene.
 *
 * @element mc-table-setup-page
 * @prop input - What it shows (`TableSetupPageInput`).
 * @attr mode - wide | phone, set by the scene from the screen's width.
 * @fires mc-setup - `SetupEventDetail`, from the sections.
 */
export class McTableSetupPage extends LitElement {
  static override styles = TableSetupPageStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: TableSetupPageInput | null;
  declare mode: SetupMode;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
  }

  /** The body's scroller (the modular tiles move in it), for the focus route and the e2e hook. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".main");
  }

  get #seating(): McSetupSeating | null {
    return this.renderRoot.querySelector("mc-setup-seating");
  }

  get #summary(): McSetupSummary | null {
    return this.renderRoot.querySelector("mc-setup-summary");
  }

  /** Where the first player token is and is drawn now (what an e2e reads). */
  tokenProbe() {
    return this.#seating?.probe() ?? null;
  }

  /** Puts the caret in the seed field. */
  focusSeed(): void {
    this.#summary?.focusSeed();
  }

  /** Takes the caret out of the seed field. */
  blurSeed(): void {
    this.#summary?.blurSeed();
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const mode = this.mode;
    const difficulty = html`<mc-setup-difficulty .input=${input.difficulty} .mode=${mode}></mc-setup-difficulty>`;
    const modulars = html`<mc-setup-modulars .input=${input.modulars} .mode=${mode}></mc-setup-modulars>`;
    const seating = html`<mc-setup-seating .input=${input.seating} .mode=${mode}></mc-setup-seating>`;
    const encounter = html`<mc-setup-encounter .input=${input.encounter} .mode=${mode}></mc-setup-encounter>`;
    const summary = html`<mc-setup-summary .input=${input.summary} .mode=${mode}></mc-setup-summary>`;
    const deal = html`<mc-setup-deal-bar .input=${input.deal} .mode=${mode}></mc-setup-deal-bar>`;
    const bar = html`<mc-setup-top-bar
      .mode=${mode}
      .titleDrop=${input.titleDrop}
      .titleMax=${input.titleMax}
      .backGlyph=${input.backGlyph}
    ></mc-setup-top-bar>`;
    if (mode === "phone")
      return html`${bar}
        <div class="body">
          <div class="main">${difficulty}${modulars}${seating}${summary}${encounter}</div>
          ${deal}
        </div>`;
    return html`${bar}
      <div class="body">
        <div class="main">${difficulty}${modulars}${seating}${encounter}</div>
        <aside class="side">${summary}${deal}</aside>
      </div>`;
  }
}

if (!customElements.get("mc-table-setup-page")) {
  customElements.define("mc-table-setup-page", McTableSetupPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-table-setup-page": McTableSetupPage;
  }
}
