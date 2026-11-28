import type { ShieldBriefing } from "../../../view/campaign-shield-model.js";
import type { ShieldPicture } from "../mc-briefing-shield-pictures/mc-briefing-shield-pictures.types.js";

/** The case file: the briefing the model made (never the sealed envelope) and the pictures of the cards it names. */
export interface ShieldSectionModel {
  readonly shield: ShieldBriefing;
  /** The evidence held, each with its kind word under it. */
  readonly evidence: readonly ShieldPicture[];
  /** The Executive Board members, each with its secrets under it. */
  readonly board: readonly ShieldPicture[];
  readonly phone: boolean;
}
