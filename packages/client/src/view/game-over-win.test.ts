/**
 * The game-over story for a *win*, checked against a real win.
 *
 * No scripted game reaches one: the greedy test driver lost every one of 450
 * solo games across all three Core scenarios and six starter decks, and every
 * e2e table. So this fixture starts a real Rhino game, saves it, and rewrites
 * the saved baseline to put Rhino on his last stage one hit from defeat — then
 * resumes it through the real host exactly as a refresh would, and lands that
 * hit with a real basic attack. Everything after the baseline is the engine's
 * own doing: the defeat, the outcome, the events the record folds and the
 * sentences the model builds from them.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { remainingHitPoints, type GameState } from "@mc/engine";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { gameOverModel } from "./game-over-model.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** A saved Rhino game whose baseline has Rhino on his last stage with 1 hit point left, resumed. */
async function nearWin(): Promise<SessionStore> {
  const storage = new MemoryGameStorage();
  const first = new SessionStore(new LocalEngineHost(storage));
  await first.start(RHINO_SOLO);
  const meta = (await storage.latestActive())!;
  const saved = (await storage.load(meta.id))!;

  const base = saved.initialState;
  const villainId = base.villain.instanceId;
  const onLastStage: StateWithoutPool = { ...base, villain: { ...base.villain, stageIndex: base.villain.lastStageIndex } };
  const remaining = remainingHitPoints({ ...onLastStage, cardPool: first.state.game!.cardPool } as GameState, villainId, CORE_DEPS)!;
  const villain = onLastStage.instances[villainId]!;
  const patched: StateWithoutPool = {
    ...onLastStage,
    instances: { ...onLastStage.instances, [villainId]: { ...villain, damage: villain.damage + remaining - 1 } },
  };
  await storage.create({ ...meta, id: "near-win", status: "active", commandCount: 0, updatedAt: meta.updatedAt + 1 }, patched);

  const store = new SessionStore(new LocalEngineHost(storage));
  await store.resume("near-win");
  return store;
}

/** Decline the mulligan, flip to Spider-Man, attack. Enough to land one hit. */
async function finishIt(store: SessionStore): Promise<void> {
  for (let step = 0; step < 40 && !store.state.game!.outcome; step++) {
    const { legal, game } = store.state;
    if (!legal || !game) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
      continue;
    }
    if (legal.actions.kind !== "turn") break;
    const pick = (kind: string) => legal.actions.kind === "turn" && legal.actions.legal.find((entry) => entry.action.kind === kind);
    const flip = game.players[0]!.identity.form === "alterEgo" ? pick("changeForm") : undefined;
    const next = flip || pick("basicAttack") || pick("endTurn");
    if (!next) break;
    await store.dispatch(next.example);
  }
}

describe("game over model, won", () => {
  let store: SessionStore;

  beforeAll(async () => {
    store = await nearWin();
    await finishIt(store);
  }, 60_000);

  test("the game really was won, by defeating the villain", () => {
    expect(store.state.game!.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  test("a won game reads as a win: headline, final blow, the stage cleared, and how it was won", () => {
    const { game, record, config } = store.state;
    const model = gameOverModel(game!, record, config, CORE_DEPS);
    expect(model.tone).toBe("win");
    expect(model.headline).toBe("Rhino defeated");
    expect(model.kicker).toMatch(/^Stage II cleared$/);
    expect(model.beatsHeading).toBe("How it was won");
    // The last hit was Spider-Man's basic attack, and the record knows it.
    expect(model.finalBlow?.title).toMatch(/landed the last \d+/);
    expect(model.stats[0]!.value).toMatch(/cleared$/);
    expect(model.quickStats.map((stat) => stat.label)).toEqual(["Rounds", "Dmg dealt", "Hero KOs"]);
  });

  test("the phone's MVP row names the seat that did the damage", () => {
    const { game, record, config } = store.state;
    const model = gameOverModel(game!, record, config, CORE_DEPS);
    expect(model.mvp).not.toBeNull();
    expect(model.mvp!.detail).toMatch(/^\d+ damage$/);
  });
});
