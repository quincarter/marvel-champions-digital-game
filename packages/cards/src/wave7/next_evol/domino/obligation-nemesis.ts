import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  addCounters,
  alterEgoAction,
  anyOfCards,
  attachCard,
  blanksTextBox,
  chooseOneBy,
  chosen,
  constant,
  controllerOf,
  countersOn,
  damageOn,
  defineAbilities,
  discard,
  discardFromHandCost,
  each,
  eachPlayer,
  encounterCards,
  exhaustYourHero,
  forEachPlayer,
  forcedResponse,
  gets,
  identityOf,
  oneCopyOf,
  option,
  placeThreat,
  query,
  selectCards,
  self,
  setAside,
  shuffleEncounterDeck,
  takeDamage,
  thatPlayer,
  whenRevealed,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

const SUPERPOWER_FEEDBACK = query("attachment", { name: "Superpower Feedback" });

/** "Your identity": whichever seat the obligation sits with, not the first Domino in play. */
const YOUR_IDENTITY = query("identity", { controller: "you" });

/** The attached identity: an attachment on a player's identity is "your" identity. */
const HOST_IDENTITY = query("identity", { hostOfSelf: true });
/**
 * "You" on Superpower Feedback inside a `sourceIs` query: the attached identity's controller. `controller: "you"` and
 * `identitySetOf: you` do not resolve from an attachment (it has no controller of its own; the pattern's own
 * `playerIs: "controller"` does), so the player is read off the host.
 */
const HOST_PLAYER = controllerOf(each(HOST_IDENTITY));

/**
 * "After you resolve an ability on your identity or an identity-specific card" (Superpower Feedback). `abilityResolved`
 * is a triggered ability's resolution, so basic powers, constants and spending a card as a resource are not heard
 * (docs/phase7-wave7.md section 4.1 Q35 = A). An identity-specific card is one with the identity's set icon
 * (RRG "Identity-Specific Card", p. 23), which the nemesis and obligation cards do not have.
 */
const ABILITY_ON_YOUR_IDENTITY_OR_ITS_CARDS: EventPattern = {
  on: "abilityResolved",
  playerIs: "controller",
  sourceIs: { anyOf: [{ hostOfSelf: true }, { identitySetOf: HOST_PLAYER }] },
};

/**
 * Domino's obligation and nemesis set (40065-40069), docs/phase7-wave7.md §7.1, §3.19, §3.61, §3.70.
 *
 * - **Memories of Armageddon (40065)**: "Give to the Neena Thurman player" is engine data
 *   (`HeroIdentityCard.obligationCardId`). It stays in the player's play area. Both faces' text boxes are blank, traits
 *   kept (Q12 = A), so Domino's wild-counts-twice rule and both swap Actions are off until the Alter-Ego Action
 *   discards it.
 * - **Topaz (40066)**: finds Superpower Feedback in the encounter deck, its discard pile or the set-aside area (the
 *   nemesis set's own cards sit in its owner's set-aside area, so every player's is searched: Topaz may be dealt to
 *   another player) and attaches one copy to the revealing player's identity, then shuffles the encounter deck (RRG
 *   "Search", p. 39).
 * - **Not My Lucky Day (40067)**: each player chooses 1 damage or 2 threat here (Q8: an option that cannot be carried
 *   out is not offered).
 * - **Prototype (40068)**: luck counters equal to the revealing player's identity's damage, each +1 hit point.
 * - **Superpower Feedback (40069)**: attaches to the identity (data, `attachesTo`); the Forced Response taxes 1 damage per
 *   identity ability; the Alter-Ego Action discards an identity-specific card from hand to discard it.
 */
export const DOMINO_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  // Treat your identity's printed text box as if it were blank (except for TRAITS).
  "40065.memories-of-armageddon-constant": constant(blanksTextBox(YOUR_IDENTITY)),
  // Alter-Ego Action: Exhaust your identity -> discard Memories of Armageddon.
  "40065.memories-of-armageddon-action": alterEgoAction({ cost: exhaustYourHero }, discard(self)),

  // When Revealed: Search the encounter deck, discard pile, and set aside area for 1 copy of Superpower Feedback and
  // attach it to your identity. (Shuffle.)
  "40066.when-revealed": whenRevealed(
    selectCards(
      "found",
      oneCopyOf(
        anyOfCards(encounterCards(["deck", "discard"], SUPERPOWER_FEEDBACK), setAside(eachPlayer, SUPERPOWER_FEEDBACK)),
      ),
    ),
    attachCard(chosen("found"), yourIdentity),
    shuffleEncounterDeck(),
  ),

  // When Revealed: Each player must either take 1 damage or place 2 threat here.
  "40067.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option("Take 1 damage", takeDamage(1, thatPlayer)),
        option("Place 2 threat on Not My Lucky Day", placeThreat(2, self)),
      ),
    ),
  ),

  // [star] Prototype gets +1 hit points for each luck counter on him.
  "40068.prototype-constant": constant(gets("hp", countersOn(self, "luck"), query("minion", { self: true }))),
  // When Revealed: Place luck counters on Prototype equal to the amount of damage your identity has sustained.
  "40068.when-revealed": whenRevealed(addCounters("luck", damageOn(identityOf(you)), self)),

  // Forced Response: After you resolve an ability on your identity or an identity-specific card, take 1 damage.
  "40069.superpower-feedback-forced-response": forcedResponse(ABILITY_ON_YOUR_IDENTITY_OR_ITS_CARDS, takeDamage(1)),
  // Alter-Ego Action: Discard 1 identity-specific card from your hand -> discard this card.
  "40069.superpower-feedback-action": alterEgoAction(
    { cost: discardFromHandCost(1, 1, undefined, { identitySetOf: you }) },
    discard(self),
  ),
});
