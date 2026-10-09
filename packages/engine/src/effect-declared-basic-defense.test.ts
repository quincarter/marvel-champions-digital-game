/**
 * docs/phase7-wave8.md §4.1 Q55 (owner ruling, B): a character made the defender by a card ability is making a basic
 * defense, so `EffectSpec declareDefender` announces `basicPowerUsing` / `basicPowerUsed` for the defense power exactly
 * as the Declare Defender step does, once per defense, whether or not the character exhausts. Playing a
 * "(defense)"-labeled ability is not by itself a basic defense.
 *
 * Sources: RRG 1.8 "Defend, Defense" (p. 15): "When a card ability says to 'declare [a hero] the defender' of an
 * attack, that hero is considered to be making a basic defense." "A card ability that allows a hero to be declared as
 * a defender without exhausting can be used on an exhausted hero." (p. 16): "Resolving a defense-labeled ability is
 * not a basic defense and does not cause a hero to reduce the amount of damage dealt by that hero's DEF. That hero can
 * still be declared the defender of the attack during the 'Declare Defender' step or by another card ability."
 *
 * Synthetic cards. The stub hero has DEF 2; the villain attacks for 3 (ATK 2 and a 1-icon boost card).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;
const self = { kind: "self" } as const;
const whenAttacked = { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true } as const;
const count = (counterType: string) => ({ kind: "addCounters", target: self, counterType, amount: n(1) }) as const;
const support = (id: string, ...abilities: readonly ReturnType<typeof stubAbility>[]) =>
  stubSupport({ id, cost: 0, abilities: abilities.map((ability) => ability.ref) });

/** "When you make a basic defense" / "After you make a basic defense": one counter each time, per timing. */
const HEAR_USING = stubAbility(
  "listener.using",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "basicPowerUsing", playerIs: "controller", eventIs: { power: "defense" } },
    },
    effects: [count("using")],
  }),
);
const HEAR_USED = stubAbility(
  "listener.used",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "basicPowerUsed", playerIs: "controller", eventIs: { power: "defense" } },
    },
    effects: [count("used")],
  }),
);
const LISTENER = support("listener", HEAR_USING, HEAR_USED);
/** "When you use a basic power, get +4 to that power for this use." */
const BRACE_ABILITY = stubAbility(
  "brace.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
    effects: [{ kind: "modifyBasicPower", amount: n(4) }],
  }),
);
const BRACE = support("brace", BRACE_ABILITY);

/** Bamf!'s shape: "When an enemy attacks you, declare your hero the defender without exhausting them." */
const DECLARE_ABILITY = stubAbility(
  "declare.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: whenAttacked },
    effects: [{ kind: "declareDefender", character: yourIdentity }],
  }),
);
const DECLARE = support("declare", DECLARE_ABILITY);
/** "When an enemy attacks you, exhaust your hero and declare them the defender." */
const DECLARE_EXHAUST_ABILITY = stubAbility(
  "declare-exhaust.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: whenAttacked },
    effects: [{ kind: "declareDefender", character: yourIdentity, exhaust: true }],
  }),
);
const DECLARE_EXHAUST = support("declare-exhaust", DECLARE_EXHAUST_ABILITY);
/** The same declaration twice in one ability. */
const DECLARE_TWICE_ABILITY = stubAbility(
  "declare-twice.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: whenAttacked },
    effects: [
      { kind: "declareDefender", character: yourIdentity },
      { kind: "declareDefender", character: yourIdentity },
    ],
  }),
);
const DECLARE_TWICE = support("declare-twice", DECLARE_TWICE_ABILITY);
/** Shieldmaiden's shape: "Interrupt (defense): When an enemy attacks you, declare your hero the defender." */
const LABELED_DECLARE_ABILITY = stubAbility(
  "labeled-declare.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: whenAttacked },
    label: ["defense"],
    effects: [{ kind: "declareDefender", character: yourIdentity }],
  }),
);
const LABELED_DECLARE = support("labeled-declare", LABELED_DECLARE_ABILITY);
/** A "(defense)" ability that declares nobody: "Interrupt (defense): When an enemy attacks you, …". */
const LABEL_ONLY_ABILITY = stubAbility(
  "label-only.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: whenAttacked },
    label: ["defense"],
    effects: [count("played")],
  }),
);
const LABEL_ONLY = support("label-only", LABEL_ONLY_ABILITY);
/** Declared once the attack's procedure is running: "When a boost card is turned faceup, declare your hero the defender." */
const LATE_ABILITY = stubAbility(
  "late.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "boostCardTurnedFaceup", activation: "attack" } },
    effects: [{ kind: "declareDefender", character: yourIdentity }],
  }),
);
const LATE = support("late", LATE_ABILITY);
/** Colossus's shape: "When an enemy attacks you, declare this ally the defender without exhausting it." */
const GUARD_ABILITY = stubAbility(
  "sentry.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: whenAttacked },
    effects: [
      { kind: "declareDefender", character: self },
      { kind: "declareDefender", character: self },
    ],
  }),
);
const SENTRY = stubAlly({ id: "sentry", cost: 0, atk: 1, thw: 1, hp: 9, abilities: [GUARD_ABILITY.ref] });

