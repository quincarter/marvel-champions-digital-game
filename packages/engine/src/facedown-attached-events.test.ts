/**
 * docs/phase7-wave5.md §3.15: facedown attached cards — playable events, a count, a maximum. Synthetic cards shaped like
 * George Stacy (`sm` 27018: "Events attached to George Stacy may be played as if they were in your hand. Action: Exhaust
 * George Stacy → attach 1 event from your hand facedown here (to a maximum of 3)") and Spider-Man Noir ("X is equal to
 * the number of facedown cards attached").
 *
 * Sources: ruling Mar 30, 2026 (1) (George Stacy's "to a maximum of 3" is local to the ability); RRG 1.8 "Facedown".
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { faceVisible } from "./visibility.js";

const self: TargetRef = { kind: "self" };
const attachedFacedown: ValueSpec = { kind: "count", query: { host: self, facedown: true } };

const STACY_CONSTANT = stubAbility("stacy.constant", {
  trigger: { kind: "constant", playableAttachments: { categories: ["event"] } },
  effects: [],
});
// "Attach 1 event from your hand facedown here (to a maximum of 3)": the maximum as an `if` on the count.
const STACY_ACTION = stubAbility("stacy.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "if",
      condition: { kind: "compare", left: attachedFacedown, op: "atMost", right: { kind: "const", value: 2 } },
      then: [
        {
          kind: "chooseCards",
          slot: "event",
          from: { kind: "zone", zone: "hand", player: { kind: "controller" }, filter: { categories: ["event"] } },
          chooser: { kind: "controller" },
          min: 1,
          max: 1,
        },
        { kind: "attach", card: { kind: "slot", slot: "event" }, to: self, facedown: true },
      ],
    },
    { kind: "setVar", name: "attached", value: attachedFacedown },
    { kind: "addCounters", target: self, counterType: "seen", amount: { kind: "var", name: "attached" } },
  ],
});
const STACY = stubSupport({ id: "stacy", cost: 0, abilities: [STACY_CONSTANT.ref, STACY_ACTION.ref] });

const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }] as EffectSpec[],
});
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });

const deps: EngineDeps = depsOf(STACY_CONSTANT, STACY_ACTION, ZAP_ACTION);

function start(): { readonly state: GameState; readonly stacy: string } {
  const state = gameAtFirstTurn({ cards: [STACY, ZAP], deps, deck: [STACY.id, ...copiesOf(ZAP.id, 5)] });
  const placed = playerCardIntoPlay(state, STACY.id);
  return { state: placed.state, stacy: placed.id };
}

function useStacy(state: GameState, stacy: string) {
  let s = giveCard(state, P1, ZAP.id).state;
  // Ready it between uses (test surgery): the exhaust cost is not what is under test.
  s = { ...s, instances: { ...s.instances, [stacy]: { ...mustInstance(s, stacy as never), exhausted: false } } };
  return driveSession(startSession(s), deps, [
    { type: "useAbility", playerId: P1, cardInstanceId: stacy as never, abilityId: STACY_ACTION.ref.id, payment: [] },
  ]);
}

const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("§3.15 events attached facedown, played as if from hand", () => {
  it("an event attached facedown is counted, then played faceup from there and resolves; replay deep-equal", () => {
    const { state, stacy } = start();
    const used = useStacy(state, stacy).session.state;
    const host = mustInstance(used, stacy as never);
    expect(host.attachments).toHaveLength(1);
    const [zap] = host.attachments;
    expect(mustInstance(used, zap!).facedownAs).not.toBeNull();
    // Its owner may look at it (table-wide today).
    expect(faceVisible(used, zap!)).toBe(true);
    expect(host.counters["seen"]).toBe(1);
    const { session } = driveSession(startSession(used), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: zap!, payment: [], attachToInstanceId: null },
    ]);
    const played = session.state;
    expect(villainDamage(played)).toBe(villainDamage(used) + 2);
    expect(mustPlayer(played, P1).discard).toContain(zap);
    expect(mustInstance(played, zap!)).toMatchObject({ facedownAs: null, faceup: true });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'to a maximum of 3': a fourth use attaches nothing", () => {
    let { state } = start();
    const { stacy } = start();
    for (let i = 0; i < 4; i++) state = useStacy(state, stacy).session.state;
    expect(mustInstance(state, stacy as never).attachments).toHaveLength(3);
  });
});
