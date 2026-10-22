/**
 * The `?screen=board&fixture=shadowland` dev jump (`scenes/boot-dev-jump.ts`): a one-seat game for looking at what
 * Shadowland puts on the board while its sets are gated out of the playable scenarios (`playable/unscripted.ts`).
 * Spider-Man (Justice) against Shifting Corridors (Shadow Labyrinth's villain, with passage counters), the TRAP! cards
 * gathered into the separate "trap" scenario deck with a couple already in its own discard pile, Creeping Corruption
 * in play with corruption counters on it, and The Streets Below (the two position environments) in the villain area.
 * `?flip=1` flips them to Atop the Tenshu; `?corruption=N` sets the counter count (default 4); `?traps=N` sets how
 * many TRAP! cards are dealt (default 5, the most there are; two of them start in the discard).
 *
 * Dev builds only: the game is built with the cards package's own test builders (`trap-testing.ts`), loaded with
 * `import.meta.glob` the way `dev-mission-game.ts` loads its builder, and handed to a `DevStateHost`. It keeps no
 * storage. It un-gates nothing: the playable pool is untouched.
 */

import type { EngineDeps, GameState, InstanceId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { appSession, useDevHost } from "../session.js";

const TRAPS = import.meta.glob("../../../cards/src/wave11/shadowland/trap-testing.ts");
const WAVE3 = import.meta.glob("../../../engine/src/testing/wave3.ts");
const SHADOW = import.meta.glob("../../../cards/src/wave11/shadowland/corruption.testing.ts");

interface TrapTesting {
  readonly trapGame: (opts: {
    readonly trapCards?: readonly string[];
    readonly passage?: number;
    readonly seed?: number;
  }) => GameState;
  readonly TRAP_DEPS: EngineDeps;
}
interface Wave3Testing {
  readonly encounterCardInVillainArea: (
    state: GameState,
    card: string,
    threat?: number,
  ) => { readonly state: GameState; readonly id: InstanceId };
}
interface ShadowTesting {
  readonly withCorruption: (state: GameState, n: number) => GameState;
}

const CREEPING_CORRUPTION = "65072a";
/** The TRAP! treacheries of Deadly Contraptions, in the order the fixture deals them. */
const TRAP_CARDS = ["65052", "65053", "65054", "65055", "65056"] as const;
const STREETS_BELOW = ["65003a", "65004a"] as const;

export interface ShadowlandFixtureOptions {
  readonly corruption: number;
  readonly traps: number;
  readonly flip: boolean;
}

/** The fixture's game state (`startDevShadowlandGame` hands it to a `DevStateHost`). Exported for the fixture's own test. */
export async function shadowlandFixtureState(
  options: ShadowlandFixtureOptions,
): Promise<{ readonly state: GameState; readonly deps: EngineDeps }> {
  const load = async <T>(glob: Record<string, () => Promise<unknown>>): Promise<T> => {
    const loader = Object.values(glob)[0];
    if (!loader) throw new Error("the cards package's test builder was not found");
    return (await loader()) as T;
  };
  const traps = await load<TrapTesting>(TRAPS);
  const wave3 = await load<Wave3Testing>(WAVE3);
  const shadow = await load<ShadowTesting>(SHADOW);
  const dealt = TRAP_CARDS.slice(
    0,
    Math.max(2, Math.min(Number.isFinite(options.traps) ? options.traps : 5, TRAP_CARDS.length)),
  );
  let state = traps.trapGame({
    trapCards: [...dealt, CREEPING_CORRUPTION, ...STREETS_BELOW],
    passage: 7,
    seed: 3,
  });
  for (const code of STREETS_BELOW) state = wave3.encounterCardInVillainArea(state, code).state;
  // Two traps already sprung: they sit in the trap deck's own discard pile, not the encounter discard.
  const pile = state.scenarioDecks["trap"]!;
  const sprung = pile.deck.slice(0, 2);
  state = {
    ...state,
    // A discarded card lies faceup, as the trap deck's own discard pile shows it in play.
    instances: Object.fromEntries(
      Object.entries(state.instances).map(([id, instance]) => [
        id,
        sprung.includes(id as InstanceId) ? { ...instance, faceup: true } : instance,
      ]),
    ),
    scenarioDecks: {
      ...state.scenarioDecks,
      trap: { ...pile, deck: pile.deck.slice(2), discard: [...sprung, ...pile.discard] },
    },
  };
  state = shadow.withCorruption(state, options.corruption);
  if (options.flip) state = flipEnvironments(state);
  return { state, deps: POOL_DEPS };
}

/** Flips each Streets Below to its Atop the Tenshu side (state surgery; the engine's own flip is a card effect). */
function flipEnvironments(state: GameState): GameState {
  const instances = Object.fromEntries(
    Object.entries(state.instances).map(([id, instance]) => [
      id,
      (STREETS_BELOW as readonly string[]).includes(instance.cardId as string)
        ? { ...instance, flipped: true }
        : instance,
    ]),
  );
  return { ...state, instances };
}

export async function startDevShadowlandGame(options: ShadowlandFixtureOptions): Promise<void> {
  const { state, deps } = await shadowlandFixtureState(options);
  useDevHost(new DevStateHost(state, deps));
  (window as unknown as { __mcShadowland?: unknown }).__mcShadowland = { store: appSession().store };
  await appSession().store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
  });
}
