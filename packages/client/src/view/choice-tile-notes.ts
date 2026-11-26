/**
 * The words a choice sheet adds to a card option, where the scan alone can't tell two options apart.
 *
 * Counters (issue #571): two Field Agents in play have the same face, and spending a Uses card's last counter sends it
 * to the discard pile, so which copy is picked matters. Each option on a card in play says what that copy holds, from
 * the same note the board's own chips use.
 *
 * Payment captions (issue #569): a card to exhaust says what exhausting it adds, and a hand card spent with its own
 * ability says what that way takes. Every number is the engine's (`paymentOptionsPool`).
 *
 * Engaged seats (issue #1001): two facedown Drones are both a card back, so in a game of more than one seat each
 * minion option says who it is engaged with, "vs Iron Man", the way its tile on the board does.
 */
import {
  cardsInPlay,
  isMinion,
  paymentOptionsPool,
  type ChoiceRef,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PendingChoice,
} from "@mc/engine";
import { counterNote, countersOf, engagedNameOf } from "./board-model.js";
import { engagedChipWords } from "./engaged-chips.js";
import { playedCardOf } from "./payment-sheet.js";
import { exhaustTileOptionsOf, isSpendChoice, spendOptionNote } from "./spend-choice.js";

/**
 * Prompts whose tiles already speak for themselves: one point of a division (its band names the card, and who a
 * minion is engaged with: `view/divide-sheet.ts`), one keyword's turn.
 */
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

/**
 * Who each minion option is engaged with, by option id: the seat's name as the board's chip gives it ("Iron Man", or
 * "Iron Man 2" when two seats play him). Empty in a one-seat game, where every minion is engaged with the one hero,
 * and for a minion engaged with nobody (held, captive). `engagedNoteForms` words it for a tile or a row.
 */
export function optionEngagedNamesOf(state: GameState, choice: PendingChoice): ReadonlyMap<string, string> {
  const notes = new Map<string, string>();
  if (WORDED_PROMPTS.has(choice.prompt.kind) || state.players.length < 2) return notes;
  const inPlay = new Set(cardsInPlay(state));
  for (const option of choice.options) {
    const id = refInstanceId(option.ref);
    if (!id || !inPlay.has(id)) continue;
    const name = minionEngagedName(state, id);
    if (name) notes.set(option.optionId, name);
  }
  return notes;
}

/**
 * "vs Spider-Man (Peter Parker)", "vs Spider-Man" and the board chip's "vs S.-Man", then the name in brackets on its
 * own, "vs Peter Parker" and "vs P. Parker": the part that tells two Spider-Men apart when their hero name can't.
 */
function noteForms(name: string): readonly string[] {
  // The alter ego's name goes first, before any seat number ("Spider-Man (Peter Parker) 2" is "Spider-Man 2").
  const base = name.replace(/\s*\([^)]*\)/, "").trim() || name;
  const forms = [`vs ${name}`, `vs ${base}`, engagedChipWords(base, 0)];
  const bracket = /\(([^)]+)\)(.*)$/.exec(name);
  if (bracket) {
    const aside = `${bracket[1]!.trim()}${bracket[2]!.trimEnd()}`;
    forms.push(`vs ${aside}`, engagedChipWords(aside, 0));
  }
  // Two seats playing the same hero differ only by the seat number at the end, the first thing a narrow tile cuts.
  // The last form puts it first ("#2 vs S.-Man"), so even a cut label keeps it (Codex, PR #1014).
  const seat = /^(.*\S)\s+(\d+)$/.exec(name);
  if (seat) {
    const hero = seat[1]!.replace(/\s*\([^)]*\)/, "").trim() || seat[1]!;
    forms.push(`#${seat[2]} ${engagedChipWords(hero, 0)}`);
  }
  return [...new Set(forms)];
}

/**
 * The seat a minion is engaged with, as the board's chip names it, or null: for a card that is not a minion, a minion
 * engaged with nobody (held, captive), and every minion in a one-seat game, where there is no one else to tell apart
 * (`engagedNameOf`). The one gate the choice sheet's tiles and rows and the divide sheet share (issue #1001).
 */
export function minionEngagedName(state: GameState, instanceId: InstanceId): string | null {
  if (!isMinion(state, instanceId)) return null;
  return engagedNameOf(state, state.instances[instanceId]?.engagedWith ?? null);
}

/**
 * The ways to word an engaged note, longest first: "vs Spider-Man (Peter Parker)", "vs Spider-Man", then the board
 * chip's short form "vs S.-Man". A tile takes the first that fits its width as drawn; a row has room for the first.
 * A shorter form another seat in `names` (every engaged name on the sheet) would also shorten to is left out: Peter
 * Parker's and Miles Morales's Drones never both read "vs Spider-Man" (Codex, PR #1014).
 */
export function engagedNoteForms(name: string | undefined, names: readonly string[] = []): readonly string[] {
  if (!name) return [];
  const others = new Set(names.filter((other) => other !== name).flatMap(noteForms));
  const [whole, ...shorter] = noteForms(name);
  return [whole!, ...shorter.filter((form) => !others.has(form))];
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
      const plain = tile.plain ? pool(tile.plain) : null;
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

/**
 * The warning or caption a card-choice prompt carries with its options (`chooseCards` `note`), or null when it has
 * none. The player reads it before picking, e.g. that a tucked card is out of play (#525 item 11).
 */
export function choiceNoteOf(choice: PendingChoice): string | null {
  if (choice.prompt.kind !== "chooseCards") return null;
  const note = choice.prompt.note?.trim();
  return note ? note : null;
}
