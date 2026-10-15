/**
 * A character another card holds is drawn with the minions, tagged with its holder: Thunderbolt Backup's held minion
 * (`aos` 50131b; MC50 p. 15: in play, engaged with nobody) and an ally attached under no player's control (M.O.D.O.K.'s
 * hostage). Read off the engine's own `isHeldMinion` / `isCaptiveAlly`.
 */
import { describe, expect, test } from "vitest";
import { getInstance, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { logLine } from "./log-lines.js";
import { placementNotes } from "./inspect-notes.js";

async function thunderbolts() {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "thunderbolts",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 5,
  });
  return { game: store.state.game!, me: store.state.perspectiveId! };
}

describe("a minion an environment holds", () => {
  test("has its own tile, named for its holder, engaged with nobody", async () => {
    const { game, me } = await thunderbolts();
    const model = boardModel(game, me, POOL_DEPS);
    const held = model.minions.filter((minion) => minion.heldBy !== null);
    expect(held).toHaveLength(1);
    const panel = held[0]!;
    expect(panel.heldBy).toMatchObject({ kind: "held", hostName: "Thunderbolt Backup" });
    expect(panel.engagedWith).toBeNull();
    expect(panel.hp).not.toBeNull();
    expect(panel.stats.length).toBeGreaterThan(0);
    // The holder is the environment on the board, and the tile comes first, beside it.
    expect(model.environments.map((environment) => environment.instanceId)).toContain(panel.heldBy!.hostId);
    expect(model.minions[0]!.instanceId).toBe(panel.instanceId);
    // Other minions are the engaged ones, never tagged.
    for (const minion of model.minions.filter((m) => m !== panel)) expect(minion.heldBy).toBeNull();
    // A held minion is engaged with no one, so its Guard guards no one: off in words. The engaged one's Guard is live.
    expect(panel.keywords).toContain("guard");
    expect(panel.inactiveKeywords).toEqual(["guard"]);
    for (const minion of model.minions.filter((m) => m !== panel)) expect(minion.inactiveKeywords).toEqual([]);
    expect(placementNotes(game, panel.instanceId)[0]).toBe(
      "Held by Thunderbolt Backup: in play, engaged with no player, does not activate",
    );
  }, 120_000);

  test("the swap's two sides both read in the log: one is held, the other leaves its holder and engages", async () => {
    const { game, me } = await thunderbolts();
    const panel = boardModel(game, me, POOL_DEPS).minions.find((minion) => minion.heldBy !== null)!;
    const id = panel.instanceId;
    const host = panel.heldBy!.hostId;
    const held = logLine(
      { type: "minionHeld", instanceId: id, hostInstanceId: host, engagedBefore: me },
      game,
      me,
      POOL_DEPS,
    );
    expect(held?.text).toBe(`${panel.name} is held by Thunderbolt Backup.`);
    const released = logLine(
      {
        type: "cardMoved",
        instanceId: id,
        cardId: game.instances[id]!.cardId,
        from: { kind: "attachment", hostInstanceId: host },
        to: { kind: "playArea", playerId: me },
      },
      game,
      me,
      POOL_DEPS,
    );
    expect(released?.text).toBe(`${panel.name} leaves Thunderbolt Backup and engages you.`);
  }, 120_000);

  test("a captive ally on a card is tagged the same way, as a captive", async () => {
    const { game, me } = await thunderbolts();
    const model = boardModel(game, me, POOL_DEPS);
    const host = model.environments[0]!.instanceId;
    // Stage an ally in the player's play area as attached to the environment under nobody's control.
    const ally = game.players[0]!.hand.find((id) => game.cardPool[game.instances[id]!.cardId]?.type === "ally") as
      | InstanceId
      | undefined;
    expect(ally).toBeDefined();
    const staged: GameState = {
      ...game,
      players: game.players.map((player, index) =>
        index === 0
          ? { ...player, hand: player.hand.filter((id) => id !== ally), playArea: [...player.playArea, ally!] }
          : player,
      ),
      instances: {
        ...game.instances,
        [ally!]: { ...getInstance(game, ally!)!, attachedTo: host, controllerId: null },
        [host]: { ...game.instances[host]!, attachments: [...game.instances[host]!.attachments, ally!] },
      },
    };
    const panel = boardModel(staged, me, POOL_DEPS).minions.find((minion) => minion.instanceId === ally);
    expect(panel?.heldBy).toMatchObject({ kind: "captive", hostId: host });
  }, 120_000);
});
