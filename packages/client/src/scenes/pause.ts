/**
 * Pause (docs/phase4-screen-gaps.md §3 "W4"; design canvases D13, P16, L07).
 *
 * Launched over the Board by its own MENU/≡ chrome button, or by Escape when
 * nothing else (a target/payment mode, the choice sheet, Inspect, the villain
 * walkthrough) already owns it — see `scenes/board.ts`'s own wiring. The board
 * keeps running underneath, exactly like every other overlay in this app.
 *
 * One panel at every size (`view/pause-layout.ts`'s own doc comment says why),
 * top to bottom: the status line, Resume, Save & quit, Rules reference,
 * Settings, "Jump to a moment", and Concede.
 *
 * Concede dispatches the engine's `concede` command (`docs/phase4-screen-gaps.md`
 * §2 S5.9: any seated player may concede for the whole table; the outcome is
 * `{ result: "conceded" }`, never a loss). The store's own state update then
 * ends the game the normal way, same as any other command, and the Board hands
 * off to Game Over — so on success this overlay only has to get out of the way.
 */
import Phaser from "phaser";
import { POOL_SCENARIOS } from "../content/pool.js";
import { accent, ink, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, label, paintDotGrid } from "../ui/widgets.js";
import { pauseLayout } from "../view/pause-layout.js";
import { pauseStatusOf } from "../view/pause-model.js";
import { pauseFocusOrder } from "../view/screen-focus.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import type { SessionState } from "../store/session-store.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export class PauseOverlay extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #confirmingConcede = false;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.#confirmingConcede = false;
    const { store } = appSession();
    this.#unsubscribe = store.subscribe(() => this.#draw());
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.rules) || this.scene.isActive(SCENES.settings) || this.scene.isActive(SCENES.inspect),
      onCancel: () => (this.#confirmingConcede ? this.#setConfirmingConcede(false) : this.#resume()),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #setConfirmingConcede(value: boolean): void {
    this.#confirmingConcede = value;
    this.#draw();
  }

  #resume(): void {
    this.scene.stop();
  }

  /** Saves are continuous (every command is written as it lands), so "quitting" is just leaving — nothing to flush. */
  #saveAndQuit(): void {
    for (const overlay of [SCENES.rules, SCENES.settings, SCENES.choice, SCENES.inspect, SCENES.villainPhase]) {
      if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
    }
    if (this.scene.isActive(SCENES.board)) this.scene.stop(SCENES.board);
    this.scene.start(SCENES.title);
  }

  /** True when the engine accepted the concession; the store then carries the outcome. */
  async #dispatchConcede(): Promise<boolean> {
    const { store } = appSession();
    const playerId = store.state.perspectiveId;
    if (!playerId) return false;
    return store.dispatch({ type: "concede", playerId });
  }

  async #onConcedeConfirmed(): Promise<void> {
    const conceded = await this.#dispatchConcede();
    this.#setConfirmingConcede(false);
    // The engine's refusal (already over, no seat) is in `store.state.error`,
    // which the Board shows; the overlay stays open so the player sees it.
    if (conceded) this.#resume();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);

    const { store } = appSession();
    const { game, perspectiveId, config } = store.state;
    const { width, height } = this.scale.gameSize;
    const layout = pauseLayout({ x: 0, y: 0, width, height });

    // Dim scrim over the board, then the panel itself.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.55).fillRect(0, 0, width, height);
    const panel = this.add.graphics();
    panel.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel.lineStyle(4, surface.paper.hex, 1).strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    paintDotGrid(this, layout.panel, "ink", { spacing: 8, radius: 1, alpha: 0.08 });

    this.#drawHeader(layout.header, game, perspectiveId, config);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    this.#button(order, stops, "resume", "primary", "Resume", layout.resume, () => this.#resume());
    this.#button(order, stops, "save-quit", "secondary", "Save & quit", layout.saveQuit, () => this.#saveAndQuit());
    this.#button(order, stops, "rules", "secondary", "Rules reference", layout.rulesButton, () => this.scene.launch(SCENES.rules));
    this.#button(order, stops, "settings", "secondary", "Settings", layout.settingsButton, () => this.scene.launch(SCENES.settings));

    label(this, layout.momentsHeading.x, layout.momentsHeading.y, "Jump to a moment", typeRole.label, surface.paper.hex, ink.secondary);
    this.#drawMomentsUnavailable(layout.moments, order, stops);

    if (this.#confirmingConcede) this.#drawConcedeConfirm(layout.footer, order, stops);
    else {
      this.#button(order, stops, "concede", "quiet", "Concede", layout.footer, () => this.#setConfirmingConcede(true));
    }

    this.#route?.set(pauseFocusOrder({ momentIds: ["info"], confirmingConcede: this.#confirmingConcede }), stops);
  }

  #drawHeader(rect: Rect, game: SessionState["game"], perspectiveId: SessionState["perspectiveId"], config: SessionState["config"]): void {
    this.add.text(rect.x + 16, rect.y + 8, caseOf(typeRole.screenTitle, "Paused"), { ...textStyle(typeRole.screenTitle, surface.paper.hex), fontSize: "34px" });
    const statusText = game && perspectiveId ? this.#statusLine(game, perspectiveId, config) : "No game in progress.";
    label(this, rect.x + 16, rect.y + 46, statusText, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(11);
    const rule = this.add.graphics();
    rule.fillStyle(surface.paper.hex, 0.4).fillRect(rect.x, rect.y + rect.height - 2, rect.width, 2);
  }

  #statusLine(game: NonNullable<SessionState["game"]>, perspectiveId: NonNullable<SessionState["perspectiveId"]>, config: SessionState["config"]): string {
    const status = pauseStatusOf(game, perspectiveId, config, POOL_SCENARIOS);
    return `${status.scenarioName} · ${status.difficultyLabel} · Round ${status.round} · ${status.phaseLabel} · ${status.seatLabel}`;
  }

  /**
   * The moments list (S7) drawn as one honestly-unavailable row rather than
   * fabricated moment labels — see docs/phase4-screen-gaps.md §2 "S7"'s "Not
   * done" note. There is nothing real to jump *to* yet: the read-only board
   * that would render a replayed state doesn't exist (`view/replay-cursor.ts`
   * has the cursor model; wiring it into what the Board draws is a scene-sized
   * follow-up, not a seam this pass could safely land). This still takes
   * keyboard/pad focus so the reason is reachable without a mouse.
   */
  #drawMomentsUnavailable(rect: Rect, order: string[], stops: Map<string, FocusStop>): void {
    const g = this.add.graphics();
    g.lineStyle(2, surface.paper.hex, 0.4);
    const dash = 6;
    for (let x = rect.x; x < rect.x + rect.width; x += dash * 2) g.lineBetween(x, rect.y, Math.min(x + dash, rect.x + rect.width), rect.y);
    for (let x = rect.x; x < rect.x + rect.width; x += dash * 2) g.lineBetween(x, rect.y + rect.height, Math.min(x + dash, rect.x + rect.width), rect.y + rect.height);
    this.add
      .text(
        rect.x + 12,
        rect.y + 10,
        "Not available yet — the read-only replay board hasn't landed (docs/phase4-screen-gaps.md S7). This game's log is still complete; there's just nowhere yet to view it mid-game.",
        textStyle(typeRole.body, surface.paper.hex, ink.secondary),
      )
      .setFontSize(11)
      .setWordWrapWidth(rect.width - 24);
    order.push("moment:info");
    stops.set("moment:info", { rect, activate: () => undefined });
  }

  #drawConcedeConfirm(rect: Rect, order: string[], stops: Map<string, FocusStop>): void {
    const halfWidth = (rect.width - 8) / 2;
    const yesRect: Rect = { x: rect.x, y: rect.y, width: halfWidth, height: rect.height };
    const cancelRect: Rect = { x: rect.x + halfWidth + 8, y: rect.y, width: halfWidth, height: rect.height };
    this.add
      .text(rect.x, rect.y - 20, "Concede? This ends the game for the whole table.", textStyle(typeRole.body, accent.heroRed.hex))
      .setFontSize(11);
    order.push("concede-confirm-yes");
    stops.set("concede-confirm-yes", { rect: yesRect, activate: () => void this.#onConcedeConfirmed() });
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Yes, concede",
        type: typeRole.label,
        rect: yesRect,
        onClick: () => void this.#onConcedeConfirmed(),
      }),
    );
    order.push("concede-confirm-cancel");
    stops.set("concede-confirm-cancel", { rect: cancelRect, activate: () => this.#setConfirmingConcede(false) });
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "Cancel",
        type: typeRole.label,
        rect: cancelRect,
        onClick: () => this.#setConfirmingConcede(false),
      }),
    );
  }

  #button(
    order: string[],
    stops: Map<string, FocusStop>,
    id: string,
    kind: "primary" | "secondary" | "quiet",
    text: string,
    rect: Rect,
    onClick: () => void,
  ): void {
    order.push(id);
    stops.set(id, { rect, activate: onClick });
    this.#buttons.push(new McButton(this, { kind, label: text, type: kind === "primary" ? typeRole.barTitle : typeRole.rowTitle, rect, onClick, enabled: true }));
  }
}
