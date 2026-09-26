/**
 * docs/phase7-wave4.md §3.28: a blank text box "except for keywords". Synthetic cards shaped like Corrupted Programming
 * (`vision` 26028: "Treat your mass form upgrade's text box as if it were blank, except for keywords.") and a Vision
 * mass form upgrade (a `form` keyword plus abilities).
 *
 * Sources: the card's own text; RRG 1.8 "Blank" (p. 10: a blanked card has no printed text, keywords included, so the
 * card has to say when keywords survive), "Form, Change Form" (p. 21).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { activeFormType, hasKeyword } from "./keywords.js";
import { activeAbilityRefs } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { gameAtFirstTurn, playerCardIntoPlay } from "./testing/wave3.js";

const DENSE_CONSTANT = stubAbility("dense.constant", {
  trigger: { kind: "constant", rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }] },
  effects: [],
});
const DENSE = stubUpgrade({
  id: "dense",
  cost: 0,
  keywords: [{ name: "form", formType: "mass" }, { name: "toughness" }],
  abilities: [DENSE_CONSTANT.ref],
});
const blanker = (id: string, exceptKeywords: boolean) => {
  const ability = stubAbility(`${id}.constant`, {
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "blankTextBox",
          target: { categories: ["upgrade"] },
          ...(exceptKeywords ? { exceptKeywords: true } : {}),
        },
      ],
    },
    effects: [],
  });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const CORRUPTED = blanker("corrupted", true);
const WIPE = blanker("wipe", false);
const deps: EngineDeps = depsOf(DENSE_CONSTANT, CORRUPTED.ability, WIPE.ability);

function start(with_: typeof CORRUPTED | null): {
  state: GameState;
  dense: ReturnType<typeof playerCardIntoPlay>["id"];
} {
  const base = gameAtFirstTurn({
    cards: [DENSE, CORRUPTED.card, WIPE.card],
    deps,
    deck: [DENSE.id, CORRUPTED.card.id, WIPE.card.id],
  });
  const placed = playerCardIntoPlay(base, DENSE.id);
  const state = with_ ? playerCardIntoPlay(placed.state, with_.card.id).state : placed.state;
  return { state, dense: placed.id };
}

describe("§3.28 a blank text box except for keywords", () => {
  it("the card loses its abilities but keeps its keywords, so it is still a mass form", () => {
    const { state, dense } = start(CORRUPTED);
    expect(activeAbilityRefs(state, dense, deps)).toEqual([]);
    expect(activeFormType(state, dense, deps)).toBe("mass");
    expect(hasKeyword(state, dense, "toughness", deps)).toBe(true);
  });

  it("a plain blank takes the keywords too; with no blank everything is live", () => {
    const wiped = start(WIPE);
    expect(activeFormType(wiped.state, wiped.dense, deps)).toBeUndefined();
    const plain = start(null);
    expect(activeFormType(plain.state, plain.dense, deps)).toBe("mass");
    expect(activeAbilityRefs(plain.state, plain.dense, deps)).toHaveLength(1);
  });
});
