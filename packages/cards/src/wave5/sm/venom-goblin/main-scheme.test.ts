import { trait } from "@mc/content";
import type { AbilityDefinition } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/index.js";
import { SKIES_OVER_NEW_YORK } from "./main-scheme.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

// A plain `Record` lookup: `describe.each`'s tuple rows don't keep `id`/`slug` correlated for TS to check a
// template-literal key against `SKIES_OVER_NEW_YORK`'s own literal key union (it offers the *other* row's key as a
// "did you mean"), so the two "constant" tests below look their ability up through this instead.
const abilities: Readonly<Record<string, AbilityDefinition>> = SKIES_OVER_NEW_YORK;

const SYMBIOTE = trait("SYMBIOTE");
const SYMBIOTE_ENVIRONMENT_EXISTS = { kind: "exists", query: { categories: ["environment"], trait: SYMBIOTE } };

/**
 * Exact-effect assertions for `main-scheme.ts` (`sm` 27116a–27119b, MC27 p. 17, the p. 67 erratum and FAQ p. 62/
 * MC27 p. 21) — every ability's plain-data shape, not just "it validates", the same discipline
 * `dsl/wave5-primitives.test.ts` uses for the glider counter's own worked examples. Runtime behavior on a real
 * game is `scenario.test.ts`'s job; `27117a.lower-manhattan-special`/`27118a.midtown-manhattan-special`/
 * `27119a.upper-manhattan-special` cannot be driven end-to-end yet — they only ever resolve when Venom Goblin's own
 * Forced Response ("resolve its 'Special' ability") calls them, and Venom Goblin (27113–27115) is out of this
 * agent's scope (task brief) — so they are asserted structurally here only.
 */
describe("27116a.setup: put Lower/Midtown/Upper Manhattan into play, glider on Midtown, flip and set aside", () => {
  it("matches the engine's own worked Setup shape (packages/engine/src/glider-main-schemes.test.ts)", () => {
    const definition = SKIES_OVER_NEW_YORK["27116a.setup"]!;
    valid(definition);
    expect(definition.trigger).toEqual({ kind: "setup" });
    expect(definition.effects).toEqual([
      { kind: "putMainSchemeStageIntoPlay", stageNumber: 2, name: "Lower Manhattan" },
      { kind: "putMainSchemeStageIntoPlay", stageNumber: 3, name: "Midtown Manhattan" },
      { kind: "putMainSchemeStageIntoPlay", stageNumber: 4, name: "Upper Manhattan" },
      {
        kind: "addCounters",
        target: { kind: "named", name: "Midtown Manhattan" },
        counterType: "glider",
        amount: { kind: "const", value: 1 },
      },
      { kind: "flipCard", target: { kind: "self" } },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "encounterSetAside" },
    ]);
  });
});

describe("27116b: Skies Over New York's three printed bullets are no-ops here (the glider rule is a scenario rule, not a card constant)", () => {
  it("all three refs are empty constants (Bell Tower's own 27077a.bell-tower-constant precedent)", () => {
    for (const id of [
      "27116b.skies-over-new-york-constant",
      "27116b.skies-over-new-york-constant-2",
      "27116b.skies-over-new-york-constant-3",
    ] as const) {
      const definition = SKIES_OVER_NEW_YORK[id]!;
      valid(definition);
      expect(definition).toEqual({ trigger: { kind: "constant" }, effects: [] });
    }
  });
});

describe("27117a.lower-manhattan-special: place 1 threat on each scheme, +1 more here if a [Symbiote] environment is in play", () => {
  it("matches the printed text exactly", () => {
    const definition = SKIES_OVER_NEW_YORK["27117a.lower-manhattan-special"]!;
    valid(definition);
    expect(definition.trigger).toEqual({ kind: "special" });
    expect(definition.effects).toEqual([
      {
        kind: "placeThreat",
        target: { kind: "each", query: { categories: ["scheme"] } },
        amount: { kind: "const", value: 1 },
      },
      {
        kind: "if",
        condition: SYMBIOTE_ENVIRONMENT_EXISTS,
        then: [{ kind: "placeThreat", target: { kind: "self" }, amount: { kind: "const", value: 1 } }],
      },
    ]);
  });
});

