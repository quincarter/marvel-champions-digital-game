/**
 * docs/phase7-wave7.md §3.27: "After a status card is placed on X" (`TriggerEvent statusPlaced`). Synthetic cards shaped
 * like a villain whose stage reads "Forced Response: After a status card is placed on [this villain], place 1 threat on
 * the main scheme."
 *
 * Sources: RRG 1.8 "Status Cards" (p. 41: "When a character is given a status card, take a status card of the
 * specified type from the pool and place it on that character. A character cannot have more than one status card of
 * each type at a time"; steady allows one more stunned and one more confused), "Stun, Stunned" (p. 41) and "Confuse,
 * Confused" (p. 13: "cannot be stunned / confused": the status card "cannot be placed on that character"), "Stalwart"
 * (p. 40), "Tough" (p. 44), "Toughness" (p. 45: "Forced Response: After this character enters play, give it a tough
 * status card"), "Triggering Condition" (p. 45: one occurrence, one window), "Simultaneous Timing Priority" (p. 5).
 * One event per card placed, as wave 6 §4.1 Q5 / Q8 decided for `statusDiscarded` and `countersPlaced`.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, StatusName, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { flat } from "@mc/content";
import { stubEvent, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const self: TargetRef = { kind: "self" };
const villain: TargetRef = { kind: "villain" };
const placed: TargetRef = { kind: "eventTarget" };
const yourHero: TargetQuery = { categories: ["identity"], controller: "you" };
const def = (definition: AbilityDefinition) => definition;
const give = (target: TargetRef, status: StatusName): EffectSpec => ({ kind: "giveStatus", target, status });
const bump = (counterType: string, amount = 1): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: amount },
});

// "Forced Response: After a status card is placed on [this villain], place 1 threat on the main scheme."
const VILLAIN_RESPONSE = stubAbility(
  "villain.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "statusPlaced", selfIs: "target" } },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
  }),
);
// A response that itself gives status cards: it must stop once the villain holds one of each.
const LOOP_RESPONSE = stubAbility(
  "looper.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "statusPlaced", selfIs: "target" } },
    effects: [bump("fired"), give(self, "stunned"), give(self, "tough"), give(self, "confused")],
  }),
);
const MINION_RESPONSE = stubAbility(
  "brute.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "statusPlaced", selfIs: "target" } },
    effects: [bump("placed")],
  }),
);
// "While this minion is engaged with you, you are confused."
const QUEEN_CONSTANT = stubAbility(
  "queen.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "keepsGivingStatus",
          target: { categories: ["identity"], controlledBy: { kind: "controller" } },
          status: "confused",
        },
      ],
    },
    effects: [],
  }),
);
// An encounter card's own effect: "When Revealed: Give the villain a tough status card."
const HARDEN_REVEALED = stubAbility(
  "harden.when-revealed",
  def({ trigger: { kind: "whenRevealed" }, effects: [give(villain, "tough")] }),
);
// The watcher's filters: by status, by "you placed it", by character, and what the listener sees on the character.
const countOnPlaced = (status: StatusName): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType: "seen",
  amount: { kind: "statusCount", of: placed, status },
});
const WATCHES = [
  stubAbility("watch-stun.forced-response", {
    trigger: { kind: "response", forced: true, on: { on: "statusPlaced", eventIs: { status: "stunned" } } },
    effects: [bump("stunned")],
  }),
  stubAbility("watch-mine.forced-response", {
    trigger: { kind: "response", forced: true, on: { on: "statusPlaced", playerIs: "controller" } },
    effects: [bump("mine")],
  }),
  stubAbility("watch-hero.forced-response", {
    trigger: { kind: "response", forced: true, on: { on: "statusPlaced", targetIs: yourHero } },
    effects: [bump("hero")],
  }),
  stubAbility("watch-seen.forced-response", {
    trigger: { kind: "response", forced: true, on: { on: "statusPlaced", targetIs: { categories: ["villain"] } } },
    effects: [countOnPlaced("stunned"), countOnPlaced("confused"), countOnPlaced("tough")],
  }),
];
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: WATCHES.map((w) => w.ref) });

const stage = { hp: flat(20), atk: 2, sch: 1 };
const SINISTER = stubVillain({ id: "sinister", stages: [{ ...stage, abilities: [VILLAIN_RESPONSE.ref] }] });
const TOUGH_SINISTER = stubVillain({
  id: "tough-sinister",
  stages: [{ ...stage, keywords: [{ name: "toughness" }], abilities: [VILLAIN_RESPONSE.ref] }],
});
const STALWART_SINISTER = stubVillain({
  id: "stalwart-sinister",
  stages: [{ ...stage, keywords: [{ name: "stalwart" }], abilities: [VILLAIN_RESPONSE.ref] }],
});
const STEADY_SINISTER = stubVillain({
  id: "steady-sinister",
  stages: [{ ...stage, keywords: [{ name: "steady" }], abilities: [VILLAIN_RESPONSE.ref] }],
});
const LOOPER = stubVillain({ id: "looper", stages: [{ ...stage, abilities: [LOOP_RESPONSE.ref] }] });

const BRUTE = stubMinion({
  id: "brute",
  atk: 0,
  sch: 0,
  hp: 4,
  boostIcons: 0,
  keywords: [{ name: "toughness" }],
  abilities: [MINION_RESPONSE.ref],
});
const QUEEN = stubMinion({ id: "queen", atk: 0, sch: 0, hp: 4, boostIcons: 0, abilities: [QUEEN_CONSTANT.ref] });
const HARDEN = stubTreachery({ id: "harden", boostIcons: 0, abilities: [HARDEN_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const STUN = event("stun", [give(villain, "stunned")]);
const CONFUSE = event("confuse", [give(villain, "confused")]);
const TOUGHEN = event("toughen", [give(villain, "tough")]);
const STUN_AND_CONFUSE = event("stun-and-confuse", [give(villain, "stunned"), give(villain, "confused")]);
const STUN_ENEMIES = event("stun-enemies", [
  give({ kind: "each", query: { categories: ["villain", "minion"] } }, "stunned"),
]);
const EVENTS = [STUN, CONFUSE, TOUGHEN, STUN_AND_CONFUSE, STUN_ENEMIES];

const deps: EngineDeps = depsOf(
  VILLAIN_RESPONSE,
  LOOP_RESPONSE,
  MINION_RESPONSE,
  QUEEN_CONSTANT,
  HARDEN_REVEALED,
  ...WATCHES,
  ...EVENTS.map((e) => e.ability),
);

function start(villainCard = SINISTER, options: { readonly watcher?: boolean } = {}): GameState {
  const state = gameAtFirstTurn({
    deps,
    villain: villainCard,
    cards: [WATCHER, BRUTE, QUEEN, HARDEN, BLANK, ...EVENTS.map((e) => e.card)],
    encounter: [BRUTE.id, QUEEN.id, HARDEN.id, ...copiesOf(BLANK.id, 30)],
    deck: [WATCHER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
  });
  const seated = options.watcher ? playerCardIntoPlay(state, WATCHER.id).state : state;
  return { ...seated, players: seated.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}

const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const heroId = (state: GameState): InstanceId => state.players[0]!.identity.instanceId;
const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const statuses = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses;
const inPlay = (state: GameState, card: string): InstanceId =>
  state.players[0]!.playArea.find((id) => mustInstance(state, id).cardId === card)!;
const watched = (state: GameState, type: string): number =>
  mustInstance(state, inPlay(state, WATCHER.id)).counters[type] ?? 0;

type Pick = (state: GameState) => readonly string[];
function run(state: GameState, pick: Pick, ...commands: readonly Command[]) {
  return runCommandsPicking(state, deps, pick, ...commands);
}
function play(state: GameState, card: string, pick: Pick = defaultPick) {
  const given = giveCard(state, P1, card);
  return run(given.state, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const placedEvents = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "statusPlaced" ? [e.event] : [],
  );
/** The response windows opened for `statusPlaced`, each as its candidates' ability ids. */
const windows = (events: readonly GameEvent[]): readonly (readonly string[])[] =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === "response" && e.event.kind === "statusPlaced"
      ? [e.candidates.map((c) => `${c.abilityId}`)]
      : [],
  );
