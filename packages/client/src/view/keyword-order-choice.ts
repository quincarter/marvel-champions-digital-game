/**
 * The first player's "which keyword resolves first?" (engine prompt `orderKeywords`, RRG 1.8 "Forced", p. 20; answer 34B
 * of docs/phase7-wave10.md section 4.0). Both options name the same revealed minion, so drawn as cards they would be two
 * identical faces. The minion's face is already shown once, as the choice's source card (`choiceSourcePanelOf`), so each
 * option is drawn as a text tile instead: the keyword's name and one line of what it does, taken from the glossary entry
 * the keyword's own card help uses, so the two always agree.
 */
import { glossaryEntry, type GlossaryId } from "@mc/content";
import type { GameState, PendingChoice } from "@mc/engine";

export interface KeywordOrderTile {
  readonly optionId: string;
  /** "Quickstrike", "Teamwork": the name the engine gave the option. */
  readonly name: string;
  /** The first sentence of the keyword's glossary definition; "" when the glossary has no entry. */
  readonly line: string;
}

/** The first sentence of `text` (up to the first full stop followed by a space or the end). */
export function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/.exec(text.trim());
  return (match ? match[0] : text).trim();
}

/**
 * A tile per option drawn in words rather than as a card face, or null for a choice with none:
 *
 * - `orderKeywords`: each option (quickstrike, teamwork on one minion).
 * - `orderWhenRevealed` (FFG ruling, September 22, 2026): a revealed card's incite, printed When Revealed abilities and
 *   surge, all on the same card. A keyword's line is its glossary sentence; a printed ability's is that ability's own
 *   paragraph of the card's text (the n-th "When Revealed" paragraph for the n-th printed option), when `state` is given.
 * - `orderSpecials`: only its incite and surge options (`<instance>:incite`, `<instance>:surge`), which would otherwise
 *   repeat the face of the card whose printed abilities are offered beside them; those keep their faces.
 */
export function keywordOrderTilesOf(
  choice: PendingChoice,
  state?: GameState,
): ReadonlyMap<string, KeywordOrderTile> | null {
  const kind = choice.prompt.kind;
  if (kind !== "orderKeywords" && kind !== "orderWhenRevealed" && kind !== "orderSpecials") return null;
  const keywordOf = (optionId: string): string | null => {
    if (kind !== "orderSpecials") return optionId;
    const match = /:(incite|surge)$/.exec(optionId);
    return match ? match[1]! : null;
  };
  const paragraphs = kind === "orderWhenRevealed" && state ? whenRevealedParagraphs(state, choice) : [];
  let printedIndex = 0;
  const tiles: [string, KeywordOrderTile][] = [];
  for (const option of choice.options) {
    if (option.ref.kind === "ability") {
      if (kind !== "orderWhenRevealed") continue;
      const line = paragraphs[printedIndex++] ?? "";
      tiles.push([option.optionId, { optionId: option.optionId, name: option.label, line }]);
      continue;
    }
    const keyword = keywordOf(option.optionId);
    if (keyword === null) continue;
    const line = firstSentence(glossaryEntry(keyword as GlossaryId)?.definition ?? "");
    tiles.push([option.optionId, { optionId: option.optionId, name: option.label, line }]);
  }
  return tiles.length > 0 ? new Map(tiles) : null;
}

/** The "When Revealed" paragraphs of the text of the card an `orderWhenRevealed` choice is about, in printed order. */
function whenRevealedParagraphs(state: GameState, choice: PendingChoice): readonly string[] {
  if (choice.prompt.kind !== "orderWhenRevealed") return [];
  const cardId = state.instances[choice.prompt.instanceId]?.cardId;
  const card = cardId
    ? (state.cardPool[cardId] as { readonly text?: { readonly current?: string } } | undefined)
    : undefined;
  return (card?.text?.current ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("When Revealed"));
}
