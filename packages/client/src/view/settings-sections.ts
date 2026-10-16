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
  | "display-mode"
  | "resolution"
  | "villain-auto"
  | "villain-hold"
  | "villain-speed"
  | "villain-dock"
  | GuideSettingsRowId
  | "unlocks"
  | "save-data"
  | "rules";

export type SettingsSectionId = "gameplay" | "villain" | "cards" | "window" | "motion" | "sound" | "guide" | "more";

export interface SettingsSection {
  readonly id: SettingsSectionId;
  readonly title: string;
  readonly items: readonly SettingsItemId[];
}

/**
 * The sections, top to bottom. `guideRowIds` is the Guide group's rows in draw order (`guideRowInfoOf`), which grows
 * with the hint warnings. `cardHover` is false off desktop, where there is no mouse popover to size. `desktopWindow` is
 * true only in the desktop app, the one build that can change its own window; the Window section is left out elsewhere.
 */
export function settingsSectionsOf(input: {
  readonly guideRowIds: readonly GuideSettingsRowId[];
  readonly cardHover: boolean;
  readonly desktopWindow?: boolean;
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
    ...(input.desktopWindow
      ? [{ id: "window", title: "Window", items: ["display-mode", "resolution"] } satisfies SettingsSection]
      : []),
    { id: "motion", title: "Animation and display", items: ["reduced-motion", "token-motion", "sharper-text"] },
    { id: "sound", title: "Sound", items: ["sound"] },
    { id: "guide", title: "Guide", items: input.guideRowIds },
    { id: "more", title: "More", items: ["unlocks", "save-data", "rules"] },
  ];
}

export type SettingsTabId = "gameplay" | "cards" | "display" | "guide" | "more";

export interface SettingsTab {
  readonly id: SettingsTabId;
  readonly label: string;
  readonly sections: readonly SettingsSection[];
}

/** Which sections each tab shows, left to right. Labels stay short enough for five tabs across a phone ("Game", not "Gameplay"). A tab with two sections heads each one; a tab with one doesn't repeat its own name. */
const TAB_SECTIONS: readonly {
  readonly id: SettingsTabId;
  readonly label: string;
  readonly sections: readonly SettingsSectionId[];
}[] = [
  { id: "gameplay", label: "Game", sections: ["gameplay", "villain"] },
  { id: "cards", label: "Cards", sections: ["cards"] },
  { id: "display", label: "Display", sections: ["window", "motion", "sound"] },
  { id: "guide", label: "Guide", sections: ["guide"] },
  { id: "more", label: "More", sections: ["more"] },
];

/** The Settings panel's tabs (owner, 2026-10-16: one tab at a time instead of one long scroll), built from `settingsSectionsOf`'s sections. */
export function settingsTabsOf(input: Parameters<typeof settingsSectionsOf>[0]): readonly SettingsTab[] {
  const sections = settingsSectionsOf(input);
  return TAB_SECTIONS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    sections: tab.sections.flatMap((id) => sections.filter((s) => s.id === id)),
  }));
}
