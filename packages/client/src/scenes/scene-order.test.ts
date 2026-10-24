import { describe, expect, it } from "vitest";
import { SCENES } from "./keys.js";
import {
  COMPANIONS,
  DEV_ONLY_SCENES,
  EAGER_SCENES,
  IdlePreloader,
  PRELOAD_FIRST,
  SCENE_ORDER,
  insertionIndex,
  needed,
  preloadOrder,
} from "./scene-order.js";
import { SCENE_LOADERS } from "./scene-table.js";

const everyKey = Object.values(SCENES) as string[];

describe("scene order and loader table", () => {
  it("lists every scene key once", () => {
    expect([...SCENE_ORDER].sort()).toEqual([...everyKey].sort());
    expect(new Set(SCENE_ORDER).size).toBe(SCENE_ORDER.length);
  });

  it("registers each scene eagerly or loads it lazily, never both, never neither", () => {
    const lazy = Object.keys(SCENE_LOADERS);
    for (const key of everyKey) {
      expect(EAGER_SCENES.includes(key) !== lazy.includes(key), key).toBe(true);
    }
    for (const key of lazy) expect(everyKey).toContain(key);
  });

  it("keeps the dev-only demos out of the table in a production build only", () => {
    // Vitest runs with `import.meta.env.DEV`, so the demos are in the table here; `scene-table.ts` gates them on it.
    for (const key of DEV_ONLY_SCENES) expect(Object.keys(SCENE_LOADERS)).toContain(key);
  });

  it("registers Boot, Title, music and the chrome eagerly, with the chrome on top", () => {
    expect(EAGER_SCENES).toEqual([
      SCENES.boot,
      SCENES.title,
      SCENES.music,
      SCENES.powerSavingNotice,
      SCENES.achievementToast,
      SCENES.languagePopup,
      SCENES.languageButton,
      SCENES.musicPlayer,
      SCENES.musicButton,
      SCENES.reportIssue,
      SCENES.reportButton,
    ]);
    expect(SCENE_ORDER.slice(-4)).toEqual([
      SCENES.musicPlayer,
      SCENES.musicButton,
      SCENES.reportIssue,
      SCENES.reportButton,
    ]);
  });

  it("only names real scenes as companions", () => {
    for (const [key, sheets] of Object.entries(COMPANIONS)) {
      expect(everyKey).toContain(key);
      for (const sheet of sheets) expect(everyKey).toContain(sheet);
    }
    expect(needed(SCENES.settings)).toEqual([SCENES.settings, ...COMPANIONS[SCENES.settings]!]);
    expect(needed(SCENES.decks)).toEqual([SCENES.decks]);
  });

  it("has Settings and the Board register every sheet they read right after launching", () => {
    expect(COMPANIONS[SCENES.settings]).toEqual(
      expect.arrayContaining([SCENES.unlocks, SCENES.saveData, SCENES.rules]),
    );
    expect(COMPANIONS[SCENES.board]).toContain(SCENES.villainPhase);
    expect(COMPANIONS[SCENES.nameConflict]).toContain(SCENES.inspect);
  });
});

describe("insertionIndex", () => {
  const eager = [...EAGER_SCENES];

  it("slots a screen below the chrome and above Title", () => {
    const at = insertionIndex(eager, SCENES.decks);
    expect(eager.slice(0, at)).toEqual([SCENES.boot, SCENES.title]);
  });

  it("keeps overlays above the screens already loaded and below the chrome", () => {
    const current = [...eager];
    current.splice(2, 0, SCENES.board, SCENES.decks);
    const at = insertionIndex(current, SCENES.settings);
    expect(current.slice(0, at)).toEqual([SCENES.boot, SCENES.title, SCENES.board, SCENES.decks]);
    current.splice(at, 0, SCENES.settings);
    expect(current.slice(at + 1, at + 2)).toEqual([SCENES.music]);
  });

  it("reproduces the canonical order whatever order the scenes load in", () => {
    const lazy = Object.keys(SCENE_LOADERS).filter((key) => !DEV_ONLY_SCENES.has(key));
    const shuffled = [...lazy].reverse().sort((a, b) => (a.length % 3) - (b.length % 3));
    const list = [...eager];
    for (const key of shuffled) list.splice(insertionIndex(list, key), 0, key);
    expect(list).toEqual(SCENE_ORDER.filter((key) => !DEV_ONLY_SCENES.has(key)));
  });

  it("puts a scene outside the order on top", () => {
    expect(insertionIndex(["a", "b"], "unknown", ["a", "b"])).toBe(2);
  });
});

describe("preloadOrder", () => {
  it("walks the likely next screens first, then the rest in draw order, without repeats", () => {
    const lazy = Object.keys(SCENE_LOADERS).filter((key) => !DEV_ONLY_SCENES.has(key));
    const order = preloadOrder(lazy);
    expect(order.slice(0, 5)).toEqual([
      SCENES.scenarioSelect,
      SCENES.guideChooser,
      SCENES.decks,
      SCENES.campaignSaga,
      SCENES.extras,
    ]);
    expect(new Set(order).size).toBe(order.length);
    expect([...order].sort()).toEqual([...lazy].sort());
    const rest = order.slice(PRELOAD_FIRST.length);
    expect(rest).toEqual(SCENE_ORDER.filter((key) => rest.includes(key)));
  });

  it("skips keys that are not asked for", () => {
    expect(preloadOrder([SCENES.extras, SCENES.pileView])).toEqual([SCENES.extras, SCENES.pileView]);
  });
});

describe("IdlePreloader", () => {
  const harness = (keys: string[], done: (key: string) => boolean = () => false) => {
    const slots: (() => void)[] = [];
    const loaded: string[] = [];
    const settle: Record<string, { resolve: () => void; reject: () => void }> = {};
    const preloader = new IdlePreloader({
      keys,
      schedule: (run) => slots.push(run),
      done,
      load: (key) => {
        loaded.push(key);
        return new Promise<void>((resolve, reject) => {
          settle[key] = { resolve, reject: () => reject(new Error("offline")) };
        });
      },
    });
    return { preloader, slots, loaded, settle };
  };
  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  it("asks for one idle slot at a time and loads one scene per slot", async () => {
    const { preloader, slots, loaded, settle } = harness(["a", "b", "c"]);
    preloader.start();
    expect(slots).toHaveLength(1);
    expect(loaded).toEqual([]);
    slots.shift()!();
    expect(loaded).toEqual(["a"]);
    await flush();
    expect(slots).toHaveLength(0); // "a" has not settled, so no second slot yet
    settle.a!.resolve();
    await flush();
    expect(slots).toHaveLength(1);
    slots.shift()!();
    expect(loaded).toEqual(["a", "b"]);
  });

  it("moves on after a load fails", async () => {
    const { preloader, slots, loaded, settle } = harness(["a", "b"]);
    preloader.start();
    slots.shift()!();
    settle.a!.reject();
    await flush();
    slots.shift()!();
    expect(loaded).toEqual(["a", "b"]);
  });

  it("skips what a tap already loaded and stops when the queue is empty", async () => {
    const loadedByTap = new Set(["a", "c"]);
    const { preloader, slots, loaded, settle } = harness(["a", "b", "c"], (key) => loadedByTap.has(key));
    preloader.start();
    slots.shift()!();
    expect(loaded).toEqual(["b"]);
    settle.b!.resolve();
    await flush();
    expect(slots).toHaveLength(0);
    expect(preloader.remaining).toBe(0);
  });

  it("starts only once", () => {
    const { preloader, slots } = harness(["a"]);
    preloader.start();
    preloader.start();
    expect(slots).toHaveLength(1);
  });
});
