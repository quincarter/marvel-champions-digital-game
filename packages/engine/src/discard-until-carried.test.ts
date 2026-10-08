/**
 * docs/phase7-wave8.md §3.71: `EffectSpec discardDeckUntil.bindAll` (every card a "discard cards from the top of your
 * deck until an X is discarded" discarded, the match included) and `EffectSpec raiseMoment.carry` (slots of the raising
 * ability stamped on `momentRaised`, read by the abilities that answer it as `moment.<slot>`).
 *
 * RRG 1.8 "Player Deck" (p. 33: "if the player's deck empties while the player was discarding cards from their deck,
 * no further cards are discarded from the newly shuffled deck"), "'Then'" (p. 44), "Triggering Condition" (p. 45),
 * "Ability" (p. 5: forced before optional), "Wild Resource" (p. 48). Ruling, April 30, 2026 - Ruling 4, answer 1 (a
 * card a response took out of the discard "does not count"; docs/phase7-wave7.md §4.1 Q32). Owner decisions,
 * docs/phase7-wave8.md §4.1: Q41 = A (no match: the discards stand and are counted, the post-"then" text is skipped),
 * Q42 = A (the match, discarded and then added to hand, counts as discarded).
 *
 * Synthetic cards. "Puller" is a support whose actions discard until a [justice] card, add it to hand and raise
 * `"pull"`. "Grudge" has "Forced Response: After you resolve a pull, take 1 damage for each card discarded by it".
 * "Plating" has "Response: After you resolve a pull, if you discarded at least 1 [mental], …". "Echo" has "Response:
 * After this card is discarded from the top of your deck, add it to your hand".
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, PlayerRef, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const MOMENT = "pull";
const you: PlayerRef = { kind: "controller" };
const self: TargetRef = { kind: "self" };
const constant = (value: number) => ({ kind: "const", value }) as const;
const variable = (name: string): ValueSpec => ({ kind: "var", name });
const count = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount,
});
const action = (id: string, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(id, { trigger: { kind: "action" }, effects } satisfies AbilityDefinition);
const youPull: EventPattern = { on: "momentRaised", playerIs: "controller", eventIs: { name: MOMENT } };

/** "Discard cards from the top of your deck until a [justice] card is discarded → add that card to your hand." */
const pull = (opts: { readonly bindAll?: boolean; readonly carry?: readonly string[] }): readonly EffectSpec[] => [
  {
    kind: "discardDeckUntil",
    player: you,
    filter: { aspect: "justice" },
    bind: "found",
    ...(opts.bindAll === false ? {} : { bindAll: "pulled" }),
  },
  // What the raising ability itself reads of the set, before the match leaves the discard pile.
  count("pulled", variable("pulled.count")),
  {
    kind: "then",
    effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, to: "hand" }],
  },
  { kind: "raiseMoment", name: MOMENT, player: you, ...(opts.carry ? { carry: opts.carry } : {}) },
  count("afterRaise", constant(1)),
];
const PULL = action("puller.pull", pull({ carry: ["pulled"] }));
/** The same pull, raising a moment that carries nothing. */
const PULL_BARE = action("puller.pull-bare", pull({}));
/** A moment carrying a slot its ability never bound. */
const PULL_UNBOUND = action("puller.pull-unbound", pull({ bindAll: false, carry: ["pulled"] }));
/**
 * "Used" and "resolved" as two moments (Q41 = A): the first is raised whatever the discard found, the second is
 * post-"then" text, so it is raised only when a match was found. Both carry the set.
 */
const PULL_TWO = action("puller.pull-two", [
  { kind: "discardDeckUntil", player: you, filter: { aspect: "justice" }, bind: "found", bindAll: "pulled" },
  {
    kind: "then",
    effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, to: "hand" }],
  },
  { kind: "raiseMoment", name: "pullUsed", player: you, carry: ["pulled"] },
  { kind: "then", effects: [{ kind: "raiseMoment", name: MOMENT, player: you, carry: ["pulled"] }] },
]);
const PULLER = stubSupport({
  id: "puller",
  cost: 0,
  abilities: [PULL.ref, PULL_BARE.ref, PULL_UNBOUND.ref, PULL_TWO.ref],
});

