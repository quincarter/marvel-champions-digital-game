/**
 * docs/phase7-wave6.md §3.19: a main scheme stage in the victory display. The Brotherhood Strikes! 1B (32125b): "When
 * Revealed: … Advance to the next card in the main scheme deck. Add this card to the victory display." Each 2B: "When
 * Completed: Add this scheme to the victory display. Advance to the next card in the main scheme deck. If there are 3
 * main schemes in the victory display, the players lose the game." `EffectSpec addMainSchemeStageToVictoryDisplay` puts
 * a copy of the main scheme card fixed at the current stage in the victory display, before the advance (§3.18's
 * `stageOrder` picks the next stage); the loss is a `stateCheck` on `victoryDisplayCount(mainScheme)`.
 */
import { flat, trait, type CardId, type MainSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { currentName, locateCard, mustInstance } from "./query.js";
import { categoriesOf, matchesQuery, resolveValue, traitsOf } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { giveCard, HERO, seatIdentities } from "./testing/scenario.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";

const p1 = playerId("p1");
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const SHUFFLE = stubAbility("shuffle.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "shuffleMainSchemeStages", fromStageIndex: 1 }],
});
// 1B: add this card to the victory display, then advance to the next card in the main scheme deck.
const ONE_B = stubAbility("oneB.whenRevealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addMainSchemeStageToVictoryDisplay" }, { kind: "advanceMainScheme" }],
});
// 2B: add this scheme to the victory display; the completion advances it afterwards.
const TWO_B = stubAbility("twoB.whenCompleted", {
  trigger: { kind: "whenCompleted" },
  effects: [{ kind: "addMainSchemeStageToVictoryDisplay" }],
});
const VICTORY_SCHEMES = { kind: "victoryDisplayCount", filter: { categories: ["mainScheme"] } } as const;
const THREE_LOSE = stubAbility("twoB.threeLose", {
  trigger: {
    kind: "stateCheck",
    when: { kind: "compare", left: VICTORY_SCHEMES, op: "atLeast", right: { kind: "const", value: 3 } },
  },
  effects: [{ kind: "endGame", result: "loss" }],
});
const SCHEME_PLOT = stubAbility("plot.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
});
const PLOT_CARD = stubEvent({ id: "plot-card", cost: 0, abilities: [SCHEME_PLOT.ref] });
const ADD = stubAbility("add.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "addMainSchemeStageToVictoryDisplay", scheme: { kind: "mainScheme" } }],
});
const ADD_CARD = stubEvent({ id: "add-card", cost: 0, abilities: [ADD.ref] });

const NAMES = ["The Atrium", "The Cafeteria", "The Basketball Court", "The Courtyard"] as const;
const LOCATION = trait("Location");

/** 32125's main scheme deck: 1A/1B (dashed, advances on reveal) then four shuffled stage 2s (target 3). */
function brotherhoodShape(): MainSchemeCard {
  const stub = stubMainScheme({
    id: "brotherhood-strikes",
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(0),
        acceleration: flat(0),
        aSideAbilities: [SHUFFLE.ref],
        abilities: [ONE_B.ref],
      },
      ...NAMES.map(() => ({
        startingThreat: flat(1),
        targetThreat: flat(3),
        acceleration: flat(0),
        abilities: [TWO_B.ref, THREE_LOSE.ref],
      })),
    ],
  });
  const [first, ...rest] = stub.stages;
  return {
    ...stub,
    name: "The Brotherhood Strikes!",
    stages: [
      { ...first, dashedValues: ["startingThreat", "targetThreat", "acceleration"] },
      ...rest.map((stage, index) => ({ ...stage, stageNumber: 2, name: NAMES[index] ?? "", traits: [LOCATION] })),
    ],
  };
}

const SCHEME = brotherhoodShape();
const ABILITIES: readonly StubAbility[] = [SHUFFLE, ONE_B, TWO_B, THREE_LOSE, SCHEME_PLOT, ADD];
const deps: EngineDeps = depsOf(...ABILITIES);

