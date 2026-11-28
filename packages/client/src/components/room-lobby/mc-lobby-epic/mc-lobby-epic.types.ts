import type { LobbyEpicModel } from "../room-lobby.types.js";

export type { LobbyEpicModel };

/** The Epic panel's properties. */
export interface McLobbyEpicProps {
  model: LobbyEpicModel | null;
}
