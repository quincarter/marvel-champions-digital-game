/**
 * Title, then setup: pick a scenario, a difficulty (and, for Breakout, each
 * villain's own version), and 1–4 seats.
 *
 * **Searchable, scrollable rosters** (docs/phase4-screen-gaps.md §2 "S8"):
 * the pool already holds 6 scenarios and 12 precons before a player's own
 * saved/imported decks are counted, and every later pack adds more, so
 * neither roster is a fixed grid sized to "however many happen to exist
 * today". Both are a `McVirtualList` (`ui/virtual-list.ts`) at a fixed
 * viewport height (`view/title-layout.ts`), with a text search above each
 * (`view/roster-filter.ts`) — heroes match on hero name, alter-ego name, deck
 * name, aspect and source; scenarios match on villain name, scenario name and
 * pack. A blocked hero seat still shows, dimmed, with its reason; a deck
 * whose only problem is a missing card script is still seatable, with a
 * warning naming the cards (PLAN.md Phase 7 wave 1). Quick-filter chips (S8:
 * aspect/source/"playable now" for heroes, product/cycle for scenarios) are
 * not built this pass — `RosterFilter` is shaped so they can be added later
 * without reshaping every call site.
 *
 * **Rows are plain, no card art** — a deliberate simplification so a row's
 * height is a constant the layout function doesn't need a live Phaser scene
 * to know (`view/title-layout.ts`'s doc comment explains why). A row's own
 * art and full text are still one press away, the same "Inspect" every other
 * blocked/inspectable row on this screen already had.
 *
 * **All six scenarios are selectable** (Core's three plus wave 1's Risky
 * Business, Mutagen Formula and Breakout). Difficulty gains `"extreme"` only
 * for Breakout (its own multi-villain challenge, docs/phase7-wave1.md §4.6);
 * every other scenario offers only standard/expert. Breakout also offers a
 * per-villain version row at standard/expert — each villain defaults to the
 * difficulty's uniform version (A at standard, B at expert) and can be
 * overridden individually; "extreme" is its own fixed shape (A in play with
 * B underneath) and has no per-villain row.
 *
 * One red per screen, so "Start game" is the only red fill here. Every seat
 * is played by the same human (PLAN.md Phase 4, hero seats): the board's
 * perspective follows whoever must act, and each command is still issued as
 * the player the engine names.
 */

import Phaser from "phaser";
import type { AnyCard, CardId, Deck, Scenario } from "@mc/content";
import { POOL_CARDS, POOL_DEPS, POOL_SCENARIOS, POOL_STARTER_DECKS, POOL_VERSION } from "../content/pool.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTextInput, fitText, label, paintDotGrid } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { ListScroll } from "../view/list-scroll.js";
import { deckOptionsOf, preconDecks, type DeckOption } from "../view/deck-list-model.js";
import { corePlayerFromDeck } from "../view/deck-seat.js";
import { seatOptions, type SeatOption } from "../view/seats.js";
import { EMPTY_ROSTER_FILTER, heroRosterMatches, scenarioRosterMatches, type RosterFilter } from "../view/roster-filter.js";
import { titleLayout } from "../view/title-layout.js";
import type { Rect } from "../view/layout.js";
import { parseSeed, rollSeed } from "../view/seed.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { titleFocusOrder } from "../view/screen-focus.js";
import { appSession, deckStorage } from "../session.js";
import type { DecksSceneData } from "./decks.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

type Difficulty = "standard" | "expert" | "extreme";
type VillainVersion = "A" | "B";

/** The default seat: the first Core precon, as a `Deck` id — unchanged from before decks existed, so "just press Start" still seats the same hero. */
const DEFAULT_SEAT_DECK_ID = preconDecks(POOL_VERSION)[0]!.id as string;

/** Standard/expert everywhere; Breakout's own multi-villain challenge adds "extreme" (docs/phase7-wave1.md §4.6). */
function difficultyOptionsFor(scenario: Scenario | undefined): readonly Difficulty[] {
  return scenario?.multipleVillains ? ["standard", "expert", "extreme"] : ["standard", "expert"];
}

