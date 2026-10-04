/**
 * The choice sheet's wording for a `lookAt` prompt (`EffectSpec lookAt`, "look at the top card of any deck"): the
 * player is shown cards and asked nothing. RRG 1.8 "Look, Looked-At" (p. 27): only the player resolving the ability
 * may look, and the cards stay where they are, in the same order.
 *
 * The engine offers the looked-at cards as the options; this names where they are ("the top card of the encounter
 * deck", "the top 2 cards of your deck") from the cards' own zones, so no card or ability is named here.
 */

import { encounterDeckOf, getPlayer, locateCard, type GameState, type PendingChoice, type PlayerId } from "@mc/engine";
import { playerName } from "./names.js";

/** Whose deck the cards are in, and at which positions — or null when they aren't all in one deck. */
function deckOfOptions(
  state: GameState,
  choice: Pick<PendingChoice, "options">,
  perspectiveId: PlayerId | null,
): { readonly name: string; readonly positions: readonly number[] } | null {
  let name: string | null = null;
  const positions: number[] = [];
  for (const option of choice.options) {
    if (option.ref.kind !== "card") return null;
    const zone = locateCard(state, option.ref.instanceId);
    let here: { readonly name: string; readonly order: readonly string[] } | null = null;
    if (zone?.kind === "encounterDeck") {
      here = { name: "the encounter deck", order: encounterDeckOf(state, zone.deckId).deck };
    } else if (zone?.kind === "deck") {
      const whose = zone.playerId === perspectiveId ? "your deck" : `${playerName(state, zone.playerId)}'s deck`;
      here = { name: whose, order: getPlayer(state, zone.playerId)?.deck ?? [] };
    } else if (zone?.kind === "separateDeck") {
      const deck = getPlayer(state, zone.playerId)?.separateDecks[zone.name]?.deck ?? [];
      here = { name: `the ${zone.name} deck`, order: deck };
    }
    if (!here || (name !== null && here.name !== name)) return null;
    name = here.name;
    positions.push(here.order.indexOf(option.ref.instanceId));
  }
  return name === null ? null : { name, positions };
}

/** "Look at the top card of the encounter deck" / "Look at the top 3 cards of your deck" / "Look at these cards". */
export function lookAtTitleOf(
  state: GameState,
  choice: Pick<PendingChoice, "options">,
  perspectiveId: PlayerId | null,
): string {
  const count = choice.options.length;
  const deck = deckOfOptions(state, choice, perspectiveId);
  if (deck) {
    const fromTop = [...deck.positions].sort((a, b) => a - b).every((position, index) => position === index);
    const what = count === 1 ? "card" : `${count} cards`;
    return fromTop
      ? `Look at the top ${what} of ${deck.name}`
      : `Look at ${count === 1 ? "a card" : what} in ${deck.name}`;
  }
  return count === 1 ? "Look at this card" : "Look at these cards";
}

/** The sheet's small print under the title for a look: what the player may do with it, which is only read it. */
export const LOOK_AT_ADVISORY = "Only you can see this · it stays where it is";

/** The caption over the cards: they can be read, not picked. */
export const LOOK_AT_CAPTION = "tap to read it";

/**
 * Owner decision Q74 (2026-10-03), RRG 1.8 "Look At": only the player resolving the ability may look at cards that
 * are otherwise hidden (they may tell the others whatever they like). A hot-seat table shares one screen, so with
 * more than one seat the faces wait behind a cover naming the looking player. A one-seat game has nobody to hide
 * them from, so there is no gate.
 */
export interface LookAtGate {
  /** The hero (or alter-ego) name of the seat that is looking. */
  readonly looker: string;
  /** "Only Gambit may look." */
  readonly headline: string;
  /** The cover's button: the headline and what to do about it. */
  readonly coverLabel: string;
}

/** The zones whose cards nobody may read: a deck's order and contents are secret (RRG 1.8 "Deck", p. 15). */
const DECK_ZONES: ReadonlySet<string> = new Set(["deck", "encounterDeck", "separateDeck", "scenarioDeck"]);

/**
 * Whether the choice puts facedown cards from a deck in front of the deciding player: a look ("look at the top 2
 * cards of the encounter deck → discard 1", Thief Extraordinaire's cost), a search, or ordering what a look found.
 * Read from the options themselves, the way the engine's own `faceVisible` reads a deck card that is face-visible only
 * because an open decision offers it, so no prompt kind or card is named here and a new look is covered when it ships.
 * A card that is faceup in its deck (an Invocation top card) is already open to everyone, and a hand or a discard pile
 * is open by rule (RRG 1.8 "Discard Pile", p. 16), so neither needs a cover.
 */
export function revealsDeckCards(state: GameState, choice: Pick<PendingChoice, "options">): boolean {
  return choice.options.some((option) => {
    if (option.ref.kind !== "card") return false;
    const zone = locateCard(state, option.ref.instanceId);
    return zone !== null && DECK_ZONES.has(zone.kind) && state.instances[option.ref.instanceId]?.faceup !== true;
  });
}

/**
 * The gate for this choice, or null when the faces may be drawn straight away (it shows no hidden card, or only one
 * seat). Every choice that shows one player cards from a deck is gated, not only the `lookAt` prompt.
 */
export function lookAtGateOf(
  state: GameState,
  choice: Pick<PendingChoice, "prompt" | "playerId" | "options">,
): LookAtGate | null {
  if (state.players.length < 2) return null;
  if (choice.prompt.kind !== "lookAt" && !revealsDeckCards(state, choice)) return null;
  const looker = playerName(state, choice.playerId);
  const headline = `Only ${looker} may look.`;
  return { looker, headline, coverLabel: `${headline} Tap to reveal` };
}

/** The sheet's small print for a look: names the looking seat on a shared screen, where "you" would be anyone. */
export function lookAtAdvisoryOf(
  state: GameState,
  choice: Pick<PendingChoice, "prompt" | "playerId" | "options">,
): string {
  const gate = lookAtGateOf(state, choice);
  return gate ? `Only ${gate.looker} can see this · it stays where it is` : LOOK_AT_ADVISORY;
}
