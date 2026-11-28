import "@mc/ui/title";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../../../components/title/mc-title-banner/mc-title-banner.js";
import "../../../components/title/mc-title-footer/mc-title-footer.js";
import "../../../components/title/mc-title-games/mc-title-games.js";
import "../../../components/title/mc-title-icon-row/mc-title-icon-row.js";
import "../../../components/title/mc-title-logo/mc-title-logo.js";
import "../../../components/title/mc-title-menu/mc-title-menu.js";
import "../../../components/title/mc-title-notice-bar/mc-title-notice-bar.js";
import "../../../components/title/mc-title-promo/mc-title-promo.js";
import "../../../components/title/mc-title-rank/mc-title-rank.js";
import "../../../components/title/mc-title-status/mc-title-status.js";
import { TitleRelay } from "../../../components/title/shared/title-relay.js";
import type { TitleMode } from "../../../components/title/shared/title.types.js";
import type { TitlePageInput } from "./mc-title-page.types.js";
import { TitlePageStyles } from "./mc-title-page.styles.js";

/**
 * # Title (page)
 * The whole Title screen, composed of its sections and nothing else. A wide screen splits in two down a red rule: the
 * art column (transparent, so the picture the scene draws under the page shows) holds the banner, the In-progress games
 * panel, the Play online caption and the rank card; the paper column holds the logo with its icon row, the menu and
 * the footer, with the Play online panel beside the menu where there is room. A phone is one column on an ink ground with
 * the banner above the logo and the rank card above the footer. It decides nothing: every press is the one `mc-title`
 * event, which bubbles through it to the scene.
 *
 * @element mc-title-page
 * @prop input - What it shows (`TitlePageInput`).
 * @attr mode - wide | phone, set by the scene from the screen size.
 * @attr placement - side when the Play online panel stands beside the menu (reflected from the input).
 * @fires mc-title - `TitleEventDetail`: a control was pressed.
 */
export class McTitlePage extends LitElement {
  static override styles = TitlePageStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
    placement: { type: String, reflect: true },
  };

  declare input: TitlePageInput | null;
  declare mode: TitleMode;
  declare placement: "side" | "art" | "none";

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    this.placement = "none";
    new TitleRelay(this);
  }

  protected override willUpdate(): void {
    this.placement = this.input?.promo?.variant ?? "none";
  }

  /** The menu column's scroller: the right stick scrolls it, and a focused stop scrolls into it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroll");
  }

  /** What the scene draws the ink ground and the picture under: the art column, or on a phone the whole page. */
  get artElement(): HTMLElement {
    return this.renderRoot.querySelector<HTMLElement>(".art") ?? this;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const phone = this.mode === "phone";
    const banner = input.banner
      ? html`<mc-title-banner class="banner" .input=${input.banner}></mc-title-banner>`
      : nothing;
    const rank = html`<mc-title-rank
      class="rank"
      .stop=${"rank-badge"}
      .action=${"rank-badge"}
      .input=${input.rank}
    ></mc-title-rank>`;
    const promo = input.promo ? html`<mc-title-promo class="promo" .input=${input.promo}></mc-title-promo>` : nothing;
    const side = input.promo?.variant === "side";
    return html`<div class="page">
      ${
        input.notice
          ? html`<mc-title-notice-bar
              class="notice"
              .stop=${"release-notice"}
              .action=${"release-notice"}
              .input=${input.notice}
            ></mc-title-notice-bar>`
          : html`<span></span>`
      }
      ${
        input.problem
          ? html`<mc-title-status class="problem" .input=${input.problem}></mc-title-status>`
          : html`<span></span>`
      }
      <div class="body">
        ${
          phone
            ? nothing
            : html`<aside class="art">
                  ${banner}
                  ${input.games ? html`<mc-title-games class="games" .input=${input.games}></mc-title-games>` : nothing}
                  <span class="spacer"></span>
                  ${side ? nothing : promo} ${rank}
                </aside>
                <div class="divider"></div>`
        }
        <main class="menu">
          ${phone ? banner : nothing}
          <header class="head">
            <mc-title-logo .mode=${this.mode} .input=${input.logo}>
              <mc-title-icon-row slot="top-end" .mode=${this.mode} .input=${input.icons}></mc-title-icon-row>
            </mc-title-logo>
          </header>
          <div class="scroll">
            <div class="cols">
              <mc-title-menu .input=${input.menu}></mc-title-menu>
              ${side ? promo : nothing}
              ${input.status ? html`<mc-title-status class="status" .input=${input.status}></mc-title-status>` : nothing}
              ${phone ? rank : nothing}
              <mc-title-footer class="foot" .input=${input.footer}></mc-title-footer>
            </div>
          </div>
        </main>
      </div>
    </div>`;
  }
}

if (!customElements.get("mc-title-page")) {
  customElements.define("mc-title-page", McTitlePage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-page": McTitlePage;
  }
}
