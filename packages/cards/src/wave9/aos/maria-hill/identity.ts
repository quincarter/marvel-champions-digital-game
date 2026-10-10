import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  allOf,
  countOf,
  valueAtLeast,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  cards,
  defineAbilities,
  exhaustYourHero,
  gainsTrait,
  moveCards,
  moveCounters,
  oncePerRound,
  query,
  shuffleDeck,
  zone,
  you,
} from "../../../dsl/index.js";

const SHIELD = trait("S.H.I.E.L.D.");

/** Every S.H.I.E.L.D. support in play, whoever controls it ("a S.H.I.E.L.D. support"). */
export const SHIELD_SUPPORTS = query("support", { trait: SHIELD });

const SHIELD_SUPPORT_WITH_COUNTER = query("support", { trait: SHIELD, hasCounter: "any" });

/**
 * Both targets are required, but the engine only checks the first when an action is initiated, so a Maria Hill with a
 * lone S.H.I.E.L.D. support would spend her once-per-round limit on nothing. The ability is only usable while a
 * S.H.I.E.L.D. support holds a counter and a second S.H.I.E.L.D. support exists (RRG 1.8 "Target", p. 43).
 */
const CAN_REASSIGN = allOf(
  valueAtLeast(countOf(SHIELD_SUPPORT_WITH_COUNTER), 1),
  valueAtLeast(countOf(SHIELD_SUPPORTS), 2),
);

/**
 * Wave 9 scripting module `aos/maria-hill/identity` (docs/phase7-wave9.md section 8.4, 3.6, 3.10).
 *
 * Cards (1 card, 2 faces):
 * - 50001a Maria Hill (hero_identity) / 50001b Maria Hill (alter ego)
 *
 * **50001a.maria-hill-constant**: "Each ally you control gains the S.H.I.E.L.D. trait." Printed on the hero face, so it
 * holds only while Maria Hill is in hero form.
 *
 * **50001a.reassignment**: "Action: Move 1 all-purpose counter from a S.H.I.E.L.D. support to another S.H.I.E.L.D.
 * support. (Limit once per round.)" Only a S.H.I.E.L.D. support holding a counter can be the source and the
 * destination is a different S.H.I.E.L.D. support. The counter is retyped by the card it lands on, and a uses support
 * emptied by the move is discarded (RRG 1.8 "All-Purpose Counter", p. 6; "Uses", p. 46; docs/phase7-wave9.md 3.6).
 * With no source holding a counter, or no second support, the ability has no legal target and cannot be initiated, so
 * the once-per-round limit is not spent.
 *
 * **50001b.maria-hill-action**: "Action: Exhaust Maria Hill -> search your deck for a S.H.I.E.L.D. support and add
 * it to your hand." The whole deck is searched and shuffled afterward, also when none is found (RRG 1.8 "Search", p.
 * 39).
 *
 * **50001b.maria-hill-constant** is her deck-building rule ("You may include the maximum number of copies of 3
 * S.H.I.E.L.D. supports ... from aspects other than your chosen aspect"). It is carried entirely by card data
 * (`deckbuilding.offAspectPackages`, checked in `engine/src/deck.ts`; docs/phase7-wave9.md 3.10), not by an ability.
 */
export const MARIA_HILL_IDENTITY: AbilityRegistry = defineAbilities({
  "50001a.maria-hill-constant": constant(gainsTrait(SHIELD, query("ally", { controller: "you" }))),

  "50001a.reassignment": action(
    { limit: oncePerRound, while: CAN_REASSIGN },
    chooseTarget("from", SHIELD_SUPPORT_WITH_COUNTER),
    chooseTarget("to", query("support", { trait: SHIELD, excludeSlots: ["from"] })),
    moveCounters(chosen("from"), chosen("to"), "any", 1),
  ),

  "50001b.maria-hill-action": action(
    { cost: exhaustYourHero },
    chooseCards("found", zone("deck", you, { filter: query("support", { trait: SHIELD }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {
  "50001b.maria-hill-constant":
    "Deck-building rule, not an ability: carried by the card's `deckbuilding.offAspectPackages` data (docs/phase7-wave9.md 3.10; checked in engine/src/deck.ts).",
};