const CARDS = [LISTENER, BRACE, DECLARE, DECLARE_EXHAUST, DECLARE_TWICE, LABELED_DECLARE, LABEL_ONLY, LATE, SENTRY];
const deps = depsOf(
  HEAR_USING,
  HEAR_USED,
  BRACE_ABILITY,
  DECLARE_ABILITY,
  DECLARE_EXHAUST_ABILITY,
  DECLARE_TWICE_ABILITY,
  LABELED_DECLARE_ABILITY,
  LABEL_ONLY_ABILITY,
  LATE_ABILITY,
  GUARD_ABILITY,
);

interface Options {
  /** The hero is exhausted before the villain attacks. */
  readonly exhausted?: boolean;
  /** At the Declare Defender step: the hero defends, or nobody does (the default). */
  readonly atStep?: "hero";
}
/** The villain phase's attack on P1 (hero form) with `cards` in play. */
function villainAttack(cards: readonly { readonly id: (typeof LISTENER)["id"] }[], options: Options = {}) {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.map((card) => card.id) });
  for (const card of [LISTENER, ...cards]) state = playerCardIntoPlay(state, card.id).state;
  const hero = mustPlayer(state, P1).identity.instanceId;
  state = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 },
    })),
    instances: {
      ...state.instances,
      [hero]: { ...mustInstance(state, hero), exhausted: options.exhausted === true },
    },
  };
  const asked: string[] = [];
  const pick = (current: GameState): readonly string[] => {
    if (current.pendingChoice?.prompt.kind !== "declareDefender") return defaultPick(current);
    asked.push("declareDefender");
    return options.atStep === "hero" ? [hero] : ["decline"];
  };
  const driven = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  const after = driven.session.state;
  const inPlay = (id: string) =>
    mustPlayer(after, P1).playArea.find((instance) => mustInstance(after, instance).cardId === id)!;
  return {
    state: after,
    events: driven.events,
    hero,
    asked,
    heard: mustInstance(after, inPlay(LISTENER.id)).counters,
    heroDamage: mustInstance(after, hero).damage,
    heroExhausted: mustInstance(after, hero).exhausted,
    inPlay,
  };
}
/** Each basic defense the log announced, as `<kind> <stat>`, once per logged phase. */
const basicDefenses = (events: readonly GameEvent[], phase: "initiated" | "resolved") =>
  events.flatMap((event) =>
    event.type === "triggerEvent" &&
    event.phase === phase &&
    (event.event.kind === "basicPowerUsing" || event.event.kind === "basicPowerUsed") &&
    event.event.power === "defense"
      ? [`${event.event.kind} ${event.event.stat}`]
      : [],
  );

