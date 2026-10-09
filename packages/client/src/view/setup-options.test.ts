import { describe, expect, test } from "vitest";
import { playableScenarioOffer } from "@mc/cards";
import { encounterSetId } from "@mc/content";
import { EngineSessionCore } from "../engine/session-core.js";
import { POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { initialSetupDraft, setDifficulty, setModularSetIds, setScenario, toSessionConfig } from "./setup-draft.js";
import type { SetupDraft } from "./setup-draft.js";
import {
  applySetupOption,
  effectiveHorsemanSides,
  isSetChoiceRow,
  offerOf,
  optionActionsOf,
  reconcileWithOffer,
  setChipLabel,
  setupOptionRowsOf,
  splitOptionRows,
} from "./setup-options.js";

const SET_NAMES = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));
const PLAYERS = [{ starterDeckId: "core-spider-man-justice" }] as const;

const draftFor = (scenarioId: string): SetupDraft =>
  initialSetupDraft({ scenarioId, seatDeckId: "precon:core-spider-man-justice", seed: 7 });
const rowsOf = (draft: SetupDraft) => setupOptionRowsOf(draft, SET_NAMES);
const rowIds = (draft: SetupDraft) => rowsOf(draft).map((row) => row.id);
const apply = (draft: SetupDraft, ...actions: string[]) => actions.reduce(applySetupOption, draft);

describe("offerOf", () => {
  test("is exactly the cards package's offer for every scenario the pool lists", () => {
    for (const scenario of POOL_SCENARIOS) {
      const draft = draftFor(scenario.id as string);
      expect(offerOf(draft), scenario.id as string).toEqual(
        playableScenarioOffer(scenario.id as string, { difficulty: "standard" }),
      );
    }
  });

  test("follows the difficulty and the modular picks", () => {
    expect(offerOf({ ...draftFor("apocalypse"), difficulty: "expert" }).easierStart).toBe(false);
    expect(offerOf(draftFor("apocalypse")).easierStart).toBe(true);
    expect(offerOf(draftFor("rhino")).genePoolThreat).toBeNull();
    expect(offerOf({ ...draftFor("rhino"), modularSetIds: ["infinites"] }).genePoolThreat).not.toBeNull();
  });
});

describe("set chips", () => {
  test("labels are the numeral after the classification, and I for the printed set", () => {
    expect(setChipLabel("Standard")).toBe("I");
    expect(setChipLabel("Standard II")).toBe("II");
    expect(setChipLabel("Standard III")).toBe("III");
    expect(setChipLabel("Expert II")).toBe("II");
    expect(setChipLabel(SET_NAMES.get("standard_iii")!)).toBe("III");
    expect(setChipLabel(SET_NAMES.get("expert_ii")!)).toBe("II");
  });
});

describe("Standard and Expert set choice (Q10 = A)", () => {
  test("Rhino (a Core scenario) offers Standard II and III, and no Expert row on standard", () => {
    expect(rowIds(draftFor("rhino"))).toEqual(["standardSet"]);
    const row = rowsOf(draftFor("rhino"))[0]!;
    if (row.control.kind !== "groups") throw new Error("expected chips");
    expect(row.control.groups[0]!.chips.map((c) => [c.label, c.selected])).toEqual([
      ["I", true],
      ["II", false],
      ["III", false],
    ]);
    expect(optionActionsOf([row])).toEqual([
      "standardSet:default",
      "standardSet:standard_ii",
      "standardSet:standard_iii",
    ]);
  });

  test("expert shows an Expert row beside it, and standard hides it again", () => {
    const expert = setDifficulty(draftFor("rhino"), "expert");
    expect(rowIds(expert)).toEqual(["standardSet", "expertSet"]);
    expect(optionActionsOf(rowsOf(expert).slice(1))).toEqual(["expertSet:default", "expertSet:expert_ii"]);
  });

  test("Standard III and Expert II are chosen separately; choosing the printed set clears one", () => {
    let draft = setDifficulty(draftFor("rhino"), "expert");
    draft = apply(draft, "standardSet:standard_iii");
    expect(draft.difficultySets).toEqual({ standard: "standard_iii" });
    draft = apply(draft, "expertSet:expert_ii");
    expect(draft.difficultySets).toEqual({ standard: "standard_iii", expert: "expert_ii" });
    draft = apply(draft, "standardSet:default");
    expect(draft.difficultySets).toEqual({ expert: "expert_ii" });
    draft = apply(draft, "expertSet:default");
    expect(draft.difficultySets).toBeNull();
  });

  test("The Hood keeps Standard II / Expert II, now as two choices", () => {
    let draft = setDifficulty(draftFor("the-hood"), "expert");
    draft = apply(draft, "standardSet:standard_ii", "expertSet:expert_ii");
    expect(draft.difficultySets).toEqual({
      standard: encounterSetId("standard_ii"),
      expert: encounterSetId("expert_ii"),
    });
    expect(toSessionConfig(draft, PLAYERS).difficultySets).toEqual(draft.difficultySets);
  });

  test("switching back to standard drops the Expert set but keeps the Standard one", () => {
    let draft = setDifficulty(draftFor("rhino"), "expert");
    draft = apply(draft, "standardSet:standard_ii", "expertSet:expert_ii");
    draft = setDifficulty(draft, "standard");
    expect(draft.difficultySets).toEqual({ standard: "standard_ii" });
  });

  test("a scenario with no plain Standard set (Breakout) offers no Standard row", () => {
    expect(rowIds(draftFor("breakout"))).toEqual([]);
  });

  test("an unlisted or stale action changes nothing", () => {
    const draft = draftFor("rhino");
    expect(applySetupOption(draft, "standardSet:expert_ii")).toBe(draft);
    expect(applySetupOption(draft, "expertSet:expert_ii")).toBe(draft);
    expect(applySetupOption(draft, "genePool:up")).toBe(draft);
    expect(applySetupOption(draft, "nonsense")).toBe(draft);
  });

  test("changing scenario resets the choice", () => {
    const draft = apply(draftFor("rhino"), "standardSet:standard_iii");
    const next = setScenario(
      draft,
      POOL_SCENARIOS.find((s) => (s.id as string) === "klaw")!,
      "klaw",
    );
    expect(next.difficultySets).toBeNull();
  });
});

