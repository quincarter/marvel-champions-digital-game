/**
 * C08 — Briefing: composes the next issue's between-games setup (answering any question it asks), shows what
 * happened automatically and what the player still has to decide, shows the two decks, and starts the game.
 *
 * Composing (`campaignService().compose`) asks one choice at a time and re-runs from the top on every answer
 * (`campaign-service.ts`'s own doc comment) — this scene accumulates `#answers` across re-entries and keeps
 * re-calling `compose` until it comes back `"done"`, exactly the loop the service's doc comment describes. Nothing
 * half-answered is ever shown as settled: `#pending` is only ever the *current* unanswered question.
 */
import Phaser from "phaser";
import type { CampaignChoiceAnswer, CampaignDefinition, CampaignPendingChoice } from "@mc/engine";
import { CAMPAIGN_ACCEPT } from "@mc/engine";
import { issueNumberOf, issueStoryFor, lineForRoster, storyFor, type IssueStory } from "../../campaign/story.js";
import {
  bangers,
  drawActionBar,
  drawPicture,
  drawTopBar,
  heroPicture,
  ruleHeading,
  speechBubble,
} from "../../ui/campaign-chrome.js";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { McButton, fitText, label } from "../../ui/widgets.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { setMask } from "../../ui/rex.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import type { Rect } from "../../view/layout.js";
import { formFactorFor } from "../../view/layout.js";
import { CAMPAIGN_ART, campaignCoverFor } from "../../art/campaign-art.js";
import { callGridOf } from "../../view/campaign-call-layout.js";
import { briefingViewOf, type BriefingView, type HandledRow } from "../../view/campaign-briefing-model.js";
import type { BriefingPoolGroup, BriefingPoolRow, BriefingPoolView } from "../../view/campaign-pool-model.js";
import { isMarketPendingChoice } from "../../view/campaign-market-model.js";
import { hiddenEvidenceEnvelope } from "../../view/campaign-hidden-evidence-model.js";
import { CARDS_BY_ID, packNameOf } from "../../content/pool.js";
import { artFor } from "../../art/art-source.js";
import { cardArt, drawArt } from "../../art/card-art.js";
import { CAMPAIGNS as CONTENT_CAMPAIGNS, type AnyCard, type CardId, type Campaign } from "@mc/content";
import { appSession, campaignService } from "../../session.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { optionLabelsOf } from "../../view/campaign-option-labels.js";
import { heroFaceDisplayName } from "../../view/hero-names.js";
import {
  ROLE_CALL_START,
  ROLE_EXPLAINER,
  backFromRole,
  confirmedRole,
  isRoleChoice,
  roleCallOf,
  roleConfirmOf,
  seatHeaderOf,
  selectRole,
  type RoleCallState,
  type RoleCallView,
  type RoleTileView,
  type SeatHeaderView,
} from "../../view/campaign-role-call-model.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignBriefingData } from "./routes.js";

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;
/** A seat's hero as the table names it ("Colossus"; "Spider-Man (Peter Parker)" where a name is shared). */
const heroNameOf = (id: CardId): string => {
  const card = CARDS_BY_ID.get(id);
  return card?.type === "hero_identity" ? heroFaceDisplayName(card) : cardName(id);
};
/** See `scenes/campaign/dossier.ts`'s own copy of this helper — a pool field names a card by name, never an id. */
const CARD_BY_NAME = new Map<string, AnyCard>([...CARDS_BY_ID.values()].map((card) => [card.name, card] as const));
const cardOfName = (name: string): AnyCard | undefined => CARD_BY_NAME.get(name);
const cardTypeOf = (name: string): { readonly type: string } | undefined => {
  const card = cardOfName(name);
  return card ? { type: card.type } : undefined;
};

