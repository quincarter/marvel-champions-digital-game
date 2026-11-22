/**
 * `searchFindableIfSpent` (#966): a search of "your deck and discard pile" (Dynamic Duo, `luke_cage` 62022, stands in
 * synthetically here; the engine does not import `@mc/cards`) finds a card spent to pay for it, because a resource card
 * is in the discard pile before the effect resolves (RRG 1.8 "Initiating Abilities", p. 24; "Resources", p. 36). The
 * query tells the payment step which cards in hand that is.
 */
import { trait, type AnyCard, type CardId, type EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { searchFindableIfSpent } from "./search-findable.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const TEAM = trait("Team-Up");

const searchBoth = stubAbility(
  "search-both",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "chooseCards",
        slot: "found",
        from: { kind: "zone", zone: ["deck", "discard"], player: { kind: "controller" }, filter: { trait: TEAM } },
        chooser: { kind: "controller" },
        min: 1,
        max: 1,
      },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, to: "hand" },
    ],
  }),
);
const damageOne = stubAbility(
  "damage-one",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
  }),
);

const SEARCH: EventCard = stubEvent({ id: "search", cost: 1, abilities: [searchBoth.ref] });
const PLAIN: EventCard = stubEvent({ id: "plain", cost: 1, abilities: [damageOne.ref] });
const TEAM_UP: EventCard = { ...stubEvent({ id: "team-up", cost: 1, resources: 1 }), traits: [TEAM] };
const CARDS: readonly AnyCard[] = [SEARCH, PLAIN, TEAM_UP];
const deps: EngineDeps = depsOf(searchBoth, damageOne);

/** A game whose deck holds one Team-Up card, with the search event, the plain event and that card handed out. */
function game(): { state: GameState; search: InstanceId; plain: InstanceId; teamUp: InstanceId } {
  const state = newGame({
    extraCards: CARDS,
    deck: [SEARCH.id, PLAIN.id, TEAM_UP.id, ...copies(RESOURCE.id, 20)],
    deps,
  });
  const given = giveCards(state, p1, "search", "plain", "team-up");
  const [search, plain, teamUp] = given.ids as [InstanceId, InstanceId, InstanceId];
  return { state: given.state, search, plain, teamUp };
}

/** Moves `id` from p1's hand to the top of their deck. */
function backToDeck(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === p1 ? { ...p, hand: p.hand.filter((i) => i !== id), deck: [id, ...p.deck] } : p,
    ),
  };
}

describe("searchFindableIfSpent (#966)", () => {
  it("finds nothing now, and names the Team-Up card in hand that paying with it would let the search find", () => {
    const { state, search, teamUp } = game();
    expect(searchFindableIfSpent(state, deps, p1, search)).toEqual({ found: false, findableIfSpent: [teamUp] });
  });

  it("agrees with the play: paying with the Team-Up card lets the search choose it", () => {
    const { state, search, teamUp } = game();
    const after = runWith(deps, state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: search,
      payment: [{ fromHand: teamUp }],
      attachToInstanceId: null,
    });
    expect(after.pendingChoice?.prompt).toMatchObject({ kind: "chooseCards", slot: "found" });
    expect(after.pendingChoice?.options.map((o) => o.optionId)).toContain(teamUp);
  });

  it("never reads the deck: a Team-Up card there neither counts as found nor hides the hand's", () => {
    const { state, search, teamUp } = game();
    // Only in the deck: nothing the player can see is found, and nothing in hand is named.
    const moved = backToDeck(state, teamUp);
    expect(searchFindableIfSpent(moved, deps, p1, search)).toEqual({ found: false, findableIfSpent: [] });
  });

  it("answers found with nothing to name for a card with no search", () => {
    const { state, plain } = game();
    expect(searchFindableIfSpent(state, deps, p1, plain)).toEqual({ found: true, findableIfSpent: [] });
  });

  it("leaves the state as it was", () => {
    const { state, search } = game();
    const hand = mustPlayer(state, p1).hand;
    const discard = mustPlayer(state, p1).discard;
    searchFindableIfSpent(state, deps, p1, search);
    expect(mustPlayer(state, p1).hand).toBe(hand);
    expect(mustPlayer(state, p1).discard).toBe(discard);
  });
});
