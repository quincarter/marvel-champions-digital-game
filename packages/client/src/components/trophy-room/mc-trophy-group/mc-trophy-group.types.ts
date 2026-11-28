import type { TrophyRow } from "../../../view/trophy-room-model.js";

/** A pack's heading inside Mods: the group rows of the Trophy Room's list. A label only. */
export type TrophyGroupModel = Extract<TrophyRow, { readonly kind: "group" }>;

export interface McTrophyGroupProps {
  readonly model: TrophyGroupModel | null;
  /** "From Silly pack": the heading's words, already translated. */
  readonly label: string;
}
