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
  cardHoverRowInfoOf,
  effectsVolumeRowInfoOf,
  gameVolumeRowInfoOf,
  musicVolumeRowInfoOf,
  nextSettingsAfterEffectsVolume,
  nextSettingsAfterMusicVolume,
  cardSizeRowInfoOf,
  displayModeRowInfoOf,
  nextSettingsAfterCardSize,
  nextSettingsAfterDisplayMode,
  nextSettingsAfterResolution,
  resolutionRowInfoOf,
  nextSettingsAfterCardHover,
  nextSettingsAfterTokenMotion,
  tokenMotionRowInfoOf,
  nextSettingsAfterToggle,
  nextSettingsAfterVillainRow,
  settingsRowInfoOf,
  earnedItemRowInfoOf,
  villainRowInfoOf,
  type GuideRowInfo,
  type SettingsRowInfo,
  type VillainRowId,
  type VillainRowsInfo,
} from "../view/settings-rows.js";
import { settingsTabsOf, type SettingsItemId, type SettingsTabId } from "../view/settings-sections.js";
import type { GuideLevel } from "../guide/guide-prefs.js";
import type {
  CardHoverScale,
  CardSize,
  FirstPlayerTokenMotion,
  Settings,
  VillainAutoAdvance,
  VillainBeatSpeed,
  FlipEncounterSpeed,
  Resolution,
} from "../settings.js";
import {
  applyDesktopWindow,
  desktopMonitor,
  HANDHELD_DISPLAY,
  hasDesktopWindow,
  onHandheldLinux,
  refreshDesktopMonitor,
  resolutionOptionsFor,
} from "../platform/desktop-window.js";
import {
  followsWindowsMixer,
  knownMixerVolume,
  onMixerChange,
  readMixerVolume,
  writeMixerVolume,
} from "../platform/app-volume.js";
import { ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, McTabs, addRowTapZone, fitText, label, paintOnFrame, sectionHeader } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import {
  settingsLayout,
  type SettingsContentLayout,
  type SettingsItemLayout,
  type SettingsItemSpec,
} from "../view/settings-layout.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { appSession } from "../session.js";
import { guidePrefs, onGuidePrefsChange, setGuidePrefs } from "../guide/guide-store.js";
import { canReadPowerSaving, onPowerSavingChange, powerSavingOn, powerSavingState } from "../platform/power-saving.js";
import { powerSavingRowOf } from "../view/power-saving-notice.js";
import { detectPlatform } from "../platform/platform.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { applyEarnedItems, earnedItems, unlocks } from "../progression/progression.js";
import { unlocksSummaryOf } from "../view/unlocks-model.js";
import { SAVE_DATA_ROW_DETAIL, SAVE_DATA_ROW_TITLE } from "../view/save-data-model.js";

/** The Unlocks row's own id: a door to `scenes/unlocks.ts`, drawn after the Table toggles and only on this screen. */
const UNLOCKS_ROW = "unlocks";

/** The Save data row's own id: a door to `scenes/save-data.ts`, right after Unlocks. */
const SAVE_DATA_ROW = "save-data";

/** The Rules reference row: a door to `scenes/rules.ts`'s glossary, right after Save data (owner, 2026-10-01). */
const RULES_ROW = "rules";
const RULES_ROW_TITLE = "Rules reference";
/** The Steam Deck row (SteamOS and Bazzite only): back to the display a Deck starts with. */
const STEAM_DECK_DETAIL =
  "Fullscreen at the screen's own resolution (1280 × 800 on the Deck), what this device starts with.";

const RULES_ROW_DETAIL = "Look up any keyword, rule or ruling, with the cards it applies to.";

type GuideNonLevelRow = Extract<GuideRowInfo, { kind: "action" | "toggle" }>;