describe("a hero declared the defender by a card ability is making a basic defense (§4.1 Q55)", () => {
  it("'declare your hero the defender without exhausting them': both basic-defense events, once; DEF 2 off the 3; not exhausted", () => {
    const run = villainAttack([DECLARE]);
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(basicDefenses(run.events, "resolved").sort()).toEqual(["basicPowerUsed def", "basicPowerUsing def"]);
    expect(run.heroDamage).toBe(1);
    expect(run.heroExhausted).toBe(false);
    // The attack has its defender: nobody is asked at the Declare Defender step.
    expect(run.asked).toEqual([]);
  });

  it("an exhausted hero can be declared that way, and is still making a basic defense", () => {
    const run = villainAttack([DECLARE], { exhausted: true });
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroDamage).toBe(1);
  });

  it("'exhaust your hero and declare them the defender': the hero exhausts and makes one basic defense", () => {
    const run = villainAttack([DECLARE_EXHAUST]);
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroExhausted).toBe(true);
    expect(run.heroDamage).toBe(1);
  });

  it("'+4 to that power for this use' answers it: DEF 2 + 4 stops the 3", () => {
    const run = villainAttack([DECLARE, BRACE]);
    expect(run.heroDamage).toBe(0);
    expect(run.state.lastingEffects).toHaveLength(0);
  });

  it("declared while the attack's procedure runs (after a declined Declare Defender step): once, and DEF counts", () => {
    const run = villainAttack([LATE]);
    expect(run.asked).toEqual(["declareDefender"]);
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroDamage).toBe(1);
  });

  it("a '(defense)' ability that declares its own hero the defender (one defense): once", () => {
    const run = villainAttack([LABELED_DECLARE]);
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroDamage).toBe(1);
    expect(run.asked).toEqual([]);
  });
});

describe("one basic defense is announced once", () => {
  it("the Declare Defender step's own basic defense, with no ability: once, as before", () => {
    const run = villainAttack([], { atStep: "hero" });
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroDamage).toBe(1);
    expect(run.heroExhausted).toBe(true);
  });

  it("the same ability declaring the hero twice: once", () => {
    const run = villainAttack([DECLARE_TWICE]);
    expect(run.heard).toEqual({ using: 1, used: 1 });
  });

  it("two abilities declaring the hero: once", () => {
    const run = villainAttack([DECLARE, DECLARE_EXHAUST]);
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroDamage).toBe(1);
  });

  it("a hero who defended at the step and is then declared the defender by an ability: once", () => {
    const run = villainAttack([LATE], { atStep: "hero" });
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroDamage).toBe(1);
  });

  it("declared by an ability as the attack is initiated and again while its procedure runs: once", () => {
    const run = villainAttack([DECLARE, LATE]);
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.asked).toEqual([]);
  });
});

describe("what is not a basic defense", () => {
  it("playing a '(defense)'-labeled ability: the hero defends, DEF does not count and no basic defense is announced", () => {
    const run = villainAttack([LABEL_ONLY]);
    expect(mustInstance(run.state, run.inPlay(LABEL_ONLY.id)).counters).toEqual({ played: 1 });
    expect(run.heard).toEqual({});
    expect(basicDefenses(run.events, "resolved")).toEqual([]);
    expect(run.heroDamage).toBe(3);
  });

  it("that hero then declared at the Declare Defender step makes the basic defense there: once", () => {
    const run = villainAttack([LABEL_ONLY], { atStep: "hero" });
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(run.heroDamage).toBe(1);
  });

  it("an undefended attack announces none", () => {
    const run = villainAttack([]);
    expect(run.heard).toEqual({});
    expect(run.heroDamage).toBe(3);
  });
});

describe("an ally declared the defender by a card ability", () => {
  it("'declare this ally the defender without exhausting it' announces its defense as the step's declaration of an ally does, once", () => {
    const run = villainAttack([SENTRY]);
    const sentry = run.inPlay(SENTRY.id);
    expect(run.heard).toEqual({ using: 1, used: 1 });
    expect(mustInstance(run.state, sentry).damage).toBe(3);
    expect(mustInstance(run.state, sentry).exhausted).toBe(false);
    expect(run.heroDamage).toBe(0);
  });
});
