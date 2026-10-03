import { trait } from "@mc/content";
import {
  action,
  addCounters,
  encounterLookDiscardCost,
  exhaustThis,
  boostIconsOn,
  chosen,
  defineAbilities,
  eventTarget,
  interrupt,
  modifyCardEffect,
  on,
  oncePerRound,
  query,
  removeUpToCounters,
  thwartAScheme,
  varOf,
} from "../../../dsl/index.js";

/** The name Throw de Card writes on the event's play, which Charged Card (37006) reads with `playNote`. */
export const THROW_DE_CARD_NOTE = "throwDeCard";

/**
 * Gambit / Remy LeBeau (37001a/b): docs/phase7-wave6.md §6.2, §3.52-§3.54, §4 Q27. Charge counters sit on the identity
 * card ("here").
 *
 * - **Charge de Card (37001a)**: "Action: Place 1 charge counter here. (Limit once per round)." Hero form only (printed
 *   on that face).
 * - **Throw de Card (37001a)**: "Interrupt: When you play an ATTACK event, remove up to 3 charge counters from here ->
 *   that event deal +1 damage for each counter removed." The count is chosen in the window (RRG 1.8 "Cost", p. 14: "up
 *   to" needs at least one, so it is not offered with none); the event's own text reads the count back through the
 *   play note (Charged Card's thresholds).
 * - **Thief Extraordinaire (37001b)**: "Action (thwart): Exhaust Remy LeBeau and look at the top 2 cards of the
 *   encounter deck. Discard 1 of those cards -> remove threat from a scheme equal to the number of boost icons on that
 *   card." The look and discard are the cost, so the card is gone before the threat comes off; the "(thwart)" label
 *   makes it a thwart (confused, crisis, "when you thwart" hooks): the body is the thwart effect, not a plain threat
 *   removal.
 *
 * RRG 1.8 errata for the Gambit pack (p. 68) list only Psionic Shield (34, the Exodus set); none changes these cards.
 */
export const GAMBIT_IDENTITY = defineAbilities({
  "37001a.charge-de-card": action({ limit: oncePerRound }, addCounters("charge", 1)),

  "37001a.throw-de-card": interrupt(
    on.youPlay(query("event", { trait: trait("ATTACK") })),
    { cost: removeUpToCounters("charge", 3, { bind: "removed" }) },
    modifyCardEffect(eventTarget, {
      damage: varOf("removed"),
      note: { name: THROW_DE_CARD_NOTE, value: varOf("removed") },
    }),
  ),

  "37001b.thief-extraordinaire": action(
    { label: "thwart", cost: [exhaustThis, encounterLookDiscardCost(2, 1, "stolen")] },
    thwartAScheme(boostIconsOn(chosen("stolen"))),
  ),
});
