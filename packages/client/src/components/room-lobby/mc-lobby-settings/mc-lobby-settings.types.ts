import type { LobbyEvent, LobbySettingsGroup, LobbySettingsItem, LobbySettingsModel } from "../room-lobby.types.js";

export type { LobbyEvent, LobbySettingsGroup, LobbySettingsItem, LobbySettingsModel };

/** The settings panel's properties. */
export interface McLobbySettingsProps {
  model: LobbySettingsModel | null;
}

/** Whether a row is drawn at all: a choice nobody can press shows only when it is the chosen one. */
export function showsItem(item: LobbySettingsItem): boolean {
  return item.kind !== "choice" || item.pressable || item.selected;
}
