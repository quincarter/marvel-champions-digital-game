/**
 * Screens that draw the top-bar chrome buttons themselves, in the DOM (the Title's icon row). The chrome scenes (Report,
 * music, language, theme) still follow the screen's slot, so the pop-ups anchor to it and the focus route and the tap
 * handlers keep working, but they paint nothing and take no press while the screen under them draws the buttons.
 */
const screens = new Set<string>();

/** Says that the screen `sceneKey` draws the chrome buttons in its own DOM (or stops saying so). */
export function setChromeDrawnByDom(sceneKey: string, on: boolean): void {
  if (on) screens.add(sceneKey);
  else screens.delete(sceneKey);
}

/** Whether the screen that owns the chrome slot (`sceneKey`) draws the buttons itself. */
export function chromeDrawnByDom(sceneKey: string | undefined): boolean {
  return sceneKey !== undefined && screens.has(sceneKey);
}