/** "Forced Response: After you resolve a pull, take 1 damage for each card discarded by it." */
const GRUDGE_ANSWER = stubAbility("grudge.answer", {
  trigger: { kind: "response", forced: true, on: youPull },
  effects: [
    { kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: variable("moment.pulled.count") },
    count("heard", constant(1)),
    // The carried slot itself, and the icons its cards showed.
    count("cards", { kind: "refCount", of: { kind: "slot", slot: "moment.pulled" } }),
    count("physical", variable("moment.pulled.physical")),
    count("wild", variable("moment.pulled.wild")),
  ],
} satisfies AbilityDefinition);
const GRUDGE = stubSupport({ id: "grudge", cost: 0, abilities: [GRUDGE_ANSWER.ref] });

/** "Response: After you resolve a pull, if you discarded at least 1 [mental], …" */
const PLATING_ANSWER = stubAbility("plating.answer", {
  trigger: {
    kind: "response",
    forced: false,
    on: youPull,
    while: { kind: "varAtLeast", name: "moment.pulled.mental", amount: 1 },
  },
  effects: [count("mental", variable("moment.pulled.mental"))],
} satisfies AbilityDefinition);
const PLATING = stubSupport({ id: "plating", cost: 0, abilities: [PLATING_ANSWER.ref] });

/** "Response: After this card is discarded from the top of your deck, add it to your hand." */
const ECHO_RESPONSE = stubAbility("echo.response", {
  trigger: { kind: "response", forced: false, on: { on: "cardDiscardedFromDeck", selfIs: "target" } },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "hand" }],
  activeIn: "discard",
} satisfies AbilityDefinition);

const BODY = stubEvent({ id: "body", cost: 0, resourceIcons: { physical: 1 } });
const MIND = stubEvent({ id: "mind", cost: 0, resourceIcons: { mental: 1 } });
/** The card a pull looks for: [justice], with an [energy] icon. */
const MATCH = stubEvent({ id: "match", cost: 0, aspect: "justice", resourceIcons: { energy: 1 } });
/** A match whose only icon is wild. */
const WILD_MATCH = stubEvent({ id: "wildmatch", cost: 0, aspect: "justice", resourceIcons: { wild: 1 } });
const ECHO = stubResource({ id: "echo", icons: 1, abilities: [ECHO_RESPONSE.ref] });

const ANSWERS = [GRUDGE_ANSWER, PLATING_ANSWER];
const PULLS = [PULL, PULL_BARE, PULL_UNBOUND, PULL_TWO];
const deps: EngineDeps = depsOf(...PULLS, ...ANSWERS, ECHO_RESPONSE);
/** The same cards in a game where no ability hears a discard from a deck. */
const silentDeps: EngineDeps = depsOf(...PULLS, ...ANSWERS);

type Name = "body" | "mind" | "match" | "wildmatch" | "echo";
type InPlay = "grudge" | "plating";
interface Table {
  readonly state: GameState;
  /** The deck, top first. */
  readonly deck: readonly InstanceId[];
  readonly puller: InstanceId;
  readonly inPlay: Readonly<Record<string, InstanceId>>;
  readonly using: EngineDeps;
}

/**
 * p1 in hero form with Puller and `inPlay` in play. The deck is exactly `deck` (top first) and the discard pile is
 * empty; every other card p1 owns is in hand (surgery before the session starts).
 */
