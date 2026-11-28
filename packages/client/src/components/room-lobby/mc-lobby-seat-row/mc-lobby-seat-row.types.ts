import type { LobbySeatDeckModel, LobbySeatRowModel } from "../room-lobby.types.js";

export type { LobbySeatDeckModel, LobbySeatRowModel };

/** The seat row's properties. */
export interface McLobbySeatRowProps {
  model: LobbySeatRowModel | null;
}
