import {
  after,
  allOf,
  alterEgoAction,
  atEndOfAttack,
  attackAnEnemy,
  bindTargets,
  boost,
  cancelIt,
  cancelWhenRevealed,
  cards,
  chosen,
  defineAbilities,
  discard,
  discardAtRandom,
  draw,
  eachPlayer,
  eventDealt,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  FRIENDLY_CHARACTER,
  heal,
  heroAction,
  heroInterrupt,
  heroResource,
  host,
  ifThen,
  inPlay,
  interrupt,
  moveCards,
  oncePerRound,
  placeThreat,
  preventDamage,
  query,
  refMatches,
  removeCounter,
  removeThreatFromAScheme,
  resource,
  resourceTypesOf,
  self,
  stun,
  surge,
  thatPlayer,
  theMainScheme,
  topOfDeck,
  tuckCards,
  tuckedUnder,
  when,
  whenDefeated,
  whenRevealed,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";
import { obligation } from "../obligations.js";

/** Spider-Man (01001a/b) and his hero kit (01002–01009). */
export const SPIDER_MAN_KIT = defineAbilities({
  // Spider-Sense — Interrupt: When the villain initiates an attack against you, draw 1 card.
  "01001a.spider-sense": interrupt(when.villainAttacks({ againstYou: true }), draw(1)),
  // Scientist — Resource: Generate a [mental] resource. (Limit once per round.)
  "01001b.scientist": resource({ mental: 1 }, { limit: oncePerRound }),

  // Black Cat — Forced Response: After you play Black Cat, discard the top 2 cards of your deck.
  // Add each card with a printed [mental] resource discarded this way to your hand.
  // "Play" (not "enters play"): putting her into play with Make the Call doesn't trigger it.
  "01002.black-cat-forced-response": forcedResponse(
    after.youPlayThis(),
    moveCards(topOfDeck(2), "discard", "milled"),
    moveCards(cards(chosen("milled"), { printedResource: "mental" }), "hand"),
  ),
  // Backflip — Interrupt (defense): When you would take any amount of damage from an attack, prevent all of that damage.
  "01003.backflip-interrupt": interrupt(when.damage(YOUR_IDENTITY, { fromAttack: true }), { label: "defense" }, preventDamage()),
  // Enhanced Spider-Sense — Hero Interrupt: When a treachery card is revealed from the encounter deck, cancel its "When Revealed" effects.
  "01004.enhanced-spider-sense-interrupt": heroInterrupt(when.encounterCardRevealed(query("treachery")), cancelWhenRevealed()),
  // Swinging Web Kick — Hero Action (attack): Deal 8 damage to an enemy.
  "01005.swinging-web-kick-action": heroAction({ label: "attack" }, attackAnEnemy(8)),
  // Aunt May — Alter-Ego Action: Exhaust Aunt May → heal 4 damage from Peter Parker.
  "01006.aunt-may-action": alterEgoAction({ cost: exhaustThis }, heal(4, yourIdentity)),
  // Spider-Tracer — Forced Interrupt: When attached minion is defeated, remove 3 threat from a scheme.
  "01007.spider-tracer-forced-interrupt": forcedInterrupt(when.defeated("host"), removeThreatFromAScheme(3)),
  // Web-Shooter — Uses (3 web counters). Hero Resource: Exhaust Web-Shooter and remove 1 web counter from it → generate a [wild] resource.
  // The counter is part of the cost; the Uses keyword discards it when the last counter is removed.
  "01008.web-shooter-resource": heroResource({ wild: 1 }, { cost: [exhaustThis, removeCounter("web")] }),
  // Webbed Up — Forced Interrupt: When attached enemy would attack, discard Webbed Up instead. Then, stun that enemy.
  "01009.webbed-up-forced-interrupt": forcedInterrupt(when.enemyAttacks("host"), bindTargets("enemy", host), cancelIt(), discard(self), stun(chosen("enemy"))),
});

/** Eviction Notice (01165), Spider-Man's obligation. */
export const SPIDER_MAN_OBLIGATION = defineAbilities({
  // • Discard 1 card at random from your hand. This card gains surge. Discard this obligation.
  "01165.obligation": obligation("Peter Parker", {
    label: "Discard 1 card at random from your hand; this card gains surge",
    effects: [discardAtRandom(1), surge()],
  }),
});

/** Spider-Man's nemesis set: Highway Robbery, Vulture, Sweeping Swoop, The Vulture's Plans. */
export const SPIDER_MAN_NEMESIS = defineAbilities({
  // Highway Robbery — When Revealed: Each player places a random card from their hand facedown here.
  "01166.when-revealed": whenRevealed(forEachPlayer(eachPlayer, tuckCards(zone("hand", thatPlayer, { random: 1 }), self, true))),
  // When Defeated: Return each facedown card here to its owner's hand.
  "01166.when-defeated": whenDefeated(moveCards(tuckedUnder(self), "hand")),
  // Sweeping Swoop — When Revealed: Stun your hero. If Vulture is in play, this card gains surge.
  "01168.when-revealed": whenRevealed(stun(yourIdentity), ifThen(inPlay(cardName("01167")), surge())),
  // [star] Boost: If this activation deals damage to a friendly character, stun that character.
  "01168.boost": boost(atEndOfAttack(ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, FRIENDLY_CHARACTER)), stun(eventTarget)))),
  // The Vulture's Plans — When Revealed: Discard 1 card at random from each player's hand.
  // Place 1 threat on the main scheme for each different resource type discarded this way.
  "01169.when-revealed": whenRevealed(
    moveCards(zone("hand", eachPlayer, { random: 1 }), "discard", "plans"),
    placeThreat(resourceTypesOf(chosen("plans")), theMainScheme),
  ),
});