function game(seed: number) {
  const identities = seatIdentities(HERO, 1);
  const config: GameSetupConfig = {
    seed,
    cards: [QUIET_VILLAIN, SCHEME, BLANK, PLOT_CARD, ADD_CARD, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: SCHEME.id,
    encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [PLOT_CARD.id, PLOT_CARD.id, ADD_CARD.id],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  const run = runCommands(result.state, deps);
  return { ...run, events: [...result.events, ...run.events] };
}

function playCard(state: GameState, cardId: string) {
  const given = giveCard(state, p1, cardId);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}
const plot = (state: GameState) => playCard(state, PLOT_CARD.id);
const playAdd = (state: GameState) => playCard(state, ADD_CARD.id);

const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps } as const;
const schemesInVictoryDisplay = (state: GameState): number => resolveValue(state, VICTORY_SCHEMES, context, deps);
const must = (id: InstanceId | undefined): InstanceId => {
  if (id === undefined) throw new Error("no such instance");
  return id;
};
const stageOf = (state: GameState, id: string): number | undefined => state.instances[id]?.mainSchemeStageIndex;

describe("§3.19 addMainSchemeStageToVictoryDisplay", () => {
  it("1B's When Revealed adds 1B to the victory display, then reveals the first stage in the shuffled order", () => {
    const { state, events } = game(5);
    const order = state.mainScheme.stageOrder ?? [];
    expect(order[0]).toBe(0);
    expect(state.mainScheme.stageIndex).toBe(order[1]);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(1);
    expect(state.victoryDisplay).toHaveLength(1);
    const [oneB = ""] = state.victoryDisplay;
    expect(stageOf(state, oneB)).toBe(0);
    expect(state.spentMainSchemeStages).toContain(0);
    expect(oneB).not.toBe(state.mainScheme.instanceId);
    const mainEvents = events.filter((event) => event.type.startsWith("mainScheme"));
    expect(mainEvents.map((event) => event.type)).toEqual([
      "mainSchemeStagesShuffled",
      "mainSchemeStageToVictoryDisplay",
      "mainSchemeAdvanced",
    ]);
    expect(mainEvents[1]).toEqual({
      type: "mainSchemeStageToVictoryDisplay",
      schemeInstanceId: state.mainScheme.instanceId,
      stageIndex: 0,
      instanceId: oneB,
    });
    expect(state.outcome).toBeNull();
  });

  it("victory display readers see the stage: count, category, name, traits, zone", () => {
    const { state } = plot(game(5).state);
    const atrium = must(state.victoryDisplay.find((id) => stageOf(state, id) !== 0));
    const completedStage = stageOf(state, atrium) ?? -1;
    expect(schemesInVictoryDisplay(state)).toBe(2);
    expect(categoriesOf(state, atrium)).toEqual(["mainScheme", "scheme"]);
    expect(currentName(state, atrium)).toBe(NAMES[completedStage - 1]);
    expect(traitsOf(state, atrium, deps)).toEqual([LOCATION]);
    expect(hasKeyword(state, atrium, "victory", deps)).toBe(false);
    expect(locateCard(state, atrium)).toEqual({ kind: "victoryDisplay" });
    expect(matchesQuery(state, atrium, { name: NAMES[completedStage - 1] ?? "" }, context)).toBe(true);
    // The 1B copy reads the card's own title; stage 1 prints no stage name.
    const oneB = must(state.victoryDisplay[0]);
    expect(currentName(state, oneB)).toBe("The Brotherhood Strikes!");
    expect(traitsOf(state, oneB, deps)).toEqual([]);
  });

  it("a 2B's completion adds it before the normal advance, which walks stageOrder", () => {
    const start = game(5).state;
    const order = start.mainScheme.stageOrder ?? [];
    const { state, events } = plot(start);
    expect(state.mainScheme.stageIndex).toBe(order[2]);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(1);
    expect(state.victoryDisplay.map((id) => stageOf(state, id))).toEqual([0, order[1]]);
    expect(
      events
        .filter((event) => event.type.startsWith("mainScheme"))
        .map((event) => [event.type, "stageIndex" in event ? event.stageIndex : null]),
    ).toEqual([
      ["mainSchemeCompleted", order[1]],
      ["mainSchemeStageToVictoryDisplay", order[1]],
      ["mainSchemeAdvanced", order[2]],
    ]);
    expect(state.outcome).toBeNull();
  });

  it("the third main scheme in the victory display loses the game, before the advance", () => {
    const start = game(5).state;
    const order = start.mainScheme.stageOrder ?? [];
    const second = plot(start).state;
    const { state, events } = plot(second);
    expect(schemesInVictoryDisplay(state)).toBe(3);
    expect(state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    expect(state.mainScheme.stageIndex).toBe(order[2]);
    expect(events.some((event) => event.type === "mainSchemeAdvanced")).toBe(false);
  });

  it("adding the same stage again does nothing", () => {
    const start = game(5).state;
    const once = playAdd(start).state;
    expect(once.victoryDisplay.map((id) => stageOf(once, id))).toEqual([0, start.mainScheme.stageIndex]);
    expect(once.mainScheme.stageIndex).toBe(start.mainScheme.stageIndex);
    const twice = playAdd(once).state;
    expect(twice.victoryDisplay).toEqual(once.victoryDisplay);
  });

  it("a shuffled game with stages in the victory display replays deep-equal", () => {
    let { state, session } = game(9);
    for (let i = 0; i < 2; i++) {
      const given = giveCard(state, p1, PLOT_CARD.id);
      ({ state, session } = runCommands(given.state, deps, {
        type: "playCard",
        playerId: p1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
      }));
      const replayed = replay(session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(state);
    }
    expect(state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });
});
