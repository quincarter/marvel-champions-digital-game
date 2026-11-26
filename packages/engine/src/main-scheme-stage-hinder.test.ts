/**
 * docs/phase7-wave10.md §3.13: hinder on a main scheme stage, printed or gained under a condition.
 *
 * Sources: RRG 1.8 "Hinder X" (p. 22): "A card with the hinder X keyword enters play with X threat on it", "in
 * addition to any threat it normally enters play with"; MC56 p. 9: "When a card with hinder X enters play, place X
 * threat on that card." RRG 1.8 "Per Player Icon" (p. 32). The Civil War stage 1B cards: "If there is more than 1
 * player on your team, this stage gains hinder 2[per_hero]."
 *
 * Synthetic cards. `gained`: stage 1B gains hinder 2 per player while there is more than 1 player; stage 2B has none.
 * `printed`: stage 1B prints hinder 1 + 2 per player beside a starting threat of 1 per player; stage 2B prints hinder 3
 * beside a starting threat of 2.
 */

import { flat, perPlayerOnly } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { keywordTotal } from "./keywords.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities, TREACHERY, VILLAIN } from "./testing/scenario.js";
import { copiesOf, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const self = { kind: "self" } as const;

/** "If there is more than 1 player on your team, this stage gains hinder 2[per_hero]." */
const GAINS_HINDER = stubAbility(
  "scheme.1b-gains-hinder",
  def({
    trigger: {
      kind: "constant",
      keywordGrants: [
        {
          keyword: { name: "hinder", value: 0 },
          target: { self: true },
          value: { kind: "perPlayer", base: 0, perPlayer: 2 },
          while: {
            kind: "compare",
            left: { kind: "refCount", of: { kind: "identityOf", player: { kind: "team", of: "yours" } } },
            op: "atLeast",
            right: { kind: "const", value: 2 },
          },
        },
      ],
    },
    effects: [],
  }),
);
/** "When Revealed: Place 1 `seen` counter here for each threat here." (what the stage holds as 1B's text resolves) */
const SEES_THREAT = stubAbility(
  "scheme.1b-when-revealed",
  def({
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: { kind: "threat", of: self } }],
  }),
);
const ADVANCE_ABILITY = stubAbility(
  "advance.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "advanceMainScheme", to: { stageNumber: 2 } }] }),
);
const ADVANCE = stubSupport({ id: "advance", cost: 0, abilities: [ADVANCE_ABILITY.ref] });

const GAINED = stubMainScheme({
  id: "gained",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: perPlayerOnly(7),
      acceleration: flat(0),
      abilities: [GAINS_HINDER.ref, SEES_THREAT.ref],
    },
    { startingThreat: flat(0), targetThreat: perPlayerOnly(9), acceleration: flat(0) },
  ],
});
const PRINTED = stubMainScheme({
  id: "printed",
  stages: [
    {
      startingThreat: perPlayerOnly(1),
      targetThreat: flat(50),
      acceleration: flat(0),
      keywords: [{ name: "hinder", value: 1, perPlayer: 2 }],
      abilities: [SEES_THREAT.ref],
    },
    {
      startingThreat: flat(2),
      targetThreat: flat(50),
      acceleration: flat(0),
      keywords: [{ name: "hinder", value: 3 }],
    },
  ],
});

const deps: EngineDeps = depsOf(GAINS_HINDER, SEES_THREAT, ADVANCE_ABILITY);

/** A game through setup, at the first player's first turn, with every setup event. */
function setUp(mainScheme: typeof GAINED, players: 1 | 2 | 3 | 4) {
  const identities = seatIdentities(HERO, players);
  const created = createGame(
    {
      seed: 21,
      cards: [...DEFAULT_CARDS, ...identities.slice(1), VILLAIN, mainScheme, ADVANCE],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: mainScheme.id,
      encounterDeck: copiesOf(TREACHERY.id, 30),
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [...DEFAULT_DECK, ADVANCE.id] })),
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  const driven = driveSession(startSession(created.state), deps);
  return { state: driven.session.state, events: [...created.events, ...driven.events] };
}

