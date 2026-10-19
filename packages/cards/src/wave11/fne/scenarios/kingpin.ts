import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Kingpin scenario (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (17):
 * - 60159a Kingpin (villain)
 * - 60160a Kingpin (villain)
 * - 60161a The King's Gambit (main_scheme)
 * - 60163a Public Support (environment)
 * - 60164 Bear Hug (attachment)
 * - 60165 James Wesley (attachment)
 * - 60166 Kingpin's Cane (attachment)
 * - 60167 Mountain of Muscle (attachment)
 * - 60168 Vanessa Fisk (attachment)
 * - 60169 Black Cat (minion)
 * - 60170 Diamondback (minion)
 * - 60171 Spot (minion)
 * - 60172 Stilt-Man (minion)
 * - 60173 Kingpin's Influence (side_scheme)
 * - 60174 Organized Crime (side_scheme)
 * - 60175 Bag of Tricks (treachery)
 * - 60176 Unrelenting Hate (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_SCENARIOS_KINGPIN: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_SCENARIOS_KINGPIN_SKIPPED: Readonly<Record<string, string>> = {
  "60159a.kingpin-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60159a.kingpin-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60159b.kingpin-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60160a.kingpin-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60160a.kingpin-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60160b.kingpin-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60161a.setup": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60161b.when-revealed": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60161b.the-kings-gambit-action": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60162a.when-revealed": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60162b.endgame-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60163a.public-support-forced-response": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60163a.public-support-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60163b.public-support-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60163b.public-support-forced-response": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60164.bear-hug-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60164.bear-hug-constant-2": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60164.bear-hug-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60165.when-revealed": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60165.james-wesley-action": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60165.boost": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60166.when-revealed": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60166.kingpins-cane-forced-response": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60166.boost": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60167.mountain-of-muscle-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60167.mountain-of-muscle-constant-2": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60167.mountain-of-muscle-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60168.when-revealed": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60168.vanessa-fisk-action": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60168.boost": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60169.black-cat-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60169.black-cat-action": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60170.diamondback-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60170.boost": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60171.spot-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60171.spot-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60172.stilt-man-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60172.stilt-man-constant-2": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60172.stilt-man-forced-interrupt": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60173.when-defeated": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60174.organized-crime-constant": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60175.when-revealed": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60175.boost": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60176.when-revealed": "wave 11 scripting in progress: fne/scenarios/kingpin",
  "60176.boost": "wave 11 scripting in progress: fne/scenarios/kingpin",
};
