/**
 * The dark mode toggle (#459): a moon or a sun at the top of every screen (`view/theme-button.ts` says where). A tap
 * flips Settings' "Dark mode" and every screen on the table recolors in place (`ui/color-scheme-phaser.ts`).
 *
 * Like the music, language and Report buttons it runs for the whole session from Boot as chrome, above every screen
 * (see `CHROME_SCENES`), and follows its slot every frame. It sits below the notices and popups that drop over the top
 * bar (an achievement, power saving), so a tap on one of those never lands here. It is deliberately not a focus stop:
 * a stop at the top centre of every screen pulled the d-pad and Tab off each screen's own controls. A keyboard or pad
 * flips the same switch from Settings > Display > Dark mode, a row like any other.
 */
import Phaser from "phaser";
import { appSession } from "../session.js";
import { hit, surface } from "../tokens.js";
import { onTap } from "../ui/tap.js";
import { musicSlots } from "../ui/music-slot.js";
import { themeSlots } from "../ui/theme-slot.js";
import { colorScheme, onColorSchemeChange, type ColorScheme } from "../view/color-scheme.js";
import { languageSlotBeside } from "../view/language-button.js";
import type { Rect } from "../view/layout.js";
import { reportButtonSlot } from "../view/report-button.js";
import { floatingThemeSlot, themeIconOf, themeSlotBeside } from "../view/theme-button.js";
import { CHROME_SCENES, SCENES } from "./keys.js";

/** The scenes that sort themselves above the screens (the chrome, its popups and the music scene). */
const ABOVE_SCREENS: ReadonlySet<string> = new Set([
  ...CHROME_SCENES,
  SCENES.languagePopup,
  SCENES.musicPlayer,
  SCENES.reportIssue,
  SCENES.music,
]);

export class ThemeButtonScene extends Phaser.Scene {
  #graphics: Phaser.GameObjects.Graphics | null = null;
  #zone: Phaser.GameObjects.Zone | null = null;
  #rect: Rect | null = null;
  #hovered = false;
  #drawnScheme: ColorScheme | null = null;

  constructor() {
    super(SCENES.themeButton);
  }

  create(): void {
    this.#graphics = this.add.graphics().setDepth(2);
    this.#zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(2).setInteractive({ useHandCursor: true });
    this.#zone.on("pointerover", () => this.#setHovered(true));
    this.#zone.on("pointerout", () => this.#setHovered(false));
    onTap(this.#zone, () => this.toggle(), "theme-button");
    const off = onColorSchemeChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.#place(null);
    // Dev-only hook: where the button is and which scheme is up, for headless screenshots and click-throughs.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcThemeButtonDebug?: unknown }).__mcThemeButtonDebug = {
        rect: () => this.#rect,
        scheme: () => colorScheme(),
      };
    }
  }

  override update(): void {
    const manager = this.scene.manager;
    const screens = manager.getScenes(true).filter((scene) => !ABOVE_SCREENS.has(scene.scene.key));
    const top = screens.at(-1)?.scene.key;
    if (top && manager.getIndex(SCENES.themeButton) < manager.getIndex(top)) manager.moveAbove(top, SCENES.themeButton);
    // Nothing to sit on until Boot has handed over to a screen.
    if (!top || top === SCENES.boot) {
      this.#place(null);
      return;
    }
    const own = themeSlots().get(top);
    if (own) {
      this.#place(own);
      return;
    }
    const running = manager
      .getScenes(true)
      .map((scene) => ({ key: scene.scene.key, visible: scene.sys.settings.visible }));
    const slot = reportButtonSlot(running, musicSlots());
    this.#place(slot ? themeSlotBeside(languageSlotBeside(slot.rect)) : floatingThemeSlot(this.scale.gameSize));
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`). */
  debugState(): Record<string, unknown> {
    return { rect: this.#rect, scheme: colorScheme() };
  }

  /** What a tap does. */
  toggle(): void {
    const session = appSession();
    session.settings = { ...session.settings, darkMode: !session.settings.darkMode };
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
    if (!graphics || !zone) return;
    graphics.clear();
    this.#drawnScheme = colorScheme();
    const rect = this.#rect;
    if (!rect) {
      zone.disableInteractive();
      return;
    }
    // The same ink chrome button as MENU, Report and the note; filled paper while hovered.
    const ground = this.#hovered ? surface.paper.hex : surface.ink.hex;
    const ink = this.#hovered ? surface.ink.hex : surface.paper.hex;
    graphics.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const size = Math.min(18, Math.round(rect.height * 0.55));
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    if (themeIconOf(this.#drawnScheme) === "moon") drawMoonIcon(graphics, cx, cy, size, ink, ground);
    else drawSunIcon(graphics, cx, cy, size, ink);
    // The phone's tab is drawn short to stay above the title line; its press area is a full touch target.
    const hitWidth = Math.max(rect.width, hit.target);
    const hitHeight = Math.max(rect.height, 32);
    zone.setPosition(rect.x - (hitWidth - rect.width) / 2, rect.y).setSize(hitWidth, hitHeight);
    zone.setInteractive({ useHandCursor: true });
    zone.input?.hitArea.setTo(0, 0, hitWidth, hitHeight);
  }
}

/** A crescent moon, `size` px across: a disc with a disc of the ground bitten out of its upper right. */
export function drawMoonIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  ground: number,
): void {
  const r = size / 2;
  graphics.fillStyle(color, 1).fillCircle(cx, cy, r);
  graphics.fillStyle(ground, 1).fillCircle(cx + r * 0.45, cy - r * 0.35, r * 0.82);
}

/**
 * A sun, `size` px across: a ring and eight rays. Strokes only: the sun shows while dark mode is on, where a paper
 * *fill* would take the dark ground's color (`view/color-scheme.ts`) and a paper *line* stays paper.
 */
export function drawSunIcon(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
): void {
  const r = size / 2;
  graphics.lineStyle(Math.max(2, size / 7), color, 1).strokeCircle(cx, cy, r * 0.34);
  graphics.lineStyle(Math.max(1.5, size / 10), color, 1);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    graphics.lineBetween(cx + cos * r * 0.62, cy + sin * r * 0.62, cx + cos * r, cy + sin * r);
  }
}
