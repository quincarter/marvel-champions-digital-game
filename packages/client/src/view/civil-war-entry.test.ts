import { afterEach, describe, expect, test } from "vitest";
import { playableScenarioOffer } from "@mc/cards";
import { CW_SCENARIOS } from "@mc/content";
import { POOL_SCENARIOS } from "../content/pool.js";
import {
  BUILDER_TILE,
  CIVIL_WAR_TITLE_LABEL,
  civilWarTitleEntryOf,
  lastBuilderOrigin,
  setBuilderOrigin,
  NOT_IN_POOL_MESSAGE,
  builderTileShelfOf,
  customizeEntryOf,
  enterBuilder,
  forgetLastBuild,
  handoffOf,
  isBuilderTile,
  isCivilWarScenario,
  rememberBuild,
  shelvesWithBuilderTile,
} from "./civil-war-entry.js";
import type { Shelf } from "./roster-shelves.js";
import { initialSetupDraft, setModularSetIds } from "./setup-draft.js";

const IRON = "registration-iron-man";
const draftFor = (id: string) => initialSetupDraft({ scenarioId: id, seatDeckId: "x", seed: 3 });
const civil = CW_SCENARIOS[0]!;
const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const shelf = (id: string, items: Shelf<typeof rhino>["items"]): Shelf<typeof rhino> => ({ id, title: id, items });

afterEach(() => forgetLastBuild());

describe("the entry points appear exactly when a Civil War scenario is in the pool", () => {
  test("a Civil War scenario qualifies, a villain scenario does not", () => {
    expect(isCivilWarScenario(civil)).toBe(true);
    expect(isCivilWarScenario(rhino)).toBe(false);
    expect(isCivilWarScenario(undefined)).toBe(false);
  });

  test("Customize: only on a Civil War scenario, and only while its offer states the stages", () => {
    expect(customizeEntryOf(civil)).toEqual({ scenarioId: civil.id, label: "Customize this scenario" });
    expect(customizeEntryOf(rhino)).toBeNull();
    expect(customizeEntryOf(civil, () => null)).toBeNull();
    expect(customizeEntryOf(civil, (id) => ({ ...playableScenarioOffer(id), mainSchemeStages: null }))).toBeNull();
  });

  test("the tile heads the Civil War shelf only; a pool without one adds nothing", () => {
    const today = [shelf("core", [rhino]), shelf("sm", [rhino])];
    expect(builderTileShelfOf(today)).toBeNull();
    expect(shelvesWithBuilderTile(today)).toEqual(today);

    const withCw = [shelf("core", [rhino]), shelf("scw", [civil as typeof rhino, rhino])];
    expect(builderTileShelfOf(withCw)).toBe("scw");
    const shelves = shelvesWithBuilderTile(withCw);
    expect(shelves[0]!.items).toEqual([rhino]);
    expect(shelves[1]!.items[0]).toBe(BUILDER_TILE);
    expect(shelves[1]!.items.slice(1)).toEqual([civil, rhino]);
    expect(isBuilderTile(shelves[1]!.items[0]!)).toBe(true);
    expect(isBuilderTile(rhino)).toBe(false);
  });
});

describe("opening the builder and remembering the last build", () => {
  test("Customize opens the review step on the scenario as printed", () => {
    const edited = setModularSetIds(draftFor(IRON), ["paladin", "cape_killer", "bomb_scare"]);
    const entry = enterBuilder("customize", edited, IRON);
    expect(entry.step).toBe(5);
    expect(entry.draft.modularSetIds).toBeNull();
  });

  test("Build your own starts at the side step on the first leader, then resumes the last build", () => {
    const first = enterBuilder("build", draftFor("rhino"), IRON);
    expect(first.step).toBe(1);
    expect(first.draft.scenarioId).toBe(IRON);

    const custom = setModularSetIds(first.draft, ["paladin", "cape_killer", "bomb_scare"]);
    rememberBuild(custom);
    const again = enterBuilder("build", draftFor("rhino"), IRON);
    expect(again.step).toBe(1);
    expect(again.draft.scenarioId).toBe(IRON);
    expect(again.draft.modularSetIds).toEqual(["paladin", "cape_killer", "bomb_scare"]);
    expect(again.draft.civilWar!.stageIds).toEqual(custom.civilWar!.stageIds);
  });

  test("a remembered build on another leader comes back on that leader", () => {
    const resistance = enterBuilder("customize", draftFor(IRON), "resistance-captain-america").draft;
    rememberBuild(resistance);
    const again = enterBuilder("build", draftFor("rhino"), IRON);
    expect(again.draft.scenarioId).toBe("resistance-captain-america");
    expect(again.draft.modularSetIds).toBeNull();
  });

  test("a draft that is not at a Civil War leader remembers nothing", () => {
    rememberBuild(draftFor("rhino"));
    expect(enterBuilder("build", draftFor("rhino"), IRON).draft.scenarioId).toBe(IRON);
  });
});

describe("Start hands the draft to Take your seats, and stops short while the pool lacks the scenario", () => {
  test("in the pool: seats with the draft; absent: blocked with the reason", () => {
    const d = enterBuilder("customize", draftFor(IRON), IRON).draft;
    expect(handoffOf(d, new Set([IRON]))).toEqual({ kind: "seats", draft: d });
    expect(handoffOf(d, new Set(["rhino"]))).toEqual({ kind: "blocked", message: NOT_IN_POOL_MESSAGE });
  });
});

describe("the Title's Civil War! entry", () => {
  test("labeled exactly Civil War!", () => expect(CIVIL_WAR_TITLE_LABEL).toBe("Civil War!"));

  test("absent while the box is locked, present (naming the first leader) once it is open", () => {
    expect(
      civilWarTitleEntryOf("Complete the Agents of S.H.I.E.L.D. campaign to unlock Civil War", POOL_SCENARIOS),
    ).toBeNull();
    expect(civilWarTitleEntryOf(null, POOL_SCENARIOS)?.scenarioId).toBe(IRON);
  });

  test("absent when no Civil War scenario is in the pool", () => {
    expect(civilWarTitleEntryOf(null, [rhino])).toBeNull();
  });

  test("the builder's origin is remembered for the session", () => {
    setBuilderOrigin("title");
    expect(lastBuilderOrigin()).toBe("title");
    setBuilderOrigin("scenarioSelect");
    expect(lastBuilderOrigin()).toBe("scenarioSelect");
  });
});
