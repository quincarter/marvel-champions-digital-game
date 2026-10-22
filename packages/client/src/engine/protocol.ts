/**
 * The messages between the main thread and the engine worker.
 *
 * Every request carries an `id` the response echoes, so replies can arrive out
 * of order. The card pool travels once, on `started`; every later snapshot goes
 * without it. A resumed game answers with `started` too: to the main thread,
 * picking a game back up and starting one look the same.
 */

import type { Command, EngineError, EngineErrorCode, IllegalDeck, LegalActions, PlayerId } from "@mc/engine";
import type { SaveMeta } from "./game-storage.js";
import type { CardPool, SessionConfig, StateWithoutPool } from "./host.js";
import type { Snapshot } from "./session-core.js";
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";

export type HostRequest =
  | { readonly kind: "start"; readonly id: number; readonly config: SessionConfig }
  | { readonly kind: "resume"; readonly id: number; readonly gameId: string }
  | { readonly kind: "dispatch"; readonly id: number; readonly command: Command }
  | { readonly kind: "rewindTo"; readonly id: number; readonly commandCount: number }
  | { readonly kind: "legalActions"; readonly id: number; readonly playerId: PlayerId }
  | { readonly kind: "judgePayment"; readonly id: number; readonly playerId: PlayerId; readonly payment: PaymentState }
  | { readonly kind: "save"; readonly id: number }
  | { readonly kind: "latestSave"; readonly id: number }
  | { readonly kind: "listSaves"; readonly id: number };

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
  | { readonly kind: "rewound"; readonly id: number; readonly snapshot: Snapshot }
  | { readonly kind: "legalActions"; readonly id: number; readonly actions: LegalActions }
  | { readonly kind: "paymentJudged"; readonly id: number; readonly judged: JudgedPayment }
  | { readonly kind: "save"; readonly id: number; readonly save: SerializedSave }
  | { readonly kind: "latestSave"; readonly id: number; readonly meta: SaveMeta | null }
  | { readonly kind: "listSaves"; readonly id: number; readonly saves: readonly SaveMeta[] }
  /**
   * Unsolicited (`id` is 0): the worker's storage writes so far have committed. Device sync listens on the main thread,
   * where the worker's own change notifications never arrive; `turn` says the command that was written ended a turn.
   */
  | { readonly kind: "saved"; readonly id: 0; readonly reason: "game" | "turn" }
  /**
   * The worker threw: an invariant break, a bad setup, or a save that won't
   * replay. Surfaced, never swallowed. `code`/`illegalDecks` are present when
   * the throw was a `SetupError` (`session-core.ts`), so a `start`/`resume`
   * refusal keeps its engine error code across the worker boundary — plain
   * data, not the `SetupError` instance itself, since a class's own fields
   * don't reliably survive structured clone.
   */
  | {
      readonly kind: "failed";
      readonly id: number;
      readonly message: string;
      readonly code?: EngineErrorCode;
      readonly illegalDecks?: readonly IllegalDeck[];
    };
