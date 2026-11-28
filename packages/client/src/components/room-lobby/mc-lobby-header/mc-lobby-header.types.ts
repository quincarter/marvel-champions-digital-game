import type { LobbyHeaderModel } from "../room-lobby.types.js";

export type { LobbyHeaderModel };

/** The header's properties. */
export interface McLobbyHeaderProps {
  model: LobbyHeaderModel | null;
  /** A phone's smaller bar and code. */
  compact: boolean;
}
