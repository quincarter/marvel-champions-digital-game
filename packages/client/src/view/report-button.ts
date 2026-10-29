/**
 * Where the Report button (#176, `scenes/report-button.ts`) is drawn: a bug icon in a screen's own top bar.
 *
 * A screen that has room in its top bar leaves a slot there (`ui/report-slot.ts`): the Board beside MENU, Title in its
 * top corner. The button is drawn above every scene, so it stays usable under the in-game overlays that leave the
 * Board's top bar showing (a choice, Inspect, the villain phase). Under anything else that runs above the slot's own
 * screen (Pause, Settings, Rules, Game over, a campaign screen), it is hidden: those draw their own top bar over the
 * slot, and the button would land on their controls.
 */
import type { Rect } from "./layout.js";

/** Overlays that leave the Board's top bar showing, so the button stays on it while they are up. */
export const KEEPS_REPORT_SLOT: ReadonlySet<string> = new Set([
  "ChoiceOverlay",
  "InspectOverlay",
  "VillainPhaseOverlay",
  "EndTurnConfirmOverlay",
  "HoldOnOverlay",
  "MusicScene",
  "ReportButton",
  "ReportIssueOverlay",
  "MusicButton",
  "MusicPlayerOverlay",
  "LanguageButton",
  "ThemeButton",
  "LanguagePopupOverlay",
  "PowerSavingNotice",
  "SyncPrompt",
  "SyncSetupNotice",
]);

export interface RunningScene {
  readonly key: string;
  /** Whether the scene draws anything (Music runs invisibly above every screen). */
  readonly visible: boolean;
}

/**
 * The slot to draw the button in, or null: the topmost running scene that left a slot, provided every visible
 * scene above it leaves the slot showing. `running` is bottom first, as the scene manager lists it.
 */
export function reportButtonSlot(
  running: readonly RunningScene[],
  slots: ReadonlyMap<string, Rect>,
): { readonly key: string; readonly rect: Rect } | null {
  for (let index = running.length - 1; index >= 0; index -= 1) {
    const scene = running[index]!;
    const rect = slots.get(scene.key);
    if (rect) return { key: scene.key, rect };
    if (scene.visible && !KEEPS_REPORT_SLOT.has(scene.key)) return null;
  }
  return null;
}

/** The top bar's own padding below the chrome buttons in it (`scenes/board/chrome.ts` insets them 5 px). */
const BAR_PADDING = 5;

/**
 * Where an overlay that keeps the slot showing has to start its own content (#514): the bottom of the top bar the
 * chrome buttons stay on, or 0 while they are hidden. A sheet drawn higher has its title covered by the buttons.
 */
export function chromeBarBottom(running: readonly RunningScene[], slots: ReadonlyMap<string, Rect>): number {
  const slot = reportButtonSlot(running, slots);
  return slot ? slot.rect.y + slot.rect.height + BAR_PADDING : 0;
}
