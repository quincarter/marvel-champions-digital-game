/**
 * The words a choice sheet adds to a card option, where the scan alone can't tell two options apart.
 *
 * Counters (issue #571): two Field Agents in play have the same face, and spending a Uses card's last counter sends it
 * to the discard pile, so which copy is picked matters. Each option on a card in play says what that copy holds, from
 * the same note the board's own chips use.
 *
 * Payment captions (issue #569): a card to exhaust says what exhausting it adds, and a hand card spent with its own
 * ability says what that way takes. Every number is the engine's (`paymentOptionsPool`).
 */
import {
  cardsInPlay,
  paymentOptionsPool,
  type ChoiceRef,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PendingChoice,
} from "@mc/engine";
import { counterNote, countersOf } from "./board-model.js";
import { playedCardOf } from "./payment-sheet.js";
import { exhaustTileOptionsOf, isSpendChoice, spendOptionNote } from "./spend-choice.js";

/** Prompts whose tiles already speak for themselves: one point of a division, one keyword's turn. */
const WORDED_PROMPTS: ReadonlySet<string> = new Set(["divide", "assignIndirectDamage", "orderKeywords"]);

const refInstanceId = (ref: ChoiceRef): InstanceId | null =>
  ref.kind === "card" || ref.kind === "ability" ? ref.instanceId : null;

/** What each option's card in play holds, by option id; an option with no such card, or no counters, has no entry. */
export function optionCounterNotesOf(state: GameState, choice: PendingChoice): ReadonlyMap<string, string> {
  const notes = new Map<string, string>();
  if (WORDED_PROMPTS.has(choice.prompt.kind)) return notes;
  const inPlay = new Set(cardsInPlay(state));
  for (const option of choice.options) {
    const id = refInstanceId(option.ref);
    const note = id && inPlay.has(id) ? counterNote(countersOf(state, id)) : null;
    if (note) notes.set(option.optionId, note);
  }
  return notes;
}

/** A note as a card tile fits it, a phone tile being 60 px wide: "2 backup counters" reads "2 backup". */
export const tileCounterNote = (note: string): string => note.replace(/ counters?\b/g, "");

/** "+1 mental", "+2 energy, +1 wild". */
function gainWords(gain: Readonly<Record<string, number>>): string {
  return Object.entries(gain)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `+${count} ${type}`)
    .join(", ");
}

/** The card a payment is being made for: the prompt's own, or the card an effect is playing. */
const payingForOf = (state: GameState, choice: PendingChoice): InstanceId | null =>
  choice.prompt.kind === "payForCard" || choice.prompt.kind === "payForAbility"
    ? choice.prompt.instanceId
    : playedCardOf(state, choice);

/**
 * The caption on a payment's tiles, by the shown option's id (`shown` is `shownSpendChoice` of `choice`). Empty for any
 * other choice.
 */
export function spendCaptionsOf(
  state: GameState,
  choice: PendingChoice,
  shown: PendingChoice,
  deps: EngineDeps,
): ReadonlyMap<string, string> {
  const captions = new Map<string, string>();
  if (!isSpendChoice(choice)) return captions;
  const pool = (optionId: string) =>
    paymentOptionsPool(state, deps, choice.playerId, [optionId], payingForOf(state, choice));
  for (const option of shown.options) {
    const tile = exhaustTileOptionsOf(choice, option.optionId);
    if (tile) {
      const alone = pool(tile.alone);
      const plain = pool(tile.plain);
      const gain = alone
        ? Object.fromEntries(
            Object.entries(alone).map(([type, count]) => [type, count - (plain?.[type as keyof typeof plain] ?? 0)]),
          )
        : {};
      captions.set(option.optionId, ["Exhaust", gainWords(gain)].filter(Boolean).join(" "));
      continue;
    }
    const note = option.ref.kind === "ability" ? spendOptionNote(option.label) : null;
    if (note) captions.set(option.optionId, note);
  }
  return captions;
}
