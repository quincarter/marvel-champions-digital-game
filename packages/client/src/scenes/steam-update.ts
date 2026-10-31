/**
 * The update panel for a game the Install for Steam script installed: it runs the script's saved copy
 * (`platform/steam-install.ts`) with its progress on screen, because a Steam Deck in Game Mode has no terminal. Opened
 * from the Title's update banner and from Settings ▸ More. Closing it mid-download leaves the script running: it
 * finishes whenever the player quits, and opening the panel again picks it back up.
 */
import Phaser from "phaser";
import { cardLanguage } from "../art/card-language.js";
import { openExternal } from "../platform/platform.js";
import { quitForSteamUpdate, startSteamUpdate, steamUpdateStatus } from "../platform/steam-install.js";
import { hit, signal, surface, typeRole } from "../tokens.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import type { Rect } from "../view/layout.js";
import {
  steamUpdateViewOf,
  type SteamUpdatePhase,
  type SteamUpdateStatus,
  type SteamUpdateView,
} from "../view/steam-update.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { PressGuard } from "./press-guard.js";
import { SCENES } from "./keys.js";

const POLL_MS = 500;
const PANEL_MAX = 480;
const PAD = 20;
const BAR_HEIGHT = 10;
const buttonType = { ...typeRole.label, size: 13 };

export interface SteamUpdateSceneData {
  /** The version on offer, or null when the panel was opened to check (Settings). */
  readonly version: string | null;
  /** Where a failed update can send the player instead. */
  readonly fallbackUrl: string;
}

export class SteamUpdateOverlay extends Phaser.Scene {
  #data: SteamUpdateSceneData = { version: null, fallbackUrl: "" };
  #status: SteamUpdateStatus | null = null;
  #started = false;
  /** Asked the shell to start, and it hasn't answered. */
  #starting = false;
  #startError: string | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #hints!: GlyphHints;
  #guard!: PressGuard;
  #primary: string | null = null;
  /** What is on screen, so a poll that changes nothing doesn't rebuild the panel under the player's press or focus. */
  #shown = "";
  #phase: SteamUpdatePhase | null = null;
  /** The download bar's fill, redrawn alone as the percent moves. */
  #bar: { readonly fill: Phaser.GameObjects.Graphics; readonly rect: Rect } | null = null;

  constructor() {
    super(SCENES.steamUpdate);
  }

