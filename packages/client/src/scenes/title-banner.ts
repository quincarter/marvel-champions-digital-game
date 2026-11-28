/**
 * The Title's caution banner as data: the update on offer (native apps, `platform/update-check.ts`) and the notices that
 * share its slot. Saves that cannot be read come first, then a downloaded update waiting on a restart, the old-save
 * notice (web) and the update on offer. A build only ever has one at a time. The wording is `TitleBannerInput`; what
 * each button does is in `actions`, keyed by the button's focus stop.
 */
import type Phaser from "phaser";
import type { TitleBannerButton, TitleBannerInput } from "../components/title/mc-title-banner/mc-title-banner.types.js";
import { t } from "../i18n/translate.js";
import { OLD_SAVE_OPEN_ID, OLD_SAVE_PAGE_URL, dismissOldSaveNotice } from "../platform/old-save-notice.js";
import { dismissUpdate } from "../platform/update-dismissal.js";
import { STEAM_UPDATE_CLOSED } from "../view/steam-update.js";
import { SCENES } from "./keys.js";
import type { SteamUpdateSceneData } from "./steam-update.js";
import type { TitleFeeds } from "./title-feeds.js";
import { openExternal } from "../platform/platform.js";
import { quitForSteamUpdate, type SteamInstall } from "../platform/steam-install.js";
import type { SelfUpdate } from "../platform/self-update.js";
import type { AvailableUpdate } from "../platform/update-check.js";
import { UPDATE_DISMISS_ID, UPDATE_RESTART_ID, updateActions } from "../view/app-version.js";

/** The saves-stuck banner's Reload button (#871). */
export const SAVES_RELOAD_ID = "saves-reload";

export interface TitleBannerState {
  readonly update: AvailableUpdate | null;
  /** The web game's "Looking for your old save?" notice has not been closed. */
  readonly oldSave: boolean;
  /** A downloaded update waits for a restart, by its version. */
  readonly readyVersion: string | null;
  /** The saved games could not be read. */
  readonly savesStuck: boolean;
  readonly steam: SteamInstall | null;
  readonly selfUpdate: SelfUpdate | null;
  /** The last update was downloaded and the game quit for it, but it did not install. */
  readonly updateFailed: boolean;
}

export interface TitleBannerHandlers {
  readonly closeSavesStuck: () => void;
  readonly closeReady: (version: string) => void;
  readonly closeOldSave: () => void;
  readonly closeUpdate: (update: AvailableUpdate) => void;
  readonly openUpdate: (update: AvailableUpdate, installer: boolean) => void;
}

export interface TitleBanner {
  readonly input: TitleBannerInput;
  /** What each button does, by its key. */
  readonly actions: ReadonlyMap<string, () => void>;
  /** The action buttons' focus stops, in order; the close button follows them. */
  readonly stops: readonly string[];
}

const closeButton: TitleBannerButton = { key: UPDATE_DISMISS_ID, label: "×", kind: "secondary" };

function banner(
  heading: string,
  detail: string,
  buttons: readonly (TitleBannerButton & { readonly activate: () => void })[],
  close: () => void,
): TitleBanner {
  return {
    input: {
      heading,
      detail,
      buttons: buttons.map(({ key, label, kind }) => ({ key, label, kind })),
      dismiss: closeButton,
    },
    actions: new Map<string, () => void>([
      ...buttons.map((b) => [b.key, b.activate] as const),
      [UPDATE_DISMISS_ID, close],
    ]),
    stops: buttons.map((b) => b.key),
  };
}

