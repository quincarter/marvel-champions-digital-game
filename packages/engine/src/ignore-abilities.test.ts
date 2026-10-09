/**
 * docs/phase7-wave8.md §3.21: `RuleSpec ignoreAbilities { on, abilities, while? }`. Synthetic cards shaped like No
 * Longer Worthy (`aoa` 45105b: "Ignore the Forced Interrupt on the main scheme.") attached to a villain whose main
 * scheme prints "Forced Interrupt: When [the villain] would be defeated, heal all damage from him instead."
 *
 * Sources: RRG 1.8 "Ignore" (p. 23: "An ability that ignores some ability, icon, or cost treats that ability, icon, or
 * cost as not being in effect or present while that ability is resolving"), "Constant Ability" (p. 13), "Replacement
 * Effect" (p. 37).
 */

import { abilityId, flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { maxHitPoints, mustInstance } from "./query.js";
import { abilityIgnored, activeAbilityRefs, cardsInPlay, ignoredAbilities } from "./select.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const theVillain: TargetRef = { kind: "villain" };
const eventTarget: TargetRef = { kind: "eventTarget" };
const constant = (value: number): ValueSpec => ({ kind: "const", value });
const eachTracker: TargetRef = { kind: "each", query: { categories: ["upgrade"], name: "tracker" } };
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: eachTracker,
  counterType,
  amount: constant(1),
});

/** The main scheme's Forced Interrupt: "When the villain would be defeated, heal all damage from him instead." */
const HEAL_INSTEAD = stubAbility("scheme.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: { on: "characterDefeated", targetIs: { categories: ["villain"] } },
  },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "heal", target: eventTarget, amount: { kind: "damage", of: eventTarget } }, mark("healed")],
    },
  ],
} as AbilityDefinition);
/** The main scheme's other text, a constant: it stays whatever is ignored. */
const SCHEME_CONSTANT = stubAbility("scheme.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 5, target: { categories: ["villain"] } }] },
  effects: [],
} as AbilityDefinition);

const ignore = (abilities: readonly string[], whilePredicate?: Predicate): RuleSpec => ({
  kind: "ignoreAbilities",
  on: { categories: ["mainScheme"] },
  abilities: abilities.map((id) => abilityId(id)),
  ...(whilePredicate ? { while: whilePredicate } : {}),
});
const rules = (id: string, rule: RuleSpec) =>
  stubAbility(id, { trigger: { kind: "constant", rules: [rule] }, effects: [] } as AbilityDefinition);
/** "Ignore the Forced Interrupt on the main scheme." */
const UNWORTHY_RULE = rules("unworthy.constant", ignore([HEAL_INSTEAD.ref.id]));
/** The same, "while a minion is in play". */
const CONDITIONAL_RULE = rules(
  "conditional.constant",
  ignore([HEAL_INSTEAD.ref.id], { kind: "exists", query: { categories: ["minion"] } }),
);
/** Ignores the main scheme's constant instead. */
const QUIET_RULE = rules("quiet.constant", ignore([SCHEME_CONSTANT.ref.id]));

const VILLAIN = stubVillain({ id: "tyrant", stages: [{ hp: flat(20), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "age",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(99),
      acceleration: flat(0),
      abilities: [HEAL_INSTEAD.ref, SCHEME_CONSTANT.ref],
    },
  ],
});
const UNWORTHY = stubAttachment({ id: "unworthy", abilities: [UNWORTHY_RULE.ref] });
const CONDITIONAL = stubAttachment({ id: "conditional", abilities: [CONDITIONAL_RULE.ref] });
const QUIET = stubAttachment({ id: "quiet", abilities: [QUIET_RULE.ref] });
const MINION = stubMinion({ id: "prelate", atk: 1, sch: 1, hp: 3 });
const TRACKER = stubUpgrade({ id: "tracker", cost: 0 });

/**
 * A side scheme with two When Revealed abilities, both on the stack at once: the first makes the game ignore the
 * second until the end of the phase, so the second has triggered and must not resolve.
 */
const SECOND = stubAbility("twofold.when-revealed-2", { trigger: { kind: "whenRevealed" }, effects: [mark("second")] });
const FIRST = stubAbility("twofold.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    mark("first"),
    {
      kind: "applyRuleUntil",
      rule: { kind: "ignoreAbilities", on: { categories: ["sideScheme"] }, abilities: [SECOND.ref.id] },
      until: "endOfPhase",
    },
  ],
});
const TWOFOLD = stubSideScheme({ id: "twofold", startingThreat: 2, abilities: [FIRST.ref, SECOND.ref] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const STRIKE = action("strike", [{ kind: "dealDamage", target: theVillain, amount: constant(30) }]);
const REVEAL = action("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const ACTIONS = [STRIKE, REVEAL];
const deps: EngineDeps = depsOf(
  HEAL_INSTEAD,
  SCHEME_CONSTANT,
  UNWORTHY_RULE,
  CONDITIONAL_RULE,
  QUIET_RULE,
  FIRST,
  SECOND,
  ...ACTIONS.map((a) => a.ability),
);

function start(): GameState {
  const base = gameAtFirstTurn({
    cards: [VILLAIN, SCHEME, UNWORTHY, CONDITIONAL, QUIET, MINION, TRACKER, TWOFOLD, ...ACTIONS.map((a) => a.card)],
    deps,
    villain: VILLAIN,
    mainScheme: SCHEME,
    encounter: [UNWORTHY.id, CONDITIONAL.id, QUIET.id, MINION.id, TWOFOLD.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [TRACKER.id, ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 2))],
  });
  return playerCardIntoPlay(base, TRACKER.id).state;
}
/** An encounter attachment attached to the villain (surgery). */
function attached(state: GameState, card: { id: string }): { state: GameState; id: InstanceId } {
  const placed = encounterCardInVillainArea(state, card.id as never);
  const host = mustInstance(placed.state, placed.state.activeVillainId);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: host.instanceId, faceup: true },
        [host.instanceId]: { ...host, attachments: [...host.attachments, placed.id] },
      },
    },
  };
}
const tracker = (state: GameState) =>
  mustInstance(state, Object.values(state.instances).find((i) => i.cardId === TRACKER.id)!.instanceId).counters;