describe("Gene Pool threat (Q1 = A)", () => {
  test("shown at Unus and absent at Rhino with no Infinites; a modular pick brings it to Rhino", () => {
    expect(rowIds(draftFor("unus"))).toContain("genePool");
    expect(rowIds(draftFor("rhino"))).not.toContain("genePool");
    expect(rowIds(setModularSetIds(draftFor("rhino"), ["infinites"]))).toContain("genePool");
  });

  test("off by default; turning it on starts at the recommendation, then steps 1 to 3 and back off", () => {
    let draft = draftFor("unus");
    expect(draft.genePoolThreatPerPlayer).toBe(0);
    const row = () => rowsOf(draft).find((r) => r.id === "genePool")!;
    expect(row().meta).toBe("Off");
    draft = apply(draft, "genePool:up");
    expect(draft.genePoolThreatPerPlayer).toBe(1);
    draft = apply(draft, "genePool:up", "genePool:up", "genePool:up");
    expect(draft.genePoolThreatPerPlayer).toBe(3);
    expect(row().meta).toBe("3 per player");
    if (row().control.kind !== "stepper") throw new Error("expected stepper");
    expect((row().control as { up: { enabled: boolean } }).up.enabled).toBe(false);
    draft = apply(draft, "genePool:down", "genePool:down", "genePool:down", "genePool:down");
    expect(draft.genePoolThreatPerPlayer).toBe(0);
    expect((row().control as { down: { enabled: boolean } }).down.enabled).toBe(false);
  });

  test("turning it on at expert starts at the expert recommendation (2)", () => {
    const draft = apply(setDifficulty(draftFor("unus"), "expert"), "genePool:up");
    expect(draft.genePoolThreatPerPlayer).toBe(2);
  });

  test("taking Infinites out of the modular picks drops the amount; a change of scenario resets it", () => {
    let draft = apply(setModularSetIds(draftFor("rhino"), ["infinites"]), "genePool:up");
    expect(draft.genePoolThreatPerPlayer).toBe(1);
    expect(toSessionConfig(draft, PLAYERS).genePoolThreatPerPlayer).toBe(1);
    expect(setModularSetIds(draft, ["bomb_scare"]).genePoolThreatPerPlayer).toBe(0);
    draft = setScenario(
      draft,
      POOL_SCENARIOS.find((s) => (s.id as string) === "unus")!,
      "unus",
    );
    expect(draft.genePoolThreatPerPlayer).toBe(0);
  });

  test("only a chosen amount is sent", () => {
    expect(toSessionConfig(draftFor("unus"), PLAYERS)).not.toHaveProperty("genePoolThreatPerPlayer");
    expect(toSessionConfig({ ...draftFor("unus"), genePoolThreatPerPlayer: 2 }, PLAYERS).genePoolThreatPerPlayer).toBe(
      2,
    );
    // A stale amount at a game without the set never reaches the builder.
    expect(toSessionConfig({ ...draftFor("rhino"), genePoolThreatPerPlayer: 2 }, PLAYERS)).not.toHaveProperty(
      "genePoolThreatPerPlayer",
    );
  });
});

