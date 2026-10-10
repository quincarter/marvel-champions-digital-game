/**
 * docs/phase7-wave9.md §3.19: an ally a player controls, attached to a card and put under no player's control.
 * Synthetic cards shaped like Hostage Situation (`aos` 50121): "When Revealed: Attach 1 Rescued ally faceup here.
 * Attached ally is under no player's control. (Attached ally is still in play.) When Defeated: The defeating player
 * takes control of attached ally." `EffectSpec attach` with `as: "captive"` clears the ally's controller, which makes it
 * a captive ally (`isCaptiveAlly`, docs/phase7-wave6.md §3.75; `captive-ally.test.ts` covers one that starts that way);
 * `EffectSpec detach` gives it a controller again.
 *
 * Rules: RRG 1.8 "Ownership and Control" (p. 31: "If a character changes control while it is in play, it remains in the
 * same state (i.e., readied or exhausted, damaged or not, etc.)"); "Ally Limit" (p. 7: "Each player is permitted to
 * control a maximum of three allies"; "if a player ever controls a number of allies greater than their ally limit in
 * play, they must immediately choose and discard"); "Attach To" (p. 8: an attached card "remains in play until either
 * the element it is attached to leaves play, in which case the attached card is discarded, or …"); ruling Jun 25, 2026
 * (4) #5 ("Characters not under player control are not friendly characters").
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, isAlly, isCaptiveAlly, selectTargets } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSideScheme, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, settleUntil, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const named = (name: string): TargetRef => ({ kind: "named", name });
const n = (value: number) => ({ kind: "const", value }) as const;

/** "Action: Deal 1 damage to the villain." */
const GUARD_ACTION = stubAbility("guard.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: theVillain, amount: n(1) }],
});
/** "Response: After the villain is dealt damage, place 1 counter here." */
const GUARD_RESPONSE = stubAbility("guard.response", {
  trigger: { kind: "response", forced: false, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: n(1) }],
});
/** "Forced Response: After the villain is dealt damage, place 1 counter here." */
const GUARD_FORCED = stubAbility("guard.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
  effects: [{ kind: "addCounters", target: self, counterType: "forced", amount: n(1) }],
});
const GUARD = stubAlly({
  id: "guard",
  cost: 0,
  atk: 2,
  thw: 1,
  hp: 3,
  abilities: [GUARD_ACTION.ref, GUARD_RESPONSE.ref, GUARD_FORCED.ref],
});
const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 1, thw: 1, hp: 2 });
const MEDIC = stubAlly({ id: "medic", cost: 0, atk: 1, thw: 1, hp: 2 });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 2 });
const BADGE = stubUpgrade({ id: "badge", cost: 0 });

