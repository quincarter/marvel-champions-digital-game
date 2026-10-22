/**
 * The one-time "Set up cross-device sync?" prompt (issue #276, step 2) and the note that follows its "Not now".
 *
 * The prompt is launched over Title by `maybeShowSyncSetupPrompt` (`scenes/sync-setup-prompt-launch.ts`), which decides
 * whether it is due (`view/sync-setup-prompt.ts`). It says what sync does and offers Set up, Join with a code and Not
 * now. Set up and Join hand over to the Sync across devices screen (`scenes/sync-data.ts`, opened at the setup or the
 * join step), so the recovery code, its acknowledge and the join field are that screen's, not copies of them; the prompt
 * steps aside while it is up and closes once sync is on (it comes back if the player backs out without turning it on).
 *
 * Any answer is remembered at once (`mcsync.prompted`), so it never comes again. Escape is Not now. While it is up it
 * owns the keyboard and the pad (`conflictPromptOwnsInput`), like the conflict prompt. Every press is an `McButton`
 * (nothing fires on the lift of a swipe) and nothing here scrolls.
 *
 * "Not now" launches `SyncSetupNotice`: a few seconds of text along the bottom edge saying where to find sync later. It
 * takes no input, so a tap lands on the screen under it (`CHROME_SCENES`).
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { appSession } from "../session.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import {
  SYNC_NOTICE_BODY,
  SYNC_NOTICE_HEADING,
  SYNC_NOTICE_HOLD_MS,
  SYNC_SETUP_BODY,
  SYNC_SETUP_BUTTONS,
  SYNC_SETUP_LATER,
  SYNC_SETUP_TITLE,
  markSyncPromptAnswered,
  syncSetupAnswerOutcome,
  type SyncSetupAnswer,
} from "../view/sync-setup-prompt.js";
import { syncService } from "../sync/sync-wiring.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { SyncDataSceneData } from "./sync-data.js";

const buttonType = { ...typeRole.label, size: 13 };
const PANEL_MAX = 520;
const PAD = 20;

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class SyncSetupPromptOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #answered = false;

  constructor() {
    super(SCENES.syncSetupPrompt);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#answered = false;
    this.sys.setVisible(true);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      // The sync screen it opens has its own route and owns Escape while it is up.
      blocked: () => this.scene.isActive(SCENES.syncData),
      onCancel: () => this.#answer("not-now"),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #answer(answer: SyncSetupAnswer): void {
    if (this.#answered || this.#motion.leaving) return;
    this.#answered = true;
    markSyncPromptAnswered(browserStorage());
    const outcome = syncSetupAnswerOutcome(answer);
    if (outcome.openSyncScreen) {
      this.#openSync(outcome.openSyncScreen);
      return;
    }
    if (outcome.notice) this.scene.launch(SCENES.syncSetupNotice);
    this.#motion.exit(this, () => this.scene.stop());
  }

  /** The sync screen draws its own full-screen panel; this one steps aside until it closes. */
  #openSync(start: "setup" | "join"): void {
    this.input.enabled = false;
    this.sys.setVisible(false);
    this.scene.launch(SCENES.syncData, { start } satisfies SyncDataSceneData);
    this.scene.get(SCENES.syncData)?.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.sys.isActive()) return;
      if (syncService().isOn()) {
        this.input.enabled = true;
        this.#motion.exit(this, () => this.scene.stop(), 0);
        return;
      }
      // Backed out without turning sync on: the question is still open.
      this.#answered = false;
      this.input.enabled = true;
      this.sys.setVisible(true);
      this.#draw();
    });
  }

  #draw(): void {
    if (this.#motion.leaving || this.#answered) return;
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
    const inner = panelWidth - PAD * 2;
    const buttonWidth = Math.min(inner, 400);

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
    const buttonRow = (id: string, label: string, primary: boolean, answer: SyncSetupAnswer): void => {
      const onClick = (): void => this.#answer(answer);
      rows.push({
        height: hit.primary + 10,
        place: (y) => {
          const rect: Rect = { x: x + PAD, y, width: buttonWidth, height: hit.primary };
          this.#buttons.push(
            new McButton(this, { kind: primary ? "primary" : "secondary", label, type: buttonType, rect, onClick }),
          );
          stops.set(id, { rect, activate: onClick });
        },
      });
    };

    textRow(
      caseOf(typeRole.sectionHeader, SYNC_SETUP_TITLE),
      textStyle(typeRole.sectionHeader, surface.paper.hex),
      20,
      10,
    );
    textRow(SYNC_SETUP_BODY, textStyle(typeRole.body, surface.paper.hex, 0.9), 14, 10);
    textRow(SYNC_SETUP_LATER, textStyle(typeRole.body, surface.paper.hex, 0.85), 12, 16);
    buttonRow("set-up", SYNC_SETUP_BUTTONS.setUp, true, "set-up");
    buttonRow("join", SYNC_SETUP_BUTTONS.join, false, "join");
    buttonRow("not-now", SYNC_SETUP_BUTTONS.notNow, false, "not-now");

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

    this.#route?.set(["set-up", "join", "not-now"], stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.filter((o) => o !== zone && o !== scrim) });
  }
}

/** The note after "Not now": where sync lives later. Stops itself after `SYNC_NOTICE_HOLD_MS`. */
export class SyncSetupNotice extends Phaser.Scene {
  constructor() {
    super(SCENES.syncSetupNotice);
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone" || formFactorFor(width, height) === "phoneLandscape";
    const margin = phone ? 8 : 16;
    const boxWidth = phone ? width - 2 * margin : Math.min(480, width - 2 * margin);
    const textX = 22;
    const heading = this.add.text(
      0,
      0,
      SYNC_NOTICE_HEADING.toUpperCase(),
      textStyle(typeRole.label, surface.paper.hex),
    );
    const line = this.add
      .text(0, 0, SYNC_NOTICE_BODY, textStyle(typeRole.body, surface.paper.hex))
      .setFontSize(phone ? 13 : 14)
      .setWordWrapWidth(boxWidth - textX - 14)
      .setLineSpacing(2);
    fitText(heading, boxWidth - textX - 14, typeRole.label.size);
    const boxHeight = 14 + heading.height + 4 + line.height + 14;
    const rect: Rect = {
      x: Math.round((width - boxWidth) / 2),
      y: height - margin - boxHeight,
      width: boxWidth,
      height: boxHeight,
    };
    heading.setPosition(rect.x + textX, rect.y + 14);
    line.setPosition(rect.x + textX, rect.y + 14 + heading.height + 4);
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 0.97).fillRect(rect.x, rect.y, rect.width, rect.height);
    ground.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, 6, rect.height);
    ground.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const container = this.add.container(0, 0, [ground, heading, line]);

    const stop = (): void => {
      if (this.sys.isActive()) this.scene.stop();
    };
    if (appSession().settings.reducedMotion) {
      this.time.delayedCall(SYNC_NOTICE_HOLD_MS, stop);
      return;
    }
    const away = height - rect.y + 12;
    container.setPosition(0, away);
    this.tweens.add({
      targets: container,
      y: 0,
      duration: 260,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          y: away,
          delay: SYNC_NOTICE_HOLD_MS,
          duration: 260,
          ease: "Quad.easeIn",
          onComplete: stop,
        });
      },
    });
  }
}
