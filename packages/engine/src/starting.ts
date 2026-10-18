import { emit, moveCard, requestChoice, setStep, updatePlayer, type Ctx } from "./ctx.js";
import { EngineInvariantError } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { unblankedPrintedKeywordsOf } from "./keywords.js";
import { mustPlayer, playerOrder } from "./query.js";
import { shuffleSearchedDecks } from "./resolve/find.js";
import type { GameState } from "./state.js";
import { displayNameOf } from "./visibility.js";

/**
 * The Starting keyword (docs/phase7-wave11.md §3.6, hero-pack spec H3.17). RRG 1.8 has no entry; the Fear No Evil
 * rulebook (MC60 p. 3) defines it: "Each deck cannot include more than one card with starting. Before drawing their
 * starting hand during player setup, each player with a starting card in their deck may search their deck for that
 * card and add it as the first card of their starting hand. That card does count against their hand size and can be
 * discarded for the mulligan."
 *
 * It runs inside the `drawStartingHands` step, before its draw (so after every campaign window and every deck surgery
 * of setup): each player in player order whose deck holds a Starting card is asked once (`takeStartingCard`). Taking
 * it moves the card to hand (appended: the hand is usually still empty, but a campaign's earlier search may already
 * have put a card there, and hand order carries no rule), shuffles the deck (RRG 1.8 "Search", p. 39) and credits the hand one card
 * (`startingHandCredit`, the credit `countTowardStartingHand` uses), so step 14 draws one fewer. Declining searches
 * nothing. The one-per-deck rule is a deckbuilding check (`validateDeck`, `starting_limit`); should an unvalidated deck
 * hold several, every one is offered and at most one is taken. A game with no Starting card sees no change at all.
 */

/** The cards in `playerId`'s deck with the printed Starting keyword, in deck order. */
export function startingCardsInDeck(state: GameState, playerId: PlayerId): readonly InstanceId[] {
  return mustPlayer(state, playerId).deck.filter((id) =>
    unblankedPrintedKeywordsOf(state, id).some((keyword) => keyword.name === "starting"),
  );
}

/**
 * Asks the next player in player order who has not been offered yet and has a Starting card in their deck. `false`
 * when nobody is left to ask: the step's draw goes ahead.
 */
export function offerStartingCard(ctx: Ctx): boolean {
  const step = ctx.state.step;
  if (step.kind !== "drawStartingHands") return false;
  const offered = step.startingOffered ?? [];
  for (const player of playerOrder(ctx.state)) {
    // A seat sitting the scenario out draws no hand (`EffectSpec sitOutScenario`), so it is not offered one either.
    if (player.eliminated || offered.includes(player.playerId)) continue;
    const cards = startingCardsInDeck(ctx.state, player.playerId);
    if (cards.length === 0) continue;
    requestChoice(ctx, {
      playerId: player.playerId,
      prompt: { kind: "takeStartingCard" },
      options: cards.map((id) => ({
        optionId: id,
        label: displayNameOf(ctx.state, id),
        ref: { kind: "card", instanceId: id },
      })),
      minSelections: 0,
      maxSelections: 1,
    });
    return true;
  }
  return false;
}

/** The answer to `takeStartingCard`: `selected` is empty (declined) or the one Starting card taken. */
export function afterStartingCardChoice(ctx: Ctx, playerId: PlayerId, selected: readonly InstanceId[]): void {
  const step = ctx.state.step;
  if (step.kind !== "drawStartingHands") {
    throw new EngineInvariantError("a Starting card was chosen outside the starting-hand step");
  }
  const [taken] = selected;
  if (taken) {
    moveCard(ctx, taken, { kind: "hand", playerId });
    shuffleSearchedDecks(ctx, [{ kind: "deck", playerId }]);
    // "That card does count against their hand size": one card fewer is drawn at step 14.
    const credit = (mustPlayer(ctx.state, playerId).startingHandCredit ?? 0) + 1;
    updatePlayer(ctx, playerId, (p) => ({ ...p, startingHandCredit: credit }));
    emit(ctx, { type: "startingHandCredited", playerId, amount: 1, credit });
  }
  setStep(ctx, { ...step, startingOffered: [...(step.startingOffered ?? []), playerId] });
}
