/**
 * The villain phase's own counts as selectors (issues #765, #769): `stepOneThreats` split into its parts, and
 * `stepThreeDealCount`. RRG 1.8 "Villain Phase" (p. 47), "Acceleration Token" (p. 5), "Hazard Icon" (p. 21), "Modes of
 * Play" (p. 29).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import { startSession } from "../engine.js";
import { createGame } from "../setup.js";
import type { GameState } from "../state.js";
import { DEFAULT_DEPS } from "../abilities.js";
import { driveSession } from "../testing/drive.js";
import { stubMainScheme, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "../testing/scenario.js";
import { copiesOf } from "../testing/wave3.js";
import { stepOneThreatOf, stepThreeDealCount } from "./step-one-threat.js";

const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(2) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

function start(): GameState {
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, SCHEME, VILLAIN, FILLER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: copiesOf(FILLER.id, 20),
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    },
    DEFAULT_DEPS,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), DEFAULT_DEPS).session.state;
}

describe("stepOneThreats (#765)", () => {
  it("splits the stage's acceleration from the tokens on the scheme", () => {
    const base = start();
    const state: GameState = { ...base, mainScheme: { ...base.mainScheme, accelerationTokens: 3 } };
    expect(stepOneThreatOf(state, DEFAULT_DEPS, state.mainScheme.instanceId)).toEqual({
      schemeInstanceId: state.mainScheme.instanceId,
      printed: 2,
      tokens: 3,
      otherTokens: 0,
      icons: 0,
      total: 5,
    });
  });

  it("is null for a card that is not a main scheme", () => {
    const state = start();
    expect(stepOneThreatOf(state, DEFAULT_DEPS, state.villains[0]!.instanceId)).toBeNull();
  });
});

describe("stepThreeDealCount (#769)", () => {
  it("deals one card to each player, X more each at heroic level X", () => {
    const state = start();
    expect(stepThreeDealCount(state, DEFAULT_DEPS)).toBe(1);
    const heroic: GameState = { ...state, scenarioRules: { ...state.scenarioRules, heroicLevel: 2 } };
    expect(stepThreeDealCount(heroic, DEFAULT_DEPS)).toBe(3);
  });

  it("deals nothing once every player is eliminated", () => {
    const state = start();
    const out: GameState = { ...state, players: state.players.map((p) => ({ ...p, eliminated: true })) };
    expect(stepThreeDealCount(out, DEFAULT_DEPS)).toBe(0);
  });
});
