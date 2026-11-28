import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchField } from "@mc/ui";
import "../../../components/reader/mc-reader-pdfs/mc-reader-pdfs.js";
import "../../../components/reader/mc-reader-contents/mc-reader-contents.js";
import "../../../components/reader/mc-reader-text/mc-reader-text.js";
import "../../../components/reader/mc-reader-nav/mc-reader-nav.js";
import type { McReaderContents } from "../../../components/reader/mc-reader-contents/McReaderContents.js";
import type { McReaderText } from "../../../components/reader/mc-reader-text/McReaderText.js";
import { readerEvent } from "../../../components/reader/shared/reader-events.types.js";
import { McReaderPageStyles } from "./mc-reader-page.styles.js";
import type { ReaderPageModel } from "./mc-reader-page.types.js";

/**
 * # Reader (page)
 * The whole Extras reader as one element that only composes: the ink bar, then the shared `mc-reader` frame holding the
 * contents (`mc-reader-contents`) beside the open section (`mc-reader-text`) with its PREV / NEXT foot (`mc-reader-nav`).
 * A phone shows one pane at a time. The scene mounts it in a `DomRegion`, sets `model` and listens for `mc-reader`.
 *
 * @element mc-reader-page
 * @prop model - `ReaderPageModel`.
 * @fires mc-reader - `ReaderEventDetail`, from any section.
 */
export class McReaderPage extends LitElement {
  static override styles = [ThemeStyles, McReaderPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: ReaderPageModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  protected override willUpdate(): void {
    this.phone = this.model?.phone ?? false;
  }

  get #contents(): McReaderContents | null {
    return this.renderRoot.querySelector("mc-reader-contents");
  }

  get #text(): McReaderText | null {
    return this.renderRoot.querySelector("mc-reader-text");
  }

  /** The contents search field, for its caret (the scene's Escape and pad rules). */
  get searchField(): McSearchField | null {
    return this.#contents?.searchField ?? null;
  }

  /** The open section's scrolling element: the stick and paging move it, and a new section starts from its top. */
  get textScroller(): HTMLElement | null {
    return this.#text?.scroller ?? null;
  }

  /** The contents list's scrolling element. */
  get contentsScroller(): HTMLElement | null {
    return this.#contents?.scroller ?? null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const ready = m.status === "ready";
    const showToc = ready && (m.wide || m.pane === "toc");
    const showText = ready && (m.wide || m.pane === "text");
    return html`<mc-reader ?wide=${m.wide} pane=${showToc ? "side" : "main"} ?no-side=${!ready}>
      <mc-top-bar
        slot="bar"
        .heading=${m.bar.title}
        .right=${m.bar.right}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${m.bar.backGlyph}
        ?compact=${m.phone}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.dispatchEvent(readerEvent({ type: "back" }));
        }}
      ></mc-top-bar>
      ${ready ? nothing : html`<mc-empty-state slot="main" message=${m.message} size="15"></mc-empty-state>`}
      ${
        showToc
          ? html`<mc-reader-contents
              slot="side"
              .query=${m.contents.query}
              .padKeyboard=${m.contents.padKeyboard}
              .hits=${m.contents.hits}
              .current=${m.contents.current}
              .pdfs=${m.contents.pdfs}
            ></mc-reader-contents>`
          : nothing
      }
      ${
        showText
          ? html`<mc-reader-text
                slot="main"
                ?wide=${m.wide}
                .article=${m.text.article}
                .pictureMax=${m.text.pictureMax}
                .pdfs=${m.text.pdfs}
              ></mc-reader-text>
              <mc-reader-nav
                slot="foot"
                ?wide=${m.wide}
                ?at-start=${m.nav.atStart}
                ?at-end=${m.nav.atEnd}
              ></mc-reader-nav>`
          : nothing
      }
    </mc-reader>`;
  }
}

if (!customElements.get("mc-reader-page")) {
  customElements.define("mc-reader-page", McReaderPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-reader-page": McReaderPage;
  }
}
