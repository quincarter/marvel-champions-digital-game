/**
 * Settings ▸ Controls (`docs/controller-support.md` "Controls screen"): the controller drawn for the active family
 * with the button list beside it, and the keyboard's shortcuts. Read-only for now; the Remap buttons are drawn dashed
 * and disabled.
 *
 * Thin by rule: every number comes from `view/controls-layout.ts`, every word from `view/controls-rows.ts`, the
 * drawing from `dom/controller-sheet.ts`. Settings changes go through `appSession().settings`, the same set path
 * `scenes/settings.ts` uses.
 *
 * **A Lit panel over the canvas** (`mc-sheet`, `dom/popup-sheet.ts`, `dom/sheet-builder.ts`) at the rects the layout
 * gives: the ink panel with its header, the tab rail and the status line, and one scrolling body with the drawing (an
 * inline SVG whose labels are text), the settings rows (choice cells, switches, the Hint size slider), the shortcut
 * lists and the footer. Presses are the sheet's taps (press and release on the control, within the slop), the body
 * scrolls natively, and the scene keeps the focus route (ring in the panel layer, `dom/dom-ring.ts`), the press shield
 * and the entrance and exit motion.
 */
import Phaser from "phaser";
import { drawControllerSheet } from "../dom/controller-sheet.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { onInputDeviceChange, inputDevice } from "../platform/input-device.js";
import { appSession } from "../session.js";
import { ink, minType, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { notifyHintSettingsChanged } from "../ui/input-hints.js";
import { OverlayMotion } from "../ui/transitions.js";
import { glyphHeightFor, scaledGlyphHeight } from "../view/glyph-placement.js";
import { layoutGlyph, measureGlyphText } from "@mc/ui";
import { font } from "../tokens.js";
import { uiSpecOf } from "../view/glyph-ui-spec.js";
import { padGlyphSpec, type GlyphSpec } from "../view/input-glyph-model.js";
import {
  controllerCaptionOf,
  controllerStateOf,
  glyphSizeAtTrack,
  glyphSizeShare,
  hintSizeRowInfoOf,
  hintsToggleInfoOf,
  nextSettingsAfterHintSize,
  steppedGlyphSize,
  keyboardGroupsOf,
  nextSettingsAfterHints,
  nextSettingsAfterNintendo,
  nextSettingsAfterPadFamily,
  glyphSourceRowInfoOf,
  nextSettingsAfterGlyphSource,
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
  INPUT_TEST_HEIGHT,
  SLIDER_LINE_HEIGHT,
  controlsLayout,
  type ControlsGroupRowSpec,
  type ControlsListSectionSpec,
} from "../view/controls-layout.js";
import type { Rect } from "../view/layout.js";
import { detectPad } from "../view/pad-family.js";
import { padInputNow, padInputTestLine } from "../view/pad-input-test.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export const remapButtonsLabel = (): string => t("controls.remap.buttons");
export const remapKeysLabel = (): string => t("controls.remap.keys");

/** The tab Controls last showed, so it reopens where the player left it (the keyboard when no pad is in use). */
let lastTab: ControlsTab | null = null;

/** Launch data: `tab` opens on that tab (a Settings search result). */
export interface ControlsSceneData {
  readonly tab?: ControlsTab;
}

/** The scrolling body's key in the panel. */
const BODY = "controls-body";
const BODY_TYPE: TypeSpec = typeRole.body;
const BODY_MEASURE = (label: string, size: number): number =>
  measureGlyphText(label, size, `"${font.body}", sans-serif`);

/** The connected pad's `Gamepad.id`, or null when none is. */
function connectedPadId(): string | null {
  return connectedPad()?.id ?? null;
}

function connectedPad(): Gamepad | null {
  const pads = globalThis.navigator?.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}

export class ControlsOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #motion = new OverlayMotion();
  #tab: ControlsTab = "controller";
  /** What each key in the panel does when pressed, this draw. */
  #actions = new Map<string, () => void>();
  /** The input test line under the caption while a pad is connected, and the last input it has seen. */
  #inputSeen: string | null = null;
  #hasTestLine = false;
  #viewport: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #slideBound = false;

  constructor() {
    super(SCENES.controls);
  }

  create(data: ControlsSceneData = {}): void {
    // Phaser hands a later launch with no data this same object again: take the tab once.
    this.sys.settings.data = {};
    this.#motion = new OverlayMotion();
    this.input.enabled = true;
    this.#slideBound = false;
    this.#tab = data.tab ?? lastTab ?? (inputDevice().mode === "keyboard" ? "keyboard" : "controller");
    this.#inputSeen = null;
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.());
    // The input test reads the browser's own pad each frame while this screen is up, and redraws only on a new input.
    const pollInput = (): void => {
      if (!this.#hasTestLine) return;
      const pads = globalThis.navigator?.getGamepads?.() ?? [];
      const now = padInputNow(pads);
      if (now === null || now === this.#inputSeen) return;
      this.#inputSeen = now;
      this.#draw();
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, pollInput);
    const redraw = (): void => {
      if (this.sys.isActive()) this.#draw();
    };
    this.scale.on("resize", redraw, this);
    const offLanguage = onLanguageChange(redraw);
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
      ring: domFocusRing,
      onCancel: () => this.#close(),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * Math.max(120, this.#viewport.height - 60) }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      this.events.off(Phaser.Scenes.Events.UPDATE, pollInput);
      offLanguage();
      unsubscribe();
      window.removeEventListener("gamepadconnected", redraw);
      window.removeEventListener("gamepaddisconnected", redraw);
    });
    if (import.meta.env.DEV) {
      (window as unknown as { __mcControlsDebug?: unknown }).__mcControlsDebug = {
        // The slider's parts on screen now (null until drawn).
        hintSlider: () => {
          const element = this.#panel.element;
          const rectOf = (key: string): Rect | null => {
            const found = element?.elementOf(key);
            return found ? (this.#panel.rectOf(found) ?? null) : null;
          };
          const viewport = rectOf(BODY);
          const track = rectOf("hint-size:track");
          const down = rectOf("hint-size:down");
          const up = rectOf("hint-size:up");
          const percent = rectOf("hint-size:label");
          return viewport && track && down && up && percent ? { track, down, up, percent, viewport } : null;
        },
        revealHintSlider: () => this.#panel.element?.elementOf("hint-size")?.scrollIntoView({ block: "nearest" }),
      };
    }
    this.#draw();
  }

  #scroller(): HTMLElement | null {
    return this.#panel.element?.elementOf(BODY) ?? null;
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #setTab(tab: ControlsTab): void {
    if (tab === this.#tab) return;
    this.#tab = tab;
    lastTab = tab;
    this.#scroller()?.scrollTo({ top: 0 });
    this.#draw();
  }

  #set(next: ReturnType<typeof nextSettingsAfterHints>): void {
    appSession().settings = next;
    // The board behind this screen draws its hints from the settings: tell it (the hints toggle, the pad's look).
    notifyHintSettingsChanged();
    this.#draw();
  }

  /** A key's press. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  /** The Hint size row's new value (a tap or drag on the track, a step): saved and the hints on the board resized. */
  #setHintSize(value: number): void {
    const current = appSession().settings;
    if (current.glyphSize !== value) appSession().settings = nextSettingsAfterHintSize(current, value);
    notifyHintSettingsChanged();
    this.#draw();
  }

  #bindSlider(): void {
    const element = this.#panel.element;
    if (!element || this.#slideBound) return;
    this.#slideBound = true;
    element.addEventListener("mc-slide", (event) => {
      const { share } = (event as CustomEvent<{ share: number }>).detail;
      this.#setHintSize(glyphSizeAtTrack(share, { x: 0, width: 1 }));
    });
    element.addEventListener("mc-step", (event) => {
      const { direction } = (event as CustomEvent<{ direction: -1 | 1 }>).detail;
      this.#setHintSize(steppedGlyphSize(appSession().settings.glyphSize, direction));
    });
  }

  /** A stop inside the scrolling body: its box is read off the panel, so it follows the scroll. */
  #bodyStop(key: string, activate: () => void, adjust?: (direction: -1 | 1) => void): FocusStop {
    const panel = this.#panel;
    const viewport = (): Rect => {
      const body = panel.element?.elementOf(BODY);
      return (body && panel.rectOf(body)) || this.#viewport;
    };
    return {
      rect: () => {
        const found = panel.element?.elementOf(key);
        return (found && panel.rectOf(found)) || viewport();
      },
      view: viewport,
      activate,
      ensureVisible: () => panel.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
      ...(adjust ? { adjust } : {}),
    };
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    destroyChildren(this);
    this.#actions = new Map();

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
    const sourceRow = glyphSourceRowInfoOf(settings);
    const hintSize = hintSizeRowInfoOf(settings);
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
            { id: "source", kind: "segmented", detail: sourceRow.detail },
            { id: "hintSize", kind: "slider", detail: hintSize.detail },
          ]
        : [
            { id: "hand", kind: "segmented", detail: handRow.detail },
            { id: "hints", kind: "toggle", detail: hints.detail },
            { id: "source", kind: "segmented", detail: sourceRow.detail },
            { id: "hintSize", kind: "slider", detail: hintSize.detail },
          ];
    const sections: ControlsListSectionSpec[] =
      tab === "controller"
        ? [
            { id: "buttons", title: t("controls.section.buttons"), notes: padRows.map((row) => row.note) },
            ...layerSections.map((layer) => ({
              id: layer.id,
              title: layer.title,
              notes: layer.rows.map((row) => row.note),
            })),
          ]
        : keyGroups.map((group) => ({ id: group.id, title: group.title, notes: group.rows.map((row) => row.note) }));
    const caption = controllerCaptionOf(state.family, pad, state.swap);
    const testPad = tab === "controller" ? connectedPad() : null;
    this.#hasTestLine = testPad !== null;
    const layout = controlsLayout(
      { x: 0, y: 0, width, height },
      {
        tab,
        drawing: state.kind,
        caption,
        inputTest: testPad !== null,
        groupRows,
        sections,
        footerButtons: tab === "controller" ? 2 : 1,
      },
    );

    // Swallows presses that land on no control, so a touch scroll over blank space can't reach the screen behind.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();
    const b = this.#panel.begin(width, height);
    const { panel, header, viewport, content } = layout;
    this.#viewport = viewport;
    b.box(panel, { fill: surface.ink.hex, stroke: surface.paper.hex, strokeWidth: 4 });
    b.box(
      { x: header.x, y: header.y + header.height - 2, width: header.width, height: 2 },
      { fill: surface.paper.hex, fillAlpha: 0.4 },
    );
    b.text(header.x + 20, header.y + header.height / 2, t("settings.controls.title"), typeRole.barTitle, {
      size: 24,
      color: surface.paper.hex,
      origin: [0, 0.5],
    });

    const stops = new Map<string, FocusStop>();
    b.button({ key: "back", rect: layout.close, label: "✕", look: "secondary", type: typeRole.rowTitle });
    // A boxed ✕: the paper frame the secondary skin lacks on an ink bar.
    b.box(
      {
        x: layout.close.x + 1.5,
        y: layout.close.y + 1.5,
        width: layout.close.width - 3,
        height: layout.close.height - 3,
      },
      { stroke: surface.paper.hex, strokeWidth: 3 },
    );
    this.#press("back", () => this.#close());
    stops.set("back", { rect: layout.close, activate: () => this.#close() });

    // The tab rail: a recessed strip of equal cells, the active one an ink fill.
    b.box(layout.tabs, { fill: surface.parchment.hex, stroke: surface.ink.hex, strokeWidth: 2 });
    const tabIds: ControlsTab[] = ["controller", "keyboard"];
    const tabLabels = { controller: t("controls.tab.controller"), keyboard: t("controls.tab.keyboard") };
    const tabType = { ...typeRole.label, size: Math.max(minType.phoneLabel, typeRole.label.size) };
    tabIds.forEach((id, i) => {
      b.button({
        key: `tab:${id}`,
        rect: layout.tabCells[i]!,
        label: tabLabels[id],
        look: "rail",
        type: tabType,
        selected: id === tab,
      });
      this.#press(`tab:${id}`, () => this.#setTab(id));
      stops.set(`tab:${id}`, { rect: layout.tabCells[i]!, activate: () => this.#setTab(id) });
    });

    this.#drawStatus(b, layout.status, connectedId, pad);

    const order: string[] = ["back", "tab:controller", "tab:keyboard"];
    // The body's content space: `x` in the screen's, `y` from the top of the region (Phaser's `toScreen`).
    const at = (rect: Rect): Rect => ({ x: viewport.x + rect.x, y: rect.y, width: rect.width, height: rect.height });

    b.scroll(BODY, viewport, content.totalHeight, (inner) => {
      if (content.diagram && content.caption) {
        const diagram = at(content.diagram);
        const captionRect = at(content.caption);
        inner.box(diagram, { fill: surface.parchment.hex, stroke: surface.paper.hex, strokeWidth: 2 });
        drawControllerSheet(inner, diagram, state.kind, state.family);
        inner.text(captionRect.x, captionRect.y + 12, caption, BODY_TYPE, {
          size: 12,
          color: surface.paper.hex,
          alpha: 0.8,
          wrapWidth: captionRect.width,
        });
        // What the browser reports from the pad, straight from `navigator.getGamepads()`: a pad that is detected but
        // never moves the game shows here whether its presses reach the page at all.
        if (testPad) {
          inner.text(
            captionRect.x,
            captionRect.y + captionRect.height - INPUT_TEST_HEIGHT + 8,
            padInputTestLine(this.#inputSeen, testPad.mapping),
            typeRole.label,
            { size: 12, color: surface.paper.hex, alpha: ink.secondary },
          );
        }
      }

      // The settings rows sit straight on the ink, as Settings' own do.
      for (const row of content.groupRows) {
        const rowRect = at(row.row);
        const control = at(row.control);
        if (row.id === "labels") {
          this.#drawSegmented(inner, row, rowRect, control, labelsRow, stops, order, (value) =>
            this.#set(nextSettingsAfterPadFamily(appSession().settings, value)),
          );
        } else if (row.id === "source") {
          this.#drawSegmented(inner, row, rowRect, control, sourceRow, stops, order, (value) =>
            this.#set(nextSettingsAfterGlyphSource(appSession().settings, value)),
          );
        } else if (row.id === "hand") {
          this.#drawSegmented(inner, row, rowRect, control, handRow, stops, order, (value) =>
            this.#set(nextSettingsAfterKeyboardHand(appSession().settings, value)),
          );
        } else if (row.id === "hintSize") {
          this.#drawHintSize(inner, rowRect, control, hintSize, state, stops, order);
        } else {
          const info = row.id === "nintendo" ? nintendo : hints;
          const activate =
            row.id === "nintendo"
              ? (): void => this.#set(nextSettingsAfterNintendo(appSession().settings))
              : (): void => this.#set(nextSettingsAfterHints(appSession().settings));
          this.#drawToggle(inner, rowRect, control, info, stops, order, activate);
        }
      }

      // The list sections.
      content.sections.forEach((section, sectionIndex) => {
        const rows: readonly ControlsListRow[] =
          tab === "controller"
            ? sectionIndex === 0
              ? padRows
              : (layerSections[sectionIndex - 1]?.rows ?? [])
            : (keyGroups[sectionIndex]?.rows ?? []);
        const heading = at(section.heading);
        this.#drawHeading(inner, heading.x, heading.y, heading.width - 2, sections[sectionIndex]!.title);
        section.rows.forEach((rowRect, i) =>
          this.#drawListRow(inner, at(rowRect), section.textX - rowRect.x, rows[i]!),
        );
      });

      // Footer: the remap buttons, disabled until remapping lands.
      const footerLabels = tab === "controller" ? [remapButtonsLabel(), t("controls.reset")] : [remapKeysLabel()];
      content.footer.forEach((rect, i) => {
        inner.button({
          key: `footer:${i}`,
          rect: at(rect),
          label: footerLabels[i]!,
          look: "quiet",
          type: typeRole.label,
          disabled: t("controls.remap.reason"),
        });
      });
    });

    this.#panel.mount(b, width, height);
    this.#bindSlider();
    this.#route?.set(order, stops);
    this.#motion.enter(this, { scrim: [], panels: [anchor] });
    this.#panel.follow(anchor);
  }

  /** "● Xbox controller connected · <pad>" (heal-green dot) or "No controller connected" (hollow). */
  #drawStatus(
    b: SheetBuilder,
    rect: Rect,
    connectedId: string | null,
    pad: ReturnType<typeof inputDevice>["pad"],
  ): void {
    const status = padStatusOf(connectedId, pad);
    const maxWidth = Math.max(40, rect.width - 24);
    const size = Math.max(minType.phoneBody, 12);
    const text = b.text(
      rect.x + rect.width,
      rect.y + rect.height / 2,
      status.text,
      { ...typeRole.label, uppercase: false },
      {
        size,
        color: surface.paper.hex,
        alpha: ink.secondary,
        origin: [1, 0.5],
        fitWidth: maxWidth,
      },
    );
    const cx = rect.x + rect.width - text.width - 12;
    const cy = rect.y + rect.height / 2;
    const dot: Rect = { x: cx - 5, y: cy - 5, width: 10, height: 10 };
    if (status.connected) b.box(dot, { fill: signal.heal.hex, round: true });
    else b.box(dot, { stroke: surface.paper.hex, strokeWidth: 2, alpha: 0.6, round: true });
  }

  /** A section heading: its title with a rule filling the rest of the row (`widgets.ts#sectionHeader`). */
  #drawHeading(b: SheetBuilder, x: number, y: number, width: number, title: string): void {
    const spec = { ...typeRole.barTitle, uppercase: false };
    const heading = b.text(x, y, title, spec, { size: 19, color: surface.paper.hex, fitWidth: Math.max(10, width) });
    const ruleX = x + heading.width + 10;
    const ruleEnd = x + width;
    if (ruleX < ruleEnd)
      b.box(
        { x: ruleX, y: y + heading.height / 2 - 1.5, width: ruleEnd - ruleX, height: 3 },
        { fill: surface.paper.hex },
      );
  }

  #drawSegmented<V extends string>(
    b: SheetBuilder,
    row: { readonly id: string; readonly stacked: boolean },
    rowRect: Rect,
    control: Rect,
    info: SegmentedRowInfo<V>,
    stops: Map<string, FocusStop>,
    order: string[],
    choose: (value: V) => void,
  ): void {
    const alpha = info.dimmed ? 0.5 : 1;
    b.text(rowRect.x, rowRect.y + 2, info.title, typeRole.label, {
      size: 12,
      color: surface.paper.hex,
      alpha: ink.secondary * alpha,
      fitWidth: rowRect.width,
    });
    b.text(rowRect.x, rowRect.y + 20, info.detail, BODY_TYPE, {
      size: 10,
      color: surface.paper.hex,
      alpha: 0.8 * alpha,
      wrapWidth: row.stacked ? rowRect.width : rowRect.width - control.width - 16,
    });
    const cell = control.width / info.options.length;
    info.options.forEach((option, i) => {
      const rect: Rect = { x: control.x + i * cell, y: control.y, width: cell, height: control.height };
      const activate = (): void => choose(option.value);
      const selected = info.selected === option.value;
      const key = `row:${row.id}:${option.value}`;
      // Settings' own choice cell: the selected one a paper fill, the rest ink with a paper border.
      b.button({
        key,
        rect,
        label: option.value === "playstation" && cell < 100 ? "PS" : option.label,
        look: selected ? "secondary" : "onInk",
        type: typeRole.label,
        ...(info.dimmed ? { alpha } : {}),
      });
      this.#press(key, activate);
      stops.set(key, this.#bodyStop(key, activate));
      order.push(key);
    });
  }

  #drawToggle(
    b: SheetBuilder,
    rowRect: Rect,
    control: Rect,
    info: ReturnType<typeof nintendoToggleInfoOf>,
    stops: Map<string, FocusStop>,
    order: string[],
    activate: () => void,
  ): void {
    const locked = info.locked !== undefined;
    b.text(rowRect.x, rowRect.y + 2, info.title, typeRole.label, {
      size: 12,
      color: surface.paper.hex,
      alpha: ink.secondary,
      fitWidth: rowRect.width - 100,
    });
    b.text(rowRect.x, rowRect.y + 20, info.detail, BODY_TYPE, {
      size: 10,
      color: surface.paper.hex,
      alpha: locked ? 0.55 : 0.8,
      wrapWidth: rowRect.width - 100,
    });
    const id = `row:${info.id}`;
    // The whole row is the target, as it always was; its box is what the focus ring frames.
    if (!locked) {
      b.tap(id, rowRect);
      this.#press(id, activate);
    }
    b.button({
      key: `${id}:switch`,
      rect: control,
      label: locked ? info.locked!.chip : info.on ? t("settings.toggleOn") : t("settings.toggleOff"),
      look: info.on ? "secondary" : "quiet",
      type: typeRole.label,
      selected: info.on,
      framed: info.on && !locked,
      ...(locked ? { disabled: info.detail } : {}),
    });
    if (!locked) {
      this.#press(`${id}:switch`, activate);
      stops.set(id, this.#bodyStop(id, activate));
      order.push(id);
    }
  }

  /**
   * "Hint size": the words, then a line with a live preview (an A button and a Space cap at the size the hints draw now)
   * and the slider. The hints toggle off dims the row but leaves it adjustable.
   */
  #drawHintSize(
    b: SheetBuilder,
    rowRect: Rect,
    control: Rect,
    info: ReturnType<typeof hintSizeRowInfoOf>,
    state: ReturnType<typeof controllerStateOf>,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const alpha = info.dimmed ? 0.5 : 1;
    b.text(rowRect.x, rowRect.y + 2, info.title, typeRole.label, {
      size: 12,
      color: surface.paper.hex,
      alpha: ink.secondary * alpha,
      fitWidth: rowRect.width,
    });
    b.text(rowRect.x, rowRect.y + 20, info.detail, BODY_TYPE, {
      size: 10,
      color: surface.paper.hex,
      alpha: 0.8 * alpha,
      wrapWidth: rowRect.width,
    });
    // The preview: the same base height a button's hint has, scaled by the setting.
    const first = padGlyphSpec(0, state.family, state.swap);
    const specs: GlyphSpec[] = [...(first ? [first] : []), { kind: "key", label: "Space", name: "Space" }];
    const baseHeight = glyphHeightFor(40);
    const twoLines = control.height > SLIDER_LINE_HEIGHT * 1.5;
    const previewWidth = twoLines ? 0 : Math.min(180, Math.floor(control.width * 0.4));
    const lineHeight = twoLines ? control.height / 2 : control.height;
    const midY = control.y + lineHeight / 2;
    const glyphHeight = scaledGlyphHeight(baseHeight, info.percent);
    let x = control.x;
    for (const spec of specs) {
      const ui = uiSpecOf(spec);
      b.glyph({ x, y: midY, specs: [ui], height: glyphHeight, ground: "ink", openness: 1, still: true, alpha });
      x += layoutGlyph([ui], glyphHeight, BODY_MEASURE).fullWidth + 8;
    }
    const id = `row:${info.id}`;
    // The row's box is what the focus ring frames; the slider's parts are inside it.
    b.box(rowRect, { key: id });
    b.slider({
      key: "hint-size",
      rect: {
        x: control.x + previewWidth,
        y: control.y + control.height - lineHeight,
        width: control.width - previewWidth,
        height: lineHeight,
      },
      share: glyphSizeShare(info.percent),
      label: `${info.percent}%`,
      ground: "ink",
      ...(info.dimmed ? { dimmed: true } : {}),
      stepLabels: ["−", "+"],
    });
    stops.set(
      id,
      this.#bodyStop(
        id,
        () => undefined,
        (direction) => this.#setHintSize(steppedGlyphSize(appSession().settings.glyphSize, direction)),
      ),
    );
    order.push(id);
  }

  /** One list row: the glyph(s), the action, and where it applies. */
  #drawListRow(b: SheetBuilder, rect: Rect, glyphColumn: number, row: ControlsListRow): void {
    b.box(
      { x: rect.x, y: rect.y + rect.height - 1, width: rect.width, height: 1 },
      { fill: surface.paper.hex, fillAlpha: 0.25 },
    );
    if (row.glyphs.length > 0) {
      b.glyph({
        x: rect.x + 12,
        y: rect.y + rect.height / 2,
        specs: row.glyphs.map((spec) => uiSpecOf(spec)),
        height: 24,
        ground: "ink",
        openness: 1,
        still: true,
      });
    }
    const textX = rect.x + glyphColumn;
    b.text(textX, rect.y + 7, row.action, typeRole.rowTitle, {
      size: 12,
      color: surface.paper.hex,
      wrapWidth: rect.width - glyphColumn - 8,
    });
    b.text(textX, rect.y + 24, row.note, BODY_TYPE, {
      size: 10,
      color: surface.paper.hex,
      alpha: 0.75,
      wrapWidth: rect.width - glyphColumn - 8,
    });
  }
}
