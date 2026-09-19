import {
  boost,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  exhaustYourHero,
  gainsKeyword,
  heroAction,
  modifyAttack,
  named,
  placeThreat,
  query,
  self,
  spend,
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
 * `04027.boost` and `04029.crossfires-rifle-action` were pinned pending engine primitives that have since landed
 * (docs/phase7-wave2.md §3): `AttackKeyword`/`modifyAttack({ keywords: [...] })` for the boost (see the ability
 * below for why no separate "if this boost resolves during an attack" condition is needed), and a `wild` slot on
 * `ResourceRequirement` for the Rifle's "spend a [wild] resource" cost.
 *
 * **Skipped:**
 * - `04028.when-revealed` — "tucks her faceup beneath this card. When this scheme is defeated, return the tucked
 *   Mockingbird to her owner's hand" (errata, RRG 1.8 p. 66) needs searching a player's hand, deck, discard pile
 *   *and play area* as one pool; `CardSelector zone`'s multi-zone search only spans out-of-play zones
 *   (`PlayerZone = "hand" | "deck" | "discard"`). Closest existing primitive: `zone()`'s existing multi-zone
 *   search (already spans hand+deck+discard); "play area" would need a fourth zone kind, or a separate `cards()`
 *   ref for "Mockingbird, wherever she is" unioned into one search.
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
  // Crossfire — [star] Boost: If this boost resolves during an attack, the attack gains piercing. `modifyAttack`'s
  // granted var is read only by an attack activation (`enemy-activation.ts`'s scheme path never reads it), so a
  // boost that resolves during a scheme activation harmlessly no-ops — no separate condition needed here.
  "04027.boost": boost(modifyAttack({ keywords: ["piercing"] })),

  // Crossfire's Rifle — Attach to Crossfire. Otherwise, attach to the villain (data, `AttachmentHost.ifAble`).
  // [star] When attached enemy attacks, the attack gains ranged: a persistent attachment granting its host the
  // keyword works (host stays in play continuously), unlike a played event's own attack.
  "04029.crossfires-rifle-constant": constant(gainsKeyword({ name: "ranged" }, query("enemy", { hostOfSelf: true }))),
  // Crossfire's Rifle — Hero Action: Exhaust your hero and spend a [wild] resource → discard Crossfire's Rifle.
  "04029.crossfires-rifle-action": heroAction({ cost: [exhaustYourHero, spend({ wild: 1 })] }, discard(self)),

  // Sniper Shot — When Revealed (Alter-Ego): Place 3 threat on the main scheme.
  "04030.when-revealed-alter-ego": whenRevealedAlterEgo(placeThreat(3, theMainScheme)),
  // Sniper Shot — When Revealed (Hero): Deal 3 damage to your hero.
  "04030.when-revealed-hero": whenRevealedHero(dealDamage(3, yourIdentity)),
});
