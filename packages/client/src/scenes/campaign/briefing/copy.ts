/**
 * The Briefing's words. Two kinds, kept apart:
 *
 * - **Chrome** (`t` in en.ts / es.ts): the headings, buttons, hints, waiting notes and errors, translated here.
 * - **Story text** (the speaker's line, the handled rows, the deck note, a deck's problem, the hidden-evidence field's
 *   label): authored per box in English, and still English. They all go through `briefingTextIn`, so the campaign
 *   copy translation (`campaign/campaign-copy-es.ts`) fills them from this one place without the layout changing.
 */
import { artLanguageNow } from "../../../art/art-source.js";
import type { CardLanguage } from "../../../art/card-language.js";
import { t, tPlural } from "../../../i18n/translate.js";
import { DECK_NOTE_EXEMPT, DECK_NOTE_REWARD, type HandledRow } from "../../../view/campaign-briefing-model.js";
import type { WaitingPanel } from "../../../view/campaign-modular-call-model.js";
import type { OpenIssueHint, OpenIssueHintInput } from "../../../view/campaign-open-hint.js";

/** The authored story text of the screen in `lang`. English for every language until the campaign copy has a translation. */
export interface BriefingText {
  /** The speech bubble's line. */
  bubble(text: string): string;
  /** A "Handled for you" row. */
  handledRow(row: HandledRow): HandledRow;
  /** The line under the Decks panel. */
  deckNote(text: string): string;
  /** The engine's reason a deck would be refused. */
  deckProblem(text: string): string;
  /** The hidden-evidence field's label on the top bar. */
  hiddenLabel(text: string): string;
}

export function briefingTextIn(_lang: CardLanguage = artLanguageNow()): BriefingText {
  return {
    bubble: (text) => text,
    handledRow: (row) => row,
    deckNote: (text) =>
      text === DECK_NOTE_EXEMPT
        ? t("briefing.deckNote.exempt")
        : text === DECK_NOTE_REWARD
          ? t("briefing.deckNote.reward")
          : text,
    deckProblem: (text) => text,
    hiddenLabel: (text) => text,
  };
}

/** What an unfilled panel says while the issue waits on a call, or is still composing. */
export function waitingNoteIn(panel: WaitingPanel, state: "asking" | "composing", genreSetPick: boolean): string {
  if (state === "composing") return t("briefing.waiting.composing");
  const what = t(genreSetPick ? "briefing.waiting.what.genre" : "briefing.waiting.what.call");
  return t(panel === "handled" ? "briefing.waiting.handled" : "briefing.waiting.decks", { what });
}

/**
 * Why the red Open issue button is greyed while a call is pending or the issue is composing (`view/campaign-open-hint.ts`
 * decides when; these are its words). `call` is the line under the "Your call" heading.
 */
export function openHintIn(input: OpenIssueHintInput): OpenIssueHint | null {
  if (input.deckBlocked || input.starting) return null;
  const number = input.issueNumber;
  if (input.pending) {
    return { bar: t("briefing.hint.answer", { number }), call: t("briefing.hint.answerCall", { number }) };
  }
  if (input.composing) return { bar: t("briefing.hint.composing", { number }), call: null };
  return null;
}

/** The hidden-evidence marker on the bar's right: its label, then what is known of the envelope. */
export function hiddenMarkerIn(
  hidden: { readonly label: string; readonly revealedCards: readonly string[] | null; readonly cardCount: number },
  text: BriefingText,
): string {
  const label = text.hiddenLabel(hidden.label);
  return hidden.revealedCards
    ? `${label} · ${hidden.revealedCards.join(", ")}`
    : tPlural("briefing.hidden.sealed", hidden.cardCount, { label });
}
