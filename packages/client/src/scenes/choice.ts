/**
 * The pending-choice overlay.
 *
 * It runs in parallel over Board (`scene.launch`), so the table stays visible
 * underneath while a decision is open — the design's overlay sheet: an ink
 * title bar with a boxed ✕, a 70%-ink scrim, and one red commit plus quiet
 * alternatives.
 *
 * The engine's `PendingChoice.options` already lists every legal answer, so
 * this screen only has to present them and send the ids back. It labels *why*
 * this player is deciding from `PendingChoice.authority`, which is what makes
 * an encounter-side decision legible as one (docs/phase3-encounter-ai.md).
 */

import Phaser from "phaser";
import { cardOf, type ChoiceRef, type GameState, type InstanceId, type PendingChoice, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McSelectionRing, fitText, label, paintPanel } from "../ui/widgets.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { artFor } from "../art/art-source.js";
import { characterPanel, faceOf } from "../view/board-model.js";
import type { Rect } from "../view/layout.js";
import { cardRow, formFactorFor } from "../view/layout.js";
import { decisionLabel } from "../view/villain-walkthrough.js";
import { abilityShortLabelOf } from "../view/ability-label.js";
import { choiceHeaderInstanceId, choiceHeaderText } from "../view/choice-source.js";
import { seatIdentityName } from "../view/names.js";
import { defendChoiceViewOf, type DefendOptionView } from "../view/defend-choice.js";
import { defendChoiceLayout, defendOptionSlots } from "../view/defend-choice-layout.js";
import {
  canConfirmChoice,
  cardChoiceDisplayOrder,
  choiceFocusKey,
  choiceFocusOrder,
  confirmMinimum,
  initialChoiceSelection,
  sameChoiceTarget,
  type ChoiceFocusTarget,
} from "../view/choice-focus.js";
import { stepFocus } from "../view/focus.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { appSession } from "../session.js";
import { bindGamepad, bindKeyboard } from "./board/input.js";
import { SCENES } from "./keys.js";
import { bindHoldTarget } from "../ui/hold-target.js";

export class ChoiceOverlay extends Phaser.Scene {
  #selected: string[] = [];
  #buttons: McButton[] = [];
  #unsubscribe: (() => void) | null = null;
  #choiceId: string | null = null;
  #maxSelections = 1;
  /** Keyboard/pad focus: what is focused, not where — the rect is re-read each rebuild. */
  #focus: ChoiceFocusTarget | null = null;
  #route: readonly ChoiceFocusTarget[] = [];
  #focusRects = new Map<string, Rect>();
  #focusRing: McSelectionRing | null = null;

  constructor() {
    super({ key: SCENES.choice });
  }

  create(): void {
    const { store } = appSession();
    this.#unsubscribe = store.subscribe(() => this.#rebuild());
    const onResize = (): void => this.#rebuild();
    /**
     * The resize listener MUST be removed on shutdown.
     *
     * `this.scale` is the *game's* emitter, not the scene's, so it outlives
     * every scene and keeps whatever is registered on it. An overlay that is
     * launched and stopped on every decision therefore added a listener per
     * open, each closure retaining a dead scene and, through it, the game
     * state, the view models and the card-art textures — a heap that reached
     * 3.5 GB in one session. It also crashed: a resize would eventually reach
     * a torn-down scene and draw into systems that no longer exist.
     */
    this.scale.on("resize", onResize, this);
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    // The Inspect sheet answers by reporting back: it presents a card, it does
    // not decide anything.
    this.game.events.on("mc-choice-toggle", this.#onInspectToggle, this);
    // The Board hands the keyboard and the pad over while this sheet is up
    // (`BoardScene`'s `blocked`), so this is where they have to land — and
    // Inspect, opened from here, owns them in turn while it is open.
    const binding = {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onIntent: (intent: GamepadIntent) => this.#onIntent(intent),
    };
    bindKeyboard(this, binding);
    bindGamepad(this, binding);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#focusRing?.destroy();
      this.#focusRing = null;
      this.scale.off("resize", onResize, this);
      artOff();
      this.game.events.off("mc-choice-toggle", this.#onInspectToggle, this);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
    });
  }

  #rebuild(): void {
    const { store } = appSession();
    const state = store.state;
    const choice = state.game?.pendingChoice;
    if (!choice || !state.game) return;

