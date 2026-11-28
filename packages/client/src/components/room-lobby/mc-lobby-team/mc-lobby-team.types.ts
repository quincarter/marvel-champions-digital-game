import type { LobbyTeamModel } from "../room-lobby.types.js";

export type { LobbyTeamModel };

/** The team card's properties. */
export interface McLobbyTeamProps {
  model: LobbyTeamModel | null;
}
