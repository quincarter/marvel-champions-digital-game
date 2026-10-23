/**
 * Save data ▸ Sync across devices (issue #276, step 2): turn device sync on (a recovery code shown once), join a synced
 * space with a typed code or a scanned link, link another device with a QR code, sync now, show the recovery code, and
 * the two ways out (unlink this device; delete the cloud data for all). Launched over Save data
 * (`scenes/save-data.ts`), in the same ink-and-paper panel; ✕ or Escape stops only this overlay.
 *
 * The work is `sync/sync-service.ts`; the wording and the decisions are `view/sync-model.ts`. This scene draws them.
 * Rules it keeps: every press is a `McButton` (nothing fires on the lift of a swipe), nothing sits over a scrolling
 * region (the screen has none: each step fits the panel), and the typed field is kept through a redraw (a phone's
 * keyboard shrinks the viewport, which redraws the scene, and a new `<input>` would close the keyboard at once).
 */
import Phaser from "phaser";
import { hit, signal, statHue, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { drawQr } from "../ui/qr-draw.js";
import { OverlayMotion } from "../ui/transitions.js";
import { overlayPanelLayout } from "../view/overlay-layout.js";
import type { Rect } from "../view/layout.js";
import { countdownOf } from "../view/save-transfer-model.js";
import {
  COPIED_STATUS,
  COPY_FAILED_STATUS,
  DELETE_BODY,
  DELETE_TITLE,
  DELETED_STATUS,
  JOIN_HELP,
  JOIN_LINK_BODY,
  JOIN_LINK_TITLE,
  JOINED_STATUS,
  LINK_HELP,
  LINK_TYPE_HELP,
  NO_STATUS,
  RECOVERY_PLACEHOLDER,
  SETUP_HELP,
  SHOW_CODE_HELP,
  SYNC_OFF_INTRO,
  SYNC_ON_INTRO,
  SYNC_ROW_TITLE,
  UNLINKED_STATUS,
  recoveryCodeText,
  syncFailureStatusOf,
  syncLinkUrlOf,
  syncStatusDisplay,
  JOIN_LINK_SWITCH_BODY,
  UNLINK_BODY,
  UNLINK_TITLE,
  syncStepWorking,
  type SyncStep,
} from "../view/sync-model.js";
import type { SaveDataStatus } from "../view/save-data-model.js";
import type { SyncLinkAddress } from "../sync/sync-link.js";
import { syncService } from "../sync/sync-wiring.js";
import { drawBetaTagBeside } from "../ui/beta-tag.js";
import { isNativeShell, openExternal } from "../platform/platform.js";
import { SYNC_INFO_LABEL, syncInfoUrl } from "../view/sync-info-link.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const HEADER_HEIGHT = 60;
const buttonType = { ...typeRole.label, size: 13 };
const codeFieldType = { ...typeRole.mono, size: 18 };
const WIDE_ROW = 520;
const WIDE_QR = 220;
const GAP = 10;

export interface SyncDataSceneData {
  /** Opened from a scanned #link= address: ask whether to join with it (the player confirms; nothing joins by itself). */
  readonly link?: SyncLinkAddress;
  /**
   * Opened from the one-time setup prompt (`scenes/sync-setup-prompt.ts`): "setup" turns sync on at once and shows the
   * recovery code to acknowledge; "join" opens the join field. Back from either lands on the usual first screen.
   */
  readonly start?: "setup" | "join";
}

interface ButtonSpec {
  readonly id: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly enabled?: boolean;
  /** The attack red the board uses for damage: destructive, and the label says so too. */
  readonly destructive?: boolean;
}

export class SyncDataOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #field: McTextInput | null = null;
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #step: SyncStep = { kind: "home" };
  #status: SaveDataStatus = NO_STATUS;
  #ticker: Phaser.Time.TimerEvent | null = null;
  #countdown: Phaser.GameObjects.Text | null = null;
  #statusLine: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENES.syncData);
  }

  create(data: SyncDataSceneData = {}): void {
    this.sys.settings.data = {};
    this.#motion = new OverlayMotion();
    this.#step = data.link
      ? { kind: "join-link", link: data.link, phase: "asking" }
      : data.start === "join"
        ? { kind: "join", phase: "typing", input: "" }
        : data.start === "setup" && !syncService().isOn()
          ? { kind: "setup", phase: "creating" }
          : { kind: "home" };
    this.#status = NO_STATUS;
    const service = syncService();
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.#field?.focused ?? false,
      onCancel: () => this.#cancel(),
    });
    let subscribed = false;
    const stopStatus = service.status.subscribe(() => {
      if (!subscribed || !this.sys.isActive()) return;
      // The status line changes on its own; only the home screen shows it, and a redraw keeps its buttons right.
      if (this.#step.kind === "home") this.#draw();
    });
    const stopLink = service.onLinkChange(() => {
      if (this.sys.isActive() && this.#step.kind === "home") this.#draw();
    });
    subscribed = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      stopStatus();
      stopLink();
      this.#clearControls();
    });
    this.#draw();
    if (this.#step.kind === "setup") void this.#createSpace();
  }

  // ---- navigation ------------------------------------------------------------------------------------------------

  /**
   * ✕: closes from any step that isn't waiting on the network. On the new recovery code that counts as the
   * acknowledge: the code stays on this device, and Show recovery code brings it back (locking ✕ there read as a dialog
   * that could not be closed).
   */
  #close(): void {
    if (this.#working) return;
    this.#motion.exit(this, () => this.scene.stop());
  }

  /** Escape: backs out one step, then closes; ignored while something is in flight. */
  #cancel(): void {
    if (syncStepWorking(this.#step)) return;
    if (this.#step.kind === "home") this.#close();
    else this.#set({ kind: "home" }, NO_STATUS);
  }

  #set(step: SyncStep, status: SaveDataStatus): void {
    this.#step = step;
    this.#status = status;
    this.#draw();
  }

  get #working(): boolean {
    return syncStepWorking(this.#step);
  }

  // ---- actions ---------------------------------------------------------------------------------------------------

  async #setUp(): Promise<void> {
    if (this.#step.kind !== "home" || syncService().isOn()) return;
    this.#set({ kind: "setup", phase: "creating" }, NO_STATUS);
    await this.#createSpace();
  }

  /** The setup step's work, from "creating": makes the space, then shows the code (or says why not, back home). */
  async #createSpace(): Promise<void> {
    const result = await syncService().setUp();
    if (!this.sys.isActive()) return;
    if (result.ok) this.#set({ kind: "setup", phase: { code: result.recoveryCode } }, NO_STATUS);
    else this.#set({ kind: "home" }, syncFailureStatusOf(result.failure));
  }

  async #join(): Promise<void> {
    const step = this.#step;
    if (step.kind !== "join" || step.phase !== "typing") return;
    this.#set({ kind: "join", phase: "working", input: step.input }, NO_STATUS);
    const result = await syncService().joinWithInput(step.input);
    if (!this.sys.isActive()) return;
    if (result.ok) this.#set({ kind: "home" }, JOINED_STATUS);
    else this.#set({ kind: "join", phase: "typing", input: step.input }, syncFailureStatusOf(result.failure));
  }

  async #joinFromLink(): Promise<void> {
    const step = this.#step;
    if (step.kind !== "join-link" || step.phase !== "asking") return;
    this.#set({ kind: "join-link", link: step.link, phase: "working" }, NO_STATUS);
    const result = await syncService().joinFromLink(step.link);
    if (!this.sys.isActive()) return;
    this.#set({ kind: "home" }, result.ok ? JOINED_STATUS : syncFailureStatusOf(result.failure));
  }

  async #link(): Promise<void> {
    const from = this.#step;
    const expired = from.kind === "link" && typeof from.phase === "object" && Date.now() >= from.phase.expiresAt;
    if (!(from.kind === "home" || expired)) return;
    this.#set({ kind: "link", phase: "uploading" }, NO_STATUS);
    const result = await syncService().linkDevice();
    if (!this.sys.isActive()) return;
    if (result.ok) {
      this.#set(
        { kind: "link", phase: { link: result.link, expiresAt: result.expiresAt, typed: result.typedText } },
        NO_STATUS,
      );
    } else this.#set({ kind: "home" }, syncFailureStatusOf(result.failure));
  }

  async #syncNow(): Promise<void> {
    if (this.#step.kind !== "home" || syncService().status.get().state === "syncing") return;
    await syncService().syncNow();
  }

  async #unlink(): Promise<void> {
    if (this.#step.kind !== "unlink") return;
    await syncService().unlink();
    if (this.sys.isActive()) this.#set({ kind: "home" }, UNLINKED_STATUS);
  }

  async #delete(): Promise<void> {
    const step = this.#step;
    if (step.kind !== "delete" || step.phase !== "asking") return;
    this.#set({ kind: "delete", phase: "working" }, NO_STATUS);
    const result = await syncService().deleteCloudData();
    if (!this.sys.isActive()) return;
    this.#set({ kind: "home" }, result.ok ? DELETED_STATUS : syncFailureStatusOf(result.failure));
  }

  #copy(text: string): void {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    const done = (status: SaveDataStatus): void => {
      if (this.sys.isActive()) this.#set(this.#step, status);
    };
    if (!clipboard?.writeText) {
      done(COPY_FAILED_STATUS);
      return;
    }
    clipboard.writeText(text).then(
      () => done(COPIED_STATUS),
      () => done(COPY_FAILED_STATUS),
    );
  }

  #tick(): void {
    const step = this.#step;
    if (step.kind === "link" && typeof step.phase === "object") {
      const left = countdownOf(step.phase.expiresAt, Date.now());
      if (left.expired) {
        this.#status = NO_STATUS;
        this.#draw();
      } else this.#countdown?.setText(left.text);
    } else if (step.kind === "home") {
      this.#statusLine?.setText(this.#statusText());
    }
  }

  #statusText(): string {
    return `Status: ${syncStatusDisplay(syncService().isOn(), syncService().status.get(), Date.now())}`;
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------

  #clearControls(keepField = false): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    if (!keepField) {
      this.#field?.destroy();
      this.#field = null;
    }
    this.#ticker?.remove(false);
    this.#ticker = null;
    this.#countdown = null;
    this.#statusLine = null;
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    // The join field survives a redraw (see the file comment).
    const step = this.#step;
    const keepField = step.kind === "join" && step.phase === "typing";
    this.#clearControls(keepField);
    const kept = (keepField && this.#field?.gameObjects) || [];
    for (const object of kept) this.children.remove(object);
    destroyChildren(this);
    for (const object of kept) this.children.add(object);

    const { width, height } = this.scale.gameSize;
    const { panel, header, body } = overlayPanelLayout({ x: 0, y: 0, width, height }, HEADER_HEIGHT, 0);
    // Swallows taps that land on no control, so none reach Save data underneath.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    ground.lineStyle(4, surface.paper.hex, 1).strokeRect(panel.x, panel.y, panel.width, panel.height);
    ground.fillStyle(surface.paper.hex, 0.4).fillRect(header.x, header.y + header.height - 2, header.width, 2);

    const stops = new Map<string, FocusStop>();
    const order: string[] = ["back"];
    const closeSize = 32;
    const closeRect: Rect = {
      x: header.x + header.width - closeSize - 16,
      y: header.y + (header.height - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        enabled: !this.#working,
        onClick: () => this.#close(),
      }),
    );
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    const barTitle = this.add
      .text(header.x + 16, header.y + header.height / 2, caseOf(typeRole.barTitle, SYNC_ROW_TITLE), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "24px",
      })
      .setOrigin(0, 0.5);
    drawBetaTagBeside(this, barTitle, closeRect.x - 8);

    const x = body.x + 16;
    const rowWidth = body.width - 32;
    const bodyBottom = body.y + body.height;
    // "More information" opens the player guide; on the steps with room, a small button above the content.
    const hasInfo = step.kind === "home" || step.kind === "join" || step.kind === "setup" || step.kind === "show-code";
    if (hasInfo) {
      const infoRect: Rect = { x, y: body.y + 12, width: Math.min(rowWidth, 170), height: 32 };
      const open = (): void => openExternal(syncInfoUrl(globalThis.location?.href ?? "", isNativeShell()));
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: SYNC_INFO_LABEL,
          type: { ...typeRole.label, size: 11 },
          rect: infoRect,
          onClick: open,
        }),
      );
      stops.set("more-info", { rect: infoRect, activate: open });
      order.push("more-info");
    }
    const top = body.y + 16 + (hasInfo ? 44 : 0);
    let y = top;
    switch (step.kind) {
      case "home":
        y = syncService().isOn()
          ? this.#drawOn(x, top, rowWidth, stops, order)
          : this.#drawOff(x, top, rowWidth, stops, order);
        break;
      case "setup":
        y = this.#drawCode(
          "Your recovery code",
          SETUP_HELP,
          step.phase === "creating" ? null : step.phase.code,
          [
            { id: "copy", label: "Copy code", onClick: () => this.#copy(recoveryText(step)) },
            {
              id: "ack",
              label: "I've saved my code",
              onClick: () => this.#set({ kind: "home" }, NO_STATUS),
            },
          ],
          x,
          top,
          rowWidth,
          stops,
          order,
        );
        break;
      case "show-code":
        y = this.#drawCode(
          "Your recovery code",
          SHOW_CODE_HELP,
          step.code,
          [
            { id: "copy", label: "Copy code", onClick: () => this.#copy(recoveryCodeText(step.code)) },
            { id: "back-menu", label: "Back", onClick: () => this.#set({ kind: "home" }, NO_STATUS) },
          ],
          x,
          top,
          rowWidth,
          stops,
          order,
        );
        break;
      case "join":
        y = this.#drawJoin(step, x, top, rowWidth, stops, order);
        break;
      case "link":
        y = this.#drawLink(step, x, top, rowWidth, bodyBottom, stops, order);
        break;
      case "join-link":
        y = this.#drawConfirm(
          JOIN_LINK_TITLE,
          syncService().isOn() ? JOIN_LINK_SWITCH_BODY : JOIN_LINK_BODY,
          step.phase === "working",
          [
            { id: "cancel", label: "Cancel", onClick: () => this.#set({ kind: "home" }, NO_STATUS) },
            { id: "join-link", label: "Join", onClick: () => void this.#joinFromLink() },
          ],
          x,
          top,
          rowWidth,
          stops,
          order,
        );
        break;
      case "unlink":
        y = this.#drawConfirm(
          UNLINK_TITLE,
          UNLINK_BODY,
          false,
          [
            {
              id: "show-first",
              label: "Show recovery code first",
              onClick: () => {
                const code = syncService().recoveryCode();
                if (code) this.#set({ kind: "show-code", code }, NO_STATUS);
              },
            },
            { id: "cancel", label: "Cancel", onClick: () => this.#set({ kind: "home" }, NO_STATUS) },
            { id: "confirm-unlink", label: "Unlink", onClick: () => void this.#unlink() },
          ],
          x,
          top,
          rowWidth,
          stops,
          order,
        );
        break;
      case "delete":
        y = this.#drawConfirm(
          DELETE_TITLE,
          DELETE_BODY,
          step.phase === "working",
          [
            { id: "cancel", label: "Cancel", onClick: () => this.#set({ kind: "home" }, NO_STATUS) },
            { id: "confirm-delete", label: "Delete", destructive: true, onClick: () => void this.#delete() },
          ],
          x,
          top,
          rowWidth,
          stops,
          order,
        );
        break;
    }

    if (this.#status.tone !== "none" || this.#working) {
      const text = this.#working ? "Working…" : this.#status.text;
      const error = this.#status.tone === "error" && !this.#working;
      this.add
        .text(
          x,
          y + 16,
          error ? `Problem: ${text}` : text,
          textStyle(typeRole.body, error ? signal.caution.hex : surface.paper.hex, 0.95),
        )
        .setFontSize(12)
        .setWordWrapWidth(rowWidth);
    }

    this.#route?.set(order, stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** Buttons in one column, or two by two on a wide panel; returns the y below them. */
  #drawButtons(
    specs: readonly ButtonSpec[],
    x: number,
    top: number,
    width: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const per = width >= WIDE_ROW ? 2 : 1;
    const cell = per === 2 ? (width - 12) / 2 : Math.min(width, 360);
    let y = top;
    for (let i = 0; i < specs.length; i += per) {
      for (const [at, spec] of specs.slice(i, i + per).entries()) {
        const rect: Rect = { x: x + at * (cell + 12), y, width: cell, height: hit.primary };
        const enabled = spec.enabled !== false && !this.#working;
        this.#buttons.push(
          new McButton(this, {
            kind: "secondary",
            label: spec.label,
            type: buttonType,
            rect,
            enabled,
            ...(spec.destructive ? { tint: { fill: statHue.atk.hex, ink: surface.paper.hex } } : {}),
            onClick: spec.onClick,
          }),
        );
        stops.set(spec.id, { rect, activate: spec.onClick });
        order.push(spec.id);
      }
      y += hit.primary + GAP;
    }
    return y - GAP;
  }

  #heading(text: string, x: number, y: number, width: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, caseOf(typeRole.sectionHeader, text), textStyle(typeRole.sectionHeader, surface.paper.hex))
      .setWordWrapWidth(width);
  }

  #paragraph(text: string, x: number, y: number, width: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, textStyle(typeRole.body, surface.paper.hex, 0.85))
      .setFontSize(12)
      .setWordWrapWidth(width)
      .setLineSpacing(3);
  }

  #drawOff(x: number, top: number, width: number, stops: Map<string, FocusStop>, order: string[]): number {
    const title = this.#heading("Sync is off", x, top, width);
    this.#statusLine = this.add
      .text(x, title.y + title.height + 6, this.#statusText(), textStyle(typeRole.body, surface.paper.hex))
      .setFontSize(14);
    const intro = this.#paragraph(SYNC_OFF_INTRO, x, this.#statusLine.y + this.#statusLine.height + 10, width);
    this.#startTicker();
    return this.#drawButtons(
      [
        { id: "sync:setup", label: "Set up sync", onClick: () => void this.#setUp() },
        {
          id: "sync:join",
          label: "Join with a recovery code",
          onClick: () => this.#set({ kind: "join", phase: "typing", input: "" }, NO_STATUS),
        },
      ],
      x,
      intro.y + intro.height + 16,
      width,
      stops,
      order,
    );
  }

  #drawOn(x: number, top: number, width: number, stops: Map<string, FocusStop>, order: string[]): number {
    const title = this.#heading("Sync is on", x, top, width);
    this.#statusLine = this.add
      .text(x, title.y + title.height + 6, this.#statusText(), textStyle(typeRole.body, surface.paper.hex))
      .setFontSize(14);
    const intro = this.#paragraph(SYNC_ON_INTRO, x, this.#statusLine.y + this.#statusLine.height + 10, width);
    this.#startTicker();
    const code = syncService().recoveryCode();
    return this.#drawButtons(
      [
        {
          id: "sync:now",
          label: "Sync now",
          enabled: syncService().status.get().state !== "syncing",
          onClick: () => void this.#syncNow(),
        },
        { id: "sync:link", label: "Link another device", onClick: () => void this.#link() },
        {
          id: "sync:show-code",
          label: "Show recovery code",
          onClick: () => (code ? this.#set({ kind: "show-code", code }, NO_STATUS) : undefined),
        },
        {
          id: "sync:unlink",
          label: "Unlink this device",
          onClick: () => this.#set({ kind: "unlink" }, NO_STATUS),
        },
        {
          id: "sync:delete",
          label: "Delete cloud data",
          destructive: true,
          onClick: () => this.#set({ kind: "delete", phase: "asking" }, NO_STATUS),
        },
      ],
      x,
      intro.y + intro.height + 16,
      width,
      stops,
      order,
    );
  }

  #startTicker(): void {
    this.#ticker = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.#tick() });
  }

  /** The recovery code big in the mono face, grouped in fives, with help and its buttons. */
  #drawCode(
    title: string,
    help: string,
    code: string | null,
    buttons: readonly ButtonSpec[],
    x: number,
    top: number,
    width: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const heading = this.#heading(code === null ? "Setting up sync" : title, x, top, width);
    if (code === null) return heading.y + heading.height;
    const text = this.#paragraph(help, x, heading.y + heading.height + 8, width);
    // 29 mono characters ("ABCDE-FGHJK-MNPQR-STUVW-XYZ23") at about 0.62 em each.
    const size = Math.max(14, Math.min(30, Math.floor(width / (29 * 0.62))));
    const shown = this.add
      .text(x, text.y + text.height + 14, recoveryCodeText(code), textStyle(typeRole.mono, surface.paper.hex))
      .setFontSize(size);
    return this.#drawButtons(buttons, x, shown.y + shown.height + 16, width, stops, order);
  }

  #drawJoin(
    step: Extract<SyncStep, { kind: "join" }>,
    x: number,
    top: number,
    width: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const title = this.#heading("Join with a recovery code", x, top, width);
    if (step.phase === "working") return title.y + title.height;
    const help = this.#paragraph(JOIN_HELP, x, title.y + title.height + 8, width);
    const fieldRect: Rect = { x, y: help.y + help.height + 14, width: Math.min(width, 440), height: hit.primary };
    const field = this.#field ?? this.#newField(fieldRect, step.input);
    field.layout(fieldRect);
    stops.set("code", { rect: fieldRect, activate: () => field.focus() });
    order.push("code");
    return this.#drawButtons(
      [
        { id: "join-go", label: "Join", onClick: () => void this.#join() },
        { id: "back-menu", label: "Back", onClick: () => this.#set({ kind: "home" }, NO_STATUS) },
      ],
      x,
      fieldRect.y + fieldRect.height + 14,
      Math.min(width, 440),
      stops,
      order,
    );
  }

  #newField(rect: Rect, input: string): McTextInput {
    const field = new McTextInput(this, {
      rect,
      value: input,
      type: codeFieldType,
      placeholder: RECOVERY_PLACEHOLDER,
      maxLength: 40,
      onChange: (value) => {
        // Kept in the step so the field can be rebuilt with what was typed; no redraw per key.
        this.#step = { kind: "join", phase: "typing", input: value };
      },
    });
    this.#field = field;
    (field.gameObject as unknown as { node: HTMLElement }).node.addEventListener("keydown", (event) => {
      if (event.key === "Enter") void this.#join();
    });
    if (!this.sys.game.device.input.touch && input === "") field.focus();
    return field;
  }

  #drawLink(
    step: Extract<SyncStep, { kind: "link" }>,
    x: number,
    top: number,
    width: number,
    bodyBottom: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const wide = width >= WIDE_ROW;
    const column = wide ? width - WIDE_QR - 24 : width;
    const title = this.#heading("Link another device", x, top, column);
    const phase = step.phase;
    if (phase === "uploading") return title.y + title.height;

    const short = bodyBottom - top < 360;
    const help = this.#paragraph(
      short ? "Scan this QR code with the other device's camera." : LINK_HELP,
      x,
      title.y + title.height + 8,
      column,
    );
    let y = help.y + help.height + 10;
    const orType = this.#paragraph(LINK_TYPE_HELP, x, y, column);
    y = orType.y + orType.height + 6;
    // The typed link code, big, for a device with no camera.
    const typed = this.add
      .text(x, y, phase.typed, textStyle(typeRole.mono, surface.paper.hex))
      .setFontSize(Math.max(16, Math.min(28, Math.floor(column / (19 * 0.62)))));
    y = typed.y + typed.height + 12;

    const url = syncLinkUrlOf(phase.link, location);
    let qrBottom = 0;
    if (wide) {
      const size = Math.max(112, Math.min(WIDE_QR, bodyBottom - 16 - top));
      drawQr(this, url, x + width - WIDE_QR + (WIDE_QR - size) / 2, top, size);
      qrBottom = top + size;
    } else {
      const size = Math.max(112, Math.min(width, 240, bodyBottom - 16 - y - 200));
      drawQr(this, url, x + (width - size) / 2, y, size);
      y += size + 12;
    }
    const left = countdownOf(phase.expiresAt, Date.now());
    this.#countdown = this.add.text(x, y, left.text, textStyle(typeRole.body, surface.paper.hex)).setFontSize(15);
    if (!left.expired) this.#startTicker();
    y += this.#countdown.height + 12;

    const buttons: ButtonSpec[] = [];
    if (left.expired) buttons.push({ id: "new-link", label: "New link", onClick: () => void this.#link() });
    else buttons.push({ id: "copy", label: "Copy code", onClick: () => this.#copy(phase.typed) });
    buttons.push({ id: "back-menu", label: "Back", onClick: () => this.#set({ kind: "home" }, NO_STATUS) });
    return Math.max(qrBottom, this.#drawButtons(buttons, x, y, column, stops, order));
  }

  #drawConfirm(
    title: string,
    text: string,
    working: boolean,
    buttons: readonly ButtonSpec[],
    x: number,
    top: number,
    width: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const heading = this.#heading(title, x, top, width);
    if (working) return heading.y + heading.height;
    const body = this.add
      .text(x, heading.y + heading.height + 10, text, textStyle(typeRole.body, surface.paper.hex, 0.9))
      .setFontSize(14)
      .setWordWrapWidth(width)
      .setLineSpacing(4);
    return this.#drawButtons(buttons, x, body.y + body.height + 16, Math.min(width, 380), stops, order);
  }
}

function recoveryText(step: Extract<SyncStep, { kind: "setup" }>): string {
  return typeof step.phase === "object" ? recoveryCodeText(step.phase.code) : "";
}
