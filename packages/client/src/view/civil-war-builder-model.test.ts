import { describe, expect, test } from "vitest";
import { playableScenario, playableScenarioOffer } from "@mc/cards";
import { CW_CARDS, CW_ENCOUNTER_SETS, CW_SCENARIOS, type AnyCard } from "@mc/content";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import {
  applyBuilderAction,
  builderViewOf,
  defaultStatusOf,
  refusalOf,
  effectiveSetIds,
  isReadyMade,
  openBuilderBuildYourOwn,
  openBuilderOn,
  startConfigOf,
  type BuilderContext,
  type CivilWarRandomizer,
} from "./civil-war-builder-model.js";
import { cardsRandomizer } from "./civil-war-random.js";
import { GAME_MODE_OPTIONS, COMPETITIVE_TAPPED_MESSAGE } from "./game-mode-options.js";
import { initialSetupDraft, setDifficulty, setModularSetIds, toSessionConfig, type SetupDraft } from "./setup-draft.js";
import { offerOf } from "./setup-options.js";

const CARDS = new Map<string, AnyCard>(CW_CARDS.map((c) => [c.id as string, c]));
const BASE: BuilderContext = {
  cards: CARDS,
  scenarios: CW_SCENARIOS,
  encounterSets: [...POOL_ENCOUNTER_SETS, ...CW_ENCOUNTER_SETS],
};
const LEADERS = [
  "registration-iron-man",
  "registration-captain-marvel",
  "resistance-captain-america",
  "resistance-spider-woman",
] as const;
const SPIDER = [{ starterDeckId: "core-spider-man-justice" }];
const IRON = "registration-iron-man";

const draftFor = (id: string, seed = 5): SetupDraft => initialSetupDraft({ scenarioId: id, seatDeckId: "x", seed });
const act = (d: SetupDraft, a: string, ctx: Partial<BuilderContext> = {}) =>
  applyBuilderAction(d, a, { ...BASE, ...ctx });
const view = (d: SetupDraft, ctx: Partial<BuilderContext> = {}) => builderViewOf(d, { ...BASE, ...ctx })!;
const recommended = (id: string): readonly string[] =>
  playableScenarioOffer(id)
    .modularSets!.filter((s) => s.recommended)
    .map((s) => s.id);
const picks = (d: SetupDraft, ids: readonly string[]) => setModularSetIds(d, ids);
const THREE = ["paladin", "cape_killer", "bomb_scare"];

describe("1. defaults per leader", () => {
  test.each(LEADERS)("%s opens on its ready-made scenario", (id) => {
    const { draft, step } = openBuilderOn(draftFor("rhino"), id);
    const offer = playableScenarioOffer(id);
    expect(step).toBe(5);
    expect(draft.scenarioId).toBe(id);
    expect(draft.civilWar!.stageIds).toEqual(offer.mainSchemeStages!.recommended);
    expect(effectiveSetIds(draft, offer)).toEqual(recommended(id));
    expect(effectiveSetIds(draft, offer)).toHaveLength(4);
    const v = view(draft);
    expect(v.isPreconstructed).toBe(true);
    expect(v.summary[0]).toBe("Ready-made");
    expect(v.canStart).toBe(true);
  });

  test("Customize drops edits a draft already held on that leader; Build your own starts at the side step", () => {
    const edited = picks(draftFor(IRON), THREE);
    expect(openBuilderOn(edited, IRON).draft.modularSetIds).toBeNull();
    const own = openBuilderBuildYourOwn(draftFor("rhino"), playableScenarioOffer(IRON));
    expect(own.step).toBe(1);
    expect(own.draft.scenarioId).toBe(IRON);
    expect(isReadyMade(own.draft, offerOf(own.draft))).toBe(true);
  });
});

