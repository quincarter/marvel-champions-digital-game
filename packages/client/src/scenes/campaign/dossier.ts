/**
 * C10/C10b/C10c — Dossier: the printed campaign log sheet, tabbed OVERVIEW / LOG / HEROES / ISSUES under the top
 * bar (Campaign - Desktop #12/#13/#14). Every number, note and citation comes from `view/campaign-dossier-model.ts`
 * over the real `CampaignRecord` and `CampaignDefinition`; Issues reuses `campaignRunModel`'s rows.
 */
import Phaser from "phaser";
import type { AnyCard } from "@mc/content";
import { CARDS_BY_ID } from "../../content/pool.js";
import { storyFor } from "../../campaign/story.js";
import { campaignService } from "../../session.js";
import { accent, signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import {
  actionBarCta,
  bangers,
  campaignFrame,
  drawActionBar,
  drawPicture,
  drawTopBar,
  heroPicture,
  ruleHeading,
  speechBubble,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { McButton, McTabs } from "../../ui/widgets.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import {
  campaignDossierHero,
  campaignDossierLog,
  campaignDossierOverview,
  type DossierBountyLadder,
  type DossierHero,
  type DossierLog,
  type DossierOverview,
  type DossierWalletSeat,
} from "../../view/campaign-dossier-model.js";
import { campaignRunModel, type RunIssueRow } from "../../view/campaign-run-model.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignDossierData, DossierTab } from "./routes.js";

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;
const cardOf = (id: string): AnyCard | undefined => CARDS_BY_ID.get(id);
const heroNameOf = (identityCardId: string): string => {
  const card = cardOf(identityCardId);
  return card && card.type === "hero_identity" ? card.hero.faceName : identityCardId;
};

interface LoadedDossier {
  readonly campaignName: string;
  readonly box: string;
  readonly campaignId: string;
  readonly issueNumber: number;
  readonly totalIssues: number;
  /** The last node marked `completed`, by its 1-based issue number — null on a run with nothing finished yet. */
  readonly lastCompletedNumber: number | null;
  readonly overview: DossierOverview;
  readonly log: DossierLog;
  readonly issues: readonly RunIssueRow[];
  readonly seatNumbers: readonly number[];
}

const TABS: readonly { readonly id: DossierTab; readonly label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "log", label: "Log" },
  { id: "heroes", label: "Heroes" },
  { id: "issues", label: "Issues" },
];

export class CampaignDossierScene extends Phaser.Scene {
  #data: CampaignDossierData | null = null;
  #loaded: LoadedDossier | null = null;
  #record: Parameters<typeof campaignDossierHero>[0] | null = null;
  #definition: Parameters<typeof campaignDossierHero>[1] | null = null;
  #tab: DossierTab = "overview";
  #seatNumber = 1;
  #status = "";
  #route: FocusRoute | null = null;
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;

  constructor() {
    super(SCENES.campaignDossier);
  }

