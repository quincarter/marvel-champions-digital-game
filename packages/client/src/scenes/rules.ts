/**
 * Rules Reference (docs/phase4-screen-gaps.md §3 "W4"; design canvases D13,
 * P16, L07): the glossary filtered to the keywords and statuses on the table,
 * with search, plus the villain phase order and the scenario's card list.
 *
 * **Composition (fidelity pass, 2026-09-17).** D13's own right-hand panel is
 * parchment top to bottom — this scene's body ground moved from ink to paper
 * to match (`#draw`'s own comment says why the title bar alone stays ink).
 * The glossary/villain-phase/card-list content is still one scrolling text
 * block (`McScrollPanel`) rather than D13's grid of individually bordered
 * keyword tiles: that widget wraps one long run of text, and a masonry grid
 * of independently-bordered entries at a variable definition length would
 * need a new virtualization-friendly widget this pass didn't build — recorded
 * as a real, not a cosmetic, gap in the fidelity report rather than papered
 * over with a fixed-height truncation that would silently clip a long ruling.
 *
 * Launched from Pause over the Board (`RulesSceneData` lets Pause's own "Quick
 * reference" rows open straight to a tab, and the glossary tab to a starting
 * query); Back returns to Pause (`this.scene.stop()` — Pause is still running
 * underneath, since it launched this the same way every other overlay in this
 * app is launched).
 */
import Phaser from "phaser";
import { POOL_DEPS, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { ink, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, McScrollPanel, McTabs, McTextInput, label } from "../ui/widgets.js";
import { rulesLayout, type RulesTab } from "../view/rules-layout.js";
import { rulesGlossaryOf, villainPhaseOrder, type RulesEntry } from "../view/rules-reference.js";
import { scenarioCardListOf } from "../view/scenario-card-list.js";
import { rulesFocusOrder } from "../view/screen-focus.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const TABS: readonly { readonly id: RulesTab; readonly label: string }[] = [
  { id: "glossary", label: "Glossary" },
  { id: "villainPhase", label: "Villain phase" },
  { id: "cardList", label: "Card list" },
];

/**
 * Optional starting point, so Pause's own "Quick reference" rows can jump
 * straight to the right tab (and, for the glossary, a pre-filled search) —
 * `scenes/pause.ts`'s own doc comment says which row sets which field.
 * Absent, this opens exactly as it always has: the glossary tab, no query.
 */
export interface RulesSceneData {
  readonly initialTab?: RulesTab;
  readonly initialQuery?: string;
}

