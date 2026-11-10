/**
 * The card pool and engine deps of the game on the table, on the main thread. A game carries its own packs
 * (`SessionConfig.packs`, what the engine worker built it with), so every in-game screen and view model reads its deps and
 * cards from here, never from `POOL_DEPS` / `currentDeps()` (which follow what is installed now, not what this game used).
 * `SessionStore` calls `setGamePacks` with each update's config; the merge is `poolViewOfPacks`' cache, the same one
 * the worker uses, so a base-game game gets `POOL_DEPS` / `CARDS_BY_ID` themselves.
 */
import type { AnyCard, EncounterSet, Scenario } from "@mc/content";
import { packEncounterSetRecords, packScenarioRecords } from "@mc/mod-sdk/game";
import type { EngineDeps } from "@mc/engine";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { POOL_ENCOUNTER_SETS, POOL_SCENARIOS, poolViewOfPacks } from "./pool.js";

let packs: readonly PackRuntime[] | undefined;

/** Records which packs the game on the table was built with (`undefined` for none or no game). */
export function setGamePacks(next: readonly PackRuntime[] | undefined): void {
  // The worker sends a fresh array with every snapshot; the same packs keep the same array, so the merged pool is built once.
  if (
    packs &&
    next &&
    packs.length === next.length &&
    packs.every((pack, i) => pack.id === next[i]!.id && pack.version === next[i]!.version)
  )
    return;
  packs = next;
}

/** The engine deps the game on the table runs with. */
export function gameDeps(): EngineDeps {
  return poolViewOfPacks(packs).deps;
}

/** Every card of the game on the table, by id. */
export function gameCardsById(): ReadonlyMap<string, AnyCard> {
  return poolViewOfPacks(packs).cardsById;
}

/** Every card of the game on the table. */
export function gameCards(): readonly AnyCard[] {
  return poolViewOfPacks(packs).cards;
}

const SET_NAMES = new WeakMap<object, ReadonlyMap<string, string>>();

/** An encounter set's name in the game on the table, by a map cached per set list; undefined for an unknown id. */
export function gameEncounterSetName(id: string): string | undefined {
  const sets = gameEncounterSets();
  let names = SET_NAMES.get(sets);
  if (!names) {
    names = new Map(sets.map((set) => [set.id as string, set.name]));
    SET_NAMES.set(sets, names);
  }
  return names.get(id);
}

const GAME_SCENARIOS = new WeakMap<object, readonly Scenario[]>();
const GAME_SETS = new WeakMap<object, readonly EncounterSet[]>();

/** Every scenario of the game on the table: the base pool's plus its own packs' (not what is installed now). */
export function gameScenarios(): readonly Scenario[] {
  if (!packs || packs.length === 0) return POOL_SCENARIOS;
  let list = GAME_SCENARIOS.get(packs);
  if (!list) {
    list = [...POOL_SCENARIOS, ...packScenarioRecords(packs)];
    GAME_SCENARIOS.set(packs, list);
  }
  return list;
}

/** Every encounter set of the game on the table: the base pool's plus its own packs'. */
export function gameEncounterSets(): readonly EncounterSet[] {
  if (!packs || packs.length === 0) return POOL_ENCOUNTER_SETS;
  let list = GAME_SETS.get(packs);
  if (!list) {
    list = [...POOL_ENCOUNTER_SETS, ...packEncounterSetRecords(packs)];
    GAME_SETS.set(packs, list);
  }
  return list;
}
