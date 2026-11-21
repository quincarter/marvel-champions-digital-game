/**
 * docs/competitive-mode-plan.md §3.3 and §4 task 3: every per player value is read through the team of the card it is
 * printed on (`perPlayerCount` in `team.ts`, `perPlayerCountAt` in `query.ts`).
 *
 * Sources: RRG 1.8 "Per Player Icon" (p. 32): "The icon next to a value multiplies that value by the number of players
 * who started the scenario. If a player is eliminated, this value does not change."; MC56 p. 20: per player values
 * apply only "to the players on your team". A cooperative game has one team of every seat, so its numbers are the
 * ones the icon has always given. No setup makes a second team, so the two-team side is read on `twoTeamState`.
 *
 * Synthetic cards only, put where they are read by hand: what is tested is the number each reader returns.
 */

import { describe, expect, it } from "vitest";
import { perPlayerOnly, type AllyCard, type AnyCard } from "@mc/content";
import { DEFAULT_DEPS } from "./abilities.js";
import { createCtx } from "./ctx.js";
import { gameAreaId, playerId, type InstanceId, type PlayerId } from "./ids.js";
import { keywordTotal } from "./keywords.js";
import {
  areaOfPlayer,
  mainSchemeValue,
  maxHitPoints,
  perPlayerCountAt,
  printedCostOf,
  scaleIn,
  startingThreatOf,
} from "./query.js";
import { eliminatePlayer } from "./resolve/defeat.js";
import { usesCountersOnEntering } from "./resolve/enter-play.js";
import { playerSideSchemeLimit } from "./rules.js";
import { resolveValue } from "./select.js";
import type { GameState, MainSchemeState } from "./state.js";
import { perPlayerCount } from "./team.js";
import { stubAlly, stubMainScheme, stubMinion, stubSideScheme, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { MAIN_SCHEME, newGame, VILLAIN } from "./testing/scenario.js";
import { LEADER_ONE, LEADER_TWO, twoTeamState } from "./testing/team.js";

const P1 = playerId("p1");
const P2 = playerId("p2");
const P3 = playerId("p3");
const P4 = playerId("p4");

/** A villain stage printed "12 per player", under each villain id the fixtures use. */
const perPlayerVillain = (id: string): AnyCard =>
  stubVillain({ id, stages: [{ hp: perPlayerOnly(12), atk: 2, sch: 1 }] });
/** The fixtures' main scheme with every value printed per player: starting 2, target 7, acceleration 1. */
const SCHEME = stubMainScheme({
  id: MAIN_SCHEME.id,
  stages: [{ startingThreat: perPlayerOnly(2), targetThreat: perPlayerOnly(7), acceleration: perPlayerOnly(1) }],
});
/** "Hinder 1 + 2 per player", starting threat 3 per player. */
const PLOT = stubSideScheme({
  id: "tsc-plot",
  startingThreat: perPlayerOnly(3),
  keywords: [{ name: "hinder", value: 1, perPlayer: 2 }],
});
const BRUTE = stubMinion({ id: "tsc-brute", atk: 1, sch: 1, hp: 4, hpPerPlayer: true });
const ARMORY = stubUpgrade({
  id: "tsc-armory",
  cost: 1,
  keywords: [{ name: "uses", count: 1, countPerPlayer: 2, counterType: "ammo" }],
});
const SQUAD: AllyCard = { ...stubAlly({ id: "tsc-squad", cost: 2, atk: 1, thw: 1, hp: 3 }), costPerPlayer: true };

const withCards = (state: GameState): GameState => ({
  ...state,
  cardPool: {
    ...state.cardPool,
    ...Object.fromEntries(
      [
        perPlayerVillain(VILLAIN.id),
        perPlayerVillain(LEADER_ONE.id),
        perPlayerVillain(LEADER_TWO.id),
        SCHEME,
        PLOT,
        BRUTE,
        ARMORY,
        SQUAD,
      ].map((card) => [card.id, card]),
    ),
  },
});

interface Planted {
  readonly state: GameState;
  readonly scheme: MainSchemeState;
  readonly villain: InstanceId;
  readonly plot: InstanceId;
  readonly brute: InstanceId;
  readonly armory: InstanceId;
  readonly squad: InstanceId;
}

/**
 * Puts one of each per player card where `seat` reads it: the side scheme in play (and in the seat's game area when
 * the players are split), the minion engaged with the seat, the upgrade in the seat's play area, the ally in the
 * seat's hand, and, when the seat's area has no main scheme, a stage of its own. Each is a card of the seat's deck
 * given another printed face, so no instance is invented.
 */
function plant(input: GameState, seat: PlayerId): Planted {
  let state = input;
  const take = (card: AnyCard, controlled: boolean): InstanceId => {
    const owner = state.players.find((player) => player.playerId === seat)!;
    const id = owner.deck[0]!;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.playerId === seat ? { ...player, deck: player.deck.slice(1) } : player,
      ),
      instances: {
        ...state.instances,
        [id]: {
          ...state.instances[id]!,
          cardId: card.id,
          faceup: true,
          ownerId: controlled ? seat : null,
          controllerId: controlled ? seat : null,
        },
      },
    };
    return id;
  };
  const toPlayer = (id: InstanceId, zone: "playArea" | "hand"): void => {
    state = {
      ...state,
      players: state.players.map((player) =>
        player.playerId === seat ? { ...player, [zone]: [...player[zone], id] } : player,
      ),
    };
  };
  const plot = take(PLOT, false);
  const brute = take(BRUTE, false);
  const armory = take(ARMORY, true);
  const squad = take(SQUAD, true);
  toPlayer(brute, "playArea");
  toPlayer(armory, "playArea");
  toPlayer(squad, "hand");
  state = { ...state, villainArea: [...state.villainArea, plot] };
  const area = areaOfPlayer(state, seat);
  if (!area) return { state, scheme: state.mainScheme, villain: state.activeVillainId, plot, brute, armory, squad };
  const scheme: MainSchemeState = area.mainScheme ?? {
    instanceId: take(SCHEME, false),
    cardId: SCHEME.id,
    stageIndex: 0,
    completed: false,
    accelerationTokens: 0,
  };
  state = {
    ...state,
    gameAreas: state.gameAreas.map((candidate) =>
      candidate.areaId === area.areaId
        ? { ...candidate, mainScheme: scheme, sideSchemeIds: [...candidate.sideSchemeIds, plot] }
        : candidate,
    ),
  };
  return { state, scheme, villain: area.activeVillainId!, plot, brute, armory, squad };
}

