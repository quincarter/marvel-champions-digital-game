/**
 * Competitive setup (docs/competitive-mode-plan.md §1.2, milestone M1): two traded scenarios become two game areas,
 * each with its leader, main scheme deck and encounter deck, the teams' obligations in their own area's deck, and each
 * team's own leader's four basic player cards set aside.
 *
 * Sources: MC56 pp. 14-16 (scenario rules override RRG per Golden Rule, RRG p. 4); MC56 FAQ p. 20 (the obligation is
 * shuffled in); Q4 A (each area sets up on its own, registration first), Q14 (1v1 or 2v2), Q16 A (the obligation goes
 * into the player's own area's deck) per owner decision 2026-11-20.
 */

import { describe, expect, it } from "vitest";
import { encounterDeckOf, mustInstance, sharedMainSchemes } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { teamSize } from "./team.js";
import {
  competitiveConfig,
  competitiveGame,
  LEADER_CARDS_ONE,
  LEADER_CARDS_TWO,
  LEADER_ONE,
  LEADER_TWO,
  SCHEME_ONE,
  SCHEME_TWO,
  TEAM_ONE,
  TEAM_TWO,
} from "./testing/team.js";

const cardOf = (state: GameState, id: string): string => mustInstance(state, id as never).cardId;

/** Every card of an encounter deck and its discard pile, by card id, sorted. */
const deckCards = (state: GameState, deckId: string): string[] => {
  const piles = encounterDeckOf(state, deckId as never);
  return [...piles.deck, ...piles.discard].map((id) => cardOf(state, id)).sort();
};

describe.each([
  { name: "1v1", sizes: [1, 1] as const, seats: [["p1"], ["p2"]] },
  {
    name: "2v2",
    sizes: [2, 2] as const,
    seats: [
      ["p1", "p2"],
      ["p3", "p4"],
    ],
  },
])("a $name competitive setup", ({ sizes, seats }) => {
  const state = competitiveGame({ sizes });

  it("is a competitive game of two teams, the registration team first and active", () => {
    expect(state.gameMode).toBe("competitive");
    expect(state.teams?.map((team) => [team.teamId, team.side, team.playerIds, team.areaId])).toEqual([
      [TEAM_ONE, "registration", seats[0], "a1"],
      [TEAM_TWO, "resistance", seats[1], "a2"],
    ]);
    expect(state.activeTeamId).toBe(TEAM_ONE);
    expect(state.teams?.map((team) => team.firstPlayerId)).toEqual([seats[0]![0], seats[1]![0]]);
    expect(state.firstPlayerId).toBe(seats[0]![0]);
    // The registration team's first turn of round 1 (MC56 p. 16).
    expect(state.round).toBe(1);
    expect(state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: seats[0]![0] });
  });

  it("builds a game area per team holding its players and the leader it faces, with that leader's encounter deck", () => {
    const [leaderOne, leaderTwo] = state.villains;
    expect(state.villains.map((villain) => villain.cardId)).toEqual([LEADER_ONE.id, LEADER_TWO.id]);
    expect(leaderOne!.encounterDeckId).not.toBe(leaderTwo!.encounterDeckId);
    expect(state.gameAreas.map((area) => [area.areaId, area.playerIds, area.villainIds])).toEqual([
      ["a1", seats[0], [leaderOne!.instanceId]],
      ["a2", seats[1], [leaderTwo!.instanceId]],
    ]);
    // "The villain" and "the encounter deck" of the table are the active (registration) team's.
    expect(state.activeVillainId).toBe(leaderOne!.instanceId);
  });

  it("puts each team's main scheme deck in its area, flipped to 1B, with starting threat for its own team's size", () => {
    const schemes = sharedMainSchemes(state);
    expect(schemes.map((scheme) => [scheme.cardId, scheme.gameAreaId, scheme.faceupSide])).toEqual([
      [SCHEME_ONE.id, "a1", undefined],
      [SCHEME_TWO.id, "a2", undefined],
    ]);
    // 1 per player on team one's scheme, 2 per player on team two's (MC56 p. 20: per player counts your team only).
    expect(schemes.map((scheme) => mustInstance(state, scheme.instanceId).threat)).toEqual([
      1 * teamSize(state, TEAM_ONE),
      2 * teamSize(state, TEAM_TWO),
    ]);
    expect([teamSize(state, TEAM_ONE), teamSize(state, TEAM_TWO)]).toEqual([sizes[0], sizes[1]]);
  });

  it("shuffles each identity's obligation into the encounter deck of its player's own area (Q16 A)", () => {
    const [deckOne, deckTwo] = state.villains.map((villain) => villain.encounterDeckId);
    const obligations = (deck: string) => deckCards(state, deck).filter((id) => id.endsWith("-obligation"));
    const identityOf = (seat: string) => {
      const player = state.players.find((candidate) => candidate.playerId === seat)!;
      const identity = state.cardPool[player.identity.cardId];
      return identity?.type === "hero_identity" ? identity.obligationCardId : "";
    };
    expect(obligations(deckOne!)).toEqual(seats[0]!.map(identityOf).sort());
    expect(obligations(deckTwo!)).toEqual(seats[1]!.map(identityOf).sort());
  });

  it("sets each team's own leader's four basic player cards aside, ownerless, out of every deck", () => {
    const [one, two] = state.teams!;
    expect(one!.leaderCardIds?.map((id) => cardOf(state, id))).toEqual(LEADER_CARDS_ONE.map((card) => card.id));
    expect(two!.leaderCardIds?.map((id) => cardOf(state, id))).toEqual(LEADER_CARDS_TWO.map((card) => card.id));
    for (const id of [...one!.leaderCardIds!, ...two!.leaderCardIds!]) {
      expect(state.encounterSetAside).toContain(id);
      expect(mustInstance(state, id).ownerId).toBeNull();
    }
  });
});

