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
import { hitRectAround } from "../view/hit-rect.js";
import { t } from "../i18n/translate.js";
import Phaser from "phaser";
import { accent, font, hit, signal, surface, typeRole } from "../tokens.js";
import { McTextInput } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { encode } from "uqr";
import { BETA_TAG_GAP, BETA_TAG_SIZE, BETA_TAG_TEXT, SHOW_BETA_TAGS } from "../view/beta-tag.js";
import { deliverSaveFile, pickSaveFile } from "../save-data/file-transfer.js";
import { exportSaveData, importSaveData } from "../save-data/save-data.js";
import type { SaveFile } from "../save-data/save-file.js";
import { receiveSaveFile, sendSaveFile } from "../save-data/transfer-client.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
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
  exportRowDetail,
  exportRowTitle,
  importRowDetail,
  importRowTitle,
} from "../view/save-data-model.js";
import {
  codeTextOf,
  COPIED_STATUS,
  COPY_FAILED_STATUS,
  countdownOf,
  receiveLinkOf,
  receiveRowDetail,
  receiveRowTitle,
  sendRowDetail,
  sendRowTitle,
  transferFailureStatusOf,
  sendFailedStatusOf,
  typedCodeOf,
} from "../view/save-transfer-model.js";
import { syncService } from "../sync/sync-wiring.js";
import { syncStatusDisplay, syncRowTitle } from "../view/sync-model.js";
import type { SyncLinkAddress } from "../sync/sync-link.js";
import { finishedIdsOf, readConsent, turnOffGlobalStats, turnOnGlobalStats } from "../global-stats/global-consent.js";
import { globalRowFailed, globalRowTitle, globalRowButton, globalRowDetail } from "../view/global-stats-ui.js";
import { appSession } from "../session.js";
import type { SyncDataSceneData } from "./sync-data.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const HEADER_HEIGHT = 60;
const buttonType = { ...typeRole.label, size: 13 };
/** The code's field, in the mono face so the code's look-alike-free characters read the same everywhere. */
const codeFieldType = { ...typeRole.mono, size: 18 };
/** Past this width the Send screen puts the QR code beside the text instead of under it. */
const WIDE_ROW = 520;
const WIDE_QR = 220;
/** What six full action rows need (measured at about 692 px), so a shorter body goes two by two or compact. */
const ROWS_ROOM = 700;

export interface SaveDataSceneData {
  /** Opened from a `#receive=` link: land on Receive with this code typed in (the player presses Receive). */
  readonly receive?: TransferCode;
  /** Opened from a `#link=` link: land on Sync across devices asking to join with it (device sync, #276). */
  readonly syncLink?: SyncLinkAddress;
  /** Opened from a Settings search result: the action row to put the ring on. */
  readonly row?: string;
}

interface PairButton {
  readonly id: string;
  readonly label: string;
  readonly onClick: () => void;
}

