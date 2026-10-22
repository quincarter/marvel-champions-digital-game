/**
 * `hasStat`: which characters have no value for a stat at all. Ruling April 17, 2025
 * (docs/rulings/post-rrg-1-6/09-april-2025.md): "Since Alter-Egos do not have an ATK value, they are not valid targets
 * for Restrained". Only an identity's face is judged: RRG 1.8 "Dash (Value)" (p. 15) ranks an ally with a dash for its
 * SCH as having SCH 0 ("the ally with the lowest SCH"), so allies have every stat.
 */

import { describe, expect, it } from "vitest";
import { hasStat, mustPlayer } from "./query.js";
import type { Form, GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAlly } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const PACIFIST = stubAlly({ id: "pacifist", cost: 0, atk: null, thw: 1, hp: 3 });
const withForm = (state: GameState, form: Form): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form } })),
});

describe("hasStat (ruling April 17, 2025; RRG 1.8 p. 15)", () => {
  const start = gameAtFirstTurn({ deps: depsOf(), cards: [PACIFIST], deck: [PACIFIST.id] });
  const { state, id: ally } = playerCardIntoPlay(start, PACIFIST.id);
  const identity = mustPlayer(state, P1).identity.instanceId;

  it("an alter-ego has no ATK, THW or DEF, only REC", () => {
    const alterEgo = withForm(state, "alterEgo");
    expect((["atk", "thw", "def", "rec"] as const).map((stat) => hasStat(alterEgo, identity, stat))).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("a hero has ATK, THW and DEF, no REC", () => {
    const hero = withForm(state, "hero");
    expect((["atk", "thw", "def", "rec"] as const).map((stat) => hasStat(hero, identity, stat))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("an ally has every stat, a dashed ATK and an unprinted SCH included", () => {
    expect((["atk", "thw", "sch"] as const).map((stat) => hasStat(state, ally, stat))).toEqual([true, true, true]);
  });
});
