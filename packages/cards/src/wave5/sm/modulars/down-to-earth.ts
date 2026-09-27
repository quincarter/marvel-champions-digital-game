import { trait } from "@mc/content";
import {
  alterEgoAction,
  cannotChangeFormUntil,
  cannotThwart,
  changeForm,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  dealDamage,
  draw,
  eachPlayer,
  ifThen,
  isHero,
  option,
  placeThreat,
  query,
  removeThreat,
  self,
  spend,
  statOf,
  theMainScheme,
  varAtLeast,
  whenRevealed,
  you,
  youHaveTrait,
  yourIdentity,
} from "../../../dsl/index.js";

const CIVILIAN = trait("CIVILIAN");

/**
 * Down to Earth (`sm` 27131/27133/27134/27135, docs/phase7-wave5.md §2.2): a modular set built around the
 * alter-ego's own civilian life rather than combat — Common Criminal is resolved with an Alter-Ego Action, Volunteer
 * Work cannot be thwarted at all (only paid down via its own Alter-Ego Action), and both treacheries pressure the
 * player's form choice. Friends and Family (27132, obligation) is part of this printed 7-card checklist
 * (`DOWN TO EARTH (2/7)`) but carries `encounterSetIds: []` — RRG 1.8 "Obligation" (p. 30): an identity-specific
 * obligation is linked from its hero's `HeroIdentityCard.obligationCardId`, not shuffled into this modular's own
 * deck — so it is scripted with its owning hero's kit, not here.
 *
 * **Loose Ends (27135) is not implemented in this module — engine gap, see the docblock above `when-revealed`
 * below.**
 */
export const DOWN_TO_EARTH = defineAbilities({
  // Common Criminal (27131, minion; ATK 1/SCH 0/HP 3/CRIMINAL/1 boost icon are data; Surge is data,
  // `keywords: [{ name: "surge" }]`) — Alter-ego Action: Spend a [physical] resource → deal 3 damage to Common
  // Criminal. If this minion is defeated this way, choose to either draw 1 card or remove 3 threat from a side
  // scheme. (Card data's own id says "-constant" — the printed text's Surge sentence was classified as unscripted
  // constant text by the curation pipeline and left the whole card under one id; the real ability is this
  // Alter-Ego Action, the sinister-six modular's own "id suffix doesn't always match ability kind" precedent.)
  "27131.common-criminal-constant": alterEgoAction(
    { cost: spend({ physical: 1 }) },
    dealDamage(3, self, { bind: "hit" }),
    ifThen(
      varAtLeast("hit.defeated"),
      chooseOne(
        option("Draw 1 card", draw(1)),
        option(
          "Remove 3 threat from a side scheme",
          chooseTarget("scheme", query("sideScheme")),
          removeThreat(3, chosen("scheme")),
        ),
      ),
    ),
  ),

  // Volunteer Work (27133, side scheme; startingThreat 0/3 per player, acceleration icon, 2 boost icons are data) —
  // You cannot thwart this scheme. No player is exempted (unlike Life-Size Decoy's own engaged-player-only ban,
  // `sinister-six/guerrilla-tactics.ts` 27142) — `eachPlayer`, scoped to this one scheme instance (`self: true`),
  // so only this card is unthwartable, not every side scheme.
  "27133.volunteer-work-constant": constant(cannotThwart(eachPlayer, { schemes: query("sideScheme", { self: true }) })),
  // Volunteer Work — Alter-Ego Action: Spend 2 resources of any type → remove threat from this scheme equal to your
  // alter-ego's REC. If your identity has the CIVILIAN trait, draw 1 card.
  "27133.volunteer-work-action": alterEgoAction(
    { cost: spend(2) },
    removeThreat(statOf(yourIdentity, "rec"), self),
    ifThen(youHaveTrait(CIVILIAN), draw(1)),
  ),

  // "Threat or Menace?" (27134, treachery; no boost icons are data) — When Revealed: You may change form. If you
  // are in hero form (after that optional change), place 2 threat on the main scheme. If you are in alter-ego form
  // (after that optional change), you cannot change form during your next turn. `isHero()`/`cannotChangeFormUntil`
  // read the form *after* the optional `changeForm`, matching the printed sentence order (change first, then
  // check).
  "27134.when-revealed": whenRevealed(
    chooseOne(option("Change form", changeForm(you)), option("Don't change form")),
    ifThen(isHero(), placeThreat(2, theMainScheme), cannotChangeFormUntil("endOfNextTurn")),
  ),
});
