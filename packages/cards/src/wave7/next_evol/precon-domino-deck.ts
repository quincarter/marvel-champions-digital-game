import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  action,
  after,
  attachCard,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  exhaustThis,
  forEachPlayer,
  gainsTraitsOf,
  heal,
  heroAction,
  heroInterrupt,
  ifThen,
  inDiscard,
  lookAt,
  moveCards,
  modifyAttack,
  on,
  option,
  perHero,
  playOnlyIf,
  putIntoPlay,
  query,
  ready,
  refMatches,
  removeThreat,
  response,
  self,
  shuffleDeck,
  theVillain,
  thatPlayer,
  topOfDeck,
  totalPrintedResources,
  valueAtLeast,
  whenDefeated,
  YOUR_IDENTITY,
  you,
  zone,
  discardTopOfDeckCost,
  cards,
} from "../../dsl/index.js";
import { SPIDERHAM_EVENTS } from "../../wave5/spiderham/events.js";
import { SPIDERHAM_SUPPORT_UPGRADES } from "../../wave5/spiderham/support-upgrades.js";

const POSSE = trait("POSSE");
const ELITE = trait("ELITE");
const SUPERPOWER = trait("SUPERPOWER");

/** The card a deck discard bound under `milled`: icons are counted as Domino's hero face counts them (a wild twice). */
const MILLED = { kind: "slot", slot: "milled" } as const;
const discardTopOfDeck = moveCards(topOfDeck(1), "discard", "milled");
/** "When Defeated: Each player may …": the effects run once per player, in player order, chosen by that player. */
const whenDefeatedEachPlayer = (...effects: EffectSpec[]) => whenDefeated(forEachPlayer(eachPlayer, effects));
/** The icons Sharpshooter's cost discarded. */
const PAID = { kind: "slot", slot: "paid" } as const;

/** The card types a player card can be named as ("name a card type"): the five Brainstorm names, plus player side scheme. */
const NAMEABLE_CARD_TYPES: ReadonlyArray<readonly [string, ReturnType<typeof query>]> = [
  ["Ally", query("ally")],
  ["Event", query("event")],
  ["Upgrade", query("upgrade")],
  ["Support", query("support")],
  ["Resource", query("resource")],
  ["Player side scheme", query("sideScheme")],
];

/** Wolfsbane after she names `type`: the discard, then the optional add if the card is of the named type. */
const wolfsbaneDiscard = (type: ReturnType<typeof query>): EffectSpec[] => [
  discardTopOfDeck,
  ifThen(
    refMatches(chosen("milled"), type, { anywhere: true }),
    chooseOne(
      option("Add it to your hand", moveCards(cards(chosen("milled")), "hand")),
      option("Leave it in your discard pile"),
    ),
  ),
];

/**
 * The aspect and basic cards printed with Domino's precon (40050-40064) and the basic ally Hope Summers (40204),
 * docs/phase7-wave7.md §7.1, §3.1-§3.4, §3.55, §3.56, §3.59, §3.61.
 *
 * - **Even the Odds (40052), Overwatch (40055)**: verbatim reprints of 30014 and 30019 (`wave5/spiderham`), aliased.
 *   Energy, Genius and Strength (40061-40063) print "Max 1 per deck." only: no ability refs.
 * - **Feral (40050)**: after she thwarts, discard the top card of her controller's deck; 1 damage (not an attack) to the
 *   villain per resource icon (a printed wild counts twice for Domino, §3.56).
 * - **Wolfsbane (40051)**: the type is named first (six types, player side scheme included), then the discard; a card a
 *   response already took away (Digging Deep) is not in the `milled` slot, so nothing is offered.
 * - **Team Investigation (40053)**: Alliance and `costPerPlayer` are data; plain removal of threat, not a thwart.
 * - **Take Out the Guards (40054), Superpower Training (40059)**: player side schemes, Victory 0 is data. When Defeated,
 *   each player (in player order) may act: discard a non-ELITE minion in play (a discard, not a defeat); search the deck
 *   and discard pile for an upgrade of their own identity set, attach it to their identity, then shuffle.
 * - **Atlas Bear (40056)**: any player's top card is looked at; an event may be added to its owner's hand for 1 damage
 *   to her.
 * - **White Fox (40057), Digging Deep (40060)**: responses from the discard pile after being discarded from the top of
 *   their owner's deck (`inDiscard`, §3.55).
 * - **The Posse (40058)**: "Play only if you control at least 3 POSSE characters" is its constant; the Action heals 1
 *   from, and readies, each POSSE character in play.
 * - **Sharpshooter (40064)**: Interrupt to your ranged attack; the cost discards the top card of the deck.
 * - **Hope Summers (40204)**: gains each trait of her controller's identity; after you play her, search for a SUPERPOWER
 *   card. She is not the campaign's Hope Summers 40130 (a different card with the same title).
 */
