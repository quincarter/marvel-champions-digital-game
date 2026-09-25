/**
 * Small text a size up on desktop.
 *
 * The type scale (`tokens.ts`) and the sizes set straight on labels were tuned on phone, where a 9–11px label sits
 * close to the eye. On a desktop monitor at arm's length those same sizes read as too small, on every screen. Rather
 * than fork every size by form factor, this bumps them in one place: the CSS font string Phaser's `TextStyle` builds
 * (`_font`), which every text path goes through (a `textStyle()` object, `setFontSize`, an inline `fontSize`).
 *
 * The size the code asks for stays what `style.fontSize` reports; only what's drawn and measured grows, so layout
 * that measures a label (`fitText`, `setWordWrapWidth`, a row sized to its text) sees the real, larger size.
 * Phone, phone-landscape and tablet are untouched. The bump is decided when a label's font is set, and every screen
 * redraws on resize, so crossing the desktop breakpoint takes effect on that screen's next draw.
 */

import Phaser from "phaser";
import { desktopFont } from "../view/desktop-type.js";
import { SCENES } from "../scenes/keys.js";

let desktop = false;

/**
 * Screens that keep the original sizes on desktop. Decks & Collection and the deck builder pack a card grid, a deck
 * list and a stats rail side by side; their small type was laid out to that density and reads fine there, while a
 * size up only crowds captions out of their cells.
 */
const ORIGINAL_SIZE_SCENES: ReadonlySet<string> = new Set([SCENES.decks, SCENES.deckBuilder]);

/** Whether the viewport is desktop-sized (`formFactorFor(...) === "desktop"`). Set on boot and on every resize. */
export function setDesktopType(value: boolean): void {
  desktop = value;
}

/** Whether small text is drawn a size up right now, for a layout that has to leave room for it. */
export const isDesktopType = (): boolean => desktop;

/** The two fields of Phaser's `TextStyle` this reads: its own font string, and the label it belongs to. */
interface StyleWithFont {
  mcFont?: string;
  readonly parent?: Phaser.GameObjects.Text;
}

let installed = false;

/**
 * Routes every `TextStyle`'s font string through `desktopFont`. An accessor on the prototype, so Phaser's own
 * `this._font = …` assignments (`setStyle`, `update`, `setFont`) land in the setter. Call once, before the game is
 * created.
 */
export function installDesktopType(): void {
  if (installed) return;
  installed = true;
  Object.defineProperty(Phaser.GameObjects.TextStyle.prototype, "_font", {
    configurable: true,
    get(this: StyleWithFont): string {
      return this.mcFont ?? "";
    },
    set(this: StyleWithFont, value: string) {
      const sceneKey = this.parent?.scene?.sys.settings.key;
      this.mcFont = desktopFont(value, desktop && !(sceneKey !== undefined && ORIGINAL_SIZE_SCENES.has(sceneKey)));
    },
  });
}
