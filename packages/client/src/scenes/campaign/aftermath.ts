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
import type { CardId, CoreAspect } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignDefinition } from "@mc/engine";
import Phaser from "phaser";
import { issueNumberOf, issueStoryFor, storyFor, type IssueStory } from "../../campaign/story.js";
import { CARDS_BY_ID } from "../../content/pool.js";
import { cardDisplayName } from "../../view/hero-names.js";

const heroNameOfCard = (id: string): string | undefined => {
  const card = CARDS_BY_ID.get(id);
  return card ? cardDisplayName(card) : undefined;
};
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import type { SavedGame } from "../../engine/host.js";
import { appSession, campaignService } from "../../session.js";
import { artFor } from "../../art/art-source.js";
import { cardArt, drawArt } from "../../art/card-art.js";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { McVirtualList, type VirtualListRow } from "../../ui/virtual-list.js";
import { ListScroll } from "../../view/list-scroll.js";
import { poolCellRect, poolColumnAt, poolGridGeometry } from "../../view/deck-pool-grid.js";
import {
  collectionPickerAspects,
  collectionPickerRows,
  filterCollectionPicker,
  type CollectionPickerRow,
} from "../../view/campaign-collection-picker-model.js";
import {
  artNote,
  artboardPicture,
  campaignFrame,
  drawPicture,
  speechBubble,
  stamp,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import {
  CinematicDriver,
  drawComicReaderStep,
  SpotlightAutoPan,
  type CinematicOptions,
} from "../../ui/comic-reader.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McButton, McTextInput, fitText, fitWrapped, label } from "../../ui/widgets.js";
import {
  advanceAftermathGroup,
  aftermathColumns,
  aftermathLogTags,
  aftermathOptionOf,
  aftermathStamp,
  answerFor,
  answerForPending,
  continuesGroup,
  decideForSeat,
  nextIssueRaisesMarket,
  offersAnswer,
  postFoldDestination,
  readyToCommit,
  startAftermathGroup,
  type AftermathChoiceGroup,
  type AftermathColumn,
  type AftermathSeat,
  type AftermathSeatDecision,
} from "../../view/campaign-aftermath-model.js";
import { removalStagingFieldIds } from "../../view/campaign-log-deltas.js";
import {
  comicReaderViewOf,
  nextComicBeat,
  prevComicBeat,
  resolveComicBeats,
  type ResolvedComicBeat,
} from "../../view/comic-reader-model.js";
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
  /** Set only once the fold reaches "summary" for a page-based box's issue that names `aftermathBeats` — see the
   * class doc comment's page-based section. Empty keeps the plain single-picture summary (MC10) untouched. */
  #comicSteps: readonly ResolvedComicBeat[] = [];
  #comicCurrent = 0;
  /** The spotlight (unlettered) reader's own within-beat pan — see `ui/comic-reader.ts`'s `SpotlightAutoPan`. */
  #spotPan: SpotlightAutoPan | null = null;
  /** The cinematic camera every box's own reader now draws through — see `ui/comic-reader.ts`'s `CinematicDriver`. */
  #cinematic = new CinematicDriver(() => this.#draw());
  /** MC27 p. 22's node 9 collection picker (`group.slot === "aspectAdvantage"`) — search text, aspect chip, list
   * scroll position and the search field itself, all kept across rebuilds the same way Decks' own pool browser
   * keeps its own (`scenes/decks.ts`'s `#poolFilterInput`/`#poolListScroll`). Reset whenever a fresh group starts
   * (`#advance`/`#commit`), so a stale filter from a previous seat's turn doesn't carry over to the next one. */
  #pickerSearchText = "";
  #pickerAspectFilter: CoreAspect | "basic" | "identity" | null = null;
  #pickerListScroll = new ListScroll();
  #pickerList: McVirtualList | null = null;
  #pickerSearchInput: McTextInput | null = null;

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
    this.#comicSteps = [];
    this.#comicCurrent = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#draw, this));
    // Every card scan drawn here (`#drawCollectionPicker`, `#drawOptionRow`) is requested from a synchronous
    // `#draw()`, so the first pass usually finds the texture not loaded yet and falls back to the empty frame —
    // this scene never redrew once the scan actually arrived, unlike every other screen that draws card art
    // (`scenes/setup-deal.ts`'s own `this.#art.onArrived(...)`, this module's own precedent to follow).
    const artUnsubscribe = cardArt(this).onArrived(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => artUnsubscribe());
    this.#spotPan = new SpotlightAutoPan(this, () => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#spotPan?.destroy());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#cinematic.destroy());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#pickerSearchInput?.destroy();
      this.#pickerSearchInput = null;
      this.#pickerList?.destroy();
      this.#pickerList = null;
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
      heroName: heroNameOfCard(seat.identityCardId as string) ?? `Seat ${seat.seatNumber}`,
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

  /** `startAftermathGroup`, plus resetting the collection picker's own search/filter — a fresh group (a new
   * choice, or the next seat's turn on the same one) starts with no stale filter carried over from before. */
  #startGroup(pending: Parameters<typeof startAftermathGroup>[0]): AftermathChoiceGroup {
    this.#pickerSearchText = "";
    this.#pickerAspectFilter = null;
    this.#pickerListScroll = new ListScroll();
    return startAftermathGroup(pending, this.#seats, this.#optionOf);
  }

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
      this.#group = advanceAftermathGroup(this.#group, lastConfirmed, pending, this.#optionOf) ?? this.#group;
    } else {
      this.#group = this.#startGroup(pending);
    }
    this.#phase = "group";
    this.#draw();
  }

  #onFolded(record: CampaignRecord): void {
    this.#record = record;
    const destination = postFoldDestination(record.status);
    if (destination === "finale") {
      goToScreen(this, SCENES.campaignFinale, { runId: record.id });
      return;
    }
    if (destination === "campaignLost" && this.#nodeId) {
      // A win that still loses the campaign (MC45 p. 20): the Rewind screen's campaign-lost variant, no retry offered.
      goToScreen(this, SCENES.campaignRewind, { runId: record.id, nodeId: this.#nodeId });
      return;
    }
    // `this.#group` is left as-is on purpose: by the time a commit loop reaches "done", every seat in it is
    // already confirmed (`AftermathColumn.status === "confirmed"`), which is exactly what the summary phase shows
    // — the tile keeps each hero's pick on screen (YOURS / WITH …), it doesn't clear the columns. A win with no
    // pending choice at all (MC10 has none, but a future box might) leaves `#group` null, which the summary phase
    // reads as "nothing to hand out this issue".
    const nodeId = this.#nodeId;
    const pages = storyFor(record.campaignId as string)?.pages;
    const story = nodeId ? issueStoryFor(record.campaignId as string, nodeId) : null;
    this.#comicSteps = story?.aftermathBeats && pages ? resolveComicBeats(pages, story.aftermathBeats) : [];
    this.#comicCurrent = 0;
    this.#cinematic.reset();
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
        this.#group = this.#startGroup(pending);
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
        this.#group = this.#startGroup(pending);
        this.#busy = false;
        this.#draw();
        return;
      }
      this.#answers = [...this.#answers, answer];
      group = advanceAftermathGroup(group, seatNumber, pending, this.#optionOf) ?? group;
      this.#group = group;
      if (!readyToCommit(group) || group.confirmedSeatNumbers.length === group.seatOrder.length) break;
    }
    this.#busy = false;
    await this.#advance();
  }

  /**
   * `AftermathChoiceGroup.dealtPerSeat`'s own confirm CTA: sends exactly the current seat's already-decided answer,
   * one real `fold` call. Never `#commit`'s peek-ahead loop — a future seat's dealt cards don't exist until the
   * engine actually reaches that seat, so pre-answering it (even with an "empty, declined" guess) would send a
   * real answer for a choice the player was never shown.
   */
  async #confirmDealtSeat(): Promise<void> {
    const group = this.#group;
    const record = this.#record;
    const saved = this.#saved;
    if (!group || !record || !saved || this.#busy) return;
    const seatNumber = group.currentSeatNumber;
    if (group.decisions[seatNumber]?.kind === "undecided") return;
    const answer = answerFor(group, seatNumber);
    this.#busy = true;
    this.#draw();
    const service = campaignService();
    const answers = [...this.#answers, answer];
    const result = await service.fold(record, saved, answers, this.#gameId);
    if (!this.sys.isActive()) return;
    this.#busy = false;
    this.#answers = answers;
    if (result.kind === "done") {
      this.#onFolded(result.record);
      return;
    }
    const pending = result.choice;
    if (continuesGroup(group, pending)) {
      this.#group = advanceAftermathGroup(group, seatNumber, pending, this.#optionOf) ?? group;
    } else {
      this.#group = this.#startGroup(pending);
      this.#phase = "group";
    }
    // A fresh turn either way (the next seat's own real prompt, or a brand-new choice): the picker's own filter
    // shouldn't carry over from whatever the last seat happened to be searching for.
    this.#pickerSearchText = "";
    this.#pickerAspectFilter = null;
    this.#pickerListScroll.reset();
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#pickerList?.destroy();
    this.#pickerList = null;
    // The picker's own search field persists across a rebuild (keeps DOM focus/keystrokes — `McTextInput`'s own
    // convention, `scenes/deck-builder.ts`'s `#filterInput`), so it's spared from the sweep below and reparented
    // back on top afterward.
    const kept = this.#pickerSearchInput ? [this.#pickerSearchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
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

    if (this.#phase === "summary" && this.#comicSteps.length > 0) {
      this.#drawComicAftermath(record, definition, nodeId, number, width, height, phone, order, stops);
      this.#route = this.#route ?? new FocusRoute(this, { onCancel: () => this.#leaveToNext() });
      this.#route.set(order, stops);
      return;
    }

    const loggedTag =
      this.#phase === "summary" ? aftermathStamp(record, nodeId, (id) => issueNumberOf(nodeIds, id)).loggedTag : null;

    if (phone) this.#drawPhone(width, height, number, story, nodeId, loggedTag, order, stops);
    else this.#drawWide(width, height, number, story, nodeId, loggedTag, order, stops);

    this.#route = this.#route ?? new FocusRoute(this);
    this.#route.set(order, stops);
  }

  /** The comic-based summary phase (C05, page-based boxes): the aftermath's own guided read, the fold's real log
   * writes stacked as tags top-left, and a CTA that names the Market when the next issue's setup raises one. */
  #drawComicAftermath(
    record: CampaignRecord,
    definition: CampaignDefinition,
    nodeId: string,
    number: number,
    width: number,
    height: number,
    phone: boolean,
    order: string[],
    stops: Map<string, FocusStop>,
  ): void {
    const rosterIds = record.seats.map((seat) => seat.identityCardId);
    const view = comicReaderViewOf(this.#comicSteps, this.#comicCurrent, rosterIds);

    const headerPad = phone ? 16 : 24;
    label(this, headerPad, 14, `AFTER ISSUE #${number}`, typeRole.label, surface.paper.hex, ink.label);
    const title = this.add
      .text(
        headerPad,
        26,
        (issueStoryFor(record.campaignId as string, nodeId)?.villain ?? "").toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: phone ? 20 : 28 }, surface.paper.hex),
      )
      .setOrigin(0, 0);
    fitText(title, width - headerPad * 2, phone ? 20 : 28);
    const counter = this.add
      .text(
        width - headerPad,
        14,
        `${view.step.pageLabel} · ${view.step.beatLabel}`,
        textStyle(typeRole.label, surface.paper.hex, ink.secondary),
      )
      .setOrigin(1, 0)
      .setLetterSpacing(1);
    void counter;
    const headerBottom = Math.max(26 + title.height, 60) + 12;

    const actionBarHeight = phone ? 68 : 88;
    const dotsHeight = 22;
    const readingBottom = height - actionBarHeight - dotsHeight;
    const readingRect: Rect = { x: 0, y: headerBottom, width, height: Math.max(0, readingBottom - headerBottom) };
    const reducedMotion = appSession().settings.reducedMotion;
    const spotPan = this.#spotPan?.progressFor(
      view.step,
      { width: readingRect.width, height: readingRect.height },
      reducedMotion,
    );
    const cinematic: CinematicOptions = { driver: this.#cinematic, reducedMotion };
    drawComicReaderStep(
      this,
      readingRect,
      record.campaignId as string,
      view.step,
      () => this.#draw(),
      undefined,
      spotPan,
      cinematic,
    );

    // The fold's real log writes, stacked top-left over the art — never the tile's own hardcoded words. Nudged
    // below a beat's own caption box (`drawComicReaderStep` pins that to the same top-left corner) rather than
    // measuring it exactly: a caption is at most a couple of short lines, so a fixed clearance never has to be
    // pixel-perfect to stop the two stacks from overlapping.
    const definitionFields = definition.logFields;
    const tags = aftermathLogTags(record, nodeId, definitionFields, CARDS_BY_ID, removalStagingFieldIds(definition));
    let tagY = readingRect.y + 12 + (view.step.caption ? 66 : 0);
    const { rect: wonRect } = stamp(this, 12, tagY, `Issue #${number} · Won`, { ground: signal.caution.hex });
    tagY = wonRect.y + wonRect.height + 8;
    for (const tag of tags) {
      const { rect } = stamp(this, 12, tagY, tag.text, {
        ground: surface.void.hex,
        color: surface.paper.hex,
        outline: tag.kind === "each" ? signal.heal.hex : surface.paper.hex,
        size: 12,
      });
      tagY = rect.y + rect.height + 8;
    }

    this.#drawBeatDots(width, height - actionBarHeight - dotsHeight / 2);

    this.add.rectangle(0, height - actionBarHeight, width, actionBarHeight, surface.ink.hex).setOrigin(0, 0);
    const ctaPad = phone ? 12 : 16;
    const barY = height - actionBarHeight;
    const ctaHeight = 62;
    const ctaY = barY + (actionBarHeight - ctaHeight) / 2;
    const hasBack = !view.isFirst;
    const backWidth = hasBack ? (phone ? 64 : 110) : 0;
    const backGap = hasBack ? 10 : 0;
    const isLastBeat = view.isLast;
    const ctaLabel = isLastBeat
      ? nextIssueRaisesMarket(definition, nodeId)
        ? "TO THE MARKET ▸"
        : this.#nextLabel()
      : "NEXT ▸";
    const ctaRect: Rect = phone
      ? { x: ctaPad + backWidth + backGap, y: ctaY, width: width - ctaPad * 2 - backWidth - backGap, height: ctaHeight }
      : {
          x: width - ctaPad - Math.min(425, width - ctaPad * 2 - backWidth - backGap),
          y: ctaY,
          width: Math.min(425, width - ctaPad * 2 - backWidth - backGap),
          height: ctaHeight,
        };
    const onCta = (): void => {
      if (this.#cinematic.isSettling()) {
        this.#cinematic.skipAhead();
        this.#draw();
        return;
      }
      if (isLastBeat) this.#leaveToNext();
      else {
        this.#comicCurrent = nextComicBeat(this.#comicCurrent, this.#comicSteps.length);
        this.#draw();
      }
    };
    this.#buttons.push(
      new McButton(this, { kind: "primary", label: ctaLabel, type: typeRole.barTitle, rect: ctaRect, onClick: onCta }),
    );
    order.push("next");
    stops.set("next", { rect: ctaRect, activate: onCta });

    if (hasBack) {
      const backRect: Rect = { x: ctaPad, y: ctaY, width: backWidth, height: ctaHeight };
      const onBack = (): void => {
        if (this.#cinematic.isSettling()) {
          this.#cinematic.skipAhead();
          this.#draw();
          return;
        }
        this.#comicCurrent = prevComicBeat(this.#comicCurrent);
        this.#draw();
      };
      this.#buttons.push(
        new McButton(this, { kind: "onInk", label: "◂ BACK", type: typeRole.label, rect: backRect, onClick: onBack }),
      );
      order.push("back");
      stops.set("back", { rect: backRect, activate: onBack });
    }

    const tapZone = this.add
      .zone(0, 0, width, height - actionBarHeight)
      .setOrigin(0, 0)
      .setInteractive();
    tapZone.on("pointerup", onCta);
    this.children.sendToBack(tapZone);
  }

  /** The beat-progress dot row between the page and the action bar — current beat lit, the rest dim. */
  #drawBeatDots(width: number, y: number): void {
    const total = this.#comicSteps.length;
    if (total <= 1) return;
    const dotSize = 8;
    const gap = 10;
    const totalWidth = total * dotSize + (total - 1) * gap;
    let x = width / 2 - totalWidth / 2 + dotSize / 2;
    for (let index = 0; index < total; index += 1) {
      const active = index === this.#comicCurrent;
      this.add.circle(x, y, dotSize / 2, active ? accent.heroRed.hex : surface.paper.hex, active ? 1 : 0.3);
      x += dotSize + gap;
    }
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
      const image = drawPicture(this, artboardPicture(campaignId, art.name), rect, () => this.#draw(), {
        focusY: art.focusY ?? 0.4,
        ...(art.focusX === undefined ? {} : { focusX: art.focusX }),
      });
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
    if (group.collectionPick) {
      this.#drawCollectionPicker(group, rect, order, stops, phone);
      return;
    }
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

  /** "AGGRESSION" -> "AGG", the same short chip word the Decks & Collection pool filter already prints. */
  static readonly #ASPECT_CHIP_LABEL: Readonly<Record<string, string>> = {
    aggression: "AGG",
    justice: "JUS",
    leadership: "LEA",
    protection: "PRO",
    pool: "'POOL",
    basic: "BASIC",
    identity: "HERO",
  };

  /**
   * MC27 p. 22's node 9 ("add the maximum number of copies of any aspect card from your whole collection"): a
   * search box + aspect chips over a virtualized card-art grid (`view/deck-pool-grid.ts`, the same geometry Decks'
   * own pool browser uses), never the small per-row column `#drawColumn` draws for every other choice — the
   * engine's own `catalog` here can run into the hundreds of legal cards. Only the seat whose real turn it is gets
   * the picker; every other seat gets a one-line status (`#drawPickerSeatStatus`) — there's nothing to search for
   * a seat that isn't deciding right now.
   */
  #drawCollectionPicker(
    group: AftermathChoiceGroup,
    rect: Rect,
    order: string[],
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): void {
    const pad = phone ? 16 : 24;
    const inner: Rect = {
      x: rect.x + pad,
      y: rect.y + pad,
      width: rect.width - pad * 2,
      height: rect.height - pad * 2,
    };
    let y = inner.y;
    for (const seatNumber of group.seatOrder) y = this.#drawPickerSeatStatus(group, seatNumber, inner, y, phone);
    y += 10;

    const currentSeat = group.currentSeatNumber;
    if (group.confirmedSeatNumbers.includes(currentSeat)) return;

    const searchRect: Rect = { x: inner.x, y, width: Math.min(340, inner.width), height: 40 };
    if (this.#pickerSearchInput) {
      this.#pickerSearchInput.layout(searchRect);
      // A fresh turn (`#confirmDealtSeat`) resets `#pickerSearchText` to "" without touching this persisted field
      // directly — keep the two in sync rather than leaving the last seat's typed text on screen.
      if (this.#pickerSearchInput.value !== this.#pickerSearchText) {
        this.#pickerSearchInput.setValue(this.#pickerSearchText);
      }
    } else {
      this.#pickerSearchInput = new McTextInput(this, {
        rect: searchRect,
        value: this.#pickerSearchText,
        type: typeRole.mono,
        placeholder: "Search your collection…",
        onChange: (value) => {
          this.#pickerSearchText = value;
          this.#pickerListScroll.reset();
          this.#draw();
        },
      });
    }
    order.push("picker-search");
    stops.set("picker-search", { rect: searchRect, activate: () => this.#pickerSearchInput?.focus() });
    y += 40 + 10;

    const rowsAll = collectionPickerRows(
      group.catalog.map((option) => option.cardId as string),
      CARDS_BY_ID,
    );
    const aspects = collectionPickerAspects(rowsAll);
    const chipHeight = 32;
    const chipGap = 6;
    const chipCount = aspects.length + 1; // "ALL" plus one per aspect actually offered.
    const naturalChipWidth = phone ? 62 : 78;
    // Shrink to fit rather than overflow the pane — a full aspect rail (7 chips) doesn't fit a phone column at
    // its natural width, and this filter rail is a convenience, never a scroll region of its own.
    const chipWidth = Math.min(naturalChipWidth, (inner.width - chipGap * (chipCount - 1)) / chipCount);
    const allSelected = this.#pickerAspectFilter === null;
    const setAspect = (aspect: CoreAspect | "basic" | "identity" | null): void => {
      this.#pickerAspectFilter = aspect;
      this.#pickerListScroll.reset();
      this.#draw();
    };
    let chipX = inner.x;
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "ALL",
        type: typeRole.label,
        rect: { x: chipX, y, width: chipWidth, height: chipHeight },
        selected: allSelected,
        onClick: () => setAspect(null),
      }),
    );
    stops.set("picker-aspect:all", {
      rect: { x: chipX, y, width: chipWidth, height: chipHeight },
      activate: () => setAspect(null),
    });
    order.push("picker-aspect:all");
    chipX += chipWidth + chipGap;
    for (const aspect of aspects) {
      const chipRect: Rect = { x: chipX, y, width: chipWidth, height: chipHeight };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: CampaignAftermathScene.#ASPECT_CHIP_LABEL[aspect] ?? aspect.toUpperCase(),
          type: typeRole.label,
          rect: chipRect,
          selected: this.#pickerAspectFilter === aspect,
          onClick: () => setAspect(aspect),
        }),
      );
      stops.set(`picker-aspect:${aspect}`, { rect: chipRect, activate: () => setAspect(aspect) });
      order.push(`picker-aspect:${aspect}`);
      chipX += chipWidth + chipGap;
    }
    y += chipHeight + 12;

    const filtered = filterCollectionPicker(rowsAll, {
      text: this.#pickerSearchText,
      aspect: this.#pickerAspectFilter,
    });
    if (filtered.length === 0) {
      label(this, inner.x, y, "No cards match this search.", typeRole.body, surface.paper.hex, 0.7);
      return;
    }

    const gridRect: Rect = { x: inner.x, y, width: inner.width, height: Math.max(1, inner.y + inner.height - y) };
    const geometry = poolGridGeometry(gridRect.width, filtered.length, !phone);
    const decision = group.decisions[currentSeat];
    const renderRow = (rowIndex: number, rowRect: Rect): VirtualListRow =>
      this.#renderPickerRow(rowRect, geometry, filtered, rowIndex, decision);
    const onRowActivate = (rowIndex: number, pointer: Phaser.Input.Pointer): void => {
      const list = this.#pickerList;
      if (!list) return;
      const startIndex = rowIndex * geometry.columns;
      const countInRow = Math.min(geometry.columns, filtered.length - startIndex);
      const col = poolColumnAt(geometry, list.rectFor(rowIndex), pointer.x, countInRow);
      if (col === null) return;
      const row = filtered[startIndex + col];
      if (row) this.#pick(currentSeat, row.cardId);
    };
    this.#pickerList = new McVirtualList(this, {
      rect: gridRect,
      rowHeight: geometry.cellHeight,
      count: geometry.rows,
      renderRow,
      scroll: this.#pickerListScroll,
      onRowActivate,
      background: false,
    });
    const list = this.#pickerList;
    filtered.forEach((row, index) => {
      const rowIndex = Math.floor(index / geometry.columns);
      const col = index % geometry.columns;
      const key = `picker-card:${row.cardId as string}`;
      stops.set(key, {
        rect: () => poolCellRect(geometry, list.rectFor(rowIndex), col),
        activate: () => this.#pick(currentSeat, row.cardId),
        ensureVisible: () => list.scrollIntoView(rowIndex),
      });
      order.push(key);
    });
  }

  /** One seat's status line above the picker: whose turn it is, and what a confirmed seat already took. Returns
   * the y just past this line. */
  #drawPickerSeatStatus(
    group: AftermathChoiceGroup,
    seatNumber: number,
    inner: Rect,
    y: number,
    phone: boolean,
  ): number {
    const heroName = this.#seats.find((seat) => seat.seatNumber === seatNumber)?.heroName ?? `Seat ${seatNumber}`;
    const confirmed = group.confirmedSeatNumbers.includes(seatNumber);
    const isCurrent = !confirmed && seatNumber === group.currentSeatNumber;
    const decision = group.decisions[seatNumber];
    const pickedName =
      decision?.kind === "picked" ? (CARDS_BY_ID.get(decision.cardId as string)?.name ?? decision.cardId) : null;
    const statusText = confirmed
      ? `${heroName}: ${pickedName ?? "—"} (confirmed)`
      : isCurrent
        ? phone
          ? `${heroName}: choosing now`
          : `${heroName}: choosing now — search your whole collection below`
        : `${heroName}: waiting`;
    label(
      this,
      inner.x,
      y,
      statusText.toUpperCase(),
      typeRole.label,
      surface.paper.hex,
      isCurrent ? 1 : confirmed ? 0.85 : 0.5,
    );
    return y + 22;
  }

  /** One row of the picker's card grid — art + name, a highlight ring on the current seat's own selection. */
  #renderPickerRow(
    rowRect: Rect,
    geometry: ReturnType<typeof poolGridGeometry>,
    rows: readonly CollectionPickerRow[],
    rowIndex: number,
    decision: AftermathSeatDecision | undefined,
  ): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const startIndex = rowIndex * geometry.columns;
    const countInRow = Math.min(geometry.columns, rows.length - startIndex);
    for (let col = 0; col < countInRow; col++) {
      const row = rows[startIndex + col]!;
      const cellRect = poolCellRect(geometry, rowRect, col);
      const cardRect: Rect = {
        x: cellRect.x + 4,
        y: cellRect.y + 2,
        width: cellRect.width - 8,
        height: cellRect.height - 4,
      };
      const selected = decision?.kind === "picked" && decision.cardId === row.cardId;
      const g = this.add.graphics();
      g.fillStyle(surface.void.hex, 1).fillRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);
      g.lineStyle(selected ? 2.5 : 1, selected ? signal.caution.hex : surface.paper.hex, selected ? 1 : 0.25);
      g.strokeRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height);
      objects.push(g);

      const artRect: Rect = {
        x: cardRect.x + 2,
        y: cardRect.y + 2,
        width: cardRect.width - 4,
        height: cardRect.height - geometry.captionHeight - 4,
      };
      const card = CARDS_BY_ID.get(row.cardId as string);
      const artKey = cardArt(this).request(this, artFor(card, { kind: "front" }));
      const art = drawArt(this, artKey, artRect);
      if (art) objects.push(art);

      const nameText = this.add
        .text(
          cardRect.x + cardRect.width / 2,
          cardRect.y + cardRect.height - geometry.captionHeight / 2,
          row.name,
          textStyle(typeRole.label, surface.paper.hex, selected ? 1 : 0.85),
        )
        .setOrigin(0.5)
        .setFontSize(11)
        .setWordWrapWidth(cardRect.width - 8, true);
      objects.push(nameText);
    }
    return { objects };
  }

  /** Draws one seat's heading + option rows; returns the y just past the last row drawn (used by the phone stack). */
  #drawColumn(
    column: AftermathColumn,
    rect: Rect,
    order: string[],
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): number {
    const headerSize = phone ? 18 : 22;
    const header = this.add
      .text(
        rect.x,
        rect.y,
        column.heroName.toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: headerSize }, surface.paper.hex),
      )
      .setOrigin(0, 0);
    // On its own line, wrapped to the column's own width — sitting beside the name (as this used to) had nothing
    // to stop a long name/status pair from running past this column's own width into the next seat's header.
    fitText(header, rect.width, headerSize);
    const statusText = column.heading;
    const status = this.add
      .text(
        rect.x,
        rect.y + header.height + 2,
        statusText.toUpperCase(),
        textStyle(typeRole.label, surface.paper.hex, ink.meta),
      )
      .setOrigin(0, 0)
      .setFontSize(11)
      .setWordWrapWidth(rect.width);
    let y = rect.y + header.height + status.height + 8;
    const rowHeight = phone ? 64 : 76;
    if (column.awaitingOffer && column.status !== "confirmed") {
      // A dealt-per-seat choice (S.H.I.E.L.D. Tech, MC27 p. 22): this seat's own 3 cards are only dealt once the
      // engine actually reaches its turn — showing nothing here (rather than a guess at another seat's cards) is
      // the honest state until then.
      this.add
        .text(rect.x, y, column.waiting.toUpperCase(), textStyle(typeRole.label, surface.paper.hex, ink.meta))
        .setOrigin(0, 0)
        .setFontSize(12);
      return y + 24;
    }
    for (const row of column.rows) {
      y = this.#drawOptionRow(row, column, { x: rect.x, y, width: rect.width, height: rowHeight }, order, stops);
      y += 8;
    }
    if (column.nothingToPick && column.status !== "confirmed") {
      // Settled by the model (an empty offer): say so, no row to press, nothing to wait for.
      return y;
    }
    if (column.optional) {
      const declineRect: Rect = { x: rect.x, y, width: rect.width, height: rowHeight };
      const editable = column.status !== "confirmed";
      const g = this.add.graphics();
      g.lineStyle(2, surface.paper.hex, 0.35);
      this.#dashed(g, declineRect);
      this.add
        .text(declineRect.x + declineRect.width / 2, declineRect.y + declineRect.height / 2, column.declineLabel, {
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

    // A real card scan (or its generated frame's own fallback, per `art/card-art.ts` — a missing scan never blocks
    // this row) so the pick reads as "here is the actual card", not just its printed name.
    const artPad = 6;
    const artHeight = rect.height - artPad * 2;
    const artWidth = artHeight * (2.5 / 3.5);
    const artRect: Rect = { x: rect.x + artPad, y: rect.y + artPad, width: artWidth, height: artHeight };
    const card = CARDS_BY_ID.get(row.option.cardId as string);
    const artKey = cardArt(this).request(this, artFor(card, { kind: "front" }));
    const art = drawArt(this, artKey, artRect);
    if (art) {
      art.setAlpha(taken ? 0.6 : 1);
    } else {
      const artFrame = this.add.graphics();
      artFrame.lineStyle(1, surface.paper.hex, 0.25).strokeRect(artRect.x, artRect.y, artRect.width, artRect.height);
    }
    const textX = artRect.x + artRect.width + 12;
    const textWidth = rect.x + rect.width - textX - 14;
    fitText(
      this.add
        .text(
          textX,
          rect.y + 8,
          row.option.name.toUpperCase(),
          textStyle({ ...typeRole.barTitle, size: 16 }, surface.paper.hex, nameAlpha),
        )
        .setOrigin(0, 0),
      textWidth,
      16,
    );
    const effectLine =
      column.showCost && row.option.cost !== undefined
        ? `Cost ${row.option.cost} · ${row.option.effect}`
        : row.option.effect;
    if (effectLine) {
      // The effect wraps to two lines under the name (a card's own effect line is the reason to pick it); longer text
      // is on the card itself, one tap away.
      fitWrapped(
        this.add
          .text(textX, rect.y + 32, effectLine, textStyle(typeRole.body, surface.paper.hex, nameAlpha * 0.85))
          .setFontSize(12),
        textWidth,
        2,
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
    // Both a dealt-per-seat choice and the collection picker only ever let *one* seat interact at a time (the
    // picker only draws a search/grid for `currentSeatNumber` — see `#drawCollectionPicker`'s own doc comment), so
    // both use the same one-seat-at-a-time confirm CTA rather than the batch "decide everyone, then commit" flow
    // below (which would deadlock here: a seat can only decide once it's current, and it only becomes current
    // through a real `fold` call the batch flow refuses to make until every seat has already decided).
    const oneSeatAtATime = group?.dealtPerSeat || (group ? group.collectionPick : false);
    if (oneSeatAtATime && group) {
      const decision = group.decisions[group.currentSeatNumber];
      const decided = decision !== undefined && decision.kind !== "undecided";
      const noteWidth = phone ? 0 : Math.max(0, rect.width - 425 - 48);
      if (!phone) {
        const note =
          group.copy?.note ??
          (group.dealtPerSeat
            ? "Dealt at random, one player at a time. A kept card is yours for the rest of the campaign."
            : "One player at a time. A kept card is yours for the rest of the campaign.");
        this.add
          .text(rect.x + 16, rect.y + rect.height / 2, note, textStyle(typeRole.body, surface.paper.hex, ink.meta))
          .setOrigin(0, 0.5)
          .setFontSize(12)
          .setWordWrapWidth(noteWidth);
      }
      const ctaRect = this.#ctaRect(rect, phone);
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Confirm",
          type: typeRole.barTitle,
          rect: ctaRect,
          onClick: () => void this.#confirmDealtSeat(),
          enabled: decided && !this.#busy,
          ...(decided ? {} : { reason: group.optional ? "pick a card, or keep none, first" : "pick a card first" }),
        }),
      );
      order.push("commit");
      stops.set("commit", { rect: ctaRect, activate: () => (decided ? void this.#confirmDealtSeat() : undefined) });
      return;
    }
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
    const label_ = ready ? "Confirm picks" : group?.optional ? "Each hero decides" : "Each hero takes one";
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
