/**
 * Environment cards on the board, against a real Risky Business game.
 *
 * Criminal Enterprise lives in `state.villainArea` and gates the whole scenario — Norman Osborn takes no damage,
 * his infamy counters do — but it is neither a character nor a scheme, so until now the board had no panel that
 * could hold it and drew nothing at all. A player attacking a villain whose HP never moves has to be able to see
 * the number that does.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { WAVE1_DEPS } from "@mc/cards";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel, faceOf } from "./board-model.js";

const RISKY_BUSINESS_SOLO: SessionConfig = {
  scenarioId: "risky-business",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 11,
};

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RISKY_BUSINESS_SOLO);
  for (let step = 0; step < 10 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as { choice: { options: readonly { optionId: string }[]; minSelections: number } };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
});

/** Flips the environment (and nothing else) by hand, to read the model on the other face. */
const flipped = (base: GameState, id: InstanceId): GameState => ({
  ...base,
  instances: { ...base.instances, [id]: { ...base.instances[id]!, flipped: true, counters: { madness: 2 } } },
});

describe("environments on the board", () => {
  test("Criminal Enterprise appears, with its infamy counters spelled out", () => {
    const [environment, ...rest] = boardModel(state, me, WAVE1_DEPS).environments;
    expect(rest).toEqual([]);
    expect(environment).toMatchObject({ name: "Criminal Enterprise", subtitle: "Environment" });
    expect(environment!.counters).toEqual([{ name: "infamy", count: 2 }]);
    expect(environment!.art).not.toBeNull();
  });

  test("once flipped it reads as State of Madness, with that face's counters and art", () => {
    const [before] = boardModel(state, me, WAVE1_DEPS).environments;
    const after = flipped(state, before!.instanceId);
    const [environment] = boardModel(after, me, WAVE1_DEPS).environments;
    expect(environment!.name).toBe("State of Madness");
    expect(environment!.counters).toEqual([{ name: "madness", count: 2 }]);
    // The flipped card must not keep showing its front, or the table names one face and pictures the other.
    expect(faceOf(after, before!.instanceId)).toEqual({ kind: "flipSide" });
    expect(environment!.art).not.toEqual(before!.art);
  });

  test("the villain panel names the side in play, not the card", () => {
    expect(boardModel(state, me, WAVE1_DEPS).villain.name).toBe("Norman Osborn");
    // Card 02001a is titled "Norman Osborn"; side B is Green Goblin. Flipping the villain must rename the panel,
    // or the table keeps announcing a villain who is no longer the one dealing the damage.
    const villainId = boardModel(state, me, WAVE1_DEPS).villain.instanceId;
    const flippedVillain: GameState = { ...state, villains: state.villains.map((v) => (v.instanceId === villainId ? { ...v, side: "B" as const } : v)) };
    expect(boardModel(flippedVillain, me, WAVE1_DEPS).villain.name).toBe("Green Goblin");
  });

  test("a scenario with no environment reports none, rather than an empty-looking panel", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({ scenarioId: "rhino", difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 11 });
    expect(boardModel(store.state.game!, store.state.perspectiveId!, WAVE1_DEPS).environments).toEqual([]);
  });
});
