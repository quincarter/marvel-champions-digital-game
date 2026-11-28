import type { TrophyRow } from "../../../view/trophy-room-model.js";

/** One achievement's card: the achievement rows of the Trophy Room's list. */
export type TrophyTileModel = Extract<TrophyRow, { readonly kind: "achievement" }>;

export interface McTrophyTileProps {
  readonly model: TrophyTileModel | null;
}