export class SaveDataOverlay extends Phaser.Scene {
  #field: McTextInput | null = null;
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;
  /** What each key in the panel does when pressed, this draw. */
  #actions = new Map<string, () => void>();
  #b!: SheetBuilder;
  #motion = new OverlayMotion();
  #step: SaveDataStep = { kind: "menu" };
  #status: SaveDataStatus = NO_STATUS;
  /** Once a second while a code is showing: the screen is drawn again for the countdown, until the code runs out. */
  #ticker: Phaser.Time.TimerEvent | null = null;
  /** The stop Start presses on the step now showing, or null (the menu and the replace confirm have none). */
  #primary: (() => void) | null = null;

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
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.());
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    // Before the route: A, B or Start takes the caret out of the code field (the route is held while it has one).
    bindTextFieldEscape(
      this,
      () => this.#field,
      () => this.scene.isActive(SCENES.syncData),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => (this.#field?.focused ?? false) || this.scene.isActive(SCENES.syncData),
      onCancel: () => this.#cancel(),
      // Start is "forward": Receive on the code step, Copy code / New code on the Send step.
      onPause: () => this.#primary?.(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#glyphs.dispose();
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
    if (data.row !== undefined) this.#route?.focusKey(`row:${data.row}`);
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

  /**
   * Share anonymous game results (global win rates): on or off, on this device only, with no network. Turning it on
   * hands the finished games so far to `turnOnGlobalStats`, which marks them sent so none of them ever is.
   */
  async #toggleGlobal(): Promise<void> {
    if (this.#step.kind !== "menu" || this.#working) return;
    let saved: boolean;
    if (readConsent() === "on") saved = turnOffGlobalStats();
    else {
      try {
        saved = turnOnGlobalStats(finishedIdsOf(await appSession().store.listSaves()));
      } catch {
        saved = false;
      }
    }
    if (!this.sys.isActive() || this.#step.kind !== "menu") return;
    this.#set({ kind: "menu" }, saved ? NO_STATUS : { tone: "error", text: globalRowFailed() });
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
    } else this.#draw();
  }

  /** `keepField` keeps the code field through a redraw on the typing step (`#draw`). */
  #clearControls(keepField = false): void {
    if (!keepField) {
      this.#field?.destroy();
      this.#field = null;
    }
    this.#ticker?.remove(false);
    this.#ticker = null;
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
    this.#glyphs.reset();
    this.#actions = new Map();
    this.#primary = null;

    const { width, height } = this.scale.gameSize;
    const { panel, header, body } = overlayPanelLayout({ x: 0, y: 0, width, height }, HEADER_HEIGHT, 0);
    // Swallows presses that land on no control, so none reach Settings underneath.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();
    // Before the first mount: the sheet then has this anchor as its one motion owner (no built-in slide on top).
    this.#panel.follow(anchor);
    const b = this.#panel.begin(width, height);
    this.#b = b;
    b.box(panel, { fill: surface.ink.hex, stroke: surface.paper.hex, strokeWidth: 4 });
    b.box(
      { x: header.x, y: header.y + header.height - 2, width: header.width, height: 2 },
      { fill: surface.paper.hex, fillAlpha: 0.4 },
    );

    const stops = new Map<string, FocusStop>();
    const closeSize = 32;
    const closeRect: Rect = {
      x: header.x + header.width - closeSize - 16,
      y: header.y + (header.height - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    const working = this.#working;
    this.#glyphs.button(b, {
      key: "back",
      rect: closeRect,
      label: "✕",
      look: "secondary",
      type: typeRole.rowTitle,
      ids: working ? [] : ["cancel"],
      ground: "ink",
      ...(working ? { disabled: true as const } : {}),
    });
    this.#press("back", () => this.#close());
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    if (!working) {
      // The drawn ✕ is small: a 44px press area around it, inside the header.
      this.#press("back:hit", () => this.#close());
      b.tap("back:hit", hitRectAround(closeRect, hit.target, header));
    }
    b.text(header.x + 16, header.y + header.height / 2, t("settings.saveData.title"), typeRole.barTitle, {
      size: 24,
      color: surface.paper.hex,
      origin: [0, 0.5],
    });

    const order: string[] = ["back"];
    const x = body.x + 16;
    const rowWidth = body.width - 32;
    const bodyBottom = body.y + body.height;
    let y = body.y + 16;

    const step = this.#step;
    let holes: readonly Rect[] = [];
    if (step.kind === "confirm") y = this.#drawConfirm(step.file, x, y, rowWidth, stops, order);
    else if (step.kind === "send") y = this.#drawSend(step.phase, x, y, rowWidth, bodyBottom, stops, order);
    else if (step.kind === "receive") {
      const drawn = this.#drawReceive(step, x, y, rowWidth, stops, order);
      y = drawn.bottom;
      holes = drawn.field ? [drawn.field] : [];
    } else y = this.#drawMenu(x, y, rowWidth, bodyBottom - y, working, stops, order);

    if (this.#status.tone !== "none" || working) {
      const text = working ? t("saveData.working") : this.#status.text;
      const error = this.#status.tone === "error" && !working;
      const line = b.text(x, y + 16, error ? t("saveData.problem", { text }) : text, typeRole.body, {
        size: 12,
        color: error ? signal.caution.hex : surface.paper.hex,
        alpha: 0.95,
        wrapWidth: rowWidth,
      });
      y = y + 16 + line.height;
      if (this.#status.offerExport && !working) {
        const rect: Rect = { x, y: y + 10, width: Math.min(rowWidth, 200), height: hit.primary };
        const exportNow = (): void => void this.#export();
        b.button({
          key: "status-export",
          rect,
          label: t("saveData.button.export"),
          look: "secondary",
          type: buttonType,
        });
        this.#press("status-export", exportNow);
        stops.set("status-export", { rect, activate: exportNow });
        order.push("status-export");
      }
    }

    this.#panel.mount(b, width, height, holes);
    this.#route?.set(order, stops);
    this.#motion.enter(this, { scrim: [], panels: [anchor] });
  }

  /** A key's press. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  /** The small outlined BETA tag (`ui/beta-tag.ts`) with its left edge at `x`, centred on `centerY`. */
  #betaTag(x: number, centerY: number): void {
    if (!SHOW_BETA_TAGS) return;
    const rect: Rect = {
      x: Math.round(x),
      y: Math.round(centerY - BETA_TAG_SIZE.height / 2),
      width: BETA_TAG_SIZE.width,
      height: BETA_TAG_SIZE.height,
    };
    this.#b.box(rect, { fill: accent.heroRed.hex, fillAlpha: 0.28, stroke: accent.heroRed.hex, strokeWidth: 1.5 });
    this.#b.text(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      BETA_TAG_TEXT,
      { ...typeRole.mono, family: font.mono, size: 9, weight: 700, letterSpacing: 1, uppercase: false },
      {
        color: surface.paper.hex,
        origin: [0.5, 0.5],
      },
    );
  }

  /**
   * The action rows (six, one per way to move or share your data): a column, two by two when the panel is wide and the
   * screen short, and on a narrow short screen (a phone) a compact column with each button beside its text. The body does
   * not scroll, so every row must fit: a full column of six needs about ROWS_ROOM px.
   */
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
        title: exportRowTitle(),
        detail: exportRowDetail(),
        label: t("saveData.button.export"),
        run: () => void this.#export(),
        id: "export",
      },
      {
        title: importRowTitle(),
        detail: importRowDetail(),
        label: t("saveData.button.import"),
        run: () => void this.#import(),
        id: "import",
      },
      {
        title: sendRowTitle(),
        detail: sendRowDetail(),
        label: t("saveData.button.send"),
        run: () => void this.#send(),
        id: "send",
      },
      {
        title: receiveRowTitle(),
        detail: receiveRowDetail(),
        label: t("saveData.button.receive"),
        run: () => this.#set({ kind: "receive", phase: "typing", input: "" }, NO_STATUS),
        id: "receive",
      },
      {
        title: syncRowTitle(),
        detail: t("sync.statusLine", {
          status: syncStatusDisplay(syncService().isOn(), syncService().status.get(), Date.now()),
        }),
        label: t("saveData.button.sync"),
        run: () => this.#openSync(),
        id: "sync",
      },
      {
        title: globalRowTitle(),
        detail: globalRowDetail(readConsent()),
        label: globalRowButton(readConsent()),
        run: () => void this.#toggleGlobal(),
        id: "global",
      },
    ];
    const per = rowWidth >= WIDE_ROW && room < ROWS_ROOM ? 2 : 1;
    const compact = per === 1 && room < ROWS_ROOM;
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
          compact,
        );
        rowBottom = Math.max(rowBottom, bottom);
      }
      y = rowBottom + (i + per < rows.length ? (compact ? 10 : 16) : 0);
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
    compact = false,
  ): number {
    const b = this.#b;
    // Compact: the button sits at the right of its text, centred on the row, instead of under it.
    const buttonWidth = compact ? 104 : Math.min(at.width, 200);
    const textWidth = compact ? at.width - buttonWidth - 12 : at.width;
    const titleText = b.text(at.x, at.y, title, typeRole.sectionHeader, {
      color: surface.paper.hex,
      wrapWidth: textWidth,
    });
    if (id === "sync") {
      // Right of the title's last line, as the Phaser tag sat beside the text's bounds.
      const oneLine = b.measure(title, typeRole.sectionHeader);
      const tagX = at.x + Math.min(oneLine.width, textWidth) + BETA_TAG_GAP;
      if (tagX + BETA_TAG_SIZE.width <= at.x + textWidth) this.#betaTag(tagX, at.y + titleText.height / 2);
    }
    const detailText = b.text(at.x, at.y + titleText.height + 4, detail, typeRole.body, {
      size: 11,
      color: surface.paper.hex,
      alpha: 0.8,
      wrapWidth: textWidth,
    });
    const textBottom = at.y + titleText.height + 4 + detailText.height;
    const rect: Rect = compact
      ? {
          x: at.x + at.width - buttonWidth,
          y: Math.round(at.y + Math.max(0, (textBottom - at.y - hit.primary) / 2)),
          width: buttonWidth,
          height: hit.primary,
        }
      : { x: at.x, y: textBottom + 10, width: buttonWidth, height: hit.primary };
    b.button({
      key: `row:${id}`,
      rect,
      label: buttonLabel,
      look: "secondary",
      type: buttonType,
      ...(enabled ? {} : { disabled: true as const }),
    });
    this.#press(`row:${id}`, onClick);
    stops.set(`row:${id}`, { rect, activate: onClick });
    order.push(`row:${id}`);
    return compact ? Math.max(textBottom, rect.y + rect.height) : rect.y + rect.height;
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
      this.#glyphs.button(this.#b, {
        key: spec.id,
        rect,
        label: spec.label,
        look: "secondary",
        type: buttonType,
        ids: spec.id === "back-menu" ? ["cancel"] : [],
        ground: "ink",
      });
      this.#press(spec.id, spec.onClick);
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
    const b = this.#b;
    const wide = rowWidth >= WIDE_ROW;
    const column = wide ? rowWidth - WIDE_QR - 24 : rowWidth;
    const title = b.text(x, top, sendRowTitle(), typeRole.sectionHeader, {
      color: surface.paper.hex,
      wrapWidth: column,
    });
    if (phase.kind === "uploading") return top + title.height;

    // A short screen (a landscape phone) gets one line of instructions so the column fits beside the QR code.
    const short = bodyBottom - top < 340;
    const help = b.text(
      x,
      top + title.height + 8,
      short ? t("saveData.send.helpShort") : t("saveData.send.help"),
      typeRole.body,
      {
        size: 12,
        color: surface.paper.hex,
        alpha: 0.85,
        wrapWidth: column,
        lineSpacing: 3,
      },
    );
    // 14 mono characters ("ABCD-EFGH-JKMN") at about 0.62 em each.
    const codeSize = Math.max(16, Math.min(34, Math.floor(column / (14 * 0.62))));
    const codeTop = top + title.height + 8 + help.height + 14;
    const code = b.text(x, codeTop, codeTextOf(phase.code), typeRole.mono, {
      size: codeSize,
      color: surface.paper.hex,
    });
    let y = codeTop + code.height + 14;

    const link = receiveLinkOf(phase.code, location);
    let qrBottom = 0;
    if (wide) {
      // Beside the text, clamped to the room the panel has left.
      const size = Math.max(112, Math.min(WIDE_QR, bodyBottom - 16 - top));
      this.#qr(link, x + rowWidth - WIDE_QR + (WIDE_QR - size) / 2, top, size);
      qrBottom = top + size;
    } else {
      // Room left under the QR: the countdown, the buttons and a status line with its Export button.
      const size = Math.max(112, Math.min(rowWidth, 260, bodyBottom - 16 - y - 230));
      this.#qr(link, x + (rowWidth - size) / 2, y, size);
      y += size + 12;
    }

    const left = countdownOf(phase.expiresAt, Date.now());
    const countdown = b.text(x, y, left.text, typeRole.body, { size: 15, color: surface.paper.hex, key: "countdown" });
    if (!left.expired) {
      this.#ticker = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.#tick() });
    }
    y += countdown.height + 12;

    const back = { id: "back-menu", label: t("saveData.back"), onClick: () => this.#set({ kind: "menu" }, NO_STATUS) };
    const first = left.expired
      ? { id: "new-code", label: t("saveData.newCode"), onClick: () => void this.#send() }
      : { id: "copy", label: t("saveData.copyCode"), onClick: () => this.#copy(phase.code) };
    this.#primary = first.onClick;
    return Math.max(qrBottom, this.#drawPair(x, y, column, first, back, stops, order));
  }

  /** A link as a QR code, in whole pixels per module with a four-module quiet zone (`ui/qr-draw.ts`, now in the panel). */
  #qr(text: string, x: number, y: number, size: number): void {
    const { data } = encode(text, { ecc: "M", border: 0 });
    const cell = Math.max(1, Math.floor(size / (data.length + 8)));
    const drawn = cell * (data.length + 8);
    this.#b.qr(
      { x: x + Math.floor((size - drawn) / 2), y, width: drawn, height: drawn },
      data.map((row) => row.map((dark) => (dark ? "1" : "0")).join("")),
      4,
      { background: surface.paper.hex, foreground: surface.ink.hex },
    );
  }

  #drawReceive(
    step: Extract<SaveDataStep, { kind: "receive" }>,
    x: number,
    top: number,
    rowWidth: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): { bottom: number; field: Rect | null } {
    const b = this.#b;
    const title = b.text(x, top, receiveRowTitle(), typeRole.sectionHeader, {
      color: surface.paper.hex,
      wrapWidth: rowWidth,
    });
    if (step.phase === "fetching") return { bottom: top + title.height, field: null };

    const help = b.text(x, top + title.height + 8, t("saveData.receive.help"), typeRole.body, {
      size: 12,
      color: surface.paper.hex,
      alpha: 0.85,
      wrapWidth: rowWidth,
      lineSpacing: 3,
    });
    const fieldRect: Rect = {
      x,
      y: top + title.height + 8 + help.height + 14,
      width: Math.min(rowWidth, 320),
      height: hit.primary,
    };
    // A field kept through the redraw (`#draw`) only moves; a new one is made on entering the step.
    const field = this.#field ?? this.#newCodeField(fieldRect, step.input);
    field.layout(fieldRect);
    for (const node of field.gameObjects) this.children.bringToTop(node);
    stops.set("code", { rect: fieldRect, activate: () => field.focus() });
    order.push("code");

    const receive = { id: "receive", label: t("saveData.button.receive"), onClick: () => void this.#receive() };
    const back = { id: "back-menu", label: t("saveData.back"), onClick: () => this.#set({ kind: "menu" }, NO_STATUS) };
    this.#primary = receive.onClick;
    return {
      bottom: this.#drawPair(x, fieldRect.y + fieldRect.height + 14, fieldRect.width, receive, back, stops, order),
      field: fieldRect,
    };
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
    const b = this.#b;
    const confirm = replaceConfirmOf(file, syncService().isOn());
    const title = b.text(x, top, confirm.title, typeRole.sectionHeader, {
      color: surface.paper.hex,
      wrapWidth: rowWidth,
    });
    const body = b.text(x, top + title.height + 10, confirm.body, typeRole.body, {
      size: 14,
      color: surface.paper.hex,
      alpha: 0.9,
      wrapWidth: rowWidth,
      lineSpacing: 4,
    });
    const buttonY = top + title.height + 10 + body.height + 16;
    const buttonWidth = Math.min(180, (rowWidth - 12) / 2);
    const cancelRect: Rect = { x, y: buttonY, width: buttonWidth, height: hit.primary };
    const replaceRect: Rect = { x: x + buttonWidth + 12, y: buttonY, width: buttonWidth, height: hit.primary };
    const cancel = (): void => this.#set({ kind: "menu" }, NO_STATUS);
    const replace = (): void => void this.#replace(file);
    this.#glyphs.button(b, {
      key: "cancel",
      rect: cancelRect,
      label: confirm.cancelLabel,
      look: "secondary",
      type: buttonType,
      ids: ["cancel"],
      ground: "ink",
    });
    // Destructive: the attack red, never the colour alone (the label says Replace).
    b.button({ key: "replace", rect: replaceRect, label: confirm.confirmLabel, look: "primary", type: buttonType });
    this.#press("cancel", cancel);
    this.#press("replace", replace);
    stops.set("cancel", { rect: cancelRect, activate: cancel });
    stops.set("replace", { rect: replaceRect, activate: replace });
    order.push("cancel", "replace");
    return replaceRect.y + replaceRect.height;
  }
}
