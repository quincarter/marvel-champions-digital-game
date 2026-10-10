/**
 * docs/phase7-wave9.md §3.46 (c): `RuleSpec spendableFromTucked`, "Any player may spend the resource card tucked here
 * as if it were in their hand" (Resource Reserve, `falcon` 53021), with synthetic cards: a support carrying the rule
 * and "Action: Exhaust this card → tuck 1 resource card from your hand under here (to a maximum of 1)".
 *
 * Sources: RRG 1.8 "Cost" (p. 13): "the player must pay that card's resource cost by discarding cards from their hand
 * or by using 'Resource' card abilities", and one card pays one cost; "Resource Card" (p. 37); "Wild Resource" (p. 48);
 * "Tuck" (p. 45): "Tucked cards are not in play", and "When a card leaves play, each card tucked under it is
 * discarded"; "Ownership and Control" (p. 31): a card goes to its owner's discard pile.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { paymentOptions } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions, paymentFor, tryPayment } from "./legal.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { tuckedSpendSources, tuckedSpender } from "./rules.js";
import { PAID_CARDS_SLOT } from "./stack.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;
const self = { kind: "self" } as const;
const one = { kind: "const", value: 1 } as const;
const RESOURCE_CARD = { categories: ["resource"] } as const;
const tuckFromHand = [
  {
    kind: "chooseCards",
    slot: "tucked",
    from: { kind: "zone", zone: "hand", player: you, filter: RESOURCE_CARD },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "slot", slot: "tucked" } }, under: self },
] as const;

/** "Any player may spend the resource card tucked here as if it were in their hand." */
const RESERVE_RULE = stubAbility(
  "reserve.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "spendableFromTucked", cards: RESOURCE_CARD, by: { kind: "each" } }],
    },
    effects: [],
  }),
);
/** "Action: Exhaust this card → tuck 1 resource card from your hand under here (to a maximum of 1)." */
const RESERVE_ACTION = stubAbility(
  "reserve.action",
  def({
    trigger: {
      kind: "action",
      while: {
        kind: "compare",
        left: { kind: "refCount", of: { kind: "tuckedUnder", of: self } },
        op: "equalTo",
        right: { kind: "const", value: 0 },
      },
    },
    cost: { exhaustSelf: true },
    effects: [...tuckFromHand],
  }),
);
/** The same rule for its controller only, and a tuck with no maximum and no cost. */
const VAULT_RULE = stubAbility(
  "vault.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "spendableFromTucked", cards: RESOURCE_CARD, by: you }] },
    effects: [],
  }),
);
const STASH_ACTION = stubAbility("stash.action", def({ trigger: { kind: "action" }, effects: [...tuckFromHand] }));
/** "Action: Discard this card." */
const SCRAP_ACTION = stubAbility(
  "scrap.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "discard" }],
  }),
);
/** "Action: Discard 1 card from your hand → place 1 done counter on your identity." */
const DISCARD_ACTION = stubAbility(
  "discard.action",
  def({
    trigger: { kind: "action" },
    cost: { discardFromHand: { min: 1, max: 1 } },
    effects: [{ kind: "addCounters", target: { kind: "identityOf", player: you }, counterType: "done", amount: one }],
  }),
);
/** The played event's own ability: how many cards paid for it, on its player's identity. */
const STUDY_ACTION = stubAbility(
  "study.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "identityOf", player: you },
        counterType: "paidCards",
        amount: { kind: "refCount", of: { kind: "slot", slot: PAID_CARDS_SLOT } },
      },
    ],
  }),
);
/** "You can only spend [mental] resources to pay for this card." */
const MENTAL_ONLY = stubAbility(
  "mental-only.constant",
  def({ trigger: { kind: "constant", paymentOnly: ["mental"] }, effects: [] }),
);
/** "Forced Response: After you spend a card, place 1 spent counter here." */
const SPENT_WATCH = stubAbility(
  "spent-watch.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "resourcesSpent", playerIs: "controller" } },
    effects: [{ kind: "addCounters", target: self, counterType: "spent", amount: one }],
  }),
);
/** "Forced Response: After a tucked card is discarded, place 1 seen counter here." Makes the discard announced. */
const WITNESS = stubAbility(
  "witness.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "tuckedCardDiscarded" } },
    effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: one }],
  }),
);

