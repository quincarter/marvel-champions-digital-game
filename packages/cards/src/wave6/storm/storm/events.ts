import { trait } from "@mc/content";
import type { CardSelector, TargetRef } from "@mc/engine";
import {
  attackInProgress,
  chooseCards,
  choosePlayer,
  chosen,
  chosenPlayer,
  dealDamage,
  defineAbilities,
  divide,
  each,
  heroAction,
  heroInterrupt,
  ifElse,
  modifyStatOf,
  query,
  resolveSpecials,
  shuffleSeparateDeck,
  swapCards,
  theAffectedCard,
  theVillain,
  when,
  you,
  YOUR_IDENTITY,
  anEnemy,
} from "../../../dsl/index.js";
import { WEATHER_DECK } from "./identity.js";

const WEATHER = trait("WEATHER");
/** "A support of your choice from the WEATHER deck" (Weather Control's search, `identity.ts`). */
const fromWeatherDeck: CardSelector = {
  kind: "separateDeck",
  player: you,
  name: WEATHER_DECK,
  filter: query("support"),
};
/** "Your WEATHER support in play". */
const yourWeatherSupport = query("support", { trait: WEATHER, controller: "you" });
const yourWeatherSupportRef: TargetRef = { kind: "each", query: yourWeatherSupport };
/** "If [title] is in play, resolve its 'Special' ability": nothing resolves if no such support is in play. */
const specialOf = (title: string) => resolveSpecials(query("support", { trait: WEATHER, name: title }));

/**
 * Storm's identity-specific events (`storm` 36009-36013), docs/phase7-wave6.md §6.2, §3.47.
 *
 * - **Weather Goddess (36009)**: Weather Control's swap without the round limit (`identity.ts`; RRG 1.8 "'Swap'", p.
 *   42): the chosen support enters play ready, the outgoing one goes facedown into the deck, which is then shuffled; the
 *   Special of the support now in play resolves even if the swap could not be completed.
 * - **Torrential Rain (36010)**: "(thwart)" is a label only: removing threat is not a thwart (no crisis, no thwart
 *   triggers), and the 3 is divided among schemes like Inconspicuous (`04038`). Hurricane's Special only if it is in play.
 * - **Lightning Bolt (36011)**: "(attack)" is a label only: 8 damage is not an attack (no guard, no retaliate). The
 *   enemy is any enemy, chosen by the player.
 * - **Flash Freeze (36012)**: interrupt to the villain attacking Storm herself, not an ally (ruling Dec 17, 2025 (3):
 *   it triggers "when" the villain attacks, so it is playable only when Storm is attacked). The -3 ATK is lasting for the
 *   phase and applies only while the villain or an engaged minion is attacking her (the amount is read per attacker,
 *   `theAffectedCard`). The minions are the ones engaged with her while the phase lasts, a live set rather than a
 *   snapshot at play.
 * - **Blast of Wind (36013)**: Hawkeye's Explosive Arrow shape: plain damage, not an attack.
 */
export const STORM_EVENTS = defineAbilities({
  "36009.weather-goddess-action": heroAction(
    chooseCards("weather", fromWeatherDeck, { min: 1, max: 1 }),
    swapCards(yourWeatherSupportRef, chosen("weather")),
    shuffleSeparateDeck(WEATHER_DECK),
    resolveSpecials(yourWeatherSupport),
  ),

  "36010.torrential-rain-action": heroAction(
    { label: "thwart" },
    divide("threat", 3, query("scheme")),
    specialOf("Hurricane"),
  ),

  "36011.lightning-bolt-action": heroAction(
    { label: "attack" },
    anEnemy("enemy"),
    dealDamage(8, chosen("enemy")),
    specialOf("Thunderstorm"),
  ),

  "36012.flash-freeze-interrupt": heroInterrupt(
    when.villainAttacks({ againstYou: true }),
    { label: "defense" },
    modifyStatOf(
      "atk",
      ifElse(attackInProgress({ attacker: theAffectedCard, target: YOUR_IDENTITY }), -3, 0),
      query("villain"),
      "endOfPhase",
    ),
    modifyStatOf(
      "atk",
      ifElse(attackInProgress({ attacker: theAffectedCard, target: YOUR_IDENTITY }), -3, 0),
      query("minion", { engagedWithPlayer: you }),
      "endOfPhase",
    ),
    specialOf("Blizzard"),
  ),

  "36013.blast-of-wind-action": heroAction(
    choosePlayer("player"),
    dealDamage(3, theVillain),
    dealDamage(3, each(query("minion", { engagedWithPlayer: chosenPlayer("player") }))),
    resolveSpecials(yourWeatherSupport),
  ),
});
