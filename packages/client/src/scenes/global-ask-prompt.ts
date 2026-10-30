/**
 * The one-time "Share your results?" question for the global win rates, launched over Title by
 * `maybeAskGlobalStats` (`scenes/global-ask-launch.ts`), which decides whether it is due.
 *
 * It says exactly what is sent and offers two buttons of equal weight: Share and No thanks. Neither is drawn as the
 * forward action and Start presses neither, so declining is as easy as accepting. Escape is No thanks. Either answer
 * is remembered at once through `global-stats/global-consent.ts` (Share by `turnOnGlobalStats` with the games already
 * finished, so they are never sent), and the question never comes again. Every press is an `McButton` (nothing fires
 * on the lift of a swipe) and nothing here scrolls.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { appSession } from "../session.js";
import { finishedIdsOf, turnOffGlobalStats, turnOnGlobalStats } from "../global-stats/global-consent.js";
import type { Rect } from "../view/layout.js";
import {
  GLOBAL_ASK_BODY,
  GLOBAL_ASK_BUTTONS,
  GLOBAL_ASK_TITLE,
  type GlobalAskAnswer,
} from "../view/global-stats-ui.js";
import { syncSetupButtonSpan } from "../view/sync-setup-prompt.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const buttonType = { ...typeRole.label, size: 13 };
const PANEL_MAX = 520;
const PAD = 20;

export class GlobalStatsPromptOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #answered = false;

  constructor() {
    super(SCENES.globalStatsPrompt);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#answered = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    // No `primary`: Start is not "Share". Escape and B are No thanks, the same as the sync question's Not now.
    this.#route = new FocusRoute(this, { onCancel: () => void this.#answer("decline") });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  async #answer(answer: GlobalAskAnswer): Promise<void> {
    if (this.#answered || this.#motion.leaving) return;
    this.#answered = true;
    if (answer === "decline") turnOffGlobalStats();
    else {
      try {
        // The games finished so far are marked sent first, so only games finished from now on are ever shared.
        turnOnGlobalStats(finishedIdsOf(await appSession().store.listSaves()));
      } catch {
        // Not saved: still off, and the question comes back on a later visit.
      }
    }
    if (this.sys.isActive()) this.#motion.exit(this, () => this.scene.stop());
  }

  #draw(): void {
    if (this.#motion.leaving) return;
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
    const buttons = syncSetupButtonSpan(x + PAD, inner);

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
    const buttonRow = (id: string, label: string, answer: GlobalAskAnswer): void => {
      const onClick = (): void => void this.#answer(answer);
      rows.push({
        height: hit.primary + 10,
        place: (y) => {
          const rect: Rect = { x: buttons.x, y, width: buttons.width, height: hit.primary };
          // Both secondary: the same size, the same look.
          this.#buttons.push(new McButton(this, { kind: "secondary", label, type: buttonType, rect, onClick }));
          stops.set(id, { rect, activate: onClick });
        },
      });
    };

    textRow(
      caseOf(typeRole.sectionHeader, GLOBAL_ASK_TITLE),
      textStyle(typeRole.sectionHeader, surface.paper.hex),
      20,
      10,
    );
    textRow(GLOBAL_ASK_BODY, textStyle(typeRole.body, surface.paper.hex, 0.9), 14, 14);
    buttonRow("share", GLOBAL_ASK_BUTTONS.share, "share");
    buttonRow("decline", GLOBAL_ASK_BUTTONS.decline, "decline");

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
    this.children.sendToBack(ground);
    this.children.sendToBack(scrim);
    this.children.sendToBack(zone);

    this.#route?.set(["share", "decline"], stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.filter((o) => o !== zone && o !== scrim) });
  }
}
