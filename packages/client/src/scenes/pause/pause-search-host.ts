import type Phaser from "phaser";
import { artLanguageNow } from "../../art/art-source.js";
import { readConsent } from "../../global-stats/global-consent.js";
import { inputDevice } from "../../platform/input-device.js";
import { followsWindowsMixer } from "../../platform/app-volume.js";
import { powerSavingOn } from "../../platform/power-saving.js";
import { guidePrefs } from "../../guide/guide-store.js";
import { earnedItems, earnedPromoSets, unlocks } from "../../progression/progression.js";
import { appSession } from "../../session.js";
import { t } from "../../i18n/translate.js";
import { heroPromoShown } from "../../view/hero-art-choice.js";
import { pauseSettingRowsOf, type PauseSettingRow } from "../../view/pause-search.js";
import { guideRowInfoOf } from "../../view/settings-rows.js";
import type { SettingsSearchEntry, SettingsSearchIndexInput } from "../../view/settings-search.js";
import { controlsShown, settingsDeviceRowsFor, settingsTabsFor } from "../settings-env.js";
import { REFERENCE_KEYWORDS, type QuickEntry } from "./pause-quick-rows.js";

/** The Settings rows this device shows and Pause can find, as they read now. */
export function settingRowsOf(): readonly PauseSettingRow[] {
  const settings = appSession().settings;
  return pauseSettingRowsOf(settings, guidePrefs(), {
    powerSaving: powerSavingOn(),
    mixer: followsWindowsMixer(),
    promoShown: heroPromoShown(earnedPromoSets(), settings.promoArtOn),
    earned: earnedItems(),
  });
}

/** Pause's own Reference rows, as search entries. */
function referenceEntriesOf(entries: readonly QuickEntry[]): readonly SettingsSearchEntry[] {
  return entries.map((row) => ({
    id: `pause:${row.id}`,
    title: row.title,
    detail: row.detail,
    place: t("pause.place"),
    target: { kind: "pause", id: row.id },
    ...(REFERENCE_KEYWORDS[row.id] ? { keywords: REFERENCE_KEYWORDS[row.id] } : {}),
  }));
}

/** What Settings' search worker indexes, with Pause's Settings rows and Reference rows, as they read now. */
export function searchIndexInputOf(game: Phaser.Game, quick: readonly QuickEntry[]): SettingsSearchIndexInput {
  const { width, height } = game.scale.gameSize;
  const settings = appSession().settings;
  const { progress, prefs, devUnlockAll, achievementPoints } = unlocks();
  return {
    tabs: settingsTabsFor(game, width, height, settings, guideRowInfoOf(guidePrefs())),
    rows: [
      // The rows Pause has no control for first, so a row Pause can change wins where both name it.
      ...settingsDeviceRowsFor(game, width, height, settings),
      ...settingRowsOf().map((row) => [row.id, { title: row.title, detail: row.detail }] as const),
    ],
    settings,
    pad: inputDevice().pad,
    unlocks: { progress, prefs, devUnlockAll, achievementPoints },
    globalConsent: readConsent(),
    controls: controlsShown(),
    language: artLanguageNow(),
    extra: referenceEntriesOf(quick),
  };
}
