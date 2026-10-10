import type { AbilityRegistry } from "@mc/engine";
import {
  attack,
  alterEgoAction,
  eachPlayer,
  encounterCards,
  exhaustYourHero,
  self,
  whenDefeated,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  defineAbilities,
  discardEncounterUntil,
  encounterSetOf,
  heroAction,
  ifThen,
  moveCards,
  query,
  removeThreat,
  thwart,
  tuckCards,
  tuckedUnderRef,
  varAtLeast,
  yourIdentity,
  aScheme,
  anAttackableEnemy,
} from "../../../dsl/index.js";

/**
 * "A card tucked under Silk from the same encounter set as" the chosen card (docs/phase7-wave9.md section 3.39): the
 * cards under your identity whose encounter sets share one with the card in `slot` (a card of several sets matches on
 * any; a player card tucked there has no set and never matches). RRG 1.8 "Encounter Set", p. 18.
 */
const tuckedOfSetOf = (slot: string) => tuckedUnderRef(yourIdentity, encounterSetOf(chosen(slot)));

/**
 * Wave 9 scripting module `silk/silk/events` (docs/phase7-wave9.md section 8.4, 3.39).
 *
 * Cards (4):
 * - 52002 Smooth as Silk (event)
 * - 52003 Swinging Silk Kick (event)
 * - 52004 Wallcrawl (event)
 * - 52005 Get the Scoop (player_side_scheme)
 *
 * Get the Scoop (52005, a player side scheme with 4 threat) is mapped here by `card-groups.ts` (the spec's build order
 * item 41 names the other module; the map is the one that counts and the card stays in this group).
 *
 * **52005.get-the-scoop-action** (Alter-Ego Action): exhaust your identity, remove 2 threat from here; any player may
 * trigger it (`triggerableBy`), exhausting their own identity.
 * **52005.when-defeated**: "The Cindy Moon player" is read as the scheme's controller (the Silk deck's owner, who
 * played it or had Jameson put it into play), whoever removed the last threat: they look at the top 2 cards of the
 * encounter deck and tuck 1 of them under their identity (the other stays on top). Flagged: the spec says "whoever
 * defeated it".
 *
 * **52002.smooth-as-silk-action** (Hero Action, no label): the chosen enemy or scheme in play is read for its encounter
 * set; the encounter deck is discarded from the top until a card of that set is discarded, and that card is tucked
 * under Silk from the discard pile. Running out of deck first fulfills the effect (RRG 1.8 "Encounter Deck", p. 17):
 * nothing is tucked.
 *
 * **52003.swinging-silk-kick-action** (Hero Action (attack)): "Deal 7 damage to an enemy. You may discard a card
 * tucked under Silk from the same encounter set as that enemy. If you do, this attack deals 2 additional damage and
 * gains overkill." The decision is made after the enemy is chosen and before the attack is declared, because overkill
 * must be on the attack when it starts: 7 without the discard, 9 with overkill with it. The enemy must be one Silk
 * can attack (guard).
 *
 * **52004.wallcrawl-action** (Hero Action (thwart)): the labeled thwart removes 2 threat from a scheme. Then a scheme
 * is chosen (the same one or another); a matching tucked card may be discarded to remove 3 threat from it. That
 * second removal is a plain removal by the event, not a thwart (only the first sentence is the labeled thwart).
 */
export const SILK_EVENTS: AbilityRegistry = defineAbilities({
  "52005.get-the-scoop-action": alterEgoAction(
    { cost: exhaustYourHero, triggerableBy: eachPlayer },
    removeThreat(2, self),
  ),
  "52005.when-defeated": whenDefeated(
    chooseCards("scoop", encounterCards(["deck"], undefined, 2), { min: 1, max: 1 }),
    tuckCards(cards(chosen("scoop")), yourIdentity),
  ),

  "52002.smooth-as-silk-action": heroAction(
    chooseTarget("target", query(["enemy", "scheme"])),
    discardEncounterUntil(query([], encounterSetOf(chosen("target"))), "found"),
    tuckCards(cards(chosen("found")), yourIdentity),
  ),

  "52003.swinging-silk-kick-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    chooseCards("kicker", cards(tuckedOfSetOf("enemy")), { min: 0, max: 1 }),
    moveCards(cards(chosen("kicker")), "discard", "paid"),
    ifThen(varAtLeast("paid.count"), attack(9, chosen("enemy"), { overkill: true }), attack(7, chosen("enemy"))),
  ),

  "52004.wallcrawl-action": heroAction(
    { label: "thwart" },
    aScheme("first"),
    thwart(2, chosen("first")),
    aScheme("second"),
    chooseCards("crawler", cards(tuckedOfSetOf("second")), { min: 0, max: 1 }),
    moveCards(cards(chosen("crawler")), "discard", "paid"),
    ifThen(varAtLeast("paid.count"), removeThreat(3, chosen("second"))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SILK_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
