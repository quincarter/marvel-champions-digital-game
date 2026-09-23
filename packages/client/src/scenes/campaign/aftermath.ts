/**
 * C05/C06 — Aftermath: folding a finished campaign game back into the log (docs/campaign-mode-design.md §7).
 *
 * Entered straight from Game over (`scenes/game-over.ts`'s "Continue the campaign ▸"): the store's current game is
 * still the one that just ended, so `#load` reads its outcome and saves it (`appSession().store.save()`), then
 * drives `campaignService().fold` to completion.
 *
 * A **loss** folds with no questions in MC10 and leaves straight for Rewind. A **win** may ask one or more victory
 * choices (`view/campaign-aftermath-model.ts`): the runner asks one seat at a time, but this screen shows every
 * seat's column at once, lets the player make every seat's pick locally, and only sends real answers to the engine
 * on commit — each one checked against what the engine actually offers before it's sent.
 *
 * **A known simplification.** The design's own tile (07-d-c06) shows the "LOGGED · 3 DELAY COUNTERS" tag *while*
 * a choice is still pending — but that number only exists once the whole victory list has resolved
 * (`CampaignHistoryEntry.steps`), which the runner doesn't expose mid-fold (only the final `"done"` log has it).
 * Reading it early would mean re-deriving a `record`-kind write from the finished game ourselves, which is exactly
 * the "client computes state" mistake CLAUDE.md rules out. So the tag appears only once this fold has nothing left
 * to ask — for MC10, that's issue #1 (which has no shared numeric write at all) and any win with no pending choice
 * at all; a win that *does* ask a choice (issue #2's optional Condition upgrade) shows the stamp without the tag,
 * because by the time it's known the screen has already moved on.
 */
import type { CardId } from "@mc/content";
import type { CampaignChoiceAnswer } from "@mc/engine";
import Phaser from "phaser";
import { issueNumberOf, issueStoryFor, type IssueStory } from "../../campaign/story.js";
import { CARDS_BY_ID } from "../../content/pool.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import type { SavedGame } from "../../engine/host.js";
import { appSession, campaignService } from "../../session.js";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import {
  artNote,
  artboardPicture,
  campaignFrame,
  drawPicture,
  speechBubble,
  stamp,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McButton, fitText, label } from "../../ui/widgets.js";
import {
  advanceAftermathGroup,
  aftermathColumns,
  aftermathOptionOf,
  aftermathStamp,
  answerForPending,
  continuesGroup,
  decideForSeat,
  offersAnswer,
  readyToCommit,
  startAftermathGroup,
  type AftermathChoiceGroup,
  type AftermathColumn,
  type AftermathSeat,
} from "../../view/campaign-aftermath-model.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignAftermathData } from "./routes.js";

type Phase = "loading" | "loss" | "group" | "summary" | "error";

/** The bubble's speaker label — a name for a hero/NPC line, nothing for the narrator. */
function speakerNameOf(line: {
  readonly speaker: { readonly kind: string; readonly name?: string };
}): string | undefined {
  return line.speaker.kind === "npc" || line.speaker.kind === "hero" ? line.speaker.name : undefined;
}

