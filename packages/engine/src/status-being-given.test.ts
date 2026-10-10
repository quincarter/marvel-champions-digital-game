/**
 * docs/phase7-wave9.md §3.33, the extend: "When X would gain a status card" (`TriggerEvent statusBeingGiven`).
 * Synthetic cards shaped like Solid Sound Constructs (`aos` 50144): "Attached enemy loses stalwart. Forced Interrupt:
 * When attached enemy would gain a confused or stunned status card, discard this card instead."
 *
 * Sources: RRG 1.8 "Interrupt" (p. 25: "Interrupts that use the word 'would' resolve before its triggering condition
 * initiates, when that condition becomes imminent"), "'Would'" (p. 48), "Replacement Effect" (p. 37: "When an effect is
 * replaced, it is no longer considered imminent and no further interrupts or responses to that effect can be
 * triggered"), "Status Cards" (p. 41: one of each type; steady allows a second stunned and a second confused),
 * "Stalwart" (p. 40), "Vulnerable" (p. 48: "When a character with vulnerable becomes confused or stunned, that
 * character is immediately discarded"), "'Loses'" (p. 27).
 */

import type { KeywordInstance } from "@mc/content";
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import type { EffectSpec, StatusName, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const self: TargetRef = { kind: "self" };
const villain: TargetRef = { kind: "villain" };
const eachEnemy: TargetRef = { kind: "each", query: { categories: ["villain", "minion"] } };
const give = (target: TargetRef, status: StatusName, bind?: string): EffectSpec => ({
  kind: "giveStatus",
  target,
  status,
  ...(bind ? { bind } : {}),
});
const bump = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: n(1) });
const instead = (...effects: readonly EffectSpec[]): EffectSpec => ({ kind: "replaceTriggeringEvent", with: effects });

// Solid Sound Constructs: "Attached enemy loses stalwart." + "… would gain a confused or stunned status card, discard
// this card instead."
const CONSTRUCTS_CONSTANT = stubAbility("constructs.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "stalwart" }, target: { hostOfSelf: true }, loses: true }],
  },
  effects: [],
});
const CONSTRUCTS_INTERRUPT = stubAbility("constructs.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: { on: "statusBeingGiven", targetIs: { hostOfSelf: true }, eventIs: { status: ["confused", "stunned"] } },
  },
  effects: [instead({ kind: "discardFromPlay", target: self })],
});
const CONSTRUCTS = stubAttachment({
  id: "constructs",
  attachesTo: { kind: "villain" },
  abilities: [CONSTRUCTS_CONSTANT.ref, CONSTRUCTS_INTERRUPT.ref],
});

// A character's own shield, any status: "Forced Interrupt: When this would gain a status card, place 1 shield counter
// here instead." It keeps answering, so every give to it is replaced.
const SHIELD_INTERRUPT = stubAbility("shield.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, would: true, on: { on: "statusBeingGiven", selfIs: "target" } },
  effects: [instead(bump("shield"))],
});
// One that only watches: "Forced Interrupt: When this would gain a stunned status card, place 1 seen counter here."
const WATCH_INTERRUPT = stubAbility("watch.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "statusBeingGiven", selfIs: "target", eventIs: { status: "stunned" } },
  },
  effects: [
    bump("seen"),
    // What the listener sees on the character: the card is not there yet.
    {
      kind: "addCounters",
      target: self,
      counterType: "held",
      amount: { kind: "statusCount", of: self, status: "stunned" },
    },
  ],
});

const stage = { hp: flat(20), atk: 2, sch: 1 };
const keyword = (name: KeywordInstance["name"]) => ({ name }) as KeywordInstance;
const SONGBIRD = stubVillain({ id: "songbird", stages: [{ ...stage, keywords: [keyword("stalwart")] }] });
const PLAIN = stubVillain({ id: "plain", stages: [stage] });
const SHIELDED = stubVillain({ id: "shielded", stages: [{ ...stage, abilities: [SHIELD_INTERRUPT.ref] }] });
const WATCHED = stubVillain({
  id: "watched",
  stages: [{ ...stage, keywords: [keyword("steady")], abilities: [WATCH_INTERRUPT.ref] }],
});

const minion = (id: string, keywords: readonly KeywordInstance[], shielded: boolean) =>
  stubMinion({ id, atk: 0, sch: 0, hp: 3, boostIcons: 0, keywords, abilities: shielded ? [SHIELD_INTERRUPT.ref] : [] });
