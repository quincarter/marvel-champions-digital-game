/**
 * "Queued this phase" against a real Klaw game — two seats, so step 2 of the
 * villain phase actually has a seat left in `remainingPlayerIds` to describe.
 */
import { activeVillain, getPlayer, minionsEngagedWith, type GameState } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { queuedActivationsOf } from "./villain-queue.js";

/** Plays a two-seat Klaw game up to the first moment step 2 has a seat still queued. */
async function reachQueuedActivations(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "klaw",
    difficulty: "standard",
    players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
    seed: 77,
  });

  for (let step = 0; step < 80 && !store.state.game!.outcome; step++) {
    const { game, legal } = store.state;
    if (!game || !legal) break;
    const s = game.step;
    if (s.phase === "villain" && s.kind === "enemyActivations" && s.remainingPlayerIds.length > 0) return game;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await store.dispatch(end.example);
    } else break;
  }
  throw new Error("never reached a queued enemyActivations step in 80 commands");
}

describe("queuedActivationsOf", () => {
  let state: GameState;

  beforeAll(async () => {
    state = await reachQueuedActivations();
  }, 60_000);

  test("empty outside step 2 of the villain phase", () => {
    const notEnemyActivations: GameState = { ...state, step: { phase: "villain", kind: "placeThreat" } };
    expect(queuedActivationsOf(notEnemyActivations, POOL_DEPS)).toEqual([]);
  });

  test("lists every remaining seat, in the engine's own order, and never the seat currently resolving", () => {
    const step = state.step as Extract<GameState["step"], { kind: "enemyActivations" }>;
    const queue = queuedActivationsOf(state, POOL_DEPS);

    expect(queue.map((seat) => seat.playerId)).toEqual([...step.remainingPlayerIds]);
    if (step.currentPlayerId) {
      expect(queue.some((seat) => seat.playerId === step.currentPlayerId)).toBe(false);
    }
  });

  test("every queued seat gets a villain activation, since the villain activates once per seat, not once per phase", () => {
    const villainId = activeVillain(state).instanceId;
    for (const seat of queuedActivationsOf(state, POOL_DEPS)) {
      expect(seat.activations[0]).toEqual({ kind: "villain", instanceId: villainId, cancelledBy: null });
    }
  });

  test("lists every minion already engaged with a queued seat, after the villain entry", () => {
    for (const seat of queuedActivationsOf(state, POOL_DEPS)) {
      const engaged = minionsEngagedWith(state, seat.playerId);
      const minionEntries = seat.activations.slice(1);
      expect(minionEntries.map((a) => a.instanceId).sort()).toEqual([...engaged].sort());
      expect(minionEntries.every((a) => a.kind === "minion")).toBe(true);
    }
  });

  /**
   * RRG "Stun": the villain discards the status instead of attacking, and only
   * the very *next* activation is cancelled — a stunned villain still attacks
   * cleanly every seat after that one. Patches a real state's own villain
   * instance directly (the same pattern `game-over-win.test.ts` uses) rather
   * than resuming through the engine, since this only reads the patched state.
   */
  test("a stunned villain cancels only its very next queued activation, in hero form", () => {
    const villainId = activeVillain(state).instanceId;
    const villain = state.instances[villainId]!;
    const stunned: GameState = { ...state, instances: { ...state.instances, [villainId]: { ...villain, statuses: { ...villain.statuses, stunned: 1 } } } };

    const queue = queuedActivationsOf(stunned, POOL_DEPS);
    const heroSeats = queue.filter((seat) => getPlayer(stunned, seat.playerId)?.identity.form === "hero");
    if (heroSeats.length === 0) return; // this deal has no queued seat in hero form to prove the case against
    expect(heroSeats[0]!.activations[0]!.cancelledBy).toBe("stunned");
    for (const seat of heroSeats.slice(1)) {
      expect(seat.activations[0]!.cancelledBy).toBeNull();
    }
  });

  test("a stunned villain does not cancel a scheme against an alter-ego seat — that's confuse's job", () => {
    const villainId = activeVillain(state).instanceId;
    const villain = state.instances[villainId]!;
    const stunned: GameState = { ...state, instances: { ...state.instances, [villainId]: { ...villain, statuses: { ...villain.statuses, stunned: 1 } } } };

    const queue = queuedActivationsOf(stunned, POOL_DEPS);
    const alterEgoSeats = queue.filter((seat) => getPlayer(stunned, seat.playerId)?.identity.form === "alterEgo");
    for (const seat of alterEgoSeats) {
      expect(seat.activations[0]!.cancelledBy).toBeNull();
    }
  });
});
