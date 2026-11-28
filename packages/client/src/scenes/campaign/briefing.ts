/**
 * C08 - Briefing: composes the next issue's between-games setup (answering any question it asks), shows what happened automatically
 * and what the player still has to decide, shows the two decks, and starts the game.
 *
 * The whole screen is one page element over the canvas (`views/briefing/mc-briefing-page`, mounted with `dom/element-region.ts`): it
 * composes section and call elements (`components/briefing/`), takes one typed model and raises one typed event, `mc-briefing`
 * (`components/briefing/briefing.types.ts`). This scene is the thin owner: the focus route, the card hover popover and Inspect, the
 * model (`briefing/page-model.ts`, from the state `briefing/context.ts`), compose / answer / open / edit decks (`briefing/flow.ts`) and
 * navigation.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../../views/briefing/mc-briefing-page/mc-briefing-page.js";
import type { McBriefingPage } from "../../views/briefing/mc-briefing-page/mc-briefing-page.js";
import { BRIEFING_EVENT, type BriefingDetail } from "../../components/briefing/briefing.types.js";
import { liveWatchDefault } from "../../platform/live-watch.js";
import { cssOf } from "../../ui/theme.js";
import { surface } from "../../tokens.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../../ui/card-hover-preview.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { onArtChange, onLanguageChange } from "../../language-change.js";
import { CardEvents } from "../../dom/card-events.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../../dom/element-region.js";
import { settleElements } from "../../dom/element-settle.js";
import { bindStopFocus, focusStopsOf } from "../../dom/element-stops.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import type { CardId } from "@mc/content";
import { campaignFrame } from "../../ui/campaign-chrome.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import { FORWARD_STOPS, newBriefingState } from "./briefing/context.js";
import { BriefingFlow } from "./briefing/flow.js";
import { BriefingHints } from "./briefing/hints.js";
import { pageModelOf } from "./briefing/page-model.js";
import type { CampaignBriefingData } from "./routes.js";

export class CampaignBriefingScene extends Phaser.Scene {
  #state = newBriefingState({ runId: "" }, false);
  #flow!: BriefingFlow;
  #route: FocusRoute | null = null;
  #hints: BriefingHints | null = null;
  #page: MountedElement<McBriefingPage> | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #unbind: (() => void) | null = null;
  #leases = new PictureLeases();
  #alive = false;
  /** Bumped on every compose: a page that finished rendering for an older one does not hand the route its stops. */
  #version = 0;

  constructor() {
    super(SCENES.campaignBriefing);
  }

  init(data: CampaignBriefingData): void {
    // The scene is reused: the toggle starts from the setting every time, not from the last visit's tick.
    this.#state = newBriefingState(data, liveWatchDefault());
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#alive = true;
    this.#leases = new PictureLeases();
    this.#route = null;
    resetHoverCards(this);
    this.scale.on("resize", this.#compose, this);
    this.#hints = new BriefingHints(this, () => this.#compose());
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    const offLanguage = onLanguageChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectTake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      this.game.events.off("mc-choice-toggle", this.#onInspectTake, this);
      offArt();
      offLanguage();
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.#hints?.dispose();
      this.#hints = null;
      this.#leases.dispose();
      this.#page = null;
      this.#route = null;
    });
    this.#flow = new BriefingFlow(
      this,
      this.#state,
      () => this.#compose(),
      () => this.scale.off("resize", this.#compose, this),
    );
    this.#mount();
    void this.#flow.load();
    fadeScreenIn(this);
  }

  /** Mounts the page and wires what it says and what hovers over it. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-briefing-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    // A pack picture blob URL went stale before its lazy image loaded: the leases read it again, once (mc-image-error).
    this.#leases.watch(element);
    element.addEventListener(BRIEFING_EVENT, (event) => this.#heard(event.detail));
    // A native button took focus (a screen reader, Tab): the route follows. A pointer press is the screen own tap.
    let pressing = false;
    element.addEventListener(
      "pointerdown",
      () => {
        pressing = true;
        setTimeout(() => (pressing = false), 0);
      },
      true,
    );
    this.#unbind = bindStopFocus(element, (key) => {
      if (!pressing) this.#routeOf().focusKey(key);
    });
    // The hover popover is drawn in the canvas, so its box is left out of the panel; a picture raises the events.
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#state.seatPicker }),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    // Hover only: a picture opens Inspect by its own press and hold (`mc-briefing` `inspect`, which can carry a "Take this card"
    // choice), so the hold `watchCard` also raises is not opened a second time.
    this.#cards = new CardEvents(region);
  }

  /** What the page said (a tap, or the focus route click on a stop). */
  #heard(detail: BriefingDetail): void {
    // Opening: a second tap must not act.
    if (this.#state.starting) return;
    switch (detail.type) {
      case "back":
        return this.#back();
      case "open":
        return void this.#flow.openIssue();
      case "watch":
        this.#state.watchable = !this.#state.watchable;
        return this.#compose();
      case "edit-decks":
        return void this.#flow.editDecks(detail.seat);
      case "close-seat-picker":
        this.#state.seatPicker = false;
        return this.#compose();
      case "answer":
        return this.#flow.answer(detail.picked);
      case "toggle-easier":
        return void this.#flow.toggleEasierStart();
      case "set-mode":
        return void this.#flow.setIssueMode(detail.action);
      case "inspect":
        return this.#inspectCard(detail.cardId, detail.choice);
    }
  }

  #back(): void {
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.campaignRun, { runId: this.#state.data.runId });
  }

  #inspectCard(cardId: string, choice?: { readonly optionId: string; readonly label: string }): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: cardId as CardId, face: { kind: "front" } },
      ...(choice ? { choice } : {}),
    });
  }

  /** A card chosen in the Inspect sheet ("Take this card") goes to the call, which opens its confirm step. */
  #onInspectTake(optionId: string): void {
    if (!this.sys.isActive()) return;
    this.#page?.element.takeFromInspect(optionId);
  }

  /** The page focus route: built once per visit, reading the latest stops on every move. */
  #routeOf(): FocusRoute {
    return (this.#route ??= new FocusRoute(this, {
      ring: domFocusRing,
      // B closes the "which deck?" chooser first, then leaves.
      onCancel: () => {
        if (this.#state.seatPicker) {
          this.#state.seatPicker = false;
          this.#compose();
        } else this.#back();
      },
      blocked: () => this.scene.isActive(SCENES.inspect),
      onPage: (direction) => this.#scrollBy(direction * 400),
      onScroll: (_dx, dy) => this.#scrollBy(dy),
      onHomeEnd: (edge) => {
        const scroller = this.#page?.element.scroller;
        if (scroller) scroller.scrollTop = edge === "home" ? 0 : scroller.scrollHeight;
      },
      // Start and A with nothing focused: the screen one forward button (Open / Confirm), never an accept or decline.
      primary: () => (this.#state.seatPicker ? null : (FORWARD_STOPS.find((key) => this.#stops.has(key)) ?? null)),
    }));
  }

  /** The stops of the page as last read. */
  #stops = new Map<string, FocusStop>();

  #scrollBy(top: number): void {
    this.#page?.element.scroller?.scrollBy({ top });
  }

  /** Builds the page model from the state and hands it to the page; then reads its stops once it has rendered. */
  #compose(): void {
    const state = this.#state;
    const page = this.#page;
    if (!this.#alive || !state.record || !page || !this.#hints) return;
    const version = ++this.#version;
    this.#leases.begin();
    resetHoverCards(this);
    const model = pageModelOf({
      scene: this,
      state,
      leases: this.#leases,
      hints: this.#hints,
      deckProblems: (record) => this.#flow.deckProblems(record),
    });
    const { width, height } = campaignFrame(this);
    page.region.setRect({ x: 0, y: 0, width, height });
    page.element.model = model;
    void settleElements(page.element).then(() => {
      this.#leases.end();
      if (this.#alive && version === this.#version) this.#syncStops();
    });
    this.#hover?.onDraw();
  }

  /** Hands the route the page stops, in the order the focus walks them: the page order, the watch toggle after Open. */
  #syncStops(): void {
    const page = this.#page;
    if (!page) return;
    const all = focusStopsOf(page.element, (target) => page.region.rectOf(target));
    // Nothing behind the "which deck?" chooser can be reached: its buttons are the whole route.
    const keys = [...all.keys()].filter((key) => (this.#state.seatPicker ? key.startsWith("pick-") : true));
    const order = [...keys.filter((key) => key !== "watch"), ...keys.filter((key) => key === "watch")];
    this.#stops = new Map(order.map((key) => [key, all.get(key)!]));
    this.#routeOf().set(order, this.#stops);
  }
}