describe("difficulty: Table setup's own state, card wording and setter", () => {
  test("two choices with Table setup's names and descriptions; Standard is selected on a fresh draft", () => {
    const v = view(draftFor(IRON));
    expect(v.difficultyChoices).toEqual([
      {
        id: "standard",
        name: "Standard",
        description: "Standard encounter set only. Starts at stage I.",
        action: "civil:difficulty:standard",
        selected: true,
      },
      {
        id: "expert",
        name: "Expert",
        description: "Expert set added. Starts at stage III.",
        action: "civil:difficulty:expert",
        selected: false,
      },
    ]);
    expect(view(draftFor(IRON), { step: 5 }).focusOrder.slice(5, 9)).toEqual([
      "civil:difficulty:standard",
      "civil:difficulty:expert",
      "civil:mode:cooperative",
      "civil:mode:competitive",
    ]);
    expect(v.summary.at(-1)).toBe("Difficulty: Standard");
  });

  test("choosing Expert sets the shared draft difficulty; the leader step and the review follow at once", () => {
    const result = act(draftFor(IRON), "civil:difficulty:expert");
    expect(result.draft.difficulty).toBe("expert");
    expect(result.status).toBeNull();
    const v = view(result.draft);
    expect(v.difficultyChoices.map((d) => [d.id, d.selected])).toEqual([
      ["standard", false],
      ["expert", true],
    ]);
    expect(v.leaderChoices[0]!.openingStage).toBe("III");
    expect(v.leaderChoices[0]!.stages.map((s) => s.numeral)).toEqual(["III", "IV"]);
    expect(v.summary).toContain("Leader: Iron Man (stage III)");
    expect(v.summary.at(-1)).toBe("Difficulty: Expert");
    expect(v.expertNote).toBe("Expert uses leader stages III and IV");
    expect(v.canStart).toBe(true);
  });

  test("Standard again goes back; Extreme and nonsense are refused; the picks survive the change", () => {
    const picked = act(picks(draftFor(IRON), THREE), "civil:difficulty:expert").draft;
    expect(picked.modularSetIds).toEqual(THREE);
    expect(act(picked, "civil:difficulty:standard").draft.difficulty).toBe("standard");
    expect(act(picked, "civil:difficulty:extreme").draft).toBe(picked);
    expect(act(picked, "civil:difficulty:").draft).toBe(picked);
    expect(act(picked, "civil:difficulty:expert").draft.difficulty).toBe("expert");
  });
});

describe("the steps and the choices", () => {
  test("five steps, with the current pick as one line each, and the side and leader cards", () => {
    const v = view(draftFor(IRON));
    expect(v.steps.map((s) => [s.title, s.line, s.complete])).toEqual([
      ["Side", "Registration", true],
      ["Leader", "Iron Man", true],
      ["Main scheme", "Cut Off Support, Negative Zone Prison", true],
      ["Modular sets", "4 sets", true],
      ["Review and play", "Ready-made", true],
    ]);
    expect(v.sideChoices.map((s) => [s.name, s.selected, s.leaderNames])).toEqual([
      ["Registration", true, ["Iron Man", "Captain Marvel"]],
      ["Resistance", false, ["Captain America", "Spider-Woman"]],
    ]);
    const leaders = v.leaderChoices;
    expect(leaders.map((l) => [l.name, l.word, l.selected, l.openingStage])).toEqual([
      ["Iron Man", "Leader", true, "I"],
      ["Captain Marvel", "Leader", false, "I"],
    ]);
    expect(leaders[0]!.ownSet).toBe("Iron Man set, 10 cards");
    expect(leaders[0]!.stages.map((s) => s.numeral)).toEqual(["I", "II"]);
    expect(leaders[0]!.stages[0]!.hpByPlayers).toHaveLength(4);
    expect(leaders[0]!.stages[0]!.hpByPlayers[3]).toBeGreaterThanOrEqual(leaders[0]!.stages[0]!.hpByPlayers[0]!);
  });

  test("11. the expert note and stages III and IV appear only on expert; the leader word is never Villain", () => {
    const standard = view(draftFor(IRON));
    expect(standard.expertNote).toBeNull();
    const expert = view(setDifficulty(draftFor(IRON), "expert"));
    expect(expert.expertNote).toBe("Expert uses leader stages III and IV");
    expect(expert.leaderChoices[0]!.openingStage).toBe("III");
    expect(expert.leaderChoices[0]!.stages.map((s) => s.numeral)).toEqual(["III", "IV"]);
    expect(JSON.stringify(standard)).not.toMatch(/Villain/);
    expect(standard.summary[1]).toBe("Leader: Iron Man (stage I)");
  });

  test("the stage rows mark the recommended and the picked option", () => {
    const v = view(draftFor(IRON));
    expect(v.stageRows.map((r) => r.options.length)).toEqual([4, 4]);
    expect(v.stageRows[0]!.label).toBe("Stage 1 (it goes on top)");
    expect(v.stageRows.map((r) => r.options.filter((o) => o.selected).length)).toEqual([1, 1]);
    expect(v.stageRows.map((r) => r.options.filter((o) => o.recommended).map((o) => o.printedCardId))).toEqual([
      ["56063b"],
      ["56064b"],
    ]);
    expect(v.stageSummary).toBe("Cut Off Support, then Negative Zone Prison.");
  });
});

