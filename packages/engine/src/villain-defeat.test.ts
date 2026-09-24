/**
 * docs/phase7-wave3.md §3.1: a villain's defeat as an interruptible event, `RuleSpec cannotBeDefeated`, a villain face
 * printed with ∞ hit points, and what a flip does to the dial when one face is ∞. Proven with synthetic cards shaped
 * like The Collector (Escape the Museum, `gmw` 16080a/b), Hela (`mts` 21136a/b) and MaGog (`mojo`).
 *
 * Sources: RRG 1.8 "Hit Points" (p. 22), "Villain Defeat" (p. 47), "Flip" (p. 20), "'Cannot'" (p. 11), "Interrupt"
 * (p. 24); The Galaxy's Most Wanted rulebook, "Infinite Hit Points (New)" (MC16 p. 12); The Mad Titan's Shadow
 * rulebook, Hela (MC21 p. 20).
 */

import { flat, type AnyCard, type CardId, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeVillain, characterProfile, mustInstance, mustPlayer, remainingHitPoints } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO, MAIN_SCHEME } from "./testing/scenario.js";

const p1 = playerId("p1");
const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const n = (value: number) => ({ kind: "const", value }) as const;

// --- Villains ----------------------------------------------------------------------------------------------------

/** "Forced Interrupt: When Collector would be defeated, … flip this card instead." */
const COLLECTOR_WOULD_FALL = stubAbility("collector.would-be-defeated", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "flipCard", target: self }],
});
/** "Collector cannot be defeated." */
const COLLECTOR_CANNOT_FALL = stubAbility("collector.cannot-be-defeated", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: { self: true } }] },
  effects: [],
});
/** Escape the Museum's Collector: an 8-hit-point front and an ∞ "Wounded" back. */
const COLLECTOR = stubVillain({
  id: "collector",
  name: "Collector",
  stages: [{ hp: flat(8), atk: 1, sch: 1, abilities: [COLLECTOR_WOULD_FALL.ref] }],
  back: {
    name: "Collector",
    stages: [{ hp: flat(0), infiniteHp: true, atk: 0, sch: 0, abilities: [COLLECTOR_CANNOT_FALL.ref] }],
  },
});
/** The same card with nothing listening to its defeat. */
const PLAIN = stubVillain({
  id: "plain",
  stages: [{ hp: flat(8), atk: 1, sch: 1 }],
  back: { name: "plain", stages: [{ hp: flat(0), infiniteHp: true, atk: 0, sch: 0 }] },
});
/** "When MaGog would be defeated, reset his hit points … instead" — here, "set his hit point dial to 5 instead". */
const MAGOG_WOULD_FALL = stubAbility("magog.would-be-defeated", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "setRemainingHitPoints", target: self, amount: n(5) }],
});
const MAGOG = stubVillain({
  id: "magog",
  stages: [{ hp: flat(8), atk: 1, sch: 1, abilities: [MAGOG_WOULD_FALL.ref] }],
});
/** Two finite stages, for a defeat that is listened to but not replaced. */
const TWO_STAGE = stubVillain({
  id: "two-stage",
  stages: [
    { hp: flat(8), atk: 1, sch: 1 },
    { hp: flat(10), atk: 2, sch: 1 },
  ],
});
/** Green Goblin's shape: both faces finite, so a flip keeps the damage (Risky Business "New Rules"). */
const GOBLIN = stubVillain({
  id: "goblin",
  stages: [{ hp: flat(12), atk: 1, sch: 1 }],
  back: { name: "Goblin", stages: [{ hp: flat(12), atk: 2, sch: 0 }] },
});
/** A finite villain whose own stage says it cannot be defeated (Citizen V's shape, without the condition). */
const UNDEFEATABLE = stubVillain({
  id: "undefeatable",
  stages: [{ hp: flat(8), atk: 1, sch: 1, abilities: [COLLECTOR_CANNOT_FALL.ref] }],
});

// --- Player cards --------------------------------------------------------------------------------------------------

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const hit = (amount: number) =>
  actionEvent(`hit-${amount}`, [{ kind: "dealDamage", target: theVillain, amount: n(amount) }]);
const HIT_3 = hit(3);
const HIT_8 = hit(8);
const HIT_50 = hit(50);
const FLIP = actionEvent("flip", [{ kind: "flipCard", target: theVillain }]);
const SET_DIAL = actionEvent("set-dial", [{ kind: "setRemainingHitPoints", target: theVillain, amount: n(3) }]);
const HURT_ME = actionEvent("hurt-me", [
  { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "controller" } }, amount: n(30) },
]);
const EVENTS = [HIT_3, HIT_8, HIT_50, FLIP, SET_DIAL, HURT_ME];

