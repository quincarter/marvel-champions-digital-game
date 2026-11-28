import type Phaser from "phaser";
import { applyTextResolution, drawnDensity } from "../../platform/screen-settings.js";
import { guidePrefs, setGuidePrefs } from "../../guide/guide-store.js";
import { applyEarnedItems } from "../../progression/progression.js";
import { appSession } from "../../session.js";
import type { PauseSettingRow, PauseSettingsState } from "../../view/pause-search.js";
import {
  cheatUnlockWarningOf,
  nextGuidePrefsAfterRow,
  nextSettingsAfterToggle,
  type GuideRowInfo,
} from "../../view/settings-rows.js";
import type { AchievementToastScene } from "../achievement-toast.js";
import { askToConfirm } from "../end-turn-confirm.js";
import { SCENES } from "../keys.js";

/** What a settings change on Pause asks of the scene. */
export interface SettingsActionHost {
  readonly scene: Phaser.Scene;
  /** Closing already: a late answer must not act. */
  leaving(): boolean;
  /** Indexes the search again and draws the sheet. */
  refresh(): void;
}

/** The rows whose change the music player has to hear about. */
const MUSIC_ROW_IDS: ReadonlySet<string> = new Set(["sound", "music-shuffle", "music-volume", "effects-volume"]);

function land(
  host: SettingsActionHost,
  row: PauseSettingRow,
  before: PauseSettingsState,
  next: PauseSettingsState,
): void {
  if (next.settings !== before.settings) {
    if (row.id === "sharper-text") applyTextResolution(next.settings);
    if (MUSIC_ROW_IDS.has(row.id)) appSession().music?.syncSettings(next.settings);
    appSession().settings = next.settings;
    applyEarnedItems();
    // A sample at the new level, and the popup where it now shows, as Settings does.
    if (row.id === "effects-volume") appSession().music?.playEffect("basic-attack");
    if (row.id.startsWith("achievement-popup-"))
      (host.scene.scene.get(SCENES.achievementToast) as AchievementToastScene | null)?.preview();
  }
  // The guide store's own change event indexes again and redraws this sheet.
  if (next.guide !== before.guide) setGuidePrefs(next.guide);
  else host.refresh();
}

/** A press on a Settings toggle (no `value`) or one of a choice's options, found by the search. */
export function applySetting(host: SettingsActionHost, row: PauseSettingRow, value?: string): void {
  if (!row.apply) return;
  const before = { settings: appSession().settings, guide: guidePrefs() };
  const next = row.apply(before, value, drawnDensity());
  // Turning on a way for a game to stop counting (Undo past your turn, Manual adjust) asks first, as Settings does.
  const warning = cheatUnlockWarningOf(before.settings, next.settings);
  if (warning) {
    askToConfirm(host.scene, warning.title, warning.sentence, warning.confirmLabel, () => {
      if (!host.leaving()) land(host, row, before, next);
    });
    return;
  }
  land(host, row, before, next);
}

/** A press on a Table row's switch (phone). */
export function toggleTableRow(host: SettingsActionHost, id: string): void {
  const next = nextSettingsAfterToggle(appSession().settings, id as never, drawnDensity());
  if (id === "sharper-text") applyTextResolution(next);
  if (id === "sound" || id === "music-shuffle") appSession().music?.syncSettings(next);
  appSession().settings = next;
  host.refresh();
}

/** A press on a Guide row: a switch flips, "Play the tutorial" is for the scene (`onTutorial`), the rest has no target yet. */
export function activateGuideRow(
  host: SettingsActionHost,
  row: GuideRowInfo | undefined,
  onTutorial: () => void,
): void {
  if (!row || row.kind === "segmented") return;
  if (row.kind === "action") {
    // "Aspect lessons" (G10c) has no target yet, still dashed unavailable; "Play the tutorial" (G6b) does.
    if (row.id === "play-tutorial") onTutorial();
    return;
  }
  setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), row.id));
  host.refresh();
}
