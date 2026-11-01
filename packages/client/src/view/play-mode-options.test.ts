/**
 * Heroic and Skirmish on Table setup and the campaign Briefing (RRG 1.8 "Modes of Play", p. 29; issue #611).
 */
import { describe, expect, it } from "vitest";
import { POOL_SCENARIOS, buildScenario } from "../content/pool.js";
import { progressOf } from "../progression/unlocks.js";
import { applyIssueMode, issueModeRowsOf } from "./campaign-modes-model.js";
import { difficultyLabelOf } from "./difficulty-label.js";
import { applySetupOption, optionActionsOf, reconcileWithOffer, setupOptionRowsOf } from "./setup-options.js";
import { initialSetupDraft, setDifficulty, setScenario, toSessionConfig } from "./setup-draft.js";

const scenario = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id);
const draftAt = (id: string) => initialSetupDraft({ scenarioId: id, seatDeckId: null, seed: 1 });
const rowOf = (draft: ReturnType<typeof draftAt>, id: string) =>
  setupOptionRowsOf(draft, new Map()).find((row) => row.id === id);

describe("the Heroic and Skirmish rows", () => {
  it("offers Heroic everywhere, and a version for each stage of the mode", () => {
    const draft = draftAt("rhino");
    expect(rowOf(draft, "heroic")?.meta).toBe("Off");
    const skirmish = rowOf(draft, "skirmish")!;
    expect(optionActionsOf([skirmish])).toEqual(["skirmish:off", "skirmish:1", "skirmish:2"]);
    const expert = setDifficulty(draft, "expert");
    expect(optionActionsOf([rowOf(expert, "skirmish")!])).toEqual(["skirmish:off", "skirmish:2", "skirmish:3"]);
  });

  it("has no Skirmish row where one version cannot stand alone", () => {
    expect(rowOf(draftAt("kang"), "skirmish")).toBeUndefined();
    expect(rowOf(draftAt("kang"), "heroic")).toBeDefined();
  });

  it("is a plain toggle where the rulebook prints the skirmish rule", () => {
    const loki = rowOf(draftAt("loki"), "skirmish")!;
    expect(loki.control).toEqual({ kind: "toggle", action: "skirmish:toggle" });
  });

  it("steps the heroic level from Off to 4 and no further", () => {
    let draft = draftAt("rhino");
    for (let i = 0; i < 6; i++) draft = applySetupOption(draft, "heroic:up");
    expect(draft.heroicLevel).toBe(4);
    const row = rowOf(draft, "heroic")!;
    expect(row.control.kind === "stepper" && row.control.up.enabled).toBe(false);
    expect(row.meta).toBe("4 extra encounter cards each");
    expect(applySetupOption(draft, "heroic:down").heroicLevel).toBe(3);
  });

  it("moves the skirmish version to one the new difficulty uses", () => {
    const standard = applySetupOption(draftAt("rhino"), "skirmish:1");
    expect(standard.skirmish).toEqual({ villainVersion: "1" });
    expect(setDifficulty(standard, "expert").skirmish).toEqual({ villainVersion: "2" });
  });

  it("clears skirmish on a scenario change and keeps the heroic level", () => {
    const draft = applySetupOption(applySetupOption(draftAt("rhino"), "skirmish:2"), "heroic:up");
    const next = setScenario(draft, scenario("klaw"), "klaw");
    expect(next.skirmish).toBeUndefined();
    expect(next.heroicLevel).toBe(1);
  });

  it("clears a skirmish choice a scenario does not offer", () => {
    const draft = { ...draftAt("kang"), skirmish: { villainVersion: "1" } };
    expect(reconcileWithOffer(draft).skirmish).toBeNull();
  });
});

describe("the session config", () => {
  const players = [{ starterDeckId: "core-spider-man-justice" }];
  const config = (draft: ReturnType<typeof draftAt>) => toSessionConfig(draft, players, scenario(draft.scenarioId));

  it("sends no modes for a plain game, so its config is the same as ever", () => {
    expect(config(draftAt("rhino")).modes).toBeUndefined();
    expect(config(setDifficulty(draftAt("rhino"), "expert")).modes).toBeUndefined();
  });

  it("sends expert, heroic and skirmish together, and they agree with the difficulty", () => {
    let draft = setDifficulty(draftAt("rhino"), "expert");
    draft = applySetupOption(applySetupOption(draft, "heroic:up"), "skirmish:3");
    const sent = config(draft);
    expect(sent.difficulty).toBe("expert");
    expect(sent.modes).toEqual({ expert: true, heroic: 1, skirmish: { villainVersion: "3" } });
  });
});

describe("a Skirmish win", () => {
  it("is a win, not an Expert win, and stays out of the global numbers", () => {
    const save = (modes?: object) => ({
      status: "won",
      config: { scenarioId: "rhino", difficulty: "expert", ...(modes ? { modes } : {}) },
    });
    const progress = progressOf([save({ expert: true, skirmish: { villainVersion: "3" } })], []);
    expect(progress.wonScenarioIds).toEqual(["rhino"]);
    expect(progress.wonExpertScenarioIds).toEqual([]);
    expect(progressOf([save({ expert: true })], []).wonExpertScenarioIds).toEqual(["rhino"]);
  });
});

describe("the difficulty label", () => {
  it.each([
    [{ difficulty: "standard" }, "Standard"],
    [{ difficulty: "extreme" }, "Extreme"],
    [{ difficulty: "standard", modes: { heroic: 2 } }, "Heroic 2"],
    [{ difficulty: "standard", modes: { skirmish: {} } }, "Skirmish"],
    [{ difficulty: "expert", modes: { expert: true, heroic: 1 } }, "Expert Heroic 1"],
    [{ difficulty: "expert", modes: { expert: true, heroic: 1, skirmish: {} } }, "Expert Heroic 1 Skirmish"],
  ] as const)("%j", (config, label) => {
    expect(difficultyLabelOf(config)).toBe(label);
  });
});

describe("the Briefing's modes", () => {
  it("lists Difficulty, Heroic and Skirmish, and builds what it lists", () => {
    const rows = issueModeRowsOf("rhino", {});
    expect(rows.map((row) => row.id)).toEqual(["expert", "heroic", "skirmish"]);
    let modes = applyIssueMode("rhino", {}, "expert:on");
    modes = applyIssueMode("rhino", modes, "heroic:up");
    modes = applyIssueMode("rhino", modes, "skirmish:3");
    expect(modes).toEqual({ expert: true, heroic: 1, skirmish: { villainVersion: "3" } });
    const built = buildScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
      modes,
    });
    expect(built.heroicLevel).toBe(1);
    expect(built.villainStartStageIndex).toBe(2);
  });

  it("moves the skirmish version off a stage the new difficulty leaves", () => {
    const modes = applyIssueMode("rhino", { expert: true, skirmish: { villainVersion: "3" } }, "expert:off");
    expect(modes).toEqual({ skirmish: { villainVersion: "1" } });
  });

  it("turns everything back off to an empty set, which is standard mode", () => {
    expect(applyIssueMode("rhino", { heroic: 1 }, "heroic:down")).toEqual({});
  });
});
