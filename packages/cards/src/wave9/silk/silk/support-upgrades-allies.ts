import type { AbilityRegistry } from "@mc/engine";
import {
  YOUR_HERO,
  YOUR_IDENTITY,
  action,
  alterEgoAction,
  atEndOfAttack,
  attackingEnemy,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  encounterCards,
  encounterSetOf,
  eventTarget,
  exhaustThis,
  gets,
  heal,
  heroInterrupt,
  isHero,
  modifyAttack,
  modifyStat,
  modifyThwart,
  on,
  option,
  putIntoPlay,
  query,
  removeThreat,
  shuffleDeck,
  tuckCards,
  tuckedCount,
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
 * **52008.eidetic-memory-interrupt** is not scripted (see the skipped map). The errata text it would implement (RRG
 * 1.8 p. 70: "your identity", twice, so it works in either form) is: when you reveal a card from the same encounter
 * set as a card tucked under your identity, exhaust to swap those cards and reveal the formerly tucked card instead.
 *
 * **52009.organic-webbing-constant**: Silk gets +1 THW (hero form). Its action is skipped (see the map).
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

  "52009.organic-webbing-constant": constant(gets("thw", 1, YOUR_IDENTITY, { while: isHero() })),

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

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SILK_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "52008.eidetic-memory-interrupt":
    "swapCards(eventTarget, chosen tucked) then revealCard(chosen tucked) swaps and reveals the tucked card fully (both verified), but cancelTriggeringEvent on encounterCardRevealing only marks the event cancelled: the original reveal frame (engine resolve/reveal.ts, stage enterPlay) keeps resolving its instance, which after the swap is the card tucked under the identity, and moves it from under the identity into play. Needs an engine effect that ends the reveal in progress without resolving it (docs/phase7-wave9.md section 3.41 names cancelTriggeringEvent, which does not do that for a reveal)",
  "52009.organic-webbing-action":
    "its cost discards a card tucked under Silk; AbilityCost has no tucked-card discard yet (same gap as 52001b.cindy-moon-action, docs/phase7-wave9.md section 3.39, owner question 7); the engine agent is adding it",
};