    // A new choice clears the previous selection.
    if (choice.choiceId !== this.#choiceId) {
      this.#choiceId = choice.choiceId;
      this.#selected = [...initialChoiceSelection(choice)];
      this.#focus = null;
    }
    this.#maxSelections = choice.maxSelections;

    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#focusRing?.destroy();
    this.#focusRing = null;
    this.#focusRects.clear();
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";

    // W6 (docs/phase4-screen-gaps.md): a dedicated presentation for the defend prompt, over the same PendingChoice
    // and answered with the same `resolveChoice` command the bare list below sends — see `#drawDefendChoice`'s own
    // doc comment for why this branches before `asCards` rather than becoming a fifth `ChoiceRef` case there.
    if (choice.prompt.kind === "declareDefender") {
      this.#drawDefendChoice(choice, state.game, width, height);
      return;
    }

    // A decision about cards is made on the cards, so it is decided here —
    // before the sheet is sized, because a row of cards needs a wider sheet
    // than a list of names does. An "ability" ref names a card too — every
    // `chooseTriggers`/`payForAbility` option is one (`ref.instanceId` plus
    // the `abilityId` it would trigger) — so "TRIGGER AN ABILITY? / 1. She-Hulk"
    // used to fall through to the bare-list branch below purely because
    // `ref.kind` was "ability", not "card": the option named a card just as
    // concretely, the check just didn't recognize it. See `refInstanceId`.
    const asCards =
      choice.options.length > 0 &&
      choice.options.every((option) => refInstanceId(option.ref) !== null);

    // The 70%-ink scrim.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.ink.hex, 0.7).fillRect(0, 0, width, height);

    const sheetWidth = Math.min(
      width - (phone ? 16 : 80),
      asCards ? 1040 : 560,
    );
    const sheetHeight = Math.min(
      height - (phone ? 16 : 80),
      asCards ? 620 : 560,
    );
    const sheet: Rect = {
      x: (width - sheetWidth) / 2,
      y: (height - sheetHeight) / 2,
      width: sheetWidth,
      height: sheetHeight,
    };
    const g = this.add.graphics();
    paintPanel(g, sheet, "card", "rest");

    // Ink title bar. It names the seat as well as the decision once there is
    // more than one seat: "Mulligan" on its own does not say *whose*, and with
    // two Captain Marvel seats even the hero's name does not — the aspect is
    // what tells them apart, so the whole identity line goes up there.
    const decider = state.game.players.find((player) => player.playerId === choice.playerId);
    const seat =
      state.game.players.length > 1 && decider ? characterPanel(state.game, decider.identity.instanceId, POOL_DEPS) : null;
    const bar: Rect = { x: sheet.x, y: sheet.y, width: sheet.width, height: seat ? 56 : 38 };
    const barG = this.add.graphics();
    barG.fillStyle(surface.ink.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);

    let titleRight = bar.x + bar.width - 10;
    if (seat) {
      // The identity card itself, so the seat is recognisable at a glance
      // rather than only readable.
      const thumb: Rect = { x: bar.x + bar.width - 46, y: bar.y + 5, width: 32, height: bar.height - 10 };
      const key = cardArt(this).request(this, seat.art);
      if (drawArt(this, key, thumb, { fit: "cover" })) titleRight = thumb.x - 8;
      else titleRight = bar.x + bar.width - 10;

      const nameRight = titleRight;
      this.add
        .text(nameRight, bar.y + 13, seat.name, textStyle(typeRole.rowTitle, surface.paper.hex))
        .setOrigin(1, 0);
      label(this, nameRight, bar.y + 31, seat.subtitle, typeRole.label, surface.paper.hex, ink.meta).setOrigin(1, 0);
      titleRight = nameRight - 120;
    }

    // Which card (and, where it can be pinned down, which ability) is actually asking — "Crimson Bands of Cyttorak
    // — Special: choose a target" rather than a bare, anonymous "Choose a target" (`view/choice-source.ts`'s own
    // doc comment covers what is and isn't derivable, and the one real engine gap it found doing this without
    // touching the engine). A thumb on the left mirrors the decider's own thumb on the right.
    let titleLeft = bar.x + 10;
    const sourceInstanceId = state.game ? choiceHeaderInstanceId(state.game, choice) : null;
    if (sourceInstanceId !== null && state.game) {
      const source = artFor(cardOf(state.game, sourceInstanceId), faceOf(state.game, sourceInstanceId));
      if (source) {
        const thumb: Rect = { x: titleLeft, y: bar.y + 5, width: 32, height: bar.height - 10 };
        const key = cardArt(this).request(this, source);
        if (drawArt(this, key, thumb, { fit: "cover" })) titleLeft = thumb.x + thumb.width + 8;
      }
    }

