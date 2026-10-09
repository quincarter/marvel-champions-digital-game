import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  applyRuleUntil,
  bindTargets,
  chooseTarget,
  chosen,
  confuse,
  dealAsEncounterCard,
  dealEncounterCard,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  enemyActivates,
  enemyAttack,
  eventPlayer,
  eventSource,
  exists,
  firstPlayer,
  forcedResponse,
  hasStatus,
  identityOf,
  ifThen,
  nextAfter,
  not,
  on,
  passEncounterCard,
  query,
  remainingHpOf,
  revealCard,
  self,
  searchAndReveal,
  shuffleEncounterDeck,
  stun,
  superlative,
  varAtLeast,
  whenRevealed,
} from "../../dsl/index.js";

const ELITE = trait("ELITE");
const A_MINION = query("minion");

/**
 * Modular encounter set `crazy_gang` (Nightcrawler pack, docs/phase7-wave8.md §7.4, §3.75, §3.81, Q44). Waits on no
 * engine work now: §3.75's `dealAsEncounterCard` of a card in play and `passEncounterCard` / `nextAfter` are in.
 *
 * Starting threat 2 per player, the acceleration icon and each minion's SCH 0 / boost icons are data (Tweedledope has
 * 1 boost icon and no star, Q44 = B). "Already confused / stunned" is read before the status is given, the convention of
 * Arcade's Funhouse and Hall of Mirrors. A permanent upgrade is not a legal pick for Tweedledope's discard (RRG p. 32),
 * so the pick excludes one. Queen of Hearts tests "already in play" before searching, since a revealed Crazy Gang would
 * otherwise be in play by then; her search finds nothing in that case. The card's closing "(Shuffle.)" comes last, so
 * the facedown card is the top card of the unshuffled deck.
 *
 * Executioner: the lowest remaining hit points among every identity and ally of every player; the first player breaks
 * a tie (RRG p. 19). "An ally this attack defeats" (the target or a defender) goes to the removed-from-game area
 * instead of the discard pile: a `defeatDestination` rule lasting to the end of exactly the attack this ability
 * initiates, so Executioner's later villain-phase attacks are untouched.
 *
 * Cards (6):
 * - 48033 The Crazy Gang (side_scheme)
 * - 48034 Queen of Hearts (minion)
 * - 48035 Jester (minion)
 * - 48036 Executioner (minion)
 * - 48037 Tweedledope (minion)
 * - 48038 "Off with His Head!" (treachery)
 */
export const CRAZY_GANG: AbilityRegistry = defineAbilities({
  // The Crazy Gang — Forced Response: after a non-Elite minion schemes against a player, deal that minion to that
  // player as a facedown encounter card; then, with more than one player, pass it to the next player. In a one-player
  // game `nextAfter` names nobody and the pass does nothing (RRG p. 15: dealt in step two, revealed in step four).
  "48033.the-crazy-gang-forced-response": forcedResponse(
    on.enemySchemes({ categories: ["minion"], withoutTrait: ELITE }),
    dealAsEncounterCard(eventSource, eventPlayer),
    passEncounterCard(eventSource, eventPlayer, nextAfter(eventPlayer)),
  ),

  // Queen of Hearts — When Revealed: search the encounter deck and discard pile for The Crazy Gang and reveal it; if it
  // is already in play, deal yourself a facedown encounter card.
  "48034.when-revealed": whenRevealed(
    ifThen(
      exists(query("sideScheme", { name: "The Crazy Gang" })),
      [dealEncounterCard(), shuffleEncounterDeck()],
      searchAndReveal("The Crazy Gang"),
    ),
  ),

  // Jester — When Revealed: you are confused; if you already were, discard a support you control.
  "48035.when-revealed": whenRevealed(
    ifThen(
      hasStatus(identityOf(), "confused"),
      [chooseTarget("pick", query("support", { controller: "you" })), discard(chosen("pick"))],
      confuse(identityOf()),
    ),
  ),

  // Executioner — When Revealed: attacks the friendly character with the fewest remaining hit points (the first player
  // picks among ties); an ally that attack defeats is removed from the game.
  "48036.when-revealed": whenRevealed(
    bindTargets(
      "fewest",
      superlative("lowest", each(query(["identity", "ally"])), remainingHpOf(chosen("candidate")), {
        ties: "all",
      }),
    ),
    chooseTarget("victim", { inSlot: "fewest" }, { chooser: firstPlayer }),
    applyRuleUntil(
      { kind: "defeatDestination", target: query("ally"), to: "removedFromGame" },
      "endOfAttack",
      undefined,
      { attack: "initiated" },
    ),
    enemyAttack(self, { targetCharacter: chosen("victim") }),
  ),

  // Tweedledope — When Revealed: you are stunned; if you already were, discard an upgrade you control.
  "48037.when-revealed": whenRevealed(
    ifThen(
      hasStatus(identityOf(), "stunned"),
      [
        chooseTarget("pick", query("upgrade", { controller: "you", withoutKeyword: "permanent" })),
        discard(chosen("pick")),
      ],
      stun(identityOf()),
    ),
  ),

  // "Off with His Head!" — When Revealed: each minion activates against the player it is engaged with; if none did,
  // discard from the encounter deck until a minion is discarded and reveal it (the resolving player reveals).
  "48038.when-revealed": whenRevealed(
    enemyActivates(each(A_MINION), { bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), [discardEncounterUntil(A_MINION, "found"), revealCard(chosen("found"))]),
  ),
});
