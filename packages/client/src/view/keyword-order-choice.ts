/**
 * The first player's "which keyword resolves first?" (engine prompt `orderKeywords`, RRG 1.8 "Forced", p. 20; answer 34B
 * of docs/phase7-wave10.md section 4.0). Both options name the same revealed minion, so drawn as cards they would be two
 * identical faces. The minion's face is already shown once, as the choice's source card (`choiceSourcePanelOf`), so each
 * option is drawn as a text tile instead: the keyword's name and one line of what it does, taken from the glossary entry
 * the keyword's own card help uses, so the two always agree.
 */
import { glossaryEntry, type GlossaryId } from "@mc/content";
import type { PendingChoice } from "@mc/engine";

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

/** A tile per option of an `orderKeywords` choice, or null for any other choice. */
export function keywordOrderTilesOf(choice: PendingChoice): ReadonlyMap<string, KeywordOrderTile> | null {
  if (choice.prompt.kind !== "orderKeywords") return null;
  return new Map(
    choice.options.map((option): [string, KeywordOrderTile] => [
      option.optionId,
      {
        optionId: option.optionId,
        name: option.label,
        line: firstSentence(glossaryEntry(option.optionId as GlossaryId)?.definition ?? ""),
      },
    ]),
  );
}