describe("a side per Horseman (Q9 = B)", () => {
  test("four A/B selectors in the offer's order at the Four Horsemen only, none labeled Extreme", () => {
    expect(rowIds(draftFor("unus"))).not.toContain("horsemanSides");
    const row = rowsOf(draftFor("four-horsemen")).find((r) => r.id === "horsemanSides")!;
    if (row.control.kind !== "groups") throw new Error("expected groups");
    expect(row.control.groups.map((g) => g.label)).toEqual(["War", "Famine", "Pestilence", "Death"]);
    expect(row.control.groups.every((g) => g.chips.map((c) => c.label).join("") === "AB")).toBe(true);
    expect(JSON.stringify(row)).not.toMatch(/extreme/i);
  });

  test("defaults from the difficulty and follows it until one is touched", () => {
    let draft = draftFor("four-horsemen");
    const offer = () => offerOf(draft);
    expect(effectiveHorsemanSides(draft, offer())).toEqual(["A", "A", "A", "A"]);
    draft = setDifficulty(draft, "expert");
    expect(effectiveHorsemanSides(draft, offer())).toEqual(["B", "B", "B", "B"]);
    draft = apply(draft, "horseman:1:A");
    expect(draft.horsemanSides).toEqual(["B", "A", "B", "B"]);
    draft = setDifficulty(draft, "standard");
    expect(draft.horsemanSides).toEqual(["B", "A", "B", "B"]);
    expect(toSessionConfig(draft, PLAYERS).horsemanSides).toEqual(["B", "A", "B", "B"]);
  });

  test("an untouched row sends nothing, so the builder's own default applies", () => {
    expect(toSessionConfig(draftFor("four-horsemen"), PLAYERS)).not.toHaveProperty("horsemanSides");
  });

  test("a bad index or side changes nothing, and a change of scenario resets the sides", () => {
    const draft = draftFor("four-horsemen");
    expect(applySetupOption(draft, "horseman:4:A")).toBe(draft);
    expect(applySetupOption(draft, "horseman:0:C")).toBe(draft);
    expect(applySetupOption(draftFor("unus"), "horseman:0:B").horsemanSides).toBeNull();
    const touched = apply(draft, "horseman:0:B");
    expect(
      setScenario(
        touched,
        POOL_SCENARIOS.find((s) => (s.id as string) === "unus")!,
        "unus",
      ).horsemanSides,
    ).toBeNull();
  });
});

describe("Apocalypse's easier start (Q12 = A)", () => {
  test("a toggle shown at Apocalypse on standard only, off by default", () => {
    const row = rowsOf(draftFor("apocalypse")).find((r) => r.id === "easierStart")!;
    expect(row.name).toBe("Easier start: begin at Apocalypse (I)");
    expect(row.control).toEqual({ kind: "toggle", action: "easierStart:toggle" });
    expect(draftFor("apocalypse").easierStart).toBe(false);
    expect(rowIds(draftFor("unus"))).not.toContain("easierStart");
    expect(rowIds(setDifficulty(draftFor("apocalypse"), "expert"))).not.toContain("easierStart");
  });

  test("toggles on and off, is sent only when on, and expert does not send it, though standard remembers it", () => {
    let draft = apply(draftFor("apocalypse"), "easierStart:toggle");
    expect(draft.easierStart).toBe(true);
    expect(toSessionConfig(draft, PLAYERS).easierStart).toBe(true);
    expect(rowsOf(draft).find((r) => r.id === "easierStart")!.meta).toBe("On · begins at stage I");
    const expert = setDifficulty(draft, "expert");
    expect(toSessionConfig(expert, PLAYERS)).not.toHaveProperty("easierStart");
    expect(rowIds(expert)).not.toContain("easierStart");
    expect(setDifficulty(expert, "standard").easierStart).toBe(true);
    draft = apply(draft, "easierStart:toggle");
    expect(toSessionConfig(draft, PLAYERS)).not.toHaveProperty("easierStart");
  });

  test("a toggle at another scenario does nothing", () => {
    expect(apply(draftFor("unus"), "easierStart:toggle").easierStart).toBe(false);
  });
});

describe("reconcileWithOffer", () => {
  test("drops every choice a different scenario does not offer", () => {
    const stale: SetupDraft = {
      ...draftFor("breakout"),
      difficultySets: { standard: encounterSetId("standard_iii") },
      genePoolThreatPerPlayer: 3,
      horsemanSides: ["B", "B", "B", "B"],
      easierStart: true,
    };
    const next = reconcileWithOffer(stale);
    expect(next.difficultySets).toBeNull();
    expect(next.genePoolThreatPerPlayer).toBe(0);
    expect(next.horsemanSides).toBeNull();
    expect(next.easierStart).toBe(false);
  });
});

