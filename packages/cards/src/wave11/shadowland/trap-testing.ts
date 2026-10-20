import { CORE_CARDS, SHADOWLAND_CARDS, cardId, trait } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries, traitEncounterDeck } from "../../dsl/index.js";
import { P1, endTurn, firstLegal, moveToHand, settle, stackEncounterDeck, type Picker } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";
import { SHADOWLAND_DEADLY_CONTRAPTIONS } from "./deadly-contraptions.js";
import { SHADOWLAND_SHADOW_LABYRINTH } from "./shadow-labyrinth.js";
import { type Seats, SPIDER_MAN, codeOf } from "../../wave9/testing.js";

/**
 * Test-local trap-deck scenario for the Shadow Labyrinth and Deadly Contraptions scripts (docs/phase7-shadowland.md
 * section 6 M3). The pack is gated and the Shadow Labyrinth scenario record (D4) does not exist yet, so this builds
 * the config it will build by hand: Core's Rhino game against Core starter decks, Shifting Corridors (or Rhino) as
 * the villain, and a trap deck of exactly `trapCards` declared with `traitEncounterDeck`.
 */
export const TRAP_DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE10_ABILITIES, SHADOWLAND_SHADOW_LABYRINTH, SHADOWLAND_DEADLY_CONTRAPTIONS),
};

export const CORRIDORS = "65037";
export const DEATHSTRIKE = "65041";
export const DEAD_END = "65042";
export const NO_TIME = "65044";
export const SUDDEN_SHIFT = "65045";
export const HALL = "65048";
export const PATH = "65049";
export const BLINDING = "65050";
export const CALTROPS = "65051";
/** A Core Rhino attachment (attaches to the villain, touches no player): the filler for encounter cards that should do nothing. */
export const FILLER = "01098";

export function trapGame(
  opts: {
    readonly seats?: Seats;
    /** The villain: Shifting Corridors with `passage` counters (default), or Core's Rhino. */
    readonly villain?: typeof CORRIDORS | "rhino";
    readonly passage?: number;
    readonly trapCards?: readonly string[];
    /** Encounter cards put on top of the encounter deck, in this order (the rest is the scenario's shuffled deck). */
    readonly encounter?: readonly string[];
    readonly seed?: number;
  } = {},
): GameState {
  const seats = opts.seats ?? [SPIDER_MAN];
  const config = coreScenario("rhino", {
    players: seats,
    seed: opts.seed ?? 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...SHADOWLAND_CARDS],
  });
  const villain = opts.villain ?? CORRIDORS;
  const created = createGame(
    {
      ...config,
      ...(villain === CORRIDORS
        ? { villainCardId: cardId(villain), villainStartStageIndex: 0, villainLastStageIndex: 0 }
        : {}),
      // The TRAP! cards in the encounter deck are gathered into the trap deck at setup (MC65 p. 12).
      encounterDeck: [...(opts.trapCards ?? []), ...(opts.encounter ?? []), ...config.encounterDeck.map(String)].map(
        cardId,
      ),
      scenarioDecks: [traitEncounterDeck("trap", trait("TRAP!"))],
    },
    TRAP_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", TRAP_DEPS);
  // Setup shuffles the encounter deck: put the cards the test named on top, in order, so what is dealt is known.
  if (opts.encounter && opts.encounter.length > 0) state = stackEncounterDeck(state, ...opts.encounter);
  if (villain === CORRIDORS) {
    const id = state.villains[0]!.instanceId;
    const instance = state.instances[id]!;
    state = {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...instance, counters: { ...instance.counters, passage: opts.passage ?? 3 } },
      },
    };
  }
  return state;
}

export const trapDeck = (s: GameState): GameState["scenarioDecks"][string] => s.scenarioDecks["trap"]!;
export const trapCodes = (s: GameState): string[] => trapDeck(s).deck.map((id) => codeOf(s, id));
export const trapDiscardCodes = (s: GameState): string[] => trapDeck(s).discard.map((id) => codeOf(s, id));
export const encounterPiles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
export const encounterTopCodes = (s: GameState, n: number): string[] =>
  encounterPiles(s)
    .deck.slice(0, n)
    .map((id) => codeOf(s, id));
export const villainId = (s: GameState): InstanceId => s.villains[0]!.instanceId;
export const passageOn = (s: GameState): number => s.instances[villainId(s)]!.counters["passage"] ?? 0;

/** The trap deck's top cards exactly `codes`, in order, taken from the trap deck or its discard pile. */
export function stackTraps(state: GameState, ...codes: readonly string[]): GameState {
  const piles = trapDeck(state);
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const id = [...piles.deck, ...piles.discard].find((i) => codeOf(state, i) === code && !ids.includes(i));
    if (!id) throw new Error(`no ${code} in the trap deck or its discard pile`);
    ids.push(id);
  }
  return {
    ...state,
    scenarioDecks: {
      ...state.scenarioDecks,
      trap: {
        ...piles,
        deck: [...ids, ...piles.deck.filter((i) => !ids.includes(i))],
        discard: piles.discard.filter((i) => !ids.includes(i)),
      },
    },
  };
}

/**
 * `player`'s hand is exactly `codes` (taken from their deck or discard pile) and their deck and discard pile are
 * emptied, so the end-of-turn refill adds nothing and the hand is what a trap card reads.
 */
export function withHandOnly(state: GameState, player: PlayerId, ...codes: readonly string[]): GameState {
  const { state: moved, ids } = moveToHand(state, player, ...codes);
  const handed = moved.players.find((p) => p.playerId === player)!.hand;
  const keep = handed.filter((id) => ids.includes(id));
  return {
    ...moved,
    players: moved.players.map((p) => (p.playerId === player ? { ...p, hand: keep, deck: [], discard: [] } : p)),
  };
}

export const handCodes = (s: GameState, player: PlayerId = P1): string[] =>
  s.players.find((p) => p.playerId === player)!.hand.map((id) => codeOf(s, id));
export const discardCodes = (s: GameState, player: PlayerId = P1): string[] =>
  s.players.find((p) => p.playerId === player)!.discard.map((id) => codeOf(s, id));

/** Answers an option prompt with the option whose label starts with `label`; any other prompt as `firstLegal`. */
export const choosingOption =
  (label: string): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "chooseOption") return firstLegal(s);
    const option = choice.options.find((o) => o.label.startsWith(label));
    if (!option) throw new Error(`no option "${label}" among ${choice.options.map((o) => o.label).join(" | ")}`);
    return [option.optionId];
  };

/** The labels of the option prompt the trap card offered, in the events of a run that stops at it. */
export function endTurnAnswering(state: GameState, pick: Picker, ...players: readonly PlayerId[]) {
  return driveEventsPicking(TRAP_DEPS, state, pick, ...(players.length > 0 ? players : [P1]).map((p) => endTurn(p)));
}
