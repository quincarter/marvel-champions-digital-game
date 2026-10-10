import type { AbilityRegistry, Predicate } from "@mc/engine";
import {
  aScheme,
  anAttackableEnemy,
  allOf,
  attack,
  boostAreaIconsOn,
  chooseOne,
  chosen,
  defineAbilities,
  discardEncounterCards,
  draw,
  encounterCards,
  anyOfCards,
  cards,
  eventTarget,
  heroAction,
  heroResponse,
  lookAtAndRearrange,
  on,
  option,
  printedBoostAreaIconsOn,
  sum,
  thwart,
} from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `falcon/falcon/events` (docs/phase7-wave9.md section 8.4, 3.42 to 3.44). `card-groups.ts` maps
 * this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 53003 Bird of Prey (event)
 * - 53004 Bird's-Eye View (event)
 * - 53005 Up, Up, and Away (event)
 *
 * **53003.bird-of-prey-action** (Hero Action, attack): "Deal 4 damage to an enemy. You may discard the top card of the
 * encounter deck to deal 1 additional damage to that enemy for each icon (star and boost) in the discarded card's boost
 * area." One attack: the enemy is chosen (guard applies, the damage is an attack), then a `chooseOne` between the
 * discard (the attack is 4 plus the discarded card's boost icons and star, the top card read where it now is) and
 * declining (4). The discard happens before the damage because the damage is one instance of 4 + X, not two hits. The
 * star counts as one icon, as printed (RRG "Star Icon", p. 40); an amplify icon adds nothing (it applies only to a boost
 * card turned faceup in an enemy activation, RRG p. 7).
 *
 * **53004.birds-eye-view-action** (Hero Action, thwart): the same shape with "Remove 3 threat from a scheme" as a thwart
 * (confused and crisis apply) and the additional threat removed from that same scheme.
 *
 * **Q6 (docs/phase7-wave9.md section 4.1 row 6; OWNER QUESTION OPEN).** When the top card is faceup (Falcon's player
 * phase) and prints no icon at all, is "you may discard the top card" still offered? The owner answered B (offered, for 0
 * additional); an official ruling points to A. Ruling January 26, 2026 - Ruling 6 (1) (marvel-champions-rulings-post-rrg-1-7.md):
 * "If there are no boost icons on the top card of the encounter deck, Redwing's ability has no effect and cannot be
 * initiated." Scripted as B for now; the choice lives in ONE place, `DISCARD_OPTION_OFFERED_WHEN` below, used by both
 * cards. To flip to A, change it to `not(topOfEncounterDeckShowsNoIcons)` (import it from the DSL) and flip the tests
 * named "Q6" in events.test.ts.
 *
 * **53005.up-up-and-away-response** (Hero Response, defense): "After an attacking enemy is given a facedown boost card,
 * look at that card and the top card of the encounter deck. You may swap those cards. Draw 1 card for each printed icon
 * (star and boost) in the (current) boost card's boost area." `on.boostCardGiven({ activation: "attack" })` (a scheme's
 * boost card does not answer); the look is the acting player's only, `bindAt: ["boost", "top"]` names each position so
 * the draw reads whichever card is the boost card after the optional swap, by its printed icons (no amplify, no
 * modifier). The (defense) label makes the hero the attack's defender at the give-boost step; the declare-defender step
 * still offers a basic defense. Owner question 34 = A: two copies may each answer the same boost card.
 */

/**
 * Q6: the condition on the "you may discard the top card" option of Bird of Prey and Bird's-Eye View. B (current): always
 * offered, an empty `allOf()` that holds. A: `not(topOfEncounterDeckShowsNoIcons)`.
 */
export const DISCARD_OPTION_OFFERED_WHEN: Predicate = allOf();

export const FALCON_EVENTS: AbilityRegistry = defineAbilities({
  "53003.bird-of-prey-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    chooseOne(
      option(
        "Discard the top card of the encounter deck",
        { when: DISCARD_OPTION_OFFERED_WHEN },
        discardEncounterCards(1, { bind: "top" }),
        attack(sum(4, boostAreaIconsOn(chosen("top"))), chosen("enemy")),
      ),
      option("Do not discard", attack(4, chosen("enemy"))),
    ),
  ),

  "53004.birds-eye-view-action": heroAction(
    { label: "thwart" },
    aScheme(),
    chooseOne(
      option(
        "Discard the top card of the encounter deck",
        { when: DISCARD_OPTION_OFFERED_WHEN },
        discardEncounterCards(1, { bind: "top" }),
        thwart(sum(3, boostAreaIconsOn(chosen("top"))), chosen("scheme")),
      ),
      option("Do not discard", thwart(3, chosen("scheme"))),
    ),
  ),

  "53005.up-up-and-away-response": heroResponse(
    on.boostCardGiven({ activation: "attack" }),
    { label: "defense" },
    lookAtAndRearrange(anyOfCards(cards(eventTarget), encounterCards(["deck"], undefined, 1)), {
      bindAt: ["boost", "top"],
    }),
    draw(printedBoostAreaIconsOn(chosen("boost"))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FALCON_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
