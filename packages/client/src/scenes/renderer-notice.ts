/**
 * "Drawing without WebGL": a one-time notice over Title when the browser had no WebGL and the game fell back to the
 * Canvas renderer by itself (`platform/renderer-options.ts`). It says why the game may run slower and look softer, and
 * how to turn WebGL back on in this browser (`view/webgl-help.ts`). Launched by `maybeShowRendererNotice`
 * (`scenes/renderer-notice-launch.ts`).
 *
 * Closing it (the button, Escape or the pad's B) is remembered on this device, so it never comes again. Its one press
 * is an `McButton` (nothing fires on the lift of a swipe) and nothing here scrolls. Modeled on the sync setup prompt.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { markRendererNoticeSeen, webglHelpText } from "../view/webgl-help.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { rendererNoticeWanted } from "./renderer-notice-launch.js";

const buttonType = { ...typeRole.label, size: 13 };
const PANEL_MAX = 560;
const PAD = 20;

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class RendererNoticeOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #closed = false;

  constructor() {
    super(SCENES.rendererNotice);
  }

  create(): void {
    // Started after Title gave the launch up (a slow load, or Title already left): close before drawing anything.
    if (!rendererNoticeWanted()) {
      this.scene.stop();
      return;
    }
    this.#motion = new OverlayMotion();
    this.#closed = false;
    this.sys.setVisible(true);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    // The language button stays above the notice: a switch redraws it in the new language.
    const offLanguage = onLanguageChange(onResize);
    this.#route = new FocusRoute(this, { onCancel: () => this.#close(), primary: () => "ok" });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      offLanguage();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`) and the e2e specs. */
  debugState(): Record<string, unknown> {
    return { closed: this.#closed };
  }

  #close(): void {
    if (this.#closed || this.#motion.leaving) return;
    this.#closed = true;
    markRendererNoticeSeen(browserStorage());
    this.#motion.exit(this, () => this.scene.stop());
  }

  #draw(): void {
    if (this.#motion.leaving || this.#closed) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height } = this.scale.gameSize;
    const stops = new Map<string, FocusStop>();

    // Swallows taps that land on no control, so none reach Title underneath.
    const zone = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const ground = this.add.graphics();

    const panelWidth = Math.min(PANEL_MAX, width - 24);
    const x = Math.round((width - panelWidth) / 2);
    const narrow = width < 480;
    const ua = globalThis.navigator?.userAgent ?? "";

    type Row = { readonly height: number; readonly place: (y: number) => void };
    // The text at `scale` and the panel's padding: a short screen (a landscape phone) shrinks both until the panel and
    // its only button fit, so the button can never fall below the screen.
    const build = (scale: number, pad: number): { rows: Row[]; texts: Phaser.GameObjects.Text[] } => {
      const inner = panelWidth - pad * 2;
      const rows: Row[] = [];
      const texts: Phaser.GameObjects.Text[] = [];
      const textRow = (
        value: string,
        style: Phaser.Types.GameObjects.Text.TextStyle,
        size: number,
        gap: number,
      ): void => {
        const object = this.add
          .text(x + pad, 0, value, style)
          .setFontSize(Math.round(size * scale))
          .setWordWrapWidth(inner)
          .setLineSpacing(scale < 1 ? 1 : 3);
        texts.push(object);
        rows.push({ height: object.height + Math.round(gap * scale), place: (y) => object.setY(y) });
      };
      textRow(
        caseOf(typeRole.sectionHeader, t("rendererNotice.heading")),
        textStyle(typeRole.sectionHeader, surface.paper.hex),
        20,
        10,
      );
      textRow(t("rendererNotice.body"), textStyle(typeRole.body, surface.paper.hex, 0.9), narrow ? 13 : 14, 12);
      textRow(t("rendererNotice.stepsHeading"), textStyle(typeRole.label, surface.paper.hex), 13, 6);
      textRow(webglHelpText(ua), textStyle(typeRole.body, surface.paper.hex, 0.9), narrow ? 12 : 13, 14);
      const close = (): void => this.#close();
      rows.push({
        // The button keeps its full touch size whatever the text does.
        height: hit.primary,
        place: (y) => {
          const buttonWidth = Math.min(inner, 220);
          const rect = { x: x + panelWidth - pad - buttonWidth, y, width: buttonWidth, height: hit.primary };
          this.#buttons.push(
            new McButton(this, {
              kind: "primary",
              label: t("rendererNotice.ok"),
              type: buttonType,
              rect,
              onClick: close,
            }),
          );
          stops.set("ok", { rect, activate: close });
        },
      });
      return { rows, texts };
    };

    const room = height - 16;
    let pad = PAD;
    let built = build(1, pad);
    for (const scale of [0.9, 0.8, 0.7]) {
      if (built.rows.reduce((sum, row) => sum + row.height, 0) + pad * 2 <= room) break;
      for (const text of built.texts) text.destroy();
      pad = 12;
      built = build(scale, pad);
    }
    const total = built.rows.reduce((sum, row) => sum + row.height, 0);
    const panelHeight = total + pad * 2;
    const panelTop = Math.max(8, Math.round((height - panelHeight) / 2));
    let y = panelTop + pad;
    for (const row of built.rows) {
      row.place(y);
      y += row.height;
    }
    ground.fillStyle(surface.ink.hex, 1).fillRect(x, panelTop, panelWidth, panelHeight);
    ground.lineStyle(4, surface.paper.hex, 1).strokeRect(x, panelTop, panelWidth, panelHeight);
    // Back to front: the tap-swallowing zone, the scrim, the panel ground, then the text and the button.
    this.children.sendToBack(ground);
    this.children.sendToBack(scrim);
    this.children.sendToBack(zone);

    this.#route?.set(["ok"], stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.filter((o) => o !== zone && o !== scrim) });
  }
}
