import { describe, expect, test } from "vitest";
import { playableScenarioOffer } from "@mc/cards";
import {
  CW_CARDS,
  CW_ENCOUNTER_SETS,
  CW_SCENARIOS,
  SYNTHEZOID_CARDS,
  SYNTHEZOID_SCENARIOS,
  type AnyCard,
} from "@mc/content";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { applyBuilderAction, builderViewOf, openBuilderOn, type BuilderContext } from "./civil-war-builder-model.js";
import { sealedScenarioOf } from "./competitive-seal.js";
import { effectiveSetIds as effectiveSetIdsOf } from "./civil-war-builder-model.js";
import { setModularSetIds } from "./setup-draft.js";
import { initialSetupDraft } from "./setup-draft.js";
import { offerOf } from "./setup-options.js";

const BASE: BuilderContext = {
  cards: new Map<string, AnyCard>([...CW_CARDS, ...SYNTHEZOID_CARDS].map((c) => [c.id as string, c])),
  scenarios: [...CW_SCENARIOS, ...SYNTHEZOID_SCENARIOS],
  encounterSets: [...POOL_ENCOUNTER_SETS, ...CW_ENCOUNTER_SETS],
};
const start = (id: string) =>
  openBuilderOn(initialSetupDraft({ scenarioId: "rhino", seatDeckId: "x", seed: 1 }), id).draft;

describe("the builder for the other team", () => {
  test("offers only this side's leaders and no difficulty or game mode", () => {
    const view = builderViewOf(start("resistance-captain-america"), { ...BASE, sealSide: "resistance" })!;
    expect(view.sideChoices.map((s) => s.side)).toEqual(["resistance"]);
    expect(view.difficultyChoices).toEqual([]);
    expect(view.modeOptions).toEqual([]);
    expect(view.seal).toEqual({ side: "resistance" });
  });

  test("a set from another product is refused with the competitive reason", () => {
    const view = builderViewOf(start("registration-iron-man"), { ...BASE, sealSide: "registration", step: 4 })!;
    const neutral = view.modular.sections.find((s) => s.key === "other")!.tiles;
    expect(neutral.length).toBeGreaterThan(0);
    for (const tile of neutral) {
      expect(tile.enabled).toBe(false);
      expect(tile.disabledReason).toMatch(/competitive mode/);
    }
    // The ordinary builder still allows them.
    const plain = builderViewOf(start("registration-iron-man"), { ...BASE, step: 4 })!;
    expect(
      plain.modular.sections
        .find((s) => s.key === "other")!
        .tiles.some((tile) => /competitive mode/.test(tile.disabledReason ?? "")),
    ).toBe(false);
  });

  test("the other side cannot be picked while sealing", () => {
    const draft = start("registration-iron-man");
    const result = applyBuilderAction(draft, "civil:side:resistance", { ...BASE, sealSide: "registration" });
    expect(result.draft).toBe(draft);
  });

  test("seals the leader, sets and stages as plain data", () => {
    const draft = start("resistance-captain-america");
    const offer = offerOf(draft);
    const sealed = sealedScenarioOf(draft, offer)!;
    expect(sealed.leaderScenarioId).toBe("resistance-captain-america");
    expect(sealed.mainSchemeStageIds).toHaveLength(2);
    expect(sealed.modularSetIds.length).toBeGreaterThanOrEqual(3);
    expect(JSON.parse(JSON.stringify(sealed))).toEqual(sealed);
  });

  test("every leader's ready-made sets are sided, so a ready-made build can be sealed as is", () => {
    for (const id of [
      "registration-iron-man",
      "registration-captain-marvel",
      "resistance-captain-america",
      "resistance-spider-woman",
    ]) {
      const sets = playableScenarioOffer(id).modularSets!.filter((s) => s.recommended);
      expect(
        sets.every((s) => s.side !== null),
        id,
      ).toBe(true);
    }
  });
});

describe("sealing refuses a neutral set (MC56 p. 5)", () => {
  test("tapping a set from another product leaves the draft unchanged in seal mode, not in the ordinary builder", () => {
    const draft = start("registration-iron-man");
    const neutral = playableScenarioOffer("registration-iron-man").modularSets!.find((s) => s.side === null && s.ok)!;
    // Make room so only legality, not the cap, decides.
    const chosen = playableScenarioOffer("registration-iron-man")
      .modularSets!.filter((s) => s.recommended)
      .slice(0, 2)
      .map((s) => s.id);
    const room = applyBuilderAction(draft, `civil:set:${chosen[0]}`, BASE).draft;
    const sealed = applyBuilderAction(room, `civil:set:${neutral.id}`, { ...BASE, sealSide: "registration" });
    expect(sealed.draft).toBe(room);
    const plain = applyBuilderAction(room, `civil:set:${neutral.id}`, BASE);
    expect(plain.draft).not.toBe(room);
  });

  test("a build that holds a neutral set cannot be sealed", () => {
    const draft = start("registration-iron-man");
    const offer = offerOf(draft);
    const neutral = offer.modularSets!.find((s) => s.side === null && s.ok)!;
    const sets = [...effectiveSetIdsOf(draft, offer).slice(0, 2), neutral.id];
    const bad = setModularSetIds(draft, sets);
    const view = builderViewOf(bad, { ...BASE, sealSide: "registration" })!;
    expect(view.canStart).toBe(false);
    expect(view.startProblem).toMatch(/competitive mode/);
  });
});

import { heroSharingLeaderTitle } from "./competitive-seal.js";

describe("heroSharingLeaderTitle", () => {
  test("finds a hero named like the team's own leader", () => {
    expect(heroSharingLeaderTitle(["Iron Man (Aggression)|01028a", "Spider-Man (Justice)|01001a"], "Iron Man")).toBe(
      "Iron Man",
    );
    expect(heroSharingLeaderTitle(["Spider-Man (Justice)|01001a"], "Iron Man")).toBeNull();
    expect(heroSharingLeaderTitle(["?"], "Iron Man")).toBeNull();
  });
});
