/**
 * How the standalone Settings screen (`scenes/settings.ts`) groups its rows into labeled sections (issue #169): one
 * place that says which setting sits under which heading, in draw order, so the scene only draws and a test can check
 * that every setting shows up exactly once. Pure data: the scene still owns each row's control.
 */
import type { GuideSettingsRowId, SettingsRowId } from "./settings-rows.js";

/** Every row the Settings screen can draw, by the id its focus stop is keyed on. */
export type SettingsItemId =
  | SettingsRowId
  | "card-size"
  | "card-hover"
  | "token-motion"
  | "villain-auto"
  | "villain-hold"
  | "villain-speed"
  | "villain-dock"
  | GuideSettingsRowId
  | "unlocks"
  | "save-data"
  | "rules";

export type SettingsSectionId = "gameplay" | "villain" | "cards" | "motion" | "sound" | "guide" | "more";

export interface SettingsSection {
  readonly id: SettingsSectionId;
  readonly title: string;
  readonly items: readonly SettingsItemId[];
}

/**
 * The sections, top to bottom. `guideRowIds` is the Guide group's rows in draw order (`guideRowInfoOf`), which grows
 * with the hint warnings. `cardHover` is false off desktop, where there is no mouse popover to size.
 */
export function settingsSectionsOf(input: {
  readonly guideRowIds: readonly GuideSettingsRowId[];
  readonly cardHover: boolean;
}): readonly SettingsSection[] {
  return [
    { id: "gameplay", title: "Gameplay", items: ["confirm-end-turn", "same-name-conflict"] },
    { id: "villain", title: "Villain phase", items: ["villain-auto", "villain-hold", "villain-speed", "villain-dock"] },
    {
      id: "cards",
      title: "Cards",
      items: [
        "card-size",
        ...(input.cardHover ? (["card-hover"] as const) : []),
        "hover-hero",
        "hover-villain",
        "large-card-text",
      ],
    },
    { id: "motion", title: "Animation and display", items: ["reduced-motion", "token-motion", "sharper-text"] },
    { id: "sound", title: "Sound", items: ["sound"] },
    { id: "guide", title: "Guide", items: input.guideRowIds },
    { id: "more", title: "More", items: ["unlocks", "save-data", "rules"] },
  ];
}
