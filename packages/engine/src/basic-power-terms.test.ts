/**
 * docs/phase7-wave11-hero-packs.md §H3.14 (HT9): `EffectSpec basicPowerBy` with `BasicPowerTerms`. "Hero Action:
 * Discard this card → make a basic thwart without exhausting (even if you are exhausted). For this thwart, your hero
 * gets +1 THW and ignores the patrol keyword and any crisis icons ([crisis]) in play." (Grapnel Launcher, `jj` 61023.)
 *
 * Sources: RRG 1.8 "Basic Power" (p. 10); "Thwart" (p. 44); "Crisis Icon" (p. 14); "Patrol" (p. 32); "Ignore"
 * (p. 23); "Confuse, Confused" (p. 13: "Costs associated with the thwart attempt, including exhausting the character,
 * must still be paid" — here there is no exhausting to pay, but the status card still replaces the thwart).
 *
 * Synthetic cards, one seat. The stub hero has THW 2. Controls: the same effect without its terms (the ordinary
 * instructed thwart) keeps every check this one waives.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { evaluate } from "./select.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { BasicPowerTerms, EffectSpec, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubResource, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const GRAPNEL_TERMS: BasicPowerTerms = {
  character: "identity",
  withoutExhausting: true,
  ignores: ["patrol", "crisis"],
};
const thwartBy = (terms?: BasicPowerTerms): EffectSpec => ({
  kind: "basicPowerBy",
  player: { kind: "controller" },
  powers: ["thwart"],
  bonus: { thw: 1 },
  ...(terms ? { terms } : {}),
});

/** Grapnel Launcher's effect, its discard cost left out. */
const GRAPNEL = stubAbility("grapnel.action", def({ trigger: { kind: "action" }, effects: [thwartBy(GRAPNEL_TERMS)] }));
/** Control: the same thwart with no terms. */
const PLAIN = stubAbility("plain.action", def({ trigger: { kind: "action" }, effects: [thwartBy()] }));

/** "As an additional cost to thwart the main scheme, you must spend a [energy] resource." */
const TOLL = stubAbility(
  "toll.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "additionalThwartCost", scheme: { categories: ["mainScheme"] }, resources: { energy: 1 } }],
    },
    effects: [],
  }),
);

const TOLLBOOTH = stubSupport({ id: "tollbooth", cost: 0, abilities: [TOLL.ref] });
const SPARK = stubResource({ id: "spark", icons: 0, produces: { energy: 1 } });
const LAUNCHER = stubSupport({ id: "launcher", cost: 0, abilities: [GRAPNEL.ref] });
const ORDINARY = stubSupport({ id: "ordinary", cost: 0, abilities: [PLAIN.ref] });
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, icons: ["crisis"] });
const LOOKOUT = stubMinion({ id: "lookout", atk: 1, sch: 1, hp: 5, keywords: [{ name: "patrol" }] });

const deps: EngineDeps = depsOf(GRAPNEL, PLAIN, TOLL);

interface Setup {
  readonly state: GameState;
  readonly launcher: InstanceId;
  readonly ordinary: InstanceId;
  readonly hero: InstanceId;
  readonly ally: InstanceId;
  readonly main: InstanceId;
  readonly crisis: InstanceId;
}

const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});

