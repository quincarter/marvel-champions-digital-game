import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { McArticleBlock, McArticleModel } from "./mc-article.types.js";
import { McArticleStyles } from "./mc-article.styles.js";

/**
 * # Article
 * Reading text that scrolls natively: a title with its red rule, then headings, paragraphs, bullets, quotes and page
 * pictures that wrap and grow as the browser lays them out (the Phaser reader measured every block by hand). The
 * element is the scroller (`scrollTop` and `scrollBy` work on `scroller`), with the lists ink scrollbar.
 *
 * @element mc-article
 * @prop model - The title and blocks (`McArticleModel`).
 * @attr picture-max - A page picture max height in px (so a page fits the reading area whole).
 * @attr pad - The left and right padding in px (16; 28 on a wide screen).
 */
export class McArticle extends LitElement {
  static override styles = [ThemeStyles, McArticleStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    pictureMax: { type: Number, attribute: "picture-max" },
    pad: { type: Number },
  };

  declare model: McArticleModel | null;
  declare pictureMax: number;
  declare pad: number;

  constructor() {
    super();
    this.model = null;
    this.pictureMax = 480;
    this.pad = 16;
  }

  /** The scrolling element (`scrollTop`, `scrollBy`, `scrollTo`). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  #block(block: McArticleBlock) {
    switch (block.kind) {
      case "heading":
        return html`<h3 class="block">${block.text}</h3>`;
      case "paragraph":
        return html`<p class="block">${block.text}</p>`;
      case "bullet":
        return html`<p
          class=${block.depth > 0 ? "block bullet deep" : "block bullet"}
          style=${`--depth:${block.depth}`}
        >
          ${block.text}
        </p>`;
      case "quote":
        return html`<p class="block quote">${block.text}</p>`;
      case "picture":
        return block.src
          ? html`<p class="block picture"><img src=${block.src} alt="" loading="lazy" decoding="async" /></p>`
          : html`<p class="block">${block.fallback}</p>`;
    }
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    this.style.setProperty("--article-pad", `${this.pad}px`);
    this.style.setProperty("--picture-max", `${this.pictureMax}px`);
    return html`<div class="scroller" tabindex="-1">
      <h2 class="title">${model.title}</h2>
      <div class="rule"></div>
      ${model.blocks.map((block) => this.#block(block))}
    </div>`;
  }
}
