/**
 * In-game room chat (issue #881): a compact dialog over the board of a room game, opened from the whose-turn row's Chat
 * control, Pause, or the host's "Message them" prompt (which opens it with "Are you still there?" ready to send). It
 * shows the newest lines that fit, a text field and Send, through `say()` and the room's chat lines. Never drawn over
 * the table: the board has the keyboard and the pad back when it closes.
 *
 * The box is one custom element, `mc-room-chat-dialog` (`components/room-dialogs/`), mounted as an overlay region. Its text
 * field is one element for the dialog's life, so a line arriving or a resize keeps the caret and selection.
 */
import "../components/room-dialogs/mc-room-chat-dialog/mc-room-chat-dialog.js";
import { MAX_CHAT_LINE } from "../components/room-dialogs/mc-room-chat-dialog/mc-room-chat-dialog.types.js";
import type { RoomChatEvent } from "../components/room-chat/room-chat.types.js";
import type { RoomChatDialogModel } from "../components/room-dialogs/room-dialogs.types.js";
import { t } from "../i18n/translate.js";
import { onRoomState, roomState, say, type RoomState } from "../platform/room.js";
import { chatChanged, chatMark, lastChatLines, markChatRead, type ChatMark } from "../view/room-chat-unread.js";
import { SCENES } from "./keys.js";
import { RoomDialogScene } from "./room-dialog/room-dialog-scene.js";

export interface RoomChatData {
  /** Text put in the field to send, when the dialog opens (the "Are you still there?" nudge). */
  readonly draft?: string;
}

/** How many of the newest lines the list keeps. */
const CHAT_LINES_SHOWN = 60;

export class RoomChatOverlay extends RoomDialogScene<"mc-room-chat-dialog"> {
  #value = "";
  #state: RoomState = roomState();
  #off: (() => void) | null = null;
  #drawn: ChatMark | null = null;
  #toEnd = 0;

  constructor() {
    super(SCENES.roomChat);
  }

  init(data: RoomChatData = {}): void {
    this.#value = data.draft ?? "";
    this.#drawn = null;
    this.#toEnd = 0;
  }

  create(): void {
    this.open("mc-room-chat-dialog", {
      press: (key) => {
        if (key === "close") this.#close();
      },
      field: () => this.dialog?.element.compose?.field ?? null,
      primary: "send",
      draw: () => this.#draw(),
    });
    const { element } = this.dialog!;
    element.addEventListener("mc-input", (event) => {
      const { value } = (event as CustomEvent<{ value: string }>).detail;
      // A line past the limit is not taken: the field shows what was accepted.
      if (value.length > MAX_CHAT_LINE) element.compose?.field?.restoreValue(this.#value);
      else this.#value = value;
    });
    element.addEventListener("mc-room-chat", (event) => this.#send((event as CustomEvent<RoomChatEvent>).detail));
    this.#off = onRoomState((state) => {
      const changed = chatChanged(this.#drawn, state.chat);
      this.#state = state;
      if (changed && this.sys.isActive()) this.#draw();
    });
    this.events.once("shutdown", () => {
      this.#off?.();
      this.#off = null;
      markChatRead(roomState().chat);
    });
    this.#draw();
    void element.updateComplete.then(() => element.compose?.field?.focusInput());
  }

  #close(): void {
    markChatRead(this.#state.chat);
    this.close();
  }

  #send(event: RoomChatEvent): void {
    const text = this.#value.trim();
    if (text === "") return;
    say(text);
    // Cleared before the redraw: a second press must not send it again.
    this.#value = "";
    this.#draw();
    // Enter keeps the caret for the next line; Send leaves it as it was.
    if (event.via === "enter") this.dialog?.element.compose?.field?.focusInput();
  }

  #draw(): void {
    const glyphs = this.glyphs;
    if (!glyphs) return;
    glyphs.reset();
    if (chatChanged(this.#drawn, this.#state.chat)) this.#toEnd += 1;
    this.#drawn = chatMark(this.#state.chat);
    const close = glyphs.glyph("close", ["cancel"], "paper", 44);
    const model: RoomChatDialogModel = {
      heading: t("chat.title"),
      lines: {
        lines: lastChatLines(this.#state.chat, CHAT_LINES_SHOWN).map((line, index) => ({
          id: String(index),
          who: line.name ?? "?",
          text: line.text,
          mine: line.mine === true,
        })),
        empty: t("chat.empty"),
        toEnd: this.#toEnd,
      },
      value: this.#value,
      placeholder: t("chat.placeholder"),
      sendLabel: t("chat.send"),
      close: { key: "close", label: t("chat.close"), kind: "secondary" },
      glyphs: close ? { close } : {},
    };
    this.show(model);
    glyphs.settled();
  }
}