function table(deck: readonly Name[], inPlay: readonly InPlay[] = [], using: EngineDeps = deps): Table {
  const base = gameAtFirstTurn({
    deps: using,
    cards: [BODY, MIND, MATCH, WILD_MATCH, ECHO, PULLER, GRUDGE, PLATING],
    deck: [
      ...copiesOf(BODY.id, 4),
      ...copiesOf(MIND.id, 3),
      ...copiesOf(MATCH.id, 2),
      WILD_MATCH.id,
      ...copiesOf(ECHO.id, 2),
      PULLER.id,
      GRUDGE.id,
      PLATING.id,
    ],
  });
  const seat = mustPlayer(base, P1);
  const pool = [...seat.hand, ...seat.deck, ...seat.discard];
  const taken = new Set<InstanceId>();
  const take = (cardId: string): InstanceId => {
    const id = pool.find((candidate) => !taken.has(candidate) && base.instances[candidate]?.cardId === cardId);
    if (!id) throw new Error(`no ${cardId} copy left`);
    taken.add(id);
    return id;
  };
  const deckIds = deck.map(take);
  const placed: Record<string, InstanceId> = {};
  for (const name of ["puller", ...inPlay]) placed[name] = take(name);
  const played = Object.values(placed);
  const instances = { ...base.instances };
  for (const id of played) instances[id] = { ...mustInstance(base, id), controllerId: P1, faceup: true };
  const state: GameState = {
    ...base,
    instances,
    players: base.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: pool.filter((id) => !taken.has(id)),
            deck: deckIds,
            discard: [],
            playArea: [...p.playArea, ...played],
            identity: { ...p.identity, form: "hero" as const },
          }
        : p,
    ),
  };
  return { state, deck: deckIds, puller: placed.puller!, inPlay: placed, using };
}

const use = (at: Table, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: at.puller,
  abilityId: ability.ref.id,
  payment: [],
});

/** Uses one of Puller's abilities, triggering every optional response offered, and records each prompt. */
function run(at: Table, ability: StubAbility = PULL, opts: { readonly decline?: readonly StubAbility[] } = {}) {
  const prompts: { kind: string; player: PlayerId; abilities: readonly string[] }[] = [];
  const declined = new Set((opts.decline ?? []).map((a) => `${a.ref.id}`));
  const { session, events } = driveSession(startSession(at.state), at.using, [use(at, ability)], (current) => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    const offered = choice.options.flatMap((option) =>
      option.ref.kind === "ability" ? [{ optionId: option.optionId, abilityId: `${option.ref.abilityId}` }] : [],
    );
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, abilities: offered.map((o) => o.abilityId) });
    if (choice.prompt.kind === "chooseTriggers")
      return offered.filter((o) => !declined.has(o.abilityId)).map((o) => o.optionId);
    return defaultPick(current);
  });
  return { session, state: session.state, events, prompts };
}

const seat = (state: GameState) => mustPlayer(state, P1);
const counter = (state: GameState, id: InstanceId | undefined, type: string): number =>
  (id ? mustInstance(state, id).counters[type] : undefined) ?? 0;
const identityDamage = (state: GameState): number => mustInstance(state, seat(state).identity.instanceId).damage;
const raisedLog = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === "momentRaised" ? [event] : []));
/** The `momentRaised` trigger events that went on the stack. */
const onStack = (events: readonly GameEvent[]) =>
  events.flatMap((event) =>
    event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "momentRaised"
      ? [event.event]
      : [],
  );
const resolved = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) => (event.type === "abilityResolved" ? [`${event.abilityId}`] : []));
const notCounted = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === "deckDiscardNotCounted" ? [[event.instanceId, event.slot]] : []));
const shuffles = (events: readonly GameEvent[]): number =>
  events.filter((event) => event.type === "deckShuffled" && event.zone.kind === "deck").length;
/** A bound set's vars, as `raiseMoment.carry` stamps them. */
const totals = (
  count_: number,
  icons: { readonly physical?: number; readonly mental?: number; readonly energy?: number; readonly wild?: number },
) => ({
  "pulled.count": count_,
  "pulled.physical": icons.physical ?? 0,
  "pulled.mental": icons.mental ?? 0,
  "pulled.energy": icons.energy ?? 0,
  "pulled.wild": icons.wild ?? 0,
  "pulled.boostIcons": 0,
  "pulled.starIcons": 0,
});

