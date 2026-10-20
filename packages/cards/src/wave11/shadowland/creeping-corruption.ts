import type { AbilityRegistry, PlayerRef, TargetRef } from "@mc/engine";
import {
  action,
  addCounters,
  andThen,
  countersOn,
  defeat,
  defineAbilities,
  discardFromHand,
  draw,
  each,
  exhaustThis,
  exists,
  flipCard,
  inPlayAreaOf,
  placeCountersCost,
  query,
  removeEachCounterFrom,
  removeCountersFrom,
  self,
  stateCheckFromEntering,
  valueAtLeast,
  yourIdentity,
  you,
} from "../../dsl/index.js";

/**
 * The counter type of a "corruption counter". M2 (docs/phase7-shadowland.md section 6, rules expert 2026-10-20):
 * corruption counters are all-purpose counters (RRG 1.8 "All-Purpose Counter", p. 6) that stay on Creeping Corruption
 * through its flip. The cards of this pack define no counter type in their data, so every script names the one type
 * `corruption` and reads and removes that same type, which keeps the count in one place.
 */
export const CORRUPTION = "corruption";

/** "Creeping Corruption" in the play area of `player`: the Setup upgrade (72A) or its overpowering face (72B). */
export const creepingCorruptionOf = (player: PlayerRef): TargetRef =>
  each(query("upgrade", { name: "Creeping Corruption", ...inPlayAreaOf(player) }));

/** "Your Creeping Corruption": the upgrade in the play area of the player the ability speaks to. */
export const YOUR_CREEPING_CORRUPTION: TargetRef = creepingCorruptionOf(you);

/** Whether `player` has a Creeping Corruption to place counters on ("you" by default). */
export const hasCreepingCorruption = (player: PlayerRef = you) =>
  exists(query("upgrade", { name: "Creeping Corruption", ...inPlayAreaOf(player) }));

/** Whether "you" have a Creeping Corruption to place counters on. */
export const youHaveCreepingCorruption = hasCreepingCorruption();

/** Whether "you" have a Creeping Corruption holding at least one corruption counter to remove. */
export const youHaveCorruptionToRemove = exists(
  query("upgrade", { name: "Creeping Corruption", ...inPlayAreaOf(you), hasCounter: CORRUPTION }),
);

/** "Place N corruption counters on your Creeping Corruption." */
export const placeCorruption = (n = 1, player: PlayerRef = you) =>
  addCounters(CORRUPTION, n, creepingCorruptionOf(player));

/** "Remove N corruption counter(s) from your Creeping Corruption." */
export const removeCorruption = (n = 1, player: PlayerRef = you) =>
  removeCountersFrom(creepingCorruptionOf(player), CORRUPTION, n);

const FIVE_HERE = valueAtLeast(countersOn(self, CORRUPTION), 5);

/**
 * Creeping Corruption (Black Flower, MC65 pp. 9, 14, 17; docs/phase7-shadowland.md M2). A double-sided upgrade, 72A on
 * its Setup side and 72B (OVERPOWERING) once flipped; the campaign instructions put one 72A into play under each
 * player's control.
 *
 * **72A** "If there are at least 5 corruption counters here, remove each of them from here and flip this card." A
 *   standing condition (`stateCheckFromEntering`, RRG 1.8 "Ability", p. 4): it also resolves the moment the card is in
 *   play with five already on it. The removal is first, so 72B begins with none (this is why the counters "survive the
 *   flip" only as far as the card's own text lets them).
 * **72A** "Action: Exhaust Creeping Corruption and place 1 corruption counter here -> draw 1 card." Both parts are the
 *   cost: the counter is placed even when it brings the card to five, and the draw still resolves.
 * **72B** "If there are at least 5 corruption counters here, you are defeated." The controller's hero is defeated
 *   (`defeat`: an identity's player is eliminated), the printed "you" being the card's controller.
 * **72B** "Action: Exhaust Creeping Corruption and place 1 corruption counter here -> draw 2 cards, then discard 1
 *   card from your hand." The discard is after the draw ("then", RRG 1.8 p. 44).
 *
 * Permanent, Setup, "Max 1 per player" and the OVERPOWERING trait are data.
 *
 * Cards (1, two faces):
 * - 65072a Creeping Corruption (upgrade)
 */
export const SHADOWLAND_CREEPING_CORRUPTION: AbilityRegistry = defineAbilities({
  "65072a.creeping-corruption-constant": stateCheckFromEntering(
    FIVE_HERE,
    removeEachCounterFrom(self, CORRUPTION),
    flipCard(self),
  ),
  "65072a.creeping-corruption-action": action({ cost: [exhaustThis, placeCountersCost(CORRUPTION, 1)] }, draw(1)),
  "65072b.creeping-corruption-constant": stateCheckFromEntering(FIVE_HERE, defeat(yourIdentity)),
  "65072b.creeping-corruption-action": action(
    { cost: [exhaustThis, placeCountersCost(CORRUPTION, 1)] },
    draw(2),
    andThen(discardFromHand(1)),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_CREEPING_CORRUPTION_SKIPPED: Readonly<Record<string, string>> = {};
