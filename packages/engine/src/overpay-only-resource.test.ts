/**
 * `AbilityDefinition.overpayOnly` (docs/phase7-wave10-hero-packs.md H3.14, engine task HT11): "Resource: Generate a
 * [energy] resource to overpay for a card. (Limit once per card.)" What the ability generates joins a payment only as
 * overpayment: the rest of the payment covers the cost by itself, and these resources are always in `overpaid.*`.
 *
 * Sources: RRG 1.8 "Cost" (p. 13): "While paying a cost, a player is permitted to generate resources beyond the
 * specified cost. Resources generated beyond the specified cost are considered to have been overpaid for that cost and
 * were not paid for that cost."; "Resource Ability" (p. 37); "Limit" (pp. 26-27). Ruling January 17, 2026 - Ruling 4
 * (1): "When generating a wild resource, you specify which resource type it represents, even when overpaying a cost."
 * Owner decision, 2026-10-12 (hero-packs Q20 = A): the resource is offered only while a card is being played.
 *
 * Synthetic cards only. The probe events put what they read of their own payment into the villain's damage, one
 * column each: 1 for resolving, 10 per `overpaid.energy`, 100 per `overpaid.physical`, 1,000 per `overpaid.total`,
 * 10,000 per `paid.count`, 100,000 per `paid.total`.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { paymentOptions, priceOrNull } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions, paymentFor, tryPayment } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport, stubVillain } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const varOf = (name: string): ValueSpec => ({ kind: "var", name });
const damage = (amount: ValueSpec): EffectSpec => ({ kind: "dealDamage", target: { kind: "villain" }, amount });
const column = (name: string, times: number): EffectSpec => damage({ kind: "scaled", value: varOf(name), times });
const READS: readonly EffectSpec[] = [
  damage({ kind: "const", value: 1 }),
  column("overpaid.energy", 10),
  column("overpaid.physical", 100),
  column("overpaid.total", 1000),
  column("paid.count", 10000),
  column("paid.total", 100000),
];

const PROBE = stubAbility("probe.action", { trigger: { kind: "action" }, effects: READS });
const ZERO = stubEvent({ id: "probe-0", cost: 0, abilities: [PROBE.ref] });
const ONE = stubEvent({ id: "probe-1", cost: 1, abilities: [PROBE.ref] });
const TWO = stubEvent({ id: "probe-2", cost: 2, abilities: [PROBE.ref] });
/** "Action: Spend X resources → deal X damage" on a card that costs 0: the X of the payment, 1,000,000 each. */
const X_PROBE = stubAbility("x-probe.action", {
  trigger: { kind: "action" },
  cost: { resourcesX: { resource: "any", bind: "spent" } },
  effects: [...READS, column("spent", 1000000)],
});
const X_EVENT = stubEvent({ id: "probe-x", cost: 0, abilities: [X_PROBE.ref] });

/** "Resource: Generate a [energy] resource to overpay for a card. (Limit once per card.)" */
const STAR_RESOURCE = stubAbility("star.resource", {
  trigger: { kind: "resource" },
  generates: { energy: 1 },
  overpayOnly: true,
  limit: { count: 1, period: "round", per: "paidCard" },
  effects: [],
} satisfies AbilityDefinition);
const STAR = stubSupport({ id: "star", cost: 0, abilities: [STAR_RESOURCE.ref] });
/** The same generating a [wild]. */
const WILD_STAR_RESOURCE = stubAbility("wild-star.resource", {
  trigger: { kind: "resource" },
  generates: { wild: 1 },
  overpayOnly: true,
  limit: { count: 1, period: "round", per: "paidCard" },
  effects: [],
} satisfies AbilityDefinition);
const WILD_STAR = stubSupport({ id: "wild-star", cost: 0, abilities: [WILD_STAR_RESOURCE.ref] });

/** "Action: Spend 1 resource → deal 1 damage": an ability's own cost, which is not playing a card. */
const GADGET_ACTION = stubAbility("gadget.action", {
  trigger: { kind: "action" },
  cost: { resources: 1 },
  effects: [damage({ kind: "const", value: 1 })],
});
const GADGET = stubSupport({ id: "gadget", cost: 0, abilities: [GADGET_ACTION.ref] });

const PHYSICAL = stubResource({ id: "physical-card", icons: 1, produces: { physical: 1 } });
const ENERGY = stubResource({ id: "energy-card", icons: 1, produces: { energy: 1 } });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(90000000), atk: 0, sch: 0 }] });

const CARDS = [ZERO, ONE, TWO, X_EVENT, STAR, WILD_STAR, GADGET, PHYSICAL, ENERGY];
const deps: EngineDeps = depsOf(PROBE, X_PROBE, STAR_RESOURCE, WILD_STAR_RESOURCE, GADGET_ACTION);

