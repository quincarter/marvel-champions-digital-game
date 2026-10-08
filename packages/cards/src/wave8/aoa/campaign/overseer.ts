import type { AbilityRegistry } from "@mc/engine";
import { constant, defineAbilities, exists, query, rule } from "../../../dsl/index.js";
import { AT_THE_MISSION } from "./mission-rules.js";

/**
 * Campaign-only encounter set `overseer` (campaign mode only; docs/phase7-wave8.md §1.25, §3.36, §3.38, §3.41). The
 * five Overseer faces; their Prelate faces are `../prelates.ts`.
 *
 * Registered: "Cannot take damage while another minion is at the mission" on all five. The rule is about the card
 * itself, and a card is never closed to its own abilities (§3.33); "another minion … at the mission" is a query that
 * names the area and leaves this card out. In practice the other minion is an Agent of Apocalypse added to the area.
 *
 * Skipped, see `OVERSEER_SKIPPED`: Mister Sinister's pairing limit and the four Mission Responses, which answer only
 * the deck discard of a mission attempt (the attempt and its pairing are tasks 37 and 38). Mission Response parses as
 * a forced response in the card data (section 1.25); when the attempt lands each is
 * `forcedResponse(on.cardDiscardedFromDeck(...))` limited to the discards of the attempt (section 3.38).
 *
 * Cards (5):
 * - 45179a Mister Sinister (minion)
 * - 45180a The Shadow King (minion)
 * - 45181a Abyss (minion)
 * - 45182a Sugar Man (minion)
 * - 45183a Mikhail Rasputin (minion)
 */
/** "Cannot take damage while another minion is at the mission." */
const shielded = () =>
  constant(
    rule({
      kind: "cannotTakeDamage",
      target: query("minion", { self: true }),
      while: exists(query("minion", { ...AT_THE_MISSION, self: false })),
    }),
  );

export const OVERSEER: AbilityRegistry = defineAbilities({
  "45179a.mister-sinister-constant": shielded(),
  "45180a.the-shadow-king-constant": shielded(),
  "45181a.abyss-constant": shielded(),
  "45182a.sugar-man-constant": shielded(),
  "45183a.mikhail-rasputin-constant": shielded(),
});

const RESPONSE =
  "a Mission Response answers only the deck discard of a mission attempt, which needs the attempt and its pairing (tasks 37 and 38, sections 3.36 to 3.38)";

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. */
export const OVERSEER_SKIPPED: Readonly<Record<string, string>> = {
  "45179a.mister-sinister-constant-2":
    "'cannot assign cards with the same resource icon to more than one ally each mission attempt' is the pairing limit `pairLimit` (task 37, section 3.36)",
  "45180a.the-shadow-king-forced-response": RESPONSE,
  "45181a.abyss-forced-response": `${RESPONSE}; attaches each discarded [wild] card to Abyss facedown (the discard half exists, section 3.38)`,
  "45182a.sugar-man-forced-response": RESPONSE,
  "45183a.mikhail-rasputin-forced-response": RESPONSE,
};