const RESERVE = stubSupport({
  id: "reserve",
  cost: 0,
  abilities: [RESERVE_RULE.ref, RESERVE_ACTION.ref, STASH_ACTION.ref, SCRAP_ACTION.ref],
});
const VAULT = stubSupport({ id: "vault", cost: 0, abilities: [VAULT_RULE.ref, STASH_ACTION.ref] });
/** Tucks like the others and has no rule: what is under it is nobody's to spend. */
const SHELF = stubSupport({ id: "shelf", cost: 0, abilities: [STASH_ACTION.ref] });
const BENCH = stubSupport({ id: "bench", cost: 0, abilities: [DISCARD_ACTION.ref] });
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [SPENT_WATCH.ref] });
const WITNESS_CARD = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS.ref] });
/** A resource card printing 2 physical resources. */
const STRENGTH = stubResource({ id: "strength", icons: 0, produces: { physical: 2 } });
/** A resource card printing 1 wild resource. */
const SPARK = stubResource({ id: "spark", icons: 1 });
/** A resource card printing 1 mental resource. */
const NOTE = stubResource({ id: "note", icons: 0, produces: { mental: 1 } });
const costing = (cost: number) => stubEvent({ id: `study-${cost}`, cost, abilities: [STUDY_ACTION.ref] });
const STUDIES = [1, 2, 3, 4].map(costing);
const MENTAL_EVENT = stubEvent({ id: "mental-event", cost: 1, abilities: [STUDY_ACTION.ref, MENTAL_ONLY.ref] });
const GROUP = stubEvent({ id: "group", cost: 2, keywords: [{ name: "alliance" }], abilities: [STUDY_ACTION.ref] });

const CARDS = [
  RESERVE,
  VAULT,
  SHELF,
  BENCH,
  WATCH,
  WITNESS_CARD,
  STRENGTH,
  SPARK,
  NOTE,
  ...STUDIES,
  MENTAL_EVENT,
  GROUP,
];
const abilities = [
  RESERVE_RULE,
  RESERVE_ACTION,
  VAULT_RULE,
  STASH_ACTION,
  SCRAP_ACTION,
  DISCARD_ACTION,
  STUDY_ACTION,
  MENTAL_ONLY,
  SPENT_WATCH,
];
const deps: EngineDeps = depsOf(...abilities);
/** The same registry with an ability that hears a tucked card's discard. */
const hearing: EngineDeps = depsOf(...abilities, WITNESS);

function start(using: EngineDeps = deps): GameState {
  const state = gameAtFirstTurn({ cards: CARDS, deps: using, players: 2, deck: CARDS.flatMap((c) => [c.id, c.id]) });
  // Empty hands: every card a test spends is one it names.
  return { ...state, players: state.players.map((p) => ({ ...p, hand: [], deck: [...p.hand, ...p.deck] })) };
}
const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const play = (card: InstanceId, payment: readonly Payment[], playerId: PlayerId = P1): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});
const use = (card: InstanceId, ability: StubAbility, playerId: PlayerId = P1): Command => ({
  type: "useAbility",
  playerId,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
});
const endTurn = (playerId: PlayerId): Command => ({ type: "endTurn", playerId });
/** Picks `prefer` when a card choice offers it; otherwise `defaultPick`. */
const picking =
  (prefer: readonly InstanceId[]) =>
  (state: GameState): readonly string[] => {
    const wanted = state.pendingChoice?.options.find(
      (o) => o.ref?.kind === "card" && prefer.includes(o.ref.instanceId),
    );
    return wanted ? [wanted.optionId] : defaultPick(state);
  };
