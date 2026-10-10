import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  attackInProgress,
  boostIconsOn,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  choosePlayer,
  chosenPlayer,
  constant,
  dealDamage,
  defineAbilities,
  encounterCards,
  eventTarget,
  exhaustCardsCost,
  exists,
  find,
  gainsAbility,
  gainsKeyword,
  gets,
  heroAction,
  host,
  ifThen,
  interrupt,
  modifyStatOf,
  modifyThwart,
  moveCards,
  not,
  playOnlyIf,
  preventDamage,
  putIntoPlay,
  query,
  ready,
  refMatches,
  removeCounter,
  removeThreatFromAScheme,
  repeatTimes,
  response,
  rule,
  spend,
  sum,
  takeIntoHand,
  titled,
  when,
  yourIdentity,
  YOUR_HERO,
  exhaustThis,
  you,
  PAID_CARDS,
  paidCards,
  refCount,
  self,
  action,
  spendableFromTucked,
  valueAtMost,
  tuckCards,
  tuckedCount,
  valueAtLeast,
  zone,
  eachPlayer,
} from "../../dsl/index.js";
import { LEADERSHIP } from "../../core/aspects/leadership.js";
import { STAR_LORD_KIT } from "../../wave3/stld/star-lord-kit.js";
import { IRONHEART_ALLIES } from "../../wave5/ironheart/allies.js";
import { ANGEL_SUPPORT_UPGRADES_ALLIES } from "../../wave7/angel/support-upgrades-allies.js";

const AERIAL = trait("AERIAL");

/** The id of Flight Squadron's gained response, registered under no card's own abilities (see the module header). */
export const FLIGHT_SQUADRON_GRANTED_RESPONSE = "53020.flight-squadron-granted-response";

/**
 * The id of Spectrum's "Response: After you play Spectrum, tuck 1 card used to pay for her under her", registered
 * under no card's own abilities (see the module header).
 */
export const SPECTRUM_GRANTED_RESPONSE = "53018.spectrum-granted-response";

/** Spectrum herself, for her own constant. */
const SPECTRUM_SELF = query("ally", { self: true });
/** "If that card's printed resource has [type]", and "[wild] – All of the above": a card tucked under her prints it. */
const tuckedPrints = (type: "mental" | "physical" | "energy") =>
  valueAtLeast(tuckedCount(self, { anyPrintedResource: [type, "wild"] }), 1);

/** "If each of your allies has the Aerial trait": true with no allies, as Avengers Tower 03024 reads the same wording. */
const EACH_OF_YOUR_ALLIES_IS_AERIAL = not(exists(query("ally", { controller: "you", withoutTrait: AERIAL })));

/**
 * "Captain America's Shield": Steve Rogers' 03009 and the linked 53034 share the title. The find offers every copy it
 * reaches (RRG 1.8 "Find", p. 19), the player picking one.
 */
const CAPTAINS_SHIELD = query("upgrade", { name: "Captain America's Shield" });

