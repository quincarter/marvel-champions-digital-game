import type { TrophyState } from "../../../view/trophy-room-model.js";

export interface McTrophyStateProps {
  readonly state: TrophyState;
  /** "EARNED", "LOCKED" or "SOON", already translated. */
  readonly label: string;
}
