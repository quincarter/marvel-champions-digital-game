import { trait } from "@mc/content";
import {
  allOf,
  alterEgoAction,
  anyOfCards,
  atMost,
  cannotChangeFormUntil,
  cannotThwart,
  changeForm,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  dealDamage,
  discardAtRandom,
  draw,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  ifElse,
  ifThen,
  isAlterEgo,
  isHero,
  not,
  option,
  placeThreat,
  query,
  removedFromGameCards,
  removeThreat,
  revealCard,
  selectCards,
  self,
  setAside,
  setVar,
  shuffleEncounterDeck,
  spend,
  statOf,
  surge,
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
 * **Loose Ends (27135)**: "Search the encounter deck, discard pile, set-aside area, and removed-from-game area for a
 * copy of your obligation, then reveal it" is one pool (`anyOfCards`) over the encounter deck and discard pile, both
 * set-aside areas the engine keeps (the player's own and the scenario's; `setAside`/`encounterSetAside`) and the
 * removed-from-game area (`removedFromGameCards`), filtered by `TargetQuery.obligationOf` (RRG 1.8 "Obligation",
 * p. 30), capped to one copy (`atMost`). The searched encounter deck is shuffled before the reveal (RRG 1.8 "Search",
 * p. 39). The removed-from-game area is reachable because the card prints it: ruling December 17, 2025 (4)'s "cannot
 * be returned to the game by any means" is about generic retrieval, and card text naming the area overrides it.
 *
 * "During that reveal, if you change to alter-ego form, discard 1 random card from your hand" is approximated as
 * "in hero form before the reveal and in alter-ego form after it": a `setVar` snapshot of the form, compared once the
 * revealed obligation has finished resolving. The shared obligation shape (`core/obligations.ts`: "You may flip to
 * alter-ego form. Choose: …") flips once, first, and its options don't read your hand, so for those the outcome
 * matches the printed text. Not modelled: the discard happening at the moment of the change (mid-reveal) rather than
 * right after the reveal, and a hero → alter-ego → hero round trip inside one reveal (which would not discard here). The exact primitive — a
 * delayed trigger scoped to one reveal ("after you change to alter-ego form during this reveal") — does not exist.
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

  // Loose Ends (27135, treachery; no boost icons are data) — When Revealed: Search the encounter deck, discard pile,
  // set-aside area, and removed-from-game area for a copy of your obligation, then reveal it. During that reveal, if
  // you change to alter-ego form, discard 1 random card from your hand. If your obligation was not revealed this way,
  // this card gains surge. (Module docblock: the search pool, and the form-snapshot reading of "during that reveal".)
  "27135.when-revealed": whenRevealed(
    selectCards(
      "obligation",
      atMost(
        1,
        anyOfCards(
          encounterCards(["deck", "discard"], { obligationOf: you }),
          setAside(you, { obligationOf: you }),
          encounterSetAside({ obligationOf: you }),
          removedFromGameCards({ obligationOf: you }),
        ),
      ),
    ),
    shuffleEncounterDeck(),
    setVar("heroBeforeReveal", ifElse(isHero(), 1, 0)),
    revealCard(chosen("obligation")),
    ifThen(allOf(varAtLeast("heroBeforeReveal"), isAlterEgo()), discardAtRandom(1)),
    ifThen(not(varAtLeast("obligation.count")), surge()),
  ),
});
