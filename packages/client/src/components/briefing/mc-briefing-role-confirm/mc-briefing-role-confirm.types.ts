import type { ConfirmBarModel } from "../mc-briefing-confirm-bar/mc-briefing-confirm-bar.types.js";

/** "Colossus will be the Brawler": the step that stands between a tap and the record. */
export interface RoleConfirmModel {
  readonly roleId: string;
  /** Already capitalised. */
  readonly title: string;
  readonly chips: readonly { readonly aspect: string; readonly label: string }[];
  readonly summary: string;
  readonly relation: string;
  readonly notes: readonly string[];
  readonly bar: ConfirmBarModel;
  readonly phone: boolean;
}
