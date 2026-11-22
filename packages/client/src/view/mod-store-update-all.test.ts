import { describe, expect, it } from "vitest";
import type { PackState } from "../packs/pack-state.js";
import type { ModStoreTile } from "./mod-store-model.js";
import {
  nextOf,
  resultOf,
  startRun,
  stepRun,
  updateAllBarOf,
  updateAllQueueOf,
  type UpdateAllBarInput,
} from "./mod-store-update-all.js";

const tile = (id: string, state: PackState, name = id): ModStoreTile => ({ id, name, state }) as ModStoreTile;

const bar = (over: Partial<UpdateAllBarInput>) =>
  updateAllBarOf({ pending: 0, run: null, progress: null, result: null, busy: false, lang: "en", ...over });

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
    run = stepRun(run, false);
    run = stepRun(run, true);
    expect(nextOf(run)).toBeNull();
    expect(resultOf(run)).toEqual({ updated: 2, failed: ["Beta"], stopped: false });
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
    expect(bar({ pending: 8 })).toEqual({
      text: "8 installed packs have updates.",
      fraction: null,
      action: { id: "update-all", label: "Update all", enabled: true },
    });
    expect(bar({ pending: 1 })?.text).toBe("1 installed pack has an update.");
    expect(bar({ pending: 2, busy: true })?.action?.enabled).toBe(false);
  });

  it("names the pack updating now and fills across the whole run", () => {
    const run = stepRun(
      startRun([
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ]),
      true,
    );
    const shown = bar({ pending: 1, run, progress: { phase: "done" } });
    expect(shown?.text).toBe("Updating 2 of 2: Beta");
    expect(shown?.fraction).toBe(1);
    expect(shown?.action).toEqual({ id: "stop", label: "Stop", enabled: true });
    expect(bar({ pending: 1, run, progress: null })?.fraction).toBe(0.5);
    expect(bar({ pending: 1, run: { ...run, stopping: true }, progress: null })?.action).toEqual({
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
    });
    const failed = bar({ pending: 1, result: { updated: 7, failed: ["Beta"], stopped: false } });
    expect(failed?.text).toBe("7 packs updated. Could not update: Beta. Open a pack to try it again.");
    expect(failed?.action?.id).toBe("update-all");
    expect(bar({ pending: 3, result: { updated: 1, failed: [], stopped: true } })?.text).toBe(
      "1 pack updated. Stopped. The rest can still update.",
    );
  });

  it("speaks Spanish", () => {
    expect(updateAllBarOf({ pending: 8, run: null, progress: null, result: null, busy: false, lang: "es" })).toEqual({
      text: "8 paquetes instalados tienen actualizaciones.",
      fraction: null,
      action: { id: "update-all", label: "Actualizar todo", enabled: true },
    });
  });
});
