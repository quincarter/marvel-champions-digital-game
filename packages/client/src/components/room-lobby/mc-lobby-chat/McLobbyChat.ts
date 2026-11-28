import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../../room-chat/mc-chat-compose/mc-chat-compose.js";
import "../../room-chat/mc-chat-lines/mc-chat-lines.js";
import type { McChatCompose } from "../../room-chat/mc-chat-compose/McChatCompose.js";
import type { McChatLines } from "../../room-chat/mc-chat-lines/McChatLines.js";
import "../mc-lobby-button/mc-lobby-button.js";
import { LOBBY_STOP } from "../room-lobby.stops.js";
import { LOBBY_EVENT, type LobbyEvent } from "../room-lobby.types.js";
import { McLobbyChatStyles } from "./mc-lobby-chat.styles.js";
import type { LobbyChatModel } from "./mc-lobby-chat.types.js";

/**
 * # Lobby chat
 * The room's Chat panel: the lines in a native scroll column (`mc-chat-lines`, `list:chat`) over the compose row
 * (`mc-chat-compose`: a real text field and Send). The floating panel (`floating`) is opaque with a heavier border and a drop
 * shadow, and carries Close; Pop out shows only where the model hands one over (the floating panel and the ultrawide column).
 * With chat turned off only the `off` words show; while the chat is in its own window only `poppedText` and Bring back do.
 * The field is one element for the panel's life, so a line arriving or the keyboard resizing the page keeps its caret.
 *
 * Window buttons raise `mc-room-lobby` (`chat`); Send and Enter raise `mc-room-chat`; the draft travels in the field's own
 * `mc-input`, which the scene keeps and hands back as `compose.value`.
 *
 * @element mc-lobby-chat
 * @prop model - The panel (`LobbyChatModel`).
 * @fires mc-room-lobby - `LobbyEvent`.
 * @fires mc-room-chat - `RoomChatEvent`.
 */
export class McLobbyChat extends LitElement {
  static override styles = [ThemeStyles, McLobbyChatStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    floating: { type: Boolean, reflect: true },
  };

  declare model: LobbyChatModel | null;
  /** Mirrors `model.floating` on the host, for the frame. */
  declare floating: boolean;

  constructor() {
    super();
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
    this.model = null;
    this.floating = false;
  }

  /** The compose row, for the scene's `restoreValue`, focus and blur (its `field`). */
  get compose(): McChatCompose | null {
    return this.renderRoot.querySelector<McChatCompose>("mc-chat-compose");
  }

  /** The lines' scrolling column (`list:chat`): the pad's stick scrolls it and the scene keeps its position. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McChatLines>("mc-chat-lines")?.scroller ?? null;
  }

  protected override willUpdate(): void {
    this.floating = this.model?.floating === true;
  }

  #body(m: LobbyChatModel) {
    if (!m.enabled) return html`<p class="words">${m.off}</p>`;
    if (m.popped) {
      return html`<div class="popped">
        <p class="words">${m.poppedText}</p>
        <mc-lobby-button .model=${m.bringBack}></mc-lobby-button>
      </div>`;
    }
    return html`<mc-chat-lines class="lines" .model=${m.lines} list-key=${LOBBY_STOP.list("chat")}></mc-chat-lines>
      <mc-chat-compose
        class="compose"
        .value=${m.compose.value}
        .placeholder=${m.compose.placeholder}
        .sendLabel=${m.compose.sendLabel}
        ?disabled=${m.compose.disabled}
        field-stop=${LOBBY_STOP.chatField}
        send-stop=${LOBBY_STOP.chatSend}
      ></mc-chat-compose>`;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const windowButtons = m.enabled && !m.popped ? [m.popout, m.close] : [m.close];
    const buttons = windowButtons.filter((button) => button !== null);
    return html`${
      m.title || buttons.length > 0
        ? html`<header class="head">
            <h2 class="title">${m.title ?? ""}</h2>
            ${buttons.map((button) => html`<mc-lobby-button class="window" .model=${button}></mc-lobby-button>`)}
          </header>`
        : nothing
    }
    ${m.enabled && !m.popped && m.popBlocked ? html`<p class="blocked">${m.popBlocked}</p>` : nothing} ${this.#body(m)}`;
  }
}
