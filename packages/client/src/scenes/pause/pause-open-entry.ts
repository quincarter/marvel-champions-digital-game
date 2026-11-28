import type { PlayerStatsData } from "../player-stats.js";
import type { SettingsSceneData } from "../settings.js";
import type { UnlocksSceneData } from "../unlocks.js";
import type { SaveDataSceneData } from "../save-data.js";
import type { ControlsSceneData } from "../controls.js";
import { SCENES } from "../keys.js";
import type { SettingsSearchEntry } from "../../view/settings-search.js";
import type { QuickHost } from "./pause-quick-rows.js";

/** A press on a result with no control of its own: its page, on the spot it was found. */
export function openSearchEntry(host: QuickHost, entry: SettingsSearchEntry): void {
  const target = entry.target;
  switch (target.kind) {
    case "setting":
      return host.launchOver(SCENES.settings, {
        focus: { item: target.item, tab: target.tab },
      } satisfies SettingsSceneData);
    case "rules":
      return host.openRules({
        initialTab: target.tab,
        initialScope: "all",
        ...(target.query !== undefined ? { initialQuery: target.query } : {}),
      });
    case "unlocks":
      return host.launchOver(SCENES.unlocks, {
        ...(target.row !== undefined ? { row: target.row } : {}),
        ...(target.guideSection !== undefined ? { guideSection: target.guideSection } : {}),
      } satisfies UnlocksSceneData);
    case "saveData":
      return host.launchOver(SCENES.saveData, { row: target.row } satisfies SaveDataSceneData);
    case "controls":
      return host.launchOver(SCENES.controls, { tab: target.tab } satisfies ControlsSceneData);
    case "stats":
      if (!host.isActive(SCENES.playerStats))
        host.launch(SCENES.playerStats, {
          from: SCENES.pause,
          overlay: true,
          tab: target.tab,
        } satisfies PlayerStatsData);
      return;
    case "pause":
      if (target.id === "jumpLog") return host.toggleFullGameLog();
      return host
        .quick()
        .find((row) => row.id === target.id)
        ?.open?.();
  }
}
