/**
 * docs/phase7-wave7.md §3.82, §4.1 Q52 = B: `PlayerCard.restrictedWeight`, "Counts as 2 restricted cards." on a card
 * without the restricted keyword. Synthetic cards shaped like Laser Swords (`deadpool` 44055, a Weapon upgrade), Venom
 * (20001a: "You can control 1 additional upgrade that has the restricted keyword.") and Side Holster (20021: "… 1
 * additional [Weapon] upgrade that has the restricted keyword.").
 *
 * The weighted card adds its weight to the load the limit is compared with (`restrictedLoadOf`) and is otherwise not
 * a restricted card: it is not offered for the discard and a limit rule naming restricted cards makes no room for it.
 *
 * Sources: RRG 1.8 "Restricted" (p. 38), "Blank" (p. 10), "Permanent" (p. 32).
 */
import { trait, type CardId, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { restrictedStanding } from "./rules.js";
import { cardsInPlay, restrictedCardsOf, restrictedLoadOf, restrictedWeightOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, resolvePending } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const WEAPON = trait("Weapon");
const you = { kind: "controller" } as const;
const restricted = [{ name: "restricted" as const }];

/** "Counts as 2 restricted cards." on a Weapon with no restricted keyword. */
const SWORDS: UpgradeCard = { ...stubUpgrade({ id: "swords", cost: 0, traits: [WEAPON] }), restrictedWeight: 2 };
const GUN = stubUpgrade({ id: "gun", cost: 0, traits: [WEAPON], keywords: restricted });
const GADGET = stubUpgrade({ id: "gadget", cost: 0, keywords: restricted });
const PLAIN = stubUpgrade({ id: "plain", cost: 0 });
/** A restricted card that cannot be discarded for the limit (a Psi-Katana's shape). */
const KATANA = stubUpgrade({ id: "katana", cost: 0, keywords: [{ name: "restricted" }, { name: "permanent" }] });

const constant = (id: string, rules: readonly RuleSpec[]) => {
  const definition: AbilityDefinition = { trigger: { kind: "constant", rules }, effects: [] };
  return stubAbility(id, definition);
};
const SYMBIOTE = constant("symbiote.constant", [{ kind: "restrictedLimit", amount: 1 }]);
const HOLSTER = constant("holster.constant", [{ kind: "restrictedLimit", amount: 1, cards: { trait: WEAPON } }]);
/** "Swords' text box is treated as blank." */
const JAMMER = constant("jammer.constant", [{ kind: "blankTextBox", target: { name: SWORDS.name } }]);
const SYMBIOTE_CARD = stubSupport({ id: "symbiote", cost: 0, abilities: [SYMBIOTE.ref] });
const HOLSTER_CARD = stubSupport({ id: "holster", cost: 0, abilities: [HOLSTER.ref] });
const JAMMER_CARD = stubSupport({ id: "jammer", cost: 0, abilities: [JAMMER.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Put a [card] from your hand into play." */
const call = (card: UpgradeCard) =>
  event(`call-${card.id}`, [
    {
      kind: "selectCards",
      slot: "called",
      cards: { kind: "zone", zone: "hand", player: you, filter: { name: card.name }, topmostOnly: true },
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "called" }, controller: you },
  ]);
const CALL_SWORDS = call(SWORDS);
const CALL_GADGET = call(GADGET);
/** "Play Swords from your hand, ignoring its resource cost." */
const MUSTER = event("muster", [
  { kind: "playFromHand", player: you, filter: { name: SWORDS.name }, ignoreCost: true },
]);

const deps: EngineDeps = depsOf(SYMBIOTE, HOLSTER, JAMMER, CALL_SWORDS.ability, CALL_GADGET.ability, MUSTER.ability);
const CARDS = [
  SWORDS,
  GUN,
  GADGET,
  PLAIN,
  KATANA,
  SYMBIOTE_CARD,
  HOLSTER_CARD,
  JAMMER_CARD,
  CALL_SWORDS.card,
  CALL_GADGET.card,
  MUSTER.card,
];

/** p1 with `inPlay` already in play, placed without the enter-play checks. */
function start(inPlay: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [
      ...copiesOf(GADGET.id, 4),
      ...copiesOf(GUN.id, 2),
      ...copiesOf(KATANA.id, 2),
      ...CARDS.filter((card) => card !== GADGET && card !== GUN && card !== KATANA).map((card) => card.id),
    ],
  });
  const ids: InstanceId[] = [];
  for (const card of inPlay) {
    const placed = playerCardIntoPlay(state, card);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, ids };
}
function tryPlay(state: GameState, card: string) {
  const given = giveCard(state, P1, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  return {
    ok: result.ok,
    state: result.ok ? result.state : given.state,
    id: given.id,
    error: result.ok ? null : result.error,
  };
}
/** Hands p1 `card` and plays the event that puts it into play from hand. */
function putIntoPlay(state: GameState, card: UpgradeCard, by: { card: { id: CardId } }) {
  const held = giveCard(state, P1, card.id);
  const played = tryPlay(held.state, by.card.id);
  if (!played.ok) throw new Error(played.error?.message);
  return { state: played.state, id: held.id };
}
const load = (state: GameState): number => restrictedLoadOf(state, P1, deps);
const inPlay = (state: GameState, id: InstanceId): boolean => cardsInPlay(state).includes(id);

describe("§3.82 the restricted load", () => {
  it("a weighted card weighs its number, a keyword card 1, any other card 0", () => {
    const { state, ids } = start([SWORDS.id, GADGET.id, PLAIN.id]);
    expect(ids.map((id) => restrictedWeightOf(state, id, deps))).toEqual([2, 1, 0]);
    expect(load(state)).toBe(3);
    expect(load(start([]).state)).toBe(0);
    expect(load(start([GADGET.id, GUN.id]).state)).toBe(2);
  });

  it("the weighted card is not one of the player's restricted cards (Q52 = B)", () => {
    const { state, ids } = start([SWORDS.id, GADGET.id]);
    expect(restrictedCardsOf(state, P1, deps)).toEqual([ids[1]]);
    expect(restrictedStanding(state, deps, P1)).toEqual({ load: 3, limit: 2, held: [ids[1]] });
  });

  it("a blank text box, or the card's other face, has no 'counts as 2'", () => {
    const blanked = start([SWORDS.id, JAMMER_CARD.id]);
    expect(load(blanked.state)).toBe(0);
    const { state, ids } = start([SWORDS.id]);
    const swords = ids[0]!;
    const flipped: GameState = {
      ...state,
      instances: { ...state.instances, [swords]: { ...mustInstance(state, swords), flipped: true } },
    };
    expect(load(flipped)).toBe(0);
  });
});

// RRG 1.8 "Restricted" (p. 38): the play is always legal; over the limit, the player discards keyword cards (Q52 = B)
// until the load fits.
describe("§3.82 playing against the load", () => {
  /** The discard the play left pending: the cards offered and how many must go, or null when the load fits. */
  const owed = (played: ReturnType<typeof tryPlay>) => {
    expect(played.ok).toBe(true);
    const choice = played.state.pendingChoice;
    if (choice?.prompt.kind !== "discardRestricted") return null;
    return { offered: choice.options.map((o) => o.optionId), count: choice.minSelections, limit: choice.prompt.limit };
  };

  it("is played with nothing restricted in play, and then fills the limit: a keyword card played next is discarded", () => {
    const played = tryPlay(start([]).state, SWORDS.id);
    expect(owed(played)).toBeNull();
    expect(load(played.state)).toBe(2);
    const second = tryPlay(played.state, GADGET.id);
    expect(owed(second)).toEqual({ offered: [second.id], count: 1, limit: 2 });
    const after = resolvePending(second.state, [second.id], deps);
    expect(inPlay(after, played.id)).toBe(true);
    expect(inPlay(after, second.id)).toBe(false);
    expect(load(after)).toBe(2);
  });

  it("played with one restricted card in play (1 + 2 is over 2), that card is discarded and it stays", () => {
    const { state, ids } = start([GADGET.id]);
    const played = tryPlay(state, SWORDS.id);
    expect(owed(played)).toEqual({ offered: ids, count: 1, limit: 2 });
    const after = resolvePending(played.state, [...ids], deps);
    expect(inPlay(after, played.id)).toBe(true);
    expect(inPlay(after, ids[0]!)).toBe(false);
    expect(load(after)).toBe(2);
  });

  it("a card with neither the keyword nor a weight is never checked", () => {
    const played = tryPlay(start([SWORDS.id]).state, PLAIN.id);
    expect(played.ok).toBe(true);
    expect(inPlay(played.state, played.id)).toBe(true);
    expect(played.state.pendingChoice).toBeNull();
    expect(load(played.state)).toBe(2);
  });

  it("'1 additional upgrade that has the restricted keyword' raises the limit to 3: one keyword card beside it", () => {
    expect(owed(tryPlay(start([GADGET.id, SYMBIOTE_CARD.id]).state, SWORDS.id))).toBeNull();
    const two = start([GADGET.id, GADGET.id, SYMBIOTE_CARD.id]);
    expect(owed(tryPlay(two.state, SWORDS.id))).toEqual({ offered: two.ids.slice(0, 2), count: 1, limit: 3 });
  });

  it("'1 additional [Weapon] upgrade that has the restricted keyword' makes no room for the weighted Weapon", () => {
    // Swords is a Weapon without the keyword: the rule's room is for a keyword Weapon only.
    const gadget = start([GADGET.id, HOLSTER_CARD.id]);
    expect(owed(tryPlay(gadget.state, SWORDS.id))).toEqual({ offered: [gadget.ids[0]], count: 1, limit: 2 });
    // A keyword Weapon in play earns the room: limit 3, load 1 + 2.
    expect(owed(tryPlay(start([GUN.id, HOLSTER_CARD.id]).state, SWORDS.id))).toBeNull();
  });

  it("played by an effect over the limit, it is offered, enters play, and the keyword card is discarded", () => {
    const { state, ids } = start([GADGET.id]);
    const over = giveCard(state, P1, SWORDS.id);
    const offered = tryPlay(over.state, MUSTER.card.id);
    expect(offered.state.pendingChoice?.options.map((o) => o.optionId)).toEqual([over.id]);
    const entered = resolvePending(offered.state, [over.id], deps);
    expect(inPlay(entered, over.id)).toBe(true);
    expect(entered.pendingChoice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(entered.pendingChoice?.options.map((o) => o.optionId)).toEqual(ids);
    const after = resolvePending(entered, [...ids], deps);
    expect(inPlay(after, over.id)).toBe(true);
    expect(inPlay(after, ids[0]!)).toBe(false);
    expect(load(after)).toBe(2);

    const room = giveCard(start([]).state, P1, SWORDS.id);
    const fits = tryPlay(room.state, MUSTER.card.id);
    expect(fits.state.pendingChoice?.options.map((o) => o.optionId)).toEqual([room.id]);
    const played = resolvePending(fits.state, [room.id], deps);
    expect(inPlay(played, room.id)).toBe(true);
    expect(load(played)).toBe(2);
    expect(played.pendingChoice).toBeNull();
  });
});

describe("§3.82 put into play over the limit", () => {
  it("with two restricted cards in play, both are discarded and the weighted card stays", () => {
    const { state, ids } = start([GADGET.id, GUN.id]);
    const put = putIntoPlay(state, SWORDS, CALL_SWORDS);
    const choice = put.state.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(choice?.options.map((o) => o.optionId)).toEqual(ids);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([2, 2]);

    const after = resolvePending(put.state, [...ids], deps);
    expect(inPlay(after, put.id)).toBe(true);
    expect(ids.map((id) => inPlay(after, id))).toEqual([false, false]);
    expect(load(after)).toBe(2);
    expect(after.pendingChoice?.prompt.kind).not.toBe("discardRestricted");
  });

  it("with one restricted card in play, that card is the only one offered", () => {
    const { state, ids } = start([GADGET.id]);
    const put = putIntoPlay(state, SWORDS, CALL_SWORDS);
    const choice = put.state.pendingChoice;
    expect(choice?.options.map((o) => o.optionId)).toEqual(ids);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);
    const after = resolvePending(put.state, [...ids], deps);
    expect(load(after)).toBe(2);
    expect(inPlay(after, put.id)).toBe(true);
  });

  it("a keyword card put into play beside the weighted card is the one discarded", () => {
    const { state, ids } = start([SWORDS.id]);
    const put = putIntoPlay(state, GADGET, CALL_GADGET);
    const choice = put.state.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(choice?.options.map((o) => o.optionId)).toEqual([put.id]);
    const after = resolvePending(put.state, [put.id], deps);
    expect(inPlay(after, ids[0]!)).toBe(true);
    expect(inPlay(after, put.id)).toBe(false);
    expect(load(after)).toBe(2);
  });

  it("with room, nobody is asked", () => {
    const put = putIntoPlay(start([]).state, SWORDS, CALL_SWORDS);
    expect(put.state.pendingChoice).toBeNull();
    expect(load(put.state)).toBe(2);
  });

  it("beside two restricted cards that cannot leave play, nobody is asked and the load stays at 4", () => {
    const { state, ids } = start([KATANA.id, KATANA.id]);
    const put = putIntoPlay(state, SWORDS, CALL_SWORDS);
    expect(put.state.pendingChoice).toBeNull();
    expect([...ids, put.id].map((id) => inPlay(put.state, id))).toEqual([true, true, true]);
    expect(restrictedStanding(put.state, deps, P1)).toEqual({ load: 4, limit: 2, held: ids });
  });
});