export class CampaignBriefingScene extends Phaser.Scene {
  #data!: CampaignBriefingData;
  #record: CampaignRecord | null = null;
  #story: IssueStory | null = null;
  #definition: CampaignDefinition | null = null;
  #nodeIds: readonly string[] = [];
  #issueNumber = 1;
  #pending: CampaignPendingChoice | null = null;
  #answers: CampaignChoiceAnswer[] = [];
  /** Accumulates a multi-pick choice's own selections before "Confirm" submits them. */
  #picking: string[] = [];
  /** The page of a long "Your call" list (role-building lists dozens of cards). */
  #callPage = 0;
  /** The role choice's confirm step: a tile is only selected here; Confirm is what records it. */
  #roleState: RoleCallState = ROLE_CALL_START;
  #composing = false;
  #starting = false;
  #startError: string | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.campaignBriefing);
  }

  init(data: CampaignBriefingData): void {
    this.#data = data;
    this.#record = null;
    this.#story = null;
    this.#definition = null;
    this.#nodeIds = [];
    this.#pending = null;
    this.#answers = data.answers ? [...data.answers] : [];
    this.#picking = [];
    this.#composing = false;
    this.#starting = false;
    this.#startError = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    const artOff = cardArt(this).onArrived(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#draw, this);
      artOff();
    });
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
    const nodeId = record.attempt?.nodeId ?? record.position.nextNodeId;
    if (!nodeId) {
      goToScreen(this, SCENES.campaignDossier, { runId: record.id });
      return;
    }
    this.#record = record;
    this.#story = issueStoryFor(record.campaignId, nodeId);
    const definition = service.definitionFor(record);
    this.#definition = definition;
    this.#nodeIds = definition.graph.nodes.map((node) => node.id);
    this.#issueNumber = issueNumberOf(
      definition.graph.nodes.map((node) => node.id),
      nodeId,
    );
    this.#draw();
    void this.#compose();
  }

  async #compose(): Promise<void> {
    const record = this.#record;
    if (!record || record.attempt || this.#composing) {
      this.#draw();
      return;
    }
    this.#composing = true;
    this.#draw();
    const result = await campaignService().compose(record, this.#answers);
    if (!this.sys.isActive()) return;
    this.#composing = false;
    if (result.kind === "pending") {
      // A Market-shaped choice (`view/campaign-market-model.ts`) gets its own screen, never this generic panel —
      // detected by shape (every option prices in the campaign's currency field), never by `campaignId`.
      if (isMarketPendingChoice(result.choice, (id) => CARDS_BY_ID.get(id))) {
        this.scale.off("resize", this.#draw, this);
        goToScreen(this, SCENES.campaignMarket, {
          runId: record.id,
          answers: this.#answers,
          ...(this.#data.replaySeed === undefined ? {} : { replaySeed: this.#data.replaySeed }),
        });
        return;
      }
      this.#pending = result.choice;
      this.#picking = [];
      this.#callPage = 0;
      this.#roleState = ROLE_CALL_START;
    } else {
      this.#record = result.record;
      this.#pending = null;
      this.#answers = [];
    }
    this.#draw();
  }

  /** Submits one answer for the current pending choice and re-composes — the service's own re-entry loop. */
  #answer(picked: readonly string[]): void {
    const pending = this.#pending;
    if (!pending) return;
    this.#answers = [
      ...this.#answers,
      { instructionId: pending.instructionId, slot: pending.slot, seatNumber: pending.seatNumber, picked },
    ];
    this.#pending = null;
    this.#roleState = ROLE_CALL_START;
    void this.#compose();
  }

  /** The box's roles when `pending` is a pick of one of them (MC32); null for every other choice. */
  #rolesFor(pending: CampaignPendingChoice): NonNullable<Campaign["roles"]> | null {
    const campaignId = this.#record?.campaignId as string | undefined;
    const roles = CONTENT_CAMPAIGNS.find((campaign) => (campaign.id as string) === campaignId)?.roles;
    return roles && isRoleChoice(pending, roles) ? roles : null;
  }

  /** "Change my answer": drops the composed attempt so the issue can be composed again — decks or a choice. */
  async #discardAttempt(): Promise<void> {
    const record = this.#record;
    if (!record?.attempt) return;
    this.#record = await campaignService().discardAttempt(record);
    if (!this.sys.isActive()) return;
    this.#answers = [];
    void this.#compose();
  }

  async #editDecks(): Promise<void> {
    if (this.#record?.attempt) await this.#discardAttempt();
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.campaignDeckEdit, {
      runId: this.#data.runId,
      seatNumber: 1,
      returnTo: { key: SCENES.campaignBriefing, data: { runId: this.#data.runId } },
    });
  }

  async #openIssue(): Promise<void> {
    const record = this.#record;
    if (!record?.attempt || this.#starting) return;
    this.#starting = true;
    this.#startError = null;
    this.#draw();
    const composed = campaignService().launchConfig(record);
    const replaySeed = this.#data.replaySeed;
    const config = replaySeed === undefined ? composed : { ...composed, seed: replaySeed };
    const { store } = appSession();
    await store.start(config);
    if (!this.sys.isActive()) return;
    if (store.state.status === "failed") {
      this.#starting = false;
      this.#startError = store.state.setupError?.illegalDecks[0]
        ? "A deck is no longer legal — edit decks before opening this issue."
        : (store.state.error ?? "setup failed");
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.setupDeal);
  }

  #draw(): void {
    const record = this.#record;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    if (!record) return;

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);

    const back = (): void => {
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.campaignRun, { runId: this.#data.runId });
    };
    // The hidden-evidence envelope (docs/campaign-mode-design.md §Q4; MC50 p. 5), when the box declares one: the
    // top bar's own right-aligned classification marker, matching the dossier's tab bar convention. Computed
    // straight off `record`/`this.#definition` — independent of `briefingViewOf` (which needs a composed attempt
    // that may not exist yet) — so the counter is visible before an issue is even composed.
    const hiddenEvidence = this.#definition ? hiddenEvidenceEnvelope(record, this.#definition, cardName) : null;
    const top = drawTopBar(this, {
      backLabel: "◂ ISSUES",
      onBack: back,
      title: `Briefing · Issue #${this.#issueNumber}`,
      ...(hiddenEvidence
        ? {
            right: hiddenEvidence.revealedCards
              ? `${hiddenEvidence.label} · ${hiddenEvidence.revealedCards.join(", ")}`
              : `${hiddenEvidence.label} · sealed · ${hiddenEvidence.cardCount} card${hiddenEvidence.cardCount === 1 ? "" : "s"}`,
          }
        : {}),
    });
    const stops = new Map<string, FocusStop>();
    if (top.back && top.backRect) stops.set("back", { rect: top.backRect, activate: back });

    const actionBar = drawActionBar(this);
    const contentBottom = actionBar.y - 16;

    const campaignStory = storyFor(record.campaignId as string);
    const firstPlayerSeat = record.seats.find((seat) => seat.seatNumber === 1) ?? record.seats[0];
    const firstPlayerName = firstPlayerSeat ? cardName(firstPlayerSeat.identityCardId as string) : undefined;
    const view = record.attempt
      ? briefingViewOf(
          record,
          cardName,
          this.#issueNumber,
          this.#definition ?? undefined,
          this.#nodeIds,
          cardTypeOf,
          campaignStory?.poolCopy,
          firstPlayerName,
          this.#story?.briefingNotes,
        )
      : null;
    const gutter = phone ? 16 : 24;
    const columnGap = 32;
    const leftWidth = phone ? width - gutter * 2 : Math.round((width - gutter * 2 - columnGap) * 0.58);
    const leftRect: Rect = {
      x: gutter,
      y: top.height + 20,
      width: leftWidth,
      height: contentBottom - (top.height + 20),
    };

    // A pool issue (design tiles 24/26): the left column is the speaker plus "From the pool", "Handled for you"
    // moves to the right column, and the Decks panel drops entirely (the bottom bar's own DECKS button still opens
    // it) — there's no room, and no printed sheet, for a pool box's own list beside a Decks table too. A box with
    // no pool (MC10/MC16) keeps the original layout: left column speaker + Handled for you, right column Decks.
    const hasPool = !!view?.pool;
    // On a phone a per-seat call (the hero's own header, the role tiles, role-building's long list) takes the
    // column's top: the story bubble and "Handled for you" return once the call is answered.
    const seatCall = phone && !!this.#pending && this.#pending.seatNumber !== null;
    let leftBottom = seatCall ? leftRect.y - 20 : this.#drawSpeaker(leftRect, record, phone);
    if (seatCall) {
      // nothing above the call
    } else if (hasPool) {
      leftBottom = this.#drawPool(
        { x: leftRect.x, y: leftBottom + 20, width: leftRect.width, height: 0 },
        view!.pool!,
        phone,
      );
    } else {
      leftBottom = this.#drawHandled(
        { x: leftRect.x, y: leftBottom + 20, width: leftRect.width, height: contentBottom - leftBottom - 20 },
        view,
        stops,
      );
    }
    if (this.#pending) {
      this.#drawYourCall(
        {
          x: leftRect.x,
          y: leftBottom + 20,
          width: leftRect.width,
          height: Math.max(0, contentBottom - leftBottom - 20),
        },
        this.#pending,
        stops,
        phone,
      );
    } else if (this.#composing) {
      label(this, leftRect.x, leftBottom + 20, "Composing this issue…", typeRole.label, surface.ink.hex, ink.secondary);
    }

    if (!phone) {
      const rightRect: Rect = {
        x: leftRect.x + leftRect.width + columnGap,
        y: top.height + 20,
        width: width - gutter - (leftRect.x + leftRect.width + columnGap),
        height: contentBottom - (top.height + 20),
      };
      if (hasPool) this.#drawHandled(rightRect, view, stops);
      else this.#drawDecks(rightRect, view);
    } else if (hasPool && !seatCall) {
      const handledTop = leftBottom + (this.#pending ? 140 : 20);
      this.#drawHandled(
        { x: gutter, y: handledTop, width: width - gutter * 2, height: Math.max(1, contentBottom - handledTop) },
        view,
        stops,
      );
    } else if (view) {
      const decksRect: Rect = {
        x: gutter,
        y: leftBottom + (this.#pending ? 140 : 20),
        width: width - gutter * 2,
        height: 0,
      };
      this.#drawDecks(decksRect, view);
    }

    // Bottom action bar: "EDIT DECKS"/"DECKS" outlined, "OPEN ISSUE #N ▸" the one red CTA — disabled until the
    // issue is composed and nothing is still being asked.
    const editRect: Rect = phone
      ? { x: 12, y: actionBar.y + (actionBar.height - 48) / 2, width: (width - 12 * 3) / 2, height: 48 }
      : { x: width - 16 - 425 - 12 - 150, y: actionBar.y + (actionBar.height - 62) / 2, width: 150, height: 62 };
    const editDecks = (): void => void this.#editDecks();
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: phone ? "DECKS" : "EDIT DECKS",
        type: typeRole.label,
        rect: editRect,
        onClick: editDecks,
      }),
    );
    stops.set("edit-decks", { rect: editRect, activate: editDecks });

    const canOpen = !!record.attempt && !this.#pending && !this.#composing && !this.#starting;
    const openRect: Rect = phone
      ? { x: 12 + editRect.width + 12, y: editRect.y, width: editRect.width, height: 48 }
      : { x: width - 16 - 425, y: editRect.y, width: 425, height: 62 };
    const openIssue = (): void => void this.#openIssue();
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Opening…" : `Open issue #${this.#issueNumber} ▸`,
        type: typeRole.barTitle,
        rect: openRect,
        onClick: openIssue,
        enabled: canOpen,
      }),
    );
    if (canOpen) stops.set("open", { rect: openRect, activate: openIssue });

    if (this.#startError) {
      label(this, gutter, actionBar.y - 20, this.#startError, typeRole.label, accent.heroRed.hex, 1);
    }

    this.#route = this.#route ?? new FocusRoute(this, { onCancel: back });
    this.#route.set([...stops.keys()], stops);
  }

  /** The round portrait + speech bubble: whoever the story's briefing line speaks as, or the first seat. */
  #drawSpeaker(rect: Rect, record: CampaignRecord, phone: boolean): number {
    const rosterIds = record.seats.map((seat) => seat.identityCardId);
    const story = this.#story;
    if (!story) return rect.y;
    const resolved = lineForRoster(story.briefing, rosterIds);
    if (!resolved) return rect.y;
    const speakerIdentityId =
      resolved.speaker.kind === "hero" ? resolved.speaker.identityId : (record.seats[0]?.identityCardId ?? null);
    const portraitSize = phone ? 64 : 84;
    const portraitRect: Rect = { x: rect.x, y: rect.y, width: portraitSize, height: portraitSize };
    const radius = portraitSize / 2;
    const centerX = rect.x + radius;
    const centerY = rect.y + radius;
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillCircle(centerX, centerY, radius);
    if (speakerIdentityId) {
      // A hero whose portrait is not filed yet (a new box's `art/heroes/_pending/`) speaks over the box's own cover.
      const picture = heroPicture(speakerIdentityId) ?? campaignCoverFor(CAMPAIGN_ART, record.campaignId as string);
      const image = drawPicture(this, picture, portraitRect, () => this.#draw(), { focusY: 0.15 });
      if (image) {
        // The design's round portrait, clipped through `ui/rex.ts` (Phaser 4's own geometry mask does nothing under
        // WebGL). The mask shape stays off the display list, so it is destroyed with the image.
        const maskShape = this.make.graphics({}, false);
        maskShape.fillStyle(0xffffff).fillCircle(centerX, centerY, radius);
        setMask(image, maskShape, "world");
        image.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());
      }
    }
    const border = this.add.graphics();
    border.lineStyle(3, surface.ink.hex, 1).strokeCircle(centerX, centerY, radius);
    const { rect: bubbleRect } = speechBubble(
      this,
      rect.x + portraitSize + 16,
      rect.y,
      rect.width - portraitSize - 16,
      resolved.text,
      {
        tail: "left",
        size: 15,
      },
    );
    return Math.max(rect.y + portraitSize, bubbleRect.y + bubbleRect.height);
  }

  /** A pool row's own small card-art thumbnail — see `scenes/campaign/dossier.ts`'s identical `#poolCardThumb`. */
  #poolCardThumb(name: string, rect: Rect): void {
    const fill = this.add.graphics();
    fill.fillStyle(0xe4dcc6, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const card = cardOfName(name);
    const key = card ? cardArt(this).request(this, artFor(card, { kind: "front" })) : null;
    const art = drawArt(this, key, rect);
    if (!art) {
      this.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2, "no\nscan", {
          ...textStyle(typeRole.label, surface.ink.hex, 0.4),
          fontSize: "8px",
          align: "center",
        })
        .setOrigin(0.5);
    }
    this.add.graphics().lineStyle(1, surface.ink.hex, 0.6).strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  /**
   * "From the pool" (design tiles 24/26): one row per resolved pool card this issue's own setup reads back, each
   * with its own colored stripe, art thumbnail and a ✓ (helps)/✗ (hurts) mark — or, for the box's finale on a
   * desktop/tablet-width column, one boxed group per destination with a small row of art tiles (design tile 26's
   * own grid); the finale on a phone keeps the same flat, full-width rows every other issue uses (design tile 24's
   * own phone layout never grew a second column to grid into).
   */
  #drawPool(rect: Rect, pool: BriefingPoolView, phone: boolean): number {
    let y = ruleHeading(
      this,
      rect.x,
      rect.y,
      rect.width,
      pool.groups ? `From the pool · ${pool.rows.length} cards` : "From the pool",
      surface.ink.hex,
      20,
    );
    const thumbSize = 44;
    const rowRect = (row: BriefingPoolRow, top: number): number => {
      const rowHeight = 54;
      const stripeColor = row.helps ? signal.heal.hex : accent.heroRed.hex;
      const box = this.add.graphics();
      box.fillStyle(surface.card.hex, 1).fillRect(rect.x, top, rect.width, rowHeight);
      box.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, top, rect.width, rowHeight);
      box.fillStyle(stripeColor, 1).fillRect(rect.x, top, 6, rowHeight);
      const textX = rect.x + 6 + 8 + thumbSize + 10;
      this.#poolCardThumb(row.name, {
        x: rect.x + 6 + 8,
        y: top + (rowHeight - thumbSize) / 2,
        width: thumbSize,
        height: thumbSize,
      });
      this.add.text(textX, top + 8, row.name.toUpperCase(), textStyle(bangers(15), surface.ink.hex));
      this.add
        .text(textX, top + 28, row.destination, textStyle(typeRole.body, surface.ink.hex, 0.7))
        .setFontSize(11)
        .setWordWrapWidth(rect.x + rect.width - 24 - textX);
      this.add
        .text(rect.x + rect.width - 24, top + rowHeight / 2, row.helps ? "✓" : "✗", {
          ...textStyle({ ...typeRole.rowTitle, size: 16 }, stripeColor),
        })
        .setOrigin(0.5);
      return top + rowHeight + 10;
    };
    if (!pool.groups) {
      for (const row of pool.rows) y = rowRect(row, y);
      return y;
    }
    if (phone) {
      for (const group of pool.groups) {
        const headerHeight = 22;
        this.add.rectangle(rect.x, y, rect.width, headerHeight, surface.ink.hex, 0.08).setOrigin(0, 0);
        this.add.text(rect.x + 8, y + 4, group.title.toUpperCase(), {
          ...textStyle(typeRole.label, surface.ink.hex, 0.7),
          fontSize: "10px",
          fontStyle: "700",
        });
        y += headerHeight + 6;
        for (const row of group.rows) y = rowRect(row, y);
        y += 6;
      }
      return y;
    }
    return this.#drawPoolGroupGrid(rect, pool.groups, y);
  }

  /**
   * The finale's own desktop/tablet grid (design tile 26): a 2-column layout of boxed groups, each a header bar
   * (title + a generic one-line subtitle, `campaign-pool-model.ts`'s own `GROUP_SUBTITLES`) over a row of small art
   * tiles, one per card, each with its name and its own ALLY/ENEMY/HELPS/AGAINST badge underneath.
   */
  #drawPoolGroupGrid(rect: Rect, groups: readonly BriefingPoolGroup[], top: number): number {
    const columnGap = 24;
    const columnWidth = (rect.width - columnGap) / 2;
    const tileSize = 64;
    // Wider than the thumbnail itself: a two-word name wraps to two lines inside its *own* column
    // (`nameWrapWidth`, narrower than the tile's own pitch), so neighboring tiles' text never bleeds into each
    // other even when Bangers' real glyph widths run wider than the wrap estimate (`tileGap`'s own safety margin).
    const tileGap = 18;
    const nameWrapWidth = tileSize;
    let leftY = top;
    let rightY = top;
    groups.forEach((group, index) => {
      const columnX = index % 2 === 0 ? rect.x : rect.x + columnWidth + columnGap;
      const groupTop = index % 2 === 0 ? leftY : rightY;
      const headerHeight = 40;
      const header = this.add.graphics();
      header.fillStyle(0xe4dcc6, 1).fillRect(columnX, groupTop, columnWidth, headerHeight);
      this.add.text(columnX + 10, groupTop + 4, group.title.toUpperCase(), {
        ...textStyle(typeRole.label, surface.ink.hex, 0.8),
        fontSize: "11px",
        fontStyle: "700",
      });
      this.add
        .text(columnX + 10, groupTop + 20, group.subtitle, {
          ...textStyle(typeRole.body, surface.ink.hex, 0.55),
          fontSize: "10px",
        })
        .setWordWrapWidth(columnWidth - 20);
      let tileY = groupTop + headerHeight + 10;
      let tileX = columnX + 10;
      // Measured once per group from its own longest name — every tile in the group then reserves the same
      // height under its thumbnail, so the badge line never has to guess how many lines the name above it took.
      const nameHeight = Math.max(
        ...group.rows.map((row) => {
          const measure = this.add
            .text(0, 0, row.name.toUpperCase(), textStyle(bangers(11), 0))
            .setWordWrapWidth(nameWrapWidth)
            .setVisible(false);
          const height = measure.height;
          measure.destroy();
          return height;
        }),
      );
      const rowHeight = tileSize + 10 + nameHeight + 16;
      for (const row of group.rows) {
        if (tileX + tileSize > columnX + columnWidth - 10) {
          tileX = columnX + 10;
          tileY += rowHeight;
        }
        const stripeColor = row.helps ? signal.heal.hex : accent.heroRed.hex;
        this.#poolCardThumb(row.name, { x: tileX, y: tileY, width: tileSize, height: tileSize });
        this.add.rectangle(tileX, tileY + tileSize, tileSize, 3, stripeColor).setOrigin(0, 0);
        this.add
          .text(tileX, tileY + tileSize + 6, row.name.toUpperCase(), textStyle(bangers(11), surface.ink.hex))
          .setWordWrapWidth(nameWrapWidth);
        this.add.text(tileX, tileY + tileSize + 8 + nameHeight, row.badgeLabel, {
          ...textStyle(typeRole.label, stripeColor, 1),
          fontSize: "9px",
          fontStyle: "700",
        });
        tileX += tileSize + tileGap;
      }
      const groupBottom = tileY + rowHeight + 6;
      this.add
        .graphics()
        .lineStyle(2, surface.ink.hex, 1)
        .strokeRect(columnX, groupTop, columnWidth, groupBottom - groupTop);
      if (index % 2 === 0) leftY = groupBottom + 16;
      else rightY = groupBottom + 16;
    });
    return Math.max(leftY, rightY);
  }

  #drawHandled(rect: Rect, view: BriefingView | null, stops: Map<string, FocusStop>): number {
    void stops;
    if (rect.height <= 0) return rect.y;
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Handled for you", surface.ink.hex, 20);
    if (!view) {
      label(
        this,
        rect.x,
        y,
        this.#pending ? "Waiting on your call…" : "Composing…",
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
      return y + 20;
    }
    if (view.handled.length === 0) {
      label(this, rect.x, y, "Nothing automatic this issue.", typeRole.label, surface.ink.hex, ink.secondary);
      return y + 20;
    }
    const listTop = y;
    const rowXs = { glyph: rect.x + 12, text: rect.x + 36 };
    const rows: { row: HandledRow; y: number; height: number }[] = [];
    let cursor = y + 10;
    for (const row of view.handled) {
      const height = this.#measureHandledRow(row, rect.width - 48);
      rows.push({ row, y: cursor, height });
      cursor += height;
    }
    const listHeight = cursor - listTop + 10;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, listTop, rect.width, listHeight);
    rows.forEach(({ row, y: rowY }, index) => {
      if (index > 0) g.lineStyle(1, surface.ink.hex, 0.2).lineBetween(rect.x, rowY, rect.x + rect.width, rowY);
      // The canvas: green ✓ for this issue, blue → for a value held for a later one (never Hero Red, which is the CTA's).
      const glyphColor = row.status === "done" ? signal.heal.hex : signal.cost.hex;
      this.add
        .text(
          rowXs.glyph,
          rowY + 10,
          row.status === "done" ? "✓" : "→",
          textStyle({ ...typeRole.rowTitle, size: 14 }, glyphColor),
        )
        .setOrigin(0.5, 0);
      const citationWidth = row.citation ? 90 : 0;
      const title = this.add
        .text(rowXs.text, rowY + 8, row.title, textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 48 - citationWidth);
      if (row.citation) {
        this.add
          .text(rect.x + rect.width - 12, rowY + 10, row.citation, {
            ...textStyle(typeRole.label, surface.ink.hex, 0.4),
            fontSize: "10px",
          })
          .setOrigin(1, 0);
      }
      this.add
        .text(
          rowXs.text,
          rowY + 8 + title.height + 2,
          row.detail,
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 48);
    });
    return listTop + listHeight;
  }

  #measureHandledRow(row: HandledRow, width: number): number {
    const title = this.add
      .text(0, 0, row.title, textStyle({ ...typeRole.rowTitle, size: 14 }, 0))
      .setWordWrapWidth(row.citation ? width - 90 : width)
      .setVisible(false);
    const detail = this.add
      .text(0, 0, row.detail, textStyle(typeRole.body, 0))
      .setWordWrapWidth(width)
      .setVisible(false);
    const height = 8 + title.height + 2 + detail.height + 12;
    title.destroy();
    detail.destroy();
    return height;
  }

  #drawYourCall(rect: Rect, pending: CampaignPendingChoice, stops: Map<string, FocusStop>, phone: boolean): void {
    if (rect.height <= 0) return;
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Your call", surface.ink.hex, 20);
    const record = this.#record;
    const header = record ? seatHeaderOf(pending, record.seats, heroNameOf) : null;
    if (header) y = this.#drawSeatHeader(rect, y, header, phone);
    const seatLabel = pending.seatNumber !== null ? `Seat ${pending.seatNumber}` : "The team";
    const prompt = this.add
      .text(
        rect.x,
        y,
        header ? pending.text : `${seatLabel.toUpperCase()} — ${pending.text}`,
        textStyle(typeRole.body, surface.ink.hex),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width);
    y += header ? prompt.height + 12 : 44;

    const roles = record ? this.#rolesFor(pending) : null;
    if (record && roles && header) {
      const view = roleCallOf(pending, roles, this.#answers, record.seats, heroNameOf);
      this.#drawRoleCall(rect, y, pending, header, view, stops, phone);
      return;
    }

    if (pending.random) {
      const declineRect: Rect = { x: rect.x, y, width: 160, height: 44 };
      const acceptRect: Rect = { x: rect.x + 172, y, width: 160, height: 44 };
      const decline = (): void => this.#answer([]);
      const accept = (): void => this.#answer([CAMPAIGN_ACCEPT]);
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: "Decline",
          type: typeRole.label,
          rect: declineRect,
          onClick: decline,
        }),
      );
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Take it",
          type: typeRole.label,
          rect: acceptRect,
          onClick: accept,
        }),
      );
      stops.set("call-decline", { rect: declineRect, activate: decline });
      stops.set("call-accept", { rect: acceptRect, activate: accept });
      return;
    }

    // Room for the options: the panel's height less a paging strip and the Confirm/Decline row beneath them.
    const reserved = (pending.options.length > 24 ? 56 : 0) + 56 + (pending.count > 1 && pending.optional ? 56 : 0);
    const grid = callGridOf({
      count: pending.options.length,
      x: rect.x,
      y,
      width: rect.width,
      maxHeight: Math.max(44, rect.y + rect.height - y - reserved),
      page: this.#callPage,
    });
    const optionLabels = optionLabelsOf(pending.options, (id) => CARDS_BY_ID.get(id), packNameOf);
    pending.options.slice(grid.firstIndex, grid.firstIndex + grid.rects.length).forEach((optionId, shownIndex) => {
      const index = grid.firstIndex + shownIndex;
      const optionLabel = optionLabels.get(optionId) ?? cardName(optionId);
      const optionRect = grid.rects[shownIndex]!;
      const selected = this.#picking.includes(optionId);
      const toggle = (): void => {
        if (pending.count <= 1) {
          this.#answer([optionId]);
          return;
        }
        this.#picking = selected ? this.#picking.filter((id) => id !== optionId) : [...this.#picking, optionId];
        this.#draw();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: optionLabel,
          type: typeRole.label,
          rect: optionRect,
          onClick: toggle,
          selected,
        }),
      );
      stops.set(`call-option:${index}`, { rect: optionRect, activate: toggle });
    });
    let below = grid.bottom + 12;
    if (grid.pageCount > 1) {
      const turn = (by: number): void => {
        this.#callPage = Math.min(Math.max(grid.page + by, 0), grid.pageCount - 1);
        this.#draw();
      };
      const prevRect: Rect = { x: rect.x, y: below, width: 130, height: 44 };
      const nextRect: Rect = { x: rect.x + 142, y: below, width: 130, height: 44 };
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "◂ Prev",
          type: typeRole.label,
          rect: prevRect,
          onClick: () => turn(-1),
          enabled: grid.page > 0,
        }),
        new McButton(this, {
          kind: "quiet",
          label: "Next ▸",
          type: typeRole.label,
          rect: nextRect,
          onClick: () => turn(1),
          enabled: grid.page < grid.pageCount - 1,
        }),
      );
      if (grid.page > 0) stops.set("call-prev", { rect: prevRect, activate: () => turn(-1) });
      if (grid.page < grid.pageCount - 1) stops.set("call-next", { rect: nextRect, activate: () => turn(1) });
      label(
        this,
        rect.x + 290,
        below + 14,
        `Page ${grid.page + 1} of ${grid.pageCount}`,
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
      below += 56;
    }
    if (pending.count > 1) {
      const confirmRect: Rect = { x: rect.x, y: below, width: 160, height: 44 };
      const confirm = (): void => this.#answer(this.#picking);
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Confirm",
          type: typeRole.label,
          rect: confirmRect,
          onClick: confirm,
          enabled: this.#picking.length === pending.count,
        }),
      );
      if (this.#picking.length === pending.count) stops.set("call-confirm", { rect: confirmRect, activate: confirm });
    }
    if (pending.optional) {
      const declineRect: Rect = {
        x: rect.x,
        y: below + (pending.count > 1 ? 56 : 0),
        width: 160,
        height: 44,
      };
      const decline = (): void => this.#answer([]);
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "Decline",
          type: typeRole.label,
          rect: declineRect,
          onClick: decline,
        }),
      );
      stops.set("call-decline", { rect: declineRect, activate: decline });
    }
  }

  /** The seat's hero above its prompt: the roster's own portrait (`art/heroes`) and "SEAT 1 · COLOSSUS". */
  #drawSeatHeader(rect: Rect, y: number, header: SeatHeaderView, phone: boolean): number {
    const size = phone ? 56 : 64;
    const portraitRect: Rect = { x: rect.x, y, width: size, height: size };
    this.add.rectangle(rect.x, y, size, size, surface.ink.hex).setOrigin(0, 0);
    drawPicture(this, heroPicture(header.identityCardId as string), portraitRect, () => this.#draw(), {
      focusY: 0.15,
    });
    this.add.graphics().lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x, y, size, size);
    const title = this.add
      .text(rect.x + size + 14, y + size / 2, header.title, textStyle(bangers(phone ? 22 : 26), surface.ink.hex))
      .setOrigin(0, 0.5);
    fitText(title, rect.width - size - 14, phone ? 22 : 26);
    return y + size + 12;
  }

  /** One chip per aspect, in the aspect's printed frame colour with its name on it (never colour alone). */
  #drawAspectChips(x: number, y: number, tile: RoleTileView, right = false): number {
    const chipHeight = 18;
    const widths = tile.aspects.map((aspect) => {
      const probe = this.add.text(0, 0, aspect.label.toUpperCase(), {
        ...textStyle(typeRole.label, 0),
        fontSize: "10px",
      });
      const width = probe.width + 14;
      probe.destroy();
      return width;
    });
    const total = widths.reduce((sum, width) => sum + width, 0) + 6 * (widths.length - 1);
    let cursor = right ? x - total : x;
    tile.aspects.forEach((aspect, index) => {
      const width = widths[index]!;
      this.add.rectangle(cursor, y, width, chipHeight, aspect.fill).setOrigin(0, 0);
      this.add.graphics().lineStyle(1, surface.ink.hex, 1).strokeRect(cursor, y, width, chipHeight);
      this.add
        .text(cursor + width / 2, y + chipHeight / 2, aspect.label.toUpperCase(), {
          ...textStyle(typeRole.label, aspect.ink),
          fontSize: "10px",
        })
        .setOrigin(0.5);
      cursor += width + 6;
    });
    return total;
  }

  /** The role choice: four explainer tiles and the "what roles do" note, then (after a tap) the confirm step. */
  #drawRoleCall(
    rect: Rect,
    top: number,
    pending: CampaignPendingChoice,
    header: SeatHeaderView,
    view: RoleCallView,
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): void {
    let y = top;
    const confirmTile = view.tiles.find((tile) => tile.id === this.#roleState.selected);
    if (confirmTile) {
      this.#drawRoleConfirm(rect, y, header, view, confirmTile, stops);
      return;
    }
    const columns = phone || rect.width < 560 ? 1 : 2;
    const gap = 10;
    const tileWidth = Math.floor((rect.width - gap * (columns - 1)) / columns);
    const tileHeight = phone ? 76 : 80;
    view.tiles.forEach((tile, index) => {
      const x = rect.x + (index % columns) * (tileWidth + gap);
      const tileY = y + Math.floor(index / columns) * (tileHeight + gap);
      const tileRect: Rect = { x, y: tileY, width: tileWidth, height: tileHeight };
      this.#drawRoleTile(
        tileRect,
        tile,
        () => {
          this.#roleState = selectRole(this.#roleState, view, tile.id);
          this.#draw();
        },
        stops,
      );
    });
    const rows = Math.ceil(view.tiles.length / columns);
    y += rows * (tileHeight + gap) + 2;
    this.#drawRoleNote(rect, y, phone);
  }

  #drawRoleTile(tileRect: Rect, tile: RoleTileView, onPick: () => void, stops: Map<string, FocusStop>): void {
    const { x, y, width, height } = tileRect;
    const taken = !tile.available;
    this.add.rectangle(x, y, width, height, taken ? 0xe4dcc6 : 0xfffaf0).setOrigin(0, 0);
    const g = this.add.graphics();
    g.lineStyle(taken ? 1 : 2, surface.ink.hex, taken ? 0.4 : 1).strokeRect(x, y, width, height);
    const dim = taken ? 0.5 : 1;
    const name = this.add
      .text(x + 12, y + 8, tile.name.toUpperCase(), textStyle(bangers(22), surface.ink.hex))
      .setOrigin(0, 0)
      .setAlpha(dim);
    const chipsRight = x + width - 12;
    const chipsWidth = this.#drawAspectChips(chipsRight, y + 10, tile, true);
    fitText(name, Math.max(60, width - 36 - chipsWidth), 22);
    if (taken && tile.takenBySeat !== null) {
      // Taken is spelled out (never just dimmed) and the chips stay readable beside it.
      this.add
        .text(
          x + 12,
          y + 36,
          `TAKEN · SEAT ${tile.takenBySeat}${tile.takenByName ? ` · ${tile.takenByName.toUpperCase()}` : ""}`,
          textStyle({ ...typeRole.label, size: 10 }, accent.heroRed.hex),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(width - 24);
    } else {
      this.add
        .text(x + 12, y + 36, tile.summary, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(width - 24);
    }
    if (taken) return;
    const zone = this.add.zone(x, y, width, height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.POINTER_UP, onPick);
    stops.set(`role:${tile.id}`, { rect: tileRect, activate: onPick });
  }

  /** "What roles do": role upgrades and role-building in plain words (MC32 p. 5). */
  #drawRoleNote(rect: Rect, y: number, phone: boolean): void {
    const heading = label(this, rect.x, y, ROLE_EXPLAINER.heading, typeRole.label, surface.ink.hex, 1);
    this.add
      .text(
        rect.x,
        y + heading.height + 6,
        [ROLE_EXPLAINER.upgrades, ROLE_EXPLAINER.building, ROLE_EXPLAINER.rule].join("\n"),
        {
          ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
          fontSize: phone ? "10px" : "11px",
        },
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width)
      .setLineSpacing(4);
  }

  /** "Colossus will be the Brawler": only Confirm records the role; Back returns to the tiles. */
  #drawRoleConfirm(
    rect: Rect,
    top: number,
    header: SeatHeaderView,
    view: RoleCallView,
    tile: RoleTileView,
    stops: Map<string, FocusStop>,
  ): void {
    const confirm = roleConfirmOf(tile, header.heroName);
    const phone = rect.width < 560;
    let y = top;
    const boxPad = 14;
    const inner = rect.width - boxPad * 2;
    const title = this.add
      .text(
        rect.x + boxPad,
        y + boxPad,
        confirm.title.toUpperCase(),
        textStyle(bangers(phone ? 24 : 28), surface.ink.hex),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(inner);
    let cursor = y + boxPad + title.height + 8;
    this.#drawAspectChips(rect.x + boxPad, cursor, tile);
    cursor += 18 + 10;
    const summary = this.add
      .text(rect.x + boxPad, cursor, tile.summary, textStyle(typeRole.emphasis, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(inner);
    cursor += summary.height + 10;
    const detail = this.add
      .text(
        rect.x + boxPad,
        cursor,
        `${ROLE_EXPLAINER.upgrades}\n${ROLE_EXPLAINER.building}\nThis is recorded in the campaign log.`,
        { ...textStyle(typeRole.body, surface.ink.hex, ink.secondary), fontSize: phone ? "10px" : "11px" },
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(inner)
      .setLineSpacing(4);
    cursor += detail.height + boxPad;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, cursor - y);
    y = cursor + 12;
    const buttonWidth = Math.min(180, Math.floor((rect.width - 12) / 2));
    const backRect: Rect = { x: rect.x, y, width: buttonWidth, height: 48 };
    const confirmRect: Rect = { x: rect.x + buttonWidth + 12, y, width: buttonWidth, height: 48 };
    const back = (): void => {
      this.#roleState = backFromRole();
      this.#draw();
    };
    const accept = (): void => {
      const role = confirmedRole(this.#roleState, view);
      if (role !== null) this.#answer([role]);
    };
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: "Back", type: typeRole.label, rect: backRect, onClick: back }),
      new McButton(this, {
        kind: "primary",
        label: "Confirm",
        type: typeRole.label,
        rect: confirmRect,
        onClick: accept,
      }),
    );
    stops.set("role-back", { rect: backRect, activate: back });
    stops.set("role-confirm", { rect: confirmRect, activate: accept });
  }

  #drawDecks(rect: Rect, view: BriefingView | null): void {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Decks", surface.ink.hex, 20);
    if (!view) {
      label(
        this,
        rect.x,
        y,
        this.#pending ? "Waiting on your call…" : "Composing…",
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
      return;
    }
    const rowHeight = 44;
    const listTop = y;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, listTop, rect.width, rowHeight * view.decks.length);
    view.decks.forEach((row, index) => {
      const rowY = listTop + index * rowHeight;
      if (index > 0) g.lineStyle(1, surface.ink.hex, 0.2).lineBetween(rect.x, rowY, rect.x + rect.width, rowY);
      const title = this.add
        .text(
          rect.x + 12,
          rowY + rowHeight / 2,
          `${row.heroName.toUpperCase()} · ${row.aspectLabel}`,
          textStyle(bangers(16), surface.ink.hex),
        )
        .setOrigin(0, 0.5);
      fitText(title, rect.width * 0.6, 16);
      const countText = row.pinnedCount > 0 ? `${row.deckSize} + ${row.pinnedCount} pinned` : `${row.deckSize}`;
      this.add
        .text(
          rect.x + rect.width - 12,
          rowY + rowHeight / 2,
          countText,
          textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex),
        )
        .setOrigin(1, 0.5);
    });
    y = listTop + rowHeight * view.decks.length + 12;
    this.add
      .text(
        rect.x,
        y,
        "Decks can change now; hero can't. Pinned campaign cards don't count toward deck size.",
        textStyle(typeRole.label, surface.ink.hex, ink.label),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width);
  }
}
