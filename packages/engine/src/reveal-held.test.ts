/**
 * `EffectSpec revealCard.heldBy` (docs/phase7-wave9.md §3.21, §4.1 Q26 = B): "Reveal and attach the remaining set-aside
 * Thunderbolt minion faceup here." (Justice, Like Lightning, `aos` 50131a). The owner: "'Reveal and attach' is
 * different from simply putting a minion into play attached. Its When Revealed ability should resolve." The minion
 * goes through the whole reveal, entering play held by the environment instead of engaged with the revealing player.
 *
 * Sources: RRG 1.8 "Reveal" (p. 38): step 2, a minion "enters play engaged with the player who revealed it" (the
 * card's "attach … here" replaces this placement); step 3, "Resolve any 'When Revealed' abilities on the card";
 * "Quickstrike" (p. 36): "After a minion with the quickstrike keyword engages a player whose identity is in hero form,
 * that minion attacks that player" (a held minion engages nobody); "Toughness" (p. 45), placed as the minion enters
 * play; "Surge" (p. 42) and "Deal, Deal an Encounter Card" (p. 15): the revealing player is dealt a facedown card,
 * which waits (§4.1 Q22); "First Player" (p. 19).
 *
 * Synthetic cards only.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, locateCard, minionsEngagedWith, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, isHeldMinion } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const mainScheme: TargetRef = { kind: "mainScheme" };
const named = (name: string): TargetRef => ({ kind: "named", name });
const n = (value: number): ValueSpec => ({ kind: "const", value });

/** "When Revealed: Place 2 threat on the main scheme. Draw 1 card." ("you" is the revealing player.) */
const MACH_REVEALED = stubAbility("mach.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "placeThreat", target: mainScheme, amount: n(2) },
    { kind: "draw", player: you, amount: n(1) },
  ],
});
/** "Quickstrike. Toughness. Surge. When Revealed: …" */
const MACH = {
  ...stubMinion({
    id: "mach",
    atk: 2,
    sch: 1,
    hp: 5,
    boostIcons: 0,
    keywords: [{ name: "quickstrike" }, { name: "toughness" }, { name: "surge" }],
    abilities: [MACH_REVEALED.ref],
  }),
  name: "Mach",
};
const JUSTICE = stubEnvironment({ id: "justice", name: "Justice" });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const TRAP = { ...stubTreachery({ id: "trap", boostIcons: 0 }), name: "Trap" };

/** Counts what it hears: the engagement in either window, and the reveal once it is done. */
const WITNESS_ENGAGING = stubAbility("witness.engaging", {
  trigger: { kind: "interrupt", forced: true, on: { on: "minionEngaged" } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "engaging", amount: n(1) }],
});
const WITNESS_ENGAGED = stubAbility("witness.engaged", {
  trigger: { kind: "response", forced: true, on: { on: "minionEngaged" } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "engaged", amount: n(1) }],
});
const WITNESS_REVEALED = stubAbility("witness.revealed", {
  trigger: { kind: "response", forced: true, on: { on: "cardRevealed" } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "revealed", amount: n(1) }],
});
const WITNESS = stubSupport({
  id: "witness",
  cost: 0,
  abilities: [WITNESS_ENGAGING.ref, WITNESS_ENGAGED.ref, WITNESS_REVEALED.ref],
});

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const fromDeck = (name: string): EffectSpec => ({
  kind: "selectCards",
  slot: "found",
  cards: { kind: "encounter", zones: ["deck"], filter: { name } },
});
const found: TargetRef = { kind: "slot", slot: "found" };
// "Reveal and attach Mach faceup to Justice."
const REVEAL_HELD = event("reveal-held", [
  fromDeck("Mach"),
  { kind: "revealCard", cards: found, player: you, heldBy: named("Justice") },
]);
// The same, resolved for the first player whoever plays it.
const REVEAL_HELD_FIRST = event("reveal-held-first", [
  fromDeck("Mach"),
  { kind: "revealCard", cards: found, player: { kind: "firstPlayer" }, heldBy: named("Justice") },
]);
// "Reveal Mach." (the control: an ordinary reveal)
const REVEAL_PLAIN = event("reveal-plain", [fromDeck("Mach"), { kind: "revealCard", cards: found, player: you }]);
// "Reveal and attach Trap faceup to Justice.": a treachery is no minion.
const REVEAL_TRAP_HELD = event("reveal-trap-held", [
  fromDeck("Trap"),
  { kind: "revealCard", cards: found, player: you, heldBy: named("Justice") },
]);
const EVENTS = [REVEAL_HELD, REVEAL_HELD_FIRST, REVEAL_PLAIN, REVEAL_TRAP_HELD];

