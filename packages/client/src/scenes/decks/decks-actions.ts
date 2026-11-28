/**
 * What a press on Decks & Collection does: the `mc-decks` events its sections raise, as changes to the screen state
 * (`DecksState`) and the screen changes they cause (Check, the builder, Play, Inspect, import, duplicate, delete). Nothing
 * is decided here that the engine view did not answer: Play and Add do nothing for a deck the status says cannot be seated or
 * added. The scene keeps the parts that need the route and hands them over as `DecksHost`.
 */
import type Phaser from "phaser";
import type { AnyCard, Deck, DeckId } from "@mc/content";
import { POOL_VERSION, currentCardsById, currentPool } from "../../content/pool.js";
import type { DecksEvent } from "../../components/decks/decks.types.js";
import { t } from "../../i18n/translate.js";
import { openExternal } from "../../platform/platform.js";
import { deckStorage } from "../../session.js";
import { goToScreen } from "../../ui/transitions.js";
import type { DeckActionId } from "../../view/deck-actions.js";
import { duplicateDeck } from "../../view/deck-builder-model.js";
import { exportDecklistText } from "../../view/deck-import-model.js";
import {
  addCommunityDeck,
  communityCredit,
  communityMetaCandidates,
  communityStatusText,
  type CommunityOffer,
} from "../../view/community-decks-model.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { villainsFacedOf } from "../../view/deck-insights.js";
import { deckReasonText } from "../../view/deck-reason.js";
import { deckStatusOf } from "../../view/deck-status.js";
import { cardTitleOf, deckMetaCandidates } from "../../view/deck-title.js";
import type { DecksTab } from "../../view/decks-layout.js";
import type { DeckBuilderSceneData } from "../deck-builder.js";
import type { DeckActionsSheetData, DeckActionsSheet } from "../deck-actions-sheet.js";
import type { DeckCheckSceneData } from "../deck-check.js";
import { SCENES } from "../keys.js";
import type { PlayerStatsData } from "../player-stats.js";
import type { TitleSceneData } from "../title.js";
import type { DecksBook } from "./decks-book.js";
import { DecksImport } from "./decks-import.js";
import { deckArtOf, pressDeckChip } from "./decks-list-model.js";
import { pressPoolChip } from "./decks-pool-model.js";
import type { DecksSceneData, DecksState } from "./decks-state.js";

/** What the scene does that the presses need: redraw, focus, the tabs the layout shows. */
export interface DecksHost {
  rebuild(): void;
  focusKey(key: string): void;
  /** Whether the narrow layout shows its tabs now. */
  tabsShown(): boolean;
  /** The pad paging scrolls this list. */
  isActive(): boolean;
}

