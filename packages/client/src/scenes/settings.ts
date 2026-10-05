/**
 * Settings (docs/phase4-screen-gaps.md §3 "W4"; design canvases D13, P16, L07).
 *
 * **Composition (fidelity pass, 2026-09-17).** The canvases never draw Settings
 * as its own full screen — D13/P16/L07 show its rows inline, under a "TABLE"
 * heading, inside Pause (`scenes/pause.ts` now draws that same group directly).
 * This overlay is the *standalone* door to the identical rows for a caller with
 * no paused game to attach them to (Title, once W2 lands its entry) — same ink
 * title bar with a boxed ✕, same row shape (title, one-line detail, a toggle
 * on the right) as Pause's own "Table" column, both built from one shared,
 * tested row list (`view/settings-rows.ts`) so the wording can never drift
 * between the two places it's drawn.
 *
 * **Entry point.** `scene.launch(SCENES.settings)` from whatever scene wants it
 * — Pause still offers it too, alongside its own inline Table group, as a way to
 * reach the same rows full-screen. Title's own rewrite (W2, a parallel worktree)
 * should launch it the same way. `#back`/the ✕ always just `this.scene.stop()`s
 * this overlay, so it returns to whichever scene launched it without needing to
 * know or care which.
 *
 * Every setting here is a client-only presentation preference
 * (`settings.ts`'s own doc comment: "nothing here reaches the engine"), read
 * live off `appSession().settings` by whatever draws with it — this scene only
 * flips fields on that one shared object, it never re-implements what reading
 * them does.
 */
import Phaser from "phaser";
import { setTextResolution } from "../ui/theme.js";
import {
  guideRowInfoOf,
  guideRowDetailOf,
  nextGuidePrefsAfterRow,
  nextSettingsAfterToggle,
  settingsRowInfoOf,
  type GuideRowInfo,
  type SettingsRowInfo,
} from "../view/settings-rows.js";
import type { GuideLevel } from "../guide/guide-prefs.js";
import { ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, addRowTapZone, label, paintOnFrame } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { settingsLayout, type SettingsContentLayout } from "../view/settings-layout.js";
import { settingsFocusOrder } from "../view/screen-focus.js";
import { contentSlotHeights, type Rect } from "../view/layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { appSession } from "../session.js";
import { guidePrefs, onGuidePrefsChange, setGuidePrefs } from "../guide/guide-store.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { unlocks } from "../progression/progression.js";
import { unlocksSummaryOf } from "../view/unlocks-model.js";
import { SAVE_DATA_ROW_DETAIL, SAVE_DATA_ROW_TITLE } from "../view/save-data-model.js";

/** The Unlocks row's own id: a door to `scenes/unlocks.ts`, drawn after the Table toggles and only on this screen. */
const UNLOCKS_ROW = "unlocks";

/** The Save data row's own id: a door to `scenes/save-data.ts`, right after Unlocks. */
const SAVE_DATA_ROW = "save-data";

/** The Rules reference row: a door to `scenes/rules.ts`'s glossary, right after Save data (owner, 2026-10-01). */
const RULES_ROW = "rules";
const RULES_ROW_TITLE = "Rules reference";
const RULES_ROW_DETAIL = "Look up any keyword, rule or ruling, with the cards it applies to.";

type GuideNonLevelRow = Extract<GuideRowInfo, { kind: "action" | "toggle" }>;

function isGuideNonLevelRow(row: GuideRowInfo): row is GuideNonLevelRow {
  return row.kind !== "segmented";
}

