/**
 * docs/phase7-wave9.md §3.41: a reveal in progress that is replaced (`EffectSpec revealCard.instead`,
 * `replaceRevealInProgress`), proven with synthetic cards shaped like "Interrupt: When you reveal a card from the same
 * encounter set as a card tucked under your identity, exhaust this card → swap those cards. Reveal the card that had
 * been tucked under your identity instead."
 *
 * Sources: RRG 1.8 erratum (p. 70) for that wording; "'Swap'" (p. 42): the two cards exchange locations; "Replacement
 * Effect" (p. 36): "When an effect is replaced, it is no longer considered imminent and no further interrupts or
 * responses to that effect can be triggered."; "Tuck" (p. 45): "Tucked cards are not in play"; "Reveal" (p. 38) for the
 * steps the card revealed instead goes through; "Surge" (p. 43).
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { createCtx, moveCard, updateInstance } from "./ctx.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState, ZoneId } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import {
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, seatIdentities } from "./testing/scenario.js";
import { playerCardIntoPlay } from "./testing/wave3.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const eventTarget: TargetRef = { kind: "eventTarget" };
const WEB = "web";
const OTHER = "other";

/** "When Revealed: [the revealing player's identity gets a `counter`]": who resolved it, and how many times. */
const marks = (id: string, counter: string) =>
  stubAbility(id, {
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "addCounters", target: yourIdentity, counterType: counter, amount: { kind: "const", value: 1 } }],
  });
const TRAP_REVEALED = marks("trap.when-revealed", "trapped");
const SNARE_REVEALED = marks("snare.when-revealed", "snared");
const THUG_REVEALED = marks("thug.when-revealed", "thugged");
const BRUTE_REVEALED = marks("brute.when-revealed", "bruted");
const PLOT_REVEALED = marks("plot.when-revealed", "plotted");
const STRAY_REVEALED = marks("stray.when-revealed", "strayed");

const TRAP = stubTreachery({ id: "trap", encounterSetIds: [WEB], abilities: [TRAP_REVEALED.ref] });
/** A treachery with surge. */
const SNARE = stubTreachery({
  id: "snare",
  encounterSetIds: [WEB],
  keywords: [{ name: "surge" }],
  abilities: [SNARE_REVEALED.ref],
});
const THUG = stubMinion({ id: "thug", encounterSetIds: [WEB], atk: 1, sch: 1, hp: 3, abilities: [THUG_REVEALED.ref] });
const BRUTE = stubMinion({
  id: "brute",
  encounterSetIds: [WEB],
  atk: 2,
  sch: 1,
  hp: 5,
  abilities: [BRUTE_REVEALED.ref],
});
const PLOT = stubSideScheme({ id: "plot", encounterSetIds: [WEB], startingThreat: 3, abilities: [PLOT_REVEALED.ref] });
/** A treachery of another encounter set. */
const STRAY = stubTreachery({ id: "stray", encounterSetIds: [OTHER], abilities: [STRAY_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const tuckedOfItsSet: TargetRef = { kind: "tuckedUnder", of: yourIdentity, filter: { encounterSetOf: eventTarget } };
const chosenTucked: TargetRef = { kind: "slot", slot: "tucked" };
const chooseTucked: EffectSpec = {
  kind: "chooseCards",
  slot: "tucked",
  from: { kind: "ref", ref: tuckedOfItsSet },
  chooser: you,
  min: 1,
  max: 1,
};
const youReveal = { on: "encounterCardRevealing", playerIs: "controller" } as const;
/** The interrupt this section is about. */
const RECALL = stubAbility("memory.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: youReveal },
  cost: { exhaustSelf: true },
  effects: [
    chooseTucked,
    { kind: "swapCards", a: eventTarget, b: chosenTucked },
    { kind: "revealCard", cards: chosenTucked, player: you, instead: true },
  ],
});
const MEMORY = stubSupport({ id: "memory", cost: 0, abilities: [RECALL.ref] });
/** The same interrupt without its swap: the card being revealed never leaves, so there is nothing to replace. */
const MISREAD = stubAbility("muddle.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: youReveal },
  cost: { exhaustSelf: true },
  effects: [chooseTucked, { kind: "revealCard", cards: chosenTucked, player: you, instead: true }],
});
const MUDDLE = stubSupport({ id: "muddle", cost: 0, abilities: [MISREAD.ref] });
/** "Forced Interrupt: When the trap is revealed, cancel its effects." A second window on the card revealed instead. */
const WARDED = stubAbility("ward.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "encounterCardRevealing", targetIs: { name: TRAP.name } },
  },
  effects: [{ kind: "cancelRevealedCard" }],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARDED.ref] });

