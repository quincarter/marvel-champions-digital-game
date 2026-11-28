/**
 * Set up the table (step 4 of 4): difficulty, the modular sets, seating and first player, the encounter deck being built,
 * the game you will get, the seed, and the one red action, "Deal it out", which starts the engine. A thin scene over five
 * sections (`table-setup/`): it holds the draft, draws one sheet of Lit panels over the canvas from the view model, wires the
 * presses to the draft, owns the focus route, the card hover popover and the first player token's own panel, and deals.
 * The setup deal animation that follows is its own scene (`setup-deal.ts`) and stays Phaser.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet, McTextField } from "@mc/ui";
import type { Deck } from "@mc/content";
import { rebuildOnPackChange } from "../ui/pack-redraw.js";
import { cssOf } from "../ui/theme.js";
import { surface } from "../tokens.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { houseModularSetIdsOf, withHouseModularSetIds } from "../view/house-modular-sets.js";
import { parseSeed } from "../view/seed.js";
import { setSeed, type SetupDraft } from "../view/setup-draft.js";
import { tableSetupFocusOrder } from "../view/screen-focus.js";
import { optionActionsOf } from "../view/setup-options.js";
import { EDIT_SCENARIO_ID } from "../view/civil-war-table-summary.js";
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
import { FocusRoute } from "./focus-route.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { SCENES } from "./keys.js";
import { loadSetupNames } from "./table-setup/text/lt.js";
import type { Rect } from "../view/layout.js";
import type { InstanceId } from "@mc/engine";
import { Registry, type Frame } from "./table-setup/shared/frame.js";
import { scenarioOf, tableModelOf, type TableModel } from "./table-setup/model.js";
import { sectionInputsOf } from "./table-setup/page/inputs.js";
import { pageLayoutOf } from "./table-setup/page/layout.js";
import { drawWidePage } from "./table-setup/page/wide-page.js";
import { drawCompactPage, PAGE } from "./table-setup/page/compact-page.js";
import { GRID } from "./table-setup/modulars/modulars.js";
import { eventsOf } from "./table-setup/page/events.js";
import type { SectionEvents } from "./table-setup/page/sections.js";
import { dealIt } from "./table-setup/page/deal.js";
import { FirstPlayerTokenLayer } from "./table-setup/seating/token-layer.js";
import { spotKey } from "./table-setup/seating/seating.js";
import { clearDevHook, installDevHook } from "./table-setup/dev-hook.js";

export interface TableSetupData {
  readonly draft: SetupDraft;
}

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
  #reg = new Registry();
  #sheet: DomRegion<McSheet> | null = null;
  #tokens: FirstPlayerTokenLayer | null = null;
  #hover: HoverPreview | null = null;
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  #on: SectionEvents | null = null;
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
    this.#sheet = null;
    this.#tokens = null;
    reportRoomSetup("table", this.#draft.scenarioId as string);
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    appSession().music?.playTitle();
    rebuildOnPackChange(this, () => this.#compose());
    this.#glyphs = new SheetGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#compose, this);
    const artOff = onArtChange(() => this.#alive && this.#compose());
    const languageOff = onLanguageChange(() => this.#alive && this.#compose());
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.game.events.on(SET_CARDS_ACTION_EVENT, this.#onSetCardsAction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      artOff();
      languageOff();
      this.#hover?.destroy();
      this.#hover = null;
      this.game.events.off(SET_CARDS_ACTION_EVENT, this.#onSetCardsAction, this);
      this.scale.off("resize", this.#compose, this);
      this.#glyphs.dispose();
      this.#leases.dispose();
      this.#tokens?.destroy();
      this.#tokens = null;
      this.#sheet = null;
      clearDevHook();
    });
    // A pad that put the caret in the seed field can take it out again (B, A or Start).
    bindTextFieldEscape(
      this,
      () => (this.#seedFocused ? { focused: true, blur: () => this.#seedField()?.blurInput() } : null),
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
      primary: () => (this.#reg.stops.has("deal-it-out") && !this.#starting && !this.#leaving ? "deal-it-out" : null),
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

  #seedField(): McTextField | null {
    return (this.#sheet?.element.elementOf("seed") as McTextField | null | undefined) ?? null;
  }

  #live = (key: string): Rect | null => {
    const el = this.#sheet?.element.elementOf(key);
    return el && this.#sheet ? this.#sheet.rectOf(el) : null;
  };

  /** Mounts the sheet's region once: presses reach the registry, a hold reaches Inspect, the seed field reports its caret. */
  #wire(element: McSheet, rect: Rect): DomRegion<McSheet> {
    element.addEventListener("mc-activate", (e) => {
      if (this.#leaving) return;
      this.#reg.actions.get((e as CustomEvent<{ key: string }>).detail.key)?.();
    });
    element.addEventListener("mc-inspect", (e) => {
      if (!this.#leaving) this.#reg.inspects.get((e as CustomEvent<{ key: string }>).detail.key)?.();
    });
    element.addEventListener("mc-input", (e) => {
      const { value } = (e as CustomEvent<{ value: string }>).detail;
      const digits = value.replace(/\D/g, "").slice(0, 9);
      this.#seedText = digits;
      const parsed = parseSeed(digits);
      if (parsed !== null) this.#draft = setSeed(this.#draft, parsed);
      const status = digits.length > 0 && parsed === null ? t("tableSetup.seedError") : "";
      // The field shows what it was given unless a character it cannot take was typed (then it is set straight).
      if (status !== this.#status || digits !== value) {
        this.#status = status;
        this.#compose();
      }
    });
    element.addEventListener("mc-field-focus", (e) => {
      this.#seedFocused = (e as CustomEvent<{ focused: boolean }>).detail.focused;
    });
    // A tile's native button took focus: the keyboard route follows, so Enter, Space and Inspect act on that tile alone.
    element.addEventListener("mc-tile-focus", (e) =>
      this.#route?.focusKey((e as CustomEvent<{ key: string }>).detail.key),
    );
    element.addEventListener("mc-image-error", (e) => {
      const { key, src } = (e as CustomEvent<{ key?: string; src?: string | null }>).detail;
      if (key !== undefined) refreshPackArt(key, src ?? undefined);
    });
    // The first player's token follows its seat as the page scrolls.
    element.addEventListener("scroll", () => this.#placeToken(), true);
    const region = new DomRegion<McSheet>(this, element, rect);
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    return region;
  }

  /** Puts the token on the first player's spot, from the spot's live rect. */
  #placeToken(): void {
    const first = this.#model?.seats.find((s) => s.selected);
    this.#tokens?.place(first?.index ?? null, first ? this.#live(spotKey(first.index)) : null);
  }

  /** Draws the whole screen from the draft: model, layout, one sheet, then the focus order, hover and token. */
  #compose(): void {
    if (!this.#alive || this.#leaving) return;
    // Turning the "extra modular sets" setting off takes the sets beyond the count out of the table.
    if (!appSession().settings.allowExtraModularSets && houseModularSetIdsOf(this.#draft).length > 0)
      this.#draft = withHouseModularSetIds(this.#draft, []);
    const { width, height } = this.scale.gameSize;
    const m = tableModelOf(this.#draft, this.#saved);
    this.#model = m;
    const inputs = sectionInputsOf(m, {
      seedText: this.#seedText,
      watchable: this.#watchable,
      starting: this.#starting,
      status: this.#status || (m.dealBlocked ?? ""),
      openGroups: this.#openGroups,
    });
    const picked = pageLayoutOf(width, height, m, inputs.modulars);
    this.#reg = new Registry();
    this.#reg.live = this.#live;
    this.#reg.reveal = (key) => this.#sheet?.element.elementOf(key)?.scrollIntoView({ block: "nearest" });
    this.#glyphs.reset();
    this.#leases.begin();
    resetHoverCards(this);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const frame = (builder: SheetBuilder): Frame => ({
      b: builder,
      reg: this.#reg,
      leases: this.#leases,
      into: frame,
    });
    const on = eventsOf({
      draft: () => this.#draft,
      setDraft: (draft) => (this.#draft = draft),
      scenario: () => scenarioOf(this.#draft),
      allowMoreModular: () => appSession().settings.allowExtraModularSets,
      redraw: () => this.#compose(),
      openGroups: this.#openGroups,
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
      focusSeed: () => this.#seedField()?.focusInput(),
    });
    this.#on = on;
    const size = { width, height };
    if (picked.kind === "wide") drawWidePage(frame(b), this.#glyphs, this, picked.layout, size, inputs, on);
    else drawCompactPage(frame(b), this.#glyphs, this, picked.layout, size, inputs, on);

    const full: Rect = { x: 0, y: 0, width, height };
    const sheet = (this.#sheet ??= this.#wire(document.createElement("mc-sheet") as McSheet, full));
    sheet.setRect(full);
    sheet.element.nodes = b.nodes;
    renderNow(sheet.element);
    this.#tokens ??= new FirstPlayerTokenLayer(this, full);
    this.#placeToken();

    const compact = picked.kind === "compact";
    this.#route?.set(
      tableSetupFocusOrder({
        difficulties: m.difficultyCards.map((c) => c.id),
        optionActions: optionActionsOf(m.allOptionRows),
        hasTowerDefenseSetupDamage: m.towerDefense,
        hasModularRandom: m.randomSets,
        modularSetIds: compact && m.cw ? [EDIT_SCENARIO_ID] : m.modularOptions.map((o) => o.id),
        ...(compact
          ? {
              modularStopIds: m.cw
                ? [`modular:${EDIT_SCENARIO_ID}`]
                : [...this.#reg.stops.keys()].filter(
                    (k) => /^modular(group)?:/.test(k) && !k.includes(":cards") && k !== "modular:random-draw",
                  ),
            }
          : {}),
        hoodSetIds: m.hoodOptions.map((o) => o.id),
        firstPlayerOptionIds: [...m.seats.map((c) => `${c.index}`), "random"],
      }),
      this.#reg.stops,
    );
    this.#leases.end();
    this.#hover?.onDraw();
    installDevHook({
      model: m,
      stops: () => this.#reg.stops,
      live: this.#live,
      viewport: () => this.#live(compact ? PAGE : GRID),
      watchable: () => this.#watchable,
      hover: () => this.#hover?.shownKey ?? null,
      token: () => this.#tokens?.probe() ?? null,
    });
  }

  /** The card pictures on screen now, each clipped to the scroller it moves in, for the hover popover. */
  #shown(face: { readonly key: string; readonly scroll: string | null }): Rect | null {
    const rect = this.#live(face.key);
    const view = face.scroll ? this.#live(face.scroll) : null;
    return rect && view ? clipHoverRect(rect, view) : rect;
  }

  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    this.#reg.faces.forEach((face, index) => {
      const rect = this.#shown(face);
      if (rect)
        found.set(hoverSlotOf(face.cardId, `card${index}`), {
          ...rect,
          cardId: face.cardId,
          ...(face.face ? { face: face.face } : {}),
          through: true,
        });
    });
    return found;
  }

  /** Hold Y: the focused modular tile's picture enlarged beside it, following the focus while held. */
  #setZoom(zooming: boolean): void {
    if (!zooming) return this.#hover?.unpin();
    this.#hover?.pin(() => {
      const stop = this.#route?.focused;
      const key = stop ? this.#reg.zoom.get(stop) : undefined;
      const face = this.#reg.faces.find((f) => f.key === key);
      const rect = face ? this.#shown(face) : null;
      const area = screenHoverArea(this, this.input.activePointer);
      return face && rect && area
        ? { id: face.cardId as InstanceId, rect, area, plain: { ...(face.face ? { face: face.face } : {}) } }
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
    this.#on?.modulars.toggle(setId);
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
