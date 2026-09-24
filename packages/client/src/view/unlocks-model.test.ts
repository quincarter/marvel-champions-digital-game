import { describe, expect, it } from "vitest";
import {
  DEFAULT_UNLOCK_PREFS,
  NO_PROGRESS,
  UNLOCK_HEROES,
  Unlocks,
  unlockByHand,
  type UnlockPrefs,
} from "../progression/unlocks.js";
import {
  confirmOf,
  pointsRowOf,
  rowTapOf,
  tapOf,
  unlockAllRowOf,
  unlockListRowsOf,
  unlocksSummaryOf,
  type UnlockListRow,
} from "./unlocks-model.js";

const thor = UNLOCK_HEROES.find((h) => h.name === "Thor")!.identityCardId;
const groot = UNLOCK_HEROES.find((h) => h.name === "Groot")!.identityCardId;
const spiderMan = UNLOCK_HEROES.find((h) => h.name === "Spider-Man")!.identityCardId;
const make = (prefs: UnlockPrefs = DEFAULT_UNLOCK_PREFS, wonScenarioIds: string[] = []) =>
  new Unlocks({ progress: { ...NO_PROGRESS, wonScenarioIds }, prefs });
type SwitchRow = Extract<UnlockListRow, { kind: "hero" | "campaign" | "scenario" }>;
const rowOf = (rows: readonly UnlockListRow[], id: string) => rows.find((r) => r.id === id) as SwitchRow;

describe("unlockListRowsOf", () => {
  it("lists campaigns, then each wave with what opens it and its heroes", () => {
    const rows = unlockListRowsOf(make());
    expect(rows[0]).toMatchObject({ kind: "section", title: "Campaigns" });
    expect(rowOf(rows, "campaign:trors")).toMatchObject({
      title: "Vol. 1 · The Rise of Red Skull",
      state: "off",
      detail: "Beat Rhino to unlock The Rise of Red Skull",
    });
    expect(rows.find((r) => r.id === "wave:core")).toMatchObject({ status: "Always open" });
    expect(rowOf(rows, `hero:${spiderMan}`)).toMatchObject({ state: "always", detail: "Core Set" });
    expect(rowOf(rows, `hero:${thor}`)).toMatchObject({ state: "off", detail: "Beat Rhino to unlock Wave 1" });
    expect(rows.filter((r) => r.kind === "hero")).toHaveLength(UNLOCK_HEROES.length);
  });

  it("tells a hero earned by play from one opened by hand", () => {
    expect(rowOf(unlockListRowsOf(make(DEFAULT_UNLOCK_PREFS, ["rhino", "ultron"])), `hero:${thor}`)).toMatchObject({
      state: "earned",
      detail: "Earned · Beat Ultron",
    });
    const byHand = unlockByHand(make(), { kind: "hero", identityCardId: thor });
    expect(rowOf(unlockListRowsOf(make(byHand)), `hero:${thor}`)).toMatchObject({ state: "on" });
    const all = unlockListRowsOf(make({ ...DEFAULT_UNLOCK_PREFS, unlockAll: true }));
    expect(rowOf(all, `hero:${thor}`).state).toBe("all");
    expect(all.find((r) => r.id === "wave:wave1")).toMatchObject({ status: "Unlocked by setting", open: true });
  });

  it("shows a campaign's cast as coming with it", () => {
    const prefs = unlockByHand(make(), { kind: "campaign", campaignId: "gmw" });
    const rows = unlockListRowsOf(make(prefs));
    expect(rowOf(rows, "campaign:gmw")).toMatchObject({ state: "on" });
    expect(rowOf(rows, `hero:${groot}`)).toMatchObject({ state: "all", detail: "Comes with its campaign" });
  });
});

