/**
 * "Play with the top card of the encounter deck faceup" (`RuleSpec topOfDeckFaceup { deck: "encounter" }`) with two
 * teams: the rule shows the encounter deck of its own card's side of the table, and each side's deck is announced on
 * its own (`encounterDecksFaceup`, `announceDeckTops`).
 *
 * Sources: MC56 p. 16 (each side of the table has its own encounter deck; card abilities ignore the other side unless
 * they name it); docs/phase7-wave9.md §3.42 (the rule).
 */

import { describe, expect, it } from "vitest";
import type { RuleSpec } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type PlayerId } from "./ids.js";
import { encounterDecksFaceup, shownEncounterTop } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubSupport } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard, settle } from "./testing/scenario.js";
import { competitiveGame } from "./testing/team.js";
import { faceVisible } from "./visibility.js";

const [P1, P2] = ["p1", "p2"].map(playerId) as [PlayerId, PlayerId];

const FACEUP: RuleSpec = { kind: "topOfDeckFaceup", deck: "encounter" };
const EYE = stubAbility("eye.constant", { trigger: { kind: "constant", rules: [FACEUP] }, effects: [] });
const EYE_CARD = stubSupport({ id: "eye", cost: 0, abilities: [EYE.ref] });
const deps = depsOf(EYE);

function play(state: GameState, player: PlayerId): { state: GameState; events: readonly GameEvent[] } {
  const given = giveCard(state, player, EYE_CARD.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("an encounter-top rule on the resistance side (MC56 p. 16)", () => {
  // The resistance team's support, played in its own hero phase.
  const start = competitiveGame({ deps, extraCards: [EYE_CARD], deck: [...DEFAULT_DECK, EYE_CARD.id] });
  const [leaderOne, leaderTwo] = start.villains;
  const deckOne = leaderOne!.encounterDeckId;
  const deckTwo = leaderTwo!.encounterDeckId;
  const ended = applyCommand(start, { type: "endTurn", playerId: P1 }, deps);
  if (!ended.ok) throw new Error(ended.error.message);
  const { state, events } = play(settle(ended.state, defaultPick, deps), P2);
  const topTwo = state.encounterDecks[deckTwo]!.deck[0]!;
  const topOne = state.encounterDecks[deckOne]!.deck[0]!;

  it("shows the top card of its own side's encounter deck, not the other side's", () => {
    expect(encounterDecksFaceup(state, deps)).toEqual([deckTwo]);
    expect(shownEncounterTop(state, deps, deckTwo)).toBe(topTwo);
    expect(shownEncounterTop(state, deps, deckOne)).toBeNull();
    expect(faceVisible(state, topTwo, { deps })).toBe(true);
    expect(faceVisible(state, topOne, { deps })).toBe(false);
  });

  it("is announced once, for that deck", () => {
    const shown = events.filter((e) => e.type === "encounterTopShown");
    expect(shown).toEqual([
      { type: "encounterTopShown", deckId: deckTwo, instanceId: topTwo, cardId: expect.anything() },
    ]);
    expect(state.encounterTopsAnnounced).toEqual({ [deckTwo]: topTwo });
    expect(state.encounterTopAnnounced).toBeUndefined();
  });

  it("stays on that deck once the registration team is active again, and is never hidden by the switch", () => {
    const next = applyCommand(state, { type: "endTurn", playerId: P2 }, deps);
    if (!next.ok) throw new Error(next.error.message);
    const after = settle(next.state, defaultPick, deps);
    expect(after.activeTeamId).toBe(start.activeTeamId);
    expect(encounterDecksFaceup(after, deps)).toEqual([deckTwo]);
    expect(shownEncounterTop(after, deps)).toBeNull();
    expect(shownEncounterTop(after, deps, deckTwo)).toBe(after.encounterDecks[deckTwo]!.deck[0]);
    expect(next.events.some((e) => e.type === "encounterTopHidden")).toBe(false);
    expect(next.events.some((e) => e.type === "encounterTopShown" && e.deckId === deckOne)).toBe(false);
  });
});