interface Table {
  readonly state: GameState;
  /** The card with the overpay-only resource ability, in play. */
  readonly star: InstanceId;
  readonly abilityId: string;
  /** The cards put in hand, in the order asked for. */
  readonly hand: readonly InstanceId[];
}

/** P1 with `source` in play and a hand of exactly `hand` (by card id). */
function table(hand: readonly CardId[], source: typeof STAR = STAR): Table {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: QUIET_VILLAIN,
    deck: CARDS.flatMap((c) => [c.id, c.id, c.id]),
  });
  const put = playerCardIntoPlay(base, source.id);
  let state: GameState = {
    ...put.state,
    players: put.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
  };
  const ids = hand.map((cardId) => {
    const seat = mustPlayer(state, P1);
    const taken = seat.deck.find((candidate) => mustInstance(state, candidate).cardId === cardId);
    if (!taken) throw new Error(`no ${cardId} in P1's deck`);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((x) => x !== taken), hand: [...p.hand, taken] } : p,
      ),
    };
    return taken;
  });
  const abilityId = source === STAR ? STAR_RESOURCE.ref.id : WILD_STAR_RESOURCE.ref.id;
  return { state, star: put.id, abilityId, hand: ids };
}

const use = (t: Table): Payment => ({ ability: { instanceId: t.star, abilityId: t.abilityId as never } });
const fromHand = (id: InstanceId): Payment => ({ fromHand: id });
const play = (card: InstanceId, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});
const villainDamage = (state: GameState): number =>
  mustInstance(state, state.villains[0]?.instanceId as InstanceId).damage;
const starOption = (t: Table): string => `ability:${t.star}:${t.abilityId}`;
/** Plays `commands` and gives the villain's damage, with the log replayed to the same state. */
function dealt(t: Table, ...commands: readonly Command[]): number {
  const { session } = driveSession(startSession(t.state), deps, commands);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return villainDamage(session.state);
}
const refusal = (t: Table, command: Command): string | null => {
  const result = applyCommand(t.state, command, deps);
  return result.ok ? null : result.error.code;
};

describe("H3.14 a resource that can only be overpaid: always overpaid, never toward the cost", () => {
  it("a cost of 0 with an empty hand: the resource alone is the payment, 1 [energy] overpaid", () => {
    const t = table([ZERO.id]);
    const [zero] = t.hand as [InstanceId];
    // Resolved, 1 energy overpaid, 1 overpaid in all, nothing paid for the cost, 1 generated.
    expect(dealt(t, play(zero, [use(t)]))).toBe(1 + 10 + 1000 + 100000);
  });

  it("a cost of 1 with the resource alone is refused: it cannot reach the cost", () => {
    const t = table([ONE.id]);
    const [one] = t.hand as [InstanceId];
    expect(refusal(t, play(one, [use(t)]))).toBe("insufficient_resources");
    const tried = tryPayment(t.state, P1, { kind: "playCard", instanceId: one }, [starOption(t)], {}, deps);
    expect(tried).toMatchObject({ ok: false, reason: "insufficient_resources" });
    if (!tried.ok) expect(tried.message).toMatch(/covers 0 without the resources that can only be overpaid/);
  });

  it("a cost of 2 with one card and the resource is refused, though 2 resources were generated", () => {
    const t = table([TWO.id, PHYSICAL.id]);
    const [two, physical] = t.hand as [InstanceId, InstanceId];
    expect(refusal(t, play(two, [fromHand(physical), use(t)]))).toBe("insufficient_resources");
    // Nothing was spent by the refusal.
    expect(mustPlayer(t.state, P1).hand).toContain(physical);
  });

  it("on top of a payment that covers the cost: the card pays, the resource is the overpaid part", () => {
    const t = table([ONE.id, PHYSICAL.id]);
    const [one, physical] = t.hand as [InstanceId, InstanceId];
    // Without the rule the [physical] could have been named the overpaid one (`overpaid.physical` 1): it paid.
    expect(dealt(t, play(one, [fromHand(physical), use(t)]))).toBe(1 + 10 + 1000 + 10000 + 200000);
  });

  it("with an [energy] card already overpaid: 2 [energy] overpaid, the [physical] card still the one that paid", () => {
    const t = table([ONE.id, PHYSICAL.id, ENERGY.id]);
    const [one, physical, energy] = t.hand as [InstanceId, InstanceId, InstanceId];
    // Of the two cards one pays and one is overpaid: at most 1 [physical] overpaid, at most 1 + 1 [energy].
    expect(dealt(t, play(one, [fromHand(physical), fromHand(energy), use(t)]))).toBe(
      1 + 20 + 100 + 2000 + 10000 + 300000,
    );
  });

  it("is not part of the X of a 'spend X resources' cost", () => {
    const t = table([X_EVENT.id, PHYSICAL.id, ENERGY.id]);
    const [x, physical, energy] = t.hand as [InstanceId, InstanceId, InstanceId];
    // X is the two cards, and `paid.count` counts them; the resource is beside them. (The `overpaid.*` columns are
    // not read here: with `resourcesX` they have always counted the X resources too.)
    const total = dealt(t, play(x, [fromHand(physical), fromHand(energy), use(t)]));
    expect(Math.floor(total / 1000000)).toBe(2);
    expect(Math.floor(total / 10000) % 10).toBe(2);
    expect(Math.floor(total / 100000) % 10).toBe(3);
    // The resource alone is an X of 0.
    const alone = table([X_EVENT.id]);
    expect(Math.floor(dealt(alone, play(alone.hand[0] as InstanceId, [use(alone)])) / 1000000)).toBe(0);
  });

  it("a [wild] generated this way is overpaid as whichever type the player names it", () => {
    const t = table([ONE.id, PHYSICAL.id], WILD_STAR);
    const [one, physical] = t.hand as [InstanceId, InstanceId];
    // January 17, 2026 - Ruling 4 (1). The [physical] card still paid: `overpaid.physical` is the wild alone.
    expect(dealt(t, play(one, [fromHand(physical), use(t)]))).toBe(1 + 10 + 100 + 1000 + 10000 + 200000);
  });

  it("is announced as generated with the payment", () => {
    const t = table([ZERO.id]);
    const [zero] = t.hand as [InstanceId];
    const { events } = driveSession(startSession(t.state), deps, [play(zero, [use(t)])]);
    expect(events.filter((e) => e.type === "resourcesGenerated" && e.instanceId === t.star)).toMatchObject([
      { amount: 1, pool: { energy: 1 } },
    ]);
    expect(events.find((e) => e.type === "cardPlayed")).toMatchObject({ resourcesPaid: 1, paid: { energy: 1 } });
  });
});