describe("2 and 3. changing leader and side", () => {
  test("a leader change resets the picks; a notice only when the player had changed something", () => {
    const fresh = act(draftFor(IRON), "civil:leader:registration-captain-marvel");
    expect(fresh.draft.scenarioId).toBe("registration-captain-marvel");
    expect(fresh.draft.civilWar!.stageIds).toEqual(["56096b", "56097b"]);
    expect(fresh.draft.modularSetIds).toBeNull();
    expect(fresh.status).toBeNull();
    const custom = act(picks(draftFor(IRON), THREE), "civil:leader:registration-captain-marvel");
    expect(custom.draft.modularSetIds).toBeNull();
    expect(custom.status).toBe("Picks reset to Captain Marvel's ready-made scenario.");
  });

  test("a side change picks that side's first leader and resets, saying so once", () => {
    const custom = act(picks(draftFor(IRON), THREE), "civil:side:resistance");
    expect(custom.draft.scenarioId).toBe("resistance-captain-america");
    expect(custom.draft.modularSetIds).toBeNull();
    expect(custom.status).toBe("Changed to Resistance. Picks reset to Captain America's ready-made scenario.");
  });

  test("the same side or leader changes nothing and has no notice", () => {
    const d = picks(draftFor(IRON), THREE);
    for (const a of ["civil:side:registration", "civil:leader:registration-iron-man"]) {
      const r = act(d, a);
      expect(r.draft).toBe(d);
      expect(r.status).toBeNull();
    }
    expect(act(d, "civil:leader:resistance-spider-woman").draft).toBe(d);
  });
});

describe("4. stages", () => {
  test("a pick replaces within its number, never zero or two, and the output is stage 1 then 2", () => {
    const r = act(draftFor(IRON), "civil:stage:2:56123b");
    expect(r.draft.civilWar!.stageIds).toEqual(["56063b", "56123b"]);
    const v = view(r.draft);
    expect(v.stageRows[1]!.options.filter((o) => o.selected).map((o) => o.printedCardId)).toEqual(["56123b"]);
    expect(v.isPreconstructed).toBe(false);
    expect(v.summary[0]).toBe("Custom");
    const again = act(r.draft, "civil:stage:2:56064b");
    expect(again.draft.civilWar!.stageIds).toEqual(["56063b", "56064b"]);
  });

  test("a stage of the other side, or of the wrong number, is refused", () => {
    const d = draftFor(IRON);
    expect(act(d, "civil:stage:1:56199b").draft).toBe(d);
    expect(act(d, "civil:stage:2:56063b").draft).toBe(d);
    expect(act(d, "civil:stage:3:56063b").draft).toBe(d);
  });
});

describe("5. set toggling", () => {
  test("two chosen: cannot start, and problems[0] is the offer's range text", () => {
    const v = view(picks(draftFor(IRON), ["paladin", "cape_killer"]));
    expect(v.canStart).toBe(false);
    expect(v.problems[0]).toBe("Registration: Iron Man uses 3 to 4 modular sets, got 2");
    expect(v.startProblem).toBe(v.problems[0]);
    expect(v.modular.counterLine).toBe("3 to 4 sets. Chosen: 2.");
    expect(v.modular.hint).toBe("Pick 1 more");
    expect(v.steps[3]!.complete).toBe(false);
    expect(v.steps[4]!.complete).toBe(false);
  });

  test("three is fine and four disables every unchosen tile with the reason", () => {
    expect(view(picks(draftFor(IRON), THREE)).canStart).toBe(true);
    const v = view(picks(draftFor(IRON), [...THREE, "martial_law"]));
    expect(v.canStart).toBe(true);
    const tiles = v.modular.sections.filter((s) => s.key !== "otherSide").flatMap((s) => s.tiles);
    const unchosen = tiles.filter((t) => !t.selected);
    expect(unchosen.length).toBeGreaterThan(0);
    for (const t of unchosen) expect(t.disabledReason, t.id).toBe("Four is the most (MC56 p. 4)");
    for (const t of tiles.filter((x) => x.selected)) expect(t.enabled).toBe(true);
  });

  test("at the cap an unchosen tile says '4 of 4 chosen' (no padlock); a set that cannot be picked at all has no cap note", () => {
    const v = view(picks(draftFor(IRON), [...THREE, "martial_law"]));
    const tiles = v.modular.sections.filter((s) => s.key !== "otherSide").flatMap((s) => s.tiles);
    for (const t of tiles.filter((x) => !x.selected)) {
      expect(t.capNote, t.id).toBe("4 of 4 chosen");
      expect(t.disabledReason, t.id).toBe("Four is the most (MC56 p. 4)");
    }
    for (const t of tiles.filter((x) => x.selected)) expect(t.capNote).toBeUndefined();
    const other = v.modular.sections.find((s) => s.key === "otherSide")!;
    for (const t of other.tiles) expect(t.capNote, t.id).toBeUndefined();
    // Below the cap nothing carries the note.
    const three = view(picks(draftFor(IRON), THREE));
    for (const t of three.modular.sections.flatMap((s) => s.tiles)) expect(t.capNote).toBeUndefined();
  });

  test("a fifth toggle changes nothing; deselect then select swaps", () => {
    const four = picks(draftFor(IRON), [...THREE, "martial_law"]);
    expect(act(four, "civil:set:mighty_avengers").draft).toBe(four);
    const fewer = act(four, "civil:set:martial_law").draft;
    expect(fewer.modularSetIds).toEqual(THREE);
    expect(act(fewer, "civil:set:the_initiative").draft.modularSetIds).toEqual([...THREE, "the_initiative"]);
  });

  test("toggling from the recommendation works on the recommended four", () => {
    const first = recommended(IRON)[0]!;
    expect(act(draftFor(IRON), `civil:set:${first}`).draft.modularSetIds).toEqual(recommended(IRON).slice(1));
  });
});

