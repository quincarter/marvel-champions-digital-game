/**
 * What a press on Take your seats does: the `mc-seats` events its sections raise, as changes to the draft (`SeatsState`) and
 * the screen changes they cause. Nothing is decided here that the engine's seat options (`SeatsBook`) did not answer: a
 * pick is refused when the roster says the deck is blocked, a locked hero opens the unlock flow, and so on. The scene keeps
 * the parts that need the route, the focus and the leaving flag, and hands them over as `SeatsHost`.
 */
import type Phaser from "phaser";
import type { CardId, CoreAspect } from "@mc/content";
import { artLanguageNow } from "../../art/art-source.js";
import type { SeatsEvent } from "../../components/seats/seats.types.js";
import { t } from "../../i18n/translate.js";
import { earnedPromoSets, unlocks } from "../../progression/progression.js";
import { appSession } from "../../session.js";
import { tableRulesOf } from "../../settings.js";
import { aspectTipContentOf } from "../../view/aspect-tip-model.js";
import { testedEntryOf } from "../../view/community-decks-model.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { reasonLabelOf } from "../../view/deck-status.js";
import { heroPromoShown, nextHeroArt } from "../../view/hero-art-choice.js";
import type { HeroDeckGroup } from "../../view/hero-deck-groups.js";
import { formFactorFor } from "../../view/layout.js";
import { recommendedStartsCollapsed, saveRecommendedCollapsed } from "../../view/seat-prefs.js";
import type { ActiveSeatRosterEntry } from "../../view/seat-slots.js";
import { seatToClear, steppedSeatIndex } from "../../view/seat-step.js";
import { testedCatalog } from "../../view/seatable-decks.js";
import { MAX_SEATS } from "../../view/seats-layout.js";
import {
  assignToActiveSeat,
  clearHeroFilter,
  clearSeat,
  setActiveSeat,
  setHeroFilter,
  usePreconstructedForAllSeats,
  type SetupDraft,
} from "../../view/setup-draft.js";
import { drillIntoPack, drillOut } from "../../view/shelf-drill.js";
import { saveShelfFolds, toggleShelfFold } from "../../view/shelf-folds.js";
import type { AspectLessonSceneData } from "../aspect-lesson.js";
import { SCENES } from "../keys.js";
import { openNameConflictSheet } from "../name-conflict.js";
import { unlockOrAsk } from "../unlock-confirm.js";
import { applyChip } from "./seats-filters-model.js";
import { deckLockOf, REC_SHELF_ID } from "./seats-book.js";
import { goToDeckCheckOrTableSetup, seatedDecksOf, unresolvedConflictsOf } from "./seats-flow.js";
import { deckIdOfStop } from "./seats-order.js";
import type { SeatsState } from "./seats-state.js";

/** What the scene does that the presses need: redraw, leave, and the parts that hold the route. */
export interface SeatsHost {
  rebuild(): void;
  back(): void;
  goToTableSetup(): void;
  /** Marks the screen as leaving (later presses do nothing) and stops it redrawing on a resize. */
  leave(): void;
  toggleFilters(): void;
  focusSearchField(): void;
}