const FRAGILE = minion("fragile", [keyword("vulnerable")], true);
const FRAGILE_BARE = minion("fragile-bare", [keyword("vulnerable")], false);
const STEADY = minion("steady-shielded", [keyword("steady")], true);
const GOON = minion("goon", [], false);
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
// An encounter card's own effect: "When Revealed: Stun the villain. If no status card was given this way, …"
const HUSH_REVEALED = stubAbility("hush.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [give(villain, "stunned")],
});
const HUSH = stubTreachery({ id: "hush", boostIcons: 0, abilities: [HUSH_REVEALED.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const STUN = event("stun", [give(villain, "stunned")]);
const CONFUSE = event("confuse", [give(villain, "confused")]);
const TOUGHEN = event("toughen", [give(villain, "tough")]);
const STUN_ENEMIES = event("stun-enemies", [give(eachEnemy, "stunned")]);
// "Stun each enemy. Place 1 threat on the main scheme for each status card given this way."
const STUN_AND_COUNT = event("stun-and-count", [
  give(eachEnemy, "stunned", "placed"),
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "var", name: "placed.amount" } },
]);
// "Choose up to 2 enemies' worth of stunned status cards": two cards divided, a steady enemy can take both.
const STUN_TWICE = event("stun-twice", [
  {
    kind: "divide",
    what: "stunned",
    amount: n(2),
    among: { categories: ["enemy"] },
    chooser: { kind: "controller" },
    bind: "placed",
  },
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "var", name: "placed.amount" } },
]);
const EVENTS = [STUN, CONFUSE, TOUGHEN, STUN_ENEMIES, STUN_AND_COUNT, STUN_TWICE];

const LISTENERS = [CONSTRUCTS_CONSTANT, CONSTRUCTS_INTERRUPT, SHIELD_INTERRUPT, WATCH_INTERRUPT];
const deps: EngineDeps = depsOf(...LISTENERS, HUSH_REVEALED, ...EVENTS.map((e) => e.ability));
/** The same cards with no ability that hears `statusBeingGiven` in the registry. */
const bareDeps: EngineDeps = depsOf(CONSTRUCTS_CONSTANT, HUSH_REVEALED, ...EVENTS.map((e) => e.ability));

const CARDS = [CONSTRUCTS, FRAGILE, FRAGILE_BARE, STEADY, GOON, BLANK, HUSH, ...EVENTS.map((e) => e.card)];
function start(villainCard = PLAIN, using: EngineDeps = deps): GameState {
  const state = gameAtFirstTurn({
    deps: using,
    villain: villainCard,
    cards: CARDS,
    encounter: [CONSTRUCTS.id, FRAGILE.id, FRAGILE_BARE.id, STEADY.id, GOON.id, HUSH.id, ...copiesOf(BLANK.id, 30)],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
  });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}

type Pick = (state: GameState) => readonly string[];
const run = (state: GameState, using: EngineDeps, pick: Pick, ...commands: readonly Command[]) =>
  runCommandsPicking(state, using, pick, ...commands);
