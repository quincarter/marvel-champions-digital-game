/**
 * The card pool and engine deps of the game on the table, on the main thread. A game carries its own packs
 * (`SessionConfig.packs`, what the engine worker built it with), so every in-game screen and view model reads its deps and
 * cards from here, never from `POOL_DEPS` / `currentDeps()` (which follow what is installed now, not what this game used).
 * `SessionStore` calls `setGamePacks` with each update's config; the merge is `poolViewOfPacks`' cache, the same one
 * the worker uses, so a base-game game gets `POOL_DEPS` / `CARDS_BY_ID` themselves.
 */
import type { AnyCard } from "@mc/content";
import type { EngineDeps } from "@mc/engine";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { poolViewOfPacks } from "./pool.js";

let packs: readonly PackRuntime[] | undefined;

/** Records which packs the game on the table was built with (`undefined` for none or no game). */
export function setGamePacks(next: readonly PackRuntime[] | undefined): void {
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
