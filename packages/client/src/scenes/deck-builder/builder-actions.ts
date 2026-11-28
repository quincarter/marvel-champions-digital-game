/**
 * What the builder does with each thing its page says (`DeckBuilderEventDetail`): the scene hears one typed event, asks
 * this, and draws the answer. The decisions are the model's and the engine's (`addCard`, `legalityOf`, the rule settings'
 * refusals, the campaign's): nothing is decided in an element, and a press an element let through is checked again here.
 */
import type { AnyCard, CardId, CoreAspect, HeroIdentityCard, StarterDeck } from "@mc/content";
import { POOL_VERSION, currentPool, currentPoolKey, currentStarterDecks } from "../../content/pool.js";
import {
  addCard,
  aspectCountFor,
  preconsFor,
  removeCard,
  resetToIdentitySet,
  resetToPrecon,
  setAspects,
  setName,
  startingDeckOf,
} from "../../view/deck-builder-model.js";
import { nextDeckListSort } from "../../view/deck-stats.js";
import { oddsGroupsOf, deckCopiesOf } from "../../view/deck-odds.js";
import { stepDeckBuilderTab, DECK_BUILDER_TABS, type DeckBuilderTab } from "../../view/deck-builder-tabs.js";
import { campaignRefusesAdd, campaignRefusesCut } from "../../view/campaign-deck-edit-model.js";
import type {
  DeckBuilderEventDetail,
  RailTab,
} from "../../components/deck-builder/shared/deck-builder-events.types.js";
import type { AspectLessonSceneData } from "../aspect-lesson.js";
import { SCENES } from "../keys.js";
import type { BuilderHost } from "./builder-host.js";
import { handleFilterEvent } from "./builder-filter-actions.js";
import {
  deleteDeck,
  freezeDeck,
  goBack,
  loadAgainstGlobal,
  reviewDeck,
  saveDeck,
  shareGames,
  toggleReward,
} from "./builder-flows.js";
import { againstVillainFor } from "./model-games.js";
import { shownHeroes } from "./model-identity.js";
import { againstStepOf } from "../../view/deck-insights.js";
import type { BuilderState } from "./builder-state.js";
import { cardById, heroSearchDocuments, poolVillainNames } from "./pool-data.js";

/** How long the mouse rests on an aspect's "i" before its tip opens (issue #911: too eager on fast sweeps). */
const ASPECT_TIP_HOVER_DELAY_MS = 350;
const TIP_CLOSE_DELAY_MS = 140;
/** Everyone's decks are read once the stepper rests on a villain, not on each press passing through. */
const STEPPER_REST_MS = 400;

/** The events that belong to the open aspect tip: any other press closes it. */
const TIP_EVENTS: ReadonlySet<string> = new Set([
  "aspect",
  "aspect-info",
  "aspect-hover",
  "tip-hover",
  "tip-close",
  "tip-link",
]);

