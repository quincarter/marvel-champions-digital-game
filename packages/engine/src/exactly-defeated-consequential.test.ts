/**
 * A thwart's `exactlyDefeated` result (`EXACTLY_DEFEATED_RESULT`), read in an ally's consequential-damage scope as
 * `thwart.exactlyDefeated`: synthetic support shaped like Sensei (`iron_fist` 64032: "Each Martial Artist ally you
 * control takes -2 consequential damage after they exactly defeat an enemy or side scheme"), the side scheme half.
 *
 * Sources: MC60 insert p. 4 (a scheme is exactly defeated when "defeated by a thwart that did not attempt to remove more
 * threat than was necessary"); RRG 1.8 "Consequential Damage" (p. 13): dealt after the thwart resolves.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { EXACTLY_DEFEATED_RESULT } from "./trigger-events.js";

const SENSEI_CONSTANT = stubAbility("sensei.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "reduceDamageTaken",
        target: { categories: ["ally"], controller: "you" },
        amount: 2,
        consequential: {
          from: "any",
          if: { kind: "varAtLeast", name: `thwart.${EXACTLY_DEFEATED_RESULT}`, amount: 1 },
        },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const SENSEI = stubSupport({ id: "sensei", cost: 0, abilities: [SENSEI_CONSTANT.ref] });
const STUDENT = stubAlly({ id: "student", cost: 0, atk: 1, thw: 2, hp: 5, consequentialThwart: 2 });
const HIDEOUT = stubSideScheme({ id: "hideout", startingThreat: 2 });

const deps: EngineDeps = depsOf(SENSEI_CONSTANT);

function thwarted(threat: number, withSensei = true): { state: GameState; student: InstanceId; scheme: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [SENSEI, STUDENT, HIDEOUT],
    deps,
    deck: [SENSEI.id, STUDENT.id],
    encounter: [HIDEOUT.id],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = encounterCardInVillainArea(heroes, HIDEOUT.id, threat);
  const sensei = withSensei ? playerCardIntoPlay(placed.state, SENSEI.id, P1).state : placed.state;
  const student = playerCardIntoPlay(sensei, STUDENT.id, P1);
  const after = driveSession(startSession(student.state), deps, [
    { type: "basicThwart", playerId: P1, thwarterInstanceId: student.id, schemeInstanceId: placed.id },
  ]).session.state;
  return { state: after, student: student.id, scheme: placed.id };
}

describe("an ally's thwart that exactly defeats a side scheme, read by its consequential damage", () => {
  it("THW 2 on a 2-threat side scheme: exactly defeated, so -2 consequential damage leaves none", () => {
    const run = thwarted(2);
    expect(run.state.villainArea).not.toContain(run.scheme);
    expect(mustInstance(run.state, run.student).damage).toBe(0);
  });

  it("THW 2 on a 1-threat side scheme: defeated with 1 to spare, not exact, so the full 2 is taken", () => {
    const run = thwarted(1);
    expect(run.state.villainArea).not.toContain(run.scheme);
    expect(mustInstance(run.state, run.student).damage).toBe(2);
  });

  it("THW 2 on a 3-threat side scheme: not defeated, so the full 2 is taken", () => {
    const run = thwarted(3);
    expect(run.state.villainArea).toContain(run.scheme);
    expect(mustInstance(run.state, run.student).damage).toBe(2);
  });

  it("control: without the constant, an exact defeat still takes the printed 2", () => {
    const run = thwarted(2, false);
    expect(mustInstance(run.state, run.student).damage).toBe(2);
  });
});
