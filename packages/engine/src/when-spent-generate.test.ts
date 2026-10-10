/**
 * "Interrupt: When you spend this card, exhaust up to 3 allies and/or supports you control that share a Trait with
 * your identity → generate the printed resources on each card exhausted this way": a resource trigger with
 * `whenSpent`, used by the payment entry that spends its card (`Payment.whenSpent`), with synthetic cards.
 *
 * Sources: RRG 1.8 "Resource Card" (p. 37): "Some resource cards have card text that is active while using the card to
 * generate resources"; "Cost" (p. 13): "While paying a cost, a player is permitted to generate resources beyond the
 * specified cost", which "were not paid for that cost" and "are lost after paying that cost", and (p. 14) "up to" some
 * number in a cost "requires a minimum of one"; "Interrupt" (p. 25): an interrupt resolves before its triggering
 * condition; "Identity" (p. 23): "your identity" is the side that is up.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { paymentOptions, spentCardOptionId } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions, paymentFor } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { timingWordOf } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubIdentity, stubResource, stubSupport } from "./testing/fixtures.js";
import { giveCard, newGame } from "./testing/scenario.js";
import { P1, playerCardIntoPlay } from "./testing/wave3.js";

const AGENCY = trait("Agency");
const FIELD = trait("Field");
const you = { kind: "controller" } as const;
const sharing = {
  categories: ["ally", "support"],
  sharesTraitWith: { kind: "identityOf", player: you },
} as const;

/** The resource card's own interrupt: up to 3 of the spender's allies and supports sharing a trait with their identity. */
const BACKING_INTERRUPT = stubAbility("backing.interrupt", {
  trigger: { kind: "resource", whenSpent: true },
  cost: { exhaustCards: { slot: "exhausted", query: sharing, min: 1, max: 3 } },
  generates: { kind: "printedResourcesOf", cards: { categories: ["ally", "support"], inSlot: "exhausted" } },
  effects: [],
} as Omit<AbilityDefinition, "id">);
/** A resource card printing one mental resource. */
const BACKING = stubResource({ id: "backing", icons: 0, produces: { mental: 1 }, abilities: [BACKING_INTERRUPT.ref] });

// The alter-ego side has the Agency trait, the hero side the Field trait.
const base = stubIdentity({
  id: "director",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroTraits: [FIELD],
});
const IDENTITY = { ...base, alterEgo: { ...base.alterEgo, traits: [AGENCY] } };

const AGENT = stubAlly({
  id: "agent",
  traits: [AGENCY],
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 2,
  resourceIcons: { physical: 1 },
});
const OFFICE = stubSupport({ id: "office", traits: [AGENCY], cost: 0, resourceIcons: { energy: 1 } });
const ANALYST = stubAlly({
  id: "analyst",
  traits: [AGENCY],
  cost: 0,
  atk: 0,
  thw: 1,
  hp: 2,
  resourceIcons: { mental: 2 },
});
const ARCHIVE = stubSupport({ id: "archive", traits: [AGENCY], cost: 0, resourceIcons: { wild: 1 } });
/** A support with neither trait: it shares none with either side of the identity. */
const OUTSIDER = stubSupport({ id: "outsider", cost: 0, resourceIcons: { physical: 1 } });
/** An ally sharing the hero side's trait only. */
const SCOUT = stubAlly({
  id: "scout",
  traits: [FIELD],
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 2,
  resourceIcons: { physical: 1 },
});

