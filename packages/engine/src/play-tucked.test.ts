/**
 * docs/phase7-wave6.md §3.57: playing a tucked ally as if from hand, exhausted (`EffectSpec playFromHand { from: {
 * tuckedUnder }, entersExhausted }`). Synthetic cards shaped like Med Lab (`rogue` 38028): "Response: After an ally is
 * defeated by consequential damage, exhaust Med Lab → place it here. (Limit 1 ally at a time.) Alter-Ego Action:
 * Exhaust Med Lab → play the ally here as if it was in your hand. It enters play exhausted."
 *
 * Sources: RRG 1.8 "Tuck" (p. 45): tucked cards are not in play. "Play, Put Into Play" (p. 32): playing pays the cost.
 * "Ally Limit" (p. 7): over the limit, discard down at once. "Initiating Abilities" (p. 24) steps 2–3. Ruling Dec 17,
 * 2025 (4) #2: "Med Lab can target allies from out-of-play areas that are still in the game, such as a player's discard
 * pile. It **cannot** target allies that have been removed from the game. Because Odin is removed from the game via a
 * Forced Interrupt, he is removed before Med Lab's Response can trigger, making him untargetable."
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, RESOURCE, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const playHere = (extra: Partial<Extract<EffectSpec, { kind: "playFromHand" }>> = {}): EffectSpec => ({
  kind: "playFromHand",
  player: { kind: "controller" },
  from: { tuckedUnder: { kind: "self" } },
  ...extra,
});
const action = (effects: readonly EffectSpec[]): AbilityDefinition => ({
  trigger: { kind: "action", form: "alterEgo" },
  cost: { exhaustSelf: true },
  effects,
});
/** Med Lab's shape. The response is forced here and costs nothing, to keep the windows out of the way. */
const LAB_ACTION = stubAbility("lab.action", action([playHere({ entersExhausted: true })]));
const LAB_RESPONSE = stubAbility("lab.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "characterDefeated", targetIs: { categories: ["ally"] }, consequential: true },
  },
  effects: [{ kind: "tuckCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, under: { kind: "self" } }],
});
const LAB = stubSupport({ id: "lab", cost: 0, abilities: [LAB_ACTION.ref, LAB_RESPONSE.ref] });
/** The near miss: the same play, without "It enters play exhausted". */
const BAY_ACTION = stubAbility("bay.action", action([playHere()]));
const BAY = stubSupport({ id: "bay", cost: 0, abilities: [BAY_ACTION.ref] });
/** "After you play an ally": counts each play on itself. */
const RALLY_RESPONSE = stubAbility("rally.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["ally"] } },
  },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "rally", amount: { kind: "const", value: 1 } },
  ],
});
const RALLY = stubSupport({ id: "rally", cost: 0, abilities: [RALLY_RESPONSE.ref] });
/** 2 to play; 1 hit point and 1 consequential damage after attacking, so its own attack defeats it. */
const PATIENT = stubAlly({ id: "patient", cost: 2, atk: 1, thw: 1, hp: 1, consequentialAttack: 1 });
/** Odin's shape: "Forced Interrupt: When this ally is defeated, remove it from the game." */
const KING_INTERRUPT = stubAbility("king.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "setDefeatDestination", to: "removedFromGame" }],
});
const KING = stubAlly({
  id: "king",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 1,
  consequentialAttack: 1,
  abilities: [KING_INTERRUPT.ref],
});
const FILLER = stubAlly({ id: "filler", cost: 0, atk: 1, thw: 1, hp: 3 });
/** "Deal 3 damage to the patient": a defeat that is not by consequential damage. */
const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "dealDamage", target: { kind: "each", query: { name: "patient" } }, amount: { kind: "const", value: 3 } },
  ],
});
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });
const TANK = stubMinion({ id: "tank", atk: 0, sch: 0, hp: 20 });

const deps: EngineDeps = depsOf(LAB_ACTION, LAB_RESPONSE, BAY_ACTION, RALLY_RESPONSE, KING_INTERRUPT, ZAP_ACTION);
const CARDS = [LAB, BAY, RALLY, PATIENT, KING, FILLER, ZAP, TANK];

interface Table {
  readonly state: GameState;
  readonly lab: InstanceId;
  readonly bay: InstanceId;
  readonly patient: InstanceId;
  readonly fillers: readonly InstanceId[];
}

/**
 * p1 in alter-ego form with Med Lab's shape, its no-exhaust twin and Rally in play, `resources` resource cards in hand
 * (and nothing else), `fillers` allies already in play, and the patient tucked under `tuckUnder` (if any).
 */