describe("6. other-side and neutral sets", () => {
  test("every set of the other side is in the collapsed group, disabled, with the offer's refusal, and not selectable", () => {
    const d = draftFor(IRON);
    const v = view(d);
    const group = v.modular.sections.find((s) => s.key === "otherSide")!;
    expect(group.tiles).toHaveLength(8);
    expect(group.expanded).toBe(false);
    expect(group.collapsedLine).toBe("8 sets from the Resistance are not used with Iron Man");
    const offer = playableScenarioOffer(IRON);
    for (const t of group.tiles) {
      expect(t.enabled).toBe(false);
      expect(t.disabledReason).toBe(offer.modularSets!.find((s) => s.id === t.id)!.problem);
      expect(act(d, t.action).draft).toBe(d);
    }
    expect(group.tiles.find((t) => t.id === "defenders")!.disabledReason).toBe(
      "Defenders is a resistance set; Iron Man leads the registration side (MC56 p. 4)",
    );
    expect(v.layout.setCounts.otherSide).toBe(8);
  });

  test("a neutral set from another product is selectable and counts", () => {
    const d = draftFor(IRON);
    const neutral = view(picks(d, ["paladin", "cape_killer"]))
      .modular.sections.find((s) => s.key === "other")!
      .tiles.find((t) => t.id === "bomb_scare")!;
    expect(neutral.enabled).toBe(true);
    const r = act(picks(d, ["paladin", "cape_killer"]), neutral.action).draft;
    expect(r.modularSetIds).toEqual(THREE);
    expect(view(r).canStart).toBe(true);
  });

  // Question 2's reading B (neutral sets do not count toward the three or four) is a one-line change in the offer.
  test.skip("question 2, reading B: neutral sets do not count toward the three or four", () => {});

  test("the side's own sets list the leader's recommended four first, marked", () => {
    const own = view(draftFor(IRON)).modular.sections[0]!;
    expect(own.label).toBe("Registration sets");
    expect(own.tiles).toHaveLength(8);
    expect(own.tiles.slice(0, 4).every((t) => t.recommended)).toBe(true);
    expect(own.tiles.slice(4).some((t) => t.recommended)).toBe(false);
    expect(own.tiles[0]!.cardCount).toBe(5);
    expect(own.tiles[0]!.descriptor).not.toBeNull();
  });
});

describe("7. Preconstructed", () => {
  test("enabled only when the picks differ; restores exactly; set order is irrelevant", () => {
    const ready = draftFor(IRON);
    expect(view(ready).preconstructedEnabled).toBe(false);
    expect(act(ready, "civil:preconstructed").draft).toBe(ready);
    const custom = act(picks(ready, THREE), "civil:stage:2:56123b").draft;
    expect(view(custom).preconstructedEnabled).toBe(true);
    const restored = act(custom, "civil:preconstructed").draft;
    expect(restored.civilWar!.stageIds).toEqual(["56063b", "56064b"]);
    expect(restored.modularSetIds).toBeNull();
    expect(view(restored).isPreconstructed).toBe(true);
    const shuffled = picks(ready, [...recommended(IRON)].reverse());
    expect(view(shuffled).isPreconstructed).toBe(true);
    expect(view(shuffled).preconstructedEnabled).toBe(false);
  });

  test("picking back to the recommendation reads Ready-made again", () => {
    const away = act(draftFor(IRON), "civil:stage:1:56121b").draft;
    expect(view(away).summary[0]).toBe("Custom");
    expect(view(act(away, "civil:stage:1:56063b").draft).summary[0]).toBe("Ready-made");
  });
});