export class SeatsActions {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly st: SeatsState,
    private readonly host: SeatsHost,
  ) {}

  onSeats(detail: SeatsEvent): void {
    switch (detail.type) {
      case "seat":
        this.set(setActiveSeat(this.st.draft, detail.index));
        return;
      case "clear":
        // The seat may have changed under a slow press: clear only the deck the ✕ named.
        if (this.st.draft.seats[detail.index] === detail.deckId) this.set(clearSeat(this.st.draft, detail.index));
        return;
      case "clear-seat":
        if (this.st.draft.seats.length > 1) this.set(clearSeat(this.st.draft, this.st.draft.activeSeatIndex));
        return;
      case "action":
        this.onAction(detail.action);
        return;
      case "search":
        this.set(setHeroFilter(this.st.draft, { ...this.st.draft.heroFilter, text: detail.text }), false);
        this.st.search.request(detail.text);
        return;
      case "toggle":
        if (detail.what === "search") this.#toggleSearch();
        else if (detail.what === "filters") this.host.toggleFilters();
        else {
          this.st.detailsOpen = !this.st.detailsOpen;
          this.host.rebuild();
        }
        return;
      case "chip":
        this.set(applyChip(this.st.draft, detail.id));
        return;
      case "chip-info": {
        const aspect = detail.id.startsWith("aspect:") ? (detail.id.slice("aspect:".length) as CoreAspect) : null;
        this.st.tipAspect = aspect === null || this.st.tipAspect === aspect ? null : aspect;
        this.host.rebuild();
        return;
      }
      case "tip-link":
        if (this.st.tipAspect && aspectTipContentOf(this.st.tipAspect))
          this.scene.scene.launch(SCENES.aspectLesson, {
            aspect: this.st.tipAspect,
            backTo: "previous",
          } satisfies AspectLessonSceneData);
        return;
      case "shelf":
        if (detail.change === "all") {
          this.st.drill = drillIntoPack(detail.id);
          this.host.rebuild();
        } else if (detail.id === REC_SHELF_ID) this.#toggleRecommended();
        else {
          this.st.folded = toggleShelfFold(this.st.folded, detail.id);
          saveShelfFolds("seats", this.st.folded);
          this.host.rebuild();
        }
        return;
      case "hero":
        this.#onHero(detail.key, detail.via);
        return;
      case "deck": {
        this.st.decksKey = null;
        const options = this.st.book.deckOptions();
        const option = options.find((o) => (o.deck.id as string) === detail.deckId);
        if (option) this.#pickHero(option, this.st.book.activeRoster(options));
        else this.host.rebuild();
        return;
      }
      case "decks-close":
        this.st.decksKey = null;
        this.host.rebuild();
        return;
    }
  }

  onAction(action: Extract<SeatsEvent, { type: "action" }>["action"]): void {
    switch (action) {
      case "back":
        this.host.back();
        return;
      case "play": {
        const options = this.st.book.deckOptions();
        if (this.st.book.tableLock(options) || this.st.draft.seats.length === 0) return;
        // A card that can't be played beside another seat's hero is answered first, in the sheet; Continue there plays.
        if (unresolvedConflictsOf(this.st.draft, options).length > 0) this.openConflictSheet();
        else this.host.goToTableSetup();
        return;
      }
      case "deck-check":
        if (this.st.draft.seats.length === 0) return;
        this.host.leave();
        goToDeckCheckOrTableSetup(this.scene, this.st.draft, this.st.book.deckOptions());
        return;
      case "random":
        this.#randomHero();
        return;
      case "game-art": {
        const { settings } = appSession();
        appSession().settings = {
          ...settings,
          heroArt: nextHeroArt(settings.heroArt, heroPromoShown(earnedPromoSets(), settings.promoArtOn)),
        };
        this.host.rebuild();
        return;
      }
      case "preconstructed":
        this.set(usePreconstructedForAllSeats(this.st.draft, this.st.book.deckOptions()));
        return;
      case "rec-toggle":
        this.#toggleRecommended();
        return;
      case "drill-back":
        this.drillOut();
        return;
      case "hero-clear":
        this.set(clearHeroFilter(this.st.draft));
        this.st.search.request("");
        return;
      case "conflict-notice":
        this.openConflictSheet();
        return;
    }
  }

  /** A hero tile: a press seats it (or opens its decks), a hold or the Inspect key inspects it. */
  #onHero(key: string, via: "press" | "inspect"): void {
    const deckId = deckIdOfStop(key);
    const options = this.st.book.deckOptions();
    const option = deckId === null ? undefined : options.find((o) => (o.deck.id as string) === deckId);
    if (!option) return;
    const active = this.st.book.activeRoster(options);
    if (via === "inspect") this.#inspectOption(option, active);
    else if (key.startsWith("hero-rec:")) this.#pickHero(option, active);
    else this.#onHeroTile(option, active);
  }

  /** A hero tile tapped: one matching deck seats as it always did; several open the deck submenu. */
  #onHeroTile(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    const group = this.st.book.groupOf(option);
    if (group && group.decks.length > 1) this.#openDeckSheet(group);
    else this.#pickHero(option, active);
  }

  #openDeckSheet(group: HeroDeckGroup<DeckOption>): void {
    this.st.decksKey = this.st.book.groupKeyOf(group.rep);
    this.host.rebuild();
  }

  #pickHero(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    if (this.#offerUnlock(option)) return;
    if (active.get(option.deck.id as string)?.blockedBy) {
      this.host.rebuild();
      return;
    }
    this.set(assignToActiveSeat(this.st.draft, option.deck.id as string));
  }

  /** A locked precon, tapped: offer to unlock it with champion points, and seat it once it is paid for. False when not locked. */
  #offerUnlock(option: DeckOption): boolean {
    if (!deckLockOf(option.deck)) return false;
    // A tested deck can also be shut by a card's wave, which champion points on its hero do not open: it stays blocked.
    if (testedEntryOf(option.deck, testedCatalog()) && !unlocks().heroLock(option.deck.identityCardId as string))
      return false;
    const deckId = option.deck.id as string;
    unlockOrAsk(this.scene, { kind: "hero", identityCardId: option.deck.identityCardId as string }, () => {
      if (this.scene.sys.isActive()) this.set(assignToActiveSeat(this.st.draft, deckId));
    });
    return true;
  }

  #inspectOption(option: DeckOption, active: ReadonlyMap<string, ActiveSeatRosterEntry>): void {
    const entry = active.get(option.deck.id as string);
    this.scene.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId as CardId, face: { kind: "hero" } },
      ...(entry?.blockedBy
        ? { note: reasonLabelOf(entry.blockedBy, artLanguageNow()) }
        : {
            choice: {
              optionId: option.deck.id as string,
              label: entry?.isActiveSeat
                ? t("seats.alreadyPick")
                : (this.st.book.groupOf(option)?.decks.length ?? 1) > 1
                  ? t("seats.pickDeck")
                  : t("seats.takeSeat"),
            },
          }),
    });
  }

  onInspectChoose(rowId: string): void {
    const options = this.st.book.deckOptions();
    const option = options.find((o) => (o.deck.id as string) === rowId);
    const group = option ? this.st.book.groupOf(option) : undefined;
    if (group && group.decks.length > 1) return this.#openDeckSheet(group);
    if (option && this.#offerUnlock(option)) return;
    if (option && !this.st.book.seating(options).get(rowId)?.blockedBy)
      this.set(assignToActiveSeat(this.st.draft, rowId));
  }

  /** Random (#911): seats a random hero in the active seat, from the heroes the roster lets the player take right now. */
  #randomHero(): void {
    const options = this.st.book.deckOptions();
    const pool = this.st.book.randomCandidates(options, this.st.book.seating(options), this.st.search.rankedFor);
    const deckId = pool.length === 0 ? null : pool[Math.floor(Math.random() * pool.length)]!.deckId;
    if (deckId !== null) this.set(assignToActiveSeat(this.st.draft, deckId));
  }

  #toggleRecommended(): void {
    this.st.recCollapsed = !recommendedStartsCollapsed(this.st.recCollapsed, this.phone());
    saveRecommendedCollapsed(this.st.recCollapsed);
    this.host.rebuild();
  }

  phone(): boolean {
    const { width, height } = this.scene.scale.gameSize;
    return formFactorFor(width, height) === "phone";
  }

  #toggleSearch(): void {
    this.st.searchOpen = !this.st.searchOpen;
    // Shutting the field also clears its text: a filter whose field you can no longer see must not keep hiding heroes.
    if (!this.st.searchOpen && this.st.draft.heroFilter.text) {
      this.st.draft = setHeroFilter(this.st.draft, { ...this.st.draft.heroFilter, text: "" });
      this.st.search.clear();
    }
    this.host.rebuild();
    if (this.st.searchOpen) void this.host.focusSearchField();
  }

  drillOut(): void {
    this.st.drill = drillOut();
    this.host.rebuild();
  }

  set(draft: SetupDraft, rebuild = true): void {
    this.st.draft = draft;
    if (rebuild) this.host.rebuild();
  }

  openConflictSheet(): void {
    openNameConflictSheet(this.scene, {
      decks: seatedDecksOf(this.st.draft, this.st.book.deckOptions(), false),
      swaps: this.st.draft.deckSwaps,
      kept: this.st.draft.keptConflicts,
      tableRules: tableRulesOf(appSession().settings),
      continueLabel: t("seats.play"),
      onChange: (deckSwaps, keptConflicts) => this.set({ ...this.st.draft, deckSwaps, keptConflicts }),
      onContinue: () => this.host.goToTableSetup(),
    });
  }

  /** LB / RB: the seat being edited steps to the previous or next one; the hero list then fills that seat. */
  stepSeat(direction: 1 | -1): void {
    const next = steppedSeatIndex(this.st.draft, direction, MAX_SEATS);
    if (next !== this.st.draft.activeSeatIndex) this.set(setActiveSeat(this.st.draft, next));
  }

  /** X: clears the focused seat tile's seat (or the active seat), the same as its clear control; the last hero stays. */
  clearSeatByPad(focused: string | null): void {
    const index = seatToClear(this.st.draft, focused);
    if (index !== null) this.set(clearSeat(this.st.draft, index));
  }
}