function table(opts: { resources: number; fillers?: number; tuckUnder?: "lab" | "bay" | null }): Table {
  const start = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [LAB.id, BAY.id, RALLY.id, PATIENT.id, KING.id, ZAP.id, ...copiesOf(FILLER.id, 3)],
    encounter: [...copiesOf(TREACHERY.id, 28), TANK.id],
  });
  // Test surgery: an empty hand, then exactly the resource cards asked for.
  let state: GameState = {
    ...start,
    players: start.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "alterEgo" },
      hand: [],
      deck: [...p.hand, ...p.deck],
    })),
  };
  const given: InstanceId[] = [];
  for (let i = 0; i < opts.resources; i++) {
    const resource = giveCard(state, P1, RESOURCE.id, given);
    state = resource.state;
    given.push(resource.id);
  }
  const lab = playerCardIntoPlay(state, LAB.id);
  const bay = playerCardIntoPlay(lab.state, BAY.id);
  state = playerCardIntoPlay(bay.state, RALLY.id).state;
  const fillers: InstanceId[] = [];
  for (let i = 0; i < (opts.fillers ?? 0); i++) {
    const filler = playerCardIntoPlay(state, FILLER.id);
    state = filler.state;
    fillers.push(filler.id);
  }
  const patient = giveCard(state, P1, PATIENT.id);
  state = patient.state;
  const host = opts.tuckUnder === undefined ? lab.id : opts.tuckUnder === "bay" ? bay.id : null;
  if (host) {
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => id !== patient.id) })),
      instances: {
        ...state.instances,
        [host]: { ...mustInstance(state, host), tucked: [patient.id] },
      },
    };
  } else {
    state = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((id) => id !== patient.id),
        discard: [...p.discard, patient.id],
      })),
    };
  }
  return { state, lab: lab.id, bay: bay.id, patient: patient.id, fillers };
}

const use = (t: Table, card: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as never,
  payment: [],
});

/** Pays every resource offered; discards over the ally limit with `discardPick` (default the first offered). */
function picker(discardPick?: InstanceId) {
  const discardPrompts: string[][] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "spendResources") return choice.options.map((o) => o.optionId);
    if (choice?.prompt.kind === "discardOverAllyLimit") {
      discardPrompts.push(choice.options.map((o) => o.optionId));
      return [discardPick ?? choice.options[0]!.optionId];
    }
    return defaultPick(state);
  };
  return { pick, discardPrompts };
}

const playedEvents = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "cardPlayed" && e.instanceId === id);

