/**
 * `AbilityLimit.per: "paidCard"` (docs/phase7-wave9.md §3.46 (a)): "Resource: Remove 1 bird counter from here →
 * generate a [energy] resource for an Aerial card. (Limit once per card.)" The limit is counted within each payment:
 * one use toward each card paid for, any number of cards in a turn, and nothing kept in `GameState.abilityUses`.
 *
 * Sources: RRG 1.8 "Limit" (pp. 26-27): "'Limit X per [period]' is a restriction that appears on cards that remain in
 * play through the specified period. Each instance of an ability with such a limit may be initiated X times during
 * the designated period."; "Resource Ability" (p. 37); "Cost" (p. 13); "Initiating Abilities" (p. 24).
 *
 * Synthetic cards only: three flocks holding bird counters (limit once per card and repeatable; the same without
 * `repeatable`; limit twice per card), and Aerial and non-Aerial supports to pay for.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { paymentOptions } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions, paymentFor, tryPayment } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const AERIAL = trait("AERIAL");
const flock = (id: string, count: number, repeatable: boolean) =>
  stubAbility(`${id}.resource`, {
    trigger: { kind: "resource", ...(repeatable ? { repeatable: true } : {}) },
    cost: { spendCounters: { counterType: "bird", amount: 1 } },
    generates: { energy: 1 },
    generatesFor: { trait: AERIAL },
    limit: { count, period: "round", per: "paidCard" },
    effects: [],
  } satisfies AbilityDefinition);
/** "Resource: Remove 1 bird counter from here → generate a [energy] resource for an Aerial card. (Limit once per card.)" */
const FLOCK_RESOURCE = flock("flock", 1, true);
const FLOCK = stubSupport({ id: "flock", cost: 0, abilities: [FLOCK_RESOURCE.ref] });
/** The same without `repeatable`. */
const PLAIN_RESOURCE = flock("plain", 1, false);
const PLAIN = stubSupport({ id: "plain", cost: 0, abilities: [PLAIN_RESOURCE.ref] });
/** "(Limit twice per card.)" */
const TWICE_RESOURCE = flock("twice", 2, true);
const TWICE = stubSupport({ id: "twice", cost: 0, abilities: [TWICE_RESOURCE.ref] });

const GLIDER = stubSupport({ id: "glider", cost: 3, traits: [AERIAL] });
const KITE = stubSupport({ id: "kite", cost: 2, traits: [AERIAL] });
const CART = stubSupport({ id: "cart", cost: 1 });
const deps: EngineDeps = depsOf(FLOCK_RESOURCE, PLAIN_RESOURCE, TWICE_RESOURCE);

interface Table {
  readonly state: GameState;
  /** The flock in play, holding 5 bird counters. */
  readonly source: InstanceId;
  readonly abilityId: string;
  readonly glider: InstanceId;
  readonly kite: InstanceId;
  readonly cart: InstanceId;
  /** The resource cards in hand, each worth 1. */
  readonly spare: readonly InstanceId[];
}

/** P1 with `card` in play holding 5 bird counters, and a hand of the three supports and `spares` resource cards. */
function table(card: typeof FLOCK, ability: typeof FLOCK_RESOURCE, spares = 3): Table {
  const cards = [FLOCK, PLAIN, TWICE, GLIDER, KITE, CART];
  const base = gameAtFirstTurn({
    cards,
    deps,
    deck: [...cards.map((c) => c.id), ...copiesOf(RESOURCE.id, 4)],
  });
  const put = playerCardIntoPlay(base, card.id);
  let state: GameState = {
    ...put.state,
    instances: {
      ...put.state.instances,
      [put.id]: { ...mustInstance(put.state, put.id), counters: { bird: 5 } },
    },
    // An empty hand, so every card in it is one this table put there.
    players: put.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
  };
  /** Moves one copy of `id` from P1's deck to their hand (surgery). */
  const give = (id: (typeof GLIDER)["id"]): InstanceId => {
    const seat = mustPlayer(state, P1);
    const taken = seat.deck.find((candidate) => mustInstance(state, candidate).cardId === id);
    if (!taken) throw new Error(`no ${id} in P1's deck`);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((x) => x !== taken), hand: [...p.hand, taken] } : p,
      ),
    };
    return taken;
  };
  const glider = give(GLIDER.id);
  const kite = give(KITE.id);
  const cart = give(CART.id);
  const spare = Array.from({ length: spares }, () => give(RESOURCE.id));
  return { state, source: put.id, abilityId: ability.ref.id, glider, kite, cart, spare };
}

