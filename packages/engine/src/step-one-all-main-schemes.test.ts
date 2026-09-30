/**
 * docs/phase7-wave5.md §4.1 Q71 (user ruling, 2026-09-27, "All first"): villain phase step one places threat on every
 * main scheme before any main scheme's completion resolves (RRG 1.8 "Villain Phase", step one; MC21 p. 10, "Each main
 * scheme gains threat during step 1 of the villain phase"). Synthetic cards shaped like Venom Goblin's lettered main
 * schemes (`sm` 27116a–27119a, `glider-main-schemes.test.ts`): a setup stage puts First and Second into play, and a
 * completed stage flips to its environment face, whose When Revealed records Second's threat at that moment.
 */

import {
  cardId,
  flat,
  type AbilityReference,
  type EnvironmentCard,
  type MainSchemeCard,
  type MainSchemeStage,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { currentName, mustInstance, sharedMainSchemes } from "./query.js";
import { createGame } from "./setup.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const one = { kind: "const", value: 1 } as const;
const named = (name: string): TargetRef => ({ kind: "each", query: { categories: ["mainScheme"], name } });

const SETUP = stubAbility("q71.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "putMainSchemeStageIntoPlay", stageNumber: 2 },
    { kind: "putMainSchemeStageIntoPlay", stageNumber: 3 },
    { kind: "flipCard", target: self },
    { kind: "moveCards", cards: { kind: "ref", ref: self }, to: "encounterSetAside" },
  ],
});
/** First's environment face: "When Revealed" records the threat on Second as First's completion resolves. */
const SEEN = stubAbility("q71.first-env.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "addCounters",
      target: named("Second"),
      counterType: "seenAtCompletion",
      amount: { kind: "threat", of: named("Second") },
    },
  ],
});
/** "Forced Response: After threat is placed here during step one of the villain phase, …" on Second. */
const PLACED_HERE = stubAbility("q71.second.placed-here", {
  trigger: { kind: "response", forced: true, on: { on: "placeThreat", selfIs: "target" } },
  effects: [
    {
      kind: "if",
      condition: { kind: "gameStep", phase: "villain", step: "placeThreat" },
      then: [{ kind: "addCounters", target: self, counterType: "stepOneResponse", amount: one }],
    },
  ],
});
/** "Forced Interrupt: When threat would be placed here, prevent all of it." on Second (variant). */
const PREVENT_HERE = stubAbility("q71.second.prevent-here", {
  trigger: { kind: "interrupt", forced: true, on: { on: "placeThreat", selfIs: "target" } },
  effects: [{ kind: "preventThreat" }],
});
/** "Forced Interrupt: When threat would be placed here, cancel it." on Second (variant). */
const CANCEL_HERE = stubAbility("q71.second.cancel-here", {
  trigger: { kind: "interrupt", forced: true, on: { on: "placeThreat", selfIs: "target" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
});

const env = (id: string, name: string, abilities: readonly AbilityReference[] = []): EnvironmentCard => ({
  ...stubEnvironment({ id, name, abilities }),
  otherFaceId: cardId("q71-schemes"),
});
const ENVIRONMENTS = [
  env("q71-setup-env", "Setup"),
  env("q71-first-env", "First", [SEEN.ref]),
  env("q71-second-env", "Second"),
];

type Variant = "plain" | "prevent" | "cancel";
const secondAbilities = (variant: Variant): readonly AbilityReference[] =>
  variant === "prevent"
    ? [PLACED_HERE.ref, PREVENT_HERE.ref]
    : variant === "cancel"
      ? [PLACED_HERE.ref, CANCEL_HERE.ref]
      : [PLACED_HERE.ref];

function schemesCard(variant: Variant): MainSchemeCard {
  const base = stubMainScheme({
    id: "q71-schemes",
    stages: [
      { startingThreat: flat(0), targetThreat: flat(0), acceleration: flat(0), aSideAbilities: [SETUP.ref] },
      // First completes on step one: 2 + 1 = its target of 3.
      { startingThreat: flat(2), targetThreat: flat(3), acceleration: flat(1) },
      { startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(2), abilities: secondAbilities(variant) },
    ],
  });
  const names = ["Setup", "First", "Second"] as const;
  return {
    ...base,
    stages: base.stages.map((stage, index): MainSchemeStage => ({
      ...stage,
      stageLetter: (["A", "B", "C"] as const)[index]!,
      name: names[index]!,
      otherFaceId: ENVIRONMENTS[index]!.id,
      ...(index === 0
        ? { dashedValues: ["startingThreat", "targetThreat", "acceleration"] as const }
        : { onCompletion: "flipToOtherFace" as const }),
    })) as unknown as MainSchemeCard["stages"],
  };
}

const VILLAIN = stubVillain({ id: "q71-villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const FILLER = stubTreachery({ id: "q71-filler", boostIcons: 0 });
const deps: EngineDeps = depsOf(SETUP, SEEN, PLACED_HERE, PREVENT_HERE, CANCEL_HERE);

function start(variant: Variant): GameState {
  const result = createGame(
    {
      seed: 3,
      cards: [...DEFAULT_CARDS, schemesCard(variant), ...ENVIRONMENTS, VILLAIN, FILLER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: cardId("q71-schemes"),
      encounterDeck: copiesOf(FILLER.id, 20),
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const schemeNamed = (state: GameState, name: string): InstanceId => {
  const found = sharedMainSchemes(state).find((s) => currentName(state, s.instanceId) === name);
  if (!found) throw new Error(`no main scheme named ${name}`);
  return found.instanceId;
};

/** Ends the player's turn and drives the villain phase to the next player phase. */
function endRound(state: GameState) {
  const step = state.step;
  if (step.kind !== "turn") throw new Error(step.kind);
  return driveSession(startSession(state), deps, [{ type: "endTurn", playerId: step.activePlayerId }]);
}

const indexOf = (events: readonly GameEvent[], match: (event: GameEvent) => boolean): number => {
  const index = events.findIndex(match);
  if (index < 0) throw new Error("event not found");
  return index;
};

describe("§4.1 Q71: step one places threat on every main scheme before any completion", () => {
  it("First completes on step one after Second's threat is placed, and Second's step-one response still resolves", () => {
    const before = start("plain");
    const first = schemeNamed(before, "First");
    const second = schemeNamed(before, "Second");
    expect([mustInstance(before, first).threat, mustInstance(before, second).threat]).toEqual([2, 0]);

    const { session, events } = endRound(before);
    const after = session.state;
    expect(after.outcome).toBeNull();
    // First flipped to its environment face; Second is the only main scheme left.
    expect(sharedMainSchemes(after).map((s) => currentName(after, s.instanceId))).toEqual(["Second"]);
    const secondAfter = mustInstance(after, second);
    // 0 + 2 on step one, already there when First's completion revealed its environment.
    expect(secondAfter.threat).toBe(2);
    expect(secondAfter.counters["seenAtCompletion"]).toBe(2);
    expect(secondAfter.counters["stepOneResponse"]).toBe(1);

    // Both placements, then the completion, then Second's response.
    const placedOn = (id: InstanceId) => (e: GameEvent) => e.type === "threatPlaced" && e.schemeInstanceId === id;
    const placedFirst = indexOf(events, placedOn(first));
    const placedSecond = indexOf(events, placedOn(second));
    // First is the central scheme here, so its event carries only its stage index.
    const completed = indexOf(events, (e) => e.type === "mainSchemeCompleted" && e.stageIndex === 1);
    const responded = indexOf(
      events,
      (e) => e.type === "counterAdded" && e.instanceId === second && e.counterType === "stepOneResponse",
    );
    expect(placedFirst).toBeLessThan(placedSecond);
    expect(placedSecond).toBeLessThan(completed);
    expect(completed).toBeLessThan(responded);

    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the last placement prevented to 0 still checks the others: First completes, Second stays at 0", () => {
    const before = start("prevent");
    const second = schemeNamed(before, "Second");
    const after = endRound(before).session.state;
    expect(sharedMainSchemes(after).map((s) => currentName(after, s.instanceId))).toEqual(["Second"]);
    expect(mustInstance(after, second).threat).toBe(0);
    expect(mustInstance(after, second).counters["seenAtCompletion"] ?? 0).toBe(0);
  });

  it("the last placement cancelled still checks the others: First completes, Second stays at 0", () => {
    const before = start("cancel");
    const second = schemeNamed(before, "Second");
    const after = endRound(before).session.state;
    expect(sharedMainSchemes(after).map((s) => currentName(after, s.instanceId))).toEqual(["Second"]);
    expect(mustInstance(after, second).threat).toBe(0);
    // A cancelled placement never happened, so "after threat is placed here" does not respond.
    expect(mustInstance(after, second).counters["stepOneResponse"] ?? 0).toBe(0);
  });
});

/** One main scheme, as every other game: its step-one placement checks completion as it lands. */
const SINGLE = stubMainScheme({
  id: "q71-single",
  stages: [
    { startingThreat: flat(2), targetThreat: flat(3), acceleration: flat(1) },
    { startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(1) },
  ],
});

describe("§4.1 Q71: one main scheme is unchanged", () => {
  it("step one's placement carries no batch marker and completes the stage as it lands", () => {
    const created = createGame(
      {
        seed: 3,
        cards: [...DEFAULT_CARDS, SINGLE, VILLAIN, FILLER],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SINGLE.id,
        encounterDeck: copiesOf(FILLER.id, 20),
        includeIdentitySets: false,
        players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
      },
      deps,
    );
    if (!created.ok) throw new Error(created.error.message);
    const before = driveSession(startSession(created.state), deps).session.state;
    expect(mustInstance(before, before.mainScheme.instanceId).threat).toBe(2);
    const { session, events } = endRound(before);
    const after = session.state;
    expect(after.outcome).toBeNull();
    // Advanced to stage 2 (excess threat does not carry over, starting threat 0).
    expect(after.mainScheme.stageIndex).toBe(1);
    expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(0);
    const stepOne = events.find(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "placeThreat",
    );
    expect(stepOne).toMatchObject({ event: { kind: "placeThreat", amount: 1, sourceInstanceId: null } });
    expect(stepOne?.type === "triggerEvent" && "completionCheck" in stepOne.event).toBe(false);
    const placed = events.findIndex((e) => e.type === "threatPlaced");
    const completed = events.findIndex((e) => e.type === "mainSchemeCompleted");
    expect(placed).toBeGreaterThanOrEqual(0);
    expect(completed).toBe(placed + 1);
  });
});