describe("H3.14 limit once per card, and Q20 = A: only while a card is being played", () => {
  it("usable for each of two cards in one turn; twice for one card is refused", () => {
    const t = table([ZERO.id, ZERO.id]);
    const [first, second] = t.hand as [InstanceId, InstanceId];
    expect(refusal(t, play(first, [use(t), use(t)]))).toBe("limit_reached");
    expect(dealt(t, play(first, [use(t)]), play(second, [use(t)]))).toBe(2 * (1 + 10 + 1000 + 100000));
  });

  it("is refused toward an ability's cost, and not offered for it", () => {
    const base = table([PHYSICAL.id]);
    const put = playerCardIntoPlay(base.state, GADGET.id);
    const t: Table = { ...base, state: put.state };
    const [physical] = t.hand as [InstanceId];
    const useGadget = (payment: readonly Payment[]): Command => ({
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: GADGET_ACTION.ref.id,
      payment,
    });
    expect(refusal(t, useGadget([use(t)]))).toBe("no_valid_target");
    expect(refusal(t, useGadget([fromHand(physical), use(t)]))).toBe("no_valid_target");
    expect(refusal(t, useGadget([fromHand(physical)]))).toBeNull();
    const query = paymentFor(
      t.state,
      P1,
      { kind: "useAbility", instanceId: put.id, abilityId: GADGET_ACTION.ref.id },
      {},
      deps,
    );
    expect(query?.sources.map((s) => s.instanceId)).toEqual([physical]);
    // A payment for no card at all (a basic power's or a form change's additional cost).
    const ctx = createCtx(t.state, deps);
    expect(paymentOptions(ctx, P1, null).map((o) => o.optionId)).not.toContain(starOption(t));
    expect(priceOrNull(ctx, P1, [use(t)], null, null)).toBeNull();
  });
});

