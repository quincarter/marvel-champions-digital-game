import type { LobbyPlanItemModel, LobbyPlanModel } from "../room-lobby.types.js";

export type { LobbyPlanItemModel, LobbyPlanModel };

/** The table plan's properties. */
export interface McLobbyPlanProps {
  model: LobbyPlanModel | null;
}
