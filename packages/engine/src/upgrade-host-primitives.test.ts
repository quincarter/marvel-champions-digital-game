/**
 * Three upgrade-and-host primitives first needed by the community pack `yondu-dh` (each card-agnostic):
 *
 * - `attachedOnlyWhileInPlay` ("Yaka Arrow cannot be attached to cards unless it is in play"): read from the card
 *   wherever it is. Out of play no effect attaches it; played from hand it enters play attached to nothing, in its
 *   controller's play area; once in play, effects attach it and move it.
 * - `TriggerEvent cardUnattached` ("After the Yaka Arrow upgrade is removed from an enemy, deal 1 damage to that
 *   enemy"): one announcement for every way a card comes off a host (moved, returned to hand, discarded, the host
 *   leaving play), the host it left as `eventTarget`. A move is heard as removed, then attached.
 * - `RuleSpec cannotLeaveHost` ("Upgrades cannot be removed from Sav'rkk"): no effect takes a held card off its host,
 *   until the host leaves play, when the card goes with it as usual (RRG 1.8 "Attach To", p. 8).
 *
 * And a check on `TargetQuery.hasAttachment` read through `Predicate refMatches`, reported as never matching by the
 * pack's author: it matches a card attached through the engine (the report came from test surgery that set
 * `attachedTo` without the host's `attachments`).
 *
 * Synthetic cards throughout.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { evaluate } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const ARROW_QUERY: TargetQuery = { categories: ["upgrade"], name: "arrow" };
const def = (definition: AbilityDefinition) => definition;
const one = { kind: "const", value: 1 } as const;

// "Arrow cannot be attached to cards unless it is in play."
const ARROW_CONSTANT = stubAbility(
  "arrow.constant",
  def({ trigger: { kind: "constant", attachedOnlyWhileInPlay: true }, effects: [] }),
);
const ARROW = stubUpgrade({ id: "arrow", cost: 0, abilities: [ARROW_CONSTANT.ref] });
// A plain upgrade, for the "held" rule.
const GADGET = stubUpgrade({ id: "gadget", cost: 0 });
// "Forced Response: After the arrow is removed from an enemy, deal 1 damage to that enemy." (on a support)
const WHISTLE_RESPONSE = stubAbility(
  "whistle.response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "cardUnattached", sourceIs: ARROW_QUERY, targetIs: { categories: ["enemy"] } },
    },
    effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: one }],
  }),
);
// "Forced Response: After the arrow is attached to an enemy, deal 1 damage to that enemy."
const ATTACHED_RESPONSE = stubAbility(
  "attached.response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "cardAttached", sourceIs: ARROW_QUERY, targetIs: { categories: ["enemy"] } },
    },
    effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: one }],
  }),
);
const WHISTLE = stubSupport({ id: "whistle", cost: 0, abilities: [WHISTLE_RESPONSE.ref, ATTACHED_RESPONSE.ref] });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 5 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 5 });
// "Upgrades cannot be removed from the holder."
const HOLDER_CONSTANT = stubAbility(
  "holder.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "cannotLeaveHost", target: { categories: ["upgrade"], host: { kind: "self" } } }],
    },
    effects: [],
  }),
);
const HOLDER = stubMinion({ id: "holder", atk: 1, sch: 1, hp: 5, abilities: [HOLDER_CONSTANT.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attach = (card: string, host: string) =>
  event(`attach-${card}-${host}`, [{ kind: "attach", card: named(card), to: named(host) }]);
const ARROW_ON_THUG = attach("arrow", "thug");
const ARROW_ON_GOON = attach("arrow", "goon");
const ARROW_ON_HOLDER = attach("arrow", "holder");
const GADGET_ON_HOLDER = attach("gadget", "holder");
const ARROW_ON_HERO = event("attach-arrow-hero", [
  {
    kind: "attach",
    card: named("arrow"),
    to: { kind: "each", query: { categories: ["identity"], controller: "you" } },
  },
]);
const FIND_ARROW_ON_THUG = event("find-arrow-thug", [
  { kind: "findCard", query: { name: "arrow" }, to: { attachTo: named("thug") } },
]);
const RETURN_ARROW = event("return-arrow", [
  { kind: "moveCards", cards: { kind: "ref", ref: named("arrow") }, to: "hand" },
]);
const DISCARD_ARROW = event("discard-arrow", [{ kind: "discardFromPlay", target: named("arrow") }]);
const DISCARD_GADGET = event("discard-gadget", [{ kind: "discardFromPlay", target: named("gadget") }]);
const KILL_THUG = event("kill-thug", [
  { kind: "dealDamage", target: named("thug"), amount: { kind: "const", value: 9 } },
]);
const KILL_HOLDER = event("kill-holder", [
  { kind: "dealDamage", target: named("holder"), amount: { kind: "const", value: 9 } },
]);
const EVENTS = [
  ARROW_ON_THUG,
  ARROW_ON_GOON,
  ARROW_ON_HOLDER,
  GADGET_ON_HOLDER,
  ARROW_ON_HERO,
  FIND_ARROW_ON_THUG,
  RETURN_ARROW,
  DISCARD_ARROW,
  DISCARD_GADGET,
  KILL_THUG,
  KILL_HOLDER,
];

const deps: EngineDeps = depsOf(
  ARROW_CONSTANT,
  WHISTLE_RESPONSE,
  ATTACHED_RESPONSE,
  HOLDER_CONSTANT,
  ...EVENTS.map((e) => e.ability),
);

/** A first turn with the whistle support in play and the thug, goon and holder engaged; the arrow in the deck. */
function start(options: { readonly whistle?: boolean } = {}) {
  let state: GameState = gameAtFirstTurn({
    cards: [ARROW, GADGET, WHISTLE, THUG, GOON, HOLDER, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 27), THUG.id, GOON.id, HOLDER.id],
    deck: [ARROW.id, GADGET.id, WHISTLE.id, ...EVENTS.map((e) => e.card.id)],
  });
  if (options.whistle !== false) state = playerCardIntoPlay(state, WHISTLE.id).state;
  const thug = minionEngagedWith(state, THUG.id);
  const goon = minionEngagedWith(thug.state, GOON.id);
  const holder = minionEngagedWith(goon.state, HOLDER.id);
  const arrow = holder.state.players[0]!.deck.find((id) => holder.state.instances[id]?.cardId === ARROW.id)!;
  return { state: holder.state, thug: thug.id, goon: goon.id, holder: holder.id, arrow };
}
/** The arrow in play, unattached, in the player's play area (surgery). */
function arrowInPlay(state: GameState) {
  return playerCardIntoPlay(state, ARROW.id);
}
const damage = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const unattached = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardUnattached" ? [e.event] : [],
  );