export class SettingsOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** The whole body's own scroll region (docs/guided-mode.md §4 G2b) — Table, Unlocks and Guide all draw into it. */
  #bodyRegion: McScrollRegion | null = null;
  #bodyScroll = new VariableListScroll();

  constructor() {
    super(SCENES.settings);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.input.enabled = true;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.unlocks) || this.scene.isActive(SCENES.saveData),
      onCancel: () => this.#close(),
    });
    // Another scene (Pause's own inline Guide group) can change the same live prefs while this overlay is open
    // behind it — redraw so this one never shows a stale level/toggle.
    const unsubscribeGuide = onGuidePrefsChange(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      unsubscribeGuide();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#bodyRegion?.destroy();
      this.#bodyRegion = null;
    });
    this.#draw();
  }

  #openUnlocks(): void {
    if (this.scene.isActive(SCENES.unlocks)) return;
    // Unlocks' panel sits exactly over this one, so a tap on its blank space must not reach a toggle underneath.
    this.input.enabled = false;
    this.scene.launch(SCENES.unlocks);
    // Back from Unlocks: redraw so the summary line reads what was just changed.
    this.scene.get(SCENES.unlocks).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
      if (this.sys.isActive()) this.#draw();
    });
  }

  #openSaveData(): void {
    if (this.scene.isActive(SCENES.saveData)) return;
    this.input.enabled = false;
    this.scene.launch(SCENES.saveData);
    this.scene.get(SCENES.saveData).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
      if (this.sys.isActive()) this.#draw();
    });
  }

  #openRules(): void {
    if (this.scene.isActive(SCENES.rules)) return;
    this.input.enabled = false;
    this.scene.launch(SCENES.rules, { initialTab: "glossary" } satisfies RulesSceneData);
    // Rules is registered before Settings, so a plain launch renders it underneath this panel.
    this.scene.bringToTop(SCENES.rules);
    this.scene.get(SCENES.rules).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
    });
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  /**
   * "Play the tutorial" (guided mode G6c, `docs/guided-mode.md` §4): leaves whatever's running — Settings can be
   * reached standalone from Title (nothing else to stop) or launched over a live game from Pause — and opens the
   * "How to play" hub (`scenes/how-to-play.ts`), mirroring `scenes/pause.ts#saveAndQuit`'s own "fully leave
   * what's running" shape rather than a bare `scene.start`, which would only stop this overlay and leave
   * Board/Pause running invisibly underneath. Retargeted from How to win directly (G6b) to the hub once it landed
   * (G6c) — the hub's own lesson 1 row/"Continue learning" is what opens How to win now.
   */
  #openHowToPlay(): void {
    this.#motion.exit(this, () => {
      for (const overlay of [SCENES.pause, SCENES.rules, SCENES.choice, SCENES.inspect, SCENES.villainPhase]) {
        if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
      }
      if (this.scene.isActive(SCENES.board)) this.scene.stop(SCENES.board);
      this.scene.start(SCENES.howToPlay);
    });
  }

  #toggle(row: SettingsRowInfo): void {
    const { settings } = appSession();
    const next = nextSettingsAfterToggle(settings, row.id, globalThis.devicePixelRatio || 1);
    if (row.id === "sharper-text") setTextResolution(next.textResolution);
    if (row.id === "sound") appSession().music?.syncSettings(next);
    appSession().settings = next;
    this.#draw();
  }

  #draw(): void {
    // Already fading out for the ✕/Escape close — a redraw mid-fade (a toggle
    // fired just before it, a resize) would only flash new chrome under it.
    if (this.#motion.leaving) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#bodyRegion?.destroy();
    this.#bodyRegion = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const rows = settingsRowInfoOf(appSession().settings);
    const unlocksDetail = unlocksSummaryOf(unlocks());
    const guideRows = guideRowInfoOf(guidePrefs());
    const guideAfterLevel = guideRows.filter(isGuideNonLevelRow);
    const layout = settingsLayout(
      { x: 0, y: 0, width, height },
      [...rows.map((row) => row.unavailable ?? row.detail), unlocksDetail, SAVE_DATA_ROW_DETAIL, RULES_ROW_DETAIL],
      guideAfterLevel.map(guideRowDetailOf),
    );

    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    const panel = this.add.graphics();
    panel
      .fillStyle(surface.ink.hex, 1)
      .fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel
      .lineStyle(4, surface.paper.hex, 1)
      .strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    const rule = this.add.graphics();
    rule
      .fillStyle(surface.paper.hex, 0.4)
      .fillRect(layout.header.x, layout.header.y + layout.header.height - 2, layout.header.width, 2);

    const stops = new Map<string, FocusStop>();
    const closeSize = 32;
    const closeRect: Rect = {
      x: layout.header.x + layout.header.width - closeSize - 16,
      y: layout.header.y + (layout.header.height - closeSize) / 2,
      width: closeSize,
      height: closeSize,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("back", { rect: closeRect, activate: () => this.#close() });
    this.add
      .text(layout.header.x + 16, layout.header.y + layout.header.height / 2, caseOf(typeRole.barTitle, "Settings"), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "24px",
      })
      .setOrigin(0, 0.5);

    const guideStopIds = this.#drawBody(layout.bodyViewport, layout.content, rows, unlocksDetail, guideRows, stops);

    this.#route?.set(
      settingsFocusOrder([...rows.map((row) => row.id), UNLOCKS_ROW, SAVE_DATA_ROW, RULES_ROW, ...guideStopIds]),
      stops,
    );
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** Runs `draw`, then reparents everything it just added to the scene's top-level display list into `container` — the "eagerly draw, then move into the scrolled/masked layer" trick `McScrollRegion` relies on (its own doc comment), same as `scenes/table-setup.ts`'s own `#captureInto`. */
  #captureInto(container: Phaser.GameObjects.Container, draw: () => void): void {
    const before = this.children.list.length;
    draw();
    const added = this.children.list.slice(before);
    if (added.length > 0) container.add(added);
  }

  /** A stop inside the body scroll region: its rect tracks the current scroll offset, and taking focus scrolls it into view. */
  #bodyStop(rect: Rect, index: number, activate: () => void): FocusStop {
    return {
      rect: () => ({ ...rect, y: rect.y - this.#bodyScroll.offsetPx }),
      activate,
      ensureVisible: () => this.#bodyRegion?.scrollIntoView(index),
    };
  }

  #bodyClip = (): Rect | null => this.#bodyRegion?.rect ?? null;
  #bodySuppressClick = (): boolean => this.#bodyRegion?.isDragSuppressingClick ?? false;

  /**
   * The whole body — "Table" heading + its rows, the Unlocks row, then "Guide" heading, the "Guide level" segment
   * and one row per `guideAfterLevel` entry — all inside one scroll region (docs/guided-mode.md §4 G2b; see
   * `view/settings-layout.ts`'s own doc comment for why this is one region rather than a second, nested one for
   * the Guide group alone). Returns the Guide group's own stop ids, in focus order; the Table and Unlocks rows
   * register themselves under their existing `row:${id}` keys directly.
   */
  #drawBody(
    viewport: Rect,
    content: SettingsContentLayout,
    rows: readonly SettingsRowInfo[],
    unlocksDetail: string,
    guideRows: readonly GuideRowInfo[],
    stops: Map<string, FocusStop>,
  ): readonly string[] {
    const levelRow = guideRows.find((row) => row.kind === "segmented");
    const afterLevel = guideRows.filter(isGuideNonLevelRow);
    // `contentSlotHeights`, not a plain `.map(r => r.height)`: each row's own gap to the next has to count toward
    // the scroll region's own total, or its offset math drifts away from where these rows are actually drawn the
    // further down it scrolls (`view/layout.ts`'s own doc comment).
    const heights = contentSlotHeights([
      content.tableHeading,
      ...content.rows,
      content.guideHeading,
      content.guideLevelRow,
      ...content.guideRows,
    ]);
    this.#bodyRegion = new McScrollRegion(this, { rect: viewport, heights, scroll: this.#bodyScroll });
    const container = this.#bodyRegion.content;
    const toScreen = (contentRect: Rect): Rect => ({ ...contentRect, y: viewport.y + contentRect.y });

    this.#captureInto(container, () =>
      label(
        this,
        viewport.x,
        viewport.y + content.tableHeading.y,
        "Table",
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
      ),
    );
    rows.forEach((row, index) => {
      this.#captureInto(container, () => this.#drawRow(toScreen(content.rows[index]!), row, index + 1, stops));
    });
    const unlocksIndex = rows.length + 1;
    this.#captureInto(container, () =>
      this.#drawUnlocksRow(toScreen(content.rows[rows.length]!), unlocksDetail, unlocksIndex, stops),
    );

    const saveDataIndex = unlocksIndex + 1;
    this.#captureInto(container, () =>
      this.#drawSaveDataRow(toScreen(content.rows[rows.length + 1]!), saveDataIndex, stops),
    );

    const rulesIndex = saveDataIndex + 1;
    this.#captureInto(container, () =>
      this.#drawDoorRow(
        toScreen(content.rows[rows.length + 2]!),
        RULES_ROW,
        RULES_ROW_TITLE,
        RULES_ROW_DETAIL,
        rulesIndex,
        stops,
        () => this.#openRules(),
      ),
    );

    const guideHeadingIndex = rulesIndex + 1;
    this.#captureInto(container, () =>
      label(
        this,
        viewport.x,
        viewport.y + content.guideHeading.y + 2,
        "Guide",
        typeRole.label,
        surface.paper.hex,
        ink.secondary,
      ),
    );
    const stopIds: string[] = [];
    if (levelRow && levelRow.kind === "segmented") {
      this.#captureInto(container, () =>
        this.#drawGuideLevelRow(toScreen(content.guideLevelRow), levelRow, guideHeadingIndex + 1, stops),
      );
      stopIds.push(...levelRow.options.map((option) => `guide-level:${option.value}`));
    }
    afterLevel.forEach((row, index) => {
      this.#captureInto(container, () =>
        this.#drawGuideRow(toScreen(content.guideRows[index]!), row, guideHeadingIndex + 2 + index, stops),
      );
      stopIds.push(row.id);
    });
    return stopIds;
  }

  #drawGuideLevelRow(
    rect: Rect,
    row: Extract<GuideRowInfo, { kind: "segmented" }>,
    index: number,
    stops: Map<string, FocusStop>,
  ): void {
    const gap = 4;
    // `EDGE_INSET`: the rightmost cell's own border used to land exactly on this row's own right edge — which,
    // once this group draws inside a masked scroll region, is also the mask's own right edge, so the border's
    // last pixel or two got clipped away entirely (found in browser verification, 2026-09-26, at 390 and 1440
    // widths). A couple of spare pixels keeps every cell's own border inside the content width the mask allows.
    const EDGE_INSET = 2;
    const cellWidth = (rect.width - EDGE_INSET - gap * (row.options.length - 1)) / row.options.length;
    row.options.forEach((option, i) => {
      const cellRect: Rect = { x: rect.x + i * (cellWidth + gap), y: rect.y, width: cellWidth, height: rect.height };
      const selected = row.selected === option.value;
      const activate = (): void => this.#setGuideLevel(option.value);
      // The button lands first (its own "quiet" skin paints an opaque paper fill), so the cell's own fill/stroke/
      // text — added after — draw on top of it rather than being hidden under it (`McButton`'s own z-order).
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "",
          type: typeRole.label,
          rect: cellRect,
          onClick: activate,
          clip: this.#bodyClip,
          suppressClick: this.#bodySuppressClick,
        }),
      );
      // Selected reads as guide yellow (`signal.caution`, ink text) rather than ink-on-ink, which — against this
      // overlay's own dark ground — used to read as *less* "on" than the bright-paper unselected cells beside it
      // (found in browser verification, 2026-09-26: the selected cell looked unselected at a glance). Unselected
      // is ink fill with a paper border and paper text, the readable-on-dark pairing the rest of this sheet uses.
      const g = this.add.graphics();
      g.fillStyle(selected ? signal.caution.hex : surface.ink.hex, 1).fillRect(
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
      );
      g.lineStyle(2, selected ? signal.caution.hex : surface.paper.hex, 1).strokeRect(
        cellRect.x + 1,
        cellRect.y + 1,
        cellRect.width - 2,
        cellRect.height - 2,
      );
      this.add
        .text(
          cellRect.x + 10,
          cellRect.y + 8,
          option.label,
          textStyle(typeRole.rowTitle, selected ? surface.ink.hex : surface.paper.hex),
        )
        .setFontSize(12);
      this.add
        .text(
          cellRect.x + 10,
          cellRect.y + 26,
          option.detail,
          textStyle(typeRole.body, selected ? surface.ink.hex : surface.paper.hex, selected ? 0.85 : 0.7),
        )
        .setFontSize(9)
        .setWordWrapWidth(cellWidth - 16);
      stops.set(`row:guide-level:${option.value}`, this.#bodyStop(cellRect, index, activate));
    });
  }

  #drawGuideRow(rect: Rect, row: GuideNonLevelRow, index: number, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(
        rect.x,
        rect.y + 20,
        guideRowDetailOf(row),
        textStyle(typeRole.body, surface.paper.hex, row.kind === "action" && row.unavailable ? 0.55 : 0.8),
      )
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);

    const controlRect: Rect = {
      x: rect.x + rect.width - 84,
      y: rect.y + (rect.height - 32) / 2,
      width: 84,
      height: 32,
    };
    const activate = (): void => this.#activateGuideRow(row);
    const unavailable = row.kind === "action" ? row.unavailable : undefined;
    addRowTapZone(this, rect, {
      onClick: activate,
      enabled: unavailable === undefined,
      clip: this.#bodyClip,
      suppressClick: this.#bodySuppressClick,
    });
    this.#buttons.push(
      new McButton(this, {
        kind: row.kind === "toggle" && row.on ? "secondary" : "quiet",
        label: unavailable ? "—" : row.kind === "toggle" ? (row.on ? "ON" : "OFF") : "Open ▸",
        type: typeRole.label,
        rect: controlRect,
        enabled: unavailable === undefined,
        ...(unavailable ? { reason: unavailable } : {}),
        selected: row.kind === "toggle" && row.on,
        onClick: activate,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    if (row.kind === "toggle" && row.on) paintOnFrame(this, controlRect);
    stops.set(`row:${row.id}`, this.#bodyStop(rect, index, activate));
  }

  #setGuideLevel(level: GuideLevel): void {
    setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), "guide-level", level));
    this.#draw();
  }

  #activateGuideRow(row: GuideNonLevelRow): void {
    if (row.kind === "action") {
      // Both actions open the same "How to play" hub (`scenes/how-to-play.ts`) — "Play the tutorial" at THE
      // BASICS, "Aspect lessons" (G10c) at ASPECTS, same screen either way.
      if (row.id === "play-tutorial" || row.id === "aspect-lessons") this.#openHowToPlay();
      return;
    }
    setGuidePrefs(nextGuidePrefsAfterRow(guidePrefs(), row.id));
    this.#draw();
  }

  #drawUnlocksRow(rect: Rect, detail: string, index: number, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, "Unlocks", typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);
    const openRect: Rect = { x: rect.x + rect.width - 84, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const activate = (): void => this.#openUnlocks();
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Open ▸",
        type: typeRole.label,
        rect: openRect,
        onClick: activate,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    stops.set(`row:${UNLOCKS_ROW}`, this.#bodyStop(rect, index, activate));
  }

  #drawSaveDataRow(rect: Rect, index: number, stops: Map<string, FocusStop>): void {
    this.#drawDoorRow(rect, SAVE_DATA_ROW, SAVE_DATA_ROW_TITLE, SAVE_DATA_ROW_DETAIL, index, stops, () =>
      this.#openSaveData(),
    );
  }

  /** A title, a detail line and an "Open ▸" button that opens another screen — the Save data and Rules rows. */
  #drawDoorRow(
    rect: Rect,
    id: string,
    title: string,
    detail: string,
    index: number,
    stops: Map<string, FocusStop>,
    activate: () => void,
  ): void {
    label(this, rect.x, rect.y + 2, title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);
    const openRect: Rect = { x: rect.x + rect.width - 84, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Open ▸",
        type: typeRole.label,
        rect: openRect,
        onClick: activate,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    stops.set(`row:${id}`, this.#bodyStop(rect, index, activate));
  }

  #drawRow(rect: Rect, row: SettingsRowInfo, index: number, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(
        rect.x,
        rect.y + 20,
        row.unavailable ?? row.detail,
        textStyle(typeRole.body, surface.paper.hex, row.unavailable ? 0.55 : 0.8),
      )
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);

    const toggleRect: Rect = { x: rect.x + rect.width - 84, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const activate = (): void => this.#toggle(row);
    addRowTapZone(this, rect, {
      onClick: activate,
      enabled: row.unavailable === undefined,
      clip: this.#bodyClip,
      suppressClick: this.#bodySuppressClick,
    });
    this.#buttons.push(
      new McButton(this, {
        kind: row.on ? "secondary" : "quiet",
        label: row.unavailable ? "—" : row.on ? "ON" : "OFF",
        type: typeRole.label,
        rect: toggleRect,
        enabled: row.unavailable === undefined,
        ...(row.unavailable ? { reason: row.unavailable } : {}),
        selected: row.on,
        onClick: activate,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    if (row.on && row.unavailable === undefined) paintOnFrame(this, toggleRect);
    stops.set(`row:${row.id}`, this.#bodyStop(rect, index, activate));
  }
}
