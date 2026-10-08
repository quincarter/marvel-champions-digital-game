/**
 * docs/phase7-wave8.md §4.1 Q54 (owner ruling, B): a basic power reports the stat actually powering it. The
 * `basicPowerUsing` / `basicPowerUsed` events carry `stat`, `Predicate basicPowerStatIs` and `eventIs: { stat }` read
 * it, and `modifyBasicPower` adds to it, so nothing infers the stat from whether the power is called an attack or a
 * thwart.
 *
 * Sources: RRG 1.8 "Assault" (p. 8): "When a character makes a basic thwart against a scheme with the assault keyword,
 * that character uses its ATK instead of its THW. … Abilities that increase a character's 'basic power' can be used to
 * increase that character's ATK when that character thwarts a scheme with assault." RRG 1.8 "Basic Power" (p. 10).
 *
 * Synthetic cards. The stub hero has THW 2, ATK 2 (3 with "+1 ATK"), DEF 2, REC 3; the stub ally THW 1, ATK 2; the
 * villain attacks for 3 (ATK 2 and a 1-icon boost card). Every scheme starts the test at 10 threat.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, StatName } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { ALLY } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;
const STATS: readonly StatName[] = ["thw", "atk", "def", "rec"];
/** One counter named `<prefix>-<stat>` on this card for the stat in use. */
const tally = (prefix: string): EffectSpec[] =>
  STATS.map((stat) => ({
    kind: "if",
    condition: { kind: "basicPowerStatIs", stat },
    then: [{ kind: "addCounters", target: { kind: "self" }, counterType: `${prefix}-${stat}`, amount: n(1) }],
  }));

/** Hears every basic power its controller's characters use, at both timings, and tallies the stat it was told. */
const HEAR_USING = stubAbility(
  "recorder.using",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
    effects: tally("using"),
  }),
);
const HEAR_USED = stubAbility(
  "recorder.used",
  def({
    trigger: { kind: "response", forced: true, on: { on: "basicPowerUsed", playerIs: "controller" } },
    effects: tally("used"),
  }),
);
const RECORDER = stubSupport({ id: "recorder", cost: 0, abilities: [HEAR_USING.ref, HEAR_USED.ref] });

/** "When you use a basic power, get +3 to that power for this use." */
const SURGE_ABILITY = stubAbility(
  "that-power.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
    effects: [{ kind: "modifyBasicPower", amount: n(3) }],
  }),
);
const THAT_POWER = stubSupport({ id: "that-power", cost: 0, abilities: [SURGE_ABILITY.ref] });
/** "When your hero makes a basic thwart, it gets +3 THW for that thwart": the card prints the stat. */
const NAMED_ABILITY = stubAbility(
  "named-thw.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "basicPowerUsing", playerIs: "controller", eventIs: { power: "thwart" } },
    },
    effects: [{ kind: "modifyBasicPower", amount: n(3), stat: "thw" }],
  }),
);
const NAMED_THW = stubSupport({ id: "named-thw", cost: 0, abilities: [NAMED_ABILITY.ref] });
/** "When an ally you control thwarts or attacks, add your identity's matching power to its power for this use." */
const MATCHING_ABILITY = stubAbility(
  "matching-stat.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: {
        on: "basicPowerUsing",
        targetIs: { categories: ["ally"], controller: "you" },
        eventIs: { power: ["thwart", "attack"] },
      },
    },
    effects: [
      {
        kind: "if",
        condition: { kind: "basicPowerStatIs", stat: "atk" },
        then: [{ kind: "modifyBasicPower", amount: { kind: "stat", of: yourIdentity, stat: "atk" } }],
        otherwise: [{ kind: "modifyBasicPower", amount: { kind: "stat", of: yourIdentity, stat: "thw" } }],
      },
    ],
  }),
);
const MATCHING = stubSupport({ id: "matching-stat", cost: 0, abilities: [MATCHING_ABILITY.ref] });
/** "When you use a basic power powered by ATK, …": a trigger narrowed by the stat. */
const ATK_ONLY_ABILITY = stubAbility(
  "atk-only.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "basicPowerUsing", playerIs: "controller", eventIs: { stat: "atk" } },
    },
    effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "heard", amount: n(1) }],
  }),
);
const ATK_ONLY = stubSupport({ id: "atk-only", cost: 0, abilities: [ATK_ONLY_ABILITY.ref] });
/** "Your identity gets +1 ATK", so its THW (2) and ATK (3) differ. */
const ATK_UP_ABILITY = stubAbility(
  "stat-atk-up.constant",
  def({
    trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 1, target: { categories: ["identity"] } }] },
    effects: [],
  }),
);
const ATK_UP = stubSupport({ id: "stat-atk-up", cost: 0, abilities: [ATK_UP_ABILITY.ref] });
/** "When a character thwarts this side scheme, they may use their ATK instead of their THW." */
const MAY_USE_ATK_ABILITY = stubAbility(
  "optional.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "thwartWithAtk", scheme: { self: true } }] },
    effects: [],
  }),
);
/** "When a character makes a basic attack, that character uses their THW instead of their ATK." */
const USE_THW_ABILITY = stubAbility(
  "befuddled.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
    effects: [{ kind: "modifyBasicPower", useStat: "thw" }],
  }),
);
const USE_THW = stubSupport({ id: "befuddled", cost: 0, abilities: [USE_THW_ABILITY.ref] });
/** "When you make a basic defense, use your ATK instead of your DEF for this attack." */
const DEFEND_WITH_ATK_ABILITY = stubAbility(
  "best-defense.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "basicPowerUsing", playerIs: "controller", eventIs: { power: "defense" } },
    },
    effects: [{ kind: "modifyAttack", defenseUsesAtk: true }],
  }),
);
const DEFEND_WITH_ATK = stubSupport({ id: "best-defense", cost: 0, abilities: [DEFEND_WITH_ATK_ABILITY.ref] });

