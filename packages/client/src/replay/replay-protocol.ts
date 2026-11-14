/** The messages between the replay screen and the replay worker. Every request's `id` is echoed by its reply. */
import type { CardPool } from "../engine/host.js";
import type { Snapshot } from "../engine/session-core.js";
import type { ReplayOpenErrorCode, ReplayOpenSource } from "./replay-core.js";
import type { ReplayInfo } from "./replay-session.js";

export type ReplayRequest =
  | { readonly kind: "open"; readonly id: number; readonly source: ReplayOpenSource }
  | { readonly kind: "snapshot"; readonly id: number; readonly n: number; readonly played: boolean }
  | { readonly kind: "export"; readonly id: number }
  | { readonly kind: "exportLog"; readonly id: number };

export type ReplayResponse =
  | { readonly kind: "opened"; readonly id: number; readonly cardPool: CardPool; readonly info: ReplayInfo }
  | { readonly kind: "snapshot"; readonly id: number; readonly snapshot: Snapshot }
  | { readonly kind: "exported"; readonly id: number; readonly bytes: Uint8Array; readonly name: string }
  | { readonly kind: "exportedLog"; readonly id: number; readonly text: string; readonly name: string }
  | {
      readonly kind: "failed";
      readonly id: number;
      readonly message: string;
      readonly code?: ReplayOpenErrorCode;
    };
