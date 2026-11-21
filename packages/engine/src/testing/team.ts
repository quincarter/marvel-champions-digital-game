/**
 * A hand-built two-team state (docs/competitive-mode-plan.md §4 task 2; MC56 p. 14), for testing what reads a team
 * before competitive setup exists. `createGame` refuses competitive mode, so this sets up a cooperative game with two
 * leaders, each with its own encounter deck, and then writes onto the state what competitive setup will: the mode, a
 * game area for each team holding that team's seats and the leader it faces, and the two teams.
 *
 * The areas have no main scheme of their own yet (the game's one stage stays the central stage), and the round is
 * still the cooperative one. Nothing but a test builds a state this way.
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
import { gameAreaId, teamId, type InstanceId } from "../ids.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import type { GameAreaState, GameState } from "../state.js";
import type { TeamState } from "../team.js";
import { stubMainScheme, stubObligation, stubUpgrade, stubVillain } from "./fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  HERO,
  MAIN_SCHEME,
  seatIdentities,
  settle,
  TREACHERY,
} from "./scenario.js";

export const TEAM_ONE = teamId("t1");
export const TEAM_TWO = teamId("t2");

/** The leader team one faces (in team one's area), and the leader team two faces. */
export const LEADER_ONE = stubVillain({ id: "leader-one", stages: [{ hp: flat(20), atk: 2, sch: 1 }] });
export const LEADER_TWO = stubVillain({ id: "leader-two", stages: [{ hp: flat(20), atk: 2, sch: 1 }] });

export interface TwoTeamOptions {
  /** How many players each team has, team one first. Default 1 against 1; 2 against 2 is the other printed game. */
  readonly sizes?: readonly [number, number];
  readonly seed?: number;
}

/**
 * A game past setup with two teams: the first `sizes[0]` seats are team one (Registration), the rest team two
 * (Resistance). Uneven sizes are for tests of per-team counts alone; the printed game is never offered that way.
 */
export function twoTeamState(options: TwoTeamOptions = {}): GameState {
  const [first, second] = options.sizes ?? [1, 1];
  const identities = seatIdentities(HERO, first + second);
  const encounterDeck = Array.from({ length: 10 }, () => TREACHERY.id);
  const result = createGame({
    seed: options.seed ?? 56,
    cards: [...DEFAULT_CARDS, LEADER_ONE, LEADER_TWO, ...identities.slice(1)],
    villainCardId: LEADER_ONE.id,
    villains: [
      { villainCardId: LEADER_ONE.id, encounterDeck },
      { villainCardId: LEADER_TWO.id, encounterDeck },
    ],
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
  });
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  const state = settle(result.state, defaultPick);
  const seats = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex).map((player) => player.playerId);
  const [leaderOne, leaderTwo] = state.villains.map((villain) => villain.instanceId) as [InstanceId, InstanceId];
  const area = (seq: number, playerIds: GameAreaState["playerIds"], leader: InstanceId): GameAreaState => ({
    areaId: gameAreaId(`a${seq}`),
    playerIds,
    mainScheme: null,
    villainIds: [leader],
    activeVillainId: leader,
    sideSchemeIds: [],
    formerSchemeIds: [],
  });
  const one = area(1, seats.slice(0, first), leaderOne);
  const two = area(2, seats.slice(first), leaderTwo);
  const teams: readonly TeamState[] = [
    { teamId: TEAM_ONE, side: "registration", playerIds: one.playerIds, areaId: one.areaId },
    { teamId: TEAM_TWO, side: "resistance", playerIds: two.playerIds, areaId: two.areaId },
  ];
  return { ...state, gameMode: "competitive", gameAreas: [one, two], nextGameAreaSeq: 3, teams };
}

