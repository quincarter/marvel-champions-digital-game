/**
 * The frozen-deck screen (design tile 20, "Deck edit — Expert"): what `scenes/campaign/deck-edit.ts` shows in
 * place of the ordinary deck builder once MC16 p. 5's Expert Campaign freeze has locked a seat's deck. A read-only
 * summary — what's locked, what's still open (campaign cards), and when The Market next opens — never a second
 * legality engine: every verdict comes from `view/campaign-frozen-deck-model.ts`'s `frozenDeckModelOf`, itself
 * built on `campaignDeckEditModel`/`validateDeck`, the same functions the ordinary builder reads.
 *
 * **THE MARKET's own enabled state is a one-shot, throwaway peek.** `campaignService().compose(record, [])` never
 * persists anything unless composing reaches `"done"` (`campaign-service.ts`'s own doc comment), so calling it here
 * to see whether the very next question is Market-shaped costs nothing — the result is read once and discarded,
 * never stored, exactly the read-only spirit `deck-edit.ts`'s own `discardAttempt` call already keeps this route to.
 */
import Phaser from "phaser";
import type { AnyCard, CardId } from "@mc/content";
import { CAMPAIGNS } from "@mc/cards";
import { CARDS_BY_ID, POOL_CARDS } from "../../content/pool.js";
import { CAMPAIGN_RECORDS } from "../../campaign/campaign-service.js";
import { campaignService } from "../../session.js";
import { signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import {
  actionBarCta,
  bangers,
  campaignFrame,
  drawActionBar,
  drawTopBar,
  ruleHeading,
} from "../../ui/campaign-chrome.js";
import { McButton } from "../../ui/widgets.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import {
  campaignDeckContextOf,
  campaignDeckEditModel,
  frozenNonCampaignCardsOf,
} from "../../view/campaign-deck-edit-model.js";
import { frozenDeckMarketCta, frozenDeckModelOf, type FrozenDeckModel } from "../../view/campaign-frozen-deck-model.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignFrozenDeckData } from "./routes.js";

/** Below this, the two-column split (breakdown box / "Still yours to change") doesn't have room, and the screen stacks — matches `scenes/deck-builder.ts`/`view/deck-check-layout.ts`'s own `WIDE_MIN_WIDTH`. */
const WIDE_MIN_WIDTH = 1000;
const LEFT_COLUMN_SHARE = 0.55;

const cardOf = (id: string): AnyCard | undefined => CARDS_BY_ID.get(id);

export class CampaignFrozenDeckScene extends Phaser.Scene {
  #data: CampaignFrozenDeckData | null = null;
  #model: FrozenDeckModel | null = null;
  #status: string | null = null;
  #route: FocusRoute | null = null;
  #buttons: McButton[] = [];

  constructor() {
    super(SCENES.campaignFrozenDeck);
  }

  create(data: CampaignFrozenDeckData): void {
    this.#data = data;
    this.#model = null;
    this.#status = "Loading…";
    this.#route = new FocusRoute(this, { onCancel: () => this.#goBack() });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
    fadeScreenIn(this);
    void this.#load(data);
  }

