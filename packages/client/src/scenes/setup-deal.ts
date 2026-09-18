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
 */

import Phaser from "phaser";
import type { InstanceId, PendingChoice } from "@mc/engine";
import { CARDS_BY_ID, POOL_DEPS } from "../content/pool.js";
import { accent, dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McSelectionRing, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { cardArt, drawArt, type CardArt } from "../art/card-art.js";
import { canConfirmChoice, cardChoiceDisplayOrder, initialChoiceSelection } from "../view/choice-focus.js";
import { wrapChipsToRows } from "../view/chip-layout.js";
import { stepFocus } from "../view/focus.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { cardRow, type Rect } from "../view/layout.js";
import { setupMetrics } from "../view/setup-metrics.js";
import { setupWalkthroughFocusOrder } from "../view/screen-focus.js";
import {
  advanceSetupWalkthroughLog,
  emptySetupWalkthroughLog,
  setupWalkthroughViewOf,
  type SetupChecklistItem,
  type SetupSeatStatus,
  type SetupWalkthroughLog,
  type SetupWalkthroughView,
} from "../view/setup-walkthrough.js";
import { CHECKLIST_HEIGHT, setupWalkthroughLayout, type SetupWalkthroughLayout } from "../view/setup-walkthrough-layout.js";
import type { HandCardView } from "../view/board-model.js";
import type { SessionState } from "../store/session-store.js";
import { appSession } from "../session.js";
import { LogPanel } from "./board/log.js";
import { bindGamepad, bindKeyboard } from "./board/input.js";
import { addTapTarget } from "./board/tap-target.js";
import { SCENES } from "./keys.js";

const STEP_STATE_INK: Readonly<Record<"done" | "current" | "pending", { readonly ground: number; readonly text: number }>> = {
  done: { ground: 0x1f3a2c, text: surface.paper.hex },
  current: { ground: accent.heroRed.hex, text: surface.paper.hex },
  pending: { ground: surface.ink.hex, text: surface.paper.hex },
};

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
  readonly #logPanel = new LogPanel(() => this.#draw());

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
    this.#logPanel.reset();
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));

    const { store } = appSession();
    this.#unsubscribe = store.subscribe((state) => this.#onState(state));
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#artUnsubscribe = this.#art.onArrived(() => this.#draw());
    this.input.on("wheel", this.#logPanel.onWheel, this.#logPanel);

    const binding = {
      blocked: () => this.#choiceOpen || this.scene.isActive(SCENES.inspect),
      onIntent: (intent: GamepadIntent) => this.#onIntent(intent),
    };
    bindKeyboard(this, binding);
    bindGamepad(this, binding);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#artUnsubscribe?.();
      this.#artUnsubscribe = null;
      this.input.off("wheel", this.#logPanel.onWheel, this.#logPanel);
      this.#focusRing?.destroy();
      this.#focusRing = null;
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      if (this.scene.isActive(SCENES.choice)) this.scene.stop(SCENES.choice);
    });
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
      this.scene.start(SCENES.board);
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
    this.children.removeAll(true);
    this.#logPanel.hide();

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
    const layout = setupWalkthroughLayout({ width, height, otherSeatCount, seatCount: view.seats.length, checklistRows: checklistRows.length });

    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    this.#drawHeader(layout, view);
    this.#drawChecklist(layout, checklistRows);

    const choice = appSession().store.state.game?.pendingChoice ?? null;
    const mulliganChoice = choice && choice.prompt.kind === "mulligan" ? choice : null;
    this.#route = mulliganChoice ? setupWalkthroughFocusOrder({ optionIds: cardChoiceDisplayOrder(mulliganChoice.options, this.#selected) }) : [];

    if (layout.mode === "allSeats") this.#drawAllSeats(layout, view, mulliganChoice);
    else this.#drawFocus(layout, view, mulliganChoice);

    this.#drawFocusRing();
  }

  #drawHeader(layout: SetupWalkthroughLayout, view: SetupWalkthroughView): void {
    const barG = this.add.graphics();
    barG.fillStyle(surface.ink.hex, 1).fillRect(layout.headerBar.x, layout.headerBar.y, layout.headerBar.width, layout.headerBar.height);
    const title = this.add
      .text(layout.title.x, layout.title.y + layout.title.height / 2, "Setting up the table", textStyle(typeRole.screenTitle, surface.paper.hex))
      .setOrigin(0, 0.5);
    fitText(title, layout.title.width, typeRole.screenTitle.size);
    label(this, layout.step.x + layout.step.width, layout.step.y + layout.step.height / 2, view.stepLabel, typeRole.label, surface.paper.hex, ink.label).setOrigin(1, 0.5);
  }

  /** `rows` is `wrapChipsToRows`' own split of the checklist's five labels, at the actual viewport width (`#draw`) — a narrow phone gets two rows instead of five truncated chips. */
  #drawChecklist(layout: SetupWalkthroughLayout, rows: readonly (readonly { readonly id: string; readonly text: string; readonly item: SetupChecklistItem }[])[]): void {
    rows.forEach((row, rowIndex) => {
      const rowY = layout.checklist.y + rowIndex * (CHECKLIST_HEIGHT + 6);
      const cellWidth = (layout.checklist.width - (row.length - 1) * 8) / row.length;
      row.forEach((cell, index) => {
        const item = cell.item;
        const rect: Rect = { x: layout.checklist.x + index * (cellWidth + 8), y: rowY, width: cellWidth, height: CHECKLIST_HEIGHT };
        const skin = STEP_STATE_INK[item.state];
        const g = this.add.graphics();
        g.fillStyle(skin.ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
        g.lineStyle(1, surface.paper.hex, item.state === "current" ? 1 : 0.25).strokeRect(rect.x, rect.y, rect.width, rect.height);
        const prefix = item.state === "done" ? "✓ " : item.state === "current" ? "▸ " : "";
        const text = this.add
          .text(rect.x + 8, rect.y + rect.height / 2, `${prefix}${item.label}`, { ...textStyle(typeRole.label, skin.text), fontStyle: item.state === "current" ? "bold" : "normal" })
          .setOrigin(0, 0.5);
        fitText(text, rect.width - 16, typeRole.label.size);
      });
    });
  }

  /** Phone/tablet-portrait/desktop: the deciding seat's own hand, other seats collapsed, a sidebar (folded on phone). */
  #drawFocus(layout: SetupWalkthroughLayout, view: SetupWalkthroughView, mulliganChoice: PendingChoice | null): void {
    const decider = view.seats.find((seat) => seat.playerId === view.decidingPlayerId) ?? null;
    const others = view.seats.filter((seat) => seat.playerId !== view.decidingPlayerId);

    if (decider && mulliganChoice) {
      label(this, layout.handLabel.x, layout.handLabel.y, `Your opening hand — ${decider.name}`, typeRole.label, surface.paper.hex, ink.label);
      this.#drawOpeningHand(layout.handRow, decider);
      this.#drawCommit(layout.commitRow, decider, mulliganChoice);
    } else {
      label(this, layout.handLabel.x, layout.handLabel.y, "Opening hands", typeRole.label, surface.paper.hex, ink.label);
      this.add
        .text(layout.handRow.x, layout.handRow.y, "Waiting on another decision before the mulligan continues…", textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setWordWrapWidth(layout.handRow.width);
    }

    label(this, layout.otherSeatsLabel.x, layout.otherSeatsLabel.y, "Other seats", typeRole.label, surface.paper.hex, ink.label);
    others.forEach((seat, index) => {
      const rect = layout.otherSeats[index];
      if (rect) this.#drawOtherSeatRow(rect, seat);
    });

    if (layout.revealedPanel) this.#drawRevealedCard(layout.revealedPanel, view);
    if (layout.logPanel) this.#logPanel.draw(this, layout.logPanel, this.#log.log);
  }

  /** Tablet landscape (L05): one column per seat, every hand visible at once. */
  #drawAllSeats(layout: SetupWalkthroughLayout, view: SetupWalkthroughView, mulliganChoice: PendingChoice | null): void {
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
        .text(layout.footerNote.x, layout.footerNote.y + layout.footerNote.height / 2, note, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0.5)
        .setWordWrapWidth(layout.footerNote.width);
    }
    if (layout.footerCommit && decider && mulliganChoice) this.#drawCommit(layout.footerCommit, decider, mulliganChoice);
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
      this.add.text(rowRect.x + 4, rowRect.y + rowRect.height / 2, costText, textStyle(typeRole.statSmall, surface.ink.hex)).setOrigin(0, 0.5);
      const nameText = this.add
        .text(rowRect.x + 26, rowRect.y + rowRect.height / 2, card.name, textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0, 0.5)
        .setMaxLines(1);
      fitText(nameText, rowRect.width - (picked ? 60 : 30), typeRole.body.size);
      if (picked) {
        label(this, rowRect.x + rowRect.width - 4, rowRect.y + rowRect.height / 2, "swap", typeRole.label, accent.heroRed.hex, 1).setOrigin(1, 0.5);
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
   * A single row for as many cards as read legibly at this width; a crowded phone hand (five or six cards in a
   * ~360px column) wraps to a two-row grid instead of shrinking every card to an unreadable thumbnail — the design's
   * own P13 grid, not this screen's own invention. `cardRow`'s single-row shrink is tried first and only abandoned
   * once it would actually fall below a readable floor, so nothing changes at tablet/desktop widths, where a single
   * row already reads fine (`ScreensDesktop_05-06`).
   */
  #drawOpeningHand(rect: Rect, decider: SetupSeatStatus): void {
    const count = decider.hand.length;
    const singleRow = cardRow(rect, count, { gap: 8, maxHeight: rect.height });
    const READABLE_CARD_WIDTH = 90;
    if (count <= 4 || (singleRow[0]?.width ?? 0) >= READABLE_CARD_WIDTH) {
      decider.hand.forEach((card, index) => {
        const slot = singleRow[index];
        if (slot) this.#drawMulliganCard(slot, card);
      });
      return;
    }

    const rows = 2;
    const perRow = Math.ceil(count / rows);
    const rowGap = 8;
    const rowHeight = (rect.height - rowGap) / rows;
    let index = 0;
    for (let r = 0; r < rows && index < count; r++) {
      const rowCount = Math.min(perRow, count - index);
      const rowRect: Rect = { x: rect.x, y: rect.y + r * (rowHeight + rowGap), width: rect.width, height: rowHeight };
      const slots = cardRow(rowRect, rowCount, { gap: 8, maxHeight: rowHeight });
      for (const slot of slots) {
        const card = decider.hand[index]!;
        this.#drawMulliganCard(slot, card);
        index++;
      }
    }
  }

  #drawMulliganCard(slot: Rect, card: HandCardView): void {
    const picked = this.#selected.includes(card.instanceId);
    this.#focusRects.set(`option:${card.instanceId}`, slot);

    const g = this.add.graphics();
    paintPanel(g, slot, "card", picked ? "selected" : "rest");
    const inner: Rect = { x: slot.x + 3, y: slot.y + 3, width: slot.width - 6, height: slot.height - 6 };
    const key = this.#art.request(this, card.art);
    if (!drawArt(this, key, inner, { fit: "contain" })) {
      this.add
        .text(inner.x + inner.width / 2, inner.y + inner.height / 2, card.name, textStyle(typeRole.rowTitle, surface.ink.hex))
        .setOrigin(0.5)
        .setWordWrapWidth(inner.width - 8)
        .setMaxLines(3);
    }
    if (picked) {
      const band: Rect = { x: inner.x, y: inner.y + inner.height - 22, width: inner.width, height: 22 };
      const bandG = this.add.graphics();
      bandG.fillStyle(accent.heroRed.hex, 1).fillRect(band.x, band.y, band.width, band.height);
      this.add
        .text(band.x + band.width / 2, band.y + band.height / 2, "MULLIGAN", textStyle(typeRole.label, surface.paper.hex))
        .setOrigin(0.5)
        .setLetterSpacing(typeRole.label.letterSpacing);
    }

    addTapTarget(this, slot, {
      onTap: () => this.#toggle(card.instanceId),
      onInspect: () => this.#inspect(card.instanceId, picked),
    });
  }

  #drawOtherSeatRow(rect: Rect, seat: SetupSeatStatus): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "onInk", "rest");
    this.add.text(rect.x + 10, rect.y + 8, seat.name, textStyle(typeRole.rowTitle, surface.paper.hex));
    label(this, rect.x + rect.width - 10, rect.y + 8, seat.statusLabel.toUpperCase(), typeRole.label, surface.paper.hex, ink.secondary).setOrigin(1, 0);
    if (seat.subtitle) {
      this.add
        .text(rect.x + 10, rect.y + rect.height - 8, seat.subtitle, textStyle(typeRole.label, surface.paper.hex, ink.label))
        .setOrigin(0, 1)
        .setWordWrapWidth(rect.width - 20)
        .setMaxLines(1);
    }
  }

  #drawRevealedCard(rect: Rect, view: SetupWalkthroughView): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "card", "rest");
    label(this, rect.x + 10, rect.y + 8, "Setup card revealed", typeRole.label, surface.ink.hex, ink.label);

    if (!view.revealedCard) {
      this.add
        .text(rect.x + 10, rect.y + 30, "No setup card has been revealed yet this game.", textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setWordWrapWidth(rect.width - 20);
      return;
    }
    const card = view.revealedCard;
    const artHeight = Math.min(rect.height * 0.4, 100);
    const artRect: Rect = { x: rect.x + 10, y: rect.y + 28, width: rect.width - 20, height: artHeight };
    const key = this.#art.request(this, card.art);
    if (!drawArt(this, key, artRect, { fit: "contain" })) {
      const ground = this.add.graphics();
      ground.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    }
    let y = artRect.y + artRect.height + 6;
    const name = this.add.text(rect.x + 10, y, card.name, textStyle(typeRole.rowTitle, surface.ink.hex));
    y += name.height + 2;
    label(this, rect.x + 10, y, card.typeLine, typeRole.label, surface.ink.hex, ink.label);
    y += 16;
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

  /** "Mulligan N" / "Keep all N" — the same commit rule `view/choice-focus.ts` already governs, worded for this screen. */
  #drawCommit(rect: Rect, decider: SetupSeatStatus, choice: PendingChoice): void {
    const canCommit = canConfirmChoice(choice, this.#selected.length);
    const halfWidth = (rect.width - 12) / 2;
    const mulliganLabel = this.#selected.length > 0 ? `Mulligan ${this.#selected.length}` : "Mulligan";

    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: mulliganLabel,
        type: typeRole.barTitle,
        rect: { x: rect.x, y: rect.y, width: halfWidth, height: rect.height },
        enabled: canCommit && this.#selected.length > 0,
        reason: "choose at least one card to mulligan",
        onClick: () => void this.#confirm(),
      }),
    );
    this.#focusRects.set("confirm", { x: rect.x, y: rect.y, width: halfWidth, height: rect.height });

    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: `Keep all ${decider.handSize}`,
        type: typeRole.barTitle,
        rect: { x: rect.x + halfWidth + 12, y: rect.y, width: halfWidth, height: rect.height },
        onClick: () => {
          this.#selected = [];
          void this.#confirm();
        },
      }),
    );
    this.#focusRects.set("decline", { x: rect.x + halfWidth + 12, y: rect.y, width: halfWidth, height: rect.height });
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
    this.scene.launch(SCENES.inspect, { instanceId, choice: { optionId: instanceId as unknown as string, label: picked ? "Deselect" : "Select" } });
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
    if (focus === "confirm" && canConfirmChoice(choice, this.#selected.length) && this.#selected.length > 0) void this.#confirm();
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
