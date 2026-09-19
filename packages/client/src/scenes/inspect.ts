/**
 * The Inspect overlay: one card, whole.
 *
 * The table caps rules text at two lines on purpose (Components.dc.html section
 * 06, "numbers before prose"), which only works if the full wording is always
 * one gesture away. This is that gesture's destination, and it runs in parallel
 * over Board so the table stays visible behind the scrim.
 *
 * **Rebuilt to D08/P14 (owner feedback, 2026-09-18): "The inspect screen looks
 * better in the screenshots with more info showing."** Two shapes, chosen by
 * `view/inspect-layout.ts#inspectLayout` (its own doc comment has the D08/T06
 * tablet reasoning):
 *  - **Panels** (every non-phone form factor, tablet included): a paper card
 *    panel — cost chip, Bangers name, type line, the scan, rules text, resource
 *    pips, set/collector footer — beside an ink "Rules & state" panel: "right
 *    now" (the engine's own playable/unplayable sentence, enriched with the
 *    open payment's resources-committed count when one exists for this exact
 *    card), "timing" (ability-header glossary entries — honestly empty for
 *    most cards; see `view/inspect-model.ts#timingEntriesFor`'s own comment
 *    for why), tappable keyword chips (open Rules at that term), "this card,
 *    this game" (the accumulated per-instance history), and PLAY IT / USE AS
 *    RESOURCE.
 *  - **Sheet** (phone only): a bottom sheet over the dimmed board — a grab
 *    handle, a scrolling body (thumbnail, name, type, keyword chips, rules
 *    text, then the same keyword definitions and "this game" history folded
 *    into the same scroll — see the note in `#drawSheetContent`), and a sticky
 *    footer (PLAY N / PAY WITH, then FULL RULES TEXT / CLOSE). "Full rules
 *    text" expands the sheet to the full viewport height.
 *
 * Everything on the card face comes from `@mc/content`; everything on the
 * rules/state side comes from the engine (`legalActions`, the glossary, and
 * the client's own accumulated card-history fold, `view/card-history.ts`,
 * read off the live Board scene). This scene decides nothing — it only asks
 * `view/inspect-model.ts` and draws the answer.
 *
 * Z-ORDER VS. THE PENDING-CHOICE OVERLAY (`scenes/choice.ts`)
 * ---------------------------------------------------------------------------
 * `scenes/villain-phase.ts` calls `this.scene.bringToTop(SCENES.choice)` on
 * every store update while a choice is open, so the sheet the player must
 * *act* on always wins over the walkthrough that only narrates
 * (`villain-phase.ts`'s own doc comment). `bringToTop` doesn't just set a
 * z-index, it splices the scene to the tail of the Scene Manager's render
 * list — a standing position that survives until something moves it again.
 * So the first villain-phase decision of a game leaves `SCENES.choice`
 * sitting above `SCENES.inspect`'s ordinary (registration-order) position for
 * the rest of the session, in or out of the villain phase — the bug where
 * Inspect, opened by right-clicking a card inside an open choice (e.g.
 * Black Panther's discard search), rendered *behind* the choice sheet that
 * launched it.
 *
 * Here the priority is the opposite of the villain-phase/choice one: Inspect
 * was just opened *deliberately* by the player to read the very card the
 * choice is asking about, so it must win. `#rebuild` re-asserts
 * `bringToTop(SCENES.inspect)` every time it runs — i.e. on every store
 * update this scene is subscribed to, the same cadence `villain-phase.ts`
 * uses for its own claim — so whichever of the two fires last for a given
 * tick decides the frame, and `SessionStore.subscribe` notifies listeners in subscription
 * order (a `Set`, iterated in insertion order): Inspect always subscribes
 * *after* Choice/VillainPhase, because it is only ever launched from a click
 * inside one of them, so its claim always runs last and wins. Dismissing
 * Inspect only stops the Inspect scene (`#close`); it never touches Choice,
 * so the choice sheet — never stopped, only briefly drawn-under — is exactly
 * what reappears once Inspect closes.
 */

import Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import type { AnyCard, CardId } from "@mc/content";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { cardArt, drawArt } from "../art/card-art.js";
import type { CardFace } from "../art/art-source.js";
import { appSession } from "../session.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, McScrollPanel, label, paintDotGrid } from "../ui/widgets.js";
import { estimateWrappedLines, type Rect } from "../view/layout.js";
import { cardFaceLayout, inspectLayout, type InspectLayout } from "../view/inspect-layout.js";
import { emptyCardHistoryLog } from "../view/card-history.js";
import { cardInspectModel, inspectModel, type InspectModel, type InspectPayment } from "../view/inspect-model.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { PressArm } from "../view/press-arm.js";
import { bindGamepad, bindKeyboard } from "./board/input.js";
import type { BoardScene } from "./board.js";
import type { RulesSceneData } from "./rules.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";

