import type { ActionButtonModel } from "../mc-builder-actions/mc-builder-actions.types.js";

/**
 * The pinned bar under the deck: Save, and on a phone's Deck tab Review beside it (a bar no scroll can hide it from). On the
 * wide rail Review is the deck list's own button, so `review` is null there.
 */
export interface SaveBarModel {
  readonly save: ActionButtonModel;
  readonly review: ActionButtonModel | null;
}