export function titleBannerOf(state: TitleBannerState, on: TitleBannerHandlers): TitleBanner | null {
  if (state.savesStuck) {
    // Nothing else on this screen works as it should until the saves can be read: one button reloads the page, which is
    // what brings a stuck IndexedDB back on iOS (#871); the close button hides it for this visit.
    return banner(
      t("title.savesStuck"),
      t("title.savesStuckDetail"),
      [
        {
          key: SAVES_RELOAD_ID,
          kind: "primary",
          label: t("title.savesStuckReload"),
          activate: () => window.location.reload(),
        },
      ],
      on.closeSavesStuck,
    );
  }
  if (state.readyVersion !== null) {
    // "The game has been updated, restart to apply" (issue #843): Restart quits; the updater installs and, for the game's
    // own updater, starts the game again. The Steam script's update leaves starting it again to Steam, so its button says
    // Quit. Close hides it for this visit; the update still installs whenever the game quits.
    const version = state.readyVersion;
    const steam = state.steam !== null;
    return banner(
      t("title.updateReady"),
      t(steam ? "title.updateReadySteam" : "title.updateReadyDetail", { version }),
      [
        {
          key: UPDATE_RESTART_ID,
          kind: "primary",
          label: t(steam ? "title.updateQuit" : "title.updateRestart"),
          activate: () => void quitForSteamUpdate(),
        },
      ],
      () => on.closeReady(version),
    );
  }
  const update = state.update;
  if (!update && state.oldSave) {
    // The web game's "Looking for your old save?" notice (issue #723, `platform/old-save-notice.ts`): one button to the
    // moved page at the old address, whose steps recover the saves the browser kept there, and a close button that hides
    // it for good.
    return banner(
      t("title.oldSave"),
      t("title.oldSaveDetail"),
      [
        {
          key: OLD_SAVE_OPEN_ID,
          kind: "primary",
          label: t("title.oldSaveOpen"),
          activate: () => openExternal(OLD_SAVE_PAGE_URL),
        },
      ],
      on.closeOldSave,
    );
  }
  if (!update) return null;
  // The game's own updater checks the download against the release's checksum, so it needs one.
  const selfUpdate = state.selfUpdate !== null && update.downloadDigest !== null;
  const actions = updateActions(update, state.steam?.canUpdate === true, selfUpdate);
  return banner(
    // The last try was downloaded but did not install (the old game started again): said in the heading, which is short
    // enough for a phone's banner, where the version line would be cut off.
    t(state.updateFailed ? "title.updateFailed" : "title.updateAvailable"),
    t("title.updateVersion", { version: update.version }),
    actions.map((action) => ({
      key: action.id,
      kind: action.id === "update-notes" ? ("secondary" as const) : ("primary" as const),
      label: action.label,
      activate: () =>
        action.url !== null ? openExternal(action.url) : on.openUpdate(update, action.id === "update-install"),
    })),
    () => on.closeUpdate(update),
  );
}

/** The update panel: the Steam script's update, or with `installer` the game's own (`platform/self-update.ts`). */
function openSteamUpdate(scene: Phaser.Scene, feeds: TitleFeeds, update: AvailableUpdate, installer: boolean): void {
  if (scene.scene.isActive(SCENES.steamUpdate)) return;
  const selfKind = feeds.selfUpdate?.kind ?? "";
  scene.scene.launch(SCENES.steamUpdate, {
    version: update.version,
    fallbackUrl: update.downloadUrl ?? update.notesUrl,
    ...(installer && update.downloadUrl !== null && update.downloadDigest !== null
      ? {
          // These install for every user, so the system asks for an administrator's permission first.
          mode: ["msi", "deb", "rpm"].includes(selfKind) ? "installer-admin" : "installer",
          installerUrl: update.downloadUrl,
          installerDigest: update.downloadDigest,
        }
      : {}),
  } satisfies SteamUpdateSceneData);
  // Closed with the download ready, the Title says so.
  scene.game.events.once(STEAM_UPDATE_CLOSED, () => {
    if (scene.sys.isActive()) feeds.checkReady();
  });
}

/** The banner for what `feeds` knows now; its close buttons call `redraw` once the notice is gone. */
export function titleBannerFor(scene: Phaser.Scene, feeds: TitleFeeds, redraw: () => void): TitleBanner | null {
  return titleBannerOf(
    {
      update: feeds.update,
      oldSave: feeds.oldSave,
      readyVersion: feeds.readyVersion,
      savesStuck: feeds.savesStuck,
      steam: feeds.steam,
      selfUpdate: feeds.selfUpdate,
      updateFailed: feeds.updateFailed,
    },
    {
      closeSavesStuck: () => {
        feeds.savesStuck = false;
        redraw();
      },
      closeReady: (version) => {
        feeds.readyDismissed = version;
        feeds.readyVersion = null;
        redraw();
      },
      closeOldSave: () => {
        dismissOldSaveNotice();
        feeds.oldSave = false;
        redraw();
      },
      closeUpdate: (update) => {
        dismissUpdate(update.version);
        feeds.update = null;
        redraw();
      },
      openUpdate: (update, installer) => openSteamUpdate(scene, feeds, update, installer),
    },
  );
}
