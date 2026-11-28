import { html, nothing, type PropertyDeclarations } from "lit";
import type { McInputDetail } from "@mc/ui";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksAction, DecksImportModel } from "../decks.types.js";
import { McDecksImportBoxStyles } from "./mc-decks-import-box.styles.js";

/**
 * # Decks import / export box
 * A compact parchment box at the foot of the deck list: a heading, two lines of description and one row of small Paste /
 * CDB link / Export buttons. Paste and CDB link are an accordion (one opens its own field and its Import button, and shuts
 * the other); Export acts at once on the selected deck. The fields are real `mc-text-field`s whose text the scene keeps
 * (`pasteText`, `marvelcdbText`: the text taken, never a live draft).
 *
 * Focus stops: `ie-paste-toggle`, `ie-marvelcdb-toggle`, `ie-export`, `paste-field`, `paste-import`, `marvelcdb-field`,
 * `marvelcdb-import`.
 *
 * @element mc-decks-import-box
 * @prop model - The box (`DecksImportModel`).
 * @fires mc-decks - `action` (the toggles, Export, the two Imports) or `input` (`field`, `text`).
 * @fires mc-field-focus - Bubbles from a field: whether the caret is in it.
 */
export class McDecksImportBox extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksImportBoxStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksImportModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** A field, for the scene's text-field escape and its caret. */
  fieldOf(key: "paste-field" | "marvelcdb-field"): (HTMLElement & { blurInput(): void }) | null {
    return this.renderRoot.querySelector(`[data-stop="${key}"]`);
  }

  #plain(action: DecksAction, label: string, selected = false, disabled: string | null = null) {
    return this.button({ action, label, disabled }, { kind: "secondary", selected, size: 11 });
  }

  #field(key: "paste" | "marvelcdb", text: string, placeholder: string, multiline: boolean) {
    return html`<mc-text-field
      class=${multiline ? "paste" : "link"}
      data-key=${`${key}-field`}
      data-stop=${`${key}-field`}
      .value=${text}
      .placeholder=${placeholder}
      ?multiline=${multiline}
      @mc-input=${(event: CustomEvent<McInputDetail>) => {
        event.stopPropagation();
        this.emit({ type: "input", field: key, text: event.detail.value });
      }}
    ></mc-text-field>`;
  }

  override render() {
    const io = this.model;
    if (!io) return nothing;
    const importing = (idle: string): string => (io.busy ? io.importingLabel : idle);
    return html`<section class="box">
      <h3 class="heading">${io.heading}</h3>
      <p class="description">${io.description}</p>
      <div class="buttons">
        ${this.#plain("ie-paste-toggle", io.pasteLabel, io.open === "paste")}
        ${this.#plain("ie-marvelcdb-toggle", io.cdbLabel, io.open === "marvelcdb")}
        ${this.#plain("ie-export", io.exportLabel, false, io.exportDisabled)}
      </div>
      ${
        io.open === "paste"
          ? html`${this.#field("paste", io.pasteText, io.pastePlaceholder, true)}
              <div class="go">
                ${this.button(
                  {
                    action: "paste-import",
                    label: importing(io.importListLabel),
                    disabled: io.busy ? io.importingLabel : null,
                  },
                  { kind: "secondary", size: 11 },
                )}
              </div>`
          : nothing
      }
      ${
        io.open === "marvelcdb"
          ? html`${this.#field("marvelcdb", io.marvelcdbText, io.linkPlaceholder, false)}
              <div class="go">
                ${this.button(
                  {
                    action: "marvelcdb-import",
                    label: importing(io.importCdbLabel),
                    disabled: io.busy ? io.importingLabel : null,
                  },
                  { kind: "secondary", size: 11 },
                )}
              </div>`
          : nothing
      }
    </section>`;
  }
}