describe("8. Random seam (a stub stands for the cards function; task C9 wires the button)", () => {
  const spiderStages = playableScenarioOffer("resistance-spider-woman").mainSchemeStages!.recommended;
  const stub: CivilWarRandomizer = (request) => ({
    leaderId: request.leaderId ?? "resistance-spider-woman",
    stageIds: spiderStages,
    modularSetIds: recommended("resistance-spider-woman").slice(0, request.modularCount ?? 4),
  });

  test("applies the result as ordinary picks, advances the seed, and leaves the player free to edit", () => {
    const r = act(draftFor(IRON, 7), "civil:random", { random: stub });
    expect(r.draft.scenarioId).toBe("resistance-spider-woman");
    expect(r.draft.civilWar).toEqual({ stageIds: spiderStages, blind: false, random: true });
    expect(r.draft.seed).toBe(8);
    expect(r.effect).toMatchObject({ kind: "random", blind: false });
    const first = recommended("resistance-spider-woman")[0]!;
    expect(act(r.draft, `civil:set:${first}`).draft.modularSetIds).toHaveLength(3);
  });

  test("a pinned leader and a pinned side are passed and stay; the stepper is passed through", () => {
    const log: unknown[] = [];
    const recording: CivilWarRandomizer = (q) => (log.push(q), stub(q));
    const pinned = act(draftFor("resistance-captain-america", 3), "civil:random", {
      random: recording,
      pins: { leader: true, side: true, modularCount: 3 },
    });
    expect(log).toEqual([{ seed: 3, side: "resistance", leaderId: "resistance-captain-america", modularCount: 3 }]);
    expect(pinned.draft.scenarioId).toBe("resistance-captain-america");
    expect(pinned.draft.modularSetIds).toHaveLength(3);
    const sidePin = act(draftFor(IRON, 3), "civil:random", { random: recording, pins: { side: true } });
    expect(log[1]).toEqual({ seed: 3, side: "registration" });
    expect(sidePin.effect).toMatchObject({ request: { side: "registration" } });
  });

  test("the same seed gives the same draft; the next press asks with the next seed", () => {
    const log: unknown[] = [];
    const recording: CivilWarRandomizer = (q) => (log.push(q), stub(q));
    const a = act(draftFor(IRON, 9), "civil:random", { random: recording });
    const b = act(draftFor(IRON, 9), "civil:random", { random: recording });
    expect(b.draft).toEqual(a.draft);
    act(a.draft, "civil:random", { random: recording });
    expect(log.map((q) => (q as { seed: number }).seed)).toEqual([9, 9, 10]);
  });

  test("Random and blind sets blind; without a randomizer the effect is reported and nothing changes", () => {
    expect(act(draftFor(IRON), "civil:random-blind", { random: stub }).draft.civilWar!.blind).toBe(true);
    const d = draftFor(IRON);
    const none = act(d, "civil:random-blind");
    expect(none.draft).toBe(d);
    expect(none.effect).toEqual({ kind: "random", blind: true, request: { seed: 5 } });
  });
});

describe("9. blind", () => {
  test("the summary hides stage 2 and the set names but keeps the leader; Show me restores them", () => {
    const blind = act(draftFor(IRON), "civil:blind:hide").draft;
    const v = view(blind);
    expect(v.blind).toBe(true);
    expect(v.summary).toContain("Stage 2: hidden");
    expect(v.summary).toContain("Modular sets: 4 hidden");
    expect(v.summary).toContain("Leader: Iron Man (stage I)");
    expect(v.summary).toContain("Stage 1: Cut Off Support");
    expect(JSON.stringify(v.summary)).not.toContain("Negative Zone Prison");
    expect(v.stageRows[1]!.hidden).toBe(true);
    expect(v.stageRows[1]!.options).toEqual([]);
    expect(v.modular.sections).toEqual([]);
    expect(v.steps[2]!.line).toBe("Cut Off Support, stage 2 hidden");
    const shown = view(act(blind, "civil:blind:show").draft);
    expect(shown.blind).toBe(false);
    expect(shown.summary).toContain("Stage 2: Negative Zone Prison");
    expect(shown.summary.find((l) => l.startsWith("Modular sets: "))).not.toContain("hidden");
    expect(shown.stageRows[1]!.options).toHaveLength(4);
  });
});

