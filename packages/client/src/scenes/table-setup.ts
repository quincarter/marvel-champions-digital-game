/**
 * Set up the table (step 4 of 4): difficulty, the modular sets, seating and first player, the encounter deck being built,
 * the game you will get, the seed, and the one red action, "Deal it out", which starts the engine. A thin scene over one
 * custom element, `mc-table-setup-page` (`views/table-setup/`), built of section elements (`components/table-setup/`): it
 * holds the draft, sets the page's properties from the view model, turns the page's `mc-setup` events into changes to the
 * draft, owns the focus route and the card hover popover, and deals. The setup deal animation that follows is its own
 * scene (`setup-deal.ts`) and stays Phaser.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { Deck } from "@mc/content";
import type { InstanceId } from "@mc/engine";
import "../views/table-setup/mc-table-setup-page/mc-table-setup-page";
import type { McSetupSetTile } from "../components/table-setup/mc-setup-set-tile/McSetupSetTile.js";
import type { SetupMode } from "../components/table-setup/shared/setup-events.types.js";
import type { McTableSetupPage } from "../views/table-setup/mc-table-setup-page/mc-table-setup-page.js";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { cssOf } from "../ui/theme.js";
import { surface } from "../tokens.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { defaultFaceFor } from "../art/art-source.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { sheetThemeFor, estimateBangersWidth } from "../ui/campaign-chrome.js";
import { CardEvents } from "../dom/card-events.js";
import { DomRegion } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { settleElements } from "../dom/element-settle.js";
import { bindStopFocus, collectStops, focusStopsOf } from "../dom/element-stops.js";
import { mountElement } from "../dom/element-region.js";
import { houseModularSetIdsOf, withHouseModularSetIds } from "../view/house-modular-sets.js";
import { parseSeed } from "../view/seed.js";
import { setSeed, type SetupDraft } from "../view/setup-draft.js";
import { difficultySetSections, difficultySetsSubtitle } from "../view/difficulty-sets.js";
import { setSheetFor } from "../view/civil-war-builder-model.js";
import { currentCardsById, currentEncounterSets, packNameOf, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { liveWatchDefault } from "../platform/live-watch.js";
import { cardHoverFactor } from "../settings.js";
import { appSession, deckStorage } from "../session.js";
import { reportRoomSetup } from "./room-setup-report.js";
import { leaveRoomSetup, roomSetupActive } from "../view/room-table-setup.js";
import { t } from "../i18n/translate.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { SET_CARDS_ACTION_EVENT, type SetCardsData } from "./set-cards.js";
import type { SeatsData } from "./seats.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import type { InspectData } from "./inspect.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { SCENES } from "./keys.js";
import { loadSetupNames } from "./table-setup/text/lt.js";
import type { Rect } from "../view/layout.js";
import { applySetupEvent, type ChangeHost } from "./table-setup/changes.js";
import { dealIt } from "./table-setup/deal.js";
import { clearDevHook, installDevHook } from "./table-setup/dev-hook.js";
import { scenarioOf, tableModelOf, type TableModel } from "./table-setup/model.js";
import { pageInputOf } from "./table-setup/page-input.js";
import { stopOrderOf } from "./table-setup/stop-order.js";

export interface TableSetupData {
  readonly draft: SetupDraft;
}

/** From this width the page is the wide layout (the ink sidebar beside the body); below it, the phone's single page. */
const WIDE_FROM = 900;
const TOP_BAR_HEIGHT = 64;

/** The product a Standard or Expert set comes from ("Core Set", "The Hood"), by the set's own pack. */
const setProductName = (setId: string): string => {
  const code = POOL_ENCOUNTER_SETS.find((set) => (set.id as string) === setId)?.packCodes[0];
  return code ? packNameOf(code as string) : setId;
};