/** What the caller hands over when it launches this overlay. */
export interface InspectData {
  /** A card in play or in hand. Omitted before a game exists. */
  readonly instanceId?: InstanceId;
  /**
   * A card with no game behind it — the Title screen's pickers. The face is
   * explicit because a villain's picture and text live on its stage and a
   * hero's on its hero side.
   */
  readonly card?: { readonly cardId: CardId; readonly face: CardFace };
  /** Cards the ◂ ▸ keys step through — the hand, when inspect was opened from it. */
  readonly siblings?: readonly InstanceId[];
  /**
   * Set when the sheet was opened from an open decision. The card is then an
   * *answer*, not a card on the table, so the sheet offers that answer directly
   * — which is the whole point of blowing it up on a phone, where the option
   * itself is a thumbnail in a stack.
   */
  readonly choice?: {
    readonly optionId: string;
    /** "Select" or "Deselect": the caller knows which, this scene doesn't. */
    readonly label: string;
  };
  /**
   * Shown where the choice buttons would be, when the card can be read but not
   * chosen — "Captain Marvel is already at the table". The card is still worth
   * opening: reading it is how the player finds out why.
   */
  readonly note?: string;
}

/** How far down the scroll panel's own body a keyword chip / history row could hide — a fixed cap on how much the sections above it may claim, so the panel never runs out of room for its buttons. */
const MIN_SCROLL_HEIGHT = 60;

export class InspectOverlay extends Phaser.Scene {
  #instanceId: InstanceId | null = null;
  #siblings: readonly InstanceId[] = [];
  #choice: InspectData["choice"] = undefined;
  #card: InspectData["card"] = undefined;
  #note: string | undefined = undefined;
  #buttons: McButton[] = [];
  #scrollPanels: McScrollPanel[] = [];
  #unsubscribe: (() => void) | null = null;
  /** Phone only — "Full rules text" grows the sheet to the full viewport (P14's own instruction). Resets on step/reopen. */
  #expanded = false;
  /**
   * Arms a dismiss on this sheet's own down+up (`view/press-arm.ts`), shared
   * by the scrim and the card panel: the gesture that *opened* the sheet
   * (a right-click or a hold) began on whatever card was under it, before
   * this scrim existed, so its matching pointerup never counts as a down
   * seen here — the sheet would otherwise vanish the instant you let go of
   * the press that opened it. The sheet's buttons (`McButton`) carry their
   * own `PressArm` for the identical reason.
   */
  #dismissArm = new PressArm();
  /** What the sheet's primary button does this rebuild — what Enter presses. Null when there is none. */
  #primaryAction: (() => void) | null = null;

  constructor() {
    super({ key: SCENES.inspect });
  }

  create(data: InspectData): void {
    this.#instanceId = data.instanceId ?? null;
    this.#siblings = data.siblings ?? [];
    this.#choice = data.choice;
    this.#card = data.card;
    this.#note = data.note;
    this.#expanded = false;

    const { store } = appSession();
    // Only a card in a game can change underneath the sheet.
    if (!this.#card) this.#unsubscribe = store.subscribe(() => this.#rebuild());
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
    // A scan that arrives while the sheet is open should appear in it.
    const artOff = cardArt(this).onArrived(() => this.#rebuild());

    // The same five intents the Board and the choice sheet speak, so a pad
    // works here too. Both of those are blocked while this sheet is open.
    const binding = { blocked: () => false, onIntent: (intent: GamepadIntent) => this.#onIntent(intent) };
    bindKeyboard(this, binding);
    bindGamepad(this, binding);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      artOff();
    });
    this.#rebuild();
  }

  #close(): void {
    this.scene.stop();
  }