const use = (t: Table): Payment => ({ ability: { instanceId: t.source, abilityId: t.abilityId as never } });
const hand = (id: InstanceId): Payment => ({ fromHand: id });
const play = (card: InstanceId, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});
const birds = (state: GameState, t: Table) => mustInstance(state, t.source).counters.bird ?? 0;
const inPlay = (state: GameState, id: InstanceId) => mustPlayer(state, P1).playArea.includes(id);
/** The payment options that are uses of the table's flock. */
const flockOptions = (state: GameState, t: Table, card: InstanceId) =>
  paymentOptions(createCtx(state, deps), P1, card)
    .map((o) => o.optionId)
    .filter((id) => id.startsWith(`ability:${t.source}:`));
const usesOf = (command: Command, t: Table) =>
  command.type === "playCard"
    ? command.payment.filter((p) => "ability" in p && p.ability.instanceId === t.source).length
    : 0;

describe('§3.46 (a) `AbilityLimit.per: "paidCard"`: limit once per card paid for', () => {
  it("used once toward a 3-cost card: 1 counter spent, 4 left, and the other 2 resources come from hand", () => {
    const t = table(FLOCK, FLOCK_RESOURCE);
    const [a, b] = t.spare as [InstanceId, InstanceId];
    const { session, events } = driveSession(startSession(t.state), deps, [play(t.glider, [use(t), hand(a), hand(b)])]);
    expect(inPlay(session.state, t.glider)).toBe(true);
    expect(birds(session.state, t)).toBe(4);
    expect(events.filter((e) => e.type === "resourcesGenerated" && e.instanceId === t.source)).toHaveLength(1);
    // The count is the payment's own: nothing is recorded, and nothing is logged as a use.
    expect(session.state.abilityUses).toEqual(t.state.abilityUses);
    expect(events.some((e) => e.type === "abilityUseRecorded")).toBe(false);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a second use toward the same card in the same payment is refused with limit_reached, and nothing is spent", () => {
    const t = table(FLOCK, FLOCK_RESOURCE);
    const [a] = t.spare as [InstanceId];
    const refused = applyCommand(t.state, play(t.glider, [use(t), use(t), hand(a)]), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("limit_reached");
    // The overlay's judge says the same, by option id (the second use is "…:2").
    const tried = tryPayment(
      t.state,
      P1,
      { kind: "playCard", instanceId: t.glider },
      [`ability:${t.source}:${t.abilityId}`, `ability:${t.source}:${t.abilityId}:2`, `hand:${a}`],
      {},
      deps,
    );
    expect(tried).toMatchObject({ ok: false, reason: "limit_reached" });
    expect(birds(t.state, t)).toBe(5);
  });

  it("the same without `repeatable`: also limit_reached, not a duplicate", () => {
    const t = table(PLAIN, PLAIN_RESOURCE);
    const [a] = t.spare as [InstanceId];
    const refused = applyCommand(t.state, play(t.glider, [use(t), use(t), hand(a)]), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("limit_reached");
    expect(flockOptions(t.state, t, t.glider)).toEqual([`ability:${t.source}:${t.abilityId}`]);
  });

  it("usable again toward a second card the same turn: 3 counters left after two cards", () => {
    const t = table(FLOCK, FLOCK_RESOURCE);
    const [a, b, c] = t.spare as [InstanceId, InstanceId, InstanceId];
    const { session } = driveSession(startSession(t.state), deps, [
      play(t.glider, [use(t), hand(a), hand(b)]),
      play(t.kite, [use(t), hand(c)]),
    ]);
    expect(inPlay(session.state, t.glider)).toBe(true);
    expect(inPlay(session.state, t.kite)).toBe(true);
    expect(birds(session.state, t)).toBe(3);
    expect(session.state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P1 });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a play that is refused consumes nothing: the same use pays for that card right after", () => {
    const t = table(FLOCK, FLOCK_RESOURCE);
    const [a, b] = t.spare as [InstanceId, InstanceId];
    // 1 resource toward a cost of 3.
    const short = applyCommand(t.state, play(t.glider, [use(t)]), deps);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error.code).toBe("insufficient_resources");
    expect(birds(t.state, t)).toBe(5);
    expect(t.state.abilityUses).toEqual({});
    const paid = applyCommand(t.state, play(t.glider, [use(t), hand(a), hand(b)]), deps);
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(birds(paid.state, t)).toBe(4);
  });

  it("payment options: 1 use offered toward an Aerial card, none toward another card", () => {
    const t = table(FLOCK, FLOCK_RESOURCE);
    expect(flockOptions(t.state, t, t.glider)).toEqual([`ability:${t.source}:${t.abilityId}`]);
    expect(flockOptions(t.state, t, t.kite)).toEqual([`ability:${t.source}:${t.abilityId}`]);
    expect(flockOptions(t.state, t, t.cart)).toEqual([]);
    const query = paymentFor(t.state, P1, { kind: "playCard", instanceId: t.glider }, {}, deps);
    const sources = query?.sources.filter((s) => s.instanceId === t.source) ?? [];
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ kind: "resourceAbility", pool: { energy: 1 } });
    // The flock once, the 3 resource cards, and the 2 other supports in hand (worth 0).
    expect(query?.sources).toHaveLength(1 + 3 + 2);
  });

  it("legal actions and the suggested payment: 5 counters and 1 card in hand do not pay for a 3-cost card", () => {
    // 2 cards in hand: the flock's 1 use and both cards pay 3.
    const two = table(FLOCK, FLOCK_RESOURCE, 2);
    const listed = legalActions(two.state, P1, deps);
    if (listed.kind !== "turn") throw new Error("expected P1's turn");
    const glider = listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === two.glider);
    expect(glider).toBeDefined();
    expect(usesOf(glider!.example, two)).toBe(1);
    expect(applyCommand(two.state, glider!.example, deps).ok).toBe(true);
    const query = paymentFor(two.state, P1, { kind: "playCard", instanceId: two.glider }, {}, deps);
    expect([...(query?.suggested ?? [])].sort()).toEqual(
      [`ability:${two.source}:${two.abilityId}`, ...two.spare.map((id) => `hand:${id}`)].sort(),
    );

    // 1 card in hand: 1 + 1 = 2 of 3, though 5 counters are there.
    const one = table(FLOCK, FLOCK_RESOURCE, 1);
    const short = legalActions(one.state, P1, deps);
    if (short.kind !== "turn") throw new Error("expected P1's turn");
    expect(short.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === one.glider)).toBe(false);
    expect(short.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === one.glider)).toMatchObject(
      { reason: "insufficient_resources" },
    );
    expect(paymentFor(one.state, P1, { kind: "playCard", instanceId: one.glider }, {}, deps)?.suggested).toEqual([]);
    // The 2-cost Aerial card is paid: 1 use and the 1 card.
    const kite = short.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === one.kite);
    expect(kite && usesOf(kite.example, one)).toBe(1);
  });

  it("limit twice per card: 2 uses offered and accepted (3 counters left), a third refused", () => {
    const t = table(TWICE, TWICE_RESOURCE, 1);
    const [a] = t.spare as [InstanceId];
    expect(flockOptions(t.state, t, t.glider)).toEqual([
      `ability:${t.source}:${t.abilityId}`,
      `ability:${t.source}:${t.abilityId}:2`,
    ]);
    const third = applyCommand(t.state, play(t.glider, [use(t), use(t), use(t)]), deps);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error.code).toBe("limit_reached");
    // With 1 card in hand the 3-cost card is now legal: 2 uses and the card.
    const listed = legalActions(t.state, P1, deps);
    if (listed.kind !== "turn") throw new Error("expected P1's turn");
    const glider = listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === t.glider);
    expect(glider && usesOf(glider.example, t)).toBe(2);
    const { session } = driveSession(startSession(t.state), deps, [
      play(t.glider, [use(t), use(t), hand(a)]),
      play(t.kite, [use(t), use(t)]),
    ]);
    expect(inPlay(session.state, t.glider)).toBe(true);
    expect(inPlay(session.state, t.kite)).toBe(true);
    expect(birds(session.state, t)).toBe(1);
    expect(session.state.abilityUses).toEqual({});
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
