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
  discard,
} from "../../../dsl/index.js";
import { CHI } from "./chi.js";

const CRANE_DAUGHTER = query("minion", { name: "Crane Daughter" });
const DAVOS = query("minion", { name: "Davos" });

/**
 * Wave 11 scripting module `iron_fist/iron-fist/obligation-nemesis` (docs/phase7-elektra-iron-fist.md).
 *
 * PROVISIONAL TEXT: Iron Fist's obligation and nemesis set are not published. Their text comes from a gameplay
 * video and an unofficial fan preview (docs/phase7-elektra-iron-fist.md section 3), the codes are placeholders, and
 * Crane Daughter is the least certain card. The scripts follow the text as recorded; revisit when the cards are official.
 *
 * Cards (4):
 * - 64034 Lack of Chi (obligation)
 * - 64035 Davos (minion)
 * - 64036 Steel Serpent (side_scheme)
 * - 64037 Crane Daughter (minion)
 *
 * **64034.obligation**: "Give to the Danny Rand player" is engine data. **64034.when-revealed**: all chi moves from the
 * identity to this card. **64034.lack-of-chi-forced-interrupt**: each chi counter about to be placed on Iron Fist is
 * placed here instead (`countersWouldBePlaced` hears only `addCounters`, which is why every chi placement uses
 * `placeChi`); then, at 4 or more chi here, the card is discarded.
 *
 * **64035.when-revealed**: each Crane Daughter is found (RRG 1.8 "Find", p. 19: the set-aside nemesis cards, the
 * encounter deck and its discard pile) and tucked facedown under Davos (the video reads "Find and tuck the 3 Crane
 * Daughter minions under here"). The encounter deck is shuffled afterwards: a deck that was searched is shuffled
 * (RRG 1.8 "Search", p. 39; FFG ruling Aug 10, 2023 #65, docs/rulings/post-rrg-1-5/04-august-2023.md).
 * **64035.davos-forced-interrupt**: when Davos would take any amount of damage and a Crane Daughter is tucked under
 * him, one is shuffled into the encounter deck instead, so all of that damage is replaced (RRG 1.8 "Replacement
 * Effect", p. 37).
 *
 * **64036.steel-serpent-constant**: "When Davos attacks" is a mandatory interrupt of the side scheme: a Crane Daughter
 * is discarded from under him, or one in play is defeated; only if that happened (`andThen`, "if you do") the
 * attack gets +3 ATK. With neither available
 * nothing happens.
 *
 * **64037.when-defeated**: shuffled into the encounter deck. **64037.boost**: with Davos engaged with you, put facedown
 * under him.
 */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "64034.obligation": coveredByEngineRule(),
  "64034.when-revealed": whenRevealed(moveCounters(yourIdentity, self, CHI)),
  "64034.lack-of-chi-forced-interrupt": forcedInterrupt(
    on.countersWouldBePlaced(CHI, query("identity", { controller: "you" })),
    instead(addCounters(CHI, eventAmount, self)),
    ifThen(valueAtLeast(countersOn(self, CHI), 4), discard(self)),
  ),

  "64035.when-revealed": whenRevealed(tuckCards(cards(find(CRANE_DAUGHTER)), self, true), shuffleEncounterDeck()),
  "64035.davos-forced-interrupt": forcedInterrupt(
    on.damage("self"),
    { while: valueAtLeast(tuckedCount(self), 1) },
    instead(moveCards(cards(tuckedUnderRef(self), undefined, { random: 1 }), "encounterDeckShuffle")),
  ),

  "64036.steel-serpent-constant": forcedInterrupt(
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

  "64037.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),
  "64037.boost": boost(
    ifThen(exists(query("minion", { name: "Davos", engagedWith: "you" })), tuckCards(cards(self), each(DAVOS), true)),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