/** Every reader of a per player value, for the cards planted at one seat. */
const numbers = ({ state, scheme, villain, plot, brute, armory, squad }: Planted, seat: PlayerId) => ({
  villainHp: maxHitPoints(state, villain, DEFAULT_DEPS),
  schemeStart: mainSchemeValue(state, "startingThreat", DEFAULT_DEPS, scheme),
  schemeTarget: mainSchemeValue(state, "targetThreat", DEFAULT_DEPS, scheme),
  acceleration: mainSchemeValue(state, "acceleration", DEFAULT_DEPS, scheme),
  sideSchemeStart: startingThreatOf(state, plot, DEFAULT_DEPS),
  hinder: keywordTotal(state, plot, "hinder", DEFAULT_DEPS),
  minionHp: maxHitPoints(state, brute, DEFAULT_DEPS),
  uses: usesCountersOnEntering(state, DEFAULT_DEPS, armory),
  cost: printedCostOf(state, state.cardPool[SQUAD.id], squad),
  ownText: resolveValue(
    state,
    { kind: "perPlayer", base: 1, perPlayer: 2 },
    { selfInstanceId: plot, controllerId: null, event: null, bindings: {}, deps: DEFAULT_DEPS },
    DEFAULT_DEPS,
  ),
  playerText: resolveValue(
    state,
    { kind: "perPlayer", base: 1, perPlayer: 2 },
    { selfInstanceId: null, controllerId: seat, event: null, bindings: {}, deps: DEFAULT_DEPS },
    DEFAULT_DEPS,
  ),
  count: perPlayerCountAt(state, plot),
});

/** What `numbers` is for a team of `n` players. */
const expected = (n: number) => ({
  villainHp: 12 * n,
  schemeStart: 2 * n,
  schemeTarget: 7 * n,
  acceleration: n,
  sideSchemeStart: 3 * n,
  hinder: 1 + 2 * n,
  minionHp: 4 * n,
  uses: { ammo: 1 + 2 * n },
  cost: 2 * n,
  ownText: 1 + 2 * n,
  playerText: 1 + 2 * n,
  count: n,
});

const twoTeams = (sizes: readonly [number, number]): GameState => withCards(twoTeamState({ sizes }));
/** The first seat of team two, after team one's `first` seats. */
const seatAfter = (first: number): PlayerId => playerId(`p${first + 1}`);

describe("a cooperative game: one team of every seat, the numbers the per player icon has always given", () => {
  it("the written-out numbers for two players", () => {
    const planted = plant(withCards(newGame({ players: 2 })), P1);
    expect(numbers(planted, P1)).toEqual({
      villainHp: 24,
      schemeStart: 4,
      schemeTarget: 14,
      acceleration: 2,
      sideSchemeStart: 6,
      hinder: 5,
      minionHp: 8,
      uses: { ammo: 5 },
      cost: 4,
      ownText: 5,
      playerText: 5,
      count: 2,
    });
  });

  it.each([1, 2, 4])("%i players: every per player value counts every player, at every seat", (players) => {
    const base = withCards(newGame({ players }));
    expect("teams" in base).toBe(false);
    for (const seat of base.players.map((player) => player.playerId)) {
      expect(numbers(plant(base, seat), seat)).toEqual(expected(players));
    }
  });

  it.each([1, 2, 4])("%i players: a value read without its card counts every player", (players) => {
    const state = withCards(newGame({ players }));
    expect(scaleIn(state, perPlayerOnly(3))).toBe(3 * players);
    expect(printedCostOf(state, SQUAD)).toBe(2 * players);
    expect(perPlayerCountAt(state, null)).toBe(players);
    expect(perPlayerCount(state, null)).toBe(players);
  });

  it("an eliminated player is still counted (RRG 1.8 p. 32)", () => {
    const ctx = createCtx(withCards(newGame({ players: 4 })), DEFAULT_DEPS);
    eliminatePlayer(ctx, P4);
    expect(numbers(plant(ctx.state, P1), P1)).toEqual(expected(4));
  });
});

