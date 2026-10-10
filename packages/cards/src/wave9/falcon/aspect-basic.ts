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
} from "../../dsl/index.js";
import { LEADERSHIP } from "../../core/aspects/leadership.js";
import { STAR_LORD_KIT } from "../../wave3/stld/star-lord-kit.js";
import { IRONHEART_ALLIES } from "../../wave5/ironheart/allies.js";
import { ANGEL_SUPPORT_UPGRADES_ALLIES } from "../../wave7/angel/support-upgrades-allies.js";

const AERIAL = trait("AERIAL");

/** The id of Flight Squadron's gained response, registered under no card's own abilities (see the module header). */
export const FLIGHT_SQUADRON_GRANTED_RESPONSE = "53020.flight-squadron-granted-response";

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
 * **53020.flight-squadron-constant / 53020.flight-squadron-granted-response**: "If each of your allies has the Aerial
 * trait, increase your ally limit by 1 and this card gains: 'Response: ...'". One condition (no ally you control
 * lacks the trait; true with no allies) over both halves of the constant: the ally limit (+1), and the grant of the
 * quoted response to the card itself (`gainsAbility`; RRG 1.8 "'Gains'", p. 21). The response is registered under the
 * registry-only id `FLIGHT_SQUADRON_GRANTED_RESPONSE`, as Night Vision Goggles 50070 registers its granted
 * Preparation (the data keeps one ref per constant, packages/content/src/data/wave9.test.ts), and carries no
 * condition of its own: while the constant's holds the card has it, with its cost (exhaust this card) its own.
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
 * **Skipped** (see the map): 53018 (task 31), 53019 (task 34), 53021 (task 32).
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
  "53018.spectrum-response":
    "needs engine task 31 (section 3.46 (b)): a slot `paid.cards` on a play's announcement, the cards that paid for the play; nothing existing names the cards that paid (only `paid.*` counts and `paidWithCard` for a named card)",
  "53019.strength-in-diversity-action":
    "needs engine task 34 (section 3.48): `ValueSpec distinctTraits { of }`, the number of different traits among friendly characters in play (only `distinctAspects` and `distinctCardTypes` exist); the rest is `repeatTimes(times, chooseOne(...))`",
  "53021.resource-reserve-constant":
    "needs engine task 32 (section 3.46 (c)): `RuleSpec spendableFromTucked`, a tucked resource card as a payment source for every player (nothing in payable.ts names a tucked card)",
  "53021.resource-reserve-action":
    "needs engine task 32 (section 3.46 (c)); the tuck is only meaningful with the constant that makes the tucked card spendable, so both refs of the card wait together",
};
