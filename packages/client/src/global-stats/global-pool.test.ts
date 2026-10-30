import { describe, expect, test } from "vitest";
import {
  GLOBAL_KEY_PATTERN,
  GLOBAL_VILLAIN_PATTERN,
  parseGlobalResult,
  type GlobalSeat,
} from "@mc/sync-worker/global-protocol";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { POOL_STATS_NAMES } from "../view/player-stats-names.js";
import { globalIdOf, globalResultOf } from "./global-result.js";
import { meta } from "./fixtures.js";

const villainNames = [...CARDS_BY_ID.values()].filter((c) => c.type === "villain").map((c) => c.name);

describe("the real pool against the protocol's patterns", () => {
  test("every encounter set id is a key", () => {
    const bad = POOL_ENCOUNTER_SETS.map((s) => s.id as string).filter((id) => !GLOBAL_KEY_PATTERN.test(id));
    expect(bad).toEqual([]);
  });

  test("every card id is a key", () => {
    const bad = [...CARDS_BY_ID.keys()].filter((id) => !GLOBAL_KEY_PATTERN.test(id));
    expect(bad).toEqual([]);
  });

  test("every villain and scenario name is a villain name, and so is a two-villain join", () => {
    const names = [...villainNames, ...POOL_SCENARIOS.map((s) => s.name)];
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => !GLOBAL_VILLAIN_PATTERN.test(n))).toEqual([]);
    const join = `${villainNames[0]} & ${villainNames[1]}`;
    expect(GLOBAL_VILLAIN_PATTERN.test(join)).toBe(true);
  });

  test("the pool knows its own villains", () => {
    expect(villainNames.every((n) => POOL_STATS_NAMES.isVillain!(n))).toBe(true);
    expect(POOL_STATS_NAMES.isVillain!("Not A Villain")).toBe(false);
  });

  test("a game built from pool ids survives the Worker's parser unchanged", async () => {
    const heroes = [...CARDS_BY_ID.values()].filter((c) => c.type === "hero_identity").slice(0, 2);
    const deck = [...CARDS_BY_ID.keys()].slice(0, 40);
    const seats = heroes.map((h) => ({
      identityCardId: h.id as string,
      aspects: ["justice"],
      deck,
      plays: {},
      activations: {},
      entered: {},
      damage: 0,
      thwart: 0,
      defeated: false,
    }));
    const modulars = POOL_ENCOUNTER_SETS.slice(0, 6).map((s) => s.id as string);
    const m = meta({}, { seats, villains: [villainNames[0]!, villainNames[1]!] });
    const game = { ...m, config: { ...m.config, modularSetIds: modulars } };
    const result = globalResultOf(game, POOL_STATS_NAMES, await globalIdOf(m.id));
    expect(result).not.toBeNull();
    expect(parseGlobalResult(JSON.parse(JSON.stringify(result)))).toEqual(result);
    const lost = {
      ...game,
      status: "lost" as const,
      summary: { ...game.summary!, lossReason: "schemeCompleted" as const },
    };
    const lostResult = globalResultOf(lost, POOL_STATS_NAMES, await globalIdOf("x"));
    expect(parseGlobalResult(JSON.parse(JSON.stringify(lostResult)))).toEqual(lostResult);
    const sent = result!.seats as readonly GlobalSeat[];
    expect(sent).toHaveLength(heroes.length);
  });
});
