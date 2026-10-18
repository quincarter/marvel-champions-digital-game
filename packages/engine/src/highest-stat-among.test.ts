/**
 * docs/phase7-wave11-hero-packs.md H3.10: a stat equal to the highest among the other characters in play
 * (`ValueSpec highestStat`, as a `setBase` modifier). Shaped like Purple Man 61031: "[star] Purple Man's SCH is equal
 * to the highest SCH or THW among characters in play. His ATK is equal to the highest ATK among characters in play."
 * Synthetic cards only.
 *
 * Sources: RRG 1.8 "Star Icon" (pp. 40–41: the value "is defined in that card's text"), "Base Value" (p. 10: "A defined
 * value before modifiers are applied"), "Modifiers" (p. 28: recalculated from the base and every active modifier on
 * each check). Engine readings (H3.10; no ruling names the card): the reading card never measures itself (circular),
 * an alter-ego prints no ATK, THW or SCH and adds nothing, and two such cards reading each other each skip the other's
 * read of themselves.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { StatModifierSpec } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { characterStat } from "./query.js";
import { resolveValue } from "./select.js";
import type { StatName, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay } from "./testing/wave3.js";

const characters: TargetRef = { kind: "each", query: { categories: ["character"] } };
const highest = (stats: readonly [StatName, ...StatName[]], among = characters): ValueSpec => ({
  kind: "highestStat",
  stats,
  among,
});
const base = (stat: StatName, amount: ValueSpec): StatModifierSpec => ({
  stat,
  amount,
  target: { self: true },
  setBase: true,
});
const constant = (id: string, ...modifiers: StatModifierSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", modifiers }, effects: [] });

/** The two star stats. */
const PURPLE_RULE = constant("purple.constant", base("sch", highest(["sch", "thw"])), base("atk", highest(["atk"])));
const PURPLE = stubMinion({ id: "purple", atk: 0, sch: 0, hp: 6, abilities: [PURPLE_RULE.ref] });
/** The same, a second card: the two read each other. */
const LILAC = stubMinion({ id: "lilac", atk: 0, sch: 0, hp: 6, abilities: [PURPLE_RULE.ref] });
/** "Among allies in play": a pool with nobody in it here. */
const LONELY_RULE = constant(
  "lonely.constant",
  base("sch", highest(["sch", "thw"], { kind: "each", query: { categories: ["ally"] } })),
);
const LONELY = stubMinion({ id: "lonely", atk: 0, sch: 0, hp: 6, abilities: [LONELY_RULE.ref] });
/** A minion with "—" SCH and a big ATK: its ATK counts for ATK, never for SCH. */
const BRUTE = stubMinion({ id: "brute", atk: 5, sch: null, hp: 3 });
/** "Your hero gets +1 THW" (against the identity card, so it also reaches an alter-ego's unused THW). */
const BRACE_RULE = constant("brace.constant", {
  stat: "thw",
  amount: 1,
  target: { categories: ["identity"], controller: "you" },
});
const BRACE = stubSupport({ id: "brace", cost: 0, abilities: [BRACE_RULE.ref] });
/** "Each minion gets +1 SCH." */
const BANNER_RULE = constant("banner.constant", { stat: "sch", amount: 1, target: { categories: ["minion"] } });
const BANNER = stubSupport({ id: "banner", cost: 0, abilities: [BANNER_RULE.ref] });
/** "Your hero gets +3 THW": an alter-ego counted would read THW 3, above the villain's SCH 2. */
const MIGHT_RULE = constant("might.constant", {
  stat: "thw",
  amount: 3,
  target: { categories: ["identity"], controller: "you" },
});
const MIGHT = stubSupport({ id: "might", cost: 0, abilities: [MIGHT_RULE.ref] });

/** Villain SCH 2, ATK 3; the default hero has THW 2, ATK 2. */
const VILLAIN = stubVillain({ id: "mastermind", stages: [{ hp: flat(20), atk: 3, sch: 2 }] });

