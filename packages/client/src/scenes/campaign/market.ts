/**
 * The Market — reached from Briefing (`briefing.ts`) whenever the between-games composer hits a Market-shaped
 * pending choice (`view/campaign-market-model.ts`'s `isMarketPendingChoice`): the "spend units to add a card from
 * The Market" step MC16 p. 5 prints, wherever a later campaign's own currency-priced choice happens to land in its
 * own graph. Nothing here reads `campaignId` — the redirect out of Briefing and everything this screen draws is
 * driven entirely by the shape of the choice the engine actually asked.
 *
 * **The flow bounces, on purpose.** `resolveBetweenGames` composes a whole issue's setup in one pass and only
 * persists once every choice in it is answered (`campaign-service.ts`'s doc comment) — a Market visit is just one
 * stretch of pending choices inside that pass, not a step of its own the engine can pause at. So Briefing hands
 * this scene `runId` plus the answers accumulated before the Market started; this scene keeps composing with its
 * own growing answer list exactly the way Briefing does, and once the runner's next pending choice is no longer
 * Market-shaped (or the whole issue is done), it hands `runId` plus its own answers back to Briefing, which resumes
 * composing from there. Neither scene ever re-decides an answer the other already made.
 *
 * **A whole cart, one seat at a time** — see `campaign-market-model.ts`'s own header. Clicking a shelf card never
 * talks to the runner directly; it only adds or removes that card from `#cart`, the active seat's own uncommitted
 * basket. "Done shopping" is what drives the runner: `#checkout` answers each of the runner's own tier-by-tier asks
 * with a cart card of that price if one remains (declining the rest of that tier), until either the runner moves on
 * to a different seat (that seat gets its own fresh empty cart) or the whole issue is done. A seat with no units
 * left for any remaining tier never sees another pending choice at all — the engine's own `fieldAtLeast` guard skips
 * it — so checkout never turns into dozens of engine round trips in practice even for a full cart.
 *
 * **The whole stall, one scrolling list** (#175, the owner's mockups of 2026-10-16). The shelf is every catalog card
 * in price tiers ("1 UNIT · 4 CARDS"), scrolled by touch drag, wheel, PgUp/PgDn or focus, with "jump to price" chips
 * that scroll to a tier and light up the tier at the top. The wallets and the chips stay pinned above the list.
 * - Phone: wallets and chips pinned under the top bar; the stall art, the printed line and the tiers scroll in one
 *   column; the bar holds the cart's count, Receipt (a sheet) and Done.
 * - Phone held sideways: wallets and the chips in a left pane, the tiers in two columns beside it, one bar row.
 * - Tablet held upright: the art and the printed line across the top, then wallets, chips and "Only what I can
 *   afford" pinned over a two-column list; the bar spells the cart out and what is kept for later.
 * - Tablet on its side and desktop: art | wallets, chips and the list | This visit (receipt and notes).
 */
import Phaser from "phaser";
import type { AnyCard } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice, LogValue } from "@mc/engine";
import { artFor, defaultFaceFor } from "../../art/art-source.js";
import { cardFaces } from "../../art/card-face-baker.js";
import { CARDS_BY_ID, POOL_CARDS } from "../../content/pool.js";
import { cardDisplayName } from "../../view/hero-names.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { campaignService } from "../../session.js";
import { border, ink, signal, surface, typeRole, type TypeSpec } from "../../tokens.js";
import {
  artNote,
  bangers,
  campaignFrame,
  artboardPicture,
  drawPicture,
  drawTopBar,
  stamp,
} from "../../ui/campaign-chrome.js";
import { storyFor } from "../../campaign/story.js";
import { HoverPreview, screenHoverArea } from "../../ui/card-hover-preview.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { captureIntoRegion } from "../../ui/scroll-capture.js";
import { McScrollRegion } from "../../ui/scroll-region.js";
import { textStyle } from "../../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McButton, fitText, label } from "../../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../../view/card-hover.js";
import {
  answerMarketAsk,
  canAddToCart,
  cartTotalOf,
  isMarketPendingChoice,
  marketCatalogOf,
  marketTiersOf,
  marketViewOf,
  type MarketCartItem,
  type MarketShelfCard,
  type MarketTier,
  type MarketView,
} from "../../view/campaign-market-model.js";
import type { FormFactor, Rect } from "../../view/layout.js";
import { VariableListScroll } from "../../view/variable-list-scroll.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import { artThumbSpec } from "../roster-panel.js";
import type { CampaignMarketData } from "./routes.js";

const cardOf = (id: string): AnyCard | undefined => CARDS_BY_ID.get(id);
/** Every campaign's Market-priced catalog this build ships, built once (`unitCost` never changes at runtime). */
const CATALOG = marketCatalogOf(POOL_CARDS);
/** Every price the stall sells, cheapest first: one "jump to price" chip each, whatever the filter hides. */
const PRICES = [...new Set(CATALOG.map((card) => (card as { readonly unitCost?: number }).unitCost ?? 0))].sort(
  (a, b) => a - b,
);

/** A campaign log's numeric field, read the same defensive way `campaign-market-model.ts`'s own `numberField` does. */
const numberField = (value: LogValue | undefined): number => (value?.kind === "number" ? value.value : 0);

type MarketLayout = "phone" | "phoneLandscape" | "tabletPortrait" | "wide";

const layoutOf = (formFactor: FormFactor): MarketLayout =>
  formFactor === "phone" || formFactor === "phoneLandscape" || formFactor === "tabletPortrait" ? formFactor : "wide";

/** Card pictures this far (px) outside the scrolled view still load, so a flick does not scroll into blank slots. */
const THUMB_LOAD_MARGIN = 240;

/** How a shelf cell lays out: on a phone the card's text sits beside its picture, on wider screens under it. */
interface CellStyle {
  /** The picture's width; its height keeps a card's own 63:88. */
  readonly thumb: number;
  readonly pad: number;
  readonly bodyBeside: boolean;
  /** "EVENT · THWART" over the name. */
  readonly showKind: boolean;
  /** The state tag inside the cell's top-right corner, or straddling its top edge. */
  readonly tagInside: boolean;
  readonly nameSize: number;
  readonly bodySize: number;
}

const CELL: Readonly<Record<MarketLayout, CellStyle>> = {
  phone: {
    thumb: 60,
    pad: 12,
    bodyBeside: true,
    showKind: true,
    tagInside: true,
    nameSize: 15,
    bodySize: 12,
  },
  phoneLandscape: {
    thumb: 46,
    pad: 10,
    bodyBeside: true,
    showKind: false,
    tagInside: true,
    nameSize: 14,
    bodySize: 11,
  },
  tabletPortrait: {
    thumb: 60,
    pad: 14,
    bodyBeside: false,
    showKind: true,
    tagInside: false,
    nameSize: 15,
    bodySize: 13,
  },
  wide: {
    thumb: 56,
    pad: 14,
    bodyBeside: false,
    showKind: true,
    tagInside: false,
    nameSize: 15,
    bodySize: 12,
  },
};

/** The bottom bar's height: phones and an upright tablet stack the cart over Done. */
const BAR_HEIGHT: Readonly<Record<MarketLayout, number>> = {
  phone: 136,
  phoneLandscape: 68,
  tabletPortrait: 136,
  wide: 88,
};

const unitsLabel = (price: number): string => `${price} ${price === 1 ? "UNIT" : "UNITS"}`;

interface PriceChip {
  readonly price: number;
  readonly rect: Rect;
  readonly g: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  readonly enabled: boolean;
}

