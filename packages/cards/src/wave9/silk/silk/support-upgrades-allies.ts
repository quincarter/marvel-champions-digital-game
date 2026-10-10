import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  YOUR_HERO,
  YOUR_IDENTITY,
  action,
  alterEgoAction,
  atEndOfAttack,
  attackingEnemy,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discardTuckedCost,
  encounterCards,
  encounterSetOf,
  eventTarget,
  exhaustThis,
  gainTraitUntil,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  interrupt,
  isHero,
  modifyAttack,
  modifyStat,
  modifyThwart,
  on,
  option,
  putIntoPlay,
  query,
  ready,
  removeThreat,
  revealInstead,
  shuffleDeck,
  swapCards,
  tuckCards,
  tuckedCount,
  tuckedUnderRef,
  yourIdentity,
  you,
  zone,
} from "../../../dsl/index.js";

/** Cards tucked under the player's identity from the encounter set(s) of the card `of` (RRG 1.8 "Encounter Set", p. 18). */
const tuckedOfSetOf = (of: Parameters<typeof encounterSetOf>[0]) =>
  tuckedCount(yourIdentity, query([], encounterSetOf(of)));

/**
 * Wave 9 scripting module `silk/silk/support-upgrades-allies` (docs/phase7-wave9.md section 8.4, 3.39, 3.41).
 * `card-groups.ts` maps this module to the ids below, except Get the Scoop 52005, a player side scheme that the map
 * keeps in `silk/silk/events` (scripted there); keep the two in step.
 *
 * **52006.albert-moon-action** (Alter-Ego Action, exhaust): choose one. Tuck the top card of the encounter deck under
 * Cindy Moon, or heal 1 damage from her for each card tucked under her (read when the mode resolves).
 *
 * **52007.j-jonah-jameson-action** (Alter-Ego Action, exhaust): search the deck and discard pile for Get the Scoop and
 * put it into play (one shuffle). **52007.j-jonah-jameson-action-2** (Action, exhaust, either form): remove 2 threat
 * from a side scheme.
 *
 * **52008.eidetic-memory-interrupt** (Interrupt, either form), the erratum's text (RRG 1.8 p. 70, "your identity"
 * twice): "When you reveal a card from the same encounter set as a card tucked under your identity, exhaust Eidetic
 * Memory → swap those cards. Reveal the card that had been tucked under your identity instead." Opens in the revealed
 * card's "when revealed" window, before any of it resolves, and only while a tucked card of its set is there to choose
 * (with several, the player chooses one). The swap is RRG 1.8 "'Swap'" (p. 42): the revealed card takes the tucked
 * card's place under the identity, so the count of tucked cards does not change and the four-card cap is not touched.
 * "Instead" is a replacement (RRG 1.8 "Replacement Effect", p. 36): the first card's reveal ends unresolved (it does
 * not enter play, resolves no keyword or When Revealed, is not discarded) and the formerly tucked card is revealed by
 * the same player in full, its own "when revealed" window, When Revealed, keywords and surge included
 * (`revealInstead`, docs/phase7-wave9.md section 3.41). A villain's or main scheme's new face is not answered: those
 * cards have no swap with a tucked card, so the ability could change nothing.
 *
 * **52009.organic-webbing-constant**: Silk gets +1 THW (hero form). **52009.organic-webbing-action** (Hero Action):
 * "Exhaust Organic Webbing and discard a card tucked under Silk → ready Silk. She gains the Aerial trait until the end
 * of the round." Both halves before the arrow are the cost (RRG 1.8 "Cost", p. 13): with nothing tucked under the
 * identity it cannot be initiated, with several the player chooses which, and the card goes to its owner's discard pile
 * (an encounter card to the encounter discard pile; RRG 1.8 "Tuck", p. 45). No printed limit: the exhaust is the limit.
 *
 * **52010.outwit-interrupt**: when Silk makes a basic thwart, exhaust: +1 THW for each card tucked under her from the
 * same encounter set as the thwarted scheme, read when it resolves, as extra threat removed by that thwart.
 *
 * **52011.spider-claws-interrupt**: when Silk makes a basic attack, exhaust: +1 ATK for each card tucked under her
 * from the same encounter set as the attacked enemy; the attack gains piercing.
 *
 * **52012.spider-reflexes-interrupt**: when Silk defends, exhaust: +1 DEF for each card tucked under her from the same
 * encounter set as the attacking enemy, for this attack; after the attack, tuck the top card of the encounter discard
 * pile under Silk.
 *
 * Cards (7):
 * - 52006 Albert Moon (support)
 * - 52007 J. Jonah Jameson (support)
 * - 52008 Eidetic Memory (upgrade)
 * - 52009 Organic Webbing (upgrade)
 * - 52010 Outwit (upgrade)
 * - 52011 Spider Claws (upgrade)
 * - 52012 Spider Reflexes (upgrade)
 */
export const SILK_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "52006.albert-moon-action": alterEgoAction(
    { cost: exhaustThis },
    chooseOne(
      option(
        "Tuck the top card of the encounter deck under Cindy Moon",
        tuckCards(encounterCards(["deck"], undefined, 1), yourIdentity),
      ),
      option(
        "Heal 1 damage from Cindy Moon for each card tucked under her",
        heal(tuckedCount(yourIdentity), yourIdentity),
      ),
    ),
  ),

  "52007.j-jonah-jameson-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("found", zone(["deck", "discard"], you, { filter: query([], { name: "Get the Scoop" }) }), {
      min: 0,
      max: 1,
    }),
    putIntoPlay(chosen("found")),
    shuffleDeck(),
  ),
  "52007.j-jonah-jameson-action-2": action(
    { cost: exhaustThis },
    chooseTarget("scheme", query("sideScheme")),
    removeThreat(2, chosen("scheme")),
  ),

  "52008.eidetic-memory-interrupt": interrupt(
    {
      ...on.encounterCardRevealed(query([], { not: query(["villain", "mainScheme"]) })),
      playerIs: "controller",
    },
    { cost: exhaustThis },
    chooseCards("tucked", cards(tuckedUnderRef(yourIdentity, query([], encounterSetOf(eventTarget)))), {
      min: 1,
      max: 1,
    }),
    swapCards(eventTarget, chosen("tucked")),
    revealInstead(chosen("tucked")),
  ),

  "52009.organic-webbing-constant": constant(gets("thw", 1, YOUR_IDENTITY, { while: isHero() })),
  "52009.organic-webbing-action": heroAction(
    { cost: [exhaustThis, discardTuckedCost(yourIdentity)] },
    ready(yourIdentity),
    gainTraitUntil(trait("AERIAL"), yourIdentity, "endOfRound"),
  ),

  "52010.outwit-interrupt": heroInterrupt(
    on.thwarts(YOUR_IDENTITY, { basic: true }),
    { cost: exhaustThis },
    modifyThwart({ extraThreat: tuckedOfSetOf(eventTarget) }),
  ),

  "52011.spider-claws-interrupt": heroInterrupt(
    on.attacks(YOUR_IDENTITY, { basic: true }),
    { cost: exhaustThis },
    modifyAttack({ atkBonus: tuckedOfSetOf(eventTarget), keywords: ["piercing"] }),
  ),

  "52012.spider-reflexes-interrupt": heroInterrupt(
    on.defends(YOUR_HERO),
    { cost: exhaustThis },
    modifyStat("def", tuckedOfSetOf(attackingEnemy), yourIdentity, "endOfAttack"),
    atEndOfAttack(tuckCards(encounterCards(["discard"], undefined, { topmostOnly: true }), yourIdentity)),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const SILK_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