export class BuilderActions {
  readonly #host: BuilderHost;
  #tipTimer: ReturnType<typeof setTimeout> | null = null;
  #stepTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: BuilderHost) {
    this.#host = host;
  }

  /** The screen is going: no timer outlives it. */
  dispose(): void {
    if (this.#tipTimer) clearTimeout(this.#tipTimer);
    if (this.#stepTimer) clearTimeout(this.#stepTimer);
    this.#tipTimer = null;
    this.#stepTimer = null;
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  handle(detail: DeckBuilderEventDetail): void {
    const host = this.#host;
    const { state } = host;
    if (host.overlayUp()) return;
    // A press anywhere but on the open aspect tip closes it.
    const closesTip = state.aspectTipOpen !== null && !TIP_EVENTS.has(detail.type);
    if (closesTip) state.aspectTipOpen = null;
    this.#dispatch(detail);
    if (closesTip) host.compose();
  }

  #dispatch(detail: DeckBuilderEventDetail): boolean {
    const host = this.#host;
    const { state } = host;
    if (handleFilterEvent(host, detail)) return true;
    switch (detail.type) {
      case "back":
        goBack(host);
        break;
      case "identity-search":
        this.#identitySearch(detail.text);
        break;
      case "pick-hero":
        this.#pickHero(detail.id);
        break;
      case "hero-inspect":
        host.inspect(detail.id, null);
        break;
      case "start":
        this.#start(detail.id);
        break;
      case "start-back":
        state.startFor = null;
        host.compose();
        break;
      case "identity-card":
        if (state.identity) host.inspect(state.identity.id as string, { kind: "hero" });
        break;
      case "aspect":
        this.#toggleAspect(detail.aspect as CoreAspect);
        break;
      case "aspect-info":
        state.aspectTipOpen = state.aspectTipOpen === detail.aspect ? null : (detail.aspect as CoreAspect);
        host.compose();
        break;
      case "aspect-hover":
        this.#hoverAspect(detail.aspect as CoreAspect, detail.over);
        break;
      case "tip-hover":
        this.#hoverTip(detail.over);
        break;
      case "tip-close":
        state.aspectTipOpen = null;
        host.compose();
        break;
      case "tip-link":
        host.scene.scene.launch(SCENES.aspectLesson, {
          aspect: detail.aspect as CoreAspect,
          backTo: "previous",
        } satisfies AspectLessonSceneData);
        break;
      case "name":
        // The name is kept as it is typed (a short pause), so Save never holds an older one.
        if (state.deck && detail.text !== state.deck.name) host.setDeck(setName(state.deck, detail.text));
        break;
      case "tab":
        this.setTab(detail.tab);
        break;
      case "rail-tab":
        this.setRailTab(detail.tab);
        break;
      case "chart-tab":
        state.chartTab = detail.tab;
        host.compose();
        break;
      case "add":
        this.#add(detail.cardId as CardId);
        break;
      case "remove":
        this.#remove(detail.cardId as CardId);
        break;
      case "open":
        this.#open(detail.cardId, detail.face ?? null);
        break;
      case "odds":
        this.#odds(detail.part);
        break;
      case "reward":
        void toggleReward(host, detail.cardId as CardId, detail.included);
        break;
      case "deck-sort":
        state.deckSort = nextDeckListSort(state.deckSort);
        host.rememberView();
        host.compose();
        break;
      case "review":
        if (!state.busy) reviewDeck(host);
        break;
      case "precon":
        this.#precon();
        break;
      case "clear":
        if (state.deck && state.identity) host.setDeck(resetToIdentitySet(state.deck, state.identity, state.pool()));
        break;
      case "delete":
        void deleteDeck(host);
        break;
      case "freeze":
        void freezeDeck(host);
        break;
      case "save":
        void saveDeck(host);
        break;
      case "games-step":
        this.#stepVillain(detail.dir);
        break;
      case "games-source":
        this.#chooseSource(detail.source);
        break;
      case "games-share":
        shareGames(host, false);
        break;
      default:
        return false;
    }
    return true;
  }

  // ---- The identity steps ---------------------------------------------------------------------------------------------

  #identitySearch(text: string): void {
    const { state } = this.#host;
    if (text === state.identitySearch) return;
    state.identitySearch = text;
    this.#host.resetPool();
    this.requestHeroSearch(text);
  }

  /** The hero picker's search, ranked off the main thread: names first, then traits. */
  requestHeroSearch(text: string): void {
    const { state } = this.#host;
    const search = state.heroSearch;
    if (!search) return;
    if (text.trim() === "") {
      search.cancel();
      state.heroRanking = null;
      this.#host.compose();
      return;
    }
    search.setDocuments(heroSearchDocuments(), currentPoolKey());
    search.search(text, (ranked) => {
      if (!this.#host.scene.sys.isActive()) return;
      state.heroRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#host.resetPool();
      this.#host.compose();
    });
  }

  #pickHero(id: string): void {
    const { state } = this.#host;
    const identity = shownHeroes(state).find((hero) => (hero.id as string) === id);
    if (!identity) return;
    // A hero with a published precon gets the "Start from" step; one without starts from its own cards.
    if (preconsFor(identity, currentStarterDecks()).length > 0) {
      state.startFor = identity;
      this.#host.compose();
    } else this.#startWith(identity, null);
  }

  #start(id: string | null): void {
    const identity = this.#host.state.startFor;
    if (!identity) return;
    const starter =
      id === null ? null : (preconsFor(identity, currentStarterDecks()).find((s) => (s.id as string) === id) ?? null);
    this.#startWith(identity, starter);
  }

  /** Opens the builder on `identity`'s new deck: empty (its signature cards) or a copy of `starter`. */
  #startWith(identity: HeroIdentityCard, starter: StarterDeck | null): void {
    const { state } = this.#host;
    state.identity = identity;
    state.startFor = null;
    state.deck = startingDeckOf(
      identity,
      starter,
      currentPool(),
      `deck-${crypto.randomUUID()}`,
      POOL_VERSION,
      new Date().toISOString(),
    );
    state.savedDeck = null;
    this.#host.resetPool();
    this.#host.compose();
  }

  // ---- The deck -----------------------------------------------------------------------------------------------------------

  #toggleAspect(aspect: CoreAspect): void {
    const { state } = this.#host;
    const deck = state.deck;
    if (!deck || !state.identity || (state.campaignModel?.editingDisabled ?? false)) return;
    const max = aspectCountFor(state.identity);
    if (deck.aspects.includes(aspect))
      this.#host.setDeck(
        setAspects(
          deck,
          deck.aspects.filter((a) => a !== aspect),
        ),
      );
    else if (deck.aspects.length < max) this.#host.setDeck(setAspects(deck, [...deck.aspects, aspect]));
    else this.#host.setDeck(setAspects(deck, [...deck.aspects.slice(1), aspect]));
  }

  /** One more copy: refused as the "+" refuses it (a save in flight, a frozen or removed card, a deck rule). */
  #add(cardId: CardId): void {
    const { state } = this.#host;
    const deck = state.deck;
    if (!deck || state.busy) return;
    const frozen = state.campaignModel?.editingDisabled ?? false;
    if (campaignRefusesAdd(state.campaignRowFor(cardId as string), frozen)) return;
    if (state.ruleRefusal(deck, cardId, 1)) return;
    this.#host.setDeck(addCard(deck, cardId));
  }

  /** One copy fewer: refused as the "-" refuses it (a pinned or frozen line, a deck rule). */
  #remove(cardId: CardId): void {
    const { state } = this.#host;
    const deck = state.deck;
    if (!deck || state.busy) return;
    const frozen = state.campaignModel?.editingDisabled ?? false;
    if (campaignRefusesCut(state.campaignRowFor(cardId as string), frozen)) return;
    if (state.ruleRefusal(deck, cardId, -1)) return;
    this.#host.setDeck(removeCard(deck, cardId));
  }

  #open(cardId: string, face: string | null): void {
    const card: AnyCard | undefined = cardById().get(cardId);
    if (card) this.#host.inspect(cardId, face ? { kind: "flipSide" } : { kind: "front" });
  }

  #precon(): void {
    const { state } = this.#host;
    if (!state.deck || !state.identity) return;
    const fresh = resetToPrecon(state.deck, state.identity, currentStarterDecks());
    if (fresh) this.#host.setDeck(fresh);
  }

  /** The odds' group and draw count: the stepper's parts. */
  #odds(part: "group-prev" | "group-next" | "fewer" | "more" | "opening"): void {
    const { state } = this.#host;
    const deck = state.deck;
    if (!deck) return;
    const copies = deckCopiesOf(deck, (id) => cardById().get(id));
    const groups = oddsGroupsOf(copies);
    if (groups.length === 0) return;
    const at = Math.max(
      0,
      groups.findIndex((g) => g.id === state.oddsGroup),
    );
    const hand = state.identity?.alterEgo.handSize ?? 6;
    const draws = Math.min(state.oddsDraws ?? hand, copies.length);
    const setDraws = (next: number): void => {
      state.oddsDraws = Math.max(1, Math.min(copies.length, next));
    };
    if (part === "group-prev" || part === "group-next")
      state.oddsGroup = groups[(at + (part === "group-next" ? 1 : -1) + groups.length) % groups.length]!.id;
    else if (part === "fewer") setDraws(draws - 1);
    else if (part === "more") setDraws(draws + 1);
    else setDraws(hand);
    this.#host.compose();
  }

  // ---- Tabs and the tip ---------------------------------------------------------------------------------------------------

  /** The narrow layout's tab press (a tap, Enter, or LB / RB). Each tab keeps its own scroll; the aspect tip closes. */
  setTab(tab: DeckBuilderTab): void {
    const { state } = this.#host;
    if (state.tab === tab) return;
    state.tab = tab;
    state.railTab = tab === "games" ? "games" : "deck";
    state.aspectTipOpen = null;
    this.#host.compose();
    this.#host.focusKey(`tab:${tab}`);
  }

  setRailTab(tab: RailTab): void {
    const { state } = this.#host;
    if (state.railTab === tab) return;
    state.railTab = tab;
    state.tab = tab === "games" ? "games" : state.tab === "games" ? "deck" : state.tab;
    this.#host.compose();
    this.#host.focusKey(`rail:${tab}`);
  }

  /** LB / RB: the narrow layout's tabs; the wide layout's deck rail has two. */
  stepTabs(direction: 1 | -1): void {
    if (!this.#host.state.identity) return;
    if (!this.#host.isWide()) this.setTab(stepDeckBuilderTab(DECK_BUILDER_TABS, this.#host.state.tab, direction));
    else this.setRailTab(direction > 0 ? "games" : "deck");
  }

  /** A mouse resting on, or leaving, an aspect's "i": the tip opens after a pause and closes on leaving both. */
  #hoverAspect(aspect: CoreAspect, over: boolean): void {
    const { state } = this.#host;
    this.#clearTip();
    if (over) {
      if (state.aspectTipOpen === aspect) return;
      this.#tipTimer = setTimeout(() => {
        this.#tipTimer = null;
        state.aspectTipOpen = aspect;
        this.#host.compose();
      }, ASPECT_TIP_HOVER_DELAY_MS);
    } else if (state.aspectTipOpen === aspect) this.#closeTipSoon();
  }

  #hoverTip(over: boolean): void {
    this.#clearTip();
    if (!over) this.#closeTipSoon();
  }

  #clearTip(): void {
    if (this.#tipTimer) clearTimeout(this.#tipTimer);
    this.#tipTimer = null;
  }

  #closeTipSoon(): void {
    this.#clearTip();
    this.#tipTimer = setTimeout(() => {
      this.#tipTimer = null;
      if (this.#host.state.aspectTipOpen === null) return;
      this.#host.state.aspectTipOpen = null;
      this.#host.compose();
    }, TIP_CLOSE_DELAY_MS);
  }

  // ---- From your games --------------------------------------------------------------------------------------------------

  #stepVillain(dir: 1 | -1): void {
    const { state } = this.#host;
    if (!state.insights) return;
    const villain = againstVillainFor(state, state.againstSource);
    if (villain === undefined) return;
    const faced = againstStepFor(state, state.againstSource);
    const next = faced[(faced.indexOf(villain) + dir + faced.length) % faced.length]!;
    state.againstVillain = next;
    if (this.#stepTimer) clearTimeout(this.#stepTimer);
    this.#stepTimer = null;
    if (state.againstSource === "everyone")
      this.#stepTimer = setTimeout(() => {
        this.#stepTimer = null;
        void loadAgainstGlobal(this.#host, next);
      }, STEPPER_REST_MS);
    this.#host.compose();
    this.#host.focusKey(dir < 0 ? "games:previous" : "games:against");
  }

  #chooseSource(source: "yours" | "everyone"): void {
    const { state } = this.#host;
    if (state.againstSource === source) return;
    state.againstSource = source;
    // A read still waiting for the stepper to rest belongs to the other source.
    if (this.#stepTimer) clearTimeout(this.#stepTimer);
    this.#stepTimer = null;
    // Everyone with no villain chosen yet starts on the first of its list, read now (this press), not before.
    const first = state.insights ? againstVillainFor(state, source) : undefined;
    if (source === "everyone" && first !== undefined) void loadAgainstGlobal(this.#host, first);
    this.#host.compose();
    this.#host.focusKey(`games:source:${source}`);
  }
}

/** What the villain stepper walks: your faced villains, or on Everyone those and then every other villain in the pool. */
export function againstStepFor(state: BuilderState, source: "yours" | "everyone"): readonly string[] {
  return state.insights ? againstStepOf(state.insights, poolVillainNames(), source) : [];
}
