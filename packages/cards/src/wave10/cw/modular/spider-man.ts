import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  chosen,
  dealAsEncounterCard,
  defineAbilities,
  discard,
  each,
  encounterCards,
  enemyAttack,
  exists,
  forEachCard,
  forcedInterrupt,
  hasAttachment,
  ifThen,
  inCompetitiveMode,
  instead,
  not,
  on,
  oneCopyOf,
  perHero,
  placeThreat,
  query,
  revealCard,
  selectCards,
  self,
  shuffleEncounterDeck,
  theMainScheme,
  valueAtLeast,
  varOf,
  whenRevealed,
  you,
  removeThreat,
  yourLeadersMainScheme,
  moveThreat,
} from "../../../dsl/index.js";

const SPIDER_MAN_MINION = query("minion", { name: "Spider-Man" });
/** A copy of Tangled Up, in the encounter deck or its discard pile (the two copies are one card). */
const TANGLED_UP = query("attachment", { name: "Tangled Up" });
const TANGLED_CHARACTER = query("character", hasAttachment(TANGLED_UP));

/**
 * Modular encounter set `spider_man_modular` (Civil War, Resistance side; docs/phase7-wave10.md sections 3.4, 3.21 and
 * 3.23). The boost icons and stars, Spider-Man's Avenger and Elite traits and Neighborhood Hero's starting threat are
 * data.
 *
 * **Spider-Man (56180)**: When Revealed: he attacks each character with Tangled Up attached, one attack per character.
 * "If no attack was made this way" is read off the attacks themselves (`attacks.hit.made`, the number made): none
 * when no character has a copy attached, and none when the attack was replaced, as a stunned Spider-Man's is (RRG 1.8
 * "Stun, Stunned", p. 41: the stun card is removed instead and he "is not considered to have attacked"). Then the
 * enemy team searches the encounter deck and discard pile for a copy of Tangled Up and deals it to you as a facedown
 * encounter card. The two copies are identical, so "the enemy team searches" has nothing to decide and no prompt is
 * shown (as for Unregistered Super in `cape-killer.ts`); the searched decks are shuffled after (RRG 1.8 "Search",
 * p. 39).
 *
 * **Tangled Up (56181)**: attaches to your leader, otherwise to your hero (`attachesTo` is data; cooperatively there
 * is no "your leader", MC56 p. 6). Forced Interrupt: when the attached character would scheme, thwart or attack, this
 * card is discarded instead (docs/phase7-wave10.md section 3.21; RRG 1.8 "'Would'", p. 48): the character is exhausted
 * if it paid that cost, and nothing else of the use happens. Boost: if the Spider-Man minion is in play, reveal this
 * card.
 *
 * **Spectacular! (56182)**: 2 threat on the main scheme. The competitive sentence is written out as a competitive-only
 * marker; cooperatively there is no "your leader's main scheme" and nothing is removed.
 *
 * **Neighborhood Hero (56183)**: in competitive mode, 2 threat moves from your leader's main scheme to this scheme
 * (written out as a competitive-only marker); otherwise 2 per player threat is placed here, on top of its starting 2.
 *
 * Cards (4):
 * - 56180 Spider-Man (minion)
 * - 56181 Tangled Up (attachment)
 * - 56182 Spectacular! (treachery)
 * - 56183 Neighborhood Hero (side_scheme)
 */
export const MODULAR_SPIDER_MAN: AbilityRegistry = defineAbilities({
  "56180.when-revealed": whenRevealed(
    forEachCard(
      "tangled",
      each(TANGLED_CHARACTER),
      enemyAttack(self, { targetCharacter: chosen("tangled"), bind: "hit" }),
      { bind: "attacks" },
    ),
    ifThen(not(valueAtLeast(varOf("attacks.hit.made"), 1)), [
      selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], TANGLED_UP))),
      dealAsEncounterCard(chosen("found"), you),
      shuffleEncounterDeck(),
    ]),
  ),

  "56181.tangled-up-forced-interrupt": forcedInterrupt(on.characterWouldAct("host"), instead(discard(self))),
  "56181.boost": boost(ifThen(exists(SPIDER_MAN_MINION), revealCard(self))),

  "56182.when-revealed": whenRevealed(placeThreat(2, theMainScheme), removeThreat(2, yourLeadersMainScheme)),

  "56183.when-revealed": whenRevealed(
    ifThen(
      inCompetitiveMode(),
      // Threat moves across the table (MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4)): removed there, placed here (RRG 1.8 "Move", p. 30).
      [moveThreat(yourLeadersMainScheme, self, { amount: 2 })],
      placeThreat(perHero(2), self),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const MODULAR_SPIDER_MAN_SKIPPED: Readonly<Record<string, string>> = {};
