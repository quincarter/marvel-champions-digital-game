/**
 * Civil War competitive setup with the real cards (docs/competitive-mode-plan.md M1, M2): each team faces the scenario
 * the other built, with the Standard PvP set in place of the Standard set; each 1A Setup finds the Choosing Sides of
 * its own side of the table and the team reveals it; the four basic player cards of each team's own leader are set
 * aside; one shared round of four team phases replays from its log.
 *
 * Sources: MC56 pp. 3, 14-16, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); Q4 A, Q13 A, Q14, Q15, Q16 A
 * per owner decision 2026-11-20.
 */

import { describe, expect, it } from "vitest";
import {
  areaOfCard,
  createGame,
  encounterDeckOf,
  replay,
  sessionApply,
  startSession,
  type GameSession,
  type GameState,
} from "@mc/engine";
import { firstLegal } from "../testing/harness.js";
import { civilWarCompetitive, leaderPlayerCardIds } from "./competitive.js";
import { WAVE10_DEPS } from "./index.js";

const IRON_MAN = "registration-iron-man";
const CAPTAIN_AMERICA = "resistance-captain-america";

const game = (sizes: 1 | 2) =>
  civilWarCompetitive({
    seed: 56,
    teams: [
      {
        leaderScenarioId: IRON_MAN,
        players:
          sizes === 1
            ? [{ starterDeckId: "tigra-aggression" }]
            : [{ starterDeckId: "tigra-aggression" }, { starterDeckId: "core-spider-man-justice" }],
      },
      {
        leaderScenarioId: CAPTAIN_AMERICA,
        players:
          sizes === 1
            ? [{ starterDeckId: "hulkling-protection" }]
            : [{ starterDeckId: "hulkling-protection" }, { starterDeckId: "core-she-hulk-aggression" }],
      },
    ],
  });

/** Answers every open choice with the default pick. */
function settled(session: GameSession): GameSession {
  let current = session;
  for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
    if (guard > 300) throw new Error("choices did not settle");
    const choice = current.state.pendingChoice;
    const result = sessionApply(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current.state),
      },
      WAVE10_DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    current = result.session;
  }
  return current;
}