export const NEXT_EVOL_PRECON_DOMINO_DECK: AbilityRegistry = defineAbilities({
  "40050.feral-response": response(
    after.thwarts("self"),
    discardTopOfDeck,
    dealDamage(totalPrintedResources(MILLED), theVillain),
  ),

  "40051.wolfsbane-response": response(
    after.thwarts("self"),
    chooseOne(...NAMEABLE_CARD_TYPES.map(([label, type]) => option(label, wolfsbaneDiscard(type)))),
  ),

  "40052.even-the-odds-action": SPIDERHAM_EVENTS["30014.even-the-odds-action"]!,

  "40053.team-investigation-action": heroAction(
    chooseTarget("scheme", query("sideScheme")),
    removeThreat(perHero(3), chosen("scheme")),
  ),

  "40054.when-defeated": whenDefeatedEachPlayer(
    chooseTarget("minion", query("minion", { withoutTrait: ELITE }), { chooser: thatPlayer, optional: true }),
    discard(chosen("minion")),
  ),

  "40055.overwatch-interrupt": SPIDERHAM_SUPPORT_UPGRADES["30019.overwatch-interrupt"]!,

  "40056.atlas-bear-action": action(
    { cost: exhaustThis },
    choosePlayer("player", you, { among: eachPlayer }),
    lookAt(zone("deck", chosenPlayer("player"), { top: 1 }), { bind: "top" }),
    ifThen(
      refMatches(chosen("top"), query("event"), { anywhere: true }),
      chooseOne(
        option(
          "Deal 1 damage to Atlas Bear to add it to its owner's hand",
          dealDamage(1, self),
          moveCards(cards(chosen("top")), "hand"),
        ),
        option("Leave it on the deck"),
      ),
    ),
  ),

  "40057.white-fox-response": inDiscard(response(on.thisDiscardedFromYourDeck(), putIntoPlay(self))),

  "40058.the-posse-constant": constant(
    playOnlyIf(valueAtLeast(countOf(query("character", { trait: POSSE, controller: "you" })), 3)),
  ),
  "40058.the-posse-action": heroAction(
    heal(1, each(query("character", { trait: POSSE }))),
    ready(each(query("character", { trait: POSSE }))),
  ),

  "40059.when-defeated": whenDefeatedEachPlayer(
    chooseCards(
      "found",
      zone(["deck", "discard"], thatPlayer, { filter: query("upgrade", { identitySetOf: thatPlayer }) }),
      { min: 0, max: 1, chooser: thatPlayer },
    ),
    ifThen(refMatches(chosen("found"), query("upgrade"), { anywhere: true }), [
      chooseTarget("newHost", query(["identity", "ally"], { controlledBy: thatPlayer }), { chooser: thatPlayer }),
      attachCard(chosen("found"), chosen("newHost")),
    ]),
    shuffleDeck(thatPlayer),
  ),

  "40060.digging-deep-response": inDiscard(response(on.thisDiscardedFromYourDeck(), moveCards(cards(self), "hand"))),

  "40064.sharpshooter-interrupt": heroInterrupt(
    on.attacks(YOUR_IDENTITY, { has: ["ranged"] }),
    { cost: discardTopOfDeckCost(1, "paid") },
    modifyAttack({ extraDamage: totalPrintedResources(PAID) }),
  ),

  "40204.hope-summers-constant": constant(
    gainsTraitsOf(query("identity", { controller: "you" }), query("ally", { self: true })),
  ),
  "40204.hope-summers-response": response(
    after.youPlayThis(),
    chooseCards("found", zone("deck", you, { filter: { trait: SUPERPOWER } }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
});
