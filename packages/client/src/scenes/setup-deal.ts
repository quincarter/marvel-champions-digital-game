/**
 * Setup deal & mulligan (W3, docs/phase4-screen-gaps.md §3 — D06, P13, L05).
 *
 * Shown once, before round 1: `TableSetupScene`'s "Deal it out" starts the
 * engine and routes here, never straight to the Board. Everything on screen
 * is driven by the engine's own setup steps and events (`view/setup-
 * walkthrough.ts` — see its own header for the composition, the checklist
 * rule and why an accumulator is needed at all), not a scripted sequence.
 *
 * **The mulligan itself answers the same `PendingChoice` the generic sheet
 * does, with the same `resolveChoice` command.** `view/choice-focus.ts`'s
 * `canConfirmChoice`/`cardChoiceDisplayOrder`/`initialChoiceSelection` are
 * reused unchanged rather than restated, so the two presentations can never
 * disagree about what counts as a legal answer —
 * `view/setup-walkthrough-parity.test.ts` proves the resulting command log
 * is byte-identical either way.
 *
 * **A resumed game never reaches this scene.** `EngineSessionCore#resume`
 * replays straight past any setup steps a saved log already answered, so
 * `scenes/decks.ts`/Title's "Continue" always lands on the Board directly.
 * `scenes/board.ts` is unchanged: if a save is somehow resumed exactly mid-
 * mulligan (a player quit at that exact instant), the Board's own generic
 * `ChoiceOverlay` still answers it, precisely as it did before this scene
 * existed.
 *
 * **A pending choice that isn't the mulligan** (an interrupt during the
 * villain/scheme's own "Setup:" ability, an identity's own setup search) is
 * not this scene's to answer — it launches the ordinary `ChoiceOverlay` on
 * top, exactly the way `BoardScene#syncChoiceOverlay` does, so no rule is
 * restated for a decision this screen doesn't otherwise know about.
 *
 * **Fidelity pass (2026-09-18), against D06/P13/L05 directly rather than the
 * structure alone:** section headers ("YOUR OPENING HAND — <hero>", "OTHER
 * SEATS") are a Bangers line with a rule running to the column's own right
 * edge (`#sectionHeader`), not a small grey label. The header's title and its
 * "Step N of M · …" caption sit inline on one line, not a title clipped at
 * the viewport's top edge beside a small badge in the far corner. Checklist
 * chips are uppercase and letter-spaced with a real state matrix (`CHIP_SKIN`):
 * a green-outlined dark wash for done, solid Hero Red for the one in
 * progress, a dim outline for what's ahead. The commit row is two compact
 * controls — "Mulligan N"/"Keep all N" — beside the mulligan rule's own
 * helper text, not two parchment slabs spanning the column; a card marked for
 * mulligan gets a dim wash under its art plus the same red tag the tile's
 * "DOWNTIME" card shows. Other seats are a side-by-side row of compact cards
 * on tablet-portrait/desktop (a monogram square, name, status, and a row of
 * facedown hand slots — dashed red for however many were just redrawn),
 * stacked only on phone. The sidebar's "Setup card revealed" panel is paper
 * with a red label and a Bangers name, and collapses to one line before
 * anything has been revealed; "Setup log" is an ink panel with a light
 * outline and paper-toned lines, reusing none of `LogPanel`'s parchment rail
 * skin (built for the Board's own paper-toned frame, not this screen's ink
 * ground). Phone pins the commit row to the bottom of the viewport, like the
 * Board's action bar, with "Keep all" on the left and "Mulligan" on the right
 * (P13's own order — the opposite of D06's, which is followed everywhere
 * else); the per-seat paged carousel P13 draws is still out of scope.
 */

import Phaser from "phaser";
import type { InstanceId, PendingChoice } from "@mc/engine";
import { CARDS_BY_ID, POOL_DEPS } from "../content/pool.js";
import { accent, dotGrid, ink, signal, statHue, surface, typeRole, type TypeSpec } from "../tokens.js";
import { setMask } from "../ui/rex.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McSelectionRing, dashedRect, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { cardArt, drawArt, type CardArt } from "../art/card-art.js";
import { canConfirmChoice, cardChoiceDisplayOrder, initialChoiceSelection } from "../view/choice-focus.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import { stepFocus } from "../view/focus.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { HandScroll } from "../view/hand-scroll.js";
import type { Rect } from "../view/layout.js";
import { openingHandLayout, openingHandThumb } from "../view/opening-hand-layout.js";
import { setupMetrics } from "../view/setup-metrics.js";
import { setupWalkthroughFocusOrder } from "../view/screen-focus.js";
import {
  advanceSetupWalkthroughLog,
  emptySetupWalkthroughLog,
  setupWalkthroughViewOf,
  type SetupSeatStatus,
  type SetupWalkthroughLog,
  type SetupWalkthroughView,
} from "../view/setup-walkthrough.js";
import {
  CHECKLIST_HEIGHT,
  setupWalkthroughLayout,
  type SetupWalkthroughLayout,
} from "../view/setup-walkthrough-layout.js";
import type { LogLine } from "../view/log-lines.js";
import type { HandCardView } from "../view/board-model.js";
import type { SessionState } from "../store/session-store.js";
import { appSession } from "../session.js";
import { bindGamepad, bindKeyboard } from "./board/input.js";
import { addTapTarget } from "./board/tap-target.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";