describe("§3.71 discardDeckUntil.bindAll: every card discarded, the match included", () => {
  it("holds the three cards in discard order with the match last, and reports the set's count and printed icons", () => {
    const at = table(["body", "mind", "match", "body", "mind"]);
    const [body, mind, match] = at.deck;
    const after = run(at);
    // The match was discarded and then added to hand (Q42 = A: it is one of the cards discarded).
    expect(seat(after.state).discard).toEqual([mind, body]);
    expect(seat(after.state).hand).toContain(match);
    expect(seat(after.state).deck).toEqual(at.deck.slice(3));
    // The raising ability's own read: 3 cards.
    expect(counter(after.state, at.puller, "pulled")).toBe(3);
    expect(raisedLog(after.events)).toEqual([
      {
        type: "momentRaised",
        name: MOMENT,
        playerId: P1,
        sourceInstanceId: at.puller,
        carried: { pulled: [body, mind, match] },
        carriedVars: totals(3, { physical: 1, mental: 1, energy: 1 }),
      },
    ]);
    expect(after.events.some((event) => event.type === "thenSkipped")).toBe(false);
  });

  it("a match on top of the deck is the whole set: one card, and a wild icon is none of the three types", () => {
    const at = table(["wildmatch", "body"]);
    const after = run(at);
    expect(raisedLog(after.events)[0]?.carried).toEqual({ pulled: [at.deck[0]] });
    expect(raisedLog(after.events)[0]?.carriedVars).toEqual(totals(1, { wild: 1 }));
    expect(seat(after.state).deck).toEqual([at.deck[1]]);
  });

  it("the match-only slot is unchanged by bindAll: one card, and without bindAll nothing else is bound", () => {
    const at = table(["body", "match", "mind"]);
    const after = run(at, PULL_UNBOUND);
    expect(seat(after.state).hand).toContain(at.deck[1]);
    // `pulled.count` was never bound: the raising ability reads 0, and the moment carries the slot empty.
    expect(counter(after.state, at.puller, "pulled")).toBe(0);
    expect(raisedLog(after.events)[0]?.carried).toEqual({ pulled: [] });
    expect(raisedLog(after.events)[0]?.carriedVars).toEqual({});
  });

  it("drops a card a response to its own discard took away, from the set and from its totals (wave 7 Q32)", () => {
    const at = table(["body", "echo", "match", "mind"]);
    const [body, echo, match] = at.deck;
    const after = run(at);
    expect(resolved(after.events)).toEqual([PULL.ref.id, ECHO_RESPONSE.ref.id]);
    expect(seat(after.state).hand).toEqual(expect.arrayContaining([echo, match]));
    // Echo sat in the set of every card discarded only (it was no match), so it is dropped from that one slot.
    expect(notCounted(after.events)).toEqual([[echo, "pulled"]]);
    expect(counter(after.state, at.puller, "pulled")).toBe(2);
    expect(raisedLog(after.events)[0]?.carried).toEqual({ pulled: [body, match] });
    expect(raisedLog(after.events)[0]?.carriedVars).toEqual(totals(2, { physical: 1, energy: 1 }));
  });

  it("keeps that card when its response is declined", () => {
    const at = table(["body", "echo", "match", "mind"]);
    const after = run(at, PULL, { decline: [ECHO_RESPONSE] });
    expect(notCounted(after.events)).toEqual([]);
    expect(raisedLog(after.events)[0]?.carried).toEqual({ pulled: at.deck.slice(0, 3) });
    expect(raisedLog(after.events)[0]?.carriedVars).toEqual(totals(3, { physical: 1, energy: 1, wild: 1 }));
  });
});

