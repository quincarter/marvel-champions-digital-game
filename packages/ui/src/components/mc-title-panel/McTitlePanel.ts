import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { SheetRect } from "../../shared/sheet.types.js";
import "../mc-alert-banner/mc-alert-banner.js";
import "../mc-footer-bar/mc-footer-bar.js";
import "../mc-glyph/mc-glyph.js";
import "../mc-menu-grid/mc-menu-grid.js";
import "../mc-news-bar/mc-news-bar.js";
import "../mc-promo-panel/mc-promo-panel.js";
import "../mc-rank-bar/mc-rank-bar.js";
import { McTitlePanelStyles } from "./mc-title-panel.styles.js";
import type { TitlePanelModel } from "./mc-title-panel.types.js";

const px = (rect: SheetRect): string =>
  `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;

/** The components that can hold a focus stop's element, searched in turn by `elementOf`. */
const HOLDERS = ["mc-menu-grid", "mc-promo-panel", "mc-alert-banner", "mc-footer-bar"] as const;

/**
 * # Title panel
 * The Title screen's panel over the canvas: the menu, the banners, the rank plate, the promo panel, the footer and the
 * glyphs that hang on the focused control, composed from `mc-menu-grid`, `mc-alert-banner`, `mc-news-bar`,
 * `mc-rank-bar`, `mc-promo-panel` and `mc-footer-bar`. It places each at the rect the client's layout gives it, so the
 * geometry is the Phaser screen's, and owns no state: the scene hands it a `TitlePanelModel` and listens.
 *
 * @element mc-title-panel
 * @attr ground - The ground the menu sits on, ink or paper (reflected).
 * @fires mc-activate - `detail.key`: a button, a link, the rank plate (`rank-badge`) or the news bar (`release-notice`).
 */
export class McTitlePanel extends LitElement {
  static override styles = [ThemeStyles, McTitlePanelStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    ground: { type: String, reflect: true },
  };

  declare model: TitlePanelModel | null;
  declare ground: "ink" | "paper";

  constructor() {
    super();
    this.model = null;
    this.ground = "paper";
  }

  override willUpdate(): void {
    this.ground = this.model?.ground ?? "paper";
  }

  /** The scrolling element: paging, the stick and keeping a focused control in view. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".viewport");
  }

  /** The element drawn for a focus stop's key (a button, a link, the rank plate, the news bar), or null. */
  elementOf(key: string): HTMLElement | null {
    if (key === "rank-badge") return this.renderRoot.querySelector("mc-rank-bar");
    if (key === "release-notice") return this.renderRoot.querySelector("mc-news-bar");
    for (const tag of HOLDERS) {
      for (const holder of this.renderRoot.querySelectorAll<
        HTMLElement & { elementOf(key: string): HTMLElement | null }
      >(tag)) {
        const found = holder.elementOf(key);
        if (found) return found;
      }
    }
    return null;
  }

  #activate(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const { scroll } = m;
    // Not scrolling, the viewport is the whole panel; the screen's coordinates then need no shift.
    const view: SheetRect = scroll ?? { x: 0, y: 0, width: 0, height: 0 };
    const full = !scroll;
    const promoIn = m.promo?.scrolls ?? false;
    return html`
      <div
        class=${full ? "viewport" : "viewport scrolls"}
        data-key="menu-scroll"
        style=${full ? "left:0;top:0;width:100%;height:100%" : px(view)}
      >
        <div class="sizer" style=${full ? "height:100%" : `height:${m.scrollHeight}px`}>
          <div class="shift" style=${`left:${-view.x}px;top:${-view.y}px;width:100%;height:100%`}>
            <mc-menu-grid .items=${m.menu}></mc-menu-grid>
            ${
              m.promo && promoIn
                ? html`<mc-promo-panel class="part" style=${px(m.promo.rect)} .model=${m.promo.model}></mc-promo-panel>`
                : nothing
            }
            ${m.status ? html`<div class="part status" style=${px(m.status.rect)}>${m.status.text}</div>` : nothing}
            <mc-footer-bar
              class="part"
              style=${px(m.footer.rect)}
              ground=${m.ground}
              .model=${m.footer.model}
            ></mc-footer-bar>
          </div>
        </div>
      </div>
      ${
        m.promo && !promoIn
          ? html`<mc-promo-panel class="part" style=${px(m.promo.rect)} .model=${m.promo.model}></mc-promo-panel>`
          : nothing
      }
      ${
        m.banner
          ? html`<mc-alert-banner class="part" style=${px(m.banner.rect)} .model=${m.banner.model}></mc-alert-banner>`
          : nothing
      }
      <mc-rank-bar
        class="part"
        data-key="rank-badge"
        style=${px(m.rank.rect)}
        .model=${m.rank.model}
        @mc-press=${() => this.#activate("rank-badge")}
      ></mc-rank-bar>
      ${
        m.news
          ? html`<mc-news-bar
              class="part"
              data-key="release-notice"
              style=${px(m.news.rect)}
              .model=${m.news.model}
              @mc-press=${() => this.#activate("release-notice")}
            ></mc-news-bar>`
          : nothing
      }
      ${m.glyphs.map(
        (glyph) =>
          html`<mc-glyph
            data-key=${glyph.key ?? nothing}
            style=${`left:${glyph.x}px;top:${glyph.y - glyph.height / 2}px`}
            .specs=${glyph.specs}
            .height=${glyph.height}
            .ground=${glyph.ground}
            .openness=${glyph.openness}
            ?still=${glyph.still ?? false}
          ></mc-glyph>`,
      )}
      ${m.problem ? html`<div class="problem">${m.problem}</div>` : nothing}
    `;
  }
}
