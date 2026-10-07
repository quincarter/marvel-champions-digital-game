import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  aScheme,
  anAttackableEnemy,
  attack,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  damageAnEnemy,
  defineAbilities,
  heal,
  heroAction,
  ifThen,
  inDiscard,
  moveCards,
  on,
  option,
  partOf,
  query,
  removeThreat,
  removeThreatFromAScheme,
  response,
  scaled,
  self,
  topOfDeck,
  totalPrintedResources,
  varAtLeast,
} from "../../../dsl/index.js";

/** The cards a deck discard bound under `milled`, counted as Domino's hero face counts them (a wild twice). */
const MILLED = { kind: "slot", slot: "milled" } as const;
const discardTopOfDeck = moveCards(topOfDeck(1), "discard", "milled");

/** "Heal 2 damage from a character." / "Remove 2 threat from a scheme." / "Deal 3 damage to an enemy." */
const healACharacter = (): EffectSpec[] => [
  chooseTarget("character", query("character")),
  heal(2, chosen("character")),
];
const MENTAL_EFFECT = (): EffectSpec[] => removeThreatFromAScheme(2);
const PHYSICAL_EFFECT = (): EffectSpec[] => damageAnEnemy(3);

/**
 * The most counted icons of one kind a card can give: three printed [wild] icons counted twice by Domino. Luck Be a Lady
 * resolves its effect once per counted icon; no repeat-N effect exists, so each count is a threshold (`varAtLeast`).
 */
const MOST_COUNTED = 6;
const perCount = (bound: string, effects: () => readonly EffectSpec[]): EffectSpec[] =>
  Array.from({ length: MOST_COUNTED }, (_, k) => ifThen(varAtLeast(bound, k + 1), effects()));

/**
 * Domino's hero events and Jackpot! (40040-40043), docs/phase7-wave7.md §7.1, §3.55, §3.56, §4.1 Q32, Q34.
 *
 * - **A Good Workout (40040), Hero Action (attack)**: choose an enemy, discard the top card of the deck, then one attack
 *   of 4 damage plus 1 per resource icon discarded (Domino's wild counts twice). Q34 = B: all the additional damage goes
 *   to the enemy the 4 damage was dealt to. Q32 = B: a card a response took away (Digging Deep) does not count.
 * - **Luck Be a Lady (40041), Hero Action**: discard the top card; for each counted icon, [energy] heals 2 from a
 *   character, [mental] removes 2 threat from a scheme, [physical] deals 3 damage to an enemy, [wild] chooses one of
 *   those (a Domino-doubled wild is two choices). Resolved energy, then mental, then physical, then wild. The three
 *   bullet-line refs are ingestion artifacts of the one action.
 * - **Right Place, Right Time (40042), Hero Action (thwart)**: one thwart of 3 plus 1 per icon discarded, on the scheme.
 * - **Jackpot! (40043), Response**: "After this card is discarded from the top of your deck, shuffle it back into your
 *   deck", read from the discard pile (`activeIn: "discard"`). MC40 p. 21: as the deck's last card, the reset already
 *   shuffled it in. Its three icons are its `producesIcons`, which the deck-discard count reads as printed.
 */
export const DOMINO_EVENTS: AbilityRegistry = defineAbilities({
  "40040.a-good-workout-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    discardTopOfDeck,
    attack(scaled(totalPrintedResources(MILLED), { plus: 4 }), chosen("enemy")),
  ),

  "40041.luck-be-a-lady-action": heroAction(
    discardTopOfDeck,
    ...perCount("milled.energy", healACharacter),
    ...perCount("milled.mental", MENTAL_EFFECT),
    ...perCount("milled.physical", PHYSICAL_EFFECT),
    ...perCount("milled.wild", () => [
      chooseOne(
        option("Heal 2 damage from a character", ...healACharacter()),
        option("Remove 2 threat from a scheme", ...MENTAL_EFFECT()),
        option("Deal 3 damage to an enemy", ...PHYSICAL_EFFECT()),
      ),
    ]),
  ),
  "40041.luck-be-a-lady-constant": partOf("40041.luck-be-a-lady-action"),
  "40041.luck-be-a-lady-constant-2": partOf("40041.luck-be-a-lady-action"),
  "40041.luck-be-a-lady-constant-3": partOf("40041.luck-be-a-lady-action"),
  "40041.luck-be-a-lady-constant-4": partOf("40041.luck-be-a-lady-action"),

  "40042.right-place-right-time-action": heroAction(
    { label: "thwart" },
    aScheme(),
    discardTopOfDeck,
    removeThreat(scaled(totalPrintedResources(MILLED), { plus: 3 }), chosen("scheme")),
  ),

  "40043.jackpot-response": inDiscard(response(on.thisDiscardedFromYourDeck(), moveCards(cards(self), "deckShuffle"))),
});
