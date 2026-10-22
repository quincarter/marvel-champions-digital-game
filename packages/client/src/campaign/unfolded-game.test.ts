import { describe, expect, it } from "vitest";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { gameInProgressOf, unfoldedGameOf } from "./unfolded-game.js";

// Only the fields `unfoldedGameOf` reads; the rest of a record or save never matters to it.
const recordOf = (
  over: { attempt?: string | null; history?: { nodeId: string; at: number; gameId: string | null }[] } = {},
): CampaignRecord =>
  ({
    id: "run-1",
    campaignId: "trors",
    createdAt: 100,
    history: over.history ?? [],
    ...(over.attempt === null ? {} : { attempt: { nodeId: over.attempt ?? "crossbones" } }),
  }) as unknown as CampaignRecord;

const saveOf = (id: string, over: Partial<SaveMeta> = {}): SaveMeta =>
  ({
    id,
    createdAt: 200,
    updatedAt: 300,
    status: "won",
    outcome: { result: "win" },
    campaignId: "trors",
    campaignNodeId: "crossbones",
    ...over,
  }) as unknown as SaveMeta;

describe("unfoldedGameOf (issue #265)", () => {
  it("finds the won game a player left Game over without folding", () => {
    expect(unfoldedGameOf(recordOf(), [saveOf("g1")])?.id).toBe("g1");
  });

  it("finds a lost or conceded game the same way: any ended game is a result to fold", () => {
    const lost = saveOf("g1", { status: "lost", outcome: { result: "loss" } as SaveMeta["outcome"] });
    expect(unfoldedGameOf(recordOf(), [lost])?.id).toBe("g1");
    const conceded = saveOf("g2", { status: "abandoned", outcome: { result: "conceded" } as SaveMeta["outcome"] });
    expect(unfoldedGameOf(recordOf(), [conceded])?.id).toBe("g2");
  });

  it("finds nothing when no issue is composed (the game was already folded)", () => {
    expect(unfoldedGameOf(recordOf({ attempt: null }), [saveOf("g1")])).toBeNull();
  });

  it("leaves a game still being played to Continue", () => {
    const playing = saveOf("g1", { status: "active", outcome: null });
    expect(unfoldedGameOf(recordOf(), [playing])).toBeNull();
  });

  it("prefers the newest game of the node, so a newer game still in play wins over an older finished one", () => {
    const finished = saveOf("old", { createdAt: 200 });
    const playing = saveOf("new", { createdAt: 250, status: "active", outcome: null });
    expect(unfoldedGameOf(recordOf(), [finished, playing])).toBeNull();
  });

  it("ignores a game from before the last fold: an earlier lost attempt at the same node", () => {
    const record = recordOf({ history: [{ nodeId: "crossbones", at: 500, gameId: null }] });
    expect(unfoldedGameOf(record, [saveOf("earlier", { createdAt: 400 })])).toBeNull();
    expect(unfoldedGameOf(record, [saveOf("retry", { createdAt: 600 })])?.id).toBe("retry");
  });

  it("ignores a game the history already names", () => {
    const record = recordOf({ history: [{ nodeId: "crossbones", at: 50, gameId: "g1" }] });
    expect(unfoldedGameOf(record, [saveOf("g1")])).toBeNull();
  });

  it("ignores other boxes, other nodes, standalone games and saves that no longer replay", () => {
    expect(unfoldedGameOf(recordOf(), [saveOf("a", { campaignId: "gmw" })])).toBeNull();
    expect(unfoldedGameOf(recordOf(), [saveOf("b", { campaignNodeId: "absorbing-man" })])).toBeNull();
    expect(unfoldedGameOf(recordOf(), [saveOf("c", { campaignId: null, campaignNodeId: null })])).toBeNull();
    expect(unfoldedGameOf(recordOf(), [saveOf("d", { status: "incompatible" })])).toBeNull();
  });
});

describe("gameInProgressOf", () => {
  it("finds the composed issue's game still being played, so Open issue resumes it", () => {
    const playing = saveOf("g1", { status: "active", outcome: null });
    expect(gameInProgressOf(recordOf(), [playing])?.id).toBe("g1");
  });

  it("finds nothing once that game has ended, for another node, or with no composed issue", () => {
    expect(gameInProgressOf(recordOf(), [saveOf("g1")])).toBeNull();
    const elsewhere = saveOf("g2", { status: "active", outcome: null, campaignNodeId: "absorbing-man" });
    expect(gameInProgressOf(recordOf(), [elsewhere])).toBeNull();
    expect(
      gameInProgressOf(recordOf({ attempt: null }), [saveOf("g3", { status: "active", outcome: null })]),
    ).toBeNull();
  });
});

describe("two runs of one box at the same issue (#276)", () => {
  const withSeed = (seed: number): CampaignRecord => {
    const record = recordOf();
    return { ...record, attempt: { ...record.attempt!, input: { seed } } } as unknown as CampaignRecord;
  };
  const saveWithSeed = (id: string, seed: number, over: Partial<SaveMeta> = {}): SaveMeta =>
    saveOf(id, { config: { campaign: { seed } } as unknown as SaveMeta["config"], ...over });

  it("each run finds its own game in progress, never the other's", () => {
    const a = saveWithSeed("game-a", 1, { status: "active", outcome: null, createdAt: 300 });
    const b = saveWithSeed("game-b", 2, { status: "active", outcome: null, createdAt: 400 });
    expect(gameInProgressOf(withSeed(1), [a, b])?.id).toBe("game-a");
    expect(gameInProgressOf(withSeed(2), [a, b])?.id).toBe("game-b");
  });

  it("each run's finished game is its own to fold", () => {
    const a = saveWithSeed("game-a", 1);
    const b = saveWithSeed("game-b", 2, { createdAt: 400 });
    expect(unfoldedGameOf(withSeed(1), [a, b])?.id).toBe("game-a");
  });

  it("a game the player removed (abandoned, never finished) is not resumed and not folded", () => {
    const removed = saveWithSeed("gone", 1, { status: "abandoned", outcome: null });
    expect(gameInProgressOf(withSeed(1), [removed])).toBeNull();
    expect(unfoldedGameOf(withSeed(1), [removed])).toBeNull();
    // An older game still in progress is found behind the removed newer one.
    const older = saveWithSeed("older", 1, { status: "active", outcome: null, createdAt: 150 });
    const newerGone = { ...removed, createdAt: 500 };
    expect(gameInProgressOf(withSeed(1), [newerGone, older])?.id).toBe("older");
  });
});
