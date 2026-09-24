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
 */
import Phaser from "phaser";
import type { AnyCard } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice, LogValue } from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS } from "../../content/pool.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { campaignService } from "../../session.js";
import { ink, signal, surface, typeRole } from "../../tokens.js";
import {
  actionBarCta,
  artNote,
  campaignFrame,
  drawActionBar,
  drawTopBar,
  ruleHeading,
  speechBubble,
  stamp,
} from "../../ui/campaign-chrome.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { textStyle } from "../../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McButton, fitText, label } from "../../ui/widgets.js";
import {
  answerMarketAsk,
  canAddToCart,
  isMarketPendingChoice,
  marketCatalogOf,
  marketViewOf,
  type MarketCartItem,
  type MarketShelfCard,
  type MarketView,
} from "../../view/campaign-market-model.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignMarketData } from "./routes.js";

const cardOf = (id: string): AnyCard | undefined => CARDS_BY_ID.get(id);
/** Every campaign's Market-priced catalog this build ships, built once (`unitCost` never changes at runtime). */
const CATALOG = marketCatalogOf(POOL_CARDS);

/** A campaign log's numeric field, read the same defensive way `campaign-market-model.ts`'s own `numberField` does. */
const numberField = (value: LogValue | undefined): number => (value?.kind === "number" ? value.value : 0);

export class CampaignMarketScene extends Phaser.Scene {
  #data!: CampaignMarketData;
  #record: CampaignRecord | null = null;
  #nodeIds: readonly string[] = [];
  #answers: CampaignChoiceAnswer[] = [];
  #pending: CampaignPendingChoice | null = null;
  #busy = false;
  /** "See the full stall": once toggled, the shelf shows every catalog card instead of the first page. */
  #showFullStall = false;
  /** The active seat's own basket this visit — see the file header's "A whole cart, one seat at a time". */
  #cart: MarketCartItem[] = [];
  /** Which seat `#cart` belongs to, so a new active seat always starts from an empty basket. */
  #cartSeatNumber: number | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

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
    this.#showFullStall = false;
    this.#cart = [];
    this.#cartSeatNumber = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0xf2ece0);
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#draw, this));
    void this.#load();
    fadeScreenIn(this);
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
    goToScreen(this, SCENES.campaignBriefing, { runId: record.id, answers: this.#answers });
  }

  /** Adds or removes `cardId` from the active seat's cart — never talks to the runner (see the file header). */
  #toggleCart(cardId: string, price: number): void {
    if (this.#busy) return;
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
    if (this.#busy) return;
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
    return seat ? (CARDS_BY_ID.get(seat.identityCardId as string)?.name ?? `Seat ${seatNumber}`) : `Seat ${seatNumber}`;
  };

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const record = this.#record;
    const { width, height, phone, gutter } = campaignFrame(this);
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
    const top = drawTopBar(this, {
      backLabel: `◂ Issue #${afterIssueNumber}`,
      onBack: back,
      title: "The Market",
      right: `After issue #${afterIssueNumber}`,
    });
    const stops = new Map<string, FocusStop>();
    if (top.back && top.backRect) stops.set("back", { rect: top.backRect, activate: back });

    const actionBar = drawActionBar(this);
    const contentBottom = actionBar.y - 16;
    const pending = this.#pending;

    if (!pending) {
      label(this, gutter, top.height + 24, "Composing…", typeRole.label, surface.ink.hex, ink.secondary);
      this.#route = this.#route ?? new FocusRoute(this, { onCancel: back });
      this.#route.set([...stops.keys()], stops);
      return;
    }

    // A new active seat always starts from an empty basket — see the file header's "A whole cart, one seat at a
    // time" and `campaign-market-model.ts`'s own header.
    if (this.#cartSeatNumber !== pending.seatNumber) {
      this.#cart = [];
      this.#cartSeatNumber = pending.seatNumber;
    }

    // Phone has no room for a sixth row below the fixed action bar without a scrolling list (out of scope this
    // pass) — one fewer card keeps "See the full stall" itself on screen instead of clipped behind the CTA.
    const pageSize = this.#showFullStall ? CATALOG.length : phone ? 3 : 5;
    const view = marketViewOf(
      record.seats,
      pending,
      this.#answers,
      this.#cart,
      CATALOG,
      cardOf,
      this.#heroNameOf,
      pageSize,
    );

    if (phone) {
      this.#drawPhone(
        { x: gutter, y: top.height + 16, width: width - gutter * 2, height: contentBottom - top.height - 16 },
        afterIssueNumber,
        view,
        stops,
      );
    } else {
      const leftWidth = Math.round((width - gutter * 2 - 64) * 0.3);
      const midWidth = Math.round((width - gutter * 2 - 64) * 0.45);
      const leftRect: Rect = {
        x: gutter,
        y: top.height + 20,
        width: leftWidth,
        height: contentBottom - top.height - 20,
      };
      const midRect: Rect = { x: leftRect.x + leftWidth + 32, y: leftRect.y, width: midWidth, height: leftRect.height };
      const rightRect: Rect = {
        x: midRect.x + midWidth + 32,
        y: leftRect.y,
        width: width - gutter - (midRect.x + midWidth + 32),
        height: leftRect.height,
      };
      this.#drawArtPanel(leftRect, afterIssueNumber, view);
      let y = this.#drawWallets(midRect, view);
      this.#drawShelf(
        { x: midRect.x, y: y + 16, width: midRect.width, height: midRect.y + midRect.height - y - 16 },
        view,
        stops,
      );
      y = this.#drawReceipt(rightRect, view);
      this.#drawNotes({ x: rightRect.x, y: y + 20, width: rightRect.width, height: 0 }, view, false);
    }

