/**
 * Inspect lines for wave 8's in-play state (docs/phase7-wave8.md §3.10, §3.33, §3.42): a hit point floor, considered
 * resource icons and the mission area's rules for the cards in it. The numbers are the engine's own
 * (`hitPointFloor`, `resourceIconsInPlay`, `scenarioPlayAreaOf`) read off a real state with scenario rules put on it.
 */

import type { GameState, InstanceId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { inspectModel } from "./inspect-model.js";
import { hitPointFloorNote, resourceIconNote, scenarioAreaNotes } from "./inspect-notes.js";
import { cardName } from "./names.js";
import { startedRhinoGame, withMission, type MissionFixture } from "./wave8-fixture.js";

let fixture: MissionFixture;
let identity: InstanceId;

beforeAll(async () => {
  fixture = withMission(await startedRhinoGame());
  identity = fixture.state.players[0]!.identity.instanceId;
}, 30_000);

const withRules = (state: GameState, ...rules: unknown[]): GameState =>
  ({
    ...state,
    scenarioRules: { ...state.scenarioRules, rules: [...(state.scenarioRules.rules ?? []), ...rules] },
  }) as GameState;

const named = (state: GameState, id: InstanceId) => ({ name: cardName(state, id) });

describe("hit point floor", () => {
  test("a rule's floor is a line, and no rule is none", () => {
    const { state } = fixture;
    expect(hitPointFloorNote(state, identity, POOL_DEPS)).toBeNull();
    const floored = withRules(state, {
      kind: "consideredRemainingHp",
      target: named(state, identity),
      atLeast: 1,
    });
    expect(hitPointFloorNote(floored, identity, POOL_DEPS)).toBe("Considered to have at least 1 hit point");
    const higher = withRules(floored, { kind: "consideredRemainingHp", target: named(state, identity), atLeast: 3 });
    expect(hitPointFloorNote(higher, identity, POOL_DEPS)).toBe("Considered to have at least 3 hit points");
  });

  test("the Inspect model carries it", () => {
    const { state, me } = fixture;
    const floored = withRules(state, { kind: "consideredRemainingHp", target: named(state, identity), atLeast: 1 });
    expect(inspectModel(floored, identity, null, me, POOL_DEPS).hitPointFloorNote).toBe(
      "Considered to have at least 1 hit point",
    );
    expect(inspectModel(state, identity, null, me, POOL_DEPS).hitPointFloorNote).toBeNull();
  });
});

describe("considered resource icons", () => {
  test("the icon a rule adds is listed apart from the printed ones", () => {
    const { state, me } = fixture;
    expect(resourceIconNote(state, POOL_DEPS, identity)).toBeNull();
    const wilder = withRules(state, {
      kind: "consideredResourceIcon",
      target: named(state, identity),
      resource: "wild",
    });
    const note = resourceIconNote(wilder, POOL_DEPS, identity);
    expect(note).toMatch(/^Resource icons: .*wild.* \(not printed: wild\)$/);
    expect(inspectModel(wilder, identity, null, me, POOL_DEPS).resourceIconNote).toBe(note);
  });

  test("a card that is not in play has no line", () => {
    const { state } = fixture;
    const inHand = state.players[0]!.hand[0]!;
    const wilder = withRules(state, { kind: "consideredResourceIcon", target: {}, resource: "wild" });
    expect(resourceIconNote(wilder, POOL_DEPS, inHand)).toBeNull();
  });
});

describe("a card in the mission area", () => {
  const blankAllies = { kind: "blankTextBox", target: { categories: ["ally"], inScenarioPlayArea: "mission" } };

  test("it has no controller and the closed area is not reached by other abilities", () => {
    const { state, mission } = fixture;
    expect(scenarioAreaNotes(state, POOL_DEPS, mission)).toEqual([
      "In the mission area: in play, but no player controls it",
      "Card abilities don't reach it unless they name the area",
    ]);
  });

  test("an ally there has a blank text box while the scenario's rule says so", () => {
    const { state, ally } = fixture;
    expect(scenarioAreaNotes(state, POOL_DEPS, ally)).not.toContain("Its text box is blank, except for traits");
    expect(scenarioAreaNotes(withRules(state, blankAllies), POOL_DEPS, ally)).toContain(
      "Its text box is blank, except for traits",
    );
  });

  test("the rule is not read onto the mission or an enemy there", () => {
    const { state, mission, minion } = fixture;
    const ruled = withRules(state, blankAllies);
    expect(scenarioAreaNotes(ruled, POOL_DEPS, mission)).not.toContain("Its text box is blank, except for traits");
    expect(scenarioAreaNotes(ruled, POOL_DEPS, minion)).not.toContain("Its text box is blank, except for traits");
  });

  test("an attached upgrade is in the area with its host", () => {
    const { state, upgrade } = fixture;
    expect(scenarioAreaNotes(state, POOL_DEPS, upgrade)[0]).toBe(
      "In the mission area: in play, but no player controls it",
    );
  });

  test("a card outside every area has no notes", () => {
    const { state } = fixture;
    expect(scenarioAreaNotes(state, POOL_DEPS, identity)).toEqual([]);
  });

  test("the Inspect model carries the notes, shows the attempt counter and hides the defeated mark", () => {
    const { state, me, mission, ally } = fixture;
    const model = inspectModel(withRules(state, blankAllies), mission, null, me, POOL_DEPS);
    expect(model.areaNotes).toHaveLength(2);
    expect(model.counterNote).toBe("2 attempt counters");
    expect(model.counterNote).not.toContain("defeated");
    expect(inspectModel(withRules(state, blankAllies), ally, null, me, POOL_DEPS).areaNotes).toContain(
      "Its text box is blank, except for traits",
    );
  });
});
