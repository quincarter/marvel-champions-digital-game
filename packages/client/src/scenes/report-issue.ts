/**
 * "Report an issue" (#176): opened by the Report button in the top bar (`scenes/report-button.ts`), over
 * whatever screen or overlay is up, in a game or not.
 *
 * Three steps, in the order a report needs them: snap a screenshot (this device's shortcut, and a button that hides
 * the panel for a few seconds so the picture shows the problem rather than this panel), save the log (copy it, or
 * download it as a file), then open a prefilled new-issue page on GitHub to paste or attach both. What the log holds
 * is `view/issue-report.ts`.
 *
 * While it is up, every other scene's input is off (and back on when it closes, for the scenes it turned off), the
 * same rule the confirm overlays follow for the scene that opened them.
 */
import Phaser from "phaser";
import { hit, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { copyText, downloadText } from "../ui/report-export.js";
import { debugSnapshot } from "../ui/debug-dump.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { appVersionText, buildCommit } from "../view/app-version.js";
import {
  DECK_REQUEST_URL,
  FEATURE_REQUEST_URL,
  issueReportFileName,
  issueReportText,
  newIssueUrl,
  screenshotDeviceOf,
  screenshotTipOf,
  type ReportEnvironment,
  type ReportInput,
} from "../view/issue-report.js";
import { CLIENT_VERSION } from "../version.js";
import { detectPlatform, openExternal } from "../platform/platform.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { displayLineOf } from "../platform/screen-settings.js";

const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };
/** How long "Hide for a screenshot" keeps the panel away. A tap anywhere brings it back sooner. */
const HIDE_MS = 5_000;

type StopId = "close" | "hide" | "copy" | "download" | "github" | "feature" | "deck";