export class CampaignAftermathScene extends Phaser.Scene {
  #data!: CampaignAftermathData;
  #record: CampaignRecord | null = null;
  #nodeId: string | null = null;
  #saved: SavedGame | null = null;
  #gameId: string | null = null;
  #answers: CampaignChoiceAnswer[] = [];
  #group: AftermathChoiceGroup | null = null;
  #seats: readonly AftermathSeat[] = [];
  #phase: Phase = "loading";
  #busy = false;
  #errorText = "";
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.campaignAftermath);
  }

  init(data: CampaignAftermathData): void {
    this.#data = data;
    this.#record = null;
    this.#nodeId = null;
    this.#saved = null;
    this.#answers = [];
    this.#group = null;
    this.#phase = "loading";
    this.#busy = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
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
    if (!record.attempt) {
      // Nothing to fold (a stale or repeated visit) — land somewhere that still makes sense of the record.
      if (record.status === "won") goToScreen(this, SCENES.campaignFinale, { runId: record.id });
      else goToScreen(this, SCENES.campaignRun, { runId: record.id });
      return;
    }
    this.#record = record;
    this.#nodeId = record.attempt.nodeId;
    this.#seats = record.seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      heroName: CARDS_BY_ID.get(seat.identityCardId as string)?.name ?? `Seat ${seat.seatNumber}`,
    }));
    const { store } = appSession();
    // `campaignResultOf` (`packages/engine/src/campaign/result.ts`) treats anything but `"win"` as a campaign
    // loss — "RRG 1.8 has no 'conceded' campaign outcome: a conceded game is a game the players did not win" — so
    // this branch has to match that, not narrow itself to `"loss"` and let a conceded game fall through as a win.
    const outcome = store.state.game?.outcome?.result ?? null;
    const won = outcome === "win";
    this.#saved = await store.save();
    const latest = await store.latestSave();
    this.#gameId = latest?.id ?? null;
    if (!this.sys.isActive()) return;
    if (!won) {
      const result = await service.fold(record, this.#saved, [], this.#gameId);
      if (!this.sys.isActive()) return;
      if (result.kind !== "done") {
        // MC10 never asks a defeat question; another box that did would need its own screen, not a silent guess.
        this.#phase = "error";
        this.#errorText = "This box's loss asks a question this screen doesn't know how to show yet.";
        this.#draw();
        return;
      }
      goToScreen(this, SCENES.campaignRewind, { runId: record.id, nodeId: this.#nodeId });
      return;
    }
    this.#phase = "loss"; // placeholder, corrected immediately by #advance for the win path
    await this.#advance();
  }

  #optionOf = (cardId: Parameters<typeof aftermathOptionOf>[0]): ReturnType<typeof aftermathOptionOf> =>
    aftermathOptionOf(cardId, CARDS_BY_ID);

  /** Calls `fold` with the answers accumulated so far and updates the phase from what comes back. */
  async #advance(): Promise<void> {
    const record = this.#record;
    const saved = this.#saved;
    if (!record || !saved) return;
    const service = campaignService();
    const result = await service.fold(record, saved, this.#answers, this.#gameId);
    if (!this.sys.isActive()) return;
    if (result.kind === "done") {
      this.#onFolded(result.record);
      return;
    }
    const pending = result.choice;
    if (this.#group && continuesGroup(this.#group, pending)) {
      const lastConfirmed = this.#answers.at(-1)?.seatNumber ?? this.#group.currentSeatNumber;
      this.#group = advanceAftermathGroup(this.#group, lastConfirmed, pending) ?? this.#group;
    } else {
      this.#group = startAftermathGroup(pending, this.#seats, this.#optionOf);
    }
    this.#phase = "group";
    this.#draw();
  }

  #onFolded(record: CampaignRecord): void {
    this.#record = record;
    if (record.status === "won") {
      goToScreen(this, SCENES.campaignFinale, { runId: record.id });
      return;
    }
    // `this.#group` is left as-is on purpose: by the time a commit loop reaches "done", every seat in it is
    // already confirmed (`AftermathColumn.status === "confirmed"`), which is exactly what the summary phase shows
    // — the tile keeps each hero's pick on screen (YOURS / WITH …), it doesn't clear the columns. A win with no
    // pending choice at all (MC10 has none, but a future box might) leaves `#group` null, which the summary phase
    // reads as "nothing to hand out this issue".
    this.#phase = "summary";
    this.#draw();
  }

  /** The right column's "EACH HERO TAKES ONE" ▸ commit loop: real fold calls, one confirmed seat at a time. */
  async #commit(): Promise<void> {
    if (!this.#group || this.#busy || !readyToCommit(this.#group)) return;
    let group: AftermathChoiceGroup = this.#group;
    this.#busy = true;
    this.#draw();
    const service = campaignService();
    const record = this.#record;
    const saved = this.#saved;
    if (!record || !saved) return;
    for (let guard = 0; guard < 8; guard++) {
      const peek = await service.fold(record, saved, this.#answers, this.#gameId);
      if (!this.sys.isActive()) return;
      if (peek.kind === "done") {
        this.#busy = false;
        this.#onFolded(peek.record);
        return;
      }
      const pending = peek.choice;
      if (!continuesGroup(group, pending)) {
        // This group is fully resolved; the engine has moved on to a different instruction.
        this.#group = startAftermathGroup(pending, this.#seats, this.#optionOf);
        this.#busy = false;
        this.#phase = "group";
        this.#draw();
        return;
      }
      const seatNumber = pending.seatNumber ?? group.currentSeatNumber;
      const answer = answerForPending(group, pending);
      if (!offersAnswer(pending, answer)) {
        // Our local guess no longer matches what the engine actually offers this seat — reset to the real prompt
        // rather than send something it never presented.
        this.#group = startAftermathGroup(pending, this.#seats, this.#optionOf);
        this.#busy = false;
        this.#draw();
        return;
      }
      this.#answers = [...this.#answers, answer];
      group = advanceAftermathGroup(group, seatNumber, pending) ?? group;
      this.#group = group;
      if (!readyToCommit(group) || group.confirmedSeatNumbers.length === group.seatOrder.length) break;
    }
    this.#busy = false;
    await this.#advance();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height, phone } = campaignFrame(this);
    this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);
    if (this.#phase === "loading") return;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    if (this.#phase === "error") {
      label(this, 24, 24, this.#errorText, typeRole.body, surface.paper.hex, 1);
      this.#route = this.#route ?? new FocusRoute(this);
      this.#route.set(order, stops);
      return;
    }

    const record = this.#record;
    const nodeId = this.#nodeId;
    if (!record || !nodeId) return;
    const service = campaignService();
    const definition = service.definitionFor(record);
    const nodeIds = definition.graph.nodes.map((node) => node.id);
    const number = issueNumberOf(nodeIds, nodeId);
    const story = issueStoryFor(record.campaignId as string, nodeId);
    const loggedTag =
      this.#phase === "summary" ? aftermathStamp(record, nodeId, (id) => issueNumberOf(nodeIds, id)).loggedTag : null;

    if (phone) this.#drawPhone(width, height, number, story, nodeId, loggedTag, order, stops);
    else this.#drawWide(width, height, number, story, nodeId, loggedTag, order, stops);

    this.#route = this.#route ?? new FocusRoute(this);
    this.#route.set(order, stops);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------------------------------------------

  #drawWide(
    width: number,
    height: number,
    number: number,
    story: IssueStory | null,
    nodeId: string,
    loggedTag: string | null,
    order: string[],
    stops: Map<string, FocusStop>,
  ): void {
    const leftWidth = Math.round(Math.min(645, width * 0.448));
    const g = this.add.graphics();
    g.lineStyle(1, surface.paper.hex, 0.15);
    for (let y = 0; y < height; y += 12) g.lineBetween(leftWidth, y, leftWidth, Math.min(y + 6, height));

    this.#drawLeftPanel({ x: 0, y: 0, width: leftWidth, height }, number, story, nodeId);

    const actionBarHeight = 88;
    const rightRect: Rect = { x: leftWidth, y: 0, width: width - leftWidth, height: height - actionBarHeight };
    if (this.#phase === "summary") this.#drawSummary(rightRect, order, stops, false);
    else this.#drawColumns(rightRect, order, stops, false);

    this.#drawActionBar(
      { x: leftWidth, y: height - actionBarHeight, width: width - leftWidth, height: actionBarHeight },
      false,
      order,
      stops,
    );
    this.#drawStamp(16, 16, number, loggedTag);
  }

  #drawPhone(
    width: number,
    height: number,
    number: number,
    story: IssueStory | null,
    nodeId: string,
    loggedTag: string | null,
    order: string[],
    stops: Map<string, FocusStop>,
  ): void {
    const actionBarHeight = 72;
    let y = 16;
    this.#drawStamp(16, y, number, loggedTag);
    y += 46;
    if (story?.aftermathArt || story?.villain) {
      const artRect: Rect = { x: 0, y, width, height: 110 };
      this.#drawArt(story, nodeId, artRect);
      y += 110 + 10;
    }
    if (story?.aftermath) {
      const speaker = speakerNameOf(story.aftermath);
      const { rect } = speechBubble(this, 16, y, width - 32, story.aftermath.text, {
        ...(speaker ? { speaker } : {}),
        tail: "bottom",
        shadow: accent.heroRed.hex,
      });
      y = rect.y + rect.height + 14;
    }
    const listRect: Rect = { x: 0, y, width, height: Math.max(0, height - actionBarHeight - y) };
    if (this.#phase === "summary") this.#drawSummary(listRect, order, stops, true);
    else this.#drawColumns(listRect, order, stops, true);
    this.#drawActionBar({ x: 0, y: height - actionBarHeight, width, height: actionBarHeight }, true, order, stops);
  }

  #drawStamp(x: number, y: number, number: number, loggedTag: string | null): void {
    const { rect } = stamp(this, x, y, `Issue #${number} · Won`, { ground: signal.heal.hex });
    if (loggedTag) {
      stamp(this, rect.x + rect.width + 10, y - 2, loggedTag, {
        ground: surface.void.hex,
        color: surface.paper.hex,
        outline: surface.paper.hex,
        size: 14,
      });
    }
  }

  #drawLeftPanel(rect: Rect, number: number, story: IssueStory | null, nodeId: string): void {
    if (!story) return;
    const artRect: Rect = { x: rect.x, y: rect.y + 70, width: rect.width, height: rect.height - 70 - 140 };
    this.#drawArt(story, nodeId, artRect);
    if (story.aftermath) {
      const bubbleWidth = Math.min(420, rect.width - 32);
      const speaker = speakerNameOf(story.aftermath);
      speechBubble(this, rect.x + 16, rect.y + rect.height - 140, bubbleWidth, story.aftermath.text, {
        ...(speaker ? { speaker } : {}),
        tail: "bottom",
        shadow: accent.heroRed.hex,
      });
    }
    void number;
  }

  #drawArt(story: IssueStory, nodeId: string, rect: Rect): void {
    const art = story.aftermathArt;
    if (art?.kind === "note") {
      artNote(this, rect, art.text, true);
      return;
    }
    if (art?.kind === "artboard") {
      const campaignId = this.#record?.campaignId ?? "";
      const image = drawPicture(this, artboardPicture(campaignId, art.name), rect, () => this.#draw(), { focusY: 0.4 });
      if (!image) artNote(this, rect, art.text, true);
      return;
    }
    const picture = villainPicture(nodeId);
    const image = drawPicture(this, picture, rect, () => this.#draw(), { focusY: 0.25 });
    if (!image) artNote(this, rect, `Panel art: ${story.villain}`, true);
  }

  /**
   * The summary phase's content area: the last committed group's columns, still showing every hero's confirmed
   * pick (YOURS / WITH …) exactly as the tile keeps them — never cleared. A win with no pending choice at all
   * (MC10 has none, but the vocabulary allows one) has no group to show, so this falls back to a short line. The
   * CTA itself lives in the action bar (`#drawActionBar`), the same place the commit CTA does.
   */
  #drawSummary(rect: Rect, order: string[], stops: Map<string, FocusStop>, phone: boolean): void {
    if (this.#group) {
      this.#drawColumns(rect, order, stops, phone);
      return;
    }
    const pad = phone ? 16 : 24;
    label(
      this,
      rect.x + pad,
      rect.y + pad,
      "Nothing else to hand out this issue.",
      typeRole.body,
      surface.paper.hex,
      1,
    );
  }

  /** "On to issue #N ▸" (or the Dossier, past the last issue) — the destination for the summary phase's CTA. */
  #nextLabel(): string {
    const record = this.#record;
    const nodeIds = record
      ? campaignService()
          .definitionFor(record)
          .graph.nodes.map((n) => n.id)
      : [];
    const currentIndex = record && this.#nodeId ? nodeIds.indexOf(this.#nodeId) : -1;
    return `On to issue #${currentIndex + 2} ▸`;
  }

  #leaveToNext(): void {
    const record = this.#record;
    if (!record) return;
    goToScreen(this, SCENES.campaignOpener, { runId: record.id });
  }

  #drawColumns(rect: Rect, order: string[], stops: Map<string, FocusStop>, phone: boolean): void {
    const group = this.#group;
    const record = this.#record;
    if (!group || !record) return;
    const columns = aftermathColumns(
      group,
      (seatNumber) => this.#seats.find((s) => s.seatNumber === seatNumber)?.heroName ?? `Seat ${seatNumber}`,
    );
    const pad = phone ? 16 : 24;
    const inner: Rect = {
      x: rect.x + pad,
      y: rect.y + pad,
      width: rect.width - pad * 2,
      height: rect.height - pad * 2,
    };
    if (phone) {
      let y = inner.y;
      for (const column of columns) {
        y = this.#drawColumn(column, { x: inner.x, y, width: inner.width, height: 0 }, order, stops, phone);
        y += 22;
      }
    } else {
      const gap = 24;
      const colWidth = (inner.width - gap * (columns.length - 1)) / Math.max(1, columns.length);
      columns.forEach((column, index) => {
        this.#drawColumn(
          column,
          { x: inner.x + index * (colWidth + gap), y: inner.y, width: colWidth, height: 0 },
          order,
          stops,
          phone,
        );
      });
    }
  }

  /** Draws one seat's heading + option rows; returns the y just past the last row drawn (used by the phone stack). */
  #drawColumn(
    column: AftermathColumn,
    rect: Rect,
    order: string[],
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): number {
    const header = this.add
      .text(
        rect.x,
        rect.y,
        column.heroName.toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: phone ? 18 : 22 }, surface.paper.hex),
      )
      .setOrigin(0, 0);
    const statusText = column.optional ? "Choose one, or stay as you are." : "Takes one";
    this.add
      .text(
        rect.x + header.width + 10,
        rect.y + header.height - 16,
        statusText.toUpperCase(),
        textStyle(typeRole.label, surface.paper.hex, ink.meta),
      )
      .setOrigin(0, 0)
      .setFontSize(11);
    let y = rect.y + header.height + 8;
    const rowHeight = phone ? 46 : 56;
    for (const row of column.rows) {
      y = this.#drawOptionRow(row, column, { x: rect.x, y, width: rect.width, height: rowHeight }, order, stops);
      y += 8;
    }
    if (column.optional) {
      const declineRect: Rect = { x: rect.x, y, width: rect.width, height: rowHeight };
      const editable = column.status !== "confirmed";
      const g = this.add.graphics();
      g.lineStyle(2, surface.paper.hex, 0.35);
      this.#dashed(g, declineRect);
      this.add
        .text(declineRect.x + declineRect.width / 2, declineRect.y + declineRect.height / 2, "No mark for me", {
          ...textStyle(typeRole.label, surface.paper.hex, column.decision.kind === "declined" ? ink.body : ink.meta),
          fontStyle: "italic 800",
        })
        .setOrigin(0.5)
        .setFontSize(12);
      if (editable) {
        const key = `decline:${column.seatNumber}`;
        const zone = this.add
          .zone(declineRect.x, declineRect.y, declineRect.width, declineRect.height)
          .setOrigin(0, 0)
          .setInteractive();
        zone.on("pointerup", () => this.#pick(column.seatNumber, null));
        order.push(key);
        stops.set(key, { rect: declineRect, activate: () => this.#pick(column.seatNumber, null) });
      }
      y += rowHeight + 8;
    }
    return y;
  }

  #drawOptionRow(
    row: AftermathColumn["rows"][number],
    column: AftermathColumn,
    rect: Rect,
    order: string[],
    stops: Map<string, FocusStop>,
  ): number {
    const g = this.add.graphics();
    const taken = row.takenByHeroName !== null;
    const editable = column.status !== "confirmed" && !taken;
    g.fillStyle(surface.void.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(
      row.selected ? 2.5 : 1.5,
      row.selected ? signal.caution.hex : surface.paper.hex,
      row.selected ? 1 : 0.3,
    );
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    const nameAlpha = taken ? ink.disabled : ink.body;
    this.add
      .text(
        rect.x + 14,
        rect.y + 8,
        row.option.name.toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: 16 }, surface.paper.hex, nameAlpha),
      )
      .setOrigin(0, 0);
    if (row.option.effect) {
      fitText(
        this.add
          .text(
            rect.x + 14,
            rect.y + rect.height - 22,
            row.option.effect,
            textStyle(typeRole.body, surface.paper.hex, nameAlpha * 0.85),
          )
          .setFontSize(12),
        rect.width - 28,
        12,
      );
    }
    if (row.selected) {
      const { rect: tagRect } = stamp(this, rect.x + rect.width - 62, rect.y - 12, "Yours", {
        ground: signal.caution.hex,
        color: surface.ink.hex,
        size: 11,
        outline: surface.ink.hex,
      });
      void tagRect;
    } else if (taken) {
      this.add
        .text(
          rect.x + rect.width - 10,
          rect.y + 10,
          `With ${row.takenByHeroName}`.toUpperCase(),
          textStyle(typeRole.label, surface.paper.hex, ink.meta),
        )
        .setOrigin(1, 0)
        .setFontSize(10);
    }
    if (editable) {
      const key = `pick:${column.seatNumber}:${row.option.cardId as string}`;
      const zone = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();
      zone.on("pointerup", () => this.#pick(column.seatNumber, row.option.cardId));
      order.push(key);
      stops.set(key, { rect, activate: () => this.#pick(column.seatNumber, row.option.cardId) });
    }
    return rect.y + rect.height;
  }

  #pick(seatNumber: number, cardId: CardId | null): void {
    if (!this.#group || this.#busy) return;
    this.#group = decideForSeat(
      this.#group,
      seatNumber,
      cardId === null ? { kind: "declined" } : { kind: "picked", cardId },
    );
    this.#draw();
  }

  /** The bar's CTA rect: right-aligned 425px on wide, full width (minus the thumb gutter) on phone. */
  #ctaRect(rect: Rect, phone: boolean): Rect {
    const width = phone ? rect.width - 24 : Math.min(425, rect.width - 32);
    return {
      x: phone ? rect.x + 12 : rect.x + rect.width - 16 - width,
      y: rect.y + (rect.height - 52) / 2,
      width,
      height: 52,
    };
  }

  #drawActionBar(rect: Rect, phone: boolean, order: string[], stops: Map<string, FocusStop>): void {
    this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
    this.add.rectangle(rect.x, rect.y, rect.width, 1, surface.paper.hex, 0.3).setOrigin(0, 0);
    if (this.#phase === "summary") {
      // Every seat has already been confirmed (or there was nothing to ask) — the same bar, now the forward CTA.
      const ctaRect = this.#ctaRect(rect, phone);
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: this.#nextLabel(),
          type: typeRole.barTitle,
          rect: ctaRect,
          onClick: () => this.#leaveToNext(),
        }),
      );
      order.push("next-issue");
      stops.set("next-issue", { rect: ctaRect, activate: () => this.#leaveToNext() });
      return;
    }
    const group = this.#group;
    const ready = group !== null && readyToCommit(group);
    const noteWidth = phone ? 0 : Math.max(0, rect.width - 425 - 48);
    if (!phone && group) {
      const note = "One of each exists. Single-use; spending one strikes it from the campaign.";
      this.add
        .text(rect.x + 16, rect.y + rect.height / 2, note, textStyle(typeRole.body, surface.paper.hex, ink.meta))
        .setOrigin(0, 0.5)
        .setFontSize(12)
        .setWordWrapWidth(noteWidth);
    }
    const ctaRect = this.#ctaRect(rect, phone);
    const label_ = group?.optional && !ready ? "Each hero decides" : "Each hero takes one";
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: label_,
        type: typeRole.barTitle,
        rect: ctaRect,
        onClick: () => void this.#commit(),
        enabled: ready && !this.#busy,
        ...(ready ? {} : { reason: "every seat needs a pick first" }),
      }),
    );
    order.push("commit");
    stops.set("commit", { rect: ctaRect, activate: () => (ready ? void this.#commit() : undefined) });
  }

  #dashed(g: Phaser.GameObjects.Graphics, rect: Rect): void {
    const step = 9;
    for (let x = rect.x; x < rect.x + rect.width; x += step * 2) {
      g.lineBetween(x, rect.y, Math.min(x + step, rect.x + rect.width), rect.y);
      g.lineBetween(x, rect.y + rect.height, Math.min(x + step, rect.x + rect.width), rect.y + rect.height);
    }
    for (let y = rect.y; y < rect.y + rect.height; y += step * 2) {
      g.lineBetween(rect.x, y, rect.x, Math.min(y + step, rect.y + rect.height));
      g.lineBetween(rect.x + rect.width, y, rect.x + rect.width, Math.min(y + step, rect.y + rect.height));
    }
  }
}
