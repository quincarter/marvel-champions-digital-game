/**
 * C08 — Briefing: composes the next issue's between-games setup (answering any question it asks), shows what
 * happened automatically and what the player still has to decide, shows the two decks, and starts the game.
 *
 * The whole screen is one Lit panel over the canvas (`dom/dom-region.ts`, `mc-sheet`), drawn by the modules in
 * `briefing/` (`page.ts` lays it out; `flow.ts` composes, answers, opens and edits). This scene is the thin owner: the
 * panel, the focus route, the card hover popover, and the glue between them.
 *
 * ## Slots (for the call piece, B, and the sections piece, C)
 *
 * The shell draws everything that is not a call or a section: the page, top bar, speaker, "Handled for you", the Decks
 * panel, the action bar, the watch toggle, the "which deck?" chooser. Two objects plug the rest in (`briefing/slots.ts`,
 * shapes in `briefing/context.ts`); replace the placeholder named there with the piece's own module and nothing else
 * changes:
 *
 * - `slots.call` (`CallSlot`, piece B): `draw(ctx, b, col, top)` draws "Your call" for `ctx.state.pending` and returns its
 *   bottom; `shape(ctx, pending, phone)` says whether the call takes the column's top (`seatCall`: no speaker or handled rows
 *   above it) and whether it scrolls itself (`ownsScroll`: role-building's list, so the page and the left column do not
 *   scroll and no Decks panel is drawn on a phone); optional `isGenreSetPick` names the waiting notes' call and
 *   `onInspectTake` hears "Take this card" from Inspect (`mc-choice-toggle`, wired here). A call answers with
 *   `ctx.answer(picked)`; its own progress lives in `ctx.state` (`picking`, `callPage`, `roleState`, `roleBuild`, cleared
 *   by `resetCallState` on every new question).
 * - `slots.sections` (`SectionsSlot`, piece C): `pool` ("From the pool", only when `plan.hasPool`), `main` (the phone's
 *   column, and the wide left column when there is a pool) and `aside` (under the Decks or Handled panel in the wide right
 *   pane). Each is a block, `(ctx, b, col, top) => bottom`; the rules for which section goes where are in `context.ts`.
 *
 * A block draws with `b` at `col.x` / `col.width` from the `top` it is given (return `top` when it draws nothing).
 * Controls: draw a `b.button` / `b.tap` and register it with `col.control(key, rect, activate, extra?)`, which wires the
 * press and a focus stop that follows the column's scroll; `col.hover(slot, cardId, rect)` opens the hover popover on a
 * card picture. Pictures go through `ctx.leases`. Stop keys that Start and A press, `FORWARD_STOPS`, are unchanged
 * (`rb-confirm`, `role-confirm`, `call-confirm`, `open`), as are `call-prev` / `call-next` for LB / RB.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { liveWatchDefault } from "../../platform/live-watch.js";
import { cssOf } from "../../ui/theme.js";
import { surface } from "../../tokens.js";
import { campaignFrame } from "../../ui/campaign-chrome.js";
import { isDesktopType } from "../../ui/desktop-type.js";
import { HoverPreview, screenHoverArea } from "../../ui/card-hover-preview.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { onArtChange, onLanguageChange } from "../../language-change.js";
import { DomRegion, renderNow } from "../../dom/dom-region.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import { SheetBuilder } from "../../dom/sheet-builder.js";
import { SheetGlyphs } from "../../dom/sheet-glyphs.js";
import type { CardId } from "@mc/content";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import type { HoverCardIdRect } from "../../view/card-hover.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import { FORWARD_STOPS, SCROLLERS, newBriefingState, type BriefingCtx } from "./briefing/context.js";
import { BriefingFlow } from "./briefing/flow.js";
import { drawPage } from "./briefing/page.js";
import { briefingSlots } from "./briefing/slots.js";
import type { CampaignBriefingData } from "./routes.js";

export class CampaignBriefingScene extends Phaser.Scene {
  #state = newBriefingState({ runId: "" }, false);
  #flow!: BriefingFlow;
  #ctx!: BriefingCtx;
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  #region: DomRegion<McSheet> | null = null;
  #hover: HoverPreview | null = null;
  #leases = new PictureLeases();
  #alive = false;
  readonly #actions = new Map<string, () => void>();
  readonly #inspects = new Map<string, () => void>();
  readonly #stops = new Map<string, FocusStop>();
  readonly #obstacles: Rect[] = [];
  readonly #hoverCards = new Map<string, () => HoverCardIdRect | null>();
  /** Each scroller's place, kept across redraws (and Inspect) and cleared when the pending call changes. */
  readonly #tops = new Map<string, number>();
  readonly #placed = new WeakSet<HTMLElement>();
  #topsFor: unknown = null;

  constructor() {
    super(SCENES.campaignBriefing);
  }

  init(data: CampaignBriefingData): void {
    // The scene is reused: the toggle starts from the setting every time, not from the last visit's tick.
    this.#state = newBriefingState(data, liveWatchDefault());
    this.#tops.clear();
    this.#topsFor = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#alive = true;
    this.#region = null;
    this.#leases = new PictureLeases();
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
    this.game.events.on("mc-choice-toggle", this.#onInspectTake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#rebuild, this);
      this.game.events.off("mc-choice-toggle", this.#onInspectTake, this);
      offArt();
      offLanguage();
      this.#hover?.destroy();
      this.#hover = null;
      this.#glyphs.dispose();
      this.#leases.dispose();
      this.#region = null;
      this.#route = null;
    });
    this.#flow = new BriefingFlow(
      this,
      this.#state,
      () => this.#rebuild(),
      () => this.scale.off("resize", this.#rebuild, this),
    );
    this.#ctx = this.#makeCtx();
    this.#hover = new HoverPreview(this, {
      cardIds: () => {
        const found = new Map<string, HoverCardIdRect>();
        for (const [slot, rectOf] of this.#hoverCards) {
          const rect = rectOf();
          if (rect) found.set(slot, rect);
        }
        return found;
      },
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#state.seatPicker }),
    });
    void this.#flow.load();
    fadeScreenIn(this);
  }

  #makeCtx(): BriefingCtx {
    const state = this.#state;
    return {
      scene: this,
      glyphs: this.#glyphs,
      leases: this.#leases,
      actions: this.#actions,
      inspects: this.#inspects,
      stops: this.#stops,
      obstacles: this.#obstacles,
      hoverCards: this.#hoverCards,
      state,
      plan: null,
      slots: briefingSlots,
      scroller: (key) => this.#region?.element.elementOf(key) ?? null,
      builder: () => new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType),
      redraw: () => this.#rebuild(),
      back: () => this.#back(),
      answer: (picked) => this.#flow.answer(picked),
      inspectCard: (cardId, choice) => this.#inspectCard(cardId, choice),
      editDecks: (seat) => void this.#flow.editDecks(seat),
      openIssue: () => void this.#flow.openIssue(),
      toggleEasierStart: () => void this.#flow.toggleEasierStart(),
      setIssueMode: (action) => void this.#flow.setIssueMode(action),
      deckProblems: (record: CampaignRecord) => this.#flow.deckProblems(record),
    };
  }

  #back(): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.campaignRun, { runId: this.#state.data.runId });
  }

  #inspectCard(cardId: string, choice?: { readonly optionId: string; readonly label: string }): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: cardId as CardId, face: { kind: "front" } },
      ...(choice ? { choice } : {}),
    });
  }

  /** A card chosen in the Inspect sheet ("Take this card") goes to the call piece, which opens its confirm step. */
  #onInspectTake(optionId: string): void {
    if (!this.sys.isActive()) return;
    this.#ctx.slots.call.onInspectTake?.(this.#ctx, optionId);
  }

  /** The page's focus route: built once per visit, reading the latest stops on every move. */
  #routeOf(): FocusRoute {
    return (this.#route ??= new FocusRoute(this, {
      ring: domFocusRing,
      // B closes the "which deck?" chooser first, then leaves.
      onCancel: () => {
        if (this.#state.seatPicker) {
          this.#state.seatPicker = false;
          this.#rebuild();
        } else this.#back();
      },
      blocked: () => this.scene.isActive(SCENES.inspect),
      onPage: (direction) => this.#scrollBy(direction * 400),
      onScroll: (_dx, dy) => this.#scrollBy(dy),
      onHomeEnd: (edge) => {
        const scroller = this.#scroller();
        if (scroller) scroller.scrollTop = edge === "home" ? 0 : scroller.scrollHeight;
      },
      // LB / RB turn the options' pages when the call has them.
      onTab: (direction) => this.#stops.get(direction < 0 ? "call-prev" : "call-next")?.activate(),
      // Start and A with nothing focused: the screen's one forward button (Open / Confirm), never an accept or decline.
      primary: () => (this.#state.seatPicker ? null : (FORWARD_STOPS.find((key) => this.#stops.has(key)) ?? null)),
    }));
  }

  /** The scroller the stick and the page keys move: the page's, else the left column's, else the right pane's. */
  #scroller(): HTMLElement | null {
    for (const key of SCROLLERS) {
      const element = this.#region?.element.elementOf(key);
      if (element) return element;
    }
    return null;
  }

  #scrollBy(top: number): void {
    this.#scroller()?.scrollBy({ top });
  }

  #rebuild(): void {
    const state = this.#state;
    if (!this.#alive || !state.record) return;
    this.#glyphs.reset();
    this.#leases.begin();
    this.#actions.clear();
    this.#inspects.clear();
    this.#stops.clear();
    this.#hoverCards.clear();
    this.#obstacles.length = 0;
    const frame = campaignFrame(this);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    drawPage(this.#ctx, b, frame);
    this.#routeOf().set([...this.#stops.keys()], new Map(this.#stops));
    this.#mount(frame, b);
    this.#hover?.onDraw();
  }

  /** Hands the built parts to the panel (made once, so the scrollers keep their place) and renders them now. */
  #mount(frame: { readonly width: number; readonly height: number }, b: SheetBuilder): void {
    const rect: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        // Opening: a second tap must not act.
        if (this.#state.starting) return;
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-inspect", (event) => {
        this.#inspects.get((event as CustomEvent<{ key: string }>).detail.key)?.();
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
    this.#restoreScrollers();
  }

  /** A scroller keeps its place across redraws and Inspect, and starts at the top for a new question. */
  #restoreScrollers(): void {
    const reset = this.#topsFor !== this.#state.pending;
    this.#topsFor = this.#state.pending;
    if (reset) this.#tops.clear();
    for (const key of SCROLLERS) {
      const scroller = this.#region?.element.elementOf(key);
      if (!scroller) continue;
      if (!this.#placed.has(scroller)) {
        scroller.scrollTop = this.#tops.get(key) ?? 0;
        this.#placed.add(scroller);
        scroller.addEventListener(
          "scroll",
          () => {
            this.#tops.set(key, scroller.scrollTop);
            this.#ctx.slots.call.onScroll?.(this.#ctx, key);
          },
          { passive: true },
        );
      } else if (reset) scroller.scrollTop = 0;
    }
  }
}
