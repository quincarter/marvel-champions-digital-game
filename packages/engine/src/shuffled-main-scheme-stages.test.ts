/**
 * docs/phase7-wave6.md §3.18: main scheme stages shuffled at setup. The Brotherhood Strikes! 1A (32125a, §1.5):
 * "Shuffle all copies of main scheme 2A and stack them under this scheme." Four stages share stage number 2 and are told
 * apart by name; unshuffled they are a group of alternatives (Kang's stage 3, wave 2 §1.6) that the default advance
 * cannot enter. `EffectSpec shuffleMainSchemeStages` stores a seeded order (`MainSchemeState.stageOrder`) that the
 * default advance then walks, one stage at a time; the last entry is the final stage.
 */
import { flat, type CardId, type MainSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { playerId } from "./ids.js";
import { mustInstance } from "./query.js";
import { nextMainSchemeStage } from "./resolve/defeat.js";
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
const ADVANCE = stubAbility("advance.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "advanceMainScheme" }],
});
const SCHEME_PLOT = stubAbility("plot.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
});
const ADVANCE_CARD = stubEvent({ id: "advance-card", cost: 0, abilities: [ADVANCE.ref] });
const PLOT_CARD = stubEvent({ id: "plot-card", cost: 0, abilities: [SCHEME_PLOT.ref] });

const NAMES = ["The Atrium", "The Cafeteria", "The Basketball Court", "The Courtyard"] as const;

/** Stage 1 (target 99) then four alternative stage 2s told apart by name (target 3), like 32125's main scheme deck. */
function brotherhoodShape(id: string, setupShuffle: boolean): MainSchemeCard {
  const stub = stubMainScheme({
    id,
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(99),
        acceleration: flat(0),
        aSideAbilities: setupShuffle ? [SHUFFLE.ref] : [],
      },
      ...NAMES.map(() => ({ startingThreat: flat(1), targetThreat: flat(3), acceleration: flat(0) })),
    ],
  });
  const [first, ...rest] = stub.stages;
  return {
    ...stub,
    stages: [first, ...rest.map((stage, index) => ({ ...stage, stageNumber: 2, name: NAMES[index] ?? "" }))],
  };
}

const SHUFFLED = brotherhoodShape("shuffled-scheme", true);
const UNSHUFFLED = brotherhoodShape("unshuffled-scheme", false);

const ABILITIES: readonly StubAbility[] = [SHUFFLE, ADVANCE, SCHEME_PLOT];
const deps: EngineDeps = depsOf(...ABILITIES);

function game(seed: number, scheme: MainSchemeCard = SHUFFLED) {
  const identities = seatIdentities(HERO, 1);
  const config: GameSetupConfig = {
    seed,
    cards: [QUIET_VILLAIN, scheme, BLANK, ADVANCE_CARD, PLOT_CARD, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: scheme.id,
    encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [ADVANCE_CARD.id, ADVANCE_CARD.id, PLOT_CARD.id],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  const run = runCommands(result.state, deps);
  return { ...run, events: [...result.events, ...run.events] };
}

function play(state: GameState, cardId: string) {
  const given = giveCard(state, p1, cardId);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const schemeThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;

describe("§3.18 shuffleMainSchemeStages", () => {
  it("the 1A Setup stores a seeded order behind stage 1 and logs it", () => {
    const { state, events } = game(5);
    expect(state.mainScheme).toEqual({
      instanceId: state.mainScheme.instanceId,
      cardId: SHUFFLED.id,
      stageIndex: 0,
      completed: false,
      accelerationTokens: 0,
      stageOrder: [0, 3, 2, 1, 4],
    });
    expect(events.filter((event) => event.type === "mainSchemeStagesShuffled")).toEqual([
      { type: "mainSchemeStagesShuffled", schemeInstanceId: state.mainScheme.instanceId, order: [0, 3, 2, 1, 4] },
    ]);
  });

  it("same seed, same order; the seed decides it", () => {
    expect(game(5).state.mainScheme.stageOrder).toEqual(game(5).state.mainScheme.stageOrder);
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(game(seed).state.mainScheme.stageOrder)),
    );
    expect(orders.size).toBeGreaterThan(1);
    for (const order of orders) expect([...(JSON.parse(order) as number[])].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("unshuffled, the same-numbered stages stay a group of alternatives (Kang's shape, unchanged)", () => {
    const { state } = game(5, UNSHUFFLED);
    expect(state.mainScheme.stageOrder).toBeUndefined();
    expect(nextMainSchemeStage(state, state.mainScheme)).toBe("alternatives");
    // The default advance does nothing into alternatives.
    expect(play(state, ADVANCE_CARD.id).state.mainScheme.stageIndex).toBe(0);
  });

  it("each default advance reveals the next stage in the shuffled order; on the last it does nothing", () => {
    let { state } = game(5);
    for (const expected of [3, 2, 1, 4]) {
      state = play(state, ADVANCE_CARD.id).state;
      expect(state.mainScheme.stageIndex).toBe(expected);
      expect(state.mainScheme.completed).toBe(false);
      expect(schemeThreat(state)).toBe(1);
    }
    expect(nextMainSchemeStage(state, state.mainScheme)).toBeNull();
    const after = play(state, ADVANCE_CARD.id).state;
    expect(after.mainScheme.stageIndex).toBe(4);
    expect(after.outcome).toBeNull();
  });

  it("completing a shuffled stage 2 advances to the next one in the order, not into alternatives", () => {
    const atFirst = play(game(5).state, ADVANCE_CARD.id).state;
    expect(atFirst.mainScheme.stageIndex).toBe(3);
    const { state, events } = play(atFirst, PLOT_CARD.id);
    expect(state.mainScheme.stageIndex).toBe(2);
    expect(state.mainScheme.completed).toBe(false);
    expect(schemeThreat(state)).toBe(1);
    expect(state.outcome).toBeNull();
    expect(events.filter((event) => event.type.startsWith("mainScheme"))).toEqual([
      { type: "mainSchemeCompleted", stageIndex: 3 },
      // The advance says what caused it (docs/phase7-wave7.md §3.12): here the stage was completed.
      { type: "mainSchemeAdvanced", stageIndex: 2, advancedBy: { cause: "completed", sourceInstanceId: null } },
    ]);
  });

  it("the final stage in the order behaves as printed: completing it loses the game", () => {
    let { state } = game(5);
    for (let i = 0; i < 4; i++) state = play(state, ADVANCE_CARD.id).state;
    expect(state.mainScheme.stageIndex).toBe(4);
    const lost = play(state, PLOT_CARD.id).state;
    expect(lost.mainScheme.completed).toBe(true);
    expect(lost.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("replays deep-equal", () => {
    let { state, session } = game(5);
    for (const cardId of [ADVANCE_CARD.id, PLOT_CARD.id, ADVANCE_CARD.id]) {
      const given = giveCard(state, p1, cardId);
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
    expect(state.mainScheme.stageIndex).toBe(1);
  });
});
