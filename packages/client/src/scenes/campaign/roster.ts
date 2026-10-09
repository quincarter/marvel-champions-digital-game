/**
 * C02 — Sign the roster: the seats a fresh campaign run is signed with. Pre-filled with the box's own cast
 * (`story.castIdentityIds`' precons); any seat can be reassigned to any legal deck through this screen's own picker
 * overlay (there is no separate tile for it — design tiles show only the filled state).
 *
 * `view/campaign-roster-model.ts` owns every rule this screen enforces (1-4 seats, unique identities, deck
 * legality); this scene only lays the seats out and turns a tap into a seat edit or the sign action.
 */
import Phaser from "phaser";
import type { CardId, Deck } from "@mc/content";
import { CARDS_BY_ID, POOL_CARDS, POOL_VERSION } from "../../content/pool.js";
import { HERO_ART, heroArtForIdentity } from "../../art/hero-art.js";
import { artFor } from "../../art/art-source.js";
import type { Picture } from "../../art/pictures.js";
import { cardDisplayName } from "../../view/hero-names.js";
import { accent, ink, surface, typeRole } from "../../tokens.js";
import {
  bangers,
  campaignFrame,
  captionBox,
  drawActionBar,
  drawPicture,
  drawTopBar,
  heroPicture,
} from "../../ui/campaign-chrome.js";
import { ASPECT_CHIP_LINE_STEP, aspectChipLines, drawAspectChips } from "../../ui/aspect-chips.js";
import { campaignActionButton } from "../../ui/campaign-buttons-a.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, skin, textStyle } from "../../ui/theme.js";
import { clampLines, dashedRect, fitText, McButton } from "../../ui/widgets.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McVirtualList } from "../../ui/virtual-list.js";
import { deckStorage, campaignService } from "../../session.js";
import { rollSeed } from "../../view/seed.js";
import { estimateWrappedLines, type Rect } from "../../view/layout.js";
import { ListScroll } from "../../view/list-scroll.js";
import { TEAM_UP_ART, teamUpArtFor } from "../../art/team-up-art.js";
import { drawRingImage } from "../board/team-up-badge.js";
import { pairCatalogOf, seatedTeamUps, type SeatedPair } from "../../view/seat-recommendations.js";
import { PAIR_ROW_HEIGHT } from "../../view/seats-layout.js";
import {
  ROSTER_SEAT_COUNT,
  pickerEntriesOf,
  preconRosterOf,
  rosterDeckOptions,
  rosterModelOf,
  type PickerEntry,
  type RosterModel,
} from "../../view/campaign-roster-model.js";
import { storyFor } from "../../campaign/story.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import { unlocks } from "../../progression/progression.js";
import { tableRulesOf } from "../../settings.js";
import { appSession } from "../../session.js";
import {
  applyDeckSwaps,
  nameConflictsOf,
  unresolvedConflicts,
  type DeckSwap,
  type KeptConflict,
  type NameConflict,
} from "../../view/name-conflicts.js";
import { openNameConflictSheet } from "../name-conflict.js";
import type { CampaignRosterData } from "./routes.js";

let pairCatalog: ReturnType<typeof pairCatalogOf> | null = null;
const rosterPairCatalog = (): ReturnType<typeof pairCatalogOf> => (pairCatalog ??= pairCatalogOf(CARDS_BY_ID));

/** A heading in the seat picker's list ("Recommended for seat #2", "All heroes"): a compact band, not a full row. */
const PICKER_HEADING_HEIGHT = 22;
/** The picker's 11 px reason line: roughly one character's width, and one extra line's height. */
const PICKER_REASON_CHAR_WIDTH = 5.4;
const PICKER_REASON_LINE = 13;

const CAST_NOTE =
  "These two ship in this box, so their story beats are written for them. Other heroes get the same beats with narrator captions.";