/** One roster row, common to both the Scenario and Heroes lists — the shared shape `#renderRosterRow` draws. */
interface RosterRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly selected: boolean;
  /** Why this row cannot be chosen. Null when it can (a seatable-with-a-warning deck is still clickable). */
  readonly blockedBy: string | null;
  /** A non-blocking note, shown on Inspect ("Playable, but <cards> do nothing yet."). */
  readonly warning: string | null;
  readonly onClick: () => void;
  readonly inspectCardId: CardId | null;
  /** What Inspect's primary button says when this row can be chosen ("Play this villain", "Take this seat", …). */
  readonly chooseLabel: string;
}

export class TitleScene extends Phaser.Scene {
  #scenarioId = POOL_SCENARIOS[0]!.id as string;
  #difficulty: Difficulty = "standard";
  /** Breakout only: a per-villain override of `#difficulty`'s uniform version, in `scenario.multipleVillains.villains` order. Null means "use the uniform default for every villain". */
  #villainVersions: readonly VillainVersion[] | null = null;
  /** Deck ids (`Deck.id`, e.g. `precon:core-spider-man-justice` or a saved deck's own id) — a single namespace covering every seat option. */
  #seats: string[] = [DEFAULT_SEAT_DECK_ID];
  /**
   * Saved and imported decks, loaded once per visit (`deckStorage().list()`),
   * refreshed on return from the Decks screen since Phaser reruns `create()`
   * on every visit to this scene instance (PLAN.md Phase 4, "reset per-visit
   * state in `create()`"). Precons are never stored here — `preconDecks()`
   * derives them fresh every time, the same as `deckOptionsOf` always does.
   */
  #savedDecks: readonly Deck[] = [];
  /** S8: "the query persists while the player moves between setup steps, and resets on a new setup" — a fresh visit to this scene resets both. */
  #scenarioFilter: RosterFilter = EMPTY_ROSTER_FILTER;
  #heroFilter: RosterFilter = EMPTY_ROSTER_FILTER;
  /**
   * A fresh seed per visit. The engine shuffles every deck from `config.seed`
   * at setup, so a constant default meant every new game dealt the same opening
   * hand — the shuffle was real, the randomness wasn't. "New seed" re-rolls it,
   * and the number stays on screen so a game can be replayed deliberately.
   */
  #seed = rollSeed();
  /** The seed field's raw text, which can be empty or mid-edit even when `#seed` — the last legal value — isn't. */
  #seedText = String(this.#seed);
  #buttons: McButton[] = [];
  /**
   * DOM text fields survive a rebuild (detach-before-sweep, reattach-after —
   * they're the app's one bit of real DOM, and destroying/recreating them
   * mid-keystroke would drop focus and the cursor). The two rosters do *not*:
   * `ui/virtual-list.ts`'s own doc comment explains why persisting a
   * `McVirtualList` across a rebuild is the wrong pattern here. Only their
   * scroll position (`#scenarioScroll`/`#heroScroll`) survives.
   */
  #seedInput: McTextInput | null = null;
  #scenarioSearchInput: McTextInput | null = null;
  #heroSearchInput: McTextInput | null = null;
  #scenarioList: McVirtualList | null = null;
  #heroList: McVirtualList | null = null;
  #scenarioScroll = new ListScroll();
  #heroScroll = new ListScroll();
  #status: Phaser.GameObjects.Text | null = null;
  #starting = false;
  /**
   * The game in progress when this screen opened, if any. Games are saved as
   * they're played, so a refresh lands here with the game still there to pick
   * back up. Looked up asynchronously; the screen draws without it first.
   */
  #continuable: SaveMeta | null = null;
  /** Keyboard and pad, over `titleFocusOrder`. Each rebuild hands it the controls it drew. */
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    // `this.scale` is the game's own emitter, so it outlives every scene
    // restart. Title is a singleton instance Phaser reuses across every
    // "play again" round trip through Board/GameOver (`create()` runs again
    // on the same object), so a listener added here and never removed isn't
    // the dead-scene leak the other four scenes had — it's the same live
    // scene registered N times, calling `#rebuild` N times per resize after N
    // restarts. Still a real, growing leak on the one emitter every other
    // scene was already audited for, so it's removed the same way.
    this.scale.on("resize", this.#rebuild, this);
    // The Inspect sheet reports its answer back rather than deciding: it names
    // the row, and the row's own handler applies whatever choosing it means.
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
      this.#seedInput?.destroy();
      this.#seedInput = null;
      this.#scenarioSearchInput?.destroy();
      this.#scenarioSearchInput = null;
      this.#heroSearchInput?.destroy();
      this.#heroSearchInput = null;
      this.#scenarioList?.destroy();
      this.#scenarioList = null;
      this.#heroList?.destroy();
      this.#heroList = null;
    });
    this.#route = new FocusRoute(this, {
      // Inspect owns input while it is open over this screen, and a text
      // field while the player is typing in it — or "i"/arrows would act on
      // the board instead.
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        (this.#seedInput?.focused ?? false) ||
        (this.#scenarioSearchInput?.focused ?? false) ||
        (this.#heroSearchInput?.focused ?? false),
      onPage: (direction) => this.#listForFocus()?.scrollByPage(direction),
      onHomeEnd: (edge) => {
        const list = this.#listForFocus();
        if (!list) return;
        if (edge === "home") list.scrollToStart();
        else list.scrollToEnd();
      },
    });
    this.#continuable = null;
    this.#savedDecks = [];
    this.#scenarioFilter = EMPTY_ROSTER_FILTER;
    this.#heroFilter = EMPTY_ROSTER_FILTER;
    this.#scenarioScroll = new ListScroll();
    this.#heroScroll = new ListScroll();
    // Phaser reuses this instance, and a successful Start or Continue leaves
    // `#starting` set as the scene hands off to the Board — so coming back from
    // Game Over's "Back to title" found Start stuck on "Starting…" and Continue
    // disabled, with no way to begin another game.
    this.#starting = false;
    this.#rebuild();
    void appSession()
      .store.latestSave()
      .then((save) => {
        // The scene may have moved on while storage answered.
        if (!save || !this.sys.isActive()) return;
        this.#continuable = save;
        this.#rebuild();
      });
    // Saved/imported decks, re-read on every visit: coming back from the Decks
    // screen (a new deck saved, one deleted, an illegal one fixed) must not
    // show what this scene last saw before that trip.
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#savedDecks = decks;
        this.#rebuild();
      });
  }

  /** Which roster (if either) the currently-focused stop belongs to — for Page Up/Down and Home/End. */
  #listForFocus(): McVirtualList | null {
    const focused = this.#route?.focused ?? null;
    if (focused?.startsWith("scenario:")) return this.#scenarioList;
    if (focused?.startsWith("hero:")) return this.#heroList;
    return null;
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    // The rosters are recreated fresh every rebuild (`ui/virtual-list.ts`),
    // in the normal draw order; only their scroll position survives, in
    // `#scenarioScroll`/`#heroScroll`.
    this.#scenarioList?.destroy();
    this.#scenarioList = null;
    this.#heroList?.destroy();
    this.#heroList = null;

    // The three DOM text fields survive the sweep: detached first so
    // `removeAll(true)` — which destroys every child it holds — doesn't take
    // them with it, then handed back so they still draw.
    const kept = [
      ...(this.#seedInput ? [this.#seedInput.gameObject] : []),
      ...(this.#scenarioSearchInput ? [this.#scenarioSearchInput.gameObject] : []),
      ...(this.#heroSearchInput ? [this.#heroSearchInput.gameObject] : []),
    ];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const deckOptions = this.#deckOptions();
    this.#seats = this.#seats.filter((id) => deckOptions.some((option) => (option.deck.id as string) === id));
    if (this.#seats.length === 0) this.#seats = [DEFAULT_SEAT_DECK_ID];

    const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === this.#scenarioId);
    const difficultyChoices = difficultyOptionsFor(scenario);
    if (!difficultyChoices.includes(this.#difficulty)) this.#difficulty = "standard";
    const showVillainVersions = scenario?.multipleVillains !== undefined && this.#difficulty !== "extreme";
    if (!showVillainVersions) this.#villainVersions = null;

    const layout = titleLayout({ width, height, continuable: this.#continuable !== null, showVillainVersions });
    const { pad, left, column } = layout;
    const phone = layout.formFactor === "phone";
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    const titleSize = phone ? 38 : Math.min(92, Math.round(width / 10), Math.round(height * 0.085));
    this.add
      .text(left, pad + 8, "MARVEL\nCHAMPIONS", {
        ...textStyle(typeRole.screenTitle, surface.ink.hex),
        fontSize: `${titleSize}px`,
        lineSpacing: -Math.round(titleSize * 0.16),
      })
      .setLetterSpacing(2);

    if (layout.continueRow) {
      const save = this.#continuable!;
      const rect = layout.continueRow;
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: continueLabel(save),
          type: typeRole.rowTitle,
          rect,
          enabled: !this.#starting,
          onClick: () => void this.#resume(save.id),
        }),
      );
      this.#stops.set("continue", { rect, activate: () => void this.#resume(save.id) });
    }

    // Scenario roster.
    label(this, left, layout.scenarioSearch.y - 16, "Scenario", typeRole.label, surface.ink.hex, ink.label);
    const scenarioRows = this.#scenarioRows(scenario);
    this.#drawSearchField(layout.scenarioSearch, "scenario-search", this.#scenarioFilter.text, "search scenarios, villains, packs…", (value) => {
      this.#scenarioFilter = { text: value };
      this.#scenarioScroll.reset();
      this.#rebuild();
    }, (input) => (this.#scenarioSearchInput = input), this.#scenarioSearchInput);
    this.#scenarioList = this.#drawRoster(layout.scenarioList, scenarioRows, this.#scenarioScroll, "scenario", () => {
      this.#scenarioFilter = EMPTY_ROSTER_FILTER;
      this.#scenarioSearchInput?.setValue("");
      this.#rebuild();
    });

    // Difficulty.
    label(this, left, layout.difficulty.y - 16, "Difficulty", typeRole.label, surface.ink.hex, ink.label);
    this.#drawChoiceRow(layout.difficulty, difficultyChoices.map((difficulty) => ({
      id: difficulty,
      text: difficulty,
      selected: this.#difficulty === difficulty,
      onClick: () => {
        this.#difficulty = difficulty;
        this.#rebuild();
      },
    })), "difficulty");

    if (layout.villainVersions && scenario?.multipleVillains) {
      label(this, left, layout.villainVersions.y - 16, "Villain versions", typeRole.label, surface.ink.hex, ink.label);
      this.#drawVillainVersions(layout.villainVersions, scenario);
    }

    // Heroes roster.
    label(this, left, layout.heroSearch.y - 16, `Heroes — ${this.#seats.length} seat${this.#seats.length === 1 ? "" : "s"}, all played by you`, typeRole.label, surface.ink.hex, ink.label);
    const seating = new Map(seatOptions(deckOptions, this.#seats, CARDS_BY_ID).map((o) => [o.deckId, o]));
    const heroRows = this.#heroRows(deckOptions, seating);
    this.#drawSearchField(layout.heroSearch, "hero-search", this.#heroFilter.text, "search heroes, aspects, decks…", (value) => {
      this.#heroFilter = { text: value };
      this.#heroScroll.reset();
      this.#rebuild();
    }, (input) => (this.#heroSearchInput = input), this.#heroSearchInput);
    this.#heroList = this.#drawRoster(layout.heroList, heroRows, this.#heroScroll, "hero", () => {
      this.#heroFilter = EMPTY_ROSTER_FILTER;
      this.#heroSearchInput?.setValue("");
      this.#rebuild();
    });

    const openDecks = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      this.scene.start(SCENES.decks);
    };
    if (layout.manageDecksRow) {
      this.#buttons.push(new McButton(this, { kind: "secondary", label: "Manage decks…", type: typeRole.rowTitle, rect: layout.manageDecksRow, onClick: openDecks }));
      this.#stops.set("manage-decks", { rect: layout.manageDecksRow, activate: openDecks });
    }

    // Seed.
    label(this, left, layout.seed.y - 16, "seed", typeRole.label, surface.ink.hex, ink.label);
    if (this.#seedInput) this.#seedInput.layout(layout.seed);
    else {
      this.#seedInput = new McTextInput(this, {
        rect: layout.seed,
        value: this.#seedText,
        type: typeRole.mono,
        numeric: true,
        maxLength: 9,
        placeholder: "seed",
        onChange: (value) => {
          this.#seedText = value;
          const parsed = parseSeed(value);
          if (parsed !== null) this.#seed = parsed;
          this.#status?.setText(value.length > 0 && parsed === null ? "seed must be a whole number" : "");
        },
      });
    }
    this.#stops.set("seed", { rect: layout.seed, activate: () => this.#seedInput?.focus() });
    const newSeed = (): void => {
      this.#seed = rollSeed();
      this.#seedText = String(this.#seed);
      this.#seedInput?.setValue(this.#seedText);
      this.#status?.setText("");
    };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "New seed", type: typeRole.label, rect: layout.newSeed, onClick: newSeed }));
    this.#stops.set("new-seed", { rect: layout.newSeed, activate: newSeed });
    if (layout.manageDecksInline) {
      this.#buttons.push(new McButton(this, { kind: "secondary", label: "Manage decks…", type: typeRole.rowTitle, rect: layout.manageDecksInline, onClick: openDecks }));
      this.#stops.set("manage-decks", { rect: layout.manageDecksInline, activate: openDecks });
    }

    // The one red on this screen: the single forward action.
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Starting…" : "Start game",
        type: typeRole.barTitle,
        rect: layout.start,
        enabled: !this.#starting,
        onClick: () => void this.#start(),
      }),
    );
    this.#stops.set("start", { rect: layout.start, activate: () => void this.#start() });

    this.#status = this.add
      .text(left, layout.start.y + layout.start.height + 10, "", textStyle(typeRole.body, accent.redDeep.hex))
      .setWordWrapWidth(column);

    // Last, so the focus ring sits over the control it frames.
    this.#route?.set(
      titleFocusOrder({
        continuable: this.#continuable !== null,
        scenarioIds: scenarioRows.map((r) => r.id),
        difficulties: difficultyChoices,
        ...(showVillainVersions && scenario?.multipleVillains
          ? { villainVersionIds: scenario.multipleVillains.villains.map((v) => v.villainCardId as string) }
          : {}),
        deckIds: heroRows.map((r) => r.id),
        manageDecks: true,
      }),
      this.#stops,
    );
  }

  #drawSearchField(
    rect: Rect,
    stopId: string,
    value: string,
    placeholder: string,
    onChange: (value: string) => void,
    setRef: (input: McTextInput) => void,
    existing: McTextInput | null,
  ): void {
    if (existing) existing.layout(rect);
    else setRef(new McTextInput(this, { rect, value, placeholder, onChange }));
    this.#stops.set(stopId, {
      rect,
      activate: () => (stopId === "scenario-search" ? this.#scenarioSearchInput : this.#heroSearchInput)?.focus(),
    });
  }

  /** One roster's list: a `McVirtualList` of plain rows, an empty-result message with Clear, and a focus stop per row (S8: "every row is a logical focus stop", not just the visible ones). */
  #drawRoster(rect: Rect, rows: readonly RosterRow[], scroll: ListScroll, focusPrefix: "scenario" | "hero", onClear: () => void): McVirtualList {
    if (rows.length === 0) {
      this.add.text(rect.x + 10, rect.y + 10, "No matches.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
      const clearRect: Rect = { x: rect.x + 10, y: rect.y + 34, width: 100, height: hit.target };
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "Clear", type: typeRole.label, rect: clearRect, onClick: onClear }));
      this.#stops.set(`${focusPrefix}-clear`, { rect: clearRect, activate: onClear });
    }
    const renderRow = (index: number, rowRect: Rect): VirtualListRow => this.#renderRosterRow(rowRect, rows[index]!);
    // Plain rows draw no interactive object of their own (`#renderRosterRow`
    // is Graphics/Text only), so a tap/click is answered here rather than by
    // a per-row `McButton` — `onRowActivate` hit-tests the pointer against
    // the visible row window itself.
    const onRowActivate = (index: number): void => {
      const row = rows[index];
      if (row && !row.blockedBy) row.onClick();
    };
    const list = new McVirtualList(this, { rect, rowHeight: hit.target, count: rows.length, renderRow, scroll, onRowActivate });
    rows.forEach((row, index) => {
      const ensureVisible = (): void => list.scrollIntoView(index);
      this.#stops.set(`${focusPrefix}:${row.id}`, {
        rect: () => list.rectFor(index),
        activate: () => (row.blockedBy ? undefined : row.onClick()),
        ...(row.inspectCardId ? { inspect: () => this.#inspectRow(row) } : {}),
        ensureVisible,
      });
    });
    return list;
  }

  #renderRosterRow(rect: Rect, row: RosterRow): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const inner: Rect = { x: rect.x + 4, y: rect.y + 2, width: rect.width - 8, height: rect.height - 4 };
    const g = this.add.graphics();
    const dim = row.blockedBy ? 0.5 : 1;
    if (row.selected) {
      g.fillStyle(surface.ink.hex, 1).fillRect(inner.x, inner.y, inner.width, inner.height);
    } else {
      g.fillStyle(surface.paper.hex, 1).fillRect(inner.x, inner.y, inner.width, inner.height);
      g.lineStyle(2, surface.ink.hex, dim).strokeRect(inner.x + 1, inner.y + 1, inner.width - 2, inner.height - 2);
    }
    objects.push(g);
    const textColor = row.selected ? surface.paper.hex : surface.ink.hex;
    const title = this.add.text(inner.x + 10, inner.y + 4, row.title, textStyle(typeRole.rowTitle, textColor, dim));
    fitText(title, inner.width - 20);
    objects.push(title);
    // One subtitle line, never two drawn at the same y: a blocked row shows why it can't be seated, a seatable row
    // with unscripted cards shows that warning instead of its source line (Inspect still reads the full detail), and
    // everything else shows its source. Fitted to the row, since a warning naming a card is far wider than a row.
    const subtitleText = row.blockedBy ?? row.warning ?? row.subtitle;
    const subtitleColor = row.blockedBy ? accent.heroRed.hex : row.warning ? signal.caution.hex : textColor;
    const subtitle = label(this, inner.x + 10, inner.y + 4 + title.height + 2, subtitleText, typeRole.label, subtitleColor, row.blockedBy || row.warning ? 1 : ink.label * dim);
    fitText(subtitle, inner.width - 20);
    objects.push(subtitle);
    return { objects };
  }

  #drawChoiceRow(
    rect: Rect,
    rows: readonly { id: string; text: string; selected: boolean; onClick: () => void }[],
    focusPrefix: "difficulty",
  ): void {
    const cellWidth = (rect.width - (rows.length - 1) * 6) / rows.length;
    rows.forEach((row, index) => {
      const cell: Rect = { x: rect.x + index * (cellWidth + 6), y: rect.y, width: cellWidth, height: rect.height };
      this.#buttons.push(new McButton(this, { kind: "secondary", label: row.text, type: typeRole.rowTitle, rect: cell, selected: row.selected, onClick: row.onClick }));
      this.#stops.set(`${focusPrefix}:${row.id}`, { rect: cell, activate: row.onClick });
    });
  }

  /** Breakout's per-villain A/B row: a small button per villain, defaulting to the difficulty's uniform version. Only called once `scenario.multipleVillains` is known present. */
  #drawVillainVersions(rect: Rect, scenario: Scenario): void {
    const villains = scenario.multipleVillains?.villains;
    if (!villains) return;
    const uniform: VillainVersion = this.#difficulty === "expert" ? "B" : "A";
    const current = this.#villainVersions ?? villains.map(() => uniform);
    const cellWidth = (rect.width - (villains.length - 1) * 6) / villains.length;
    villains.forEach((villain, index) => {
      const card = CARDS_BY_ID.get(villain.villainCardId as string);
      const name = card?.name ?? (villain.villainCardId as string);
      const cell: Rect = { x: rect.x + index * (cellWidth + 6), y: rect.y, width: cellWidth, height: rect.height };
      const version = current[index] ?? uniform;
      const toggle = (): void => {
        const next = [...current];
        next[index] = next[index] === "A" ? "B" : "A";
        this.#villainVersions = next;
        this.#rebuild();
      };
      this.#buttons.push(new McButton(this, { kind: "secondary", label: `${name} · ${version}`, type: typeRole.label, rect: cell, onClick: toggle }));
      this.#stops.set(`villain-version:${villain.villainCardId as string}`, { rect: cell, activate: toggle });
    });
  }

  #scenarioRows(current: Scenario | undefined): readonly RosterRow[] {
    void current;
    return POOL_SCENARIOS.filter((s) => scenarioRosterMatches(s, CARDS_BY_ID.get(s.villainCardId as string), [], this.#scenarioFilter)).map((s) => {
      const villain = CARDS_BY_ID.get(s.villainCardId as string);
      return {
        id: s.id as string,
        title: s.name,
        subtitle: villain ? `${villain.name} · ${s.packCode}` : s.packCode,
        selected: this.#scenarioId === (s.id as string),
        blockedBy: null,
        warning: null,
        onClick: () => {
          this.#scenarioId = s.id as string;
          this.#rebuild();
        },
        inspectCardId: s.villainCardId,
        chooseLabel: "Play this villain",
      };
    });
  }

  #heroRows(deckOptions: readonly DeckOption[], seating: ReadonlyMap<string, SeatOption>): readonly RosterRow[] {
    return deckOptions
      .filter((option) => heroRosterMatches(option.deck, CARDS_BY_ID.get(option.deck.identityCardId as string), this.#heroFilter))
      .map((option) => {
        const deckId = option.deck.id as string;
        const seated = this.#seats.includes(deckId);
        const blockedBy = seating.get(deckId)?.blockedBy ?? null;
        const warning = seating.get(deckId)?.warning ?? null;
        const sourceText = option.deck.source.kind === "precon" ? "Precon" : option.deck.source.kind === "imported" ? "Imported" : "Built";
        return {
          id: deckId,
          title: option.deck.name.split(" — ")[0]!,
          subtitle: `${sourceText} · ${option.identityName ?? "unknown identity"}`,
          selected: seated,
          blockedBy,
          warning,
          onClick: () => {
            if (seated) {
              if (this.#seats.length > 1) this.#seats = this.#seats.filter((id) => id !== deckId);
            } else if (!blockedBy) {
              this.#seats = [...this.#seats, deckId];
            }
            this.#rebuild();
          },
          inspectCardId: option.deck.identityCardId,
          chooseLabel: seated ? "Remove this seat" : "Take this seat",
        };
      });
  }

  #onInspectChoose(rowId: string): void {
    // Every row's own onClick already handles choosing; Inspect's sheet
    // reports the same row id back, so the same lookup works for both lists.
    const row = [...this.#scenarioRows(undefined), ...this.#heroRows(this.#deckOptions(), new Map(seatOptions(this.#deckOptions(), this.#seats, CARDS_BY_ID).map((o) => [o.deckId, o])))].find(
      (r) => r.id === rowId,
    );
    if (row && !row.blockedBy) row.onClick();
  }

  #inspectRow(row: RosterRow): void {
    if (!row.inspectCardId) return;
    const card = CARDS_BY_ID.get(row.inspectCardId as string);
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    // `note` replaces the choice buttons on the sheet (it's drawn where they
    // would be), so a row that's seatable — even with a warning — must still
    // get `choice`, never `note`: the warning is already visible on the
    // roster row itself (`#renderRosterRow`), which is enough to satisfy
    // "seatable with a visible warning" without hiding "Take this seat".
    this.scene.launch(SCENES.inspect, {
      card: { cardId: row.inspectCardId, face },
      ...(row.blockedBy ? { note: row.blockedBy } : { choice: { optionId: row.id, label: row.chooseLabel } }),
    });
  }

  async #resume(gameId: string): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    this.#rebuild();
    const { store } = appSession();
    await store.resume(gameId);
    if (store.state.status === "failed") {
      // A save that no longer replays has been retired by the host; say why, and drop the button.
      this.#starting = false;
      this.#continuable = null;
      this.#rebuild();
      this.#status?.setText(store.state.error ?? "that game could not be resumed");
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.board);
  }

  async #start(): Promise<void> {
    if (this.#starting) return;
    // The seed is the engine's shuffle key: a field the player has typed a
    // non-number into (or emptied) must never fall back to some other value
    // and quietly start a game that can't be reproduced from what's on screen.
    if (parseSeed(this.#seedText) === null) {
      this.#status?.setText("seed must be a whole number");
      return;
    }
    this.#starting = true;
    this.#rebuild();

    const deckOptions = this.#deckOptions();
    const seatedDecks = this.#seats.map((deckId) => deckOptions.find((option) => (option.deck.id as string) === deckId)!);
    const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === this.#scenarioId);
    const showVillainVersions = scenario?.multipleVillains !== undefined && this.#difficulty !== "extreme";
    const { store } = appSession();
    await store.start({
      scenarioId: this.#scenarioId,
      difficulty: this.#difficulty,
      // A precon seat still goes through `{ starterDeckId }` — the same shape
      // every existing save and test already uses — rather than re-deriving
      // its card list from `Deck.cards`, which would be a second way to say
      // the same seat (`view/deck-seat.ts`).
      players: seatedDecks.map((option) =>
        option.deck.source.kind === "precon" ? { starterDeckId: option.deck.source.starterDeckId as string } : corePlayerFromDeck(option.deck),
      ),
      seed: this.#seed,
      ...(showVillainVersions && this.#villainVersions ? { villainVersions: this.#villainVersions } : {}),
    });

    if (store.state.status === "failed") {
      this.#starting = false;
      this.#rebuild();
      // `Setup` only ever offers seatable decks, dimming the rest — but the
      // engine is still the one enforcing `requireLegalDecks` (PLAN.md Phase
      // 9: "no opt-out"), so a refusal is still possible (a pool update
      // landing between this screen loading and Start being pressed). Route
      // straight to fixing the named deck rather than only showing the
      // engine's message here.
      const setupError = store.state.setupError;
      if (setupError?.code === "illegal_deck") {
        const seat = setupError.illegalDecks[0];
        const deckId = seat ? this.#seats[seat.seatIndex] : undefined;
        this.scale.off("resize", this.#rebuild, this);
        this.scene.start(SCENES.decks, {
          focusDeckId: deckId ?? null,
          message: seat?.problems[0]?.message ?? store.state.error ?? "This deck is not legal.",
        } satisfies DecksSceneData);
        return;
      }
      // The engine's own message: nothing here rephrases a setup failure.
      this.#status?.setText(store.state.error ?? "setup failed");
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.board);
  }

  /** Every seat option, precons then saved/imported decks. */
  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(this.#savedDecks, POOL_CARDS, POOL_VERSION, POOL_DEPS);
  }
}

/** Every card in the app's pool by id, so a scenario or a deck can show the card it names. */
const CARDS_BY_ID = new Map<string, AnyCard>(POOL_CARDS.map((card) => [card.id as string, card]));

/** "Continue — Rhino · Spider-Man · round 4". Names from content, never from the save's own text. */
function continueLabel(save: SaveMeta): string {
  const scenario = POOL_SCENARIOS.find((candidate) => (candidate.id as string) === save.config.scenarioId)?.name ?? save.config.scenarioId;
  const heroes = save.config.players
    .map((player) => {
      // A seat is a starter deck or a custom deck; a custom one is named by its identity card.
      if (!("starterDeckId" in player)) {
        return CARDS_BY_ID.get(player.identityCardId as string)?.name ?? player.identityCardId;
      }
      return POOL_STARTER_DECKS.find((deck) => (deck.id as string) === player.starterDeckId)?.name.split(" — ")[0] ?? player.starterDeckId;
    })
    .join(", ");
  return `Continue — ${scenario} · ${heroes} · round ${save.round}`;
}
