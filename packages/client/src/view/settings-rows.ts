/**
 * The client-preference toggle rows shown on the standalone Settings screen
 * (`scenes/settings.ts`) and inline in Pause's "Table" group (`scenes/pause.ts`,
 * design canvases D13/P16/L07) — one shared, tested list of titles/details/on-state
 * so the wording can't drift between the two places it's drawn. Pure data: a scene
 * still owns the actual toggle (it needs `appSession()`, which view modules never
 * import), keyed by `SettingsRowInfo.id`.
 */
import { SHARP_TEXT_RESOLUTION_CEILING, type Settings } from "../settings.js";

export type SettingsRowId = "reduced-motion" | "sharper-text" | "large-card-text" | "sound";

export interface SettingsRowInfo {
  readonly id: SettingsRowId;
  readonly title: string;
  readonly detail: string;
  readonly on: boolean;
  /** Present only for a row this build can't act on yet — drawn dim with this as its reason, never omitted. */
  readonly unavailable?: string;
}

export function settingsRowInfoOf(settings: Settings): readonly SettingsRowInfo[] {
  return [
    {
      id: "reduced-motion",
      title: "Reduced motion",
      detail: "Skip travel animation and auto-advancing reveals; beats and state changes still appear, just without the motion.",
      on: settings.reducedMotion,
    },
    {
      id: "sharper-text",
      title: "Sharper text",
      detail: "Renders text at the screen's own pixel density. Off trades a little crispness for less texture memory.",
      on: settings.textResolution > 1,
    },
    {
      id: "large-card-text",
      title: "Large card text",
      detail: "Reads a card's full rules text larger in the Inspect sheet — the screen whose whole job is reading a card closely.",
      on: settings.largeCardText,
    },
    {
      id: "sound",
      title: "Sound",
      detail: "Background music and audio across menus and games.",
      on: settings.sound,
    },
  ];
}

/** The value "Sharper text" should switch *to* when it's off, given the screen's own device pixel ratio. What "off" restores is always `1`. */
export function sharperTextTargetResolution(devicePixelRatio: number): number {
  return Math.min(SHARP_TEXT_RESOLUTION_CEILING, Math.max(1, devicePixelRatio || 1));
}

/**
 * `settings` with one row's toggle applied — the one place that logic lives,
 * so Pause's inline "Table" group and the standalone Settings screen flip the
 * same field the same way.
 */
export function nextSettingsAfterToggle(settings: Settings, id: SettingsRowId, devicePixelRatio: number): Settings {
  switch (id) {
    case "reduced-motion":
      return { ...settings, reducedMotion: !settings.reducedMotion };
    case "sharper-text":
      return { ...settings, textResolution: settings.textResolution > 1 ? 1 : sharperTextTargetResolution(devicePixelRatio) };
    case "large-card-text":
      return { ...settings, largeCardText: !settings.largeCardText };
    case "sound":
      return { ...settings, sound: !settings.sound };
  }
}
