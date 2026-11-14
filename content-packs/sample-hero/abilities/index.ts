/**
 * Sample Sentinel's abilities. Every script copies the shape of a base-game card whose script is known good (the base
 * card is named in each comment), so a creator can see one of each kind done with existing DSL primitives only.
 *
 * Ability ids are `<card code>.<slug>`, the base game's convention with the pack's card code swapped in. The alter-ego
 * face's ability uses the `01b` code, as the base game does for `01001b`.
 */
import {
  after,
  alterEgoAction,
  attackAnEnemy,
  boost,
  allOf,
  atEndOfAttack,
  cards,
  chosen,
  definePackAbilities,
  discardAtRandom,
  draw,
  eachPlayer,
  eventDealt,
  eventTarget,
  exhaustThis,
  forEachPlayer,
  FRIENDLY_CHARACTER,
  heal,
  heroAction,
  heroResource,
  ifThen,
  inPlay,
  interrupt,
  isHero,
  moveCards,
  packObligation,
  oncePerRound,
  refMatches,
  removeCounter,
  resource,
  self,
  stun,
  surge,
  thatPlayer,
  topOfDeck,
  tuckCards,
  tuckedUnder,
  when,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  forcedResponse,
  zone,
} from "@mc/mod-sdk";

export default definePackAbilities({
  // Hero ability. Modeled on Spider-Man's Spider-Sense (01001a):
  // Interrupt: When the villain initiates an attack against you, draw 1 card.
  "x.sample-hero.01a.sentinel-sense": interrupt(when.villainAttacks({ againstYou: true }), draw(1)),

  // Alter-ego ability. Modeled on Peter Parker's Scientist (01001b), with a [physical] resource:
  // Resource: Generate a [physical] resource. (Limit once per round.)
  "x.sample-hero.01b.quiet-study": resource({ physical: 1 }, { limit: oncePerRound }),

  // Ally. Modeled on Black Cat (01002): Forced Response: After you play Rook, discard the top 2 cards of your deck.
  // Add each card with a printed [physical] resource discarded this way to your hand.
  // "Play" (not "enters play"): putting her into play with Make the Call doesn't trigger it.
  "x.sample-hero.02.rook-forced-response": forcedResponse(
    after.youPlayThis(),
    moveCards(topOfDeck(2), "discard", "milled"),
    moveCards(cards(chosen("milled"), { printedResource: "physical" }), "hand"),
  ),

  // Event. Modeled on Swinging Web Kick (01005): Hero Action (attack): Deal 6 damage to an enemy.
  "x.sample-hero.03.sentinel-slam-action": heroAction({ label: "attack" }, attackAnEnemy(6)),

  // Support. Modeled on Aunt May (01006): Alter-Ego Action: Exhaust Workshop → heal 3 damage from Sam Pell.
  "x.sample-hero.04.workshop-action": alterEgoAction({ cost: exhaustThis }, heal(3, yourIdentity)),

  // Upgrade. Modeled on Web-Shooter (01008): Uses (3 charge counters). Hero Resource: Exhaust this and remove 1 charge
  // counter from it → generate a [wild] resource. The counter is part of the cost; the Uses keyword discards the card
  // when the last counter is removed.
  "x.sample-hero.05.sentinel-cell-resource": heroResource(
    { wild: 1 },
    { cost: [exhaustThis, removeCounter("charge")] },
  ),

  // Obligation. Modeled on Eviction Notice (01165): give to the Sam Pell player; may flip to alter-ego; then exhaust
  // Sam Pell → remove from the game, or discard 1 card at random (this card gains surge) and discard the obligation.
  "x.sample-hero.06.obligation": packObligation("Sam Pell", {
    label: "Discard 1 card at random from your hand; this card gains surge",
    effects: [discardAtRandom(1), surge()],
  }),

  // Nemesis side scheme. Modeled on Highway Robbery (01166).
  // When Revealed: Each player places a random card from their hand facedown here.
  "x.sample-hero.08.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, tuckCards(zone("hand", thatPlayer, { random: 1 }), self, true)),
  ),
  // When Defeated: Return each facedown card here to its owner's hand.
  "x.sample-hero.08.when-defeated": whenDefeated(moveCards(tuckedUnder(self), "hand")),

  // Nemesis treachery. Modeled on Sweeping Swoop (01168).
  // When Revealed: Stun your hero. If Rust Warden is in play, this card gains surge.
  // An alter-ego is not stunned (RRG 1.8 "Form, Change Form", p. 21); the surge still applies.
  "x.sample-hero.09.when-revealed": whenRevealed(
    ifThen(isHero(), stun(yourIdentity)),
    ifThen(inPlay("Rust Warden"), surge()),
  ),
  // [star] Boost: If this activation deals damage to a friendly character, stun that character.
  "x.sample-hero.09.boost": boost(
    atEndOfAttack(ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, FRIENDLY_CHARACTER)), stun(eventTarget))),
  ),
});
