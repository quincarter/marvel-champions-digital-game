/**
 * #431: an optional interrupt on a player's card that answers an event but cannot be initiated (no valid target, RRG
 * 1.8 "Target", pp. 42–43; a cost that cannot be paid, "Initiating Abilities", p. 24, step 2) is not offered, and the
 * engine says so (`abilityNotOffered`, `unofferedAbilities`) so the client can tell its player why nothing was asked.
 * Synthetic cards answering one action's attack, as `unpayable-trigger-offer.test.ts` builds them.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubResource, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const BLAST = stubAbility("blast.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
});
const onBlast = { on: "attack", sourceAbility: "blast.action" } as const;
const plus = [{ kind: "modifyAttack", extraDamage: { kind: "const", value: 1 } }] as const;
const PAID = stubAbility("paid.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast },
  cost: { resources: { energy: 1 } },
  effects: plus,
});
const AIMED = stubAbility("aimed.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast },
  effects: [
    { kind: "chooseTarget", slot: "victim", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
    { kind: "dealDamage", target: { kind: "slot", slot: "victim" }, amount: { kind: "const", value: 1 } },
  ],
});
const TIRED = stubAbility("tired.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast },
  cost: { exhaustSelf: true },
  effects: [
    { kind: "chooseTarget", slot: "victim", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
    { kind: "dealDamage", target: { kind: "slot", slot: "victim" }, amount: { kind: "const", value: 1 } },
  ],
});
const FORCED = stubAbility("forced.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: onBlast },
  effects: [
    { kind: "chooseTarget", slot: "victim", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
    { kind: "dealDamage", target: { kind: "slot", slot: "victim" }, amount: { kind: "const", value: 1 } },
  ],
});
const BLASTER = stubSupport({ id: "blaster", cost: 0, abilities: [BLAST.ref] });
const PAYER = stubSupport({ id: "payer", cost: 0, abilities: [PAID.ref] });
const AIMER = stubSupport({ id: "aimer", cost: 0, abilities: [AIMED.ref] });
const TIRER = stubSupport({ id: "tirer", cost: 0, abilities: [TIRED.ref] });
const FORCER = stubSupport({ id: "forcer", cost: 0, abilities: [FORCED.ref] });
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 1 } });
const deps: EngineDeps = depsOf(BLAST, PAID, AIMED, TIRED, FORCED);

interface Table {
  readonly state: GameState;
  readonly blaster: InstanceId;
  readonly ids: Readonly<Record<string, InstanceId>>;
}

/** Blaster and every listener in play, the Tirer exhausted, and a hand of an Energy card or nothing. */
function table(energy: boolean): Table {
  const cards = [BLASTER, PAYER, AIMER, TIRER, FORCER, ENERGY];
  let state = gameAtFirstTurn({ cards, deps, deck: cards.map((c) => c.id) });
  const ids: Record<string, InstanceId> = {};
  for (const card of [BLASTER, PAYER, AIMER, TIRER, FORCER]) {
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    ids[card.id] = placed.id;
  }
  const given = energy ? giveCard(state, P1, ENERGY.id) : null;
  if (given) state = given.state;
  const hand = given ? [given.id] : [];
  const seat = mustPlayer(state, P1);
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand, discard: [...p.discard, ...seat.hand.filter((id) => !hand.includes(id))] } : p,
    ),
    instances: { ...state.instances, [ids.tirer!]: { ...mustInstance(state, ids.tirer!), exhausted: true } },
  };
  return { state, blaster: ids.blaster!, ids };
}

function blast(t: Table): { readonly events: readonly GameEvent[]; readonly offered: readonly string[] } {
  const result = applyCommand(
    t.state,
    { type: "useAbility", playerId: P1, cardInstanceId: t.blaster, abilityId: BLAST.ref.id, payment: [] },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const choice = result.state.pendingChoice;
  const offered = choice?.prompt.kind === "chooseTriggers" ? choice.options.map((o) => o.optionId) : [];
  return { events: result.events, offered };
}

const notOffered = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityNotOffered" ? [{ abilityId: e.abilityId, reason: e.reason }] : []));

describe("abilityNotOffered (#431)", () => {
  it("says which optional interrupts answered but could not be used, and why, once each", () => {
    const t = table(false);
    const { events, offered } = blast(t);
    expect(notOffered(events)).toEqual([
      { abilityId: PAID.ref.id, reason: "cannotPay" },
      { abilityId: AIMED.ref.id, reason: "noTarget" },
    ]);
    expect(events.filter((e) => e.type === "abilityNotOffered")).toEqual([
      expect.objectContaining({ instanceId: t.ids.payer, playerId: P1, timing: "interrupt" }),
      expect.objectContaining({ instanceId: t.ids.aimer, playerId: P1, timing: "interrupt" }),
    ]);
    expect(offered).toEqual([]);
  });

  it("an exhausted card's 'exhaust this' ability and a forced one are never reported", () => {
    const reported = notOffered(blast(table(false)).events).map((e) => e.abilityId);
    expect(reported).not.toContain(TIRED.ref.id);
    expect(reported).not.toContain(FORCED.ref.id);
  });

  it("an ability that is offered is never reported: with an Energy card in hand only the targetless one is", () => {
    const { events, offered } = blast(table(true));
    expect(notOffered(events)).toEqual([{ abilityId: AIMED.ref.id, reason: "noTarget" }]);
    expect(offered.some((id) => id.includes(PAID.ref.id))).toBe(true);
    for (const { abilityId } of notOffered(events)) expect(offered.some((id) => id.includes(abilityId))).toBe(false);
  });
});
