/**
 * Pairing cards with characters (`ChoicePrompt pairCards`, docs/phase7-wave8.md §3.36; MC45 p. 6, step 2 of a mission
 * attempt: "Assign each of the discarded cards to a different ally at the mission"). The discarded cards sit on one side,
 * the characters on the other, and the player draws one-to-one pairs between them. Pure functions: the assignment so far
 * goes in, the legal next moves and the selection to send come out.
 *
 * The engine decides everything it can be asked: which pairs match (`prompt.matching`), the icons (`prompt.icons`), and
 * whether an assignment is allowed (`pairSelectionFault`, which also enforces `prompt.limit`). This module restates no
 * rule. A card or character can be left unassigned; the whole assignment is the selection, any number of options from
 * none up (`minSelections` 0). A selection the engine refuses leaves the choice open: `withRefusal` keeps its message so
 * the sheet can show it where the player is looking.
 *
 * Assigning a card that already has a character moves it, and assigning to a character that already has a card takes it
 * from that card (the card goes back to unassigned): one gesture, never a second step to clear first.
 */

import {
  pairOptionId,
  pairSelectionFault,
  type ChoicePrompt,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type ResourceType,
} from "@mc/engine";
import { cardName } from "./names.js";

export type PairPrompt = Extract<ChoicePrompt, { kind: "pairCards" }>;

export interface Pair {
  readonly card: InstanceId;
  readonly character: InstanceId;
}

export interface PairingState {
  readonly prompt: PairPrompt;
  /** The option ids the engine offered; a pair outside them is never a move. */
  readonly offered: ReadonlySet<string>;
  readonly pairs: readonly Pair[];
  /** The engine's message for the last selection it refused, until the assignment changes. */
  readonly refusal: string | null;
}

/** The pairing for a pending `pairCards` choice, with nothing assigned. Null for any other choice. */
export function beginPairing(choice: Pick<PendingChoice, "prompt" | "options">): PairingState | null {
  if (choice.prompt.kind !== "pairCards") return null;
  return {
    prompt: choice.prompt,
    offered: new Set(choice.options.map((option) => option.optionId)),
    pairs: [],
    refusal: null,
  };
}

/** The most pairs possible: the smaller of the two counts. */
export const maxPairs = (pairing: PairingState): number =>
  Math.min(pairing.prompt.cards.length, pairing.prompt.with.length);

/** The option ids of the assignment, in the prompt's card order: the selection to send with `resolveChoice`. */
export function selectionOf(pairing: PairingState): readonly string[] {
  const byCard = new Map(pairing.pairs.map((pair) => [pair.card, pair.character] as const));
  return pairing.prompt.cards.flatMap((card) => {
    const character = byCard.get(card);
    return character === undefined ? [] : [pairOptionId(card, character)];
  });
}

/** The engine's own check of an assignment (`pairSelectionFault`): why it is not a legal pairing, or null. */
export const faultOf = (prompt: PairPrompt, pairs: readonly Pair[]): string | null =>
  pairSelectionFault(
    prompt,
    pairs.map((pair) => pairOptionId(pair.card, pair.character)),
  );

/** The pairs after assigning `card` to `character`: both lose any earlier partner first. */
function assignedPairs(pairs: readonly Pair[], card: InstanceId, character: InstanceId): readonly Pair[] {
  return [...pairs.filter((pair) => pair.card !== card && pair.character !== character), { card, character }];
}

export type MoveCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Whether assigning `card` to `character` is a legal next move, with the engine's reason when it is not. */
export function checkAssign(pairing: PairingState, card: InstanceId, character: InstanceId): MoveCheck {
  if (!pairing.offered.has(pairOptionId(card, character))) return { ok: false, reason: "not a pairing you can make" };
  const fault = faultOf(pairing.prompt, assignedPairs(pairing.pairs, card, character));
  return fault === null ? { ok: true } : { ok: false, reason: fault };
}

/** The assignment with `card` given to `character`; unchanged when the engine's own check refuses it. */
export function assign(pairing: PairingState, card: InstanceId, character: InstanceId): PairingState {
  if (!checkAssign(pairing, card, character).ok) return pairing;
  return { ...pairing, pairs: assignedPairs(pairing.pairs, card, character), refusal: null };
}

/** The assignment with `card` back among the unassigned ones. */
export function unassign(pairing: PairingState, card: InstanceId): PairingState {
  if (!pairing.pairs.some((pair) => pair.card === card)) return pairing;
  return { ...pairing, pairs: pairing.pairs.filter((pair) => pair.card !== card), refusal: null };
}

/** Keeps the engine's message for a selection it refused (`resolveChoice` rejected it and the choice stayed open). */
export const withRefusal = (pairing: PairingState, message: string): PairingState => ({ ...pairing, refusal: message });

