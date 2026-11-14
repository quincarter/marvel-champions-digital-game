import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  defineAbilities,
  draw,
  each,
  giveHeldBoostCard,
  giveTough,
  ifThen,
  modifyBasicPower,
  query,
  self,
  shuffleIntoSeparateDeck,
  usingBasicPower,
  whenRevealed,
} from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/ninja-deck` (docs/phase7-elektra-iron-fist.md): the three Ninja cards,
 * encounter treacheries of Elektra's separate Ninja deck (63001b; owner decision 2A, 2026-11-14, provisional: built at
 * setup, none in the encounter deck until her abilities shuffle one in, `shuffleTopOfSeparateDeckIntoEncounterDeck`).
 * Once there a card is the scenario's (no owner), so whoever reveals it, it goes to Elektra.
 *
 * "Elektra" is her hero face only (`query("hero", { name: "Elektra" })`): "Since 'Elektra' and 'Elektra Natchios' are
 * two different card names, the Boost abilities on the Ninja cards would not register 'Elektra' as activating or being
 * in play if she were in Alter-Ego form, and they would be discarded to the encounter deck discard pile" (ruling October
 * 12, 2026 - Ruling 2). The same reading is taken for When Revealed: with no Elektra hero in play nothing is given and
 * the treachery is discarded as usual.
 *
 * **When Revealed**: "Give this card to Elektra as a facedown boost card": held for her next basic power
 *   (`giveHeldBoostCard`, ruling September 10, 2026 - Ruling 3 (A)). Surge is a printed keyword.
 * **Boost**: "If Elektra is using a basic power, [X] and shuffle this card into the Ninja deck. Otherwise, give this
 *   card to Elektra as a facedown boost card." Her basic defense counts while a villain's attack turns its boost cards
 *   up, so a Ninja card dealt as the villain's boost card then resolves the first half (rules verdict Q3). "You" is the
 *   card's resolver: her controller as her own card, the defending player as an enemy's.
 *
 * Cards (3):
 * - 63002 Ninja Stars (treachery)
 * - 63003 Ninja Strike (treachery)
 * - 63004 Ninja Vanish (treachery)
 */
const ELEKTRA = each(query("hero", { name: "Elektra" }));
const ELEKTRA_USING_A_BASIC_POWER = usingBasicPower(query("hero", { name: "Elektra" }));

const toElektra = giveHeldBoostCard(ELEKTRA, { card: self });
const ninjaBoost = (...using: Parameters<typeof ifThen>[1][]) =>
  boost(ifThen(ELEKTRA_USING_A_BASIC_POWER, [...using, shuffleIntoSeparateDeck(self)], toElektra));

export const ELEKTRA_ELEKTRA_NINJA_DECK: AbilityRegistry = defineAbilities({
  "63002.when-revealed": whenRevealed(toElektra),
  "63002.boost": ninjaBoost(draw(2)),
  "63003.when-revealed": whenRevealed(toElektra),
  "63003.boost": ninjaBoost(modifyBasicPower(3)),
  "63004.when-revealed": whenRevealed(toElektra),
  "63004.boost": ninjaBoost(giveTough(ELEKTRA)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None is left. */
export const ELEKTRA_ELEKTRA_NINJA_DECK_SKIPPED: Readonly<Record<string, string>> = {};
