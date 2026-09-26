/**
 * docs/phase7-wave5.md §3.3: several main schemes, one marked by a counter; a completed stage flips to an environment.
 * Synthetic cards shaped like Venom Goblin's main scheme deck (`sm` 27116a–27119b): Skies Over New York (A: "Put the
 * Lower Manhattan, Midtown Manhattan, and Upper Manhattan main schemes into play. Place the glider counter on Midtown
 * Manhattan. Flip this card and set it aside."), three lettered main schemes whose other faces are environments, and
 * the glider counter's scenario rule.
 *
 * Sources: MC27 p. 17, "The Glider Counter", with the RRG 1.8 p. 67 erratum ("When a main scheme is completed, flip it to
 * its environment side"); FAQ, RRG 1.8 p. 62 and MC27 p. 21 (a player effect's acceleration token goes on the glider
 * scheme; patrol and crisis protect only the glider scheme); RRG 1.8 "Acceleration Token" (p. 5), "Flip" (p. 20).
 */

import { cardId, flat, type EnvironmentCard, type MainSchemeCard, type MainSchemeStage } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { currentName, mustInstance, sharedMainSchemes } from "./query.js";
import { isProtectedMainScheme, resolveRef } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, playFree } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { categories: ["mainScheme"], name } });
const SETUP = stubAbility("skies.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "putMainSchemeStageIntoPlay", stageNumber: 2 },
    { kind: "putMainSchemeStageIntoPlay", stageNumber: 3 },
    { kind: "putMainSchemeStageIntoPlay", stageNumber: 4 },
    { kind: "addCounters", target: named("Midtown"), counterType: "glider", amount: { kind: "const", value: 1 } },
    { kind: "flipCard", target: { kind: "self" } },
    { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "encounterSetAside" },
  ],
});
const REVEALED = stubAbility("manhattan-env.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "revealed", amount: { kind: "const", value: 1 } },
  ],
});
const env = (id: string, name: string): EnvironmentCard => ({
  ...stubEnvironment({ id, name, abilities: [REVEALED.ref] }),
  otherFaceId: cardId("skies"),
});
const ENVIRONMENTS = [
  env("skies-env", "Skies"),
  env("lower-env", "Lower"),
  env("mid-env", "Midtown"),
  env("up-env", "Upper"),
];

const base = stubMainScheme({
  id: "skies",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(0), acceleration: flat(0), aSideAbilities: [SETUP.ref] },
    { startingThreat: flat(1), targetThreat: flat(11), acceleration: flat(1) },
    { startingThreat: flat(2), targetThreat: flat(12), acceleration: flat(2) },
    { startingThreat: flat(0), targetThreat: flat(10), acceleration: flat(3) },
  ],
});
const LETTERS = ["A", "B", "C", "D"] as const;
const NAMES = ["Skies", "Lower", "Midtown", "Upper"] as const;
const SKIES: MainSchemeCard = {
  ...base,
  stages: base.stages.map((stage, index): MainSchemeStage => ({
    ...stage,
    stageLetter: LETTERS[index]!,
    name: NAMES[index]!,
    otherFaceId: ENVIRONMENTS[index]!.id,
    ...(index === 0
      ? { dashedValues: ["startingThreat", "targetThreat", "acceleration"] as const }
      : { onCompletion: "flipToOtherFace" as const }),
  })) as unknown as MainSchemeCard["stages"],
};

/** The glider counter's scenario rule (MC27 p. 17), a scenario rule with no card in play (wave 4 §3.40). */
const GLIDER_RULE: RuleSpec = {
  kind: "focusedMainScheme",
  scheme: { kind: "each", query: { categories: ["mainScheme"], hasCounter: "glider" } },
  encounterCards: "focused",
};