/** "When a character would be defeated, place a counter here": listens without replacing. */
const WITNESS_INTERRUPT = stubAbility("witness.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated" } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: n(1) }],
});
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_INTERRUPT.ref] });
/** "Identities cannot be defeated." */
const WARD_RULE = stubAbility("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: { categories: ["identity"] } }] },
  effects: [],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARD_RULE.ref] });

const ALL: readonly StubAbility[] = [
  COLLECTOR_WOULD_FALL,
  COLLECTOR_CANNOT_FALL,
  MAGOG_WOULD_FALL,
  WITNESS_INTERRUPT,
  WARD_RULE,
  ...EVENTS.map((event) => event.ability),
];
const deps: EngineDeps = depsOf(...ALL);
const VILLAINS: readonly VillainCard[] = [COLLECTOR, PLAIN, MAGOG, TWO_STAGE, GOBLIN, UNDEFEATABLE];
const CARDS: readonly AnyCard[] = [...DEFAULT_CARDS, ...VILLAINS, WITNESS, WARD, ...EVENTS.map((e) => e.card)];
const copies = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);

// --- Driving -------------------------------------------------------------------------------------------------------

function drive(session: GameSession, commands: readonly Command[]) {
  let current = session;
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(current, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    current = result.session;
    events.push(...result.events);
  };
  const answer = (): void => {
    for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      const choice = current.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: defaultPick(current.state),
      });
    }
  };
  answer();
  for (const command of commands) {
    apply(command);
    answer();
  }
  return { session: current, events };
}

/** A session at p1's first turn against `villain`. */
function start(villain: VillainCard): GameSession {
  const result = createGame(
    {
      seed: 11,
      cards: CARDS,
      villainCardId: villain.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copies(DEFAULT_CARDS[6]!.id, 20),
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copies(e.card.id, 3)), WITNESS.id, WARD.id],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return drive(startSession(result.state), []).session;
}

/** Plays a copy of `card` (cost 0) from p1's hand, putting it there first. */
function play(session: GameSession, card: AnyCard) {
  const given = giveCard(session.state, p1, card.id);
  const moved: GameSession = { ...session, state: given.state };
  return drive(moved, [
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
}

/** State surgery: a support straight into p1's play area. */
function withSupport(session: GameSession, card: AnyCard): GameSession {
  const given = giveCard(session.state, p1, card.id, []);
  const state = given.state;
  const player = mustPlayer(state, p1);
  return {
    ...session,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === p1
          ? { ...p, hand: player.hand.filter((id) => id !== given.id), playArea: [...player.playArea, given.id] }
          : p,
      ),
      instances: { ...state.instances, [given.id]: { ...mustInstance(state, given.id), controllerId: p1 } },
    },
  };
}

const villainId = (state: GameState): InstanceId => activeVillain(state).instanceId;
const damageOf = (state: GameState): number => mustInstance(state, villainId(state)).damage;

// --- Tests ---------------------------------------------------------------------------------------------------------

describe("§3.1 infinite hit points and the flip", () => {
  it("an ∞ face has infinite remaining hit points and is never defeated by damage (RRG 1.8 'Hit Points', p. 22)", () => {
    let session = start(PLAIN);
    session = play(session, FLIP.card).session;
    expect(activeVillain(session.state).side).toBe("B");
    expect(characterProfile(session.state, villainId(session.state), deps)?.maxHp).toBe(Number.POSITIVE_INFINITY);
    session = play(session, HIT_50.card).session;
    // "Damage may still be dealt": it is taken and recorded, but the dial never reaches zero.
    expect(damageOf(session.state)).toBe(50);
    expect(remainingHitPoints(session.state, villainId(session.state), deps)).toBe(Number.POSITIVE_INFINITY);
    expect(session.state.outcome).toBeNull();
  });

  it("a flip into or out of an ∞ face sets the dial to the new face's hit points (MC21 p. 20)", () => {
    let session = start(PLAIN);
    session = play(session, HIT_3.card).session;
    expect(damageOf(session.state)).toBe(3);
    const into = play(session, FLIP.card);
    expect(damageOf(into.session.state)).toBe(0);
    expect(into.events).toContainEqual(
      expect.objectContaining({ type: "villainFlipped", to: "B", hitPointsReset: true }),
    );
    session = play(into.session, HIT_50.card).session;
    const out = play(session, FLIP.card);
    expect(activeVillain(out.session.state).side).toBe("A");
    expect(damageOf(out.session.state)).toBe(0);
    expect(remainingHitPoints(out.session.state, villainId(out.session.state), deps)).toBe(8);
    expect(out.events).toContainEqual(
      expect.objectContaining({ type: "villainFlipped", to: "A", hitPointsReset: true }),
    );
  });

  it("a flip between two finite faces still keeps the damage, and logs as before (Risky Business)", () => {
    let session = start(GOBLIN);
    session = play(session, HIT_3.card).session;
    const flipped = play(session, FLIP.card);
    expect(damageOf(flipped.session.state)).toBe(3);
    const logged = flipped.events.find((event) => event.type === "villainFlipped");
    expect(logged).toEqual({ type: "villainFlipped", instanceId: villainId(session.state), from: "A", to: "B" });
  });

  it("an ∞ face has no dial to set: `setRemainingHitPoints` leaves it alone", () => {
    let session = start(PLAIN);
    session = play(session, FLIP.card).session;
    const set = play(session, SET_DIAL.card);
    expect(damageOf(set.session.state)).toBe(0);
    expect(set.events.some((event) => event.type === "hitPointsSet")).toBe(false);
  });
});

