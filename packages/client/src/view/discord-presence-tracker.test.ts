import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DiscordActivity, PresenceGame } from "./discord-presence.js";
import { PRESENCE_DEBOUNCE_MS, PresenceTracker } from "./discord-presence-tracker.js";

const GAME: PresenceGame = {
  kind: "campaign",
  campaignId: "mts",
  heroes: ["Spider-Man"],
  form: "hero",
  villain: "Rhino",
  round: 1,
  phase: "player",
};

function rig(enabled = true) {
  let now = 1_000_000;
  let next = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const sent: (DiscordActivity | null)[] = [];
  const tracker = new PresenceTracker(
    {
      now: () => now,
      setTimer: (run, ms) => {
        timers.set(next, { at: now + ms, run });
        return next++;
      },
      clearTimer: (handle) => void timers.delete(handle as number),
      emit: (activity) => sent.push(activity),
      runCampaignName: async (runId) =>
        runId === "run1"
          ? { campaignId: "sm", name: "Run 1" }
          : runId === "run2"
            ? { campaignId: "mts", name: "My run" }
            : null,
    },
    enabled,
  );
  tracker.setCampaignNames({ mts: "The Mad Titan's Shadow", sm: "Sinister Motives" });
  const advance = (ms: number): void => {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.run();
      }
    }
  };
  return { tracker, sent, advance, timers };
}

describe("PresenceTracker", () => {
  test("a burst of changes is one send, a second after the first", () => {
    const { tracker, sent, advance } = rig();
    tracker.sceneUp("Title");
    tracker.sceneUp("Decks");
    tracker.sceneDown("Decks");
    advance(PRESENCE_DEBOUNCE_MS - 1);
    expect(sent).toHaveLength(0);
    advance(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.details).toBe("In the menus");
  });

  test("an unchanged activity is not sent twice", () => {
    const { tracker, sent, advance } = rig();
    tracker.sceneUp("Title");
    advance(PRESENCE_DEBOUNCE_MS);
    tracker.sceneUp("Title");
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent).toHaveLength(1);
  });

  test("the table's summary names the game, and a new game key restarts the clock", () => {
    const { tracker, sent, advance } = rig();
    tracker.sceneUp("Board");
    tracker.setGame(GAME, "g1");
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[0]).toMatchObject({ details: "Campaign · The Mad Titan's Shadow · vs Rhino", startTimestamp: 1001 });
    advance(5000);
    tracker.setGame({ ...GAME, round: 2 }, "g1");
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[1]?.startTimestamp).toBe(1001);
    tracker.setGame(GAME, "g2");
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[2]?.startTimestamp).toBe(1008);
  });

  test("the Board without a summary reads as the menus", () => {
    const { tracker, sent, advance } = rig();
    tracker.sceneUp("Board");
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[0]?.details).toBe("In the menus");
  });

  test("off clears at once and cancels the pending look; on shows it again", () => {
    const { tracker, sent, advance, timers } = rig();
    tracker.sceneUp("Title");
    advance(PRESENCE_DEBOUNCE_MS);
    tracker.sceneUp("Decks");
    tracker.setEnabled(false);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBeNull();
    expect(timers.size).toBe(0);
    tracker.sceneDown("Decks");
    tracker.sceneUp("Seats");
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent).toHaveLength(2);
    tracker.setEnabled(true);
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[2]?.state).toBe("Setting up a game");
  });

  test("a clear with nothing shown sends nothing; after a failed send the same activity goes out again", () => {
    const { tracker, sent, advance } = rig();
    tracker.clear();
    expect(sent).toHaveLength(0);
    tracker.sceneUp("Title");
    advance(PRESENCE_DEBOUNCE_MS);
    tracker.sendFailed();
    tracker.sceneUp("Title");
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent).toHaveLength(2);
  });

  test("a stored run names its campaign by the shelf's box name, else its own", async () => {
    const { tracker, sent, advance } = rig();
    tracker.sceneUp("CampaignRun", { runId: "run2" });
    advance(PRESENCE_DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[1]?.details).toBe("Campaign · The Mad Titan's Shadow");
  });

  test("a stored run names its campaign once the worker has read it", async () => {
    const { tracker, sent, advance } = rig();
    tracker.sceneUp("CampaignRun", { runId: "run1" });
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[0]?.details).toBe("Campaign");
    await Promise.resolve();
    await Promise.resolve();
    advance(PRESENCE_DEBOUNCE_MS);
    expect(sent[1]?.details).toBe("Campaign · Sinister Motives");
  });
});

describe("the main thread's part", () => {
  const source = readFileSync(fileURLToPath(new URL("../platform/discord-presence.ts", import.meta.url)), "utf8");
  test("has no timers, store subscription or diffing", () => {
    expect(source).not.toMatch(/setInterval|setTimeout|\.subscribe\(|presenceKey|presenceOf|presenceGameOf/);
  });
});
