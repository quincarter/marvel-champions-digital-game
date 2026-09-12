/**
 * The messages between the main thread and the engine worker.
 *
 * Every request carries an `id` the response echoes, so replies can arrive out
 * of order. The card pool travels once, on `started`; every later snapshot goes
 * without it.
 */

import type { Command, EngineError, LegalActions, PlayerId } from "@mc/engine";
import type { CardPool, SessionConfig, StateWithoutPool } from "./host.js";
import type { Snapshot } from "./session-core.js";

export type HostRequest =
  | { readonly kind: "start"; readonly id: number; readonly config: SessionConfig }
  | { readonly kind: "dispatch"; readonly id: number; readonly command: Command }
  | { readonly kind: "legalActions"; readonly id: number; readonly playerId: PlayerId }
  | { readonly kind: "save"; readonly id: number };

/** A save as it crosses the boundary: the baseline state without its card pool. */
export interface SerializedSave {
  readonly initialState: StateWithoutPool;
  readonly commands: readonly Command[];
}

export type HostResponse =
  | { readonly kind: "started"; readonly id: number; readonly cardPool: CardPool; readonly snapshot: Snapshot }
  | {
      readonly kind: "dispatched";
      readonly id: number;
      readonly result:
        | { readonly ok: true; readonly snapshot: Snapshot }
        | { readonly ok: false; readonly error: EngineError };
    }
  | { readonly kind: "legalActions"; readonly id: number; readonly actions: LegalActions }
  | { readonly kind: "save"; readonly id: number; readonly save: SerializedSave }
  /** The worker threw: an invariant break or a bad setup. Surfaced, never swallowed. */
  | { readonly kind: "failed"; readonly id: number; readonly message: string };
