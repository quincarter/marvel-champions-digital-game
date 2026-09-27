import { trait } from "@mc/content";
import {
  cards,
  defineAbilities,
  eachPlayer,
  encounterCards,
  eventPlayer,
  eventTarget,
  forEachPlayer,
  forcedResponse,
  ifThen,
  moveCards,
  moveCardsInto,
  on,
  refMatches,
  thatPlayer,
  whenRevealed,
  zone,
} from "../../../dsl/index.js";

const ILLUSION = trait("ILLUSION");

/**
 * Mysterio (`sm` 27084–27086, docs/phase7-wave5.md §2.2/§3.5): three stages, standard I–II, expert II–III. Each
 * stage's own "Seeds of Fear"/"Creeping Fear"/"Bound by Fear" star ability is a Forced Response reacting to
 * `boostCardResolved` (docs/phase7-wave5.md §3.5's own worked example, `wave5-primitives.test.ts`'s "Mysterio I
 * places the resolved boost card in your discard pile"); the data ids all read "-constant" though the printed
 * ability is a Forced Response (`@mc/content`'s own naming, not this file's).
 */
const boostCardWithIllusion = (destination: "discard" | "deckBottom" | "deckTop") =>
  forcedResponse(
    on.boostCardResolved("self"),
    // `anywhere: true`: the resolved boost card sits in the activation's own boost slot, not a play-area zone
    // `refMatches` reads by default (`select.ts`'s own `cardsInPlay` restriction, `Death-Glow`'s own precedent for
    // reading a card wherever it is).
    ifThen(
      refMatches(eventTarget, { trait: ILLUSION }, { anywhere: true }),
      moveCardsInto(cards(eventTarget), destination, eventPlayer),
    ),
  );

export const MYSTERIO = defineAbilities({
  // Mysterio (I) (27084, HP/ATK/SCH are data) — Seeds of Fear: after you resolve a boost card during Mysterio's
  // activation, place that card in your discard pile if it has the Illusion trait.
  "27084.mysterio-constant": boostCardWithIllusion("discard"),

  // Mysterio (II) (27085, HP/ATK/SCH are data) — When Revealed: in player order, shuffle the top card of the
  // encounter deck into each player's deck (facedown: MC27 p. 13, `EffectSpec moveCards.into`, docs/phase7-wave5.md
  // §3.5). Creeping Fear: as (I), but to the bottom of your deck instead.
  "27085.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, moveCardsInto(encounterCards(["deck"], undefined, 1), "deckShuffle", thatPlayer)),
  ),
  "27085.mysterio-constant": boostCardWithIllusion("deckBottom"),

  // Mysterio (III) (27086, HP/ATK/SCH are data) — When Revealed: discard the top 5 cards of each player's deck (no
  // `into`: each card discards to its own owner's discard pile, `EffectSpec moveCards`'s default). Bound by Fear: as
  // (I), but to the top of your deck instead.
  "27086.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, moveCards(zone("deck", thatPlayer, { top: 5 }), "discard")),
  ),
  "27086.mysterio-constant": boostCardWithIllusion("deckTop"),
});
