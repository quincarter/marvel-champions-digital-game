/**
 * Settings ▸ Controls (`docs/controller-support.md` "Controls screen"): the controller drawn for the active family
 * with the button list beside it, and the keyboard's shortcuts. Read-only for now; the Remap buttons are drawn dashed
 * and disabled.
 *
 * Thin by rule: every number comes from `view/controls-layout.ts`, every word from `view/controls-rows.ts`, the
 * drawings from `ui/controller-drawing.ts`. Settings changes go through `appSession().settings`, the same set path
 * `scenes/settings.ts` uses. Presses are `McButton`s (press and release on the control); the only controls inside the
 * scroll region carry its `clip` and `suppressClick`.
 */
import Phaser from "phaser";
import { onInputDeviceChange, inputDevice } from "../platform/input-device.js";
import { appSession } from "../session.js";
import { ink, minType, signal, surface, typeRole } from "../tokens.js";
import { McInputGlyph } from "../ui/input-glyph.js";
import { drawController, ensureControllerImage } from "../ui/controller-drawing.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { OverlayMotion } from "../ui/transitions.js";
import { McButton, McTabs, addRowTapZone, fitText, paintOnFrame, label, sectionHeader } from "../ui/widgets.js";
import {
  controllerCaptionOf,
  controllerStateOf,
  hintsToggleInfoOf,
  keyboardGroupsOf,
  nextSettingsAfterHints,
  nextSettingsAfterNintendo,
  nextSettingsAfterPadFamily,
  nintendoToggleInfoOf,
  padFamilyRowInfoOf,
  keyboardHandRowInfoOf,
  nextSettingsAfterKeyboardHand,
  padLayerSectionsOf,
  padRowsOf,
  type SegmentedRowInfo,
  padStatusOf,
  type ControlsListRow,
  type ControlsTab,
} from "../view/controls-rows.js";
import {
  controlsLayout,
  type ControlsGroupRowLayout,
  type ControlsGroupRowSpec,
  type ControlsListSectionSpec,
} from "../view/controls-layout.js";
import type { Rect } from "../view/layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { detectPad } from "../view/pad-family.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export const REMAP_BUTTONS_LABEL = "Remap buttons · coming next";
export const REMAP_KEYS_LABEL = "Remap keys · coming next";

/** The tab Controls last showed, so it reopens where the player left it (the keyboard when no pad is in use). */
let lastTab: ControlsTab | null = null;

/** The connected pad's `Gamepad.id`, or null when none is. */
function connectedPadId(): string | null {
  const pads = globalThis.navigator?.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected) return pad.id;
  return null;
}

