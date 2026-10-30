import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  GLOBAL_ALLOWED_HEROES,
  GLOBAL_ALLOWED_MODULARS,
  GLOBAL_ALLOWED_VILLAINS,
} from "@mc/sync-worker/global-allowlist";
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

/** The Worker's allowlist (`packages/sync-worker/src/global-allowlist.ts`) as the pool says it should read. */
const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();
function expectedAllowlist() {
  const cards = [...CARDS_BY_ID.values()];
  return {
    villains: sorted([
      ...cards.filter((c) => c.type === "villain").map((c) => c.name),
      ...POOL_SCENARIOS.map((s) => s.name),
    ]),
    modulars: sorted(POOL_ENCOUNTER_SETS.map((s) => s.id as string)),
    heroes: sorted(cards.filter((c) => c.type === "hero_identity").map((c) => c.id as string)),
  };
}
const list = (name: string, values: readonly string[], doc: string) =>
  [
    `/** ${doc} */`,
    `export const ${name}: readonly string[] = [`,
    ...values.map((v) => `  ${JSON.stringify(v)},`),
    "];",
    "",
  ].join("\n");
function allowlistSource(want: ReturnType<typeof expectedAllowlist>): string {
  return [
    "/**",
    " * GENERATED FILE, do not edit by hand. The Worker only counts games whose villain, encounter sets and heroes it knows,",
    " * which bounds the store. Regenerate after the card pool changes with:",
    " *   UPDATE_GLOBAL_ALLOWLIST=1 pnpm --filter @mc/client exec vitest run src/global-stats/global-pool.test.ts",
    " * then `pnpm exec oxfmt packages/sync-worker/src/global-allowlist.ts`. A test in the client fails when it drifts.",
    " */",
    "",
    list(
      "GLOBAL_ALLOWED_VILLAINS",
      want.villains,
      "Villain card names and scenario names (a two-villain game joins parts with ` & `).",
    ),
    list("GLOBAL_ALLOWED_MODULARS", want.modulars, "Encounter set ids."),
    list("GLOBAL_ALLOWED_HEROES", want.heroes, "Hero identity card ids (what a seat's identityCardId holds)."),
  ].join("\n");
}
const ALLOWLIST_FILE = new URL("../../../sync-worker/src/global-allowlist.ts", import.meta.url);

describe("the Worker's allowlist", () => {
  test("matches the pool (regenerate with UPDATE_GLOBAL_ALLOWLIST=1)", () => {
    const want = expectedAllowlist();
    if (process.env.UPDATE_GLOBAL_ALLOWLIST === "1") writeFileSync(ALLOWLIST_FILE, allowlistSource(want));
    const have = {
      villains: [...GLOBAL_ALLOWED_VILLAINS],
      modulars: [...GLOBAL_ALLOWED_MODULARS],
      heroes: [...GLOBAL_ALLOWED_HEROES],
    };
    const hint =
      "packages/sync-worker/src/global-allowlist.ts is out of date. Regenerate it with:\n" +
      "  UPDATE_GLOBAL_ALLOWLIST=1 pnpm --filter @mc/client exec vitest run src/global-stats/global-pool.test.ts\n" +
      "  pnpm exec oxfmt packages/sync-worker/src/global-allowlist.ts";
    if (process.env.UPDATE_GLOBAL_ALLOWLIST !== "1" && JSON.stringify(have) !== JSON.stringify(want)) {
      throw new Error(hint);
    }
    expect(readFileSync(ALLOWLIST_FILE, "utf8")).toContain("GENERATED FILE");
  });

  test("every pool game's villain, sets and heroes are on it", () => {
    const want = expectedAllowlist();
    expect(want.villains.length).toBeGreaterThan(10);
    expect(want.modulars.length).toBeGreaterThan(10);
    expect(want.heroes.length).toBeGreaterThan(10);
  });
});
