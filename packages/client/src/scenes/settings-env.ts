/**
 * What this device and build show on the Settings screen: which tabs, which rows. Shared by Settings itself
 * (`scenes/settings.ts`) and Pause's search (`scenes/pause.ts`), which finds a Settings row under the tab Settings
 * would draw it on, and leaves out a row Settings would not draw here.
 */
import type Phaser from "phaser";
import { availableCardLanguages } from "../art/card-language.js";
import type { Settings } from "../settings.js";
import { followsWindowsMixer } from "../platform/app-volume.js";
import { hasDesktopWindow, onHandheldLinux } from "../platform/desktop-window.js";
import { padAvailable } from "../platform/input-device.js";
import { detectPlatform } from "../platform/platform.js";
import { canReadPowerSaving, powerSavingState } from "../platform/power-saving.js";
import { drawsAtScreenDensity, screenEnvironment } from "../platform/screen-density.js";
import { knownSteamInstall } from "../platform/steam-install.js";
import { couchBaseSize } from "../ui/render-resolution.js";
import type { CouchSize } from "../view/couch-mode.js";
import { formFactorFor } from "../view/layout.js";
import { settingsLayout } from "../view/settings-layout.js";
import { couchModeRowInfoOf, type GuideRowInfo } from "../view/settings-rows.js";
import { settingsTabsOf } from "../view/settings-sections.js";

/** The narrowest tab cell that still shows "Display" and "Sound" whole (#243). */
const SOUND_TAB_MIN_CELL = 64;

/**
 * The size couch mode divides, from the real window (couch mode shrinks the game's own size, which must not hide the
 * row that undoes it): the fixed resolution when one is set, else the window.
 */
export function couchBaseOf(game: Phaser.Game): CouchSize {
  return couchBaseSize(game) ?? { width: window.innerWidth, height: window.innerHeight };
}

/** The Couch mode row: any build with a choice besides Off on this window (a phone has none), and while it is on. */
export function couchModeShown(game: Phaser.Game, settings: Settings): boolean {
  return settings.couchMode !== "off" || couchModeRowInfoOf(settings, couchBaseOf(game)).options.length > 1;
}

/** The phone apps show Controls only once a controller is connected (the owner, 2026-10-24). */
export function controlsShown(): boolean {
  return detectPlatform() !== "capacitor" || padAvailable();
}

/** The Screen section: every build, unless `?renderscale=off`. */
export function screenSettingsShown(): boolean {
  const env = screenEnvironment();
  return drawsAtScreenDensity(env.search);
}

/** The tabs Settings shows on this device at `width` by `height`. */
export function settingsTabsFor(
  game: Phaser.Game,
  width: number,
  height: number,
  settings: Settings,
  guideRows: readonly GuideRowInfo[],
) {
  return settingsTabsOf({
    guideRowIds: guideRows.map((row) => row.id),
    cardHover: formFactorFor(width, height) === "desktop",
    cardLanguage: availableCardLanguages().length > 1,
    inspectCard: formFactorFor(width, height) === "phone",
    gameVolume: followsWindowsMixer(),
    // Sound's own tab only where six fit with their names whole; a phone keeps five, Sound under Display.
    soundTab: settingsLayout({ x: 0, y: 0, width, height }, []).tabs.width / 6 >= SOUND_TAB_MIN_CELL,
    couchMode: couchModeShown(game, settings),
    desktopWindow: hasDesktopWindow(),
    discord: hasDesktopWindow(),
    steamInstall: knownSteamInstall()?.canUpdate === true,
    steamDeck: onHandheldLinux(),
    powerSaving:
      canReadPowerSaving(detectPlatform(), globalThis.navigator?.userAgent ?? "") || powerSavingState().detected,
    screenSettings: screenSettingsShown(),
    controls: controlsShown(),
  });
}