const resolvedOrder = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [String(e.abilityId)] : []));

describe("attachedOnlyWhileInPlay: 'cannot be attached to cards unless it is in play'", () => {
  it("played from hand it enters play attached to nothing, in its controller's play area", () => {
    const table = start();
    const run = playFree(table.state, deps, ARROW.id);
    expect(mustInstance(run.state, table.arrow).attachedTo).toBeNull();
    expect(locateCard(run.state, table.arrow)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(run.state, table.arrow).controllerId).toBe(P1);
  });

  it("no effect attaches it from out of play: an attach effect and a find that attaches leave it where it is", () => {
    const table = start();
    const attached = playFree(table.state, deps, ARROW_ON_THUG.card.id);
    expect(mustInstance(attached.state, table.arrow).attachedTo).toBeNull();
    expect(locateCard(attached.state, table.arrow)?.kind).toBe("deck");
    const found = playFree(table.state, deps, FIND_ARROW_ON_THUG.card.id);
    expect(mustInstance(found.state, table.arrow).attachedTo).toBeNull();
    expect(mustInstance(found.state, table.thug).attachments).toEqual([]);
  });

  it("once in play, effects attach it and move it between hosts", () => {
    const table = start({ whistle: false });
    const inPlay = arrowInPlay(table.state);
    const onThug = playFree(inPlay.state, deps, ARROW_ON_THUG.card.id);
    expect(mustInstance(onThug.state, inPlay.id).attachedTo).toBe(table.thug);
    const onGoon = playFree(onThug.state, deps, ARROW_ON_GOON.card.id);
    expect(mustInstance(onGoon.state, inPlay.id).attachedTo).toBe(table.goon);
    expect(mustInstance(onGoon.state, table.thug).attachments).toEqual([]);
  });
});

