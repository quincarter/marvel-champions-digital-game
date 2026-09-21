/**
 * `schemeResolved`: the scheme half of `attackResolved`.
 *
 * RRG 1.8 "Scheme (Enemy Activation)" (p. 39) and "Boost, Boost Icon" (p. 11): an activation places threat equal to
 * the enemy's SCH plus the boost icons resolved for it. Until now the engine reported only the total, so a client
 * could show "3 threat" but never "SCH 1 + 2 boost".
 */

import { flat, type CardId } from "@mc/content";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { activeVillain } from "./query.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { newGame } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn: Command = { type: "endTurn", playerId: p1 };

const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const BOOST_2 = stubTreachery({ id: "boost2", boostIcons: 2 });
const deckOf = (id: CardId, count = 40): readonly CardId[] => Array.from({ length: count }, () => id);

type Resolved = Extract<GameEvent, { type: "schemeResolved" }>;

/** Four rounds of an alter-ego player doing nothing, so the villain schemes every round. */
function schemeEvents(
  villain: ReturnType<typeof stubVillain>,
  abilities: readonly ReturnType<typeof stubAbility>[] = [],
) {
  const deps = depsOf(...abilities);
  const state = newGame({
    villain,
    mainScheme: SCHEME,
    extraCards: [BOOST_2],
    encounterDeck: deckOf(BOOST_2.id),
    deps,
  });
  const { events } = driveSession(startSession(state), deps, [endTurn, endTurn, endTurn, endTurn]);
  return { events, villainId: activeVillain(state).instanceId };
}

test("every scheme activation reports each term of its threat total, and they add up to the threat placed", () => {
  const villain = stubVillain({ id: "villain", stages: [{ hp: flat(200), atk: 2, sch: 1 }] });
  const { events, villainId } = schemeEvents(villain);

  const resolved = events.filter((event): event is Resolved => event.type === "schemeResolved");
  expect(resolved.length).toBeGreaterThan(0);

  for (const event of resolved) {
    expect(event.enemyInstanceId).toBe(villainId);
    expect(event.baseSch).toBe(1);
    // One boost card of two icons per activation (RRG 1.8 p. 11).
    expect(event.boostIcons).toBe(2);
    expect(event.threatBonus).toBe(0);
    expect(event.baseSch + event.boostIcons + event.threatBonus).toBe(event.threatPlaced);
  }
});

test("the threat placed by the activation is exactly what the breakdown says", () => {
  const villain = stubVillain({ id: "villain", stages: [{ hp: flat(200), atk: 2, sch: 1 }] });
  const { events } = schemeEvents(villain);

  // Each `schemeResolved` is immediately followed (once the event resolves) by the `threatPlaced` it describes.
  const pairs: { readonly resolved: Resolved; readonly placed: Extract<GameEvent, { type: "threatPlaced" }> }[] = [];
  events.forEach((event, index) => {
    if (event.type !== "schemeResolved") return;
    const placed = events
      .slice(index)
      .find(
        (later): later is Extract<GameEvent, { type: "threatPlaced" }> =>
          later.type === "threatPlaced" && later.sourceInstanceId === event.enemyInstanceId,
      );
    if (placed) pairs.push({ resolved: event, placed });
  });

  expect(pairs.length).toBeGreaterThan(0);
  for (const { resolved, placed } of pairs) {
    expect(placed.amount).toBe(resolved.threatPlaced);
    expect(placed.schemeInstanceId).toBe(resolved.schemeInstanceId);
  }
});

test("a reduction to the threat placed is its own term, not folded into SCH", () => {
  // "Reduce the amount of threat placed on the scheme by 1" changes the threat, not the enemy's SCH value, which is
  // why the two are separate keys on the activation and separate fields on the event.
  const emergency = stubAbility("emergency", {
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme" } },
    effects: [{ kind: "modifyAttack", threatBonus: { kind: "const", value: -1 } }],
  });
  const villain = stubVillain({
    id: "villain",
    stages: [{ hp: flat(200), atk: 2, sch: 1, abilities: [emergency.ref] }],
  });
  const { events } = schemeEvents(villain, [emergency]);

  const resolved = events.filter((event): event is Resolved => event.type === "schemeResolved");
  expect(resolved.length).toBeGreaterThan(0);
  for (const event of resolved) {
    expect(event.baseSch).toBe(1);
    expect(event.threatBonus).toBe(-1);
    expect(event.threatPlaced).toBe(event.baseSch + event.boostIcons - 1);
  }
});