/**
 * Wave 9 scripting module `falcon/aspect-basic` (docs/phase7-wave9.md section 8.4): 53014 to 53028 and 53034 to 53037.
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **53014.adam-warlock-response / 53016.cloud-9-action**: reprints of Adam Warlock 17011 (`stld`) and Cloud 9 29014
 * (`ironheart`), same cost, stats, traits and text; aliased. 17011's other four refs are an ingestion artifact of the
 * bulleted lines (`partOf` the response); 53014's data lists only the response.
 *
 * **53015.aero-action**: Cloud 9's text with ATK. Exhausting Aero is the cost (before the arrow); the player is chosen
 * on resolution, and every Aerial character that player controls (allies, and an identity with the trait) gets +1 ATK
 * until the end of the phase.
 *
 * **53017.hugin-and-munin-response**: the search of the top 10 cards of the encounter deck is compulsory when a minion
 * is there (owner ruling: a search with no "may"); the minion enters play engaged with you, then one character you
 * control is readied for each icon (star and boost) printed in its boost area (section 3.43: `boostIcons + starIcons`;
 * amplify adds nothing). The search and the entry are "before the arrow", so they are costs by the rules, but the cost
 * vocabulary has no search of the encounter deck (`chooseCard` reads the payer's hand, discard and decks only), so they
 * are the first effects: with no minion in the top 10 the response is still offered and does nothing, instead of not
 * being offered. Each readied character is its own choice (RRG "'For Each'", p. 20), so one may be named twice.
 *
 * **53018.spectrum-response / 53018.spectrum-granted-response**: the data keeps one ref for the whole text, which
 * is two things: the response that tucks, and the bonuses, which last "only … while a card remains tucked under her"
 * (ruling June 2, 2026 - Ruling 2 (2)) and so are a constant read from the tucked card, not a lasting effect of the
 * response (section 3.46 (b)). The printed ref is that constant, and it gives her the response under the registry-only
 * id `SPECTRUM_GRANTED_RESPONSE` (`gainsAbility`, as Flight Squadron's), with no condition: she always has it. The
 * response answers her own play only ("After you play Spectrum": put into play another way she tucks nothing) and is
 * offered when a card paid for her (engine slot `paid.cards`: cards discarded from a hand, another player's too, or
 * spent from under a Resource Reserve; never a resource a "Resource" ability generated, never an overpaid card). The
 * player picks 1 of those still in a discard pile, whoever owns it; it is tucked faceup and stays its owner's. Each
 * bonus reads the printed resources of what is tucked under her: [mental] +2 THW, [physical] +2 ATK, [energy] +2 hit
 * points, each once however many icons, and a printed [wild] gives all three. A card of any type can be tucked (the
 * ruling's example is Captain America's Shield, a [wild]). When the tucked card leaves, the bonuses end at once; with
 * the hit points gone, damage of 3 or more defeats her.
 *
 * **53020.flight-squadron-constant / 53020.flight-squadron-granted-response**: "If each of your allies has the Aerial
 * trait, increase your ally limit by 1 and this card gains: 'Response: ...'". One condition (no ally you control
 * lacks the trait; true with no allies) over both halves of the constant: the ally limit (+1), and the grant of the
 * quoted response to the card itself (`gainsAbility`; RRG 1.8 "'Gains'", p. 21). The response is registered under the
 * registry-only id `FLIGHT_SQUADRON_GRANTED_RESPONSE`, as Night Vision Goggles 50070 registers its granted
 * Preparation (the data keeps one ref per constant, packages/content/src/data/wave9.test.ts), and carries no
 * condition of its own: while the constant's holds the card has it, with its cost (exhaust this card) its own.
 *
 * **53021.resource-reserve-constant / 53021.resource-reserve-action**: "Any player may spend the resource card tucked
 * here as if it were in their hand" is the engine rule `spendableFromTucked` (section 3.46 (c)): the tucked resource
 * card is offered to every player with their hand cards, generates what it would from the spender's hand (a wild is a
 * wild; The Power of Flight 53028 doubles for an Aerial card), counts as a card that paid, and is discarded from under
 * the support to its owner's discard pile. Only spending: it is not a card in hand for a discard cost and cannot be
 * played. The Action (any form, the controller's) exhausts the support as its cost and tucks 1 card of the resource
 * card type from the controller's hand (RRG 1.8 "Resource Card", p. 37: a card type, not any card with a resource
 * icon); "(to a maximum of 1)" refuses the action while a card is tucked. "Max 1 per player" is data. When the support
 * leaves play the card under it is discarded (RRG 1.8 "Tuck", p. 45).
 *
 * **53022.the-triskelion-constant / 53028.the-power-of-flight-constant**: reprints of Core's The Triskelion 01073 and
 * Angel's The Power of Flight 42022, same cost, icons, traits and text; aliased.
 *
 * **53023.captain-america-constant / 53023.captain-america-action**: "Play only if you are the Bucky Barnes or Sam
 * Wilson player" names an identity card by both sides ("Falcon/Sam Wilson", "Winter Soldier/Bucky Barnes"; RRG 1.8
 * "Identity", p. 23), so it holds in either form. The Hero Action's cost is exhausting the upgrade and spending a
 * [physical] resource. The find offers every "Captain America's Shield" it reaches (RRG 1.8 "Find", p. 19: the linked
 * 53034 set aside, and with Steve Rogers in the game his 03009, ruling June 25, 2026 - Ruling 4 (2)); the player picks
 * and must pick one. The shield goes to the player's hand and stays its owner's (ruling June 25, 2026 - Ruling 1: "If
 * discarded, it returns to Steve's discard pile"); the linked copy, owned by nobody, becomes the player's. "If it
 * leaves play this way" is true only for a shield that was in play, then 4 damage to an enemy of the player's choice.
 * Not done: the owner's deck is not shuffled when the chosen shield was in it (a find of a deck card shuffles that
 * deck, RRG 1.8 "Search", p. 39); the choice among copies is made apart from `findCard`, which takes the first.
 *
 * **53024.wingman-interrupt**: another Aerial ally's consequential damage, 1 of it prevented; the cost exhausts the
 * attached ally (it cannot pay while exhausted).
 *
 * **53034.captain-americas-shield-constant**: Core's shield (03009) for "your hero": +1 DEF and retaliate 1 while the
 * controller is in hero form. Linked and Restricted are data.
 *
 * **53035.winter-soldier-response**: "attacks and defeats an enemy", 2 threat from a scheme of the player's choice.
 *
 * **53036.misty-knight-interrupt**: looks at the top 2 cards of the encounter deck and discards 1 (compulsory); the
 * thwart then removes 1 additional threat per icon (star and boost) printed in the discarded card's boost area
 * (`modifyThwart`, as Silk's Outwit 52010 reads "gets +X THW for this thwart"). The look and the discard follow no
 * arrow, so they are effects. Not tested, no ruling read: an encounter deck of fewer than 2 cards (the look takes the
 * cards there; the deck is not reset first).
 *
 * **53037.ops-room-interrupt**: "while defending" is the defender of the attack being the character that takes the
 * damage (`attackInProgress.defender` against the event's target), so overkill spilling onto another character of a
 * defended attack and an undefended attack are not answered. Removing the counter is the cost; the threat removal is a
 * plain removal (not a thwart) from a scheme of the player's choice.
 *
 * **Skipped** (see the map): 53019 (task 34).
 *
 * Cards (19):
 * - 53014 Adam Warlock (ally)
 * - 53015 Aero (ally)
 * - 53016 Cloud 9 (ally)
 * - 53017 Hugin & Munin (ally)
 * - 53018 Spectrum (ally)
 * - 53019 Strength in Diversity (event)
 * - 53020 Flight Squadron (support)
 * - 53021 Resource Reserve (support)
 * - 53022 The Triskelion (support)
 * - 53023 Captain America (upgrade)
 * - 53024 Wingman (upgrade)
 * - 53025 Energy (resource)
 * - 53026 Genius (resource)
 * - 53027 Strength (resource)
 * - 53028 The Power of Flight (resource)
 * - 53034 Captain America's Shield (upgrade)
 * - 53035 Winter Soldier (ally)
 * - 53036 Misty Knight (ally)
 * - 53037 Ops Room (support)
 */