export class ControlsOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #route: FocusRoute | null = null;
  #region: McScrollRegion | null = null;
  #scroll = new VariableListScroll();
  #motion = new OverlayMotion();
  #tab: ControlsTab = "controller";

  constructor() {
    super(SCENES.controls);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.input.enabled = true;
    this.#scroll = new VariableListScroll();
    this.#tab = lastTab ?? (inputDevice().mode === "keyboard" ? "keyboard" : "controller");
    const redraw = (): void => {
      if (this.sys.isActive()) this.#draw();
    };
    this.scale.on("resize", redraw, this);
    // Only a change of input mode or pad redraws: the mouse flipping between moving and resting must not rebuild the
    // screen under a click in progress.
    let lastMode = inputDevice().mode;
    let lastPad = inputDevice().pad;
    const unsubscribe = onInputDeviceChange((state) => {
      if (state.mode === lastMode && state.pad === lastPad) return;
      lastMode = state.mode;
      lastPad = state.pad;
      redraw();
    });
    window.addEventListener("gamepadconnected", redraw);
    window.addEventListener("gamepaddisconnected", redraw);
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#close(),
      onScroll: (_dx, dy) => this.#region?.scrollByPx(dy),
      onPage: (direction) => this.#region?.scrollByPx(direction * (this.#region.rect.height - 60)),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      unsubscribe();
      window.removeEventListener("gamepadconnected", redraw);
      window.removeEventListener("gamepaddisconnected", redraw);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#tabs?.destroy();
      this.#tabs = null;
      this.#region?.destroy();
      this.#region = null;
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #setTab(tab: ControlsTab): void {
    if (tab === this.#tab) return;
    this.#tab = tab;
    lastTab = tab;
    this.#scroll = new VariableListScroll();
    this.#draw();
  }

  #set(next: ReturnType<typeof nextSettingsAfterHints>): void {
    appSession().settings = next;
    this.#draw();
  }

  #captureInto(container: Phaser.GameObjects.Container, draw: () => void): void {
    const before = this.children.list.length;
    draw();
    const added = this.children.list.slice(before);
    if (added.length > 0) container.add(added);
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#region?.destroy();
    this.#region = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const settings = appSession().settings;
    // One pad for the status line and the drawing: the last one used, else the first connected.
    const connectedId = connectedPadId();
    const pad = inputDevice().pad ?? (connectedId === null ? null : detectPad(connectedId));
    const state = controllerStateOf(settings, pad);
    const tab = this.#tab;
    const labelsRow = padFamilyRowInfoOf(settings);
    const nintendo = nintendoToggleInfoOf(settings, pad);
    const hints = hintsToggleInfoOf(settings);
    const padRows = padRowsOf(state.family, state.swap);
    const layerSections = padLayerSectionsOf(state.family, state.swap);
    const handRow = keyboardHandRowInfoOf(settings);
    const keyGroups = keyboardGroupsOf(settings.keyboardHand);

    const groupRows: ControlsGroupRowSpec[] =
      tab === "controller"
        ? [
            { id: "labels", kind: "segmented", detail: labelsRow.detail },
            { id: "nintendo", kind: "toggle", detail: nintendo.detail },
            { id: "hints", kind: "toggle", detail: hints.detail },
          ]
        : [
            { id: "hand", kind: "segmented", detail: handRow.detail },
            { id: "hints", kind: "toggle", detail: hints.detail },
          ];
    const sections: ControlsListSectionSpec[] =
      tab === "controller"
        ? [
            { id: "buttons", title: "BUTTONS", notes: padRows.map((row) => row.note) },
            ...layerSections.map((layer) => ({
              id: layer.id,
              title: layer.title,
              notes: layer.rows.map((row) => row.note),
            })),
          ]
        : keyGroups.map((group) => ({ id: group.id, title: group.title, notes: group.rows.map((row) => row.note) }));
    const caption = controllerCaptionOf(state.family, pad, state.swap);
    const layout = controlsLayout(
      { x: 0, y: 0, width, height },
      { tab, drawing: state.kind, caption, groupRows, sections, footerButtons: tab === "controller" ? 2 : 1 },
    );

    // Swallows presses that land on no control, so a touch scroll over blank space can't reach the screen behind.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const { panel, header } = layout;
    const frame = this.add.graphics();
    frame.fillStyle(surface.ink.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    frame.lineStyle(4, surface.paper.hex, 1).strokeRect(panel.x, panel.y, panel.width, panel.height);
    frame.fillStyle(surface.paper.hex, 0.4).fillRect(header.x, header.y + header.height - 2, header.width, 2);
    this.add
      .text(header.x + 20, header.y + header.height / 2, caseOf(typeRole.barTitle, "Controls"), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "24px",
      })
      .setOrigin(0, 0.5);

    const stops = new Map<string, FocusStop>();
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: layout.close,
        onClick: () => this.#close(),
      }),
    );
    // A boxed ✕: the paper frame the secondary skin lacks on an ink bar.
    this.add
      .graphics()
      .lineStyle(3, surface.paper.hex, 1)
      .strokeRect(layout.close.x + 1.5, layout.close.y + 1.5, layout.close.width - 3, layout.close.height - 3);
    stops.set("back", { rect: layout.close, activate: () => this.#close() });

    const tabIds: ControlsTab[] = ["controller", "keyboard"];
    this.#tabs = new McTabs(this, {
      rect: layout.tabs,
      tabs: [
        { id: "controller", label: "CONTROLLER" },
        { id: "keyboard", label: "KEYBOARD" },
      ],
      activeId: tab,
      onSelect: (id) => this.#setTab(id as ControlsTab),
    });
    tabIds.forEach((id, i) => stops.set(`tab:${id}`, { rect: layout.tabCells[i]!, activate: () => this.#setTab(id) }));

    this.#drawStatus(layout.status, connectedId, pad);

    const { viewport, content } = layout;
    this.#region = new McScrollRegion(this, {
      rect: viewport,
      heights: content.slotHeights,
      scroll: this.#scroll,
      clipInteractive: true,
    });
    const container = this.#region.content;
    const region = this.#region;
    const clip = (): Rect | null => region.rect;
    const suppress = (): boolean => region.isDragSuppressingClick;
    const toScreen = (rect: Rect): Rect => ({
      x: viewport.x + rect.x,
      y: viewport.y + rect.y,
      width: rect.width,
      height: rect.height,
    });
    const stopOf = (rect: Rect, slot: number, activate: () => void): FocusStop => ({
      rect: () => ({ ...toScreen(rect), y: viewport.y + rect.y - this.#scroll.offsetPx }),
      activate,
      ensureVisible: () => region.scrollIntoView(slot),
    });
    const order: string[] = ["back", "tab:controller", "tab:keyboard"];

    if (content.diagram && content.caption) {
      const diagram = toScreen(content.diagram);
      const captionRect = toScreen(content.caption);
      this.#captureInto(container, () => {
        const frameGfx = this.add.graphics();
        frameGfx.fillStyle(surface.parchment.hex, 1).fillRect(diagram.x, diagram.y, diagram.width, diagram.height);
        frameGfx.lineStyle(2, surface.paper.hex, 1).strokeRect(diagram.x, diagram.y, diagram.width, diagram.height);
        const picture = ensureControllerImage(this, state.kind, () => {
          if (this.sys.isActive()) this.#draw();
        });
        drawController(this, diagram, state.kind, state.family);
        if (picture === "failed") {
          this.add
            .text(
              diagram.x + diagram.width / 2,
              diagram.y + diagram.height / 2,
              "Picture didn't load",
              textStyle(typeRole.body, surface.paper.hex, 0.8),
            )
            .setFontSize(12)
            .setOrigin(0.5);
        }
        this.add
          .text(captionRect.x, captionRect.y + 12, caption, textStyle(typeRole.body, surface.paper.hex, 0.8))
          .setFontSize(12)
          .setWordWrapWidth(captionRect.width);
      });
    }

    // The settings rows sit straight on the ink, as Settings' own do.
    for (const row of content.groupRows) {
      const place = (rect: Rect): Rect => toScreen(rect);
      const rowRect = place(row.row);
      const control = place(row.control);
      this.#captureInto(container, () => {
        if (row.id === "labels") {
          this.#drawSegmented(row, rowRect, control, labelsRow, stops, order, stopOf, clip, suppress, (value) =>
            this.#set(nextSettingsAfterPadFamily(appSession().settings, value)),
          );
        } else if (row.id === "hand") {
          this.#drawSegmented(row, rowRect, control, handRow, stops, order, stopOf, clip, suppress, (value) =>
            this.#set(nextSettingsAfterKeyboardHand(appSession().settings, value)),
          );
        } else {
          const info = row.id === "nintendo" ? nintendo : hints;
          const activate =
            row.id === "nintendo"
              ? (): void => this.#set(nextSettingsAfterNintendo(appSession().settings))
              : (): void => this.#set(nextSettingsAfterHints(appSession().settings));
          this.#drawToggle(row, rowRect, control, info, stops, order, stopOf, clip, suppress, activate);
        }
      });
    }

    // The list sections.
    content.sections.forEach((section, sectionIndex) => {
      const rows: readonly ControlsListRow[] =
        tab === "controller"
          ? sectionIndex === 0
            ? padRows
            : (layerSections[sectionIndex - 1]?.rows ?? [])
          : (keyGroups[sectionIndex]?.rows ?? []);
      this.#captureInto(container, () => {
        const heading = toScreen(section.heading);
        sectionHeader(this, heading.x, heading.y, heading.width - 2, sections[sectionIndex]!.title, surface.paper.hex);
        section.rows.forEach((rowRect, i) => this.#drawListRow(toScreen(rowRect), section.textX - rowRect.x, rows[i]!));
      });
    });

    // Footer: the remap buttons, disabled until remapping lands.
    const footerLabels = tab === "controller" ? [REMAP_BUTTONS_LABEL, "Reset to defaults"] : [REMAP_KEYS_LABEL];
    this.#captureInto(container, () => {
      content.footer.forEach((rect, i) => {
        const r = toScreen(rect);
        this.#buttons.push(
          new McButton(this, {
            kind: "quiet",
            label: footerLabels[i]!,
            type: typeRole.label,
            rect: r,
            enabled: false,
            onClick: () => undefined,
            reason: "Remapping is coming in a later update.",
            clip,
            suppressClick: suppress,
          }),
        );
      });
    });
    region.syncInteractivity();
    this.#route?.set(order, stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** "● Xbox controller connected · <pad>" (heal-green dot) or "No controller connected" (hollow). */
  #drawStatus(rect: Rect, connectedId: string | null, pad: ReturnType<typeof inputDevice>["pad"]): void {
    const status = padStatusOf(connectedId, pad);
    const text = this.add
      .text(
        rect.x + rect.width,
        rect.y + rect.height / 2,
        status.text,
        textStyle(typeRole.label, surface.paper.hex, ink.secondary),
      )
      .setFontSize(Math.max(minType.phoneBody, 12))
      .setOrigin(1, 0.5);
    fitText(text, Math.max(40, rect.width - 24), 12);
    const g = this.add.graphics();
    const cx = text.x - text.width - 12;
    const cy = rect.y + rect.height / 2;
    if (status.connected) g.fillStyle(signal.heal.hex, 1).fillCircle(cx, cy, 5);
    else g.lineStyle(2, surface.paper.hex, 0.6).strokeCircle(cx, cy, 5);
  }

  #drawSegmented<V extends string>(
    row: ControlsGroupRowLayout,
    rowRect: Rect,
    control: Rect,
    info: SegmentedRowInfo<V>,
    stops: Map<string, FocusStop>,
    order: string[],
    stopOf: (rect: Rect, slot: number, activate: () => void) => FocusStop,
    clip: () => Rect | null,
    suppress: () => boolean,
    choose: (value: V) => void,
  ): void {
    label(this, rowRect.x, rowRect.y + 2, info.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rowRect.x, rowRect.y + 20, info.detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(row.stacked ? rowRect.width : rowRect.width - control.width - 16);
    const cell = control.width / info.options.length;
    info.options.forEach((option, i) => {
      const rect: Rect = { x: control.x + i * cell, y: control.y, width: cell, height: control.height };
      const activate = (): void => choose(option.value);
      const selected = info.selected === option.value;
      // Settings' own choice cell: an opaque quiet button, then the fill, border and caps label over it.
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect,
          onClick: activate,
          clip,
          suppressClick: suppress,
        }),
      );
      const gfx = this.add.graphics();
      gfx
        .fillStyle(selected ? surface.paper.hex : surface.ink.hex, 1)
        .fillRect(rect.x, rect.y, rect.width, rect.height);
      gfx.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
      const cellLabel = this.add
        .text(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          (option.value === "playstation" && cell < 100 ? "PS" : option.label).toUpperCase(),
          textStyle(typeRole.label, selected ? surface.ink.hex : surface.paper.hex),
        )
        .setFontSize(11)
        .setOrigin(0.5);
      fitText(cellLabel, rect.width - 8, 11);
      const id = `row:${row.id}:${option.value}`;
      const contentCell: Rect = {
        x: row.control.x + i * cell,
        y: row.control.y,
        width: cell,
        height: row.control.height,
      };
      stops.set(id, stopOf(contentCell, row.slot, activate));
      order.push(id);
    });
  }

  #drawToggle(
    row: ControlsGroupRowLayout,
    rowRect: Rect,
    control: Rect,
    info: ReturnType<typeof nintendoToggleInfoOf>,
    stops: Map<string, FocusStop>,
    order: string[],
    stopOf: (rect: Rect, slot: number, activate: () => void) => FocusStop,
    clip: () => Rect | null,
    suppress: () => boolean,
    activate: () => void,
  ): void {
    const locked = info.locked !== undefined;
    label(this, rowRect.x, rowRect.y + 2, info.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rowRect.x, rowRect.y + 20, info.detail, textStyle(typeRole.body, surface.paper.hex, locked ? 0.55 : 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rowRect.width - 100);
    addRowTapZone(this, rowRect, { onClick: activate, enabled: !locked, clip, suppressClick: suppress });
    this.#buttons.push(
      new McButton(this, {
        kind: info.on ? "secondary" : "quiet",
        label: locked ? info.locked!.chip : info.on ? "ON" : "OFF",
        type: typeRole.label,
        rect: control,
        enabled: !locked,
        ...(locked ? { reason: info.detail } : {}),
        selected: info.on,
        onClick: activate,
        clip,
        suppressClick: suppress,
      }),
    );
    if (info.on && !locked) paintOnFrame(this, control);
    if (!locked) {
      const id = `row:${info.id}`;
      stops.set(id, stopOf(row.row, row.slot, activate));
      order.push(id);
    }
  }

  /** One list row: the glyph(s), the action, and where it applies. */
  #drawListRow(rect: Rect, glyphColumn: number, row: ControlsListRow): void {
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 0.25).fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1);
    const glyph = new McInputGlyph(this, rect.x + 12, rect.y + rect.height / 2, row.glyphs, {
      height: 24,
      ground: "ink",
    });
    if (row.glyphs.length === 0) glyph.destroy();
    const textX = rect.x + glyphColumn;
    this.add
      .text(textX, rect.y + 7, row.action, textStyle(typeRole.rowTitle, surface.paper.hex))
      .setFontSize(12)
      .setWordWrapWidth(rect.width - glyphColumn - 8);
    this.add
      .text(textX, rect.y + 24, row.note, textStyle(typeRole.body, surface.paper.hex, 0.75))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - glyphColumn - 8);
  }
}
