/**
 * Guided mode, game tips and the table help, checked against a real Core Set game rather than fixtures, so the
 * copy is proven to read the table's own names and numbers.
 */
import { beforeAll, describe, expect, test } from "vitest";
import type { Scenario } from "@mc/content";
import { CARDS_BY_ID, POOL_DEPS, POOL_SCENARIOS } from "../../content/pool.js";
import { LocalEngineHost } from "../../engine/local-host.js";
import { SessionStore } from "../../store/session-store.js";
import { boardModel, type BoardModel } from "../board-model.js";
import { rulesGlossaryOf, type RulesEntry } from "../rules-reference.js";
import { currentRoundGuideStep, roundGuideSteps } from "./round-guide.js";
import { tipsFor } from "./game-tips.js";
import { seatScalingOf, seatWarningOf, setupGuideStep } from "./setup-guide.js";
import { tableHelpOf } from "./table-help.js";
import { parseTeachingPrefs, serializeTeachingPrefs, DEFAULT_TEACHING_PREFS } from "../../teaching/teaching-prefs.js";

async function rhinoInPlay(): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  for (let step = 0; step < 40; step++) {
    const legal = store.state.legal;
    if (!legal || legal.actions.kind !== "choice") break;
    const { choice } = legal.actions;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
  return store;
}

let model: BoardModel;
let glossary: readonly RulesEntry[];

beforeAll(async () => {
  const store = await rhinoInPlay();
  model = boardModel(store.state.game!, store.state.perspectiveId!, POOL_DEPS);
  glossary = rulesGlossaryOf(store.state.game!, POOL_DEPS);
}, 60_000);

describe("round guide", () => {
  test("round 1's player phase walks the whole round, starting with the villain by name", () => {
    expect(model.round).toBe(1);
    expect(model.phase).toBe("player");
    const at = currentRoundGuideStep(model, new Set())!;
    expect(at.step.id).toBe("villain");
    expect(at.step.title).toContain("Rhino");
    expect(at.step.body).toContain(`${model.villain.hp!.current} hit points`);
    expect(at.index).toBe(1);
    expect(at.total).toBe(roundGuideSteps(model).length);
    expect(at.previousId).toBeNull();
  });

  test("Next moves through the steps in order, and Back points at the one before", () => {
    const at = currentRoundGuideStep(model, new Set(["villain", "scheme"]))!;
    expect(at.step.id).toBe("identity");
    expect(at.previousId).toBe("scheme");
    expect(at.step.anchor).toBe("me");
  });

  test("the villain phase step waits for the villain phase, so round 1's walk stops after End turn", () => {
    const heroSteps = ["villain", "scheme", "identity", "hand", "powers", "playArea", "endTurn"];
    expect(currentRoundGuideStep(model, new Set(heroSteps))).toBeNull();
    const villainPhase: BoardModel = { ...model, phase: "villain" };
    expect(currentRoundGuideStep(villainPhase, new Set(heroSteps))!.step.id).toBe("villainPhase");
  });

  test("round 2 skips the hero-phase steps and ends on the wrap-up", () => {
    const round2: BoardModel = { ...model, round: 2 };
    expect(currentRoundGuideStep(round2, new Set())!.step.id).toBe("villainPhase");
    expect(currentRoundGuideStep(round2, new Set(["villainPhase"]))!.step.id).toBe("wrap");
    expect(currentRoundGuideStep(round2, new Set(["villainPhase", "wrap"]))).toBeNull();
  });

  test("the identity step reads the form the player is actually in", () => {
    const hero = currentRoundGuideStep({ ...model, myForm: "hero" }, new Set(["villain", "scheme"]))!;
    const alterEgo = currentRoundGuideStep({ ...model, myForm: "alterEgo" }, new Set(["villain", "scheme"]))!;
    expect(hero.step.body).toContain("In hero form");
    expect(alterEgo.step.title).toContain("alter-ego");
  });
});

