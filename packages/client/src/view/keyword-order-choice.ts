/**
 * The first player's "which keyword resolves first?" (engine prompt `orderKeywords`, RRG 1.8 "Forced", p. 20; answer 34B
 * of docs/phase7-wave10.md section 4.0). Both options name the same revealed minion, so drawn as cards they would be two
 * identical faces. The minion's face is already shown once, as the choice's source card (`choiceSourcePanelOf`), so each
 * option is drawn as a text tile instead: the keyword's name and one line of what it does, taken from the glossary entry
 * the keyword's own card help uses, so the two always agree.
 */
import { glossaryEntry, type GlossaryId } from "@mc/content";
import type { GameState, InstanceId, PendingChoice } from "@mc/engine";
import { cardName } from "./names.js";

export interface KeywordOrderTile {
  readonly optionId: string;
  /** "Quickstrike", "Teamwork": the name the engine gave the option (for `orderLoopKeywords`, the keyword alone). */
  readonly name: string;
  /**
   * `orderLoopKeywords` only: the minion the keyword belongs to, which no source card shows (several minions can be
   * ordered at once). Two minions sharing a name read apart by the order they entered play ("Kree Private, 2nd to
   * enter play"); one minion's two keywords share the line.
   */
  readonly subject?: string;
  /** `orderLoopKeywords` only: that minion, for the tile's hover and press-and-hold read. */
  readonly instanceId?: InstanceId;
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
 * - `orderLoopKeywords` (FFG ruling 38, Drang III): the quickstrikes and teamworks of the minions an "each time" loop
 *   put into play. Each option is labelled "<Keyword>: <minion>", so the keyword's line is read from the label's head,
 *   and a minion with both keywords is not drawn as two identical faces. The tile names the keyword, with the minion
 *   on its own line (`subject`), so a long minion name is never squeezed into the keyword's.
 */
export function keywordOrderTilesOf(
  choice: PendingChoice,
  state?: GameState,
): ReadonlyMap<string, KeywordOrderTile> | null {
  const kind = choice.prompt.kind;
  if (
    kind !== "orderKeywords" &&
    kind !== "orderWhenRevealed" &&
    kind !== "orderSpecials" &&
    kind !== "orderLoopKeywords"
  )
    return null;
  const labels = new Map(choice.options.map((option) => [option.optionId, option.label ?? ""]));
  const keywordOf = (optionId: string): string | null => {
    if (kind === "orderLoopKeywords") return (labels.get(optionId) ?? "").split(":")[0]!.trim().toLowerCase() || null;
    if (kind !== "orderSpecials") return optionId;
    const match = /:(incite|surge)$/.exec(optionId);
    return match ? match[1]! : null;
  };
  const paragraphs = kind === "orderWhenRevealed" && state ? whenRevealedParagraphs(state, choice) : [];
  const subjects = kind === "orderLoopKeywords" ? loopSubjects(choice, state) : null;
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
    const subject = subjects?.get(option.optionId);
    if (subject) {
      const name = option.label.split(":")[0]!.trim();
      tiles.push([option.optionId, { optionId: option.optionId, name, line, ...subject }]);
      continue;
    }
    tiles.push([option.optionId, { optionId: option.optionId, name: option.label, line }]);
  }
  return tiles.length > 0 ? new Map(tiles) : null;
}

const ORDINALS = ["1st", "2nd", "3rd"];
const ordinal = (n: number): string => ORDINALS[n - 1] ?? `${n}th`;

/**
 * Each `orderLoopKeywords` option's minion: its name (the face in play when `state` is given, else the label's tail),
 * and, where two minions in the prompt share it, the order they entered play. The engine lists the options in the
 * order the minions were discarded (`releaseLoopFrames`), and each entered play in its own pass of the loop, so the
 * first minion of a name met in the options is the first of that name to enter play.
 */
function loopSubjects(
  choice: PendingChoice,
  state: GameState | undefined,
): ReadonlyMap<string, { readonly subject: string; readonly instanceId?: InstanceId }> {
  const minions = choice.options.map((option) => {
    const instanceId = option.ref.kind === "card" ? option.ref.instanceId : undefined;
    const tail = option.label.split(":").slice(1).join(":").trim();
    const name = state && instanceId && state.instances[instanceId] ? cardName(state, instanceId) : tail;
    return { optionId: option.optionId, instanceId, name };
  });
  const byName = new Map<string, (InstanceId | undefined)[]>();
  for (const { name, instanceId } of minions) {
    const seen = byName.get(name) ?? [];
    if (!seen.includes(instanceId)) seen.push(instanceId);
    byName.set(name, seen);
  }
  return new Map(
    minions.map(({ optionId, instanceId, name }) => {
      const twins = byName.get(name)!;
      const subject = twins.length > 1 ? `${name}, ${ordinal(twins.indexOf(instanceId) + 1)} to enter play` : name;
      return [optionId, instanceId ? { subject, instanceId } : { subject }];
    }),
  );
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
