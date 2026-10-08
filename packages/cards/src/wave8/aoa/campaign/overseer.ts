import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `overseer` (campaign mode only; docs/phase7-wave8.md §1.25, §3.36, §3.38, §3.41). The
 * five Overseer faces; their Prelate faces are `../prelates.ts`.
 *
 * **Nothing here is registered.** Every printed line of every face names the mission: "Cannot take damage while
 * another minion is at the mission" (all five), the pairing limit of Mister Sinister (task 37), and the four Mission
 * Responses ("after you discard cards" during a mission attempt, then threat on the [MISSION] side scheme, a heal, a
 * facedown attach or damage to an ally at the mission). The engine has no mission area or mission attempt yet (spec
 * section 8.2, tasks 31 to 38), so there is nothing a faithful script could be written against, and the DSL has no
 * way to type even a draft of "at the mission". See `OVERSEER_SKIPPED`.
 *
 * Mission Response parses as a forced response in the card data (section 1.25); when the area lands each is
 * `forcedResponse(on.cardDiscardedFromDeck(...))` limited to the discards of the attempt (section 3.38).
 *
 * Cards (5):
 * - 45179a Mister Sinister (minion)
 * - 45180a The Shadow King (minion)
 * - 45181a Abyss (minion)
 * - 45182a Sugar Man (minion)
 * - 45183a Mikhail Rasputin (minion)
 */
export const OVERSEER: AbilityRegistry = defineAbilities({});

const SHIELD =
  "'Cannot take damage while another minion is at the mission' needs the mission area and its closed filter (tasks 31 and 32, section 3.33)";
const RESPONSE =
  "a Mission Response answers only the deck discard of a mission attempt, which needs the mission area, the attempt and the pairing (tasks 31 to 33 and 37, sections 3.33, 3.36, 3.38)";

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. */
export const OVERSEER_SKIPPED: Readonly<Record<string, string>> = {
  "45179a.mister-sinister-constant": SHIELD,
  "45179a.mister-sinister-constant-2":
    "'cannot assign cards with the same resource icon to more than one ally each mission attempt' is the pairing limit `pairLimit` (task 37, section 3.36), over allies in the mission area (task 31)",
  "45180a.the-shadow-king-constant": SHIELD,
  "45180a.the-shadow-king-forced-response": `${RESPONSE}; also places threat on the [MISSION] side scheme (task 32)`,
  "45181a.abyss-constant": SHIELD,
  "45181a.abyss-forced-response": `${RESPONSE}; attaches each discarded [wild] card to Abyss facedown (the discard half exists, section 3.38)`,
  "45182a.sugar-man-constant": SHIELD,
  "45182a.sugar-man-forced-response": RESPONSE,
  "45183a.mikhail-rasputin-constant": SHIELD,
  "45183a.mikhail-rasputin-forced-response": `${RESPONSE}; the damage goes to an ally at the mission (task 32)`,
};