const villain = (state: GameState) => mustInstance(state, state.activeVillainId);
const schemeRefs = (state: GameState) => activeAbilityRefs(state, state.mainScheme.instanceId, deps).map((r) => r.id);
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

describe("§3.21 ignoreAbilities", () => {
  it("control: with no rule the main scheme's interrupt replaces the defeat", () => {
    const state = start();
    expect(ignoredAbilities(state, deps).size).toBe(0);
    const { state: after, events } = playFree(state, deps, STRIKE.card.id);
    expect(after.outcome).toBeNull();
    expect(villain(after).damage).toBe(0);
    expect(tracker(after).healed).toBe(1);
    expect(resolved(events)).toContain(HEAL_INSTEAD.ref.id);
  });

  it("the named ability does not trigger: the villain is defeated and nothing of the interrupt resolves", () => {
    const { state } = attached(start(), UNWORTHY);
    expect(abilityIgnored(state, deps, state.mainScheme.instanceId, HEAL_INSTEAD.ref.id)).toBe(true);
    const { state: after, events, session } = playFree(state, deps, STRIKE.card.id);
    expect(after.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(tracker(after).healed).toBeUndefined();
    expect(resolved(events)).not.toContain(HEAL_INSTEAD.ref.id);
    // It never triggered, so there is nothing to log as ignored either.
    expect(events.some((e) => e.type === "abilityIgnored")).toBe(false);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("only the named ability is ignored: the card's other ability and its values stay", () => {
    const { state } = attached(start(), UNWORTHY);
    expect(schemeRefs(state)).toEqual([SCHEME_CONSTANT.ref.id]);
    expect(maxHitPoints(state, state.activeVillainId, deps)).toBe(25);
    expect(abilityIgnored(state, deps, state.mainScheme.instanceId, SCHEME_CONSTANT.ref.id)).toBe(false);
    // The rule's own card is untouched: only cards matching `on` are read.
    expect(ignoredAbilities(state, deps).size).toBe(1);
  });

  it("a named constant ability applies nothing while it is ignored", () => {
    const base = start();
    expect(maxHitPoints(base, base.activeVillainId, deps)).toBe(25);
    const { state } = attached(base, QUIET);
    expect(maxHitPoints(state, state.activeVillainId, deps)).toBe(20);
    expect(schemeRefs(state)).toEqual([HEAL_INSTEAD.ref.id]);
  });

  it("the rule ends with its card: once the attachment leaves play the interrupt is back", () => {
    const { state, id } = attached(start(), UNWORTHY);
    const host = villain(state);
    const gone: GameState = {
      ...state,
      removedFromGame: [...state.removedFromGame, id],
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), attachedTo: null },
        [host.instanceId]: { ...host, attachments: host.attachments.filter((x) => x !== id) },
      },
    };
    expect(cardsInPlay(gone)).not.toContain(id);
    expect(schemeRefs(gone)).toEqual([HEAL_INSTEAD.ref.id, SCHEME_CONSTANT.ref.id]);
    const after = playFree(gone, deps, STRIKE.card.id).state;
    expect(after.outcome).toBeNull();
    expect(tracker(after).healed).toBe(1);
  });

  it("`while`: the ability is ignored only while the condition holds", () => {
    const { state } = attached(start(), CONDITIONAL);
    expect(schemeRefs(state)).toContain(HEAL_INSTEAD.ref.id);
    const healed = playFree(state, deps, STRIKE.card.id).state;
    expect(healed.outcome).toBeNull();
    expect(tracker(healed).healed).toBe(1);
    const withMinion = minionEngagedWith(state, MINION.id).state;
    expect(schemeRefs(withMinion)).not.toContain(HEAL_INSTEAD.ref.id);
    expect(playFree(withMinion, deps, STRIKE.card.id).state.outcome).toEqual({
      result: "win",
      reason: "villainDefeated",
    });
  });

  it("an ability that had already triggered does not resolve once a rule ignores it, and the log says so", () => {
    const state = onTopOfEncounterDeck(start(), TWOFOLD.id);
    const { state: after, events } = playFree(state, deps, REVEAL.card.id);
    const scheme = Object.values(after.instances).find((i) => i.cardId === TWOFOLD.id)!.instanceId;
    expect(tracker(after)).toMatchObject({ first: 1 });
    expect(tracker(after).second).toBeUndefined();
    expect(resolved(events)).toContain(FIRST.ref.id);
    expect(resolved(events)).not.toContain(SECOND.ref.id);
    expect(events.filter((e) => e.type === "abilityIgnored")).toEqual([
      { type: "abilityIgnored", instanceId: scheme, abilityId: SECOND.ref.id },
    ]);
  });
});