export class RulesOverlay extends Phaser.Scene {
  #activeTab: RulesTab = "glossary";
  #query = "";
  #searchInput: McTextInput | null = null;
  #tabsWidget: McTabs | null = null;
  #scroll: McScrollPanel | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.rules);
  }

  create(data: RulesSceneData = {}): void {
    this.#activeTab = data.initialTab ?? "glossary";
    this.#query = data.initialQuery ?? "";
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.scene.stop() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#searchInput?.destroy();
      this.#searchInput = null;
      this.#tabsWidget?.destroy();
      this.#tabsWidget = null;
      this.#scroll?.destroy();
      this.#scroll = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #setTab(tab: RulesTab): void {
    this.#activeTab = tab;
    this.#draw();
  }

  #draw(): void {
    this.#tabsWidget?.destroy();
    this.#tabsWidget = null;
    this.#scroll?.destroy();
    this.#scroll = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const layout = rulesLayout({ x: 0, y: 0, width, height }, this.#activeTab);

    // Scrim, then the sheet: an ink title bar (Back, the title, the "filtered
    // to your table" caption) over a **parchment body** — D13's own right-hand
    // panel is cream throughout, not ink; the title bar stays ink only because
    // every overlay in this app puts Back/✕ on one, the same chrome language
    // Pause and Settings use (`view/pause-layout.ts`'s own doc comment makes
    // the same call for Pause's sheet, the other direction).
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panel = this.add.graphics();
    panel.fillStyle(surface.paper.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel.fillStyle(surface.ink.hex, 1).fillRect(layout.header.x, layout.header.y, layout.header.width, layout.header.height);
    panel.lineStyle(4, surface.ink.hex, 1).strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);

    const stops = new Map<string, FocusStop>();

    const backRect: Rect = { x: layout.header.x + 12, y: layout.header.y + 10, width: 90, height: 32 };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "◂ Back", type: typeRole.label, rect: backRect, onClick: () => this.scene.stop() }));
    stops.set("back", { rect: backRect, activate: () => this.scene.stop() });
    this.add.text(backRect.x + backRect.width + 12, layout.header.y + 12, caseOf(typeRole.barTitle, "Rules reference"), { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "22px" });
    label(this, layout.header.x + 12, layout.header.y + layout.header.height - 20, "Filtered to what's on your table", typeRole.label, surface.paper.hex, ink.secondary).setFontSize(9);

    this.#tabsWidget = new McTabs(this, {
      rect: layout.tabs,
      tabs: TABS.map((tab) => ({ id: tab.id, label: tab.label })),
      activeId: this.#activeTab,
      onSelect: (id) => this.#setTab(id as RulesTab),
    });
    const cellWidth = layout.tabs.width / TABS.length;
    TABS.forEach((tab, index) => {
      stops.set(`tab:${tab.id}`, {
        rect: { x: layout.tabs.x + index * cellWidth, y: layout.tabs.y, width: cellWidth, height: layout.tabs.height },
        activate: () => this.#setTab(tab.id),
      });
    });

    const { game } = appSession().store.state;
    const rowIds: string[] = [];

    if (this.#activeTab === "glossary") {
      if (this.#searchInput) this.#searchInput.layout(layout.search);
      else this.#searchInput = new McTextInput(this, { rect: layout.search, value: this.#query, placeholder: "Search rules — \"retaliate\", \"confused\"…", onChange: (v) => this.#onQueryChange(v) });
      stops.set("search", { rect: layout.search, activate: () => this.#searchInput?.focus() });

      const entries = game ? rulesGlossaryOf(game, POOL_DEPS, this.#query) : [];
      rowIds.push(...entries.map((entry) => entry.id));
      this.#scroll = new McScrollPanel(this, { rect: layout.body, text: this.#glossaryText(entries, game !== null), onInk: false });
    } else if (this.#activeTab === "villainPhase") {
      this.#searchInput?.destroy();
      this.#searchInput = null;
      const steps = villainPhaseOrder(game ?? undefined);
      rowIds.push(...steps.map((step) => step.id));
      const text = steps.map((step) => `${step.label}${step.current ? "  ← here" : ""}\n${step.detail}`).join("\n\n") + "\n\nRRG 1.8 p. 47 \"Villain Phase\".";
      this.#scroll = new McScrollPanel(this, { rect: layout.body, text, onInk: false });
    } else {
      this.#searchInput?.destroy();
      this.#searchInput = null;
      if (!game) {
        this.#scroll = new McScrollPanel(this, { rect: layout.body, text: "No game in progress.", onInk: false });
      } else {
        const groups = scenarioCardListOf(game, POOL_ENCOUNTER_SETS);
        rowIds.push(...groups.map((group) => group.setId));
        const text = groups.map((group) => `${group.setName.toUpperCase()}\n${group.cardNames.join(", ")}`).join("\n\n") || "This game has no encounter-side cards to list.";
        this.#scroll = new McScrollPanel(this, { rect: layout.body, text, onInk: false });
      }
    }
    rowIds.forEach((id) => stops.set(`row:${id}`, { rect: layout.body, activate: () => undefined }));

    this.#route?.set(
      rulesFocusOrder({ tabIds: TABS.map((t) => t.id), showSearch: this.#activeTab === "glossary", rowIds }),
      stops,
    );
  }

  #onQueryChange(value: string): void {
    this.#query = value;
    // Only the glossary body needs to change; a full `#draw` would tear down
    // and recreate the DOM search field mid-keystroke (see `#draw`'s own note
    // on why the input survives the sweep) — cheap enough to just rebuild the
    // scroll panel's text in place instead.
    if (this.#activeTab !== "glossary") return;
    const { game } = appSession().store.state;
    const entries = game ? rulesGlossaryOf(game, POOL_DEPS, this.#query) : [];
    this.#scroll?.setText(this.#glossaryText(entries, game !== null));
  }

  #glossaryText(entries: readonly RulesEntry[], hasGame: boolean): string {
    if (!hasGame) return "No game in progress.";
    if (entries.length === 0) return "No rules terms match that search.";
    return entries
      .map((entry) => {
        const flags = [entry.unverified ? "UNVERIFIED — not confirmed rules" : null, entry.conflict ? "RRG/RULING CONFLICT — see below" : null].filter(Boolean);
        const lines = [`${entry.displayName}  (${entry.citeLabel})`, entry.definition, ...flags];
        if (entry.conflict) lines.push(entry.conflict);
        return lines.join("\n");
      })
      .join("\n\n");
  }
}
