import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  andThen,
  cards,
  chosen,
  defineAbilities,
  discardDeckUntil,
  moveCards,
  on,
  oncePerRound,
  raiseMoment,
  response,
  you,
  zone,
} from "../../../dsl/index.js";

const MAGNETIC = trait("MAGNETIC");

/**
 * Raised unconditionally by "Magnetic Pull" once its action is used: Old Grievances (49027, "Forced Response: After
 * you use your 'Magnetic Pull' ability") answers it. Carries the slot `pulled`, every card the Pull discarded, read by
 * answering abilities as `moment.pulled.count`, `moment.pulled.mental` and so on (docs/phase7-wave8.md section 3.71).
 */
export const MAGNETIC_PULL_USED_MOMENT = "magneticPullUsed";
/**
 * Raised only when the Pull resolved (a MAGNETIC card was found, Q41 = A): Magneto's Armor (49004) and Magneto's Cape
 * (49005) ("After you resolve your 'Magnetic Pull' ability") answer it. Carries the same slot `pulled`.
 */
export const MAGNETIC_PULL_MOMENT = "magneticPull";

/**
 * Magneto / Erik Lehnsherr (49001a/b): docs/phase7-wave8.md section 7.5, 3.71; section 4.1 Q41 and Q42.
 *
 * **Magnetic Pull (49001a)**, an Action of the hero face, limit once per round (the limit persists across a flip).
 * `discardDeckUntil` discards until a MAGNETIC card is discarded and binds every discarded card as `pulled` (the match
 * included, so the found card counts as discarded for the Armor and Old Grievances: Q42 = A), the match as `found`.
 * Its Then adds the found card to hand. Two moments follow: "used" is raised whatever happened (the discards stand and
 * the round's use is spent, Q41 = A), "resolved" only when the Then went through, i.e. when a MAGNETIC card was found.
 * With no MAGNETIC card in the deck: nothing added to hand, only the "used" moment.
 *
 * **Survivor (49001b)**, Response: after he changes to this form, shuffle the top 3 cards of the discard pile into the
 * deck (fewer cards: all of them).
 *
 * Cards (1):
 * - 49001a Magneto (hero_identity)
 */
export const MAGNETO_IDENTITY: AbilityRegistry = defineAbilities({
  "49001a.magnetic-pull": action(
    { limit: oncePerRound },
    discardDeckUntil({ trait: MAGNETIC }, "found", { bindAll: "pulled" }),
    andThen(moveCards(cards(chosen("found")), "hand")),
    raiseMoment(MAGNETIC_PULL_USED_MOMENT, you, ["pulled"]),
    andThen(raiseMoment(MAGNETIC_PULL_MOMENT, you, ["pulled"])),
  ),

  "49001b.survivor": response(on.youChangeForm(), moveCards(zone("discard", you, { top: 3 }), "deckShuffle")),
});

/** Refs left unregistered, each with its reason. */
export const MAGNETO_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