describe("game tips", () => {
  test("keyword and status tips come from the table's own glossary, never the three always-true entries", () => {
    const tips = tipsFor(model, glossary, new Set());
    const ids = tips.map((tip) => tip.id);
    expect(ids).not.toContain("keyword:exhausted");
    expect(ids).not.toContain("keyword:ready");
    expect(ids).not.toContain("keyword:facedownBoostCard");
    for (const entry of glossary.filter((e) => !["exhausted", "ready", "facedownBoostCard"].includes(e.id))) {
      expect(ids).toContain(`keyword:${entry.id}`);
    }
  });

  test("a tip already seen never comes back", () => {
    const first = tipsFor(model, glossary, new Set());
    const seen = new Set(first.map((tip) => tip.id));
    expect(tipsFor(model, glossary, seen)).toEqual([]);
  });

  test("the main scheme nearing its target is a tip, and comes before keyword tips", () => {
    const target = model.mainScheme.target!;
    const near: BoardModel = { ...model, mainScheme: { ...model.mainScheme, threat: target - 1 } };
    const tips = tipsFor(near, glossary, new Set());
    expect(tips[0]!.id).toBe("situation:threatNearTarget");
    expect(tips[0]!.body).toContain(`${target - 1} of ${target}`);
  });

  test("low hit points suggests the alter-ego only to a player in hero form", () => {
    const low = { ...model.me, hp: { current: 2, max: 10 } };
    const hero = tipsFor({ ...model, me: low, myForm: "hero" }, [], new Set());
    const alterEgo = tipsFor({ ...model, me: low, myForm: "alterEgo" }, [], new Set());
    expect(hero.find((t) => t.id === "situation:lowHitPoints")!.body).toContain("Flipping to your alter-ego");
    expect(alterEgo.find((t) => t.id === "situation:lowHitPoints")!.body).not.toContain("Flipping");
  });
});

describe("setup guide and the seat warning", () => {
  const rhino = POOL_SCENARIOS.find((s) => s.id === "rhino") as Scenario;

  test("one seat has no warning", () => {
    expect(seatWarningOf(rhino, "standard", CARDS_BY_ID, 1, "Rhino")).toBeNull();
  });

  test("more seats quote the scaled villain hit points and scheme target beside the solo numbers", () => {
    const solo = seatScalingOf(rhino, "standard", CARDS_BY_ID, 1)!;
    const three = seatScalingOf(rhino, "standard", CARDS_BY_ID, 3)!;
    expect(three.villainHp).toBeGreaterThan(solo.villainHp);
    expect(three.schemeTarget).toBeGreaterThan(solo.schemeTarget);
    const warning = seatWarningOf(rhino, "standard", CARDS_BY_ID, 3, "Rhino")!;
    expect(warning).toContain(`${three.villainHp} hit points in all (${solo.villainHp} solo)`);
    expect(warning).toContain(`${three.schemeTarget} threat (${solo.schemeTarget} solo)`);
    expect(warning).toContain("activates 3 times");
  });

  test("the seats step carries the warning it's given", () => {
    const step = setupGuideStep("seats", { seats: 2, seatWarning: "careful" });
    expect(step.warning).toBe("careful");
    expect(setupGuideStep("scenarioSelect").body).toContain("Rhino");
  });
});

describe("table help", () => {
  test("names this table's villain, scheme and hero, and every glossary term on it", () => {
    const sections = tableHelpOf(model, glossary);
    const text = sections.flatMap((s) => [s.heading, ...s.lines]).join("\n");
    expect(text).toContain("Round 1");
    expect(text).toContain(model.villain.name);
    expect(text).toContain(model.mainScheme.name);
    expect(text).toContain(model.me.name);
    for (const entry of glossary.filter((e) => !["exhausted", "ready", "facedownBoostCard"].includes(e.id))) {
      expect(text).toContain(entry.displayName);
    }
  });
});

describe("teaching prefs", () => {
  test("round-trips, and anything unreadable falls back to the defaults", () => {
    const prefs = { guidedMode: true, gameTips: false, askedAboutGuide: true, seenTips: ["keyword:guard"] };
    expect(parseTeachingPrefs(serializeTeachingPrefs(prefs))).toEqual(prefs);
    expect(parseTeachingPrefs(null)).toEqual(DEFAULT_TEACHING_PREFS);
    expect(parseTeachingPrefs("not json")).toEqual(DEFAULT_TEACHING_PREFS);
    expect(parseTeachingPrefs('{"gameTips":"yes","seenTips":[1,"a"]}')).toEqual({
      ...DEFAULT_TEACHING_PREFS,
      seenTips: ["a"],
    });
  });
});
