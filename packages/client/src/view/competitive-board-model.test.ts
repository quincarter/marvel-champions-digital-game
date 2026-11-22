/**
 * The board model of a Civil War Competitive game (issue #883, plan M9): the viewer's own game area is the main table,
 * the other side is a compact strip, and the whose-turn line names the active side.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { sessionApply, startSession, createGame, type GameState } from "@mc/engine";
import { civilWarCompetitive } from "@mc/cards";
import { gameDeps } from "../content/game-deps.js";
import { boardModel, competitiveTurnLine } from "./board-model.js";

const deps = gameDeps();
let state: GameState;

const settle = (initial: GameState): GameState => {
  let session = startSession(initial);
  for (let guard = 0; session.state.pendingChoice && guard < 400; guard++) {
    const choice = session.state.pendingChoice;
    const first = choice.options?.[0];
    const result = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: first ? [first.optionId] : [],
      },
      deps,
    );
    if (!result.ok) break;
    session = result.session;
  }
  return session.state;
};

beforeAll(() => {
  const setup = civilWarCompetitive({
    seed: 3,
    teams: [
      { leaderScenarioId: "registration-iron-man", players: [{ starterDeckId: "tigra-aggression" }] },
      { leaderScenarioId: "resistance-captain-america", players: [{ starterDeckId: "hulkling-protection" }] },
    ],
  });
  const created = createGame(setup, deps);
  if (!created.ok) throw new Error(created.error.message);
  state = settle(created.state);
});

describe("the competitive board model", () => {
  test("each viewer's main table is the area they fight in", () => {
    const registration = boardModel(state, "p1" as never, deps);
    const resistance = boardModel(state, "p2" as never, deps);
    // The registration team fights the leader the resistance team built.
    expect(registration.villain?.name).toMatch(/Captain America/);
    expect(resistance.villain?.name).toMatch(/Iron Man/);
    expect(registration.villains).toHaveLength(1);
    expect(registration.mainScheme.instanceId).not.toBe(resistance.mainScheme.instanceId);
    expect(registration.extraMainSchemes).toEqual([]);
    expect(registration.encounterPiles.deck).toBeGreaterThan(0);
  });

  test("the other side is a strip with counts only: no hand, no deck contents", () => {
    const strip = boardModel(state, "p1" as never, deps).competitive!.other;
    expect(strip.side).toBe("resistance");
    expect(strip.leader?.name).toMatch(/Iron Man/);
    expect(strip.heroes).toHaveLength(1);
    expect(Object.keys(strip.heroes[0]!).sort()).toEqual(["eliminated", "handCount", "hp", "name", "playerId"]);
    expect(strip.encounterDeck).toBeGreaterThan(0);
    expect(typeof strip.encounterDeck).toBe("number");
  });

  test("the whose-turn line names the active side and says whether yours is inactive", () => {
    const first = boardModel(state, "p1" as never, deps);
    const second = boardModel(state, "p2" as never, deps);
    expect(first.competitive!.activeSide).toBe("registration");
    expect(first.competitive!.inactive).toBe(false);
    expect(first.stepLabel).toMatch(/Registration/);
    expect(first.stepLabel).toMatch(/your turn/);
    expect(second.competitive!.inactive).toBe(true);
    expect(second.stepLabel).toMatch(/Registration.*hero.*inactive/);
  });

  test("the line words each phase and viewer", () => {
    expect(competitiveTurnLine("resistance", "villain", false)).toBe(
      "Resistance's villain phase: your side is inactive",
    );
    expect(competitiveTurnLine("resistance", "hero", true)).toBe("Resistance's hero phase: your turn");
  });

  test("a 1v1 viewer has no teammates in the seat row", () => {
    expect(boardModel(state, "p1" as never, deps).team).toEqual([]);
  });
});
