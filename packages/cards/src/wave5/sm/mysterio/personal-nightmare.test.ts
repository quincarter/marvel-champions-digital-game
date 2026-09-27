import { encounterSetId } from "@mc/content";
import { handSize, type GameEvent } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { inst, instancesOf, playerOf, stackEncounterDeck, toHero, endTurn, P1 } from "../../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea } from "../../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const mysterioGame = () =>
  startWave5Game(ghostSpiderScenario("mysterio", { seed: 1, modularSetIds: [encounterSetId("bomb_scare")] }));

/**
 * How many cards `player` held in hand right when `revealedCardId` was revealed: the initial hand, adjusted for
 * every `cardDrawn`/`cardDiscardedFromHand`/hand-leaving `cardMoved` event strictly before its own
 * `encounterCardRevealed`. Ghost-Spider's own kit (27006, a card that discards itself early in the round) changes
 * her hand between game start and the villain phase's own reveal step, so "the number of cards in your hand" for
 * Weakness from Within/Deepest Fears has to be read at the reveal, not at the start of the round.
 */
function handCountAtReveal(
  handBefore: number,
  events: readonly GameEvent[],
  player: string,
  revealedCardId: string,
): number {
  const revealIndex = events.findIndex(
    (e) => e.type === "encounterCardRevealed" && e.instanceId === revealedCardId && e.playerId === player,
  );
  if (revealIndex < 0) throw new Error(`${revealedCardId} was never revealed to ${player}`);
  let count = handBefore;
  for (const event of events.slice(0, revealIndex)) {
    if (event.type === "cardDrawn" && event.playerId === player) count += 1;
    else if (event.type === "cardDiscardedFromHand" && event.playerId === player) count -= 1;
    else if (
      event.type === "cardMoved" &&
      event.from.kind === "hand" &&
      event.from.playerId === player &&
      event.to.kind !== "discard"
    ) {
      count -= 1;
    }
  }
  return count;
}

describe("Fool's Paradise (27155)", () => {
  it("27155.fools-paradise-constant: each identity gets +2 hand size", () => {
    const state = mysterioGame();
    const before = handSize(state, P1, WAVE5_DEPS);
    const { state: withCard } = encounterCardInVillainArea(state, "27155");
    expect(handSize(withCard, P1, WAVE5_DEPS)).toBe(before + 2);
  });
});

describe("Weakness from Within (27156)", () => {
  it("27156.when-revealed: places 1 additional threat here for each card in your hand", () => {
    const state = mysterioGame();
    const handBefore = playerOf(state, P1).hand.length;
    const stacked = stackEncounterDeck(state, "01186", "27156");
    const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    const card = instancesOf(after, "27156")[0]!;
    const handCount = handCountAtReveal(handBefore, events, P1, card);
    expect(inst(after, card).threat).toBe(1 + handCount); // 1 startingThreat (data) + 1 per hand card
  });
});

describe("Deepest Fears (27157)", () => {
  it("27157.when-revealed: discards cards from the top of your deck equal to your hand size; identity-specific discard places threat, otherwise you take damage", () => {
    const state = mysterioGame();
    const handBefore = playerOf(state, P1).hand.length;
    const deckBefore = playerOf(state, P1).deck.length;
    const stacked = stackEncounterDeck(state, "01186", "27157");
    const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    // Deepest Fears prints 2 copies (quantityInSet): the one this round actually reveals, not necessarily
    // `instancesOf`'s own first hit.
    const revealed = events.find(
      (e) => e.type === "encounterCardRevealed" && e.cardId === "27157" && e.playerId === P1,
    );
    if (revealed?.type !== "encounterCardRevealed") throw new Error("Deepest Fears was never revealed");
    const card = revealed.instanceId;
    const handCount = handCountAtReveal(handBefore, events, P1, card);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore - handCount);
    const placedThreat = events.some((e) => e.type === "threatPlaced" && e.sourceInstanceId === card);
    const tookDamage = events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === card);
    // Exactly one of the two printed branches fires, depending on whether an identity-specific card was among the
    // discards (Ghost-Spider's own precon carries several, so this is not a coin flip in practice, but either
    // outcome is a legal reveal).
    expect(placedThreat).not.toBe(tookDamage);
  });
});
