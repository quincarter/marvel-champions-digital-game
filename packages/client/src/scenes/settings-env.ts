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
import { canReadPowerSaving, powerSavingOn, powerSavingState } from "../platform/power-saving.js";
import { drawsAtScreenDensity, screenEnvironment } from "../platform/screen-density.js";
import { knownSteamInstall } from "../platform/steam-install.js";
import { knownSteamAdd } from "../platform/steam-add.js";
import { t } from "../i18n/translate.js";
import { couchBaseSize } from "../ui/render-resolution.js";
import type { CouchSize } from "../view/couch-mode.js";
import { formFactorFor } from "../view/layout.js";
import { settingsLayout } from "../view/settings-layout.js";
import {
  cardLanguageRowInfoOf,
  couchModeRowInfoOf,
  discordRowInfoOf,
  liveWatchRowInfoOf,
  displayModeRowInfoOf,
  frameRateRowInfoOf,
  gameVolumeRowInfoOf,
  renderScaleRowInfoOf,
  renderScaleRowShown,
  resolutionRowInfoOf,
  type GuideRowInfo,
} from "../view/settings-rows.js";
import { settingsTabsOf, type SettingsItemId } from "../view/settings-sections.js";
import { seatNoRewind } from "../view/seat-context.js";
import type { SettingsRowText } from "../view/settings-search.js";
import { knownMixerVolume } from "../platform/app-volume.js";
import { desktopMonitor, resolutionOptionsFor } from "../platform/desktop-window.js";
import { knownHardware } from "../platform/device-hardware.js";
import { hardwareSummaryOf, recommendedScreenOf } from "../platform/device-tier.js";
import { knownRefreshInfo } from "../platform/screen-settings.js";
import { powerSavingRowOf } from "../view/power-saving-notice.js";
import { saveDataRowDetail, saveDataRowTitle } from "../view/save-data-model.js";
import { steamInstallRowDetail, steamInstallRowTitle } from "../view/steam-update.js";
import { unlocksSummaryOf } from "../view/unlocks-model.js";
import { unlocks } from "../progression/progression.js";

/** The Unlocks row's own id: a door to `scenes/unlocks.ts`, drawn after the Table toggles and only on Settings. */
export const UNLOCKS_ROW = "unlocks";

/** The Save data row's own id: a door to `scenes/save-data.ts`, right after Unlocks. */
export const SAVE_DATA_ROW = "save-data";
export const STATS_ROW = "stats";
export const statsRowDetail = (): string => t("settings.stats.detail");

/** The Rules reference row: a door to `scenes/rules.ts`'s glossary, right after Save data (owner, 2026-10-01). */
export const RULES_ROW = "rules";
export const rulesRowTitle = (): string => t("settings.rules.title");
export const rulesRowDetail = (): string => t("settings.rules.detail");

/** The Steam Deck row (SteamOS and Bazzite only): back to the display a Deck starts with. */
export const steamDeckDetail = (): string => t("settings.steamDeck.detail");

/** The Controls row: a door to `scenes/controls.ts`, the drawn controller and the keyboard's keys. */
export const CONTROLS_ROW = "controls";
export const controlsRowDetail = (): string => t("settings.controls.detail");

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

/** What the Screen rows recommend for this device's hardware. */
export function screenAdviceOf() {
  const hardware = knownHardware();
  const recommended = recommendedScreenOf(hardware);
  return { ...recommended, tier: t(`settings.tier.${recommended.tier}`), summary: hardwareSummaryOf(hardware) };
}

/**
 * The words of the Settings rows that depend on this device or its window (Screen, Window, Couch mode, Game volume,
 * Discord, Steam, power saving) and of its doors (Unlocks, Your stats, Save data, Controls, Rules reference), as Settings
 * draws them (`scenes/settings.ts` `#itemsOf`, from the same row info). Pause's search finds these and opens Settings on
 * them; it has no control of its own for them. A row this device does not show is simply not in Settings' tabs, which is
 * what decides whether it is found.
 */
export function settingsDeviceRowsFor(
  game: Phaser.Game,
  width: number,
  height: number,
  settings: Settings,
): readonly (readonly [SettingsItemId, SettingsRowText])[] {
  const rows: [SettingsItemId, SettingsRowText][] = [];
  const add = (id: SettingsItemId, row: { readonly title: string; readonly detail: string }): void => {
    rows.push([id, { title: row.title, detail: row.detail }]);
  };
  add("game-volume", gameVolumeRowInfoOf(knownMixerVolume() ?? 100));
  add("card-language", cardLanguageRowInfoOf(settings));
  add("power-saving", powerSavingRowOf(settings, powerSavingState().detected));
  if (screenSettingsShown()) {
    const screen = { width, height, devicePixelRatio: globalThis.devicePixelRatio || 1 };
    const advice = screenAdviceOf();
    // Only where Settings draws it: a result must land on a row that is there.
    const scale = renderScaleRowInfoOf(settings, screen, advice);
    if (renderScaleRowShown(scale)) add("render-scale", scale);
    add(
      "frame-rate",
      frameRateRowInfoOf(settings, knownRefreshInfo()?.maxRefreshRate ?? null, powerSavingOn(), advice),
    );
  }
  add("couch-mode", couchModeRowInfoOf(settings, couchBaseOf(game)));
  if (hasDesktopWindow()) {
    const monitor = desktopMonitor();
    const sizes = monitor === null ? [] : resolutionOptionsFor(monitor, settings.displayMode);
    add("display-mode", displayModeRowInfoOf(settings));
    add("resolution", resolutionRowInfoOf(settings, sizes, monitor, monitor?.displayModes !== undefined));
    const discord = discordRowInfoOf(settings);
    add(discord.id, { title: discord.title, detail: discord.unavailable ?? discord.detail });
  }
  add("live-watch", liveWatchRowInfoOf(settings));
  add("steam-deck", { title: "Steam Deck", detail: steamDeckDetail() });
  add("steam-install", { title: steamInstallRowTitle(), detail: steamInstallRowDetail() });
  add("steam-add", { title: t("steamAdd.row.title"), detail: t("steamAdd.row.detail") });
  add(UNLOCKS_ROW, { title: t("settings.unlocks.title"), detail: unlocksSummaryOf(unlocks()) });
  add(STATS_ROW, { title: t("settings.stats.title"), detail: statsRowDetail() });
  add(SAVE_DATA_ROW, { title: saveDataRowTitle(), detail: saveDataRowDetail() });
  add(CONTROLS_ROW, { title: t("settings.controls.title"), detail: controlsRowDetail() });
  add(RULES_ROW, { title: rulesRowTitle(), detail: rulesRowDetail() });
  return rows;
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
    steamAdd: knownSteamAdd()?.canAdd === true,
    steamDeck: onHandheldLinux(),
    powerSaving:
      canReadPowerSaving(detectPlatform(), globalThis.navigator?.userAgent ?? "") || powerSavingState().detected,
    screenSettings: screenSettingsShown(),
    controls: controlsShown(),
    cheats: !seatNoRewind(),
  });
}
