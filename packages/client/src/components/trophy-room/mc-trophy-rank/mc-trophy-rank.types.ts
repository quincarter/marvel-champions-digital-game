import type { TrophyHeader } from "../../../view/trophy-room-model.js";

export interface McTrophyRankProps {
  /** The rank, lifetime points, the way to the next rank and the earned count (`trophyHeaderOf`). */
  readonly model: TrophyHeader | null;
}
