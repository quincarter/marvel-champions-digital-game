import { describe, expect, it } from "vitest";
import type { PackState } from "../packs/pack-state.js";
import type { ModStoreTile } from "./mod-store-model.js";
import {
  failedIdsOf,
  failureOf,
  nextOf,
  resultOf,
  startRun,
  stepRun,
  updateAllBarOf,
  updateAllQueueOf,
  type UpdateAllBarInput,
} from "./mod-store-update-all.js";

const tile = (id: string, state: PackState, name = id): ModStoreTile => ({ id, name, state }) as ModStoreTile;

/** `count` pending packs: p0, p1, ... */
const packs = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Pack ${i}` }));

const bar = (over: Partial<UpdateAllBarInput>) =>
  updateAllBarOf({ pending: [], run: null, progress: null, result: null, busy: false, lang: "en", ...over });

describe("updateAllQueueOf", () => {
  it("takes only the packs with an installable update, by name", () => {
    const queue = updateAllQueueOf([
      tile("z", "update", "Zed"),
      tile("a", "installed", "Alpha"),
      tile("n", "needs-app-update", "Newer game"),
      tile("w", "withdrawn", "Gone"),
      tile("b", "update", "Beta"),
      tile("i", "install", "Not installed"),
    ]);
    expect(queue).toEqual([
      { id: "b", name: "Beta" },
      { id: "z", name: "Zed" },
    ]);
  });
});

describe("a run", () => {
  const queue = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
    { id: "c", name: "Gamma" },
  ];

  it("walks the queue, counting updates and failures", () => {
    let run = startRun(queue);
    expect(nextOf(run)?.id).toBe("a");
    run = stepRun(run, true);
    expect(nextOf(run)?.id).toBe("b");
    run = stepRun(run, false, "The download failed.");
    run = stepRun(run, true);
    expect(nextOf(run)).toBeNull();
    expect(resultOf(run)).toEqual({
      updated: 2,
      failed: [{ id: "b", name: "Beta", error: "The download failed." }],
      stopped: false,
    });
  });

  it("ends after the current pack once Stop is pressed", () => {
    let run = stepRun(startRun(queue), true);
    run = { ...run, stopping: true };
    expect(nextOf(run)).toBeNull();
    expect(resultOf(stepRun(run, true))).toEqual({ updated: 2, failed: [], stopped: true });
  });
});

describe("updateAllBarOf", () => {
  it("shows nothing with no update and no run to report", () => {
    expect(bar({})).toBeNull();
  });

  it("offers Update all with the count, held while another install runs", () => {
    expect(bar({ pending: packs(8) })).toEqual({
      text: "8 installed packs have updates.",
      fraction: null,
      action: { id: "update-all", label: "Update all", enabled: true },
      show: null,
    });
    expect(bar({ pending: packs(1) })?.text).toBe("1 installed pack has an update.");
    expect(bar({ pending: packs(2), busy: true })?.action?.enabled).toBe(false);
  });

  it("names the pack updating now and fills across the whole run", () => {
    const run = stepRun(
      startRun([
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ]),
      true,
    );
    const shown = bar({ pending: packs(1), run, progress: { phase: "done" } });
    expect(shown?.text).toBe("Updating 2 of 2: Beta");
    expect(shown?.fraction).toBe(1);
    expect(shown?.action).toEqual({ id: "stop", label: "Stop", enabled: true });
    expect(bar({ pending: packs(1), run, progress: null })?.fraction).toBe(0.5);
    expect(bar({ pending: packs(1), run: { ...run, stopping: true }, progress: null })?.action).toEqual({
      id: "stop",
      label: "Stopping after this one",
      enabled: false,
    });
  });

  it("reports how the last run ended", () => {
    expect(bar({ result: { updated: 8, failed: [], stopped: false } })).toEqual({
      text: "8 packs updated.",
      fraction: null,
      action: null,
      show: null,
    });
    // Failures are counted, not listed: their tiles are marked, so eight long names never crowd a phone's bar.
    const result = { updated: 6, failed: packs(2).map((item) => ({ ...item, error: null })), stopped: false };
    const failed = bar({ pending: packs(2), result });
    expect(failed?.text).toBe(
      "6 packs updated. 2 packs could not update and kept their old versions. They are marked ! below: open one to try again.",
    );
    expect(failed?.action?.id).toBe("update-all");
    expect(bar({ pending: packs(1), result })?.text).toBe(
      "6 packs updated. 1 pack could not update and kept its old version. It is marked ! below: open it to try again.",
    );
    expect(bar({ pending: packs(3), result: { updated: 1, failed: [], stopped: true } })?.text).toBe(
      "1 pack updated. Stopped. The rest can still update.",
    );
  });

  it("drops a failure once it has been retried from its page", () => {
    const result = { updated: 1, failed: [{ id: "p0", name: "Pack 0", error: "No space." }], stopped: false };
    expect(failedIdsOf(result, packs(2))).toEqual(new Set(["p0"]));
    // p0 updated since: it no longer has an update, so it is neither marked nor counted, and nothing is left to do.
    expect(failedIdsOf(result, [])).toEqual(new Set());
    expect(bar({ pending: [], result })).toEqual({ text: "1 pack updated.", fraction: null, action: null, show: null });
    expect(failedIdsOf(null, packs(2)).size).toBe(0);
  });

  it("offers Show them when the tab or the search hides a failed pack", () => {
    const result = { updated: 1, failed: [{ id: "p1", name: "Pack 1", error: null }], stopped: false };
    const show = { id: "show-failed", label: "Show them", enabled: true };
    expect(bar({ pending: packs(2), result, shown: new Set(["p0"]) })?.show).toEqual(show);
    expect(bar({ pending: packs(2), result, shown: new Set(["p0", "p1"]) })?.show).toBeNull();
    // Nothing failed, or the failure was retried: nothing to show.
    expect(bar({ pending: packs(2), shown: new Set() })?.show).toBeNull();
    expect(bar({ pending: [], result, shown: new Set() })?.show).toBeNull();
  });

  it("keeps why each pack failed for its page, until it is retried", () => {
    const result = {
      updated: 0,
      failed: [
        { id: "p0", name: "Pack 0", error: "The download failed." },
        { id: "p1", name: "Pack 1", error: "No space." },
      ],
      stopped: false,
    };
    expect(failureOf(result, packs(2), "p0")).toBe("The download failed.");
    expect(failureOf(result, packs(2), "p1")).toBe("No space.");
    expect(failureOf(result, [{ id: "p1" }], "p0")).toBeNull();
    expect(failureOf(null, packs(2), "p0")).toBeNull();
  });

  it("speaks Spanish", () => {
    expect(bar({ pending: packs(8), lang: "es" })).toEqual({
      text: "8 paquetes instalados tienen actualizaciones.",
      fraction: null,
      action: { id: "update-all", label: "Actualizar todo", enabled: true },
      show: null,
    });
  });
});
