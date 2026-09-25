import { cardOf, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, patchInstance, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  attachedTo,
  deckId,
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  stackTop,
} from "./testing.js";

/**
 * Real-game tests for the Brothers Grimm modular set (`brothers-grimm.ts`): Brothers Grimm (24018), Blackbird
 * Pellets (24019), Corrosive Egg Bomb (24020), Paralytic Stardust (24021) and Unbreakable Thread (24022).
 *
 * A dealt facedown card resolves within the same villain phase's "Deal Encounter Cards" step that dealt it (RRG
 * 1.8 "Deal", p. 15: dealt cards are revealed immediately), so `PlayerState.dealtEncounter` reads empty again by
 * the time a full villain phase (`endTurn`) finishes — these tests confirm each ability actually ran via the exact
 * ability-resolved event instead of that transient zone.
 *
 * Ref -> covering test:
 *  24018.brothers-grimm-forced-interrupt -> "discards until an attachment is found and reveals it"
 *  24018.boost                           -> "puts Brothers Grimm into play engaged with the first player"
 *  24019.blackbird-pellets-forced-response -> "discards a card at random from hand"
 *  24020.corrosive-egg-bomb-forced-response -> "takes 3 indirect damage"
 *  24021.paralytic-stardust-forced-response -> "stuns your identity"
 *  24022.unbreakable-thread-forced-response -> "discards an ally/support/upgrade you control"
 */

const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed), "brothers_grimm");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

/** Puts one of `player`'s own ally/support/upgrade cards (from hand or deck) into their play area, so a "discard an
 * ally, support, or upgrade you control" cost has a legal target. */
function withAllyInPlay(state: GameState, player = P1): GameState {
  const seat = state.players.find((p) => p.playerId === player)!;
  const candidateId = [...seat.hand, ...seat.deck].find((id) => {
    const card = cardOf(state, id);
    return card && ["ally", "support", "upgrade"].includes(card.type);
  });
  if (!candidateId) throw new Error(`${player} has no ally/support/upgrade to place in play`);
  const withoutIt = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== candidateId),
            deck: p.deck.filter((i) => i !== candidateId),
            playArea: [...p.playArea, candidateId],
          }
        : p,
    ),
  };
  return patchInstance(withoutIt, candidateId, { faceup: true, controllerId: player });
}

describe("Brothers Grimm (24018-24022)", () => {
  it("24018.brothers-grimm-forced-interrupt: discards until an attachment is found and reveals it", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24018", P1);
    const { events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24018.brothers-grimm-forced-interrupt")).toBe(true);
  });

  it("24018.boost: after this activation ends, puts Brothers Grimm into play engaged with the first player", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = stackTop(base, "24018");
    const brothersId = staged.encounterDecks[deckId(staged)]!.deck[0]!;
    const activated = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(activated.instances[brothersId]?.engagedWith).toBe(P1);
  });

  it("24019.blackbird-pellets-forced-response: discards a card at random from hand", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const hosted = minionEngagedWith(base, "24018", P1);
    const staged = attachedTo(hosted.state, "24019", hosted.id);
    const { state: activated, events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24019.blackbird-pellets-forced-response")).toBe(true);
    expect(activated.encounterDecks[deckId(activated)]!.discard).toContain(staged.id);
  });

  it("24020.corrosive-egg-bomb-forced-response: takes 3 indirect damage", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const hosted = minionEngagedWith(base, "24018", P1);
    const staged = attachedTo(hosted.state, "24020", hosted.id);
    const { events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24020.corrosive-egg-bomb-forced-response")).toBe(true);
    const dealtIndirect = events.find(
      (e) => e.type === "damageDealt" && (e as { sourceInstanceId?: string }).sourceInstanceId === staged.id,
    ) as { readonly amount?: number } | undefined;
    expect(dealtIndirect?.amount).toBe(3);
  });

  it("24021.paralytic-stardust-forced-response: stuns your identity", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const hosted = minionEngagedWith(base, "24018", P1);
    const staged = attachedTo(hosted.state, "24021", hosted.id);
    const identity = staged.state.players[0]!.identity.instanceId;
    const { state: activated, events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24021.paralytic-stardust-forced-response")).toBe(true);
    expect(activated.instances[identity]?.statuses.stunned).toBeGreaterThanOrEqual(1);
  });

  it("24022.unbreakable-thread-forced-response: discards an ally/support/upgrade you control", () => {
    const base = withAllyInPlay(heroified(onStage(withSet(), 0), P1));
    const hosted = minionEngagedWith(base, "24018", P1);
    const staged = attachedTo(hosted.state, "24022", hosted.id);
    const allyId = staged.state.players[0]!.playArea[0]!;
    const { state: activated, events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24022.unbreakable-thread-forced-response")).toBe(true);
    expect(activated.encounterDecks[deckId(activated)]!.discard).toContain(staged.id);
    expect(activated.players[0]!.playArea).not.toContain(allyId);
  });
});