export class ReportIssueOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  /**
   * The input this panel turned off, to turn back on when it closes: each scene's pointer input, and its keyboard
   * separately, since a scene's keyboard still delivers keys while its pointer input is off (a Tab and Enter under
   * the panel once pressed the Decks screen's Back button).
   */
  #disabled: { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[] = [];
  #feedback = "";
  #hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SCENES.reportIssue);
  }

  create(): void {
    this.#feedback = "";
    this.#disabled = this.scene.manager
      .getScenes(true)
      .filter((scene) => scene !== this && scene.scene.key !== SCENES.reportButton && scene.input)
      .map((scene) => ({ scene, pointer: scene.input.enabled, keyboard: scene.input.keyboard?.enabled === true }))
      .filter(({ pointer, keyboard }) => pointer || keyboard);
    for (const { scene, pointer, keyboard } of this.#disabled) {
      if (pointer) scene.input.enabled = false;
      if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
    this.scene.get(SCENES.reportButton)?.sys.setVisible(false);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.scene.stop() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#hideTimer?.remove();
      this.#hideTimer = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      for (const { scene, pointer, keyboard } of this.#disabled) {
        if (!scene.sys.isActive()) continue;
        if (pointer) scene.input.enabled = true;
        if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
      this.#disabled = [];
      this.scene.get(SCENES.reportButton)?.sys.setVisible(true);
    });
    this.#draw();
  }

  #environment(): ReportEnvironment {
    const { width, height } = this.scale.gameSize;
    const platform = detectPlatform();
    return {
      version: appVersionText(CLIENT_VERSION, platform, buildCommit()),
      platform,
      userAgent: navigator.userAgent,
      viewport: { width, height },
      formFactor: formFactorFor(width, height),
      ...displayLineOf(width, height),
      screens: this.scene.manager
        .getScenes(true)
        .filter((scene) => scene !== this && scene.sys.settings.visible && scene.scene.key !== SCENES.reportButton)
        .map((scene) => scene.scene.key),
      at: new Date().toISOString(),
    };
  }

  #report(): ReportInput {
    const session = appSession();
    const state = session.store.state;
    const game = state.game;
    return {
      environment: this.#environment(),
      game:
        game === null
          ? null
          : {
              seed: state.config?.seed ?? null,
              round: game.round ?? null,
              step: game.step ?? null,
              lines: session.gameLog.lines,
              config: state.config,
              commands: state.commandTrail.map((entry) => ({ playerId: entry.playerId, command: entry.command })),
            },
      snapshot: debugSnapshot(this.game),
    };
  }

  #copy(): void {
    void copyText(issueReportText(this.#report())).then((copied) => {
      if (!this.sys.isActive()) return;
      this.#say(copied ? "Log copied. Paste it into the issue." : "This device would not copy. Use Download log.");
    });
  }

  #download(): void {
    const fileName = issueReportFileName(new Date());
    try {
      downloadText(issueReportText(this.#report()), fileName);
      this.#say(`Saved ${fileName}. Attach it to the issue.`);
    } catch {
      this.#say("This device would not save the file. Use Copy log.");
    }
  }

  #openIssue(): void {
    openExternal(newIssueUrl(this.#environment()));
  }

  /** Hides the panel (and the Report button) so a screenshot shows the screen underneath; back after `HIDE_MS` or a tap. */
  #hideForScreenshot(): void {
    if (this.#hideTimer) return;
    this.sys.setVisible(false);
    const back = (): void => {
      this.#hideTimer?.remove();
      this.#hideTimer = null;
      this.input.off("pointerup", back);
      if (!this.sys.isActive()) return;
      this.sys.setVisible(true);
      this.#draw();
    };
    this.#hideTimer = this.time.delayedCall(HIDE_MS, back);
    // The press that hid the panel is still going up: listen from the next frame on.
    this.time.delayedCall(0, () => this.input.once("pointerup", back));
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#route?.set([], new Map());
  }

  #say(message: string): void {
    this.#feedback = message;
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.72).fillRect(0, 0, width, height);

    // Two columns when the screen is wide but short (a phone on its side): one column would run off the bottom.
    const columns = width >= 700 && height < 600 ? 2 : 1;
    const pad = phone ? 16 : 24;
    const boxWidth = Math.min(columns === 2 ? 860 : 560, width - (phone ? 16 : 48));
    const columnGap = 24;
    const columnWidth = (boxWidth - pad * 2 - (columns - 1) * columnGap) / columns;
    const bodySize = phone ? 14 : 15;
    const buttonHeight = hit.target;

    const ground = this.add.graphics();
    const placed: { readonly id: StopId; readonly rect: Rect; readonly activate: () => void }[] = [];
    type Button = {
      readonly id: StopId;
      readonly label: string;
      readonly kind: "primary" | "secondary";
      readonly run: () => void;
    };
    const buttons: { readonly button: Button; readonly rect: Rect }[] = [];

    const text = (value: string, spec: TypeSpec, alpha = 1, size?: number): Phaser.GameObjects.Text => {
      const object = this.add.text(0, 0, value, textStyle(spec, surface.ink.hex, alpha)).setWordWrapWidth(columnWidth);
      if (size !== undefined) object.setFontSize(size).setLineSpacing(3);
      return object;
    };

    /** Lays one column's steps top-down from `top`, at `x`; returns where it ended. */
    const layColumn = (
      x: number,
      top: number,
      steps: readonly { title: string; body: string; rows: readonly (readonly Button[])[] }[],
    ): number => {
      let y = top;
      steps.forEach((step, index) => {
        if (index > 0) y += 18;
        const heading = text(caseOf(typeRole.label, step.title), typeRole.label, 1, phone ? 11 : 12);
        heading.setPosition(x, y);
        y += heading.height + 6;
        const body = text(step.body, typeRole.body, 0.9, bodySize);
        body.setPosition(x, y);
        y += body.height + 10;
        const gap = 10;
        step.rows.forEach((row, rowIndex) => {
          if (rowIndex > 0) y += gap;
          const each = (columnWidth - gap * (row.length - 1)) / row.length;
          row.forEach((button, at) => {
            buttons.push({ button, rect: { x: x + at * (each + gap), y, width: each, height: buttonHeight } });
          });
          y += buttonHeight;
        });
      });
      return y;
    };

    const tip = screenshotTipOf(screenshotDeviceOf(navigator.userAgent));
    const steps = [
      {
        title: "1 · Snap a screenshot",
        body: `${tip} Hide this panel first so the picture shows the problem.`,
        rows: [
          [{ id: "hide", label: "Hide for a screenshot", kind: "secondary", run: () => this.#hideForScreenshot() }],
        ],
      },
      {
        title: "2 · Save the log",
        body: "The log has this game's moves and your device details, so we can replay what you saw.",
        rows: [
          [
            { id: "copy", label: "Copy log", kind: "secondary", run: () => this.#copy() },
            { id: "download", label: "Download log", kind: "secondary", run: () => this.#download() },
          ],
        ],
      },
      {
        title: "3 · Tell us about it",
        body: "Report a bug opens GitHub's bug form with your device details filled in: add your screenshot and the log there.",
        rows: [
          [{ id: "github", label: "Report a bug ↗", kind: "primary", run: () => this.#openIssue() }],
          [
            {
              id: "feature",
              label: "Suggest a feature ↗",
              kind: "secondary",
              run: () => openExternal(FEATURE_REQUEST_URL),
            },
            { id: "deck", label: "Request a deck ↗", kind: "secondary", run: () => openExternal(DECK_REQUEST_URL) },
          ],
        ],
      },
    ] satisfies { title: string; body: string; rows: Button[][] }[];

    // Measured in place at a provisional origin, then the whole box is centred and everything moved with it.
    const title = this.add.text(0, 0, "Report an issue", textStyle(typeRole.barTitle, surface.ink.hex));
    const closeSize = hit.target;
    title.setPosition(pad, pad + (closeSize - title.height) / 2);
    const top = pad + closeSize + 8;
    const left = pad;
    const ends =
      columns === 2
        ? [layColumn(left, top, steps.slice(0, 2)), layColumn(left + columnWidth + columnGap, top, steps.slice(2))]
        : [layColumn(left, top, steps)];
    let bottom = Math.max(...ends);
    if (this.#feedback !== "") {
      const feedback = this.add
        .text(left, bottom + 12, this.#feedback, textStyle(typeRole.emphasis, surface.ink.hex))
        .setFontSize(bodySize)
        .setWordWrapWidth(boxWidth - pad * 2);
      bottom = feedback.y + feedback.height;
    }
    const boxHeight = bottom + pad;
    const box: Rect = {
      x: Math.round((width - boxWidth) / 2),
      y: Math.round(Math.max(8, (height - boxHeight) / 2)),
      width: boxWidth,
      height: boxHeight,
    };
    for (const object of this.children.list) {
      if (object instanceof Phaser.GameObjects.Text) object.setPosition(object.x + box.x, object.y + box.y);
    }
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    ground
      .lineStyle(2, surface.ink.hex, ink.meta)
      .lineBetween(box.x + pad, box.y + top - 4, box.x + box.width - pad, box.y + top - 4);

    const close: Rect = {
      x: box.x + box.width - pad - closeSize + 8,
      y: box.y + pad - 8,
      width: closeSize,
      height: closeSize,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "✕",
        type: BUTTON_TYPE,
        rect: close,
        onClick: () => this.scene.stop(),
      }),
    );
    placed.push({ id: "close", rect: close, activate: () => this.scene.stop() });
    for (const { button, rect } of buttons) {
      const moved = { ...rect, x: rect.x + box.x, y: rect.y + box.y };
      this.#buttons.push(
        new McButton(this, {
          kind: button.kind,
          label: button.label,
          type: BUTTON_TYPE,
          rect: moved,
          onClick: button.run,
        }),
      );
      placed.push({ id: button.id, rect: moved, activate: button.run });
    }
    const order: StopId[] = ["hide", "copy", "download", "github", "feature", "deck", "close"];
    const stops = new Map<string, FocusStop>(
      placed.map((stop) => [stop.id, { rect: stop.rect, activate: stop.activate }]),
    );
    this.#route?.set(order, stops);
  }
}
