/**
 * `RuleSpec attacksDealExtraDamage.perCounterOnTarget` (#890 item 10), on synthetic cards shaped like Sentinel's
 * Expose insert (the `sentinel-tw` community pack): "When a character with one or more Exposed status cards is
 * attacked, discard all Exposed status cards from that character. That attack deals 1 additional damage for each
 * Exposed status card discarded this way." Exposed is carried as `exposed` counters; a support holds the rule and a
 * forced response to the attack removes them. The author's ruling (T-Wrecks, 2026-11-11): the additional damage is part
 * of the one instance, so a tough status card blocks the whole boosted instance.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import type { GameState } from "./state.js";
import { mustInstance } from "./query.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubVillain } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const EXPOSED = { categories: ["villain", "minion"], hasCounter: "exposed" } as const;
const PROTOCOL_CONSTANT = stubAbility("protocol.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "attacksDealExtraDamage",
        amount: 1,
        perCounterOnTarget: "exposed",
        target: { categories: ["villain", "minion"] },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
/** "After a character with Exposed is attacked, discard all its Exposed." */
const PROTOCOL_RESPONSE = stubAbility("protocol.response", {
  trigger: { kind: "response", forced: true, on: { on: "characterAttacked", targetIs: EXPOSED } },
  effects: [{ kind: "removeCounters", target: { kind: "eventTarget" }, counterType: "exposed" }],
} satisfies AbilityDefinition);
const PROTOCOL = stubSupport({ id: "protocol", cost: 0, abilities: [PROTOCOL_CONSTANT.ref, PROTOCOL_RESPONSE.ref] });
/** "Hero Action (attack): Deal 3 damage to the villain." */
const LANCE_ACTION = stubAbility("lance.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }],
} satisfies AbilityDefinition);
const LANCE = stubEvent({ id: "lance", cost: 0, abilities: [LANCE_ACTION.ref] });
const VILLAIN = stubVillain({ id: "plain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const deps: EngineDeps = depsOf(PROTOCOL_CONSTANT, PROTOCOL_RESPONSE, LANCE_ACTION);

function start(exposed: number, tough = false): { state: GameState; villain: InstanceId; lance: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [PROTOCOL, LANCE, VILLAIN, SCHEME],
    deps,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deck: [PROTOCOL.id, LANCE.id],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const put = playerCardIntoPlay(hero, PROTOCOL.id, P1);
  const villain = put.state.villains[0]!.instanceId;
  const v = mustInstance(put.state, villain);
  const state: GameState = {
    ...put.state,
    instances: {
      ...put.state.instances,
      [villain]: {
        ...v,
        counters: { ...v.counters, ...(exposed > 0 ? { exposed } : {}) },
        statuses: { ...v.statuses, tough: tough ? 1 : 0 },
      },
    },
  };
  const given = giveCard(state, P1, LANCE.id);
  return { state: given.state, villain, lance: given.id };
}

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
function run(state: GameState, command: Command): GameState {
  const { state: after, session } = runCommands(state, deps, command);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  return after;
}

describe("Exposed as counters: attacks deal 1 additional damage per counter, then they are discarded (#890 item 10)", () => {
  it("2 Exposed: the attack deals 3 + 2, and the counters are gone", () => {
    const { state, villain, lance } = start(2);
    const after = run(state, play(lance));
    expect(mustInstance(after, villain).damage).toBe(5);
    expect(mustInstance(after, villain).counters.exposed ?? 0).toBe(0);
  });

  it("no Exposed: no additional damage", () => {
    const { state, villain, lance } = start(0);
    expect(mustInstance(run(state, play(lance)), villain).damage).toBe(3);
  });

  it("a tough status card blocks the whole boosted instance, and the Exposed are still discarded", () => {
    const { state, villain, lance } = start(2, true);
    const after = run(state, play(lance));
    expect(mustInstance(after, villain).damage).toBe(0);
    expect(mustInstance(after, villain).statuses.tough).toBe(0);
    expect(mustInstance(after, villain).counters.exposed ?? 0).toBe(0);
  });
});
