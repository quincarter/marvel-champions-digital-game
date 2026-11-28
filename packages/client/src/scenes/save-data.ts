/**
 * Settings ▸ Save data: export everything this device has saved (games, decks, campaigns, unlocks) to a file, or
 * import such a file back. Launched over Settings (`scenes/settings.ts`); Back or Escape stops only this overlay.
 *
 * Importing replaces what's on the device, so a good file first lands on a confirm step inside this overlay
 * (wording from `view/save-data-model.ts`); only "Replace" writes anything, then reloads so every store re-reads
 * what it was just given. The I/O lives in `save-data/`; this scene only hands the page its model and calls it.
 *
 * Send to / Receive from another device (issue #276) move the same file through the sync Worker with a short code:
 * Send shows the code, a QR code of the receive link and a countdown; Receive takes a typed code (or one filled in
 * from a `#receive=` link, `save-data/receive-link.ts`) and lands on the same replace confirm as Import. Wording
 * and the countdown are in `view/save-transfer-model.ts`.
 *
 * **The screen is one custom element**, `mc-save-data-page` (`views/save-data/`), composing the sections in
 * `components/save-data/` (the six action rows, the replace confirm, Send, Receive, the status line) under an
 * `mc-top-bar`. The scene keeps the press shield, the entrance and exit motion, the focus route, the steps and the I/O.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { TransferCode } from "@mc/sync-worker/protocol";
import "../views/save-data/mc-save-data-page/mc-save-data-page.js";
import type {
  SaveDataActionId,
  SaveDataEventDetail,
  SaveDataPageModel,
  SaveDataStepInput,
} from "../components/save-data/save-data.types.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import { t } from "../i18n/translate.js";
import { addPressShield } from "../ui/press-shield.js";
import { OverlayMotion } from "../ui/transitions.js";
import { deliverSaveFile, pickSaveFile } from "../save-data/file-transfer.js";
import { exportSaveData, importSaveData } from "../save-data/save-data.js";
import type { SaveFile } from "../save-data/save-file.js";
import { receiveSaveFile, sendSaveFile } from "../save-data/transfer-client.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import {
  badFileStatusOf,
  exportStatusOf,
  importFailedStatusOf,
  NO_STATUS,
  type SaveDataStatus,
  type SaveDataStep,
} from "../view/save-data-model.js";
import {
  codeTextOf,
  COPIED_STATUS,
  COPY_FAILED_STATUS,
  countdownOf,
  transferFailureStatusOf,
  sendFailedStatusOf,
  typedCodeOf,
} from "../view/save-transfer-model.js";
import { formFactorFor } from "../view/layout.js";
import { syncService } from "../sync/sync-wiring.js";
import type { SyncLinkAddress } from "../sync/sync-link.js";
import { finishedIdsOf, readConsent, turnOffGlobalStats, turnOnGlobalStats } from "../global-stats/global-consent.js";
import { globalRowFailed } from "../view/global-stats-ui.js";
import { appSession } from "../session.js";
import type { SyncDataSceneData } from "./sync-data.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { FocusRoute } from "./focus-route.js";
import { composeStep, statusInputOf } from "./save-data/save-data-compose.js";
import { SCENES } from "./keys.js";

export interface SaveDataSceneData {
  /** Opened from a `#receive=` link: land on Receive with this code typed in (the player presses Receive). */
  readonly receive?: TransferCode;
  /** Opened from a `#link=` link: land on Sync across devices asking to join with it (device sync, #276). */
  readonly syncLink?: SyncLinkAddress;
  /** Opened from a Settings search result: the action row to put the ring on. */
  readonly row?: string;
}

