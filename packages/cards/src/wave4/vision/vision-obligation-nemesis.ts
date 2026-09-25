import {
  alterEgoAction,
  anyOfCards,
  chosen,
  defineAbilities,
  discardAtRandom,
  droneFromDeck,
  encounterCards,
  exhaustYourHero,
  forcedInterrupt,
  ifThen,
  inPlay,
  moveCards,
  cards,
  oneCopyOf,
  on,
  putIntoPlay,
  self,
  selectCards,
  setAside,
  shuffleEncounterDeck,
  whenRevealed,
  eachPlayer,
  firstPlayer,
  you,
} from "../../dsl/index.js";

/**
 * Corrupted Programming (26028), Vision's obligation, and his nemesis set: Ultron (26029, an ELITE minion — distinct
 * from Core's Ultron villain), Ultron Unleashed (26030, side scheme), Ultron Drones (26031, environment — an exact
 * reprint of Core's own 01140, aliased automatically by `../reprints.ts`, not scripted here) and Relentless Android
 * ×2 (26032, treachery).
 *
 * The "Drone" mechanic (a facedown top-of-deck card engaged as a 1/1/1 minion) is Core's own Ultron scenario
 * (`packages/cards/src/core/scenarios/ultron.ts`): `droneFromDeck`, `EACH_PLAYER_DRONE`'s
 * `droneFromDeck(eachPlayer)` shape and Ultron (II)'s own "put the top card of your deck into play … as you" are
 * reused verbatim rather than reinvented (docs/phase7-wave4.md §3.23 "Reusable as is").
 */
export const VISION_OBLIGATION_NEMESIS = defineAbilities({
  // Corrupted Programming (26028) — Give to the Vision player. Treat your mass form upgrade's text box as if it
  // were blank, except for keywords (KNOWN_SKIPPED: `blankTextBox` has no keyword exception yet, docs/phase7-
  // wave4.md §3.1's own "Not done" note and `../vision-kit.ts`'s module docblock — blanking would also strip the
  // `form` keyword, leaving Vision with no mass form at all, backwards from the printed card. See
  // `KNOWN_SKIPPED["vision"]` in `../coverage.test.ts`). Alter-Ego Action: Exhaust your identity → remove Corrupted
  // Programming from the game.
  "26028.corrupted-programming-action": alterEgoAction(
    { cost: exhaustYourHero },
    moveCards(cards(self), "removedFromGame"),
  ),

  // Ultron (nemesis minion, 26029) — Toughness (data). [star] Forced Interrupt: When Ultron attacks you, if Ultron
  // Drones is in play, put the top card of your deck into play facedown, engaged with you as a Drone minion. The
  // same shape as Core's own Ultron (II), 01135 (module docblock).
  "26029.ultron-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    ifThen(inPlay("Ultron Drones"), droneFromDeck(you)),
  ),

  // Ultron Unleashed (side scheme, 26030) — When Revealed: Search the encounter deck, discard pile, and set-aside
  // area for Ultron Drones and put it into play. Shuffle the encounter deck. Each player puts the top card of
  // their deck into play facedown, engaged with them as a Drone minion. The search-and-setup half mirrors Core's
  // own Crimson Cowl 1A Setup (01137a, `core/scenarios/ultron.ts`); the "each player" half is Core's own
  // `droneFromDeck(eachPlayer)` shape (module docblock).
  "26030.when-revealed": whenRevealed(
    selectCards(
      "drones",
      oneCopyOf(
        anyOfCards(
          encounterCards(["deck", "discard"], { name: "Ultron Drones" }),
          setAside(you, { name: "Ultron Drones" }),
        ),
      ),
    ),
    putIntoPlay(chosen("drones"), firstPlayer),
    shuffleEncounterDeck(),
    droneFromDeck(eachPlayer),
  ),

  // Relentless Android (treachery ×2, 26032) — When Revealed: If Ultron Drones is in play, put the top 2 cards of
  // your deck into play facedown, engaged with you as Drone minions. Otherwise, discard 2 random cards from your
  // hand.
  "26032.when-revealed": whenRevealed(ifThen(inPlay("Ultron Drones"), droneFromDeck(you, 2), discardAtRandom(2, you))),
});