/**
 * The checklist's state matrix (fidelity pass): a green-outlined dark wash for a done step ("done fill"/"done
 * stroke" sampled off D06's own chips — the stroke lands exactly on `signal.heal`), solid Hero Red for the one in
 * progress, a dim paper-on-ink outline for what's still ahead.
 */
const CHIP_SKIN: Readonly<
  Record<
    "done" | "current" | "pending",
    {
      readonly fill: number;
      readonly fillAlpha: number;
      readonly stroke: number;
      readonly strokeAlpha: number;
      readonly text: number;
      readonly textAlpha: number;
    }
  >
> = {
  done: {
    fill: 0x1c281c,
    fillAlpha: 1,
    stroke: signal.heal.hex,
    strokeAlpha: 1,
    text: surface.paper.hex,
    textAlpha: 1,
  },
  current: {
    fill: accent.heroRed.hex,
    fillAlpha: 1,
    stroke: accent.heroRed.hex,
    strokeAlpha: 1,
    text: surface.paper.hex,
    textAlpha: 1,
  },
  pending: {
    fill: surface.ink.hex,
    fillAlpha: 1,
    stroke: surface.paper.hex,
    strokeAlpha: 0.3,
    text: surface.paper.hex,
    textAlpha: ink.label,
  },
};
const CHIP_TYPE: TypeSpec = { ...typeRole.label, size: 10 };
/** Section headers ("YOUR OPENING HAND — <hero>", "OTHER SEATS", "SETUP LOG"): Bangers, then a rule to the column's own right edge. */
const SECTION_HEADER_TYPE: TypeSpec = typeRole.barTitle;
/** The header's inline step caption, beside the Bangers title. */
const STEP_CAPTION_TYPE: TypeSpec = {
  family: typeRole.body.family,
  size: 14,
  weight: 700,
  lineHeight: 1.3,
  letterSpacing: 0,
  uppercase: false,
};
/** A colour for a seat's monogram square, cycling by seat index. Never Hero Red: that's the screen's one action colour. */
const MONOGRAM_PALETTE: readonly number[] = [statHue.thw.hex, statHue.def.hex, statHue.sch.hex, statHue.rec.hex];
const OTHER_SEAT_SLOT_WIDTH = 16;
const OTHER_SEAT_SLOT_HEIGHT = 22;

