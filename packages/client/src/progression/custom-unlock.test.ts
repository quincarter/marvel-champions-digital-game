import { afterEach, describe, expect, it } from "vitest";
import {
  CUSTOM_WINS_TO_UNLOCK,
  customEarned,
  customHeroMode,
  customLockText,
  customScenarioMode,
} from "./custom-unlock.js";
import { DEFAULT_CUSTOM_CONTENT_PREFS, setCustomContentPrefs } from "../packs/custom-content-prefs.js";
import { DEFAULT_UNLOCK_PREFS, Unlocks } from "./unlocks.js";
import { setLoadedPacks } from "../packs/pack-registry.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { confirmOf } from "../view/unlocks-model.js";

const packs = [
  { id: "pts", unlock: "points" as const, scenarios: [{ id: "x.pts.scenario" }] },
  { id: "win", unlock: "wins" as const },
  { id: "free" },
];

describe("custom content unlock modes (issue #734)", () => {
  it("opens everything while new custom content starts unlocked", () => {
    expect(customHeroMode("x.pts.01a", packs, true)).toBe("open");
    expect(customScenarioMode("x.pts.scenario", packs, true)).toBe("open");
  });

  it("follows the creator's choice when it does not, open when the pack says nothing", () => {
    expect(customHeroMode("x.pts.01a", packs, false)).toBe("points");
    expect(customHeroMode("x.win.01a", packs, false)).toBe("wins");
    expect(customHeroMode("x.free.01a", packs, false)).toBe("open");
    expect(customScenarioMode("x.pts.scenario", packs, false)).toBe("points");
  });

  it("is not about official content", () => {
    expect(customHeroMode("01001a", packs, false)).toBeNull();
    expect(customScenarioMode("rhino", packs, false)).toBeNull();
  });

  it("opens a wins pack after enough different wins, never a points pack", () => {
    expect(customEarned("open", 0)).toBe(true);
    expect(customEarned("wins", CUSTOM_WINS_TO_UNLOCK - 1)).toBe(false);
    expect(customEarned("wins", CUSTOM_WINS_TO_UNLOCK)).toBe(true);
    expect(customEarned("points", 99)).toBe(false);
  });

  it("says how to open it", () => {
    expect(customLockText("points", 0, "en")).toMatch(/champion points/);
    expect(customLockText("wins", CUSTOM_WINS_TO_UNLOCK - 2, "en")).toMatch(/^Win 2 more/);
  });
});

describe("Unlocks with custom content locked (issue #734)", () => {
  afterEach(() => {
    setCustomContentPrefs(DEFAULT_CUSTOM_CONTENT_PREFS);
    setLoadedPacks([]);
  });

  const unlocks = (heroIds: string[] = []) =>
    new Unlocks({
      progress: { wonScenarioIds: [], wonExpertScenarioIds: [], wonCampaignIds: [], wonExpertCampaignIds: [] },
      prefs: { ...DEFAULT_UNLOCK_PREFS, heroIds },
    });

  it("locks a points pack's hero until it is opened by hand, and charges a hero's price", () => {
    setLoadedPacks(packs as unknown as PackRuntime[]);
    setCustomContentPrefs({ placement: "bottom", unlocked: false });
    expect(unlocks().heroLock("x.pts.01a", "en")).toMatch(/champion points/);
    expect(unlocks().chargesFor({ kind: "hero", identityCardId: "x.pts.01a" })).toHaveLength(1);
    expect(unlocks(["x.pts.01a"]).heroLock("x.pts.01a", "en")).toBeNull();
    expect(unlocks().scenarioLock({ id: "x.pts.scenario", packCode: "x" } as never, "en")).toMatch(/champion/);
  });

  it("leaves it open with the setting on", () => {
    setLoadedPacks(packs as unknown as PackRuntime[]);
    expect(unlocks().heroLock("x.pts.01a", "en")).toBeNull();
    expect(unlocks().chargesFor({ kind: "hero", identityCardId: "x.pts.01a" })).toEqual([]);
  });
});

describe("the unlock confirm for custom content (issue #734)", () => {
  afterEach(() => {
    setCustomContentPrefs(DEFAULT_CUSTOM_CONTENT_PREFS);
    setLoadedPacks([]);
  });

  it("names the pack's hero and scenario, and gives a wins pack's free way in", () => {
    setLoadedPacks([
      { id: "pts", unlock: "points", cards: [{ id: "x.pts.01a", name: "Gwenpool" }], scenarios: [] },
      { id: "win", unlock: "wins", cards: [], scenarios: [{ id: "x.win.scenario", name: "Mephisto" }] },
    ] as unknown as PackRuntime[]);
    setCustomContentPrefs({ placement: "bottom", unlocked: false });
    const none = new Unlocks({
      progress: { wonScenarioIds: [], wonExpertScenarioIds: [], wonCampaignIds: [], wonExpertCampaignIds: [] },
      prefs: DEFAULT_UNLOCK_PREFS,
    });
    const hero = confirmOf(none, { kind: "hero", identityCardId: "x.pts.01a" });
    // Not enough points yet: the confirm says what it would cost, by the pack's own names.
    expect(hero.body).toContain("Gwenpool");
    expect(hero.body).not.toMatch(/precon|this hero/);
    const scenario = confirmOf(none, { kind: "scenario", scenarioId: "x.win.scenario" });
    expect(scenario.body).toContain("Mephisto");
    expect(scenario.body).toMatch(/Win 5 more different scenarios to unlock Mephisto for free/);
  });
});
