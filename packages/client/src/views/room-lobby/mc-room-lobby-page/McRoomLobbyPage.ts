import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import "../../../components/room-lobby/mc-lobby-footer/mc-lobby-footer.js";
import "../../../components/room-lobby/mc-lobby-frame/mc-lobby-frame.js";
import "../../../components/room-lobby/mc-lobby-header/mc-lobby-header.js";
import "../../../components/room-lobby/mc-lobby-tabs/mc-lobby-tabs.js";
import { deepQuery } from "../../../components/room-lobby/room-lobby.deep.js";
import type { LobbyPageModel, LobbySeatsPanelModel } from "../../../components/room-lobby/room-lobby.types.js";
import { McRoomLobbyPageStyles } from "./mc-room-lobby-page.styles.js";

/**
 * # Room lobby
 * The page: it only composes the sections and holds no state. Header (the top bar and the code strip), then, by `model.mode`,
 * a CSS grid of the panels: **tabs** (a phone: the tab strip and the one chosen panel), **stack** (seats across the top, tabs,
 * then settings or chat), **wide** (seats left, settings over chat right), **float** (seats left, settings right, chat a
 * floating panel above a Chat pill) and **triple** (seats, settings, chat side by side); the Start footer last. Which panels
 * show is the model's: `active` picks the one a tab layout shows, `chat` and `pill` are null where there is none.
 *
 * @element mc-room-lobby-page
 * @prop model - What the page shows (`LobbyPageModel`).
 * @attr mode - Mirrors `model.mode` for the stylesheet.
 * @prop covered - How many px of the bottom the soft keyboard covers; the page ends above it.
 * @fires mc-room-lobby - every section's event, as it bubbles.
 */
export class McRoomLobbyPage extends LitElement {
  static override styles = [ThemeStyles, McRoomLobbyPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    mode: { type: String, reflect: true },
    compact: { type: Boolean, reflect: true },
    covered: { type: Number },
  };

  declare model: LobbyPageModel | null;
  declare mode: string;
  declare compact: boolean;
  declare covered: number;

  constructor() {
    super();
    this.model = null;
    this.mode = "tabs";
    this.compact = false;
    this.covered = 0;
  }

  /** The `list:<key>` scroll region of a panel (through the sections' shadow roots), or null while it is not drawn. */
  scroller(key: "seats" | "settings" | "chat"): HTMLElement | null {
    return deepQuery(this.renderRoot, `[data-key="list:${key}"]`);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("model") && this.model) {
      this.mode = this.model.mode;
      this.compact = this.model.compact;
    }
    this.style.setProperty("--lobby-covered", `${this.covered}px`);
  }

  #seats(panel: LobbySeatsPanelModel) {
    switch (panel.kind) {
      case "seats":
        return html`<mc-lobby-seats .model=${panel}></mc-lobby-seats>`;
      case "epic":
        return html`<mc-lobby-epic .model=${panel}></mc-lobby-epic>`;
      case "competitive":
        return html`<mc-lobby-competitive .model=${panel}></mc-lobby-competitive>`;
    }
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const tabbed = m.mode === "tabs" || m.mode === "stack";
    // A tab layout shows one panel at a time (the stacked one always shows seats above its tabs).
    const showSeats = m.mode === "stack" || !tabbed || m.active === "seats";
    const showSettings = !tabbed || m.active === "settings" || (m.mode === "stack" && m.active !== "chat");
    const seatsTitle = m.seats.title ?? "";
    return html`
      <mc-lobby-header class="header" ?compact=${m.phone} .model=${m.header}></mc-lobby-header>
      ${m.tabs ? html`<mc-lobby-tabs class="tabs" .model=${m.tabs}></mc-lobby-tabs>` : nothing}
      ${
        showSeats
          ? html`<mc-lobby-frame class="seats" heading=${seatsTitle}>${this.#seats(m.seats)}</mc-lobby-frame>`
          : nothing
      }
      ${
        showSettings
          ? html`<mc-lobby-frame class="settings" heading=${m.settings.title ?? ""}>
              <mc-lobby-settings .model=${m.settings}></mc-lobby-settings>
            </mc-lobby-frame>`
          : nothing
      }
      ${
        m.chat
          ? html`<mc-lobby-frame class="chat" heading=${m.chat.title ?? ""} ?floating=${m.chat.floating}>
              <mc-lobby-chat .model=${m.chat}></mc-lobby-chat>
            </mc-lobby-frame>`
          : nothing
      }
      ${m.pill ? html`<mc-lobby-chat-pill class="pill" .model=${m.pill}></mc-lobby-chat-pill>` : nothing}
      <mc-lobby-footer class="footer" .model=${m.footer}></mc-lobby-footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-room-lobby-page": McRoomLobbyPage;
  }
}
