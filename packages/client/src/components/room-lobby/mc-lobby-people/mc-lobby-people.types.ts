import type { LobbyPeopleModel, LobbyPersonModel } from "../room-lobby.types.js";

export type { LobbyPeopleModel, LobbyPersonModel };

/** The people list's properties. */
export interface McLobbyPeopleProps {
  model: LobbyPeopleModel | null;
}
