import { AOS_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  type AbilityRegistry,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { coreScenario } from "../core/setup.js";
import { mergeRegistries } from "../dsl/index.js";
import { P1, endTurn, firstLegal, identityOf, settle, stackEncounterDeck, type Picker } from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";

/**
 * Shared scenario helpers for the wave 9 encounter-set tests (Rhino from Core against a Core starter deck, a
 * Thunderbolt set's cards added to the encounter deck by hand). Every scenario stacks the encounter deck top first
 * and ends turns for real.
 */

/** Core treachery with no boost icons and no Boost ability; the filler for boost cards that should add nothing. */
export const BLANK = "01186";
/** Core treachery with 1 boost icon and no Boost ability. */
export const ONE_ICON = "01188";
/** Core Rhino attachments: they attach to the villain without touching the players; the filler for dealt cards. */
export const FILLER_A = "01098";
export const FILLER_B = "01100";
/** Core Rhino attachment with 2 boost icons, two copies. */
export const CHARGE = "01099";
export const BLACK_CAT = "01002";
export const AUNT_MAY = "01006";

export const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
export const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
export const SHE_HULK = { starterDeckId: "core-she-hulk-aggression" } as const;
export const IRON_MAN = { starterDeckId: "core-iron-man-aggression" } as const;
export type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL | typeof SHE_HULK | typeof IRON_MAN)[];

export const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
export const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
export const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
export const inPlayCard = (s: GameState, code: string): InstanceId | undefined =>
  cardsInPlay(s).find((id) => codeOf(s, id) === code);
export const idOf = (s: GameState, code: string): InstanceId => {
  const id = Object.keys(s.instances).find((i) => codeOf(s, i as InstanceId) === code);
  return id as InstanceId;
};
export const dataOf = (code: string) =>
  AOS_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
export const types = <T extends GameEvent["type"]>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
export const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
export const schemesBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "schemeResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
export const revealedCodes = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "encounterCardRevealed").map((e) => codeOf(s, e.instanceId));
export const flippedBoosts = (events: readonly GameEvent[]) => types(events, "boostCardFlipped");
export const tough = (s: GameState, id: InstanceId): number => s.instances[id]!.statuses.tough;

export const heroForm = (s: GameState, ...seats: readonly PlayerId[]): GameState =>
  (seats.length > 0 ? seats : [P1]).reduce((acc, p) => withForm(acc, { heroForm: 0 }, p), s);

/** An encounter card out of the game: `code` removed from the deck and discard pile. */
export function without(state: GameState, code: string): GameState {
  const pile = piles(state);
  const keep = (id: InstanceId) => codeOf(state, id) !== code;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck.filter(keep), discard: pile.discard.filter(keep) },
    },
  };
}

/** One copy of `code` moved from the encounter deck to its discard pile. */
export function inDiscardPile(state: GameState, code: string): GameState {
  const pile = piles(state);
  const id = pile.deck.find((i) => codeOf(state, i) === code)!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck.filter((i) => i !== id), discard: [...pile.discard, id] },
    },
  };
}

/** Picks the option naming the card `target`; any other choice is answered as `firstLegal` does. */
export const picking =
  (target: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    // Only the effect's own target prompt: a defender or a trigger prompt is declined, as `firstLegal` does.
    if (choice.prompt.kind !== "chooseTarget") return firstLegal(s);
    const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
    return option ? [option.optionId] : firstLegal(s);
  };

/**
 * The encounter deck exactly `codes`, top first (the rest of the deck and the discard pile are dropped). Finding or
 * searching a card shuffles the encounter deck (RRG 1.8 "Find", p. 19; "Search", p. 39), so a test that stacks cards
 * behind a find leaves at most one card there: a one-card deck shuffles to itself.
 */
export function onlyDeck(state: GameState, ...codes: readonly string[]): GameState {
  const pile = piles(state);
  const used: InstanceId[] = [];
  for (const code of codes) {
    const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code && !used.includes(i));
    if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
    used.push(id);
  }
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [activeEncounterDeckId(state)]: { deck: used, discard: [] } },
  };
}

/** The game and villain-phase driver of one encounter set: its copies appended to Rhino's encounter deck. */
export function setKit(setId: string, module: AbilityRegistry) {
  const deps: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, module) };

  function setupGame(players: Seats = [SPIDER_MAN]): GameState {
    const config = coreScenario("rhino", {
      players,
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: [...CORE_CARDS, ...AOS_CARDS],
    });
    const cards = AOS_CARDS.filter((c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId(setId)));
    const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
    const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, deps);
    if (!created.ok) throw new Error(created.error.message);
    return settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
  }

  /** Every player ends their turn, in seat order, and the villain phase runs on the stacked deck. */
  function villainPhase(state: GameState, stack: readonly string[], pick: Picker = firstLegal) {
    const staged = stackEncounterDeck(state, ...stack);
    return driveEventsPicking(deps, staged, pick, ...state.players.map((p) => endTurn(p.playerId)));
  }

  return { deps, setupGame, villainPhase };
}

/** The player's identity (in hero form) makes a basic attack on `target`; every choice answered by `pick`. */
export function heroAttacks(
  deps: EngineDeps,
  state: GameState,
  target: InstanceId,
  opts: { readonly player?: PlayerId; readonly pick?: Picker } = {},
) {
  const player = opts.player ?? P1;
  return driveEventsPicking(deps, state, opts.pick ?? firstLegal, {
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: identityOf(state, player),
    targetInstanceId: target,
  });
}

/** The player's identity (in hero form) makes a basic thwart on `scheme`; every choice answered by `pick`. */
export function heroThwarts(
  deps: EngineDeps,
  state: GameState,
  scheme: InstanceId,
  opts: { readonly player?: PlayerId; readonly pick?: Picker } = {},
) {
  const player = opts.player ?? P1;
  return driveEventsPicking(deps, state, opts.pick ?? firstLegal, {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: identityOf(state, player),
    schemeInstanceId: scheme,
  });
}