const resolvedOn = (events: readonly GameEvent[], abilityId: string): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "abilityResolved" && e.abilityId === abilityId ? [e.instanceId] : []));

function expectReplays(result: ReturnType<typeof run>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("§3.27 statusPlaced", () => {
  it.each([
    [STUN, "stunned"],
    [CONFUSE, "confused"],
    [TOUGHEN, "tough"],
  ] as const)("a %o effect on the villain places its threat once", (card, status) => {
    const base = start();
    const result = play(base, card.card.id);
    const id = villainId(result.state);
    expect(statuses(result.state, id)[status]).toBe(1);
    expect(placedEvents(result.events)).toEqual([
      { kind: "statusPlaced", instanceId: id, status, sourceInstanceId: expect.any(String), playerId: P1 },
    ]);
    expect(threat(result.state)).toBe(threat(base) + 1);
    // Nothing is left waiting once it was announced.
    expect(result.state.pendingStatusPlaced).toBeUndefined();
    expectReplays(result);
  });

  it("names the card whose effect placed it as the source", () => {
    const given = giveCard(start(), P1, STUN.card.id);
    const result = run(given.state, defaultPick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(placedEvents(result.events)).toEqual([
      {
        kind: "statusPlaced",
        instanceId: villainId(result.state),
        status: "stunned",
        sourceInstanceId: given.id,
        playerId: P1,
      },
    ]);
  });

  it("a villain that already has that status card gets no second one: nothing placed, no event (RRG p. 41)", () => {
    const stunned = play(start(), STUN.card.id).state;
    const result = play(stunned, STUN.card.id);
    expect(statuses(result.state, villainId(result.state)).stunned).toBe(1);
    expect(placedEvents(result.events)).toEqual([]);
    expect(result.events.some((e) => e.type === "statusGiven")).toBe(false);
    expect(threat(result.state)).toBe(threat(stunned));
    expectReplays(result);
  });

  it("a stalwart villain is never stunned or confused, so nothing fires; a tough card still lands (RRG p. 40)", () => {
    const base = start(STALWART_SINISTER);
    const stunned = play(base, STUN.card.id);
    const confused = play(stunned.state, CONFUSE.card.id);
    expect(statuses(confused.state, villainId(confused.state))).toEqual({ stunned: 0, confused: 0, tough: 0 });
    expect(placedEvents([...stunned.events, ...confused.events])).toEqual([]);
    expect(threat(confused.state)).toBe(threat(base));
    const tough = play(confused.state, TOUGHEN.card.id);
    expect(placedEvents(tough.events)).toHaveLength(1);
    expect(threat(tough.state)).toBe(threat(base) + 1);
    expectReplays(tough);
  });

  it("a steady villain holds two stunned cards: each one placed fires, a third does not (RRG p. 41)", () => {
    const base = start(STEADY_SINISTER);
    const first = play(base, STUN.card.id);
    const second = play(first.state, STUN.card.id);
    const third = play(second.state, STUN.card.id);
    expect(statuses(third.state, villainId(third.state)).stunned).toBe(2);
    expect(placedEvents(first.events)).toHaveLength(1);
    expect(placedEvents(second.events)).toHaveLength(1);
    expect(placedEvents(third.events)).toEqual([]);
    expect(threat(third.state)).toBe(threat(base) + 2);
  });

  it("an effect giving two different status cards fires twice", () => {
    const base = start();
    const result = play(base, STUN_AND_CONFUSE.card.id);
    const id = villainId(result.state);
    expect(statuses(result.state, id)).toEqual({ stunned: 1, confused: 1, tough: 0 });
    expect(placedEvents(result.events).map((e) => (e.kind === "statusPlaced" ? e.status : null))).toEqual([
      "stunned",
      "confused",
    ]);
    expect(resolvedOn(result.events, VILLAIN_RESPONSE.ref.id)).toEqual([id, id]);
    expect(threat(result.state)).toBe(threat(base) + 2);
    expectReplays(result);
  });

  it("the toughness keyword places a tough card as the villain enters play at setup, and that fires it", () => {
    const plain = gameAtFirstTurn({ deps, villain: SINISTER, cards: [] });
    const tough = gameAtFirstTurn({ deps, villain: TOUGH_SINISTER, cards: [] });
    expect(statuses(tough, villainId(tough)).tough).toBe(1);
    expect(threat(plain)).toBe(0);
    expect(threat(tough)).toBe(1);
    expect(tough.pendingStatusPlaced).toBeUndefined();
  });

  it("the toughness keyword on a minion entering play fires it, with the minion as its own source", () => {
    // The villain's attack turns over one boost card (a blank) first; the encounter card dealt to p1 is the minion.
    const state = onTopOfEncounterDeck(onTopOfEncounterDeck(start(), BRUTE.id), BLANK.id);
    const result = run(state, defaultPick, { type: "endTurn", playerId: P1 });
    const brute = inPlay(result.state, BRUTE.id);
    expect(statuses(result.state, brute).tough).toBe(1);
    expect(placedEvents(result.events)).toEqual([
      { kind: "statusPlaced", instanceId: brute, status: "tough", sourceInstanceId: brute, playerId: null },
    ]);
    expect(mustInstance(result.state, brute).counters.placed).toBe(1);
    expectReplays(result);
  });

  it("an encounter card's effect fires it with no placing player; the 'you placed it' filter leaves it alone", () => {
    const base = start(SINISTER, { watcher: true });
    const mine = play(base, STUN.card.id);
    expect(watched(mine.state, "mine")).toBe(1);
    // The stunned villain's attack is cancelled before a boost card is dealt, so the encounter card dealt to p1 is the
    // top card.
    const state = onTopOfEncounterDeck(mine.state, HARDEN.id);
    const result = run(state, defaultPick, { type: "endTurn", playerId: P1 });
    const id = villainId(result.state);
    expect(placedEvents(result.events)).toEqual([
      { kind: "statusPlaced", instanceId: id, status: "tough", sourceInstanceId: expect.any(String), playerId: null },
    ]);
    // The villain's own response answered the encounter card's tough card; the player's "you" response did not.
    expect(resolvedOn(result.events, VILLAIN_RESPONSE.ref.id)).toEqual([id]);
    expect(watched(result.state, "mine")).toBe(1);
    expectReplays(result);
  });

  it("is filtered by status and by character, and the listener sees the card already on the character", () => {
    const base = start(SINISTER, { watcher: true });
    const confused = play(base, CONFUSE.card.id);
    expect(watched(confused.state, "stunned")).toBe(0);
    // One status card on the villain when the response resolved: the confused card just placed.
    expect(watched(confused.state, "seen")).toBe(1);
    const stunned = play(confused.state, STUN.card.id);
    expect(watched(stunned.state, "stunned")).toBe(1);
    // Now two: the confused card from before and the stunned card just placed.
    expect(watched(stunned.state, "seen")).toBe(1 + 2);
    expect(watched(stunned.state, "mine")).toBe(2);
    // Neither was placed on the player's hero.
    expect(watched(stunned.state, "hero")).toBe(0);
    expectReplays(stunned);
  });

  it("a constant's status card is a placement, and so is the one given again when it is spent", () => {
    const engaged = minionEngagedWith(start(SINISTER, { watcher: true }), QUEEN.id);
    // The first command boundary over the surgery: the constant confuses the hero.
    const first = play(engaged.state, TOUGHEN.card.id);
    const id = heroId(first.state);
    expect(statuses(first.state, id).confused).toBe(1);
    expect(placedEvents(first.events)).toContainEqual({
      kind: "statusPlaced",
      instanceId: id,
      status: "confused",
      sourceInstanceId: engaged.id,
      playerId: null,
    });
    expect(watched(first.state, "hero")).toBe(1);
    // A thwart attempt spends the confused card; the constant gives another at once (RRG 1.8 FAQ "White Queen", p. 63).
    const result = run(first.state, defaultPick, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: id,
      schemeInstanceId: first.state.mainScheme.instanceId,
    });
    expect(statuses(result.state, id).confused).toBe(1);
    expect(placedEvents(result.events)).toEqual([
      { kind: "statusPlaced", instanceId: id, status: "confused", sourceInstanceId: engaged.id, playerId: null },
    ]);
    expect(watched(result.state, "hero")).toBe(2);
    // No player placed either of them.
    expect(watched(result.state, "mine")).toBe(1);
    expectReplays(result);
  });

  it("one effect on several characters is one event each in one window; the first player orders the responses", () => {
    const engaged = minionEngagedWith(start(), BRUTE.id);
    const brute = engaged.id;
    const bruteFirst: Pick = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "orderTriggers") return defaultPick(state);
      const ids = choice.options.map((o) => o.optionId);
      return [...ids.filter((id) => id.startsWith(`${brute}:`)), ...ids.filter((id) => !id.startsWith(`${brute}:`))];
    };
    const result = play(engaged.state, STUN_ENEMIES.card.id, bruteFirst);
    const id = villainId(result.state);
    expect(statuses(result.state, id).stunned).toBe(1);
    expect(statuses(result.state, brute).stunned).toBe(1);
    expect(
      placedEvents(result.events)
        .map((e) => (e.kind === "statusPlaced" ? e.instanceId : null))
        .sort(),
    ).toEqual([id, brute].sort());
    // One shared window holding both forced responses (RRG 1.8 "Triggering Condition", p. 45).
    const opened = windows(result.events);
    expect(opened).toHaveLength(1);
    expect([...opened[0]!].sort()).toEqual([MINION_RESPONSE.ref.id, VILLAIN_RESPONSE.ref.id].sort());
    // Simultaneous forced responses: the first player picks the order (RRG 1.8 p. 5), here the minion's first.
    const prompts = result.events.flatMap((e) =>
      e.type === "choiceRequested" && e.choice.prompt.kind === "orderTriggers" ? [e.choice] : [],
    );
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ playerId: result.state.firstPlayerId, authority: "firstPlayerOrders" });
    const order = result.events.flatMap((e) =>
      e.type === "abilityResolved" && [MINION_RESPONSE.ref.id, VILLAIN_RESPONSE.ref.id].includes(e.abilityId)
        ? [e.abilityId]
        : [],
    );
    expect(order).toEqual([MINION_RESPONSE.ref.id, VILLAIN_RESPONSE.ref.id]);
    expect(mustInstance(result.state, brute).counters.placed).toBe(1);
    expectReplays(result);
  });

  it("a response that gives status cards itself stops once the character holds one of each", () => {
    const result = play(start(LOOPER), STUN.card.id);
    const id = villainId(result.state);
    expect(statuses(result.state, id)).toEqual({ stunned: 1, confused: 1, tough: 1 });
    // Three cards landed (the stun, then the response's tough and confused), so three events and three responses; the
    // gives that found the card already there placed nothing and announced nothing.
    expect(placedEvents(result.events)).toHaveLength(3);
    expect(mustInstance(result.state, id).counters.fired).toBe(3);
    expect(result.state.stack).toEqual([]);
    expectReplays(result);
  });

  it("with nothing listening, nothing is recorded or pushed", () => {
    const bare: EngineDeps = depsOf(STUN.ability);
    const state = gameAtFirstTurn({ deps: bare, cards: [STUN.card], deck: copiesOf(STUN.card.id, 3) });
    const given = giveCard(state, P1, STUN.card.id);
    const result = runCommandsPicking(given.state, bare, defaultPick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(statuses(result.state, villainId(result.state)).stunned).toBe(1);
    expect(result.events.some((e) => e.type === "statusGiven")).toBe(true);
    expect(placedEvents(result.events)).toEqual([]);
    expect(result.state.pendingStatusPlaced).toBeUndefined();
  });
});