describe("what the engine gets", () => {
  const start = async (draft: SetupDraft) =>
    (await new EngineSessionCore().start(toSessionConfig(draft, PLAYERS))).snapshot.state;
  const cardIdsInGame = (state: Awaited<ReturnType<typeof start>>): string[] =>
    Object.values(state.instances).map((instance) => instance.cardId as string);

  test("Gene Pool threat reaches the table", async () => {
    const threatOnGenePool = async (draft: SetupDraft): Promise<number> => {
      const state = await start(draft);
      const genePool = Object.values(state.instances).find((instance) => (instance.cardId as string) === "45071");
      return genePool?.threat ?? 0;
    };
    const base = draftFor("unus");
    const without = await threatOnGenePool(base);
    expect(await threatOnGenePool(apply(base, "genePool:up", "genePool:up"))).toBe(without + 2);
  });

  test("the Horsemen's chosen sides are the cards on the board", async () => {
    const draft = apply(draftFor("four-horsemen"), "horseman:1:B", "horseman:3:B");
    const ids = cardIdsInGame(await start(draft));
    for (const id of ["45081a", "45082b", "45083a", "45084b"]) expect(ids).toContain(id);
  });

  test("the easier start begins Apocalypse a stage earlier", async () => {
    const stageOf = async (draft: SetupDraft): Promise<number | undefined> => {
      const state = await start(draft);
      return state.villains[0]?.stageIndex;
    };
    const printed = await stageOf(draftFor("apocalypse"));
    const easier = await stageOf(apply(draftFor("apocalypse"), "easierStart:toggle"));
    expect(easier).toBeDefined();
    expect(easier).toBe((printed ?? 0) - 1);
  });

  test("Standard III cards are in the encounter deck in place of Standard", async () => {
    const standardIII = (await import("@mc/content")).PLAYABLE_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes("standard_iii"),
    ).map((card) => card.id as string);
    const ids = cardIdsInGame(await start(apply(draftFor("rhino"), "standardSet:standard_iii")));
    expect(standardIII.length).toBeGreaterThan(0);
    expect(ids.filter((id) => standardIII.includes(id)).length).toBeGreaterThan(0);
    const printedIds = cardIdsInGame(await start(draftFor("rhino")));
    expect(printedIds.filter((id) => standardIII.includes(id))).toEqual([]);
  });

  test("an older save (no wave 8 fields) still starts", async () => {
    const config = toSessionConfig(draftFor("rhino"), PLAYERS);
    expect(config).not.toHaveProperty("horsemanSides");
    const started = await new EngineSessionCore().start({ ...config });
    expect(started.snapshot.state).toBeDefined();
  });
});

describe("the set choices folded into the difficulty row", () => {
  test("splitOptionRows takes the Standard and Expert set rows out of the option cards and keeps every action", () => {
    const expert = setDifficulty(draftFor("rhino"), "expert");
    const rows = rowsOf(expert);
    const { setChoices, cards } = splitOptionRows(rows);
    expect(setChoices.map((row) => row.id)).toEqual(["standardSet", "expertSet"]);
    expect(setChoices.every(isSetChoiceRow)).toBe(true);
    expect(cards).toEqual([]);
    // The focus order lists the same actions it did, in the same order.
    expect(optionActionsOf([...setChoices, ...cards])).toEqual(optionActionsOf(rows));
    // Expert set only while expert is the difficulty (reconcile is unchanged).
    expect(splitOptionRows(rowsOf(draftFor("rhino"))).setChoices.map((row) => row.id)).toEqual(["standardSet"]);
  });

  test("the other options stay cards, in draw order, after the set rows", () => {
    const { setChoices, cards } = splitOptionRows(rowsOf(draftFor("four-horsemen")));
    expect(setChoices.map((row) => row.id)).toEqual(["standardSet"]);
    expect(cards.map((row) => row.id)).toEqual(["horsemanSides"]);
    expect(cards.every((row) => !isSetChoiceRow(row))).toBe(true);
    const apocalypse = splitOptionRows(rowsOf(draftFor("apocalypse")));
    expect(apocalypse.cards.map((row) => row.id)).toContain("easierStart");
  });

  test("the easier start shares a row with Gene Pool (a half-width card)", () => {
    const row = rowsOf(draftFor("apocalypse")).find((r) => r.id === "easierStart")!;
    expect(row.span).toBe(1);
  });
});