const FRONT = stubSideScheme({ id: "front", startingThreat: 10, keywords: [{ name: "assault" }] });
const OPTIONAL = stubSideScheme({ id: "optional", startingThreat: 10, abilities: [MAY_USE_ATK_ABILITY.ref] });

const SUPPORTS = [RECORDER, THAT_POWER, NAMED_THW, MATCHING, ATK_ONLY, ATK_UP, USE_THW, DEFEND_WITH_ATK];
const deps = depsOf(
  HEAR_USING,
  HEAR_USED,
  SURGE_ABILITY,
  NAMED_ABILITY,
  MATCHING_ABILITY,
  ATK_ONLY_ABILITY,
  ATK_UP_ABILITY,
  MAY_USE_ATK_ABILITY,
  USE_THW_ABILITY,
  DEFEND_WITH_ATK_ABILITY,
);
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const patch = (state: GameState, id: InstanceId, change: { threat?: number; damage?: number }): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});

interface Ran {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/** The commands through a session, the log replayed to the same state. */
function run(state: GameState, commands: readonly Command[], pick?: (state: GameState) => readonly string[]): Ran {
  const driven = driveSession(startSession(state), deps, commands, pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
interface Table {
  readonly state: GameState;
  readonly front: InstanceId;
  readonly optional: InstanceId;
}
/** P1's first turn in hero form (alter-ego if asked), the cards in play, both side schemes out, 10 threat on each scheme. */
function start(cards: readonly { readonly id: (typeof RECORDER)["id"] }[], alterEgo = false): Table {
  let state = gameAtFirstTurn({
    cards: [...SUPPORTS, FRONT, OPTIONAL],
    deps,
    deck: SUPPORTS.map((card) => card.id),
    encounter: [FRONT.id, OPTIONAL.id, ...Array.from({ length: 28 }, () => "treachery" as (typeof FRONT)["id"])],
  });
  for (const card of cards) state = playerCardIntoPlay(state, card.id).state;
  if (!alterEgo) state = run(state, [{ type: "changeForm", playerId: P1 }]).state;
  const front = encounterCardInVillainArea(state, FRONT.id, 10);
  const optional = encounterCardInVillainArea(front.state, OPTIONAL.id, 10);
  return {
    state: patch(optional.state, optional.state.mainScheme.instanceId, { threat: 10 }),
    front: front.id,
    optional: optional.id,
  };
}
const thwart = (state: GameState, scheme: InstanceId, by = identityOf(state), useAtk = false): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: by,
  schemeInstanceId: scheme,
  ...(useAtk ? { useAtk: true } : {}),
});
const attack = (state: GameState, by: InstanceId = identityOf(state)): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: by,
  targetInstanceId: state.activeVillainId!,
});
const threat = (state: GameState, id: InstanceId) => mustInstance(state, id).threat;
const villainDamage = (state: GameState) => mustInstance(state, state.activeVillainId!).damage;
const inPlay = (state: GameState, card: { readonly id: string }) =>
  mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === card.id)!;