describe("§3.71 the deck runs out (RRG p. 33; Q41 = A)", () => {
  it("no match in a deck of four: four discarded and counted, the deck resets, one encounter card, nothing to hand", () => {
    const at = table(["body", "mind", "body", "mind"], ["grudge", "plating"], silentDeps);
    const hand = seat(at.state).hand;
    const after = run(at);
    // The discard that emptied the deck reset it at once and the discarding stopped there: the four cards are the
    // new deck, and none was discarded a second time.
    expect(shuffles(after.events)).toBe(1);
    expect([...seat(after.state).deck].sort()).toEqual([...at.deck].sort());
    expect(seat(after.state).discard).toEqual([]);
    expect(seat(after.state).dealtEncounter).toHaveLength(1);
    expect(seat(after.state).hand).toEqual(hand);
    // The pre-"then" text did not fully resolve: "add that card to your hand" is skipped.
    expect(after.events).toContainEqual({ type: "preThenUnresolved", cause: "discardUntilFoundNothing" });
    expect(after.events.filter((event) => event.type === "thenSkipped")).toHaveLength(1);
    // The discards stand and are all in the set, in order, wherever the reset put them.
    expect(counter(after.state, at.puller, "pulled")).toBe(4);
    expect(raisedLog(after.events)[0]?.carried).toEqual({ pulled: at.deck });
    expect(raisedLog(after.events)[0]?.carriedVars).toEqual(totals(4, { physical: 2, mental: 2 }));
    // An answer counts them: 1 damage for each of the 4.
    expect(identityDamage(after.state)).toBe(4);
  });

  it("the match is the deck's last card: the deck resets, one encounter card, and it is taken from the new deck", () => {
    const at = table(["body", "mind", "match"]);
    const [body, mind, match] = at.deck;
    const after = run(at);
    expect(shuffles(after.events)).toBe(1);
    expect(seat(after.state).dealtEncounter).toHaveLength(1);
    expect(seat(after.state).hand).toContain(match);
    expect([...seat(after.state).deck].sort()).toEqual([body, mind].sort());
    expect(after.events.some((event) => event.type === "thenSkipped")).toBe(false);
    expect(raisedLog(after.events)[0]?.carried).toEqual({ pulled: [body, mind, match] });
    expect(raisedLog(after.events)[0]?.carriedVars).toEqual(totals(3, { physical: 1, mental: 1, energy: 1 }));
  });
});

describe("§3.71 raiseMoment.carry: the abilities that answer the moment read the carried slots", () => {
  it("a forced response reads the slot and its vars as moment.<slot>, in its effects", () => {
    const at = table(["body", "mind", "match", "body"], ["grudge"]);
    const [body, mind, match] = at.deck;
    const after = run(at);
    const grudge = at.inPlay.grudge;
    expect(resolved(after.events)).toEqual([PULL.ref.id, GRUDGE_ANSWER.ref.id]);
    // 1 damage for each card discarded, the match (now in hand) included: 3.
    expect(identityDamage(after.state)).toBe(3);
    expect(counter(after.state, grudge, "cards")).toBe(3);
    expect(counter(after.state, grudge, "physical")).toBe(1);
    expect(counter(after.state, grudge, "wild")).toBe(0);
    // The event on the stack is the one that carries them.
    expect(onStack(after.events)).toEqual([
      {
        kind: "momentRaised",
        name: MOMENT,
        playerId: P1,
        sourceInstanceId: at.puller,
        carried: { pulled: [body, mind, match] },
        carriedVars: totals(3, { physical: 1, mental: 1, energy: 1 }),
      },
    ]);
    // The answers resolved before the raising ability's next effect.
    expect(counter(after.state, at.puller, "afterRaise")).toBe(1);
    expect(after.state.stack).toEqual([]);
  });

  it("a condition reads them too: the optional response is offered when a [mental] was discarded, after the forced one", () => {
    const at = table(["body", "mind", "mind", "match"], ["grudge", "plating"]);
    const after = run(at);
    expect(after.prompts).toEqual([{ kind: "chooseTriggers", player: P1, abilities: [PLATING_ANSWER.ref.id] }]);
    expect(resolved(after.events)).toEqual([PULL.ref.id, GRUDGE_ANSWER.ref.id, PLATING_ANSWER.ref.id]);
    expect(identityDamage(after.state)).toBe(4);
    expect(counter(after.state, at.inPlay.plating, "mental")).toBe(2);
  });

  it("and is not offered when none was: the discard is a [physical] and the [energy] match", () => {
    const at = table(["body", "match", "mind"], ["plating"]);
    const after = run(at);
    expect(after.prompts).toEqual([]);
    expect(resolved(after.events)).toEqual([PULL.ref.id]);
    // Nothing could answer, so the moment is logged and never goes on the stack (§3.39's `heard` gate).
    expect(raisedLog(after.events)).toHaveLength(1);
    expect(onStack(after.events)).toEqual([]);
    expect(counter(after.state, at.inPlay.plating, "mental")).toBe(0);
  });

  it("each pull carries its own discard: a second pull's answers read the second set", () => {
    const at = table(["match", "body", "body", "mind", "match"], ["grudge"]);
    const first = run(at);
    expect(identityDamage(first.state)).toBe(1);
    const second = run({ ...at, state: first.state });
    expect(raisedLog(second.events)[0]?.carried).toEqual({ pulled: at.deck.slice(1) });
    // 1 + 4.
    expect(identityDamage(second.state)).toBe(5);
    expect(counter(second.state, at.inPlay.grudge, "physical")).toBe(2);
  });
});

