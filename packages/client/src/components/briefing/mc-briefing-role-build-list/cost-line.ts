import { artLanguageNow } from "../../../art/art-source.js";
import { t } from "../../../i18n/translate.js";
import { aspectStampOf } from "../../../view/aspect-stamp.js";
import type { RoleBuildCardView } from "../../../view/campaign-role-build-model.js";

/** "Cost 2 · Justice": the cost in the player language, then the aspect name. */
export function costLineOf(card: Pick<RoleBuildCardView, "cost" | "aspect">): string {
  const cost = card.cost === null ? t("briefing.call.costX") : t("briefing.call.cost", { cost: card.cost });
  return `${cost} · ${aspectStampOf(card.aspect.aspect, artLanguageNow()).label}`;
}
