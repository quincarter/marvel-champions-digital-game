/**
 * "The first ally played each round" by anyone (`Predicate playedThisRound`, `player: each`; Living Legend 03001b) in
 * The Once and Future Kang's split game areas (docs/phase7-wave2.md §3.1), read from `GameState.playedInAreaThisRound`:
 * an area counts its own plays and those made before the split, and an area that joins another brings its plays along.
 */
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { createCtx } from "./ctx.js";
import { gameAreaId, type PlayerId } from "./ids.js";
import { joinGameArea } from "./resolve/game-areas.js";
import { type EffectContext, evaluate } from "./select.js";
import type { Predicate } from "./spec.js";
import type { GameAreaState, GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const deps: EngineDeps = depsOf();
const FIRST_ALLY: Predicate = { kind: "playedThisRound", player: { kind: "each" }, cardType: "ally", atMost: 0 };
const asP1: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

const area = (id: string, player: PlayerId): GameAreaState => ({
  areaId: gameAreaId(id),
  playerIds: [player],
  mainScheme: null,
  villainIds: [],
  activeVillainId: null,
  sideSchemeIds: [],
  formerSchemeIds: [],
});

/** Split into one area each, with `inArea` the round's plays by area and P2 the one who made them. */
function split(inArea: Readonly<Record<string, number>>): GameState {
  const base = gameAtFirstTurn({ cards: [], deps, players: 2 });
  const total = Object.values(inArea).reduce((a, b) => a + b, 0);
  return {
    ...base,
    gameAreas: [area("area-1", P1), area("area-2", P2)],
    nextGameAreaSeq: 3,
    playedByPlayerThisRound: total > 0 ? { [`${P2}:ally`]: total } : {},
    playedInAreaThisRound: inArea,
  };
}

describe("the first ally played each round, by game area", () => {
  it("an ally played in the other area leaves this area's first ally to come", () => {
    expect(evaluate(split({ "area-2:ally": 1 }), FIRST_ALLY, asP1)).toBe(true);
  });

  it("an ally played before the split counts in every area", () => {
    expect(evaluate(split({ ":ally": 1 }), FIRST_ALLY, asP1)).toBe(false);
  });

  it("an area that joins another brings its plays this round: the joined area's first ally is spent", () => {
    const ctx = createCtx(split({ "area-2:ally": 1 }), deps);
    joinGameArea(ctx, gameAreaId("area-2"), gameAreaId("area-1"));
    expect(ctx.state.gameAreas.map((a) => a.areaId)).toEqual(["area-1"]);
    expect(ctx.state.playedInAreaThisRound).toEqual({ "area-1:ally": 1 });
    expect(evaluate(ctx.state, FIRST_ALLY, asP1)).toBe(false);
  });

  it("a game saved before plays were kept by area counts every player's plays", () => {
    const old = split({});
    const { playedInAreaThisRound: _dropped, ...saved } = { ...old, playedByPlayerThisRound: { [`${P1}:ally`]: 1 } };
    expect(evaluate(saved, FIRST_ALLY, asP1)).toBe(false);
    // A later play recorded by area alone does not hide the one made before it was kept.
    const later = {
      ...saved,
      playedByPlayerThisRound: { [`${P1}:ally`]: 1, [`${P2}:ally`]: 1 },
      playedInAreaThisRound: { "area-2:ally": 1 },
    };
    expect(evaluate(later, FIRST_ALLY, asP1)).toBe(false);
    // Another player's ally from such a save, made before the split or not, withholds this area's first.
    const theirs = { ...saved, playedByPlayerThisRound: { [`${P2}:ally`]: 1 } };
    expect(evaluate(theirs, FIRST_ALLY, asP1)).toBe(false);
  });
});