describe("27118a.midtown-manhattan-special: take 2 indirect damage, +1 more if a [Symbiote] environment is in play", () => {
  it("matches the printed text exactly", () => {
    const definition = SKIES_OVER_NEW_YORK["27118a.midtown-manhattan-special"]!;
    valid(definition);
    expect(definition.trigger).toEqual({ kind: "special" });
    expect(definition.effects).toEqual([
      { kind: "dealIndirectDamage", to: { kind: "controller" }, amount: { kind: "const", value: 2 } },
      {
        kind: "if",
        condition: SYMBIOTE_ENVIRONMENT_EXISTS,
        then: [{ kind: "dealIndirectDamage", to: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
      },
    ]);
  });
});

describe("27119a.upper-manhattan-special: discard 1 card from your hand, or the top 4 of your deck too if a [Symbiote] environment is in play", () => {
  it("matches the printed text exactly", () => {
    const definition = SKIES_OVER_NEW_YORK["27119a.upper-manhattan-special"]!;
    valid(definition);
    expect(definition.trigger).toEqual({ kind: "special" });
    expect(definition.effects).toEqual([
      { kind: "discardFromHand", player: { kind: "controller" }, amount: { kind: "const", value: 1 } },
      {
        kind: "if",
        condition: SYMBIOTE_ENVIRONMENT_EXISTS,
        then: [
          {
            kind: "moveCards",
            cards: { kind: "zone", zone: "deck", player: { kind: "controller" }, top: { kind: "const", value: 4 } },
            to: "discard",
          },
        ],
      },
    ]);
  });
});

const leastThreatScheme = {
  kind: "superlative",
  order: "lowest",
  among: { kind: "each", query: { categories: ["mainScheme"] } },
  measure: { kind: "threat", of: { kind: "slot", slot: "candidate" } },
};
const lossIfTwoSymbioteEnvironments = {
  kind: "stateCheck",
  when: {
    kind: "compare",
    left: { kind: "count", query: { categories: ["environment"], trait: SYMBIOTE } },
    op: "atLeast",
    right: { kind: "const", value: 2 },
  },
};

describe.each([
  ["27117b", "lower-manhattan"],
  ["27118b", "midtown-manhattan"],
  ["27119b", "upper-manhattan"],
] as const)(
  "%s: When Revealed moves the glider and any acceleration tokens; loses at 2 [Symbiote] environments",
  (id, slug) => {
    it(`${id}.when-revealed moves everything self holds to the main scheme with the least threat`, () => {
      const definition = abilities[`${id}.when-revealed`]!;
      valid(definition);
      expect(definition.trigger).toEqual({ kind: "whenRevealed" });
      expect(definition.effects).toEqual([
        { kind: "bindTargets", slot: "leastThreat", target: { ...leastThreatScheme, ties: "all" } },
        expect.objectContaining({ kind: "chooseTarget", slot: "gliderTo", chooser: { kind: "firstPlayer" } }),
        { kind: "moveCounters", from: { kind: "self" }, to: { kind: "slot", slot: "gliderTo" } },
      ]);
      // Which scheme the glider actually lands on, ties included, is played out in `scenario.test.ts`.
    });

    it(`${id}.${slug}-constant is a state check for 2+ [Symbiote] environments ending the game in a loss`, () => {
      const definition = abilities[`${id}.${slug}-constant`]!;
      valid(definition);
      expect(definition.trigger).toEqual(lossIfTwoSymbioteEnvironments);
      expect(definition.effects).toEqual([{ kind: "endGame", result: "loss", reason: "cardAbility" }]);
    });
  },
);