  create(data: CampaignDossierData): void {
    this.#data = data;
    this.#loaded = null;
    this.#tab = data.tab ?? "overview";
    this.#seatNumber = data.seatNumber ?? 1;
    this.#status = "";
    this.#route = new FocusRoute(this, { onCancel: () => this.#back() });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#tabs?.destroy();
      this.#tabs = null;
    });
    void this.#load(data);
    this.#draw();
    fadeScreenIn(this);
  }

  async #load(data: CampaignDossierData): Promise<void> {
    const service = campaignService();
    const record = await service.load(data.runId);
    if (!record || !this.sys.isActive()) {
      this.#status = record ? "" : "this run could not be found";
      this.#draw();
      return;
    }
    const definition = service.definitionFor(record);
    this.#record = record;
    this.#definition = definition;
    const withMeta = { ...record, name: record.name, box: record.box };
    const overview = campaignDossierOverview(withMeta, definition, heroNameOf, cardName);
    const log = campaignDossierLog(record, definition, cardName, heroNameOf);
    const run = campaignRunModel(withMeta, definition, storyFor(record.campaignId as string), cardName);
    // "After issue #N" names the *last finished* issue, not the current/next one `run.issueNumber` tracks — the
    // highest 1-based position among nodes marked `completed`, in the definition's own printed order. Null on a
    // fresh run (nothing finished yet), which the header renders as "No issues yet".
    const completedNumbers = definition.graph.nodes
      .map((node, index) => (record.position.resolved[node.id] === "completed" ? index + 1 : null))
      .filter((n): n is number => n !== null);
    const lastCompletedNumber = completedNumbers.length > 0 ? Math.max(...completedNumbers) : null;
    this.#loaded = {
      campaignName: record.name,
      box: record.box,
      campaignId: record.campaignId as string,
      issueNumber: run.issueNumber,
      totalIssues: run.totalIssues,
      lastCompletedNumber,
      overview,
      log,
      issues: run.issues,
      seatNumbers: record.seats.map((seat) => seat.seatNumber),
    };
    if (!this.#loaded.seatNumbers.includes(this.#seatNumber)) this.#seatNumber = this.#loaded.seatNumbers[0] ?? 1;
    this.#draw();
  }

  #back(): void {
    if (!this.#data) return;
    // The cover of *this* run: without `runId` it is a fresh volume's cover ("Sign the roster"). A run that never
    // loaded has no box to show a cover for, so it goes back to the shelf.
    const campaignId = this.#loaded?.campaignId;
    if (!campaignId) goToScreen(this, SCENES.campaignSaga);
    else goToScreen(this, SCENES.campaignCover, { campaignId, runId: this.#data.runId });
  }

  #setTab(tab: DossierTab): void {
    this.#tab = tab;
    this.#draw();
  }

  #draw(): void {
    destroyChildren(this);
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tabs?.destroy();
    this.#tabs = null;
    const frame = campaignFrame(this);
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));

    const loaded = this.#loaded;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    const top = drawTopBar(this, {
      backLabel: "◂ Cover",
      onBack: () => this.#back(),
      title: "Dossier",
      right: loaded
        ? this.#tab === "overview"
          ? loaded.lastCompletedNumber === null
            ? "No issues yet"
            : `After issue #${loaded.lastCompletedNumber}`
          : loaded.campaignName
        : "",
    });
    if (top.back && top.backRect) {
      stops.set("back", { rect: top.backRect, activate: () => this.#back() });
      order.push("back");
    }

    if (!loaded) {
      this.add
        .text(frame.width / 2, frame.height / 2, this.#status || "Loading…", textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0.5);
      this.#route?.set(order, stops);
      return;
    }

    const tabBarHeight = frame.phone ? 40 : 44;
    const tabRect: Rect = { x: 0, y: top.height, width: frame.width, height: tabBarHeight };
    this.#tabs = new McTabs(this, {
      rect: tabRect,
      tabs: TABS.map((tab) => ({ id: tab.id, label: tab.label })),
      activeId: this.#tab,
      onSelect: (id) => this.#setTab(id as DossierTab),
    });
    TABS.forEach((tab, index) => {
      const cellWidth = tabRect.width / TABS.length;
      const rect: Rect = { x: tabRect.x + index * cellWidth, y: tabRect.y, width: cellWidth, height: tabRect.height };
      const key = `tab:${tab.id}`;
      stops.set(key, { rect, activate: () => this.#setTab(tab.id) });
      order.push(key);
    });

    const bodyTop = tabRect.y + tabRect.height;
    // Only the Heroes tab has an action bar (design tile 14's "EDIT HAWKEYE'S DECK") — Overview and Log run their
    // content to the bottom of the screen (tiles 12/13).
    let bodyBottom = frame.height;
    if (this.#tab === "heroes") {
      const bar = drawActionBar(this);
      bodyBottom = bar.y;
      this.#heroesActionBar(bar, stops, order);
    }
    const bodyRect: Rect = { x: 0, y: bodyTop, width: frame.width, height: bodyBottom - bodyTop };
    switch (this.#tab) {
      case "overview":
        this.#drawOverview(loaded, frame, bodyRect);
        break;
      case "log":
        this.#drawLog(loaded, frame, bodyRect);
        break;
      case "heroes":
        this.#drawHeroes(loaded, frame, bodyRect, stops, order);
        break;
      case "issues":
        this.#drawIssues(loaded, frame, bodyRect, stops, order);
        break;
    }

    this.#route?.set(order, stops);
  }

  /** Heroes tab's action bar: "EDIT <HERO>'S DECK" → the deck editor, returning to this seat's Heroes tab. */
  #heroesActionBar(bar: Rect, stops: Map<string, FocusStop>, order: string[]): void {
    const frame = campaignFrame(this);
    const seatNumber = this.#seatNumber;
    const runId = this.#data?.runId;
    const heroName = this.#loaded?.overview.seats.find((seat) => seat.seatNumber === seatNumber)?.heroName;
    const label = heroName ? `EDIT ${heroName.toUpperCase()}'S DECK` : "EDIT DECK";
    const rect = actionBarCta(bar, frame.phone);
    const activate = (): void => {
      if (!runId) return;
      goToScreen(this, SCENES.campaignDeckEdit, {
        runId,
        seatNumber,
        returnTo: { key: SCENES.campaignDossier, data: { runId, tab: "heroes", seatNumber } },
      });
    };
    stops.set("edit-deck", { rect, activate });
    order.push("edit-deck");
    this.#buttons.push(
      new McButton(this, { kind: "primary", label, type: typeRole.barTitle, rect, onClick: activate }),
    );
  }

  // -----------------------------------------------------------------------------------------------------------
  // Overview
  // -----------------------------------------------------------------------------------------------------------

  #drawOverview(loaded: LoadedDossier, frame: ReturnType<typeof campaignFrame>, body: Rect): void {
    const pad = frame.gutter;
    // Desktop/tablet (#12/#19): a fixed 320px "The world" column on the right; everything else wraps in what's
    // left. Phone: one column, the left column's own content then the world box beneath — no room for a side
    // column.
    const worldWidth = frame.phone ? body.width - pad * 2 : 320;
    const leftWidth = frame.phone ? body.width - pad * 2 : frame.width - pad * 2 - worldWidth - 24;
    const leftX = pad;
    let leftY = body.y + pad;

    // A box with a Wallets-shaped currency field (MC16) shows the wallet panel where MC10 shows seat art cards —
    // there is no room, and no printed-sheet column, for both. A box with neither (nothing detected) falls back
    // to the seat art cards MC10 has always shown, unchanged.
    if (loaded.overview.wallets) {
      leftY = this.#walletsPanel(loaded.overview.wallets, { x: leftX, y: leftY, width: leftWidth, height: 0 }) + 24;
    } else {
      const cardWidth = frame.phone ? leftWidth : Math.min(456, leftWidth);
      const gap = 24;
      let x = leftX;
      let y = leftY;
      let rowBottom = y;
      for (const seat of loaded.overview.seats) {
        const rect: Rect = { x, y, width: cardWidth, height: 0 };
        const height = this.#seatOverviewCard(seat, rect);
        rowBottom = Math.max(rowBottom, y + height);
        if (frame.phone) {
          y += height + 16;
        } else {
          x += cardWidth + gap;
          if (x + cardWidth > leftX + leftWidth) {
            x = leftX;
            y = rowBottom + 16;
          }
        }
      }
      leftY = rowBottom + 16;
    }

    if (loaded.overview.bountyLadder) {
      leftY = this.#bountyLadderPanel(loaded.overview.bountyLadder, {
        x: leftX,
        y: leftY,
        width: leftWidth,
        height: 0,
      });
    }

    const worldX = frame.phone ? pad : frame.width - pad - worldWidth;
    const worldY = frame.phone ? leftY + 16 : body.y + pad;
    if (loaded.overview.world.length > 0) {
      let wy = ruleHeading(this, worldX, worldY, worldWidth, "The world");
      const box = this.add.graphics();
      const boxTop = wy;
      for (const row of loaded.overview.world) {
        this.add.text(worldX + 12, wy + 10, row.bigValue, textStyle(bangers(24), surface.ink.hex));
        const labelText = this.add
          .text(worldX + 60, wy + 8, row.label, textStyle(typeRole.emphasis, surface.ink.hex))
          .setFontSize(12)
          .setWordWrapWidth(worldWidth - 72);
        const whenText = this.add
          .text(
            worldX + 60,
            labelText.y + labelText.height + 2,
            row.when,
            textStyle(typeRole.body, surface.ink.hex, 0.65),
          )
          .setFontSize(11)
          .setWordWrapWidth(worldWidth - 72);
        const rowHeight = Math.max(54, whenText.y + whenText.height - wy + 10);
        wy += rowHeight;
        this.add.rectangle(worldX, wy, worldWidth, 1, surface.ink.hex, 0.15).setOrigin(0, 0.5);
      }
      box.lineStyle(2, surface.ink.hex, 1).strokeRect(worldX, boxTop, worldWidth, wy - boxTop);
      this.add
        .text(worldX, wy + 8, "Each line says when it matters. Nothing here needs to be written down.", {
          ...textStyle(typeRole.body, surface.ink.hex, 0.55),
          fontSize: "11px",
        })
        .setWordWrapWidth(worldWidth);
    }
  }

  #seatOverviewCard(seat: DossierOverview["seats"][number], rect: Rect): number {
    const artHeight = 200;
    const picture = heroPicture(seat.identityCardId);
    const artRect: Rect = { ...rect, height: artHeight };
    const g = this.add.graphics();
    g.fillStyle(0x1c1a17, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    drawPicture(this, picture, artRect, () => this.#draw(), { focusY: 0.1 });
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(artRect.x, artRect.y, artRect.width, artRect.height);
    const plateHeight = 34;
    const plateRect: Rect = { x: rect.x, y: artRect.y + artHeight, width: rect.width, height: plateHeight };
    const plate = this.add.graphics();
    plate.fillStyle(0xe4dcc6, 1).fillRect(plateRect.x, plateRect.y, plateRect.width, plateRect.height);
    this.add
      .text(
        plateRect.x + 10,
        plateRect.y + plateRect.height / 2,
        seat.heroName.toUpperCase(),
        textStyle(bangers(16), surface.ink.hex),
      )
      .setOrigin(0, 0.5);
    this.add
      .text(plateRect.x + rect.width - 10, plateRect.y + plateRect.height / 2, `SEAT #${seat.seatNumber} · LOCKED`, {
        ...textStyle(typeRole.label, surface.ink.hex, 0.6),
        fontSize: "10px",
      })
      .setOrigin(1, 0.5);
    let y = plateRect.y + plateRect.height;
    const box = this.add.graphics();
    const boxTop = y;
    for (const row of seat.rows) {
      const rowHeight = 40;
      this.add
        .text(rect.x + 10, y + 6, row.label, textStyle(typeRole.emphasis, surface.ink.hex, row.empty ? 0.4 : 1))
        .setFontSize(12);
      const valueText = row.empty ? (row.note ?? "—") : row.value;
      this.add
        .text(rect.x + 10, y + 22, valueText, textStyle(typeRole.body, surface.ink.hex, row.empty ? 0.45 : 0.75))
        .setFontSize(11)
        .setWordWrapWidth(rect.width - 20);
      y += rowHeight;
      this.add.rectangle(rect.x, y, rect.width, 1, surface.ink.hex, 0.12).setOrigin(0, 0.5);
    }
    box.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, boxTop, rect.width, y - boxTop);
    return y - rect.y;
  }

  /** Wallets (design tile 19): one bordered card per seat, two to a row, real balance + Market grants. */
  #walletsPanel(wallets: readonly DossierWalletSeat[], rect: Rect): number {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Wallets");
    const gap = 16;
    const cardWidth = Math.min(360, (rect.width - gap) / 2);
    let x = rect.x;
    let rowStartY = y;
    let rowBottom = y;
    wallets.forEach((wallet, index) => {
      const height = this.#walletCard(wallet, { x, y: rowStartY, width: cardWidth, height: 0 });
      rowBottom = Math.max(rowBottom, rowStartY + height);
      if (index % 2 === 1) {
        x = rect.x;
        rowStartY = rowBottom + 12;
      } else {
        x += cardWidth + gap;
      }
    });
    return rowBottom;
  }

  #walletCard(wallet: DossierWalletSeat, rect: Rect): number {
    const inset = 10;
    let y = rect.y + inset;
    this.add.text(rect.x + inset, y, `${wallet.heroName.toUpperCase()} · SEAT #${wallet.seatNumber}`, {
      ...textStyle(typeRole.label, surface.ink.hex, 0.6),
      fontSize: "10px",
    });
    y += 18;
    this.add.text(rect.x + inset, y, wallet.balanceLabel, textStyle(bangers(22), surface.ink.hex));
    y += 30;
    if (wallet.cardNames.length === 0) {
      this.add.text(rect.x + inset, y, "—", textStyle(typeRole.body, surface.ink.hex, 0.4)).setFontSize(11);
      y += 18;
    } else {
      for (const name of wallet.cardNames) {
        this.add
          .text(rect.x + inset, y, name, textStyle(typeRole.body, surface.ink.hex, 0.8))
          .setFontSize(11)
          .setWordWrapWidth(rect.width - inset * 2);
        y += 18;
      }
    }
    const height = y - rect.y + inset;
    this.add.graphics().lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, height);
    return height;
  }

  /** The Bounty Ladder (design tile 19): a dark header bar, then one row per rung with an ACTIVE/NOT YET badge. */
  #bountyLadderPanel(ladder: DossierBountyLadder, rect: Rect): number {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "The bounty ladder");
    const headerHeight = 30;
    const header = this.add.graphics();
    header.fillStyle(surface.ink.hex, 1).fillRect(rect.x, y, rect.width, headerHeight);
    this.add
      .text(rect.x + 10, y + headerHeight / 2, ladder.title.toUpperCase(), textStyle(bangers(15), surface.paper.hex))
      .setOrigin(0, 0.5);
    this.add
      .text(rect.x + rect.width - 10, y + headerHeight / 2, ladder.marksLabel, {
        ...textStyle(typeRole.label, signal.cost.hex, 1),
        fontSize: "11px",
        fontStyle: "700",
      })
      .setOrigin(1, 0.5);
    y += headerHeight;
    const bodyTop = y;
    const box = this.add.graphics();
    for (const rung of ladder.rungs) {
      const rowHeight = 42;
      this.add
        .text(rect.x + 18, y + rowHeight / 2, String(rung.tier), {
          ...textStyle(bangers(18), surface.ink.hex, rung.unlocked ? 1 : 0.4),
        })
        .setOrigin(0.5, 0.5);
      this.add
        .text(rect.x + 40, y + 6, rung.name, textStyle(typeRole.emphasis, surface.ink.hex, rung.unlocked ? 1 : 0.5))
        .setFontSize(12);
      this.add
        .text(rect.x + 40, y + 22, `Joins from issue ${rung.firstIssueLabel}.`, {
          ...textStyle(typeRole.body, surface.ink.hex, rung.unlocked ? 0.6 : 0.4),
        })
        .setFontSize(10)
        .setWordWrapWidth(rect.width - 160);
      const badgeWidth = 74;
      const badgeHeight = 20;
      const badgeRect: Rect = {
        x: rect.x + rect.width - badgeWidth - 10,
        y: y + rowHeight / 2 - badgeHeight / 2,
        width: badgeWidth,
        height: badgeHeight,
      };
      const badge = this.add.graphics();
      badge
        .fillStyle(rung.unlocked ? accent.heroRed.hex : 0xd9d2bd, 1)
        .fillRect(badgeRect.x, badgeRect.y, badgeRect.width, badgeRect.height);
      this.add
        .text(badgeRect.x + badgeWidth / 2, badgeRect.y + badgeHeight / 2, rung.unlocked ? "ACTIVE" : "NOT YET", {
          ...textStyle(typeRole.label, rung.unlocked ? surface.paper.hex : surface.ink.hex, 1),
          fontSize: "9px",
          fontStyle: "700",
        })
        .setOrigin(0.5);
      y += rowHeight;
      this.add.rectangle(rect.x, y, rect.width, 1, surface.ink.hex, 0.15).setOrigin(0, 0.5);
    }
    box.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, bodyTop, rect.width, y - bodyTop);
    const caption = this.add
      .text(rect.x, y + 8, ladder.caption, { ...textStyle(typeRole.body, surface.ink.hex, 0.55), fontSize: "11px" })
      .setWordWrapWidth(rect.width);
    return caption.y + caption.height;
  }

  // -----------------------------------------------------------------------------------------------------------
  // Log
  // -----------------------------------------------------------------------------------------------------------

  #drawLog(loaded: LoadedDossier, frame: ReturnType<typeof campaignFrame>, body: Rect): void {
    const pad = frame.gutter;
    const rightWidth = frame.phone ? 0 : 300;
    const leftWidth = frame.width - pad * 2 - (rightWidth > 0 ? rightWidth + 24 : 0);
    let y = body.y + pad;
    for (const section of loaded.log.sections) {
      const header = this.add.graphics();
      const headerHeight = 30;
      header.fillStyle(surface.ink.hex, 1).fillRect(pad, y, leftWidth, headerHeight);
      this.add
        .text(pad + 10, y + headerHeight / 2, section.headline, textStyle(bangers(15), surface.paper.hex))
        .setOrigin(0, 0.5);
      this.add
        .text(pad + leftWidth - 10, y + headerHeight / 2, section.outcomeLabel, {
          ...textStyle(
            typeRole.label,
            section.outcomeLabel.startsWith("WON") ? signal.heal.hex : accent.heroRed.hex,
            1,
          ),
          fontSize: "11px",
        })
        .setOrigin(1, 0.5);
      y += headerHeight;
      const bodyTop = y;
      const box = this.add.graphics();
      const minRowHeight = 38;
      const detailTop = 22;
      const detailBottomPad = 8;
      // Phone has no room for a right-aligned citation column beside the headline (`leftWidth` is the full frame
      // width there) — the citation drops under the detail line instead of squeezing/overlapping the headline.
      const citationColumnWidth = frame.phone ? 0 : 150;
      for (const entry of section.entries) {
        const rowTop = y;
        this.add
          .text(pad + 24, y + 6, entry.headline, textStyle(typeRole.emphasis, surface.ink.hex))
          .setFontSize(12)
          .setWordWrapWidth(leftWidth - 34 - citationColumnWidth);
        const detail = this.add
          .text(pad + 24, y + detailTop, entry.detail, textStyle(typeRole.body, surface.ink.hex, 0.6))
          .setFontSize(10)
          .setWordWrapWidth(leftWidth - 34 - citationColumnWidth);
        // Sized from the detail text's own measured (possibly wrapped) height, never a fixed height a long
        // instruction's printed text can run past — see `scenes/campaign/issue.ts`'s own writes list.
        let rowHeight = Math.max(minRowHeight, detailTop + detail.height + detailBottomPad);
        if (frame.phone) {
          const citation = this.add
            .text(
              pad + 24,
              y + detailTop + detail.height + 4,
              entry.citation,
              textStyle(typeRole.label, surface.ink.hex, 0.45),
            )
            .setFontSize(9);
          rowHeight = Math.max(rowHeight, citation.y - y + citation.height + detailBottomPad);
        } else {
          this.add
            .text(pad + leftWidth - 8, y + 6, entry.citation, textStyle(typeRole.label, surface.ink.hex, 0.45))
            .setOrigin(1, 0)
            .setFontSize(9);
        }
        this.add.rectangle(pad + 10, rowTop + rowHeight / 2, 8, 8, signal.cost.hex);
        y += rowHeight;
      }
      box.lineStyle(2, surface.ink.hex, 1).strokeRect(pad, bodyTop, leftWidth, y - bodyTop);
      y += 16;
    }
    if (loaded.log.next) {
      const dashHeight = 46;
      const box = this.add.graphics();
      box.lineStyle(2, surface.ink.hex, 0.6).strokeRect(pad, y, leftWidth, dashHeight);
      this.add.text(pad + 10, y + 6, loaded.log.next.headline, textStyle(bangers(14), surface.ink.hex));
      this.add
        .text(pad + 10, y + 24, loaded.log.next.promise, textStyle(typeRole.body, surface.ink.hex, 0.7))
        .setFontSize(11)
        .setWordWrapWidth(leftWidth - 20);
    }

    if (rightWidth > 0) {
      const rx = pad + leftWidth + 24;
      let ry = ruleHeading(this, rx, body.y + pad, rightWidth, "In force now");
      const box = this.add.graphics();
      const boxTop = ry;
      // Three columns, none overlapping: the label at the left edge, the big number in its own column starting
      // ~130px in (design tile 13's own layout), the short note right-aligned at the far edge.
      const valueColumnX = rx + 130;
      for (const row of loaded.log.inForce) {
        const rowHeight = 36;
        this.add
          .text(rx + 10, ry + rowHeight / 2, row.label, textStyle(typeRole.emphasis, surface.ink.hex))
          .setOrigin(0, 0.5)
          .setFontSize(12);
        this.add
          .text(valueColumnX, ry + rowHeight / 2, row.value, textStyle(bangers(18), surface.ink.hex))
          .setOrigin(0, 0.5);
        this.add
          .text(rx + rightWidth - 10, ry + rowHeight / 2, row.note, {
            ...textStyle(typeRole.body, surface.ink.hex, 0.5),
            fontSize: "10px",
          })
          .setOrigin(1, 0.5)
          .setWordWrapWidth(rightWidth - 140);
        ry += rowHeight;
        this.add.rectangle(rx, ry, rightWidth, 1, surface.ink.hex, 0.12).setOrigin(0, 0.5);
      }
      box.lineStyle(2, surface.ink.hex, 1).strokeRect(rx, boxTop, rightWidth, ry - boxTop);
      this.add
        .text(rx, ry + 10, "Written by the game, never by hand. Page refs point to the rulebook for anyone checking.", {
          ...textStyle(typeRole.body, surface.ink.hex, 0.55),
          fontSize: "11px",
        })
        .setWordWrapWidth(rightWidth);
    }
  }

  // -----------------------------------------------------------------------------------------------------------
  // Heroes
  // -----------------------------------------------------------------------------------------------------------

  #drawHeroes(
    loaded: LoadedDossier,
    frame: ReturnType<typeof campaignFrame>,
    body: Rect,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    if (!this.#record || !this.#definition) return;
    const hero = campaignDossierHero(this.#record, this.#definition, this.#seatNumber, cardOf);
    const pad = frame.gutter;
    if (frame.phone) {
      // Two-button seat switcher up top, then the hero panel beneath.
      const switchHeight = 40;
      const half = (body.width - pad * 2 - 8) / Math.max(1, loaded.seatNumbers.length);
      loaded.seatNumbers.forEach((seatNumber, index) => {
        const rect: Rect = { x: pad + index * (half + 8), y: body.y + pad, width: half, height: switchHeight };
        this.#seatButton(seatNumber, rect, stops, order);
      });
      if (hero)
        this.#heroPanel(
          hero,
          {
            x: pad,
            y: body.y + pad + switchHeight + 12,
            width: body.width - pad * 2,
            height: body.height - pad * 2 - switchHeight - 12,
          },
          stops,
          order,
        );
      return;
    }
    const listWidth = 220;
    let y = body.y + pad;
    for (const seatNumber of loaded.seatNumbers) {
      const rect: Rect = { x: pad, y, width: listWidth, height: 56 };
      this.#seatRow(loaded, seatNumber, rect, stops, order);
      y += rect.height + 8;
    }
    const midX = pad + listWidth + 16;
    const midWidth = 320;
    const boxesHeight = 48;
    const artHeight = body.height - pad * 2 - boxesHeight - 10;
    if (hero) {
      this.#heroBigPanel(hero, { x: midX, y: body.y + pad, width: midWidth, height: artHeight });
      this.#issueBoxesRow(hero, { x: midX, y: body.y + pad + artHeight + 10, width: midWidth, height: boxesHeight });
    }
    const rightX = midX + midWidth + 24;
    const rightWidth = frame.width - rightX - pad;
    if (hero)
      this.#heroSidePanel(hero, { x: rightX, y: body.y + pad, width: rightWidth, height: body.height - pad * 2 });
  }

  /** The five per-issue result boxes under the hero's art (design tile 14): WON green, NEXT red, sealed dim. */
  #issueBoxesRow(hero: DossierHero, rect: Rect): void {
    const gap = 6;
    const count = Math.max(1, hero.issues.length);
    const width = (rect.width - gap * (count - 1)) / count;
    for (const box of hero.issues) {
      const index = hero.issues.indexOf(box);
      const bx = rect.x + index * (width + gap);
      const color = box.state === "won" ? signal.heal.hex : box.state === "next" ? accent.heroRed.hex : surface.ink.hex;
      const alpha = box.state === "sealed" ? 0.3 : 1;
      const g = this.add.graphics();
      g.fillStyle(surface.card.hex, 1).fillRect(bx, rect.y, width, rect.height);
      g.lineStyle(2, color, alpha).strokeRect(bx, rect.y, width, rect.height);
      this.add
        .text(bx + width / 2, rect.y + rect.height * 0.38, `#${box.number}`, {
          ...textStyle(bangers(14), surface.ink.hex, alpha),
        })
        .setOrigin(0.5);
      this.add
        .text(bx + width / 2, rect.y + rect.height * 0.74, box.label, {
          ...textStyle(typeRole.label, color, alpha),
          fontSize: "9px",
          fontStyle: "700",
        })
        .setOrigin(0.5);
    }
  }

  #seatButton(seatNumber: number, rect: Rect, stops: Map<string, FocusStop>, order: string[]): void {
    const key = `seat:${seatNumber}`;
    const selected = seatNumber === this.#seatNumber;
    stops.set(key, {
      rect,
      activate: () => {
        this.#seatNumber = seatNumber;
        this.#draw();
      },
    });
    order.push(key);
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: `Seat #${seatNumber}`,
        type: typeRole.rowTitle,
        rect,
        selected,
        onClick: () => {
          this.#seatNumber = seatNumber;
          this.#draw();
        },
      }),
    );
  }

  #seatRow(
    loaded: LoadedDossier,
    seatNumber: number,
    rect: Rect,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const seatOverview = loaded.overview.seats.find((seat) => seat.seatNumber === seatNumber);
    const selected = seatNumber === this.#seatNumber;
    const g = this.add.graphics();
    g.lineStyle(selected ? 3 : 2, surface.ink.hex, selected ? 1 : 0.4).strokeRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
    const thumbRect: Rect = { x: rect.x + 6, y: rect.y + 6, width: rect.height - 12, height: rect.height - 12 };
    if (seatOverview) drawPicture(this, heroPicture(seatOverview.identityCardId), thumbRect, () => this.#draw());
    this.add.text(
      rect.x + rect.height,
      rect.y + 12,
      (seatOverview?.heroName ?? `Seat ${seatNumber}`).toUpperCase(),
      textStyle(bangers(14), surface.ink.hex),
    );
    this.add
      .text(rect.x + rect.height, rect.y + 32, `Seat #${seatNumber}`, textStyle(typeRole.label, surface.ink.hex, 0.55))
      .setFontSize(10);
    const key = `seat:${seatNumber}`;
    const activate = (): void => {
      this.#seatNumber = seatNumber;
      this.#draw();
    };
    this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", activate);
    stops.set(key, { rect, activate });
    order.push(key);
  }

  #heroPanel(hero: DossierHero, rect: Rect, stops: Map<string, FocusStop>, order: string[]): void {
    const boxesHeight = 44;
    const artHeight = rect.height * 0.5;
    this.#heroBigPanel(hero, { x: rect.x, y: rect.y, width: rect.width, height: artHeight });
    this.#issueBoxesRow(hero, { x: rect.x, y: rect.y + artHeight + 8, width: rect.width, height: boxesHeight });
    this.#heroSidePanel(hero, {
      x: rect.x,
      y: rect.y + artHeight + boxesHeight + 20,
      width: rect.width,
      height: rect.height - artHeight - boxesHeight - 20,
    });
    void stops;
    void order;
  }

  #heroBigPanel(hero: DossierHero, rect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(0x1c1a17, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const bandHeight = 46;
    drawPicture(
      this,
      heroPicture(hero.identityCardId),
      { ...rect, height: rect.height - bandHeight },
      () => this.#draw(),
      { focusY: 0.08 },
    );
    if (hero.quote) speechBubble(this, rect.x + 10, rect.y + 10, Math.min(rect.width - 20, 280), hero.quote);
    const bandRect: Rect = { x: rect.x, y: rect.y + rect.height - bandHeight, width: rect.width, height: bandHeight };
    const band = this.add.graphics();
    band.fillStyle(surface.ink.hex, 1).fillRect(bandRect.x, bandRect.y, bandRect.width, bandRect.height);
    this.add
      .text(bandRect.x + 10, bandRect.y + 6, hero.heroName.toUpperCase(), textStyle(bangers(16), surface.paper.hex))
      .setOrigin(0, 0);
    const subtitle = `${(hero.alterEgoName ?? hero.heroName).toUpperCase()} · SEAT #${hero.seatNumber} · LOCKED FOR THE CAMPAIGN`;
    this.add
      .text(bandRect.x + 10, bandRect.y + bandRect.height - 8, subtitle, {
        ...textStyle(typeRole.label, surface.paper.hex, 0.6),
        fontSize: "9px",
      })
      .setOrigin(0, 1);
  }

  #heroSidePanel(hero: DossierHero, rect: Rect): void {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Campaign cards");
    for (const card of hero.campaignCards) {
      const cardHeight = 62;
      const box = this.add.graphics();
      box.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, cardHeight);
      this.add.text(rect.x + 10, y + 6, card.typeLabel.toUpperCase(), {
        ...textStyle(typeRole.label, surface.ink.hex, 0.55),
        fontSize: "9px",
      });
      this.add.text(rect.x + 10, y + 18, card.name, textStyle(bangers(15), surface.ink.hex));
      this.add
        .text(rect.x + 10, y + cardHeight - 16, card.textLine, textStyle(typeRole.body, surface.ink.hex, 0.65))
        .setFontSize(10)
        .setWordWrapWidth(rect.width - 20);
      if (card.improvesIn) {
        const tagWidth = 90;
        const tagRect: Rect = { x: rect.x + rect.width - tagWidth - 6, y: y + 4, width: tagWidth, height: 16 };
        const tag = this.add.graphics();
        tag.fillStyle(signal.cost.hex, 1).fillRect(tagRect.x, tagRect.y, tagRect.width, tagRect.height);
        this.add
          .text(tagRect.x + tagRect.width / 2, tagRect.y + tagRect.height / 2, `IMPROVES IN ${card.improvesIn}`, {
            ...textStyle(typeRole.label, surface.paper.hex, 1),
            fontSize: "8px",
          })
          .setOrigin(0.5);
      }
      y += cardHeight + 8;
    }
    y += 8;
    y = ruleHeading(
      this,
      rect.x,
      y,
      rect.width,
      `Stats as of issue #${this.#loaded?.issueNumber ?? 1}`,
      surface.ink.hex,
      16,
    );
    const boxTop = y;
    // Estimated up front so the fill can be drawn before the rows' text — a fill drawn (or reordered) after would
    // paint over its own numbers, the same "graphics is a z-order slot" trap `campaign-chrome.ts` avoids.
    const rowHeight = 40;
    const boxHeight = hero.stats.length * rowHeight;
    const fill = this.add.graphics();
    fill.fillStyle(0xeae3d3, 1).fillRect(rect.x, boxTop, rect.width, boxHeight);
    // Three columns, none overlapping: label at the left edge, the big number in its own column ~130px in, the
    // short note right-aligned at the far edge — the same layout `#drawLog`'s "In force now" table uses.
    const statValueX = rect.x + 130;
    for (const stat of hero.stats) {
      this.add
        .text(rect.x + 10, y + rowHeight / 2, stat.label, textStyle(typeRole.emphasis, surface.ink.hex))
        .setFontSize(12)
        .setOrigin(0, 0.5);
      this.add
        .text(statValueX, y + rowHeight / 2, stat.value, textStyle(bangers(16), surface.ink.hex))
        .setOrigin(0, 0.5);
      this.add
        .text(rect.x + rect.width - 10, y + rowHeight / 2, stat.note, {
          ...textStyle(typeRole.body, surface.ink.hex, 0.5),
          fontSize: "9px",
        })
        .setOrigin(1, 0.5)
        .setWordWrapWidth(rect.width - 140);
      y += rowHeight;
      this.add.rectangle(rect.x, y, rect.width, 1, surface.ink.hex, 0.12).setOrigin(0, 0.5);
    }
    this.add
      .graphics()
      .lineStyle(2, surface.ink.hex, 1)
      .strokeRect(rect.x, boxTop, rect.width, y - boxTop);
  }

  // -----------------------------------------------------------------------------------------------------------
  // Issues (reuses the Run screen's own row rendering, compactly)
  // -----------------------------------------------------------------------------------------------------------

  #drawIssues(
    loaded: LoadedDossier,
    frame: ReturnType<typeof campaignFrame>,
    body: Rect,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const pad = frame.gutter;
    let y = body.y + pad;
    for (const issue of loaded.issues) {
      const rowHeight = 64;
      const rect: Rect = { x: pad, y, width: frame.width - pad * 2, height: rowHeight };
      this.#issueRow(issue, rect, stops, order);
      y += rowHeight + 8;
    }
  }

  #issueRow(issue: RunIssueRow, rect: Rect, stops: Map<string, FocusStop>, order: string[]): void {
    const finished = issue.status === "finished";
    const sealed = issue.status === "sealed";
    const g = this.add.graphics();
    g.fillStyle(issue.status === "current" ? surface.ink.hex : sealed ? 0xd9d2bd : 0x1c1a17, 1).fillRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
    const thumbRect: Rect = { x: rect.x + 6, y: rect.y + 6, width: rect.height - 12, height: rect.height - 12 };
    const color = issue.status === "current" || !sealed ? surface.paper.hex : surface.ink.hex;
    if (sealed) {
      this.add
        .text(
          thumbRect.x + thumbRect.width / 2,
          thumbRect.y + thumbRect.height / 2,
          "?",
          textStyle(bangers(18), surface.ink.hex, 0.4),
        )
        .setOrigin(0.5);
    } else {
      drawPicture(this, villainPicture(issue.nodeId), thumbRect, () => this.#draw(), {
        grayscale: finished,
        focusY: 0.12,
      });
    }
    const textX = thumbRect.x + thumbRect.width + 10;
    const kicker = sealed ? `#${issue.number} · SEALED` : `#${issue.number} · ${(issue.villain ?? "").toUpperCase()}`;
    this.add.text(textX, rect.y + 10, kicker, { ...textStyle(typeRole.label, color, 0.7), fontSize: "10px" });
    this.add.text(textX, rect.y + 24, issue.title, textStyle(bangers(15), color));
    if (finished && issue.resultLine) {
      this.add.text(textX, rect.y + 44, issue.resultLine, {
        ...textStyle(typeRole.body, color, 0.7),
        fontSize: "10px",
      });
    }
    if (finished) {
      const key = `issue:${issue.nodeId}`;
      const activate = (): void => {
        if (!this.#data) return;
        goToScreen(this, SCENES.campaignIssue, { runId: this.#data.runId, nodeId: issue.nodeId });
      };
      this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", activate);
      stops.set(key, { rect, activate });
      order.push(key);
    }
  }
}
