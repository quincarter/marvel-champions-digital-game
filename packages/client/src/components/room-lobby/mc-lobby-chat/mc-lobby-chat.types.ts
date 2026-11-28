import type { ChatLinesModel, LobbyChatModel, LobbyEvent } from "../room-lobby.types.js";

export type { ChatLinesModel, LobbyChatModel, LobbyEvent };

/** The chat panel's properties. */
export interface McLobbyChatProps {
  model: LobbyChatModel | null;
  /** Set from `model.floating`. */
  floating: boolean;
}
