/** The messages of the Discord presence worker (`workers/discord-presence.worker.ts`). Plain data only. */
import type { DiscordActivity, PresenceGame } from "./discord-presence.js";

/** Main thread to the presence worker. Each is posted as the event happens, with nothing computed on main. */
export type PresenceIn =
  | {
      readonly kind: "init";
      readonly enabled: boolean;
      /** Campaign id to box name, so the worker never imports the story text. */
      readonly campaignNames: Readonly<Record<string, string>>;
      /** The engine worker's end of the channel; game summaries arrive on it. */
      readonly gamePort?: MessagePort;
    }
  | { readonly kind: "sceneUp"; readonly key: string; readonly campaignId?: string; readonly runId?: string }
  | { readonly kind: "sceneDown"; readonly key: string }
  | { readonly kind: "enabled"; readonly on: boolean }
  /** The page is going away: clear the activity now. */
  | { readonly kind: "clear" }
  /** The `invoke` for the last activity failed: forget it was sent. */
  | { readonly kind: "sendFailed" };

/** Engine worker to the presence worker, over the port: the table's summary, only when it changed. */
export interface PresenceGameMessage {
  readonly kind: "game";
  readonly game: PresenceGame;
  /** Which game this is (a new key restarts the elapsed time). */
  readonly gameKey: string;
}

/** The presence worker to main: the one activity to send. */
export interface PresenceOut {
  readonly kind: "activity";
  readonly activity: DiscordActivity | null;
}
