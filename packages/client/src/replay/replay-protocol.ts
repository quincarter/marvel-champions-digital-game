/** The messages between the replay screen and the replay worker. Every request's `id` is echoed by its reply. */
import type { CardPool } from "../engine/host.js";
import type { RoomDevice } from "@mc/sync-worker/room-protocol";
import type { Snapshot } from "../engine/session-core.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { LiveWatchEvent } from "../live/watch-events.js";
import type { ReplayOpenErrorCode, ReplayOpenSource } from "./replay-core.js";
import type { ReplayInfo } from "./replay-session.js";

export type ReplayRequest =
  | { readonly kind: "open"; readonly id: number; readonly source: ReplayOpenSource }
  /** Follows a live game room (issue #876): answered with `opened` once its game has arrived, then `live` events follow. */
  | {
      readonly kind: "watch";
      readonly id: number;
      readonly roomId: string;
      readonly syncUrl: string;
      readonly packs: readonly PackRuntime[];
      /** A guest of a lobby room (issue #880): the room worker's end of a `MessagePort`, followed instead of a socket. */
      readonly feed?: MessagePort;
      /** This device's platform and form, for the watcher's own hello (read on main, `platform/room-device.ts`). */
      readonly device?: RoomDevice;
      /** A watch link's own socket: the viewer's online name for its hello, when they have set one (#1021). */
      readonly name?: string;
      /** A watch link's own socket: the table its link names, when not the first (#1021). */
      readonly table?: string;
    }
  | { readonly kind: "snapshot"; readonly id: number; readonly n: number; readonly played: boolean }
  | { readonly kind: "export"; readonly id: number }
  | { readonly kind: "exportLog"; readonly id: number };

export type ReplayResponse =
  /** A change in a live game being followed (issue #876); not the answer to any request, so it has no id. */
  | { readonly kind: "live"; readonly event: LiveWatchEvent }
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