describe("taps", () => {
  it("asks before anything that costs points, and switches off without asking", () => {
    const u = make();
    const tap = rowTapOf(u, rowOf(unlockListRowsOf(u), `hero:${thor}`));
    expect(tap).toMatchObject({
      kind: "confirm",
      confirm: { title: "Unlock Thor by hand?", confirmLabel: "Spend 150" },
    });

    const opened = make(unlockByHand(u, { kind: "hero", identityCardId: thor }));
    const off = rowTapOf(opened, rowOf(unlockListRowsOf(opened), `hero:${thor}`));
    expect(off).toMatchObject({ kind: "apply", prefs: { heroIds: [] } });

    // Paid for once: back on without asking again.
    if (off?.kind !== "apply") throw new Error("expected apply");
    const reopened = rowTapOf(make(off.prefs), rowOf(unlockListRowsOf(make(off.prefs)), `hero:${thor}`));
    expect(reopened).toMatchObject({ kind: "apply", prefs: { heroIds: [thor] } });
  });

  it("does nothing for a row with no switch", () => {
    const rows = unlockListRowsOf(make());
    expect(rowTapOf(make(), rowOf(rows, `hero:${spiderMan}`))).toBeNull();
  });

  it("says what a confirm costs, that it isn't refunded, and how to earn it instead", () => {
    const hero = confirmOf(make(DEFAULT_UNLOCK_PREFS, ["rhino"]), { kind: "hero", identityCardId: thor });
    expect(hero.body).toBe(
      "This costs 150 champion points (you have 100, leaving -50). Switching it off later won't refund them. " +
        "Or beat Ultron to unlock Thor for free, and earn points for the win. " +
        "This is for Thor's precon: a Thor deck you import or build plays already.",
    );
    const campaign = confirmOf(make(), { kind: "campaign", campaignId: "gmw" });
    expect(campaign.body).toContain("Its cast (Groot and Rocket Raccoon) comes with it.");
    const everything = tapOf(make(), { kind: "everything" }, false);
    expect(everything).toMatchObject({ kind: "confirm", confirm: { title: "Unlock everything?" } });
    if (everything?.kind !== "confirm") throw new Error("expected confirm");
    expect(everything.confirm.body).toMatch(/covers 2 campaigns, \d+ scenarios and \d+ heroes/);
  });
});

describe("summaries", () => {
  it("leads with champion points", () => {
    expect(unlocksSummaryOf(make())).toBe("0 champion points · 1 of 4 waves open. Next: Beat Rhino to unlock Wave 1.");
    const byHand = unlockByHand(make(), { kind: "hero", identityCardId: thor });
    expect(unlocksSummaryOf(make(byHand))).toBe(
      "-150 champion points · 1 of 4 waves open · 1 unlocked by hand. Next: Beat Rhino to unlock Wave 1.",
    );
    expect(pointsRowOf(make(DEFAULT_UNLOCK_PREFS, ["rhino"])).title).toBe("Champion points: 100");
  });

  it("notes the dev param on the Unlock everything row", () => {
    const dev = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS, devUnlockAll: true });
    expect(unlockAllRowOf(dev).detail).toContain("?unlock=all");
    expect(unlockAllRowOf(make()).on).toBe(false);
  });
});

describe("points header", () => {
  it("says where every point came from, and starts at none", () => {
    expect(pointsRowOf(make()).detail).toMatch(/^No points yet: you earn them by winning\. Spent 0\./);
    expect(pointsRowOf(make(DEFAULT_UNLOCK_PREFS, ["rhino"])).detail).toMatch(
      /^Earned 100: First win: Rhino \(\+100\)\. Spent 0\./,
    );
  });
});

describe("scenario rows", () => {
  it("lists each wave's scenarios with a switch, the Core Set's always open", () => {
    const rows = unlockListRowsOf(make());
    expect(rowOf(rows, "scenario:rhino")).toMatchObject({ state: "always" });
    expect(rowOf(rows, "scenario:red-skull")).toMatchObject({
      state: "off",
      detail: "Beat Rhino to unlock The Rise of Red Skull",
    });
    expect(rowTapOf(make(), rowOf(rows, "scenario:red-skull"))).toMatchObject({
      kind: "confirm",
      confirm: { title: "Unlock Red Skull by hand?", confirmLabel: "Spend 100" },
    });
  });
});