describe("two teams: a per player value counts the players on the team of the card it is printed on (MC56 p. 20)", () => {
  it("two against one: team one's leader, scheme and cards read 2, team two's read 1", () => {
    const state = twoTeams([2, 1]);
    expect(state.startingPlayerCount).toBe(3);
    expect(numbers(plant(state, P1), P1)).toEqual(expected(2));
    expect(numbers(plant(state, P2), P2)).toEqual(expected(2));
    expect(numbers(plant(state, P3), P3)).toEqual(expected(1));
  });

  it("two against one, written out: 12 per player hit points are 24 on team one's leader and 12 on team two's", () => {
    const state = twoTeams([2, 1]);
    const [one, two] = state.gameAreas;
    expect(maxHitPoints(state, one!.activeVillainId!, DEFAULT_DEPS)).toBe(24);
    expect(maxHitPoints(state, two!.activeVillainId!, DEFAULT_DEPS)).toBe(12);
  });

  it("one against two: the same the other way round", () => {
    const state = twoTeams([1, 2]);
    expect(numbers(plant(state, P1), P1)).toEqual(expected(1));
    expect(numbers(plant(state, P3), P3)).toEqual(expected(2));
  });

  it.each([
    [1, 1],
    [2, 2],
  ] as const)("%i against %i, the printed games: each side reads its own size, not the table's", (first, second) => {
    const state = twoTeams([first, second]);
    expect(state.startingPlayerCount).toBe(first + second);
    expect(numbers(plant(state, P1), P1)).toEqual(expected(first));
    const other = seatAfter(first);
    expect(numbers(plant(state, other), other)).toEqual(expected(second));
  });

  it("hinder 1 + 2 per player on a scheme is 3 in a one against one game and 5 in a two against two game", () => {
    const single = plant(twoTeams([1, 1]), P2);
    expect(keywordTotal(single.state, single.plot, "hinder", DEFAULT_DEPS)).toBe(3);
    const double = plant(twoTeams([2, 2]), P3);
    expect(keywordTotal(double.state, double.plot, "hinder", DEFAULT_DEPS)).toBe(5);
  });

  it("a seat that sat the scenario out is not counted on its team, and the other team's values do not move", () => {
    const base = twoTeams([2, 2]);
    const satOut: GameState = {
      ...base,
      startingPlayerCount: 3,
      players: base.players.map((player) => (player.playerId === P4 ? { ...player, sittingOut: true } : player)),
    };
    expect(numbers(plant(satOut, P3), P3)).toEqual(expected(1));
    expect(numbers(plant(satOut, P1), P1)).toEqual(expected(2));
  });

  it("an eliminated player is still counted on its team (RRG 1.8 p. 32)", () => {
    const ctx = createCtx(twoTeams([2, 2]), DEFAULT_DEPS);
    eliminatePlayer(ctx, P4);
    expect(numbers(plant(ctx.state, P3), P3)).toEqual(expected(2));
  });
});

describe("a value that belongs to no team keeps the count of the whole table", () => {
  const state = twoTeams([2, 1]);

  it("the central stage, which is in every game area", () => {
    expect(mainSchemeValue(state, "targetThreat", DEFAULT_DEPS)).toBe(21);
    expect(perPlayerCountAt(state, state.mainScheme.instanceId)).toBe(3);
  });

  it("a value read without its card, and an area no team plays in", () => {
    expect(scaleIn(state, perPlayerOnly(3))).toBe(9);
    expect(printedCostOf(state, SQUAD)).toBe(6);
    expect(perPlayerCount(state, null)).toBe(3);
    expect(perPlayerCount(state, { areaId: gameAreaId("a9") })).toBe(3);
  });

  it("a card in an encounter deck counts the team that faces that deck (MC56 p. 15, competitive plan M1)", () => {
    // Each team's half of the table holds the encounter deck it faces (MC56 p. 15), so its cards are in that team's
    // game area (`areaOfCard`); team one (2 players) faces the first leader's deck, team two (1) the second's.
    const [first, second] = state.encounterDeckOrder.map((deckId) => state.encounterDecks[deckId]!.deck[0]!);
    expect(perPlayerCountAt(state, first)).toBe(2);
    expect(perPlayerCountAt(state, second)).toBe(1);
  });

  it("the table's own counts: the players who started, and the player side scheme limit", () => {
    expect(state.startingPlayerCount).toBe(3);
    expect(playerSideSchemeLimit(state)).toBe(2);
  });
});
