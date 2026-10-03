import { trait } from "@mc/content";
import {
  attacksGainKeywords,
  boost,
  confuse,
  constant,
  defeatingPlayer,
  defineAbilities,
  discardEncounterUntil,
  each,
  encounterCards,
  chosen,
  dealDamage,
  gainsKeyword,
  giveBoostCard,
  giveTough,
  hasStatus,
  heal,
  identityOf,
  ifThen,
  isConfused,
  isStunned,
  moveCards,
  placeThreat,
  putIntoPlay,
  query,
  removeStatus,
  resolveWhenDefeatedOf,
  revealCard,
  stun,
  theMainScheme,
  theVillain,
  valueEquals,
  varOf,
  whenDefeated,
  whenRevealed,
} from "../../dsl/index.js";

const ACOLYTE = trait("ACOLYTE");
const ACOLYTE_MINION = query("minion", { trait: ACOLYTE });

/**
 * The Acolytes modular set (`acolytes`, `mut_gen` 32159-32165, MC32 p. 7 / p. 15, docs/phase7-wave6.md §2.2): five
 * Acolyte minions, Zeal for the Cause and The Acolytes side scheme. Teamwork (ACOLYTE), Stalwart, Retaliate, Toughness,
 * Villainous and the side scheme's Hinder-free text are data keywords (§3.1: the engine reads the `teamwork` keyword,
 * only the minion that just entered activates, before its When Revealed, §4.1 Q1/Q2).
 *
 * Every When Defeated reads "the player who defeated X": `defeatingPlayer`, which Zeal for the Cause's
 * `resolveWhenDefeatedOf` sets to the player resolving it (§4.1 Q10). "Is already confused/stunned" is read before the
 * status is given, so an ability's own status card never counts (`isConfused` / `isStunned` honour steady).
 *
 * **Fabian Cortez**: putting the found minion into play is the last effect, so he is discarded as it enters and its
 * teamwork does not see him (RRG FAQ "Fabian Cortez (#159)", p. 64).
 */
export const ACOLYTES_ABILITIES = defineAbilities({
  // Fabian Cortez (32159) — When Defeated: The player who defeated him discards cards from the encounter deck until an
  // Acolyte minion is discarded, then puts that minion into play engaged with them.
  "32159.when-defeated": whenDefeated(
    discardEncounterUntil(ACOLYTE_MINION, "acolyte"),
    putIntoPlay(chosen("acolyte"), defeatingPlayer),
  ),

  // Amelia Voght (32160) — When Defeated: The player who defeated her is confused. If they are already confused, place
  // 2 threat on the main scheme.
  "32160.when-defeated": whenDefeated(
    ifThen(
      isConfused(identityOf(defeatingPlayer)),
      placeThreat(2, theMainScheme),
      confuse(identityOf(defeatingPlayer)),
    ),
  ),

  // Senyaka (32161) — [star] Senyaka's attacks gain piercing.
  "32161.senyaka-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  // When Defeated: The player who defeated Senyaka is stunned. If they are already stunned, they take 3 damage.
  "32161.when-defeated": whenDefeated(
    ifThen(
      isStunned(identityOf(defeatingPlayer)),
      dealDamage(3, identityOf(defeatingPlayer)),
      stun(identityOf(defeatingPlayer)),
    ),
  ),

  // Delgado (32162) — When Defeated: Discard each stunned and confused card from the villain and give it a facedown
  // boost card.
  "32162.when-defeated": whenDefeated(
    removeStatus(theVillain, "stunned"),
    removeStatus(theVillain, "confused"),
    giveBoostCard(theVillain),
  ),

  // Unuscione (32163) — When Defeated: Give the villain a tough status card. If the villain already has a tough status
  // card, heal 4 damage from it.
  "32163.when-defeated": whenDefeated(
    ifThen(hasStatus(theVillain, "tough"), heal(4, theVillain), giveTough(theVillain)),
  ),

  // Zeal for the Cause (32164) — When Revealed: Resolve the "When Defeated" ability of each Acolyte minion engaged with
  // you. If you are not engaged with an Acolyte minion, discard cards from the encounter deck until a minion is
  // discarded, then reveal it.
  "32164.when-revealed": whenRevealed(
    resolveWhenDefeatedOf(each(query("minion", { trait: ACOLYTE, engagedWith: "you" })), { bind: "zeal" }),
    ifThen(valueEquals(varOf("zeal.count"), 0), [
      discardEncounterUntil(query("minion"), "minion"),
      revealCard(chosen("minion")),
    ]),
  ),

  // The Acolytes (32165) — Each Acolyte minion gains guard.
  "32165.the-acolytes-constant": constant(gainsKeyword({ name: "guard" }, ACOLYTE_MINION)),
  // [star] Boost: Shuffle each Acolyte minion from the discard pile into the encounter deck.
  "32165.boost": boost(moveCards(encounterCards(["discard"], ACOLYTE_MINION), "encounterDeckShuffle")),
});