const start = (sizes: 1 | 2): GameSession => {
  const created = createGame(game(sizes), WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settled(startSession(created.state));
};

const cardIdOf = (state: GameState, id: string): string => state.instances[id]!.cardId;

describe.each([1, 2] as const)("a %dv%d Civil War competitive game", (size) => {
  const config = game(size);
  const session = start(size);
  const state = session.state;

  it("trades the scenarios: registration faces Captain America, resistance faces Iron Man", () => {
    const [registration, resistance] = config.competitive!.teams;
    expect(registration.faces.villain.villainCardId).toBe("56137");
    expect(resistance.faces.villain.villainCardId).toBe("56059");
    expect(state.villains.map((villain) => villain.cardId)).toEqual(["56137", "56059"]);
    expect(state.teams?.map((team) => [team.side, team.playerIds.length])).toEqual([
      ["registration", size],
      ["resistance", size],
    ]);
  });

  it("builds each encounter deck with its side's Standard PvP set instead of the Standard set (MC56 p. 3)", () => {
    const [registration, resistance] = config.competitive!.teams;
    const deck = (team: typeof registration) => team.faces.villain.encounterDeck as readonly string[];
    // The resistance-built scenario holds the resistance printing, the registration-built one the registration's.
    expect(
      deck(registration)
        .filter((id) => ["56203", "56204", "56205", "56206a"].includes(id))
        .sort(),
    ).toEqual(["56203", "56204", "56205", "56205", "56206a"]);
    expect(
      deck(resistance)
        .filter((id) => ["56125", "56126", "56127", "56128a"].includes(id))
        .sort(),
    ).toEqual(["56125", "56126", "56127", "56127", "56128a"]);
    const standard = config.cards.filter(
      (card) => "encounterSetIds" in card && card.encounterSetIds.includes("standard" as never),
    );
    for (const team of [registration, resistance])
      expect(deck(team).filter((id) => standard.some((card) => card.id === id))).toEqual([]);
  });

  it("each 1A Setup reveals the Choosing Sides of its own side of the table, with 4 threat per player of that team", () => {
    for (const [index, area] of state.gameAreas.entries()) {
      const choosing = area.sideSchemeIds.filter((id) => ["56128a", "56206a"].includes(cardIdOf(state, id)));
      expect(choosing).toHaveLength(1);
      const id = choosing[0]!;
      // The copy from the deck this team faces: the resistance printing for registration, and the other way round.
      expect(cardIdOf(state, id)).toBe(index === 0 ? "56206a" : "56128a");
      expect(areaOfCard(state, id)?.areaId).toBe(area.areaId);
      expect(state.instances[id]!.threat).toBe(4 * size);
    }
    // Neither copy is left in a deck.
    for (const deckId of state.encounterDeckOrder) {
      const piles = encounterDeckOf(state, deckId);
      const left = [...piles.deck, ...piles.discard].map((id) => cardIdOf(state, id));
      expect(left.filter((cardId) => cardId === "56128a" || cardId === "56206a")).toEqual([]);
    }
  });

  it("sets aside each team's own leader's four basic player cards", () => {
    const [registration, resistance] = state.teams!;
    expect(registration!.leaderCardIds?.map((id) => cardIdOf(state, id))).toEqual([...leaderPlayerCardIds(IRON_MAN)]);
    expect(resistance!.leaderCardIds?.map((id) => cardIdOf(state, id))).toEqual([
      ...leaderPlayerCardIds(CAPTAIN_AMERICA),
    ]);
    expect(leaderPlayerCardIds(IRON_MAN)).toEqual(["56129", "56130", "56131", "56132"]);
    expect(leaderPlayerCardIds(CAPTAIN_AMERICA)).toEqual(["56207", "56208", "56209", "56210"]);
  });

  it("plays one shared round of four team phases and replays it from the log", () => {
    let current = session;
    for (let guard = 0; !(current.state.round === 2 && current.state.step.kind === "turn"); guard++) {
      if (guard > 40 || current.state.outcome) throw new Error("the round did not finish");
      const step = current.state.step;
      if (step.kind !== "turn") throw new Error(`not at a turn: ${step.phase}/${step.kind}`);
      const result = sessionApply(current, { type: "endTurn", playerId: step.activePlayerId }, WAVE10_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      current = settled(result.session);
    }
    expect(current.state.activeTeamId).toBe("t1");
    const replayed = replay(current.log, WAVE10_DEPS);
    expect(replayed.ok && replayed.state).toEqual(current.state);
  });
});

describe("Civil War competitive team sizes", () => {
  const team = (leaderScenarioId: string, starterDeckIds: readonly string[]) => ({
    leaderScenarioId,
    players: starterDeckIds.map((starterDeckId) => ({ starterDeckId })),
  });
  const ONE_REG = ["tigra-aggression"];
  const TWO_REG = ["tigra-aggression", "core-spider-man-justice"];
  const ONE_RES = ["hulkling-protection"];
  const TWO_RES = ["hulkling-protection", "core-she-hulk-aggression"];

  // MC56 p. 14: "This mode can be played either 1v1 ... or 2v2"; no 1v2 or 2v1.
  it.each([
    ["1v2", ONE_REG, TWO_RES, /the teams have 1 and 2 players; competitive mode is 1v1 or 2v2 \(MC56 p\. 14\)/],
    ["2v1", TWO_REG, ONE_RES, /the teams have 2 and 1 players; competitive mode is 1v1 or 2v2 \(MC56 p\. 14\)/],
  ])("refuses a %s game", (_, registration, resistance, message) => {
    expect(() =>
      civilWarCompetitive({
        seed: 56,
        teams: [team(IRON_MAN, registration), team(CAPTAIN_AMERICA, resistance)],
      }),
    ).toThrow(message);
  });
});