describe("cardUnattached: 'after the arrow is removed from an enemy, deal 1 damage to that enemy'", () => {
  function onThug() {
    const table = start();
    const inPlay = arrowInPlay(table.state);
    const run = playFree(inPlay.state, deps, ARROW_ON_THUG.card.id);
    // The attach itself: the "attached" response deals the thug 1.
    expect(damage(run.state, table.thug)).toBe(1);
    return { ...table, state: run.state, arrow: inPlay.id };
  }

  it("moved to another enemy: heard removed from the first, then attached to the second, 1 damage each", () => {
    const table = onThug();
    const run = playFree(table.state, deps, ARROW_ON_GOON.card.id);
    expect(damage(run.state, table.thug)).toBe(2);
    expect(damage(run.state, table.goon)).toBe(1);
    expect(unattached(run.events)).toEqual([
      { kind: "cardUnattached", instanceId: table.arrow, hostInstanceId: table.thug, playerId: P1, to: "attachment" },
    ]);
    expect(resolvedOrder(run.events).filter((id) => id.endsWith(".response"))).toEqual([
      "whistle.response",
      "attached.response",
    ]);
  });

  it("returned to hand, or discarded: heard, with the enemy it left as the target", () => {
    const table = onThug();
    const returned = playFree(table.state, deps, RETURN_ARROW.card.id);
    expect(locateCard(returned.state, table.arrow)).toEqual({ kind: "hand", playerId: P1 });
    expect(damage(returned.state, table.thug)).toBe(2);
    expect(unattached(returned.events)[0]).toMatchObject({ hostInstanceId: table.thug, to: "hand" });
    const discarded = playFree(table.state, deps, DISCARD_ARROW.card.id);
    expect(locateCard(discarded.state, table.arrow)).toEqual({ kind: "discard", playerId: P1 });
    expect(damage(discarded.state, table.thug)).toBe(2);
    expect(unattached(discarded.events)[0]).toMatchObject({ hostInstanceId: table.thug, to: "discard" });
  });

  it("its host leaving play takes it: heard, the defeated enemy as the target (out of play, so no damage lands)", () => {
    const table = onThug();
    const run = playFree(table.state, deps, KILL_THUG.card.id);
    expect(locateCard(run.state, table.arrow)).toEqual({ kind: "discard", playerId: P1 });
    expect(unattached(run.events)).toEqual([
      { kind: "cardUnattached", instanceId: table.arrow, hostInstanceId: table.thug, playerId: P1, to: "discard" },
    ]);
  });

  it("removed from a host that is no enemy: not heard by a response that asks for an enemy", () => {
    const table = start();
    const inPlay = arrowInPlay(table.state);
    const onHero = playFree(inPlay.state, deps, ARROW_ON_HERO.card.id);
    const run = playFree(onHero.state, deps, ARROW_ON_THUG.card.id);
    expect(resolvedOrder(run.events)).not.toContain("whistle.response");
    expect(damage(run.state, table.thug)).toBe(1);
  });

  it("nothing listens: no pending list is kept and no announcement is made", () => {
    const quiet: EngineDeps = depsOf(ARROW_CONSTANT, ...EVENTS.map((e) => e.ability));
    const table = start({ whistle: false });
    const inPlay = arrowInPlay(table.state);
    const onThugRun = playFree(inPlay.state, quiet, ARROW_ON_THUG.card.id);
    const run = playFree(onThugRun.state, quiet, ARROW_ON_GOON.card.id);
    expect(run.state.pendingUnattached).toBeUndefined();
    expect(unattached(run.events)).toEqual([]);
  });
});

