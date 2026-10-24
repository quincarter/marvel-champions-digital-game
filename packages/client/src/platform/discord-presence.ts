/**
 * Discord Rich Presence, in the desktop app only (`src-tauri` exposes `discord_set_activity` and `discord_status`).
 * Gathers a small snapshot (which screen, the session store's game) and hands it to `view/discord-presence.ts`, which
 * words it. Nothing here runs per frame: the store's updates, a two-second look at which scenes are up (the scene
 * manager has no event for a screen change) and the Settings toggle each ask for a refresh, and a refresh is a
 * one-second trailing debounce that sends only when the activity changed. A browser and the phone apps never start it.
 */
import type Phaser from "phaser";
import { appSession, campaignService } from "../session.js";
import { SCENES } from "../scenes/keys.js";
import { campaignNameOf, presenceGameOf } from "../view/discord-presence-game.js";
import { presenceKey, presenceOf, type DiscordActivity, type PresenceScreen } from "../view/discord-presence.js";
import { detectPlatform } from "./platform.js";

const DEBOUNCE_MS = 1000;
const WATCH_MS = 2000;

const GAME_SCREENS: ReadonlySet<string> = new Set([SCENES.board]);
const SETUP_SCREENS: ReadonlySet<string> = new Set([
  SCENES.scenarioSelect,
  SCENES.seats,
  SCENES.setup,
  SCENES.setupDeal,
  SCENES.scenarioIntro,
  SCENES.civilWarBuilder,
]);
const DECK_SCREENS: ReadonlySet<string> = new Set([
  SCENES.decks,
  SCENES.deckBuilder,
  SCENES.deckCheck,
  SCENES.campaignDeckEdit,
  SCENES.campaignFrozenDeck,
]);
const CAMPAIGN_SCREENS: ReadonlySet<string> = new Set([
  SCENES.campaignSaga,
  SCENES.campaignCover,
  SCENES.campaignRoster,
  SCENES.campaignOpener,
  SCENES.campaignBriefing,
  SCENES.campaignMarket,
  SCENES.campaignAftermath,
  SCENES.campaignRewind,
  SCENES.campaignRun,
  SCENES.campaignIssue,
  SCENES.campaignDossier,
  SCENES.campaignFinale,
]);

/** The screen family for the scenes up now, the most specific first (Game over, the table, then the rest). */
export function screenOf(active: readonly string[]): PresenceScreen {
  if (active.includes(SCENES.gameOver)) return "gameOver";
  if (active.some((key) => GAME_SCREENS.has(key))) return "game";
  if (active.some((key) => CAMPAIGN_SCREENS.has(key))) return "campaign";
  if (active.some((key) => DECK_SCREENS.has(key))) return "deck";
  if (active.some((key) => SETUP_SCREENS.has(key))) return "setup";
  return "menus";
}

interface DiscordStatus {
  readonly enabled: boolean;
  readonly connected: boolean;
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

let started = false;
let enabled = true;
let refresh: (() => void) | null = null;
let sendNow: ((activity: DiscordActivity | null) => void) | null = null;

/** Starts the watcher once the game exists. A no-op everywhere but the desktop app. */
export function startDiscordPresence(game: Phaser.Game): void {
  if (started || detectPlatform() !== "tauri") return;
  started = true;
  enabled = appSession().settings.discordPresence;
  void begin(game);
}

/** The Settings toggle: off clears the activity at once, on shows it again. */
export function syncDiscordPresence(on: boolean): void {
  enabled = on;
  if (!started) return;
  if (!on) sendNow?.(null);
  else refresh?.();
}

async function begin(game: Phaser.Game): Promise<void> {
  let invoke: Invoke;
  try {
    ({ invoke } = (await import("@tauri-apps/api/core")) as { invoke: Invoke });
    // A build without the Discord commands (or with the feature off) answers nothing: do no work at all.
    const status = await invoke<DiscordStatus>("discord_status");
    if (!status.enabled) return;
  } catch {
    return;
  }

  let lastKey = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let warned = false;

  const send = (activity: DiscordActivity | null): void => {
    const key = presenceKey(activity);
    if (key === lastKey) return;
    lastKey = key;
    invoke("discord_set_activity", { activity }).catch((error: unknown) => {
      lastKey = "";
      if (!warned) console.warn("discord presence:", error);
      warned = true;
    });
  };

  // Elapsed time: the game's own start while a game is up, else the start of this spell away from one.
  let menuSince = Math.floor(Date.now() / 1000);
  let gameSince = menuSince;
  let gameKey = "";
  let wasInGame = false;
  const runNames = new Map<string, string>();

  const campaignNameOfScenes = (): string | null => {
    for (const scene of game.scene.getScenes(true)) {
      if (!CAMPAIGN_SCREENS.has(scene.scene.key) && !DECK_SCREENS.has(scene.scene.key)) continue;
      const data = (scene.sys.settings.data ?? {}) as { campaignId?: string; runId?: string };
      const direct = campaignNameOf(data.campaignId);
      if (direct) return direct;
      if (data.runId) {
        const known = runNames.get(data.runId);
        if (known !== undefined) return known || null;
        runNames.set(data.runId, "");
        void campaignService()
          .load(data.runId)
          .then((record) => {
            if (!record) return;
            runNames.set(data.runId!, campaignNameOf(record.campaignId as string) ?? record.name);
            schedule();
          })
          .catch(() => undefined);
      }
    }
    return null;
  };

  const compute = (): DiscordActivity | null => {
    if (!enabled) return null;
    const now = Math.floor(Date.now() / 1000);
    const { game: state, config, gameId } = appSession().store.state;
    let screen = screenOf(game.scene.getScenes(true).map((scene) => scene.scene.key));
    if ((screen === "game" || screen === "gameOver") && !state) screen = "menus";
    const inGame = screen === "game" || screen === "gameOver";
    if (inGame) {
      const key = gameId ?? `${config?.scenarioId}:${config?.seed}`;
      if (key !== gameKey) {
        gameKey = key;
        gameSince = now;
      }
    } else if (wasInGame) {
      menuSince = now;
    }
    wasInGame = inGame;
    return presenceOf({
      screen,
      startedAt: inGame ? gameSince : menuSince,
      campaignName: screen === "campaign" ? campaignNameOfScenes() : null,
      game: inGame && state ? presenceGameOf(state, config) : null,
    });
  };

  const run = (): void => {
    timer = null;
    send(compute());
  };
  const schedule = (): void => {
    if (!enabled || timer !== null) return;
    timer = setTimeout(run, DEBOUNCE_MS);
  };

  refresh = schedule;
  sendNow = (activity) => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    send(activity);
  };

  appSession().store.subscribe(schedule);
  // The scene manager has no event for a screen change, so a slow look catches those; it only reads scene keys.
  setInterval(schedule, WATCH_MS);
  window.addEventListener("pagehide", () => sendNow?.(null));
  schedule();
}
