import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  dealDamage,
  defineAbilities,
  enemyActivates,
  modifyAttack,
  option,
  placeThreat,
  putIntoPlay,
  self,
  surge,
  takeDamage,
  whenRevealed,
  you,
} from "../../../dsl/index.js";
import { ALLY_AT_THE_MISSION, INTO_THE_MISSION, missionInPlay, theMission } from "./mission-rules.js";

/**
 * Campaign-only encounter set `age_of_apocalypse` (campaign mode only; docs/phase7-wave8.md §1.28, §3.33, §3.41).
 *
 * Both cards refer to the mission by name, so their queries reach into the closed mission area
 * (`inScenarioPlayArea`, through `mission-rules.ts`). Each first option needs a [MISSION] side scheme in play: with
 * the mission finished, or in a game with no mission, only the second can be chosen (§3.41).
 *
 * Agent of Apocalypse (45164): a revealed minion engages the player as any does (RRG 1.8 "Reveal", p. 38), then its
 *   When Revealed resolves. "Add … to the mission area" moves it there from play: not engaged, under no player's
 *   control, and it never activates (RRG 1.8 "Activation", p. 6). Guard is data and reads minions engaged with a player
 *   (RRG p. 21), so it does nothing at the mission. "Or it activates against you" is an ordinary activation.
 *   The Boost's "an ally at the mission" is chosen by the player resolving the boost ("you": the player the
 *   activation is against); with none there, nothing is dealt. "Give the activating enemy an additional boost card"
 *   is its own sentence and happens either way.
 * Worldwide Crisis (45165): "take 1 damage" is the player's identity.
 *
 * Cards (2):
 * - 45164 Agent of Apocalypse (minion)
 * - 45165 Worldwide Crisis (treachery)
 */
export const AGE_OF_APOCALYPSE: AbilityRegistry = defineAbilities({
  // When Revealed: Choose: Either add Agent of Apocalypse to the mission area, or it activates against you.
  "45164.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Add Agent of Apocalypse to the mission area",
        { when: missionInPlay },
        putIntoPlay(self, you, { into: INTO_THE_MISSION }),
      ),
      option("Agent of Apocalypse activates against you", enemyActivates(self, { against: you })),
    ),
  ),
  // [star] Boost: Deal 1 damage to an ally at the mission. Give the activating enemy an additional boost card.
  "45164.boost": boost(
    chooseTarget("ally", ALLY_AT_THE_MISSION),
    dealDamage(1, chosen("ally")),
    modifyAttack({ extraBoostCards: 1 }),
  ),

  // When Revealed: Choose: Either place 3 threat on the [MISSION] side scheme, or take 1 damage and this card gains
  // surge.
  "45165.when-revealed": whenRevealed(
    chooseOne(
      option("Place 3 threat on the [MISSION] side scheme", { when: missionInPlay }, placeThreat(3, theMission)),
      option("Take 1 damage and this card gains surge", takeDamage(1), surge()),
    ),
  ),
  // [star] Boost: Place 1 threat on the [MISSION] side scheme. Give the activating enemy an additional boost card.
  "45165.boost": boost(placeThreat(1, theMission), modifyAttack({ extraBoostCards: 1 })),
});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. Empty: both are scripted. */
export const AGE_OF_APOCALYPSE_SKIPPED: Readonly<Record<string, string>> = {};