const mark = stubAbility("spend.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: you },
      counterType: "resolved",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const costing = (cost: number) => stubEvent({ id: `cost-${cost}`, cost, abilities: [mark.ref] });
const EVENTS = [1, 2, 3, 4, 5, 6].map(costing);

const deps: EngineDeps = depsOf(BACKING_INTERRUPT, mark);

interface Table {
  readonly state: GameState;
  readonly card: InstanceId;
  readonly backing: readonly InstanceId[];
  readonly agent: InstanceId;
  readonly office: InstanceId;
  readonly analyst: InstanceId;
  readonly archive: InstanceId;
  readonly outsider: InstanceId;
  readonly scout: InstanceId;
}

/**
 * Alter-ego form, first turn. In hand: `copies` of the resource card and the event costing `cost`, nothing else. In
 * play, ready: the six cards above, of which `inPlay` keeps only those named.
 */
function table(cost: number, copies = 1, inPlay?: readonly string[]): Table {
  const inPlayCards = [AGENT, OFFICE, ANALYST, ARCHIVE, OUTSIDER, SCOUT];
  let state = newGame({
    identity: IDENTITY,
    extraCards: [BACKING, ...inPlayCards, ...EVENTS],
    deck: [
      ...inPlayCards.map((c) => c.id),
      ...EVENTS.map((c) => c.id),
      BACKING.id,
      BACKING.id,
      BACKING.id,
      ...EVENTS.map((c) => c.id),
    ],
    deps,
  });
  state = { ...state, players: state.players.map((p) => ({ ...p, hand: [], deck: [...p.hand, ...p.deck] })) };
  const ids: Record<string, InstanceId> = {};
  for (const card of inPlayCards) {
    if (inPlay && !inPlay.includes(card.id)) {
      ids[card.id] = "absent" as InstanceId;
      continue;
    }
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    ids[card.id] = placed.id;
  }
  const backing: InstanceId[] = [];
  for (let i = 0; i < copies; i++) {
    const given = giveCard(state, P1, BACKING.id, backing);
    state = given.state;
    backing.push(given.id);
  }
  const card = giveCard(state, P1, costing(cost).id);
  return {
    state: card.state,
    card: card.id,
    backing,
    agent: ids.agent!,
    office: ids.office!,
    analyst: ids.analyst!,
    archive: ids.archive!,
    outsider: ids.outsider!,
    scout: ids.scout!,
  };
}

const plain = (t: Table, copy = 0): Payment => ({ fromHand: t.backing[copy]! });
const withInterrupt = (t: Table, exhausted?: readonly InstanceId[], copy = 0): Payment => ({
  fromHand: t.backing[copy]!,
  whenSpent: { abilityId: BACKING_INTERRUPT.ref.id, ...(exhausted ? { costChoices: { exhausted } } : {}) },
});
const play = (t: Table, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: t.card,
  payment,
  attachToInstanceId: null,
});
const refusal = (t: Table, payment: readonly Payment[], state = t.state): string | undefined => {
  const result = applyCommand(state, play(t, payment), deps);
  return result.ok ? undefined : result.error.message;
};
/** Plays the event with `payment`; the log replays to the same state, and no prompt was needed. */
function pay(t: Table, payment: readonly Payment[]) {
  const asked: string[] = [];
  const { session, events } = driveSession(startSession(t.state), deps, [play(t, payment)], (state) => {
    asked.push(state.pendingChoice?.prompt.kind ?? "?");
    return [];
  });
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  expect(asked).toEqual([]);
  return { state: session.state, events };
}
const pool = (parts: Partial<Record<"physical" | "mental" | "energy" | "wild", number>>) => ({
  energy: 0,
  mental: 0,
  physical: 0,
  wild: 0,
  ...parts,
});
/** What each resource ability use generated, in order (a hand card's own resources are not an ability's). */
const generated = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "resourcesGenerated" && e.instanceId !== undefined ? [e.pool] : []));
const played = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "cardPlayed" ? [{ resourcesPaid: e.resourcesPaid, paid: e.paid }] : []));
const exhausted = (state: GameState, ...ids: readonly InstanceId[]): readonly boolean[] =>
  ids.map((id) => mustInstance(state, id).exhausted);
const resolved = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters.resolved ?? 0;
const optionIds = (t: Table, state = t.state): readonly string[] =>
  paymentOptions(createCtx(state, deps), P1, t.card).map((o) => o.optionId);
