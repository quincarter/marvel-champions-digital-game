/**
 * Game links opening the installed app (issue #862). The desktop app registers `marvelchampions://` links
 * (`marvelchampions://replay/<id>`, Tauri's deep-link plugin, `src-tauri/`); the Android app claims the game's own
 * address through App Links (`https://marvel.champions-digital-game.com/#replay=<id>`, `public/.well-known/`). Either
 * way the link is turned into the game's own fragment (`#replay=`, `#receive=`, `#link=`), which Boot and Title already
 * read once at startup (`replay/replay-link.ts`, `save-data/receive-link.ts`).
 *
 * A link the app was started with is put on the address before the game starts (`takeLaunchLink`, `main.ts`). A link
 * that arrives while it runs (the desktop's single instance forwards it, Android hands it to the open app) reloads the
 * page with it: games in progress are saved as they go, and Boot is the one place that knows how to open a link.
 */
import { detectPlatform, type Platform } from "./platform.js";
import { GAME_URL } from "../site/site-urls.js";

/** The desktop app's link scheme (`src-tauri/tauri.conf.json`, `plugins.deep-link`). */
export const APP_LINK_SCHEME = "marvelchampions";

const FRAGMENT = /^#(replay|receive|link)=[^#\s]+$/;
const GAME_HOST = new URL(GAME_URL).host;

/**
 * The game fragment a link carries (`#replay=<id>`), or null for a link that names nothing the game opens:
 *  - `marvelchampions://replay/<id>` (and `receive`, `link`), or `marvelchampions://open#replay=<id>`;
 *  - the game's own address with a game fragment (`https://marvel.champions-digital-game.com/#replay=<id>`).
 */
export function gameFragmentOf(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol === `${APP_LINK_SCHEME}:`) {
    if (FRAGMENT.test(url.hash)) return url.hash;
    // `marvelchampions://replay/<id>`: the kind is the host, the value the first path part.
    const kind = url.host;
    const value = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    const fragment = `#${kind}=${value}`;
    return value && FRAGMENT.test(fragment) ? fragment : null;
  }
  if (url.protocol === "https:" && url.host === GAME_HOST && FRAGMENT.test(url.hash)) return url.hash;
  return null;
}

/** The desktop app's link for a shared replay, for the web version's "Open in the desktop app". */
export function appReplayLinkOf(id: string): string {
  return `${APP_LINK_SCHEME}://replay/${encodeURIComponent(id)}`;
}

/**
 * Hands `link` to the system from the web version without leaving the page: through a hidden frame, so a browser with
 * no app for the scheme (Firefox shows an error page for one) leaves the game, and the replay loading in it, alone.
 */
export function launchAppLink(link: string, doc: Document = document): void {
  const frame = doc.createElement("iframe");
  frame.style.display = "none";
  frame.src = link;
  doc.body.append(frame);
  setTimeout(() => frame.remove(), 3000);
}

/**
 * Whether to offer "Open in the desktop app": the web version on a desktop browser. Not in an app (it is the app), and
 * not on a phone or tablet, which has no desktop app to open.
 */
