/**
 * Pause (docs/phase4-screen-gaps.md §3 "W4"; owner decision 2026-09-18 — see
 * `view/pause-layout.ts`'s own header for the full read of what changed and
 * why).
 *
 * **Wide (desktop and tablet, both orientations): D13's two-panel sheet.**
 * A left ink menu — Bangers "Paused", the status line, Resume (the one red
 * fill), Full game log, Rules reference, Settings, and Concede pinned at the
 * panel's own foot — beside a right paper panel: "Rules reference" over a
 * grid of bordered keyword/status cards for what's on the table right now
 * (`view/rules-reference.ts`'s own glossary, capped at a few rows by
 * `view/pause-keyword-grid.ts`), then "Jump to a moment" over the most
 * recent log lines (`view/pause-log-window.ts`) — not clickable yet
 * (docs/phase4-screen-gaps.md S7's read-only replay board hasn't landed), so
 * its own footer label says that plainly rather than promising a jump this
 * build doesn't do. "Full game log" swaps that same footprint for the fuller
 * retained log instead — there is no separate full-log screen to open, so
 * this is what "open the log" means here (`view/pause-layout.ts`'s own doc
 * comment).
 *
 * **Phone: P16's own single-column sheet**, unchanged in spirit from the
 * previous pass — an ink title bar with a boxed ✕, a search field, "Quick
 * reference" chevron rows, the "Table" toggle rows (`scenes/settings.ts`'s
 * own shared row list — P16 draws Table inline, unlike D13, which sends it
 * to the standalone Settings screen instead), and a footer of Resume over
 * Save & quit / Concede side by side.
 *
 * Launched over the Board by its own MENU/≡ chrome button, or by Escape when
 * nothing else (a target/payment mode, the choice sheet, Inspect, the villain
 * walkthrough) already owns it — see `scenes/board.ts`'s own wiring. The board
 * keeps running underneath, exactly like every other overlay in this app.
 *
 * Concede dispatches the engine's `concede` command (`docs/phase4-screen-gaps.md`
 * §2 S5.9: any seated player may concede for the whole table; the outcome is
 * `{ result: "conceded" }`, never a loss). The store's own state update then
 * ends the game the normal way, same as any other command, and the Board hands
 * off to Game Over — so on success this overlay only has to get out of the way.
 */
