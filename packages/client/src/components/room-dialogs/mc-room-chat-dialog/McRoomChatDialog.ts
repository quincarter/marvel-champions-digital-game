import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../../room-chat/mc-chat-compose/mc-chat-compose.js";
import "../../room-chat/mc-chat-lines/mc-chat-lines.js";
import type { McChatCompose } from "../../room-chat/mc-chat-compose/McChatCompose.js";
import type { McChatLines } from "../../room-chat/mc-chat-lines/McChatLines.js";
import { roomDialogEvent, type RoomChatDialogModel } from "../room-dialogs.types.js";
import { McRoomChatDialogStyles } from "./mc-room-chat-dialog.styles.js";

/**
 * # Room chat (dialog)
 * The in-game chat over the board: the newest lines in a native scroll column, the compose row (a real text field and
 * Send, `mc-chat-compose`) and Close. The field is one element for the dialog's life, so a line arriving or the keyboard
 * resizing the page keeps its caret, selection and IME composition. Close raises `mc-room-dialog`
 * `{ type: "press", key: "close" }`; Send and Enter raise `mc-room-chat`.
 *
 * Focus stops: `field`, `send`, `close`.
 *
 * @element mc-room-chat-dialog
 * @prop model - The dialog (`RoomChatDialogModel`).
 * @fires mc-room-dialog - `RoomDialogEvent`.
 * @fires mc-room-chat - `RoomChatEvent`.
 */
export class McRoomChatDialog extends LitElement {
  static override styles = [ThemeStyles, McRoomChatDialogStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: RoomChatDialogModel | null;

  constructor() {
    super();
    this.model = null;
  }

  get compose(): McChatCompose | null {
    return this.renderRoot.querySelector<McChatCompose>("mc-chat-compose");
  }

  /** The lines' scrolling column, for the pad's stick and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McChatLines>("mc-chat-lines")?.scroller ?? null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-dialog .heading=${m.heading} .width=${520} tall>
      <mc-chat-lines class="lines" .model=${m.lines} list-key="chat-list"></mc-chat-lines>
      <mc-chat-compose
        slot="footer"
        .value=${m.value}
        .placeholder=${m.placeholder}
        .sendLabel=${m.sendLabel}
        field-stop="field"
        send-stop="send"
      ></mc-chat-compose>
      <mc-popup-button
        slot="footer"
        class="close"
        .button=${m.close}
        .glyph=${m.glyphs[m.close.key] ?? null}
        @mc-activate=${(event: CustomEvent<{ key: string }>) => {
          event.stopPropagation();
          this.dispatchEvent(roomDialogEvent({ type: "press", key: event.detail.key }));
        }}
      ></mc-popup-button>
    </mc-dialog>`;
  }
}
