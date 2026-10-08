import type { AbilityRegistry, EffectSpec, EventPattern, TargetQuery } from "@mc/engine";
import {
  attachCard,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  eventPlayer,
  eventTarget,
  exists,
  forcedResponse,
  heal,
  ifThen,
  pairLimit,
  placeThreat,
  query,
  reaching,
  rule,
  scaled,
  self,
  totalPrintedResources,
  valueAtLeast,
} from "../../../dsl/index.js";
import { ALLY_AT_THE_MISSION, AT_THE_MISSION, MISSION_AREA, MISSION_TEAM, theMission } from "./mission-rules.js";

/**
 * Campaign-only encounter set `overseer` (campaign mode only; docs/phase7-wave8.md §1.25, §3.36, §3.38, §3.41). The
 * five Overseer faces; their Prelate faces are `../prelates.ts`.
 *
 * "Cannot take damage while another minion is at the mission" on all five. The rule is about the card itself, and a
 * card is never closed to its own abilities (§3.33); "another minion … at the mission" is a query that names the area
 * and leaves this card out. In practice the other minion is an Agent of Apocalypse added to the area.
 *
 * Mister Sinister (45179a): "Players cannot assign cards with the same resource icon … to more than one ally each
 *   mission attempt" is the pairing limit of the mission area (`pairLimit`, §3.36), in force while he is in play.
 *
 * The four Mission Responses (MC45 p. 5: "a new type of Forced Response that only resolves after a player discards
 * cards from the top of their deck during a mission attempt"; it parses as a forced response, §1.25). Each answers
 * `cardDiscardedFromDeck` for the discards whose source is Mission Team, the card making the attempt, so no other
 * discard from a deck is heard (Famine's ten cards, a hero's own). It resolves once for each discarded card that
 * shows the icon it names, reading that card's printed icons, and the per-card results add up to the printed "for
 * each … discarded". A forced response, it resolves before the discarded card's own Response (RRG 1.8 "Forced",
 * p. 20), which is how Abyss takes a [wild] card before its "add it to your hand" can be used. "You" is the player
 * whose deck it is (`eventPlayer`): an Overseer has no controller.
 *
 * The Shadow King (45180a): 2 threat on the [MISSION] side scheme for each [mental] icon.
 * Abyss (45181a): the discarded card is attached to him facedown, out of play and blank, and is no longer one of the
 *   cards the attempt assigns (`settleDeckDiscards`). His a face prints no "+2 hit points" line.
 * Sugar Man (45182a): heal 3 damage from him for each [physical] icon.
 * Mikhail Rasputin (45183a): 1 damage to an ally at the mission for each [energy] icon, each its own choice by the
 *   player who discarded. X was counted when the cards were discarded, so an ally defeated here is not recounted.
 *
 * Cards (5):
 * - 45179a Mister Sinister (minion)
 * - 45180a The Shadow King (minion)
 * - 45181a Abyss (minion)
 * - 45182a Sugar Man (minion)
 * - 45183a Mikhail Rasputin (minion)
 */
type Icon = "physical" | "mental" | "energy" | "wild";
/** "After you discard cards" during a mission attempt: one card of the attempt's discard that prints `icon`. */
const missionDiscardOf = (icon: Icon): EventPattern => ({
  on: "cardDiscardedFromDeck",
  sourceIs: MISSION_TEAM,
  targetIs: { anyPrintedResource: [icon] } satisfies TargetQuery,
});
/** The discarded card's printed icons of one type. */
const iconsOf = (icon: Icon) => totalPrintedResources(eventTarget, [icon]);
const missionResponse = (icon: Icon, ...effects: readonly EffectSpec[]) =>
  reaching(MISSION_AREA, forcedResponse(missionDiscardOf(icon), ...effects));
/** "Deal 1 damage to an ally at the mission": the discarding player chooses; with none there, nothing. */
const oneDamageToAnAllyAtTheMission = (slot: string): readonly EffectSpec[] => [
  chooseTarget(slot, ALLY_AT_THE_MISSION, { chooser: eventPlayer }),
  dealDamage(1, chosen(slot)),
];

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
  // Players cannot assign cards with the same resource icon ([energy], [mental], [physical], or [wild]) to more than
  // one ally each mission attempt.
  "45179a.mister-sinister-constant-2": constant(pairLimit(MISSION_AREA)),

  "45180a.the-shadow-king-constant": shielded(),
  // Mission Response: After you discard cards, place 2 threat on the [MISSION] side scheme for each mental resource
  // ([mental]) discarded.
  "45180a.the-shadow-king-forced-response": missionResponse(
    "mental",
    placeThreat(scaled(iconsOf("mental"), { times: 2 }), theMission),
  ),

  "45181a.abyss-constant": shielded(),
  // Mission Response: After you discard cards, attach each card with a wild resource ([wild]) discarded to Abyss
  // facedown. (They cannot be used for the mission attempt.)
  "45181a.abyss-forced-response": missionResponse("wild", attachCard(eventTarget, self, { facedown: true })),

  "45182a.sugar-man-constant": shielded(),
  // Mission Response: After you discard cards, heal 3 damage from Sugar Man for each physical resource ([physical])
  // discarded.
  "45182a.sugar-man-forced-response": missionResponse(
    "physical",
    heal(scaled(iconsOf("physical"), { times: 3 }), self),
  ),

  "45183a.mikhail-rasputin-constant": shielded(),
  // Mission Response: After you discard cards, deal 1 damage to an ally at the mission for each energy resource
  // ([energy]) discarded. No player card prints more than three icons of one type.
  "45183a.mikhail-rasputin-forced-response": missionResponse(
    "energy",
    ...oneDamageToAnAllyAtTheMission("first"),
    ifThen(valueAtLeast(iconsOf("energy"), 2), oneDamageToAnAllyAtTheMission("second")),
    ifThen(valueAtLeast(iconsOf("energy"), 3), oneDamageToAnAllyAtTheMission("third")),
  ),
});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. Empty: all five are scripted. */
export const OVERSEER_SKIPPED: Readonly<Record<string, string>> = {};
