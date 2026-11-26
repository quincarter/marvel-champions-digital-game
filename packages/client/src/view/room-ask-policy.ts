/**
 * What a seated guest may ask the host for in a lobby room (#904), pure so the room worker and the screens share it.
 * Undo under the "ask" policy, and under "own", where the host's device takes the guest's own move back at once without
 * asking (`lobbyUndoFor`; Host only and Off hide it, with the reason where Undo would be).
 * A change (Manual adjust) only with cheats on in a Host control room.
 */
import { lobbyUndoFor, type LobbySettings } from "@mc/sync-worker/room-protocol";

export type SeatAskSettings = Pick<LobbySettings, "playMode" | "undo" | "cheats">;

/** The room's undo policy as a guest sees it (off when the room's settings are not known). */
export const seatUndoPolicyOf = (settings: Pick<LobbySettings, "playMode" | "undo"> | null | undefined) =>
  settings ? lobbyUndoFor(settings.playMode, settings.undo) : "off";

/** True when a request of this kind is one the room allows a guest to make (and the host to accept). */
export function askAllowedOf(what: "undo" | "adjust", settings: SeatAskSettings | null | undefined): boolean {
  if (!settings) return false;
  return what === "undo"
    ? seatUndoPolicyOf(settings) === "ask" || seatUndoPolicyOf(settings) === "own"
    : settings.playMode === "host" && settings.cheats === true;
}
