import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  afterNextCardPlayed,
  anEnemy,
  ANY_NUMBER,
  aScheme,
  bindTargets,
  chooseCards,
  chooseOne,
  chosen,
  cards,
  countOf,
  dealDamage,
  defineAbilities,
  discardCardsCost,
  each,
  eventTarget,
  heroAction,
  on,
  option,
  printedCostOf,
  query,
  ready,
  removeThreat,
  repeatTimes,
  response,
  valueAtLeast,
  you,
} from "../../../dsl/index.js";
import { SHIELD_SUPPORTS } from "./identity.js";

const SHIELD = trait("S.H.I.E.L.D.");

/** Exhausted S.H.I.E.L.D. supports, whoever controls them (the cards do not say "you control"). */
const EXHAUSTED_SHIELD_SUPPORTS = query("support", { trait: SHIELD, exhausted: true });

/**
 * Wave 9 scripting module `aos/maria-hill/events` (docs/phase7-wave9.md section 8.4, 3.6, 3.11).
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **50003.all-points-bulletin-action**: "Hero Action: For each S.H.I.E.L.D. support you control, choose: Remove 1
 * threat from a scheme. Deal 1 damage to an enemy." One choice per support, counted once as the event resolves, each
 * its own instance of 1 threat or 1 damage. Nothing makes the choices differ: MC50 p. 22, "Q. How many schemes or
 * enemies can be chosen as targets for All-Points Bulletin? A. You can choose a different scheme or enemy to target for
 * each S.H.I.E.L.D. support you control", gives a permission, and RRG 1.8 "'For Each'" (p. 20) says "each iteration of
 * that choice is considered a separate instance of that effect, even if the same target is chosen multiple times". So
 * the same enemy or scheme may be chosen every time. With no S.H.I.E.L.D. support it resolves to nothing.
 *
 * **50004.on-the-double-action**: "Action: Ready any number of S.H.I.E.L.D. supports with a combined printed cost of 6
 * or less." Any player's supports. Section 3.11: it cannot be played while no S.H.I.E.L.D. support is exhausted
 * (nothing would change), so the action carries that as its `while` gate. Only exhausted supports are offered, which
 * changes nothing a ready one could (readying a ready card does nothing).
 *
 * **50005.reinforcements-action**: "Action: Choose any number of S.H.I.E.L.D. supports with a combined printed cost of
 * 6 or less. Place 1 all-purpose counter on each of those supports." Zero picks is legal ("any number"). Each counter
 * takes the type its support defines (RRG 1.8 "All-Purpose Counter", p. 6; MC50 p. 4).
 *
 * **50006.the-hard-call-action**: "Hero Action: Discard a S.H.I.E.L.D. support you control -> deal X damage to each
 * enemy, where X is the printed cost of the discarded support." The discard is the cost, so the event cannot be played
 * without one, and X is read off the discarded card's printed cost (RRG 1.8 "Printed", p. 35).
 *
 * **50007.special-funding-response**: "Response: After you spend this card to pay for a S.H.I.E.L.D. support, place 1
 * all-purpose counter on that support after it enters play." The response fires while the support is still being paid
 * for, so it binds that support and defers the counter to the end of that play (the `afterNextCardPlayed` timing point
 * is after the card has entered play).
 *
 * Cards (5):
 * - 50003 All-Points Bulletin (event)
 * - 50004 On the Double (event)
 * - 50005 Reinforcements (event)
 * - 50006 The Hard Call (event)
 * - 50007 Special Funding (resource)
 */
export const MARIA_HILL_EVENTS: AbilityRegistry = defineAbilities({
  "50003.all-points-bulletin-action": heroAction(
    repeatTimes(
      countOf(query("support", { trait: SHIELD, controller: "you" })),
      chooseOne(
        option("Remove 1 threat from a scheme", aScheme(), removeThreat(1, chosen("scheme"))),
        option("Deal 1 damage to an enemy", anEnemy(), dealDamage(1, chosen("enemy"))),
      ),
    ),
  ),

  "50004.on-the-double-action": action(
    { while: valueAtLeast(countOf(EXHAUSTED_SHIELD_SUPPORTS), 1) },
    chooseCards("readied", cards(each(EXHAUSTED_SHIELD_SUPPORTS)), {
      min: 0,
      max: ANY_NUMBER,
      maxTotalPrintedCost: 6,
    }),
    ready(chosen("readied")),
  ),

  "50005.reinforcements-action": action(
    chooseCards("reinforced", cards(each(SHIELD_SUPPORTS)), { min: 0, max: ANY_NUMBER, maxTotalPrintedCost: 6 }),
    addCounters("allPurpose", 1, chosen("reinforced")),
  ),

  "50006.the-hard-call-action": heroAction(
    { cost: discardCardsCost(query("support", { trait: SHIELD, controller: "you" })) },
    dealDamage(printedCostOf(chosen("discarded")), each(query("enemy"))),
  ),

  "50007.special-funding-response": response(
    on.youSpendThis({ toPlay: SHIELD_SUPPORTS }),
    bindTargets("funded", eventTarget),
    afterNextCardPlayed(you, SHIELD_SUPPORTS, addCounters("allPurpose", 1, chosen("funded"))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
