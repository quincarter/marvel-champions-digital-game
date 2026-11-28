import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import "../mc-lobby-button/mc-lobby-button.js";
import { LOBBY_EVENT, lobbyEvent, type LobbyEvent, type LobbyHeaderModel } from "../room-lobby.types.js";
import { McLobbyHeaderStyles } from "./mc-lobby-header.styles.js";

/**
 * # Lobby header
 * The shared top bar (Leave, the title, the player's role) and, under it, the ink code strip: the room code, Copy link, the
 * host's Live now toggle (when the strip has room) and the connection line. Stops: `back`, `copy`, `listed`.
 *
 * @element mc-lobby-header
 * @prop model - What it shows (`LobbyHeaderModel`).
 * @attr compact - A phone's smaller bar and code.
 * @fires mc-room-lobby - `leave`, `copy-link`, `setting` (Live now).
 */
export class McLobbyHeader extends LitElement {
  static override styles = [ThemeStyles, McLobbyHeaderStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    compact: { type: Boolean, reflect: true },
  };

  declare model: LobbyHeaderModel | null;
  declare compact: boolean;

  constructor() {
    super();
    this.model = null;
    this.compact = false;
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    this.toggleAttribute("hidden", m.hidden);
    return html`<mc-top-bar
        italic
        .heading=${m.title}
        .right=${m.role}
        .backLabel=${m.backLabel}
        .backName=${m.backName}
        .backGlyph=${hintGlyphOf(m.backGlyph ?? undefined)}
        ?compact=${this.compact}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.dispatchEvent(lobbyEvent({ type: "leave" }));
        }}
      ></mc-top-bar>
      <div class="strip">
        <span class="eyebrow">${m.eyebrow}</span>
        <span class="code" data-key="room-code">${m.code}</span>
        ${m.listed ? html`<mc-lobby-button class="listed" .model=${m.listed}></mc-lobby-button>` : nothing}
        <mc-lobby-button class="copy" .model=${m.copy}></mc-lobby-button>
        ${m.connection ? html`<span class="connection">${m.connection}</span>` : nothing}
      </div>`;
  }
}