const VILLAIN = stubVillain({ id: "venom-goblin", stages: [{ hp: flat(30), atk: 0, sch: 2 }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOKEN = event("token", [{ kind: "addAccelerationToken" }]);
const JOY_RIDE = event("joy-ride", [
  {
    kind: "moveCounters",
    from: { kind: "each", query: { categories: ["mainScheme"], hasCounter: "glider" } },
    to: {
      kind: "superlative",
      order: "lowest",
      among: { kind: "each", query: { categories: ["mainScheme"] } },
      measure: { kind: "threat", of: { kind: "slot", slot: "candidate" } },
    },
    counterType: "glider",
  },
]);
const FLOOD = event("flood", [{ kind: "placeThreat", target: named("Upper"), amount: { kind: "const", value: 20 } }]);
const EVENTS = [TOKEN, JOY_RIDE, FLOOD];

const deps: EngineDeps = depsOf(SETUP, REVEALED, ...EVENTS.map((e) => e.ability));

function start(): GameState {
  const result = createGame(
    {
      seed: 2,
      cards: [...DEFAULT_CARDS, SKIES, ...ENVIRONMENTS, VILLAIN, FILLER, ...EVENTS.map((e) => e.card)],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SKIES.id,
      encounterDeck: copiesOf(FILLER.id, 20),
      scenarioRuleSpecs: [GLIDER_RULE],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const schemeNamed = (state: GameState, name: string): InstanceId =>
  sharedMainSchemes(state).find((s) => currentName(state, s.instanceId) === name)!.instanceId;
const threat = (state: GameState, name: string) => mustInstance(state, schemeNamed(state, name)).threat;
const gliderOn = (state: GameState): string | undefined =>
  sharedMainSchemes(state)
    .map((s) => s.instanceId)
    .filter((id) => (mustInstance(state, id).counters["glider"] ?? 0) > 0)
    .map((id) => currentName(state, id))[0];

describe("§3.3 Venom Goblin's setup", () => {
  it("three main schemes in play, the glider on Midtown, and stage A set aside as its environment face", () => {
    const state = start();
    expect(sharedMainSchemes(state).map((s) => currentName(state, s.instanceId))).toEqual([
      "Lower",
      "Midtown",
      "Upper",
    ]);
    expect(gliderOn(state)).toBe("Midtown");
    const skies = state.encounterSetAside.find((id) => mustInstance(state, id).cardId === ENVIRONMENTS[0]!.id);
    expect(skies).toBeDefined();
    expect([threat(state, "Lower"), threat(state, "Midtown"), threat(state, "Upper")]).toEqual([1, 2, 0]);
  });
});

describe("§3.3 the glider scheme is 'the main scheme' for encounter cards", () => {
  it("an encounter card's 'the main scheme' is the glider's; crisis and patrol protect only it", () => {
    const state = start();
    const context = {
      controllerId: null,
      selfInstanceId: state.activeVillainId,
      scopedPlayerId: null,
      event: null,
      bindings: {},
      deps,
    };
    expect(resolveRef(state, { kind: "mainScheme" }, context)).toEqual([schemeNamed(state, "Midtown")]);
    expect(isProtectedMainScheme(state, deps, schemeNamed(state, "Midtown"))).toBe(true);
    expect(isProtectedMainScheme(state, deps, schemeNamed(state, "Lower"))).toBe(false);
  });

  it("an acceleration token 'on the main scheme' goes on the glider scheme", () => {
    const after = playFree(start(), deps, TOKEN.card.id).state;
    const tokens = (name: string) =>
      sharedMainSchemes(after).find((s) => currentName(after, s.instanceId) === name)!.accelerationTokens;
    expect([tokens("Lower"), tokens("Midtown"), tokens("Upper")]).toEqual([0, 1, 0]);
  });

  it("in the villain phase each main scheme gains its own acceleration and the villain schemes on the glider's", () => {
    const state = start();
    const step = state.step;
    if (step.kind !== "turn") throw new Error(step.kind);
    const after = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: step.activePlayerId }]).session
      .state;
    // Lower 1+1, Midtown 2+2 (+2 from the villain's scheme), Upper 0+3.
    expect([threat(after, "Lower"), threat(after, "Midtown"), threat(after, "Upper")]).toEqual([2, 6, 3]);
  });

  it("moving the glider counter moves 'the main scheme' with it", () => {
    const after = playFree(start(), deps, JOY_RIDE.card.id).state;
    expect(gliderOn(after)).toBe("Upper");
    const context = {
      controllerId: null,
      selfInstanceId: after.activeVillainId,
      scopedPlayerId: null,
      event: null,
      bindings: {},
      deps,
    };
    expect(resolveRef(after, { kind: "mainScheme" }, context)).toEqual([schemeNamed(after, "Upper")]);
  });
});

describe("§3.3 a completed main scheme flips to its environment face", () => {
  it("Upper Manhattan reaching its target turns into its environment, revealed; no loss", () => {
    const { state, session } = playFree(start(), deps, FLOOD.card.id);
    expect(state.outcome).toBeNull();
    expect(sharedMainSchemes(state).map((s) => currentName(state, s.instanceId))).toEqual(["Lower", "Midtown"]);
    const upperEnv = state.villainArea.find((id) => mustInstance(state, id).cardId === ENVIRONMENTS[3]!.id)!;
    expect(mustInstance(state, upperEnv).threat).toBe(0);
    expect(mustInstance(state, upperEnv).counters["revealed"]).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
