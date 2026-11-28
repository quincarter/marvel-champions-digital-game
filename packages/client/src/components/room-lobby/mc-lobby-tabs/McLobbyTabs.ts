import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { lobbyEvent, type LobbyPanelId, type LobbyTabsModel } from "../room-lobby.types.js";
import { McLobbyTabsStyles } from "./mc-lobby-tabs.styles.js";

/**
 * # Lobby tabs
 * The strip that chooses People and seats, Settings or Chat on the narrow layouts: an `mc-tab-rail` (a recessed rail of equal
 * cells, the chosen one an ink fill, a count on a Chat tab with news). Stops: `tab:<id>`.
 *
 * @element mc-lobby-tabs
 * @prop model - The cells and the chosen one (`LobbyTabsModel`).
 * @fires mc-room-lobby - `{ type: "tab", tab }`.
 */
export class McLobbyTabs extends LitElement {
  static override styles = [ThemeStyles, McLobbyTabsStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbyTabsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m || m.tabs.length === 0) return nothing;
    return html`<mc-tab-rail
      prefix="tab:"
      .size=${14}
      .tabs=${m.tabs}
      .selected=${m.selected}
      @mc-activate=${(event: CustomEvent<{ id: string }>) => {
        event.stopPropagation();
        this.dispatchEvent(lobbyEvent({ type: "tab", tab: event.detail.id as LobbyPanelId }));
      }}
    ></mc-tab-rail>`;
  }
}