export class DecksActions {
  readonly imports: DecksImport;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly st: DecksState,
    private readonly book: DecksBook,
    private readonly host: DecksHost,
  ) {
    this.imports = new DecksImport(st, () => host.rebuild());
  }

  /** The listed deck with this id (an offer for a community deck), by id; null once it is gone. */
  deckFor(deckId: string): { readonly option: DeckOption; readonly offer?: CommunityOffer } | null {
    const offer = this.book.communityOffers().find((o) => (o.option.deck.id as string) === deckId);
    if (offer) return { option: offer.option, offer };
    const option = this.book.deckOptions().find((o) => (o.deck.id as string) === deckId);
    return option ? { option } : null;
  }

  /** The selected deck, with its offer when it is a community deck. */
  selected(): { readonly option: DeckOption; readonly offer?: CommunityOffer } | null {
    return this.st.selectedDeckId === null ? null : this.deckFor(this.st.selectedDeckId);
  }

  /** One event of the page. */
  handle(event: DecksEvent): void {
    const st = this.st;
    switch (event.type) {
      case "action":
        return this.#action(event.action);
      case "tab":
        return this.setTab(event.tab);
      case "deck":
        return event.via === "inspect" ? this.#inspectDeckId(event.deckId) : this.tapDeck(event.deckId);
      case "search":
        if (event.list === "pool") {
          if (event.text !== st.poolSearchText) {
            st.poolSearchText = event.text;
            st.poolSearch.request(event.text);
          }
        } else if (event.text !== st.filter.text) {
          st.filter = { ...st.filter, text: event.text };
          this.book.requestSearch(event.text);
        }
        return;
      case "chip":
        if (event.list === "deck") pressDeckChip(st, this.book, event.id);
        else pressPoolChip(st, event.id);
        return this.host.rebuild();
      case "input":
        if (event.field === "paste") st.pasteText = event.text;
        else st.marvelcdbText = event.text;
        return;
      case "card":
        return event.via === "inspect" ? this.#inspectCardId(event.cardId) : this.#showCardId(event.cardId, false);
    }
  }

  #action(action: Extract<DecksEvent, { type: "action" }>["action"]): void {
    const st = this.st;
    const now = this.selected();
    switch (action) {
      case "back":
        return goToScreen(this.scene, SCENES.title);
      case "player-stats":
        return goToScreen(this.scene, SCENES.playerStats, { from: SCENES.decks } satisfies PlayerStatsData);
      case "new-deck":
        return goToScreen(this.scene, SCENES.deckBuilder, {} satisfies DeckBuilderSceneData);
      case "filters-toggle":
        st.filtersExpanded = !st.filtersExpanded;
        return this.host.rebuild();
      case "ie-paste-toggle":
      case "ie-marvelcdb-toggle": {
        const which = action === "ie-paste-toggle" ? "paste" : "marvelcdb";
        st.importExportOpen = st.importExportOpen === which ? null : which;
        return this.host.rebuild();
      }
      case "ie-export":
        if (now) this.exportToClipboard(now.option.deck);
        return;
      case "paste-import":
        return void this.imports.paste();
      case "marvelcdb-import":
        return void this.imports.marvelcdb();
      case "pool-filters-toggle":
        st.poolFiltersOpen = !st.poolFiltersOpen;
        return this.host.rebuild();
      case "pane-deck":
      case "pane-games":
        return this.setPaneTab(action === "pane-deck" ? "deck" : "games");
      case "games-against":
        return this.#stepVillain();
      case "games-open":
        if (now)
          goToScreen(this.scene, SCENES.deckBuilder, {
            deck: now.option.deck,
            railTab: "games",
          } satisfies DeckBuilderSceneData);
        return;
      case "card-back":
        return this.closePaneCard(false);
      case "card-inspect":
        if (st.paneCard) this.#inspectCard(st.paneCard);
        return;
      case "stats-check":
        if (now) this.openDeckCheck(now.option.deck);
        return;
      case "stats-edit":
        if (now) goToScreen(this.scene, SCENES.deckBuilder, { deck: now.option.deck } satisfies DeckBuilderSceneData);
        return;
      case "stats-delete":
        return this.#confirmDelete(now?.option.deck ?? null);
      case "stats-duplicate":
        if (now) this.#duplicate(now.option.deck);
        return;
      case "stats-play":
        if (now?.option.seatable) this.#playDeck(now.option.deck);
        return;
      case "stats-add":
        if (now?.offer && now.offer.lock === null && now.offer.option.legal) this.#addCommunityDeck(now.offer);
        return;
      case "stats-preview":
        return this.setTab("cards");
      case "stats-copy-link":
        if (now?.offer) this.#copyLink(now.offer);
        return;
      case "stats-open-link":
        if (now?.offer) openExternal(now.offer.entry.url);
        return;
    }
  }

  /** A tap on a deck row selects it; the three-pane layout also opens its Check (#966), a narrow one its actions (#958). */
  tapDeck(deckId: string): void {
    const found = this.deckFor(deckId);
    if (!found) return;
    this.selectDeck(deckId);
    if (this.host.tabsShown()) this.#openDeckActions(deckId);
    else if (!found.offer) this.openDeckCheck(found.option.deck);
  }

  /** A pad or the keyboard only selects (a narrow layout opens the actions), so walking the list never leaves. */
  keyDeck(deckId: string): void {
    this.selectDeck(deckId);
    if (this.host.tabsShown()) this.#openDeckActions(deckId);
  }

  selectDeck(deckId: string): void {
    this.st.selectedDeckId = deckId;
    this.st.paneCard = null;
    this.host.rebuild();
  }

  setTab(tab: DecksTab): void {
    const st = this.st;
    if (tab === st.activeTab) return;
    st.activeTab = tab;
    st.listTop += 1;
    st.poolTop += 1;
    this.host.rebuild();
  }

  setPaneTab(tab: "deck" | "games"): void {
    // Only while the tabs are on screen (not under a card, a community deck, or another narrow tab).
    if (this.st.paneTab === tab || this.st.paneCard !== null) return;
    this.st.paneTab = tab;
    this.host.rebuild();
    this.host.focusKey(`pane:${tab}`);
  }

  #stepVillain(): void {
    const faced = this.st.insights ? villainsFacedOf(this.st.insights) : [];
    if (faced.length < 2) return;
    const at = faced.indexOf(this.st.againstVillain ?? faced[0]!);
    this.st.againstVillain = faced[(at + 1) % faced.length]!;
    this.host.rebuild();
    this.host.focusKey("games-against");
  }

  /** Puts `card` in the stats pane (the narrow layout Stats tab). From a pad or the keyboard (`byFocus`) the focus goes to its way back. */
  showPaneCard(card: AnyCard, byFocus: boolean): void {
    const st = this.st;
    // A community deck pane has no card view: the card opens in Inspect.
    if (this.selected()?.offer) return this.#inspectCard(card);
    st.paneCard = card;
    st.paneCardDeckId = st.selectedDeckId;
    if (this.host.tabsShown() && st.activeTab !== "stats") st.activeTab = "stats";
    this.host.rebuild();
    if (byFocus) this.host.focusKey("card-back");
  }

  #showCardId(cardId: string, byFocus: boolean): void {
    const card = currentCardsById().get(cardId);
    if (card) this.showPaneCard(card, byFocus);
  }

  closePaneCard(byFocus: boolean): void {
    const st = this.st;
    const card = st.paneCard;
    st.paneCard = null;
    // On the narrow layout the card came from the Cards tab: back there, on it.
    if (this.host.tabsShown()) st.activeTab = "cards";
    this.host.rebuild();
    if (card && byFocus) this.host.focusKey(`pool-card:${card.id as string}`);
  }

  inspectCard(card: AnyCard): void {
    this.#inspectCard(card);
  }

  #inspectCard(card: AnyCard): void {
    this.scene.scene.launch(SCENES.inspect, { card: { cardId: card.id, face: { kind: "front" } } });
  }

  #inspectCardId(cardId: string): void {
    const card = currentCardsById().get(cardId);
    if (card) this.#inspectCard(card);
  }

  #inspectDeckId(deckId: string): void {
    const found = this.deckFor(deckId);
    if (found) this.inspectDeck(found.option);
  }

  inspectDeck(option: DeckOption): void {
    const card = currentCardsById().get(option.deck.identityCardId as string);
    const face =
      card?.type === "villain"
        ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const)
        : ({ kind: "hero" } as const);
    const note =
      (option.checking ? t("room.picker.checking") : deckReasonText(option.blockedReason)) ?? option.warning ?? null;
    this.scene.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId, face },
      ...(note ? { note } : {}),
    });
  }

  /** Opens Deck check (W1) over this deck, returning here on Back. */
  openDeckCheck(deck: Deck): void {
    // Back lands on this deck again, selected, wherever it sits in the list.
    const returnTo = { scene: SCENES.decks, data: { focusDeckId: deck.id as string } satisfies DecksSceneData };
    goToScreen(this.scene, SCENES.deckCheck, { deck, returnTo } satisfies DeckCheckSceneData);
  }

  /** "Play this deck" (W9): hands the deck to the existing setup flow with it preselected for seat 1. */
  #playDeck(deck: Deck): void {
    goToScreen(this.scene, SCENES.title, {
      initialSeatDeckId: deck.id as string,
      initialSeatDeck: deck,
    } satisfies TitleSceneData);
  }

  #confirmDelete(deck: Deck | null): void {
    const st = this.st;
    if (!deck || deck.source.kind === "precon") return;
    if (st.deleteArmedId === (deck.id as string)) {
      st.deleteArmedId = null;
      void this.#delete(deck.id);
      return;
    }
    st.deleteArmedId = deck.id as string;
    st.status = { text: t("decks.stats.confirmMessage", { name: deck.name }), tone: "error" };
    this.host.rebuild();
  }

  async #delete(id: DeckId): Promise<void> {
    this.st.status = null;
    await deckStorage().remove(id);
    this.st.savedDecks = await deckStorage().list();
    this.host.rebuild();
  }

  #duplicate(deck: Deck): void {
    const st = this.st;
    if (st.busy) return;
    st.busy = true;
    void (async () => {
      const copy = duplicateDeck(
        deck,
        crypto.randomUUID(),
        new Date().toISOString(),
        st.savedDecks.map((saved) => saved.name),
      );
      await deckStorage().put(copy);
      st.savedDecks = await deckStorage().list();
      st.selectedDeckId = copy.id as string;
      // Saved decks list after every precon: bring the copy into view, as an import does, on a list that holds it.
      st.scrollToDeckId = copy.id as string;
      this.book.setList(null);
      st.status = { text: `Duplicated as "${copy.name}".`, tone: "success" };
      st.busy = false;
      this.host.rebuild();
    })();
  }

  /** Adds the player own editable copy of a community deck and selects it. */
  #addCommunityDeck(offer: CommunityOffer): void {
    const st = this.st;
    if (st.busy) return;
    st.busy = true;
    void (async () => {
      const copy = addCommunityDeck(offer.entry, {
        poolVersion: POOL_VERSION,
        now: () => new Date().toISOString(),
        newId: () => crypto.randomUUID(),
        existingNames: st.savedDecks.map((deck) => deck.name),
      });
      await deckStorage().put(copy);
      st.savedDecks = await deckStorage().list();
      st.selectedDeckId = copy.id as string;
      st.scrollToDeckId = copy.id as string;
      this.book.setList(null);
      st.status = {
        text: t("decks.community.added", { name: copy.name, credit: communityCredit(offer.entry) }),
        tone: "success",
      };
      st.busy = false;
      this.host.rebuild();
    })();
  }

  #copyLink(offer: CommunityOffer): void {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    const done = (text: string, tone: "success" | "error"): void => {
      this.st.status = { text, tone };
      this.host.rebuild();
    };
    if (!clipboard?.writeText) return done(t("decks.community.noClipboard", { url: offer.entry.url }), "error");
    clipboard.writeText(offer.entry.url).then(
      () => done(t("decks.community.copied", { name: offer.entry.name }), "success"),
      () => done(t("decks.community.copyFailed", { url: offer.entry.url }), "error"),
    );
  }

  exportToClipboard(deck: Deck): void {
    const text = exportDecklistText(deck, currentPool());
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      this.st.status = {
        text: "Clipboard access isn't available here — open this deck in the builder to read its cards instead.",
        tone: "error",
      };
      this.host.rebuild();
      return;
    }
    clipboard.writeText(text).then(
      () => {
        this.st.status = { text: `Copied "${deck.name}"'s decklist to the clipboard.`, tone: "success" };
        this.host.rebuild();
      },
      () => {
        this.st.status = { text: "Couldn't copy to the clipboard.", tone: "error" };
        this.host.rebuild();
      },
    );
  }

  /** A deck options sheet (#958), for the layouts that show one pane at a time: each press runs the code the rails buttons run. */
  #openDeckActions(deckId: string): void {
    const scene = this.scene;
    if (scene.scene.isActive(SCENES.deckActions)) return;
    // Read after the select rebuild, which checked this deck at once: the row own option may still be "Checking...".
    const now = this.deckFor(deckId);
    if (!now) return;
    const deck = now.option.deck;
    const art = deckArtOf(this.st, deck.identityCardId as string);
    const onAction = (id: DeckActionId): void => {
      if (!scene.sys.isActive()) return;
      switch (id) {
        case "play": {
          const latest = this.deckFor(deckId)?.option;
          if (latest?.seatable) this.#playDeck(latest.deck);
          return;
        }
        case "add": {
          const latest = this.deckFor(deckId)?.offer;
          if (latest && latest.lock === null && latest.option.legal) this.#addCommunityDeck(latest);
          return;
        }
        case "edit":
          return goToScreen(scene, SCENES.deckBuilder, { deck } satisfies DeckBuilderSceneData);
        case "cards":
          return this.setTab("cards");
        case "stats":
          return this.setTab("stats");
        case "check":
          return this.openDeckCheck(deck);
        case "duplicate":
          return this.#duplicate(deck);
        case "delete":
          void this.#delete(deck.id);
          return;
      }
    };
    scene.scene.launch(SCENES.deckActions, {
      from: scene.scene.key,
      identityCardId: deck.identityCardId as string,
      artUrl: art.url,
      ...(art.focus ? { artFocus: art.focus } : {}),
      // Read on every draw of the sheet: a status the worker sends, or an unlock, while it is up shows at once.
      current: () => {
        const latest = this.deckFor(deckId);
        if (!latest) return null;
        const status = deckStatusOf(latest.option);
        return {
          title: cardTitleOf(latest.option),
          meta:
            (latest.offer
              ? communityMetaCandidates(latest.offer)
              : deckMetaCandidates(latest.option, currentPool())
            )[0] ?? "",
          status: {
            text: latest.offer ? communityStatusText(latest.offer) : status.text,
            problem: latest.offer ? latest.offer.lock !== null || !latest.option.legal : status.tone === "illegal",
          },
          actions: {
            option: latest.option,
            ...(latest.offer ? { community: { lock: latest.offer.lock, added: latest.offer.added } } : {}),
          },
        };
      },
      onAction,
    } satisfies DeckActionsSheetData);
  }

  /** The options sheet redraws with this draw statuses (#958 review). */
  refreshSheet(): void {
    if (this.scene.scene.isActive(SCENES.deckActions))
      this.scene.time.delayedCall(0, () =>
        (this.scene.scene.get(SCENES.deckActions) as DeckActionsSheet | null)?.refresh(),
      );
  }
}
