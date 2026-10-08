/**
 * The mission area on the board model (docs/phase7-wave8.md §3.33): each in-play scenario area with its cards in the
 * order they entered, attachments under their hosts, and the same facts the ally and villain-area panels carry.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel, countersOf, scenarioPlayAreaPanels } from "./board-model.js";
import { startedRhinoGame, withMission, type MissionFixture } from "./wave8-fixture.js";

let fixture: MissionFixture;

beforeAll(async () => {
  fixture = withMission(await startedRhinoGame());
}, 30_000);

describe("scenarioPlayAreas on the board model", () => {
  test("a game with no scenario play area has none", async () => {
    const plain = await startedRhinoGame();
    expect(boardModel(plain.state, plain.me, POOL_DEPS).scenarioPlayAreas).toEqual([]);
  });

  test("the mission area lists its cards in the order they entered it", () => {
    const { state, me, mission, ally, minion } = fixture;
    const [area, ...rest] = boardModel(state, me, POOL_DEPS).scenarioPlayAreas;
    expect(rest).toEqual([]);
    expect(area!.name).toBe("mission");
    expect(area!.closed).toBe(true);
    expect(area!.count).toBe(3);
    expect(area!.cards.map((card) => card.instanceId)).toEqual([mission, ally, minion]);
  });

  test("the mission is a scheme meter with its threat, and the attempt counter shows while the defeated mark does not", () => {
    const { state, mission } = fixture;
    const card = scenarioPlayAreaPanels(state, POOL_DEPS)[0]!.cards[0]!;
    expect(card.scheme?.threat).toBe(5);
    expect(card.threat).toBe(5);
    expect(card.subtitle).toMatch(/^Side scheme/);
    expect(card.panel.counters).toEqual([{ name: "attempt", count: 2 }]);
    expect(countersOf(state, mission)).toEqual([{ name: "attempt", count: 2 }]);
    // Outside an area the same counter is an ordinary one.
    const { scenarioPlayAreas: _areas, ...rest } = state;
    const outside = rest as typeof state;
    expect(
      countersOf(outside, mission)
        .map((counter) => counter.name)
        .sort(),
    ).toEqual(["attempt", "defeated"]);
  });

  test("an ally carries its hit points, exhausted state, keywords and the upgrade hanging under it", () => {
    const { state, ally, upgrade } = fixture;
    const card = scenarioPlayAreaPanels(state, POOL_DEPS)[0]!.cards[1]!;
    expect(card.instanceId).toBe(ally);
    expect(card.scheme).toBeNull();
    expect(card.panel.exhausted).toBe(true);
    expect(card.panel.hp?.current).toBe(card.panel.hp!.max - 1);
    expect(card.panel.keywords).toBeInstanceOf(Array);
    expect(card.panel.attachments.map((chip) => chip.instanceId)).toEqual([upgrade]);
    expect(card.subtitle).toBe("Ally");
    expect(card.controlledBy).toBeNull();
  });

  test("an attachment is not a card of the area of its own", () => {
    const { state, me, upgrade } = fixture;
    const ids = boardModel(state, me, POOL_DEPS).scenarioPlayAreas.flatMap((area) =>
      area.cards.map((card) => card.instanceId),
    );
    expect(ids).not.toContain(upgrade);
  });
});
