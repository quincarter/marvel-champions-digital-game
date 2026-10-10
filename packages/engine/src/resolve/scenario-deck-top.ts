/**
 * A scenario deck whose top card is in play (`ScenarioSeparateDeck.topCardInPlay`; docs/phase7-wave9.md §3.17). The
 * Holding Cell deck, M.O.D.O.K., MC50 p. 13: "shuffle together the four double-sided Holding Cell cards, each with an
 * Inhuman ally on the reverse. Place this deck near the main scheme with its Holding Cell side faceup. The top card of
 * this deck is in play. When a Holding Cell enters play, either during setup or when the last lock counter is removed
 * from the previous top card of the Holding Cell deck, the text on the Holding Cell places 2[per_hero] lock counters on
 * that card."
 *
 * How it is held. The card in play is an ordinary card in play: it sits where its type lives (an environment in the
 * villain's area, under no player's control), its abilities are active and every in-play query finds it.
 * `ScenarioDeckState.inPlayTopId` names it, and `ScenarioDeckState.deck` holds only the cards under it, which are out
 * of play in a deck zone: no ability of theirs is active (RRG 1.8 "In Play and Out of Play", p. 23) and no viewer sees
 * their faces (`visibility.ts`). `scenarioDeckCards` reads the whole deck, top card first.
 *
 * One function keeps that true, `settleScenarioDeckTops`. It is run when the deck is built, when cards have been moved
 * into a scenario deck, and by `runFlow` before every frame and step, so the deck never resolves anything with a stale
 * top card:
 * - The top card stops being the deck's top card when it leaves play, or when it is in play showing a face the deck is
 *   not made of: a Holding Cell that flipped to its Inhuman ally (RRG 1.8 "Flip", p. 20: the card never left play, and
 *   as another card type it kept nothing). The deck is made of the faces its `contents` name (`scenarioDeckIsMadeOf`).
 * - With no top card in play and a card in the deck, the deck's first card enters play.
 *
 * What "enters play" means for it. The card is put into play, not revealed: it goes where its type goes with what it
 * enters play with (`enterPlayOnReveal`), and a `cardEntersPlay` event follows, whose apply step resolves its
 * enter-play keywords and whose windows hold the card's own "Enters play with 2[per_hero] lock counters on it" (the
 * rulebook's "the text on the Holding Cell places" them). No When Revealed, surge or incite resolves (RRG 1.8 "When
 * Revealed Abilities", p. 48: an encounter card "put into play without being revealed" does not trigger it), and no
 * player is dealt or engaged anything: the entry is attributed to the first player, as a setup card's is.
 *
 * A card placed into the deck (`moveCards` to the deck, `toScenarioDeck`) goes in showing the deck's face
 * (`showScenarioDeckFace`): "flip it and place it on the bottom of the Holding Cell deck". Under a deck with cards it
 * waits its turn. Under a deck with no card left and none in play it is the top card and enters play at once (MC50
 * p. 22: "The Inhuman ally that leaves play flips over and becomes the only card in the Holding Cell deck. Resolve the
 * 'enters play' text on its Holding Cell side by placing lock counters on it.").
 *
 * The deck has run out (`TriggerEvent deckRanOut`) when its top card leaves it with no card under it, not when its
 * last card comes up into play.
 */

import type { CardId } from "@mc/content";
import { type Ctx, emit, updateInstance } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import { getInstance } from "../query.js";
import { cardsInPlay } from "../select.js";
import type { GameState, ScenarioDeckState } from "../state.js";
import { enterPlayOnReveal } from "./reveal.js";

/**
 * Whether a card (one face) is of the scenario deck `name`, as its `contents` say: what `buildScenarioDeck` gathers,
 * and for a `topCardInPlay` deck what its top card must still be showing to be its top card. `cardIds` alone names
 * every card of the deck; with other fields it adds to what they match (docs/phase7-wave6.md §3.66).
 */