/** The control widths of the rows that draw a segmented choice. */
const SPEED_CONTROL_WIDTH = 204;
const CARD_HOVER_CONTROL_WIDTH = 280;
const CARD_SIZE_CONTROL_WIDTH = 520;
/** Room for each mode's label with padding either side (the owner, 2026-10-16). */
const DISPLAY_MODE_CONTROL_WIDTH = 480;
/** Resolution is a dropdown and an Apply button: up to seventeen sizes is too many segments. */
const RESOLUTION_CONTROL_WIDTH = 320;
const APPLY_WIDTH = 88;
const LIST_ROW_HEIGHT = 36;
const LIST_VISIBLE_ROWS = 8;

/**
 * A toggle or door row's 84px control, right-aligned and centred on the row. Held 2px in from the row's right edge,
 * which is also the scroll region's mask edge, so the control's own border isn't clipped away.
 */
function controlRectOf(row: Rect): Rect {
  return { x: row.x + row.width - 86, y: row.y + (row.height - 32) / 2, width: 84, height: 32 };
}

/** What a segmented row draws: its title and detail, and the option it shows chosen. */
interface SegmentedInfo<V extends string> {
  readonly title: string;
  readonly detail: string;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly selected: V;
}

/** One row the body can draw: how `settingsLayout` sizes it, and how to draw it once placed (screen space). */
interface SettingsItem {
  readonly spec: SettingsItemSpec;
  readonly draw: (item: SettingsItemLayout, stops: Map<string, FocusStop>) => readonly string[];
}

/** The tab Settings last showed, so reopening it in the same session lands where the player left off. */
let lastTab: SettingsTabId = "gameplay";

/** The narrowest tab cell that still shows "Display" and "Sound" whole (#243). */
const SOUND_TAB_MIN_CELL = 64;