  #goBack(): void {
    const data = this.#data;
    if (data) goToScreen(this, data.returnTo.key, data.returnTo.data);
  }

  async #load(data: CampaignFrozenDeckData): Promise<void> {
    const service = campaignService();
    const record = await service.load(data.runId);
    if (!this.sys.isActive()) return;
    if (!record) {
      this.#status = "This campaign run could not be found.";
      this.#draw();
      return;
    }
    // Same as `deck-edit.ts`: a composed-but-unplayed attempt is thrown away before this screen reads the log, so
    // the summary always reflects the log a fresh Briefing visit would recompose from.
    const current = record.attempt ? await service.discardAttempt(record) : record;
    const seat = current.seats.find((candidate) => candidate.seatNumber === data.seatNumber);
    if (!seat) {
      this.#status = `This campaign has no seat ${data.seatNumber}.`;
      this.#draw();
      return;
    }
    const content = CAMPAIGN_RECORDS[current.campaignId as string];
    const definition = CAMPAIGNS[current.campaignId as string];
    if (!content || !definition) {
      this.#status = `This build cannot show a frozen deck for "${current.campaignId as string}".`;
      this.#draw();
      return;
    }
    const frozenNonCampaignCards = frozenNonCampaignCardsOf(definition, current, data.seatNumber);
    if (!frozenNonCampaignCards) {
      // The deck isn't (or is no longer) frozen — a stale link, or the freeze rule changed under this record.
      // `deck-edit.ts` owns the real branch; hand it straight back so it can route to the ordinary builder.
      this.scene.start(SCENES.campaignDeckEdit, {
        runId: data.runId,
        seatNumber: data.seatNumber,
        returnTo: data.returnTo,
      });
      return;
    }
    const context = campaignDeckContextOf(content, current, data.seatNumber, { frozenNonCampaignCards });
    const editModel = campaignDeckEditModel(seat.deck, POOL_CARDS, context);

    // A one-shot, throwaway peek at the runner's very next question — see the file header. Never persisted.
    const nextNodeId = current.attempt?.nodeId ?? current.position.nextNodeId;
    const peeked = nextNodeId ? await service.compose(current, []) : null;
    const nextPending = peeked?.kind === "pending" ? peeked.choice : null;

    const grantedCardIdsCampaignWide = new Set<CardId>(
      current.seats.flatMap((candidate) => candidate.grants.map((grant) => grant.cardId)),
    );

    this.#model = frozenDeckModelOf({
      frozenCards: frozenNonCampaignCards,
      editModel,
      pool: POOL_CARDS,
      grants: seat.grants,
      definition,
      frozenAtNodeId: definition.graph.kind === "linear" ? (definition.graph.nodes[0]?.id ?? "") : "",
      nextNodeId: current.position.nextNodeId,
      nextPending,
      cardOf,
      seatFields: seat.fields,
      grantedCardIdsCampaignWide,
    });
    this.#status = null;
    this.#draw();
  }

  #draw(): void {
    destroyChildren(this);
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    const frame = campaignFrame(this);
    const data = this.#data;
    const title = data ? `${data.title}'s deck` : "Deck";

    drawTopBar(this, {
      backLabel: "◂ Back",
      onBack: () => this.#goBack(),
      title,
      right: "EXPERT CAMPAIGN",
    });

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    if (this.#status) {
      this.add
        .text(0, 0, this.#status, textStyle(typeRole.body, surface.ink.hex))
        .setPosition(frame.gutter, frame.topBar + 24)
        .setWordWrapWidth(frame.width - frame.gutter * 2);
      this.#route?.set(order, stops);
      return;
    }
    const model = this.#model;
    if (!model) {
      this.#route?.set(order, stops);
      return;
    }

    const bodyTop = frame.topBar + frame.gutter;
    const bodyBottom = frame.height - frame.actionBar - frame.gutter;
    const wide = frame.width >= WIDE_MIN_WIDTH && !frame.phone;
    const leftWidth = wide
      ? Math.floor((frame.width - frame.gutter * 3) * LEFT_COLUMN_SHARE)
      : frame.width - frame.gutter * 2;
    const leftRect: Rect = { x: frame.gutter, y: bodyTop, width: leftWidth, height: bodyBottom - bodyTop };

    this.#drawBanner(leftRect, model);
    const boxTop = leftRect.y + this.#bannerHeight(leftRect, model) + 16;
    this.#drawBreakdown({ x: leftRect.x, y: boxTop, width: leftRect.width, height: bodyBottom - boxTop }, model);

    const rightRect: Rect = wide
      ? {
          x: leftRect.x + leftRect.width + frame.gutter,
          y: bodyTop,
          width: frame.width - frame.gutter * 2 - leftRect.width - frame.gutter,
          height: bodyBottom - bodyTop,
        }
      : {
          x: frame.gutter,
          y: boxTop + this.#breakdownHeight(leftRect, model) + 24,
          width: frame.width - frame.gutter * 2,
          height: bodyBottom - (boxTop + this.#breakdownHeight(leftRect, model) + 24),
        };
    this.#drawStillYours(rightRect, model);

    this.#drawActionBar(frame, model, stops, order);
    this.#route?.set(order, stops);
  }

  #bannerHeight(rect: Rect, model: FrozenDeckModel): number {
    const titleHeight = 22;
    const bodyLines = Math.ceil(this.#measureWrap(model.bannerReason, rect.width - 32, 13) / 13);
    return 16 + titleHeight + 8 + bodyLines * 17 + 16;
  }

  #measureWrap(text: string, width: number, fontSize: number): number {
    // A cheap estimate (chars-per-line at ~0.52 average glyph width) good enough to size a box before drawing its
    // real wrapped text object — Phaser only reports a `Text`'s wrapped height once it exists on the display list.
    const charsPerLine = Math.max(10, Math.floor(width / (fontSize * 0.52)));
    return Math.max(1, Math.ceil(text.length / charsPerLine)) * fontSize;
  }

  #drawBanner(rect: Rect, model: FrozenDeckModel): void {
    const height = this.#bannerHeight(rect, model);
    const g = this.add.graphics();
    g.fillStyle(signal.caution.hex, 1).fillRect(rect.x, rect.y, rect.width, height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, height);
    this.add
      .text(rect.x + 16, rect.y + 14, `FROZEN SINCE ISSUE #${model.frozenSinceIssueNumber}`, {
        ...textStyle(bangers(20), surface.ink.hex),
      })
      .setOrigin(0, 0);
    this.add
      .text(rect.x + 16, rect.y + 44, model.bannerReason, { ...textStyle(typeRole.body, surface.ink.hex, 0.85) })
      .setFontSize(13)
      .setWordWrapWidth(rect.width - 32);
  }

  #breakdownHeight(rect: Rect, model: FrozenDeckModel): number {
    return 34 + model.rows.length * 56 + 4;
  }

  #drawBreakdown(rect: Rect, model: FrozenDeckModel): void {
    const headerHeight = 34;
    const header = this.add.graphics();
    header.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, headerHeight);
    this.add
      .text(
        rect.x + 12,
        rect.y + headerHeight / 2,
        `${model.totalCards} CARDS · ${model.countedCards} + ${model.campaignCardCount} CAMPAIGN`,
        { ...textStyle(typeRole.label, surface.ink.hex, 1), fontStyle: "italic 800" },
      )
      .setOrigin(0, 0.5)
      .setFontSize(12);
    let y = rect.y + headerHeight;
    const box = this.add.graphics();
    for (const row of model.rows) {
      const rowHeight = 56;
      this.add
        .text(rect.x + 18, y + rowHeight / 2, String(row.count), { ...textStyle(bangers(24), surface.ink.hex) })
        .setOrigin(0.5, 0.5);
      this.add.text(rect.x + 48, y + 12, row.label, textStyle(typeRole.emphasis, surface.ink.hex)).setFontSize(13);
      this.add
        .text(rect.x + 48, y + 30, row.sublabel, textStyle(typeRole.body, surface.ink.hex, 0.6))
        .setFontSize(11)
        .setWordWrapWidth(rect.width - 180);
      const badgeWidth = 70;
      const badgeHeight = 22;
      const badgeRect: Rect = {
        x: rect.x + rect.width - badgeWidth - 12,
        y: y + rowHeight / 2 - badgeHeight / 2,
        width: badgeWidth,
        height: badgeHeight,
      };
      const badge = this.add.graphics();
      badge
        .fillStyle(row.locked ? surface.ink.hex : signal.heal.hex, 1)
        .fillRect(badgeRect.x, badgeRect.y, badgeRect.width, badgeRect.height);
      this.add
        .text(badgeRect.x + badgeWidth / 2, badgeRect.y + badgeHeight / 2, row.locked ? "LOCKED" : "OPEN", {
          ...textStyle(typeRole.label, surface.paper.hex, 1),
          fontSize: "10px",
          fontStyle: "700",
        })
        .setOrigin(0.5);
      y += rowHeight;
      this.add.rectangle(rect.x, y, rect.width, 1, surface.ink.hex, 0.15).setOrigin(0, 0.5);
    }
    box.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, y - rect.y);
  }

  #drawStillYours(rect: Rect, model: FrozenDeckModel): void {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Still yours to change");
    const boxTop = y;
    const box = this.add.graphics();
    for (const card of model.campaignCards) {
      const rowHeight = 44;
      this.add.rectangle(rect.x + 10, y + rowHeight / 2, 8, 8, signal.cost.hex);
      this.add.text(rect.x + 24, y + 6, card.name, textStyle(typeRole.emphasis, surface.ink.hex)).setFontSize(13);
      this.add
        .text(rect.x + 24, y + 24, card.note, textStyle(typeRole.body, surface.ink.hex, 0.6))
        .setFontSize(11)
        .setWordWrapWidth(rect.width - 150);
      this.add
        .text(rect.x + rect.width - 10, y + 6, card.citation, textStyle(typeRole.label, surface.ink.hex, 0.45))
        .setOrigin(1, 0)
        .setFontSize(9);
      y += rowHeight;
      this.add.rectangle(rect.x, y, rect.width, 1, surface.ink.hex, 0.15).setOrigin(0, 0.5);
    }
    // The Market's own status, as one more row — never a card, but the same shape (a headline plus a detail line)
    // so a player reads it as part of the same "what's still open" list rather than a separate note.
    const marketRowHeight = 44;
    const cta = frozenDeckMarketCta(model.market);
    this.add.rectangle(
      rect.x + 10,
      y + marketRowHeight / 2,
      8,
      8,
      cta.enabled ? signal.heal.hex : surface.ink.hex,
      cta.enabled ? 1 : 0.3,
    );
    this.add
      .text(
        rect.x + 24,
        y + 6,
        cta.enabled ? "The Market is open" : (cta.reason ?? "The Market"),
        textStyle(typeRole.emphasis, surface.ink.hex),
      )
      .setFontSize(13)
      .setWordWrapWidth(rect.width - 40);
    if (model.marketHint) {
      const hintText = model.marketHint.affordableCardName
        ? `${model.marketHint.balanceLabel} — you can afford ${model.marketHint.affordableCardName}.`
        : `${model.marketHint.balanceLabel}.`;
      this.add
        .text(rect.x + 24, y + 24, hintText, textStyle(typeRole.body, surface.ink.hex, 0.6))
        .setFontSize(11)
        .setWordWrapWidth(rect.width - 40);
    }
    y += marketRowHeight;
    box.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, boxTop, rect.width, y - boxTop);

    this.add
      .text(rect.x, y + 16, model.caption, { ...textStyle(typeRole.body, surface.ink.hex, 0.55) })
      .setFontSize(11)
      .setWordWrapWidth(rect.width);
  }

  #drawActionBar(
    frame: ReturnType<typeof campaignFrame>,
    model: FrozenDeckModel,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const bar = drawActionBar(this);
    const gap = 12;
    let doneRect: Rect;
    let marketRect: Rect;
    if (frame.phone) {
      // `actionBarCta` always widens to the full bar on phone (one CTA per screen, everywhere else) — this screen
      // needs two, so both halves are computed here rather than through it.
      const pad = 12;
      const half = (bar.width - pad * 2 - gap) / 2;
      const height = Math.max(48, bar.height - pad * 2);
      const y = bar.y + (bar.height - height) / 2;
      marketRect = { x: bar.x + pad, y, width: half, height };
      doneRect = { x: marketRect.x + half + gap, y, width: half, height };
    } else {
      doneRect = actionBarCta(bar, frame.phone, 200);
      marketRect = { x: doneRect.x - gap - 200, y: doneRect.y, width: 200, height: doneRect.height };
    }

    const cta = frozenDeckMarketCta(model.market);
    const data = this.#data;
    const goToMarket = (): void => {
      if (!cta.enabled || !data) return;
      goToScreen(this, SCENES.campaignBriefing, { runId: data.runId });
    };
    const marketButton = new McButton(this, {
      kind: "onInk",
      label: "The Market",
      type: typeRole.barTitle,
      rect: marketRect,
      onClick: goToMarket,
      enabled: cta.enabled,
      ...(cta.reason ? { reason: cta.reason } : {}),
    });
    this.#buttons.push(marketButton);
    stops.set("market", { rect: marketRect, activate: goToMarket });
    order.push("market");

    const done = (): void => this.#goBack();
    const doneButton = new McButton(this, {
      kind: "primary",
      label: "Done ▸",
      type: typeRole.barTitle,
      rect: doneRect,
      onClick: done,
    });
    this.#buttons.push(doneButton);
    stops.set("done", { rect: doneRect, activate: done });
    order.push("done");
  }
}
