import {
  constant,
  dealDamage,
  defineAbilities,
  discard,
  gainsKeyword,
  named,
  placeThreat,
  query,
  theMainScheme,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";
import { cardName } from "../names.js";

const BOW_NAME = cardName("04002");

/**
 * Criminal Past (04026), Hawkeye's obligation, and his nemesis set: Crossfire (04027), Marked for Death (04028),
 * Crossfire's Rifle (04029), Sniper Shot (04030).
 *
 * **Skipped:**
 * - `04027.boost` — "If this boost resolves during an attack, the attack gains piercing." Same one-shot-attack
 *   keyword-grant gap as Vibranium Arrow (`hawkeye-kit.ts` module docblock): a Boost ability has no persistent
 *   card to grant piercing "from" for just this activation; it needs the same `attack.piercing`-shaped primitive
 *   `modifyAttack` already has for `overkill`/`atkBonus`.
 * - `04028.when-revealed` — "tucks her faceup beneath this card. When this scheme is defeated, return the tucked
 *   Mockingbird to her owner's hand" (errata, RRG 1.8 p. 66) needs searching a player's hand, deck, discard pile
 *   *and play area* as one pool; `CardSelector zone`'s multi-zone search only spans out-of-play zones
 *   (`PlayerZone = "hand" | "deck" | "discard"`). Closest existing primitive: `zone()`'s existing multi-zone
 *   search (already spans hand+deck+discard); "play area" would need a fourth zone kind, or a separate `cards()`
 *   ref for "Mockingbird, wherever she is" unioned into one search.
 * - `04029.crossfires-rifle-action` — "Hero Action: Exhaust your hero and spend a [wild] resource → discard
 *   Crossfire's Rifle." `ResourceRequirement` (`engine/src/resources.ts`) has only `generic`/`physical`/`mental`/
 *   `energy` slots; a typed slot already accepts a wild resource as a substitute (`satisfies`'s "wilds cover any
 *   typed shortfall"), but there is no way to require the payment be a wild resource *specifically* (as opposed
 *   to any one resource, which is `generic`). Closest existing primitive: the typed fields themselves — a `wild`
 *   field on `ResourceRequirement`, checked before typed/generic fallback, is the natural extension.
 */
export const HAWKEYE_OBLIGATION_NEMESIS = defineAbilities({
  // Criminal Past — Give to the Clint Barton Player. You may flip to alter-ego form. Choose:
  // • Exhaust Clint Barton → remove this card from the game.
  // • Discard Hawkeye's Bow from play. Discard this obligation.
  "04026.obligation": obligation("Clint Barton", {
    label: "Discard Hawkeye's Bow from play",
    effects: [discard(named(BOW_NAME))],
  }),

  // Crossfire — Quickstrike (data). Crossfire's attacks gain piercing: a persistent character, so a constant grant
  // on himself is exact (unlike a played event's own one-off attack).
  "04027.crossfire-constant": constant(gainsKeyword({ name: "piercing" }, query("minion", { self: true }))),

  // Crossfire's Rifle — Attach to Crossfire. Otherwise, attach to the villain (data, `AttachmentHost.ifAble`).
  // [star] When attached enemy attacks, the attack gains ranged: a persistent attachment granting its host the
  // keyword works (host stays in play continuously), unlike a played event's own attack.
  "04029.crossfires-rifle-constant": constant(gainsKeyword({ name: "ranged" }, query("enemy", { hostOfSelf: true }))),
  // Crossfire's Rifle — Hero Action: Exhaust your hero and spend a [wild] resource → discard Crossfire's Rifle.
  // SKIPPED (module docblock): a `spend a [wild] resource` cost has no `ResourceRequirement` shape yet.

  // Sniper Shot — When Revealed (Alter-Ego): Place 3 threat on the main scheme.
  "04030.when-revealed-alter-ego": whenRevealedAlterEgo(placeThreat(3, theMainScheme)),
  // Sniper Shot — When Revealed (Hero): Deal 3 damage to your hero.
  "04030.when-revealed-hero": whenRevealedHero(dealDamage(3, yourIdentity)),
});
