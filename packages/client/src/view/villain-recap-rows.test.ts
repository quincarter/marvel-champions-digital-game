import { describe, expect, test } from "vitest";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { villainRecapOf } from "./villain-recap.js";
import {
  emptyWalkthrough,
  type ActivationBeat,
  type Walkthrough,
  type WalkthroughBeat,
} from "./villain-walkthrough.js";

async function table(scenarioId = "rhino"): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId,
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    seed: 7,
  });
  return store.state.game!;
}

const beat = (id: string, text: string, rest: Partial<WalkthroughBeat> = {}): WalkthroughBeat => ({
  id,
  text,
  pause: null,
  activation: null,
  ...rest,
});

const pauseOf = (text: string): WalkthroughBeat["pause"] => ({
  playerId: "p1" as PlayerId,
  promptKind: "chooseTarget",
  authority: "firstPlayerTargets",
  timing: "interrupt",
  label: text,
  soleDecider: false,
  offer: "",
});

/** A walkthrough with the given beats per step and the encounter cards revealed, over the empty one. */
function walk(
  steps: readonly (readonly WalkthroughBeat[])[],
  revealed: Walkthrough["encounter"]["revealed"] = [],
): Walkthrough {
  const base = emptyWalkthrough(1);
  return {
    ...base,
    complete: true,
    encounter: { dealt: [], revealed, current: null },
    steps: base.steps.map((step, i) => ({ ...step, beats: steps[i] ?? [], status: "done" as const })),
  };
}

const attackOn = (enemy: InstanceId, target: PlayerId, resolved: boolean): ActivationBeat => ({
  kind: "attack",
  enemyInstanceId: enemy,
  attackedPlayerId: target,
  boosts: [],
  defender: null,
  resolved: resolved
    ? { targetInstanceId: enemy, baseAtk: 3, boostIcons: 1, defenseReduction: 0, damageDealt: 4 }
    : null,
});

describe("the recap's rows", () => {
  test("'Auto-advance paused' beats are not rows, headlines or effects", async () => {
    const game = await table();
    const p1 = game.players[0]!.playerId;
    const placed = beat("b2", "1 threat placed on the scheme.", { eventType: "threatPlaced" });
    const paused = beat("b1", "Auto-advance paused — as first player, you pick the target", {
      pause: pauseOf("Auto-advance paused"),
    });
    const recap = villainRecapOf(walk([[paused, placed]]), null, game, p1, POOL_DEPS);
    expect(JSON.stringify(recap.columns)).not.toContain("Auto-advance");
    expect(recap.columns[0]!.entries[0]!.headline).toBe("1 threat placed on the scheme.");
  });

  test("the active counter moving is its own row, in the order it happened", async () => {
    const game = await table();
    const [first, second] = game.villains.map((v) => v.instanceId);
    const enemy = first!;
    const p1 = game.players[0]!.playerId;
    const hit = attackOn(enemy, p1, false);
    const moved = beat("b2", "The active villain is now X.", {
      eventType: "activeVillainChanged",
      activation: hit,
      activeChange: { from: enemy, to: second ?? enemy, reason: "effect", via: null },
    });
    const recap = villainRecapOf(
      walk([
        [],
        [beat("b1", "attacks", { eventType: "enemyActivated", activation: hit, startsActivation: true }), moved],
      ]),
      null,
      game,
      p1,
      POOL_DEPS,
    );
    const rows = recap.columns[1]!.entries;
    expect(rows.map((row) => row.kind)).toEqual(["activation", "activeVillain"]);
    expect(rows[1]!.headline).toMatch(/^Active villain → /);
    expect(rows[1]!.cardInstanceId).toBe(second ?? enemy);
  });

  test("the counter moving in the middle of an activation does not split it in two", async () => {
    const game = await table();
    const [enemy, other] = game.villains.map((v) => v.instanceId) as [InstanceId, InstanceId];
    const p1 = game.players[0]!.playerId;
    const open = attackOn(enemy, p1, false);
    const done = attackOn(enemy, p1, true);
    const beats = [
      beat("b1", "attacks", { eventType: "enemyActivated", activation: open, startsActivation: true }),
      beat("b2", "The active villain is now X.", {
        eventType: "activeVillainChanged",
        activation: open,
        activeChange: { from: enemy, to: other, reason: "effect", via: null },
      }),
      beat("b3", "Hit you.", { eventType: "attackResolved", activation: done }),
    ];
    const rows = villainRecapOf(walk([[], beats]), null, game, p1, POOL_DEPS).columns[1]!.entries;
    expect(rows.map((row) => row.kind)).toEqual(["activation", "activeVillain"]);
    expect(rows[0]!.detail).toBe("ATK 3 + boost 1 = 4");
  });

  test("an activation an encounter card starts is a row of its own, not a line of the card's text", async () => {
    const game = await table();
    const enemy = game.villains[0]!.instanceId;
    const card = game.villains[0]!.instanceId;
    const p1 = game.players[0]!.playerId;
    const open = attackOn(enemy, p1, false);
    const done = attackOn(enemy, p1, true);
    const under = { encounterInstanceId: card };
    const beats = [
      beat("b1", "Card revealed.", { ...under, eventType: "encounterCardRevealed" }),
      beat("b2", "Each minion attacks you.", {
        ...under,
        eventType: "enemyActivated",
        activation: open,
        startsActivation: true,
      }),
      beat("b3", "Hit you for 4.", { ...under, eventType: "attackResolved", activation: done }),
      beat("b4", "The card is discarded.", { ...under, eventType: "cardMoved", activation: done }),
    ];
    const recap = villainRecapOf(
      walk([[], [], [], beats], [{ instanceId: card, cardId: game.instances[card]!.cardId, playerId: p1 }]),
      null,
      game,
      p1,
      POOL_DEPS,
    );
    const rows = recap.columns[3]!.entries;
    expect(rows.map((row) => row.kind)).toEqual(["card", "activation"]);
    expect(rows[0]!.effects).toEqual(["The card is discarded."]);
    expect(rows[1]!.headline).toMatch(/ attacks you$/);
    expect(rows[1]!.detail).toBe("ATK 3 + boost 1 = 4");
  });
});

describe("the scheme tiles", () => {
  test("a second main scheme that got threat has its own tile; one that did not has none", async () => {
    const game = await table("tower-defense");
    const extra = game.extraMainSchemes?.[0]?.instanceId;
    expect(extra).toBeDefined();
    const p1 = game.players[0]!.playerId;
    const before: GameState = {
      ...game,
      instances: {
        ...game.instances,
        [extra!]: { ...game.instances[extra!]!, threat: game.instances[extra!]!.threat - 2 },
      },
    };
    const recap = villainRecapOf(walk([]), before, game, p1, POOL_DEPS);
    const threats = recap.changes.filter((tile) => tile.kind === "threat");
    expect(threats).toHaveLength(2);
    expect(threats[1]!.to! - threats[1]!.from!).toBe(2);
    const flat = villainRecapOf(walk([]), game, game, p1, POOL_DEPS);
    expect(flat.changes.filter((tile) => tile.kind === "threat")).toHaveLength(1);
  }, 30_000);
});
