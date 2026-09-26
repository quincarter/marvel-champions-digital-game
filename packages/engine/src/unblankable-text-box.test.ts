/**
 * docs/phase7-wave5.md §3.31: a printed text box that cannot be blanked. Synthetic cards shaped like SP//dr Suit 1B and
 * SP//dr (`spdr` 31001b / 31002b: "This card's printed text box cannot be treated as if it were blank."), against a
 * lasting blank ("treat its printed text box as if it were blank", Panic in the Streets, Vivian) and a constant one
 * ("Treat the printed text box of each [Tech] player card as if it were blank", Tech Theft 12026).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { activeAbilityRefs, blankedByConstantRules, textBoxBlankFor, textBoxCannotBeBlanked } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, playerCardIntoPlay } from "./testing/wave3.js";

const TECH = trait("TECH");
const constantRules = (rules: NonNullable<Extract<AbilityDefinition["trigger"], { kind: "constant" }>["rules"]>) =>
  ({ trigger: { kind: "constant", rules }, effects: [] }) satisfies AbilityDefinition;

const UNBLANKABLE = stubAbility("suit.constant", constantRules([{ kind: "textBoxCannotBeBlanked" }]));
const SUIT_ACTION = stubAbility("suit.action", { trigger: { kind: "action" }, effects: [] });
const SUIT = stubSupport({
  id: "suit",
  cost: 0,
  traits: [TECH],
  keywords: [{ name: "permanent" }],
  abilities: [UNBLANKABLE.ref, SUIT_ACTION.ref],
});
// The same card without the line: the control.
const PLAIN = stubSupport({ id: "plain", cost: 0, traits: [TECH], keywords: [{ name: "permanent" }] });

// Tech Theft's constant, on a side scheme.
const THEFT_RULE = stubAbility(
  "theft.constant",
  constantRules([{ kind: "blankTextBox", target: { trait: TECH, categories: ["support"] } }]),
);
const THEFT = stubSideScheme({ id: "theft", startingThreat: 5, abilities: [THEFT_RULE.ref] });

// A card that cannot be blanked and itself blanks other supports: its rule survives a lasting blank on it.
const WARDEN_BLANK = stubAbility(
  "warden.constant",
  constantRules([{ kind: "textBoxCannotBeBlanked" }, { kind: "blankTextBox", target: { categories: ["support"] } }]),
);
const WARDEN = stubSupport({ id: "warden", cost: 0, abilities: [WARDEN_BLANK.ref] });

const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const deps: EngineDeps = depsOf(UNBLANKABLE, SUIT_ACTION, THEFT_RULE, WARDEN_BLANK);

function start(): GameState {
  return gameAtFirstTurn({
    cards: [SUIT, PLAIN, THEFT, WARDEN, FILLER],
    deps,
    deck: [SUIT.id, PLAIN.id, WARDEN.id],
    encounter: [THEFT.id, ...copiesOf(FILLER.id, 20)],
  });
}

/** Panic in the Streets / Vivian: a lasting blank on these cards. */
const blankedUntilEndOfPhase = (state: GameState, targets: readonly InstanceId[]): GameState => ({
  ...state,
  lastingEffects: [
    ...state.lastingEffects,
    { id: "test.blank", kind: "blankTextBox", targets, duration: { kind: "endOfPhase" } },
  ],
});

describe("§3.31 'This card's printed text box cannot be treated as if it were blank'", () => {
  it("a lasting blank leaves its abilities and keywords live; the same blank on a card without the line takes them", () => {
    const suit = playerCardIntoPlay(start(), SUIT.id);
    const plain = playerCardIntoPlay(suit.state, PLAIN.id);
    const state = blankedUntilEndOfPhase(plain.state, [suit.id, plain.id]);

    expect(textBoxCannotBeBlanked(state, suit.id, deps)).toBe(true);
    expect(textBoxBlankFor(state, suit.id, deps)).toBe(false);
    expect(activeAbilityRefs(state, suit.id, deps).map((ref) => ref.id)).toEqual([
      UNBLANKABLE.ref.id,
      SUIT_ACTION.ref.id,
    ]);
    expect(hasKeyword(state, suit.id, "permanent", deps)).toBe(true);

    expect(textBoxBlankFor(state, plain.id, deps)).toBe(true);
    expect(hasKeyword(state, plain.id, "permanent", deps)).toBe(false);
  });

  it("a constant blank rule (Tech Theft) passes over it and still blanks the card without the line", () => {
    const suit = playerCardIntoPlay(start(), SUIT.id);
    const plain = playerCardIntoPlay(suit.state, PLAIN.id);
    const { state } = encounterCardInVillainArea(plain.state, THEFT.id, 5);

    expect([...blankedByConstantRules(state, deps)]).toEqual([plain.id]);
    expect(activeAbilityRefs(state, suit.id, deps)).toHaveLength(2);
    expect(hasKeyword(state, suit.id, "permanent", deps)).toBe(true);
    expect(activeAbilityRefs(state, plain.id, deps)).toEqual([]);
  });

  it("a blanking rule on a card that cannot be blanked keeps working under a lasting blank on its source", () => {
    const warden = playerCardIntoPlay(start(), WARDEN.id);
    const plain = playerCardIntoPlay(warden.state, PLAIN.id);
    const state = blankedUntilEndOfPhase(plain.state, [warden.id]);

    expect(textBoxBlankFor(state, warden.id, deps)).toBe(false);
    expect([...blankedByConstantRules(state, deps)]).toEqual([plain.id]);
  });

  it("without a registry nothing is protected (a caller with no registry has no abilities to run)", () => {
    const suit = playerCardIntoPlay(start(), SUIT.id);
    const state = blankedUntilEndOfPhase(suit.state, [suit.id]);
    expect(textBoxBlankFor(state, suit.id, depsOf())).toBe(true);
  });
});