export class SettingsOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** The active tab's own scroll region (docs/guided-mode.md §4 G2b): its sections all draw into it. */
  #bodyRegion: McScrollRegion | null = null;
  #bodyScroll = new VariableListScroll();
  /** The Resolution the player picked in the dropdown, not yet applied; null when nothing is pending. */
  #pendingResolution: Resolution | null = null;
  #resolutionListOpen = false;
  #resolutionListScroll = new VariableListScroll();
  #listRegion: McScrollRegion | null = null;
  /** Where the Resolution field was last drawn (screen space) and what it lists, for the open list. */
  #resolutionField: Rect | null = null;
  #resolutionInfo: SegmentedInfo<Resolution> | null = null;

  constructor() {
    super(SCENES.settings);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.input.enabled = true;
    // In the desktop app a resize can also be a move to another monitor, whose sizes the Resolution row lists.
    const onResize = (): void => {
      this.#draw();
      if (hasDesktopWindow()) void refreshDesktopMonitor().then(() => this.#redrawIfOpen());
    };
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.unlocks) || this.scene.isActive(SCENES.saveData),
      onCancel: () => (this.#resolutionListOpen ? this.#closeResolutionList() : this.#close()),
    });
    // Another scene (Pause's own inline Guide group) can change the same live prefs while this overlay is open
    // behind it — redraw so this one never shows a stale level/toggle.
    const unsubscribeGuide = onGuidePrefsChange(() => this.#draw());
    // Power saving mode turning on or off changes the Reduced motion and Sharper text rows.
    const unsubscribePowerSaving = onPowerSavingChange(() => this.#redrawIfOpen());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      unsubscribeGuide();
      unsubscribePowerSaving();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#tabs?.destroy();
      this.#tabs = null;
      this.#bodyRegion?.destroy();
      this.#bodyRegion = null;
    });
    this.#draw();
    if (hasDesktopWindow()) void refreshDesktopMonitor().then(() => this.#redrawIfOpen());
    // The game's volume in the Windows mixer may have moved there since: read it fresh for the Game volume row.
    if (followsWindowsMixer()) {
      // Read it now, then follow the shell's change events, so a change in the Windows mixer shows on the Game volume
      // row while Settings is open. Nothing polls here.
      let last = knownMixerVolume();
      const show = (read: number | null): void => {
        if (read === last) return;
        last = read;
        this.#redrawIfOpen();
      };
      void readMixerVolume().then(show);
      const stop = onMixerChange(({ volume }) => show(volume));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    }
  }

  #redrawIfOpen(): void {
    if (this.sys.isActive()) this.#draw();
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
      this.scene.start(SCENES.howToPlay, {});
    });
  }

  #toggle(row: SettingsRowInfo): void {
    const { settings } = appSession();
    const next = nextSettingsAfterToggle(settings, row.id, globalThis.devicePixelRatio || 1);
    if (row.id === "sharper-text") setTextResolution(next.textResolution);
    if (row.id === "sound" || row.id === "music-shuffle") appSession().music?.syncSettings(next);
    appSession().settings = next;
    applyEarnedItems();
    this.#draw();
  }

  /** Shows another tab, from its top. */
  #setTab(id: SettingsTabId): void {
    if (id === lastTab) return;
    lastTab = id;
    this.#bodyScroll = new VariableListScroll();
    this.#draw();
  }

  #draw(): void {
    // Already fading out for the ✕/Escape close — a redraw mid-fade (a toggle
    // fired just before it, a resize) would only flash new chrome under it.
    if (this.#motion.leaving) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#bodyRegion?.destroy();
    this.#bodyRegion = null;
    this.#listRegion?.destroy();
    this.#listRegion = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const settings = appSession().settings;
    const guideRows = guideRowInfoOf(guidePrefs());
    const items = this.#itemsOf(settings, guideRows);
    const tabs = settingsTabsOf({
      guideRowIds: guideRows.map((row) => row.id),
      cardHover: formFactorFor(width, height) === "desktop",
      gameVolume: followsWindowsMixer(),
      // Sound's own tab only where six fit with their names whole; a phone keeps five, Sound under Display.
      soundTab: settingsLayout({ x: 0, y: 0, width, height }, []).tabs.width / 6 >= SOUND_TAB_MIN_CELL,
      desktopWindow: hasDesktopWindow(),
      steamDeck: onHandheldLinux(),
      powerSaving:
        canReadPowerSaving(detectPlatform(), globalThis.navigator?.userAgent ?? "") || powerSavingState().detected,
    });
    const active = tabs.find((tab) => tab.id === lastTab) ?? tabs[0]!;
    const layout = settingsLayout(
      { x: 0, y: 0, width, height },
      active.sections.map((section) => ({
        id: section.id,
        // A tab's only section is already named by the tab itself.
        title: active.sections.length > 1 ? section.title : "",
        items: section.items.flatMap((id) => {
          const item = items.get(id);
          return item ? [item.spec] : [];
        }),
      })),
    );

    // Swallows every press that lands on no control of this overlay's own. Without it, lifting a finger after a
    // touch scroll over the panel's blank space reached Title underneath and opened its releases link (owner,
    // 2026-10-16), and the same went for Pause or the Board.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
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

    this.#tabs = new McTabs(this, {
      rect: layout.tabs,
      tabs: tabs.map((tab) => ({ id: tab.id, label: tab.label })),
      activeId: active.id,
      onSelect: (id) => this.#setTab(id as SettingsTabId),
    });
    const cellWidth = layout.tabs.width / tabs.length;
    tabs.forEach((tab, index) => {
      stops.set(`tab:${tab.id}`, {
        rect: { x: layout.tabs.x + index * cellWidth, y: layout.tabs.y, width: cellWidth, height: layout.tabs.height },
        activate: () => this.#setTab(tab.id),
      });
    });

    const stopIds = this.#drawBody(layout.bodyViewport, layout.content, items, stops);
    if (this.#resolutionListOpen) this.#drawResolutionList({ x: 0, y: 0, width, height });
    this.#route?.set(["back", ...tabs.map((tab) => `tab:${tab.id}`), ...stopIds.map((id) => `row:${id}`)], stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /**
   * Every row this screen can draw, keyed by its id in `view/settings-sections.ts`: the shape `settingsLayout` sizes
   * it by, and how to draw it once placed. Each `draw` registers its own focus stops and returns their ids in order.
   */
  #itemsOf(settings: Settings, guideRows: readonly GuideRowInfo[]): ReadonlyMap<SettingsItemId, SettingsItem> {
    const items = new Map<SettingsItemId, SettingsItem>();
    for (const row of [
      ...settingsRowInfoOf(settings, powerSavingOn()),
      ...earnedItemRowInfoOf(settings, earnedItems()),
    ]) {
      items.set(row.id, {
        spec: { kind: "toggle", id: row.id, detail: row.unavailable ?? row.detail },
        draw: (item, stops) => {
          this.#drawRow(item.row, row, item.slot, stops);
          return [row.id];
        },
      });
    }

    const segmented = <V extends string>(
      id: SettingsItemId,
      info: SegmentedInfo<V>,
      controlWidth: number,
      choose: (value: V) => void,
    ): void => {
      items.set(id, {
        spec: { kind: "segmented", id, detail: info.detail, controlWidth },
        draw: (item, stops) => {
          this.#drawSegmentedRow(item, info, id, stops, choose);
          return info.options.map((o) => `${id}:${o.value}`);
        },
      });
    };
    segmented("card-hover", cardHoverRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) => this.#setCardHover(v));
    // The game's mixer volume shows once read (`create` reads it); 100 until then, the mixer's own default.
    segmented("game-volume", gameVolumeRowInfoOf(knownMixerVolume() ?? 100), CARD_HOVER_CONTROL_WIDTH, (v) => {
      writeMixerVolume(Number(v));
      this.#draw();
    });
    const setVolume = (next: Settings): void => {
      appSession().music?.syncSettings(next);
      appSession().settings = next;
      this.#draw();
    };
    segmented("music-volume", musicVolumeRowInfoOf(settings, followsWindowsMixer()), CARD_HOVER_CONTROL_WIDTH, (v) =>
      setVolume(nextSettingsAfterMusicVolume(appSession().settings, v)),
    );
    segmented("effects-volume", effectsVolumeRowInfoOf(settings), CARD_HOVER_CONTROL_WIDTH, (v) => {
      setVolume(nextSettingsAfterEffectsVolume(appSession().settings, v));
      // A sample at the new level.
      appSession().music?.playEffect("basic-attack");
    });
    segmented("card-size", cardSizeRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => this.#setCardSize(v));
    segmented("token-motion", tokenMotionRowInfoOf(settings), CARD_SIZE_CONTROL_WIDTH, (v) => this.#setTokenMotion(v));
    if (hasDesktopWindow()) {
      const monitor = desktopMonitor();
      const sizes = monitor === null ? [] : resolutionOptionsFor(monitor, settings.displayMode);
      segmented("display-mode", displayModeRowInfoOf(settings), DISPLAY_MODE_CONTROL_WIDTH, (v) => {
        this.#pendingResolution = null;
        this.#setWindow(nextSettingsAfterDisplayMode(appSession().settings, v));
      });
      const sizeInfo = resolutionRowInfoOf(settings, sizes, monitor, monitor?.displayModes !== undefined);
      items.set("resolution", {
        spec: {
          kind: "segmented",
          id: "resolution",
          detail: sizeInfo.detail,
          controlWidth: RESOLUTION_CONTROL_WIDTH,
        },
        draw: (item, stops) => {
          this.#drawResolutionRow(item, sizeInfo, stops);
          return ["resolution:field", "resolution:apply"];
        },
      });
    }

    const villain = villainRowInfoOf(settings);
    items.set("villain-auto", {
      spec: {
        kind: "tiles",
        id: "villain-auto",
        detail: villain.autoAdvance.detail,
        count: villain.autoAdvance.options.length,
      },
      draw: (item, stops) => {
        this.#drawVillainAuto(item, villain, stops);
        return villain.autoAdvance.options.map((o) => `villain-auto:${o.value}`);
      },
    });
    segmented("villain-flip-speed", villain.flipSpeed, SPEED_CONTROL_WIDTH, (v) =>
      this.#setVillain("villain-flip-speed", v),
    );
    segmented("villain-speed", villain.beatSpeed, SPEED_CONTROL_WIDTH, (v) => this.#setVillain("villain-speed", v));
    for (const [id, row] of [
      ["villain-hold", villain.hold],
      ["villain-flip", villain.flip],
      ["villain-dock", villain.dock],
      ["power-saving", powerSavingRowOf(settings, powerSavingState().detected)],
    ] as const) {
      items.set(id, {
        spec: { kind: "toggle", id, detail: row.detail },
        draw: (item, stops) => {
          this.#drawVillainToggle(item.row, id, row, item.slot, stops);
          return [id];
        },
      });
    }

    for (const row of guideRows) {
      if (row.kind === "segmented") {
        items.set(row.id, {
          spec: { kind: "level", id: row.id },
          draw: (item, stops) => {
            this.#drawGuideLevelRow(item.row, row, item.slot, stops);
            return row.options.map((option) => `guide-level:${option.value}`);
          },
        });
      } else {
        items.set(row.id, {
          spec: { kind: "toggle", id: row.id, detail: guideRowDetailOf(row) },
          draw: (item, stops) => {
            this.#drawGuideRow(item.row, row, item.slot, stops);
            return [row.id];
          },
        });
      }
    }

    const door = (id: SettingsItemId, title: string, detail: string, open: () => void): void => {
      items.set(id, {
        spec: { kind: "toggle", id, detail },
        draw: (item, stops) => {
          this.#drawDoorRow(item.row, id, title, detail, item.slot, stops, open);
          return [id];
        },
      });
    };
    door(UNLOCKS_ROW, "Unlocks", unlocksSummaryOf(unlocks()), () => this.#openUnlocks());
    door(SAVE_DATA_ROW, SAVE_DATA_ROW_TITLE, SAVE_DATA_ROW_DETAIL, () => this.#openSaveData());
    door(RULES_ROW, RULES_ROW_TITLE, RULES_ROW_DETAIL, () => this.#openRules());
    items.set("steam-deck", {
      spec: { kind: "toggle", id: "steam-deck", detail: STEAM_DECK_DETAIL },
      draw: (item, stops) => {
        const use = (): void => {
          this.#pendingResolution = null;
          this.#setWindow({ ...appSession().settings, ...HANDHELD_DISPLAY });
        };
        this.#drawDoorRow(item.row, "steam-deck", "Steam Deck", STEAM_DECK_DETAIL, item.slot, stops, use, "Use");
        return ["steam-deck"];
      },
    });
    return items;
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
   * The whole body — every section's heading and rows (`view/settings-sections.ts`) — inside one scroll region
   * (docs/guided-mode.md §4 G2b; `view/settings-layout.ts`'s own doc comment says why it's one region). Returns every
   * focus stop id in draw order.
   */
  #drawBody(
    viewport: Rect,
    content: SettingsContentLayout,
    items: ReadonlyMap<SettingsItemId, SettingsItem>,
    stops: Map<string, FocusStop>,
  ): readonly string[] {
    // `clipInteractive`: a mask hides pixels, not hit areas, so a row scrolled up under the title bar would still
    // win the press on the ✕ above it (its own `clip` then drops the click, so nothing happened at all).
    this.#bodyRegion = new McScrollRegion(this, {
      rect: viewport,
      heights: content.slotHeights,
      scroll: this.#bodyScroll,
      clipInteractive: true,
      // The open Resolution list scrolls on its own.
      enabled: () => !this.#resolutionListOpen,
    });
    const container = this.#bodyRegion.content;
    const toScreen = (rect: Rect): Rect => ({ ...rect, y: viewport.y + rect.y });

    const stopIds: string[] = [];
    for (const section of content.sections) {
      const heading = section.heading;
      if (heading) {
        this.#captureInto(container, () =>
          sectionHeader(this, viewport.x, viewport.y + heading.y, viewport.width - 2, section.title, surface.paper.hex),
        );
      }
      for (const item of section.items) {
        const entry = items.get(item.id as SettingsItemId);
        if (!entry) continue;
        const onScreen: SettingsItemLayout = {
          ...item,
          row: toScreen(item.row),
          control: item.control ? toScreen(item.control) : null,
          tiles: item.tiles.map(toScreen),
        };
        this.#captureInto(container, () => stopIds.push(...entry.draw(onScreen, stops)));
      }
    }
    this.#bodyRegion?.syncInteractivity();
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

  /** "Lighter play in power saving": the session tells `platform/power-saving.ts`, and this redraws from its change. */
  #togglePowerSaving(): void {
    const settings = appSession().settings;
    appSession().settings = { ...settings, powerSavingAdjust: !settings.powerSavingAdjust };
    this.#draw();
  }

  #setVillain(id: VillainRowId, value?: VillainAutoAdvance | VillainBeatSpeed | FlipEncounterSpeed): void {
    appSession().settings = nextSettingsAfterVillainRow(appSession().settings, id, value);
    this.#draw();
  }

  /** One selectable tile/segment: the button first (its quiet skin is opaque paper), then fill, border and text over it. Selected is filled accent (tile) or paper (segment) with ink text, never colour alone: the border weight and fill both change. */
  #drawChoiceCell(
    cell: Rect,
    selected: boolean,
    index: number,
    stopId: string,
    stops: Map<string, FocusStop>,
    activate: () => void,
    texts: { readonly label: string; readonly detail?: string; readonly fill: number },
  ): void {
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "",
        type: typeRole.label,
        rect: cell,
        onClick: activate,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    const g = this.add.graphics();
    g.fillStyle(selected ? texts.fill : surface.ink.hex, 1).fillRect(cell.x, cell.y, cell.width, cell.height);
    g.lineStyle(2, selected ? texts.fill : surface.paper.hex, 1).strokeRect(
      cell.x + 1,
      cell.y + 1,
      cell.width - 2,
      cell.height - 2,
    );
    const ink_ = selected ? surface.ink.hex : surface.paper.hex;
    if (texts.detail === undefined) {
      const cellLabel = this.add
        .text(
          cell.x + cell.width / 2,
          cell.y + cell.height / 2,
          texts.label.toUpperCase(),
          textStyle(typeRole.label, ink_),
        )
        .setFontSize(11)
        .setOrigin(0.5);
      // A long label ("Extra large") on a narrow phone segment shrinks to fit rather than running past its cell.
      fitText(cellLabel, cell.width - 8, 11);
    } else {
      this.add.text(cell.x + 10, cell.y + 8, texts.label, textStyle(typeRole.rowTitle, ink_)).setFontSize(12);
      this.add
        .text(cell.x + 10, cell.y + 26, texts.detail, textStyle(typeRole.body, ink_, selected ? 0.85 : 0.7))
        .setFontSize(9)
        .setWordWrapWidth(cell.width - 16);
    }
    stops.set(`row:${stopId}`, this.#bodyStop(cell, index, activate));
  }

  #drawVillainAuto(item: SettingsItemLayout, villain: VillainRowsInfo, stops: Map<string, FocusStop>): void {
    const { autoAdvance } = villain;
    const rect = item.row;
    label(this, rect.x, rect.y + 2, autoAdvance.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(
      12,
    );
    this.add
      .text(rect.x, rect.y + 20, autoAdvance.detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width);
    autoAdvance.options.forEach((option, i) => {
      this.#drawChoiceCell(
        item.tiles[i]!,
        autoAdvance.selected === option.value,
        item.slot,
        `villain-auto:${option.value}`,
        stops,
        () => this.#setVillain("villain-auto", option.value),
        { label: option.label, detail: option.detail, fill: signal.caution.hex },
      );
    });
  }

  #setCardHover(value: CardHoverScale): void {
    appSession().settings = nextSettingsAfterCardHover(appSession().settings, value);
    this.#draw();
  }

  #setCardSize(value: CardSize): void {
    appSession().settings = nextSettingsAfterCardSize(appSession().settings, value);
    this.#draw();
  }

  /** A row with a title, its detail, and one segmented choice beside or (stacked) under the text. */
  #drawSegmentedRow<V extends string>(
    item: SettingsItemLayout,
    info: SegmentedInfo<V>,
    stopPrefix: string,
    stops: Map<string, FocusStop>,
    choose: (value: V) => void,
  ): void {
    const rect = item.row;
    const control = item.control!;
    label(this, rect.x, rect.y + 2, info.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, info.detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(item.stacked ? rect.width : rect.width - control.width - 16);
    const cellWidth = control.width / info.options.length;
    info.options.forEach((option, i) => {
      this.#drawChoiceCell(
        { x: control.x + i * cellWidth, y: control.y, width: cellWidth, height: control.height },
        info.selected === option.value,
        item.slot,
        `${stopPrefix}:${option.value}`,
        stops,
        () => choose(option.value),
        { label: option.label, fill: surface.paper.hex },
      );
    });
  }

  /** Saves a Window mode or size change and puts the window into it; redraws again once it lands (a new monitor). */
  #setWindow(next: Settings): void {
    appSession().settings = next;
    this.#draw();
    void applyDesktopWindow(next.displayMode, next.resolution).then(() => this.#redrawIfOpen());
  }

  /**
   * The Resolution row: a dropdown field showing the resolution picked (pending, until applied) and an Apply button
   * that is live only while the pick differs from what is in effect. The open list draws over everything
   * (`#drawResolutionList`), from the field's own position on screen.
   */
  #drawResolutionRow(item: SettingsItemLayout, info: SegmentedInfo<Resolution>, stops: Map<string, FocusStop>): void {
    const rect = item.row;
    const control = item.control!;
    label(this, rect.x, rect.y + 2, info.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, info.detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(item.stacked ? rect.width : rect.width - control.width - 16);
    const picked = this.#pendingResolution ?? info.selected;
    const field: Rect = { x: control.x, y: control.y, width: control.width - APPLY_WIDTH - 8, height: control.height };
    const apply: Rect = { x: field.x + field.width + 8, y: control.y, width: APPLY_WIDTH, height: control.height };
    // Where the field is on screen right now, for the list: content space less the body's scroll.
    this.#resolutionField = { ...field, y: field.y - this.#bodyScroll.offsetPx };
    this.#resolutionInfo = info;
    const open = (): void => {
      this.#resolutionListOpen = true;
      this.#resolutionListScroll = new VariableListScroll();
      this.#draw();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "",
        type: typeRole.label,
        rect: field,
        onClick: open,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(field.x, field.y, field.width, field.height);
    const value = this.add
      .text(
        field.x + 12,
        field.y + field.height / 2,
        info.options.find((option) => option.value === picked)?.label ?? "",
        textStyle(typeRole.label, surface.ink.hex),
      )
      .setFontSize(12)
      .setOrigin(0, 0.5);
    fitText(value, field.width - 40, 12);
    this.add
      .text(field.x + field.width - 12, field.y + field.height / 2, "▼", textStyle(typeRole.label, surface.ink.hex))
      .setFontSize(10)
      .setOrigin(1, 0.5);
    stops.set("row:resolution:field", this.#bodyStop(field, item.slot, open));

    const pending = this.#pendingResolution !== null && this.#pendingResolution !== info.selected;
    const activateApply = (): void => {
      if (this.#pendingResolution === null) return;
      const next = nextSettingsAfterResolution(appSession().settings, this.#pendingResolution);
      this.#pendingResolution = null;
      this.#setWindow(next);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: pending ? "primary" : "secondary",
        label: "Apply",
        type: typeRole.label,
        rect: apply,
        enabled: pending,
        onClick: activateApply,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    stops.set("row:resolution:apply", this.#bodyStop(apply, item.slot, activateApply));
  }

  #closeResolutionList(): void {
    this.#resolutionListOpen = false;
    this.#draw();
  }

  /**
   * The open Resolution list: up to `LIST_VISIBLE_ROWS` rows under the field (over it when there's no room below),
   * scrolling for the rest. A press anywhere else closes it without a change; picking a row makes it the pending
   * choice, which Apply then puts into effect.
   */
  #drawResolutionList(bounds: Rect): void {
    const field = this.#resolutionField;
    const info = this.#resolutionInfo;
    if (field === null || info === null) return;
    this.add
      .zone(0, 0, bounds.width, bounds.height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerup", () => this.#closeResolutionList());
    const visible = Math.min(info.options.length, LIST_VISIBLE_ROWS);
    const height = visible * LIST_ROW_HEIGHT + 4;
    const below = field.y + field.height + height <= bounds.y + bounds.height - 8;
    const box: Rect = {
      x: field.x,
      y: below ? field.y + field.height + 2 : field.y - height - 2,
      width: field.width,
      height,
    };
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(2, surface.paper.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
    // Swallows presses on the box's own border so they don't close it.
    this.add.zone(box.x, box.y, box.width, box.height).setOrigin(0, 0).setInteractive();
    const viewport: Rect = { x: box.x + 2, y: box.y + 2, width: box.width - 4, height: box.height - 4 };
    this.#listRegion = new McScrollRegion(this, {
      rect: viewport,
      heights: info.options.map(() => LIST_ROW_HEIGHT),
      scroll: this.#resolutionListScroll,
      clipInteractive: true,
    });
    const region = this.#listRegion;
    const picked = this.#pendingResolution ?? info.selected;
    const pickedIndex = Math.max(
      0,
      info.options.findIndex((option) => option.value === picked),
    );
    info.options.forEach((option, i) => {
      const row: Rect = {
        x: viewport.x,
        y: viewport.y + i * LIST_ROW_HEIGHT,
        width: viewport.width - 8,
        height: LIST_ROW_HEIGHT,
      };
      const selected = option.value === picked;
      this.#captureInto(region.content, () => {
        this.#buttons.push(
          new McButton(this, {
            kind: selected ? "secondary" : "quiet",
            label: option.label,
            type: typeRole.label,
            rect: row,
            selected,
            onClick: () => {
              this.#pendingResolution = option.value === info.selected ? null : option.value;
              this.#closeResolutionList();
            },
            clip: () => region.rect,
            suppressClick: () => region.isDragSuppressingClick,
          }),
        );
      });
    });
    region.syncInteractivity();
    region.scrollIntoView(pickedIndex);
  }

  #setTokenMotion(value: FirstPlayerTokenMotion): void {
    appSession().settings = nextSettingsAfterTokenMotion(appSession().settings, value);
    this.#draw();
  }

  #drawVillainToggle(
    rect: Rect,
    id: "villain-hold" | "villain-flip" | "villain-dock" | "power-saving",
    row: { readonly title: string; readonly detail: string; readonly on: boolean },
    index: number,
    stops: Map<string, FocusStop>,
  ): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, row.detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);
    const toggleRect = controlRectOf(rect);
    const activate = (): void => (id === "power-saving" ? this.#togglePowerSaving() : this.#setVillain(id));
    addRowTapZone(this, rect, { onClick: activate, clip: this.#bodyClip, suppressClick: this.#bodySuppressClick });
    this.#buttons.push(
      new McButton(this, {
        kind: row.on ? "secondary" : "quiet",
        label: row.on ? "ON" : "OFF",
        type: typeRole.label,
        rect: toggleRect,
        selected: row.on,
        onClick: activate,
        clip: this.#bodyClip,
        suppressClick: this.#bodySuppressClick,
      }),
    );
    if (row.on) paintOnFrame(this, toggleRect);
    stops.set(`row:${id}`, this.#bodyStop(rect, index, activate));
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

    const controlRect = controlRectOf(rect);
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

  /** A title, a detail line and an "Open ▸" button that opens another screen — the Unlocks, Save data and Rules rows. */
  #drawDoorRow(
    rect: Rect,
    id: string,
    title: string,
    detail: string,
    index: number,
    stops: Map<string, FocusStop>,
    activate: () => void,
    buttonLabel = "Open ▸",
  ): void {
    label(this, rect.x, rect.y + 2, title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, detail, textStyle(typeRole.body, surface.paper.hex, 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);
    const openRect = controlRectOf(rect);
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: buttonLabel,
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

    const toggleRect = controlRectOf(rect);
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