export class TableSetupScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #saved: readonly Deck[] = [];
  #seedText = "";
  /** "Let people watch this game" (#876): starts from the Always allow setting; sent on the config at Deal it out. */
  #watchable = liveWatchDefault();
  #starting = false;
  #leaving = false;
  #alive = false;
  #status = "";
  #seedFocused = false;
  #openGroups = new Map<string, boolean>();
  #model: TableModel | null = null;
  #region: DomRegion<McTableSetupPage> | null = null;
  #page: McTableSetupPage | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #route: FocusRoute | null = null;
  #stops: ReadonlyMap<string, FocusStop> = new Map();
  /** Counts draws, so a draw that was overtaken while the page rendered does not wire stale stops. */
  #drawn = 0;
  readonly #leases = new PackLeases();

  constructor() {
    super(SCENES.setup);
  }

  init(data: TableSetupData): void {
    // The scene is reused: the toggle starts from the setting every time, not from the last visit's tick.
    this.#watchable = liveWatchDefault();
    this.#draft = data.draft;
    this.#seedText = String(data.draft.seed);
  }

  create(): void {
    this.#alive = true;
    this.#starting = false;
    this.#leaving = false;
    this.#status = "";
    this.#seedFocused = false;
    this.#saved = [];
    this.#openGroups = new Map();
    this.#stops = new Map();
    reportRoomSetup("table", this.#draft.scenarioId as string);
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    rebuildOnPackChange(this, () => this.#compose());
    this.scale.on("resize", this.#compose, this);
    const artOff = onArtChange(() => this.#alive && this.#compose());
    const languageOff = onLanguageChange(() => this.#alive && this.#compose());
    resetHoverCards(this);
    this.#mountPage();
    this.game.events.on(SET_CARDS_ACTION_EVENT, this.#onSetCardsAction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      artOff();
      languageOff();
      this.#cards?.destroy();
      this.#cards = null;
      this.#hover?.destroy();
      this.#hover = null;
      this.game.events.off(SET_CARDS_ACTION_EVENT, this.#onSetCardsAction, this);
      this.scale.off("resize", this.#compose, this);
      this.#leases.dispose();
      this.#region = null;
      this.#page = null;
      clearDevHook();
    });
    // A pad that put the caret in the seed field can take it out again (B, A or Start).
    bindTextFieldEscape(
      this,
      () => (this.#seedFocused ? { focused: true, blur: () => this.#page?.blurSeed() } : null),
      () => this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.setCards),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.setCards) || this.#seedFocused,
      onCancel: () => this.#back(),
      // Hold Y (or E) enlarges the focused set's picture, as the desktop hover does; a tap opens its cards.
      onInspectZoom: (zooming) => this.#setZoom(zooming),
      zoomEnabled: () => cardHoverFactor(appSession().settings.cardHoverScale) !== null,
      // Start / Menu (and A with nothing focused) deals: the way forward on this screen.
      primary: () => (this.#stops.has("deal-it-out") && !this.#starting && !this.#leaving ? "deal-it-out" : null),
    });
    this.#compose();
    // The Spanish set and product names are a data module: the screen draws again once they are in.
    void loadSetupNames().then((ok) => ok && this.#alive && this.#compose());
    fadeScreenIn(this);
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#saved = decks;
        this.#compose();
      });
  }

  /** Mounts the page once: its events become draft changes, its card pictures reach the hover popover and Inspect. */
  #mountPage(): void {
    const { region, element } = mountElement(this, "mc-table-setup-page", this.#full());
    this.#region = region;
    this.#page = element;
    element.addEventListener("mc-setup", (e) => {
      if (!this.#leaving) applySetupEvent(this.#changes, e.detail);
    });
    element.addEventListener("mc-image-error", (e) => {
      const { key, src } = (e as CustomEvent<{ key?: string; src?: string | null }>).detail;
      if (key !== undefined) refreshPackArt(key, src ?? undefined);
    });
    // A tile's native focus (a screen reader, a click) moves the keyboard route there too.
    bindStopFocus(element, (key) => this.#route?.focusKey(key));
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) => this.#inspect(cardId, face);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
  }

  #full(): Rect {
    const { width, height } = this.scale.gameSize;
    return { x: 0, y: 0, width, height };
  }

  #mode(): SetupMode {
    return this.scale.gameSize.width >= WIDE_FROM ? "wide" : "phone";
  }

  /** What the page's events change in the screen: the draft, the seed field's text, the watch choice, where to go. */
  readonly #changes: ChangeHost = {
    draft: () => this.#draft,
    setDraft: (draft) => (this.#draft = draft),
    scenario: () => scenarioOf(this.#draft),
    allowMoreModular: () => appSession().settings.allowExtraModularSets,
    redraw: () => this.#compose(),
    openGroups: () => this.#openGroups,
    rerolled: (seed) => {
      this.#seedText = String(seed);
      this.#status = "";
    },
    toggleWatch: () => {
      this.#watchable = !this.#watchable;
      this.#compose();
    },
    openSetCards: (setId) => this.#openSetCards(setId),
    openSetsSheet: () => this.#openSetsSheet(),
    editScenario: () => {
      this.scale.off("resize", this.#compose, this);
      goToScreen(this, SCENES.civilWarBuilder, { draft: this.#draft, step: 5 } satisfies CivilWarBuilderData);
    },
    deal: () => void this.#deal(),
    back: () => this.#back(),
    seedInput: (value) => this.#seedInput(value),
    seedFocus: (focused) => (this.#seedFocused = focused),
  };

  #back(): void {
    if (this.#starting || this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#compose, this);
    // Room mode (#880): there is no hero step (players bring their own decks), so Back returns to the lobby.
    if (roomSetupActive()) {
      leaveRoomSetup();
      goToScreen(this, SCENES.roomLobby);
      return;
    }
    goToScreen(this, SCENES.seats, { draft: this.#draft } satisfies SeatsData);
  }

  /** The seed field's text: digits only, nine at most; the field is set straight if it held a character it cannot take. */
  #seedInput(value: string): void {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    this.#seedText = digits;
    const parsed = parseSeed(digits);
    if (parsed !== null) this.#draft = setSeed(this.#draft, parsed);
    const status = digits.length > 0 && parsed === null ? t("tableSetup.seedError") : "";
    if (status !== this.#status || digits !== value) {
      this.#status = status;
      this.#compose();
    }
  }

  /** Where the dark mode tab leaves the top bar's title room (the one rule every panel bar follows). */
  #title(mode: SetupMode): { readonly drop: number; readonly max: number } {
    const { width } = this.scale.gameSize;
    const phone = mode === "phone";
    const size = phone ? 22 : 28;
    const back = phone ? 44 : Math.max(64, estimateBangersWidth(t("tableSetup.back"), 22) + 26);
    const left = (phone ? 12 : 22) + back + (phone ? 12 : 16);
    const room = width - (phone ? 12 : 22) - (phone ? 40 : 120) - left - 8;
    const { drop, maxRight } = sheetThemeFor(this, {
      width,
      textLeft: left,
      textRight: left + room,
      textTop: TOP_BAR_HEIGHT / 2 - size / 2,
      textHeight: size,
      barHeight: TOP_BAR_HEIGHT,
    });
    return { drop, max: maxRight === null ? 0 : Math.max(40, Math.min(room, maxRight - left)) };
  }

  /** Sets the page's properties from the draft, then, once it has rendered, hands the route its stops and the hover its cards. */
  #compose(): void {
    const page = this.#page;
    if (!this.#alive || this.#leaving || !page) return;
    // Turning the "extra modular sets" setting off takes the sets beyond the count out of the table.
    if (!appSession().settings.allowExtraModularSets && houseModularSetIdsOf(this.#draft).length > 0)
      this.#draft = withHouseModularSetIds(this.#draft, []);
    const mode = this.#mode();
    const m = tableModelOf(this.#draft, this.#saved);
    this.#model = m;
    this.#region?.setRect(this.#full());
    resetHoverCards(this);
    this.#leases.begin();
    page.mode = mode;
    page.input = pageInputOf(
      m,
      {
        seedText: this.#seedText,
        watchable: this.#watchable,
        starting: this.#starting,
        status: this.#status,
        openGroups: this.#openGroups,
        title: this.#title(mode),
      },
      this.#leases,
    );
    this.#leases.end();
    const draw = ++this.#drawn;
    void settleElements(page).then(() => draw === this.#drawn && this.#alive && this.#wire(m));
  }

  /** After a render: the route's stops (live rects, from the page's own `data-stop` parts), the hover and the dev hook. */
  #wire(m: TableModel): void {
    const page = this.#page;
    const region = this.#region;
    if (!page || !region) return;
    const rectOf = (target: Element): Rect => region.rectOf(target);
    this.#stops = focusStopsOf(page, rectOf);
    this.#route?.set(stopOrderOf([...this.#stops.keys()]), this.#stops);
    this.#hover?.onDraw();
    installDevHook({
      model: m,
      stops: () => this.#stops,
      viewport: () => (page.scroller ? rectOf(page.scroller) : null),
      watchable: () => this.#watchable,
      hover: () => this.#hover?.shownKey ?? null,
      token: () => {
        const probe = page.tokenProbe();
        if (!probe) return null;
        const drawn = rectOf(probe.drawn);
        const at = rectOf(probe.at);
        return {
          index: probe.index,
          x: drawn.x + drawn.width / 2,
          y: drawn.y + drawn.height / 2,
          at: { x: at.x + at.width / 2, y: at.y + at.height / 2 },
          flying: probe.flying,
        };
      },
    });
  }

  /** A hold or right-click on a card picture: the card's own Inspect sheet. */
  #inspect(cardId: string, face: unknown): void {
    const card = currentCardsById().get(cardId);
    if (!card) return;
    this.scene.launch(SCENES.inspect, {
      card: { cardId: cardId as never, face: (face ?? defaultFaceFor(card)) as never },
    } satisfies InspectData);
    this.scene.bringToTop(SCENES.inspect);
  }

  /** Hold Y: the focused modular tile's picture enlarged beside it, following the focus while held. */
  #setZoom(zooming: boolean): void {
    if (!zooming) return this.#hover?.unpin();
    this.#hover?.pin(() => {
      const page = this.#page;
      const region = this.#region;
      const key = this.#route?.focused;
      if (!page || !region || !key?.startsWith("modular:")) return null;
      const stop = collectStops(page).find((s) => s.key === key);
      const host = (stop?.element.getRootNode() as ShadowRoot | undefined)?.host as McSetupSetTile | undefined;
      const picture = host?.tile?.picture;
      const pic = host?.shadowRoot?.querySelector(".pic");
      const area = screenHoverArea(this, this.input.activePointer);
      return picture && pic && area
        ? {
            id: picture.cardId as InstanceId,
            rect: region.rectOf(pic),
            area,
            plain: { ...(picture.face ? { face: picture.face } : {}) },
          }
        : null;
    });
  }

  /** The "cards in this set" sheet over this screen, with "Add this set" / "Remove this set" at its foot. */
  #openSetCards(setId: string): void {
    const option = this.#model?.modularOptions.find((o) => o.id === setId);
    if (!option) return;
    this.scene.launch(SCENES.setCards, {
      setId,
      action: {
        label: t(option.selected ? "tableSetup.removeSet" : "tableSetup.addSet"),
        enabled: !(option.disabledReason !== null && !option.selected),
      },
      from: SCENES.setup,
    } satisfies SetCardsData);
    this.scene.bringToTop(SCENES.setCards);
  }

  /** "Cards" on a Standard/Expert set row: one sheet with every set the rows offer, each under where it comes from. */
  #openSetsSheet(): void {
    const rows = this.#model?.setChoices ?? [];
    const ctx = { cards: currentCardsById(), encounterSets: currentEncounterSets() };
    const sections = difficultySetSections(rows, setProductName, (id) => setSheetFor(ctx, id).totalCards);
    if (sections.length === 0) return;
    this.scene.launch(SCENES.setCards, {
      setId: sections[0]!.setId,
      title: t(rows.length > 1 ? "tableSetup.setsBoth" : "tableSetup.setsStandard"),
      subtitle: difficultySetsSubtitle(rows),
      sections,
      from: SCENES.setup,
    } satisfies SetCardsData);
    this.scene.bringToTop(SCENES.setCards);
  }

  /** The sheet's "Add this set" / "Remove this set": the same toggle a tap on the tile makes. */
  #onSetCardsAction(setId: string): void {
    if (!this.sys.isActive()) return;
    applySetupEvent(this.#changes, { type: "modular-toggle", id: setId });
  }

  async #deal(): Promise<void> {
    const m = this.#model;
    if (!m || this.#starting || this.#leaving) return;
    await dealIt({
      scene: this,
      draft: this.#draft,
      seedText: this.#seedText,
      players: m.players,
      deckOptions: m.deckOptions,
      watchable: this.#watchable,
      blocked: m.dealBlocked,
      working: (on) => {
        this.#starting = on;
        this.#compose();
      },
      leaving: () => (this.#leaving = true),
      stopRedraw: () => this.scale.off("resize", this.#compose, this),
      status: (text) => {
        this.#status = text === "seed" ? t("tableSetup.seedError") : text;
        this.#compose();
      },
    });
  }
}