describe("10. game mode", () => {
  test("modeOptions is the shared pair, cooperative selected", () => {
    expect(view(draftFor(IRON)).modeOptions).toEqual(
      GAME_MODE_OPTIONS.map((o) => ({ ...o, selected: o.id === "cooperative" })),
    );
    expect(playableScenarioOffer(IRON).gameModes!.map((m) => [m.mode, m.available])).toEqual([
      ["cooperative", true],
      ["competitive", false],
    ]);
  });

  test("tapping competitive changes nothing and the status line says why", () => {
    const d = draftFor(IRON);
    const r = act(d, "civil:mode:competitive");
    expect(r.draft).toBe(d);
    expect(r.status).toBe(COMPETITIVE_TAPPED_MESSAGE);
    expect(view(d, { status: r.status }).statusLine).toBe(
      "Competitive mode is coming soon. Play this scenario cooperatively for now.",
    );
    expect(act(d, "civil:mode:cooperative").status).toBeNull();
  });

  test.each(LEADERS)("%s: Start carries cooperative and never competitive", (id) => {
    const config = startConfigOf(draftFor(id), SPIDER, BASE)!;
    expect(config.gameMode).toBe("cooperative");
    expect(JSON.stringify(config)).not.toContain("competitive");
  });
});

describe("12. focus order and the action strings", () => {
  test.each([1, 2, 3, 4, 5] as const)("step %i: every control once, and every action runs without throwing", (step) => {
    const d = picks(draftFor(IRON), [...THREE, "martial_law"]);
    const v = view(d, { step, otherSideExpanded: true });
    expect(new Set(v.focusOrder).size).toBe(v.focusOrder.length);
    for (const a of v.focusOrder) expect(() => act(d, a)).not.toThrow();
    expect(v.focusOrder.slice(0, 5)).toEqual([1, 2, 3, 4, 5].map((n) => `civil:step:${n}`));
    expect(v.focusOrder.slice(-3)).toEqual(["civil:preconstructed", "civil:back", "civil:start"]);
  });

  test("step 4 lists each over-count and other-side tile once (the other side once expanded)", () => {
    const d = picks(draftFor(IRON), [...THREE, "martial_law"]);
    const open = view(d, { step: 4, otherSideExpanded: true });
    for (const t of open.modular.sections.flatMap((s) => s.tiles.map((x) => x.action)))
      expect(open.focusOrder.filter((a) => a === t)).toHaveLength(1);
    const collapsed = view(d, { step: 4 }).focusOrder;
    expect(collapsed).toContain("civil:other-side");
    expect(collapsed).not.toContain("civil:set:defenders");
  });

  test("navigation actions come back as effects", () => {
    expect(act(draftFor(IRON), "civil:step:3").effect).toEqual({ kind: "step", step: 3 });
    expect(act(draftFor(IRON), "civil:start").effect).toEqual({ kind: "start" });
    expect(act(draftFor(IRON), "civil:back").effect).toEqual({ kind: "back" });
  });

  test("the layout counts follow the sections", () => {
    const v = view(draftFor(IRON), { step: 4, extraSets: 1 });
    expect(v.layout.setCounts.side).toBe(8);
    expect(v.layout.setCounts.otherSide).toBe(8);
    expect(v.layout.setCounts.other).toBeGreaterThan(0);
    expect([v.layout.step, v.layout.otherSideExpanded, v.layout.extraSets]).toEqual([4, false, 1]);
  });
});