/** The legal moves from a card: every character it can be assigned to now, with whether the pair matches. */
export function movesFor(
  pairing: PairingState,
  card: InstanceId,
): readonly { readonly character: InstanceId; readonly matches: boolean }[] {
  return pairing.prompt.with
    .filter((character) => checkAssign(pairing, card, character).ok)
    .map((character) => ({
      character,
      matches: pairing.prompt.matching.includes(pairOptionId(card, character)),
    }));
}

export interface PairCardRow {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly icons: readonly ResourceType[];
  /** "energy, wild", or "no icon" for a card that prints none (an encounter card). */
  readonly iconWords: string;
  readonly assignedTo: InstanceId | null;
  readonly assignedToName: string | null;
  /** Characters it could go to now (`movesFor`). */
  readonly canGoTo: readonly InstanceId[];
}

export interface PairCharacterRow {
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly icons: readonly ResourceType[];
  readonly iconWords: string;
  readonly takenBy: InstanceId | null;
  readonly takenByName: string | null;
  /** Its pair matches, so it takes part. Never true with nothing assigned to it. */
  readonly participates: boolean;
}

export interface PairView {
  readonly card: InstanceId;
  readonly character: InstanceId;
  /** `<card>><character>`: the option id sent for this pair. */
  readonly optionId: string;
  readonly matches: boolean;
  /** "Ace of Spades with Ally: match" / "no match": never by color alone. */
  readonly label: string;
}

export interface PairingView {
  readonly cards: readonly PairCardRow[];
  readonly characters: readonly PairCharacterRow[];
  readonly pairs: readonly PairView[];
  readonly selection: readonly string[];
  /** The most pairs possible. */
  readonly maxPairs: number;
  /** The restriction in force (`prompt.limit`) in words, or null with none. */
  readonly restriction: string | null;
  /** "2 of 3 characters take part": the result so far, for a line above Confirm. */
  readonly summary: string;
  readonly unassignedCards: readonly InstanceId[];
  /** The engine's message when the assignment as it stands is not a legal pairing, else null. */
  readonly fault: string | null;
  /** The engine's message for a selection it refused when sent, else null. */
  readonly refusal: string | null;
}

const iconWords = (icons: readonly ResourceType[]): string => (icons.length === 0 ? "no icon" : icons.join(", "));

/** `PairLimit` in words; one kind exists today. */
function restrictionWords(prompt: PairPrompt): string | null {
  if (!prompt.limit) return null;
  return "Cards with the same resource icon can't go to more than one character";
}

/** The pairing as the sheet draws it: both columns, each pair worded, the result so far and what Confirm may do. */
export function pairingView(state: GameState, pairing: PairingState): PairingView {
  const { prompt } = pairing;
  const byCard = new Map(pairing.pairs.map((pair) => [pair.card, pair.character] as const));
  const byCharacter = new Map(pairing.pairs.map((pair) => [pair.character, pair.card] as const));
  const pairs = pairing.pairs.map((pair): PairView => {
    const optionId = pairOptionId(pair.card, pair.character);
    const matches = prompt.matching.includes(optionId);
    return {
      card: pair.card,
      character: pair.character,
      optionId,
      matches,
      label: `${cardName(state, pair.card)} with ${cardName(state, pair.character)}: ${matches ? "match" : "no match"}`,
    };
  });
  const matched = new Set(pairs.filter((pair) => pair.matches).map((pair) => pair.character));
  const fault = faultOf(prompt, pairing.pairs);
  return {
    cards: prompt.cards.map((card): PairCardRow => {
      const to = byCard.get(card) ?? null;
      const icons = prompt.icons[card] ?? [];
      return {
        instanceId: card,
        name: cardName(state, card),
        icons,
        iconWords: iconWords(icons),
        assignedTo: to,
        assignedToName: to === null ? null : cardName(state, to),
        canGoTo: movesFor(pairing, card).map((move) => move.character),
      };
    }),
    characters: prompt.with.map((character): PairCharacterRow => {
      const by = byCharacter.get(character) ?? null;
      const icons = prompt.icons[character] ?? [];
      return {
        instanceId: character,
        name: cardName(state, character),
        icons,
        iconWords: iconWords(icons),
        takenBy: by,
        takenByName: by === null ? null : cardName(state, by),
        participates: matched.has(character),
      };
    }),
    pairs,
    selection: selectionOf(pairing),
    maxPairs: maxPairs(pairing),
    restriction: restrictionWords(prompt),
    summary: `${matched.size} of ${prompt.with.length} take part`,
    unassignedCards: prompt.cards.filter((card) => !byCard.has(card)),
    fault,
    refusal: pairing.refusal,
  };
}
