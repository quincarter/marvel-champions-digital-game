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
import { cardLanguage } from "../art/card-language.js";
import { artLanguageNow } from "../art/art-source.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { copyText, downloadText } from "../ui/report-export.js";
import { debugSnapshot } from "../ui/debug-dump.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { formFactorFor } from "../view/layout.js";
import { appVersionText, buildCommit } from "../view/app-version.js";
import { reportReplayLink, withinTime } from "../replay/report-replay.js";
import { knownSteamInstall } from "../platform/steam-install.js";
import {
  DECK_REQUEST_URL,
  DISCORD_INVITE_URL,
  FEATURE_REQUEST_URL,
  issueReportFileName,
  issueReportText,
  newIssueUrl,
  playLineOf,
  screenshotDeviceOf,
  screenshotTipOf,
  type ReportEnvironment,
  type ReportInput,
} from "../view/issue-report.js";
import { CLIENT_VERSION } from "../version.js";
import { detectPlatform, openExternal } from "../platform/platform.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { REPORT_ORDER, drawReportPanel, reportSteps, type ReportStopId } from "./report-issue-panel.js";
import { SCENES } from "./keys.js";
import { displayLineOf } from "../platform/screen-settings.js";
import { roomState } from "../platform/room.js";
import { ReplayTransportOverlay } from "./replay-transport.js";

/** How long "Hide for a screenshot" keeps the panel away. A tap anywhere brings it back sooner. */
const HIDE_MS = 5_000;

type Disabled = { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean };

/**
 * The input a closed panel has not yet given back (it waits for the held pad button to be let go). One slot for the
 * whole module: a panel opened meanwhile cancels the wait and takes the scenes over, so the old timer can never turn a
 * screen's input back on under the new panel.
 */
let pendingRestore: { readonly cancel: () => void; readonly entries: readonly Disabled[] } | null = null;

/** A Lit panel over the canvas (`dom/popup-sheet.ts`, an overlay region): the screen under it stays shown beneath its scrim. */
export class ReportIssueOverlay extends Phaser.Scene {
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;
  /** What each control does this draw, by key. */
  #actions = new Map<string, () => void>();
  #route: FocusRoute | null = null;
  /**
   * The input this panel turned off, to turn back on when it closes: each scene's pointer input, and its keyboard
   * separately, since a scene's keyboard still delivers keys while its pointer input is off (a Tab and Enter under
   * the panel once pressed the Decks screen's Back button).
   */
  #disabled: { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[] = [];
  #feedback = "";
  /** A Download log save is under way; another press waits for it. */
  #saving = false;
  /** The game shared as a replay (#693), asked for as the panel opens; the link once it has come back, else null. */
  #replayLink: Promise<string | null> = Promise.resolve(null);
  #replayLinkNow: string | null = null;
  #hideTimer: Phaser.Time.TimerEvent | null = null;
  /** Brings the panel back while it is hidden for a screenshot (a tap does it; so does any pad button or key). */
  #restore: (() => void) | null = null;

  constructor() {
    super(SCENES.reportIssue);
  }

