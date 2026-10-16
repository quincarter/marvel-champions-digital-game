/**
 * "Resolve each 'When Revealed' ability that you reveal 1 additional time" (Media Coverage, 02049; `RuleSpec
 * repeatWhenRevealed`) repeats the two keywords that are When Revealed abilities too.
 *
 * Sources: RRG v1.8 p.24/p.42 ("Incite X": "When Revealed: place X threat on the main scheme"; "Surge": "When
 * Revealed: Deal yourself 1 facedown encounter card"); ruling 2026-08-03 R3 ("Surge is treated as a When Revealed
 * ability").
 */

import { flat, type AbilityReference, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAttachment, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, HERO, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const coverageRule = stubAbility("mc-coverage.rule", {
  trigger: { kind: "constant", rules: [{ kind: "repeatWhenRevealed", player: { kind: "controller" }, times: 1 }] },
  effects: [],
});
const COVERAGE = stubAttachment({
  id: "mc-coverage",
  attachesTo: { kind: "hero" },
  abilities: [coverageRule.ref as AbilityReference],
});
const VILLAIN = stubVillain({ id: "mc-boss", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "mc-calm",
  stages: [{ startingThreat: flat(3), targetThreat: flat(50), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "mc-blank", boostIcons: 0 });
const INCITER = stubTreachery({ id: "mc-inciter", boostIcons: 0, keywords: [{ name: "incite", value: 2 }] });
const SURGER = stubTreachery({ id: "mc-surger", boostIcons: 0, keywords: [{ name: "surge" }] });

const ENCOUNTER_CARDS: readonly AnyCard[] = [COVERAGE, INCITER, SURGER];
const deps: EngineDeps = depsOf(coverageRule);
const endTurn: Command = { type: "endTurn", playerId: p1 };

/**
 * A solo game whose encounter deck is the villain's boost card (blank), then `revealed` (this round's encounter
 * card), then blanks only; with `covered`, Media Coverage attached to p1's identity.
 */
function game(revealed: AnyCard, covered: boolean): GameState {
  const start = newGame({
    identity: HERO,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deps,
    extraCards: [BLANK, ...ENCOUNTER_CARDS],
    encounterDeck: [...ENCOUNTER_CARDS.map((card) => card.id), ...copies(BLANK.id, 12)],
    deck: DEFAULT_DECK,
  });
  const deck = activeEncounterDeck(start).deck;
  const find = (card: AnyCard) => deck.find((id) => start.instances[id]?.cardId === card.id) as InstanceId;
  const blanks = deck.filter((id) => start.instances[id]?.cardId === BLANK.id);
  const coverage = find(COVERAGE);
  const [boost, ...rest] = blanks;
  const ordered = [boost!, find(revealed), ...rest];
  const piled = withEncounterPiles(start, { deck: ordered });
  if (!covered) return piled;
  // Test surgery: Media Coverage attached to p1's identity.
  const identity = mustPlayer(piled, p1).identity.instanceId;
  return {
    ...piled,
    instances: {
      ...piled.instances,
      [identity]: { ...mustInstance(piled, identity), attachments: [coverage] },
      [coverage]: { ...mustInstance(piled, coverage), faceup: true, attachedTo: identity, engagedWith: null },
    },
  };
}

describe("Media Coverage repeats the When Revealed keywords (RRG v1.8 p.24/p.42, ruling 2026-08-03 R3)", () => {
  it("Incite X is a When Revealed ability: under Media Coverage it places its threat twice", () => {
    const threatAfter = (covered: boolean) => {
      const { state, events } = runCommands(game(INCITER, covered), deps, endTurn);
      const incites = events.filter(
        (e) =>
          e.type === "triggerEvent" &&
          e.phase === "initiated" &&
          e.event.kind === "placeThreat" &&
          e.event.sourceInstanceId != null &&
          state.instances[e.event.sourceInstanceId]?.cardId === INCITER.id,
      );
      return { threat: mustInstance(state, state.mainScheme.instanceId).threat, incites: incites.length };
    };
    const plain = threatAfter(false);
    const covered = threatAfter(true);
    expect(plain.incites).toBe(1);
    expect(covered.incites).toBe(2);
    expect(covered.threat - plain.threat).toBe(2);
  });

  it("Surge is a When Revealed ability: under Media Coverage it deals 2 facedown encounter cards", () => {
    const surgesAfter = (covered: boolean) => {
      const { events } = runCommands(game(SURGER, covered), deps, endTurn);
      return {
        surges: events.filter((e) => e.type === "surgeTriggered").length,
        revealed: events.filter((e) => e.type === "encounterCardRevealed").length,
      };
    };
    expect(surgesAfter(false)).toEqual({ surges: 1, revealed: 2 });
    expect(surgesAfter(true)).toEqual({ surges: 2, revealed: 3 });
  });
});