describe("H3.14 the payment query and legal actions", () => {
  it("lists the resource as a source marked overpayOnly, and never suggests it", () => {
    const t = table([ONE.id, PHYSICAL.id]);
    const [one, physical] = t.hand as [InstanceId, InstanceId];
    const query = paymentFor(t.state, P1, { kind: "playCard", instanceId: one }, {}, deps);
    expect(query?.sources.find((s) => s.instanceId === t.star)).toMatchObject({
      optionId: starOption(t),
      kind: "resourceAbility",
      pool: { energy: 1 },
      overpayOnly: true,
    });
    expect(query?.sources.find((s) => s.instanceId === physical)?.overpayOnly).toBeUndefined();
    expect(query?.suggested).toEqual([`hand:${physical}`]);
    const both = tryPayment(
      t.state,
      P1,
      { kind: "playCard", instanceId: one },
      [`hand:${physical}`, starOption(t)],
      {},
      deps,
    );
    expect(both.ok).toBe(true);
  });

  it("a card the resource alone would have to pay for is not legal; a cost of 0 is", () => {
    const t = table([ONE.id, ZERO.id]);
    const [one, zero] = t.hand as [InstanceId, InstanceId];
    const listed = legalActions(t.state, P1, deps);
    if (listed.kind !== "turn") throw new Error("expected P1's turn");
    const playOf = (id: InstanceId) => (a: (typeof listed.legal)[number] | (typeof listed.illegal)[number]) =>
      a.action.kind === "playCard" && a.action.instanceId === id;
    expect(listed.legal.some(playOf(one))).toBe(false);
    expect(listed.illegal.find(playOf(one))).toMatchObject({ reason: "insufficient_resources" });
    expect(listed.legal.some(playOf(zero))).toBe(true);
    expect(paymentFor(t.state, P1, { kind: "playCard", instanceId: one }, {}, deps)?.suggested).toEqual([]);
    // What a payment is worth toward a cost leaves the resource out.
    const ctx = createCtx(t.state, deps);
    expect(priceOrNull(ctx, P1, [use(t)], one)).toMatchObject({ energy: 0 });
  });
});

describe("a play with nothing to pay still has a pay step when overpaying matters", () => {
  it("a cost-0 card reading overpaid.* gets a query, marked overpayMatters, with and without the resource", () => {
    const withStar = table([ZERO.id]);
    const [zero] = withStar.hand as [InstanceId];
    const query = paymentFor(withStar.state, P1, { kind: "playCard", instanceId: zero }, {}, deps);
    expect(query).toMatchObject({ overpayMatters: true, suggested: [] });
    expect(query?.sources.some((s) => s.overpayOnly)).toBe(true);
    // Paying nothing stays the default, and is accepted.
    expect(tryPayment(withStar.state, P1, { kind: "playCard", instanceId: zero }, [], {}, deps).ok).toBe(true);
    // The resource alone is accepted too, overpaying by 1.
    expect(
      tryPayment(withStar.state, P1, { kind: "playCard", instanceId: zero }, [starOption(withStar)], {}, deps).ok,
    ).toBe(true);

    const bare = gameAtFirstTurn({
      cards: CARDS,
      deps,
      villain: QUIET_VILLAIN,
      deck: CARDS.flatMap((c) => [c.id, c.id, c.id]),
    });
    const inHand = mustPlayer(bare, P1).deck.find((id) => mustInstance(bare, id).cardId === ZERO.id) as InstanceId;
    const handed: GameState = {
      ...bare,
      players: bare.players.map((p) => (p.playerId === P1 ? { ...p, hand: [inHand] } : p)),
    };
    expect(paymentFor(handed, P1, { kind: "playCard", instanceId: inHand }, {}, deps)?.overpayMatters).toBe(true);
  });

  it("a cost-0 card that does not read overpaid.*, with no such resource in play, has no pay step", () => {
    const t = table([GADGET.id], GADGET);
    const [gadget] = t.hand as [InstanceId];
    expect(paymentFor(t.state, P1, { kind: "playCard", instanceId: gadget }, {}, deps)).toBeNull();
  });

  it("a cost-0 card that does not read overpaid.* still gets the step while an overpay-only resource is in play", () => {
    const t = table([GADGET.id]);
    const [gadget] = t.hand as [InstanceId];
    expect(paymentFor(t.state, P1, { kind: "playCard", instanceId: gadget }, {}, deps)?.overpayMatters).toBe(true);
  });
});

describe("legalActions marks a cost-0 play whose overpaying matters as needing the pay step", () => {
  const needsPaymentOf = (state: GameState, id: InstanceId): boolean | undefined => {
    const listed = legalActions(state, P1, deps);
    if (listed.kind !== "turn") throw new Error("expected P1's turn");
    return listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id)?.needsPayment;
  };

  it("a card reading overpaid.*, and any card while the overpay-only resource is in play", () => {
    const t = table([ZERO.id, GADGET.id]);
    const [zero, gadget] = t.hand as [InstanceId, InstanceId];
    expect(needsPaymentOf(t.state, zero)).toBe(true);
    expect(needsPaymentOf(t.state, gadget)).toBe(true);
  });

  it("a plain cost-0 card with no such resource in play stays a one-tap free play", () => {
    const t = table([GADGET.id], GADGET);
    const [gadget] = t.hand as [InstanceId];
    expect(needsPaymentOf(t.state, gadget)).toBe(false);
  });
});