  create(): void {
    this.#feedback = "";
    // Shared now, while the player reads the panel, so Copy, Download and Report a bug carry it without waiting.
    this.#replayLinkNow = null;
    this.#replayLink = reportReplayLink(appSession().store);
    void this.#replayLink.then((link) => {
      this.#replayLinkNow = link;
    });
    const inherited = pendingRestore?.entries ?? [];
    pendingRestore?.cancel();
    pendingRestore = null;
    this.#disabled = this.scene.manager
      .getScenes(true)
      .filter((scene) => scene !== this && scene.scene.key !== SCENES.reportButton && scene.input)
      .map((scene) => ({ scene, pointer: scene.input.enabled, keyboard: scene.input.keyboard?.enabled === true }))
      .filter(({ pointer, keyboard }) => pointer || keyboard);
    this.#disabled.push(...inherited);
    for (const { scene, pointer, keyboard } of this.#disabled) {
      if (pointer) scene.input.enabled = false;
      if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
    this.scene.get(SCENES.reportButton)?.sys.setVisible(false);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.(), undefined, {
      onDismiss: () => this.#close(),
    });
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#panel.leaving,
      // B, Start and A bring a hidden panel back first; otherwise B closes it and Start files the bug report.
      onCancel: () => (this.#restore ? this.#restore() : this.#close()),
      onPause: () => (this.#restore ? this.#restore() : this.#openIssue()),
      primary: () => (this.#restore ? "restore" : null),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#glyphs.dispose();
      this.#hideTimer?.remove();
      this.#hideTimer = null;
      // Given back only once no pad button is held. A scene's pad plugin does not poll while its input is off, so
      // the press that closed this panel (B) would look like a fresh press to the screen under it the moment its input
      // came back, and close that too (B on the Trophy Room under the panel left both).
      const disabled = this.#disabled;
      const restore = (): void => {
        for (const { scene, pointer, keyboard } of disabled) {
          if (!scene.sys.isActive()) continue;
          if (pointer) scene.input.enabled = true;
          if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
        }
      };
      const padHeld = (): boolean =>
        [...(globalThis.navigator?.getGamepads?.() ?? [])].some((pad) => pad?.buttons.some((b) => b.pressed));
      let waited = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const wait = (): void => {
        waited += 1;
        if (padHeld() && waited < 40) {
          timer = setTimeout(wait, 25);
          return;
        }
        timer = null;
        if (pendingRestore?.entries === disabled) pendingRestore = null;
        restore();
      };
      pendingRestore = {
        entries: disabled,
        cancel: () => {
          if (timer !== null) clearTimeout(timer);
        },
      };
      timer = setTimeout(wait, 0);
      this.#disabled = [];
      this.scene.get(SCENES.reportButton)?.sys.setVisible(true);
    });
    this.#draw();
  }

  #environment(): ReportEnvironment {
    const { width, height } = this.scale.gameSize;
    const platform = detectPlatform();
    return {
      version: appVersionText(CLIENT_VERSION, platform, buildCommit(), cardLanguage(), knownSteamInstall() !== null),
      platform,
      cardLanguage: artLanguageNow(),
      userAgent: navigator.userAgent,
      viewport: { width, height },
      formFactor: formFactorFor(width, height),
      ...displayLineOf(width, height),
      play: playLineOf(roomState(), this.#viewing()),
      screens: this.scene.manager
        .getScenes(true)
        .filter((scene) => scene !== this && scene.sys.settings.visible && scene.scene.key !== SCENES.reportButton)
        .map((scene) => scene.scene.key),
      at: new Date().toISOString(),
    };
  }

  /** The replay transport's live game or replay, when it is open under the panel. */
  #viewing(): "live" | "replay" | null {
    const transport = this.scene.get(SCENES.replayTransport);
    return transport instanceof ReplayTransportOverlay && transport.sys.isActive() ? transport.viewing : null;
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
              adjusted: state.adjusted,
            },
      snapshot: debugSnapshot(this.game),
      replayLink: this.#replayLinkNow,
    };
  }

  /** The report once its replay link is in, or after `REPORT_LINK_WAIT_MS` without it. */
  async #reportWithLink(): Promise<ReportInput> {
    this.#replayLinkNow = await withinTime(this.#replayLink);
    return this.#report();
  }

  #copy(): void {
    void this.#reportWithLink()
      .then((report) => copyText(issueReportText(report)))
      .then((copied) => {
        if (!this.sys.isActive()) return;
        this.#say(copied ? t("report.copied") : t("report.copyFailed"));
      });
  }

  #download(): void {
    const fileName = issueReportFileName(new Date());
    // One save at a time: Android's Save dialog takes a moment to cover the panel.
    if (this.#saving) return;
    this.#saving = true;
    void this.#reportWithLink()
      .then((report) => downloadText(issueReportText(report), fileName))
      .then(
        (saved) => {
          if (saved && this.sys.isActive()) this.#say(t("report.saved", { file: fileName }));
        },
        () => {
          if (this.sys.isActive()) this.#say(t("report.saveFailed"));
        },
      )
      .finally(() => {
        this.#saving = false;
      });
  }

  #openIssue(): void {
    // Opened at once (a popup must follow the press), with the replay link when it has already come back.
    openExternal(newIssueUrl(this.#environment(), this.#replayLinkNow));
  }

  /** Hides the panel (and the Report button) so a screenshot shows the screen underneath; back after `HIDE_MS` or a tap. */
  #hideForScreenshot(): void {
    if (this.#hideTimer) return;
    this.sys.setVisible(false);
    const back = (): void => {
      this.#hideTimer?.remove();
      this.#hideTimer = null;
      this.#restore = null;
      this.input.off("pointerup", back);
      if (!this.sys.isActive()) return;
      this.sys.setVisible(true);
      this.#draw();
    };
    this.#hideTimer = this.time.delayedCall(HIDE_MS, back);
    this.#restore = back;
    // The press that hid the panel is still going up: listen from the next frame on.
    this.time.delayedCall(0, () => this.input.once("pointerup", back));
    // No stop is on the route (no ring over the screenshot); A reaches this one through the primary.
    this.#route?.set([], new Map([["restore", { rect: { x: 0, y: 0, width: 1, height: 1 }, activate: back }]]));
  }

  #say(message: string): void {
    this.#feedback = message;
    this.#draw();
  }

  #close(): void {
    this.#panel.close();
  }

  #draw(): void {
    destroyChildren(this);
    this.#glyphs.reset();
    const { width, height } = this.scale.gameSize;
    // Under the panel Phaser still hits a press: this shield keeps it from reaching the screen under.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);
    const run = new Map<ReportStopId, () => void>([
      ["close", () => this.#close()],
      ["hide", () => this.#hideForScreenshot()],
      ["copy", () => this.#copy()],
      ["download", () => this.#download()],
      ["github", () => this.#openIssue()],
      ["feature", () => openExternal(FEATURE_REQUEST_URL)],
      ["deck", () => openExternal(DECK_REQUEST_URL)],
      ["discord", () => openExternal(DISCORD_INVITE_URL)],
    ]);
    const laid = drawReportPanel(b, this.#glyphs, {
      screen: { width, height },
      steps: reportSteps(screenshotTipOf(screenshotDeviceOf(navigator.userAgent))),
      feedback: this.#feedback,
    });
    this.#actions = new Map(run);
    const stops = new Map<string, FocusStop>();
    for (const [id, stop] of laid) stops.set(id, { rect: stop.rect, activate: run.get(id)! });
    this.#panel.mount(b, width, height);
    this.#route?.set(REPORT_ORDER, stops);
  }
}
