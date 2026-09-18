/**
 * Pause (docs/phase4-screen-gaps.md §3 "W4"; design canvases D13, P16, L07).
 *
 * **Composition (fidelity pass, 2026-09-17).** `view/pause-layout.ts`'s own
 * doc comment has the full read of the tiles; in short, an overlay *sheet*
 * over a 70%-ink scrim, one ink ground throughout: an ink title bar ("Paused"
 * + the status line, a boxed ✕ at its corner that does what Resume does) over
 * a two-column body — **Rules reference** (a search field, then "Quick
 * reference" chevron rows: Villain phase order / Keyword glossary / Scenario
 * card list / Jump into the log) beside **Table** (the same toggle rows
 * `scenes/settings.ts` draws, from the shared `view/settings-rows.ts`) — and a
 * three-button footer: Save & quit, Concede (both quiet outlines), Resume (the
 * one red primary action). Below `TWO_COLUMN_MIN_BODY_WIDTH` the Table group
 * stacks under Rules reference instead of beside it.
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
import { accent, ink, surface, typeRole } from "../tokens.js";
import { caseOf, setTextResolution, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { pauseLayout } from "../view/pause-layout.js";
import { pauseStatusOf } from "../view/pause-model.js";
import { rulesGlossaryOf } from "../view/rules-reference.js";
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

/** One "Quick reference" row: a title, an optional detail line, and what opens when it's activated (or, absent that, why it can't be yet). */
interface QuickReferenceRow {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly open?: () => void;
  readonly unavailable?: string;
}

