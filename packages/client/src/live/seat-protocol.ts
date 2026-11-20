/**
 * The messages of a seated guest's play (issue #881), as plain data: the seat worker's with the main thread, and the
 * one message the seat sends the room worker over the feed port. Nothing here is a socket or a secret.
 */
import type { Command, LegalActions, PlayerId } from "@mc/engine";
import type { ProposalRefusal, RefusalReason } from "@mc/sync-worker/room-protocol";
import { FIRST_TABLE, type ClientMessage } from "@mc/sync-worker/room-protocol";
import type { CardPool } from "../engine/host.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";
import type { RoomDevice } from "./room-state.js";
import type { SeatPlayer, SeatSnapshot } from "./seat-core.js";

/**
 * A seat's feed port to the room worker, besides `{ kind: "resync" }`: send `command`, built on a log `base` commands
 * long, to the table's host as a proposal. The room worker (`room-session.ts`, `follow`) hands this to
 * `seatFeedMessage` and sends what it returns.
 */
export interface SeatFeedPropose {
  readonly kind: "propose";
  readonly command: Command;
  readonly base: number;
  /** This proposal's id, echoed in every refusal of it so a seat fails the right one. */
  readonly pid?: number;
  /** The table's identity at `base` (`SeatCore.stampAt`): the host dispatches only onto the table it names. */
  readonly stamp?: string;
}

/** What the room worker sends the room for a seat's feed message: the `propose` of a `SeatFeedPropose`, else null. */
export function seatFeedMessage(data: unknown): Omit<Extract<ClientMessage, { kind: "propose" }>, "v"> | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Partial<SeatFeedPropose>;
  if (m.kind !== "propose" || typeof m.base !== "number" || !Number.isInteger(m.base) || m.base < 0) return null;
  if (typeof m.command !== "object" || m.command === null) return null;
  return {
    ch: "game",
    kind: "propose",
    table: FIRST_TABLE,
    command: m.command,
    base: m.base,
    ...(typeof m.pid === "number" && Number.isInteger(m.pid) && m.pid >= 0 ? { pid: m.pid } : {}),
    ...(typeof m.stamp === "string" && m.stamp !== "" ? { stamp: m.stamp } : {}),
  };
}

/** Why a seat's proposal came back: the host's reasons, or the room's own soft refusal when it never reached the host. */
export type SeatRefusal = ProposalRefusal | RefusalReason;

/** What a seat reports to the main thread, unasked. */
export type SeatEvent =
  /** The table changed. `divergedAt`: the first command count whose state differs from the host's checksum. */
  | { readonly type: "update"; readonly snapshot: SeatSnapshot; readonly divergedAt: number | null }
  /** The host turned the proposal built on `base` down. */
  | { readonly type: "refused"; readonly base: number; readonly reason: SeatRefusal; readonly pid?: number }
  | { readonly type: "presence"; readonly hostConnected: boolean; readonly watchers: number }
  /** The game ended (its outcome came, or the room closed): no more commands. */
  | { readonly type: "over"; readonly reason: "ended" | "closed" }
  /** Following stopped for good: the game could not be read or applied here. */
  | { readonly type: "failed" };

/** Where a seat's engine session runs: the seat worker in the app, `SeatFollower` in-thread in the tests. */
export interface SeatBackend {
  /** Waits for the room's game and settles once it is open: the card pool and the table. Rejects when it cannot be. */
  open(): Promise<{ readonly cardPool: CardPool; readonly snapshot: SeatSnapshot }>;
  /** Sends a proposal for the host to judge. The answer is a later event (the log's next command, or `refused`). */
  propose(command: Command, base: number, pid: number): void;
  /** The heroes this device holds; answers the table again with `legal` for them. */
  setPlayers(players: readonly SeatPlayer[]): Promise<SeatSnapshot>;
  legalActions(playerId: PlayerId): Promise<LegalActions>;
  judgePayment(playerId: PlayerId, payment: PaymentState): Promise<JudgedPayment>;
  onEvent(listener: (event: SeatEvent) => void): void;
  dispose(): void;
}

export type SeatRequest =
  | {
      readonly kind: "open";
      readonly id: number;
      readonly packs: readonly PackRuntime[];
      /** The room worker's feed, as for a watcher (`room-follow`). */
      readonly feed: MessagePort;
      readonly device?: RoomDevice;
    }
  | {
      readonly kind: "propose";
      readonly id: number;
      readonly command: Command;
      readonly base: number;
      readonly pid: number;
    }
  | { readonly kind: "players"; readonly id: number; readonly players: readonly SeatPlayer[] }
  | { readonly kind: "legalActions"; readonly id: number; readonly playerId: PlayerId }
  | { readonly kind: "judgePayment"; readonly id: number; readonly playerId: PlayerId; readonly payment: PaymentState };

export type SeatResponse =
  | { readonly kind: "event"; readonly event: SeatEvent }
  | {
      readonly kind: "opened";
      readonly id: number;
      readonly cardPool: CardPool;
      readonly snapshot: SeatSnapshot;
    }
  | { readonly kind: "players"; readonly id: number; readonly snapshot: SeatSnapshot }
  | { readonly kind: "legalActions"; readonly id: number; readonly actions: LegalActions }
  | { readonly kind: "paymentJudged"; readonly id: number; readonly judged: JudgedPayment }
  | { readonly kind: "failed"; readonly id: number; readonly message: string; readonly code?: string };
