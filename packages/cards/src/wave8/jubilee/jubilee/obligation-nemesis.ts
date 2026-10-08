import { trait } from "@mc/content";
import type { AbilityRegistry, Predicate, TargetRef } from "@mc/engine";
import {
  anyOfCards,
  atMost,
  cards,
  changeForm,
  chosen,
  constant,
  controllerOf,
  defineAbilities,
  encounterCards,
  encounterSetAside,
  engage,
  exists,
  forcedResponse,
  gainsTrait,
  gets,
  host,
  ifThen,
  moveCards,
  ofIdentitySetTitled,
  partOf,
  placeThreat,
  playersWhere,
  query,
  refMatches,
  resourceTypesOf,
  response,
  revealCard,
  selectCards,
  self,
  setAside,
  shuffleEncounterDeck,
  surge,
  thatPlayer,
  treatAttachedAllyAsMinion,
  whenRevealed,
  after,
  you,
  zone,
} from "../../../dsl/index.js";

/** "If you cannot, this card gains surge" (Beguiled and Manipulated Mind's shape): whether `attachesTo` found a host. */
const isAttached = (of: TargetRef): Predicate => ({ kind: "isAttached", of });

const LOST_CHILD = '"Lost" Child';
const REGRESSED = trait("REGRESSED");
const AERIAL = trait("AERIAL");

/**
 * "The Jubilation Lee player": the player whose nemesis minion this card is. Encounter cards have no owner
 * (`ownerOf(self)` names nobody), so the player is found by the nemesis relation (Nightcrawler's shape). Nanny may attack
 * any player, but the nemesis set sits in the Jubilee player's set-aside area.
 */
const JUBILEE_PLAYER = playersWhere(
  refMatches(self, query("minion", { nemesisMinionOf: thatPlayer }), { anywhere: true }),
);

/**
 * Jubilee's obligation and nemesis set (docs/phase7-wave8.md section 7.3, 3.63, 3.70; Q37).
 *
 * Cards (5):
 * - 47023 Grounded (obligation)
 * - 47024 Nanny (minion)
 * - 47025 Naughty Children (side_scheme)
 * - 47026 Battle Suit (attachment)
 * - 47027 "Lost" Child (attachment)
 *
 * **Grounded (47023)**: "Give to the Jubilation Lee player" is engine data (`obligationCardId`). When Revealed: a forced
 * change to alter-ego form (nothing in alter-ego form already; it does not use the once-per-round change). Response:
 * after you play a Jubilee event (an event of her identity-specific set), remove this card from the game (an optional
 * Response, "you" being the player whose play area holds it). The constant line (2 resources of the same type as an
 * additional cost to change to hero form on your turn, section 3.63 `RuleSpec formChangeCost`) is NOT registered: the
 * engine has no form-change cost yet (see `JUBILEE_OBLIGATION_NEMESIS_SKIPPED`).
 *
 * **Nanny (47024)**: Toughness is data. Forced Response: after she attacks you, if you control an ally, search the
 * encounter deck, discard pile and set-aside areas for 1 copy of "Lost" Child, shuffle the encounter deck (the search is
 * over) and reveal it (the attacked player reveals it, so it engages and attaches for them). The nemesis set is in the
 * Jubilee player's set-aside area, which is searched whoever Nanny attacked.
 *
 * **Naughty Children (47025)**: 2 threat (flat) and the crisis icon are data. When Revealed: 1 threat per different
 * resource type among the cards in the revealing player's hand (a wild is its own type, section 3.70).
 *
 * **Battle Suit (47026)**: the superlative host (fewest remaining hit points) and +1 ATK are data. The attached minion
 * gets +3 hit points and gains AERIAL. "Otherwise, this card gains surge" has no ability id in the card data: see `JUBILEE_OBLIGATION_NEMESIS_DRAFTS`.
 *
 * **"Lost" Child (47027)**: the superlative host (highest printed cost without a "Lost" Child) and -1 SCH are data. The
 * constant treats the attached ally as a REGRESSED minion with a blank text box, SCH from its printed THW and no
 * consequential damage. When Revealed: the attached ally engages its controller; otherwise the card gains surge.
 */
export const JUBILEE_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "47023.when-revealed": whenRevealed(changeForm(you, "alterEgo")),
  "47023.grounded-response": response(
    after.youPlayedCard(query("event", ofIdentitySetTitled("Jubilee"))),
    moveCards(cards(self), "removedFromGame"),
  ),

  "47024.nanny-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    ifThen(exists(query("ally", { controller: "you" })), [
      selectCards(
        "lostChild",
        atMost(
          1,
          anyOfCards(
            encounterCards(["deck", "discard"], query("attachment", { name: LOST_CHILD })),
            setAside(JUBILEE_PLAYER, query("attachment", { name: LOST_CHILD })),
            encounterSetAside(query("attachment", { name: LOST_CHILD })),
          ),
        ),
      ),
      shuffleEncounterDeck(),
      revealCard(chosen("lostChild"), you),
    ]),
  ),

  "47025.when-revealed": whenRevealed(
    selectCards("hand", zone("hand", you)),
    placeThreat(resourceTypesOf(chosen("hand")), self),
  ),

  "47026.battle-suit-constant": constant(
    gets("hp", 3, query("minion", { hostOfSelf: true })),
    gainsTrait(AERIAL, query("minion", { hostOfSelf: true })),
  ),
  "47026.battle-suit-constant-2": partOf("47026.battle-suit-constant"),

  "47027.lost-child-constant": constant(treatAttachedAllyAsMinion([REGRESSED])),
  "47027.when-revealed": whenRevealed(ifThen(isAttached(self), engage(host, controllerOf(host)), surge())),
});

/**
 * Grounded's constant line, NOT registered. `RuleSpec formChangeCost` (section 3.63, engine task 10) does not exist yet,
 * and no existing rule prices a form change, so the draft is a constant that changes nothing (hand size plus 0: the behavior
 * of today's engine, and a definition that validates). When the rule lands, put `rule({ kind: "formChangeCost", player: you, to: "hero",
 * during: "ownTurn", cost: spendSameType(2) })` here, move the entry into the registry and empty `skipped`.
 */
export const JUBILEE_OBLIGATION_NEMESIS_DRAFTS: AbilityRegistry = defineAbilities({
  "47023.obligation": constant(gets("handSize", 0, query("identity", { controller: "you" }))),
  // Battle Suit's "Otherwise, this card gains surge". The card data names no ability for it (only the two constants), so
  // the engine never looks this id up: it takes effect once the card data lists `47026.when-revealed` (Lost Child's
  // own When Revealed is the same shape).
  "47026.when-revealed": whenRevealed(ifThen(isAttached(self), [], surge())),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const JUBILEE_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "47023.obligation":
    "section 3.63 (extend, engine task 10) is not built: there is no RuleSpec formChangeCost, so 'as an additional cost to change to hero form during your turn, spend 2 resources of the same type' cannot be expressed; the change is free today",
};