/** Advances the main scheme to stage 2 by a player card's action, the log replayed to the same state. */
function advance(state: GameState) {
  const placed = playerCardIntoPlay(state, ADVANCE.id);
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: placed.id,
    abilityId: ADVANCE_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const driven = driveSession(startSession(placed.state), deps, [command]);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

const scheme = (state: GameState) => mustInstance(state, state.mainScheme.instanceId);
const threat = (state: GameState): number => scheme(state).threat;
/** Every threat placement on the main scheme, in order. */
const placements = (state: GameState, events: readonly GameEvent[]): number[] =>
  events.flatMap((event) =>
    event.type === "threatPlaced" && event.schemeInstanceId === state.mainScheme.instanceId ? [event.amount] : [],
  );

describe("a stage that gains hinder under a condition (the Civil War stage 1B text)", () => {
  it("one player: the condition is not met, so the stage opens with 0 threat and nothing is placed", () => {
    const { state, events } = setUp(GAINED, 1);
    expect(threat(state)).toBe(0);
    expect(placements(state, events)).toEqual([]);
    expect(keywordTotal(state, state.mainScheme.instanceId, "hinder", deps)).toBe(0);
  });

  it.each([
    [2, 4],
    [3, 6],
    [4, 8],
  ] as const)("%i players: 0 + 2 per player = %i threat, in one placement", (players, expected) => {
    const { state, events } = setUp(GAINED, players);
    expect(threat(state)).toBe(expected);
    expect(placements(state, events)).toEqual([expected]);
    expect(keywordTotal(state, state.mainScheme.instanceId, "hinder", deps)).toBe(expected);
  });

  it("the hinder is on the stage before side 1B's When Revealed resolves", () => {
    expect(scheme(setUp(GAINED, 3).state).counters).toEqual({ seen: 6 });
  });

  it("it is placed as the stage turns to its B side, not while 1A is faceup", () => {
    const { state, events } = setUp(GAINED, 2);
    const turned = events.findIndex(
      (event) =>
        event.type === "triggerEvent" && event.phase === "initiated" && event.event.kind === "mainSchemeTurnsToB",
    );
    const placed = events.findIndex(
      (event) => event.type === "threatPlaced" && event.schemeInstanceId === state.mainScheme.instanceId,
    );
    expect(turned).toBeGreaterThanOrEqual(0);
    expect(placed).toBeGreaterThan(turned);
  });

  it("a stage 2B with no hinder: the advance places none", () => {
    const after = advance(setUp(GAINED, 3).state);
    expect(after.state.mainScheme.stageIndex).toBe(1);
    expect(threat(after.state)).toBe(0);
    expect(placements(after.state, after.events)).toEqual([]);
  });
});

describe("a stage that prints hinder", () => {
  it("setup, three players: starting threat 3, then hinder 1 + 2 x 3 = 7, 10 in all", () => {
    const { state, events } = setUp(PRINTED, 3);
    expect(placements(state, events)).toEqual([3, 7]);
    expect(threat(state)).toBe(10);
    expect(scheme(state).counters).toEqual({ seen: 10 });
  });

  it("setup, one player: starting threat 1, then hinder 1 + 2 = 3, 4 in all", () => {
    const { state, events } = setUp(PRINTED, 1);
    expect(placements(state, events)).toEqual([1, 3]);
    expect(threat(state)).toBe(4);
  });

  it("an advance: the new stage's starting threat 2 and its hinder 3, 5 in all, the old stage's threat gone", () => {
    const after = advance(setUp(PRINTED, 2).state);
    expect(after.state.mainScheme.stageIndex).toBe(1);
    // RRG 1.8 "Main Scheme" (p. 27) step 3 places the starting threat as the stage flips, as setup does; hinder's threat
    // is "in addition" (RRG 1.8 "Hinder X", p. 22), and both are on before the B side's When Revealed (#1012).
    expect(placements(after.state, after.events)).toEqual([2, 3]);
    expect(threat(after.state)).toBe(5);
  });
});