/** Hero form, the hero exhausted, a ready ally, 5 threat on the main scheme and a crisis side scheme in play. */
function setup(): Setup {
  const base = gameAtFirstTurn({
    cards: [LAUNCHER, ORDINARY, CRISIS, LOOKOUT, TOLLBOOTH, SPARK],
    deps,
    deck: [LAUNCHER.id, ORDINARY.id, TOLLBOOTH.id, SPARK.id],
    encounter: [CRISIS.id, LOOKOUT.id, ...copiesOf(TREACHERY.id, 26)],
  });
  const launcher = playerCardIntoPlay(base, LAUNCHER.id);
  const ordinary = playerCardIntoPlay(launcher.state, ORDINARY.id);
  const ally = playerCardIntoPlay(ordinary.state, ALLY.id);
  const crisis = encounterCardInVillainArea(ally.state, CRISIS.id, 3);
  const heroForm: GameState = {
    ...crisis.state,
    players: crisis.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const hero = mustPlayer(heroForm, P1).identity.instanceId;
  const main = heroForm.mainScheme.instanceId;
  return {
    state: patch(patch(heroForm, main, { threat: 5 }), hero, { exhausted: true }),
    launcher: launcher.id,
    ordinary: ordinary.id,
    hero,
    ally: ally.id,
    main,
    crisis: crisis.id,
  };
}

const use = (card: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

function run(state: GameState, target: InstanceId | null, ...commands: readonly Command[]) {
  const seen: NonNullable<GameState["pendingChoice"]>[] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    seen.push(choice);
    if (choice.prompt.kind === "chooseBasicPowerTarget" && target) return [target];
    if (choice.prompt.kind === "spendResources") return choice.options.map((o) => o.optionId);
    return defaultPick(s);
  };
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  return { state: session.state, events, seen };
}
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const optionsOf = (seen: readonly NonNullable<GameState["pendingChoice"]>[], kind: string) =>
  seen.find((choice) => choice.prompt.kind === kind)?.options.map((o) => o.optionId);

describe("basicPowerBy terms — 'your hero', 'without exhausting', 'ignores patrol and crisis' (§H3.14)", () => {
  it("exhausted, THW 2, crisis in play: 3 threat comes off the main scheme and the hero stays exhausted", () => {
    const s = setup();
    const { state, events, seen } = run(s.state, s.main, use(s.launcher, GRAPNEL.ref.id));
    // "Your hero": the ready ally is not offered; the exhausted hero is.
    expect(optionsOf(seen, "chooseBasicPower")).toEqual([`thwart:${s.hero}`]);
    // The crisis icon does not keep the main scheme out of the targets.
    expect(optionsOf(seen, "chooseBasicPowerTarget")).toEqual([s.main, s.crisis]);
    expect(mustInstance(state, s.main).threat).toBe(2);
    expect(mustInstance(state, s.hero).exhausted).toBe(true);
    expect(of(events, "basicPowerInstructed")[0]).toMatchObject({
      withoutExhausting: true,
      ignores: ["patrol", "crisis"],
    });
  });

  it("a ready hero stays ready", () => {
    const s = setup();
    const ready = patch(s.state, s.hero, { exhausted: false });
    const { state } = run(ready, s.main, use(s.launcher, GRAPNEL.ref.id));
    expect(mustInstance(state, s.main).threat).toBe(2);
    expect(mustInstance(state, s.hero).exhausted).toBe(false);
  });

  it("a patrol minion engaged with the player does not stop it either", () => {
    const s = setup();
    const patrolled = minionEngagedWith(s.state, LOOKOUT.id);
    const { state, seen } = run(patrolled.state, s.main, use(s.launcher, GRAPNEL.ref.id));
    expect(optionsOf(seen, "chooseBasicPowerTarget")).toEqual([s.main, s.crisis]);
    expect(mustInstance(state, s.main).threat).toBe(2);
  });

  it("control: without the terms, the exhausted hero is no candidate and the ready ally's thwart cannot reach the main scheme", () => {
    const s = setup();
    const { state, seen } = run(s.state, s.crisis, use(s.ordinary, PLAIN.ref.id));
    expect(optionsOf(seen, "chooseBasicPower")).toEqual([`thwart:${s.ally}`]);
    expect(optionsOf(seen, "chooseBasicPowerTarget")).toEqual([s.crisis]);
    expect(mustInstance(state, s.main).threat).toBe(5);
    expect(mustInstance(state, s.ally).exhausted).toBe(true);
  });

  it("control: the waiver was for that thwart only; the hero's own thwart afterwards is blocked by the crisis icon", () => {
    const s = setup();
    const after = patch(run(s.state, s.main, use(s.launcher, GRAPNEL.ref.id)).state, s.hero, { exhausted: false });
    const result = applyCommand(
      after,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: s.hero, schemeInstanceId: s.main },
      deps,
    );
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.message).toBe("a crisis icon blocks thwarting the main scheme");
  });

  it("a confused ready hero loses the status card instead, removing nothing, and does not exhaust (RRG p. 13)", () => {
    const s = setup();
    const hero = mustInstance(s.state, s.hero);
    const confused = patch(s.state, s.hero, { statuses: { ...hero.statuses, confused: 1 }, exhausted: false });
    const { state } = run(confused, s.main, use(s.launcher, GRAPNEL.ref.id));
    expect(mustInstance(state, s.hero).statuses.confused).toBe(0);
    expect(mustInstance(state, s.main).threat).toBe(5);
    expect(mustInstance(state, s.hero).exhausted).toBe(false);
  });

  it("an additional cost to thwart the main scheme is paid first; the thwart keeps its terms (crisis, exhausted)", () => {
    const s = setup();
    const tolled = playerCardIntoPlay(s.state, TOLLBOOTH.id).state;
    const funded = giveCard(tolled, P1, SPARK.id);
    const { state, events } = run(funded.state, s.main, use(s.launcher, GRAPNEL.ref.id));
    // The askBasicThwartCost → settleBasicThwartCost path.
    expect(of(events, "thwartCostAsked")).toHaveLength(1);
    expect(of(events, "thwartCostSettled").map((e) => e.outcome)).toEqual(["paid"]);
    expect(mustPlayer(state, P1).hand).not.toContain(funded.id);
    expect(mustInstance(state, s.main).threat).toBe(2);
    expect(mustInstance(state, s.hero).exhausted).toBe(true);
  });

  it("canUseBasicPower with the same terms holds for the exhausted hero; without them it does not", () => {
    const s = setup();
    const alone = patch(s.state, s.ally, { exhausted: true });
    const can = (terms?: BasicPowerTerms): Predicate => ({
      kind: "canUseBasicPower",
      player: { kind: "controller" },
      powers: ["thwart"],
      ...(terms ? { terms } : {}),
    });
    const context = { selfInstanceId: s.launcher, controllerId: P1, event: null, bindings: {}, deps };
    expect(evaluate(alone, can(GRAPNEL_TERMS), context)).toBe(true);
    expect(evaluate(alone, can(), context)).toBe(false);
  });
});