    const doneRect = actionBarCta(actionBar, phone);
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Done shopping ▸",
        type: typeRole.barTitle,
        rect: doneRect,
        onClick: () => void this.#checkout(),
        enabled: !this.#busy,
      }),
    );
    stops.set("done", { rect: doneRect, activate: () => void this.#checkout() });

    this.#route = this.#route ?? new FocusRoute(this, { onCancel: back });
    this.#route.set([...stops.keys()], stops);
  }

  #drawPhone(rect: Rect, issueNumber: number, view: MarketView, stops: Map<string, FocusStop>): void {
    let y = rect.y;
    const artRect: Rect = { x: rect.x, y, width: rect.width, height: 150 };
    this.#drawArt(artRect, issueNumber);
    y += artRect.height + 14;
    const { rect: bubbleRect } = speechBubble(this, rect.x, y, rect.width, view.promptText, {
      speaker: `The Market · ${view.citation}`,
      tail: "bottom",
    });
    y = bubbleRect.y + bubbleRect.height + 16;
    y = this.#drawWallets({ x: rect.x, y, width: rect.width, height: 0 }, view);
    y = this.#drawShelf({ x: rect.x, y: y + 16, width: rect.width, height: 999 }, view, stops);
    this.#drawNotes({ x: rect.x, y: y + 16, width: rect.width, height: 0 }, view, true);
  }

  #drawArt(rect: Rect, issueNumber: number): void {
    const { rect: badgeRect } = stamp(this, rect.x, rect.y, `Issue #${issueNumber} · Won`, { ground: signal.heal.hex });
    const artTop = rect.y + badgeRect.height + 10;
    const artRect: Rect = {
      x: rect.x,
      y: artTop,
      width: rect.width,
      height: Math.max(60, rect.height - badgeRect.height - 10),
    };
    const g = this.add.graphics();
    g.fillStyle(0xe4dcc9, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(artRect.x, artRect.y, artRect.width, artRect.height);
    artNote(this, artRect, "Panel art: Knowhere black-market stall");
  }

  #drawArtPanel(rect: Rect, issueNumber: number, view: MarketView): void {
    const bubbleHeight = 130;
    const artRect: Rect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: Math.max(80, rect.height - bubbleHeight - 16),
    };
    this.#drawArt(artRect, issueNumber);
    speechBubble(this, rect.x, artRect.y + artRect.height + 16, rect.width, view.promptText, {
      speaker: `The Market · ${view.citation}`,
      tail: "bottom",
    });
  }

  /** "ROCKET  5 → 1U" · "GROOT  3 → 0U": one box per seat, the active one drawn with the heavier ink border. */
  #drawWallets(rect: Rect, view: MarketView): number {
    const rowHeight = 52;
    const gap = 12;
    const boxWidth = (rect.width - gap * Math.max(0, view.wallets.length - 1)) / Math.max(1, view.wallets.length);
    view.wallets.forEach((wallet, index) => {
      const boxRect: Rect = { x: rect.x + index * (boxWidth + gap), y: rect.y, width: boxWidth, height: rowHeight };
      const g = this.add.graphics();
      g.fillStyle(wallet.active ? 0xf5efe0 : surface.paper.hex, 1).fillRect(
        boxRect.x,
        boxRect.y,
        boxRect.width,
        boxRect.height,
      );
      g.lineStyle(wallet.active ? 3 : 1.5, surface.ink.hex, wallet.active ? 1 : 0.4).strokeRect(
        boxRect.x,
        boxRect.y,
        boxRect.width,
        boxRect.height,
      );
      const valueText = this.add
        .text(
          boxRect.x + boxRect.width - 12,
          boxRect.y + boxRect.height / 2,
          `${wallet.before} → ${wallet.after}U`,
          textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex),
        )
        .setOrigin(1, 0.5);
      const name = this.add
        .text(
          boxRect.x + 12,
          boxRect.y + boxRect.height / 2,
          wallet.heroName.toUpperCase(),
          textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex),
        )
        .setOrigin(0, 0.5);
      fitText(name, boxRect.width - valueText.width - 30, 14);
    });
    return rect.y + rowHeight;
  }

  #drawShelf(rect: Rect, view: MarketView, stops: Map<string, FocusStop>): number {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "On the shelf", surface.ink.hex, 18);
    const cols = 2;
    const gap = 12;
    const rowGap = 26; // room for a tag poking above the next row's cell (`#tag`'s own `rect.y - 10`).
    const cellWidth = (rect.width - gap * (cols - 1)) / cols;
    const cellHeight = 108;
    const rowTop = (row: number): number => y + row * cellHeight + row * rowGap;
    view.shelf.forEach((card, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cellRect: Rect = {
        x: rect.x + col * (cellWidth + gap),
        y: rowTop(row),
        width: cellWidth,
        height: cellHeight,
      };
      this.#drawShelfCard(cellRect, card, stops);
    });
    const rows = Math.ceil(view.shelf.length / cols);
    let bottom = rowTop(rows);
    if (view.overflowCount > 0 && !this.#showFullStall) {
      const overflowCol = view.shelf.length % cols;
      const overflowRow = Math.floor(view.shelf.length / cols);
      const cellRect: Rect = {
        x: rect.x + overflowCol * (cellWidth + gap),
        y: rowTop(overflowRow),
        width: cellWidth,
        height: cellHeight,
      };
      this.#drawSeeFullStall(cellRect, view.overflowCount, stops);
      bottom = Math.max(bottom, cellRect.y + cellRect.height);
    }
    return bottom;
  }

  #drawShelfCard(rect: Rect, card: MarketShelfCard, stops: Map<string, FocusStop>): void {
    const clickable = card.state.kind === "live" || card.state.kind === "inCart";
    const dim = card.state.kind === "unaffordable" || card.state.kind === "taken" || card.state.kind === "capped";
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, dim ? 0.6 : 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(
      card.state.kind === "inCart" ? 3 : 1.5,
      card.state.kind === "inCart" ? signal.caution.hex : surface.ink.hex,
      dim ? 0.35 : 1,
    );
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    const textColor = dim ? ink.disabled : surface.ink.hex;
    this.add
      .text(
        rect.x + 10,
        rect.y + 6,
        `${card.typeLabel} · ${card.price}U`,
        textStyle(typeRole.label, textColor, ink.secondary),
      )
      .setOrigin(0, 0)
      .setFontSize(11);
    const name = this.add
      .text(rect.x + 10, rect.y + 22, card.name.toUpperCase(), textStyle({ ...typeRole.rowTitle, size: 14 }, textColor))
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - 20);
    fitText(name, rect.width - 20, 14);
    const detailText = card.detail.length > 118 ? `${card.detail.slice(0, 115)}…` : card.detail;
    const detail = this.add
      .text(rect.x + 10, rect.y + 22 + name.height + 4, detailText, textStyle(typeRole.body, textColor, ink.secondary))
      .setOrigin(0, 0)
      .setFontSize(11)
      .setWordWrapWidth(rect.width - 20);
    void detail;

    if (card.state.kind === "inCart") this.#tag(rect, "In your cart", signal.caution.hex, surface.ink.hex);
    else if (card.state.kind === "taken") this.#centeredTag(rect, `${card.state.heroName.toUpperCase()} bought it`);
    else if (card.state.kind === "capped") this.#tag(rect, "Tier full (4)", surface.void.hex, surface.paper.hex);
    else if (card.state.kind === "unaffordable")
      this.#tag(rect, `Need ${card.state.need}`, surface.void.hex, surface.paper.hex);

    if (clickable) {
      const zone = this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const cardId = card.cardId as string;
      const price = card.price;
      zone.on("pointerup", () => this.#toggleCart(cardId, price));
      const key = `cart:${cardId}`;
      stops.set(key, { rect, activate: () => this.#toggleCart(cardId, price) });
    }
  }

  #tag(rect: Rect, text: string, ground: number, color: number): void {
    const t = this.add.text(0, 0, text.toUpperCase(), textStyle(typeRole.label, color)).setFontSize(10);
    const tagRect: Rect = {
      x: rect.x + rect.width - t.width - 14,
      y: rect.y - 10,
      width: t.width + 10,
      height: t.height + 4,
    };
    const g = this.add.graphics();
    g.fillStyle(ground, 1).fillRect(tagRect.x, tagRect.y, tagRect.width, tagRect.height);
    g.lineStyle(1, surface.ink.hex, 1).strokeRect(tagRect.x, tagRect.y, tagRect.width, tagRect.height);
    t.setPosition(tagRect.x + 5, tagRect.y + 2);
    this.children.bringToTop(t);
  }

  #centeredTag(rect: Rect, text: string): void {
    const g = this.add.graphics();
    // Just under the title row, not mid-paragraph, so the wrapped body text underneath still reads as a whole
    // sentence rather than being sliced by the bar.
    const barRect: Rect = { x: rect.x, y: rect.y + 40, width: rect.width, height: 20 };
    g.fillStyle(surface.ink.hex, 0.85).fillRect(barRect.x, barRect.y, barRect.width, barRect.height);
    this.add
      .text(rect.x + rect.width / 2, barRect.y + barRect.height / 2, text, textStyle(typeRole.label, surface.paper.hex))
      .setOrigin(0.5, 0.5)
      .setFontSize(11);
  }

  #drawSeeFullStall(rect: Rect, overflowCount: number, stops: Map<string, FocusStop>): void {
    const g = this.add.graphics();
    g.lineStyle(1.5, surface.ink.hex, 0.6).strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.add
      .text(
        rect.x + 10,
        rect.y + 6,
        `Market · ${overflowCount} more`,
        textStyle(typeRole.label, surface.ink.hex, ink.secondary),
      )
      .setOrigin(0, 0)
      .setFontSize(11);
    this.add
      .text(
        rect.x + 10,
        rect.y + 26,
        "See the full stall",
        textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex),
      )
      .setOrigin(0, 0);
    this.add
      .text(
        rect.x + 10,
        rect.y + 50,
        "Sorted by what you can afford.",
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setOrigin(0, 0)
      .setFontSize(11)
      .setWordWrapWidth(rect.width - 20);
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    const show = (): void => {
      this.#showFullStall = true;
      this.#draw();
    };
    zone.on("pointerup", show);
    stops.set("full-stall", { rect, activate: show });
  }

  #drawReceipt(rect: Rect, view: MarketView): number {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "This visit", surface.ink.hex, 18);
    const boxTop = y;
    const rowHeight = 24;
    const lines = view.receipt.length > 0 ? view.receipt.length : 1;
    const boxHeight = 34 + lines * rowHeight + view.leftoverBySeat.length * rowHeight + 10;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, boxTop, rect.width, boxHeight);
    this.add
      .text(rect.x + 12, boxTop + 10, "Receipt", textStyle({ ...typeRole.rowTitle, size: 15 }, surface.ink.hex))
      .setOrigin(0, 0);
    let rowY = boxTop + 34;
    if (view.receipt.length === 0) {
      this.add
        .text(
          rect.x + 12,
          rowY,
          "Nothing bought yet this visit.",
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0, 0)
        .setFontSize(12);
      rowY += rowHeight;
    } else {
      for (const line of view.receipt) {
        const label = line.inCart
          ? `${line.heroName} · ${line.cardName} (in cart)`
          : `${line.heroName} · ${line.cardName}`;
        this.add
          .text(rect.x + 12, rowY, label, textStyle(typeRole.body, line.inCart ? signal.caution.hex : surface.ink.hex))
          .setOrigin(0, 0)
          .setFontSize(12)
          .setWordWrapWidth(rect.width - 90);
        this.add
          .text(
            rect.x + rect.width - 12,
            rowY,
            `-${line.price}u`,
            textStyle({ ...typeRole.rowTitle, size: 13 }, line.inCart ? signal.caution.hex : surface.ink.hex),
          )
          .setOrigin(1, 0);
        rowY += rowHeight;
      }
    }
    this.add
      .text(rect.x + 12, rowY, "Left over, kept for later", textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setFontSize(12);
    this.add
      .text(
        rect.x + rect.width - 12,
        rowY,
        view.leftoverBySeat.map((leftover) => `${leftover.units}u`).join(" · "),
        textStyle({ ...typeRole.rowTitle, size: 13 }, signal.caution.hex),
      )
      .setOrigin(1, 0);
    return boxTop + boxHeight;
  }

  #drawNotes(rect: Rect, view: MarketView, phone: boolean): void {
    const notes: { readonly icon: string; readonly title: string; readonly detail: string }[] = [
      {
        icon: "✓",
        title: "Units recorded",
        detail: "Units earned from the issue you just won are already in your wallet above.",
      },
      {
        icon: "→",
        title: "Unspent units carry over",
        detail: "Anything you don't spend now stays banked for your next Market visit.",
      },
    ];
    let y = rect.y;
    for (const note of notes) {
      const glyphColor = note.icon === "✓" ? signal.heal.hex : signal.cost.hex;
      this.add.text(rect.x, y, note.icon, textStyle({ ...typeRole.rowTitle, size: 14 }, glyphColor)).setOrigin(0, 0);
      const title = this.add
        .text(rect.x + 22, y, `${note.title}`, textStyle({ ...typeRole.rowTitle, size: 13 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 100);
      this.add
        .text(rect.x + rect.width, y, view.citation, textStyle(typeRole.label, surface.ink.hex, ink.meta))
        .setOrigin(1, 0)
        .setFontSize(10);
      const detail = this.add
        .text(rect.x + 22, y + title.height + 2, note.detail, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0)
        .setFontSize(11)
        .setWordWrapWidth(rect.width - 22);
      y += title.height + 2 + detail.height + 14;
    }
    void phone;
    this.add
      .text(
        rect.x,
        y,
        "One copy of each card for the whole crew. Price and wallet always sit side by side, so nobody does the maths.",
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setOrigin(0, 0)
      .setFontSize(11)
      .setWordWrapWidth(rect.width);
  }
}