const query = (t: Table, state = t.state) => paymentFor(state, P1, { kind: "playCard", instanceId: t.card }, {}, deps);
const listed = (t: Table, state = t.state) => {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`not the player's turn: ${actions.kind}`);
  return actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === t.card);
};

describe("a resource card's 'Interrupt: When you spend this card, exhaust up to 3 … → generate their printed resources'", () => {
  it("spent plainly it generates its own 1 mental resource and exhausts nothing", () => {
    const t = table(1);
    const { state, events } = pay(t, [plain(t)]);
    expect(resolved(state)).toBe(1);
    expect(generated(events)).toEqual([]);
    expect(played(events)).toEqual([{ resourcesPaid: 1, paid: pool({ mental: 1 }) }]);
    expect(exhausted(state, t.agent, t.office, t.analyst, t.archive)).toEqual([false, false, false, false]);
    // The same card toward a cost of 2: 1 short.
    expect(refusal(table(2), [plain(table(2))])).toBeDefined();
  });

  it("with the interrupt, two cards exhausted add their printed resources: 1 + 1 + 1 pays a cost of 3", () => {
    const t = table(3);
    const { state, events } = pay(t, [withInterrupt(t, [t.agent, t.office])]);
    expect(resolved(state)).toBe(1);
    expect(generated(events)).toEqual([pool({ physical: 1, energy: 1 })]);
    expect(played(events)).toEqual([{ resourcesPaid: 3, paid: pool({ mental: 1, physical: 1, energy: 1 }) }]);
    expect(exhausted(state, t.agent, t.office, t.analyst, t.archive)).toEqual([true, true, false, false]);
    expect(mustPlayer(state, P1).discard).toContain(t.backing[0]);
    // The cost is paid before the card is discarded (an interrupt to the spending).
    const order = events.flatMap((e) =>
      e.type === "cardExhausted"
        ? ["exhaust"]
        : e.type === "cardMoved" && e.instanceId === t.backing[0]
          ? ["discard"]
          : [],
    );
    expect(order).toEqual(["exhaust", "exhaust", "discard"]);
  });

  it("three cards is the most: 1 + (1 + 1 + 2) = 5 pays a cost of 5 and not 6; a fourth pick is refused", () => {
    const t = table(5);
    const { state, events } = pay(t, [withInterrupt(t, [t.agent, t.office, t.analyst])]);
    expect(generated(events)).toEqual([pool({ physical: 1, energy: 1, mental: 2 })]);
    expect(played(events)).toEqual([{ resourcesPaid: 5, paid: pool({ mental: 3, physical: 1, energy: 1 }) }]);
    expect(exhausted(state, t.agent, t.office, t.analyst, t.archive)).toEqual([true, true, true, false]);
    const six = table(6);
    expect(refusal(six, [withInterrupt(six, [six.agent, six.office, six.analyst])])).toBeDefined();
    expect(refusal(t, [withInterrupt(t, [t.agent, t.office, t.analyst, t.archive])])).toBeDefined();
  });

  it("'up to 3' is at least 1, and only ready cards sharing a trait with the identity side that is up can pay", () => {
    const t = table(2);
    // No pick named with several candidates, or none picked: the cost before the arrow is not paid.
    expect(refusal(t, [withInterrupt(t)])).toBeDefined();
    expect(refusal(t, [withInterrupt(t, [])])).toBeDefined();
    // Alter-ego side (Agency): the support with no trait and the Field ally share none.
    expect(refusal(t, [withInterrupt(t, [t.outsider])])).toBeDefined();
    expect(refusal(t, [withInterrupt(t, [t.scout])])).toBeDefined();
    // An exhausted card cannot be exhausted again.
    const tired: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.agent]: { ...mustInstance(t.state, t.agent), exhausted: true } },
    };
    expect(refusal(t, [withInterrupt(t, [t.agent])], tired)).toBeDefined();
    expect(refusal(t, [withInterrupt(t, [t.office])], tired)).toBeUndefined();
    // Hero side (Field): now only the Field ally shares a trait.
    const flipped = applyCommand(t.state, { type: "changeForm", playerId: P1 }, deps);
    if (!flipped.ok) throw new Error(flipped.error.message);
    expect(refusal(t, [withInterrupt(t, [t.agent])], flipped.state)).toBeDefined();
    expect(refusal(t, [withInterrupt(t, [t.scout])], flipped.state)).toBeUndefined();
  });

  it("overpaying is legal: 5 resources toward a cost of 2 pays it, the 3 cards stay exhausted and nothing carries over", () => {
    const t = table(2);
    const { state, events } = pay(t, [withInterrupt(t, [t.agent, t.office, t.analyst])]);
    expect(resolved(state)).toBe(1);
    expect(generated(events)).toEqual([pool({ physical: 1, energy: 1, mental: 2 })]);
    expect(played(events).map((p) => p.resourcesPaid)).toEqual([5]);
    expect(exhausted(state, t.agent, t.office, t.analyst)).toEqual([true, true, true]);
    expect(mustPlayer(state, P1).hand).toEqual([]);
  });

  it("is used only by the entry that spends its card, once, and one card pays one cost", () => {
    const t = table(1, 2);
    const asAbility: Payment = { ability: { instanceId: t.backing[0]!, abilityId: BACKING_INTERRUPT.ref.id } };
    // Not a "Resource" ability: naming it as one, with or without the card, is refused.
    expect(refusal(t, [asAbility])).toMatch(/spending its card/);
    expect(refusal(t, [plain(t), asAbility])).toMatch(/spending its card/);
    // One card is spent once.
    expect(refusal(t, [plain(t), withInterrupt(t, [t.agent])])).toMatch(/duplicate payment card/);
    // Two copies cannot exhaust the same card; with different cards each generates its own.
    expect(refusal(t, [withInterrupt(t, [t.agent], 0), withInterrupt(t, [t.agent], 1)])).toMatch(/two costs/);
    const four = table(4, 2);
    const { state, events } = pay(four, [withInterrupt(four, [four.agent], 0), withInterrupt(four, [four.office], 1)]);
    expect(generated(events)).toEqual([pool({ physical: 1 }), pool({ energy: 1 })]);
    expect(played(events)).toEqual([{ resourcesPaid: 4, paid: pool({ mental: 2, physical: 1, energy: 1 }) }]);
    expect(exhausted(state, four.agent, four.office)).toEqual([true, true]);
    // An ability that is not printed on the spent card is not its interrupt: another event spent "with" it.
    const second = giveCard(t.state, P1, costing(4).id);
    const other: Payment = {
      fromHand: second.id,
      whenSpent: { abilityId: BACKING_INTERRUPT.ref.id, costChoices: { exhausted: [t.agent] } },
    };
    expect(refusal(t, [other], second.state)).toMatch(/not a when-spent ability/);
  });

  it("is printed as an Interrupt: that is its timing word, not Resource", () => {
    expect(timingWordOf({ kind: "resource", whenSpent: true })).toBe("interrupt");
    expect(timingWordOf({ kind: "resource", whenSpent: true, form: "hero" })).toBe("heroInterrupt");
    expect(timingWordOf({ kind: "resource" })).toBe("resource");
  });

  describe("the listing", () => {
    const three = ["agent", "office", "analyst"];

    it("payment options: the plain spending first, then one option per pick of 1, 2 or 3 of the cards that can pay", () => {
      const t = table(3, 1, three);
      const use = (...ids: readonly InstanceId[]) => spentCardOptionId(withInterrupt(t, ids) as never);
      expect(optionIds(t)).toEqual([
        `hand:${t.backing[0]}`,
        use(t.agent),
        use(t.office),
        use(t.analyst),
        use(t.agent, t.office),
        use(t.agent, t.analyst),
        use(t.office, t.analyst),
        use(t.agent, t.office, t.analyst),
      ]);
      expect(use(t.agent, t.office)).toBe(
        `hand:${t.backing[0]}:${BACKING_INTERRUPT.ref.id}@exhausted=${t.agent},${t.office}`,
      );
    });

    it("payment sources: each such option is the card's resources and the picks' together, marked as spending the card", () => {
      const t = table(3, 1, three);
      const sources = query(t)?.sources ?? [];
      expect(sources.map((s) => [s.kind, s.spendsHandCard ?? false, s.pool])).toEqual([
        ["handCard", false, pool({ mental: 1 })],
        ["resourceAbility", true, pool({ mental: 1, physical: 1 })],
        ["resourceAbility", true, pool({ mental: 1, energy: 1 })],
        ["resourceAbility", true, pool({ mental: 3 })],
        ["resourceAbility", true, pool({ mental: 1, physical: 1, energy: 1 })],
        ["resourceAbility", true, pool({ mental: 3, physical: 1 })],
        ["resourceAbility", true, pool({ mental: 3, energy: 1 })],
        ["resourceAbility", true, pool({ mental: 3, physical: 1, energy: 1 })],
      ]);
      expect(sources.every((s) => s.instanceId === t.backing[0])).toBe(true);
      expect(sources[4]?.costChoices).toEqual({ exhausted: [t.agent, t.office] });
    });

    it("a card only the interrupt makes affordable is listed, with a payment that exhausts no more than it needs", () => {
      // Cost 3 from one card worth 1: the analyst's 2 printed resources make it, with one card exhausted.
      const t = table(3, 1, three);
      const action = listed(t);
      expect(action).toBeDefined();
      const example = action!.example as Extract<Command, { type: "playCard" }>;
      expect(example.payment).toEqual([withInterrupt(t, [t.analyst])]);
      expect(query(t)?.suggested).toEqual([spentCardOptionId(withInterrupt(t, [t.analyst]) as never)]);
      expect(applyCommand(t.state, action!.example, deps).ok).toBe(true);
      // Cost 5 needs all three.
      const five = table(5, 1, three);
      expect(query(five)?.suggested).toEqual([
        spentCardOptionId(withInterrupt(five, [five.agent, five.office, five.analyst]) as never),
      ]);
      // Cost 6 is out of reach: 1 + 4.
      const six = table(6, 1, three);
      expect(listed(six)).toBeUndefined();
      expect(query(six)?.suggested).toEqual([]);
    });

    it("a card the plain spending pays for is suggested without the interrupt", () => {
      const t = table(1, 1, three);
      expect(query(t)?.suggested).toEqual([`hand:${t.backing[0]}`]);
      expect((listed(t)!.example as Extract<Command, { type: "playCard" }>).payment).toEqual([plain(t)]);
    });

    it("with no card that can pay its cost there is only the plain spending, and the bonus is not counted", () => {
      const t = table(2, 1, ["outsider", "scout"]);
      expect(optionIds(t)).toEqual([`hand:${t.backing[0]}`]);
      expect(query(t)?.sources.map((s) => s.kind)).toEqual(["handCard"]);
      expect(listed(t)).toBeUndefined();
    });

    it("two copies: the suggestion spends each once, with different cards", () => {
      // Cost 6 from two cards worth 1 each: 2 + the analyst's 2 + two more single resources.
      const t = table(6, 2, three);
      const suggested = query(t)?.suggested ?? [];
      const picks = suggested.map((id) => id.split("=")[1]?.split(",") ?? []);
      expect(suggested).toHaveLength(2);
      expect(new Set(picks.flat()).size).toBe(picks.flat().length);
      expect(applyCommand(t.state, listed(t)!.example, deps).ok).toBe(true);
    });
  });
});
