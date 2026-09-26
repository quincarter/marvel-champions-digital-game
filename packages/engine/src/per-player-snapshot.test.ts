/**
 * docs/phase7-wave4.md §3.46: "Each player must resolve The Hood's 'Foul Play' ability in player order. For each player
 * who was not dealt at least 1 facedown encounter card this way, place 2 threat here." (Promised Prosperity, `hood`
 * 24005b). Synthetic villain whose Special is Foul Play's shape (discard the top encounter card; deal it to "you"
 * unless it is a Hood card), resolved for each player with that player as "you", and a per-player snapshot of their
 * dealt encounter cards.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playFree } from "./testing/wave3.js";
import { activeEncounterDeck } from "./query.js";

const FOUL_PLAY = stubAbility("hood.special", {
  trigger: { kind: "special" },
  effects: [
    { kind: "discardEncounterCards", count: { kind: "const", value: 1 }, bind: "d" } as never,
    {
      kind: "if",
      condition: {
        kind: "not",
        of: { kind: "refMatches", ref: { kind: "slot", slot: "d" }, query: { name: "hoodling" }, anywhere: true },
      },
      then: [
        { kind: "dealAsEncounterCard", cards: { kind: "slot", slot: "d" }, player: { kind: "controller" } } as never,
      ],
    },
  ],
});
const HOOD = stubVillain({
  id: "hood",
  name: "The Hood",
  stages: [{ hp: flat(20), atk: 1, sch: 1, abilities: [FOUL_PLAY.ref] }],
});
const HOODLING = stubTreachery({ id: "hoodling", boostIcons: 0 });
const OTHER = stubTreachery({ id: "other", boostIcons: 0 });
/** "Dealt … this way": the scoped ("that") player's dealt encounter cards. */
const dealt = (): ValueSpec => ({
  kind: "dealtEncounterCount",
  player: { kind: "scoped" },
});
const PROSPERITY = stubAbility("prosperity.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "forEachPlayer",
      players: { kind: "each" },
      effects: [
        { kind: "setVar", name: "dealtBefore", value: dealt() },
        { kind: "resolveSpecials", of: { kind: "villain" }, player: { kind: "scoped" } },
        {
          kind: "if",
          condition: { kind: "compare", left: dealt(), op: "atMost", right: { kind: "var", name: "dealtBefore" } },
          then: [
            { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } } as EffectSpec,
          ],
        },
      ],
    },
  ],
});
const PROSPERITY_CARD = stubEvent({ id: "prosperity", cost: 0, abilities: [PROSPERITY.ref] });
const deps: EngineDeps = depsOf(FOUL_PLAY, PROSPERITY);

function run(tops: readonly ("hoodling" | "other")[]): { before: GameState; after: GameState } {
  const base = gameAtFirstTurn({
    cards: [HOOD, HOODLING, OTHER, PROSPERITY_CARD],
    deps,
    villain: HOOD,
    players: 2,
    encounter: [...copiesOf(HOODLING.id, 4), ...copiesOf(OTHER.id, 4)],
    deck: [PROSPERITY_CARD.id],
  });
  const pile = activeEncounterDeck(base);
  const used = new Set<string>();
  const top = tops.map((code) => {
    const id = pile.deck.find((i) => base.instances[i]!.cardId === code && !used.has(i))!;
    used.add(id);
    return id;
  });
  const deckId = Object.keys(base.encounterDecks)[0]!;
  const before: GameState = {
    ...base,
    encounterDecks: {
      ...base.encounterDecks,
      [deckId]: { ...pile, deck: [...top, ...pile.deck.filter((i) => !used.has(i))] },
    },
  };
  return { before, after: playFree(before, deps, PROSPERITY_CARD.id).state };
}
const threat = (s: GameState) => s.instances[s.mainScheme.instanceId]!.threat;

describe("§3.46 per player: was that player dealt a card this way?", () => {
  it("2 threat for each player not dealt a card; each player's Foul Play deals to that player", () => {
    const both = run(["hoodling", "hoodling"]);
    expect(threat(both.after) - threat(both.before)).toBe(4);
    const one = run(["hoodling", "other"]);
    expect(threat(one.after) - threat(one.before)).toBe(2);
    expect(mustPlayer(one.after, P2).dealtEncounter.length).toBe(mustPlayer(one.before, P2).dealtEncounter.length + 1);
    expect(mustPlayer(one.after, P1).dealtEncounter.length).toBe(mustPlayer(one.before, P1).dealtEncounter.length);
    const none = run(["other", "other"]);
    expect(threat(none.after) - threat(none.before)).toBe(0);
  });
});