describe("idempotence and Start", () => {
  test.each(LEADERS)("%s: re-deriving the model of an accepted draft changes nothing", (id) => {
    const d = draftFor(id);
    expect(view(d, { offer: offerOf(d) })).toEqual(view(d));
    expect(openBuilderOn(d, id).draft).toEqual(d);
    expect(act(d, "civil:preconstructed").draft).toBe(d);
  });

  test("a custom accepted draft re-derives the same", () => {
    const d = act(picks(draftFor(IRON), THREE), "civil:stage:2:56123b").draft;
    expect(view(d)).toEqual(view(d, { offer: offerOf(d) }));
  });

  test("Start is refused with the offer's words while there is a problem", () => {
    const d = picks(draftFor(IRON), ["paladin"]);
    expect(startConfigOf(d, SPIDER, BASE)).toBeNull();
    expect(view(d).startProblem).toBe("Registration: Iron Man uses 3 to 4 modular sets, got 1");
  });

  const accepted = (config: NonNullable<ReturnType<typeof startConfigOf>>) =>
    playableScenario(config.scenarioId, {
      difficulty: config.difficulty,
      players: [...config.players],
      seed: config.seed,
      ...(config.modularSetIds ? { modularSetIds: config.modularSetIds } : {}),
      ...(config.mainSchemeStageIds ? { mainSchemeStageIds: config.mainSchemeStageIds } : {}),
      ...(config.gameMode ? { gameMode: config.gameMode } : {}),
    });

  test.each(LEADERS)("%s: Start's session config is accepted by playableScenario", (id) => {
    const config = startConfigOf(draftFor(id), SPIDER, BASE)!;
    expect(config).not.toBeNull();
    expect(() => accepted(config)).not.toThrow();
  });

  test("a custom build is accepted too", () => {
    const base = draftFor("resistance-captain-america");
    const d = act(picks(base, ["defenders", "hells_kitchen", "bomb_scare"]), "civil:stage:2:56168b").draft;
    const config = startConfigOf(d, SPIDER, BASE)!;
    expect(config.modularSetIds).toEqual(["defenders", "hells_kitchen", "bomb_scare"]);
    expect(() => accepted(config)).not.toThrow();
  });
});

describe("the status line the scene shows", () => {
  test("refusalOf: a disabled set, a disabled mode and a refused Start speak in the offer's words", () => {
    const four = picks(draftFor(IRON), [...THREE, "martial_law"]);
    const v = view(four);
    const unchosen = v.modular.sections
      .flatMap((s) => s.tiles)
      .find((t) => t.enabled === false && t.disabledReason === "Four is the most (MC56 p. 4)")!;
    expect(refusalOf(v, unchosen.action)).toBe("Four is the most (MC56 p. 4)");
    expect(refusalOf(v, "civil:mode:competitive")).toBe(GAME_MODE_OPTIONS[1]!.reason);
    expect(refusalOf(v, "civil:mode:cooperative")).toBeNull();
    expect(refusalOf(v, "civil:start")).toBeNull();
    const two = view(picks(draftFor(IRON), ["paladin", "cape_killer"]));
    expect(refusalOf(two, "civil:start")).toBe(two.startProblem);
    expect(two.startProblem).toContain("got 2");
  });

  test("defaultStatusOf: the whole scenario in one sentence, or the problem", () => {
    expect(defaultStatusOf(view(draftFor(IRON)))).toMatch(/^Iron Man, .+ then .+, 4 modular sets chosen of 3 to 4\.$/);
    const two = view(picks(draftFor(IRON), ["paladin", "cape_killer"]));
    expect(defaultStatusOf(two)).toBe(two.startProblem);
  });
});