export class SaveDataOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-save-data-page"]> | null = null;
  #glyphs!: ControlGlyphs;
  #motion = new OverlayMotion();
  #anchor: Phaser.GameObjects.Graphics | null = null;
  #step: SaveDataStep = { kind: "menu" };
  #status: SaveDataStatus = NO_STATUS;
  /** Once a second while a code is showing: the screen is drawn again for the countdown, until the code runs out. */
  #ticker: Phaser.Time.TimerEvent | null = null;
  /** The stop Start presses on the step now showing, or null (the menu and the replace confirm have none). */
  #primary: (() => void) | null = null;
  /** The caret is in the code field: the route stands aside. */
  #typing = false;
  /** The code field takes the caret when the Receive step is drawn next (a keyboard or mouse player types at once). */
  #focusCode = false;
  #stamp = 0;
  #qr: { readonly link: string; readonly rows: readonly string[] } | null = null;

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
    this.#typing = false;
    this.#focusCode = false;
    const { width, height } = this.scale.gameSize;
    // Swallows presses that land on no control, so none reach Settings underneath.
    addPressShield(this, { x: 0, y: 0, width, height });
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    this.#anchor = this.add.graphics();
    const mounted = mountElement(this, "mc-save-data-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    mounted.region.follow(this.#anchor);
    mounted.element.addEventListener("mc-save-data", (event) => this.#heard(event.detail));
    mounted.element.addEventListener("mc-field-focus", (event) => {
      this.#typing = (event as CustomEvent<{ focused: boolean }>).detail.focused;
    });
    mounted.element.addEventListener("mc-input", (event) => {
      // Kept in the step so the field can be set again with what was typed; no redraw per key.
      const step = this.#step;
      if (step.kind === "receive" && step.phase === "typing")
        this.#step = { ...step, input: (event as CustomEvent<{ value: string }>).detail.value };
    });
    const unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    // Before the route: A, B or Start takes the caret out of the code field (the route is held while it has one).
    bindTextFieldEscape(
      this,
      () => {
        const field = this.#mounted?.element.codeField;
        return field ? { focused: field.isFocused, blur: () => field.blurInput() } : null;
      },
      () => this.scene.isActive(SCENES.syncData),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#typing || this.scene.isActive(SCENES.syncData),
      onCancel: () => this.#cancel(),
      // Start is "forward": Receive on the code step, Copy code / New code on the Send step.
      onPause: () => this.#primary?.(),
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    // The Sync row's status line follows the scheduler; a redraw only while this menu is what shows.
    let subscribed = false;
    const unsubscribe = syncService().status.subscribe(() => {
      // Not while the sync overlay is over this one: it shows the status itself, and a redraw here would be wasted.
      if (subscribed && this.sys.isActive() && this.#step.kind === "menu" && !this.scene.isActive(SCENES.syncData)) {
        this.#draw();
      }
    });
    subscribed = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      unbind();
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
      this.#clearTicker();
      this.#mounted = null;
    });
    this.#focusCode = this.#step.kind === "receive" && !this.sys.game.device.input.touch && this.#step.input === "";
    this.#draw(() => {
      if (data.row !== undefined) this.#route?.focusKey(`row:${data.row}`);
    });
    if (data.syncLink) this.#openSync(data.syncLink);
  }

  #heard(detail: SaveDataEventDetail): void {
    if (this.#motion.leaving) return;
    switch (detail.type) {
      case "back":
        // Nothing is pressed while a file is being written, uploaded or fetched.
        return this.#working ? undefined : this.#close();
      case "action":
        if (this.#working) return;
        return this.#act(detail.id);
      case "menu":
        return this.#set({ kind: "menu" }, NO_STATUS);
      case "replace":
        if (this.#step.kind === "confirm") void this.#replace(this.#step.file);
        return;
      case "copy":
        if (this.#step.kind === "send" && this.#step.phase.kind === "showing") this.#copy(this.#step.phase.code);
        return;
      case "new-code":
        return void this.#send();
      case "receive":
        return void this.#receive();
      case "status-export":
        return void this.#export();
    }
  }

  #act(id: SaveDataActionId): void {
    if (id === "export") void this.#export();
    else if (id === "import") void this.#import();
    else if (id === "send") void this.#send();
    else if (id === "receive") {
      this.#focusCode = !this.sys.game.device.input.touch;
      this.#set({ kind: "receive", phase: "typing", input: "" }, NO_STATUS);
    } else if (id === "sync") this.#openSync();
    else void this.#toggleGlobal();
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

  #clearTicker(): void {
    this.#ticker?.remove(false);
    this.#ticker = null;
  }

  /** The once-a-second tick: the countdown line, or a redraw into the expired state. */
  #tick(): void {
    const step = this.#step;
    if (step.kind !== "send" || step.phase.kind !== "showing") return;
    if (countdownOf(step.phase.expiresAt, Date.now()).expired) this.#status = NO_STATUS;
    this.#draw();
  }

  #stepInput(): { readonly input: SaveDataStepInput; readonly order: string[] } {
    this.#clearTicker();
    this.#primary = null;
    const composed = composeStep(this.#step, {
      cancelGlyph: hintGlyphOf(this.#glyphs.glyph("cancel", ["cancel"], "ink", 44)),
      short: this.scale.gameSize.height < 520,
      qr: this.#qr,
    });
    this.#qr = composed.qr;
    const step = this.#step;
    if (step.kind === "send" && step.phase.kind === "showing") {
      const phase = step.phase;
      const expired = countdownOf(phase.expiresAt, Date.now()).expired;
      if (!expired) this.#ticker = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.#tick() });
      this.#primary = expired ? () => void this.#send() : () => this.#copy(phase.code);
    } else if (step.kind === "receive" && step.phase === "typing") this.#primary = () => void this.#receive();
    return composed;
  }

  #draw(after?: () => void): void {
    const mounted = this.#mounted;
    if (this.#motion.leaving || !mounted) return;
    const { region, element } = mounted;
    const { width, height } = this.scale.gameSize;
    const stamp = ++this.#stamp;
    const form = formFactorFor(width, height);
    const phone = form === "phone" || form === "phoneLandscape";
    this.#glyphs.reset();
    const { input, order } = this.#stepInput();
    const status = statusInputOf(this.#status, this.#working);
    const backGlyph = this.#glyphs.glyph("back", ["cancel"], "ink", 44);
    this.#glyphs.settled();
    const model: SaveDataPageModel = {
      phone,
      bar: {
        title: t("settings.saveData.title"),
        backLabel: phone ? "◂" : "◂ " + t("guide.back"),
        backGlyph: this.#working ? null : hintGlyphOf(backGlyph),
      },
      step: input,
      status,
    };
    region.setRect({ x: 0, y: 0, width, height });
    element.model = model;
    this.#motion.enter(this, { scrim: [], panels: this.#anchor ? [this.#anchor] : [] });
    void renderDeep(element).then(() => {
      if (stamp !== this.#stamp || !this.#mounted) return;
      const stops = focusStopsOf(element, (target) => region.rectOf(target));
      const keys = ["back", ...order, ...(status?.exportLabel ? ["status-export"] : [])];
      this.#route?.set(
        keys.filter((key) => stops.has(key)),
        stops,
      );
      // The code field takes the caret on entering the Receive step, once.
      if (this.#focusCode && element.codeField) {
        this.#focusCode = false;
        element.codeField.focusInput();
      }
      after?.();
    });
  }
}
