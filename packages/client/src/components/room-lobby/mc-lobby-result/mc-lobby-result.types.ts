import type { LobbyStartResultModel } from "../room-lobby.types.js";

export type { LobbyStartResultModel };

/** The start result's properties. */
export interface McLobbyResultProps {
  model: LobbyStartResultModel | null;
}