function play(
  state: GameState,
  card: { readonly card: { readonly id: string } },
  pick: Pick = defaultPick,
  using = deps,
) {
  const given = giveCard(state, P1, card.card.id);
  return run(given.state, using, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}
/** Ends the turn with `cards` on top of the encounter deck, the first on top (a blank boost card goes above them). */
function nextRound(state: GameState, cards: readonly string[], using = deps) {
  let stacked = state;
  for (const card of [...cards].reverse()) stacked = onTopOfEncounterDeck(stacked, card as never);
  return run(stacked, using, defaultPick, { type: "endTurn", playerId: P1 });
}

const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const statuses = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses;
const counters = (state: GameState, id: InstanceId, type: string) => mustInstance(state, id).counters[type] ?? 0;
const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const attachedTo = (state: GameState, host: InstanceId): readonly string[] =>
  mustInstance(state, host).attachments.map((id) => `${mustInstance(state, id).cardId}`);
const inEncounterDiscard = (state: GameState, card: string): boolean =>
  activeEncounterDeck(state).discard.some((id) => mustInstance(state, id).cardId === card);
const beingGiven = (events: readonly GameEvent[], phase: "initiated" | "resolved" | "cancelled") =>
  events.flatMap((e): readonly TriggerEvent[] =>
    e.type === "triggerEvent" && e.phase === phase && e.event.kind === "statusBeingGiven" ? [e.event] : [],
  );
const given = (events: readonly GameEvent[]) => events.filter((e) => e.type === "statusGiven");

function expectReplays(result: ReturnType<typeof run>, using = deps): void {
  const replayed = replay(result.session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

/** Songbird (stalwart) with Solid Sound Constructs attached, at the next player turn. */
function songbirdWithConstructs(): GameState {
  // A stalwart villain is never stunned, so her attack turns a boost card (the blank) and p1 is dealt the attachment.
  const revealed = nextRound(start(SONGBIRD), [BLANK.id, CONSTRUCTS.id]);
  expect(attachedTo(revealed.state, villainId(revealed.state))).toEqual([CONSTRUCTS.id]);
  return revealed.state;
}

describe("§3.33 statusBeingGiven: an interrupt to a status card about to be given", () => {
  it.each([
    ["stunned", STUN],
    ["confused", CONFUSE],
  ] as const)(
    "Songbird with Solid Sound Constructs, a hero's %s card: the attachment is discarded, no card",
    (status, card) => {
      const base = songbirdWithConstructs();
      const result = play(base, card);
      const id = villainId(result.state);
      expect(statuses(result.state, id)).toEqual({ stunned: 0, confused: 0, tough: 0 });
      expect(attachedTo(result.state, id)).toEqual([]);
      expect(inEncounterDiscard(result.state, CONSTRUCTS.id)).toBe(true);
      // One event, initiated and then cancelled: the give did not happen, so nothing was placed or announced as placed.
      const expected = {
        kind: "statusBeingGiven",
        instanceId: id,
        status,
        sourceInstanceId: expect.any(String),
        playerId: P1,
      };
      expect(beingGiven(result.events, "initiated")).toEqual([expected]);
      expect(beingGiven(result.events, "cancelled")).toEqual([expected]);
      expect(beingGiven(result.events, "resolved")).toEqual([]);
      expect(given(result.events)).toEqual([]);
      expect(result.state.stack).toEqual([]);
      expectReplays(result);
      // With the attachment gone she is stalwart again: the next stun places nothing and opens no window.
      const again = play(result.state, card);
      expect(statuses(again.state, id)[status]).toBe(0);
      expect(beingGiven(again.events, "initiated")).toEqual([]);
    },
  );

  it("a tough status card is not what the attachment watches: it lands and the attachment stays", () => {
    const base = songbirdWithConstructs();
    const result = play(base, TOUGHEN);
    const id = villainId(result.state);
    expect(statuses(result.state, id).tough).toBe(1);
    expect(attachedTo(result.state, id)).toEqual([CONSTRUCTS.id]);
    // The registry listens but this give matches no ability: it is not announced at all.
    expect(beingGiven(result.events, "initiated")).toEqual([]);
    expectReplays(result);
  });

  it("an interrupt that hears any status replaces a tough card too", () => {
    const result = play(start(SHIELDED), TOUGHEN);
    const id = villainId(result.state);
    expect(statuses(result.state, id).tough).toBe(0);
    expect(counters(result.state, id, "shield")).toBe(1);
    expect(beingGiven(result.events, "cancelled")).toHaveLength(1);
    expectReplays(result);
  });

  it("an encounter card's stun is heard the same way, with no giving player", () => {
    const base = songbirdWithConstructs();
    const result = nextRound(base, [BLANK.id, HUSH.id]);
    const id = villainId(result.state);
    expect(statuses(result.state, id).stunned).toBe(0);
    expect(attachedTo(result.state, id)).toEqual([]);
    expect(beingGiven(result.events, "cancelled")).toEqual([
      {
        kind: "statusBeingGiven",
        instanceId: id,
        status: "stunned",
        sourceInstanceId: expect.any(String),
        playerId: null,
      },
    ]);
    expectReplays(result);
  });

  it("a vulnerable minion whose stun is replaced is not discarded (RRG p. 48: it did not become stunned)", () => {
    const engaged = minionEngagedWith(start(), FRAGILE.id);
    const result = play(engaged.state, STUN_ENEMIES);
    expect(result.state.players[0]!.playArea).toContain(engaged.id);
    expect(statuses(result.state, engaged.id).stunned).toBe(0);
    expect(counters(result.state, engaged.id, "shield")).toBe(1);
    expect(result.events.some((e) => e.type === "vulnerableDiscarded")).toBe(false);
    // The plain villain was stunned by the same effect, at once: its give matched no ability.
    expect(statuses(result.state, villainId(result.state)).stunned).toBe(1);
    expectReplays(result);
  });

  it("a vulnerable minion whose stun is heard but not replaced is discarded once the card lands", () => {
    // The watching villain's stun is announced first, so the minion's waits behind it and lands in order.
    const engaged = minionEngagedWith(start(WATCHED), FRAGILE_BARE.id);
    const result = play(engaged.state, STUN_ENEMIES);
    const id = villainId(result.state);
    expect(statuses(result.state, id).stunned).toBe(1);
    expect(counters(result.state, id, "seen")).toBe(1);
    // The interrupt resolved before the card was on the villain.
    expect(counters(result.state, id, "held")).toBe(0);
    expect(result.state.players[0]!.playArea).not.toContain(engaged.id);
    expect(result.events.filter((e) => e.type === "vulnerableDiscarded")).toHaveLength(1);
    // Both gives were announced, the villain's first; only the villain's opened a window.
    expect(beingGiven(result.events, "resolved").map((e) => ("instanceId" in e ? e.instanceId : null))).toEqual([
      id,
      engaged.id,
    ]);
    const windows = result.events.filter((e) => e.type === "windowOpened" && e.event.kind === "statusBeingGiven");
    expect(windows).toHaveLength(1);
    expectReplays(result);
  });

  it("a steady character's first status card is announced like its second", () => {
    const engaged = minionEngagedWith(start(), STEADY.id);
    const first = play(engaged.state, STUN_ENEMIES);
    expect(statuses(first.state, engaged.id).stunned).toBe(0);
    expect(counters(first.state, engaged.id, "shield")).toBe(1);
    // A steady villain that only watches: each of its two stunned cards is heard, a third is not given or heard.
    const base = start(WATCHED);
    const one = play(base, STUN);
    const two = play(one.state, STUN);
    const three = play(two.state, STUN);
    const id = villainId(three.state);
    expect(statuses(three.state, id).stunned).toBe(2);
    expect(counters(three.state, id, "seen")).toBe(2);
    // Held 0 before the first card and 1 before the second.
    expect(counters(three.state, id, "held")).toBe(1);
    expect(beingGiven(three.events, "initiated")).toEqual([]);
    expectReplays(three);
  });

  it("one effect on several characters: one event each, in order; 'given this way' counts only the cards that land", () => {
    const a = minionEngagedWith(start(SHIELDED), FRAGILE.id);
    const b = minionEngagedWith(a.state, GOON.id);
    const before = threat(b.state);
    const result = play(b.state, STUN_AND_COUNT);
    const id = villainId(result.state);
    // The villain's and the vulnerable minion's are replaced; the goon's waits behind them and lands.
    expect(statuses(result.state, id).stunned).toBe(0);
    expect(statuses(result.state, a.id).stunned).toBe(0);
    expect(statuses(result.state, b.id).stunned).toBe(1);
    expect(counters(result.state, id, "shield")).toBe(1);
    expect(counters(result.state, a.id, "shield")).toBe(1);
    expect(beingGiven(result.events, "cancelled")).toHaveLength(2);
    expect(beingGiven(result.events, "resolved")).toHaveLength(1);
    // Three named, one given: 1 threat.
    expect(threat(result.state)).toBe(before + 1);
    expectReplays(result);
  });

  it("two stunned cards divided onto one steady character are two events; the second is not asked about once full", () => {
    // A steady, watching villain already holding one stunned card: the first card fills it, the second has no room.
    const one = play(start(WATCHED), STUN);
    const id = villainId(one.state);
    const before = threat(one.state);
    const result = play(one.state, STUN_TWICE, (state) =>
      state.pendingChoice?.prompt.kind === "divide" ? [`${id}#1`] : defaultPick(state),
    );
    expect(statuses(result.state, id).stunned).toBe(2);
    expect(counters(result.state, id, "seen")).toBe(2);
    expect(threat(result.state)).toBe(before + 1);
    // Both of a steady character's cards from one divide, from none: two events, two windows, two cards.
    const fresh = start(WATCHED);
    const both = play(fresh, STUN_TWICE, (state) =>
      state.pendingChoice?.prompt.kind === "divide"
        ? [`${villainId(state)}#1`, `${villainId(state)}#2`]
        : defaultPick(state),
    );
    expect(statuses(both.state, villainId(both.state)).stunned).toBe(2);
    expect(counters(both.state, villainId(both.state), "seen")).toBe(2);
    expect(beingGiven(both.events, "resolved")).toHaveLength(2);
    expect(threat(both.state)).toBe(threat(fresh) + 2);
    expectReplays(both);
  });

  it("with no ability listening, the log, the state and the replay are those of a plain give", () => {
    const plays = [STUN, CONFUSE, TOUGHEN, STUN_ENEMIES, STUN_AND_COUNT];
    for (const card of plays) {
      const withListeners = minionEngagedWith(start(PLAIN, deps), GOON.id);
      const without = minionEngagedWith(start(PLAIN, bareDeps), GOON.id);
      expect(withListeners.state).toEqual(without.state);
      const heard = play(withListeners.state, card, defaultPick, deps);
      const bare = play(without.state, card, defaultPick, bareDeps);
      // Listeners in the registry but none in play: nothing is announced, and nothing differs.
      expect(heard.events).toEqual(bare.events);
      expect(heard.state).toEqual(bare.state);
      expect(beingGiven(bare.events, "initiated")).toEqual([]);
      expectReplays(bare, bareDeps);
    }
  });
});
