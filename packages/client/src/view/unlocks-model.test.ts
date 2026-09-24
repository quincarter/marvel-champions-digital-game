import { describe, expect, it } from "vitest";
import { DEFAULT_UNLOCK_PREFS, NO_PROGRESS, UNLOCK_HEROES, Unlocks, type UnlockPrefs } from "../progression/unlocks.js";
import {
  prefsAfterTap,
  unlockAllRowOf,
  unlockListRowsOf,
  unlocksSummaryOf,
  type UnlockListRow,
} from "./unlocks-model.js";

const thor = UNLOCK_HEROES.find((h) => h.name === "Thor")!.identityCardId;
const spiderMan = UNLOCK_HEROES.find((h) => h.name === "Spider-Man")!.identityCardId;
const make = (prefs: UnlockPrefs = DEFAULT_UNLOCK_PREFS, wonScenarioIds: string[] = []) =>
  new Unlocks({ progress: { ...NO_PROGRESS, wonScenarioIds }, prefs });
const heroRow = (rows: readonly UnlockListRow[], id: string) =>
  rows.find((r): r is Extract<UnlockListRow, { kind: "hero" }> => r.kind === "hero" && r.identityCardId === id)!;

describe("unlockListRowsOf", () => {
  it("lists each wave with what opens it, then its heroes", () => {
    const rows = unlockListRowsOf(make());
    expect(rows[0]).toMatchObject({ kind: "wave", title: "Core Set", status: "Unlocked", open: true });
    const wave1 = rows.find((r) => r.id === "wave:wave1")!;
    expect(wave1).toMatchObject({ status: "Beat Rhino to unlock Wave 1", open: false });
    expect(rows.filter((r) => r.kind === "hero")).toHaveLength(UNLOCK_HEROES.length);
    expect(heroRow(rows, spiderMan).state).toBe("earned");
    expect(heroRow(rows, thor).state).toBe("off");
  });

  it("shows a hero's own switch, and hides it behind Unlock everything", () => {
    expect(heroRow(unlockListRowsOf(make({ unlockAll: false, heroIds: [thor] })), thor).state).toBe("on");
    const all = unlockListRowsOf(make({ unlockAll: true, heroIds: [] }));
    expect(heroRow(all, thor).state).toBe("all");
    expect(all.find((r) => r.id === "wave:wave1")).toMatchObject({ status: "Unlocked by setting", open: true });
    expect(heroRow(unlockListRowsOf(make(DEFAULT_UNLOCK_PREFS, ["rhino"])), thor).state).toBe("earned");
  });
});

describe("prefsAfterTap", () => {
  it("flips only a hero's own switch", () => {
    const rows = unlockListRowsOf(make());
    expect(prefsAfterTap(DEFAULT_UNLOCK_PREFS, heroRow(rows, thor))?.heroIds).toEqual([thor]);
    expect(prefsAfterTap(DEFAULT_UNLOCK_PREFS, heroRow(rows, spiderMan))).toBeNull();
    expect(prefsAfterTap(DEFAULT_UNLOCK_PREFS, rows[0]!)).toBeNull();
  });
});

describe("summaries", () => {
  it("says what's open and what's next", () => {
    expect(unlocksSummaryOf(make())).toBe("1 of 4 waves open. Next: Beat Rhino to unlock Wave 1.");
    expect(unlocksSummaryOf(make({ unlockAll: false, heroIds: [thor] }))).toBe(
      "1 of 4 waves open · 1 hero unlocked by hand. Next: Beat Rhino to unlock Wave 1.",
    );
    expect(unlocksSummaryOf(make({ unlockAll: true, heroIds: [] }))).toBe("Everything is unlocked.");
  });

  it("notes the dev param on the Unlock everything row", () => {
    const dev = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS, devUnlockAll: true });
    expect(unlockAllRowOf(dev).detail).toContain("?unlock=all");
    expect(unlockAllRowOf(make()).on).toBe(false);
  });
});