/** Runs the commands through a session; the log replays to the same state. */
function run(state: GameState, commands: readonly Command[], prefer: readonly InstanceId[] = [], using = deps) {
  const { session, events } = driveSession(startSession(state), using, commands, picking(prefer));
  const replayed = replay(session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const refusal = (state: GameState, command: Command, using = deps): string | undefined => {
  const result = applyCommand(state, command, using);
  return result.ok ? undefined : `${result.error.code}: ${result.error.message}`;
};
const counter = (state: GameState, id: InstanceId, name: string): number => mustInstance(state, id).counters[name] ?? 0;
const identity = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const optionIds = (state: GameState, player: PlayerId, card: InstanceId): readonly string[] =>
  paymentOptions(createCtx(state, deps), player, card).map((o) => o.optionId);
const played = (events: readonly GameEvent[]) => events.flatMap((e) => (e.type === "cardPlayed" ? [e.paid] : []));
const pool = (parts: Partial<Record<"physical" | "mental" | "energy" | "wild", number>>) => ({
  energy: 0,
  mental: 0,
  physical: 0,
  wild: 0,
  ...parts,
});

interface Table {
  readonly state: GameState;
  readonly host: InstanceId;
  /** The cards tucked under the host, in the order given. */
  readonly tucked: readonly InstanceId[];
}
/** P1 controls `host` with these cards (from P1's deck) tucked under it through its own tuck action, one at a time. */
function tuckedUnder(hostCard: { readonly id: string }, cards: readonly string[], using = deps): Table {
  const placed = playerCardIntoPlay(start(using), hostCard.id as never);
  let state = placed.state;
  const tucked: InstanceId[] = [];
  for (const card of cards) {
    const given = giveCards(state, P1, card);
    const id = given.ids[0]!;
    state = run(given.state, [use(placed.id, STASH_ACTION)], [id], using).state;
    tucked.push(id);
  }
  return { state, host: placed.id, tucked };
}
/** The state with P2 the active player (P1 ends their turn). */
const p2Turn = (state: GameState): GameState => run(state, [endTurn(P1)]).state;

describe("§3.46 (c) `spendableFromTucked`: a tucked resource card as a payment source", () => {
  it("the action tucks 1 resource card from hand, exhausting its card, and is refused while a card is tucked", () => {
    const placed = playerCardIntoPlay(start(), RESERVE.id);
    const given = giveCards(placed.state, P1, STRENGTH.id, SPARK.id);
    const [strength, spark] = given.ids as [InstanceId, InstanceId];
    const { state } = run(given.state, [use(placed.id, RESERVE_ACTION)], [strength]);
    expect(mustInstance(state, placed.id).tucked).toEqual([strength]);
    expect(mustInstance(state, placed.id).exhausted).toBe(true);
    expect(mustPlayer(state, P1).hand).toEqual([spark]);
    // "(To a maximum of 1)": ready again, with a card under it, the action is refused and nothing is tucked.
    const ready: GameState = {
      ...state,
      instances: { ...state.instances, [placed.id]: { ...mustInstance(state, placed.id), exhausted: false } },
    };
    expect(refusal(ready, use(placed.id, RESERVE_ACTION))).toBeDefined();
    expect(mustInstance(ready, placed.id).tucked).toEqual([strength]);
  });

  it("its controller spends it: 2 physical as printed, discarded from under the host to its owner's discard pile", () => {
    const t = tuckedUnder(RESERVE, [STRENGTH.id]);
    const given = giveCards(t.state, P1, costing(2).id);
    const study = given.ids[0]!;
    const { state, events } = run(given.state, [play(study, fromHand(t.tucked[0]!))]);
    expect(played(events)).toEqual([pool({ physical: 2 })]);
    expect(mustInstance(state, t.host).tucked).toEqual([]);
    expect(locateCard(state, t.tucked[0]!)).toMatchObject({ kind: "discard", playerId: P1 });
    // It is a card that paid (slot `paid.cards`), and no card left a hand.
    expect(counter(state, identity(state, P1), "paidCards")).toBe(1);
    expect(events.filter((e) => e.type === "cardDiscardedFromHand")).toEqual([]);
    expect(events.filter((e) => e.type === "tuckedCardSpent")).toEqual([
      { type: "tuckedCardSpent", playerId: P1, instanceId: t.tucked[0], hostInstanceId: t.host },
    ]);
  });

  it("another player spends it: P2 pays 2 physical with the card under P1's host, and it goes to P1's discard pile", () => {
    const t = tuckedUnder(RESERVE, [STRENGTH.id]);
    const watch = playerCardIntoPlay(p2Turn(t.state), WATCH.id, P2);
    const given = giveCards(watch.state, P2, costing(2).id);
    const study = given.ids[0]!;
    expect(tuckedSpender(given.state, deps, t.tucked[0]!, P2)).toBe(P2);
    const { state, events } = run(given.state, [play(study, fromHand(t.tucked[0]!), P2)]);
    expect(played(events)).toEqual([pool({ physical: 2 })]);
    expect(locateCard(state, t.tucked[0]!)).toMatchObject({ kind: "discard", playerId: P1 });
    expect(mustInstance(state, t.tucked[0]!).controllerId).toBe(P1);
    expect(mustPlayer(state, P2).discard).not.toContain(t.tucked[0]);
    expect(events.filter((e) => e.type === "tuckedCardSpent")).toEqual([
      { type: "tuckedCardSpent", playerId: P2, instanceId: t.tucked[0], hostInstanceId: t.host },
    ]);
    // The spender is P2: "after you spend a card" on P2's support hears it once.
    expect(counter(state, watch.id, "spent")).toBe(1);
    expect(counter(state, identity(state, P2), "paidCards")).toBe(1);
  });

  it("a wild is a wild: it pays for a card that takes only [mental] resources, and a [physical] card does not", () => {
    const wild = tuckedUnder(RESERVE, [SPARK.id]);
    const given = giveCards(wild.state, P1, MENTAL_EVENT.id);
    const paid = run(given.state, [play(given.ids[0]!, fromHand(wild.tucked[0]!))]);
    expect(played(paid.events)).toEqual([pool({ wild: 1 })]);
    // The card paid for says what it excludes, for a tucked source as for a hand card.
    const physical = tuckedUnder(RESERVE, [STRENGTH.id]);
    const other = giveCards(physical.state, P1, MENTAL_EVENT.id);
    expect(refusal(other.state, play(other.ids[0]!, fromHand(physical.tucked[0]!)))).toMatch(/only mental/);
    expect(mustInstance(other.state, physical.host).tucked).toEqual(physical.tucked);
  });

  it("two tucked cards are two sources: 2 physical + 1 mental pay a cost of 3, each spent once", () => {
    const t = tuckedUnder(RESERVE, [STRENGTH.id, NOTE.id]);
    const given = giveCards(t.state, P1, costing(3).id, costing(4).id, costing(1).id);
    const [three, four, single] = given.ids as [InstanceId, InstanceId, InstanceId];
    expect(tuckedSpendSources(given.state, deps, P1).map((s) => s.instanceId)).toEqual(t.tucked);
    // After the hand's own cards, in the order tucked.
    expect(optionIds(given.state, P1, three)).toEqual([
      `hand:${four}`,
      `hand:${single}`,
      ...t.tucked.map((id) => `hand:${id}`),
    ]);
    // The same card named twice is one card.
    expect(refusal(given.state, play(three, fromHand(t.tucked[0]!, t.tucked[0]!)))).toMatch(/duplicate payment card/);
    // 3 does not pay 4.
    expect(refusal(given.state, play(four, fromHand(...t.tucked)))).toMatch(/insufficient_resources/);
    const { state, events } = run(given.state, [play(three, fromHand(...t.tucked))]);
    expect(played(events)).toEqual([pool({ physical: 2, mental: 1 })]);
    expect(counter(state, identity(state, P1), "paidCards")).toBe(2);
    expect(mustInstance(state, t.host).tucked).toEqual([]);
    // One of two: the other stays under the host.
    const other = run(given.state, [play(single, fromHand(t.tucked[1]!))]);
    expect(played(other.events)).toEqual([pool({ mental: 1 })]);
    expect(mustInstance(other.state, t.host).tucked).toEqual([t.tucked[0]]);
  });

  it("is listed: payment options, the suggested payment, the legal action's example, and a refusal once it is gone", () => {
    const t = tuckedUnder(RESERVE, [STRENGTH.id]);
    const state = giveCards(p2Turn(t.state), P2, costing(2).id);
    const study = state.ids[0]!;
    const option = paymentOptions(createCtx(state.state, deps), P2, study);
    expect(option).toEqual([
      {
        optionId: `hand:${t.tucked[0]}`,
        label: "strength (under reserve)",
        ref: { kind: "card", instanceId: t.tucked[0] },
      },
    ]);
    const query = paymentFor(state.state, P2, { kind: "playCard", instanceId: study }, {}, deps)!;
    expect(query.sources).toEqual([
      {
        optionId: `hand:${t.tucked[0]}`,
        kind: "handCard",
        instanceId: t.tucked[0],
        label: "strength (under reserve)",
        pool: pool({ physical: 2 }),
        tuckedUnder: t.host,
      },
    ]);
    expect(query.suggested).toEqual([`hand:${t.tucked[0]}`]);
    const actions = legalActions(state.state, P2, deps);
    if (actions.kind !== "turn") throw new Error(actions.kind);
    const listed = actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === study);
    expect(listed?.example).toMatchObject({ type: "playCard", payment: [{ fromHand: t.tucked[0] }] });
    const attempt = tryPayment(
      state.state,
      P2,
      { kind: "playCard", instanceId: study },
      [`hand:${t.tucked[0]}`],
      {},
      deps,
    );
    expect(attempt.ok).toBe(true);
    // Spent by P1 first (the round before), it is gone for P2: not offered, and the play is illegal with a reason.
    const p1 = giveCards(t.state, P1, costing(1).id);
    const spent = run(p1.state, [play(p1.ids[0]!, fromHand(t.tucked[0]!))]).state;
    const later = giveCards(p2Turn(spent), P2, costing(2).id);
    const after = legalActions(later.state, P2, deps);
    if (after.kind !== "turn") throw new Error(after.kind);
    expect(after.legal.some((a) => a.action.kind === "playCard")).toBe(false);
    const why = after.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === later.ids[0]);
    expect(why?.reason).toBe("insufficient_resources");
    expect(refusal(later.state, play(later.ids[0]!, fromHand(t.tucked[0]!), P2))).toMatch(/card_not_in_zone/);
  });

  it("only spending: it is not a card in hand for a 'discard 1 card from your hand' cost, and cannot be played", () => {
    const t = tuckedUnder(RESERVE, [STRENGTH.id]);
    const bench = playerCardIntoPlay(t.state, BENCH.id);
    const discard: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: bench.id,
      abilityId: DISCARD_ACTION.ref.id,
      payment: [],
      costChoices: { discard: [t.tucked[0]!] },
    };
    expect(refusal(bench.state, discard)).toBeDefined();
    const actions = legalActions(bench.state, P1, deps);
    if (actions.kind !== "turn") throw new Error(actions.kind);
    expect(
      actions.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === DISCARD_ACTION.ref.id),
    ).toBe(false);
    expect(refusal(bench.state, play(t.tucked[0]!, []))).toBeDefined();
    expect(mustInstance(bench.state, t.host).tucked).toEqual(t.tucked);
  });

  it("the rule names who: under a 'you may spend' host its controller spends it and another player cannot", () => {
    const t = tuckedUnder(VAULT, [STRENGTH.id]);
    const mine = giveCards(t.state, P1, costing(2).id);
    expect(optionIds(mine.state, P1, mine.ids[0]!)).toEqual([`hand:${t.tucked[0]}`]);
    const theirs = giveCards(p2Turn(t.state), P2, costing(2).id);
    expect(tuckedSpender(theirs.state, deps, t.tucked[0]!, P2)).toBeNull();
    expect(optionIds(theirs.state, P2, theirs.ids[0]!)).toEqual([]);
    expect(refusal(theirs.state, play(theirs.ids[0]!, fromHand(t.tucked[0]!), P2))).toMatch(/card_not_in_zone/);
    // A group payment takes it from the player the rule names: P1 spends it toward P2's alliance card.
    const group = giveCards(p2Turn(t.state), P2, GROUP.id);
    expect(tuckedSpender(group.state, deps, t.tucked[0]!, P2, true)).toBe(P1);
    const paid = run(group.state, [play(group.ids[0]!, fromHand(t.tucked[0]!), P2)]);
    expect(paid.events.filter((e) => e.type === "tuckedCardSpent")).toEqual([
      { type: "tuckedCardSpent", playerId: P1, instanceId: t.tucked[0], hostInstanceId: t.host },
    ]);
  });

  it("no rule, no source: a card tucked under a card without the rule, and a facedown tucked card", () => {
    const shelf = tuckedUnder(SHELF, [STRENGTH.id]);
    const given = giveCards(shelf.state, P1, costing(2).id);
    expect(optionIds(given.state, P1, given.ids[0]!)).toEqual([]);
    expect(refusal(given.state, play(given.ids[0]!, fromHand(shelf.tucked[0]!)))).toMatch(/card_not_in_zone/);
    const t = tuckedUnder(RESERVE, [STRENGTH.id]);
    const facedown: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.tucked[0]!]: { ...mustInstance(t.state, t.tucked[0]!), faceup: false } },
    };
    expect(tuckedSpendSources(facedown, deps, P1)).toEqual([]);
  });

  it("the host leaves play: the card under it is discarded by the game and is no longer a source", () => {
    const t = tuckedUnder(RESERVE, [STRENGTH.id]);
    const { state } = run(t.state, [use(t.host, SCRAP_ACTION)]);
    expect(locateCard(state, t.host)).toMatchObject({ kind: "discard" });
    expect(locateCard(state, t.tucked[0]!)).toMatchObject({ kind: "discard", playerId: P1 });
    expect(tuckedSpendSources(state, deps, P1)).toEqual([]);
    const given = giveCards(state, P1, costing(2).id);
    expect(refusal(given.state, play(given.ids[0]!, fromHand(t.tucked[0]!)))).toMatch(/card_not_in_zone/);
  });

  it("is heard as a tucked card discarded as a cost, its host the source, when an ability listens", () => {
    const t = tuckedUnder(RESERVE, [STRENGTH.id], hearing);
    const witness = playerCardIntoPlay(t.state, WITNESS_CARD.id);
    const given = giveCards(witness.state, P1, costing(2).id);
    const { state, events } = run(given.state, [play(given.ids[0]!, fromHand(t.tucked[0]!))], [], hearing);
    expect(counter(state, witness.id, "seen")).toBe(1);
    const heard = events.flatMap((e) =>
      e.type === "triggerEvent" && e.event.kind === "tuckedCardDiscarded" ? [e.event] : [],
    );
    expect(heard[0]).toMatchObject({
      kind: "tuckedCardDiscarded",
      instanceId: t.tucked[0],
      hostInstanceId: t.host,
      sourceInstanceId: t.host,
      playerId: P1,
      under: "other",
      by: "playerCard",
      how: "cost",
    });
  });
});