describe("§3.1 a villain's defeat as an interruptible event", () => {
  it("with nothing listening, the stage falls inline exactly as before and the players win", () => {
    const { session, events } = play(start(PLAIN), HIT_8.card);
    expect(session.state.outcome).toMatchObject({ result: "win" });
    expect(events.some((event) => event.type === "villainFlipped")).toBe(false);
  });

  it("'When Collector would be defeated, … flip this card instead' replaces the defeat", () => {
    let session = start(COLLECTOR);
    const fell = play(session, HIT_8.card);
    session = fell.session;
    expect(session.state.outcome).toBeNull();
    expect(activeVillain(session.state).side).toBe("B");
    expect(activeVillain(session.state).defeated).toBe(false);
    expect(fell.events.some((event) => event.type === "characterDefeated")).toBe(false);
    // On the ∞ face, more damage does nothing to the villain's standing, and its own "cannot be defeated" holds.
    session = play(session, HIT_50.card).session;
    expect(session.state.outcome).toBeNull();
    // Flipped back, the dial is the front's hit points, and the interrupt is live again.
    session = play(session, FLIP.card).session;
    expect(remainingHitPoints(session.state, villainId(session.state), deps)).toBe(8);
    session = play(session, HIT_8.card).session;
    expect(activeVillain(session.state).side).toBe("B");
    expect(session.state.outcome).toBeNull();
  });

  it("'reset his hit points instead' (MaGog's shape) also replaces it, through the dial re-check", () => {
    const { session } = play(start(MAGOG), HIT_8.card);
    expect(session.state.outcome).toBeNull();
    expect(remainingHitPoints(session.state, villainId(session.state), deps)).toBe(5);
  });

  it("a listener that does not replace it lets it apply: the next stage is revealed", () => {
    const session = withSupport(start(TWO_STAGE), WITNESS);
    const after = play(session, HIT_8.card).session;
    const witness = mustPlayer(after.state, p1).playArea.find((id) => after.state.instances[id]?.cardId === WITNESS.id);
    expect(after.state.instances[witness!]?.counters["seen"]).toBe(1);
    expect(activeVillain(after.state).stageIndex).toBe(1);
    expect(damageOf(after.state)).toBe(0);
    expect(after.state.outcome).toBeNull();
  });

  it("replaying the Collector's replaced defeat reproduces the same state", () => {
    // Every card goes to hand before the session starts, so the log holds the whole game and nothing else.
    let state = start(COLLECTOR).state;
    const ids: InstanceId[] = [];
    for (const card of [HIT_8.card, HIT_50.card, FLIP.card]) {
      const given = giveCard(state, p1, card.id);
      state = given.state;
      ids.push(given.id);
    }
    const { session } = drive(
      startSession(state),
      ids.map((id) => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null })),
    );
    expect(activeVillain(session.state).side).toBe("A");
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.1 `RuleSpec cannotBeDefeated`", () => {
  it("a villain at zero remaining hit points is not defeated while the rule holds", () => {
    const { session } = play(start(UNDEFEATABLE), HIT_50.card);
    expect(session.state.outcome).toBeNull();
    expect(damageOf(session.state)).toBe(50);
    expect(activeVillain(session.state).defeated).toBe(false);
  });

  it("an identity is not eliminated while the rule holds", () => {
    const session = withSupport(start(PLAIN), WARD);
    const { session: after } = play(session, HURT_ME.card);
    expect(mustPlayer(after.state, p1).eliminated).toBe(false);
    expect(after.state.outcome).toBeNull();
  });
});