const tallies = (state: GameState) => mustInstance(state, inPlay(state, RECORDER)).counters;
/** Each basic power the log announced, as `<kind> <power> <stat>`, once each whatever phases were logged, sorted. */
const announced = (events: readonly GameEvent[]): string[] =>
  [
    ...new Set(
      events.flatMap((event) =>
        event.type === "triggerEvent" &&
        (event.event.kind === "basicPowerUsing" || event.event.kind === "basicPowerUsed")
          ? [`${event.event.kind} ${event.event.power} ${event.event.stat}`]
          : [],
      ),
    ),
  ].sort();
/** Ends the turn and defends the villain's attack with the hero. */
const defend = (state: GameState): Ran => {
  const hero = identityOf(state);
  return run(state, [{ type: "endTurn", playerId: P1 }], (s) =>
    s.pendingChoice?.prompt.kind === "declareDefender"
      ? [hero]
      : (s.pendingChoice?.options.slice(0, s.pendingChoice.minSelections).map((o) => o.optionId) ?? []),
  );
};

describe("a basic power reports the stat powering it (§4.1 Q54)", () => {
  it("an ordinary basic thwart reports THW, at both timings and in the log", () => {
    const t = start([RECORDER]);
    const r = run(t.state, [thwart(t.state, t.state.mainScheme.instanceId)]);
    expect(tallies(r.state)).toEqual({ "using-thw": 1, "used-thw": 1 });
    expect(announced(r.events)).toEqual(["basicPowerUsed thwart thw", "basicPowerUsing thwart thw"]);
  });

  it("a basic thwart against a scheme with assault reports ATK: still the thwart power, powered by ATK", () => {
    const t = start([RECORDER, ATK_UP]);
    const r = run(t.state, [thwart(t.state, t.front)]);
    expect(threat(r.state, t.front)).toBe(7);
    expect(tallies(r.state)).toEqual({ "using-atk": 1, "used-atk": 1 });
    expect(announced(r.events)).toEqual(["basicPowerUsed thwart atk", "basicPowerUsing thwart atk"]);
  });

  it("'may use their ATK instead of their THW': ATK when the player chooses it, THW when they do not", () => {
    const t = start([RECORDER, ATK_UP]);
    const withAtk = run(t.state, [thwart(t.state, t.optional, identityOf(t.state), true)]);
    expect(threat(withAtk.state, t.optional)).toBe(7);
    expect(tallies(withAtk.state)).toEqual({ "using-atk": 1, "used-atk": 1 });
    const withThw = run(t.state, [thwart(t.state, t.optional)]);
    expect(threat(withThw.state, t.optional)).toBe(8);
    expect(tallies(withThw.state)).toEqual({ "using-thw": 1, "used-thw": 1 });
  });

  it("a basic attack reports ATK", () => {
    const t = start([RECORDER]);
    const r = run(t.state, [attack(t.state)]);
    expect(tallies(r.state)).toEqual({ "using-atk": 1, "used-atk": 1 });
    expect(announced(r.events)).toEqual(["basicPowerUsed attack atk", "basicPowerUsing attack atk"]);
  });

  it("a basic defense reports DEF", () => {
    const t = start([RECORDER]);
    const r = defend(t.state);
    expect(tallies(r.state)).toEqual({ "using-def": 1, "used-def": 1 });
    expect(announced(r.events)).toEqual(["basicPowerUsed defense def", "basicPowerUsing defense def"]);
  });

  it("a basic recovery reports REC", () => {
    const t = start([RECORDER], true);
    const hurt = patch(t.state, identityOf(t.state), { damage: 8 });
    const r = run(hurt, [{ type: "basicRecover", playerId: P1 }]);
    expect(tallies(r.state)).toEqual({ "using-rec": 1, "used-rec": 1 });
  });

  it("an ally's basic thwart against assault reports ATK too", () => {
    const t = start([RECORDER, ALLY]);
    const r = run(t.state, [thwart(t.state, t.front, inPlay(t.state, ALLY))]);
    expect(threat(r.state, t.front)).toBe(8);
    expect(tallies(r.state)).toEqual({ "using-atk": 1, "used-atk": 1 });
  });
});