const findAndReveal = (name: string): EffectSpec => ({
  kind: "revealCard",
  cards: { kind: "find", query: { name } },
  player: you,
});
const caller = (card: { readonly id: CardId; readonly name: string }) => {
  const ability = stubAbility(`call-${card.id}.action`, {
    trigger: { kind: "action" },
    effects: [findAndReveal(card.name)],
  });
  return { card: stubEvent({ id: `call-${card.id}`, cost: 0, abilities: [ability.ref] }), ability };
};
const CALL_TRAP = caller(TRAP);
const CALL_SNARE = caller(SNARE);
const CALL_THUG = caller(THUG);
const CALL_BRUTE = caller(BRUTE);
const CALL_PLOT = caller(PLOT);
const CALLS = [CALL_TRAP, CALL_SNARE, CALL_THUG, CALL_BRUTE, CALL_PLOT];

const REVEALED = [TRAP_REVEALED, SNARE_REVEALED, THUG_REVEALED, BRUTE_REVEALED, PLOT_REVEALED, STRAY_REVEALED];
const deps: EngineDeps = depsOf(...CALLS.map((c) => c.ability), ...REVEALED, RECALL, MISREAD, WARDED);
const ENCOUNTER = [TRAP, SNARE, THUG, BRUTE, PLOT, STRAY];
const SUPPORTS = [MEMORY, MUDDLE, WARD];
const CARDS = [
  ...DEFAULT_CARDS,
  QUIET_VILLAIN,
  LONG_SCHEME,
  BLANK,
  ...SUPPORTS,
  ...ENCOUNTER,
  ...CALLS.map((c) => c.card),
];

function game(): GameState {
  const identities = seatIdentities(
    stubIdentity({ id: "seeker", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
    2,
  );
  const config: GameSetupConfig = {
    seed: 41,
    cards: [...CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 12 }, () => BLANK.id as CardId), ...ENCOUNTER.map((card) => card.id)],
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...SUPPORTS.map((s) => s.id), ...CALLS.map((c) => c.card.id as CardId)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const the = (state: GameState, card: { readonly id: CardId }): InstanceId =>
  (Object.keys(state.instances) as InstanceId[]).find((id) => state.instances[id]?.cardId === card.id)!;
const identityId = (state: GameState, player: PlayerId = p1): InstanceId =>
  mustPlayer(state, player).identity.instanceId;
const counterOn = (state: GameState, counter: string, player: PlayerId = p1): number =>
  mustInstance(state, identityId(state, player)).counters[counter] ?? 0;
const tuckedOf = (state: GameState, player: PlayerId = p1): readonly InstanceId[] =>
  mustInstance(state, identityId(state, player)).tucked;
const tuckedZone = (state: GameState, player: PlayerId = p1): ZoneId => ({
  kind: "tucked",
  hostInstanceId: identityId(state, player),
});
const encounterDiscard = (state: GameState): readonly InstanceId[] => activeEncounterDeck(state).discard;
const inPlayOf = (state: GameState, player: PlayerId = p1): readonly InstanceId[] => mustPlayer(state, player).playArea;

/** Test-only state surgery: puts a card somewhere, faceup or facedown. */
function place(state: GameState, id: InstanceId, zone: ZoneId, faceup = true): GameState {
  const ctx = createCtx(state, deps);
  moveCard(ctx, id, zone, "bottom");
  updateInstance(ctx, id, (i) => ({ ...i, faceup }));
  return ctx.state;
}
/** Surgery: these encounter cards tucked under `player`'s identity, faceup, in this order. */
function tuck(state: GameState, cards: readonly { readonly id: CardId }[], player: PlayerId = p1) {
  let current = state;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const id = the(current, card);
    current = place(current, id, tuckedZone(current, player));
    ids.push(id);
  }
  return { state: current, ids };
}
/** Player 1 with the support in play, ready, and these cards tucked. */
function ready(tucked: readonly { readonly id: CardId }[], support: { readonly id: CardId } = MEMORY) {
  const start = playerCardIntoPlay(game(), support.id, p1);
  const staged = tuck(start.state, tucked);
  return { state: staged.state, ids: staged.ids, support: start.id };
}

/** Takes the optional interrupt when offered and, asked for a tucked card, takes `tucked`; otherwise the default. */
const taking =
  (tucked?: InstanceId) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers") {
      const hit = ids.find((o) => o.endsWith(".interrupt"));
      return hit ? [hit] : defaultPick(state);
    }
    if (tucked && ids.includes(tucked)) return [tucked];
    return defaultPick(state);
  };

