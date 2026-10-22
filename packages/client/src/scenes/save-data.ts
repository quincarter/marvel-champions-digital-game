/**
 * Settings ▸ Save data: export everything this device has saved (games, decks, campaigns, unlocks) to a file, or
 * import such a file back. Launched over Settings (`scenes/settings.ts`), the same ink-and-paper panel shape as
 * Unlocks; ✕ or Escape stops only this overlay.
 *
 * Importing replaces what's on the device, so a good file first lands on a confirm step inside this overlay
 * (wording from `view/save-data-model.ts`); only "Replace" writes anything, then reloads so every store re-reads
 * what it was just given. The I/O lives in `save-data/`; this scene only draws and calls it.
 *
 * Send to / Receive from another device (issue #276) move the same file through the sync Worker with a short code:
 * Send shows the code, a QR code of the receive link and a countdown; Receive takes a typed code (or one filled in
 * from a `#receive=` link, `save-data/receive-link.ts`) and lands on the same replace confirm as Import. Wording
 * and the countdown are in `view/save-transfer-model.ts`.
 */
import Phaser from "phaser";
import { hit, signal, statHue, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { deliverSaveFile, pickSaveFile } from "../save-data/file-transfer.js";
import { exportSaveData, importSaveData } from "../save-data/save-data.js";
import type { SaveFile } from "../save-data/save-file.js";
import { receiveSaveFile, sendSaveFile } from "../save-data/transfer-client.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { drawQr } from "../ui/qr-draw.js";
import type { TransferCode } from "@mc/sync-worker/protocol";
import { overlayPanelLayout } from "../view/overlay-layout.js";
import type { Rect } from "../view/layout.js";
import {
  badFileStatusOf,
  exportStatusOf,
  importFailedStatusOf,
  NO_STATUS,
  replaceConfirmOf,
  type SaveDataStatus,
  type SaveDataStep,
} from "../view/save-data-model.js";
import {
  codeTextOf,
  COPIED_STATUS,
  COPY_FAILED_STATUS,
  countdownOf,
  receiveLinkOf,
  RECEIVE_ROW_DETAIL,
  RECEIVE_ROW_TITLE,
  SEND_ROW_DETAIL,
  SEND_ROW_TITLE,
  transferFailureStatusOf,
  sendFailedStatusOf,
  typedCodeOf,
} from "../view/save-transfer-model.js";
import { syncService } from "../sync/sync-wiring.js";
import { syncStatusDisplay, SYNC_ROW_TITLE } from "../view/sync-model.js";
import type { SyncLinkAddress } from "../sync/sync-link.js";
import type { SyncDataSceneData } from "./sync-data.js";
import { drawBetaTagBeside } from "../ui/beta-tag.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const HEADER_HEIGHT = 60;
const buttonType = { ...typeRole.label, size: 13 };
/** The code's field, in the mono face so the code's look-alike-free characters read the same everywhere. */
const codeFieldType = { ...typeRole.mono, size: 18 };
/** Past this width the Send screen puts the QR code beside the text instead of under it. */
const WIDE_ROW = 520;
const WIDE_QR = 220;

export interface SaveDataSceneData {
  /** Opened from a `#receive=` link: land on Receive with this code typed in (the player presses Receive). */
  readonly receive?: TransferCode;
  /** Opened from a `#link=` link: land on Sync across devices asking to join with it (device sync, #276). */
  readonly syncLink?: SyncLinkAddress;
}

interface PairButton {
  readonly id: string;
  readonly label: string;
  readonly onClick: () => void;
}

export class SaveDataOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #field: McTextInput | null = null;
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #step: SaveDataStep = { kind: "menu" };
  #status: SaveDataStatus = NO_STATUS;
  /** Once a second while a code is showing; only the countdown line changes until the code runs out. */
  #ticker: Phaser.Time.TimerEvent | null = null;
  #countdown: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENES.saveData);
  }

  create(data: SaveDataSceneData = {}): void {
    // Phaser hands a later launch with no data this same object again: take the code once.
    this.sys.settings.data = {};
    this.#motion = new OverlayMotion();
    this.#step = data.receive
      ? { kind: "receive", phase: "typing", input: codeTextOf(data.receive) }
      : { kind: "menu" };
    this.#status = NO_STATUS;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => (this.#field?.focused ?? false) || this.scene.isActive(SCENES.syncData),
      onCancel: () => this.#cancel(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#clearControls();
    });
    // The Sync row's status line follows the scheduler; a redraw only while this menu is what shows.
    let subscribed = false;
    const unsubscribe = syncService().status.subscribe(() => {
      // Not while the sync overlay is over this one: it shows the status itself, and a redraw here would be wasted.
      if (subscribed && this.sys.isActive() && this.#step.kind === "menu" && !this.scene.isActive(SCENES.syncData)) {
        this.#draw();
      }
    });
    subscribed = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.#draw();
    if (data.syncLink) this.#openSync(data.syncLink);
  }

  /** Sync across devices is its own overlay, over this one. */
  #openSync(link?: SyncLinkAddress): void {
    if (this.scene.isActive(SCENES.syncData) || this.#working) return;
    this.input.enabled = false;
    this.scene.launch(SCENES.syncData, (link ? { link } : {}) satisfies SyncDataSceneData);
    this.scene.get(SCENES.syncData).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
      if (this.sys.isActive()) this.#draw();
    });
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  /** Escape: backs out of the confirm, Send or Receive first, then closes; ignored while something is in flight. */
  #cancel(): void {
    if (this.#working) return;
    if (this.#step.kind === "menu") this.#close();
    else this.#set({ kind: "menu" }, NO_STATUS);
  }

  /** A file is being written, uploaded or fetched: nothing can be pressed until it answers. */
  get #working(): boolean {
    const step = this.#step;
    return (
      step.kind === "busy" ||
      (step.kind === "send" && step.phase.kind === "uploading") ||
      (step.kind === "receive" && step.phase === "fetching")
    );
  }

  #set(step: SaveDataStep, status: SaveDataStatus): void {
    this.#step = step;
    this.#status = status;
    this.#draw();
  }

  async #export(): Promise<void> {
    if (this.#working) return;
    this.#set({ kind: "busy" }, NO_STATUS);
    let error: unknown;
    try {
      await deliverSaveFile(await exportSaveData());
    } catch (caught) {
      error = caught ?? new Error("unknown error");
    }
    if (this.sys.isActive()) this.#set({ kind: "menu" }, exportStatusOf(error));
  }

  async #import(): Promise<void> {
    if (this.#step.kind !== "menu") return;
    const picked = await pickSaveFile();
    if (!this.sys.isActive() || picked === null) return;
    if (!picked.ok) this.#set({ kind: "menu" }, badFileStatusOf(picked.error));
    else this.#set({ kind: "confirm", file: picked.file }, NO_STATUS);
  }

  /** Uploads the save and shows its code. Also "New code" once a code has run out. */
  async #send(): Promise<void> {
    // A new code is asked for from the menu, or from a Send screen whose code has run out; never mid-request.
    const from = this.#step;
    if (
      from.kind === "send" ? from.phase.kind !== "showing" || Date.now() < from.phase.expiresAt : from.kind !== "menu"
    )
      return;
    // No service configured: say so without trying, and point at Export.
    if (syncServiceUrl() === null) {
      this.#set({ kind: "menu" }, transferFailureStatusOf({ kind: "unavailable" }));
      return;
    }
    this.#set({ kind: "send", phase: { kind: "uploading" } }, NO_STATUS);
    let sent: Awaited<ReturnType<typeof sendSaveFile>>;
    try {
      sent = await sendSaveFile(await exportSaveData());
    } catch (error) {
      if (this.sys.isActive()) this.#set({ kind: "menu" }, sendFailedStatusOf(error));
      return;
    }
    if (!this.sys.isActive()) return;
    if (sent.ok) {
      this.#set({ kind: "send", phase: { kind: "showing", code: sent.code, expiresAt: sent.expiresAt } }, NO_STATUS);
    } else this.#set({ kind: "menu" }, transferFailureStatusOf(sent.failure));
  }

  #copy(code: TransferCode): void {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    const done = (status: SaveDataStatus): void => {
      if (this.sys.isActive() && this.#step.kind === "send") this.#set(this.#step, status);
    };
    if (!clipboard?.writeText) {
      done(COPY_FAILED_STATUS);
      return;
    }
    clipboard.writeText(codeTextOf(code)).then(
      () => done(COPIED_STATUS),
      () => done(COPY_FAILED_STATUS),
    );
  }

  /** Receive's button (and Enter in the field): check the typed code, ask the service, go to the replace confirm. */
  async #receive(): Promise<void> {
    const step = this.#step;
    if (step.kind !== "receive" || step.phase !== "typing") return;
    const typed = typedCodeOf(step.input);
    if ("status" in typed) {
      this.#set(step, typed.status);
      return;
    }
    if (syncServiceUrl() === null) {
      this.#set(step, transferFailureStatusOf({ kind: "unavailable" }));
      return;
    }
    this.#set({ kind: "receive", phase: "fetching", input: step.input }, NO_STATUS);
    let got: Awaited<ReturnType<typeof receiveSaveFile>>;
    try {
      got = await receiveSaveFile(typed.code);
    } catch {
      got = { ok: false, failure: { kind: "unavailable" } };
    }
    if (!this.sys.isActive()) return;
    if (got.ok) this.#set({ kind: "confirm", file: got.file }, NO_STATUS);
    else this.#set({ kind: "receive", phase: "typing", input: step.input }, transferFailureStatusOf(got.failure));
  }

  async #replace(file: SaveFile): Promise<void> {
    this.#set({ kind: "busy" }, NO_STATUS);
    try {
      await importSaveData(file);
    } catch (error) {
      if (this.sys.isActive()) this.#set({ kind: "menu" }, importFailedStatusOf(error));
      return;
    }
    location.reload();
  }

  /** The once-a-second tick: the countdown line, or a redraw into the expired state. */
  #tick(): void {
    const step = this.#step;
    if (step.kind !== "send" || step.phase.kind !== "showing") return;
    const left = countdownOf(step.phase.expiresAt, Date.now());
    if (left.expired) {
      this.#status = NO_STATUS;
      this.#draw();
    } else this.#countdown?.setText(left.text);
  }

  /** `keepField` keeps the code field through a redraw on the typing step (`#draw`). */
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
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    // The code field survives a redraw on the typing step. A phone's keyboard shrinks the viewport as it opens, and
    // the resize redraws this screen: a new `<input>` there would drop focus and the keyboard would close at once.
    const keepField = this.#step.kind === "receive" && this.#step.phase === "typing";
    this.#clearControls(keepField);
    const kept = (keepField && this.#field?.gameObjects) || [];
    for (const object of kept) this.children.remove(object);
    destroyChildren(this);
    for (const object of kept) this.children.add(object);

    const { width, height } = this.scale.gameSize;
    const { panel, header, body } = overlayPanelLayout({ x: 0, y: 0, width, height }, HEADER_HEIGHT, 0);
    // Swallows taps that land on no control, so none reach Settings underneath.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    ground.lineStyle(4, surface.paper.hex, 1).strokeRect(panel.x, panel.y, panel.width, panel.height);
    ground.fillStyle(surface.paper.hex, 0.4).fillRect(header.x, header.y + header.height - 2, header.width, 2);

    const stops = new Map<string, FocusStop>();
    const closeSize = 32;
    const closeRect: Rect = {
      x: header.x + header.width - closeSize - 16,
      y: header.y + (header.height - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    const working = this.#working;
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        enabled: !working,
        onClick: () => this.#close(),
      }),
    );
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    this.add
      .text(header.x + 16, header.y + header.height / 2, caseOf(typeRole.barTitle, "Save data"), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "24px",
      })
      .setOrigin(0, 0.5);

    const order: string[] = ["back"];
    const x = body.x + 16;
    const rowWidth = body.width - 32;
    const bodyBottom = body.y + body.height;
    let y = body.y + 16;

    const step = this.#step;
    if (step.kind === "confirm") y = this.#drawConfirm(step.file, x, y, rowWidth, stops, order);
    else if (step.kind === "send") y = this.#drawSend(step.phase, x, y, rowWidth, bodyBottom, stops, order);
    else if (step.kind === "receive") y = this.#drawReceive(step, x, y, rowWidth, stops, order);
    else y = this.#drawMenu(x, y, rowWidth, bodyBottom - y, working, stops, order);

    if (this.#status.tone !== "none" || working) {
      const text = working ? "Working…" : this.#status.text;
      const error = this.#status.tone === "error" && !working;
      const line = this.add
        .text(
          x,
          y + 16,
          error ? `Problem: ${text}` : text,
          textStyle(typeRole.body, error ? signal.caution.hex : surface.paper.hex, 0.95),
        )
        .setFontSize(12)
        .setWordWrapWidth(rowWidth);
      y = line.y + line.height;
      if (this.#status.offerExport && !working) {
        const rect: Rect = { x, y: y + 10, width: Math.min(rowWidth, 200), height: hit.primary };
        const exportNow = (): void => void this.#export();
        this.#buttons.push(
          new McButton(this, { kind: "secondary", label: "Export", type: buttonType, rect, onClick: exportNow }),
        );
        stops.set("status-export", { rect, activate: exportNow });
        order.push("status-export");
      }
    }

    this.#route?.set(order, stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** The four action rows: a column, or two by two when the panel is wide and the screen short (a landscape phone). */
  #drawMenu(
    x: number,
    top: number,
    rowWidth: number,
    room: number,
    working: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const rows = [
      {
        title: "Export",
        detail: "Save everything on this device to a file you can keep or move to another device.",
        label: "Export",
        run: () => void this.#export(),
        id: "export",
      },
      {
        title: "Import",
        detail: "Load a save file made by Export. It replaces what's on this device, after you confirm.",
        label: "Import",
        run: () => void this.#import(),
        id: "import",
      },
      { title: SEND_ROW_TITLE, detail: SEND_ROW_DETAIL, label: "Send", run: () => void this.#send(), id: "send" },
      {
        title: RECEIVE_ROW_TITLE,
        detail: RECEIVE_ROW_DETAIL,
        label: "Receive",
        run: () => this.#set({ kind: "receive", phase: "typing", input: "" }, NO_STATUS),
        id: "receive",
      },
      {
        title: SYNC_ROW_TITLE,
        detail: `Status: ${syncStatusDisplay(syncService().isOn(), syncService().status.get(), Date.now())}`,
        label: "Sync",
        run: () => this.#openSync(),
        id: "sync",
      },
    ];
    const per = rowWidth >= WIDE_ROW && room < 560 ? 2 : 1;
    const cell = per === 2 ? (rowWidth - 16) / 2 : rowWidth;
    let y = top;
    for (let i = 0; i < rows.length; i += per) {
      let rowBottom = y;
      for (const [at, row] of rows.slice(i, i + per).entries()) {
        const bottom = this.#drawAction(
          { x: x + at * (cell + 16), y, width: cell, height: 0 },
          row.title,
          row.detail,
          row.label,
          row.run,
          row.id,
          stops,
          order,
          !working,
        );
        rowBottom = Math.max(rowBottom, bottom);
      }
      y = rowBottom + (i + per < rows.length ? 16 : 0);
    }
    return y;
  }

  /** One title + detail + button block; returns the y below it. */
  #drawAction(
    at: Rect,
    title: string,
    detail: string,
    buttonLabel: string,
    onClick: () => void,
    id: string,
    stops: Map<string, FocusStop>,
    order: string[],
    enabled: boolean,
  ): number {
    const titleText = this.add
      .text(at.x, at.y, caseOf(typeRole.sectionHeader, title), textStyle(typeRole.sectionHeader, surface.paper.hex))
      .setWordWrapWidth(at.width);
    if (id === "sync") drawBetaTagBeside(this, titleText, at.x + at.width);
    const detailText = this.add
      .text(at.x, titleText.y + titleText.height + 4, detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(11)
      .setWordWrapWidth(at.width);
    const rect: Rect = {
      x: at.x,
      y: detailText.y + detailText.height + 10,
      width: Math.min(at.width, 200),
      height: hit.primary,
    };
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: buttonLabel, type: buttonType, rect, enabled, onClick }),
    );
    stops.set(`row:${id}`, { rect, activate: onClick });
    order.push(`row:${id}`);
    return rect.y + rect.height;
  }

  /** Two equal buttons side by side (Cancel / Replace's shape); returns the y below them. */
  #drawPair(
    x: number,
    y: number,
    rowWidth: number,
    left: PairButton,
    right: PairButton,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const buttonWidth = Math.min(180, (rowWidth - 12) / 2);
    for (const [at, spec] of [left, right].entries()) {
      const rect: Rect = { x: x + at * (buttonWidth + 12), y, width: buttonWidth, height: hit.primary };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: spec.label,
          type: buttonType,
          rect,
          onClick: spec.onClick,
        }),
      );
      stops.set(spec.id, { rect, activate: spec.onClick });
      order.push(spec.id);
    }
    return y + hit.primary;
  }

  #drawSend(
    phase: Extract<SaveDataStep, { kind: "send" }>["phase"],
    x: number,
    top: number,
    rowWidth: number,
    bodyBottom: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const wide = rowWidth >= WIDE_ROW;
    const column = wide ? rowWidth - WIDE_QR - 24 : rowWidth;
    const title = this.add
      .text(
        x,
        top,
        caseOf(typeRole.sectionHeader, SEND_ROW_TITLE),
        textStyle(typeRole.sectionHeader, surface.paper.hex),
      )
      .setWordWrapWidth(column);
    if (phase.kind === "uploading") return title.y + title.height;

    // A short screen (a landscape phone) gets one line of instructions so the column fits beside the QR code.
    const short = bodyBottom - top < 340;
    const help = this.add
      .text(
        x,
        title.y + title.height + 8,
        short
          ? "Type this code on the other device, or scan the QR code."
          : "On the other device open Settings, Save data, Receive from another device, then type this code or scan the QR code with its camera. The code works once.",
        textStyle(typeRole.body, surface.paper.hex, 0.85),
      )
      .setFontSize(12)
      .setWordWrapWidth(column)
      .setLineSpacing(3);
    // 14 mono characters ("ABCD-EFGH-JKMN") at about 0.62 em each.
    const codeSize = Math.max(16, Math.min(34, Math.floor(column / (14 * 0.62))));
    const code = this.add
      .text(x, help.y + help.height + 14, codeTextOf(phase.code), textStyle(typeRole.mono, surface.paper.hex))
      .setFontSize(codeSize);
    let y = code.y + code.height + 14;

    const link = receiveLinkOf(phase.code, location);
    let qrBottom = 0;
    if (wide) {
      // Beside the text, clamped to the room the panel has left.
      const size = Math.max(112, Math.min(WIDE_QR, bodyBottom - 16 - top));
      drawQr(this, link, x + rowWidth - WIDE_QR + (WIDE_QR - size) / 2, top, size);
      qrBottom = top + size;
    } else {
      // Room left under the QR: the countdown, the buttons and a status line with its Export button.
      const size = Math.max(112, Math.min(rowWidth, 260, bodyBottom - 16 - y - 230));
      drawQr(this, link, x + (rowWidth - size) / 2, y, size);
      y += size + 12;
    }

    const left = countdownOf(phase.expiresAt, Date.now());
    this.#countdown = this.add.text(x, y, left.text, textStyle(typeRole.body, surface.paper.hex)).setFontSize(15);
    if (!left.expired) {
      this.#ticker = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.#tick() });
    }
    y += this.#countdown.height + 12;

    const back = { id: "back-menu", label: "Back", onClick: () => this.#set({ kind: "menu" }, NO_STATUS) };
    const first = left.expired
      ? { id: "new-code", label: "New code", onClick: () => void this.#send() }
      : { id: "copy", label: "Copy code", onClick: () => this.#copy(phase.code) };
    return Math.max(qrBottom, this.#drawPair(x, y, column, first, back, stops, order));
  }

  #drawReceive(
    step: Extract<SaveDataStep, { kind: "receive" }>,
    x: number,
    top: number,
    rowWidth: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const title = this.add
      .text(
        x,
        top,
        caseOf(typeRole.sectionHeader, RECEIVE_ROW_TITLE),
        textStyle(typeRole.sectionHeader, surface.paper.hex),
      )
      .setWordWrapWidth(rowWidth);
    if (step.phase === "fetching") return title.y + title.height;

    const help = this.add
      .text(
        x,
        title.y + title.height + 8,
        "On the other device open Settings, Save data, Send to another device. Type the code it shows. It replaces what's on this device, after you confirm.",
        textStyle(typeRole.body, surface.paper.hex, 0.85),
      )
      .setFontSize(12)
      .setWordWrapWidth(rowWidth)
      .setLineSpacing(3);
    const fieldRect: Rect = { x, y: help.y + help.height + 14, width: Math.min(rowWidth, 320), height: hit.primary };
    // A field kept through the redraw (`#draw`) only moves; a new one is made on entering the step.
    const field = this.#field ?? this.#newCodeField(fieldRect, step.input);
    field.layout(fieldRect);
    stops.set("code", { rect: fieldRect, activate: () => field.focus() });
    order.push("code");

    const receive = { id: "receive", label: "Receive", onClick: () => void this.#receive() };
    const back = { id: "back-menu", label: "Back", onClick: () => this.#set({ kind: "menu" }, NO_STATUS) };
    return this.#drawPair(x, fieldRect.y + fieldRect.height + 14, fieldRect.width, receive, back, stops, order);
  }

  #newCodeField(rect: Rect, input: string): McTextInput {
    const field = new McTextInput(this, {
      rect,
      value: input,
      type: codeFieldType,
      placeholder: "ABCD-EFGH-JKMN",
      maxLength: 24,
      onChange: (value) => {
        // Kept in the step so the field can be rebuilt with what was typed; no redraw per key.
        this.#step = { kind: "receive", phase: "typing", input: value };
      },
    });
    this.#field = field;
    (field.gameObject as unknown as { node: HTMLElement }).node.addEventListener("keydown", (event) => {
      if (event.key === "Enter") void this.#receive();
    });
    // A keyboard or mouse player can type at once; a phone would have its keyboard cover the screen.
    if (!this.sys.game.device.input.touch && input === "") field.focus();
    return field;
  }

  #drawConfirm(
    file: SaveFile,
    x: number,
    top: number,
    rowWidth: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const confirm = replaceConfirmOf(file, syncService().isOn());
    const title = this.add
      .text(x, top, confirm.title, textStyle(typeRole.sectionHeader, surface.paper.hex))
      .setWordWrapWidth(rowWidth);
    const body = this.add
      .text(x, title.y + title.height + 10, confirm.body, textStyle(typeRole.body, surface.paper.hex, 0.9))
      .setFontSize(14)
      .setWordWrapWidth(rowWidth)
      .setLineSpacing(4);
    const buttonY = body.y + body.height + 16;
    const buttonWidth = Math.min(180, (rowWidth - 12) / 2);
    const cancelRect: Rect = { x, y: buttonY, width: buttonWidth, height: hit.primary };
    const replaceRect: Rect = { x: x + buttonWidth + 12, y: buttonY, width: buttonWidth, height: hit.primary };
    const cancel = (): void => this.#set({ kind: "menu" }, NO_STATUS);
    const replace = (): void => void this.#replace(file);
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: confirm.cancelLabel,
        type: buttonType,
        rect: cancelRect,
        onClick: cancel,
      }),
      // Destructive: the attack red the board uses for damage, never the color alone (the label says Replace).
      new McButton(this, {
        kind: "secondary",
        label: confirm.confirmLabel,
        type: buttonType,
        rect: replaceRect,
        tint: { fill: statHue.atk.hex, ink: surface.paper.hex },
        onClick: replace,
      }),
    );
    stops.set("cancel", { rect: cancelRect, activate: cancel });
    stops.set("replace", { rect: replaceRect, activate: replace });
    order.push("cancel", "replace");
    return replaceRect.y + replaceRect.height;
  }
}
