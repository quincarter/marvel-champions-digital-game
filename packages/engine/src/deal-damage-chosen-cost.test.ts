/**
 * `AbilityCost.dealDamage.choose` (docs/phase7-wave8.md §3.74): a cost that deals damage to a character the payer
 * picks, any player's. Synthetic cards shaped like "Action: Deal 1 damage to another friendly character → place 1
 * mark counter on that character."
 *
 * Sources: RRG 1.8 "Cost" (p. 13: paid before the effects; p. 14: "If dealing damage is a cost, that cost is considered
 * paid even if some or all of that damage is prevented"); "Friendly" (p. 20): every player's identity and allies.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, CostChoices } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMinion } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const FRIEND = { categories: ["identity", "ally"], excluding: { kind: "self" } } as const;
// "Action: Deal 1 damage to another friendly character → place 1 mark counter on that character."
const DRAIN = stubAbility("drain.action", {
  trigger: { kind: "action" },
  cost: {
    dealDamage: { target: { kind: "slot", slot: "friend" }, amount: 1, choose: { slot: "friend", query: FRIEND } },
  },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "slot", slot: "friend" },
      counterType: "mark",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const LEECH = stubAlly({ id: "leech", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [DRAIN.ref] });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3 });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3 });

const deps: EngineDeps = depsOf(DRAIN);

function start(players: 1 | 2 = 2) {
  const state = gameAtFirstTurn({
    cards: [LEECH, PAL, THUG],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 29), THUG.id],
    deck: [LEECH.id, PAL.id],
    players,
  });
  const leech = playerCardIntoPlay(state, LEECH.id);
  const pal = players === 2 ? playerCardIntoPlay(leech.state, PAL.id, P2) : { state: leech.state, id: null };
  const thug = minionEngagedWith(pal.state, THUG.id);
  const identity = (player: typeof P1) => mustPlayer(thug.state, player).identity.instanceId;
  return {
    state: thug.state,
    leech: leech.id,
    pal: pal.id,
    thug: thug.id,
    hero: identity(P1),
    other: players === 2 ? identity(P2) : null,
  };
}
const use = (card: InstanceId, costChoices?: CostChoices): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: DRAIN.ref.id,
  payment: [],
  ...(costChoices ? { costChoices } : {}),
});
const run = (state: GameState, command: Command) => driveSession(startSession(state), deps, [command]).session.state;

describe("a deal-damage cost on a character the payer picks", () => {
  it("the payer's own identity: 1 damage as the cost, then the effects name that character", () => {
    const table = start();
    const after = run(table.state, use(table.leech, { friend: [table.hero] }));
    expect(mustInstance(after, table.hero)).toMatchObject({ damage: 1, counters: { mark: 1 } });
    expect(mustInstance(after, table.leech).damage).toBe(0);
  });

  it("another player's ally or identity can be picked: it is the cost's target, not a card paying it", () => {
    const table = start();
    const ally = run(table.state, use(table.leech, { friend: [table.pal!] }));
    expect(mustInstance(ally, table.pal!)).toMatchObject({ damage: 1, counters: { mark: 1 } });
    const hero = run(table.state, use(table.leech, { friend: [table.other!] }));
    expect(mustInstance(hero, table.other!)).toMatchObject({ damage: 1, counters: { mark: 1 } });
  });

  it("'another friendly character': the ability's own card and an enemy are refused, and nothing is paid", () => {
    const table = start();
    for (const pick of [table.leech, table.thug]) {
      expect(applyCommand(table.state, use(table.leech, { friend: [pick] }), deps).ok).toBe(false);
    }
    expect(applyCommand(table.state, use(table.leech, { friend: [table.hero, table.pal!] }), deps).ok).toBe(false);
  });

  it("several candidates: the command must name one; one candidate: the pick is forced", () => {
    const two = start(2);
    expect(applyCommand(two.state, use(two.leech), deps).ok).toBe(false);
    const one = start(1);
    const after = run(one.state, use(one.leech));
    expect(mustInstance(after, one.hero)).toMatchObject({ damage: 1, counters: { mark: 1 } });
  });

  it("dealing is paid even if prevented: a tough status card takes the damage and the effects still resolve", () => {
    const table = start();
    const tough: GameState = {
      ...table.state,
      instances: {
        ...table.state.instances,
        [table.hero]: { ...mustInstance(table.state, table.hero), statuses: { stunned: 0, confused: 0, tough: 1 } },
      },
    };
    const after = run(tough, use(table.leech, { friend: [table.hero] }));
    expect(mustInstance(after, table.hero)).toMatchObject({ damage: 0, counters: { mark: 1 } });
    expect(mustInstance(after, table.hero).statuses.tough).toBe(0);
  });

  it("legalActions offers the ability once per character it may pick", () => {
    const table = start();
    const legal = legalActions(table.state, P1, deps);
    if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
    const action = legal.legal.find((a) => a.example.type === "useAbility" && a.example.cardInstanceId === table.leech);
    const offered = action?.targets ?? [];
    expect(new Set(offered)).toEqual(new Set([table.hero, table.other, table.pal]));
  });
});