describe("8b. Random with the cards function behind it (task C9)", () => {
  const real = { random: cardsRandomizer };
  const picksOf = (d: SetupDraft) =>
    JSON.stringify([d.scenarioId, d.civilWar!.stageIds, [...(d.modularSetIds ?? [])].sort()]);

  test("Random fills the builder with a legal scenario the player can still edit, and Start stays enabled", () => {
    const r = act(draftFor(IRON, 5), "civil:random", real);
    expect(r.draft.civilWar!.blind).toBe(false);
    const v = view(r.draft);
    expect(v.canStart).toBe(true);
    expect(v.modular.chosen).toBe(4);
    expect(v.stageRows[1]!.hidden).toBe(false);
    const stage = v.stageRows[0]!.options.find((o) => !o.selected)!;
    const edited = act(r.draft, `civil:stage:1:${stage.printedCardId}`).draft;
    expect(edited.civilWar!.stageIds[0]).toBe(stage.printedCardId);
  });

  test("pressing it again gives a different scenario (seed + 1) and the same seed gives the same one", () => {
    const first = act(draftFor(IRON, 5), "civil:random", real).draft;
    expect(first.seed).toBe(6);
    expect(picksOf(act(draftFor(IRON, 5), "civil:random", real).draft)).toBe(picksOf(first));
    const seen = new Set([picksOf(first)]);
    let d = first;
    for (let i = 0; i < 6; i++) {
      d = act(d, "civil:random", real).draft;
      seen.add(picksOf(d));
    }
    expect(seen.size).toBeGreaterThan(2);
    expect(picksOf(act(first, "civil:random", real).draft)).not.toBe(picksOf(first));
  });

  test("the lock toggles and the set stepper are effects the scene keeps; Random reads them", () => {
    const side = act(draftFor(IRON), "civil:lock:side");
    expect(side.effect).toEqual({ kind: "pins", pins: { side: true } });
    const off = act(draftFor(IRON), "civil:lock:side", { pins: { side: true } });
    expect(off.effect).toEqual({ kind: "pins", pins: { side: false } });
    expect(act(draftFor(IRON), "civil:count:3", { pins: { leader: true } }).effect).toEqual({
      kind: "pins",
      pins: { leader: true, modularCount: 3 },
    });
    expect(act(draftFor(IRON), "civil:count:5").effect).toBeUndefined();
    expect(view(draftFor(IRON)).randomPins).toEqual([
      { action: "civil:lock:side", label: "Random may change the side", on: false },
      { action: "civil:lock:leader", label: "Random may change the leader", on: false },
      { action: "civil:count:3", label: "Random draws 4 sets", on: false },
    ]);
    const pinned = view(draftFor(IRON), { pins: { side: true, leader: true, modularCount: 3 } }).randomPins;
    expect(pinned.map((p) => [p.label, p.on])).toEqual([
      ["Random keeps the side", true],
      ["Random keeps the leader", true],
      ["Random draws 3 sets", true],
    ]);
  });

  test("a pinned leader and side stay through many rolls; the count 3 gives three sets", () => {
    let d = draftFor("resistance-captain-america", 1);
    for (let i = 0; i < 5; i++) {
      d = act(d, "civil:random", { ...real, pins: { leader: true, side: true, modularCount: 3 } }).draft;
      expect(d.scenarioId).toBe("resistance-captain-america");
      expect(d.modularSetIds).toHaveLength(3);
      expect(view(d).canStart).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      d = act(d, "civil:random", { ...real, pins: { side: true } }).draft;
      expect(view(d).sideChoices.find((s) => s.selected)!.side).toBe("resistance");
    }
  });

  test("a failing randomizer says why and changes nothing", () => {
    const d = draftFor(IRON);
    const r = act(d, "civil:random", {
      random: () => {
        throw new Error("No such pairing.");
      },
    });
    expect(r.draft).toBe(d);
    expect(r.status).toBe("No such pairing.");
  });

  test("Random and blind masks stage 2 and the set names with exact words; Show reveals and turns blind off", () => {
    const blind = act(draftFor(IRON, 5), "civil:random-blind", real).draft;
    expect(blind.civilWar!.blind).toBe(true);
    const v = view(blind);
    const picked = view(act(blind, "civil:blind:show").draft);
    expect(v.summary[4]).toBe("Stage 2: hidden");
    expect(v.summary[7]).toBe("Modular sets: 4 hidden");
    expect(v.stageSummary).toBe("");
    expect(v.stageRows[1]!.options).toEqual([]);
    expect(v.modular.hidden).toBe(true);
    expect(v.modular.sections).toEqual([]);
    expect(v.steps[2]!.line).toBe(`${v.summary[3]!.slice("Stage 1: ".length)}, stage 2 hidden`);
    expect(v.steps[3]!.line).toBe("4 sets hidden");
    expect(v.summary[3]).toBe(picked.summary[3]);
    expect(v.focusOrder).toContain("civil:blind:show");
    expect(picked.blind).toBe(false);
    expect(picked.summary[4]).toMatch(/^Stage 2: (?!hidden)/);
    expect(picked.summary[7]).toMatch(/^Modular sets: [A-Za-z]/);
    expect(picked.focusOrder).not.toContain("civil:blind:show");
  });
});

describe("a rolled scenario is marked random until the player edits it", () => {
  const real = { random: cardsRandomizer };

  test("Random sets the mark, a blind toggle keeps it, and the mark reaches the session config", () => {
    const rolled = act(draftFor(IRON, 5), "civil:random", real).draft;
    expect(rolled.civilWar!.random).toBe(true);
    expect(toSessionConfig(rolled, SPIDER).randomScenario).toBe(true);
    const blind = act(rolled, "civil:blind:hide").draft;
    expect(blind.civilWar!.random).toBe(true);
    expect(toSessionConfig(draftFor(IRON), SPIDER).randomScenario).toBeUndefined();
  });

  test("changing the leader drops the mark", () => {
    const rolled = act(draftFor(IRON, 5), "civil:random", real).draft;
    const other = LEADERS.find((id) => id !== rolled.scenarioId)!;
    const edited = act(rolled, `civil:leader:${other}`).draft;
    expect(edited.scenarioId).toBe(other);
    expect(edited.civilWar!.random).toBeUndefined();
  });
});