export function scenarioDeckIsMadeOf(state: GameState, name: string, cardId: CardId): boolean {
  const contents = state.scenarioDecks[name]?.contents;
  const card = state.cardPool[cardId];
  if (!contents || !card) return false;
  const { encounterSetIds, cardType, trait, cardIds } = contents;
  if (cardIds?.includes(card.id)) return true;
  if (encounterSetIds === undefined && cardType === undefined && trait === undefined) return false;
  if (cardType !== undefined && card.type !== cardType) return false;
  if (trait !== undefined && !("traits" in card && (card.traits as readonly string[]).includes(trait))) return false;
  return (
    encounterSetIds === undefined ||
    ("encounterSetIds" in card && card.encounterSetIds.some((set: string) => encounterSetIds.includes(set)))
  );
}

/**
 * Every card of a scenario deck in order, top card first: for a `topCardInPlay` deck its card in play, then the cards
 * under it; for any other deck its `deck` list as it is. Empty for a deck the game does not have.
 */
export function scenarioDeckCards(state: GameState, name: string): readonly InstanceId[] {
  const piles = state.scenarioDecks[name];
  if (!piles) return [];
  return piles.inPlayTopId !== undefined ? [piles.inPlayTopId, ...piles.deck] : piles.deck;
}

/** The scenario deck whose top card in play this is (`ScenarioDeckState.inPlayTopId`), or null. */
export function scenarioDeckWithTop(state: GameState, id: InstanceId): string | null {
  for (const [name, piles] of Object.entries(state.scenarioDecks)) if (piles.inPlayTopId === id) return name;
  return null;
}

/**
 * A card that has just been put into a `topCardInPlay` deck shows the face the deck is made of (MC50 p. 13: the deck
 * sits "with its Holding Cell side faceup"; the Inhuman allies' "flip it and place it on the bottom of the Holding Cell
 * deck"). The card is out of play, so this is no flip in play: nothing is on it to discard and no `cardFlipped` event
 * follows; the log line is the one a turned-over card writes. A card already showing a face of the deck, one with no
 * other face, and one neither of whose faces is of the deck are left as they are.
 */
export function showScenarioDeckFace(ctx: Ctx, id: InstanceId, name: string): void {
  const piles = ctx.state.scenarioDecks[name];
  const instance = getInstance(ctx.state, id);
  if (!piles?.topCardInPlay || !instance || !piles.deck.includes(id)) return;
  if (scenarioDeckIsMadeOf(ctx.state, name, instance.cardId)) return;
  const from = ctx.state.cardPool[instance.cardId];
  const to = from?.otherFaceId !== undefined ? ctx.state.cardPool[from.otherFaceId] : undefined;
  if (!from || !to || !scenarioDeckIsMadeOf(ctx.state, name, to.id)) return;
  updateInstance(ctx, id, (i) => ({ ...i, cardId: to.id, flipped: false }));
  emit(ctx, {
    type: "cardFlippedToOtherFace",
    instanceId: id,
    from: from.id,
    to: to.id,
    typeChanged: from.type !== to.type,
  });
}

/**
 * Whether a double-sided card leaving play for an area of kind `requested` stays in the game, against RRG 1.8
 * "Double-Sided Card" (p. 17: "When a double-sided card would enter an out-of-play area other than the victory display
 * or set-aside area, it is removed from the game"). True for a card of a `topCardInPlay` deck (its `home`) that
 * - shows the face the deck is not made of (an Inhuman ally): Strong Inhuman, `aos` 50108b, "Forced Response: After this
 *   card leaves play, flip it and place it on the bottom of the Holding Cell deck", and MC50 p. 22, "The Inhuman ally
 *   that leaves play flips over and becomes the only card in the Holding Cell deck". The card's own text and the
 *   product's rules put it back in a deck, which a card removed from the game could not be (ruling Dec 17, 2025 (4):
 *   it "cannot be returned to the game by any means"); so it goes where it was sent (a defeated ally to the discard
 *   pile its deck's `discardPile` names) and its response takes it from there; or
 * - is going into a scenario deck: the deck is itself an out-of-play area that holds these cards.
 * A Holding Cell side discarded from play has no such text and is removed from the game as the RRG says.
 */
