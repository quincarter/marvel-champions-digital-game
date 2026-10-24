/**
 * The card language button (#337): a globe and the language's code ("EN", "ES") in the top bar, just left of the music
 * button, on every screen that leaves the music button a slot (`ui/music-slot.ts`: the table and Title). A globe rather
 * than a flag, because a flag names a country and not a language. It reads the language the card art is drawn in now
 * (`artLanguageNow`), so it follows a change made in Settings too.
 *
 * A tap opens `scenes/language-popup.ts`: the list to pick from on the web, the "Other languages" note on a native
 * install, which carries one language only. A second tap closes it again.
 *
 * Like the music and Report buttons it runs for the whole session from Boot as chrome, above every screen (see
 * `CHROME_SCENES`), and follows the slot every frame.
 */
import Phaser from "phaser";
import { availableCardLanguages } from "../art/card-language.js";
import { artLanguageNow, onArtLanguageChange } from "../art/art-source.js";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { onTap } from "../ui/tap.js";
import { musicSlots } from "../ui/music-slot.js";
import { reportButtonSlot } from "../view/report-button.js";
import type { Rect } from "../view/layout.js";
import { languageCodeOf, languagePopupMode, languageSlotBeside } from "../view/language-button.js";
import { isNativeShell } from "../platform/platform.js";
import { SCENES } from "./keys.js";

/** The scenes that sort themselves above the screens (the same set the music button keeps clear of). */
const ABOVE_SCREENS: ReadonlySet<string> = new Set([
  SCENES.languageButton,
  SCENES.languagePopup,
  SCENES.musicButton,
  SCENES.musicPlayer,
  SCENES.reportButton,
  SCENES.reportIssue,
  SCENES.music,
  SCENES.powerSavingNotice,
  SCENES.achievementToast,
  SCENES.syncPrompt,
  SCENES.syncSetupNotice,
]);

/** Dev only: `?nativelang` shows the native install's "Other languages" note in a browser. */
function forcedInfo(): boolean {
  return import.meta.env.DEV && new URLSearchParams(globalThis.location?.search ?? "").has("nativelang");
}

export class LanguageButtonScene extends Phaser.Scene {
  #graphics: Phaser.GameObjects.Graphics | null = null;
  #code: Phaser.GameObjects.Text | null = null;
  #zone: Phaser.GameObjects.Zone | null = null;
  #rect: Rect | null = null;
  #hovered = false;
  #popupUp = false;
  #drawnCode = "";
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super(SCENES.languageButton);
  }

  create(): void {
    this.#graphics = this.add.graphics().setDepth(2);
    this.#code = this.add.text(0, 0, "", textStyle(typeRole.label, surface.paper.hex)).setOrigin(0.5).setDepth(3);
    this.#zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(2).setInteractive({ useHandCursor: true });
    this.#zone.on("pointerover", () => this.#setHovered(true));
    this.#zone.on("pointerout", () => this.#setHovered(false));
    onTap(this.#zone, () => this.#toggle(), "language-button");
    this.#unsubscribe = onArtLanguageChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
    });
    this.#place(null);
    // Headless click-through hook only: where the button is and what it says, for the e2e specs.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcLanguageButtonDebug?: unknown }).__mcLanguageButtonDebug = {
        rect: () => this.#rect,
        label: () => this.#code?.text ?? "",
      };
    }
  }

  override update(): void {
    const manager = this.scene.manager;
    const screens = manager.getScenes(true).filter((scene) => !ABOVE_SCREENS.has(scene.scene.key));
    const top = screens.at(-1)?.scene.key;
    const popupUp = manager.isActive(SCENES.languagePopup);
    if (top && popupUp && manager.getIndex(SCENES.languagePopup) < manager.getIndex(top)) {
      manager.moveAbove(top, SCENES.languagePopup);
    }
    const under = popupUp ? SCENES.languagePopup : top;
    if (under && manager.getIndex(SCENES.languageButton) < manager.getIndex(under)) {
      manager.moveAbove(under, SCENES.languageButton);
    }
    const running = manager
      .getScenes(true)
      .map((scene) => ({ key: scene.scene.key, visible: scene.sys.settings.visible }));
    const slot = reportButtonSlot(running, musicSlots());
    this.#place(slot ? languageSlotBeside(slot.rect) : null);
    // Lit while its popup is open: redraw when that changes.
    if (popupUp !== this.#popupUp) {
      this.#popupUp = popupUp;
      this.#draw();
    }
    if (this.#drawnCode !== languageCodeOf(artLanguageNow())) this.#draw();
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`). */
  debugState(): Record<string, unknown> {
    return { rect: this.#rect, code: this.#drawnCode };
  }

  #toggle(): void {
    const rect = this.#rect;
    if (!rect) return;
    if (this.scene.isActive(SCENES.languagePopup)) {
      this.scene.stop(SCENES.languagePopup);
      return;
    }
    this.scene.launch(SCENES.languagePopup, {
      mode: languagePopupMode(availableCardLanguages().length, isNativeShell(), forcedInfo()),
      anchor: rect,
    });
  }

  #place(rect: Rect | null): void {
    const same =
      rect === this.#rect ||
      (rect !== null &&
        this.#rect !== null &&
        rect.x === this.#rect.x &&
        rect.y === this.#rect.y &&
        rect.width === this.#rect.width &&
        rect.height === this.#rect.height);
    if (same) return;
    this.#rect = rect;
    this.#draw();
  }

  #setHovered(hovered: boolean): void {
    if (this.#hovered === hovered) return;
    this.#hovered = hovered;
    this.#draw();
  }

  #draw(): void {
    const graphics = this.#graphics;
    const zone = this.#zone;
    const code = this.#code;
    if (!graphics || !zone || !code) return;
    graphics.clear();
    const rect = this.#rect;
    this.#drawnCode = languageCodeOf(artLanguageNow());
    code.setText(this.#drawnCode);
    if (!rect) {
      code.setVisible(false);
      zone.disableInteractive();
      return;
    }
    // The same ink chrome button as MENU, Report and the note; filled paper while hovered or while its popup is open.
    const lit = this.#hovered || this.scene.isActive(SCENES.languagePopup);
    const ground = lit ? surface.paper.hex : surface.ink.hex;
    const ink = lit ? surface.ink.hex : surface.paper.hex;
    graphics.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const globe = Math.min(18, Math.round(rect.height * 0.5));
    const globeX = rect.x + 7 + globe / 2;
    const cy = rect.y + rect.height / 2;
    drawGlobeIcon(graphics, globeX, cy, globe, ink);
    code.setColor(`#${ink.toString(16).padStart(6, "0")}`);
    code.setPosition(globeX + globe / 2 + (rect.x + rect.width - 4 - (globeX + globe / 2)) / 2, cy);
    code.setVisible(true);
    zone.setPosition(rect.x, rect.y).setSize(rect.width, rect.height);
    zone.setInteractive({ useHandCursor: true });
    zone.input?.hitArea.setTo(0, 0, rect.width, rect.height);
  }
}

/** A globe, `size` px across, centred on (`cx`, `cy`): a circle, its equator, its axis and one meridian. */
export function drawGlobeIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
): void {
  const r = size / 2;
  graphics.lineStyle(Math.max(1.5, size / 11), color, 1);
  graphics.strokeCircle(cx, cy, r);
  graphics.strokeEllipse(cx, cy, r, size);
  graphics.lineBetween(cx - r, cy, cx + r, cy);
  graphics.lineBetween(cx, cy - r, cx, cy + r);
}
