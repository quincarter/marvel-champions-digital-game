/**
 * "Which copy do you want to keep?" (issue #276, step 2): both devices played the same game since they last synced and
 * the two games went different ways. Launched by `scenes/sync-prompt.ts` over whatever screen is up, one game at a time.
 * It names the game, says each side's round and last play time (and which is newer, in words), and offers Keep this
 * device, Keep the other device and Keep both (not for a campaign game, which says why). The choice that loses nothing,
 * Keep both (Keep this device for a campaign), is the primary button and first in the keyboard route. Nothing is
 * decided by a timer or by closing the prompt: the sync waits for the answer.
 *
 * When the Board is up, "Peek at table" steps the panel aside for a compact banner (`view/peek-banner.ts`) so the table
 * can be looked over before choosing.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { peekBannerLayout, peekEdge, peekMoveLabel, flipPeekEdge } from "../view/peek-banner.js";
import { CONFLICT_CLOSED, conflictPromptOf } from "../view/sync-model.js";
import { syncSetupButtonSpan } from "../view/sync-setup-prompt.js";
import type { PendingConflict } from "../sync/sync-service.js";
import type { ConflictChoice } from "../sync/sync-types.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const buttonType = { ...typeRole.label, size: 13 };
const PANEL_MAX = 560;
const PAD = 20;

export interface SyncConflictSceneData {
  readonly pending: PendingConflict;
}

export class SyncConflictOverlay extends Phaser.Scene {
  #pending: PendingConflict | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #peeking = false;
  #answered = false;

  constructor() {
    super(SCENES.syncConflict);
  }

  create(data: SyncConflictSceneData): void {
    this.#pending = data.pending;
    this.#motion = new OverlayMotion();
    this.#peeking = false;
    this.#answered = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    // Escape does nothing: the question has to be answered (the sync is waiting on it).
    this.#route = new FocusRoute(this, { onCancel: () => (this.#peeking ? this.#setPeek(false) : undefined) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.game.events.emit(CONFLICT_CLOSED);
    });
    this.#draw();
  }

  #answer(choice: ConflictChoice): void {
    if (this.#answered || !this.#pending) return;
    this.#answered = true;
    this.#pending.answer(choice);
    this.#motion.exit(this, () => this.scene.stop());
  }

  #setPeek(on: boolean): void {
    this.#peeking = on;
    this.#draw();
  }

  /** The Board (or its deal) is what a peek shows; elsewhere the dimmed screen already shows enough. */
  get #tableUp(): boolean {
    return (
      this.scene.isActive(SCENES.board) ||
      this.scene.isPaused(SCENES.board) ||
      this.scene.isActive(SCENES.setupDeal) ||
      this.scene.isPaused(SCENES.setupDeal)
    );
  }

  #draw(): void {
    if (this.#motion.leaving || !this.#pending) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const prompt = conflictPromptOf(this.#pending.conflict, Date.now());
    const { width, height } = this.scale.gameSize;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    if (this.#peeking) {
      const phone = formFactorFor(width, height) === "phone" || formFactorFor(width, height) === "phoneLandscape";
      const area: Rect = { x: 8, y: 8, width: width - 16, height: height - 16 };
      const layout = peekBannerLayout(area, peekEdge(), phone);
      const ground = this.add.graphics();
      ground
        .fillStyle(surface.ink.hex, 1)
        .fillRect(layout.banner.x, layout.banner.y, layout.banner.width, layout.banner.height);
      ground
        .lineStyle(2, surface.paper.hex, 1)
        .strokeRect(layout.banner.x, layout.banner.y, layout.banner.width, layout.banner.height);
      this.add
        .text(
          layout.text.x,
          layout.text.y + layout.text.height / 2,
          "Which copy to keep?",
          textStyle(typeRole.label, surface.paper.hex),
        )
        .setOrigin(0, 0.5);
      const move = (): void => {
        flipPeekEdge();
        this.#draw();
      };
      const back = (): void => this.#setPeek(false);
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: peekMoveLabel(layout.edge),
          type: buttonType,
          rect: layout.move,
          onClick: move,
        }),
        new McButton(this, { kind: "secondary", label: "Back", type: buttonType, rect: layout.back, onClick: back }),
      );
      stops.set("back", { rect: layout.back, activate: back });
      stops.set("move", { rect: layout.move, activate: move });
      order.push("back", "move");
      this.#route?.set(order, stops);
      return;
    }

    // Swallows taps that land on no control, so none reach the screen underneath.
    const zone = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const ground = this.add.graphics();

    const panelWidth = Math.min(PANEL_MAX, width - 24);
    const x = Math.round((width - panelWidth) / 2);
    const inner = panelWidth - PAD * 2;
    const buttonWidth = Math.min(inner, 400);

    // One list of rows, laid out top to bottom once their heights are known; the panel is centered around them.
    type Row = { readonly height: number; readonly place: (y: number) => void };
    const rows: Row[] = [];
    const textRow = (
      value: string,
      style: Phaser.Types.GameObjects.Text.TextStyle,
      size: number,
      gap: number,
    ): void => {
      const object = this.add
        .text(x + PAD, 0, value, style)
        .setFontSize(size)
        .setWordWrapWidth(inner)
        .setLineSpacing(3);
      rows.push({ height: object.height + gap, place: (y) => object.setY(y) });
    };
    const buttonRow = (
      spec: { id: string; label: string; primary: boolean; onClick: () => void; width?: number },
      detail: string | null,
    ): void => {
      // Each button and its line sit centred in the panel, however narrow the button is.
      const span = syncSetupButtonSpan(x + PAD, inner, spec.width ?? buttonWidth);
      const detailObject = detail
        ? this.add
            .text(span.x + span.width / 2, 0, detail, {
              ...textStyle(typeRole.body, surface.paper.hex, 0.75),
              align: "center",
            })
            .setOrigin(0.5, 0)
            .setFontSize(11)
            .setWordWrapWidth(span.width)
        : null;
      rows.push({
        height: hit.primary + 2 + (detailObject ? detailObject.height : 0) + 8,
        place: (y) => {
          const rect: Rect = { x: span.x, y, width: span.width, height: hit.primary };
          this.#buttons.push(
            new McButton(this, {
              kind: spec.primary ? "primary" : "secondary",
              label: spec.label,
              type: buttonType,
              rect,
              onClick: spec.onClick,
            }),
          );
          stops.set(spec.id, { rect, activate: spec.onClick });
          detailObject?.setY(y + hit.primary + 2);
        },
      });
    };

    textRow(caseOf(typeRole.sectionHeader, prompt.title), textStyle(typeRole.sectionHeader, surface.paper.hex), 20, 8);
    textRow(prompt.body, textStyle(typeRole.body, surface.paper.hex, 0.9), 14, 12);
    for (const side of [prompt.local, prompt.remote]) {
      textRow(`${side.heading}${side.newer ? " (newer)" : ""}`, textStyle(typeRole.label, surface.paper.hex), 13, 0);
      textRow(side.line, textStyle(typeRole.body, surface.paper.hex, 0.85), 13, 8);
    }
    for (const button of prompt.buttons) {
      buttonRow(
        {
          id: button.choice,
          label: button.label,
          primary: button.choice === prompt.defaultChoice,
          onClick: () => this.#answer(button.choice),
        },
        button.detail,
      );
    }
    if (prompt.campaignNote) textRow(prompt.campaignNote, textStyle(typeRole.body, surface.paper.hex, 0.85), 12, 8);
    if (this.#tableUp) {
      buttonRow(
        {
          id: "peek",
          label: "Peek at table ▾",
          primary: false,
          width: Math.min(inner, 220),
          onClick: () => this.#setPeek(true),
        },
        null,
      );
    }

    const total = rows.reduce((sum, row) => sum + row.height, 0);
    const panelHeight = total + PAD * 2;
    const panelTop = Math.max(8, Math.round((height - panelHeight) / 2));
    let y = panelTop + PAD;
    for (const row of rows) {
      row.place(y);
      y += row.height;
    }
    ground.fillStyle(surface.ink.hex, 1).fillRect(x, panelTop, panelWidth, panelHeight);
    ground.lineStyle(4, surface.paper.hex, 1).strokeRect(x, panelTop, panelWidth, panelHeight);
    // Back to front: the tap-swallowing zone, the scrim, the panel ground, then the text and buttons.
    this.children.sendToBack(ground);
    this.children.sendToBack(scrim);
    this.children.sendToBack(zone);

    // The default choice leads the keyboard route.
    order.push(prompt.defaultChoice, ...prompt.buttons.map((b) => b.choice).filter((c) => c !== prompt.defaultChoice));
    if (stops.has("peek")) order.push("peek");
    this.#route?.set(order, stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.filter((o) => o !== zone && o !== scrim) });
  }
}
