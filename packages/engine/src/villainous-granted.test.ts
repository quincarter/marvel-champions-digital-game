/**
 * The activation's automatic boost card reads Villainous the way every other keyword is read (`hasKeyword`): a gained
 * Villainous counts (RRG 1.8 "Gains", p. 21: the card "functions as if it possesses the gained characteristic"; Solus,
 * `spiderham` 30037, "Each Inheritor minion gains villainous"), and a printed one on a blanked text box does not
 * (RRG 1.8 "Blank", p. 10; docs/phase7-wave5.md §4.1 Q73). RRG 1.8 "Villainous" (p. 47).
 */
import { describe, expect, it } from "vitest";
import { flat, type CardId, type KeywordInstance } from "@mc/content";
import { DEFAULT_DEPS } from "./abilities.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import type { LastingEffect } from "./lasting.js";
import type { GameState } from "./state.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubMinion, stubVillain } from "./testing/fixtures.js";
import { newGame, runWith, settle } from "./testing/scenario.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const endTurn = { type: "endTurn", playerId: p1 } as const;

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 0, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(60), acceleration: flat(0) }],
});
const deckOf = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);

/** Round two's hero phase, with one minion (printed `keywords`) revealed and engaged in round one's villain phase. */
function minionInPlay(keywords: readonly KeywordInstance[]): {
  readonly state: GameState;
  readonly minion: InstanceId;
} {
  const card = stubMinion({ id: "minion", atk: 1, sch: 1, hp: 5, boostIcons: 0, keywords });
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [card],
    encounterDeck: deckOf(card.id, 30),
  });
  const state = settle(runWith(DEFAULT_DEPS, start, endTurn));
  const minion = state.players[0]!.playArea.find((id) => state.instances[id]?.cardId === card.id);
  if (!minion) throw new Error("no minion engaged in round one");
  return { state, minion };
}

const withLasting = (state: GameState, effect: LastingEffect): GameState => ({
  ...state,
  lastingEffects: [...state.lastingEffects, effect],
});

const grantVillainous = (minion: InstanceId): LastingEffect => ({
  id: "test.grant",
  kind: "keywordGrant",
  keyword: { name: "villainous" },
  targets: [minion],
  affects: null,
  scope: { selfInstanceId: null, controllerId: null, vars: {}, bindings: {} },
  duration: { kind: "endOfRound" },
});

const blank = (minion: InstanceId): LastingEffect => ({
  id: "test.blank",
  kind: "blankTextBox",
  targets: [minion],
  duration: { kind: "endOfRound" },
});

/** The boost cards the activation procedure dealt `minion` (a card ability's own boost card excluded). */
const automaticBoosts = (events: readonly GameEvent[], minion: InstanceId): number =>
  events.filter((e) => e.type === "boostCardDealt" && e.enemyInstanceId === minion && !e.outsideActivation).length;

/** Round two's villain phase from `state`: the boost cards dealt `minion`, and the villain-phase audit's violations. */
function roundTwo(state: GameState, minion: InstanceId) {
  const { events, session } = runCommands(state, DEFAULT_DEPS, endTurn);
  const activated = events.some((e) => e.type === "enemyActivated" && e.enemyInstanceId === minion);
  const audit = auditVillainPhases(session.log, DEFAULT_DEPS);
  return {
    activated,
    boosts: automaticBoosts(events, minion),
    recipientViolations: audit.violations.filter((v) => v.rule === "boost.recipient"),
  };
}

describe("Villainous is read with gained keywords and blanks (RRG 1.8 'Villainous', p. 47)", () => {
  it("a minion that gains villainous is dealt exactly one boost card when it activates", () => {
    const { state, minion } = minionInPlay([]);
    const granted = withLasting(state, grantVillainous(minion));
    expect(hasKeyword(granted, minion, "villainous")).toBe(true);
    const result = roundTwo(granted, minion);
    expect(result.activated).toBe(true);
    expect(result.boosts).toBe(1);
    // The audit's independent check agrees the granted keyword makes it a legal recipient.
    expect(result.recipientViolations).toEqual([]);
  });

  it("without the grant the same minion is dealt none", () => {
    const { state, minion } = minionInPlay([]);
    const result = roundTwo(state, minion);
    expect(result.activated).toBe(true);
    expect(result.boosts).toBe(0);
  });

  it("a printed villainous minion is dealt one; with its text box blanked it is dealt none", () => {
    const { state, minion } = minionInPlay([{ name: "villainous" }]);
    const printed = roundTwo(state, minion);
    expect(printed.activated).toBe(true);
    expect(printed.boosts).toBe(1);

    const blanked = withLasting(state, blank(minion));
    expect(hasKeyword(blanked, minion, "villainous")).toBe(false);
    const result = roundTwo(blanked, minion);
    expect(result.activated).toBe(true);
    expect(result.boosts).toBe(0);
  });
});