const deps: EngineDeps = depsOf(
  MACH_REVEALED,
  WITNESS_ENGAGING,
  WITNESS_ENGAGED,
  WITNESS_REVEALED,
  ...EVENTS.map((e) => e.ability),
);

interface Table {
  readonly state: GameState;
  readonly justice: InstanceId | null;
  readonly witness: InstanceId;
}

/** P1 in hero form with the witness in play; `environment`: Justice in the villain's area. */
function table(options: { readonly players?: 1 | 2; readonly environment?: boolean } = {}): Table {
  const start = gameAtFirstTurn({
    players: options.players ?? 1,
    cards: [MACH, JUSTICE, BLANK, TRAP, WITNESS, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [MACH.id, JUSTICE.id, TRAP.id, ...copiesOf(BLANK.id, 20)],
    deck: [WITNESS.id, ...EVENTS.map((e) => e.card.id)],
  });
  const hero = runCommands(start, deps, { type: "changeForm", playerId: P1 }).state;
  expect(mustPlayer(hero, P1).identity.form).toBe("hero");
  const witness = playerCardIntoPlay(hero, WITNESS.id);
  if (options.environment === false) return { state: witness.state, justice: null, witness: witness.id };
  const environment = encounterCardInVillainArea(witness.state, JUSTICE.id);
  return { state: environment.state, justice: environment.id, witness: witness.id };
}

const play = (state: GameState, card: (typeof EVENTS)[number], player: PlayerId = P1) =>
  playFree(state, deps, card.card.id, player);
const idOf = (state: GameState, cardId: string): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === cardId)!.instanceId;
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const hand = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand.length;
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** The trigger events announced, by kind (`GameEvent triggerEvent`, as each is initiated). */
const announced = (events: readonly GameEvent[], kind: string) =>
  events.filter((e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === kind).length;
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("Q26: a minion revealed and attached to an environment", () => {
  it("is revealed in full and held: When Revealed (2 threat, 1 card), toughness, surge; no engagement, no quickstrike", () => {
    const t = table();
    const deck = activeEncounterDeck(t.state).deck.length;
    const { state, events, session } = play(t.state, REVEAL_HELD);
    const mach = idOf(state, MACH.id);

    // Revealed by P1, and held by the environment: in play, engaged with nobody.
    expect(typed(events, "encounterCardRevealed")).toEqual([
      { type: "encounterCardRevealed", instanceId: mach, cardId: MACH.id, playerId: P1 },
    ]);
    expect(locateCard(state, mach)).toEqual({ kind: "attachment", hostInstanceId: t.justice });
    expect(mustInstance(state, mach)).toMatchObject({ engagedWith: null, heldMinion: true, faceup: true });
    expect(isHeldMinion(state, mach)).toBe(true);
    expect(cardsInPlay(state)).toContain(mach);
    expect(minionsEngagedWith(state, P1)).toEqual([]);
    expect(typed(events, "minionHeld")).toEqual([
      { type: "minionHeld", instanceId: mach, hostInstanceId: t.justice, engagedBefore: null },
    ]);

    // It entered play once, with its toughness.
    expect(announced(events, "cardEntersPlay")).toBe(1);
    expect(mustInstance(state, mach).statuses.tough).toBe(1);

    // Its When Revealed resolved once, "you" being the revealing player: 2 threat, and 1 card drawn (the event played
    // came from outside the hand, so the hand is 1 larger).
    expect(threat(state)).toBe(threat(t.state) + 2);
    expect(hand(state, P1)).toBe(hand(t.state, P1) + 1);

    // No engagement: nothing heard `minionEngaged` in either window, and quickstrike made no attack on a hero.
    expect(counters(state, t.witness)).toEqual({ revealed: 1 });
    expect(announced(events, "minionEngaged")).toBe(0);
    expect(announced(events, "enemyAttack")).toBe(0);
    expect(typed(events, "enemyActivated")).toEqual([]);
    expect(mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage).toBe(0);

    // Surge: P1 is dealt 1 facedown card, which waits (Q22); 2 cards left the deck, Mach and that one.
    expect(typed(events, "surgeTriggered")).toEqual([{ type: "surgeTriggered", instanceId: mach, playerId: P1 }]);
    expect(mustPlayer(state, P1).dealtEncounter).toHaveLength(1);
    expect(activeEncounterDeck(state).deck).toHaveLength(deck - 2);
    expect(typed(events, "encounterCardRevealed")).toHaveLength(1);
    expectReplays(session);
  });

  it("control: the same minion revealed plainly engages P1 and its quickstrike attacks", () => {
    const t = table();
    const { state, events } = play(t.state, REVEAL_PLAIN);
    const mach = idOf(state, MACH.id);
    expect(minionsEngagedWith(state, P1)).toEqual([mach]);
    expect(mustInstance(state, mach)).toMatchObject({ engagedWith: P1, attachedTo: null });
    expect(typed(events, "minionHeld")).toEqual([]);
    expect(counters(state, t.witness)).toEqual({ engaging: 1, engaged: 1, revealed: 1 });
    expect(announced(events, "enemyAttack")).toBe(1);
    expect(threat(state)).toBe(threat(t.state) + 2);
  });

  it("the player the effect names resolves it: the first player draws and is dealt the surge card, not the player whose card it is", () => {
    const t = table({ players: 2 });
    const turn = runCommands(t.state, deps, { type: "endTurn", playerId: P1 }).state;
    const { state, events, session } = play(turn, REVEAL_HELD_FIRST, P2);
    const mach = idOf(state, MACH.id);
    expect(state.firstPlayerId).toBe(P1);
    expect(typed(events, "encounterCardRevealed")).toEqual([
      { type: "encounterCardRevealed", instanceId: mach, cardId: MACH.id, playerId: P1 },
    ]);
    expect(isHeldMinion(state, mach)).toBe(true);
    expect(hand(state, P1)).toBe(hand(turn, P1) + 1);
    expect(hand(state, P2)).toBe(hand(turn, P2));
    expect(mustPlayer(state, P1).dealtEncounter).toHaveLength(1);
    expect(mustPlayer(state, P2).dealtEncounter).toHaveLength(0);
    expect(minionsEngagedWith(state, P1)).toEqual([]);
    expect(minionsEngagedWith(state, P2)).toEqual([]);
    expectReplays(session);
  });

  it("with the host not in play, the minion is revealed as any other: it engages the revealing player", () => {
    const t = table({ environment: false });
    const { state, events } = play(t.state, REVEAL_HELD);
    const mach = idOf(state, MACH.id);
    expect(minionsEngagedWith(state, P1)).toEqual([mach]);
    expect(mustInstance(state, mach).heldMinion).toBeUndefined();
    expect(typed(events, "minionHeld")).toEqual([]);
    expect(counters(state, t.witness)).toEqual({ engaging: 1, engaged: 1, revealed: 1 });
  });

  it("a card that is not a minion is revealed as any other: the treachery is discarded, nothing is attached", () => {
    const t = table();
    const { state, events } = play(t.state, REVEAL_TRAP_HELD);
    const trap = idOf(state, TRAP.id);
    expect(locateCard(state, trap)?.kind).toBe("encounterDiscard");
    expect(mustInstance(state, t.justice!).attachments).toEqual([]);
    expect(typed(events, "minionHeld")).toEqual([]);
  });
});
