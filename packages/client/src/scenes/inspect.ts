/**
 * The Inspect overlay: one card, whole.
 *
 * The table caps rules text at two lines on purpose (Components.dc.html section
 * 06, "numbers before prose"), which only works if the full wording is always
 * one gesture away. This is that gesture's destination, and it runs in parallel
 * over Board so the table stays visible behind the scrim.
 *
 * Two panels, from `Screens - Desktop` section 08:
 *  - the card itself on paper, with a 5px ink border: cost chip, name, type
 *    line, the scan, rules text, flavor, resource pips, set/collector footer;
 *  - "Rules & state" on ink: what the engine says about this card right now,
 *    its keywords and traits, and the one action that makes sense from here.
 *
 * Everything on the left comes from `@mc/content`; everything on the right
 * comes from the engine's `legalActions`. This scene decides nothing.
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
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, McScrollPanel, label, paintDotGrid } from "../ui/widgets.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { cardInspectModel, inspectModel, type InspectModel } from "../view/inspect-model.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { PressArm } from "../view/press-arm.js";
import { bindGamepad, bindKeyboard } from "./board/input.js";
import { SCENES } from "./keys.js";

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

export class InspectOverlay extends Phaser.Scene {
  #instanceId: InstanceId | null = null;
  #siblings: readonly InstanceId[] = [];
  #choice: InspectData["choice"] = undefined;
  #card: InspectData["card"] = undefined;
  #note: string | undefined = undefined;
  #buttons: McButton[] = [];
  #unsubscribe: (() => void) | null = null;
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
      this.#rebuild();
    }
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
    this.children.removeAll(true);
    this.#dismissArm = new PressArm();
    this.#primaryAction = null;

    const { width, height } = this.scale.gameSize;
    // The scrim is a dismiss target as well as a scrim: the design says "click
    // anywhere to dismiss", so the whole backdrop takes the tap.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.9).fillRect(0, 0, width, height);
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk).setAlpha(0.7);
    // Dismiss on a *fresh* press, not on the release of the press that opened
    // the sheet. Inspect opens on pointerdown (a right-click or a hold), so the
    // matching pointerup lands on a scrim that did not exist when the gesture
    // began — which made the sheet vanish the moment you let go.
    this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerdown", () => {
        this.#dismissArm.down();
      })
      .on("pointerup", () => {
        if (this.#dismissArm.up()) this.#close();
      });

    // Phone stacks the two panels; anything wider sets them side by side.
    const narrow = formFactorFor(width, height) === "phone" || width < 900;
    const gap = narrow ? 10 : 26;
    const pad = narrow ? 12 : 40;
    const cardWidth = narrow ? width - pad * 2 : Math.min(400, (width - pad * 2 - gap) * 0.48);
    const cardHeight = Math.min(height - pad * 2, narrow ? (height - pad * 2) * 0.62 : 660);
    const sideWidth = narrow ? width - pad * 2 : Math.min(440, width - pad * 2 - gap - cardWidth);

    const cardRect: Rect = narrow
      ? { x: pad, y: pad, width: cardWidth, height: cardHeight }
      : {
          x: (width - (cardWidth + gap + sideWidth)) / 2,
          y: (height - cardHeight) / 2,
          width: cardWidth,
          height: cardHeight,
        };
    const sideRect: Rect = narrow
      ? { x: pad, y: cardRect.y + cardRect.height + gap, width: sideWidth, height: height - pad - (cardRect.y + cardRect.height + gap) }
      : { x: cardRect.x + cardWidth + gap, y: cardRect.y, width: sideWidth, height: cardHeight };

    this.#drawCard(cardRect, model);
    this.#drawRulesAndState(sideRect, model);

    const hint =
      this.#siblings.length > 1
        ? "◂ previous · next ▸ · tap the card or Close to dismiss"
        : "tap the card or Close to dismiss";
    label(this, width / 2, height - 20, hint, typeRole.label, surface.paper.hex, ink.meta).setOrigin(0.5);

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
    return inspectModel(state.game, this.#instanceId, state.legal?.actions ?? null, state.perspectiveId, POOL_DEPS);
  }

  /** The card face: everything `@mc/content` prints on it. */
  #drawCard(rect: Rect, model: InspectModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(5, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    // The card panel carries no controls, so it dismisses like the scrim does.
    // Only the "Rules & state" panel swallows taps, because its buttons are
    // there — on a phone the scrim is a few pixels of margin, and a sheet you
    // can only close by hitting that margin is a sheet you cannot close.
    this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerdown", () => {
        this.#dismissArm.down();
      })
      .on("pointerup", () => {
        if (this.#dismissArm.up()) this.#close();
      });

    // Header: cost chip, name, type line.
    const headerHeight = 62;
    let nameLeft = rect.x + 14;
    if (model.cost !== null) {
      const chip: Rect = { x: rect.x + 5, y: rect.y + 5, width: 54, height: headerHeight - 5 };
      const chipG = this.add.graphics();
      chipG.fillStyle(signal.cost.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
      this.add
        .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(model.cost), {
          ...textStyle(typeRole.screenTitle, surface.paper.hex),
          fontSize: "40px",
        })
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
    const rule = this.add.graphics();
    rule.fillStyle(surface.ink.hex, 1).fillRect(rect.x + 5, rect.y + headerHeight, rect.width - 10, 4);

    // Footer first, so the art and the body know where they end.
    const footerTop = rect.y + rect.height - 28;
    const footRule = this.add.graphics();
    footRule.fillStyle(surface.ink.hex, 1).fillRect(rect.x + 5, footerTop, rect.width - 10, 4);
    label(this, rect.x + 14, footerTop + 12, model.footerLeft, typeRole.label, surface.ink.hex, ink.label);
    label(this, rect.x + rect.width - 14, footerTop + 12, model.footerRight, typeRole.label, surface.ink.hex, ink.label).setOrigin(1, 0);

    // The scan is the point of this sheet, so it gets the room and the text
    // fits around it — the opposite of the table, where text leads and the
    // scan is a thumbnail. Whatever the text needs is measured first, but the
    // scan keeps a floor of just over half the panel.
    //
    // `largeCardText` (Settings, docs/phase4-screen-gaps.md §3 "W4") is read
    // here rather than app-wide: this sheet's whole job is reading a card's
    // full text closely, which is exactly the accessibility need that setting
    // names (`settings.ts`'s own doc comment).
    const bodySize = appSession().settings.largeCardText ? 17 : 14;
    const bodyWidth = rect.width - 28;
    const measure = this.add
      .text(-10000, -10000, model.rulesText, textStyle(typeRole.body, surface.ink.hex))
      .setWordWrapWidth(bodyWidth)
      .setFontSize(bodySize);
    const textHeight = measure.height + (model.flavor ? 28 : 0) + (model.printedText ? 46 : 0) + (model.resourceIcons.length ? 30 : 0) + (model.stats.length ? 34 : 0);
    measure.destroy();

    const artTop = rect.y + headerHeight + 4;
    const available = footerTop - artTop;
    const artHeight = Math.max(
      Math.min(available * 0.52, available),
      Math.min(available * 0.78, available - textHeight - 20),
    );
    const artBottom = artTop + artHeight;
    if (artHeight > 40) {
      const band: Rect = { x: rect.x + 5, y: artTop, width: rect.width - 10, height: artHeight };
      const frame = this.add.graphics();
      frame.fillStyle(surface.parchment.hex, 1).fillRect(band.x, band.y, band.width, band.height);
      const key = cardArt(this).request(this, model.art);
      if (!drawArt(this, key, band)) {
        label(this, band.x + band.width / 2, band.y + band.height / 2, model.hidden ? "facedown" : "no scan", typeRole.label, surface.ink.hex, ink.meta).setOrigin(0.5);
      }
      const bandRule = this.add.graphics();
      bandRule.fillStyle(surface.ink.hex, 1).fillRect(band.x, band.y + band.height, band.width, 4);
    }

    let y = artBottom + 12;
    if (model.stats.length > 0) {
      // A modified stat says so in words, e.g. "THW 2 (+1)": the sheet is text, and
      // colour alone never carries meaning.
      const statLine = model.stats
        .map((tile) => `${tile.label} ${tile.value}${tile.bonus ? ` (${tile.bonus > 0 ? "+" : "−"}${Math.abs(tile.bonus)})` : ""}`)
        .join("  ·  ");
      this.add.text(rect.x + 14, y, statLine, textStyle(typeRole.stat, surface.ink.hex)).setLetterSpacing(1);
      y += 30;
    }

    // Resource pips are their own fixed-height strip just above the footer —
    // short and constant, unlike the prose above, so they don't need to
    // scroll with it.
    const iconsHeight = model.resourceIcons.length > 0 ? 30 : 0;
    const scrollBottom = footerTop - iconsHeight - 6;
    if (scrollBottom > y + 20) {
      // Rules text, the superseded-by-errata printed text, and flavor, in one
      // scrolling region rather than three stacked `Text` objects that could
      // each run past the card's own edge. This is the fix PLAN.md calls for:
      // long rules text used to overflow the panel instead of scrolling.
      // Errata's red label and flavor's dimmer ink are lost in the merge —
      // rexUI's `BBCodeText` could recover them, but card text prints literal
      // `[energy]`/`[mental]`-style tokens that `BBCodeText` would read as
      // markup, so a uniform style is the trade for not corrupting those.
      let content = model.rulesText;
      if (model.printedText) content += `\n\nPRINTED TEXT (superseded by errata)\n${model.printedText}`;
      if (model.flavor) content += `\n\n${model.flavor}`;
      new McScrollPanel(this, {
        rect: { x: rect.x + 10, y, width: rect.width - 20, height: scrollBottom - y },
        text: content,
        type: { ...typeRole.body, size: bodySize },
      });
    }

    if (model.resourceIcons.length > 0) {
      const iconsTop = footerTop - iconsHeight;
      model.resourceIcons.forEach((icon, index) => {
        const box: Rect = { x: rect.x + 14 + index * 22, y: iconsTop, width: 18, height: 18 };
        const pip = this.add.graphics();
        pip.fillStyle(signal.cost.hex, 1).fillRect(box.x, box.y, box.width, box.height);
        this.add
          .text(box.x + box.width / 2, box.y + box.height / 2, icon.charAt(0).toUpperCase(), textStyle(typeRole.label, surface.paper.hex))
          .setOrigin(0.5);
      });
      label(
        this,
        rect.x + 18 + model.resourceIcons.length * 22,
        iconsTop + 5,
        `generates ${model.resourceIcons.join(", ")} when spent`,
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
    }
  }

  /** "Rules & state": the engine's verdict, the keywords, the one useful action. */
  #drawRulesAndState(rect: Rect, model: InspectModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(5, surface.paper.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();

    this.add
      .text(rect.x + 18, rect.y + 16, "RULES & STATE", textStyle(typeRole.barTitle, surface.paper.hex))
      .setLetterSpacing(1);
    // A phone has no Esc key, so the chip that names it is also the button.
    const chipWidth = 62;
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: this.scale.gameSize.width < 900 ? "Close" : "Esc",
        type: typeRole.label,
        rect: { x: rect.x + rect.width - chipWidth - 14, y: rect.y + 12, width: chipWidth, height: 30 },
        onClick: () => this.#close(),
      }),
    );

    let y = rect.y + 52;
    const inner = rect.width - 36;

    // "Right now" — the engine's own sentence, in the design's red callout.
    // Skipped while this card *is* the answer to an open decision: "a decision
    // is open, answer it first" is unhelpful when answering it is exactly what
    // the button below does.
    if (model.status.message && !this.#choice) {
      label(this, rect.x + 18, y, "right now", typeRole.label, surface.paper.hex, ink.meta);
      y += 16;
      const text = this.add
        .text(rect.x + 30, y + 10, model.status.message, textStyle(typeRole.body, surface.paper.hex))
        .setFontSize(12)
        .setWordWrapWidth(inner - 24);
      const box: Rect = { x: rect.x + 18, y, width: inner, height: text.height + 20 };
      const callout = this.add.graphics();
      callout.fillStyle(accent.heroRed.hex, 0.2).fillRect(box.x, box.y, box.width, box.height);
      callout.lineStyle(3, accent.heroRed.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
      // The graphics were added after the text, so put the text back on top.
      this.children.bringToTop(text);
      y += box.height + 18;
    }
    // The price the table is actually charging, when it isn't the one on the card. Sits above "legal targets"
    // because it changes what the player can afford this turn, which is the decision in front of them.
    if (model.priceNote) {
      label(this, rect.x + 18, y, "cost right now", typeRole.label, surface.paper.hex, ink.meta);
      const note = this.add
        .text(rect.x + 18, y + 16, model.priceNote, textStyle(typeRole.body, surface.paper.hex))
        .setWordWrapWidth(inner);
      y += 16 + note.height + 16;
    }
    if (model.status.targets.length > 0) {
      label(this, rect.x + 18, y, "legal targets", typeRole.label, surface.paper.hex, ink.meta);
      const targets = this.add
        .text(rect.x + 18, y + 16, model.status.targets.join(" · "), textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setWordWrapWidth(inner);
      y += 16 + targets.height + 16;
    }

    y = this.#chips(rect, y, inner, "keywords on this card", model.keywords);
    y = this.#chips(rect, y, inner, "traits", model.traits);

    // Why this card cannot be chosen, where the choice buttons would be.
    if (this.#note) {
      const box: Rect = { x: rect.x + 18, y: rect.y + rect.height - hit.primary - 16, width: inner, height: hit.primary };
      const callout = this.add.graphics();
      callout.fillStyle(accent.heroRed.hex, 0.2).fillRect(box.x, box.y, box.width, box.height);
      callout.lineStyle(3, accent.heroRed.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
      this.add
        .text(box.x + box.width / 2, box.y + box.height / 2, this.#note, textStyle(typeRole.body, surface.paper.hex))
        .setOrigin(0.5)
        .setWordWrapWidth(box.width - 20)
        .setMaxLines(2);
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
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: choiceLabel,
          type: typeRole.barTitle,
          rect: { x: rect.x + 18, y: rect.y + rect.height - hit.primary - 16, width: buttonWidth, height: hit.primary },
          onClick: choose,
        }),
      );
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "Cancel",
          type: typeRole.label,
          rect: { x: rect.x + 27 + buttonWidth, y: rect.y + rect.height - hit.primary - 16, width: buttonWidth, height: hit.primary },
          onClick: () => this.#close(),
        }),
      );
      return;
    }

    // A card in play with a usable action ability: one button per ability,
    // checked *before* "Play it" below. `model.status.playable` is also true
    // for these (`statusOf` finds either a `playCard` or a `useAbility` match
    // and doesn't tell them apart), so without this order a card with an
    // ability and no play of its own would show "Play it" and silently do
    // nothing when tapped — `#playCard` only ever looks for a `playCard`
    // entry. This is the fix, and it's also the picker PLAN.md asks for when
    // a card has more than one usable ability: the sheet already shows the
    // card's full rules text, so the player can read what each one does
    // before choosing, and it only *reports* the pick — `mc-use-ability`,
    // the same pattern `mc-play-card` already uses — never dispatches it
    // itself. No Core card offers two at once today (checked by replaying
    // three full games through `legalActions`), so the stacked-row case below
    // is exercised by test data rather than by any real card yet.
    if (model.abilities.length > 0) {
      const instanceId = this.#instanceId;
      const area: Rect = { x: rect.x + 18, y: rect.y + rect.height - hit.primary - 16, width: inner, height: hit.primary };
      const rowHeight = model.abilities.length === 1 ? area.height : Math.max(hit.target, area.height / model.abilities.length);
      model.abilities.forEach((ability, index) => {
        const rowRect: Rect = { x: area.x, y: area.y + area.height - (model.abilities.length - index) * (rowHeight + 4), width: area.width, height: rowHeight };
        const use = (): void => {
          this.#close();
          if (instanceId) this.game.events.emit("mc-use-ability", instanceId, ability.abilityId);
        };
        // Enter takes the first, the one drawn as primary; the rest are a click or a tap.
        if (index === 0) this.#primaryAction = use;
        this.#buttons.push(
          new McButton(this, {
            kind: index === 0 ? "primary" : "secondary",
            label: ability.label,
            type: model.abilities.length === 1 ? typeRole.barTitle : typeRole.label,
            rect: rowRect,
            onClick: use,
          }),
        );
      });
      return;
    }

    // One action, and only when the engine has already said it is legal.
    if (model.status.playable === true) {
      const play = (): void => {
        const instanceId = this.#instanceId;
        this.#close();
        if (instanceId) this.game.events.emit("mc-play-card", instanceId);
      };
      this.#primaryAction = play;
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Play it",
          type: typeRole.barTitle,
          rect: { x: rect.x + 18, y: rect.y + rect.height - hit.primary - 16, width: inner, height: hit.primary },
          onClick: play,
        }),
      );
    }
  }

  /** A labeled row of outlined chips, as the design draws keywords. Returns the next y. */
  #chips(rect: Rect, top: number, inner: number, heading: string, items: readonly string[]): number {
    if (items.length === 0) return top;
    label(this, rect.x + 18, top, heading, typeRole.label, surface.paper.hex, ink.meta);
    let x = rect.x + 18;
    let y = top + 16;
    for (const item of items) {
      const text = this.add
        .text(x + 8, y + 5, caseOf(typeRole.label, item), textStyle(typeRole.label, surface.paper.hex))
        .setLetterSpacing(typeRole.label.letterSpacing);
      const chipWidth = text.width + 16;
      if (x + chipWidth > rect.x + 18 + inner) {
        x = rect.x + 18;
        y += 28;
        text.setPosition(x + 8, y + 5);
      }
      const chip = this.add.graphics();
      chip.lineStyle(2, surface.paper.hex, 1).strokeRect(x, y, chipWidth, 22);
      this.children.bringToTop(text);
      x += chipWidth + 7;
    }
    return y + 40;
  }
}

/** Every Core card by id, for the sheets opened before a game exists. */
const CARDS_BY_ID = new Map<string, AnyCard>(POOL_CARDS.map((card) => [card.id as string, card]));
