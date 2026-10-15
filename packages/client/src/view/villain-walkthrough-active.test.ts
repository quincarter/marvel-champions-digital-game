import { describe, expect, test } from "vitest";
import type { GameEvent, GameState } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { villainRecapOf } from "./villain-recap.js";
import { appendWalkthrough, emptyWalkthrough } from "./villain-walkthrough.js";

async function breakout(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "breakout",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    seed: 7,
  });
  return store.state.game!;
}

describe("the active counter moving, in the walkthrough", () => {
  test("its beat carries who holds the counter now and why", async () => {
    const game = await breakout();
    const [from, to] = game.villains.map((v) => v.instanceId);
    const events = [
      { type: "stepChanged", from: game.step, to: { phase: "villain", kind: "placeThreat" } },
      { type: "activeVillainChanged", from: from!, to: to!, reason: "nextInRow" },
    ] as unknown as GameEvent[];
    const walkthrough = appendWalkthrough(emptyWalkthrough(1), events, game, game.players[0]!.playerId, POOL_DEPS);
    const beats = walkthrough.steps[0]!.beats;
    const moved = beats.find((beat) => beat.eventType === "activeVillainChanged");
    expect(moved?.activeChange).toEqual({ from, to, reason: "nextInRow", via: null });
    expect(beats.filter((beat) => beat.activeChange !== undefined)).toHaveLength(1);
  });
});

describe("an activation an encounter card starts", () => {
  test("has no enemyActivated, so its first boost card begins it and its resolution settles it", async () => {
    const game = await breakout();
    const p1 = game.players[0]!.playerId;
    const enemy = game.villains[0]!.instanceId;
    const card = game.villains[1]!.instanceId;
    const boost = game.villains[2]!.instanceId;
    const scheme = game.mainScheme.instanceId;
    const events = [
      { type: "stepChanged", from: game.step, to: { phase: "villain", kind: "revealEncounterCards" } },
      { type: "encounterCardRevealed", instanceId: card, cardId: game.instances[card]!.cardId, playerId: p1 },
      { type: "boostCardFlipped", enemyInstanceId: enemy, instanceId: boost, boostIcons: 1 },
      {
        type: "schemeResolved",
        enemyInstanceId: enemy,
        schemeInstanceId: scheme,
        baseSch: 2,
        boostIcons: 1,
        threatBonus: 0,
        threatPlaced: 3,
      },
    ] as unknown as GameEvent[];
    const walkthrough = appendWalkthrough(emptyWalkthrough(1), events, game, p1, POOL_DEPS);
    const beats = walkthrough.steps[3]!.beats;
    const flipped = beats.find((beat) => beat.eventType === "boostCardFlipped")!;
    expect(flipped.startsActivation).toBe(true);
    expect(flipped.activation).toMatchObject({ kind: "scheme", provisional: true, resolved: null });
    const settled = beats.find((beat) => beat.eventType === "schemeResolved")!;
    expect(settled.startsActivation).toBeUndefined();
    expect(settled.activation).toMatchObject({ kind: "scheme", resolved: { baseSch: 2, threatPlaced: 3 } });
    expect(settled.activation).not.toHaveProperty("provisional");
    expect(settled.activation).toMatchObject({ boosts: [{ instanceId: boost, boostIcons: 1 }] });

    // ... and the recap gives it a row of its own under the card, with the scheme that took the threat.
    const rows = villainRecapOf({ ...walkthrough, complete: true }, null, game, p1, POOL_DEPS).columns[3]!.entries;
    expect(rows.map((row) => row.kind)).toEqual(["card", "activation"]);
    expect(rows[0]!.effects).toEqual([]);
    expect(rows[1]!.detail).toBe("SCH 2 + boost 1 = 3 → Breakout");
  });
});
