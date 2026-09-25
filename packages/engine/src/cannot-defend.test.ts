/**
 * docs/phase7-wave4.md §3.31: a character that cannot defend. Synthetic cards shaped like Grant Ward (`aos` 50022:
 * "Grant Ward cannot defend."), Intangible (`vision` 26002: "Vision cannot attack or defend.") and Tracking Display
 * (`sm` 27152: "Each character cannot defend against attached villain's attacks.").
 *
 * Sources: the cards' own text; RRG 1.8 "Defend, Defense" (p. 16), "'Cannot'" (p. 11).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { mustPlayer } from "./query.js";
import { legalDefenders } from "./resolve/index.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubMinion, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const WARD_CONSTANT = stubAbility("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotDefend", target: { self: true } }] },
  effects: [],
});
const WARD = stubAlly({ id: "ward", cost: 0, atk: 2, thw: 1, hp: 3, abilities: [WARD_CONSTANT.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3 });
/** "Each character cannot defend against [the villain]'s attacks." */
const DISPLAY_CONSTANT = stubAbility("display.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "cannotDefend", target: { categories: ["character"] }, attacker: { categories: ["villain"] } }],
  },
  effects: [],
});
const DISPLAY = stubSupport({ id: "display", cost: 0, abilities: [DISPLAY_CONSTANT.ref] });
const deps: EngineDeps = depsOf(WARD_CONSTANT, DISPLAY_CONSTANT);

function start(): { state: GameState; ward: string; buddy: string; identity: string } {
  const base = gameAtFirstTurn({
    cards: [WARD, BUDDY, GRUNT, DISPLAY],
    deps,
    encounter: copiesOf(GRUNT.id, 5),
    deck: [WARD.id, BUDDY.id, DISPLAY.id],
  });
  const hero = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const ward = playerCardIntoPlay(hero, WARD.id);
  const buddy = playerCardIntoPlay(ward.state, BUDDY.id);
  return {
    state: buddy.state,
    ward: ward.id,
    buddy: buddy.id,
    identity: mustPlayer(buddy.state, P1).identity.instanceId,
  };
}

describe("§3.31 a character that cannot defend", () => {
  it("is never offered as a defender; the others still are", () => {
    const { state, ward, buddy, identity } = start();
    const defenders = legalDefenders(state, P1, deps, state.activeVillainId);
    expect(defenders).not.toContain(ward);
    expect(defenders).toEqual(expect.arrayContaining([identity, buddy]));
  });

  it("scoped to one enemy's attacks: nobody may defend the villain, but a minion's attack is defended as usual", () => {
    const { state, identity, buddy } = start();
    const withDisplay = playerCardIntoPlay(state, DISPLAY.id).state;
    expect(legalDefenders(withDisplay, P1, deps, withDisplay.activeVillainId)).toEqual([]);
    const grunt = minionEngagedWith(withDisplay, GRUNT.id, P1);
    expect(legalDefenders(grunt.state, P1, deps, grunt.id)).toEqual(expect.arrayContaining([identity, buddy]));
  });
});