describe('§3.71 "used" and "resolved" as two moments (Q41 = A)', () => {
  it("a match found: both are raised, the used one first, each carrying the set", () => {
    const at = table(["body", "match", "mind"], ["grudge"]);
    const after = run(at, PULL_TWO);
    const carried = { pulled: at.deck.slice(0, 2) };
    expect(raisedLog(after.events).map((event) => [event.name, event.carried])).toEqual([
      ["pullUsed", carried],
      [MOMENT, carried],
    ]);
    expect(identityDamage(after.state)).toBe(2);
  });

  it("no match: the used moment is raised with the four discards, the resolved one is not, and nothing answers it", () => {
    const at = table(["body", "mind", "body", "mind"], ["grudge", "plating"], silentDeps);
    const after = run(at, PULL_TWO);
    expect(raisedLog(after.events).map((event) => [event.name, event.carried])).toEqual([
      ["pullUsed", { pulled: at.deck }],
    ]);
    // Both post-"then" texts were skipped: the add to hand and the second raise.
    expect(after.events.filter((event) => event.type === "thenSkipped")).toHaveLength(2);
    expect(resolved(after.events)).toEqual([PULL_TWO.ref.id]);
    expect(identityDamage(after.state)).toBe(0);
    expect(after.prompts).toEqual([]);
  });
});

describe("§3.71 a moment with no carry is unchanged", () => {
  it("logs and raises the bare moment, and its answers read nothing", () => {
    const at = table(["body", "mind", "match"], ["grudge", "plating"]);
    const after = run(at, PULL_BARE);
    // Exactly §3.39's record: no `carried`, no `carriedVars`.
    const bare = { name: MOMENT, playerId: P1, sourceInstanceId: at.puller };
    expect(raisedLog(after.events)).toEqual([{ type: "momentRaised", ...bare }]);
    expect(onStack(after.events)).toEqual([{ kind: "momentRaised", ...bare }]);
    // The raising ability still has its own set …
    expect(counter(after.state, at.puller, "pulled")).toBe(3);
    // … and the answers have none: Grudge is heard and deals 0, Plating's condition fails and it is not offered.
    expect(resolved(after.events)).toEqual([PULL_BARE.ref.id, GRUDGE_ANSWER.ref.id]);
    expect(counter(after.state, at.inPlay.grudge, "heard")).toBe(1);
    expect(counter(after.state, at.inPlay.grudge, "cards")).toBe(0);
    expect(identityDamage(after.state)).toBe(0);
    expect(after.prompts).toEqual([]);
  });
});

describe("§3.71 replay", () => {
  it("the same commands replay deep-equal: a response-taken card, a reset mid-discard and the answers included", () => {
    const at = table(["body", "echo", "match", "mind", "body"], ["grudge", "plating"]);
    const first = run(at);
    // A second pull runs the deck out: [mind, body] and no match.
    const { session } = driveSession(first.session, deps, [use(at, PULL_BARE), use(at, PULL)]);
    expect(seat(session.state).dealtEncounter.length).toBeGreaterThanOrEqual(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    // And a second run from the same state logs the same events and ends in the same state.
    const again = run(at);
    expect(again.events).toEqual(first.events);
    expect(again.state).toEqual(first.state);
  });
});