export function staysInGameForScenarioDeck(state: GameState, id: InstanceId, requested: string): boolean {
  const instance = getInstance(state, id);
  if (instance?.home.kind !== "scenarioDeck") return false;
  const name = instance.home.name;
  if (!state.scenarioDecks[name]?.topCardInPlay) return false;
  if (requested === "scenarioDeck") return true;
  const other = state.cardPool[instance.cardId]?.otherFaceId;
  return (
    other !== undefined &&
    !scenarioDeckIsMadeOf(state, name, instance.cardId) &&
    scenarioDeckIsMadeOf(state, name, other)
  );
}

const setPiles = (ctx: Ctx, name: string, piles: ScenarioDeckState): void => {
  ctx.state = { ...ctx.state, scenarioDecks: { ...ctx.state.scenarioDecks, [name]: piles } };
};

/** Whether the deck's recorded top card is still that: in play, showing a face the deck is made of. */
function stillOnTop(state: GameState, name: string, id: InstanceId): boolean {
  const instance = getInstance(state, id);
  return (
    instance !== undefined && cardsInPlay(state).includes(id) && scenarioDeckIsMadeOf(state, name, instance.cardId)
  );
}

/**
 * Keeps "the top card of this deck is in play" true for every `topCardInPlay` deck (see the file comment): a top card
 * that left play or flipped to a face the deck is not made of is no longer the deck's, and with none in play the
 * deck's first card enters play. Does nothing, and logs nothing, in a game with no such deck or with every such deck
 * already settled. Returns true when a card entered play.
 */
export function settleScenarioDeckTops(ctx: Ctx): boolean {
  let entered = false;
  for (const name of Object.keys(ctx.state.scenarioDecks)) {
    if (!ctx.state.scenarioDecks[name]?.topCardInPlay) continue;
    // A deck not yet built has no top card: its first card enters play when it is built (`buildScenarioDeck`).
    if (ctx.state.outcome) return entered;
    if (settleOne(ctx, name)) entered = true;
  }
  return entered;
}

function settleOne(ctx: Ctx, name: string): boolean {
  let entered = false;
  // Bounded by the deck: each turn of the loop takes one card out of it. More than one turn only when the card that
  // came up could not stay in play (an attachment with nothing to attach to; RRG 1.8 "Attach To", p. 8).
  for (;;) {
    const piles = ctx.state.scenarioDecks[name];
    if (!piles) return entered;
    const top = piles.inPlayTopId;
    if (top !== undefined) {
      if (stillOnTop(ctx.state, name, top)) return entered;
      const { inPlayTopId: _left, ...rest } = piles;
      setPiles(ctx, name, rest);
      emit(ctx, { type: "scenarioDeckTopLeft", name, instanceId: top });
      // "After the [name] deck runs out" (docs/phase7-wave4.md §3.11): its top card left with no card under it.
      if (rest.deck.length === 0) {
        ctx.state = {
          ...ctx.state,
          pendingDeckRunOuts: [...(ctx.state.pendingDeckRunOuts ?? []), { deck: "scenario", name }],
        };
      }
      continue;
    }
    const [next] = piles.deck;
    if (next === undefined) return entered;
    // Named as the top card before it moves, so the move out of `deck` is not read as the deck running out.
    setPiles(ctx, name, { ...piles, inPlayTopId: next });
    updateInstance(ctx, next, (i) => ({ ...i, faceup: true }));
    emit(ctx, { type: "scenarioDeckTopEnteredPlay", name, instanceId: next });
    enterPlayOnReveal(ctx, next, ctx.state.firstPlayerId);
    entered = true;
    if (ctx.state.outcome) return entered;
  }
}