/** The main scheme team one faces (stage 1: 1 starting threat per player, acceleration 1), and team two's (2 each). */
export const SCHEME_ONE = stubMainScheme({
  id: "scheme-one",
  stages: [
    { startingThreat: { base: 0, perPlayer: 1 }, targetThreat: flat(30), acceleration: flat(1) },
    { startingThreat: flat(0), targetThreat: flat(30), acceleration: flat(1) },
  ],
});
export const SCHEME_TWO = stubMainScheme({
  id: "scheme-two",
  stages: [
    { startingThreat: { base: 0, perPlayer: 2 }, targetThreat: flat(30), acceleration: flat(2) },
    { startingThreat: flat(0), targetThreat: flat(30), acceleration: flat(2) },
  ],
});

/** Each team's own leader's four basic player cards (MC56 p. 14), set aside at setup. */
export const LEADER_CARDS_ONE = [1, 2, 3, 4].map((n) => stubUpgrade({ id: `registration-card-${n}`, cost: 1 }));
export const LEADER_CARDS_TWO = [1, 2, 3, 4].map((n) => stubUpgrade({ id: `resistance-card-${n}`, cost: 1 }));

export interface CompetitiveGameOptions {
  /** How many players each team has, the registration team first. Default 1 against 1. */
  readonly sizes?: readonly [number, number];
  readonly seed?: number;
  readonly deps?: EngineDeps;
  readonly extraCards?: readonly AnyCard[];
  /** Each leader's encounter deck, the one the team faces first. Default 10 treacheries each. */
  readonly encounterDecks?: readonly [readonly CardId[], readonly CardId[]];
  /** Every seat's deck. Default `DEFAULT_DECK`. */
  readonly deck?: readonly CardId[];
}

/**
 * The `GameSetupConfig` of a real competitive game (docs/competitive-mode-plan.md M1; MC56 p. 14): the first `sizes[0]`
 * seats are the registration team, which faces `LEADER_ONE` and `SCHEME_ONE`; the rest are the resistance team,
 * facing `LEADER_TWO` and `SCHEME_TWO`. Each identity brings `HERO`'s obligation.
 */
export function competitiveConfig(options: CompetitiveGameOptions = {}): GameSetupConfig {
  const [first, second] = options.sizes ?? [1, 1];
  const identities = seatIdentities(HERO, first + second);
  // Every seat's identity is a clone of `HERO`, so every seat brings `HERO`'s obligation.
  const obligations = [stubObligation({ id: HERO.obligationCardId })];
  const [deckOne, deckTwo] = options.encounterDecks ?? [
    Array.from({ length: 10 }, () => TREACHERY.id),
    Array.from({ length: 10 }, () => TREACHERY.id),
  ];
  return {
    seed: options.seed ?? 56,
    cards: [
      ...DEFAULT_CARDS,
      LEADER_ONE,
      LEADER_TWO,
      SCHEME_ONE,
      SCHEME_TWO,
      ...LEADER_CARDS_ONE,
      ...LEADER_CARDS_TWO,
      ...identities.slice(1),
      ...obligations,
      ...(options.extraCards ?? []),
    ],
    villainCardId: LEADER_ONE.id,
    mainSchemeCardId: SCHEME_ONE.id,
    encounterDeck: [],
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: options.deck ?? DEFAULT_DECK })),
    gameMode: "competitive",
    competitive: {
      teams: [
        {
          side: "registration",
          playerCount: first,
          faces: { villain: { villainCardId: LEADER_ONE.id, encounterDeck: deckOne }, mainSchemeCardId: SCHEME_ONE.id },
          leaderPlayerCardIds: LEADER_CARDS_ONE.map((card) => card.id),
        },
        {
          side: "resistance",
          playerCount: second,
          faces: { villain: { villainCardId: LEADER_TWO.id, encounterDeck: deckTwo }, mainSchemeCardId: SCHEME_TWO.id },
          leaderPlayerCardIds: LEADER_CARDS_TWO.map((card) => card.id),
        },
      ],
    },
  };
}

/** A real competitive game past setup, every player keeping their opening hand: the registration team's first turn. */
export function competitiveGame(options: CompetitiveGameOptions = {}): GameState {
  const deps = options.deps ?? DEFAULT_DEPS;
  const result = createGame(competitiveConfig(options), deps);
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  return settle(result.state, defaultPick, deps);
}