import Phaser from "phaser";
import { POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { accent, ink, status, surface, typeRole, type TypeSpec } from "../tokens.js";
import { caseOf, setTextResolution, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { pauseLayout, type PausePhoneLayout, type PauseWideLayout } from "../view/pause-layout.js";
import { recentLogMoments } from "../view/pause-log-window.js";
import { pauseStatusOf } from "../view/pause-model.js";
import { rulesGlossaryOf, type RulesEntry } from "../view/rules-reference.js";
import { scenarioCardListOf } from "../view/scenario-card-list.js";
import { nextSettingsAfterToggle, settingsRowInfoOf, type SettingsRowInfo } from "../view/settings-rows.js";
import { pauseFocusOrder } from "../view/screen-focus.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import type { SessionState } from "../store/session-store.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import type { RulesSceneData } from "./rules.js";
import type { RulesTab } from "../view/rules-layout.js";
import { SCENES } from "./keys.js";

/** One "Quick reference" row (phone only): a title, an optional detail line, and what opens when it's activated (or, absent that, why it can't be yet). */
interface QuickReferenceRow {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly open?: () => void;
  readonly unavailable?: string;
}

/** The wide menu's own Bangers size — smaller than a bar title, still the display face, matching D13's own read of "RESUME"/"SETTINGS" etc. */
const MENU_BUTTON_TYPE: TypeSpec = { ...typeRole.barTitle, size: 18 };

export class PauseOverlay extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #buttons: McButton[] = [];
  #searchInput: McTextInput | null = null;
  #query = "";
  #route: FocusRoute | null = null;
  #confirmingConcede = false;
  /** Wide only: "Full game log" swaps the right panel's header/grid/jump-box group for the fuller retained log (`view/pause-layout.ts`'s own `rightContent`). */
  #logExpanded = false;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.#confirmingConcede = false;
    this.#logExpanded = false;
    this.#query = "";
    const { store } = appSession();
    this.#unsubscribe = store.subscribe(() => this.#draw());
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.rules) || this.scene.isActive(SCENES.settings) || this.scene.isActive(SCENES.inspect) || (this.#searchInput?.focused ?? false),
      onCancel: () => (this.#confirmingConcede ? this.#setConfirmingConcede(false) : this.#resume()),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#searchInput?.destroy();
      this.#searchInput = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #setConfirmingConcede(value: boolean): void {
    this.#confirmingConcede = value;
    this.#draw();
  }

  #toggleFullGameLog(): void {
    this.#logExpanded = !this.#logExpanded;
    this.#draw();
  }

  #resume(): void {
    this.scene.stop();
  }

  /** Saves are continuous (every command is written as it lands), so "quitting" is just leaving — nothing to flush. */
  #saveAndQuit(): void {
    for (const overlay of [SCENES.rules, SCENES.settings, SCENES.choice, SCENES.inspect, SCENES.villainPhase]) {
      if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
    }
    if (this.scene.isActive(SCENES.board)) this.scene.stop(SCENES.board);
    this.scene.start(SCENES.title);
  }

  /** True when the engine accepted the concession; the store then carries the outcome. */
  async #dispatchConcede(): Promise<boolean> {
    const { store } = appSession();
    const playerId = store.state.perspectiveId;
    if (!playerId) return false;
    return store.dispatch({ type: "concede", playerId });
  }

  async #onConcedeConfirmed(): Promise<void> {
    const conceded = await this.#dispatchConcede();
    this.#setConfirmingConcede(false);
    // The engine's refusal (already over, no seat) is in `store.state.error`,
    // which the Board shows; the overlay stays open so the player sees it.
    if (conceded) this.#resume();
  }

  #openRules(data: RulesSceneData): void {
    this.scene.launch(SCENES.rules, data);
  }

  /** Phone only — wide mode's menu links straight to Rules reference/Settings instead of this chevron list. */
  #quickReferenceRows(game: SessionState["game"]): readonly QuickReferenceRow[] {
    const rows: QuickReferenceRow[] = [];
    const query = this.#query.trim();
    if (query.length > 0) {
      rows.push({
        id: "search",
        title: `Search "${query}" in the glossary`,
        detail: "Opens Rules reference, filtered to this.",
        open: () => this.#openRules({ initialTab: "glossary", initialQuery: query }),
      });
    }
    const glossaryCount = game ? rulesGlossaryOf(game, POOL_DEPS).length : 0;
    const cardListSetCount = game ? scenarioCardListOf(game, POOL_ENCOUNTER_SETS).length : 0;
    rows.push(
      {
        id: "villainPhase",
        title: "Villain phase order",
        detail: "Six steps, in sequence.",
        open: () => this.#openRules({ initialTab: "villainPhase" satisfies RulesTab }),
      },
      {
        id: "glossary",
        title: "Keyword glossary",
        detail: game ? `${glossaryCount} term${glossaryCount === 1 ? "" : "s"} on the table` : "No game in progress.",
        open: () => this.#openRules({ initialTab: "glossary" satisfies RulesTab }),
      },
      {
        id: "cardList",
        title: "Scenario card list",
        detail: game ? `${cardListSetCount} encounter set${cardListSetCount === 1 ? "" : "s"}` : "No game in progress.",
        open: () => this.#openRules({ initialTab: "cardList" satisfies RulesTab }),
      },
      {
        id: "jumpLog",
        title: "Jump into the log",
        detail: "Undo back to an earlier command.",
        unavailable: "Not available yet — the read-only replay board hasn't landed (docs/phase4-screen-gaps.md S7).",
      },
    );
    return rows;
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];

    const { store, settings } = appSession();
    const { game, perspectiveId, config } = store.state;
    const { width, height } = this.scale.gameSize;

    const quickReferenceRows = this.#quickReferenceRows(game);
    const tableRows = settingsRowInfoOf(settings);
    const keywordEntries = game ? rulesGlossaryOf(game, POOL_DEPS) : [];

    const layout = pauseLayout(
      { x: 0, y: 0, width, height },
      {
        keywordCount: keywordEntries.length,
        quickReferenceDetails: quickReferenceRows.map((row) => row.unavailable ?? row.detail),
        tableDetails: tableRows.map((row) => row.unavailable ?? row.detail),
      },
    );

    const kept = layout.kind === "phone" && this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);
    if (layout.kind === "wide" && this.#searchInput) {
      // Wide mode has no search field of its own — search lives in the full Rules reference overlay instead.
      this.#searchInput.destroy();
      this.#searchInput = null;
    }

    // Dim scrim over the board — the sheet itself paints its own two panels below.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const stops = new Map<string, FocusStop>();

    if (layout.kind === "wide") {
      this.#drawWide(layout, keywordEntries, game, perspectiveId, config, stops);
      this.#route?.set(
        pauseFocusOrder({
          kind: "wide",
          keywordIds: keywordEntries.slice(0, layout.keywordGrid.shown).map((entry) => entry.id),
          confirmingConcede: this.#confirmingConcede,
        }),
        stops,
      );
    } else {
      this.#drawPhone(layout, quickReferenceRows, tableRows, game, perspectiveId, config, stops);
      this.#route?.set(
        pauseFocusOrder({
          kind: "phone",
          quickReferenceIds: quickReferenceRows.map((row) => row.id),
          tableRowIds: tableRows.map((row) => row.id),
          confirmingConcede: this.#confirmingConcede,
        }),
        stops,
      );
    }
  }

  // ------------------------------------------------------------------------------------------------------------
  // Wide (desktop + tablet, both orientations): D13's two-panel sheet.
  // ------------------------------------------------------------------------------------------------------------

  #drawWide(
    layout: PauseWideLayout,
    entries: readonly RulesEntry[],
    game: SessionState["game"],
    perspectiveId: SessionState["perspectiveId"],
    config: SessionState["config"],
    stops: Map<string, FocusStop>,
  ): void {
    // A hard offset shadow behind the sheet — the design's own one shadow besides the selection ring.
    const shadow = this.add.graphics();
    shadow.fillStyle(surface.ink.hex, 0.5).fillRect(layout.sheet.x + 8, layout.sheet.y + 8, layout.sheet.width, layout.sheet.height);

    const leftG = this.add.graphics();
    leftG.fillStyle(surface.ink.hex, 1).fillRect(layout.left.x, layout.left.y, layout.left.width, layout.left.height);
    leftG.lineStyle(4, surface.paper.hex, 1).strokeRect(layout.left.x, layout.left.y, layout.left.width, layout.left.height);
    paintDotGrid(this, layout.left, "ink", { spacing: 8, radius: 1, alpha: 0.08 });

    const rightG = this.add.graphics();
    rightG.fillStyle(surface.paper.hex, 1).fillRect(layout.right.x, layout.right.y, layout.right.width, layout.right.height);
    rightG.lineStyle(4, surface.ink.hex, 1).strokeRect(layout.right.x, layout.right.y, layout.right.width, layout.right.height);
    paintDotGrid(this, layout.right, "paper", { spacing: 6, radius: 1, alpha: 0.1 });

    this.add.text(layout.title.x, layout.title.y, caseOf(typeRole.barTitle, "Paused"), { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "30px" });
    const statusText = game && perspectiveId ? this.#wideStatusLine(game, perspectiveId, config) : "No game in progress.";
    const statusLabel = label(this, layout.status.x, layout.status.y, statusText, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(11);
    fitText(statusLabel, layout.status.width, 11);

    this.#menuButton(stops, "resume", "primary", "Resume", layout.menu.resume, () => this.#resume());
    this.#menuButton(stops, "full-game-log", "onInk", "Full game log", layout.menu.fullGameLog, () => this.#toggleFullGameLog(), this.#logExpanded);
    this.#menuButton(stops, "rules-reference", "onInk", "Rules reference", layout.menu.rulesReference, () => this.#openRules({ initialTab: "glossary" satisfies RulesTab }));
    this.#menuButton(stops, "settings", "onInk", "Settings", layout.menu.settings, () => this.scene.launch(SCENES.settings));
    this.#menuButton(stops, "save-quit", "onInk", "Save & quit", layout.menu.saveQuit, () => this.#saveAndQuit());

    if (this.#confirmingConcede) this.#drawWideConcedeConfirm(layout, stops);
    // The same full-strength outline as the rest of the menu. D13 dims it, which read as *disabled* (owner,
    // 2026-09-18); its place alone at the panel's foot, and the confirm step behind it, already set it apart.
    else this.#menuButton(stops, "concede", "onInk", "Concede", layout.concede, () => this.#setConfirmingConcede(true));

    this.#drawWideRight(layout, entries, game, stops);
  }

  #menuButton(stops: Map<string, FocusStop>, id: string, kind: "primary" | "onInk", text: string, rect: Rect, onClick: () => void, selected = false): void {
    stops.set(id, { rect, activate: onClick });
    this.#buttons.push(new McButton(this, { kind, label: text, type: MENU_BUTTON_TYPE, rect, onClick, selected, enabled: true }));
  }

  #drawWideConcedeConfirm(layout: PauseWideLayout, stops: Map<string, FocusStop>): void {
    this.add
      .text(layout.title.x, layout.concedeConfirmCancel.y - 34, "Concede? This ends the game for the whole table.", textStyle(typeRole.body, accent.heroRed.hex))
      .setFontSize(10)
      .setWordWrapWidth(layout.title.width);
    stops.set("concede-confirm-yes", { rect: layout.concedeConfirmYes, activate: () => void this.#onConcedeConfirmed() });
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Yes, concede", type: MENU_BUTTON_TYPE, rect: layout.concedeConfirmYes, onClick: () => void this.#onConcedeConfirmed() }));
    stops.set("concede-confirm-cancel", { rect: layout.concedeConfirmCancel, activate: () => this.#setConfirmingConcede(false) });
    this.#buttons.push(new McButton(this, { kind: "onInk", label: "Cancel", type: MENU_BUTTON_TYPE, rect: layout.concedeConfirmCancel, onClick: () => this.#setConfirmingConcede(false) }));
  }

  #drawWideRight(layout: PauseWideLayout, entries: readonly RulesEntry[], game: SessionState["game"], stops: Map<string, FocusStop>): void {
    if (this.#logExpanded) {
      this.#drawExpandedLog(layout);
      return;
    }

    const headerTitle = this.add
      .text(layout.rulesHeader.x, layout.rulesHeader.y, caseOf(typeRole.barTitle, "Rules reference"), { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "20px" })
      .setLetterSpacing(typeRole.barTitle.letterSpacing);
    const filterText = game ? "Filtered to what's on your table" : "No game in progress";
    const filterLabel = label(this, layout.rulesHeader.x + layout.rulesHeader.width, layout.rulesHeader.y + 8, filterText, typeRole.label, surface.ink.hex, ink.secondary)
      .setOrigin(1, 0)
      .setFontSize(9);
    fitText(filterLabel, 240, 9);
    const ruleY = layout.rulesHeader.y + headerTitle.height / 2 + 4;
    const ruleStartX = layout.rulesHeader.x + headerTitle.width + 12;
    const ruleEndX = filterLabel.x - filterLabel.width - 12;
    if (ruleEndX > ruleStartX) {
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, 0.3).fillRect(ruleStartX, ruleY, ruleEndX - ruleStartX, 2);
    }

    if (layout.keywordGrid.shown === 0) {
      const emptyText = game ? "Nothing on the table carries a keyword or status right now." : "No game in progress — start or resume one to see what's on your table.";
      this.add.text(layout.keywordEmpty.x, layout.keywordEmpty.y, emptyText, textStyle(typeRole.body, surface.ink.hex, ink.meta)).setFontSize(10).setWordWrapWidth(layout.keywordEmpty.width);
    } else {
      entries.slice(0, layout.keywordGrid.shown).forEach((entry, index) => this.#drawKeywordCard(layout.keywordGrid.cells[index]!, entry, stops));
    }

    this.#drawLogSection(layout.jumpHeader, layout.logBox, "Jump to a moment");
  }

  /** One bordered keyword/status card — a status is a filled card in its own status colour with paper text (colorblind-safe: the term is always the plain word, never colour alone), a keyword a plain outlined card. Tapping either opens the full Rules reference overlay's Glossary tab, filtered to this term. */
  #drawKeywordCard(rect: Rect, entry: RulesEntry, stops: Map<string, FocusStop>): void {
    const isStatus = entry.id === "stunned" || entry.id === "confused" || entry.id === "tough";
    const g = this.add.graphics();
    if (isStatus) {
      g.fillStyle(status[entry.id as "stunned" | "confused" | "tough"].hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
    } else {
      paintPanel(g, rect, "card", "rest");
    }
    const textColor = isStatus ? surface.paper.hex : surface.ink.hex;
    const pad = 10;
    const term = this.add
      .text(rect.x + pad, rect.y + 8, caseOf(typeRole.barTitle, entry.displayName), { ...textStyle(typeRole.barTitle, textColor), fontSize: "16px" })
      .setLetterSpacing(typeRole.barTitle.letterSpacing);
    fitText(term, rect.width - pad * 2, 16);
    this.add
      .text(rect.x + pad, rect.y + 8 + term.height + 4, entry.definition, textStyle(typeRole.body, textColor, isStatus ? 1 : ink.body))
      .setFontSize(9)
      .setWordWrapWidth(rect.width - pad * 2);
    const tailCard = entry.cardRefs[0];
    if (tailCard) {
      this.add.text(rect.x + pad, rect.y + rect.height - 16, `On ${tailCard.name}.`, textStyle(typeRole.label, textColor, isStatus ? 0.85 : ink.meta)).setFontSize(9);
    }
    const activate = (): void => this.#openRules({ initialTab: "glossary" satisfies RulesTab, initialQuery: entry.displayName });
    const zone = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on("pointerup", activate);
    stops.set(`keyword:${entry.id}`, { rect, activate });
  }

  /** The parchment box of recent log lines — shared by the normal "Jump to a moment" footprint and "Full game log"'s expanded one. Not clickable yet (docs/phase4-screen-gaps.md S7). */
  #drawLogBox(boxRect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(boxRect.x, boxRect.y, boxRect.width, boxRect.height);

    const padX = 12;
    const padY = 10;
    const footerHeight = 16;
    const textWidth = Math.max(1, boxRect.width - padX * 2 - 46);
    const available = Math.max(0, boxRect.height - padY * 2 - footerHeight - 6);
    const moments = recentLogMoments(appSession().gameLog.lines, available, textWidth);

    if (moments.length === 0) {
      this.add.text(boxRect.x + padX, boxRect.y + padY, "Nothing has happened yet.", textStyle(typeRole.body, surface.ink.hex, ink.meta)).setFontSize(10);
    } else {
      let y = boxRect.y + padY;
      for (const moment of moments) {
        this.add.text(boxRect.x + padX, y, moment.line.ref, textStyle(typeRole.mono, surface.ink.hex, ink.meta)).setFontSize(9);
        this.add.text(boxRect.x + padX + 46, y, moment.line.text, textStyle(typeRole.body, surface.ink.hex, ink.body)).setFontSize(10).setWordWrapWidth(textWidth);
        y += moment.height;
      }
    }
    label(this, boxRect.x + padX, boxRect.y + boxRect.height - padY - 6, "REPLAY FROM A MOMENT ISN'T BUILT YET", typeRole.label, surface.ink.hex, ink.meta)
      .setFontSize(8)
      .setOrigin(0, 0.5);
  }

  #drawLogSection(headerRect: Rect, boxRect: Rect, title: string): void {
    this.add.text(headerRect.x, headerRect.y, caseOf(typeRole.barTitle, title), { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "18px" }).setLetterSpacing(typeRole.barTitle.letterSpacing);
    this.#drawLogBox(boxRect);
  }

  /** "Full game log": there is no separate full-log screen to open (`view/pause-layout.ts`'s own doc comment), so this swaps the header/grid/jump-header/log-box group for one taller box over the same footprint instead. */
  #drawExpandedLog(layout: PauseWideLayout): void {
    const rect = layout.rightContent;
    const titleText = this.add
      .text(rect.x, rect.y, caseOf(typeRole.barTitle, "Full game log"), { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "20px" })
      .setLetterSpacing(typeRole.barTitle.letterSpacing);
    const note = this.add
      .text(rect.x, rect.y + titleText.height + 4, "Every retained beat, newest first. Tap “Full game log” again to go back to the keyword grid.", textStyle(typeRole.label, surface.ink.hex, ink.secondary))
      .setFontSize(9)
      .setWordWrapWidth(rect.width);
    const boxTop = note.y + note.height + 8;
    this.#drawLogBox({ x: rect.x, y: boxTop, width: rect.width, height: Math.max(60, rect.y + rect.height - boxTop) });
  }

  // ------------------------------------------------------------------------------------------------------------
  // Phone: P16's own single-column sheet.
  // ------------------------------------------------------------------------------------------------------------

  #drawPhone(
    layout: PausePhoneLayout,
    quickReferenceRows: readonly QuickReferenceRow[],
    tableRows: readonly SettingsRowInfo[],
    game: SessionState["game"],
    perspectiveId: SessionState["perspectiveId"],
    config: SessionState["config"],
    stops: Map<string, FocusStop>,
  ): void {
    const panel = this.add.graphics();
    panel.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel.lineStyle(4, surface.paper.hex, 1).strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    paintDotGrid(this, layout.panel, "ink", { spacing: 8, radius: 1, alpha: 0.08 });

    this.#drawHeader(layout.header, layout.closeButton, game, perspectiveId, config, stops);

    if (this.#searchInput) this.#searchInput.layout(layout.search);
    else {
      this.#searchInput = new McTextInput(this, {
        rect: layout.search,
        value: this.#query,
        placeholder: "Search rules — \"retaliate\", \"confused\"…",
        onChange: (value) => {
          this.#query = value;
          this.#draw();
        },
      });
    }
    stops.set("search", { rect: layout.search, activate: () => this.#searchInput?.focus() });

    label(this, layout.quickReferenceHeading.x, layout.quickReferenceHeading.y, "Quick reference", typeRole.label, surface.paper.hex, ink.label);
    quickReferenceRows.forEach((row, index) => this.#drawQuickReferenceRow(layout.quickReferenceRows[index]!, row, stops));

    label(this, layout.tableHeading.x, layout.tableHeading.y, "Table", typeRole.label, surface.paper.hex, ink.secondary);
    tableRows.forEach((row, index) => this.#drawTableRow(layout.tableRows[index]!, row, stops));

    if (this.#confirmingConcede) this.#drawPhoneConcedeConfirm(layout, stops);
    else {
      this.#button(stops, "resume", "primary", "Resume", layout.resume, () => this.#resume());
      this.#button(stops, "save-quit", "secondary", "Save & quit", layout.saveQuit, () => this.#saveAndQuit());
      this.#button(stops, "concede", "quiet", "Concede", layout.concede, () => this.#setConfirmingConcede(true));
    }
  }

  #drawHeader(
    rect: Rect,
    closeRect: Rect,
    game: SessionState["game"],
    perspectiveId: SessionState["perspectiveId"],
    config: SessionState["config"],
    stops: Map<string, FocusStop>,
  ): void {
    this.add.text(rect.x + 16, rect.y + 10, caseOf(typeRole.barTitle, "Paused"), { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "26px" });
    const statusText = game && perspectiveId ? this.#statusLine(game, perspectiveId, config) : "No game in progress.";
    const statusLabel = label(this, rect.x + 16, rect.y + 42, statusText, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(11);
    // Shrinks rather than running under the ✕ (fidelity pass, 2026-09-17): at
    // phone width the full "‹scenario› · ‹difficulty› · Round ‹n› · ‹phase› ·
    // ‹seat›" line is wider than the header has room for beside the close button.
    fitText(statusLabel, closeRect.x - rect.x - 16 - 12, 11);
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "✕", type: typeRole.rowTitle, rect: closeRect, onClick: () => this.#resume() }));
    stops.set("close", { rect: closeRect, activate: () => this.#resume() });
    const rule = this.add.graphics();
    rule.fillStyle(surface.paper.hex, 0.4).fillRect(rect.x, rect.y + rect.height - 2, rect.width, 2);
  }

  #statusLine(game: NonNullable<SessionState["game"]>, perspectiveId: NonNullable<SessionState["perspectiveId"]>, config: SessionState["config"]): string {
    const s = pauseStatusOf(game, perspectiveId, config, POOL_SCENARIOS);
    return `${s.scenarioName} · ${s.difficultyLabel} · Round ${s.round} · ${s.phaseLabel} · ${s.seatLabel}`;
  }

  /**
   * D13's own shorter read ("Round 3 · player phase · your turn") — the wide
   * left menu is a fixed ~300px column, not phone's near-full-width header,
   * so it drops the scenario/difficulty phone's line carries (still visible
   * on the Board's own chrome underneath) rather than shrinking the whole
   * line to near-illegibility to fit all five segments.
   */
  #wideStatusLine(game: NonNullable<SessionState["game"]>, perspectiveId: NonNullable<SessionState["perspectiveId"]>, config: SessionState["config"]): string {
    const s = pauseStatusOf(game, perspectiveId, config, POOL_SCENARIOS);
    return `Round ${s.round} · ${s.phaseLabel.toLowerCase()} · ${s.seatLabel}`;
  }

  #drawQuickReferenceRow(rect: Rect, row: QuickReferenceRow, stops: Map<string, FocusStop>): void {
    const enabled = row.open !== undefined;
    const g = this.add.graphics();
    paintPanel(g, rect, "onInk", enabled ? "rest" : "unavailable");
    const alpha = enabled ? 1 : ink.disabled;
    this.add.text(rect.x + 12, rect.y + 6, row.title, textStyle(typeRole.rowTitle, surface.paper.hex, alpha)).setWordWrapWidth(rect.width - 60);
    this.add.text(rect.x + 12, rect.y + 24, row.unavailable ?? row.detail, textStyle(typeRole.label, surface.paper.hex, alpha * 0.75)).setFontSize(9).setWordWrapWidth(rect.width - 24);
    if (enabled) label(this, rect.x + rect.width - 16, rect.y + rect.height / 2, "›", typeRole.rowTitle, surface.paper.hex, ink.secondary).setOrigin(0.5);
    const activate = (): void => row.open?.();
    stops.set(`quick:${row.id}`, { rect, activate });
    const zone = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
    if (enabled) {
      zone.setInteractive({ useHandCursor: true }).on("pointerup", activate);
    }
  }

  #drawTableRow(rect: Rect, row: SettingsRowInfo, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, row.unavailable ?? row.detail, textStyle(typeRole.body, surface.paper.hex, row.unavailable ? 0.55 : 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);
    const toggleRect: Rect = { x: rect.x + rect.width - 84, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const activate = (): void => this.#toggleTableRow(row);
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
      }),
    );
    stops.set(`table:${row.id}`, { rect, activate });
  }

  #toggleTableRow(row: SettingsRowInfo): void {
    if (row.id === "sound") return;
    const { settings } = appSession();
    const next = nextSettingsAfterToggle(settings, row.id, globalThis.devicePixelRatio || 1);
    if (row.id === "sharper-text") setTextResolution(next.textResolution);
    appSession().settings = next;
    this.#draw();
  }

  #drawPhoneConcedeConfirm(layout: PausePhoneLayout, stops: Map<string, FocusStop>): void {
    const yesRect = layout.resume;
    const cancelRect = layout.saveQuit;
    this.add
      .text(layout.panel.x + 16, yesRect.y - 22, "Concede? This ends the game for the whole table.", textStyle(typeRole.body, accent.heroRed.hex))
      .setFontSize(11)
      .setWordWrapWidth(layout.panel.width - 32);
    stops.set("concede-confirm-yes", { rect: yesRect, activate: () => void this.#onConcedeConfirmed() });
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Yes, concede", type: typeRole.barTitle, rect: yesRect, onClick: () => void this.#onConcedeConfirmed() }));
    stops.set("concede-confirm-cancel", { rect: cancelRect, activate: () => this.#setConfirmingConcede(false) });
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "Cancel", type: typeRole.rowTitle, rect: cancelRect, onClick: () => this.#setConfirmingConcede(false) }));
  }

  #button(stops: Map<string, FocusStop>, id: string, kind: "primary" | "secondary" | "quiet", text: string, rect: Rect, onClick: () => void): void {
    stops.set(id, { rect, activate: onClick });
    this.#buttons.push(new McButton(this, { kind, label: text, type: kind === "primary" ? typeRole.barTitle : typeRole.rowTitle, rect, onClick, enabled: true }));
  }
}