  create(data: SteamUpdateSceneData): void {
    this.#data = data;
    this.#status = null;
    this.#started = false;
    this.#starting = false;
    this.#startError = null;
    this.#shown = "";
    this.#phase = null;
    this.#bar = null;
    this.#primary = null;
    this.#motion = new OverlayMotion();
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#hints = new GlyphHints(this);
    this.#guard = new PressGuard(this);
    this.#route = new FocusRoute(this, {
      blocked: () => !this.#guard.armed,
      onCancel: () => this.#close(),
      primary: () => this.#primary,
    });
    const poll = this.time.addEvent({ delay: POLL_MS, loop: true, callback: () => void this.#poll() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      poll.remove(false);
      this.scale.off("resize", onResize, this);
      this.#hints.dispose();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    // An update left running in the background is picked back up instead of asking again.
    void steamUpdateStatus()
      .then((status) => {
        if (!this.sys.isActive() || !status.running) return;
        this.#started = true;
        this.#status = status;
        this.#draw();
      })
      .catch(() => undefined);
    this.#draw();
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`) and the e2e specs. */
  debugState(): Record<string, unknown> {
    return { phase: this.#view().phase, started: this.#started };
  }

  #view(): SteamUpdateView {
    if (this.#startError !== null) {
      return { phase: "failed", heading: "The update didn't start", body: this.#startError, percent: null };
    }
    return steamUpdateViewOf(this.#status, this.#started, this.#data.version);
  }

  async #start(): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    try {
      // The shell starts a new log before it answers, so no poll can read the last run's as this one's.
      await startSteamUpdate(cardLanguage());
      this.#started = true;
      await this.#poll();
    } catch (error) {
      this.#startError = String(error);
      this.#draw();
    }
  }

  async #poll(): Promise<void> {
    if (!this.#started || this.#startError !== null || this.#motion.leaving) return;
    const status = await steamUpdateStatus().catch(() => null);
    if (status === null || !this.sys.isActive()) return;
    this.#status = status;
    this.#draw(false);
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #draw(always = true): void {
    if (this.#motion.leaving) return;
    const view = this.#view();
    this.#paintBar(view.percent);
    const fingerprint = `${view.phase}|${view.heading}|${view.body}`;
    if (!always && fingerprint === this.#shown) return;
    this.#shown = fingerprint;
    // A new step's buttons appear under the player's thumbs, and "Quit and install" exits at once: no stray press.
    if (this.#phase !== null && view.phase !== this.#phase) this.#guard.restart();
    this.#phase = view.phase;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#hints.reset();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    // Swallows taps that land on no control, so none reach the screen underneath.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const ground = this.add.graphics();

    const panelWidth = Math.min(PANEL_MAX, width - 24);
    const x = Math.round((width - panelWidth) / 2);
    const inner = panelWidth - PAD * 2;
    const title = this.add
      .text(
        x + PAD,
        0,
        caseOf(typeRole.sectionHeader, view.heading),
        textStyle(typeRole.sectionHeader, surface.paper.hex),
      )
      .setFontSize(20)
      .setWordWrapWidth(inner);
    const body = this.add
      .text(x + PAD, 0, view.body, textStyle(typeRole.body, surface.paper.hex, 0.9))
      .setFontSize(14)
      .setWordWrapWidth(inner)
      .setLineSpacing(3);

    const actions = this.#actionsOf(view.phase);
    const showBar = view.phase === "working";
    const contentHeight =
      title.height + 10 + body.height + 16 + (showBar ? BAR_HEIGHT + 16 : 0) + actions.length * (hit.primary + 8) - 8;
    const panelHeight = contentHeight + PAD * 2;
    const top = Math.max(12, Math.round((height - panelHeight) / 2));
    ground.fillStyle(surface.ink.hex, 1).fillRect(x, top, panelWidth, panelHeight);
    ground.lineStyle(2, surface.paper.hex, 1).strokeRect(x, top, panelWidth, panelHeight);

    let y = top + PAD;
    title.setY(y);
    y += title.height + 10;
    body.setY(y);
    y += body.height + 16;
    if (showBar) {
      ground.fillStyle(surface.void.hex, 1).fillRect(x + PAD, y, inner, BAR_HEIGHT);
      this.#bar = { fill: this.add.graphics(), rect: { x: x + PAD, y, width: inner, height: BAR_HEIGHT } };
      this.#paintBar(view.percent);
      y += BAR_HEIGHT + 16;
    } else {
      this.#bar = null;
    }

    const stops = new Map<string, FocusStop>();
    actions.forEach((action, index) => {
      const rect: Rect = { x: x + PAD, y, width: inner, height: hit.primary };
      const button = new McButton(this, {
        kind: index === 0 && actions.length > 1 ? "primary" : "secondary",
        label: action.label,
        type: buttonType,
        rect,
        onClick: action.onClick,
      });
      this.#buttons.push(button);
      if (action.id === "close") this.#hints.button(button, ["cancel"], "paper");
      stops.set(action.id, { rect, activate: action.onClick });
      y += hit.primary + 8;
    });
    this.#primary = actions[0]?.id ?? null;
    this.#route?.set(
      actions.map((action) => action.id),
      stops,
    );
  }

  #paintBar(percent: number | null): void {
    if (this.#bar === null) return;
    const { fill, rect } = this.#bar;
    fill.clear().fillStyle(signal.caution.hex, 1);
    fill.fillRect(rect.x, rect.y, (rect.width * (percent ?? 0)) / 100, rect.height);
  }

  #actionsOf(
    phase: SteamUpdatePhase,
  ): readonly { readonly id: string; readonly label: string; readonly onClick: () => void }[] {
    const close = { id: "close", label: "Close", onClick: () => this.#close() };
    const quit = { id: "quit", label: "Quit and install", onClick: () => void quitForSteamUpdate() };
    switch (phase) {
      case "ask":
        return [
          { id: "start", label: "Update now", onClick: () => void this.#start() },
          { ...close, label: "Not now" },
        ];
      case "ready":
        return [quit, { ...close, label: "Keep playing" }];
      case "done":
        return [{ ...quit, label: "Quit" }, close];
      case "failed":
        return [
          { id: "download", label: "Go to the download ↗", onClick: () => openExternal(this.#data.fallbackUrl) },
          close,
        ];
      default:
        return [close];
    }
  }
}
