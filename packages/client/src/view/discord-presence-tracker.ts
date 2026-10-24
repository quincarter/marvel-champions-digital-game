/**
 * The presence worker's brain: keeps the scenes up, the table's summary and the setting, and decides when Discord
 * hears something. Pure over injected clock and timers, so the debounce and dedupe are tested without a worker.
 *
 * A change schedules one trailing look a second later (so a burst is one send); the look builds the activity and emits
 * it only when it differs from the last one emitted. Turning the setting off clears at once.
 */
import { presenceKey, presenceOf, type DiscordActivity, type PresenceGame } from "./discord-presence.js";
import { namesCampaign, screenOf } from "./discord-presence-screen.js";

export const PRESENCE_DEBOUNCE_MS = 1000;

export interface PresenceTrackerDeps {
  /** Milliseconds since the epoch. */
  readonly now: () => number;
  readonly setTimer: (run: () => void, ms: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
  readonly emit: (activity: DiscordActivity | null) => void;
  /** The campaign box a stored run belongs to, or null. Optional: absent, a run id names nothing. */
  readonly runCampaignName?: (runId: string) => Promise<string | null>;
}

interface SceneData {
  readonly campaignId?: string | undefined;
  readonly runId?: string | undefined;
}

export class PresenceTracker {
  readonly #deps: PresenceTrackerDeps;
  #names: Readonly<Record<string, string>> = {};
  #enabled: boolean;
  readonly #scenes = new Map<string, SceneData>();
  #game: { readonly game: PresenceGame; readonly key: string } | null = null;
  #timer: unknown = null;
  #lastKey = "";
  #menuSince: number;
  #gameSince: number;
  #gameKey = "";
  #wasInGame = false;
  readonly #runNames = new Map<string, string>();

  constructor(deps: PresenceTrackerDeps, enabled = true) {
    this.#deps = deps;
    this.#enabled = enabled;
    this.#menuSince = this.#gameSince = Math.floor(deps.now() / 1000);
  }

  setCampaignNames(names: Readonly<Record<string, string>>): void {
    this.#names = names;
  }

  sceneUp(key: string, data: SceneData = {}): void {
    this.#scenes.set(key, data);
    this.#schedule();
  }

  sceneDown(key: string): void {
    this.#scenes.delete(key);
    this.#schedule();
  }

  setGame(game: PresenceGame, gameKey: string): void {
    this.#game = { game, key: gameKey };
    this.#schedule();
  }

  setEnabled(on: boolean): void {
    this.#enabled = on;
    if (on) this.#schedule();
    else this.clear();
  }

  /** Clears the activity now (setting off, page going away). */
  clear(): void {
    this.#cancel();
    this.#send(null);
  }

  /** The last `emit` did not reach Discord: a later identical activity must go out again. */
  sendFailed(): void {
    this.#lastKey = "\u0000failed";
  }

  #cancel(): void {
    if (this.#timer !== null) this.#deps.clearTimer(this.#timer);
    this.#timer = null;
  }

  #schedule(): void {
    if (!this.#enabled || this.#timer !== null) return;
    this.#timer = this.#deps.setTimer(() => {
      this.#timer = null;
      this.#send(this.#compute());
    }, PRESENCE_DEBOUNCE_MS);
  }

  #send(activity: DiscordActivity | null): void {
    const key = presenceKey(activity);
    if (key === this.#lastKey) return;
    this.#lastKey = key;
    this.#deps.emit(activity);
  }

  #campaignName(): string | null {
    for (const [key, data] of this.#scenes) {
      if (!namesCampaign(key)) continue;
      const direct = data.campaignId ? this.#names[data.campaignId] : undefined;
      if (direct) return direct;
      const { runId } = data;
      if (!runId || !this.#deps.runCampaignName) continue;
      const known = this.#runNames.get(runId);
      if (known !== undefined) {
        if (known) return known;
        continue;
      }
      this.#runNames.set(runId, "");
      void this.#deps
        .runCampaignName(runId)
        .then((name) => {
          if (!name) return;
          this.#runNames.set(runId, name);
          this.#schedule();
        })
        .catch(() => undefined);
    }
    return null;
  }

  #compute(): DiscordActivity | null {
    if (!this.#enabled) return null;
    const now = Math.floor(this.#deps.now() / 1000);
    let screen = screenOf([...this.#scenes.keys()]);
    if ((screen === "game" || screen === "gameOver") && !this.#game) screen = "menus";
    const inGame = screen === "game" || screen === "gameOver";
    if (inGame && this.#game) {
      if (this.#game.key !== this.#gameKey) {
        this.#gameKey = this.#game.key;
        this.#gameSince = now;
      }
    } else if (this.#wasInGame) {
      this.#menuSince = now;
    }
    this.#wasInGame = inGame;
    const game = inGame && this.#game ? this.#game.game : null;
    const campaignName = game?.campaignId ? (this.#names[game.campaignId] ?? null) : null;
    return presenceOf({
      screen,
      startedAt: inGame ? this.#gameSince : this.#menuSince,
      campaignName: screen === "campaign" ? this.#campaignName() : null,
      game: game ? { ...game, campaignName } : null,
    });
  }
}
