import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../mc-lobby-button/mc-lobby-button.js";
import { LOBBY_EVENT, type LobbyEvent } from "../room-lobby.types.js";
import { McLobbyChatPillStyles } from "./mc-lobby-chat-pill.styles.js";
import { unreadLabel, type LobbyChatPillModel } from "./mc-lobby-chat-pill.types.js";

/**
 * # Lobby Chat pill
 * The closed floating chat: a Chat button at the corner with the unread count in a badge at its right end (digits, "9+"
 * past nine; the count is words, never colour alone). While the chat is in its own window the pill gives way to a small card
 * with `poppedText` and Bring back. A press raises `mc-room-lobby` (`chat` open / bring-back) through the `FeatureRelay`.
 * Stop: `chat-pill` (its button's own stop, from the model).
 *
 * @element mc-lobby-chat-pill
 * @prop model - The pill (`LobbyChatPillModel`).
 * @fires mc-room-lobby - `LobbyEvent`.
 */
export class McLobbyChatPill extends LitElement {
  static override styles = [ThemeStyles, McLobbyChatPillStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbyChatPillModel | null;

  constructor() {
    super();
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    if (m.popped) {
      return html`<div class="card">
        <p class="words">${m.poppedText}</p>
        <mc-lobby-button .model=${m.bringBack}></mc-lobby-button>
      </div>`;
    }
    const unread = m.unread > 0;
    return html`<div class="pill" ?data-unread=${unread}>
      <mc-lobby-button .model=${m.open}></mc-lobby-button>
      ${unread ? html`<span class="badge">${unreadLabel(m.unread)}</span>` : nothing}
    </div>`;
  }
}