export class PauseOverlay extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #buttons: McButton[] = [];
  #searchInput: McTextInput | null = null;
  #query = "";
  #route: FocusRoute | null = null;
  #confirmingConcede = false;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.#confirmingConcede = false;
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
    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { store, settings } = appSession();
    const { game, perspectiveId, config } = store.state;
    const { width, height } = this.scale.gameSize;

    const quickReferenceRows = this.#quickReferenceRows(game);
    const tableRows = settingsRowInfoOf(settings);
    const layout = pauseLayout(
      { x: 0, y: 0, width, height },
      quickReferenceRows.map((row) => row.unavailable ?? row.detail),
      tableRows.map((row) => row.unavailable ?? row.detail),
    );

    // Dim scrim over the board, then the panel itself — one ink ground
    // throughout (`view/pause-layout.ts`'s own doc comment says why).
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panel = this.add.graphics();
    panel.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel.lineStyle(4, surface.paper.hex, 1).strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    paintDotGrid(this, layout.panel, "ink", { spacing: 8, radius: 1, alpha: 0.08 });

    const stops = new Map<string, FocusStop>();
    this.#drawHeader(layout.header, layout.closeButton, game, perspectiveId, config, stops);

    // Rules reference column: search field, then the Quick reference rows.
    label(this, layout.rules.heading.x, layout.rules.heading.y, "Rules reference", typeRole.label, surface.paper.hex, ink.secondary);
    if (this.#searchInput) this.#searchInput.layout(layout.rules.search);
    else {
      this.#searchInput = new McTextInput(this, {
        rect: layout.rules.search,
        value: this.#query,
        placeholder: "Search — \"retaliate\", \"confused\"…",
        onChange: (value) => {
          this.#query = value;
          this.#draw();
        },
      });
    }
    stops.set("search", { rect: layout.rules.search, activate: () => this.#searchInput?.focus() });
    label(this, layout.rules.subheading.x, layout.rules.subheading.y, "Quick reference", typeRole.label, surface.paper.hex, ink.label);
    quickReferenceRows.forEach((row, index) => this.#drawQuickReferenceRow(layout.rules.rows[index]!, row, stops));

    // Table column: the same toggle rows Settings draws, from one shared list.
    label(this, layout.table.heading.x, layout.table.heading.y, "Table", typeRole.label, surface.paper.hex, ink.secondary);
    tableRows.forEach((row, index) => this.#drawTableRow(layout.table.rows[index]!, row, stops));

    // Footer: Save & quit, Concede, Resume — or the concede confirm in their place.
    if (this.#confirmingConcede) this.#drawConcedeConfirm(layout, stops);
    else {
      this.#button(stops, "save-quit", "secondary", "Save & quit", layout.saveQuit, () => this.#saveAndQuit());
      this.#button(stops, "concede", "quiet", "Concede", layout.concede, () => this.#setConfirmingConcede(true));
      this.#button(stops, "resume", "primary", "Resume", layout.resume, () => this.#resume());
    }

    this.#route?.set(
      pauseFocusOrder({
        quickReferenceIds: quickReferenceRows.map((row) => row.id),
        tableRowIds: tableRows.map((row) => row.id),
        confirmingConcede: this.#confirmingConcede,
      }),
      stops,
    );
  }

  #drawHeader(
    rect: Rect,
    closeRect: Rect,
    game: SessionState["game"],
    perspectiveId: SessionState["perspectiveId"],
    config: SessionState["config"],
    stops: Map<string, FocusStop>,
  ): void {
    this.add.text(rect.x + 16, rect.y + 12, caseOf(typeRole.barTitle, "Paused"), { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "28px" });
    const statusText = game && perspectiveId ? this.#statusLine(game, perspectiveId, config) : "No game in progress.";
    const status = label(this, rect.x + 16, rect.y + 46, statusText, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(11);
    // Shrinks rather than running under the ✕ (fidelity pass, 2026-09-17): at
    // phone width the full "‹scenario› · ‹difficulty› · Round ‹n› · ‹phase› ·
    // ‹seat›" line is wider than the header has room for beside the close button.
    fitText(status, closeRect.x - rect.x - 16 - 12, 11);
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "✕", type: typeRole.rowTitle, rect: closeRect, onClick: () => this.#resume() }));
    stops.set("close", { rect: closeRect, activate: () => this.#resume() });
    const rule = this.add.graphics();
    rule.fillStyle(surface.paper.hex, 0.4).fillRect(rect.x, rect.y + rect.height - 2, rect.width, 2);
  }

  #statusLine(game: NonNullable<SessionState["game"]>, perspectiveId: NonNullable<SessionState["perspectiveId"]>, config: SessionState["config"]): string {
    const status = pauseStatusOf(game, perspectiveId, config, POOL_SCENARIOS);
    return `${status.scenarioName} · ${status.difficultyLabel} · Round ${status.round} · ${status.phaseLabel} · ${status.seatLabel}`;
  }

  #drawQuickReferenceRow(rect: Rect, row: QuickReferenceRow, stops: Map<string, FocusStop>): void {
    const enabled = row.open !== undefined;
    const g = this.add.graphics();
    paintPanel(g, rect, "onInk", enabled ? "rest" : "unavailable");
    const alpha = enabled ? 1 : ink.disabled;
    this.add.text(rect.x + 12, rect.y + 6, row.title, textStyle(typeRole.rowTitle, surface.paper.hex, alpha)).setWordWrapWidth(rect.width - 60);
    // Anchored below the title and growing *down*, not anchored to the row's
    // bottom edge and growing up into it — "Jump into the log"'s two-line
    // unavailable reason used to render its second line straight through the
    // row's own border (fidelity pass, 2026-09-17: `QUICK_REFERENCE_ROW_HEIGHT`
    // in `view/pause-layout.ts` now reserves room for a two-line detail).
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

  #drawConcedeConfirm(layout: { readonly footer: Rect; readonly saveQuit: Rect; readonly concede: Rect; readonly resume: Rect }, stops: Map<string, FocusStop>): void {
    const yesRect = layout.concede;
    const cancelRect = layout.resume;
    this.add
      .text(layout.footer.x + 16, layout.footer.y - 4, "Concede? This ends the game for the whole table.", textStyle(typeRole.body, accent.heroRed.hex))
      .setFontSize(11);
    stops.set("concede-confirm-yes", { rect: yesRect, activate: () => void this.#onConcedeConfirmed() });
    this.#buttons.push(new McButton(this, { kind: "primary", label: "Yes, concede", type: typeRole.label, rect: yesRect, onClick: () => void this.#onConcedeConfirmed() }));
    stops.set("concede-confirm-cancel", { rect: cancelRect, activate: () => this.#setConfirmingConcede(false) });
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "Cancel", type: typeRole.label, rect: cancelRect, onClick: () => this.#setConfirmingConcede(false) }));
  }

  #button(stops: Map<string, FocusStop>, id: string, kind: "primary" | "secondary" | "quiet", text: string, rect: Rect, onClick: () => void): void {
    stops.set(id, { rect, activate: onClick });
    this.#buttons.push(new McButton(this, { kind, label: text, type: kind === "primary" ? typeRole.barTitle : typeRole.rowTitle, rect, onClick, enabled: true }));
  }
}