describe("a substitution made during the use is reported from then on", () => {
  it("'uses their THW instead of their ATK' on a basic attack: the attack deals THW 2 and is reported used with THW", () => {
    const t = start([RECORDER, ATK_UP, USE_THW]);
    const r = run(t.state, [attack(t.state)]);
    expect(villainDamage(r.state)).toBe(2);
    // The substitution interrupts the attack itself, after the "using" window: that window read ATK.
    expect(tallies(r.state)).toEqual({ "using-atk": 1, "used-thw": 1 });
  });

  it("'use your ATK instead of your DEF' on a basic defense: ATK 3 stops the villain's 3, reported used with ATK", () => {
    const t = start([RECORDER, ATK_UP, DEFEND_WITH_ATK]);
    const r = defend(t.state);
    expect(mustInstance(r.state, identityOf(r.state)).damage).toBe(0);
    expect(tallies(r.state)["used-atk"]).toBe(1);
    expect(tallies(r.state)["used-def"] ?? 0).toBe(0);
  });
});

describe("what reads the stat in use", () => {
  it("'+3 to that power': an assault thwart gets it on ATK (3 + 3 = 6 removed), an ordinary thwart on THW (2 + 3)", () => {
    const t = start([THAT_POWER, ATK_UP]);
    expect(threat(run(t.state, [thwart(t.state, t.front)]).state, t.front)).toBe(4);
    const main = t.state.mainScheme.instanceId;
    expect(threat(run(t.state, [thwart(t.state, main)]).state, main)).toBe(5);
  });

  it("'+3 to that power' ends with the use: no lasting effect is left after the assault thwart", () => {
    const t = start([THAT_POWER, ATK_UP]);
    expect(run(t.state, [thwart(t.state, t.front)]).state.lastingEffects).toHaveLength(0);
  });

  it("'+3 THW for that thwart' names its stat: nothing against assault (ATK 3 removed), 2 + 3 otherwise", () => {
    const t = start([NAMED_THW, ATK_UP]);
    expect(threat(run(t.state, [thwart(t.state, t.front)]).state, t.front)).toBe(7);
    const main = t.state.mainScheme.instanceId;
    expect(threat(run(t.state, [thwart(t.state, main)]).state, main)).toBe(5);
  });

  it("'matching power': an ally's assault thwart adds the hero's ATK 3 (2 + 3), its ordinary thwart the hero's THW 2 (1 + 2)", () => {
    const t = start([MATCHING, ATK_UP, ALLY]);
    const ally = inPlay(t.state, ALLY);
    expect(threat(run(t.state, [thwart(t.state, t.front, ally)]).state, t.front)).toBe(5);
    const main = t.state.mainScheme.instanceId;
    expect(threat(run(t.state, [thwart(t.state, main, ally)]).state, main)).toBe(7);
    expect(villainDamage(run(t.state, [attack(t.state, ally)]).state)).toBe(5);
  });

  it("a trigger narrowed to the ATK stat hears an attack and an assault thwart, not an ordinary thwart", () => {
    const t = start([ATK_ONLY]);
    const heard = (state: GameState) => mustInstance(state, inPlay(state, ATK_ONLY)).counters.heard ?? 0;
    expect(heard(run(t.state, [attack(t.state)]).state)).toBe(1);
    expect(heard(run(t.state, [thwart(t.state, t.front)]).state)).toBe(1);
    expect(heard(run(t.state, [thwart(t.state, t.state.mainScheme.instanceId)]).state)).toBe(0);
  });

  it("is false when no basic power is being used", () => {
    const probe = stubAbility("stat-probe.action", def({ trigger: { kind: "action" }, effects: tally("now") }));
    const card = stubSupport({ id: "stat-probe", cost: 0, abilities: [probe.ref] });
    const probeDeps = depsOf(probe);
    const base = gameAtFirstTurn({ cards: [card], deps: probeDeps, deck: [card.id] });
    const { state, id } = playerCardIntoPlay(base, card.id);
    const after = driveSession(startSession(state), probeDeps, [
      { type: "useAbility", playerId: P1, cardInstanceId: id, abilityId: probe.ref.id, payment: [] },
    ]).session.state;
    expect(mustInstance(after, id).counters).toEqual({});
  });
});
