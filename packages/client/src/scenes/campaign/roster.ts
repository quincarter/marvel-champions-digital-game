/**
 * C02 — Sign the roster: the seats a fresh campaign run is signed with. Pre-filled with the box's own cast
 * (`story.castIdentityIds`' precons); any seat can be reassigned to any legal deck through this screen's own picker
 * (there is no separate tile for it — design tiles show only the filled state).
 *
 * `view/campaign-roster-model.ts` owns every rule this screen enforces (1-4 seats, unique identities, deck
 * legality); this scene only turns a tap into a seat edit or the sign action.
 *
 * The whole screen is one Lit panel over the canvas (`dom/dom-region.ts`, `mc-sheet`): the page, the four seats and the
 * deck picker over them, each drawn by a module in `roster/`. This scene is the thin owner: the panel, the focus route,
 * the search worker, the card hover popover, signing and navigation.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSearchField, McSheet } from "@mc/ui";
import type { CardId, Deck } from "@mc/content";
import { POOL_VERSION, currentCardsById, currentPool, currentPoolKey } from "../../content/pool.js";
import { surface } from "../../tokens.js";
import { campaignFrame } from "../../ui/campaign-chrome.js";
import { cssOf } from "../../ui/theme.js";
import { isDesktopType } from "../../ui/desktop-type.js";
import { HoverPreview, screenHoverArea } from "../../ui/card-hover-preview.js";
import { DeckSearchClient } from "../../view/deck-search-client.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignService, deckStorage, appSession } from "../../session.js";
import { rollSeed } from "../../view/seed.js";
import {
  ROSTER_SEAT_COUNT,
  pickerSearchDocumentsOf,
  preconRosterOf,
  rosterModelOf,
  type RosterDeckOption,
} from "../../view/campaign-roster-model.js";
import { storyFor } from "../../campaign/story.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import { bindTextFieldEscape } from "../text-field-escape.js";
import { tableRulesOf } from "../../settings.js";
import { applyDeckSwaps, nameConflictsOf, unresolvedConflicts, type NameConflict } from "../../view/name-conflicts.js";
import { openNameConflictSheet } from "../name-conflict.js";
import { rebuildOnPackChange } from "../../ui/pack-redraw.js";
import { t } from "../../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../../language-change.js";
import { DomRegion, renderNow } from "../../dom/dom-region.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import { SheetBuilder } from "../../dom/sheet-builder.js";
import { SheetGlyphs } from "../../dom/sheet-glyphs.js";
import type { Rect } from "../../view/layout.js";
import { PICKER_LIST, PICKER_SEARCH, type RosterCtx, type RosterState } from "./roster/context.js";
import { drawPage } from "./roster/page.js";
import { drawPicker, pickerDebugRows, pickerHoverCards } from "./roster/picker.js";
import type { CampaignRosterData } from "./routes.js";

export class CampaignRosterScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  #region: DomRegion<McSheet> | null = null;
  readonly #leases = new PictureLeases();
  readonly #actions = new Map<string, () => void>();
  readonly #inspects = new Map<string, () => void>();
  readonly #stops = new Map<string, FocusStop>();
  readonly #obstacles: Rect[] = [];
  readonly #state: RosterState = {
    seats: Array.from({ length: ROSTER_SEAT_COUNT }, () => null),
    savedDecks: [],
    model: null,
    balanced: null,
    campaignId: "",
    expertCampaign: false,
    pickerSeat: null,
    pickerQuery: "",
    pickerRanking: null,
    pickerRecs: null,
    pickerView: null,
    pickerTop: 0,
    signing: false,
    error: null,
    pairs: [],
    phoneLayout: false,
    swaps: [],
    kept: [],
  };
  /** Ranks the picker's decks for the query off the main thread. */
  readonly #search = new DeckSearchClient();
  #searchDocsKey = "";
  #hover: HoverPreview | null = null;
  #ctx!: RosterCtx;
  #alive = false;
  /** The scrollers whose scroll place has been restored and listened to. */
  readonly #placed = new WeakSet<HTMLElement>();

  constructor() {
    super(SCENES.campaignRoster);
  }

  create(data: CampaignRosterData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#alive = true;
    this.#region = null;
    this.scale.on("resize", this.#rebuild, this);
    this.#glyphs = new SheetGlyphs(
      this,
      () => this.#rebuild(),
      () => this.#obstacles,
    );
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    const offLanguage = onLanguageChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#rebuild, this);
      offArt();
      offLanguage();
      this.#search.destroy();
      this.#hover?.destroy();
      this.#hover = null;
      this.#glyphs.dispose();
      this.#leases.dispose();
      this.#region = null;
    });
    const covered = (): boolean => this.scene.isActive(SCENES.nameConflict) || this.scene.isActive(SCENES.inspect);
    this.#hover = new HoverPreview(this, {
      cardIds: () => (this.#state.pickerSeat === null ? new Map() : pickerHoverCards(this.#ctx)),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#searchFocused() }),
    });
    // Before the route, so the press that puts the caret in the field is not also the one that takes it out.
    bindTextFieldEscape(this, () => this.#field(), covered);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => covered() || this.#searchFocused(),
      // Start and A with nothing focused: Sign & open issue #1 (never behind the open deck picker).
      primary: () => (this.#state.pickerSeat === null ? "cta" : null),
      onCancel: () => this.#onCancel(),
      onPage: (direction) =>
        this.#scroller()?.scrollBy({ top: direction * (this.#state.pickerView?.listRect.height ?? 0) * 0.9 }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onHomeEnd: (edge) => {
        const scroller = this.#scroller();
        if (scroller) scroller.scrollTop = edge === "home" ? 0 : scroller.scrollHeight;
      },
    });
    this.#ctx = {
      scene: this,
      glyphs: this.#glyphs,
      leases: this.#leases,
      actions: this.#actions,
      inspects: this.#inspects,
      stops: this.#stops,
      obstacles: this.#obstacles,
      state: this.#state,
      scroller: () => this.#scroller(),
      openPicker: (seat) => this.#openPicker(seat),
      closePicker: () => this.#closePicker(),
      removeSeat: (seat) => {
        this.#state.seats[seat - 1] = null;
        this.#closePicker();
      },
      pickDeck: (seat, option) => this.#pickDeck(seat, option),
      onSign: () => this.#onSign(),
      onCancel: () => this.#onCancel(),
      syncSearch: (options) => this.#syncSearchDocuments(options),
      focusSearch: () => this.#focusSearch(),
      inspectIdentity: (cardId) => this.#inspectIdentity(cardId),
    };
    const state = this.#state;
    state.campaignId = data.campaignId;
    state.expertCampaign = data.expertCampaign ?? false;
    state.balanced = data.balanced ?? null;
    state.seats = preconRosterOf(
      (storyFor(state.campaignId)?.castIdentityIds ?? []) as readonly CardId[],
      POOL_VERSION,
    );
    state.pickerSeat = null;
    state.pickerTop = 0;
    state.pickerQuery = "";
    state.pickerRanking = null;
    state.pickerRecs = null;
    state.pickerView = null;
    this.#search.cancel();
    state.signing = false;
    state.error = null;
    state.swaps = [];
    state.kept = [];
    state.model = rosterModelOf(state.seats, currentPool());
    void this.#loadSavedDecks();
    // Installed packs load a moment after boot, and again after an install or removal: a pack hero joins the picker (and
    // its seat's legality is checked again) when they do (#978).
    rebuildOnPackChange(this, () => this.#rebuild());
    this.#rebuild();
    fadeScreenIn(this);
  }

  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(PICKER_LIST) ?? null;
  }

  #field(): McSearchField | null {
    return (this.#region?.element.elementOf(PICKER_SEARCH) as McSearchField | null) ?? null;
  }

  #searchFocused(): boolean {
    return this.#field()?.focused ?? false;
  }

  #focusSearch(): void {
    const field = this.#field();
    if (field) void field.updateComplete.then(() => field.focusInput());
  }

  /** Hands the worker the picker's decks when the list changes, and re-asks the open query of the new list. */
  #syncSearchDocuments(options: readonly RosterDeckOption[]): void {
    const key = currentPoolKey() + ":" + options.map((option) => option.deck.id as string).join("|");
    if (key === this.#searchDocsKey) return;
    this.#searchDocsKey = key;
    this.#search.setDocuments(pickerSearchDocumentsOf(options, currentCardsById()), key);
    const text = this.#state.pickerQuery;
    // After this redraw, not inside it: the answer redraws again.
    if (text.trim() !== "") queueMicrotask(() => this.sys.isActive() && this.#requestSearch(text));
  }

  /** Asks the worker to rank the decks for the text; the picker redraws when the newest answer arrives. An empty text clears at once. */
  #requestSearch(text: string): void {
    if (text.trim() === "") {
      this.#search.cancel();
      this.#state.pickerRanking = null;
      this.#rebuild();
      return;
    }
    this.#search.search(text, (ranked) => {
      if (!this.sys.isActive()) return;
      this.#state.pickerRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#rebuild();
    });
  }

  async #loadSavedDecks(): Promise<void> {
    const decks = await deckStorage().list();
    if (!this.sys.isActive()) return;
    this.#state.savedDecks = decks;
    if (this.#state.pickerSeat !== null) this.#rebuild();
  }

  #resetPickerSearch(): void {
    const state = this.#state;
    state.pickerTop = 0;
    state.pickerQuery = "";
    state.pickerRanking = null;
    this.#search.cancel();
    state.pickerRecs = null;
  }

  #openPicker(seatNumber: number): void {
    this.#state.pickerSeat = seatNumber;
    this.#resetPickerSearch();
    this.#rebuild();
  }

  #closePicker(): void {
    this.#state.pickerSeat = null;
    this.#resetPickerSearch();
    this.#rebuild();
  }

  #pickDeck(seatNumber: number, option: RosterDeckOption): void {
    if (option.blocked) return;
    const state = this.#state;
    const before = state.seats.filter((deck): deck is Deck => deck !== null);
    state.seats[seatNumber - 1] = option.deck;
    // A replacement answered a hero who has now left the table: drop the answers (a hero only joining keeps them).
    const after = state.seats.filter((deck): deck is Deck => deck !== null);
    if (!before.every((deck) => after.some((other) => other.id === deck.id))) {
      state.swaps = [];
      state.kept = [];
    }
    this.#closePicker();
  }

  #onCancel(): void {
    if (this.#state.pickerSeat !== null) {
      this.#closePicker();
      return;
    }
    goToScreen(this, SCENES.campaignCover, { campaignId: this.#state.campaignId });
  }

  /** Y: the hero's identity card in full. */
  #inspectIdentity(cardId: string): void {
    this.scene.launch(SCENES.inspect, { card: { cardId: cardId as CardId, face: { kind: "front" } } });
    this.scene.bringToTop(SCENES.inspect);
  }

  /** The signed decks as the roster stands: each seat's deck with this run's replacements applied. */
  #effectiveDecks(): readonly Deck[] {
    return this.#state.seats
      .filter((deck): deck is Deck => deck !== null)
      .map((deck) => applyDeckSwaps(deck, this.#state.swaps));
  }

  /** Cards that cannot be played beside another seat's hero and have not been answered. */
  #unresolved(): readonly NameConflict[] {
    const found = nameConflictsOf(
      this.#effectiveDecks().map((deck) => ({ deck })),
      currentCardsById(),
      tableRulesOf(appSession().settings),
    );
    return unresolvedConflicts(found, this.#state.kept);
  }

  #openConflictSheet(): void {
    openNameConflictSheet(this, {
      decks: this.#state.seats.filter((deck): deck is Deck => deck !== null),
      swaps: this.#state.swaps,
      kept: this.#state.kept,
      tableRules: tableRulesOf(appSession().settings),
      continueLabel: t("roster.sign.conflictContinue"),
      onChange: (swaps, kept) => {
        this.#state.swaps = swaps;
        this.#state.kept = kept;
        this.#rebuild();
      },
      onContinue: () => void this.#sign(),
    });
  }

  /** "Sign" with a clash still open asks first (the sheet's Continue signs); otherwise signs. */
  #onSign(): void {
    if (this.#state.model?.canSign && this.#unresolved().length > 0) {
      this.#openConflictSheet();
      return;
    }
    void this.#sign();
  }

  #rebuild(): void {
    if (!this.#alive) return;
    const state = this.#state;
    this.#glyphs.reset();
    this.#leases.begin();
    this.#actions.clear();
    this.#inspects.clear();
    this.#stops.clear();
    this.#obstacles.length = 0;
    state.pickerView = null;
    state.model = rosterModelOf(state.seats, currentPool());

    const frame = campaignFrame(this);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    drawPage(this.#ctx, b, frame);
    if (state.pickerSeat !== null) drawPicker(this.#ctx, b, frame, state.pickerSeat);

    // With the deck picker open it is the whole route: nothing behind it can be reached.
    const picks = [...this.#stops.keys()].filter((k) => k.startsWith("pick-"));
    const order =
      state.pickerSeat !== null
        ? picks
        : ["back", ...Array.from({ length: ROSTER_SEAT_COUNT }, (_, i) => `seat-${i + 1}`), "cta"].filter((key) =>
            this.#stops.has(key),
          );
    this.#route?.set(order, new Map(this.#stops));
    this.#mount(frame, b);
    this.#hover?.onDraw();
    if (import.meta.env.DEV) this.#publishDebug();
  }

  /** Hands the built parts to the panel (made once, so the picker's scroll survives a redraw) and renders them now. */
  #mount(frame: { readonly width: number; readonly height: number }, b: SheetBuilder): void {
    const rect: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        // Signing: a second tap must not act.
        if (this.#state.signing) return;
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-inspect", (event) => {
        this.#inspects.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-search", (event) => {
        const { key, value } = (event as CustomEvent<{ key: string; value: string }>).detail;
        if (key !== PICKER_SEARCH || value === this.#state.pickerQuery) return;
        this.#state.pickerQuery = value;
        this.#state.pickerTop = 0;
        const scroller = this.#scroller();
        if (scroller) scroller.scrollTop = 0;
        this.#requestSearch(value);
      });
      this.#leases.watch(element);
      const region = new DomRegion(this, element, rect);
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas; the popover itself is
      // drawn in the canvas, so its box is left out of the panel.
      region.forwardMouseMoves(() => this.#hover?.suppress());
      region.setHoles(() => {
        const popover = this.#hover?.shownRect;
        return popover ? [popover] : [];
      });
      this.#region = region;
    }
    const region = this.#region;
    region.setRect(rect);
    region.element.nodes = b.nodes;
    renderNow(region.element);
    this.#leases.end();
    const scroller = this.#scroller();
    if (scroller && !this.#placed.has(scroller)) {
      scroller.scrollTop = this.#state.pickerTop;
      this.#placed.add(scroller);
      scroller.addEventListener(
        "scroll",
        () => {
          this.#state.pickerTop = scroller.scrollTop;
        },
        { passive: true },
      );
    }
  }

  /** Dev e2e hook (never referenced by product code): the picker's rows and whether it is open, and where its panel sits. */
  #publishDebug(): void {
    (window as unknown as { __mcRosterPickerDebug?: unknown }).__mcRosterPickerDebug = {
      rows: () => pickerDebugRows(this.#ctx).map(({ name, picture, badges }) => ({ name, picture, badges })),
      rowTexts: () => pickerDebugRows(this.#ctx).map(({ name, rect }) => ({ name, rect })),
      open: () => this.#state.pickerSeat !== null,
      panel: () => this.#state.pickerView?.panel ?? null,
    };
  }

  async #sign(): Promise<void> {
    const state = this.#state;
    if (state.signing) return;
    const model = state.model;
    if (!model || !model.canSign) return;
    state.signing = true;
    state.error = null;
    this.#rebuild();
    try {
      // The run's own copy of each deck carries this run's replacements; the saved deck is never modified.
      const seats = this.#effectiveDecks().map((deck) => ({ identityCardId: deck.identityCardId, deck }));
      const tableRules = tableRulesOf(appSession().settings);
      const record = await campaignService().start({
        campaignId: state.campaignId,
        seats,
        ...(state.expertCampaign ? { expertCampaign: true } : {}),
        ...(state.balanced ? { balanced: state.balanced } : {}),
        poolVersion: POOL_VERSION,
        seed: rollSeed(),
        ...(tableRules ? { tableRules } : {}),
      });
      if (!this.sys.isActive()) return;
      goToScreen(this, SCENES.campaignOpener, { runId: record.id });
    } catch (error) {
      state.signing = false;
      state.error = error instanceof Error ? error.message : t("roster.error.fallback");
      this.#rebuild();
    }
  }
}
