import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  activationIs,
  atEndOfActivation,
  boost,
  chooseTarget,
  chosen,
  countBoostIcons,
  defineAbilities,
  discardFromHand,
  enemyActivates,
  engage,
  eventPlayer,
  eventTarget,
  find,
  forcedInterrupt,
  ifThen,
  moveCards,
  named,
  not,
  notMatching,
  placeThreat,
  query,
  revealCard,
  rotateEngagement,
  self,
  surge,
  totalPrintedResources,
  varOf,
  varAtLeast,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

const BATROC = "Batroc";

/** "When Batroc engages you": the minion is the event's target, the player it engaged the event's player. */
const BATROC_ENGAGES: EventPattern = { on: "minionEngaged", selfIs: "target" };
/** "When a minion engages a player" (any minion, any player). */
const A_MINION_ENGAGES: EventPattern = { on: "minionEngaged" };

/**
 * Modular encounter set `the_leaper` (Agents of S.H.I.E.L.D., a Thunderbolt set; docs/phase7-wave9.md sections 3.24,
 * 3.35). Villainous and Victory 1 are data.
 *
 * **Batroc (50161)**: Forced Interrupt: when he engages a player (revealed into play, found, moved by a card), that
 * player discards 1 card from their hand. The ability is on an encounter card, so the player is `eventPlayer`.
 *
 * **Coup de Foudre (50162)**: Forced Interrupt: when any minion engages a player, that player discards the top X
 * cards of their deck, X the boost icons on that minion (counted as a card effect counts them, so Crest and Chaos
 * Control apply), then 1 threat is placed here for each printed energy resource among the discarded cards.
 *
 * **Batroc the Leaper (50163)**: finds and reveals Batroc (when in play he engages the revealing player), who
 * activates against that player; surge when nobody activated. Boost: discard 1 card from your hand.
 *
 * **Parcours du Combattant (50164)**: Surge (data). When Revealed: every player engages the minions engaged with the
 * player clockwise from them, all at once. Boost: after this attack resolves, engage a minion in play that is not
 * engaged with you.
 *
 * Cards (4):
 * - 50161 Batroc (minion)
 * - 50162 Coup de Foudre (side_scheme)
 * - 50163 Batroc the Leaper (treachery)
 * - 50164 Parcours du Combattant (treachery)
 */
export const THE_LEAPER: AbilityRegistry = defineAbilities({
  "50161.batroc-forced-interrupt": forcedInterrupt(BATROC_ENGAGES, discardFromHand(1, eventPlayer)),

  "50162.coup-de-foudre-forced-interrupt": forcedInterrupt(
    A_MINION_ENGAGES,
    countBoostIcons(eventTarget, "icons"),
    moveCards(zone("deck", eventPlayer, { top: varOf("icons.boostIcons") }), "discard", "discarded"),
    placeThreat(totalPrintedResources(chosen("discarded"), ["energy"]), self),
  ),

  "50163.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: BATROC })), you),
    enemyActivates(named(BATROC), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "50163.boost": boost(discardFromHand(1, you)),

  "50164.when-revealed": whenRevealed(rotateEngagement()),
  "50164.boost": boost(
    ifThen(
      activationIs("attack"),
      atEndOfActivation(
        chooseTarget("minion", query("minion", notMatching({ engagedWithPlayer: you }))),
        engage(chosen("minion"), you),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const THE_LEAPER_SKIPPED: Readonly<Record<string, string>> = {};