    const titleText = state.game ? choiceHeaderText(state.game, choice, POOL_DEPS, promptTitle(choice.prompt.kind)) : promptTitle(choice.prompt.kind);
    const title = this.add
      .text(titleLeft, bar.y + bar.height / 2, titleText, textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    fitText(title, Math.max(60, titleRight - titleLeft), typeRole.barTitle.size);

    // Why this player is the one deciding. The villain-phase screen's
    // "auto-advance paused" wording belongs to that screen, not here.
    const reason = decisionLabel(choice, state.game, state.perspectiveId);
    const advisory = this.add
      .text(
        sheet.x + 12,
        bar.y + bar.height + 10,
        choice.soleDecider ? `${reason} · Peril — nobody else may act` : reason,
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setWordWrapWidth(sheet.width - 24);
    label(
      this,
      sheet.x + 12,
      advisory.y + advisory.height + 6,
      `select ${choice.minSelections === choice.maxSelections ? choice.minSelections : `${choice.minSelections}–${choice.maxSelections}`}${choice.ordered ? " · order matters" : ""}`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );

    // The options: every legal answer the engine listed.
    const listTop = advisory.y + advisory.height + 26;
    const commitTop = sheet.y + sheet.height - hit.primary - 12;

    // A mulligan read as six words is not a decision a player can actually
    // make, so when every option names a card the options are the cards.
    const listHeight = commitTop - listTop - 8;

    if (asCards && listHeight >= 120) {
      this.#route = choiceFocusOrder(cardChoiceDisplayOrder(choice.options, this.#selected), choice.minSelections === 0);
      this.#drawCardChoice(
        {
          x: sheet.x + 12,
          y: listTop,
          width: sheet.width - 24,
          height: listHeight,
        },
        choice,
      );
      this.#drawCommit(sheet, commitTop, choice);
      this.cameras.main.setBackgroundColor(cssOf(accent.heroRed.hex, 0));
      return;
    }

    const rowHeight = hit.target;
    const capacity = Math.max(1, Math.floor(listHeight / (rowHeight + 4)));
    const shown = choice.options.slice(0, capacity);
    this.#route = choiceFocusOrder(shown.map((option) => option.optionId), choice.minSelections === 0);

    shown.forEach((option, index) => {
      const order = this.#selected.indexOf(option.optionId);
      // The engine labels a seat by its id; the table knows it by its hero.
      const text =
        option.ref.kind === "player" && state.game
          ? playerOptionLabel(state.game, option.ref.playerId, state.perspectiveId)
          : option.label;
      const rowLabel =
        choice.ordered && order >= 0
          ? `${order + 1}. ${text}`
          : text;
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: rowLabel,
          type: typeRole.rowTitle,
          rect: {
            x: sheet.x + 12,
            y: listTop + index * (rowHeight + 4),
            width: sheet.width - 24,
            height: rowHeight,
          },
          selected: order >= 0,
          onClick: () => this.#toggle(option.optionId, choice.maxSelections),
        }),
      );
      this.#focusRects.set(choiceFocusKey({ kind: "option", optionId: option.optionId }), {
        x: sheet.x + 12,
        y: listTop + index * (rowHeight + 4),
        width: sheet.width - 24,
        height: rowHeight,
      });
    });
    if (choice.options.length > capacity) {
      label(
        this,
        sheet.x + 12,
        commitTop - 16,
        `+${choice.options.length - capacity} more options — resize to see them`,
        typeRole.label,
        signal.caution.hex,
        ink.body,
      );
    }

    this.#drawCommit(sheet, commitTop, choice);
    this.cameras.main.setBackgroundColor(cssOf(accent.heroRed.hex, 0));
  }

  /**
   * The declareDefender choice's own presentation (W6, docs/phase4-screen-gaps.md): an incoming-attack summary, the
   * options with what each one would cost (`view/defend-choice.ts`'s `defendChoiceViewOf`, backed by the engine's
   * `defendPreview`/`stackEntries`/`legalActions` — nothing here computes a rule), the resolution stack with the open
   * window marked, and who's deciding. It answers with the same `resolveChoice([optionId])` the bare list below sends
   * — `#toggle`/`#confirm` are shared with it unchanged — so the command log reads no differently than it did before
   * this screen existed.
   *
   * A sibling scene was the other option W6 was told it could take; this stays a branch of `ChoiceOverlay` instead
   * because everything else the sheet needs — the subscription, the resize listener, card-art loading, Inspect's
   * toggle-back channel, and the keyboard/pad route (`#onIntent`/`#drawFocusRing`, unchanged below) — already lives
   * here, and a second scene would have to re-wire all of it rather than reuse it.
   */
  #drawDefendChoice(choice: PendingChoice, game: GameState, width: number, height: number): void {
    const view = defendChoiceViewOf(game, choice, POOL_DEPS, appSession().store.state.perspectiveId, this.#selected);
    if (!view) return;

    this.#route = choiceFocusOrder(view.options.map((option) => option.optionId), false);

    // Ink void, board dimmed but visible underneath (this class's own doc comment) — the design's own D10/P15
    // composition is a run of cream cards and an ink rail over a dark ground, never one big white sheet behind them.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.ink.hex, 0.7).fillRect(0, 0, width, height);

    const layout = defendChoiceLayout({ x: 0, y: 0, width, height });

    // Header: an ink bar naming the attack, same ground as the generic sheet's own title bar.
    const headerG = this.add.graphics();
    headerG.fillStyle(surface.ink.hex, 1).fillRect(layout.header.x, layout.header.y, layout.header.width, layout.header.height);
    const authorityTag = choice.soleDecider ? "PERIL" : "AUTHORITY: PLAYER";
    label(this, layout.header.x + layout.header.width - 12, layout.header.y + layout.header.height / 2, authorityTag, typeRole.label, surface.paper.hex, ink.secondary).setOrigin(1, 0.5);
    const headerTitle = this.add
      .text(layout.header.x + 12, layout.header.y + layout.header.height / 2, `${view.summary.attackerName} attacks ${view.summary.targetName}`, textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    fitText(headerTitle, layout.header.width - 140, typeRole.barTitle.size);

    // Incoming attack summary.
    const summaryG = this.add.graphics();
    paintPanel(summaryG, layout.summary, "card", "rest");
    let sy = layout.summary.y + 10;
    this.add.text(layout.summary.x + 12, sy, `Base ATK ${view.summary.baseAtk} · ${view.summary.facedownCount} boost card${view.summary.facedownCount === 1 ? "" : "s"} facedown`, textStyle(typeRole.rowTitle, surface.ink.hex));
    sy += 20;
    for (const note of view.summary.forcedNotes) {
      const t = this.add.text(layout.summary.x + 12, sy, note, textStyle(typeRole.body, surface.ink.hex, ink.secondary)).setWordWrapWidth(layout.summary.width - 24);
      sy += t.height + 4;
    }
    if (view.summary.boostAbilityNote) {
      const t = this.add.text(layout.summary.x + 12, sy, view.summary.boostAbilityNote, textStyle(typeRole.body, surface.ink.hex, ink.secondary)).setWordWrapWidth(layout.summary.width - 24);
      sy += t.height + 4;
    }
    const eventsLine = this.add
      .text(layout.summary.x + 12, sy, `Play a defense event: ${view.defenseEventsNote}`, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setWordWrapWidth(layout.summary.width - 24);
    sy += eventsLine.height + 4;
    this.add.text(layout.summary.x + 12, sy, view.rangeCaveat, textStyle(typeRole.label, surface.ink.hex, ink.label)).setWordWrapWidth(layout.summary.width - 24);

    // Options.
    const slots = defendOptionSlots(layout.options, view.options.length, layout.formFactor);
    view.options.forEach((option, index) => {
      const slot = slots[index];
      if (slot) this.#drawDefendOption(slot, option);
    });

    // The stack, "← here" on the open window.
    const stackG = this.add.graphics();
    paintPanel(stackG, layout.stack, "onInk", "rest");
    label(this, layout.stack.x + 10, layout.stack.y + 8, "the stack", typeRole.label, surface.paper.hex, ink.body);
    let rowY = layout.stack.y + 24;
    for (const row of view.stack) {
      const text = row.openWindow ? `${row.label} ← here` : row.label;
      const style = row.openWindow ? textStyle(typeRole.body, accent.heroRed.hex, 1) : textStyle(typeRole.body, surface.paper.hex, ink.secondary);
      const t = this.add.text(layout.stack.x + 10, rowY, text, style).setWordWrapWidth(layout.stack.width - 20);
      rowY += t.height + 4;
      if (rowY > layout.stack.y + layout.stack.height) break;
    }

    // Waiting on — light on the dark scrim, not the summary/option cards' dark-on-cream (this text sits directly on
    // the dimmed board, per the design's own D10 "WAITING ON" copy, which is likewise plain light text on the void).
    this.add
      .text(layout.waitingOn.x, layout.waitingOn.y, view.waitingOn, textStyle(typeRole.body, surface.paper.hex, ink.secondary))
      .setWordWrapWidth(layout.waitingOn.width)
      .setMaxLines(2);

    // One red commit, labeled with the current pick.
    const picked = view.options.find((option) => option.selected) ?? null;
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: picked ? `Confirm — ${picked.title}` : "Confirm",
        type: typeRole.barTitle,
        rect: layout.commit,
        enabled: this.#selected.length === 1,
        reason: "choose one option to continue",
        onClick: () => void this.#confirm(),
      }),
    );
    this.#focusRects.set(choiceFocusKey({ kind: "confirm" }), layout.commit);
    this.#drawFocusRing();

    this.cameras.main.setBackgroundColor(cssOf(accent.heroRed.hex, 0));
  }

  /**
   * One defend option, drawn as a card: title, what it costs, and its consequences — tap to select, Confirm to answer.
   *
   * `defendOptionSlots` reserves a full, non-overlapping cell per option so the layout never depends on how much any
   * one option has to say, but the card itself is only ever drawn (and only ever clickable) at its own content
   * height, top-aligned in that cell — a two-option defend (the common case) leaving most of a tall cell empty would
   * otherwise draw an oversized card with a large dead-looking blank lower half, which the design canvases never show.
   */
  #drawDefendOption(fullSlot: Rect, option: DefendOptionView): void {
    const slot: Rect = { ...fullSlot, height: Math.min(fullSlot.height, 190) };
    this.#focusRects.set(choiceFocusKey({ kind: "option", optionId: option.optionId }), slot);

    const g = this.add.graphics();
    paintPanel(g, slot, "card", option.selected ? "selected" : "rest");

    let y = slot.y + 8;
    const title = this.add.text(slot.x + 10, y, option.title, textStyle(typeRole.rowTitle, surface.ink.hex));
    fitText(title, slot.width - 20, typeRole.rowTitle.size);
    y += title.height + 4;

    const costLine =
      option.kind === "decline"
        ? "Stays ready."
        : `Exhausts ${option.exhaustsNames.join(", ")}${option.defenseReduction > 0 ? ` · DEF ${option.defenseReduction}` : ""}.`;
    const cost = this.add.text(slot.x + 10, y, costLine, textStyle(typeRole.label, surface.ink.hex, ink.secondary)).setWordWrapWidth(slot.width - 20);
    y += cost.height + 6;

    const damage = this.add.text(slot.x + 10, y, option.damageHeadline, {
      ...textStyle(typeRole.stat, accent.heroRed.hex),
    });
    y += damage.height + 4;

    if (option.hpAfter) {
      const hp = this.add.text(slot.x + 10, y, option.hpAfter, textStyle(typeRole.label, surface.ink.hex, ink.secondary));
      y += hp.height + 4;
    }

    if (option.consequences.length > 0 && y < slot.y + slot.height - 12) {
      this.add
        .text(slot.x + 10, y, option.consequences.join(" "), textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setWordWrapWidth(slot.width - 20)
        .setMaxLines(Math.max(1, Math.floor((slot.y + slot.height - y - 8) / 16)));
    }

    const zone = this.add.zone(slot.x, slot.y, slot.width, slot.height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => this.#toggle(option.optionId, 1));
  }

  /**
   * The options as two rows: what you have picked, above what you have not.
   *
   * A single row of six cards has to overlap to fit, and an overlapped card
   * shows a sliver of its left edge — enough to tell them apart, nowhere near
   * enough to *read* one. So picking a card lifts it out of the stack into its
   * own row, where the row is short enough to hold the picks without crowding.
   * Picking again pushes the previous pick down the stack and leaves the newest
   * one fully visible, so the card you just chose is always the readable one.
   */
  #drawCardChoice(area: Rect, choice: PendingChoice): void {
    const byId = new Map(
      choice.options.map((option) => [option.optionId, option] as const),
    );
    // Pick order, not list order: the last thing you touched is the last drawn,
    // and the last drawn is the one on top.
    const picked = this.#selected.flatMap((optionId) => {
      const option = byId.get(optionId);
      return option ? [option] : [];
    });
    const available = choice.options.filter(
      (option) => !this.#selected.includes(option.optionId),
    );

    const captionHeight = 16;
    const gap = 10;
    // The stack only gives up room once something is in the picked row, and
    // gives up all of it once nothing is left in the stack.
    const split = picked.length === 0 ? 0 : available.length === 0 ? 1 : 0.5;
    const pickedHeight =
      split === 0 ? 0 : Math.round((area.height - gap) * split);
    const availableHeight =
      area.height - pickedHeight - (pickedHeight > 0 ? gap : 0);

    if (pickedHeight > captionHeight + 40) {
      const row: Rect = {
        x: area.x,
        y: area.y,
        width: area.width,
        height: pickedHeight - captionHeight,
      };
      label(
        this,
        area.x,
        area.y,
        `selected ${picked.length}`,
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
      const slots = cardRow(
        { ...row, y: row.y + captionHeight },
        picked.length,
        { gap: 6 },
      );
      picked.forEach((option, index) => {
        const slot = slots[index];
        if (slot) this.#drawCardOption(slot, option, choice.ordered);
      });
    }

    if (available.length > 0 && availableHeight > captionHeight + 40) {
      const top = area.y + pickedHeight + (pickedHeight > 0 ? gap : 0);
      const row: Rect = {
        x: area.x,
        y: top + captionHeight,
        width: area.width,
        height: availableHeight - captionHeight,
      };
      label(
        this,
        area.x,
        top,
        picked.length > 0
          ? "tap to add · long press/right click to read it"
          : "tap to select · long press/right click to read it",
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
      const slots = cardRow(row, available.length, { gap: 6 });
      available.forEach((option, index) => {
        const slot = slots[index];
        if (slot) this.#drawCardOption(slot, option, choice.ordered);
      });
    }
  }

  /** One red commit, plus a quiet alternative when declining is legal. */
  #drawCommit(sheet: Rect, commitTop: number, choice: PendingChoice): void {
    const canCommit = canConfirmChoice(choice, this.#selected.length);
    const commitWidth =
      choice.minSelections === 0 ? (sheet.width - 32) / 2 : sheet.width - 24;

    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Confirm",
        type: typeRole.barTitle,
        rect: {
          x: sheet.x + 12,
          y: commitTop,
          width: commitWidth,
          height: hit.primary,
        },
        enabled: canCommit,
        reason: `choose ${confirmMinimum(choice)} to continue`,
        onClick: () => void this.#confirm(),
      }),
    );
    if (choice.minSelections === 0) {
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "Decline",
          type: typeRole.label,
          rect: {
            x: sheet.x + 20 + commitWidth,
            y: commitTop,
            width: commitWidth,
            height: hit.primary,
          },
          onClick: () => {
            this.#selected = [];
            void this.#confirm();
          },
        }),
      );
      this.#focusRects.set(choiceFocusKey({ kind: "decline" }), {
        x: sheet.x + 20 + commitWidth,
        y: commitTop,
        width: commitWidth,
        height: hit.primary,
      });
    }
    this.#focusRects.set(choiceFocusKey({ kind: "confirm" }), {
      x: sheet.x + 12,
      y: commitTop,
      width: commitWidth,
      height: hit.primary,
    });
    // Last in every rebuild, so the ring sits over the controls it frames.
    this.#drawFocusRing();
  }

  /**
   * One option drawn as the card it names. A selected card wears the red ring
   * and, when the order matters, the number it will resolve in.
   */
  #drawCardOption(
    slot: Rect,
    option: PendingChoice["options"][number],
    ordered: boolean,
  ): void {
    const { store } = appSession();
    const state = store.state.game;
    const instanceId = refInstanceId(option.ref);
    const order = this.#selected.indexOf(option.optionId);
    const picked = order >= 0;
    this.#focusRects.set(choiceFocusKey({ kind: "option", optionId: option.optionId }), slot);

    const g = this.add.graphics();
    paintPanel(g, slot, "card", picked ? "selected" : "rest");

    const inner: Rect = {
      x: slot.x + 3,
      y: slot.y + 3,
      width: slot.width - 6,
      height: slot.height - 6,
    };
    const source =
      state && instanceId
        ? artFor(
            state.cardPool[state.instances[instanceId]?.cardId ?? ""],
            faceOf(state, instanceId),
          )
        : null;
    const key = cardArt(this).request(this, source);
    /**
     * `contain`, not `cover`. The option slot is portrait — it was shaped for a
     * player card — but an option can be any card the engine offers, and a
     * scheme is a *landscape* card. `cover`'s contract is "only for a slot that
     * is already the card's own shape"; a landscape scan in this slot broke that
     * and cropped the scheme down to a detail of its own artwork, with its name
     * and threat box outside the frame. For the portrait cards this slot usually
     * holds the two fits are identical, so nothing is lost by being safe.
     */
    if (!drawArt(this, key, inner, { fit: "contain" })) {
      // No scan: the name is the option, exactly as the list form shows it.
      this.add
        .text(
          inner.x + inner.width / 2,
          inner.y + inner.height / 2,
          option.label,
          textStyle(typeRole.rowTitle, surface.ink.hex),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(inner.width - 8)
        .setMaxLines(3);
    }

    // "TRIGGER AN ABILITY?" and "pay for this ability?" name a card, but the
    // question is about one *ability* on it, not the card as a whole — and a
    // card can offer more than one at once, which would otherwise be two
    // identical-looking slots. So an ability option gets a caption strip
    // naming that ability specifically, straight off `abilityShortLabelOf`
    // (the same source the board's own ability affordance uses) — never a
    // guess from `option.label`, which is only ever the card's name here
    // (`resolve/window.ts`).
    if (state && instanceId && option.ref.kind === "ability") {
      const captionHeight = 20;
      const band: Rect = {
        x: inner.x,
        y: inner.y + inner.height - captionHeight,
        width: inner.width,
        height: captionHeight,
      };
      const bandG = this.add.graphics();
      bandG.fillStyle(surface.ink.hex, 0.85).fillRect(band.x, band.y, band.width, band.height);
      const short = abilityShortLabelOf(state, instanceId, option.ref.abilityId, POOL_DEPS);
      this.add
        .text(band.x + band.width / 2, band.y + band.height / 2, short ?? "trigger", {
          ...textStyle(typeRole.label, surface.paper.hex),
          fontSize: "11px",
        })
        .setOrigin(0.5)
        .setWordWrapWidth(band.width - 8)
        .setMaxLines(1);
    }

    if (picked && ordered) {
      const chip: Rect = {
        x: slot.x + 4,
        y: slot.y + 4,
        width: 22,
        height: 22,
      };
      const chipG = this.add.graphics();
      chipG
        .fillStyle(accent.heroRed.hex, 1)
        .fillRect(chip.x, chip.y, chip.width, chip.height);
      this.add
        .text(
          chip.x + chip.width / 2,
          chip.y + chip.height / 2,
          String(order + 1),
          textStyle(typeRole.statSmall, surface.paper.hex),
        )
        .setOrigin(0.5);
    }

    // Tap picks; press-and-hold or right-click blows the card up, which is the
    // only way to read one on a phone where six options share a row.
    const zone = this.add
      .zone(slot.x, slot.y, slot.width, slot.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    bindHoldTarget(this, zone, {
      key: option.optionId as string,
      onTap: () => this.#toggle(option.optionId, this.#maxSelections),
      // An option that is not a card has nothing to read; its press is only a tap.
      onInspect: instanceId
        ? () =>
            this.scene.launch(SCENES.inspect, {
              instanceId,
              choice: {
                optionId: option.optionId,
                label: picked ? "Deselect" : "Select",
              },
            })
        : undefined,
    });
  }

  /**
   * One intent from the keyboard or the pad, over the sheet's stated route
   * (`view/choice-focus.ts`). Arrows/Tab walk it, Enter/Space presses what is
   * focused, `I` reads a card option, Escape drops focus — it does not dismiss
   * the sheet, because an open decision has to be answered.
   */
  #onIntent(intent: GamepadIntent): void {
    const choice = appSession().store.state.game?.pendingChoice;
    if (!choice) return;
    switch (intent) {
      case "next":
      case "previous": {
        const at = this.#route.findIndex((target) => sameChoiceTarget(target, this.#focus));
        const next = stepFocus(this.#route, at, intent === "next" ? 1 : -1);
        this.#focus = next >= 0 ? (this.#route[next] ?? null) : null;
        this.#drawFocusRing();
        break;
      }
      case "activate":
        this.#activate(choice);
        break;
      case "inspect":
        if (this.#focus?.kind === "option") this.#inspectOption(choice, this.#focus.optionId);
        break;
      case "cancel":
        this.#focus = null;
        this.#drawFocusRing();
        break;
    }
  }

  /** Enter on the focused control means exactly what a tap on it means — including nothing, for a Confirm that isn't ready. */
  #activate(choice: PendingChoice): void {
    const focus = this.#focus;
    if (!focus) return;
    if (focus.kind === "option") {
      this.#toggle(focus.optionId, choice.maxSelections);
      return;
    }
    if (focus.kind === "decline") {
      if (choice.minSelections === 0) {
        this.#selected = [];
        void this.#confirm();
      }
      return;
    }
    if (canConfirmChoice(choice, this.#selected.length)) void this.#confirm();
  }

  #inspectOption(choice: PendingChoice, optionId: string): void {
    const option = choice.options.find((candidate) => candidate.optionId === optionId);
    const instanceId = option ? refInstanceId(option.ref) : null;
    if (!instanceId) return;
    this.scene.launch(SCENES.inspect, {
      instanceId,
      choice: { optionId, label: this.#selected.includes(optionId) ? "Deselect" : "Select" },
    });
  }

  /** Static, not pulsing: the ring says "here you are", not "act now" — the Board's convention. */
  #drawFocusRing(): void {
    this.#focusRing?.destroy();
    this.#focusRing = null;
    const focus = this.#focus;
    if (!focus) return;
    if (!this.#route.some((target) => sameChoiceTarget(target, focus))) {
      this.#focus = null;
      return;
    }
    const rect = this.#focusRects.get(choiceFocusKey(focus));
    if (!rect) return;
    this.#focusRing = new McSelectionRing(this);
    this.#focusRing.show(rect, "static", true);
  }

  #onInspectToggle(optionId: string): void {
    this.#toggle(optionId, this.#maxSelections);
  }

  #toggle(optionId: string, max: number): void {
    const at = this.#selected.indexOf(optionId);
    if (at >= 0)
      this.#selected = this.#selected.filter((id) => id !== optionId);
    else if (max === 1) this.#selected = [optionId];
    else if (this.#selected.length < max)
      this.#selected = [...this.#selected, optionId];
    this.#rebuild();
  }

  async #confirm(): Promise<void> {
    // The store issues this as the player the engine named, not as "the human".
    await appSession().store.resolveChoice(this.#selected);
  }
}

/**
 * The card a `ChoiceRef` names, when it names one at all. `"card"` and
 * `"ability"` both do — an ability option is still an ability *on* a card,
 * so it renders as that card exactly like a `"card"` option does. `"player"`
 * and `"none"` don't name a card and fall through to the plain list.
 */
function refInstanceId(ref: ChoiceRef): InstanceId | null {
  return ref.kind === "card" || ref.kind === "ability" ? ref.instanceId : null;
}

/**
 * "Spider-Man / Peter Parker · Hero · 7/10 HP · you" — both faces, which side
 * is up, and how hurt, which is usually what the player is choosing on.
 */
function playerOptionLabel(game: GameState, playerId: PlayerId, perspectiveId: PlayerId | null): string {
  const seat = game.players.find((player) => player.playerId === playerId);
  if (!seat) return playerId;
  const panel = characterPanel(game, seat.identity.instanceId, POOL_DEPS);
  return [
    seatIdentityName(game, playerId),
    seat.identity.form === "hero" ? "Hero" : "Alter-ego",
    panel.hp ? `${panel.hp.current}/${panel.hp.max} HP` : null,
    seat.eliminated ? "eliminated" : null,
    playerId === perspectiveId ? "you" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The design's overlay titles for the engine's prompt kinds. */
function promptTitle(kind: string): string {
  const titles: Record<string, string> = {
    declareDefender: "Declare a defender",
    discardDownToHandSize: "Discard to hand size",
    mulligan: "Mulligan",
    chooseMinionToActivate: "Choose a minion to activate",
    orderEnemies: "Order the enemies",
    orderPlayers: "Order the players",
    orderCards: "Put these back in any order",
    orderTriggers: "Order these effects",
    chooseTriggers: "Trigger an ability?",
    chooseTarget: "Choose a target",
    chooseAttachmentTarget: "Choose a host",
    chooseCards: "Choose cards",
    chooseOption: "Choose one",
    choosePlayer: "Choose a player",
    orderSpecials: "Order the special abilities",
    payForCard: "Pay for this card?",
    payForAbility: "Pay for this ability?",
    spendResources: "Spend resources?",
    discardOverAllyLimit: "Discard to your ally limit",
    discardRestricted: "Discard to two restricted cards",
  };
  return titles[kind] ?? "Choose";
}
