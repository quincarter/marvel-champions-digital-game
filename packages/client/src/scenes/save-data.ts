/**
 * Settings ▸ Save data: export everything this device has saved (games, decks, campaigns, unlocks) to a file, or
 * import such a file back. Launched over Settings (`scenes/settings.ts`), the same ink-and-paper panel shape as
 * Unlocks; ✕ or Escape stops only this overlay.
 *
 * Importing replaces what's on the device, so a good file first lands on a confirm step inside this overlay
 * (wording from `view/save-data-model.ts`); only "Replace" writes anything, then reloads so every store re-reads
 * what it was just given. The I/O lives in `save-data/`; this scene only draws and calls it.
 */
import Phaser from "phaser";
import { hit, signal, statHue, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { deliverSaveFile, pickSaveFile } from "../save-data/file-transfer.js";
import { exportSaveData, importSaveData } from "../save-data/save-data.js";
import type { SaveFile } from "../save-data/save-file.js";
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
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const HEADER_HEIGHT = 60;
const buttonType = { ...typeRole.label, size: 13 };

export class SaveDataOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #step: SaveDataStep = { kind: "menu" };
  #status: SaveDataStatus = NO_STATUS;

  constructor() {
    super(SCENES.saveData);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#step = { kind: "menu" };
    this.#status = NO_STATUS;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#cancel() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  /** Escape: backs out of the confirm first, then closes; ignored while a file is being written. */
  #cancel(): void {
    if (this.#step.kind === "busy") return;
    if (this.#step.kind === "confirm") this.#set({ kind: "menu" }, NO_STATUS);
    else this.#close();
  }

  #set(step: SaveDataStep, status: SaveDataStatus): void {
    this.#step = step;
    this.#status = status;
    this.#draw();
  }

  async #export(): Promise<void> {
    if (this.#step.kind !== "menu") return;
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

  #draw(): void {
    if (this.#motion.leaving) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

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
    const busy = this.#step.kind === "busy";
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        enabled: !busy,
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
    let y = body.y + 16;

    if (this.#step.kind === "confirm") {
      y = this.#drawConfirm(this.#step.file, x, y, rowWidth, stops, order);
    } else {
      y = this.#drawAction(
        { x, y, width: rowWidth, height: 0 },
        "Export",
        "Save everything on this device to a file you can keep or move to another device.",
        "Export",
        () => void this.#export(),
        "export",
        stops,
        order,
        !busy,
      );
      y = this.#drawAction(
        { x, y: y + 16, width: rowWidth, height: 0 },
        "Import",
        "Load a save file made by Export. It replaces what's on this device, after you confirm.",
        "Import",
        () => void this.#import(),
        "import",
        stops,
        order,
        !busy,
      );
    }

    if (this.#status.tone !== "none" || busy) {
      const text = busy ? "Working…" : this.#status.text;
      const error = this.#status.tone === "error";
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
    const titleText = this.add.text(
      at.x,
      at.y,
      caseOf(typeRole.sectionHeader, title),
      textStyle(typeRole.sectionHeader, surface.paper.hex),
    );
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

  #drawConfirm(
    file: SaveFile,
    x: number,
    top: number,
    rowWidth: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const confirm = replaceConfirmOf(file);
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
      // Destructive: the attack red the board uses for damage, never the colour alone (the label says Replace).
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