export function offersDesktopApp(
  platform: Platform = detectPlatform(),
  userAgent: string = globalThis.navigator?.userAgent ?? "",
  touchPoints: number = globalThis.navigator?.maxTouchPoints ?? 0,
): boolean {
  if (platform !== "web" || /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return false;
  // iPadOS Safari reads as a Mac by default ("Macintosh … Safari"); no Mac has a touch screen.
  if (/Macintosh/i.test(userAgent) && touchPoints > 1) return false;
  return true;
}

/**
 * Screens where starting the page again would lose something the player has not saved yet: a deck being built, a
 * game or campaign being set up, save data being moved. A link that arrives on one waits until the player leaves it.
 */
export const RELOAD_UNSAFE_SCENES: readonly string[] = [
  "DeckBuilder",
  // Deck check stops the screen it was opened from and carries its work: an unsaved deck from the deck builder, or a
  // Take your seats setup in progress.
  "DeckCheck",
  "Decks",
  "ScenarioSelect",
  "Seats",
  "Setup",
  "SetupDeal",
  "CampaignRoster",
  "CampaignMarket",
  "CampaignDeckEdit",
  "CampaignFrozenDeck",
  "CivilWarBuilder",
  "SaveDataOverlay",
  "SyncDataOverlay",
];

/** Whether none of `activeKeys` is a screen that a reload would lose work on. */
export function reloadIsSafe(activeKeys: readonly string[]): boolean {
  return !activeKeys.some((key) => RELOAD_UNSAFE_SCENES.includes(key));
}

/** What the shells answer: the link the app started with, and a way to hear the ones that come later. */
export interface AppLinkSource {
  readonly launchLinks: () => Promise<readonly string[]>;
  readonly listen: (onLink: (link: string) => void) => void;
}

async function tauriSource(): Promise<AppLinkSource> {
  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  return {
    launchLinks: async () => (await getCurrent()) ?? [],
    listen: (onLink) => void onOpenUrl((urls) => urls.forEach(onLink)),
  };
}

async function capacitorSource(): Promise<AppLinkSource> {
  const { App } = await import("@capacitor/app");
  return {
    launchLinks: async () => {
      const launch = await App.getLaunchUrl();
      return launch?.url ? [launch.url] : [];
    },
    listen: (onLink) => void App.addListener("appUrlOpen", (event) => onLink(event.url)),
  };
}

/**
 * Whether the Android or iOS app build has the App plugin (`@capacitor/app`): the native bridge lists its plugins
 * (`Capacitor.PluginHeaders`) before any page script runs. An APK built before it has none, and then `@capacitor/core`
 * is not loaded at launch for it (as `platform/power-saving.ts` does for its plugin).
 */
export function hasAppPlugin(global: object = globalThis): boolean {
  const headers = (global as { Capacitor?: { PluginHeaders?: readonly { name?: string }[] } }).Capacitor?.PluginHeaders;
  return headers?.some((header) => header.name === "App") ?? false;
}

function sourceFor(platform: Platform): Promise<AppLinkSource> | null {
  if (platform === "tauri") return tauriSource();
  if (platform === "capacitor" && hasAppPlugin()) return capacitorSource();
  return null;
}

export interface AppLinkLocation {
  readonly hash: string;
  readonly pathname: string;
  readonly search: string;
  reload(): void;
}

/** Where the launch link already opened is kept for this run of the app (session storage). */
export interface LaunchLinkMemory {
  get(): string | null;
  set(link: string): void;
}

const LAUNCH_LINK_KEY = "mc-app-launch-link";

const sessionMemory: LaunchLinkMemory = {
  get: () => {
    try {
      return globalThis.sessionStorage?.getItem(LAUNCH_LINK_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set: (link) => {
    try {
      globalThis.sessionStorage?.setItem(LAUNCH_LINK_KEY, link);
    } catch {
      // Without storage a reload may open the launch link again; nothing worse.
    }
  },
};

export interface AppLinkHistory {
  readonly state: unknown;
  replaceState(data: unknown, unused: string, url: string): void;
}

/** Puts `fragment` on the address, where Boot and Title read it. */
function putOnAddress(fragment: string, location: AppLinkLocation, history: AppLinkHistory): void {
  history.replaceState(history.state, "", `${location.pathname}${location.search}${fragment}`);
}

/**
 * The installed app's link handling, started before the game (`main.ts`): resolves once a link the app was started
 * with is on the address (or at once, on the web or with none), never later than `maxWaitMs`, so a slow shell never
 * holds the game back (a launch link that comes later still opens). Later links reload the page with theirs, once the
 * screen is one that loses nothing by it (`canReload`). The shells keep answering the launch link for as long
 * as the app runs, so it is opened once (`memory`), not again on every reload.
 */
export async function startAppLinks(
  source: Promise<AppLinkSource> | null = sourceFor(detectPlatform()),
  location: AppLinkLocation = globalThis.location,
  history: AppLinkHistory = globalThis.history,
  maxWaitMs = 600,
  memory: LaunchLinkMemory = sessionMemory,
  canReload: () => boolean = () => true,
): Promise<void> {
  if (!source) return;
  let started = false;
  let placed = false;
  let waiting: ReturnType<typeof setInterval> | null = null;
  // After the game has started, the page starts again to open a link, but only on a screen that loses nothing by it
  // (`canReload`: not the deck builder or a setup half filled in); until then the link waits on the address.
  const reloadWhenSafe = (): void => {
    if (canReload()) return location.reload();
    if (waiting !== null) return;
    waiting = setInterval(() => {
      if (!canReload()) return;
      if (waiting !== null) clearInterval(waiting);
      location.reload();
    }, 1000);
  };
  const open = (fragment: string): void => {
    putOnAddress(fragment, location, history);
    placed = true;
    if (started) reloadWhenSafe();
  };
  const atLaunch = (async () => {
    const shell = await source;
    shell.listen((link) => {
      const fragment = gameFragmentOf(link);
      if (fragment) open(fragment);
    });
    const launch = (await shell.launchLinks()).find((link) => gameFragmentOf(link) !== null);
    if (!launch || memory.get() === launch) return;
    // Opened, or passed over for a newer link that arrived since: either way not again after a reload.
    memory.set(launch);
    if (placed) return;
    // Late (a slow shell answered after the game started): it still opens, as a later link does.
    open(gameFragmentOf(launch)!);
  })().catch(() => undefined);
  await Promise.race([atLaunch, new Promise((resolve) => setTimeout(resolve, maxWaitMs))]);
  started = true;
}