describe("cannotLeaveHost: 'upgrades cannot be removed from the holder'", () => {
  function onHolder() {
    const table = start({ whistle: false });
    const arrow = arrowInPlay(table.state);
    const gadget = playerCardIntoPlay(arrow.state, GADGET.id);
    let state = playFree(gadget.state, deps, ARROW_ON_HOLDER.card.id).state;
    state = playFree(state, deps, GADGET_ON_HOLDER.card.id).state;
    expect(mustInstance(state, table.holder).attachments).toEqual([arrow.id, gadget.id]);
    return { ...table, state, arrow: arrow.id, gadget: gadget.id };
  }

  it("not moved to another host, returned to hand or discarded while the holder is in play", () => {
    const table = onHolder();
    const moved = playFree(table.state, deps, ARROW_ON_GOON.card.id);
    expect(mustInstance(moved.state, table.arrow).attachedTo).toBe(table.holder);
    const returned = playFree(table.state, deps, RETURN_ARROW.card.id);
    expect(mustInstance(returned.state, table.arrow).attachedTo).toBe(table.holder);
    const discarded = playFree(table.state, deps, DISCARD_GADGET.card.id);
    expect(mustInstance(discarded.state, table.gadget).attachedTo).toBe(table.holder);
    expect(
      discarded.events.some(
        (e) => e.type === "leavePlayBlocked" && e.instanceId === table.gadget && e.reason === "cannotLeavePlay",
      ),
    ).toBe(true);
  });

  it("lapses with the holder: defeated, its upgrades are discarded with it", () => {
    const table = onHolder();
    const run = playFree(table.state, deps, KILL_HOLDER.card.id);
    expect(locateCard(run.state, table.holder)?.kind).not.toBe("playArea");
    expect(locateCard(run.state, table.arrow)).toEqual({ kind: "discard", playerId: P1 });
    expect(locateCard(run.state, table.gadget)).toEqual({ kind: "discard", playerId: P1 });
  });

  it("holds only cards on the holder: the same upgrade on another enemy moves freely", () => {
    const table = start({ whistle: false });
    const arrow = arrowInPlay(table.state);
    const onThug = playFree(arrow.state, deps, ARROW_ON_THUG.card.id);
    const moved = playFree(onThug.state, deps, ARROW_ON_GOON.card.id);
    expect(mustInstance(moved.state, arrow.id).attachedTo).toBe(table.goon);
  });
});

describe("hasAttachment inside refMatches (reported by the yondu-dh author)", () => {
  it("matches an enemy with the upgrade attached by an effect, as `query({ host })` inside `exists` does", () => {
    const table = start({ whistle: false });
    const arrow = arrowInPlay(table.state);
    const state = playFree(arrow.state, deps, ARROW_ON_THUG.card.id).state;
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: { enemy: [table.thug] }, deps };
    const slot: TargetRef = { kind: "slot", slot: "enemy" };
    const withArrow: TargetQuery = { categories: ["enemy"], hasAttachment: { name: "arrow" } };
    expect(evaluate(state, { kind: "refMatches", ref: slot, query: withArrow }, context)).toBe(true);
    expect(
      evaluate(state, { kind: "exists", query: { categories: ["upgrade"], name: "arrow", host: slot } }, context),
    ).toBe(true);
    // The goon has none.
    const goon = { ...context, bindings: { enemy: [table.goon] } };
    expect(evaluate(state, { kind: "refMatches", ref: slot, query: withArrow }, goon)).toBe(false);
    expect(mustPlayer(state, P1).playArea).not.toContain(arrow.id);
  });
});