const deps = depsOf(PURPLE_RULE, LONELY_RULE, BRACE_RULE, BANNER_RULE, MIGHT_RULE);

function start(): GameState {
  return gameAtFirstTurn({
    cards: [PURPLE, LILAC, LONELY, BRUTE, BRACE, BANNER, MIGHT],
    deps,
    villain: VILLAIN,
    deck: [BRACE.id, BANNER.id, MIGHT.id],
    encounter: [PURPLE.id, LILAC.id, LONELY.id, BRUTE.id, ...copiesOf(TREACHERY.id, 20)],
  });
}
const heroForm = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero", heroFormIndex: 0 } })),
});
const alterEgoForm = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo", heroFormIndex: null } })),
});
const engaged = (state: GameState, card: { readonly id: CardId }) => minionEngagedWith(state, card.id);
const stats = (state: GameState, id: InstanceId) => [
  characterStat(state, id, "sch", deps),
  characterStat(state, id, "atk", deps),
];

describe("H3.10 a stat equal to the highest among the other characters", () => {
  it("hero THW 3 beats villain SCH 2 for SCH; villain ATK 3 beats hero ATK 2 for ATK", () => {
    const braced = playerCardIntoPlay(heroForm(start()), BRACE.id).state;
    const { state, id } = engaged(braced, PURPLE);
    expect(stats(state, id)).toEqual([3, 3]);
  });

  it("ties: hero THW 2 and villain SCH 2 give 2", () => {
    const { state, id } = engaged(heroForm(start()), PURPLE);
    expect(stats(state, id)).toEqual([2, 3]);
  });

  it("a modifier on the card applies on top of the base, and is not read back into it", () => {
    const braced = playerCardIntoPlay(heroForm(start()), BRACE.id).state;
    const bannered = playerCardIntoPlay(braced, BANNER.id).state;
    const { state, id } = engaged(bannered, PURPLE);
    // Base 3 (the hero's THW), +1 from the banner: 4, not 5.
    expect(stats(state, id)).toEqual([4, 3]);
  });

  it("an alter-ego adds nothing, even with a THW modifier on the identity: the villain's SCH 2 is the highest", () => {
    const mighty = playerCardIntoPlay(alterEgoForm(start()), MIGHT.id).state;
    const { state, id } = engaged(mighty, PURPLE);
    // Counting the alter-ego would give its THW 3.
    expect(characterStat(state, state.players[0]!.identity.instanceId, "thw", deps)).toBe(3);
    expect(stats(state, id)).toEqual([2, 3]);
  });

  it("outside a modifier only the reading card is skipped, so a value's own source counts", () => {
    const { state, id } = engaged(heroForm(start()), BRUTE);
    const context = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
    expect(resolveValue(state, highest(["atk"]), context, deps)).toBe(5);
  });

  it("a printed '—' stat is skipped: a minion with ATK 5 and '—' SCH raises ATK only", () => {
    const withBrute = engaged(heroForm(start()), BRUTE).state;
    const { state, id } = engaged(withBrute, PURPLE);
    expect(stats(state, id)).toEqual([2, 5]);
  });

  it("nobody to measure is 0, and modifiers still apply on top", () => {
    const { state, id } = engaged(heroForm(start()), LONELY);
    expect(characterStat(state, id, "sch", deps)).toBe(0);
    const bannered = playerCardIntoPlay(state, BANNER.id).state;
    expect(characterStat(bannered, id, "sch", deps)).toBe(1);
  });

  it("two such cards read each other without looping, each measuring the other as the rest of the table stands", () => {
    const braced = playerCardIntoPlay(heroForm(start()), BRACE.id).state;
    const first = engaged(braced, PURPLE);
    const second = engaged(first.state, LILAC);
    expect(stats(second.state, first.id)).toEqual([3, 3]);
    expect(stats(second.state, second.id)).toEqual([3, 3]);
  });
});
