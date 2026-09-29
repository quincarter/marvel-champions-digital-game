import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { inst, instancesOf, toHero, endTurn, P1 } from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const mysterioGame = () =>
  startWave5Game(ghostSpiderScenario("mysterio", { seed: 1, modularSetIds: [encounterSetId("bomb_scare")] }));

describe("Maze of Mirrors (27087a/b): Setup", () => {
  it("27087a.setup: puts a Shifting Apparition minion into play engaged with each player", () => {
    const state = mysterioGame();
    // A minion enters the engaged player's own play area, not the villain area (`resolve/apply-effect.ts`'s own
    // `putIntoPlay` case): find it by engagement, not by `state.villainArea`.
    const engaged = instancesOf(state, "27091").filter((id) => inst(state, id).engagedWith !== null);
    expect(engaged.length).toBe(1); // one player
    expect(inst(state, engaged[0]!).engagedWith).toBe(P1);
    expect(inst(state, engaged[0]!).faceup).toBe(true);
  });
});

/** Puts `code` (an unowned encounter card already in the encounter deck) onto the top of `player`'s deck for the
 * forced interrupt to catch on the next draw (MC27 p. 13's own "Encounter Cards in Your Player Deck"; test surgery,
 * since nothing else yet deals a specific encounter card into a player's deck on demand). */
function stackPlayerDeckWithEncounterCard(
  state: GameState,
  code: string,
): { readonly state: GameState; readonly id: string } {
  const pile = activeEncounterDeck(state);
  const deckId = activeEncounterDeckId(state);
  const id = pile.deck.find((candidate) => state.instances[candidate]?.cardId === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((c) => c !== id) } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [id, ...p.deck] } : p)),
    },
  };
}

describe('Maze of Mirrors 1B / Edge of Reality 2B: "encounter card from your deck" Forced Interrupt', () => {
  it("27087b.maze-of-mirrors-forced-interrupt: a drawn encounter card is dealt facedown instead, and a replacement is drawn", () => {
    const state = mysterioGame();
    // Thin the hand to below hand size first: RRG 1.8 Appendix II's own "discard down, then draw back up to hand
    // size" (`flow.ts` `executeEndPhaseDraw`) only pulls from the deck when the hand is short, and a kept 6-card
    // mulligan hand against a 5-card hand size never needs to draw at all this round otherwise.
    const thinned: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, discard: [...p.discard, ...p.hand.slice(2)], hand: p.hand.slice(0, 2) } : p,
      ),
    };
    // Advance (01186, Core Standard): no When Revealed of its own, so nothing else moves it once dealt.
    const { state: staged, id: encounterCard } = stackPlayerDeckWithEncounterCard(thinned, "01186");
    const { events } = driveEvents(WAVE5_DEPS, staged, toHero(P1), endTurn(P1));
    const forThatCard = events.filter((e) => JSON.stringify(e).includes(encounterCard));
    // Drawn once (into hand)...
    expect(forThatCard.some((e) => e.type === "cardDrawn" && "instanceId" in e && e.instanceId === encounterCard)).toBe(
      true,
    );
    // ...then the Forced Interrupt catches it: moved from hand to the dealt-encounter-card area, never staying in hand.
    expect(
      forThatCard.some(
        (e) =>
          e.type === "cardMoved" &&
          "to" in e &&
          e.to.kind === "dealtEncounter" &&
          "from" in e &&
          e.from.kind === "hand",
      ),
    ).toBe(true);
    // A second, distinct card was drawn as the interrupt's own "draw 1 card" replacement.
    const drawnInstanceIds = new Set(
      events.flatMap((e) => (e.type === "cardDrawn" && "instanceId" in e ? [e.instanceId] : [])),
    );
    expect(drawnInstanceIds.size).toBeGreaterThanOrEqual(2);
  });
});
