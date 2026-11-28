import type { LobbySeatCountModel } from "../room-lobby.types.js";

export type { LobbySeatCountModel };

/** The seat-count control's properties. */
export interface McLobbySeatCountProps {
  model: LobbySeatCountModel | null;
}
