/**
 * The words for why a deck cannot be seated, in the card language. `DeckOption.blockedReason` is the engine's or the deck
 * list's own English; the known short verdicts are translated here at presentation time. A legality problem's own
 * message (`validateDeck`, free English from the engine) is passed through as it is: localizing those needs structured
 * problem codes from the engine, which is deferred (listed in packages/ui/MIGRATION.md notes, "Engine reasons").
 */
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";
import { t } from "../i18n/translate.js";
import { CHECKING_REASON, NOT_LEGAL_REASON, NOT_READY_REASON } from "./deck-list-model.js";

export function deckReasonText(reason: string | null, lang: CardLanguage = artLanguageNow()): string | null {
  if (reason === null) return null;
  if (reason === NOT_READY_REASON) return t("deckPicker.reason.notReady", undefined, lang);
  if (reason === NOT_LEGAL_REASON) return t("deckPicker.reason.notLegal", undefined, lang);
  if (reason === CHECKING_REASON) return t("room.picker.checking", undefined, lang);
  return reason;
}
