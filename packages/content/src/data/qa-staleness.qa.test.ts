/**
 * QA 2026-10-13, card-data staleness audit (docs/qa-card-data-staleness.md): committed card data that a fresh
 * `ingest --offline` emit of its pack disagrees with, where the emit is right (raw MarvelCDB record, and the scan
 * where one exists). Every pin is `it.fails` asserting the CORRECT value, so fixing the data flips it to a failure
 * of the pin: delete the `.fails` then.
 */
import { describe, expect, it } from "vitest";
import type { AnyCard } from "../schema/cards/index.js";
import { CORE_ENCOUNTER_SETS } from "./core/encounterSets.js";
import { GAMBIT_CARDS } from "./gambit/cards.js";
import { GMW_CARDS } from "./gmw/cards.js";
import { MOJO_CARDS } from "./mojo/cards.js";
import { MTS_CARDS } from "./mts/cards.js";
import { MUT_GEN_CARDS } from "./mut_gen/cards.js";
import { NEBU_CARDS } from "./nebu/cards.js";
import { PHOENIX_CARDS } from "./phoenix/cards.js";
import { SM_CARDS } from "./sm/cards.js";
import { TOAFK_CARDS } from "./toafk/cards.js";

const find = (cards: readonly AnyCard[], id: string): any => {
  const card = cards.find((candidate) => (candidate.id as string) === id);
  if (!card) throw new Error(`card ${id} not in its pack's data`);
  return card;
};

describe("stale scheme icons (printed on the card, missing from the data)", () => {
  // A hazard icon deals each player an extra encounter card; an acceleration icon adds threat each round; a crisis
  // icon stops the main scheme being thwarted. The engine counts them for any card in play (rules.ts printedIconsOn).
  const pins: readonly [string, readonly AnyCard[], string, string][] = [
    ["37025 Guild Business (obligation)", GAMBIT_CARDS, "37025", "hazard"],
    ["16108 Kree Command Ship (environment)", GMW_CARDS, "16108", "hazard"],
    ["16126 Vandarian Power Stone (attachment)", GMW_CARDS, "16126", "hazard"],
    ["39036 Build the Case (obligation)", MOJO_CARDS, "39036", "acceleration"],
    ["39064 The One with the Breakup (obligation)", MOJO_CARDS, "39064", "hazard"],
    ["21189b Jormungand (attachment)", MTS_CARDS, "21189b", "acceleration"],
    ["27105 Team Leader (attachment)", SM_CARDS, "27105", "crisis"],
    ["27174a Public Outcry (environment)", SM_CARDS, "27174a", "acceleration"],
    ["27190 Venom (ally)", SM_CARDS, "27190", "hazard"],
    ["27191 Symbiote Suit (upgrade)", SM_CARDS, "27191", "hazard"],
  ];
  for (const [label, cards, id, icon] of pins) {
    it.fails(`${label} shows its ${icon} icon`, () => {
      expect(find(cards, id).schemeIcons).toEqual([icon]);
    });
  }
});

describe("stale encounter set membership", () => {
  // Without a set the card is never shuffled into a built encounter deck (kang-encounter-set.test.ts relabels
  // an instance to work around it).
  for (const [id, set] of [
    ["11018", "kang"],
    ["11019", "kang"],
    ["11020", "kang"],
    ["11021", "kang"],
    ["11049", "mot"],
  ] as const) {
    it.fails(`${id} is in the ${set} encounter set`, () => {
      expect(find(TOAFK_CARDS, id).encounterSetIds).toEqual([set]);
    });
  }

  // `difficultySetAlternativesFor` offers a replacement Standard/Expert set by classification, so Core's own two
  // sets (Standard, Expert) are never offered where a scenario prints Standard II / Expert II.
  it.fails("Core's Standard and Expert sets carry their classification", () => {
    const classes = Object.fromEntries(CORE_ENCOUNTER_SETS.map((set) => [set.id as string, set.classification]));
    expect(classes["standard"]).toBe("standard");
    expect(classes["expert"]).toBe("expert");
  });
});

describe("stale play restriction and flip-face resource icons", () => {
  it.fails("22033 Guardians of the Galaxy: max 1 Team card per player", () => {
    expect(find(NEBU_CARDS, "22033").playRestrictions?.maxWithTrait).toEqual({ trait: "TEAM", per: "player", max: 1 });
  });

  it.fails("32031a Solid, flipped to Phased (32031b), prints a mental resource", () => {
    expect(find(MUT_GEN_CARDS, "32031a").flipSide.resourceIcons).toEqual({ mental: 1 });
  });

  it.fails("34002a Phoenix Force, flipped (34002b), prints a physical resource", () => {
    expect(find(PHOENIX_CARDS, "34002a").flipSide.resourceIcons).toEqual({ physical: 1 });
  });
});