/** "When Defeated: The defeating player takes control of attached ally." */
const LOCKUP_DEFEATED = stubAbility("lockup.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    {
      kind: "detach",
      card: { kind: "each", query: { categories: ["ally"], host: self } },
      controller: { kind: "defeatingPlayer" },
    },
  ],
});
const LOCKUP = stubSideScheme({ id: "lockup", startingThreat: 2, abilities: [LOCKUP_DEFEATED.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Attach [the guard] faceup to [the lockup]. Attached ally is under no player's control." */
const CAPTURE = event("capture", [{ kind: "attach", card: named(GUARD.id), to: named(LOCKUP.id), as: "captive" }]);
/** The same attach without the option: the ally keeps its controller. */
const PARK = event("park", [{ kind: "attach", card: named(GUARD.id), to: named(LOCKUP.id) }]);
/** A card that is not an ally, attached with the option: it keeps its controller. */
const PIN = event("pin", [{ kind: "attach", card: named(BADGE.id), to: named(LOCKUP.id), as: "captive" }]);
const FREE = event("free", [{ kind: "removeThreat", target: named(LOCKUP.id), amount: n(2) }]);
const RAZE = event("raze", [{ kind: "discardFromPlay", target: named(LOCKUP.id) }]);
const JAB = event("jab", [{ kind: "dealDamage", target: named(GUARD.id), amount: n(1) }]);
const SLAY = event("slay", [{ kind: "dealDamage", target: named(GUARD.id), amount: n(3) }]);
const STRIKE = event("strike", [{ kind: "dealDamage", target: theVillain, amount: n(1) }]);
const EVENTS = [CAPTURE, PARK, PIN, FREE, RAZE, JAB, SLAY, STRIKE];

const deps: EngineDeps = depsOf(
  GUARD_ACTION,
  GUARD_RESPONSE,
  GUARD_FORCED,
  LOCKUP_DEFEATED,
  ...EVENTS.map((e) => e.ability),
);

/** Takes every optional prompt (the first option that is not "decline"), declines to defend, else the default. */
const eager =
  (seen: string[] = []) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice!;
    seen.push(`${choice.playerId}:${choice.prompt.kind}`);
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    const picked = defaultPick(state);
    if (picked.length > 0) return picked;
    const take = choice.options.find((o) => o.optionId !== "decline");
    return take ? [take.optionId] : [];
  };

function play(state: GameState, card: string, player: PlayerId = P1, seen: string[] = []) {
  const given = giveCard(state, player, card);
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return runCommandsPicking(given.state, deps, eager(seen), command);
}

/** Two players at P1's turn: the lockup in play with 2 threat, and P1 controlling the guard, scout and medic. */
function start(): { state: GameState; guard: InstanceId; scout: InstanceId; medic: InstanceId; lockup: InstanceId } {
  const base = gameAtFirstTurn({
    deps,
    players: 2,
    cards: [GUARD, SCOUT, MEDIC, RECRUIT, BADGE, LOCKUP, ...EVENTS.map((e) => e.card)],
    encounter: [LOCKUP.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [GUARD.id, SCOUT.id, MEDIC.id, RECRUIT.id, BADGE.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const lockup = encounterCardInVillainArea(base, LOCKUP.id, 2);
  const guard = playerCardIntoPlay(lockup.state, GUARD.id);
  const scout = playerCardIntoPlay(guard.state, SCOUT.id);
  const medic = playerCardIntoPlay(scout.state, MEDIC.id);
  return { state: medic.state, guard: guard.id, scout: scout.id, medic: medic.id, lockup: lockup.id };
}
const patch = (state: GameState, id: InstanceId, change: { damage?: number; exhausted?: boolean }): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
const alliesOf = (state: GameState, player: PlayerId): InstanceId[] =>
  cardsInPlay(state).filter((id) => isAlly(state, id) && mustInstance(state, id).controllerId === player);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const refused = (state: GameState, command: Command): boolean => !applyCommand(state, command, deps).ok;
const mentions = (value: unknown, id: InstanceId): boolean => JSON.stringify(value).includes(`"${id}"`);

describe("§3.19 attach with as: 'captive': the attached ally is under no player's control", () => {
  it("the ally is on the host with no controller, still owned by its owner, in play, in the state it was in", () => {
    const { state, guard, lockup } = start();
    const run = play(patch(state, guard, { damage: 1, exhausted: true }), CAPTURE.card.id);
    const held = mustInstance(run.state, guard);
    expect([held.attachedTo, held.controllerId, held.ownerId]).toEqual([lockup, null, P1]);
    expect([held.damage, held.exhausted, held.faceup]).toEqual([1, true, true]);
    expect(locateCard(run.state, guard)).toEqual({ kind: "attachment", hostInstanceId: lockup });
    expect(mustPlayer(run.state, P1).playArea).not.toContain(guard);
    expect(cardsInPlay(run.state)).toContain(guard);
    expect(isCaptiveAlly(run.state, guard)).toBe(true);
    expect(of(run.events, "controlReleased")).toEqual([
      { type: "controlReleased", instanceId: guard, hostInstanceId: lockup, from: P1 },
    ]);
    // An ally and a character, friendly to nobody (ruling Jun 25, 2026 (4) #5).
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    expect(selectTargets(run.state, { categories: ["ally"] }, context)).toContain(guard);
    expect(selectTargets(run.state, { categories: ["ally"], controller: "you" }, context)).not.toContain(guard);
    expect(selectTargets(run.state, { categories: ["identity", "ally"] }, context)).not.toContain(guard);
  });

  it("without the option the attached ally keeps its controller; a card that is not an ally keeps its controller", () => {
    const { state, guard, lockup } = start();
    const parked = play(state, PARK.card.id);
    expect([mustInstance(parked.state, guard).attachedTo, mustInstance(parked.state, guard).controllerId]).toEqual([
      lockup,
      P1,
    ]);
    expect(of(parked.events, "controlReleased")).toEqual([]);

    const badge = playerCardIntoPlay(state, BADGE.id);
    const pinned = play(badge.state, PIN.card.id);
    expect([
      mustInstance(pinned.state, badge.id).attachedTo,
      mustInstance(pinned.state, badge.id).controllerId,
    ]).toEqual([lockup, P1]);
    expect(of(pinned.events, "controlReleased")).toEqual([]);
  });

  it("nobody can use it: no basic attack or thwart, no Action of its own, for its old controller or anyone", () => {
    const { state, guard, scout, lockup } = start();
    const villain = state.villains[0]!.instanceId;
    // Before: the guard's attack, thwart and Action are P1's.
    expect(mentions(legalActions(state, P1, deps), guard)).toBe(true);
    const held = play(state, CAPTURE.card.id).state;
    expect(mentions(legalActions(held, P1, deps), guard)).toBe(false);
    expect(mentions(legalActions(held, P2, deps), guard)).toBe(false);
    expect(mentions(legalActions(held, P1, deps), scout)).toBe(true);
    for (const playerId of [P1, P2]) {
      expect(
        refused(held, { type: "basicAttack", playerId, attackerInstanceId: guard, targetInstanceId: villain }),
      ).toBe(true);
      expect(
        refused(held, { type: "basicThwart", playerId, thwarterInstanceId: guard, schemeInstanceId: lockup }),
      ).toBe(true);
      expect(
        refused(held, {
          type: "useAbility",
          playerId,
          cardInstanceId: guard,
          abilityId: GUARD_ACTION.ref.id,
          payment: [],
        }),
      ).toBe(true);
    }
  });

  it("its optional Response is offered to nobody (its Forced Response still resolves); controlled, the Response is its controller's", () => {
    const { state, guard } = start();
    const seenFree: string[] = [];
    const free = play(state, STRIKE.card.id, P1, seenFree);
    expect(mustInstance(free.state, guard).counters["seen"]).toBe(1);

    const held = play(state, CAPTURE.card.id).state;
    const seenHeld: string[] = [];
    const struck = play(held, STRIKE.card.id, P1, seenHeld);
    expect(mustInstance(struck.state, guard).counters["seen"] ?? 0).toBe(0);
    expect(seenHeld).toEqual([]);
    expect(mustInstance(struck.state, guard).counters["forced"]).toBe(1);
    expect(seenFree.length).toBeGreaterThan(0);
  });

  it("it defends for nobody: the villain's attack on its old controller does not offer it", () => {
    const { state, guard, scout } = start();
    const held = play(state, CAPTURE.card.id).state;
    // In hero form the villain attacks P1 (the first player) and asks for a defender.
    const ended = runCommandsPicking(
      held,
      deps,
      eager(),
      { type: "changeForm", playerId: P1 },
      { type: "endTurn", playerId: P1 },
    ).state;
    const passed = applyCommand(ended, { type: "endTurn", playerId: P2 }, deps);
    if (!passed.ok) throw new Error(passed.error.message);
    const asked = settleUntil(passed.state, "declareDefender", deps);
    expect(asked.pendingChoice?.prompt.kind).toBe("declareDefender");
    expect(asked.pendingChoice?.playerId).toBe(P1);
    expect(mentions(asked.pendingChoice?.options, scout)).toBe(true);
    expect(mentions(asked.pendingChoice?.options, guard)).toBe(false);
  });

  it("it readies with nobody: exhausted when taken, it is still exhausted next round; its old controller's ally is not", () => {
    const { state, guard, scout } = start();
    const staged = patch(patch(state, guard, { exhausted: true }), scout, { exhausted: true });
    const held = play(staged, CAPTURE.card.id).state;
    const round = runCommandsPicking(
      held,
      deps,
      eager(),
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    ).state;
    expect(round.round).toBe(held.round + 1);
    expect(mustInstance(round, scout).exhausted).toBe(false);
    expect(mustInstance(round, guard).exhausted).toBe(true);
    expect(mustInstance(round, guard).controllerId).toBeNull();
  });

  it("the ally limit does not count it: with it held, a third ally enters play and nobody discards", () => {
    const { state, guard, scout, medic } = start();
    expect(alliesOf(state, P1)).toHaveLength(3);
    const held = play(state, CAPTURE.card.id).state;
    expect(alliesOf(held, P1).sort()).toEqual([scout, medic].sort());
    const seen: string[] = [];
    const joined = play(held, RECRUIT.id, P1, seen);
    expect(alliesOf(joined.state, P1)).toHaveLength(3);
    expect(seen).toEqual([]);
    expect(cardsInPlay(joined.state)).toContain(guard);
    expect(mustPlayer(joined.state, P1).discard.filter((id) => isAllyCard(joined.state, id))).toEqual([]);
  });

  it("it is still a character: 1 damage lands on it; 3 damage defeats it, into its owner's discard pile", () => {
    const { state, guard, lockup } = start();
    const held = play(state, CAPTURE.card.id).state;
    const jabbed = play(held, JAB.card.id, P2).state;
    expect(mustInstance(jabbed, guard).damage).toBe(1);
    expect(mustInstance(jabbed, guard).attachedTo).toBe(lockup);
    const slain = play(held, SLAY.card.id, P2).state;
    expect(cardsInPlay(slain)).not.toContain(guard);
    expect(mustPlayer(slain, P1).discard).toContain(guard);
    expect(mustInstance(slain, lockup).attachments).toEqual([]);
  });
});

/** Whether a card in a discard pile is one of this file's allies. */
const isAllyCard = (state: GameState, id: InstanceId): boolean =>
  [GUARD.id, SCOUT.id, MEDIC.id, RECRUIT.id].includes(mustInstance(state, id).cardId);

describe("§3.19 detach hands the captive ally to the named player", () => {
  it("the scheme defeated by P2: P2 controls it, in P2's play area, P1 still owns it, exhausted and damaged as it was", () => {
    const { state, guard, lockup } = start();
    const held = play(patch(state, guard, { damage: 2, exhausted: true }), CAPTURE.card.id).state;
    const run = play(held, FREE.card.id, P2);
    expect(cardsInPlay(run.state)).not.toContain(lockup);
    const freed = mustInstance(run.state, guard);
    expect([freed.attachedTo, freed.controllerId, freed.ownerId]).toEqual([null, P2, P1]);
    expect([freed.damage, freed.exhausted]).toEqual([2, true]);
    expect(locateCard(run.state, guard)).toEqual({ kind: "playArea", playerId: P2 });
    expect(isCaptiveAlly(run.state, guard)).toBe(false);
    expect(of(run.events, "cardDetached")).toEqual([{ type: "cardDetached", instanceId: guard, from: lockup }]);
    expect(of(run.events, "controllerChanged")).toEqual([
      { type: "controllerChanged", instanceId: guard, from: null, to: P2, reason: "effect" },
    ]);
  });

  it("taken ready, it is handed over ready and its new controller can attack with it at once", () => {
    const { state, guard } = start();
    const held = play(state, CAPTURE.card.id).state;
    const freed = play(held, FREE.card.id).state;
    expect(mustInstance(freed, guard).exhausted).toBe(false);
    expect(mustInstance(freed, guard).controllerId).toBe(P1);
    expect(mentions(legalActions(freed, P1, deps), guard)).toBe(true);
    const villain = freed.villains[0]!.instanceId;
    const attack = applyCommand(
      freed,
      { type: "basicAttack", playerId: P1, attackerInstanceId: guard, targetInstanceId: villain },
      deps,
    );
    expect(attack.ok).toBe(true);
  });

  it("the ally limit then applies: handed a fourth ally, the taker chooses and discards down to three", () => {
    const { state, guard } = start();
    const held = play(state, CAPTURE.card.id).state;
    const joined = play(held, RECRUIT.id).state;
    expect(alliesOf(joined, P1)).toHaveLength(3);
    const seen: string[] = [];
    const freed = play(joined, FREE.card.id, P1, seen);
    expect(seen.some((entry) => entry.startsWith(`${P1}:`))).toBe(true);
    expect(alliesOf(freed.state, P1)).toHaveLength(3);
    expect(mustPlayer(freed.state, P1).discard.filter((id) => isAllyCard(freed.state, id))).toHaveLength(1);
    // The fourth ally was really there to be counted: the guard went to P1 before the discard.
    expect(of(freed.events, "controllerChanged")).toMatchObject([{ instanceId: guard, from: null, to: P1 }]);
  });

  it("the scheme leaving play another way (discarded, not defeated): no hand-over, the ally is discarded with it", () => {
    const { state, guard, lockup } = start();
    const held = play(state, CAPTURE.card.id).state;
    const run = play(held, RAZE.card.id, P2);
    expect(cardsInPlay(run.state)).not.toContain(lockup);
    expect(cardsInPlay(run.state)).not.toContain(guard);
    expect(mustPlayer(run.state, P1).discard).toContain(guard);
    expect(mustInstance(run.state, guard).controllerId).toBe(P1);
    expect(of(run.events, "cardDetached")).toEqual([]);
    expect(of(run.events, "controllerChanged")).toEqual([]);
  });

  it("replays to the same state: taken, then handed over", () => {
    const { state } = start();
    const given = giveCard(giveCard(state, P1, CAPTURE.card.id).state, P1, FREE.card.id);
    const hand = mustPlayer(given.state, P1).hand;
    const idOf = (card: string) => hand.find((id) => mustInstance(given.state, id).cardId === card)!;
    const run = runCommandsPicking(
      given.state,
      deps,
      eager(),
      { type: "playCard", playerId: P1, cardInstanceId: idOf(CAPTURE.card.id), payment: [], attachToInstanceId: null },
      { type: "playCard", playerId: P1, cardInstanceId: idOf(FREE.card.id), payment: [], attachToInstanceId: null },
    );
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});
