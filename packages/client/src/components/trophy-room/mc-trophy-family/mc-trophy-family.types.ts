import type { TrophyRow } from "../../../view/trophy-room-model.js";

/** A family's heading: the section rows of the Trophy Room's list. */
export type TrophyFamilyModel = Extract<TrophyRow, { readonly kind: "section" }>;

export interface McTrophyFamilyProps {
  readonly model: TrophyFamilyModel | null;
}
