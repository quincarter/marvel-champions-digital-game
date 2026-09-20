import {
  anyOfCards,
  boost,
  cards,
  chooseCards,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  each,
  eventPlayer,
  exhaustYourHero,
  gainsKeyword,
  heroAction,
  modifyAttack,
  moveCards,
  named,
  placeThreat,
  query,
  self,
  spend,
  theMainScheme,
  tuckCards,
  tuckedUnder,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";
import { cardName } from "../names.js";

const BOW_NAME = cardName("04002");
const MOCKINGBIRD_NAME = cardName("04004");

/**
 * Criminal Past (04026), Hawkeye's obligation, and his nemesis set: Crossfire (04027), Marked for Death (04028),
 * Crossfire's Rifle (04029), Sniper Shot (04030).
 *
 * `04027.boost` and `04029.crossfires-rifle-action` were pinned pending engine primitives that have since landed
 * (docs/phase7-wave2.md §3): `AttackKeyword`/`modifyAttack({ keywords: [...] })` for the boost (see the ability
 * below for why no separate "if this boost resolves during an attack" condition is needed), and a `wild` slot on
 * `ResourceRequirement` for the Rifle's "spend a [wild] resource" cost.
 *
 * `04028.when-revealed` was pinned on a skip that had gone stale by the time of the audit
 * (docs/phase7-wave2.md §18.4): `anyOf` (CardSelector, landed for §10.1) unions the `zone` selector (hand/deck/
 * discard) with a `ref` selector over `each(query(...))` — the play area — into one pool and one choice, and
 * `tuckCards` already takes an in-play card out of play correctly (attachments discarded, RRG 1.8 "Leaves Play",
 * p. 27) rather than merely relocating the instance.
 *
 * "The Clint Barton player" is `eventPlayer`, checked rather than assumed: Marked for Death has no path into this
 * reveal at all except through Shadow of the Past (Core 01190, `core/modular/standard.ts`), whose own "Reveal
 * your set-aside nemesis side scheme and put it into play" is `revealCard(chosen("nemesisScheme"))` — default
 * player `you`, i.e. whichever player is *currently resolving* that copy of Shadow of the Past — over
 * `setAside(you, query("sideScheme"))`, which only ever finds a scheme in *that same player's own* set-aside pile.
 * Marked for Death sits nowhere else before this (RRG 1.8 "Nemesis Encounter Set", p. 30: set aside out of play at
 * setup). So the only way this ability's own reveal frame is ever created is when the player resolving Shadow of
 * the Past is the Hawkeye player — `eventPlayer` and "the Clint Barton player" are the same player by construction,
 * not by coincidence of a solo table.
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

  // Marked for Death — When Revealed (errata, RRG 1.8 p. 66): the Clint Barton player searches their hand, deck,
  // discard pile and play area for Mockingbird and tucks her faceup beneath this card (module docblock — `eventPlayer`
  // is provably the Clint Barton player here, and `anyOf` unions the out-of-play zones with the play area into one
  // pool and one choice).
  "04028.when-revealed": whenRevealed(
    chooseCards(
      "mockingbird",
      anyOfCards(
        zone(["hand", "deck", "discard"], eventPlayer, { filter: { name: MOCKINGBIRD_NAME } }),
        cards(each(query("ally", { controller: "any" })), { name: MOCKINGBIRD_NAME }),
      ),
      { min: 1, max: 1, chooser: eventPlayer },
    ),
    tuckCards(cards(chosen("mockingbird")), self),
  ),
  // Marked for Death — When Defeated: return the tucked Mockingbird to her owner's hand.
  "04028.when-defeated": whenDefeated(moveCards(tuckedUnder(self), "hand")),

  // Sniper Shot — When Revealed (Alter-Ego): Place 3 threat on the main scheme.
  "04030.when-revealed-alter-ego": whenRevealedAlterEgo(placeThreat(3, theMainScheme)),
  // Sniper Shot — When Revealed (Hero): Deal 3 damage to your hero.
  "04030.when-revealed-hero": whenRevealedHero(dealDamage(3, yourIdentity)),
});
