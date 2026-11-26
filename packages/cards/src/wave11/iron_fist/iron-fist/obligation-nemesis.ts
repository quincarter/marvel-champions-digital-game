import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  countersOn,
  coveredByEngineRule,
  defeat,
  defineAbilities,
  each,
  find,
  andThen,
  shuffleEncounterDeck,
  eventAmount,
  exists,
  forcedInterrupt,
  ifThen,
  instead,
  modifyAttack,
  moveCards,
  moveCounters,
  on,
  option,
  query,
  self,
  tuckCards,
  tuckedCount,
  tuckedUnderRef,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  addCounters,
  atEndOfActivation,
  discard,
} from "../../../dsl/index.js";
import { CHI } from "./chi.js";

const CRANE_DAUGHTER = query("minion", { name: "Crane Daughter" });
const DAVOS = query("minion", { name: "Davos" });

/**
 * Wave 11 scripting module `iron_fist/iron-fist/obligation-nemesis` (docs/phase7-elektra-iron-fist.md).
 *
 * Official text (MarvelCDB, read against the official card images). The set was first transcribed from a gameplay video
 * and a fan preview under placeholder codes 64034 to 64037; those became 64026 to 64029.
 *
 * Cards (4):
 * - 64026 Lack of Chi (obligation)
 * - 64027 Davos (minion)
 * - 64028 Crane Daughter (minion, x3)
 * - 64029 Steel Serpent (side_scheme)
 *
 * **64026.obligation**: "Give to the Danny Rand player" is engine data. **64026.when-revealed**: all chi moves from the
 * identity to this card. **64026.lack-of-chi-forced-interrupt**: each chi counter about to be placed on Iron Fist is
 * placed here instead (`countersWouldBePlaced` hears only `addCounters`, which is why every chi placement uses
 * `placeChi`). "If there are at least 4 chi counters here, discard this card" is a separate sentence (no "Then"), so the
 * check follows the redirect as a plain `ifThen` and does not depend on the redirect resolving.
 *
 * **64027.when-revealed**: each Crane Daughter is found (RRG 1.8 "Find", p. 19: the set-aside nemesis cards, the
 * encounter deck and its discard pile) and tucked facedown under Davos. The encounter deck is shuffled afterwards: a deck
 * that was searched is shuffled (RRG 1.8 "Search", p. 39; FFG ruling Aug 10, 2023 #65,
 * docs/rulings/post-rrg-1-5/04-august-2023.md).
 * **64027.davos-forced-interrupt**: when Davos would take any amount of damage and a Crane Daughter is tucked under
 * him, one is shuffled into the encounter deck instead, so all of that damage is replaced (RRG 1.8 "Replacement
 * Effect", p. 37).
 *
 * **64029.steel-serpent-forced-interrupt**: "When Davos attacks" is a mandatory interrupt of the side scheme with a
 * cost-like "discard X or defeat Y -> Z" (RRG 1.8 "Forced", p. 20: a forced ability must resolve as far as it can). The
 * controller of the encounter effect (the first player) picks the option that is available; with both available the
 * choice is a `chooseOne`. Only if the discard or defeat happened (`andThen`, "if you do") does the attack get +3 ATK.
 * With neither available nothing happens.
 *
 * **64028.when-defeated**: shuffled into the encounter deck. **64028.boost**: "After this activation, tuck this card under
 * Davos" runs at the end of the activation (`atEndOfActivation`, as Hairbag/Nebula's boosts do). With no Davos in play
 * there is nothing to tuck under, so the card is discarded as any boost card is.
 */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "64026.obligation": coveredByEngineRule(),
  "64026.when-revealed": whenRevealed(moveCounters(yourIdentity, self, CHI)),
  "64026.lack-of-chi-forced-interrupt": forcedInterrupt(
    on.countersWouldBePlaced(CHI, query("identity", { controller: "you" })),
    instead(addCounters(CHI, eventAmount, self)),
    ifThen(valueAtLeast(countersOn(self, CHI), 4), discard(self)),
  ),

  "64027.when-revealed": whenRevealed(tuckCards(cards(find(CRANE_DAUGHTER)), self, true), shuffleEncounterDeck()),
  "64027.davos-forced-interrupt": forcedInterrupt(
    on.damage("self"),
    { while: valueAtLeast(tuckedCount(self), 1) },
    instead(moveCards(cards(tuckedUnderRef(self), undefined, { random: 1 }), "encounterDeckShuffle")),
  ),

  "64029.steel-serpent-forced-interrupt": forcedInterrupt(
    on.enemyAttacks(DAVOS),
    chooseOne(
      option(
        "Discard a Crane Daughter from under Davos",
        { when: valueAtLeast(tuckedCount(each(DAVOS)), 1) },
        moveCards(cards(tuckedUnderRef(each(DAVOS)), undefined, { random: 1 }), "discard"),
        andThen(modifyAttack({ atkBonus: 3 })),
      ),
      option(
        "Defeat a Crane Daughter in play",
        { when: exists(CRANE_DAUGHTER) },
        chooseTarget("daughter", CRANE_DAUGHTER),
        defeat(chosen("daughter")),
        andThen(modifyAttack({ atkBonus: 3 })),
      ),
    ),
  ),

  "64028.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),
  "64028.boost": boost(atEndOfActivation(ifThen(exists(DAVOS), tuckCards(cards(self), each(DAVOS), true)))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