  /**
   * ◂ ▸ (and Tab) step through the list the sheet was opened from, Enter or
   * Space presses the primary button — Select, the first ability, or Play it —
   * and Escape closes. `inspect` means nothing here: this already is Inspect.
   */
  #onIntent(intent: GamepadIntent): void {
    switch (intent) {
      case "next":
        this.#step(1);
        break;
      case "previous":
        this.#step(-1);
        break;
      case "activate":
        this.#primaryAction?.();
        break;
      case "cancel":
        this.#close();
        break;
      default:
        break;
    }
  }

  /** ◂ ▸ through whatever list the overlay was opened from. */
  #step(direction: number): void {
    if (this.#siblings.length < 2 || !this.#instanceId) return;
    const at = this.#siblings.indexOf(this.#instanceId);
    if (at < 0) return;
    const next = this.#siblings[(at + direction + this.#siblings.length) % this.#siblings.length];
    if (next) {
      this.#instanceId = next;
      this.#expanded = false;
      this.#rebuild();
    }
  }

  /** The live Board scene, when one is running underneath — the source of the card-history fold and the open payment, neither of which lives on the store. */
  #boardScene(): BoardScene | null {
    if (!this.scene.isActive(SCENES.board)) return null;
    return this.scene.get(SCENES.board) as BoardScene;
  }

  #rebuild(): void {
    const model = this.#model();
    if (!model) return;

    // See the "Z-ORDER VS. THE PENDING-CHOICE OVERLAY" note at the top of
    // this file: re-claimed every rebuild so a later villain-phase/choice
    // claim in the same tick never wins.
    this.scene.bringToTop(SCENES.inspect);

    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const panel of this.#scrollPanels) panel.destroy();
    this.#scrollPanels = [];
    destroyChildren(this);
    this.#dismissArm = new PressArm();
    this.#primaryAction = null;

    const { width, height } = this.scale.gameSize;
    const layout = inspectLayout({ x: 0, y: 0, width, height }, { expanded: this.#expanded });

    // The scrim is a dismiss target as well as a scrim: the design says "click
    // anywhere to dismiss", so the whole backdrop takes the tap. On phone the
    // backdrop is P14's own dimmed *board* (Board keeps drawing underneath, at
    // reduced opacity through this scrim) rather than the panels' purpose-built
    // felt ground, so it reads noticeably lighter there.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, layout.mode === "sheet" ? 0.72 : 0.9).fillRect(0, 0, width, height);
    if (layout.mode === "panels") paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", { spacing: 8, radius: 1, alpha: 0.13 }).setAlpha(0.7);
    // Dismiss on a *fresh* press, not on the release of the press that opened
    // the sheet. Inspect opens on pointerdown (a right-click or a hold), so the
    // matching pointerup lands on a scrim that did not exist when the gesture
    // began — which made the sheet vanish the moment you let go.
    this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerdown", () => this.#dismissArm.down())
      .on("pointerup", () => {
        if (this.#dismissArm.up()) this.#close();
      });

    if (layout.mode === "panels") this.#drawPanels(layout, model);
    else this.#drawSheet(layout, model);

    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex, 0));
  }

  /**
   * The sheet's subject: a card in a game, or a card from the content alone.
   * Null when there is neither, which is the one case worth drawing nothing for.
   */
  #model(): InspectModel | null {
    if (this.#card) return cardInspectModel(CARDS_BY_ID.get(this.#card.cardId as string), this.#card.face);
    const { store } = appSession();
    const state = store.state;
    if (!state.game || state.perspectiveId === null || !this.#instanceId) return null;
    const board = this.#boardScene();
    const paymentView = board?.paymentView() ?? null;
    const payment: InspectPayment | null = paymentView
      ? {
          subjectInstanceId: paymentView.subject,
          paid: paymentView.paid,
          required: paymentView.required,
          spendableInstanceIds: new Set(paymentView.spendable.keys()),
        }
      : null;
    return inspectModel(state.game, this.#instanceId, state.legal?.actions ?? null, state.perspectiveId, POOL_DEPS, {
      history: board?.cardHistory() ?? emptyCardHistoryLog(),
      payment,
    });
  }

  // ---------------------------------------------------------------------
  // Panels mode (D08): desktop and tablet, both orientations.
  // ---------------------------------------------------------------------

  #drawPanels(layout: Extract<InspectLayout, { mode: "panels" }>, model: InspectModel): void {
    this.#drawCardPanel(layout.card, model);
    this.#drawRulesPanel(layout.rules, model);
    const hint =
      this.#siblings.length > 1
        ? "◂ previous card in hand · next ▸ · click anywhere to dismiss"
        : "click anywhere to dismiss";
    label(this, layout.hint.x + layout.hint.width / 2, layout.hint.y + layout.hint.height / 2, hint, typeRole.label, surface.paper.hex, ink.meta).setOrigin(0.5);
  }

  /** A hard-offset drop shadow, the one shadow shape D08 draws besides the selection ring. */
  #drawShadow(rect: Rect, offset = 8): void {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4).fillRect(rect.x + offset, rect.y + offset, rect.width, rect.height);
  }

  /** The card face: everything `@mc/content` prints on it. */
  #drawCardPanel(rect: Rect, model: InspectModel): void {
    this.#drawShadow(rect);
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(5, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    // The card panel carries no controls, so it dismisses like the scrim does.
    this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerdown", () => this.#dismissArm.down())
      .on("pointerup", () => {
        if (this.#dismissArm.up()) this.#close();
      });

    // `largeCardText` (Settings, docs/phase4-screen-gaps.md §3 "W4") is read
    // here rather than app-wide: this sheet's whole job is reading a card's
    // full text closely, which is exactly the accessibility need that setting
    // names (`settings.ts`'s own doc comment).
    const bodySize = appSession().settings.largeCardText ? 17 : 14;
    const bodyWidth = rect.width - 28;
    const charWidth = bodySize * 0.5;
    let content = model.rulesText;
    let lines = estimateWrappedLines(model.rulesText, bodyWidth, charWidth);
    if (model.printedText) {
      content += `\n\nPRINTED TEXT (superseded by errata)\n${model.printedText}`;
      lines += estimateWrappedLines(model.printedText, bodyWidth, charWidth) + 3;
    }
    if (model.flavor) {
      content += `\n\n${model.flavor}`;
      lines += estimateWrappedLines(model.flavor, bodyWidth, charWidth) + 2;
    }

    const face = cardFaceLayout(rect, { rulesTextLines: lines, hasStats: model.stats.length > 0, hasIcons: model.resourceIcons.length > 0 });

    // Header: cost chip, name, type line.
    let nameLeft = rect.x + 14;
    if (model.cost !== null) {
      const chip: Rect = { x: rect.x + 5, y: rect.y + 5, width: 54, height: face.header.height - 5 };
      const chipG = this.add.graphics();
      chipG.fillStyle(signal.cost.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
      this.add
        .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(model.cost), { ...textStyle(typeRole.screenTitle, surface.paper.hex), fontSize: "40px" })
        .setOrigin(0.5);
      nameLeft = chip.x + chip.width + 12;
    }
    this.add
      .text(nameLeft, rect.y + 12, caseOf(typeRole.barTitle, model.name), {
        ...textStyle(typeRole.barTitle, surface.ink.hex),
        fontSize: `${Math.min(32, Math.max(20, Math.round(rect.width / 13)))}px`,
      })
      .setLetterSpacing(1)
      .setWordWrapWidth(rect.x + rect.width - 12 - nameLeft)
      .setMaxLines(1);
    label(this, nameLeft, rect.y + 46, model.typeLine, typeRole.label, surface.ink.hex, ink.label);
    this.#fillRule(face.headerRule);

    if (face.art) {
      const frame = this.add.graphics();
      frame.fillStyle(surface.parchment.hex, 1).fillRect(face.art.x, face.art.y, face.art.width, face.art.height);
      const key = cardArt(this).request(this, model.art);
      if (!drawArt(this, key, face.art)) {
        label(this, face.art.x + face.art.width / 2, face.art.y + face.art.height / 2, model.hidden ? "facedown" : "no scan", typeRole.label, surface.ink.hex, ink.meta).setOrigin(0.5);
      }
      if (face.artRule) this.#fillRule(face.artRule);
    }

    if (face.stats && model.stats.length > 0) {
      // A modified stat says so in words, e.g. "THW 2 (+1)": the sheet is text, and
      // colour alone never carries meaning.
      const statLine = model.stats.map((tile) => `${tile.label} ${tile.value}${tile.bonus ? ` (${tile.bonus > 0 ? "+" : "−"}${Math.abs(tile.bonus)})` : ""}`).join("  ·  ");
      this.add.text(face.stats.x, face.stats.y, statLine, textStyle(typeRole.stat, surface.ink.hex)).setLetterSpacing(1);
    }

    if (face.scroll.height > 20) {
      // Rules text, the superseded-by-errata printed text, and flavor, in one
      // scrolling region rather than three stacked `Text` objects that could
      // each run past the card's own edge. Errata's red label and flavor's
      // dimmer ink are lost in the merge — rexUI's `BBCodeText` could recover
      // them, but card text prints literal `[energy]`/`[mental]`-style tokens
      // that `BBCodeText` would read as markup, so a uniform style is the
      // trade for not corrupting those.
      const panel = new McScrollPanel(this, { rect: face.scroll, text: content, type: { ...typeRole.body, size: bodySize } });
      this.#scrollPanels.push(panel);
    }

    if (face.icons && model.resourceIcons.length > 0) {
      model.resourceIcons.forEach((icon, index) => {
        const box: Rect = { x: face.icons!.x + index * 22, y: face.icons!.y, width: 18, height: 18 };
        const pip = this.add.graphics();
        pip.fillStyle(signal.cost.hex, 1).fillRect(box.x, box.y, box.width, box.height);
        this.add.text(box.x + box.width / 2, box.y + box.height / 2, icon.charAt(0).toUpperCase(), textStyle(typeRole.label, surface.paper.hex)).setOrigin(0.5);
      });
      label(this, face.icons.x + 4 + model.resourceIcons.length * 22, face.icons.y + 5, `generates ${model.resourceIcons.join(", ")} when spent`, typeRole.label, surface.ink.hex, ink.label);
    }

    this.#fillRule(face.footerRule);
    label(this, rect.x + 14, face.footer.y + 12, model.footerLeft, typeRole.label, surface.ink.hex, ink.label);
    label(this, rect.x + rect.width - 14, face.footer.y + 12, model.footerRight, typeRole.label, surface.ink.hex, ink.label).setOrigin(1, 0);
  }

  #fillRule(rect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  /** "Rules & state": the engine's verdict, timing, keywords, this card's own history, and the one useful action. */
  #drawRulesPanel(rect: Rect, model: InspectModel): void {
    this.#drawShadow(rect);
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(5, surface.paper.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();

    this.add.text(rect.x + 18, rect.y + 16, caseOf(typeRole.barTitle, "Rules & state"), textStyle(typeRole.barTitle, surface.paper.hex)).setLetterSpacing(1);
    const chipWidth = 62;
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Esc",
        type: typeRole.label,
        rect: { x: rect.x + rect.width - chipWidth - 14, y: rect.y + 12, width: chipWidth, height: 30 },
        onClick: () => this.#close(),
      }),
    );

    const inner = rect.width - 36;
    const buttonsTop = rect.y + rect.height - hit.primary - 16;
    let y = rect.y + 52;

    // "Right now" — the engine's own sentence, merged with the legal-target list into one red callout, exactly as
    // D08 draws it. Skipped while this card *is* the answer to an open decision: "a decision is open, answer it
    // first" is unhelpful when answering it is exactly what the button below does.
    if ((model.status.message || model.priceNote) && !this.#choice) {
      label(this, rect.x + 18, y, "right now", typeRole.label, surface.paper.hex, ink.meta);
      y += 16;
      const sentence = [model.status.message, model.priceNote, model.status.targets.length > 0 ? `Legal targets: ${model.status.targets.join(", ")}.` : null]
        .filter((part): part is string => Boolean(part))
        .join(" ");
      const text = this.add.text(rect.x + 30, y + 10, sentence, textStyle(typeRole.body, surface.paper.hex)).setFontSize(12).setWordWrapWidth(inner - 24);
      const box: Rect = { x: rect.x + 18, y, width: inner, height: text.height + 20 };
      const callout = this.add.graphics();
      callout.fillStyle(accent.heroRed.hex, 0.2).fillRect(box.x, box.y, box.width, box.height);
      callout.lineStyle(3, accent.heroRed.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
      this.children.bringToTop(text);
      y += box.height + 18;
    }

    // "Timing" — see `view/inspect-model.ts#timingEntriesFor`'s own comment on why most cards show nothing here.
    if (model.timing.length > 0) {
      label(this, rect.x + 18, y, "timing", typeRole.label, surface.paper.hex, ink.meta);
      y += 16;
      for (const entry of model.timing) {
        const heading = this.add.text(rect.x + 18, y, entry.label, { ...textStyle(typeRole.body, surface.paper.hex), fontStyle: "700" });
        y += heading.height + 2;
        const body = this.add.text(rect.x + 18, y, `${entry.definition} (${entry.citeLabel})`, textStyle(typeRole.body, surface.paper.hex, ink.secondary)).setWordWrapWidth(inner);
        y += body.height + 12;
      }
      y += 6;
    }

    // "Keywords on this card" — chips a tap opens the Rules overlay at.
    if (model.keywordChips.length > 0) {
      y = this.#drawChips(rect, y, inner, "keywords on this card", model.keywordChips.map((chip) => ({ text: chip.text, glossaryId: chip.glossaryId })));
    }
    if (model.traits.length > 0) {
      y = this.#drawChips(rect, y, inner, "traits", model.traits.map((trait) => ({ text: trait, glossaryId: null })));
    }

    // "This card, this game" — the accumulated per-instance history, scrolled if it runs long.
    const historyBottom = this.#note || this.#choice ? buttonsTop - 16 : buttonsTop - 16;
    if (model.history.length > 0 && historyBottom - y > MIN_SCROLL_HEIGHT) {
      label(this, rect.x + 18, y, "this card, this game", typeRole.label, surface.paper.hex, ink.meta);
      y += 16;
      const historyRect: Rect = { x: rect.x + 18, y, width: inner, height: Math.max(0, historyBottom - y) };
      const historyText = model.history.map((line) => `${line.roundTag}   ${line.text}`).join("\n");
      const panel = new McScrollPanel(this, { rect: historyRect, text: historyText, type: typeRole.body, onInk: true });
      this.#scrollPanels.push(panel);
    }

    // Why this card cannot be chosen, where the choice buttons would be.
    if (this.#note) {
      const box: Rect = { x: rect.x + 18, y: buttonsTop, width: inner, height: hit.primary };
      const callout = this.add.graphics();
      callout.fillStyle(accent.heroRed.hex, 0.2).fillRect(box.x, box.y, box.width, box.height);
      callout.lineStyle(3, accent.heroRed.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
      this.add.text(box.x + box.width / 2, box.y + box.height / 2, this.#note, textStyle(typeRole.body, surface.paper.hex)).setOrigin(0.5).setWordWrapWidth(box.width - 20).setMaxLines(2);
      return;
    }

    // Answering the open decision, when the sheet was opened from one.
    if (this.#choice) {
      const { optionId, label: choiceLabel } = this.#choice;
      const buttonWidth = (inner - 9) / 2;
      const choose = (): void => {
        this.#close();
        this.game.events.emit("mc-choice-toggle", optionId);
      };
      this.#primaryAction = choose;
      this.#buttons.push(new McButton(this, { kind: "primary", label: choiceLabel, type: typeRole.barTitle, rect: { x: rect.x + 18, y: buttonsTop, width: buttonWidth, height: hit.primary }, onClick: choose }));
      this.#buttons.push(new McButton(this, { kind: "quiet", label: "Cancel", type: typeRole.label, rect: { x: rect.x + 27 + buttonWidth, y: buttonsTop, width: buttonWidth, height: hit.primary }, onClick: () => this.#close() }));
      return;
    }

    // A card in play with a usable action ability: one button per ability, checked *before* "Play it" below.
    // `model.status.playable` is also true for these (`statusOf` finds either a `playCard` or a `useAbility` match
    // and doesn't tell them apart), so without this order a card with an ability and no play of its own would show
    // "Play it" and silently do nothing when tapped — `#playCard` only ever looks for a `playCard` entry.
    if (model.abilities.length > 0) {
      const instanceId = this.#instanceId;
      const area: Rect = { x: rect.x + 18, y: buttonsTop, width: inner, height: hit.primary };
      const rowHeight = model.abilities.length === 1 ? area.height : Math.max(hit.target, area.height / model.abilities.length);
      model.abilities.forEach((ability, index) => {
        const rowRect: Rect = { x: area.x, y: area.y + area.height - (model.abilities.length - index) * (rowHeight + 4), width: area.width, height: rowHeight };
        const use = (): void => {
          this.#close();
          if (instanceId) this.game.events.emit("mc-use-ability", instanceId, ability.abilityId);
        };
        if (index === 0) this.#primaryAction = use;
        this.#buttons.push(new McButton(this, { kind: index === 0 ? "primary" : "secondary", label: ability.label, type: model.abilities.length === 1 ? typeRole.barTitle : typeRole.label, rect: rowRect, onClick: use }));
      });
      return;
    }

    this.#drawPlayAndPayButtons(rect, model, { x: rect.x + 18, y: buttonsTop, width: inner, height: hit.primary });
  }

  /** PLAY IT / USE AS RESOURCE — the design's own pair (D08), split when both apply, either one full-width alone. */
  #drawPlayAndPayButtons(rect: Rect, model: InspectModel, area: Rect): void {
    const showPlay = model.status.playable === true;
    const showPay = model.canPayAsResource;
    if (!showPlay && !showPay) return;
    const gap = showPlay && showPay ? 9 : 0;
    const width = showPlay && showPay ? (area.width - gap) / 2 : area.width;
    let x = area.x;

    const play = (): void => {
      const instanceId = this.#instanceId;
      this.#close();
      if (instanceId) this.game.events.emit("mc-play-card", instanceId);
    };
    const payWith = (): void => {
      const instanceId = this.#instanceId;
      this.#close();
      if (instanceId) this.#boardScene()?.payWithCard(instanceId);
    };

    if (showPlay) {
      this.#primaryAction = play;
      this.#buttons.push(new McButton(this, { kind: "primary", label: "Play it", type: typeRole.barTitle, rect: { x, y: area.y, width, height: area.height }, onClick: play }));
      x += width + gap;
    }
    if (showPay) {
      if (!showPlay) this.#primaryAction = payWith;
      this.#buttons.push(new McButton(this, { kind: "onInk", label: "Use as resource", type: showPlay ? typeRole.label : typeRole.barTitle, rect: { x, y: area.y, width, height: area.height }, onClick: payWith }));
    }
  }

  /**
   * A labeled row of tappable chips (keywords → the Rules overlay at that term; traits carry no `glossaryId` and
   * are plain text-in-a-box). Returns the next y. Deliberately raw graphics rather than `McButton` per chip: the
   * design's chip is a transparent outline, and every widget skin (`ui/theme.ts#skin`) fills its control — a
   * `McButton` chip would read as a small filled block instead. Each chip still gets its own `PressArm` so a chip
   * that appears mid-rebuild is never accidentally activated by the release of the gesture that opened this sheet
   * (the exact hazard `#dismissArm`'s own comment documents for the scrim).
   */
  #drawChips(rect: Rect, top: number, inner: number, heading: string, items: readonly { readonly text: string; readonly glossaryId: string | null }[]): number {
    if (items.length === 0) return top;
    label(this, rect.x + 18, top, heading, typeRole.label, surface.paper.hex, ink.meta);
    let x = rect.x + 18;
    let y = top + 16;
    for (const item of items) {
      const text = this.add.text(x + 8, y + 5, caseOf(typeRole.label, item.text), textStyle(typeRole.label, surface.paper.hex)).setLetterSpacing(typeRole.label.letterSpacing);
      const chipWidth = text.width + 16;
      if (x + chipWidth > rect.x + 18 + inner) {
        x = rect.x + 18;
        y += 28;
        text.setPosition(x + 8, y + 5);
      }
      const chip = this.add.graphics();
      chip.lineStyle(2, surface.paper.hex, 1).strokeRect(x, y, chipWidth, 22);
      this.children.bringToTop(text);
      if (item.glossaryId) {
        const glossaryId = item.glossaryId;
        const arm = new PressArm();
        const zone = this.add.zone(x, y, chipWidth, 22).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        zone.on("pointerdown", () => arm.down());
        zone.on("pointerout", () => arm.cancel());
        zone.on("pointerup", () => {
          if (arm.up()) this.#openRulesAt(glossaryId, item.text);
        });
      }
      x += chipWidth + 7;
    }
    return y + 40;
  }

  #openRulesAt(glossaryId: string, displayText: string): void {
    // The glossary is searched by its own display name, not the value-instantiated chip text ("Retaliate 1" would
    // not match the entry's own "Retaliate X") — `glossaryId` is the keyword's bare name (`KeywordName`), which
    // `rulesGlossaryOf`/`rulesGlossaryPoolOf` (`view/rules-reference.ts`) both search on via the entry's own
    // `displayName`, so the query here is deliberately the id rather than the drawn chip text.
    void displayText;
    // Closes this sheet first, rather than launching Rules alongside it: `#rebuild` re-claims `bringToTop` on
    // every store update (the "Z-ORDER VS. THE PENDING-CHOICE OVERLAY" note at the top of this file), so a Rules
    // overlay merely launched *underneath* an open Inspect would render invisibly behind it — found verifying this
    // exact flow in the browser, where the glossary opened at the right term but nothing showed until Inspect was
    // separately dismissed. The player asked to go read a term, not to peek at it through a gap.
    this.#close();
    this.scene.launch(SCENES.rules, { initialTab: "glossary", initialQuery: glossaryId } satisfies RulesSceneData);
  }

  // ---------------------------------------------------------------------
  // Sheet mode (P14): phone only.
  // ---------------------------------------------------------------------

  #drawSheet(layout: Extract<InspectLayout, { mode: "sheet" }>, model: InspectModel): void {
    const { sheet, handle, content, footer, footerPrimaryRow, footerQuietRow } = layout;

    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(sheet.x, sheet.y, sheet.width, sheet.height);
    g.lineStyle(3, surface.paper.hex, 1).strokeRect(sheet.x, sheet.y, sheet.width, sheet.height);
    // The sheet swallows every tap inside it — it has scrolling content and controls of its own, so "tap anywhere
    // to dismiss" only applies to the dimmed board sliver above it (the scrim zone `#rebuild` already drew) and
    // the explicit Close button in the footer.
    this.add.zone(sheet.x, sheet.y, sheet.width, sheet.height).setOrigin(0, 0).setInteractive();

    const handlePill: Rect = { x: sheet.x + sheet.width / 2 - 22, y: handle.y + handle.height / 2 - 2, width: 44, height: 4 };
    const pill = this.add.graphics();
    pill.fillStyle(surface.ink.hex, 0.35).fillRect(handlePill.x, handlePill.y, handlePill.width, handlePill.height);

    this.#drawSheetContent(content, model);
    this.#drawSheetFooter(footer, footerPrimaryRow, footerQuietRow, model);
  }

  /**
   * The sheet's scrolling body. P14 draws the thumbnail/name/type/chips fixed at the top with a separately
   * bordered parchment "Keywords" box and distinct "This game" rows below; this build keeps the thumbnail/name/
   * type/chips fixed (they're the part a player reads first and the part every other screen's card header already
   * looks like) but folds the rules text, the keyword definitions and the per-card history into **one** scrolling
   * text region below it, rather than three separately-chromed boxes. `McScrollPanel` is the one scrolling widget
   * this app has for freeform text (rexUI's `TextArea`, `ui/widgets.ts`'s own doc comment on why — card text's
   * literal `[energy]`-style tokens rule out `BBCodeText`), and it takes one string, not a mix of bordered panels
   * and tappable chips; building a second freeform-mixed-content scroller for this one screen was more than this
   * pass could justify. Every fact the design asks for is still here, still real, still scrollable — the
   * difference is chrome, not content, and it's the one deliberate visual simplification in this rebuild.
   */
  #drawSheetContent(rect: Rect, model: InspectModel): void {
    const pad = 14;
    const thumbWidth = 116;
    const thumbHeight = 164;
    const thumb: Rect = { x: rect.x + pad, y: rect.y + 8, width: thumbWidth, height: thumbHeight };
    const frame = this.add.graphics();
    frame.fillStyle(surface.parchment.hex, 1).fillRect(thumb.x, thumb.y, thumb.width, thumb.height);
    frame.lineStyle(3, surface.ink.hex, 1).strokeRect(thumb.x, thumb.y, thumb.width, thumb.height);
    const key = cardArt(this).request(this, model.art);
    if (!drawArt(this, key, thumb)) {
      label(this, thumb.x + thumb.width / 2, thumb.y + thumb.height / 2, model.hidden ? "facedown" : "no scan", typeRole.label, surface.ink.hex, ink.meta).setOrigin(0.5);
    }

    const textLeft = thumb.x + thumb.width + 11;
    const textWidth = rect.x + rect.width - pad - textLeft;
    let ty = thumb.y;
    this.add.text(textLeft, ty, caseOf(typeRole.barTitle, model.name), { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "26px" }).setLetterSpacing(1).setWordWrapWidth(textWidth).setMaxLines(2);
    ty += 30;
    label(this, textLeft, ty, model.typeLine, typeRole.label, surface.ink.hex, ink.label);
    ty += 16;
    if (model.keywordChips.length > 0) {
      let cx = textLeft;
      let cy = ty;
      for (const chip of model.keywordChips) {
        const text = this.add.text(cx + 6, cy + 3, caseOf(typeRole.label, chip.text), textStyle(typeRole.label, surface.ink.hex)).setLetterSpacing(typeRole.label.letterSpacing).setFontSize(9);
        const chipWidth = text.width + 12;
        if (cx + chipWidth > textLeft + textWidth) {
          cx = textLeft;
          cy += 22;
          text.setPosition(cx + 6, cy + 3);
        }
        const box = this.add.graphics();
        box.lineStyle(2, surface.ink.hex, 1).strokeRect(cx, cy, chipWidth, 18);
        this.children.bringToTop(text);
        if (chip.glossaryId) {
          const glossaryId = chip.glossaryId;
          const arm = new PressArm();
          const zone = this.add.zone(cx, cy, chipWidth, 18).setOrigin(0, 0).setInteractive({ useHandCursor: true });
          zone.on("pointerdown", () => arm.down());
          zone.on("pointerout", () => arm.cancel());
          zone.on("pointerup", () => {
            if (arm.up()) this.#openRulesAt(glossaryId, chip.text);
          });
        }
        cx += chipWidth + 6;
      }
      ty = cy + 26;
    }

    const bodySize = appSession().settings.largeCardText ? 16 : 12;
    let text = model.rulesText;
    if (model.printedText) text += `\n\nPRINTED TEXT (superseded by errata)\n${model.printedText}`;
    if (model.flavor) text += `\n\n${model.flavor}`;
    if (model.keywordChips.length > 0) {
      text += `\n\nKEYWORDS\n${model.keywordDefinitions.map((entry) => `${entry.label} — ${entry.definition} (${entry.citeLabel})`).join("\n")}`;
    }
    if (model.history.length > 0) {
      text += `\n\nTHIS GAME\n${model.history.map((line) => `${line.roundTag}   ${line.text}`).join("\n")}`;
    }

    const scrollTop = Math.max(ty + 6, thumb.y + thumb.height + 12);
    const scrollRect: Rect = { x: rect.x + pad, y: scrollTop, width: rect.width - pad * 2, height: Math.max(0, rect.y + rect.height - scrollTop - 8) };
    if (scrollRect.height > 20) {
      const panel = new McScrollPanel(this, { rect: scrollRect, text, type: { ...typeRole.body, size: bodySize } });
      this.#scrollPanels.push(panel);
    }
  }

  #drawSheetFooter(footer: Rect, primaryRow: Rect, quietRow: Rect, model: InspectModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(footer.x, footer.y, footer.width, footer.height);
    this.add.zone(footer.x, footer.y, footer.width, footer.height).setOrigin(0, 0).setInteractive();

    const showPlay = model.status.playable === true;
    const showPay = model.canPayAsResource;
    if (showPlay || showPay) {
      const gap = showPlay && showPay ? 6 : 0;
      const width = showPlay && showPay ? (primaryRow.width - gap) / 2 : primaryRow.width;
      let x = primaryRow.x;
      const play = (): void => {
        const instanceId = this.#instanceId;
        this.#close();
        if (instanceId) this.game.events.emit("mc-play-card", instanceId);
      };
      const payWith = (): void => {
        const instanceId = this.#instanceId;
        this.#close();
        if (instanceId) this.#boardScene()?.payWithCard(instanceId);
      };
      if (showPlay) {
        this.#primaryAction = play;
        this.#buttons.push(
          new McButton(this, {
            kind: "primary",
            label: model.cost !== null ? `Play ${model.cost}` : "Play",
            type: typeRole.rowTitle,
            rect: { x, y: primaryRow.y, width, height: primaryRow.height },
            onClick: play,
          }),
        );
        x += width + gap;
      }
      if (showPay) {
        if (!showPlay) this.#primaryAction = payWith;
        this.#buttons.push(new McButton(this, { kind: "onInk", label: "Pay with", type: typeRole.rowTitle, rect: { x, y: primaryRow.y, width, height: primaryRow.height }, onClick: payWith }));
      }
    }

    const quietWidth = (quietRow.width - 6) / 2;
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: this.#expanded ? "Collapse" : "Full rules text",
        type: typeRole.label,
        rect: { x: quietRow.x, y: quietRow.y, width: quietWidth, height: quietRow.height },
        onClick: () => {
          this.#expanded = !this.#expanded;
          this.#rebuild();
        },
      }),
    );
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Close",
        type: typeRole.label,
        rect: { x: quietRow.x + quietWidth + 6, y: quietRow.y, width: quietWidth, height: quietRow.height },
        onClick: () => this.#close(),
      }),
    );
  }
}

/** Every Core card by id, for the sheets opened before a game exists. */
const CARDS_BY_ID = new Map<string, AnyCard>(POOL_CARDS.map((card) => [card.id as string, card]));
