/**
 * Rules audit, cause `obligation-other-game-area`. FFG ruling Sep 21, 2023 (post-RRG 1.5 #89): a player who reveals
 * another player's identity-specific obligation while that player is in a different game area (Kang Stage 2B) treats it
 * "as if the player was eliminated from the game: ignore the obligation's ability, remove it from the game, and reveal a
 * new encounter card to replace it. (Otherwise, play with the obligation as normal.)" RRG 1.8 "Obligation" (p. 30): "If
 * an obligation cannot be given to the specified player for any reason, ignore the card's ability, remove it from the
 * game, and reveal an additional encounter card."
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "../commands.js";
import { createGame } from "../setup.js";
import { gameAreaId, playerId, type InstanceId, type PlayerId } from "../ids.js";
import { activeEncounterDeck, mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { stubIdentity, stubMainScheme, stubObligation, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { DEFAULT_CARDS, RESOURCE, runWith, settle, withEncounterPiles } from "../testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const endTurn = (player: PlayerId): Command => ({ type: "endTurn", playerId: player });
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const identity = (id: string) =>
  stubIdentity({ id, hp: 10, atk: 2, thw: 1, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
const HERO_A = identity("a");
const HERO_B = identity("b");
// "a-obligation" is HERO_A's obligation (the stub identity links `<id>-obligation`).
const loud = stubAbility("a-obligation.revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 9 } }],
});
const OBLIGATION = stubObligation({ id: "a-obligation", abilities: [loud.ref] });
const deps = depsOf(loud);

const decline = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "declareDefender"
    ? ["decline"]
    : (state.pendingChoice?.options.slice(0, state.pendingChoice.minSelections).map((o) => o.optionId) ?? []);

/** Test surgery: p1 and p2 in two separate game areas (Kang Stage 2B), or still sharing one. */
function withAreas(state: GameState, split: boolean): GameState {
  if (!split) return state;
  const area = (id: string, player: PlayerId) => ({
    areaId: gameAreaId(id),
    playerIds: [player],
    mainScheme: null,
    villainIds: [],
    activeVillainId: null,
    sideSchemeIds: [],
    formerSchemeIds: [],
  });
  return { ...state, gameAreas: [area("area-1", p1), area("area-2", p2)], nextGameAreaSeq: 3 };
}

/** Plays round 1 with every encounter card a blank except the one p2 is dealt, which is p1's obligation. */
function play(split: boolean) {
  const created = createGame(
    {
      seed: 3,
      cards: [...DEFAULT_CARDS, HERO_A, HERO_B, OBLIGATION, BLANK, VILLAIN, SCHEME],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [OBLIGATION.id, ...copies(BLANK.id, 12)],
      players: [
        { identityCardId: HERO_A.id, deck: copies(RESOURCE.id, 20) },
        { identityCardId: HERO_B.id, deck: copies(RESOURCE.id, 20) },
      ],
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  return placeObligationForP2(withAreas(settle(created.state, decline, deps), split));
}

/**
 * Stacks the encounter deck so p2's dealt card is the obligation: the deck is dealt to p1 then p2 after any boost
 * cards, so the obligation goes right after p1's card and the boost cards this game draws in round 1.
 */
function placeObligationForP2(state: GameState): { readonly stacked: GameState; readonly obligationId: InstanceId } {
  const deck = activeEncounterDeck(state).deck;
  const obligation = deck.find((id) => state.instances[id]?.cardId === OBLIGATION.id) as InstanceId;
  const blanks = deck.filter((id) => id !== obligation);
  // Round 1 boosts: one per villain activation. With separate areas and no villain in either, no one activates.
  const before = state.gameAreas.length > 0 ? 1 : 3;
  const stacked = withEncounterPiles(state, {
    deck: [...blanks.slice(0, before), obligation, ...blanks.slice(before)],
  });
  return { stacked, obligationId: obligation };
}

const threat = (state: GameState) => state.instances[state.mainScheme.instanceId]!.threat;

describe("another player's obligation revealed in a different game area (ruling Sep 21, 2023, #89)", () => {
  it("is ignored, removed from the game, and replaced by a new encounter card", () => {
    const { stacked, obligationId } = play(true);
    const after = settle(runWith(deps, stacked, endTurn(p1), endTurn(p2)), decline, deps);
    expect(after.removedFromGame).toContain(obligationId);
    expect(mustPlayer(after, p1).playArea).not.toContain(obligationId);
    expect(threat(after)).toBe(5);
    // p1 revealed one blank, p2 the replacement: both in the encounter discard.
    expect(activeEncounterDeck(after).discard.filter((id) => after.instances[id]?.cardId === BLANK.id)).toHaveLength(2);
  });

  it("control: in one shared game area it is given to its owner and resolves as normal", () => {
    const { stacked, obligationId } = play(false);
    const after = settle(runWith(deps, stacked, endTurn(p1), endTurn(p2)), decline, deps);
    expect(after.removedFromGame).not.toContain(obligationId);
    expect(threat(after)).toBe(14);
  });
});