/** "She-Hulk" → "SH", "Ms. Marvel" → "MM", "Captain Marvel" → "CM": first letter of each of the first two words, or the first two letters of one. */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
  return (
    name
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export class SetupDealScene extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #artUnsubscribe: (() => void) | null = null;
  #version = -1;
  #handedOff = false;
  #choiceOpen = false;
  #log: SetupWalkthroughLog = emptySetupWalkthroughLog();
  #view: SetupWalkthroughView | null = null;
  #selected: string[] = [];
  #choiceId: string | null = null;
  #buttons: McButton[] = [];
  /** Keyboard/pad focus: what is focused, not where — the rect is re-read each rebuild (`ChoiceOverlay`'s own convention). */
  #focus: string | null = null;
  #route: readonly string[] = [];
  #focusRects = new Map<string, Rect>();
  #focusRing: McSelectionRing | null = null;
  /**
   * The opening hand's sideways scroll, on a width where the cards would otherwise not read
   * (`view/opening-hand-layout.ts`). Every scrolled pixel redraws the scene, the way the Board's own tabbed hand
   * does (`scenes/board/hand.ts`): the gesture survives the redraw because `ui/hold-target.ts` keeps the press per
   * pointer, not per zone.
   */
  #hand = new HandScroll(() => this.#draw());
  /** The strip's clip shape — off the display list, so `children.removeAll` never reaches it and `#draw` destroys it by hand. */
  #stripMask: Phaser.GameObjects.Graphics | null = null;

  get #art(): CardArt {
    return cardArt(this);
  }

  constructor() {
    super(SCENES.setupDeal);
  }

  create(): void {
    this.#version = -1;
    this.#handedOff = false;
    this.#choiceOpen = false;
    this.#log = emptySetupWalkthroughLog();
    this.#selected = [];
    this.#choiceId = null;
    this.#focus = null;
    this.#hand = new HandScroll(() => this.#draw());
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    appSession().music?.playTitle();

    const { store } = appSession();
    this.#unsubscribe = store.subscribe((state) => this.#onState(state));
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#artUnsubscribe = this.#art.onArrived(() => this.#draw());

    const binding = {
      blocked: () => this.#choiceOpen || this.scene.isActive(SCENES.inspect),
      onIntent: (intent: GamepadIntent) => this.#onIntent(intent),
    };
    bindKeyboard(this, binding);
    bindGamepad(this, binding);
    // A wheel/trackpad gesture over the hand strip scrolls it; a no-op wherever the hand fits in one row
    // (`HandScroll#measure` is only ever called for a strip, so `maxScroll` stays 0 otherwise).
    this.input.on("wheel", this.#hand.onWheel, this.#hand);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.input.off("wheel", this.#hand.onWheel, this.#hand);
      this.#stripMask?.destroy();
      this.#stripMask = null;
      this.#artUnsubscribe?.();
      this.#artUnsubscribe = null;
      this.#focusRing?.destroy();
      this.#focusRing = null;
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      if (this.scene.isActive(SCENES.choice)) this.scene.stop(SCENES.choice);
    });

    // `store.subscribe` above delivers the current state synchronously, so the first `#draw()` has
    // already happened by the time we get here.
    fadeScreenIn(this);
  }

  #onState(state: SessionState): void {
    if (!state.game || this.#handedOff) return;

    const fresh = state.version !== this.#version;
    if (fresh) {
      this.#log = advanceSetupWalkthroughLog(this.#log, state.lastEvents, state.game, state.perspectiveId, POOL_DEPS);
      this.#version = state.version;
    }

    // Setup is over: hand off to the Board, exactly as `TableSetupScene#start` used to do directly.
    if (state.game.step.phase !== "setup") {
      this.#handedOff = true;
      goToScreen(this, SCENES.board);
      return;
    }

    this.#view = setupWalkthroughViewOf(state.game, this.#log, POOL_DEPS, CARDS_BY_ID);

    const choice = state.game.pendingChoice;
    const isMulligan = choice !== null && choice.prompt.kind === "mulligan";

    // Any other decision that opens during setup (a forced trigger while the villain/scheme's own "Setup:" ability
    // resolves) isn't this scene's to answer — the generic sheet handles it, same as the Board does for every other
    // in-game choice (`BoardScene#syncChoiceOverlay`).
    const openGeneric = choice !== null && !isMulligan;
    if (openGeneric && !this.#choiceOpen) {
      this.#choiceOpen = true;
      this.scene.launch(SCENES.choice);
    } else if (!openGeneric && this.#choiceOpen) {
      this.#choiceOpen = false;
      this.scene.stop(SCENES.choice);
    }

    if (isMulligan && choice.choiceId !== this.#choiceId) {
      this.#choiceId = choice.choiceId;
      this.#selected = [...initialChoiceSelection(choice)];
      this.#focus = null;
    } else if (!isMulligan) {
      this.#choiceId = null;
    }

    this.#draw();
  }

  #draw(): void {
    const view = this.#view;
    if (!view) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#focusRing?.destroy();
    this.#focusRing = null;
    this.#focusRects.clear();
    destroyChildren(this);
    this.#stripMask?.destroy();
    this.#stripMask = null;

    const { width, height } = this.scale.gameSize;
    const otherSeatCount = view.decidingPlayerId ? view.seats.length - 1 : view.seats.length;
    const { pad } = setupMetrics(width, height);
    // Five labels ("Villain & main scheme placed", "Setup cards revealed — N", …) truncate at phone width in one
    // equal-width row — the same problem `view/chip-layout.ts`'s own doc comment found for Title's quick filters —
    // so the checklist wraps exactly the way those chips do, and the pure layout just needs the row count.
    const checklistRows = wrapChipsToRows(
      view.checklist.map((item) => ({ id: item.key, text: item.label, item })),
      width - pad * 2,
    );
    const layout = setupWalkthroughLayout({
      width,
      height,
      otherSeatCount,
      seatCount: view.seats.length,
      checklistRows: checklistRows.length,
      hasRevealedCard: view.revealedCard !== null,
    });

    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    this.#drawHeader(layout, view);
    this.#drawChecklist(layout, checklistRows);

    const choice = appSession().store.state.game?.pendingChoice ?? null;
    const mulliganChoice = choice && choice.prompt.kind === "mulligan" ? choice : null;
    this.#route = mulliganChoice
      ? setupWalkthroughFocusOrder({ optionIds: cardChoiceDisplayOrder(mulliganChoice.options, this.#selected) })
      : [];

    if (layout.mode === "allSeats") this.#drawAllSeats(layout, view, mulliganChoice);
    else this.#drawFocus(layout, view, mulliganChoice);

    this.#drawFocusRing();
  }

  /** Title inline with "Step N of M · …" (fidelity pass): the caption follows the title's own measured width, so it always sits right beside it rather than a fixed far-corner box. */
  #drawHeader(layout: SetupWalkthroughLayout, view: SetupWalkthroughView): void {
    const barG = this.add.graphics();
    barG
      .fillStyle(surface.ink.hex, 1)
      .fillRect(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height);

    const { titleRow } = layout;
    const title = this.add
      .text(
        titleRow.x,
        titleRow.y + titleRow.height / 2,
        "Setting up the table",
        textStyle(typeRole.screenTitle, surface.paper.hex),
      )
      .setOrigin(0, 0.5);
    fitText(title, titleRow.width * 0.62, typeRole.screenTitle.size);

    const captionX = titleRow.x + title.width + 16;
    const captionWidth = titleRow.x + titleRow.width - captionX;
    if (captionWidth > 40) {
      const caption = this.add
        .text(
          captionX,
          titleRow.y + titleRow.height / 2,
          view.stepLabel,
          textStyle(STEP_CAPTION_TYPE, surface.paper.hex, ink.secondary),
        )
        .setOrigin(0, 0.5);
      fitText(caption, captionWidth, STEP_CAPTION_TYPE.size);
    }
  }

  /** A Bangers section label with a rule running to the column's own right edge (D06's "YOUR OPENING HAND — …"/"OTHER SEATS"). */
  #sectionHeader(x: number, y: number, width: number, text: string): void {
    const title = this.add.text(x, y, text, textStyle(SECTION_HEADER_TYPE, surface.paper.hex)).setOrigin(0, 0.5);
    fitText(title, width * 0.7, SECTION_HEADER_TYPE.size);
    const ruleX = x + title.width + 12;
    if (ruleX < x + width) {
      const rule = this.add.graphics();
      rule.fillStyle(surface.paper.hex, 0.3).fillRect(ruleX, y, x + width - ruleX, 1);
    }
  }

  /** `rows` is `wrapChipsToRows`' own split of the checklist's five labels, at the actual viewport width (`#draw`) — a narrow phone gets two rows instead of five truncated chips. */
  #drawChecklist(
    layout: SetupWalkthroughLayout,
    rows: readonly (readonly {
      readonly id: string;
      readonly text: string;
      readonly item: { readonly state: "done" | "current" | "pending"; readonly label: string };
    }[])[],
  ): void {
    rows.forEach((row, rowIndex) => {
      const rowY = layout.checklist.y + rowIndex * (CHECKLIST_HEIGHT + 6);
      const cellWidth = (layout.checklist.width - (row.length - 1) * 8) / row.length;
      row.forEach((cell, index) => {
        const item = cell.item;
        const rect: Rect = {
          x: layout.checklist.x + index * (cellWidth + 8),
          y: rowY,
          width: cellWidth,
          height: CHECKLIST_HEIGHT,
        };
        const skin = CHIP_SKIN[item.state];
        const g = this.add.graphics();
        g.fillStyle(skin.fill, skin.fillAlpha).fillRect(rect.x, rect.y, rect.width, rect.height);
        g.lineStyle(2, skin.stroke, skin.strokeAlpha).strokeRect(
          rect.x + 1,
          rect.y + 1,
          rect.width - 2,
          rect.height - 2,
        );
        const prefix = item.state === "done" ? "✓ " : item.state === "current" ? "▸ " : "";
        const text = this.add
          .text(rect.x + 10, rect.y + rect.height / 2, `${prefix}${item.label}`, {
            ...textStyle(CHIP_TYPE, skin.text, skin.textAlpha),
            fontStyle: "800",
          })
          .setOrigin(0, 0.5);
        fitText(text, rect.width - 18, CHIP_TYPE.size);
      });
    });
  }

  /** Phone/tablet-portrait/desktop: the deciding seat's own hand, other seats collapsed, a sidebar (folded on phone). */
  #drawFocus(layout: SetupWalkthroughLayout, view: SetupWalkthroughView, mulliganChoice: PendingChoice | null): void {
    const decider = view.seats.find((seat) => seat.playerId === view.decidingPlayerId) ?? null;
    const others = view.seats.filter((seat) => seat.playerId !== view.decidingPlayerId);

    if (decider && mulliganChoice) {
      this.#sectionHeader(
        layout.handLabel.x,
        layout.handLabel.y + layout.handLabel.height / 2,
        layout.handLabel.width,
        `Your opening hand — ${decider.name}`,
      );
      this.#drawOpeningHand(layout.handRow, decider);
      this.#drawCommit(layout.commitRow, decider, mulliganChoice, layout.formFactor === "phone");
    } else {
      this.#sectionHeader(
        layout.handLabel.x,
        layout.handLabel.y + layout.handLabel.height / 2,
        layout.handLabel.width,
        "Opening hands",
      );
      this.add
        .text(
          layout.handRow.x,
          layout.handRow.y,
          "Waiting on another decision before the mulligan continues…",
          textStyle(typeRole.body, surface.paper.hex, ink.secondary),
        )
        .setWordWrapWidth(layout.handRow.width);
    }

    // A solo game has no other seats, and a header over nothing reads as a bug.
    if (others.length > 0) {
      this.#sectionHeader(
        layout.otherSeatsLabel.x,
        layout.otherSeatsLabel.y + layout.otherSeatsLabel.height / 2,
        layout.otherSeatsLabel.width,
        "Other seats",
      );
    }
    others.forEach((seat, index) => {
      const rect = layout.otherSeats[index];
      if (rect) this.#drawOtherSeatCard(rect, seat);
    });

    if (layout.revealedPanel) this.#drawRevealedCard(layout.revealedPanel, view);
    if (layout.logPanel) this.#drawSetupLog(layout.logPanel, view.setupLog);
  }

  /** Tablet landscape (L05): one column per seat, every hand visible at once. */
  #drawAllSeats(
    layout: SetupWalkthroughLayout,
    view: SetupWalkthroughView,
    mulliganChoice: PendingChoice | null,
  ): void {
    view.seats.forEach((seat, index) => {
      const column = layout.seatColumns[index];
      if (column) this.#drawSeatColumn(column, seat, seat.playerId === view.decidingPlayerId);
    });

    const decider = view.seats.find((seat) => seat.playerId === view.decidingPlayerId) ?? null;
    if (layout.footerNote) {
      const kept = view.seats.filter((seat) => seat.state === "kept" || seat.state === "mulliganed").length;
      const note = decider
        ? `${kept} seat${kept === 1 ? " has" : "s have"} kept. ${decider.name} is deciding.`
        : "Every seat has answered — moving on.";
      this.add
        .text(
          layout.footerNote.x,
          layout.footerNote.y + layout.footerNote.height / 2,
          note,
          textStyle(typeRole.body, surface.paper.hex, ink.secondary),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(layout.footerNote.width);
    }
    if (layout.footerCommit && decider && mulliganChoice)
      this.#drawCommit(layout.footerCommit, decider, mulliganChoice, false);
  }

  #drawSeatColumn(rect: Rect, seat: SetupSeatStatus, isDeciding: boolean): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "card", isDeciding ? "selected" : "rest");

    let y = rect.y + 8;
    const nameColor = isDeciding ? accent.heroRed.hex : surface.ink.hex;
    this.add.text(rect.x + 8, y, seat.name, textStyle(typeRole.rowTitle, nameColor));
    y += 18;
    label(this, rect.x + 8, y, seat.statusLabel.toUpperCase(), typeRole.label, surface.ink.hex, ink.label);
    y += 20;

    const rowHeight = 32;
    seat.hand.forEach((card, index) => {
      const rowY = y + index * (rowHeight + 4);
      if (rowY + rowHeight > rect.y + rect.height) return;
      const picked = isDeciding && this.#selected.includes(card.instanceId);
      const rowRect: Rect = { x: rect.x + 6, y: rowY, width: rect.width - 12, height: rowHeight };
      if (picked) {
        const wash = this.add.graphics();
        wash.fillStyle(accent.heroRed.hex, 0.15).fillRect(rowRect.x, rowRect.y, rowRect.width, rowRect.height);
      }
      const costText = card.cost !== null ? String(card.cost) : "–";
      this.add
        .text(rowRect.x + 4, rowRect.y + rowRect.height / 2, costText, textStyle(typeRole.statSmall, surface.ink.hex))
        .setOrigin(0, 0.5);
      const nameText = this.add
        .text(rowRect.x + 26, rowRect.y + rowRect.height / 2, card.name, textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0, 0.5)
        .setMaxLines(1);
      fitText(nameText, rowRect.width - (picked ? 60 : 30), typeRole.body.size);
      if (picked) {
        label(
          this,
          rowRect.x + rowRect.width - 4,
          rowRect.y + rowRect.height / 2,
          "swap",
          typeRole.label,
          accent.heroRed.hex,
          1,
        ).setOrigin(1, 0.5);
      }
      if (isDeciding) {
        this.#focusRects.set(`option:${card.instanceId}`, rowRect);
        addTapTarget(this, rowRect, {
          onTap: () => this.#toggle(card.instanceId),
          onInspect: () => this.#inspect(card.instanceId, picked),
        });
      }
    });
  }

  /**
   * A single row for as many cards as read legibly at this width. Where they wouldn't — a five- or six-card hand in
   * a phone's ~360px column — the hand becomes a sideways-scrolling strip of full-height cards instead
   * (`view/opening-hand-layout.ts` decides which, and lays out both). The strip replaced the P13 two-row grid after
   * a Pixel 9 Pro XL report (2026-09-19): halving each card's height to fit two rows made the cards "nearly
   * impossible to see", and a card's height is what its text reads by. Nothing changes at tablet-landscape/desktop
   * widths, where a single row already reads fine (`ScreensDesktop_05-06`).
   *
   * The strip is clipped to its own viewport (a masked container, the same `ui/rex.ts` mask `McScrollRegion` uses,
   * everything drawn eagerly then reparented — `TableSetupScene#captureInto`'s trick), drags sideways on any card
   * (`addTapTarget`'s `onDrag`, exactly the Board's tabbed hand), takes a wheel/trackpad gesture (`create`), and
   * carries a thin indicator under it so the player can see there is more hand to the right.
   */
  #drawOpeningHand(rect: Rect, decider: SetupSeatStatus): void {
    const layout = openingHandLayout(rect, decider.hand.length);
    if (layout.mode === "row") {
      decider.hand.forEach((card, index) => {
        const slot = layout.slots[index];
        if (slot) this.#drawMulliganCard(slot, card);
      });
      return;
    }

    this.#hand.measure(layout.viewport, layout.viewport.x + layout.contentWidth);
    const scrollX = this.#hand.scrollX;
    const onDrag = (deltaX: number): void => this.#hand.scrollBy(-deltaX);

    const strip = this.add.container(0, 0);
    const mask = this.make.graphics({}, false);
    mask
      .fillStyle(0xffffff)
      .fillRect(layout.viewport.x, layout.viewport.y, layout.viewport.width, layout.viewport.height);
    this.#stripMask = mask;
    setMask(strip, mask, "world");

    const before = this.children.list.length;
    decider.hand.forEach((card, index) => {
      const slot = layout.slots[index];
      if (slot) this.#drawMulliganCard({ ...slot, x: slot.x - scrollX }, card, onDrag);
    });
    const drawn = this.children.list.slice(before);
    if (drawn.length > 0) strip.add(drawn);

    const thumb = openingHandThumb(layout, scrollX);
    if (layout.indicator && thumb) {
      const track = this.add.graphics();
      track
        .fillStyle(surface.paper.hex, 0.15)
        .fillRect(layout.indicator.x, layout.indicator.y, layout.indicator.width, layout.indicator.height);
      track.fillStyle(surface.paper.hex, 0.7).fillRect(thumb.x, thumb.y, thumb.width, thumb.height);
    }
  }

  /**
   * A card marked for mulligan gets a dim wash under its art, a red outline (`paintPanel`'s own "selected" skin
   * already draws that), and a red "MULLIGAN" tag near the bottom — D06's "DOWNTIME" card. `onDrag` is given only
   * inside the scrolling strip, where a sideways drag on a card scrolls the hand instead of toggling the card.
   */
  #drawMulliganCard(slot: Rect, card: HandCardView, onDrag?: (deltaX: number) => void): void {
    const picked = this.#selected.includes(card.instanceId);
    this.#focusRects.set(`option:${card.instanceId}`, slot);

    const g = this.add.graphics();
    paintPanel(g, slot, "card", picked ? "selected" : "rest");
    const inner: Rect = { x: slot.x + 3, y: slot.y + 3, width: slot.width - 6, height: slot.height - 6 };
    const key = this.#art.request(this, card.art);
    const drawn = drawArt(this, key, inner, { fit: "contain" });
    if (!drawn) {
      this.add
        .text(
          inner.x + inner.width / 2,
          inner.y + inner.height / 2,
          card.name,
          textStyle(typeRole.rowTitle, surface.ink.hex),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(inner.width - 8)
        .setMaxLines(3);
    }
    if (picked) {
      // The dim wash: this card leaves the hand, so its art reads as already half-gone.
      const dim = this.add.graphics();
      dim.fillStyle(surface.ink.hex, 0.55).fillRect(inner.x, inner.y, inner.width, inner.height);

      const tagWidth = Math.min(inner.width - 8, 96);
      const tagHeight = 20;
      const band: Rect = {
        x: inner.x + (inner.width - tagWidth) / 2,
        y: inner.y + inner.height - tagHeight - 6,
        width: tagWidth,
        height: tagHeight,
      };
      const bandG = this.add.graphics();
      bandG.fillStyle(accent.heroRed.hex, 1).fillRect(band.x, band.y, band.width, band.height);
      const tagText = this.add
        .text(
          band.x + band.width / 2,
          band.y + band.height / 2,
          "MULLIGAN",
          textStyle(typeRole.label, surface.paper.hex),
        )
        .setOrigin(0.5);
      fitText(tagText, band.width - 6, typeRole.label.size);
    }

    addTapTarget(this, slot, {
      onTap: () => this.#toggle(card.instanceId),
      onInspect: () => this.#inspect(card.instanceId, picked),
      onDrag,
      // Stable across the redraw every scrolled pixel causes, so a press that began on this card is still a tap
      // on it when it ends (`ui/hold-target.ts`'s own doc comment).
      key: card.instanceId as unknown as string,
    });
  }

  /** A compact seat card: a coloured monogram square, the seat's name, its status, and a row of facedown hand slots (dashed red for however many were just redrawn). */
  #drawOtherSeatCard(rect: Rect, seat: SetupSeatStatus, index = 0): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "onInk", "rest");

    const monoSize = Math.min(28, rect.height - 16);
    const monoRect: Rect = { x: rect.x + 8, y: rect.y + 8, width: monoSize, height: monoSize };
    const monoColor = MONOGRAM_PALETTE[Math.abs(hashOf(seat.playerId as unknown as string)) % MONOGRAM_PALETTE.length]!;
    const monoG = this.add.graphics();
    monoG.fillStyle(monoColor, 1).fillRect(monoRect.x, monoRect.y, monoRect.width, monoRect.height);
    monoG.lineStyle(1.5, surface.ink.hex, 1).strokeRect(monoRect.x, monoRect.y, monoRect.width, monoRect.height);
    this.add
      .text(
        monoRect.x + monoRect.width / 2,
        monoRect.y + monoRect.height / 2,
        initialsOf(seat.name),
        textStyle({ ...typeRole.rowTitle, size: 11 }, surface.paper.hex),
      )
      .setOrigin(0.5);

    const textLeft = monoRect.x + monoRect.width + 8;
    this.add.text(textLeft, rect.y + 8, seat.name, textStyle(typeRole.rowTitle, surface.paper.hex)).setMaxLines(1);
    label(
      this,
      textLeft,
      rect.y + 8 + 16,
      seat.statusLabel.toUpperCase(),
      typeRole.label,
      surface.paper.hex,
      seat.state === "waiting" ? ink.secondary : 1,
    );

    const slotsTop = monoRect.y + monoRect.height + 10;
    const count = Math.max(0, seat.handSize);
    const gap = 3;
    const available = rect.width - 16;
    const slotWidth =
      count > 0
        ? Math.max(9, Math.min(OTHER_SEAT_SLOT_WIDTH, (available - gap * (count - 1)) / count))
        : OTHER_SEAT_SLOT_WIDTH;
    const slotHeight = Math.min(OTHER_SEAT_SLOT_HEIGHT, rect.y + rect.height - slotsTop - 4);
    if (slotHeight > 8) {
      const redrawn = seat.state === "mulliganed" ? (seat.mulliganedCount ?? 0) : 0;
      for (let i = 0; i < count; i++) {
        const sx = rect.x + 8 + i * (slotWidth + gap);
        const isRedrawn = i >= count - redrawn;
        const slotRect: Rect = { x: sx, y: slotsTop, width: slotWidth, height: slotHeight };
        if (isRedrawn) {
          dashedRect(this.add.graphics(), slotRect, 1.5);
          this.add
            .graphics()
            .lineStyle(1.5, accent.heroRed.hex, 1)
            .strokeRect(slotRect.x, slotRect.y, slotRect.width, slotRect.height);
        } else {
          const slotG = this.add.graphics();
          slotG.fillStyle(surface.void.hex, 1).fillRect(slotRect.x, slotRect.y, slotRect.width, slotRect.height);
          slotG
            .lineStyle(1, surface.paper.hex, 0.3)
            .strokeRect(slotRect.x, slotRect.y, slotRect.width, slotRect.height);
        }
      }
    }
    void index;
  }

  #drawRevealedCard(rect: Rect, view: SetupWalkthroughView): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "card", "rest");
    label(this, rect.x + 10, rect.y + 8, "Setup card revealed", typeRole.label, accent.heroRed.hex, 1);

    if (!view.revealedCard) {
      this.add
        .text(
          rect.x + 10,
          rect.y + 8 + 16,
          "No setup card revealed yet.",
          textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        )
        .setWordWrapWidth(rect.width - 20);
      return;
    }
    const card = view.revealedCard;
    const nameY = rect.y + 8 + 16;
    const name = this.add.text(rect.x + 10, nameY, card.name, textStyle(typeRole.barTitle, surface.ink.hex));
    fitText(name, rect.width - 20, typeRole.barTitle.size);
    let y = nameY + name.height + 4;
    const artHeight = Math.min((rect.y + rect.height - y) * 0.5, 90);
    if (artHeight > 30) {
      const artRect: Rect = { x: rect.x + 10, y, width: rect.width - 20, height: artHeight };
      const key = this.#art.request(this, card.art);
      if (!drawArt(this, key, artRect, { fit: "contain" })) {
        const ground = this.add.graphics();
        ground.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
      }
      y = artRect.y + artRect.height + 6;
    }
    const rulesHeight = Math.max(0, rect.y + rect.height - y - 8);
    if (rulesHeight > 14) {
      this.add
        .text(rect.x + 10, y, card.rulesText, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setWordWrapWidth(rect.width - 20)
        .setMaxLines(Math.max(1, Math.floor(rulesHeight / 15)));
    }
    addTapTarget(this, rect, {
      onTap: () => this.#inspectInstance(card.instanceId),
      onInspect: () => this.#inspectInstance(card.instanceId),
    });
  }

  /** "SETUP LOG": an ink panel with a light outline and paper-toned lines — never `LogPanel`'s parchment rail, which is built for the Board's own paper-toned frame. */
  #drawSetupLog(rect: Rect, lines: readonly LogLine[]): void {
    const g = this.add.graphics();
    g.lineStyle(1, surface.paper.hex, 0.25).strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
    const header = this.add.text(rect.x + 10, rect.y + 8, "Setup log", textStyle(typeRole.barTitle, surface.paper.hex));
    fitText(header, rect.width - 20, typeRole.barTitle.size);

    const top = rect.y + 8 + header.height + 6;
    const bottom = rect.y + rect.height - 8;
    const lineGap = 6;
    let y = top;
    let shown = 0;
    for (const line of lines) {
      const text = this.add
        .text(rect.x + 10, y, line.text, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setWordWrapWidth(rect.width - 20);
      if (y + text.height > bottom) {
        text.destroy();
        break;
      }
      y += text.height + lineGap;
      shown += 1;
    }
    const hidden = lines.length - shown;
    if (hidden > 0 && y < bottom) {
      label(this, rect.x + 10, y, `+${hidden} more`, typeRole.label, surface.paper.hex, ink.meta);
    }
  }

  /** "Mulligan N" / "Keep all N" — compact controls, not two column-spanning slabs, plus the mulligan rule's own helper text beside them where there's room (D06). Phone (P13) swaps the order: "Keep all" left, "Mulligan" right, since that's what the phone tile itself draws. */
  #drawCommit(rect: Rect, decider: SetupSeatStatus, choice: PendingChoice, phoneOrder: boolean): void {
    const canCommit = canConfirmChoice(choice, this.#selected.length);
    const mulliganLabel = this.#selected.length > 0 ? `Mulligan ${this.#selected.length}` : "Mulligan";
    const keepLabel = `Keep all ${decider.handSize}`;

    const mulliganWidth = Math.min(200, rect.width * 0.4);
    const keepWidth = Math.min(150, rect.width * 0.32);
    const gap = 12;

    const mulliganRect: Rect = phoneOrder
      ? { x: rect.x + keepWidth + gap, y: rect.y, width: mulliganWidth, height: rect.height }
      : { x: rect.x, y: rect.y, width: mulliganWidth, height: rect.height };
    const keepRect: Rect = phoneOrder
      ? { x: rect.x, y: rect.y, width: keepWidth, height: rect.height }
      : { x: rect.x + mulliganWidth + gap, y: rect.y, width: keepWidth, height: rect.height };

    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: mulliganLabel,
        type: typeRole.barTitle,
        rect: mulliganRect,
        enabled: canCommit && this.#selected.length > 0,
        reason: "choose at least one card to mulligan",
        onClick: () => void this.#confirm(),
      }),
    );
    this.#focusRects.set("confirm", mulliganRect);

    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: keepLabel,
        type: typeRole.barTitle,
        rect: keepRect,
        onClick: () => {
          this.#selected = [];
          void this.#confirm();
        },
      }),
    );
    this.#focusRects.set("decline", keepRect);

    if (!phoneOrder) {
      const noteX = rect.x + mulliganWidth + gap + keepWidth + 16;
      const noteWidth = rect.x + rect.width - noteX;
      if (noteWidth > 100) {
        this.add
          .text(
            noteX,
            rect.y + rect.height / 2,
            "One mulligan per player: discard any number, draw back up, shuffle the discards in.",
            textStyle(typeRole.body, surface.paper.hex, ink.secondary),
          )
          .setOrigin(0, 0.5)
          .setWordWrapWidth(noteWidth);
      }
    }
  }

  #toggle(instanceId: InstanceId): void {
    const choice = appSession().store.state.game?.pendingChoice;
    if (!choice || choice.prompt.kind !== "mulligan") return;
    const id = instanceId as unknown as string;
    const at = this.#selected.indexOf(id);
    if (at >= 0) this.#selected = this.#selected.filter((selectedId) => selectedId !== id);
    else if (this.#selected.length < choice.maxSelections) this.#selected = [...this.#selected, id];
    this.#draw();
  }

  #inspect(instanceId: InstanceId, picked: boolean): void {
    this.scene.launch(SCENES.inspect, {
      instanceId,
      choice: { optionId: instanceId as unknown as string, label: picked ? "Deselect" : "Select" },
    });
  }

  #inspectInstance(instanceId: InstanceId): void {
    this.scene.launch(SCENES.inspect, { instanceId });
  }

  async #confirm(): Promise<void> {
    await appSession().store.resolveChoice(this.#selected);
  }

  #onIntent(intent: GamepadIntent): void {
    const choice = appSession().store.state.game?.pendingChoice;
    if (!choice || choice.prompt.kind !== "mulligan") return;
    switch (intent) {
      case "next":
      case "previous": {
        const at = this.#route.indexOf(this.#focus ?? "");
        const next = stepFocus(this.#route, at, intent === "next" ? 1 : -1);
        this.#focus = next >= 0 ? (this.#route[next] ?? null) : null;
        // A card off the edge of the hand strip comes on screen before it is ringed (a redraw, which re-registers
        // every focus rect at the new offset); the ring is drawn either way.
        const focused = this.#focus ? this.#focusRects.get(this.#focus) : undefined;
        if (focused && this.#focus?.startsWith("option:")) this.#hand.scrollIntoView(focused);
        this.#drawFocusRing();
        break;
      }
      case "activate":
        this.#activate(choice);
        break;
      case "inspect":
        if (this.#focus?.startsWith("option:")) {
          const instanceId = this.#focus.slice("option:".length) as InstanceId;
          this.#inspect(instanceId, this.#selected.includes(this.#focus.slice("option:".length)));
        }
        break;
      case "cancel":
        this.#focus = null;
        this.#drawFocusRing();
        break;
    }
  }

  #activate(choice: PendingChoice): void {
    const focus = this.#focus;
    if (!focus) return;
    if (focus.startsWith("option:")) {
      this.#toggle(focus.slice("option:".length) as InstanceId);
      return;
    }
    if (focus === "decline") {
      this.#selected = [];
      void this.#confirm();
      return;
    }
    if (focus === "confirm" && canConfirmChoice(choice, this.#selected.length) && this.#selected.length > 0)
      void this.#confirm();
  }

  /** Static, not pulsing: the ring says "here you are", not "act now" — the same convention `ChoiceOverlay` uses. */
  #drawFocusRing(): void {
    this.#focusRing?.destroy();
    this.#focusRing = null;
    const focus = this.#focus;
    if (!focus) return;
    if (!this.#route.includes(focus)) {
      this.#focus = null;
      return;
    }
    const rect = this.#focusRects.get(focus);
    if (!rect) return;
    this.#focusRing = new McSelectionRing(this);
    this.#focusRing.show(rect, "static", true);
  }
}

/** A small, stable string hash for picking a monogram colour deterministically from a player id — never `Math.random`, so a seat's colour doesn't change between redraws. */
function hashOf(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return hash;
}
