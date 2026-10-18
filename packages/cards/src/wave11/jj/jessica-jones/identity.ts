import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  addCounters,
  alterEgoAction,
  andThen,
  cannotChangeFormUntil,
  changeForm,
  chooseOne,
  countersOn,
  defeat,
  defineAbilities,
  exhaustThis,
  heroResponse,
  named,
  on,
  option,
  putIntoPlayFromSetAside,
  query,
  remainingHpOf,
  removeCountersFrom,
  response,
  self,
  setup,
  theVillain,
  valueAtLeast,
} from "../../../dsl/index.js";

const ALIAS = named("Alias Investigations");

/**
 * Wave 11 scripting module `jj/jessica-jones/identity` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (2):
 * - 61001a Jessica Jones (hero_identity)
 * - 61002 Alias Investigations (support)
 *
 * The identity's other face is 61001b Jessica Jones (alter ego).
 *
 * **61001a.star-gather-evidence** (hero face): "Response: After you use a basic power, place 1 evidence counter on
 * Alias Investigations." Hero form only, so a basic thwart, attack or defense (a basic recover is an alter-ego power and
 * the other face prints no such response). With Alias Investigations out of play nothing is placed.
 *
 * **61001b.incognito-mode** (alter-ego face): "Action: Change to hero form. You cannot change back to alter-ego form
 * this phase." The change comes first, then the restriction (it forbids any change of form for the phase; she is in
 * hero form, so only the way back is closed).
 *
 * **61001b.setup**: "Setup: Put the Alias Investigations support into play." Permanent, so it was set aside before
 * setup step 1 (RRG 1.8 "Permanent", p. 32) and is taken from there.
 *
 * **61002.alias-investigations-response**: "Response: After a side scheme is defeated, exhaust this card -> place 2
 * evidence counters here. Then, you may remove evidence counters from here equal to the villain's remaining hit points
 * to defeat the villain's current stage." Any side scheme, encounter or player, defeated by anyone. The removal is
 * offered only with at least as many counters as the villain has hit points left, and defeats the stage as an effect
 * (RRG 1.8 "Villain Defeat", p. 47); the "Then" ties it to the counters having been placed (RRG 1.8 "'Then'", p. 44).
 */
export const JJ_JESSICA_JONES_IDENTITY: AbilityRegistry = defineAbilities({
  "61001a.star-gather-evidence": heroResponse(after.basicPowerUsed("self"), addCounters("evidence", 1, ALIAS)),

  "61001b.incognito-mode": alterEgoAction(changeForm(), cannotChangeFormUntil("endOfPhase")),
  "61001b.setup": setup(putIntoPlayFromSetAside("alias", query("support", { name: "Alias Investigations" }))),

  "61002.alias-investigations-response": response(
    on.schemeDefeated(query("sideScheme")),
    { cost: exhaustThis },
    addCounters("evidence", 2, self),
    andThen(
      chooseOne(
        option(
          "Remove evidence counters equal to the villain's remaining hit points to defeat its current stage",
          { when: valueAtLeast(countersOn(self, "evidence"), remainingHpOf(theVillain)) },
          removeCountersFrom(self, "evidence", remainingHpOf(theVillain)),
          defeat(theVillain),
        ),
        option("Do not defeat the villain's stage"),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const JJ_JESSICA_JONES_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