describe("§3.57 playing a tucked ally as if from hand, exhausted", () => {
  it("pays its cost, enters play exhausted, leaves the tuck and counts as played; replay deep-equal", () => {
    const t = table({ resources: 2 });
    const { pick } = picker();
    const { session, events } = driveSession(startSession(t.state), deps, [use(t, t.lab, "lab.action")], pick);
    const state = session.state;
    const p1 = mustPlayer(state, P1);
    expect(p1.playArea).toContain(t.patient);
    expect(mustInstance(state, t.patient).exhausted).toBe(true);
    expect(mustInstance(state, t.patient).controllerId).toBe(P1);
    expect(mustInstance(state, t.lab).tucked).toEqual([]);
    expect(mustInstance(state, t.lab).exhausted).toBe(true);
    // The cost was paid: both resource cards spent, 2 resources recorded on the play.
    expect(p1.hand).toEqual([]);
    expect(playedEvents(events, t.patient)).toMatchObject([{ resourcesPaid: 2 }]);
    // "After you play an ally" fires once, for this play.
    expect(
      mustInstance(
        state,
        mustPlayer(state, P1).playArea.find((id) => isRally(state, id))!,
      ).counters,
    ).toEqual({
      rally: 1,
    });
    // Exhausted as it moved in, before its enter-play announcement.
    const moved = events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === t.patient && e.to.kind === "playArea",
    );
    const exhausted = events.findIndex((e) => e.type === "cardExhausted" && e.instanceId === t.patient);
    expect(moved).toBeGreaterThanOrEqual(0);
    expect(exhausted).toBe(moved + 1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("near miss: without `entersExhausted` the same play enters ready", () => {
    const t = table({ resources: 2, tuckUnder: "bay" });
    const { pick } = picker();
    const { session, events } = driveSession(startSession(t.state), deps, [use(t, t.bay, "bay.action")], pick);
    expect(mustPlayer(session.state, P1).playArea).toContain(t.patient);
    expect(mustInstance(session.state, t.patient).exhausted).toBe(false);
    expect(events.some((e) => e.type === "cardExhausted" && e.instanceId === t.patient)).toBe(false);
  });

  it("over the ally limit, a discard is forced at once; the played ally may stay", () => {
    const t = table({ resources: 2, fillers: 3 });
    const { pick, discardPrompts } = picker();
    const { session } = driveSession(startSession(t.state), deps, [use(t, t.lab, "lab.action")], pick);
    const p1 = mustPlayer(session.state, P1);
    expect(discardPrompts).toHaveLength(1);
    expect(discardPrompts[0]).toEqual(expect.arrayContaining([...t.fillers, t.patient]));
    expect(p1.playArea).toContain(t.patient);
    expect(p1.discard).toContain(t.fillers[0]);
    expect(p1.playArea.filter((id) => t.fillers.includes(id) || id === t.patient)).toHaveLength(3);
  });

  it("is not offered, and is refused, when the tucked ally cannot be paid for; offered once it can", () => {
    const short = table({ resources: 1 });
    const offered = (state: GameState) => {
      const legal = legalActions(state, P1, deps);
      if (legal.kind !== "turn") throw new Error(legal.kind);
      return legal.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === "lab.action");
    };
    expect(offered(short.state)).toBe(false);
    const refused = applyCommand(short.state, use(short, short.lab, "lab.action"), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    expect(offered(table({ resources: 2 }).state)).toBe(true);
    // Nothing tucked there: nothing to play.
    expect(offered(table({ resources: 2, tuckUnder: null }).state)).toBe(false);
  });

  it("a game where no card plays a tucked card is unchanged: a hand play enters ready and the play frame is as before", () => {
    const t = table({ resources: 2, tuckUnder: null });
    const given = giveCard(t.state, P1, FILLER.id);
    const command: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    const result = applyCommand(given.state, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(mustInstance(result.state, given.id).exhausted).toBe(false);
    expect(result.events.some((e) => e.type === "cardExhausted")).toBe(false);
    expect(JSON.stringify(result.state.stack)).not.toContain("entersExhausted");
  });
});

const isRally = (state: GameState, id: InstanceId) => String(mustInstance(state, id).cardId) === RALLY.id;

describe("§3.57 ruling Dec 17, 2025 (4) #2: Med Lab takes an ally from the discard pile, never from removed-from-game", () => {
  function attackWith(state: GameState, ally: InstanceId) {
    const tank = minionEngagedWith(state, TANK.id);
    return driveSession(startSession(tank.state), deps, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: tank.id },
    ]);
  }

  it("an ally defeated by its consequential damage is tucked from the discard pile, then played from there", () => {
    const t = table({ resources: 2, tuckUnder: null });
    const inPlay = playerCardIntoPlay(t.state, PATIENT.id);
    const { session, events } = attackWith(inPlay.state, inPlay.id);
    expect(events.some((e) => e.type === "characterDefeated" && e.instanceId === t.patient)).toBe(true);
    expect(mustInstance(session.state, t.lab).tucked).toEqual([t.patient]);
    expect(mustPlayer(session.state, P1).discard).not.toContain(t.patient);
    const { pick } = picker();
    const after = driveSession(session, deps, [use(t, t.lab, "lab.action")], pick);
    expect(mustPlayer(after.session.state, P1).playArea).toContain(t.patient);
    expect(mustInstance(after.session.state, t.patient).exhausted).toBe(true);
  });

  it("near miss: an ally removed from the game by its forced interrupt is never tucked", () => {
    const t = table({ resources: 2, tuckUnder: null });
    const king = playerCardIntoPlay(t.state, KING.id);
    const { session, events } = attackWith(king.state, king.id);
    expect(events.some((e) => e.type === "characterDefeated" && e.instanceId === king.id)).toBe(true);
    expect(session.state.removedFromGame).toContain(king.id);
    expect(mustInstance(session.state, t.lab).tucked).toEqual([]);
  });

  it("near miss: an ally defeated by other damage is not tucked", () => {
    const t = table({ resources: 2, tuckUnder: null });
    const inPlay = playerCardIntoPlay(t.state, PATIENT.id);
    const zap = giveCard(inPlay.state, P1, ZAP.id);
    const { session } = driveSession(startSession(zap.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: zap.id, payment: [], attachToInstanceId: null },
    ]);
    expect(mustPlayer(session.state, P1).discard).toContain(t.patient);
    expect(mustInstance(session.state, t.lab).tucked).toEqual([]);
  });
});
