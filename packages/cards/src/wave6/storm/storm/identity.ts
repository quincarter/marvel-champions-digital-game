import { trait } from "@mc/content";
import {
  action,
  chooseCards,
  chosen,
  coveredByEngineRule,
  defineAbilities,
  oncePerRound,
  putIntoPlay,
  query,
  resolveSpecials,
  setup,
  shuffleSeparateDeck,
  swapCards,
  you,
} from "../../../dsl/index.js";
import type { CardSelector, TargetRef } from "@mc/engine";

/** The name of Storm's separate deck, matching `HeroIdentityCard.separateDecks[0].name` (36001a). */
export const WEATHER_DECK = "Weather";
const WEATHER = trait("WEATHER");

/** "A support from the WEATHER deck": every card of it is one, but the text names the type. */
const fromWeatherDeck: CardSelector = {
  kind: "separateDeck",
  player: you,
  name: WEATHER_DECK,
  filter: query("support"),
};
/** "Your WEATHER support in play". */
const yourWeatherSupport = query("support", { trait: WEATHER, controller: "you" });
const yourWeatherSupportRef: TargetRef = { kind: "each", query: yourWeatherSupport };

/**
 * Storm / Ororo Munroe (36001a/b): docs/phase7-wave6.md §6.2, §3.45-§3.47, §4.1 Q26. Her four WEATHER supports
 * (36002-36005) form a facedown deck beside her identity, built by setup (`HeroIdentityCard.separateDecks`); their
 * scripts are in `weather.ts`.
 *
 * - **36001b.ororo-munroe-constant**: "Ororo Munroe begins the game with a WEATHER deck. (See insert.)" Reminder text:
 *   setup builds and shuffles the deck (§3.46), as Doctor Strange's Invocation deck (`wave1/drs/kit.ts`).
 * - **"I feel a storm coming..." (36001b)**: "Setup: Choose a support from the WEATHER deck and put it into play." The
 *   choice looks through a facedown deck, so it is a search and the deck is shuffled after (RRG 1.8 "Search", p. 39).
 * - **Weather Control (36001a)**: "Action: Swap your WEATHER support in play with a support of your choice from the
 *   WEATHER deck. Resolve the 'Special' ability on your WEATHER support in play. (Limit once per round)." Printed
 *   "Action:" on the hero face, so live in hero form only (as Spell Mastery, 09001a). The swap is RRG 1.8 "'Swap'"
 *   (p. 42; §3.47): two supports of different titles, so the one in play leaves play into the chosen card's place in
 *   the deck, facedown, and the chosen one enters play ready; Storm's own ability may move her permanent supports (RRG
 *   1.8 "Permanent", p. 32: same set). The deck was searched, so it is shuffled; then the Special of the support now in
 *   play resolves. The Special is not after a "then", so it resolves even if the swap could not be completed.
 */
export const STORM_IDENTITY = defineAbilities({
  "36001b.ororo-munroe-constant": coveredByEngineRule(),

  "36001b.i-feel-a-storm-coming": setup(
    chooseCards("weather", fromWeatherDeck, { min: 1, max: 1 }),
    putIntoPlay(chosen("weather"), you),
    shuffleSeparateDeck(WEATHER_DECK),
  ),

  "36001a.weather-control": action(
    { limit: oncePerRound },
    chooseCards("weather", fromWeatherDeck, { min: 1, max: 1 }),
    swapCards(yourWeatherSupportRef, chosen("weather")),
    shuffleSeparateDeck(WEATHER_DECK),
    resolveSpecials(yourWeatherSupport),
  ),
});
