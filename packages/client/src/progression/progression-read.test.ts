import { describe, expect, test, vi } from "vitest";

// Each `listSaves` call hands back a promise this test settles itself, so it decides which read lands first.
const reads: Array<(saves: unknown[]) => void> = [];
vi.mock("../session.js", () => ({
  appSession: () => ({
    store: { listSaves: () => new Promise((resolve) => reads.push(resolve)) },
    settings: { promoArt: [], promoArtOn: false },
  }),
  campaignService: () => ({ storage: { list: () => Promise.resolve([]) } }),
  deckStorage: () => ({ list: () => Promise.resolve([]) }),
}));

const { onProgressRead, refreshUnlocks } = await import("./progression.js");

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("a progress read that lands after Boot went on without it (issue #871)", () => {
  test("tells the screen that is up, though the screen's own read is still pending", async () => {
    const heard: boolean[] = [];
    const stop = onProgressRead((changed) => heard.push(changed));
    // Boot's read, given up on after its time, then Title's, which never lands.
    const boot = refreshUnlocks();
    void refreshUnlocks();
    await flush();
    expect(reads).toHaveLength(2);
    reads[0]!([]);
    await boot;
    await flush();
    expect(heard).toHaveLength(1);
    stop();
  });
});
