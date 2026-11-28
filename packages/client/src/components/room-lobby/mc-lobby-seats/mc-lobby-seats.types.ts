import type { LobbySeatsModel } from "../room-lobby.types.js";

export type { LobbySeatsModel };

/** The standard seats panel's properties. */
export interface McLobbySeatsProps {
  model: LobbySeatsModel | null;
}
