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
import { ink, surface, typeRole } from "../../tokens.js";
import {
  bangers,
  campaignFrame,
  captionBox,
  drawActionBar,
  drawPicture,
  drawTopBar,
  heroPicture,
} from "../../ui/campaign-chrome.js";
import { campaignActionButton } from "../../ui/campaign-buttons-a.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { dashedRect, McButton } from "../../ui/widgets.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McVirtualList } from "../../ui/virtual-list.js";
import { deckStorage, campaignService } from "../../session.js";
import { rollSeed } from "../../view/seed.js";
import type { Rect } from "../../view/layout.js";
import { ListScroll } from "../../view/list-scroll.js";
import {
  ROSTER_SEAT_COUNT,
  preconRosterOf,
  rosterDeckOptions,
  rosterModelOf,
  type RosterModel,
} from "../../view/campaign-roster-model.js";
import { storyFor } from "../../campaign/story.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignRosterData } from "./routes.js";

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
  #signing = false;
  #error: string | null = null;

  constructor() {
    super(SCENES.campaignRoster);
  }

  create(data: CampaignRosterData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#rebuild, this));
    this.#route = new FocusRoute(this, {
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

  #rebuild(): void {
    this.#pickerList?.destroy();
    this.#pickerList = null;
    destroyChildren(this);
    this.#stops = new Map();
    this.#model = rosterModelOf(this.#seats, POOL_CARDS);

    const frame = campaignFrame(this);
    const top = drawTopBar(this, {
      backLabel: frame.phone ? "◂" : "◂ Cover",
      onBack: () => this.#onCancel(),
      title: "Sign the roster",
    });
    if (top.backRect) this.#stops.set("back", { rect: top.backRect, activate: () => this.#onCancel() });

    const story = storyFor(this.#campaignId);
    const gutter = frame.gutter;
    let y = top.height + gutter;
    const banner = captionBox(this, gutter, y, frame.width - gutter * 2, story?.rosterBanner ?? "", { size: 13 });
    y += banner.rect.height + gutter;

    const actionBar = drawActionBar(this);
    const seatsBottom = actionBar.y - gutter;

    if (frame.phone) this.#drawPhoneSeats(gutter, y, frame.width - gutter * 2, seatsBottom - y - 96);
    else this.#drawWideSeats(gutter, y, frame.width - gutter * 2, seatsBottom - y - 60);

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
    if (!frame.phone) {
      this.add.text(noteRect.x + 320, noteRect.y + 6, CAST_NOTE, {
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
      onClick: () => void this.#sign(),
      titleSize: 16,
    });
    void cta;
    this.#stops.set("cta", { rect: ctaRect, activate: () => void this.#sign() });

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

  #drawWideSeats(x: number, y: number, width: number, height: number): void {
    const gap = 16;
    const cardWidth = (width - gap * (ROSTER_SEAT_COUNT - 1)) / ROSTER_SEAT_COUNT;
    for (let i = 0; i < ROSTER_SEAT_COUNT; i++) {
      const rect: Rect = { x: x + i * (cardWidth + gap), y, width: cardWidth, height };
      this.#drawSeat(i + 1, rect);
    }
  }

  #drawPhoneSeats(x: number, y: number, width: number, height: number): void {
    const gap = 12;
    const cardWidth = (width - gap) / 2;
    const cardHeight = (height - gap) / 2;
    for (let i = 0; i < ROSTER_SEAT_COUNT; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rect: Rect = {
        x: x + col * (cardWidth + gap),
        y: y + row * (cardHeight + gap),
        width: cardWidth,
        height: cardHeight,
      };
      this.#drawSeat(i + 1, rect);
    }
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

    const footerRect: Rect = { x: rect.x, y: rect.y + artRect.height, width: rect.width, height: footerHeight };
    this.add
      .rectangle(footerRect.x, footerRect.y, footerRect.width, footerRect.height, surface.card.hex)
      .setOrigin(0, 0);
    const identityName = CARDS_BY_ID.get(deck.identityCardId as string)?.name ?? (deck.identityCardId as string);
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

  // ---- The deck picker overlay ------------------------------------------------------------------------------

  #drawPicker(frame: ReturnType<typeof campaignFrame>, seatNumber: number): void {
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
    const rowHeight = 56;
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

    const options = rosterDeckOptions(this.#seats, seatNumber, this.#savedDecks, POOL_VERSION);
    const listRect: Rect = { x: panelRect.x + 20, y, width: rowWidth, height: panelRect.y + panelRect.height - 16 - y };
    const gap = 8;

    if (options.length === 0) {
      this.add.text(listRect.x, listRect.y, "No decks available — build one from Decks & Collection.", {
        ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        wordWrap: { width: rowWidth, useAdvancedWrap: true },
      });
      return;
    }

    const selectAt = (index: number): void => {
      const option = options[index];
      if (!option || option.blocked) return;
      this.#seats[seatNumber - 1] = option.deck;
      this.#pickerSeat = null;
      this.#rebuild();
    };

    const renderRow = (index: number, rect: Rect): { objects: readonly Phaser.GameObjects.GameObject[] } => {
      const option = options[index]!;
      const identityName =
        CARDS_BY_ID.get(option.deck.identityCardId as string)?.name ?? (option.deck.identityCardId as string);
      const aspects = option.deck.aspects.length > 0 ? option.deck.aspects.join(" + ") : "No aspect";
      const rowRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rowHeight };
      const button = campaignActionButton(this, {
        kind: "secondary",
        rect: rowRect,
        title: identityName,
        subtitle: option.blocked ? (option.blockedReason ?? "Already seated") : aspects,
        enabled: !option.blocked,
        onClick: () => selectAt(index),
        titleSize: 15,
      });
      return { objects: [button.container] };
    };

    // Stops for every option, not just the visible window, so Tab reaches a deck scrolled off-screen (`rect` reads
    // the list's own position math, which is valid whether or not that row is currently drawn).
    let list: McVirtualList;
    options.forEach((option, index) => {
      this.#stops.set(`pick-${index}`, {
        rect: () => list.rectFor(index),
        activate: () => selectAt(index),
        ensureVisible: () => list.scrollIntoView(index),
      });
    });

    list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: rowHeight + gap,
      count: options.length,
      scroll: this.#pickerScroll,
      background: false,
      renderRow,
      onRowActivate: (index) => selectAt(index),
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
      const seats = this.#seats
        .filter((deck): deck is Deck => deck !== null)
        .map((deck) => ({ identityCardId: deck.identityCardId, deck }));
      const record = await campaignService().start({
        campaignId: this.#campaignId,
        seats,
        ...(this.#expertCampaign ? { expertCampaign: true } : {}),
        poolVersion: POOL_VERSION,
        seed: rollSeed(),
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
