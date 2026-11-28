import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { roomDialogEvent, type RoomGiveModel } from "../room-dialogs.types.js";
import { McRoomGiveDialogStyles } from "./mc-room-give-dialog.styles.js";

/**
 * # Give <hero> to... (dialog)
 * The host's picker for an away or vacated seat: one full-width button per person who could take it, in a body that scrolls
 * natively, and Cancel in the footer, always on screen. Nothing is decided here: a press raises `mc-room-dialog`
 * `{ type: "press", key }` with `give:<participant id>` or `cancel`, and the room refuses what it will not allow.
 *
 * Focus stops: `give:<id>` for each person, `cancel`.
 *
 * @element mc-room-give-dialog
 * @prop model - The dialog (`RoomGiveModel`).
 * @fires mc-room-dialog - `RoomDialogEvent`.
 */
export class McRoomGiveDialog extends LitElement {
  static override styles = [ThemeStyles, McRoomGiveDialogStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: RoomGiveModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The dialog's scrolling body, for the pad's stick and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-dialog")?.scroller ?? null;
  }

  #press = (event: CustomEvent<{ key: string }>): void => {
    event.stopPropagation();
    this.dispatchEvent(roomDialogEvent({ type: "press", key: event.detail.key }));
  };

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-dialog .heading=${m.heading} .width=${420}>
      ${m.empty === null ? nothing : html`<p class="empty">${m.empty}</p>`}
      <div class="people">
        ${repeat(
          m.people,
          (person) => person.id,
          (person) =>
            html`<mc-popup-button
              .button=${person.button}
              .glyph=${m.glyphs[person.button.key] ?? null}
              @mc-activate=${this.#press}
            ></mc-popup-button>`,
        )}
      </div>
      <mc-popup-button
        slot="footer"
        .button=${m.cancel}
        .glyph=${m.glyphs[m.cancel.key] ?? null}
        @mc-activate=${this.#press}
      ></mc-popup-button>
    </mc-dialog>`;
  }
}
