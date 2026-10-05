import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  allOf,
  attackAnEnemy,
  changeForm,
  chooseCards,
  chooseOneBy,
  chosen,
  cards,
  defineAbilities,
  encounterCards,
  forEachPlayer,
  heroAction,
  inForm,
  isAlterEgo,
  isHero,
  moveCards,
  not,
  option,
  otherPlayers,
  query,
  reorderCards,
  scaled,
  selectCards,
  thatPlayer,
  thwartAScheme,
  victoryDisplayCount,
} from "../../../dsl/index.js";

/** "each side scheme in the victory display": player and encounter side schemes both count (docs/phase7-wave7.md §3.49). */
const SIDE_SCHEMES_IN_VICTORY_DISPLAY = victoryDisplayCount(query("sideScheme"));

/**
 * Cable's hero events (40002-40005), docs/phase7-wave7.md §7.1 and the §3.61 rows.
 *
 * - **Bodyslide (40002), Action**: change form, then each other player may change to the form Cable is now in. The
 *   change is an effect, not the once-per-round change (RRG "Form, Change Form", p. 21). A player already in that
 *   form is not asked.
 * - **Mind Scan (40003), Hero Action (thwart)**: remove 3 threat from a scheme, +1 per side scheme in the victory
 *   display. It is a thwart by Cable, so "after Cable defeats a scheme" hears it (RRG "You, Your", p. 49).
 * - **Precognition (40004), Hero Action**: look at the top X cards of the encounter deck (X = side schemes in the
 *   victory display), may discard 1, put the rest back in any order. X = 0 looks at nothing.
 * - **Telekinetic Blast (40005), Hero Action (attack)**: 6 damage to an enemy, +1 per side scheme in the victory
 *   display. An attack, so it needs an enemy Cable may attack (Guard) and Retaliate / Toughness apply.
 */
export const CABLE_EVENTS: AbilityRegistry = defineAbilities({
  "40002.bodyslide-action": action(
    changeForm(),
    forEachPlayer(
      otherPlayers(),
      chooseOneBy(
        thatPlayer,
        option(
          "Change to hero form",
          { when: allOf(isHero(), not(inForm("hero", thatPlayer))) },
          changeForm(thatPlayer, "hero"),
        ),
        option(
          "Change to alter-ego form",
          { when: allOf(isAlterEgo(), not(inForm("alterEgo", thatPlayer))) },
          changeForm(thatPlayer, "alterEgo"),
        ),
        option("Do not change form"),
      ),
    ),
  ),

  "40003.mind-scan-action": heroAction(
    { label: "thwart" },
    thwartAScheme(scaled(SIDE_SCHEMES_IN_VICTORY_DISPLAY, { plus: 3 })),
  ),

  "40004.precognition-action": heroAction(
    selectCards("looked", encounterCards(["deck"], undefined, SIDE_SCHEMES_IN_VICTORY_DISPLAY)),
    chooseCards("discarded", cards(chosen("looked")), { min: 0, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
    reorderCards(cards(chosen("looked"), { excludeSlots: ["discarded"] })),
  ),

  "40005.telekinetic-blast-action": heroAction(
    { label: "attack" },
    attackAnEnemy(scaled(SIDE_SCHEMES_IN_VICTORY_DISPLAY, { plus: 6 })),
  ),
});