/** Player 1 plays the event that finds and reveals a card (cost 0), every choice answered by `pick`. */
function call(state: GameState, event: { readonly card: { readonly id: CardId } }, pick = taking()) {
  const given = giveCard(state, p1, event.card.id);
  const command: Command = {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const result = runCommandsPicking(given.state, deps, pick, command);
  expect(result.state.pendingChoice).toBeNull();
  expect(result.state.stack).toEqual([]);
  return { ...result, before: given.state };
}

const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  typed(events, "cardMoved").filter((e) => e.instanceId === id);
/** Every trigger event of `kind` the log announced for `id`, by phase. */
const announced = (events: readonly GameEvent[], kind: string, id: InstanceId) =>
  typed(events, "triggerEvent")
    .filter((e) => e.event.kind === kind && "instanceId" in e.event && e.event.instanceId === id)
    .map((e) => e.phase);
const revealOrder = (events: readonly GameEvent[]) => typed(events, "encounterCardRevealed").map((e) => e.cardId);
const offered = (events: readonly GameEvent[]) =>
  typed(events, "choiceRequested").filter((e) => e.choice.prompt.kind === "chooseTriggers");

describe("§3.41: a treachery tucked, a minion of its set revealed", () => {
  it("the minion ends tucked and never enters play; the treachery is revealed instead and resolves once", () => {
    const { state: at, ids, support } = ready([TRAP]);
    const [trap] = ids as [InstanceId];
    const thug = the(at, THUG);
    const { state, events } = call(at, CALL_THUG);

    expect(tuckedOf(state)).toEqual([thug]);
    expect(inPlayOf(state)).not.toContain(thug);
    expect(mustInstance(state, thug)).toMatchObject({ faceup: true, engagedWith: null, damage: 0 });
    expect(announced(events, "cardEntersPlay", thug)).toEqual([]);
    expect(announced(events, "minionEngaged", thug)).toEqual([]);
    expect(counterOn(state, "thugged")).toBe(0);
    // Out of the deck to the dealt cards, then under the identity: it never went anywhere else.
    expect(movesOf(events, thug).map((e) => [e.from.kind, e.to.kind])).toEqual([
      ["encounterDeck", "dealtEncounter"],
      ["dealtEncounter", "tucked"],
    ]);

    expect(counterOn(state, "trapped")).toBe(1);
    expect(encounterDiscard(state)[0]).toBe(trap);
    expect(movesOf(events, trap).map((e) => [e.from.kind, e.to.kind])).toEqual([
      ["tucked", "dealtEncounter"],
      ["dealtEncounter", "encounterDiscard"],
    ]);
    expect(mustInstance(state, support).exhausted).toBe(true);

    expect(revealOrder(events)).toEqual([THUG.id, TRAP.id]);
    expect(typed(events, "revealReplaced")).toEqual([
      { type: "revealReplaced", instanceId: thug, withInstanceIds: [trap], playerId: p1 },
    ]);
    expect(typed(events, "cardsSwapped")).toEqual([
      { type: "cardsSwapped", how: "outOfPlay", outgoing: thug, incoming: trap, cardIds: [THUG.id, TRAP.id] },
    ]);
    // The replaced reveal is no longer imminent (RRG 1.8 p. 36): cancelled, and no "after it is revealed" for it.
    expect(announced(events, "encounterCardRevealing", thug)).toContain("cancelled");
    expect(announced(events, "cardRevealed", thug)).toEqual([]);
    expect(announced(events, "cardRevealed", trap).length).toBeGreaterThan(0);
    // The round's reveal history holds the card revealed instead, once.
    expect(state.revealedThisRound).toEqual([{ instanceId: trap, playerId: p1, phase: "player" }]);
  });

  it("the order in the log: the first card revealed, the swap, the reveal replaced, the other card revealed, its When Revealed", () => {
    const { state: at } = ready([TRAP]);
    const { events } = call(at, CALL_THUG);
    const at_ = (match: (e: GameEvent) => boolean) => events.findIndex(match);
    const order = [
      at_((e) => e.type === "encounterCardRevealed" && e.cardId === THUG.id),
      at_((e) => e.type === "cardsSwapped"),
      at_((e) => e.type === "revealReplaced"),
      at_((e) => e.type === "encounterCardRevealed" && e.cardId === TRAP.id),
      at_((e) => e.type === "counterAdded"),
    ];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("declined: the minion is revealed as usual and the treachery stays tucked", () => {
    const { state: at, ids, support } = ready([TRAP]);
    const thug = the(at, THUG);
    const { state, events } = call(at, CALL_THUG, defaultPick);
    expect(offered(events)).toHaveLength(1);
    expect(tuckedOf(state)).toEqual(ids);
    expect(inPlayOf(state)).toContain(thug);
    expect(mustInstance(state, thug).engagedWith).toBe(p1);
    expect([counterOn(state, "thugged"), counterOn(state, "trapped")]).toEqual([1, 0]);
    expect(mustInstance(state, support).exhausted).toBe(false);
    expect(typed(events, "revealReplaced")).toEqual([]);
  });
});

describe("§3.41: the other pairings", () => {
  it("a minion tucked, a treachery revealed: the minion enters play engaged with the player; the treachery is tucked, undiscarded", () => {
    const { state: at, ids } = ready([THUG]);
    const [thug] = ids as [InstanceId];
    const trap = the(at, TRAP);
    const { state, events } = call(at, CALL_TRAP);
    expect(tuckedOf(state)).toEqual([trap]);
    expect(encounterDiscard(state)).not.toContain(trap);
    expect(counterOn(state, "trapped")).toBe(0);
    expect(inPlayOf(state)).toContain(thug);
    expect(mustInstance(state, thug)).toMatchObject({ engagedWith: p1, faceup: true, exhausted: false });
    expect(counterOn(state, "thugged")).toBe(1);
    expect(announced(events, "cardEntersPlay", thug).length).toBeGreaterThan(0);
    expect(announced(events, "cardEntersPlay", trap)).toEqual([]);
    expect(revealOrder(events)).toEqual([TRAP.id, THUG.id]);
  });

  it("a side scheme tucked, a minion revealed: the side scheme enters play with its 3 starting threat; the minion is tucked", () => {
    const { state: at, ids } = ready([PLOT]);
    const [plot] = ids as [InstanceId];
    const thug = the(at, THUG);
    const { state } = call(at, CALL_THUG);
    expect(tuckedOf(state)).toEqual([thug]);
    expect(state.villainArea).toContain(plot);
    expect(mustInstance(state, plot).threat).toBe(3);
    expect([counterOn(state, "plotted"), counterOn(state, "thugged")]).toEqual([1, 0]);
    expect(inPlayOf(state)).not.toContain(thug);
  });

  it("a minion tucked, a side scheme revealed: the minion engages; the side scheme is tucked with no threat on it", () => {
    const { state: at, ids } = ready([BRUTE]);
    const [brute] = ids as [InstanceId];
    const plot = the(at, PLOT);
    const { state } = call(at, CALL_PLOT);
    expect(tuckedOf(state)).toEqual([plot]);
    expect(state.villainArea).not.toContain(plot);
    expect(mustInstance(state, plot).threat).toBe(0);
    expect(mustInstance(state, brute).engagedWith).toBe(p1);
    expect([counterOn(state, "bruted"), counterOn(state, "plotted")]).toEqual([1, 0]);
  });

  it("a treachery tucked, a side scheme revealed, and a side scheme tucked, a treachery revealed", () => {
    const first = ready([TRAP]);
    const plot = the(first.state, PLOT);
    const one = call(first.state, CALL_PLOT).state;
    expect(tuckedOf(one)).toEqual([plot]);
    expect([counterOn(one, "trapped"), counterOn(one, "plotted")]).toEqual([1, 0]);
    expect(encounterDiscard(one)[0]).toBe(first.ids[0]);

    const second = ready([PLOT]);
    const trap = the(second.state, TRAP);
    const two = call(second.state, CALL_TRAP).state;
    expect(tuckedOf(two)).toEqual([trap]);
    expect(mustInstance(two, second.ids[0]!).threat).toBe(3);
    expect([counterOn(two, "trapped"), counterOn(two, "plotted")]).toEqual([0, 1]);
  });
});

describe("§3.41: surge and the card revealed instead", () => {
  it("a surge treachery tucked: revealed instead, its When Revealed resolves once and it surges once", () => {
    const { state: at, ids } = ready([SNARE]);
    const thug = the(at, THUG);
    const { state, events } = call(at, CALL_THUG);
    expect(tuckedOf(state)).toEqual([thug]);
    expect(counterOn(state, "snared")).toBe(1);
    expect(typed(events, "surgeTriggered")).toEqual([{ type: "surgeTriggered", instanceId: ids[0], playerId: p1 }]);
    // Three reveals: the minion (replaced), the surge treachery, the card its surge dealt.
    expect(typed(events, "encounterCardRevealed")).toHaveLength(3);
    expect(revealOrder(events).slice(0, 2)).toEqual([THUG.id, SNARE.id]);
  });

  it("a surge treachery revealed and swapped away: no surge, no When Revealed, and it is tucked", () => {
    const { state: at, ids } = ready([THUG]);
    const snare = the(at, SNARE);
    const { state, events } = call(at, CALL_SNARE);
    expect(tuckedOf(state)).toEqual([snare]);
    expect(counterOn(state, "snared")).toBe(0);
    expect(typed(events, "surgeTriggered")).toEqual([]);
    expect(revealOrder(events)).toEqual([SNARE.id, THUG.id]);
    expect(mustInstance(state, ids[0]!).engagedWith).toBe(p1);
  });

  it("the card revealed instead has its own 'when revealed' window: cancelled there, it is discarded unresolved", () => {
    const base = ready([TRAP]);
    const { state: at } = playerCardIntoPlay(base.state, WARD.id, p1);
    const thug = the(at, THUG);
    const { state, events } = call(at, CALL_THUG);
    expect(tuckedOf(state)).toEqual([thug]);
    expect(counterOn(state, "trapped")).toBe(0);
    expect(encounterDiscard(state)[0]).toBe(base.ids[0]);
    expect(typed(events, "revealCancelled")).toEqual([
      { type: "revealCancelled", instanceId: base.ids[0], scope: "allEffects" },
    ]);
  });
});

describe("§3.41: which tucked card, and when the interrupt is open", () => {
  it("4 tucked, 3 of the revealed card's set: only those 3 are offered; the one chosen is swapped and the revealed card takes its place among the 4", () => {
    const { state: at, ids } = ready([TRAP, STRAY, BRUTE, PLOT]);
    const [trap, stray, brute, plot] = ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const thug = the(at, THUG);
    const { state, events } = call(at, CALL_THUG, taking(brute));
    const asked = typed(events, "choiceRequested").find((e) => e.choice.prompt.kind === "chooseCards")!;
    expect(asked.choice.options.map((o) => o.optionId as string).sort()).toEqual([trap, brute, plot].sort());
    expect(tuckedOf(state)).toEqual([trap, stray, thug, plot]);
    expect(mustInstance(state, brute).engagedWith).toBe(p1);
    expect([counterOn(state, "bruted"), counterOn(state, "thugged"), counterOn(state, "trapped")]).toEqual([1, 0, 0]);
    expect(state.villainArea).not.toContain(plot);
  });

  it("nothing tucked, or only a card of another set: the interrupt is not offered and the reveal is the usual one", () => {
    for (const tucked of [[], [STRAY]]) {
      const { state: at, ids, support } = ready(tucked);
      const thug = the(at, THUG);
      const { state, events } = call(at, CALL_THUG);
      expect(offered(events)).toEqual([]);
      expect(tuckedOf(state)).toEqual(ids);
      expect(mustInstance(state, thug).engagedWith).toBe(p1);
      expect(counterOn(state, "thugged")).toBe(1);
      expect(mustInstance(state, support).exhausted).toBe(false);
    }
  });

  it("another player's reveal does not open it", () => {
    const { state: at, ids } = ready([TRAP]);
    const thug = the(at, THUG);
    const given = giveCard(at, p2, CALL_THUG.card.id);
    const passed = runCommandsPicking(given.state, deps, taking(), { type: "endTurn", playerId: p1 });
    expect(passed.state.step).toMatchObject({ phase: "player", activePlayerId: p2 });
    const { state, events } = runCommandsPicking(passed.state, deps, taking(), {
      type: "playCard",
      playerId: p2,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(offered(events)).toEqual([]);
    expect(tuckedOf(state)).toEqual(ids);
    expect(mustInstance(state, thug).engagedWith).toBe(p2);
  });

  it("exhausted by its first use, it does not answer a second reveal in the round", () => {
    const { state: at, ids } = ready([TRAP, BRUTE]);
    const thug = the(at, THUG);
    const plot = the(at, PLOT);
    const once = call(at, CALL_THUG, taking(ids[0])).state;
    expect(tuckedOf(once)).toEqual([thug, ids[1]]);
    const { state, events } = call(once, CALL_PLOT);
    expect(offered(events)).toEqual([]);
    expect(tuckedOf(state)).toEqual([thug, ids[1]]);
    expect(state.villainArea).toContain(plot);
    expect(counterOn(state, "plotted")).toBe(1);
  });

  it("without the swap there is nothing to replace: the revealed card resolves as usual and the tucked one is not revealed", () => {
    const { state: at, ids, support } = ready([TRAP], MUDDLE);
    const thug = the(at, THUG);
    const { state, events } = call(at, CALL_THUG);
    expect(mustInstance(state, support).exhausted).toBe(true);
    expect(tuckedOf(state)).toEqual(ids);
    expect(mustInstance(state, thug).engagedWith).toBe(p1);
    expect([counterOn(state, "thugged"), counterOn(state, "trapped")]).toEqual([1, 0]);
    expect(revealOrder(events)).toEqual([THUG.id]);
    expect(typed(events, "revealReplaced")).toEqual([]);
    expect(typed(events, "preThenUnresolved").map((e) => e.cause)).toEqual(["nothingToCancel"]);
  });
});

describe("§3.41: a card dealt in the villain phase", () => {
  /** Every non-blank encounter card out of the deck: the thug dealt facedown to player 1, the trap tucked. */
  function dealt() {
    const base = ready([TRAP]);
    let state = base.state;
    const thug = the(state, THUG);
    for (const card of [SNARE, BRUTE, PLOT, STRAY]) state = place(state, the(state, card), { kind: "removedFromGame" });
    const deck: ZoneId = { kind: "encounterDeck", deckId: activeEncounterDeckId(state) };
    state = place(state, thug, deck, false);
    state = place(state, thug, { kind: "dealtEncounter", playerId: p1 }, false);
    return { state, thug, trap: base.ids[0]!, support: base.support };
  }
  const endBothTurns = (state: GameState) => {
    const first = runCommandsPicking(state, deps, taking(), { type: "endTurn", playerId: p1 });
    const second = runCommandsPicking(first.state, deps, taking(), { type: "endTurn", playerId: p2 });
    return { state: second.state, events: [...first.events, ...second.events], session: second.session, first };
  };

  it("the dealt minion is tucked and not revealed again; the treachery resolves once; the next round begins", () => {
    const { state: at, thug, trap } = dealt();
    expect(mustInstance(at, thug).dealtFromEncounterDeck).toBe(true);
    const { state, events } = endBothTurns(at);
    expect(state.outcome).toBeNull();
    expect(state.round).toBe(at.round + 1);
    expect(state.stack).toEqual([]);
    expect(tuckedOf(state)).toEqual([thug]);
    expect(mustInstance(state, thug).dealtFromEncounterDeck).toBeUndefined();
    expect(counterOn(state, "thugged")).toBe(0);
    expect(counterOn(state, "trapped")).toBe(1);
    expect(encounterDiscard(state)).toContain(trap);
    expect(typed(events, "encounterCardRevealed").filter((e) => e.instanceId === thug)).toHaveLength(1);
    expect(typed(events, "encounterCardRevealed").filter((e) => e.instanceId === trap)).toHaveLength(1);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
  });

  it("deterministic, and the log replays to the same state", () => {
    const one = dealt();
    const once = endBothTurns(one.state);
    const again = endBothTurns(dealt().state);
    expect(again.state).toEqual(once.state);
    expect(again.events).toEqual(once.events);
    const replayed = replay(once.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(once.state);

    const played = call(ready([TRAP, STRAY, BRUTE, PLOT]).state, CALL_THUG);
    const replayedPlay = replay(played.session.log, deps);
    if (!replayedPlay.ok) throw new Error(replayedPlay.error.message);
    expect(replayedPlay.state).toEqual(played.state);
  });
});
