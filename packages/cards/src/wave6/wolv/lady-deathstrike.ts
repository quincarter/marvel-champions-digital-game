import {
  after,
  attacksGainKeywords,
  boost,
  each,
  chosen,
  constant,
  defineAbilities,
  discard,
  discardAtRandom,
  enemyActivates,
  eventTarget,
  exists,
  forcedResponse,
  heroAction,
  ifThen,
  isAttached,
  moveCards,
  not,
  ownerOf,
  putIntoPlay,
  query,
  cards,
  selectCards,
  encounterCards,
  oneCopyOf,
  self,
  shuffleEncounterDeck,
  spend,
  surge,
  takeDamage,
  totalPrintedResources,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

const LADY_DEATHSTRIKE = query("minion", { name: "Lady Deathstrike" });

/**
 * The Lady Deathstrike modular set (`deathstrike`, `wolv` 35034-35037, docs/phase7-wave6.md §6.1, §3.44): Lady
 * Deathstrike, Seeking Vengeance, Adamantium Upgrades x2 and Hack 'n' Slash x2. Quickstrike, Elite, the +2 ATK box and
 * "Attach to an enemy without a copy of Adamantium Upgrades attached" are data.
 *
 * - **Lady Deathstrike**: the discard is "that character's owner": the attacked character's owner, so an ally's owner
 *   discards when the ally was damaged.
 * - **Seeking Vengeance**: the search covers the deck and discard pile, then the deck is shuffled (RRG 1.8 "Search").
 * - **Adamantium Upgrades**: the card data's `-constant` ref is the printed "Otherwise, this card gains surge" (read
 *   after the engine tried to attach it, as Jetpack and Tech Gauntlets, `wave4/hood/ransacked-armory.ts`), `-constant-2`
 *   is the star line. The action's cost is exactly one of each type: a [wild] resource covers one of them.
 * - **Hack 'n' Slash**: the random card is picked first, so its printed resources can be read after it is discarded
 *   (a hand with no card discards nothing and takes no damage).
 */
const hackNSlash = () => [
  selectCards("hack", zone("hand", you, { random: 1 })),
  moveCards(cards(chosen("hack")), "discard"),
  takeDamage(totalPrintedResources(chosen("hack"))),
];

export const LADY_DEATHSTRIKE_ABILITIES = defineAbilities({
  // Lady Deathstrike (35034) — [star] Forced Response: After she attacks and damages a character, that character's
  // owner discards 1 random card from their hand.
  "35034.lady-deathstrike-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    discardAtRandom(1, ownerOf(eventTarget)),
  ),

  // Seeking Vengeance (35035) — When Revealed: If Lady Deathstrike is in play, she activates against you. Otherwise,
  // search the encounter deck and discard pile for her and put her into play engaged with you.
  "35035.when-revealed": whenRevealed(
    ifThen(exists(LADY_DEATHSTRIKE), enemyActivates(each(LADY_DEATHSTRIKE), { against: you }), [
      selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], LADY_DEATHSTRIKE))),
      putIntoPlay(chosen("found"), you),
      shuffleEncounterDeck(),
    ]),
  ),

  // Adamantium Upgrades (35036).
  "35036.adamantium-upgrades-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  "35036.adamantium-upgrades-constant-2": constant(
    attacksGainKeywords(["piercing"], { attacker: { hostOfSelf: true } }),
  ),
  "35036.adamantium-upgrades-action": heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self)),

  // Hack 'n' Slash (35037) — When Revealed / [star] Boost: Discard 1 random card from your hand and take damage equal
  // to the number of printed resources on it.
  "35037.when-revealed": whenRevealed(...hackNSlash()),
  "35037.boost": boost(...hackNSlash()),
});
