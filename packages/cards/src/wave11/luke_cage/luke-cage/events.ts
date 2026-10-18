import type { AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  attackAnEnemy,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  dealDamage,
  defineAbilities,
  each,
  giveTough,
  hasStatus,
  heroAction,
  min,
  moveCards,
  option,
  query,
  ready,
  removeStatus,
  repeatTimes,
  scaled,
  self,
  statusCount,
  thwart,
  yourIdentity,
} from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `luke_cage/luke-cage/events` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (4):
 * - 62003 Harlem's Hero (event)
 * - 62004 Knuckle Sandwich (event)
 * - 62005 "Stand with Me!" (event)
 * - 62006 "Sweet Christmas!" (event)
 *
 * **62003.harlems-hero-action**: "Give Luke Cage a tough status card. For each tough status card on Luke Cage, choose a
 * character you control and ready it." The count is read after the tough card is given and fixed as the "for each"
 * starts; each pass is its own choice, so one character may be named twice (RRG 1.8 "'For Each'", p. 20). Luke Cage
 * holding a tough card already still counts it.
 *
 * **62004.knuckle-sandwich-action**: "Deal 3 damage to an enemy. You may discard a tough status card from Luke Cage to
 * return this event to your hand." The option is offered only while Luke Cage holds one.
 *
 * **62005.stand-with-me-action**: "Give Luke Cage a tough status card. Remove 1 threat from a scheme for each tough
 * status card on Luke Cage (to a maximum of 5)." One thwart of that many, read after the tough card is given.
 *
 * **62006.sweet-christmas-constant / -action**: cost reduced by 1 per tough card on Luke Cage (active from the hand,
 * never below 0); "(attack): Deal 5 damage to the villain and each minion engaged with you", all inside the one attack.
 */
export const LUKE_CAGE_LUKE_CAGE_EVENTS: AbilityRegistry = defineAbilities({
  "62003.harlems-hero-action": heroAction(
    giveTough(yourIdentity),
    repeatTimes(
      statusCount("tough", yourIdentity),
      chooseTarget("readied", query(["identity", "ally"], { controller: "you" })),
      ready(chosen("readied")),
    ),
  ),

  "62004.knuckle-sandwich-action": heroAction(
    { label: "attack" },
    attackAnEnemy(3),
    chooseOne(
      option(
        "Discard a tough status card from Luke Cage to return this event to your hand",
        { when: hasStatus(yourIdentity, "tough") },
        removeStatus(yourIdentity, "tough", { count: 1 }),
        moveCards(cards(self), "hand"),
      ),
      option("Do not"),
    ),
  ),

  "62005.stand-with-me-action": heroAction(
    { label: "thwart" },
    giveTough(yourIdentity),
    aScheme("scheme"),
    thwart(min(statusCount("tough", yourIdentity), 5), chosen("scheme")),
  ),

  "62006.sweet-christmas-constant": constant(
    costModifier({
      delta: scaled(statusCount("tough", yourIdentity), { times: -1 }),
      appliesTo: query("event", { self: true }),
      activeIn: "hand",
    }),
  ),
  "62006.sweet-christmas-action": heroAction(
    { label: "attack" },
    dealDamage(5, each(query("villain"))),
    dealDamage(5, each(query("minion", { engagedWith: "you" }))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LUKE_CAGE_LUKE_CAGE_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
