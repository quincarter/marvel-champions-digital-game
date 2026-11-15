import { describe, expect, test } from "vitest";
import type { ReplayHost } from "./replay-host.js";
import { exportPastGame, sharePastGame, type PastGameActionDeps } from "./past-game-actions.js";

/** A worker whose open and exports wait until the test lets them go, so Back can land in between. */
function harness(info: { length: number; total: number; failure: unknown } = { length: 40, total: 40, failure: null }) {
  const calls: string[] = [];
  let release!: () => void;
  const opened = new Promise<void>((resolve) => (release = resolve));
  let disposed = 0;
  const host = {
    info,
    exportFile: async () => ({ bytes: new Uint8Array([1]), name: "game.mcreplay" }),
    exportLog: async () => ({ text: "log", name: "game.txt" }),
    dispose: () => void disposed++,
  } as unknown as ReplayHost;
  let current = true;
  const deps: PastGameActionDeps = {
    open: async () => {
      await opened;
      return host;
    },
    current: () => current,
    deliverFile: async (_bytes, name) => void calls.push(`file ${name}`),
    deliverLog: async (_text, name) => void calls.push(`log ${name}`),
    shareLink: async () => {
      calls.push("upload");
      return { ok: true, url: "https://x/#replay=a" };
    },
  };
  return {
    deps,
    calls,
    release,
    back: () => (current = false),
    disposed: () => disposed,
  };
}

describe("Past games actions", () => {
  test("Export and Log hand the file out and close the worker", async () => {
    const h = harness({ length: 12, total: 40, failure: { commandIndex: 12, message: "x" } });
    h.release();
    expect(await exportPastGame("g", "export", h.deps)).toEqual({ kind: "delivered", stopsAt: null });
    // A log this build can't play to the end says where it stops.
    expect(await exportPastGame("g", "log", h.deps)).toEqual({ kind: "delivered", stopsAt: 12 });
    expect(h.calls).toEqual(["file game.mcreplay", "log game.txt"]);
    expect(h.disposed()).toBe(2);
  });

  for (const what of ["export", "log"] as const) {
    test(`Back while the worker opens: ${what} opens no save dialog, and the worker is closed`, async () => {
      const h = harness();
      const pending = exportPastGame("g", what, h.deps);
      h.back();
      h.release();
      expect(await pending).toEqual({ kind: "stale" });
      expect(h.calls).toEqual([]);
      expect(h.disposed()).toBe(1);
    });
  }

  test("Share uploads and answers the link; Back while the worker opens uploads nothing", async () => {
    const live = harness();
    live.release();
    expect(await sharePastGame("g", live.deps)).toEqual({ ok: true, url: "https://x/#replay=a" });
    expect(live.calls).toEqual(["upload"]);

    const stale = harness();
    const pending = sharePastGame("g", stale.deps);
    stale.back();
    stale.release();
    expect(await pending).toEqual({ ok: "stale" });
    expect(stale.calls).toEqual([]);
    expect(stale.disposed()).toBe(1);
  });
});
