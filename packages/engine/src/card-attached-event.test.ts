/**
 * `TriggerEvent cardAttached` (docs/phase7-wave8.md §3.61): an ability attached a card to a host. Synthetic cards shaped
 * like "Forced Response: After you attach a [chill] upgrade to an enemy, take 1 damage." on a support.
 *
 * Sources: RRG 1.8 "Attach To" (p. 8); "Response" (p. 36): resolves after its triggering condition, here the attach.
 * Announced by the one way an ability attaches a card (`attachCard`: the `attach` effect and an attach cost), once per
 * card that landed on a new host, and only when an ability listens.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const CHILL_QUERY = { categories: ["upgrade"], name: "chill" } as const;

// "Forced Response: After you attach a chill upgrade to an enemy, take 1 damage."
const TEMPER_RESPONSE = stubAbility("temper.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "cardAttached", sourceIs: CHILL_QUERY, targetIs: { categories: ["enemy"] }, playerIs: "controller" },
  },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["identity"], controller: "you" } },
      amount: { kind: "const", value: 1 },
      taken: true,
    },
  ],
});
const TEMPER = stubSupport({ id: "temper", cost: 0, abilities: [TEMPER_RESPONSE.ref] });
const CHILL = stubUpgrade({ id: "chill", cost: 0 });
const GADGET = stubUpgrade({ id: "gadget", cost: 0 });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 3 });

const event = (id: string, effects: readonly EffectSpec[], cost?: EngineDeps["abilities"][string]["cost"]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attach = (card: string, host: string) =>
  event(`attach-${card}-${host}`, [{ kind: "attach", card: named(card), to: named(host) }]);
const CHILL_ON_THUG = attach("chill", "thug");
const CHILL_ON_HERO = event("attach-chill-hero", [
  {
    kind: "attach",
    card: named("chill"),
    to: { kind: "each", query: { categories: ["identity"], controller: "you" } },
  },
]);
const GADGET_ON_THUG = attach("gadget", "thug");
// "Attach every chill to the thug." Two cards from one effect.
const ALL_CHILL_ON_THUG = event("attach-all-chill", [
  { kind: "attach", card: { kind: "each", query: CHILL_QUERY }, to: named("thug") },
]);
// "Attach chill to a minion →" (an attach cost).
const CHILL_AS_COST = event("chill-as-cost", [], {
  attach: { card: named("chill"), to: { slot: "host", query: { categories: ["minion"], name: "goon" } } },
});
const EVENTS = [CHILL_ON_THUG, CHILL_ON_HERO, GADGET_ON_THUG, ALL_CHILL_ON_THUG, CHILL_AS_COST];

const deps: EngineDeps = depsOf(TEMPER_RESPONSE, ...EVENTS.map((e) => e.ability));

function start(players: 1 | 2 = 1, chills = 1) {
  let state: GameState = gameAtFirstTurn({
    cards: [TEMPER, CHILL, GADGET, THUG, GOON, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 28), THUG.id, GOON.id],
    deck: [TEMPER.id, ...copiesOf(CHILL.id, 2), GADGET.id, ...EVENTS.map((e) => e.card.id)],
    players,
  });
  state = playerCardIntoPlay(state, TEMPER.id).state;
  const ids: InstanceId[] = [];
  for (let n = 0; n < chills; n++) {
    const next = playerCardIntoPlay(state, CHILL.id);
    state = next.state;
    ids.push(next.id);
  }
  state = playerCardIntoPlay(state, GADGET.id).state;
  const thug = minionEngagedWith(state, THUG.id);
  const goon = minionEngagedWith(thug.state, GOON.id);
  return { state: goon.state, chill: ids[0]!, thug: thug.id, goon: goon.id };
}
const damage = (state: GameState, player: PlayerId = P1): number =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const responses = (events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "abilityResolved" && String(e.abilityId) === "temper.forced-response").length;

describe("cardAttached: 'after you attach a chill upgrade to an enemy, take 1 damage'", () => {
  it("an attach effect that lands the card on an enemy is heard once, with the card already attached", () => {
    const table = start();
    const run = playFree(table.state, deps, CHILL_ON_THUG.card.id);
    expect(mustInstance(run.state, table.chill).attachedTo).toBe(table.thug);
    expect(responses(run.events)).toBe(1);
    expect(damage(run.state)).toBe(1);
    const moved = run.events.findIndex((e) => e.type === "cardMoved" && e.instanceId === table.chill);
    const hurt = run.events.findIndex((e) => e.type === "damageDealt");
    expect(moved).toBeGreaterThan(-1);
    expect(hurt).toBeGreaterThan(moved);
  });

  it("a card already on that host did not move: attaching it there again announces nothing", () => {
    const table = start();
    const first = playFree(table.state, deps, CHILL_ON_THUG.card.id);
    const again = playFree(first.state, deps, CHILL_ON_THUG.card.id);
    expect(responses(again.events)).toBe(0);
    expect(damage(again.state)).toBe(1);
  });

  it("another card attached, or the card attached to a host that is no enemy, is not heard", () => {
    const table = start();
    const gadget = playFree(table.state, deps, GADGET_ON_THUG.card.id);
    expect(damage(gadget.state)).toBe(0);
    const hero = playFree(gadget.state, deps, CHILL_ON_HERO.card.id);
    expect(mustInstance(hero.state, table.chill).attachedTo).toBe(mustPlayer(hero.state, P1).identity.instanceId);
    expect(damage(hero.state)).toBe(0);
  });

  it("two cards attached by one effect: one response each", () => {
    const table = start(1, 2);
    const run = playFree(table.state, deps, ALL_CHILL_ON_THUG.card.id);
    expect(mustInstance(run.state, table.thug).attachments).toHaveLength(2);
    expect(responses(run.events)).toBe(2);
    expect(damage(run.state)).toBe(2);
  });

  it("'you': another player's attach is not the support's controller's", () => {
    const table = start(2);
    const run = playFree(table.state, deps, CHILL_ON_THUG.card.id, P2);
    expect(mustInstance(run.state, table.chill).attachedTo).toBe(table.thug);
    expect(damage(run.state, P1)).toBe(0);
    expect(damage(run.state, P2)).toBe(0);
  });

  it("an attach cost is an attach by the payer", () => {
    const table = start();
    const run = playFree(table.state, deps, CHILL_AS_COST.card.id);
    expect(mustInstance(run.state, table.chill).attachedTo).toBe(table.goon);
    expect(responses(run.events)).toBe(1);
    expect(damage(run.state)).toBe(1);
  });

  it("with no listener in the registry nothing is announced", () => {
    const quiet: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
    const table = start();
    const run = playFree(table.state, quiet, CHILL_ON_THUG.card.id);
    expect(mustInstance(run.state, table.chill).attachedTo).toBe(table.thug);
    expect(run.events.some((e) => e.type === "framePushed" && /cardAttached/.test(e.description))).toBe(false);
    expect(damage(run.state)).toBe(0);
  });
});