export const FALCON_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "53014.adam-warlock-response": STAR_LORD_KIT["17011.adam-warlock-response"]!,

  "53015.aero-action": heroAction(
    { cost: exhaustThis },
    choosePlayer(),
    modifyStatOf("atk", 1, query("character", { trait: AERIAL, controlledBy: chosenPlayer() }), "endOfPhase"),
  ),

  "53016.cloud-9-action": IRONHEART_ALLIES["29014.cloud-9-action"]!,

  "53017.hugin-and-munin-response": response(
    after.entersPlay("self"),
    chooseCards("found", encounterCards(["deck"], query("minion"), 10), { min: 1, max: 1 }),
    putIntoPlay(chosen("found")),
    repeatTimes(
      sum(boostIconsOn(chosen("found")), { kind: "starIcons", cards: chosen("found") }),
      chooseTarget("character", query("character", { controlledBy: you })),
      ready(chosen("character")),
    ),
  ),

  "53018.spectrum-response": constant(
    gets("thw", 2, SPECTRUM_SELF, { while: tuckedPrints("mental") }),
    gets("atk", 2, SPECTRUM_SELF, { while: tuckedPrints("physical") }),
    gets("hp", 2, SPECTRUM_SELF, { while: tuckedPrints("energy") }),
    gainsAbility(SPECTRUM_GRANTED_RESPONSE),
  ),
  [SPECTRUM_GRANTED_RESPONSE]: response(
    after.youPlayThis(),
    { while: valueAtLeast(refCount(paidCards), 1) },
    chooseCards("tucked", zone("discard", eachPlayer, { filter: { inSlot: PAID_CARDS } }), { min: 1, max: 1 }),
    tuckCards(cards(chosen("tucked")), self),
  ),

  "53020.flight-squadron-constant": constant(
    rule({ kind: "allyLimit", amount: 1, while: EACH_OF_YOUR_ALLIES_IS_AERIAL }),
    gainsAbility(FLIGHT_SQUADRON_GRANTED_RESPONSE, { while: EACH_OF_YOUR_ALLIES_IS_AERIAL }),
  ),
  [FLIGHT_SQUADRON_GRANTED_RESPONSE]: response(
    after.youPlayedCard(query([], { trait: AERIAL })),
    { cost: exhaustThis },
    chooseTarget("ally", query("ally", { controller: "you" })),
    ready(chosen("ally")),
  ),

  "53021.resource-reserve-constant": constant(spendableFromTucked()),
  "53021.resource-reserve-action": action(
    { cost: exhaustThis, while: valueAtMost(tuckedCount(self), 0) },
    chooseCards("tucked", zone("hand", you, { filter: query("resource") }), { min: 1, max: 1 }),
    tuckCards(cards(chosen("tucked")), self),
  ),

  "53022.the-triskelion-constant": LEADERSHIP["01073.the-triskelion-constant"]!,

  "53023.captain-america-constant": constant(
    playOnlyIf(refMatches(yourIdentity, titled("Falcon/Sam Wilson", "Winter Soldier/Bucky Barnes"))),
  ),
  "53023.captain-america-action": heroAction(
    { cost: [exhaustThis, spend({ physical: 1 })] },
    chooseCards("shield", cards(find(CAPTAINS_SHIELD)), { min: 1, max: 1 }),
    ifThen(
      refMatches(chosen("shield"), query("upgrade")),
      [
        takeIntoHand(cards(chosen("shield")), you, { keepOwner: true }),
        chooseTarget("enemy", query("enemy")),
        dealDamage(4, chosen("enemy")),
      ],
      takeIntoHand(cards(chosen("shield")), you, { keepOwner: true }),
    ),
  ),

  "53024.wingman-interrupt": interrupt(
    when.damage(query("ally", { trait: AERIAL, excluding: host }), { consequential: true }),
    { cost: exhaustCardsCost(query("ally", { hostOfSelf: true })) },
    preventDamage(1),
  ),

  "53028.the-power-of-flight-constant": ANGEL_SUPPORT_UPGRADES_ALLIES["42022.the-power-of-flight-constant"]!,

  "53034.captain-americas-shield-constant": constant(
    gets("def", 1, YOUR_HERO),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_HERO),
  ),

  "53035.winter-soldier-response": response(
    after.attacks("self", { target: query("enemy"), defeats: true }),
    removeThreatFromAScheme(2),
  ),

  "53036.misty-knight-interrupt": interrupt(
    when.thwarts("self"),
    chooseCards("discarded", encounterCards(["deck"], undefined, 2), { min: 1, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
    modifyThwart({
      extraThreat: sum(boostIconsOn(chosen("discarded")), { kind: "starIcons", cards: chosen("discarded") }),
    }),
  ),

  "53037.ops-room-interrupt": interrupt(
    {
      ...when.damage(query(["identity", "ally"]), { fromAttack: true }),
    },
    {
      cost: removeCounter("alert"),
      while: attackInProgress({ defender: query(["identity", "ally"], { not: { excluding: eventTarget } }) }),
    },
    preventDamage(1),
    removeThreatFromAScheme(1),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FALCON_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "53019.strength-in-diversity-action":
    "needs engine task 34 (section 3.48): `ValueSpec distinctTraits { of }`, the number of different traits among friendly characters in play (only `distinctAspects` and `distinctCardTypes` exist); the rest is `repeatTimes(times, chooseOne(...))`",
};