export class CampaignRosterScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #campaignId = "";
  #expertCampaign = false;
  #seats: (Deck | null)[] = Array.from({ length: ROSTER_SEAT_COUNT }, () => null);
  #savedDecks: readonly Deck[] = [];
  #model: RosterModel | null = null;
  #pickerSeat: number | null = null;
  #pickerScroll = new ListScroll();
  #pickerList: McVirtualList | null = null;
  /** Dev e2e hook only (see `#drawPicker`): the picker rows drawn since it opened. */
  #pickerRowsDebug = new Map<number, { name: string; picture: boolean; badges: { label: string; fill: number }[] }>();
  #heroArtCache = new Map<string, Picture | null>();
  #signing = false;
  #error: string | null = null;
  /** Circle masks the Team-Up pill's picture made; destroyed with the next rebuild. */
  #masks: Phaser.GameObjects.Graphics[] = [];
  /** The seated pairs of the latest rebuild, for the phone's per-card tags. */
  #pairs: readonly SeatedPair[] = [];
  #phoneLayout = false;
  /**
   * Cards the player replaced because they cannot be played beside another seat's hero (`view/name-conflicts.ts`),
   * and cards kept as a resource. Applied to the decks as the roster is signed: the campaign stores its own copy of each
   * deck with the replacement in it (so every issue of the run plays with it), and the saved deck is never touched.
   */
  #swaps: readonly DeckSwap[] = [];
  #kept: readonly KeptConflict[] = [];

  constructor() {
    super(SCENES.campaignRoster);
  }

  create(data: CampaignRosterData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      for (const mask of this.#masks) mask.destroy();
      this.#masks = [];
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.nameConflict),
      onCancel: () => this.#onCancel(),
      onPage: (direction) => this.#pickerList?.scrollByPage(direction),
      onHomeEnd: (edge) => (edge === "home" ? this.#pickerList?.scrollToStart() : this.#pickerList?.scrollToEnd()),
    });
    this.#campaignId = data.campaignId;
    this.#expertCampaign = data.expertCampaign ?? false;
    this.#seats = preconRosterOf(
      (storyFor(this.#campaignId)?.castIdentityIds ?? []) as readonly CardId[],
      POOL_VERSION,
    );
    this.#pickerSeat = null;
    this.#pickerScroll.reset();
    this.#pickerList = null;
    this.#signing = false;
    this.#error = null;
    this.#swaps = [];
    this.#kept = [];
    this.#model = rosterModelOf(this.#seats, POOL_CARDS);
    void this.#loadSavedDecks();
    this.#rebuild();
    fadeScreenIn(this);
  }

  async #loadSavedDecks(): Promise<void> {
    const decks = await deckStorage().list();
    if (!this.sys.isActive()) return;
    this.#savedDecks = decks;
    if (this.#pickerSeat !== null) this.#rebuild();
  }

  #onCancel(): void {
    if (this.#pickerSeat !== null) {
      this.#pickerSeat = null;
      this.#rebuild();
      return;
    }
    goToScreen(this, SCENES.campaignCover, { campaignId: this.#campaignId });
  }

  /** The signed decks as the roster stands: each seat's deck with this run's replacements applied. */
  #effectiveDecks(): readonly Deck[] {
    return this.#seats.filter((deck): deck is Deck => deck !== null).map((deck) => applyDeckSwaps(deck, this.#swaps));
  }

  /** Cards that cannot be played beside another seat's hero and have not been answered. */
  #unresolved(): readonly NameConflict[] {
    const found = nameConflictsOf(
      this.#effectiveDecks().map((deck) => ({ deck })),
      CARDS_BY_ID,
      tableRulesOf(appSession().settings),
    );
    return unresolvedConflicts(found, this.#kept);
  }

  #openConflictSheet(): void {
    openNameConflictSheet(this, {
      decks: this.#seats.filter((deck): deck is Deck => deck !== null),
      swaps: this.#swaps,
      kept: this.#kept,
      tableRules: tableRulesOf(appSession().settings),
      continueLabel: "Sign",
      onChange: (swaps, kept) => {
        this.#swaps = swaps;
        this.#kept = kept;
        this.#rebuild();
      },
      onContinue: () => void this.#sign(),
    });
  }

  /** "Sign" with a clash still open asks first (the sheet's Continue signs); otherwise signs. */
  #onSign(): void {
    if (this.#model?.canSign && this.#unresolved().length > 0) {
      this.#openConflictSheet();
      return;
    }
    void this.#sign();
  }

  #rebuild(): void {
    this.#pickerList?.destroy();
    this.#pickerList = null;
    for (const mask of this.#masks) mask.destroy();
    this.#masks = [];
    destroyChildren(this);
    this.#stops = new Map();
    this.#model = rosterModelOf(this.#seats, POOL_CARDS);

    const frame = campaignFrame(this);
    const top = drawTopBar(this, {
      backLabel: frame.phone ? "◂" : "◂ Cover",
      onBack: () => this.#onCancel(),
      title: this.#expertCampaign ? "Sign the roster · Expert" : "Sign the roster",
    });
    if (top.backRect) this.#stops.set("back", { rect: top.backRect, activate: () => this.#onCancel() });

    const story = storyFor(this.#campaignId);
    const gutter = frame.gutter;
    let y = top.height + gutter;
    // A box with no story file (MojoMania) has no banner to show: no empty caption box either.
    if (story) {
      const banner = captionBox(this, gutter, y, frame.width - gutter * 2, story.rosterBanner, { size: 13 });
      y += banner.rect.height + gutter;
    }

    const actionBar = drawActionBar(this);
    const seatsBottom = actionBar.y - gutter;

    // Seated Team-Up pairs: a strip above the seat cards, one row per pair, reserved only while there are some.
    this.#phoneLayout = frame.phone;
    const pairs = seatedTeamUps(this.#seats, CARDS_BY_ID, rosterPairCatalog());
    this.#pairs = pairs;
    const stripRows = Math.min(pairs.length, 3);
    const stripRect: Rect = { x: gutter, y, width: frame.width - gutter * 2, height: stripRows * PAIR_ROW_HEIGHT };
    if (stripRows > 0) y += stripRect.height + 6;

    const seatsHeight = seatsBottom - y - (frame.phone ? 96 : 60);
    const seatRects = frame.phone
      ? this.#phoneSeatRects(gutter, y, frame.width - gutter * 2, seatsHeight)
      : this.#wideSeatRects(gutter, y, frame.width - gutter * 2, seatsHeight);
    seatRects.forEach((rect, i) => this.#drawSeat(i + 1, rect));
    if (stripRows > 0) this.#drawPairStrip(stripRect, pairs, seatRects, y, frame.phone);

    const model = this.#model;
    const noteY = seatsBottom - 52;
    const noteRect: Rect = { x: gutter, y: noteY, width: frame.width - gutter * 2, height: 44 };
    const noteBg = this.add.graphics();
    noteBg.lineStyle(1.5, surface.ink.hex, 1).strokeRect(noteRect.x, noteRect.y, noteRect.width, noteRect.height);
    void noteBg;
    this.add.text(
      noteRect.x + 10,
      noteRect.y + 6,
      "LOCKED",
      textStyle({ ...typeRole.rowTitle, size: 11 }, surface.ink.hex),
    );
    this.add.text(noteRect.x + 66, noteRect.y + 6, "Hero identity, whole campaign.", {
      ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      fontSize: "11px",
    });
    this.add
      .text(noteRect.x + 10, noteRect.y + 22, "FREE", textStyle({ ...typeRole.rowTitle, size: 11 }, 0x1f7a4c))
      .setColor(cssOf(0x1f7a4c));
    this.add.text(noteRect.x + 52, noteRect.y + 22, "Aspects and deck, between issues.", {
      ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      fontSize: "11px",
    });
    if (!frame.phone && story) {
      this.add.text(noteRect.x + 320, noteRect.y + 6, story.rosterNote ?? CAST_NOTE, {
        ...textStyle(typeRole.label, surface.ink.hex, ink.meta),
        fontSize: "10px",
        wordWrap: { width: noteRect.width - 330, useAdvancedWrap: true },
      });
    }

    const ctaWidth = frame.phone ? actionBar.width - 24 : Math.min(360, actionBar.width - 32);
    const ctaRect: Rect = {
      x: actionBar.x + actionBar.width - 16 - ctaWidth,
      y: actionBar.y + (actionBar.height - 52) / 2,
      width: ctaWidth,
      height: 52,
    };
    const cta = campaignActionButton(this, {
      kind: "primary",
      rect: ctaRect,
      title: this.#signing ? "Signing…" : "Sign & open issue #1",
      chevron: !this.#signing,
      enabled: model?.canSign === true && !this.#signing,
      ...(model?.blockedReason ? { reason: model.blockedReason } : {}),
      onClick: () => this.#onSign(),
      titleSize: 16,
    });
    void cta;
    this.#stops.set("cta", { rect: ctaRect, activate: () => this.#onSign() });

    if (this.#error) {
      this.add.text(gutter, actionBar.y - 20, this.#error, textStyle(typeRole.label, 0xc8102e, 1));
    }

    if (this.#pickerSeat !== null) this.#drawPicker(frame, this.#pickerSeat);

    const order = [
      "back",
      ...Array.from({ length: ROSTER_SEAT_COUNT }, (_, i) => `seat-${i + 1}`),
      "cta",
      ...[...this.#stops.keys()].filter((k) => k.startsWith("pick-")),
    ].filter((key) => this.#stops.has(key));
    this.#route?.set(order, this.#stops);
  }

  // ---- Seat grids -------------------------------------------------------------------------------------------

  #wideSeatRects(x: number, y: number, width: number, height: number): Rect[] {
    const gap = 16;
    const cardWidth = (width - gap * (ROSTER_SEAT_COUNT - 1)) / ROSTER_SEAT_COUNT;
    return Array.from({ length: ROSTER_SEAT_COUNT }, (_, i) => ({
      x: x + i * (cardWidth + gap),
      y,
      width: cardWidth,
      height,
    }));
  }

  #phoneSeatRects(x: number, y: number, width: number, height: number): Rect[] {
    const gap = 12;
    const cardWidth = (width - gap) / 2;
    const cardHeight = (height - gap) / 2;
    return Array.from({ length: ROSTER_SEAT_COUNT }, (_, i) => ({
      x: x + (i % 2) * (cardWidth + gap),
      y: y + Math.floor(i / 2) * (cardHeight + gap),
      width: cardWidth,
      height: cardHeight,
    }));
  }

  /**
   * The Team-Up marker above the seat cards: per pair, a bracket from each partner's card up to a line with a pill on
   * it (the pair's circle where there is art, "Team-Up: Colossus and Shadowcat"). On the phone's 2×2 grid only a top
   * row card can reach the strip, so the pill also says which seats ("#1 + #3") and the paired cards carry their own
   * small TEAM-UP tag (`#drawSeat`). Not interactive.
   */
  #drawPairStrip(
    strip: Rect,
    pairs: readonly SeatedPair[],
    seatRects: readonly Rect[],
    cardsTop: number,
    phone: boolean,
  ): void {
    pairs.slice(0, Math.floor(strip.height / PAIR_ROW_HEIGHT)).forEach((pair, row) => {
      const y = strip.y + row * PAIR_ROW_HEIGHT + PAIR_ROW_HEIGHT / 2;
      const g = this.add.graphics();
      g.lineStyle(2, accent.heroRed.hex, 1);
      const rects = pair.seats.map((seat) => seatRects[seat - 1]!);
      const xs = rects.map((rect) => rect.x + rect.width / 2);
      rects.forEach((rect, i) => {
        if (rect.y <= cardsTop + 1) g.lineBetween(xs[i]!, y, xs[i]!, cardsTop);
      });
      g.lineBetween(xs[0]!, y, xs[1]!, y);
      const art = teamUpArtFor(TEAM_UP_ART, pair.pair.names)?.badge ?? null;
      const ringSize = PAIR_ROW_HEIGHT - 2;
      const caption = phone ? `${pair.label} · #${pair.seats[0]} + #${pair.seats[1]}` : pair.label;
      const text = this.add.text(0, 0, caption.toUpperCase(), textStyle(typeRole.label, surface.paper.hex, 1));
      const width = Math.min(strip.width, text.width + 16 + (art ? ringSize + 2 : 0));
      const center = (xs[0]! + xs[1]!) / 2;
      const left = Math.max(strip.x, Math.min(strip.x + strip.width - width, center - width / 2));
      g.fillStyle(surface.ink.hex, 1).fillRect(left, y - ringSize / 2, width, ringSize);
      g.lineStyle(2, accent.heroRed.hex, 1).strokeRect(left, y - ringSize / 2, width, ringSize);
      let textX = left + 8;
      if (art) {
        drawRingImage(
          this,
          { key: pair.pair.key, cx: left + ringSize / 2 + 1, cy: y, radius: ringSize / 2 - 1 },
          art,
          this.#masks,
          () => this.#rebuild(),
        );
        textX = left + ringSize + 6;
      }
      text.setPosition(textX, y - text.height / 2);
      fitText(text, left + width - textX - 6, typeRole.label.size);
      this.children.bringToTop(text);
    });
  }

  #drawSeat(seatNumber: number, rect: Rect): void {
    const deck = this.#seats[seatNumber - 1] ?? null;
    const open = (): void => {
      this.#pickerSeat = seatNumber;
      this.#pickerScroll.reset();
      this.#rebuild();
    };
    if (!deck) {
      const g = this.add.graphics();
      dashedRect(g, rect, 2);
      const label = this.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2, `+ Seat #${seatNumber}`.toUpperCase(), {
          ...textStyle({ ...typeRole.rowTitle, size: 12 }, surface.ink.hex),
          fontStyle: "italic 800",
        })
        .setOrigin(0.5, 0.5);
      label.setColor(cssOf(surface.ink.hex, ink.meta));
      const zone = this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", open);
      void zone;
      this.#stops.set(`seat-${seatNumber}`, { rect, activate: open });
      return;
    }

    const footerHeight = Math.min(64, rect.height * 0.22);
    const artRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - footerHeight };
    const border = this.add.graphics();
    border.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);

    const picture = heroPicture(deck.identityCardId as string);
    if (picture) drawPicture(this, picture, artRect, () => this.#rebuild(), { focusY: 0.1 });
    else this.add.rectangle(artRect.x, artRect.y, artRect.width, artRect.height, surface.parchment.hex).setOrigin(0, 0);

    const tagLabel = this.add.text(0, 0, `#${seatNumber}`, textStyle(bangers(14, 1), surface.paper.hex));
    const tagBg = this.add.graphics();
    tagBg.fillStyle(surface.ink.hex, 1).fillRect(rect.x + 8, rect.y + 8, tagLabel.width + 14, tagLabel.height + 8);
    tagLabel.setPosition(rect.x + 15, rect.y + 12);
    this.children.bringToTop(tagLabel);

    // A paired hero on the phone's grid wears its own tag, since the strip above can't reach a bottom-row card.
    if (this.#phoneLayout && this.#pairs.some((pair) => pair.seats.includes(seatNumber))) {
      const tag = this.add
        .text(rect.x + rect.width - 8, rect.y + 8, "TEAM-UP", textStyle(typeRole.label, surface.paper.hex, 1))
        .setOrigin(1, 0)
        .setPadding(5, 3, 5, 3)
        .setBackgroundColor(cssOf(accent.heroRed.hex));
      void tag;
    }

    const footerRect: Rect = { x: rect.x, y: rect.y + artRect.height, width: rect.width, height: footerHeight };
    this.add
      .rectangle(footerRect.x, footerRect.y, footerRect.width, footerRect.height, surface.card.hex)
      .setOrigin(0, 0);
    const identityCard = CARDS_BY_ID.get(deck.identityCardId as string);
    const identityName = identityCard ? cardDisplayName(identityCard) : (deck.identityCardId as string);
    const name = this.add.text(footerRect.x + 8, footerRect.y + 6, identityName.toUpperCase(), {
      ...textStyle(bangers(15, 0.9), surface.ink.hex),
      wordWrap: { width: footerRect.width - 16, useAdvancedWrap: true },
    });
    void name;
    const seatView = this.#model?.seats[seatNumber - 1] ?? null;
    this.add.text(footerRect.x + 8, footerRect.y + footerHeight - 20, seatView?.aspectsLabel ?? "", {
      ...textStyle(typeRole.label, surface.ink.hex, ink.meta),
      fontSize: "9px",
    });
    if (seatView && !seatView.legal) {
      this.add
        .text(footerRect.x + footerRect.width - 8, footerRect.y + 6, "Illegal", textStyle(typeRole.label, 0xc8102e, 1))
        .setOrigin(1, 0);
    }

    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", open);
    void zone;
    this.#stops.set(`seat-${seatNumber}`, { rect, activate: open });
  }

  /** The hero's artwork as Take your seats picks it, else the identity card's own scan; null draws a plain block. */
  #heroPictureFor(identityId: string): Picture | null {
    if (!this.#heroArtCache.has(identityId)) {
      const art = heroArtForIdentity(HERO_ART, identityId, POOL_CARDS, () => 0);
      const identity = CARDS_BY_ID.get(identityId);
      this.#heroArtCache.set(identityId, art ?? (identity ? artFor(identity, { kind: "hero" }) : null));
    }
    return this.#heroArtCache.get(identityId) ?? null;
  }

  // ---- The deck picker overlay ------------------------------------------------------------------------------

  #drawPicker(frame: ReturnType<typeof campaignFrame>, seatNumber: number): void {
    // Dev e2e hook (never referenced by product code): each picker row's name, whether its hero picture is drawn,
    // and the aspect badges it carries (label and fill: a badge is never color alone).
    if (import.meta.env.DEV) {
      this.#pickerRowsDebug.clear();
      (window as unknown as { __mcRosterPickerDebug?: unknown }).__mcRosterPickerDebug = {
        rows: () => [...this.#pickerRowsDebug.values()],
      };
    }
    const scrim = this.add.rectangle(0, 0, frame.width, frame.height, surface.ink.hex, 0.6).setOrigin(0, 0);
    scrim.setInteractive();
    scrim.on("pointerup", () => {
      this.#pickerSeat = null;
      this.#rebuild();
    });

    const panelWidth = Math.min(460, frame.width - 32);
    const panelHeight = Math.min(560, frame.height - 32);
    const panelRect: Rect = {
      x: (frame.width - panelWidth) / 2,
      y: (frame.height - panelHeight) / 2,
      width: panelWidth,
      height: panelHeight,
    };
    const panelBg = this.add.graphics();
    panelBg.fillStyle(surface.paper.hex, 1).fillRect(panelRect.x, panelRect.y, panelRect.width, panelRect.height);
    panelBg
      .lineStyle(3, surface.ink.hex, 1)
      .strokeRect(panelRect.x + 1.5, panelRect.y + 1.5, panelRect.width - 3, panelRect.height - 3);

    this.add.text(
      panelRect.x + 20,
      panelRect.y + 18,
      `Seat #${seatNumber}`.toUpperCase(),
      textStyle(bangers(20, 1), surface.ink.hex),
    );

    const closeRect: Rect = { x: panelRect.x + panelRect.width - 44, y: panelRect.y + 14, width: 30, height: 30 };
    const close = new McButton(this, {
      kind: "secondary",
      label: "✕",
      type: typeRole.rowTitle,
      rect: closeRect,
      onClick: () => {
        this.#pickerSeat = null;
        this.#rebuild();
      },
    });
    void close;
    this.#stops.set("pick-close", {
      rect: closeRect,
      activate: () => {
        this.#pickerSeat = null;
        this.#rebuild();
      },
    });

    let y = panelRect.y + 58;
    const rowWidth = panelRect.width - 40;

    if (this.#seats[seatNumber - 1]) {
      const removeRect: Rect = { x: panelRect.x + 20, y, width: rowWidth, height: 40 };
      const remove = campaignActionButton(this, {
        kind: "secondary",
        rect: removeRect,
        title: "Remove from this seat",
        enabled: true,
        onClick: () => {
          this.#seats[seatNumber - 1] = null;
          this.#pickerSeat = null;
          this.#rebuild();
        },
        titleSize: 13,
      });
      void remove;
      this.#stops.set("pick-remove", {
        rect: removeRect,
        activate: () => {
          this.#seats[seatNumber - 1] = null;
          this.#pickerSeat = null;
          this.#rebuild();
        },
      });
      y += 50;
    }

    const options = rosterDeckOptions(this.#seats, seatNumber, this.#savedDecks, POOL_VERSION, (deck) =>
      unlocks().deckLock(deck),
    );
    const listRect: Rect = { x: panelRect.x + 20, y, width: rowWidth, height: panelRect.y + panelRect.height - 16 - y };
    const gap = 8;

    if (options.length === 0) {
      this.add.text(listRect.x, listRect.y, "No decks available — build one from Decks & Collection.", {
        ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        wordWrap: { width: rowWidth, useAdvancedWrap: true },
      });
      return;
    }

    // From seat 2 on, with someone else seated: a pinned "Recommended" group, then the whole list under its heading.
    const entries = pickerEntriesOf(this.#seats, seatNumber, options, CARDS_BY_ID, rosterPairCatalog());
    const hasGroup = entries.some((entry) => entry.kind === "heading");
    // A recommended row has a third line for its reason, so a list with the group is a little taller throughout.
    const rowHeight = hasGroup ? 78 : 64;
    // A heading is a compact band, not a full row; a row whose aspect badges wrap to a second line grows by that line.
    const thumbSide = rowHeight - 16;
    const chipRoom = rowWidth - 8 - thumbSide - 12 - 12;
    const optionHeightOf = (entry: PickerEntry): number => {
      if (entry.kind !== "option") return PICKER_HEADING_HEIGHT;
      const stamps = options[entry.optionIndex]!.stamps;
      const reason = entry.rec?.reason ?? "";
      const reasonLines = reason ? Math.min(2, estimateWrappedLines(reason, chipRoom, PICKER_REASON_CHAR_WIDTH)) : 0;
      return (
        rowHeight +
        (aspectChipLines(this, stamps, chipRoom) - 1) * ASPECT_CHIP_LINE_STEP +
        Math.max(0, reasonLines - 1) * PICKER_REASON_LINE
      );
    };
    const heights = entries.map(optionHeightOf);

    const selectAt = (index: number): void => {
      const option = options[index];
      if (!option || option.blocked) return;
      const before = this.#seats.filter((deck): deck is Deck => deck !== null);
      this.#seats[seatNumber - 1] = option.deck;
      // A replacement answered a hero who has now left the table: drop the answers (a hero only joining keeps them).
      const after = this.#seats.filter((deck): deck is Deck => deck !== null);
      if (!before.every((deck) => after.some((other) => other.id === deck.id))) {
        this.#swaps = [];
        this.#kept = [];
      }
      this.#pickerSeat = null;
      this.#rebuild();
    };

    const renderRow = (entryIndex: number, rect: Rect): { objects: readonly Phaser.GameObjects.GameObject[] } => {
      const entry = entries[entryIndex]!;
      if (entry.kind === "heading") {
        const midY = rect.y + PICKER_HEADING_HEIGHT / 2;
        const text = this.add
          .text(rect.x, midY, entry.text.toUpperCase(), textStyle(typeRole.label, surface.ink.hex, ink.label))
          .setOrigin(0, 0.5);
        const rule = this.add.graphics();
        rule
          .lineStyle(2, surface.ink.hex, ink.meta)
          .lineBetween(rect.x + text.width + 10, midY, rect.x + rect.width, midY);
        // In one container, like a deck row, so the list moves both together.
        return { objects: [this.add.container(0, 0, [text, rule])] };
      }
      const index = entry.optionIndex;
      const rec = entry.rec;
      const option = options[index]!;
      const identityCard = CARDS_BY_ID.get(option.identityId);
      const identityName = identityCard ? cardDisplayName(identityCard) : option.identityId;
      const rowRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: heights[entryIndex]! };
      const enabled = !option.blocked;
      // The row's own button supplies fill, border, hover and hit zone; its text is drawn here so the picture and
      // the aspect badges can sit beside it. Text color tracks hover the way `campaignActionButton`'s does.
      const button = new McButton(this, {
        kind: "secondary",
        label: "",
        type: typeRole.body,
        rect: rowRect,
        enabled,
        ...(option.blockedReason ? { reason: option.blockedReason } : {}),
        onClick: () => selectAt(index),
      });
      const zone = button.container.list.at(-1) as Phaser.GameObjects.Zone | undefined;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const pad = 8;
      const thumb: Rect = {
        x: rowRect.x + pad,
        y: rowRect.y + pad,
        width: thumbSide,
        height: thumbSide,
      };
      const picture = this.#heroPictureFor(option.identityId);
      const image = drawPicture(this, picture, thumb, () => this.#rebuild(), { focusY: 0.2 });
      if (image) {
        parts.push(image);
      } else {
        parts.push(
          this.add.rectangle(thumb.x, thumb.y, thumb.width, thumb.height, surface.parchment.hex).setOrigin(0, 0),
        );
      }
      parts.push(
        this.add.graphics().lineStyle(1.5, surface.ink.hex, 1).strokeRect(thumb.x, thumb.y, thumb.width, thumb.height),
      );
      if (import.meta.env.DEV) {
        this.#pickerRowsDebug.set(index, {
          name: identityName,
          picture: image !== null && image !== undefined,
          badges: option.stamps.map((stamp) => ({ label: stamp.label, fill: stamp.fill })),
        });
      }
      const textX = thumb.x + thumb.width + 12;
      const textWidth = rowRect.x + rowRect.width - textX - 12;
      const title = this.add
        .text(textX, rowRect.y + 8, identityName.toUpperCase(), textStyle(bangers(16), 0))
        .setOrigin(0, 0);
      fitText(title, textWidth, 16);
      const lineY = rowRect.y + 8 + 16 + 8;
      // Four badges (Adam Warlock) wrap to a second line rather than run off the row's edge; the source note rides
      // beside the last badge and the reason line moves down by the extra line.
      const chips = drawAspectChips(this, textX, lineY, option.stamps, false, textWidth);
      const extraLines = (chips.lines - 1) * ASPECT_CHIP_LINE_STEP;
      const noteText = option.blocked ? (option.blockedReason ?? "Already seated") : option.sourceLabel;
      const noteX = textX + chips.lastWidth + (chips.lastWidth > 0 ? 8 : 0);
      const note = this.add
        .text(noteX, lineY + extraLines + 9, noteText, { ...textStyle(typeRole.emphasis, 0), fontSize: "12px" })
        .setOrigin(0, 0.5);
      fitText(note, Math.max(40, rowRect.x + rowRect.width - 12 - noteX), 12);
      // A recommended row: the TEAM-UP tag where it applies (right of the name) and the reason on a line of its own.
      const extras: Phaser.GameObjects.GameObject[] = [];
      let reasonText: Phaser.GameObjects.Text | null = null;
      if (rec) {
        if (rec.teamUps.length > 0) {
          // Quiet: the accent as an outline and as the text on an ink plate (not a solid red block), so it does not
          // compete with the aspect badges.
          const tag = this.add
            .text(
              rowRect.x + rowRect.width - 10,
              rowRect.y + 8,
              "TEAM-UP",
              textStyle(typeRole.label, accent.heroRed.hex, 1),
            )
            .setOrigin(1, 0)
            .setPadding(5, 2, 5, 2);
          const plate = this.add.graphics();
          const tagBounds = tag.getBounds();
          plate.fillStyle(surface.ink.hex, 1).fillRect(tagBounds.x, tagBounds.y, tagBounds.width, tagBounds.height);
          plate
            .lineStyle(1.5, accent.heroRed.hex, 1)
            .strokeRect(tagBounds.x + 0.75, tagBounds.y + 0.75, tagBounds.width - 1.5, tagBounds.height - 1.5);
          extras.push(plate, tag);
          title.setWordWrapWidth(Math.max(40, textWidth - tag.width - 8));
          fitText(title, Math.max(40, textWidth - tag.width - 8), 16);
        }
        reasonText = this.add
          .text(textX, lineY + extraLines + 22, rec.reason, { ...textStyle(typeRole.body, 0), fontSize: "11px" })
          .setOrigin(0, 0);
        // Wrapped to two lines (the row has grown for the second, `optionHeightOf`), never cut to one with an ellipsis.
        reasonText.setWordWrapWidth(textWidth, true);
        clampLines(reasonText, 2);
        extras.push(reasonText);
      }
      const applyState = (state: "rest" | "hover" | "unavailable"): void => {
        const buttonSkin = skin("secondary", state);
        title.setColor(cssOf(buttonSkin.text, buttonSkin.textAlpha));
        note.setColor(cssOf(buttonSkin.text, buttonSkin.textAlpha * ink.secondary));
        reasonText?.setColor(cssOf(buttonSkin.text, buttonSkin.textAlpha * ink.secondary));
      };
      applyState(enabled ? "rest" : "unavailable");
      if (enabled) {
        zone?.on("pointerover", () => applyState("hover"));
        zone?.on("pointerout", () => applyState("rest"));
      }
      button.container.add([...parts, title, ...chips.objects, note, ...extras]);
      return { objects: [button.container] };
    };

    // Stops for every option, not just the visible window, so Tab reaches a deck scrolled off-screen (`rect` reads
    // the list's own position math, which is valid whether or not that row is currently drawn).
    // A stop for every deck row, `pick-<optionIndex>` as ever for the full list, `pick-rec-<n>` for the pinned group.
    let list: McVirtualList;
    let recCount = 0;
    entries.forEach((entry, entryIndex) => {
      if (entry.kind !== "option") return;
      const key = entry.recommended ? `pick-rec-${recCount++}` : `pick-${entry.optionIndex}`;
      this.#stops.set(key, {
        rect: () => list.rectFor(entryIndex),
        activate: () => selectAt(entry.optionIndex),
        ensureVisible: () => list.scrollIntoView(entryIndex),
      });
    });

    list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: rowHeight + gap,
      rowHeightOf: (index) => (heights[index] ?? rowHeight) + gap,
      count: entries.length,
      scroll: this.#pickerScroll,
      background: false,
      renderRow,
      onRowActivate: (entryIndex) => {
        const entry = entries[entryIndex];
        if (entry?.kind === "option") selectAt(entry.optionIndex);
      },
    });
    this.#pickerList = list;
  }

  async #sign(): Promise<void> {
    if (this.#signing) return;
    const model = this.#model;
    if (!model || !model.canSign) return;
    this.#signing = true;
    this.#error = null;
    this.#rebuild();
    try {
      // The run's own copy of each deck carries this run's replacements; the saved deck is never modified.
      const seats = this.#effectiveDecks().map((deck) => ({ identityCardId: deck.identityCardId, deck }));
      const tableRules = tableRulesOf(appSession().settings);
      const record = await campaignService().start({
        campaignId: this.#campaignId,
        seats,
        ...(this.#expertCampaign ? { expertCampaign: true } : {}),
        poolVersion: POOL_VERSION,
        seed: rollSeed(),
        ...(tableRules ? { tableRules } : {}),
      });
      if (!this.sys.isActive()) return;
      goToScreen(this, SCENES.campaignOpener, { runId: record.id });
    } catch (error) {
      this.#signing = false;
      this.#error = error instanceof Error ? error.message : "could not start this campaign";
      this.#rebuild();
    }
  }
}
