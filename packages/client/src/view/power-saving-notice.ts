/**
 * The words the game shows when it notices power saving mode (`platform/power-saving.ts`): the notice that drops in
 * when the mode turns on or off (`scenes/power-saving-notice.ts`), the Title footer's standing line, and the extra
 * sentence on the Settings rows the mode changes. Pure, so the wording is tested once.
 */
import { POWER_SAVING_FPS } from "../platform/power-saving.js";
import type { Settings } from "../settings.js";

export interface PowerSavingNotice {
  readonly heading: string;
  readonly body: string;
}

/** What the notice says as the mode turns on (with what the game changed) or off. */
export function powerSavingNoticeOf(on: boolean, settings: Pick<Settings, "reducedMotion">): PowerSavingNotice {
  if (!on) {
    return { heading: "Power saving off", body: "Animation, sharp text and the full frame rate are back." };
  }
  return {
    heading: "Power saving detected",
    body: settings.reducedMotion
      ? `Reduced motion and a ${POWER_SAVING_FPS} fps cap are on while it lasts.`
      : `A ${POWER_SAVING_FPS} fps cap is on while it lasts.`,
  };
}

/** The Title footer's line while the mode is on; null while it is off. */
export function powerSavingFooterOf(on: boolean): string | null {
  return on ? `Power saving detected · lighter effects, ${POWER_SAVING_FPS} fps` : null;
}

/** The sentence a Settings row's detail gains while power saving mode is on, for the rows the mode turns down. */
export const POWER_SAVING_ROW_NOTE = "Power saving mode is on, so this follows it unless you change it here.";