export class CampaignMarketScene extends Phaser.Scene {
  #data!: CampaignMarketData;
  #record: CampaignRecord | null = null;
  #nodeIds: readonly string[] = [];
  #answers: CampaignChoiceAnswer[] = [];
  #pending: CampaignPendingChoice | null = null;
  #busy = false;
  /** The active seat's own basket this visit — see the file header's "A whole cart, one seat at a time". */
  #cart: MarketCartItem[] = [];
  /** Which seat `#cart` belongs to, so a new active seat always starts from an empty basket. */
  #cartSeatNumber: number | null = null;
  /** "Only what I can afford": the shelf keeps the cards the active seat can add or has in its cart. */
  #onlyAffordable = false;
  /** The phone's Receipt sheet, over everything. */
  #receiptOpen = false;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  /** What Escape and B do now: close the sheet, or go back. */
  #cancel: () => void = () => undefined;
  /** Every region drawn this pass. Offsets live in the scrolls below, so a redraw keeps the player where they were. */
  #regions: McScrollRegion[] = [];
  #shelfScroll = new VariableListScroll();
  #paneScroll = new VariableListScroll();
  #receiptScroll = new VariableListScroll();
  /** The region the tiers scroll in, and the content-space top of each tier's heading: what the chips jump to. */
  #shelfRegion: McScrollRegion | null = null;
  #tierTops: { readonly price: number; readonly y: number }[] = [];
  #chips: PriceChip[] = [];
  /** Every shelf card drawn this pass, in content space, with the region it scrolls in. */
  #shelfCards: { readonly cardId: string; readonly rect: Rect; readonly region: McScrollRegion }[] = [];
  #hover: HoverPreview | null = null;
  #redrawQueued = false;
  /** Card pictures waiting for their scans, drawn as their cells come near the view (`#fillThumbs`). */
  #thumbs: {
    readonly rect: Rect;
    readonly url: string;
    readonly alpha: number;
    /** The parchment slot the picture goes just above, under the price stamp. */
    readonly under: Phaser.GameObjects.GameObject;
    readonly region: McScrollRegion;
    done: boolean;
  }[] = [];

  constructor() {
    super(SCENES.campaignMarket);
  }

  init(data: CampaignMarketData): void {
    this.#data = data;
    this.#record = null;
    this.#nodeIds = [];
    this.#answers = data.answers ? [...data.answers] : [];
    this.#pending = null;
    this.#busy = false;
    this.#cart = [];
    this.#cartSeatNumber = null;
    this.#onlyAffordable = false;
    this.#receiptOpen = false;
    this.#regions = [];
    this.#resetScrolls();
    this.#shelfCards = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0xf2ece0);
    this.scale.on("resize", this.#draw, this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.#receiptOpen }),
    });
    const offBaked = cardFaces(this).onBaked(() => this.#fillThumbs());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offBaked();
      this.scale.off("resize", this.#draw, this);
      this.#hover?.destroy();
      this.#hover = null;
      for (const region of this.#regions) region.destroy();
      this.#regions = [];
    });
    void this.#load();
    fadeScreenIn(this);
  }

  #resetScrolls(): void {
    this.#shelfScroll = new VariableListScroll();
    this.#paneScroll = new VariableListScroll();
    this.#receiptScroll = new VariableListScroll();
  }

  async #load(): Promise<void> {
    const service = campaignService();
    const record = await service.load(this.#data.runId);
    if (!this.sys.isActive()) return;
    if (!record) {
      goToScreen(this, SCENES.campaignSaga);
      return;
    }
    this.#record = record;
    this.#nodeIds = service.definitionFor(record).graph.nodes.map((node) => node.id);
    this.#draw();
    await this.#compose();
  }

  async #compose(): Promise<void> {
    const record = this.#record;
    if (!record) return;
    this.#busy = true;
    this.#draw();
    const result = await campaignService().compose(record, this.#answers);
    if (!this.sys.isActive()) return;
    this.#busy = false;
    if (result.kind === "done" || !isMarketPendingChoice(result.choice, cardOf)) {
      this.#leaveToBriefing();
      return;
    }
    this.#pending = result.choice;
    this.#draw();
  }

  /** Hands the flow back to Briefing with whatever this visit has decided so far — see the file header. */
  #leaveToBriefing(): void {
    const record = this.#record;
    if (!record) return;
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.campaignBriefing, {
      runId: record.id,
      answers: this.#answers,
      ...(this.#data.replaySeed === undefined ? {} : { replaySeed: this.#data.replaySeed }),
    });
  }

  /** Adds or removes `cardId` from the active seat's cart — never talks to the runner (see the file header). */
  #toggleCart(cardId: string, price: number): void {
    if (this.#busy || this.#receiptOpen) return;
    const already = this.#cart.some((item) => item.cardId === cardId);
    if (already) {
      this.#cart = this.#cart.filter((item) => item.cardId !== cardId);
    } else {
      const activeSeatNumber = this.#pending?.seatNumber ?? null;
      const seat = this.#record?.seats.find((candidate) => candidate.seatNumber === activeSeatNumber);
      const remainingBalance = numberField(seat?.fields.units) - this.#spentThisVisit(activeSeatNumber);
      if (!canAddToCart(price, this.#cart, remainingBalance)) return;
      this.#cart = [...this.#cart, { cardId, price }];
    }
    this.#draw();
  }

  /** Units the active seat has already spent this visit via committed answers (not the cart). */
  #spentThisVisit(seatNumber: number | null): number {
    if (seatNumber === null) return 0;
    let spent = 0;
    for (const answer of this.#answers) {
      if (answer.seatNumber !== seatNumber || !answer.slot.startsWith("market-") || answer.picked.length === 0) {
        continue;
      }
      const price = (CARDS_BY_ID.get(answer.picked[0] as string) as { readonly unitCost?: number } | undefined)
        ?.unitCost;
      if (price !== undefined) spent += price;
    }
    return spent;
  }

  /**
   * Turns the active seat's cart into engine answers: for each of the runner's own tier-by-tier asks, answers with
   * a cart card of that price if one remains (removing it from the cart), or declines. Loops until the runner
   * either moves off this seat (a fresh cart starts for whoever it asks next, in `#draw`) or the issue is done.
   */
  async #checkout(): Promise<void> {
    if (this.#busy || this.#receiptOpen) return;
    const activeSeatNumber = this.#pending?.seatNumber ?? null;
    let cart: readonly MarketCartItem[] = this.#cart;
    for (;;) {
      const pending = this.#pending;
      if (!pending || pending.seatNumber !== activeSeatNumber || !isMarketPendingChoice(pending, cardOf)) break;
      const step = answerMarketAsk(pending, cart);
      cart = step.remainingCart;
      this.#answers = [...this.#answers, step.answer];
      this.#pending = null;
      await this.#compose();
      if (!this.sys.isActive()) return;
    }
    this.#cart = [...cart];
  }

  #heroNameOf = (seatNumber: number): string => {
    const seat = this.#record?.seats.find((candidate) => candidate.seatNumber === seatNumber);
    const identity = seat ? CARDS_BY_ID.get(seat.identityCardId as string) : undefined;
    return identity ? cardDisplayName(identity) : `Seat ${seatNumber}`;
  };

  #setReceiptOpen(open: boolean): void {
    this.#receiptOpen = open;
    this.#draw();
  }

  #toggleAffordable(): void {
    if (this.#receiptOpen) return;
    this.#onlyAffordable = !this.#onlyAffordable;
    this.#shelfScroll = new VariableListScroll();
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const region of this.#regions) region.destroy();
    this.#regions = [];
    this.#shelfRegion = null;
    this.#shelfCards = [];
    this.#tierTops = [];
    this.#thumbs = [];
    this.#chips = [];
    destroyChildren(this);
    this.#drawScreen();
    this.#fillThumbs();
    this.#hover?.onDraw();
  }

  #drawScreen(): void {
    const record = this.#record;
    const frame = campaignFrame(this);
    const { width, height, gutter } = frame;
    const layout = layoutOf(frame.formFactor);
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    if (!record) return;

    // The issue whose victory paid for this visit — the Market is composed as *next* issue's own first setup
    // instruction (`marketShoppingSetup`, first in every scenario's `setup` array in `packages/cards/src/campaigns/
    // gmw.ts`), so "after issue #N" is one behind whatever node is currently being composed.
    const composingIndex = this.#nodeIds.indexOf(record.position.nextNodeId ?? "");
    const afterIssueNumber = Math.max(1, composingIndex); // composingIndex is 0-based; issue N is index N-1
    const previousNodeId = this.#nodeIds[afterIssueNumber - 1] ?? null;
    const back = (): void => {
      this.scale.off("resize", this.#draw, this);
      if (previousNodeId) goToScreen(this, SCENES.campaignIssue, { runId: record.id, nodeId: previousNodeId });
      else goToScreen(this, SCENES.campaignRun, { runId: record.id });
    };
    this.#cancel = () => (this.#receiptOpen ? this.#setReceiptOpen(false) : back());
    const wonLabel = `Issue #${afterIssueNumber} · Won`;
    const top = drawTopBar(this, {
      backLabel: `◂ Issue #${afterIssueNumber}`,
      onBack: back,
      title: "The Market",
      ...(layout === "phoneLandscape" ? {} : { right: `After issue #${afterIssueNumber}` }),
    });
    if (layout === "phoneLandscape") {
      // Sideways there is no room for the art; the issue's stamp rides in the top bar instead.
      const probe = this.add.text(0, 0, wonLabel.toUpperCase(), textStyle(bangers(16), surface.paper.hex));
      const stampWidth = probe.width + 20;
      probe.destroy();
      stamp(this, width - 12 - stampWidth, (top.height - 30) / 2, wonLabel, { size: 16 });
    }
    const stops = new Map<string, FocusStop>();
    if (top.back && top.backRect) stops.set("back", { rect: top.backRect, activate: back });

    const pending = this.#pending;
    if (!pending) {
      label(this, gutter, top.height + 24, "Composing…", typeRole.label, surface.ink.hex, ink.secondary);
      this.#setRoute(stops);
      return;
    }

    // A new active seat always starts from an empty basket — see the file header's "A whole cart, one seat at a
    // time" and `campaign-market-model.ts`'s own header.
    if (this.#cartSeatNumber !== pending.seatNumber) {
      this.#cart = [];
      this.#cartSeatNumber = pending.seatNumber;
      this.#resetScrolls();
    }

    const view = marketViewOf(
      record.seats,
      pending,
      this.#answers,
      this.#cart,
      CATALOG,
      cardOf,
      this.#heroNameOf,
      CATALOG.length,
    );
    const tiers = marketTiersOf(view.shelf, this.#onlyAffordable);
    const barTop = height - BAR_HEIGHT[layout];
    const body: Rect = { x: 0, y: top.height, width, height: barTop - top.height };

    if (layout === "phone") this.#drawPhone(body, gutter, wonLabel, view, tiers, stops);
    else if (layout === "phoneLandscape") this.#drawPhoneLandscape(body, gutter, view, tiers, stops);
    else if (layout === "tabletPortrait") this.#drawTabletPortrait(body, gutter, wonLabel, view, tiers, stops);
    else this.#drawWide(body, gutter, wonLabel, view, tiers, stops, frame.formFactor === "desktop");
    this.#syncActivePrice();

    this.#drawBar(layout, { x: 0, y: barTop, width, height: BAR_HEIGHT[layout] }, gutter, view, stops);
    if (this.#receiptOpen) {
      const closeRect = this.#drawReceiptSheet(view);
      const sheetStops = new Map<string, FocusStop>([
        ["receipt-close", { rect: closeRect, activate: () => this.#setReceiptOpen(false) }],
      ]);
      this.#setRoute(sheetStops);
      return;
    }
    this.#setRoute(stops);
  }

  #setRoute(stops: Map<string, FocusStop>): void {
    this.#route =
      this.#route ??
      new FocusRoute(this, {
        onCancel: () => this.#cancel(),
        onPage: (direction) => this.#page(direction),
        onHomeEnd: (edge) => this.#page(edge === "home" ? -1 : 1, true),
      });
    this.#route.set([...stops.keys()], stops);
  }

  /** PgUp/PgDn (or a pad's shoulders): most of a screen of the list; Home/End: its ends. */
  #page(direction: 1 | -1, toEnd = false): void {
    const region = this.#shelfRegion;
    if (!region || this.#receiptOpen) return;
    region.scrollByPx(direction * (toEnd ? 1_000_000 : region.rect.height * 0.85));
  }

  // ── Layouts ────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Phone: wallets and price chips pinned; the art, the printed line and the tiers scroll in one column. */
  #drawPhone(
    body: Rect,
    gutter: number,
    wonLabel: string,
    view: MarketView,
    tiers: readonly MarketTier[],
    stops: Map<string, FocusStop>,
  ): void {
    const inner = body.width - gutter * 2;
    const headerBottom = this.#drawPinnedHeader(
      { x: gutter, y: body.y + 14, width: inner, height: 0 },
      view,
      tiers,
      stops,
      "PRICE",
    );
    this.#scrolled(
      { x: 0, y: headerBottom, width: body.width, height: body.y + body.height - headerBottom },
      this.#shelfScroll,
      stops,
      (region) => {
        this.#shelfRegion = region;
        let y = this.#drawIntro({ x: gutter, y: headerBottom + 20, width: inner, height: 0 }, wonLabel, view);
        y = this.#drawStall({ x: gutter, y: y + 28, width: inner - 6, height: 0 }, "phone", 1, tiers, stops, region);
        return this.#drawStallEnd({ x: gutter, y: y + 8, width: inner - 6, height: 0 }, view, true);
      },
    );
  }

  /** A phone on its side: wallets and the chips in a left pane, the tiers in two columns beside it. */
  #drawPhoneLandscape(
    body: Rect,
    gutter: number,
    view: MarketView,
    tiers: readonly MarketTier[],
    stops: Map<string, FocusStop>,
  ): void {
    const paneWidth = Math.round(Math.min(280, Math.max(220, body.width * 0.3)));
    this.add.rectangle(0, body.y, paneWidth, body.height, surface.parchment.hex).setOrigin(0, 0);
    this.add.rectangle(paneWidth, body.y, border.object, body.height, surface.ink.hex).setOrigin(0, 0);
    this.#scrolled({ x: 0, y: body.y, width: paneWidth, height: body.height }, this.#paneScroll, stops, () => {
      const x = 14;
      const w = paneWidth - 28;
      let y = body.y + 14;
      for (const wallet of view.wallets) {
        this.#drawWallet({ x, y, width: w, height: 56 }, wallet.heroName, wallet.before, wallet.after, wallet.active);
        y += 56 + 10;
      }
      y += 10;
      label(this, x, y, "Jump to price", { ...typeRole.label, size: 11 }, surface.ink.hex, ink.secondary);
      y += 22;
      return this.#drawChips({ x, y, width: w, height: 0 }, tiers, stops, 4, 44);
    });
    const listX = paneWidth + border.object + gutter;
    const listWidth = body.width - listX - gutter;
    this.#scrolled(
      { x: paneWidth + border.object, y: body.y, width: body.width - paneWidth - border.object, height: body.height },
      this.#shelfScroll,
      stops,
      (region) => {
        this.#shelfRegion = region;
        const y = this.#drawStall(
          { x: listX, y: body.y + 14, width: listWidth - 6, height: 0 },
          "phoneLandscape",
          2,
          tiers,
          stops,
          region,
        );
        return this.#drawStallEnd({ x: listX, y: y + 8, width: listWidth - 6, height: 0 }, view, true);
      },
    );
  }

  /** An upright tablet: art and the printed line across the top, then wallets, chips and the filter over the list. */
  #drawTabletPortrait(
    body: Rect,
    gutter: number,
    wonLabel: string,
    view: MarketView,
    tiers: readonly MarketTier[],
    stops: Map<string, FocusStop>,
  ): void {
    const inner = body.width - gutter * 2;
    let y = body.y + 20;
    const artWidth = Math.round(inner * 0.27);
    const { rect: stampRect } = stamp(this, gutter + artWidth + 20, y, wonLabel, { size: 20 });
    const promptBottom = this.#drawPromptBox(
      { x: gutter + artWidth + 20, y: stampRect.y + stampRect.height + 12, width: inner - artWidth - 20, height: 0 },
      view,
    );
    this.#drawArtBox(
      { x: gutter, y, width: artWidth, height: promptBottom - y },
      "Panel art: Knowhere black-market stall",
    );
    y = promptBottom + 22;
    const headerBottom = this.#drawPinnedHeader({ x: gutter, y, width: inner, height: 0 }, view, tiers, stops, null);
    this.#scrolled(
      { x: 0, y: headerBottom, width: body.width, height: body.y + body.height - headerBottom },
      this.#shelfScroll,
      stops,
      (region) => {
        this.#shelfRegion = region;
        const end = this.#drawStall(
          { x: gutter, y: headerBottom + 22, width: inner - 8, height: 0 },
          "tabletPortrait",
          2,
          tiers,
          stops,
          region,
        );
        return this.#drawStallEnd({ x: gutter, y: end + 8, width: inner - 8, height: 0 }, view, true);
      },
    );
  }

  /** A tablet on its side or a desktop: art | wallets, chips and the list | This visit. */
  #drawWide(
    body: Rect,
    gutter: number,
    wonLabel: string,
    view: MarketView,
    tiers: readonly MarketTier[],
    stops: Map<string, FocusStop>,
    desktop: boolean,
  ): void {
    const gap = 32;
    const inner = body.width - gutter * 2 - gap * 2;
    const leftWidth = Math.round(inner * (desktop ? 0.22 : 0.26));
    const rightWidth = Math.round(inner * (desktop ? 0.25 : 0.28));
    const midWidth = inner - leftWidth - rightWidth;
    const top = body.y + 24;
    const bottom = body.y + body.height - 20;
    const left: Rect = { x: gutter, y: top, width: leftWidth, height: bottom - top };
    const mid: Rect = { x: left.x + leftWidth + gap, y: top, width: midWidth, height: bottom - top };
    const right: Rect = { x: mid.x + midWidth + gap, y: top, width: rightWidth, height: bottom - top };

    // Left: the issue's stamp, the art, and the printed line boxed at the foot.
    const { rect: stampRect } = stamp(this, left.x, left.y, wonLabel, { size: 20 });
    const promptHeight = this.#promptBoxHeight(left.width, view);
    const promptTop = bottom - promptHeight;
    this.#drawPromptBox({ x: left.x, y: promptTop, width: left.width, height: 0 }, view);
    const artTop = stampRect.y + stampRect.height + 16;
    this.#drawArtBox(
      { x: left.x, y: artTop, width: left.width, height: Math.max(60, promptTop - 20 - artTop) },
      "Panel art: Knowhere black-market stall",
    );

    // Middle: wallets and chips pinned over the scrolling list.
    const headerBottom = this.#drawPinnedHeader(mid, view, tiers, stops, null, desktop);
    this.#scrolled(
      { x: mid.x, y: headerBottom, width: mid.width + 16, height: bottom - headerBottom },
      this.#shelfScroll,
      stops,
      (region) => {
        this.#shelfRegion = region;
        const cols = desktop && mid.width >= 640 ? 3 : 2;
        const end = this.#drawStall(
          { x: mid.x, y: headerBottom + 22, width: mid.width, height: 0 },
          "wide",
          cols,
          tiers,
          stops,
          region,
        );
        return this.#drawStallEnd({ x: mid.x, y: end + 8, width: mid.width, height: 0 }, view, false);
      },
    );

    // Right: This visit, scrolling on its own if a long receipt runs past the bar.
    this.#scrolled(
      { x: right.x, y: right.y, width: right.width + Math.min(16, gutter), height: body.y + body.height - right.y },
      this.#receiptScroll,
      stops,
      () => {
        const y = this.#drawReceipt(right, view);
        return this.#drawNotes({ x: right.x, y: y + 24, width: right.width, height: 0 });
      },
    );
  }

  // ── Pinned header: wallets and the price chips ─────────────────────────────────────────────────────────────────

  /**
   * The wallets row (two per row on a phone) over the chips row. `chipLabel` is the phone's "PRICE" lead; without it
   * the row leads with "ON THE SHELF", and an upright tablet adds "Only what I can afford" at its right. Returns the
   * bottom of the rule under it.
   */
  #drawPinnedHeader(
    rect: Rect,
    view: MarketView,
    tiers: readonly MarketTier[],
    stops: Map<string, FocusStop>,
    chipLabel: string | null,
    hint = false,
  ): number {
    const phone = chipLabel !== null;
    const perRow = phone ? 2 : Math.min(4, Math.max(1, view.wallets.length));
    const walletGap = phone ? 12 : 16;
    const walletHeight = phone ? 62 : 56;
    const walletWidth = (rect.width - walletGap * (perRow - 1)) / perRow;
    const walletRows = Math.ceil(view.wallets.length / perRow);
    const chipSize = phone ? 44 : 48;
    const chipGap = phone ? 8 : 10;
    const contentHeight = walletRows * (walletHeight + 10) + 6 + chipSize + 16;
    if (phone) {
      // A recessed strip across the full width: the pinned part reads as one piece over the scrolling list.
      const full = this.scale.gameSize.width;
      this.add.rectangle(0, rect.y - 14, full, contentHeight + 14, surface.parchment.hex).setOrigin(0, 0);
    }
    let y = rect.y;
    view.wallets.forEach((wallet, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      this.#drawWallet(
        {
          x: rect.x + col * (walletWidth + walletGap),
          y: rect.y + row * (walletHeight + 10),
          width: walletWidth,
          height: walletHeight,
        },
        wallet.heroName,
        wallet.before,
        wallet.after,
        wallet.active,
      );
    });
    y += walletRows * (walletHeight + 10) + 6;

    const leadWidth = phone ? 62 : 0;
    let x = rect.x;
    if (phone) {
      label(
        this,
        x,
        y + chipSize / 2,
        chipLabel,
        { ...typeRole.label, size: 11 },
        surface.ink.hex,
        ink.secondary,
      ).setOrigin(0, 0.5);
      x += leadWidth;
    } else {
      const heading = this.add
        .text(x, y + chipSize / 2, "ON THE SHELF", textStyle(bangers(26), surface.ink.hex))
        .setOrigin(0, 0.5);
      x += heading.width + 20;
    }
    const avail = rect.x + rect.width - x;
    const smallestChips = PRICES.length * 40 + (PRICES.length - 1) * chipGap;
    // An upright tablet has room for the filter beside the chips; elsewhere the chips sit at the right edge, shrunk to
    // fit a narrow column.
    const filterWidth = !phone && avail - smallestChips >= 250 ? 230 : 0;
    const size = Math.min(
      chipSize,
      Math.floor((avail - (filterWidth > 0 ? filterWidth + 20 : 0) - chipGap * (PRICES.length - 1)) / PRICES.length),
    );
    const chipsWidth = PRICES.length * size + (PRICES.length - 1) * chipGap;
    const chipsX = phone || filterWidth > 0 ? x : rect.x + rect.width - chipsWidth;
    if (hint && filterWidth === 0 && chipsX - x >= 220) {
      this.add
        .text(x, y + chipSize / 2, "Wheel, drag or PgUp / PgDn to scroll · arrows keep focus in view", {
          ...textStyle({ ...typeRole.body, size: 12 }, surface.ink.hex, ink.secondary),
          wordWrap: { width: chipsX - x - 16 },
        })
        .setOrigin(0, 0.5);
    }
    this.#drawChipRow({ x: chipsX, y: y + (chipSize - size) / 2, width: 0, height: size }, tiers, stops, size, chipGap);
    if (filterWidth > 0) {
      this.#drawAffordableToggle(
        { x: rect.x + rect.width - filterWidth, y, width: filterWidth, height: chipSize },
        stops,
      );
    }
    y += chipSize + 16;
    if (phone) {
      this.add.rectangle(0, y, this.scale.gameSize.width, border.control, surface.ink.hex).setOrigin(0, 0);
      return y + border.control;
    }
    this.add.rectangle(rect.x, y, rect.width, border.object, surface.ink.hex).setOrigin(0, 0);
    return y + border.object;
  }

  #drawWallet(rect: Rect, heroName: string, before: number, after: number, active: boolean): void {
    const g = this.add.graphics();
    g.fillStyle(active ? surface.card.hex : surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    if (active) g.lineStyle(border.object + 1, surface.ink.hex, 1);
    else g.lineStyle(border.control, surface.ink.hex, 0.3);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    const alpha = active ? 1 : ink.secondary;
    const value = this.add
      .text(
        rect.x + rect.width - 14,
        rect.y + rect.height / 2,
        `${before} → ${after}U`,
        textStyle(bangers(rect.height >= 52 ? 28 : 22), surface.ink.hex, alpha),
      )
      .setOrigin(1, 0.5);
    const name = this.add
      .text(
        rect.x + 14,
        rect.y + rect.height / 2,
        heroName.toUpperCase(),
        textStyle({ ...typeRole.rowTitle, size: 15 }, surface.ink.hex, alpha),
      )
      .setOrigin(0, 0.5);
    if (name.width + value.width + 40 > rect.width) {
      // A long name ("ROCKET RACCOON") beside the balance would be cut: the name goes on its own line over it.
      name.setPosition(rect.x + 12, rect.y + 8).setOrigin(0, 0);
      fitText(name, rect.width - 24, 15);
      value.setPosition(rect.x + rect.width - 12, rect.y + rect.height - 6).setOrigin(1, 1);
      return;
    }
    fitText(name, rect.width - value.width - 40, 15);
  }

  /** One row of chips from `rect.x`, `size` square. */
  #drawChipRow(
    rect: Rect,
    tiers: readonly MarketTier[],
    stops: Map<string, FocusStop>,
    size: number,
    gap: number,
  ): void {
    PRICES.forEach((price, index) => {
      this.#drawChip({ x: rect.x + index * (size + gap), y: rect.y, width: size, height: size }, price, tiers, stops);
    });
  }

  /** The chips as a grid, `perRow` across `rect.width`. Returns the grid's bottom. */
  #drawChips(rect: Rect, tiers: readonly MarketTier[], stops: Map<string, FocusStop>, perRow: number, height: number) {
    const gap = 8;
    const size = (rect.width - gap * (perRow - 1)) / perRow;
    PRICES.forEach((price, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      this.#drawChip(
        { x: rect.x + col * (size + gap), y: rect.y + row * (height + gap), width: size, height },
        price,
        tiers,
        stops,
      );
    });
    return rect.y + Math.ceil(PRICES.length / perRow) * (height + gap);
  }

  #drawChip(rect: Rect, price: number, tiers: readonly MarketTier[], stops: Map<string, FocusStop>): void {
    const enabled = tiers.some((tier) => tier.price === price);
    const g = this.add.graphics();
    const text = this.add
      .text(rect.x + rect.width / 2, rect.y + rect.height / 2, `${price}U`, textStyle(bangers(22), surface.ink.hex))
      .setOrigin(0.5, 0.5);
    const chip: PriceChip = { price, rect, g, text, enabled };
    this.#chips.push(chip);
    this.#paintChip(chip, false);
    if (!enabled) return;
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => this.#jumpTo(price));
    stops.set(`price:${price}`, { rect, activate: () => this.#jumpTo(price) });
  }

  #paintChip(chip: PriceChip, active: boolean): void {
    const { g, rect, text, enabled } = chip;
    g.clear();
    g.fillStyle(active ? surface.ink.hex : surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.object, surface.ink.hex, enabled ? 1 : 0.3);
    g.strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
    text.setColor(active ? surface.paper.css : surface.ink.css).setAlpha(enabled ? 1 : 0.35);
  }

  /** Scrolls the list so `price`'s tier heading sits at the top. */
  #jumpTo(price: number): void {
    const region = this.#shelfRegion;
    const tier = this.#tierTops.find((candidate) => candidate.price === price);
    if (!region || !tier || this.#receiptOpen) return;
    const onScreen = tier.y + region.content.y;
    region.scrollByPx(onScreen - region.rect.y - 12);
    this.#syncActivePrice(price);
  }

  /** Lights the chip of the tier at the top of the list (the last heading at or above the list's top). */
  #syncActivePrice(forced?: number): void {
    const region = this.#shelfRegion;
    let active: number | null = forced ?? null;
    if (active === null && region && this.#tierTops.length > 0) {
      const line = region.rect.y + 40;
      active = this.#tierTops[0]!.price;
      for (const tier of this.#tierTops) if (tier.y + region.content.y <= line) active = tier.price;
    }
    for (const chip of this.#chips) this.#paintChip(chip, chip.price === active);
  }

  #drawAffordableToggle(rect: Rect, stops: Map<string, FocusStop>): void {
    const box = 26;
    const boxX = rect.x + 4;
    const boxY = rect.y + (rect.height - box) / 2;
    const g = this.add.graphics();
    g.fillStyle(this.#onlyAffordable ? surface.ink.hex : surface.card.hex, 1).fillRect(boxX, boxY, box, box);
    g.lineStyle(border.control, surface.ink.hex, 1).strokeRect(boxX, boxY, box, box);
    if (this.#onlyAffordable) {
      this.add
        .text(boxX + box / 2, boxY + box / 2, "✓", textStyle({ ...typeRole.rowTitle, size: 18 }, surface.paper.hex))
        .setOrigin(0.5, 0.5);
    }
    this.add
      .text(
        boxX + box + 12,
        rect.y + rect.height / 2,
        "Only what I can afford",
        textStyle({ ...typeRole.rowTitle, size: 15 }, surface.ink.hex),
      )
      .setOrigin(0, 0.5);
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => this.#toggleAffordable());
    stops.set("afford", { rect, activate: () => this.#toggleAffordable() });
  }

  // ── The stall ──────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Every tier as a "N UNITS · K CARDS" heading over a grid of cells. A cell is as tall as its card's whole text, and
   * a row as tall as its tallest cell, so nothing is cut off. Returns the last row's bottom.
   */
  #drawStall(
    rect: Rect,
    layout: MarketLayout,
    cols: number,
    tiers: readonly MarketTier[],
    stops: Map<string, FocusStop>,
    region: McScrollRegion,
  ): number {
    const style = CELL[layout];
    const colGap = layout === "phone" ? 12 : 16;
    const rowGap = style.tagInside ? 12 : 22;
    const cellWidth = (rect.width - colGap * (cols - 1)) / cols;
    let y = rect.y;
    if (tiers.length === 0) {
      this.add
        .text(
          rect.x,
          y,
          "Nothing on the shelf you can afford right now.",
          textStyle({ ...typeRole.body, size: 14 }, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0, 0);
      return y + 30;
    }
    tiers.forEach((tier, tierIndex) => {
      if (tierIndex > 0) y += 30;
      this.#tierTops.push({ price: tier.price, y });
      const heading = this.add
        .text(
          rect.x,
          y,
          unitsLabel(tier.price),
          textStyle(bangers(layout === "phoneLandscape" ? 22 : 26), surface.ink.hex),
        )
        .setOrigin(0, 0);
      this.add
        .text(
          rect.x + rect.width,
          y + heading.height - 4,
          `${tier.cards.length} ${tier.cards.length === 1 ? "CARD" : "CARDS"}`,
          textStyle({ ...typeRole.label, size: 11 }, surface.ink.hex, ink.secondary),
        )
        .setOrigin(1, 1);
      y += heading.height + 6;
      this.add.rectangle(rect.x, y, rect.width, border.control, surface.ink.hex).setOrigin(0, 0);
      y += border.control + (style.tagInside ? 14 : 24);
      for (let start = 0; start < tier.cards.length; start += cols) {
        const row = tier.cards.slice(start, start + cols).map((card, col) => ({
          card,
          x: rect.x + col * (cellWidth + colGap),
          cell: this.#drawCell(rect.x + col * (cellWidth + colGap), y, cellWidth, card, style, stops, region),
        }));
        const rowHeight = Math.max(...row.map((entry) => entry.cell.height));
        for (const { card, x, cell } of row) {
          const cellRect: Rect = { x, y, width: cellWidth, height: rowHeight };
          cell.finish(rowHeight);
          this.#shelfCards.push({ cardId: card.cardId as string, rect: cellRect, region });
        }
        y += rowHeight + (start + cols < tier.cards.length ? rowGap : 0);
      }
    });
    return y;
  }

  /**
   * One shelf card: its picture with the price stamped on its corner, then its type, name and whole text beside it
   * (a phone) or the text under the picture row (wider screens). Drawn at the cell's top-left; `finish` frames it at
   * the row's height and makes it a control. Returns the height the card needs.
   */
  #drawCell(
    x: number,
    y: number,
    width: number,
    card: MarketShelfCard,
    style: CellStyle,
    stops: Map<string, FocusStop>,
    region: McScrollRegion,
  ): { readonly height: number; readonly finish: (height: number) => void } {
    const { kind } = card.state;
    const inCart = kind === "inCart";
    const live = kind === "live";
    const dim = !live && !inCart;
    // The frame goes in first so everything else draws over it; it is painted once the row's height is known.
    const frame = this.add.graphics();

    const tagText =
      kind === "inCart"
        ? "In your cart"
        : kind === "taken"
          ? `${card.state.heroName} bought it`
          : kind === "capped"
            ? "Tier full (4)"
            : kind === "unaffordable"
              ? `Need ${card.state.need}`
              : null;
    let tagWidth = 0;
    let tagBottom = y;
    if (tagText) {
      const t = this.add
        .text(
          0,
          0,
          tagText.toUpperCase(),
          textStyle({ ...typeRole.label, size: 10 }, inCart ? surface.ink.hex : surface.paper.hex),
        )
        .setOrigin(0, 0);
      const tag: Rect = {
        x: x + width - t.width - 16 - (style.tagInside ? 6 : 12),
        y: style.tagInside ? y + 8 : y - 10,
        width: t.width + 16,
        height: t.height + 8,
      };
      const tg = this.add.graphics();
      tg.fillStyle(inCart ? signal.caution.hex : surface.ink.hex, inCart ? 1 : 0.42).fillRect(
        tag.x,
        tag.y,
        tag.width,
        tag.height,
      );
      if (inCart) tg.lineStyle(1.5, surface.ink.hex, 1).strokeRect(tag.x, tag.y, tag.width, tag.height);
      t.setPosition(tag.x + 8, tag.y + 4);
      this.children.bringToTop(t);
      tagWidth = style.tagInside ? tag.width + 10 : 0;
      if (style.tagInside) tagBottom = tag.y + tag.height;
    }

    // The picture, a card's own proportions, with a parchment slot under it until its scan arrives.
    const thumb: Rect = {
      x: x + style.pad,
      y: y + style.pad,
      width: style.thumb,
      height: Math.round((style.thumb * 88) / 63),
    };
    const slot = this.add.graphics();
    slot.fillStyle(surface.parchment.hex, 1).fillRect(thumb.x, thumb.y, thumb.width, thumb.height);
    slot.lineStyle(1.5, surface.ink.hex, 0.5).strokeRect(thumb.x, thumb.y, thumb.width, thumb.height);
    const source = cardOf(card.cardId as string);
    const url = artFor(source, defaultFaceFor(source))?.url ?? null;
    if (url) this.#thumbs.push({ rect: thumb, url, alpha: dim ? 0.45 : 1, under: slot, region, done: false });
    // The price, stamped over the picture's corner.
    const badgeSize = style.thumb >= 56 ? 28 : 24;
    const badge: Rect = {
      x: thumb.x - 4,
      y: thumb.y + thumb.height - badgeSize + 4,
      width: badgeSize + 8,
      height: badgeSize,
    };
    const bg = this.add.graphics();
    bg.fillStyle(signal.cost.hex, dim ? 0.55 : 1).fillRect(badge.x, badge.y, badge.width, badge.height);
    bg.lineStyle(border.detail, surface.ink.hex, 1).strokeRect(badge.x, badge.y, badge.width, badge.height);
    this.add
      .text(
        badge.x + badge.width / 2,
        badge.y + badge.height / 2 + 1,
        `${card.price}U`,
        textStyle(bangers(badgeSize >= 28 ? 19 : 17), surface.paper.hex),
      )
      .setOrigin(0.5, 0.5);

    const textX = thumb.x + thumb.width + 12;
    const textWidth = x + width - style.pad - textX;
    const alpha = dim ? ink.disabled : 1;
    let textY = y + style.pad - 2;
    if (style.showKind) {
      const kindText = this.add
        .text(
          textX,
          textY,
          card.kindLabel,
          textStyle({ ...typeRole.label, size: 10 }, surface.ink.hex, dim ? ink.disabled : ink.secondary),
        )
        .setOrigin(0, 0);
      fitText(kindText, textWidth - tagWidth, 10);
      textY += Math.max(kindText.height, tagWidth > 0 ? 18 : 0) + 3;
    }
    // With no kind line to sit beside it, a tag in the corner takes the first line: the name starts under it.
    if (!style.showKind) textY = Math.max(textY, tagBottom + 4);
    const nameSpec: TypeSpec = { ...typeRole.rowTitle, size: style.nameSize, lineHeight: 1.15 };
    const name = this.add
      .text(textX, textY, card.name.toUpperCase(), {
        ...textStyle(nameSpec, surface.ink.hex, alpha),
        wordWrap: { width: textWidth },
      })
      .setOrigin(0, 0);
    textY += name.height + 4;

    const bodyX = style.bodyBeside ? textX : x + style.pad;
    const bodyWidth = style.bodyBeside ? textWidth : width - style.pad * 2;
    const bodyY = style.bodyBeside ? textY : Math.max(thumb.y + thumb.height, textY) + 10;
    const body = this.add
      .text(bodyX, bodyY, card.detail, {
        ...textStyle(
          { ...typeRole.body, size: style.bodySize, lineHeight: 1.35 },
          surface.ink.hex,
          dim ? ink.disabled : ink.secondary,
        ),
        wordWrap: { width: bodyWidth },
      })
      .setOrigin(0, 0);
    const contentBottom = Math.max(thumb.y + thumb.height, body.y + (card.detail ? body.height : 0));
    const height = Math.ceil(contentBottom + style.pad - y);

    const finish = (rowHeight: number): void => {
      frame.fillStyle(dim ? surface.paper.hex : surface.card.hex, 1).fillRect(x, y, width, rowHeight);
      if (inCart) frame.lineStyle(4, signal.caution.hex, 1);
      else if (live) frame.lineStyle(border.object, surface.ink.hex, 1);
      else frame.lineStyle(border.control, surface.ink.hex, 0.3);
      const inset = inCart ? 2 : 1.5;
      frame.strokeRect(x + inset, y + inset, width - inset * 2, rowHeight - inset * 2);
      if (!live && !inCart) return;
      const rect: Rect = { x, y, width, height: rowHeight };
      const zone = this.add.zone(x, y, width, rowHeight).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const cardId = card.cardId as string;
      const price = card.price;
      zone.on("pointerup", () => this.#toggleCart(cardId, price));
      stops.set(`cart:${cardId}`, { rect, activate: () => this.#toggleCart(cardId, price) });
    };
    return { height, finish };
  }

  /** Draws every waiting card picture whose baked scan is on hand and whose cell is near the scrolled view. */
  #fillThumbs(): void {
    const faces = cardFaces(this);
    for (const slot of this.#thumbs) {
      if (slot.done || !slot.region.content.active) continue;
      const top = slot.rect.y + slot.region.content.y;
      const view = slot.region.rect;
      if (top + slot.rect.height < view.y - THUMB_LOAD_MARGIN || top > view.y + view.height + THUMB_LOAD_MARGIN)
        continue;
      const key = faces.request(artThumbSpec(slot.rect, slot.url, 0.12, "contain"));
      if (!key) continue;
      const image = this.add.image(slot.rect.x, slot.rect.y, key).setOrigin(0, 0).setAlpha(slot.alpha);
      image.setDisplaySize(slot.rect.width, slot.rect.height);
      faces.hold(key, image);
      // Just over its parchment slot, so the price stamped over the corner stays on top.
      slot.region.content.addAt(image, slot.region.content.getIndex(slot.under) + 1);
      slot.done = true;
    }
  }

  /** The dashed "END OF THE STALL" slot under the last tier; `note` adds the carry-over line where no column has it. */
  #drawStallEnd(rect: Rect, view: MarketView, note: boolean): number {
    const pad = 18;
    const title = this.add
      .text(
        rect.x + pad,
        rect.y + pad,
        `END OF THE STALL · ${view.shelf.length} CARDS`,
        textStyle(bangers(22), surface.ink.hex),
      )
      .setOrigin(0, 0);
    fitText(title, rect.width - pad * 2, 22);
    let bottom = title.y + title.height;
    if (note) {
      const line = this.add
        .text(rect.x + pad, bottom + 8, "→ Anything you don't spend now stays banked for your next Market visit.", {
          ...textStyle({ ...typeRole.body, size: 13 }, surface.ink.hex),
          wordWrap: { width: rect.width - pad * 2 },
        })
        .setOrigin(0, 0);
      bottom = line.y + line.height;
    }
    const height = bottom + pad - rect.y;
    const g = this.add.graphics();
    g.lineStyle(border.control, surface.ink.hex, 0.55);
    dashedRect(g, { x: rect.x, y: rect.y, width: rect.width, height });
    return rect.y + height;
  }

  // ── Art, the printed line, This visit ──────────────────────────────────────────────────────────────────────────

  /** The phone's opening block: a small art panel beside the issue's stamp, the printed line and its citation. */
  #drawIntro(rect: Rect, wonLabel: string, view: MarketView): number {
    const artWidth = 84;
    const textX = rect.x + artWidth + 16;
    const textWidth = rect.width - artWidth - 16;
    const { rect: stampRect } = stamp(this, textX, rect.y, wonLabel, { size: 18 });
    const prompt = this.add
      .text(textX, stampRect.y + stampRect.height + 10, view.promptText, {
        ...textStyle({ ...typeRole.body, size: 14, lineHeight: 1.4 }, surface.ink.hex),
        wordWrap: { width: textWidth },
      })
      .setOrigin(0, 0);
    const cite = this.add
      .text(
        textX,
        prompt.y + prompt.height + 8,
        `The Market · ${view.citation}`.toUpperCase(),
        textStyle({ ...typeRole.label, size: 10 }, surface.ink.hex, ink.secondary),
      )
      .setOrigin(0, 0);
    const bottom = cite.y + cite.height;
    this.#drawArtBox(
      { x: rect.x, y: rect.y, width: artWidth, height: Math.min(110, bottom - rect.y) },
      "Stall art",
      true,
    );
    return bottom;
  }

  /**
   * The box's own Market artboard (`CampaignStory.marketArt`: GMW's Knowhere stall), cover-cropped; a placeholder
   * while it loads or for a box with none. `small` letters a label instead of the full picture note.
   */
  #drawArtBox(rect: Rect, note: string, small = false): void {
    const g = this.add.graphics();
    g.fillStyle(0xe4dcc9, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const record = this.#record;
    const art = record ? storyFor(record.campaignId as string)?.marketArt : undefined;
    // Focused high: the shopkeeper's face and the shelves behind him, not the counter.
    const image =
      record && art
        ? drawPicture(this, artboardPicture(record.campaignId as string, art.name), rect, () => this.#redrawOnce(), {
            focusY: 0.2,
          })
        : null;
    const frame = this.add.graphics();
    frame.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    if (image) return;
    if (small) {
      this.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2, note.toUpperCase(), {
          ...textStyle({ ...typeRole.label, size: 10 }, surface.ink.hex, ink.secondary),
          align: "center",
          wordWrap: { width: rect.width - 12 },
        })
        .setOrigin(0.5, 0.5);
      return;
    }
    artNote(this, rect, note);
  }

  /** A picture that finished loading redraws the screen once (several arriving together share one redraw). */
  #redrawOnce(): void {
    if (this.#redrawQueued) return;
    this.#redrawQueued = true;
    this.time.delayedCall(0, () => {
      this.#redrawQueued = false;
      if (this.sys.isActive()) this.#draw();
    });
  }

  #promptBoxHeight(width: number, view: MarketView): number {
    const probe = this.add.text(0, 0, view.promptText, {
      ...textStyle({ ...typeRole.body, size: 14, lineHeight: 1.4 }, surface.ink.hex),
      wordWrap: { width: width - 36 },
    });
    const height = probe.height + 18 + 18 + 22;
    probe.destroy();
    return height;
  }

  /** The printed line in a white box, its citation over it. Returns the box's bottom. */
  #drawPromptBox(rect: Rect, view: MarketView): number {
    const pad = 18;
    const g = this.add.graphics();
    const cite = this.add
      .text(
        rect.x + pad,
        rect.y + pad,
        `The Market · ${view.citation}`.toUpperCase(),
        textStyle({ ...typeRole.label, size: 11 }, surface.ink.hex, ink.secondary),
      )
      .setOrigin(0, 0);
    const text = this.add
      .text(rect.x + pad, cite.y + cite.height + 6, view.promptText, {
        ...textStyle({ ...typeRole.body, size: 14, lineHeight: 1.4 }, surface.ink.hex),
        wordWrap: { width: rect.width - pad * 2 },
      })
      .setOrigin(0, 0);
    const bottom = text.y + text.height + pad;
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, bottom - rect.y);
    g.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, bottom - rect.y);
    return bottom;
  }

  /** "THIS VISIT" over the receipt box: every line this visit, then what each seat keeps. Returns the box's bottom. */
  #drawReceipt(rect: Rect, view: MarketView): number {
    const heading = this.add
      .text(rect.x, rect.y, "THIS VISIT", textStyle(bangers(26), surface.ink.hex))
      .setOrigin(0, 0);
    let y = heading.y + heading.height + 8;
    this.add.rectangle(rect.x, y, rect.width, border.object, surface.ink.hex).setOrigin(0, 0);
    y += border.object + 18;
    const boxTop = y;
    const pad = 18;
    const g = this.add.graphics();
    let rowY = boxTop + pad;
    const title = this.add
      .text(rect.x + pad, rowY, "Receipt", textStyle({ ...typeRole.rowTitle, size: 17 }, surface.ink.hex))
      .setOrigin(0, 0);
    rowY += title.height + 8;
    if (view.receipt.length === 0) {
      const none = this.add
        .text(
          rect.x + pad,
          rowY,
          "Nothing in the cart yet.",
          textStyle({ ...typeRole.body, size: 14 }, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0, 0);
      rowY += none.height + 8;
    }
    for (const line of view.receipt) {
      const amount = this.add
        .text(
          rect.x + rect.width - pad,
          rowY,
          `−${line.price}U`,
          textStyle({ ...typeRole.rowTitle, size: 15 }, surface.ink.hex),
        )
        .setOrigin(1, 0);
      const name = this.add
        .text(
          rect.x + pad,
          rowY,
          `${line.heroName} · ${line.cardName}`,
          textStyle({ ...typeRole.body, size: 14 }, surface.ink.hex),
        )
        .setOrigin(0, 0);
      const room = rect.width - pad * 2 - amount.width - 12;
      if (line.inCart) {
        const note = this.add
          .text(
            name.x + name.width + 5,
            rowY,
            "(in cart)",
            textStyle({ ...typeRole.body, size: 14 }, surface.ink.hex, ink.meta),
          )
          .setOrigin(0, 0);
        if (name.width + 5 + note.width > room) note.setVisible(false);
      }
      fitText(name, room, 14);
      rowY += Math.max(name.height, amount.height) + 8;
    }
    rowY += 4;
    g.fillStyle(surface.ink.hex, 0.2).fillRect(rect.x + pad, rowY, rect.width - pad * 2, 2);
    rowY += 12;
    const kept = this.add
      .text(
        rect.x + rect.width - pad,
        rowY,
        view.leftoverBySeat.map((seat) => `${seat.units}U`).join(" · "),
        textStyle(bangers(24), surface.ink.hex),
      )
      .setOrigin(1, 0);
    const keptLabel = this.add
      .text(
        rect.x + pad,
        rowY + 4,
        "Left over, kept for later",
        textStyle({ ...typeRole.body, size: 14 }, surface.ink.hex, ink.secondary),
      )
      .setOrigin(0, 0);
    fitText(keptLabel, rect.width - pad * 2 - kept.width - 12, 14);
    const boxBottom = rowY + kept.height + pad;
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, boxTop, rect.width, boxBottom - boxTop);
    g.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, boxTop, rect.width, boxBottom - boxTop);
    return boxBottom;
  }

  #drawNotes(rect: Rect): number {
    const notes = [
      {
        icon: "✓",
        color: signal.heal.hex,
        title: "Units recorded",
        detail: "Units earned from the issue you just won are already in your wallet.",
      },
      {
        icon: "→",
        color: signal.cost.hex,
        title: "Unspent units carry over",
        detail: "Anything you don't spend now stays banked for your next Market visit.",
      },
    ];
    let y = rect.y;
    for (const note of notes) {
      const icon = this.add
        .text(rect.x, y, note.icon, textStyle({ ...typeRole.rowTitle, size: 16 }, note.color))
        .setOrigin(0, 0);
      const title = this.add
        .text(rect.x + icon.width + 6, y, note.title, textStyle({ ...typeRole.rowTitle, size: 15 }, surface.ink.hex))
        .setOrigin(0, 0);
      const detail = this.add
        .text(rect.x, y + title.height + 4, note.detail, {
          ...textStyle({ ...typeRole.body, size: 13, lineHeight: 1.45 }, surface.ink.hex, ink.secondary),
          wordWrap: { width: rect.width },
        })
        .setOrigin(0, 0);
      y = detail.y + detail.height + 20;
    }
    return y - 20;
  }

  // ── The bar and the phone's Receipt sheet ──────────────────────────────────────────────────────────────────────

  #drawBar(layout: MarketLayout, bar: Rect, gutter: number, view: MarketView, stops: Map<string, FocusStop>): void {
    this.add.rectangle(bar.x, bar.y, bar.width, bar.height, surface.ink.hex).setOrigin(0, 0);
    const pad = layout === "phone" || layout === "phoneLandscape" ? 12 : gutter;
    const count = this.#cart.length;
    const total = cartTotalOf(this.#cart);
    const summary = count === 0 ? "EMPTY" : `${count} ${count === 1 ? "CARD" : "CARDS"} · ${total}U`;
    const activeName = view.wallets.find((wallet) => wallet.active)?.heroName ?? "";
    const cartLabel = layout === "phone" || layout === "phoneLandscape" ? "CART" : `${activeName.toUpperCase()}'S CART`;
    const done = (rect: Rect): void => {
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Done shopping ▸",
          type: typeRole.barTitle,
          rect,
          onClick: () => void this.#checkout(),
          enabled: !this.#busy,
        }),
      );
      stops.set("done", { rect, activate: () => void this.#checkout() });
    };
    const receipt = (rect: Rect): void => {
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: "Receipt",
          type: typeRole.menuButton,
          rect,
          onClick: () => this.#setReceiptOpen(true),
        }),
      );
      stops.set("receipt", { rect, activate: () => this.#setReceiptOpen(true) });
    };
    const lead = (x: number, cy: number, maxWidth: number): void => {
      const tag = this.add
        .text(x, cy, cartLabel, textStyle({ ...typeRole.label, size: 11 }, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0.5);
      const value = this.add
        .text(tag.x + tag.width + 14, cy, summary, textStyle(bangers(layout === "wide" ? 30 : 26), surface.paper.hex))
        .setOrigin(0, 0.5);
      fitText(value, Math.max(60, maxWidth - tag.width - 14), layout === "wide" ? 30 : 26);
    };

    if (layout === "phone") {
      const rowY = bar.y + 12;
      const receiptRect: Rect = { x: bar.width - pad - 110, y: rowY, width: 110, height: 48 };
      receipt(receiptRect);
      lead(pad + 8, rowY + 24, receiptRect.x - pad - 20);
      done({ x: pad, y: rowY + 48 + 12, width: bar.width - pad * 2, height: bar.y + bar.height - 12 - (rowY + 60) });
      return;
    }
    if (layout === "phoneLandscape") {
      const doneWidth = Math.min(300, Math.round(bar.width * 0.36));
      const doneRect: Rect = {
        x: bar.width - pad - doneWidth,
        y: bar.y + 8,
        width: doneWidth,
        height: bar.height - 16,
      };
      const receiptRect: Rect = { x: doneRect.x - 14 - 110, y: bar.y + 10, width: 110, height: bar.height - 20 };
      receipt(receiptRect);
      done(doneRect);
      lead(pad + 8, bar.y + bar.height / 2, receiptRect.x - pad - 24);
      return;
    }
    if (layout === "tabletPortrait") {
      // Upright there is room to spell the cart out and what each seat keeps, over Done.
      const cy = bar.y + 30;
      const tag = this.add
        .text(pad, cy, cartLabel, textStyle({ ...typeRole.label, size: 11 }, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0.5);
      const kept = this.add
        .text(
          bar.width - pad,
          cy,
          view.leftoverBySeat.map((seat) => `${seat.units}U`).join(" · "),
          textStyle(bangers(26), signal.caution.hex),
        )
        .setOrigin(1, 0.5);
      const keptTag = this.add
        .text(
          kept.x - kept.width - 16,
          cy,
          "KEPT FOR LATER",
          textStyle({ ...typeRole.label, size: 11 }, surface.paper.hex, ink.secondary),
        )
        .setOrigin(1, 0.5);
      const lines =
        this.#cart.length === 0
          ? "Nothing yet. Tap a card to add it."
          : this.#cart.map((item) => `${cardOf(item.cardId)?.name ?? item.cardId} −${item.price}U`).join(" · ");
      const cartText = this.add
        .text(tag.x + tag.width + 16, cy, lines, textStyle({ ...typeRole.rowTitle, size: 15 }, surface.paper.hex))
        .setOrigin(0, 0.5);
      fitText(cartText, keptTag.x - keptTag.width - 24 - cartText.x, 15);
      const doneWidth = Math.min(440, bar.width - pad * 2);
      done({ x: bar.width - pad - doneWidth, y: bar.y + 58, width: doneWidth, height: bar.height - 58 - 14 });
      return;
    }
    const doneWidth = Math.min(440, Math.round(bar.width * 0.32));
    const doneRect: Rect = { x: bar.width - pad - doneWidth, y: bar.y + 12, width: doneWidth, height: bar.height - 24 };
    done(doneRect);
    lead(pad, bar.y + bar.height / 2, doneRect.x - pad - 24);
  }

  /** The phone's receipt: a sheet over the screen with This visit, and Close. */
  #drawReceiptSheet(view: MarketView): Rect {
    const { width, height } = this.scale.gameSize;
    const scrim = this.add.rectangle(0, 0, width, height, surface.void.hex, 0.6).setOrigin(0, 0);
    scrim.setInteractive().on("pointerup", () => this.#setReceiptOpen(false));
    const sheetWidth = Math.min(width - 32, 460);
    const x = (width - sheetWidth) / 2;
    const pad = 20;
    const closeHeight = 52;
    // Drawn from the top, measured, then centered: everything drawn after the panel moves down by the same amount.
    const panel = this.add.graphics();
    const start = this.children.list.length;
    const receiptBottom = this.#drawReceipt({ x: x + pad, y: pad, width: sheetWidth - pad * 2, height: 0 }, view);
    const sheetHeight = receiptBottom + 16 + closeHeight + pad;
    const y = Math.max(8, (height - sheetHeight) / 2);
    for (const object of this.children.list.slice(start)) (object as unknown as { y: number }).y += y;
    panel.fillStyle(surface.paper.hex, 1).fillRect(x, y, sheetWidth, sheetHeight);
    panel.lineStyle(border.object, surface.ink.hex, 1).strokeRect(x, y, sheetWidth, sheetHeight);
    const closeRect: Rect = { x: x + pad, y: y + receiptBottom + 16, width: sheetWidth - pad * 2, height: closeHeight };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Close",
        type: typeRole.menuButton,
        rect: closeRect,
        onClick: () => this.#setReceiptOpen(false),
      }),
    );
    return closeRect;
  }

  // ── Scrolling ──────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Draws `draw`'s content into a new scroll region over `viewport`: the content is drawn at the top level as it would
   * be without scrolling, then moved into the region, sized to the bottom `draw` returns. Controls in it take input
   * only while wholly in view, and their focus stops scroll themselves into view.
   */
  #scrolled(
    viewport: Rect,
    scroll: VariableListScroll,
    stops: Map<string, FocusStop>,
    draw: (region: McScrollRegion) => number,
  ): void {
    // A placeholder until the content is drawn, so a kept offset survives the region's first layout.
    const heights: number[] = [1_000_000];
    // The region calls `onScroll` once while it is built, before `region` is assigned below.
    let region: McScrollRegion | null = null;
    region = new McScrollRegion(this, {
      rect: viewport,
      heights,
      scroll,
      clipInteractive: true,
      enabled: () => !this.#receiptOpen,
      onScroll: () => {
        if (region === null || region !== this.#shelfRegion) return;
        this.#syncActivePrice();
        this.#fillThumbs();
      },
    });
    this.#regions.push(region);
    const fromIndex = this.children.list.length;
    const stopsBefore = new Set(stops.keys());
    const bottom = draw(region);
    captureIntoRegion(this, {
      region,
      heights,
      scroll,
      fromIndex,
      stops,
      stopsBefore,
      viewportTop: viewport.y,
      viewportBottom: viewport.y + viewport.height,
      bottom,
    });
  }

  /** The shelf cards on screen now, each clipped to the region it scrolls in: what the desktop hover popover reads. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    if (this.#receiptOpen) return found;
    this.#shelfCards.forEach(({ cardId, rect, region }, index) => {
      const shown = clipHoverRect({ ...rect, y: rect.y + region.content.y }, region.rect);
      if (shown) found.set(hoverSlotOf(cardId, index), { ...shown, cardId, through: true });
    });
    return found;
  }
}

/** A dashed outline: an empty slot in the design system's depth model. */
function dashedRect(g: Phaser.GameObjects.Graphics, rect: Rect): void {
  const dash = border.dashSegment + 2;
  const gap = border.dashGap + 1;
  const side = (x1: number, y1: number, x2: number, y2: number): void => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < length; d += dash + gap) {
      const e = Math.min(d + dash, length);
      g.lineBetween(
        x1 + ((x2 - x1) * d) / length,
        y1 + ((y2 - y1) * d) / length,
        x1 + ((x2 - x1) * e) / length,
        y1 + ((y2 - y1) * e) / length,
      );
    }
  };
  const { x, y, width, height } = rect;
  side(x, y, x + width, y);
  side(x + width, y, x + width, y + height);
  side(x + width, y + height, x, y + height);
  side(x, y + height, x, y);
}