describe("competitive setup", () => {
  it("logs the teams once, after gameCreated, and each area's setup in team order (Q4 A)", () => {
    const result = createGame(competitiveConfig({ sizes: [2, 2] }));
    if (!result.ok) throw new Error(result.error.message);
    const types = result.events.map((event) => event.type);
    expect(types.indexOf("teamsFormed")).toBe(types.indexOf("gameCreated") + 1);
    const switches = result.events.flatMap((event) =>
      event.type === "activeTeamChanged" ? [[event.teamId, event.phase]] : [],
    );
    expect(switches).toEqual([
      [TEAM_TWO, "setup"],
      [TEAM_ONE, "setup"],
    ]);
  });

  it("is deterministic: the same config builds the same state and log", () => {
    const config = competitiveConfig({ sizes: [2, 2] });
    expect(createGame(config)).toEqual(createGame(config));
  });

  it.each([
    [
      "three players on a team",
      { sizes: [3, 1] as const },
      "team 1 has 3 players; a competitive team has 1 or 2 (MC56 p. 14)",
    ],
  ])("refuses %s", (_, options, message) => {
    const result = createGame(competitiveConfig(options));
    expect(result.ok ? null : result.error).toMatchObject({ code: "invalid_setup", message });
  });

  it("refuses the resistance team listed first: registration goes first (MC56 p. 16)", () => {
    const config = competitiveConfig();
    const [one, two] = config.competitive!.teams;
    const swapped = createGame({
      ...config,
      competitive: {
        teams: [
          { ...two!, side: "registration" },
          { ...one!, side: "registration" },
        ],
      },
    });
    expect(swapped.ok ? null : swapped.error.code).toBe("invalid_setup");
  });

  it("still refuses competitive mode with a single scenario (mode_unavailable)", () => {
    const { competitive: _teams, ...single } = competitiveConfig();
    const result = createGame(single);
    expect(result.ok ? null : result.error.code).toBe("mode_unavailable");
  });

  it("refuses the teams' scenarios without gameMode competitive", () => {
    const { gameMode: _mode, ...noMode } = competitiveConfig();
    const result = createGame(noMode);
    expect(result.ok ? null : result.error.code).toBe("invalid_setup");
  });
});
