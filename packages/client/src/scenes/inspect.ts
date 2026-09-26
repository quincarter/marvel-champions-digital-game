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
import type { AnyCard, CardId, ResourceIconType } from "@mc/content";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { cardArt, drawArt } from "../art/card-art.js";
import type { CardFace } from "../art/art-source.js";
import { appSession } from "../session.js";
import { accent, border, hit, ink, minType, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, McScrollPanel, fitText, label, paintDotGrid } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { estimateWrappedLines, formFactorFor, type Rect } from "../view/layout.js";
import { pointInRect } from "../view/drag-gesture.js";
import {
  SHEET_CONTENT_PAD,
  SHEET_THUMB,
  cardFaceContentHeight,
  DESKTOP_ART_ASPECT,
  cardFaceLayout,
  inspectLayout,
  sheetPlayPayWidths,
  sheetTextColumn,
  type CardFaceContent,
  type InspectLayout,
} from "../view/inspect-layout.js";
import { OverlayMotion } from "../ui/transitions.js";
import { emptyCardHistoryLog } from "../view/card-history.js";
import { cardInspectModel, inspectModel, type InspectModel, type InspectPayment } from "../view/inspect-model.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { PressArm } from "../view/press-arm.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
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

// ---------------------------------------------------------------------------
// Panels-mode constants (D08). Shared between the sizing pass (`#rebuild`'s
// `cardFaceContentHeight`/`#rulesContentHeight` calls, made before either
// panel's final rect exists) and the actual draw, so the two can never
// disagree about how tall a panel needs to be.
// ---------------------------------------------------------------------------

/** D08's own 14px padding, 16px `gap` on the ink "Rules & state" panel's own flex column. */
const RULES_PAD = 22;
const RULES_SECTION_GAP = 16;
/** The "RULES & STATE" title row, Bangers 24px, plus its own leading room. */
const RULES_TITLE_HEIGHT = 30;
/** The card panel's own `padding:14px`/`gap:10px` text block (matches `view/inspect-layout.ts`'s own `TEXT_PAD`/`TEXT_GAP`, duplicated here since that file stays a pure-layout module with no text drawing of its own). */
const CARD_TEXT_PAD = 14;
const CARD_TEXT_GAP = 10;
/** D08's own `line-height:1.6` at 12px for "This card, this game" — one row per history line, never wrapped. */
const HISTORY_LINE_HEIGHT = 12 * 1.6;

/**
 * How many rows `count` chip-shaped labels wrap into at `width`, without a live Phaser text object to measure — the
 * same "conservative width estimate, no canvas" trade `view/layout.ts#estimateWrappedLines` makes, generalized from
 * a wrapped sentence to a wrapped row of chips. Used only by the *sizing* pass (`#rulesContentHeight`); the actual
 * draw (`#drawChips`) measures each chip's real Phaser text width and wraps for real, so this only has to be close,
 * not exact — and errs high (a wider average character) so the sizing pass reserves at least as much room as the
 * real draw is likely to need, not less.
 */
function estimateChipRows(items: readonly string[], width: number): number {
  const CHIP_CHAR_WIDTH = 7;
  const CHIP_PADDING = 16;
  const CHIP_GAP = 7;
  let x = 0;
  let rows = 1;
  for (const item of items) {
    const chipWidth = item.length * CHIP_CHAR_WIDTH + CHIP_PADDING;
    if (x > 0 && x + chipWidth > width) {
      rows += 1;
      x = 0;
    }
    x += chipWidth + CHIP_GAP;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Sheet-mode constants (P14). The whole scrolling body is one `McScrollRegion`
// (`#drawSheetContent`'s own doc comment), so — unlike the panels-mode block
// above — nothing here needs a separate sizing pass: every gap below is used
// exactly once, at draw time, by the section it names.
// ---------------------------------------------------------------------------

/** P14's own 11px gap between the header row / keywords box / this-game block. */
const SHEET_ROW_GAP = 11;

/** "energy" → "E", the letter drawn inside a resource pip so its type is never colour-only (this design's own rule). */
function resourcePipGlyph(icon: ResourceIconType): string {
  switch (icon) {
    case "physical":
      return "P";
    case "mental":
      return "M";
    case "energy":
      return "E";
    case "wild":
      return "W";
  }
}

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
   * Phone only — the sheet's own scroll position (`ui/scroll-region.ts`'s convention: caller-owned, persisted
   * across rebuilds so an ordinary store-driven redraw doesn't snap the sheet back to the top). Reset on step/reopen,
   * same as `#expanded`.
   */
  #sheetScroll = new VariableListScroll();
  /** Phone only — destroyed and rebuilt every `#rebuild` (`#drawSheetContent`'s own doc comment on why), same lifecycle `table-setup.ts#compactRegion` already follows for the identical widget. */
  #sheetRegion: McScrollRegion | null = null;
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
  /** The panels' own rise-and-fade entrance/exit (`ui/transitions.ts`) — a fresh instance per open, so stepping ◂ ▸ through siblings (an ordinary rebuild, not a reopen) never replays it. */
  #motion = new OverlayMotion();

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
    this.#sheetScroll = new VariableListScroll();
    this.#motion = new OverlayMotion();

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
      // `McScrollRegion` binds its own listeners on `scene.input`/`scene.events` (`ui/scroll-region.ts`'s own doc
      // comment); `#rebuild` destroys and rebuilds it on every redraw, but nothing else runs after the scene's very
      // last draw, so the region from that draw is only ever cleaned up here.
      this.#sheetRegion?.destroy();
      this.#sheetRegion = null;
    });
    this.#rebuild();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  /**
   * ◂ ▸ (and Tab) step through the list the sheet was opened from, Enter or
   * Space presses the primary button — Select, the first ability, or Play it —
   * and Escape closes. `inspect` means nothing here: this already is Inspect.
   */
  #onIntent(intent: GamepadIntent): void {
    // The overlay is on its way out — a second Escape, or a stray Enter during the fade, does nothing.
    if (this.#motion.leaving) return;
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
      this.#sheetScroll = new VariableListScroll();
      this.#rebuild();
    }
  }

  /** The live Board scene, when one is running underneath — the source of the card-history fold and the open payment, neither of which lives on the store. */
  #boardScene(): BoardScene | null {
    if (!this.scene.isActive(SCENES.board)) return null;
    return this.scene.get(SCENES.board) as BoardScene;
  }

  #rebuild(): void {
    // The overlay is fading out; its own display list is what's being tweened to alpha 0, so redrawing it now would
    // both fight the tween and reset every object back to opaque mid-exit.
    if (this.#motion.leaving) return;
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
    // Must be destroyed *before* `destroyChildren` below, not left for it: `McScrollRegion` binds its own listeners
    // on `scene.input`/`scene.events` (`ui/scroll-region.ts`'s own doc comment), which `destroyChildren` — a plain
    // walk over the display list — never touches. Left alive, those listeners would go on firing against a
    // container `destroyChildren` had already torn down.
    this.#sheetRegion?.destroy();
    this.#sheetRegion = null;
    destroyChildren(this);
    this.#dismissArm = new PressArm();
    this.#primaryAction = null;

    const { width, height } = this.scale.gameSize;
    // Two passes for panels mode: the first learns each panel's own (content-independent) width; the second, after
    // measuring both panels' natural content height at that width, gets the final centered rect pair
    // (`view/inspect-layout.ts`'s own header comment on why the pure layout functions can't do this in one call).
    const provisional = inspectLayout({ x: 0, y: 0, width, height }, { expanded: this.#expanded });
    const layout: InspectLayout =
      provisional.mode === "panels"
        ? inspectLayout(
            { x: 0, y: 0, width, height },
            {
              expanded: this.#expanded,
              cardContentHeight: cardFaceContentHeight(
                provisional.card.width,
                this.#cardFaceContent(model, provisional.card.width),
              ),
              rulesContentHeight: this.#rulesContentHeight(provisional.rules.width, model),
            },
          )
        : provisional;

    // The scrim is a dismiss target as well as a scrim: the design says "click
    // anywhere to dismiss", so the whole backdrop takes the tap. On phone the
    // backdrop is P14's own dimmed *board* (Board keeps drawing underneath, at
    // reduced opacity through this scrim) rather than the panels' purpose-built
    // felt ground, so it reads noticeably lighter there.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, layout.mode === "sheet" ? 0.72 : 0.9).fillRect(0, 0, width, height);
    const dotGrid =
      layout.mode === "panels"
        ? paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", { spacing: 8, radius: 1, alpha: 0.13 }).setAlpha(0.7)
        : null;
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

    if (layout.mode === "panels") {
      // Everything `#drawPanels` adds from here on is the entrance's "panels" set — the card panel, the rules
      // panel and the hint row beneath them, whichever objects those end up being (`ui/transitions.ts`'s own
      // "simplest: pass `children.list.slice(from)`" suggestion).
      const from = this.children.list.length;
      this.#drawPanels(layout, model);
      const panels = this.children.list.slice(from);
      this.#motion.enter(this, { scrim: [scrim, ...(dotGrid ? [dotGrid] : [])], panels });
    } else {
      // Same "slice off what this draw added" trick as panels mode, just with a bigger rise (P14's own bottom
      // sheet travels further than a centered panel does) and no dot grid (the sheet's own scrim is the dimmed
      // board, not the panels' felt ground).
      const from = this.children.list.length;
      const contentHeight = this.#drawSheet(layout, model);
      // The collapsed sheet hugs its content (P14), and the content can only be measured by drawing it: so when the
      // measured height asks for a different sheet, this pass is thrown away and drawn again at the final size —
      // within the same frame, so the player never sees the first one.
      const hugged = inspectLayout(
        { x: 0, y: 0, width, height },
        { expanded: this.#expanded, sheetContentHeight: contentHeight },
      );
      if (hugged.mode === "sheet" && hugged.sheet.height !== layout.sheet.height) {
        // `#drawSheet` assigned the region; the compiler still has it narrowed to the `null` set at the top.
        (this.#sheetRegion as McScrollRegion | null)?.destroy();
        this.#sheetRegion = null;
        for (const object of this.children.list.slice(from)) object.destroy();
        this.#drawSheet(hugged, model);
      }
      const panels = this.children.list.slice(from);
      this.#motion.enter(this, { scrim: [scrim], panels, rise: 40 });
    }

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
    label(
      this,
      layout.hint.x + layout.hint.width / 2,
      layout.hint.y + layout.hint.height / 2,
      hint,
      { ...typeRole.label, size: 11, letterSpacing: 1.6 },
      surface.paper.hex,
      ink.meta,
    ).setOrigin(0.5);
  }

  /** A hard-offset drop shadow, the one shadow shape D08 draws besides the selection ring — D08's own 14px offset at 0.5 alpha. */
  #drawShadow(rect: Rect, offset = 14): void {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5).fillRect(rect.x + offset, rect.y + offset, rect.width, rect.height);
  }

  /**
   * The card panel's rules-text/printed-text/flavor/pips content, measured once and shared by both the sizing pass
   * (`#rebuild`'s `cardFaceContentHeight` call, made before this panel's final rect exists) and the actual draw
   * (`#drawCardPanel`), so the two can never disagree about how tall the panel needs to be.
   */
  #cardFaceContent(model: InspectModel, width: number): CardFaceContent {
    // `largeCardText` (Settings, docs/phase4-screen-gaps.md §3 "W4") is read here rather than app-wide: this
    // sheet's whole job is reading a card's full text closely, which is exactly the accessibility need that
    // setting names (`settings.ts`'s own doc comment).
    const bodySize = appSession().settings.largeCardText ? 17 : 14;
    const bodyWidth = Math.max(1, width - CARD_TEXT_PAD * 2);
    // A desktop gets the taller art band (`view/inspect-layout.ts`'s `DESKTOP_ART_ASPECT`): the scan is what the
    // player opened this to read, and a big monitor has the height for it. Tablets keep D08's band.
    const { width: viewportWidth, height: viewportHeight } = this.scale.gameSize;
    const desktop = formFactorFor(viewportWidth, viewportHeight) === "desktop";
    return {
      ...(desktop ? { artAspect: DESKTOP_ART_ASPECT } : {}),
      bodySize,
      rulesTextLines: estimateWrappedLines(model.rulesText, bodyWidth, bodySize * 0.5),
      // +1 for the block's own "PRINTED TEXT (superseded by errata)" label line.
      printedTextLines: model.printedText ? estimateWrappedLines(model.printedText, bodyWidth, 11 * 0.5) + 1 : 0,
      flavorLines: model.flavor ? estimateWrappedLines(model.flavor, bodyWidth, 11 * 0.5) : 0,
      hasStats: model.stats.length > 0,
      hasIcons: model.resourceIcons.length > 0,
    };
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

    const content = this.#cardFaceContent(model, rect.width);
    const face = cardFaceLayout(rect, content);

    // Header: a full-header-height Hero Red cost block, the name in Bangers (shrinking rather than clipping — a
    // long name is common on later sets), the type line under it, a full-width rule under the whole header.
    let nameLeft = rect.x + 14;
    if (model.cost !== null) {
      const chip: Rect = { x: rect.x, y: rect.y, width: 62, height: face.header.height };
      const chipG = this.add.graphics();
      chipG.fillStyle(accent.heroRed.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
      this.add
        .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(model.cost), {
          ...textStyle(typeRole.screenTitle, surface.paper.hex),
          fontSize: "44px",
        })
        .setOrigin(0.5);
      nameLeft = chip.x + chip.width + 14;
    }
    const nameWidth = Math.max(10, rect.x + rect.width - 14 - nameLeft);
    const name = this.add
      .text(nameLeft, rect.y + 10, model.name, { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "36px" })
      .setLetterSpacing(0.5);
    fitText(name, nameWidth, 36);
    label(
      this,
      nameLeft,
      rect.y + 10 + name.height + 2,
      model.typeLine,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    ).setWordWrapWidth(nameWidth);
    this.#fillRule(face.headerRule);

    if (face.art) {
      const frame = this.add.graphics();
      frame.fillStyle(surface.parchment.hex, 1).fillRect(face.art.x, face.art.y, face.art.width, face.art.height);
      const key = cardArt(this).request(this, model.art);
      if (!drawArt(this, key, face.art)) {
        label(
          this,
          face.art.x + face.art.width / 2,
          face.art.y + face.art.height / 2,
          model.hidden ? "facedown" : "no scan",
          typeRole.label,
          surface.ink.hex,
          ink.meta,
        ).setOrigin(0.5);
      }
      if (face.artRule) this.#fillRule(face.artRule);
    }

    if (face.stats && model.stats.length > 0) {
      // A modified stat says so in words, e.g. "THW 2 (+1)": the sheet is text, and
      // colour alone never carries meaning.
      const statLine = model.stats
        .map(
          (tile) =>
            `${tile.label} ${tile.value}${tile.bonus ? ` (${tile.bonus > 0 ? "+" : "−"}${Math.abs(tile.bonus)})` : ""}`,
        )
        .join("  ·  ");
      this.add
        .text(face.stats.x, face.stats.y, statLine, textStyle(typeRole.stat, surface.ink.hex))
        .setLetterSpacing(1);
    }

    this.#drawCardTextBlock(face.scroll, model, content);

    this.#fillRule(face.footerRule);
    label(this, rect.x + 14, face.footer.y + 9, model.footerLeft, typeRole.label, surface.ink.hex, ink.label);
    label(
      this,
      rect.x + rect.width - 14,
      face.footer.y + 9,
      model.footerRight,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    ).setOrigin(1, 0);
  }

  /**
   * The rules-text/printed-text/flavor/resource-pips block — D08's own `padding:14px`/`gap:10px` column. Plain
   * stacked text (and pip graphics) when the measured content fits `outer` — D08 draws no scrollbar on an
   * ordinary card — or a `McScrollPanel` filling `outer` verbatim when it wouldn't ("only fall back to a scroll
   * panel when the measured text would not fit the maximum panel height").
   */
  #drawCardTextBlock(outer: Rect, model: InspectModel, content: CardFaceContent): void {
    if (outer.height <= 0) return;
    const inner: Rect = {
      x: outer.x + CARD_TEXT_PAD,
      y: outer.y + CARD_TEXT_PAD,
      width: Math.max(0, outer.width - CARD_TEXT_PAD * 2),
      height: Math.max(0, outer.height - CARD_TEXT_PAD * 2),
    };
    const needed =
      content.rulesTextLines * content.bodySize * 1.45 +
      (content.printedTextLines > 0 ? CARD_TEXT_GAP + content.printedTextLines * 11 * 1.45 : 0) +
      (content.flavorLines > 0 ? CARD_TEXT_GAP + content.flavorLines * 11 * 1.4 : 0) +
      (content.hasIcons ? CARD_TEXT_GAP + 26 : 0);

    // A 1px tolerance: the ordinary case is `needed` landing *exactly* at `inner.height` (the panel was sized to
    // this content in the first place, via `cardFaceContentHeight`'s own copy of this same arithmetic), and a bare
    // `>` flips into the scroll fallback on nothing but float noise between the two independently-summed totals —
    // found reading a tablet-portrait screenshot during D08 verification, 2026-09-21: an ordinary short Interrupt
    // card scrolling for no visible reason, `needed` and `inner.height` differing by 6e-14px.
    if (needed > inner.height + 1) {
      let text = model.rulesText;
      if (model.printedText) text += `\n\nPRINTED TEXT (superseded by errata)\n${model.printedText}`;
      if (model.flavor) text += `\n\n${model.flavor}`;
      if (model.resourceIcons.length > 0) text += `\n\n${this.#resourcePipLabel(model)}`;
      const panel = new McScrollPanel(this, { rect: outer, text, type: { ...typeRole.body, size: content.bodySize } });
      this.#scrollPanels.push(panel);
      return;
    }

    let y = inner.y;
    const rules = this.add
      .text(inner.x, y, model.rulesText, {
        ...textStyle(typeRole.body, surface.ink.hex),
        fontSize: `${content.bodySize}px`,
      })
      .setWordWrapWidth(inner.width);
    y += rules.height + CARD_TEXT_GAP;

    if (model.printedText) {
      label(this, inner.x, y, "printed text (superseded by errata)", typeRole.label, surface.ink.hex, ink.meta);
      y += 14;
      const printed = this.add
        .text(inner.x, y, model.printedText, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setFontSize(11)
        .setWordWrapWidth(inner.width);
      y += printed.height + CARD_TEXT_GAP;
    }

    if (model.flavor) {
      const flavor = this.add
        .text(inner.x, y, model.flavor, {
          ...textStyle(typeRole.body, surface.ink.hex, 0.65),
          fontSize: "11px",
          fontStyle: "italic",
        })
        .setWordWrapWidth(inner.width);
      y += flavor.height + CARD_TEXT_GAP;
    }

    if (model.resourceIcons.length > 0) {
      model.resourceIcons.forEach((icon, index) => {
        const box: Rect = { x: inner.x + index * 24, y, width: 18, height: 18 };
        const pip = this.add.graphics();
        pip.fillStyle(accent.heroRed.hex, 1).fillRect(box.x, box.y, box.width, box.height);
        this.add
          .text(box.x + box.width / 2, box.y + box.height / 2, resourcePipGlyph(icon), {
            ...textStyle(typeRole.label, surface.paper.hex),
            fontSize: "10px",
          })
          .setOrigin(0.5);
      });
      label(
        this,
        inner.x + model.resourceIcons.length * 24 + 4,
        y + 4,
        this.#resourcePipLabel(model),
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
    }
  }

  /** "Generates 2 energy when spent" — the resource pips grouped by type, so two energy pips read as "2 energy" rather than "energy, energy". */
  #resourcePipLabel(model: InspectModel): string {
    const counts = new Map<ResourceIconType, number>();
    for (const icon of model.resourceIcons) counts.set(icon, (counts.get(icon) ?? 0) + 1);
    const parts = [...counts.entries()].map(([type, count]) => `${count} ${type}`);
    return `generates ${parts.join(", ")} when spent`;
  }

  #fillRule(rect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  /**
   * The ink "Rules & state" panel's own natural (unclamped) content height at `width` — what `#rebuild` measures
   * (before this panel's final rect exists) and hands to `inspectLayout` as `rulesContentHeight`. Mirrors
   * `#drawRulesPanel`'s own section order and spacing exactly (`RULES_PAD`/`RULES_SECTION_GAP`/`RULES_TITLE_HEIGHT`
   * are the same module constants both use), so the two can never disagree about how tall the panel needs to be.
   */
  #rulesContentHeight(width: number, model: InspectModel): number {
    const inner = Math.max(1, width - RULES_PAD * 2);
    const blocks = [RULES_TITLE_HEIGHT, ...this.#rulesSectionHeights(inner, model)];
    // History assumes its full, untruncated height here (the natural/unclamped case); if the pair ends up clamped
    // smaller than that, `#drawHistory` truncates to whatever room is actually left at draw time instead of
    // reopening this circular "height depends on height" problem.
    if (model.history.length > 0) blocks.push(16 + model.history.length * HISTORY_LINE_HEIGHT);
    blocks.push(hit.primary);
    return RULES_PAD * 2 + blocks.reduce((sum, block) => sum + block, 0) + RULES_SECTION_GAP * (blocks.length - 1);
  }

  /** "Right now" / "Timing" / "Keywords on this card" / "Traits", whichever apply, in D08's own order. */
  #rulesSectionHeights(inner: number, model: InspectModel): number[] {
    const heights: number[] = [];
    if ((model.status.message || model.priceNote || model.resourceNote) && !this.#choice)
      heights.push(this.#rightNowHeight(inner, model));
    if (model.timing.length > 0) heights.push(this.#timingHeight(inner, model));
    if (model.keywordChips.length > 0)
      heights.push(
        16 +
          estimateChipRows(
            model.keywordChips.map((chip) => chip.text),
            inner,
          ) *
            28,
      );
    if (model.traits.length > 0) heights.push(16 + estimateChipRows(model.traits, inner) * 28);
    return heights;
  }

  /** "Playable. Cost 3 — you have 2 resources committed, 1 short. Legal targets: …" — the engine's own sentence, never this scene's invention. */
  #rightNowSentence(model: InspectModel): string {
    const sentence = [
      model.status.message,
      model.priceNote,
      model.resourceNote,
      model.status.targets.length > 0 ? `Legal targets: ${model.status.targets.join(", ")}.` : null,
    ]
      .filter((part): part is string => Boolean(part))
      // Each part ends its own sentence: the engine's reasons are clauses with no full stop of their own.
      .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
      .join(" ");
    // The engine's reasons are written as clauses ("this event can only…"); on the sheet they stand as a sentence.
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  #rightNowHeight(inner: number, model: InspectModel): number {
    const lines = estimateWrappedLines(this.#rightNowSentence(model), inner - 26, 12 * 0.5);
    return 16 + lines * (12 * 1.5) + 22;
  }

  /** "Right now" — the engine's own sentence, merged with the legal-target list into one Hero Red callout, exactly as D08 draws it. */
  #drawRightNow(x: number, y: number, width: number, model: InspectModel): void {
    label(this, x, y, "right now", typeRole.label, surface.paper.hex, ink.meta);
    const boxTop = y + 16;
    const text = this.add
      .text(x + 13, boxTop + 11, this.#rightNowSentence(model), textStyle(typeRole.body, surface.paper.hex))
      .setFontSize(12)
      .setLineSpacing(6)
      .setWordWrapWidth(width - 26);
    const box: Rect = { x, y: boxTop, width, height: text.height + 22 };
    const callout = this.add.graphics();
    callout.fillStyle(accent.heroRed.hex, 0.2).fillRect(box.x, box.y, box.width, box.height);
    callout.lineStyle(3, accent.heroRed.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    this.children.bringToTop(text);
  }

  #timingHeight(inner: number, model: InspectModel): number {
    let height = 16;
    for (const entry of model.timing) {
      const lines = estimateWrappedLines(`${entry.definition} (${entry.citeLabel})`, inner, 12 * 0.5);
      height += 16 + lines * (12 * 1.55) + 12;
    }
    return height;
  }

  /** "Timing" — see `view/inspect-model.ts#timingEntriesFor`'s own comment on why most cards show nothing here. */
  #drawTiming(x: number, y: number, width: number, model: InspectModel): void {
    label(this, x, y, "timing", typeRole.label, surface.paper.hex, ink.meta);
    let ty = y + 16;
    for (const entry of model.timing) {
      const heading = this.add.text(x, ty, entry.label, {
        ...textStyle(typeRole.body, surface.paper.hex),
        fontSize: "12px",
        fontStyle: "700",
      });
      ty += heading.height + 2;
      const body = this.add
        .text(x, ty, `${entry.definition} (${entry.citeLabel})`, textStyle(typeRole.body, surface.paper.hex, 0.85))
        .setFontSize(12)
        .setLineSpacing(7)
        .setWordWrapWidth(width);
      ty += body.height + 12;
    }
  }

  /**
   * "This card, this game" — plain lines, oldest-shown-first, truncated to whatever room `#drawRulesPanel` actually
   * has left rather than scrolled: a `McScrollPanel` always draws a visible track, even over three lines that never
   * need to move, which is worse than not scrolling at all (item 7 of the owner's own list). A history longer than
   * fits keeps its most recent lines and gets a leading "… N earlier" line instead.
   */
  #drawHistory(x: number, y: number, width: number, available: number, model: InspectModel): void {
    const maxLines = Math.floor((available - 16) / HISTORY_LINE_HEIGHT);
    if (maxLines <= 0) return;
    label(this, x, y, "this card, this game", typeRole.label, surface.paper.hex, ink.meta);
    const lines = model.history.map((line) => `${line.roundTag}   ${line.text}`);
    const shown =
      lines.length <= maxLines
        ? lines
        : [`… ${lines.length - (maxLines - 1)} earlier`, ...lines.slice(lines.length - Math.max(0, maxLines - 1))];
    let ty = y + 16;
    for (const line of shown.slice(0, maxLines)) {
      this.add
        .text(x, ty, line, textStyle(typeRole.body, surface.paper.hex, 0.85))
        .setFontSize(12)
        .setWordWrapWidth(width);
      ty += HISTORY_LINE_HEIGHT;
    }
  }

  /** "Rules & state": the engine's verdict, timing, keywords, this card's own history, and the one useful action. */
  #drawRulesPanel(rect: Rect, model: InspectModel): void {
    this.#drawShadow(rect);
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(5, surface.paper.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();

    const pad = RULES_PAD;
    const inner = rect.width - pad * 2;

    this.add
      .text(rect.x + pad, rect.y + pad, caseOf(typeRole.barTitle, "Rules & state"), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "24px",
      })
      .setLetterSpacing(1);
    const escWidth = 50;
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "Esc",
        type: { ...typeRole.label, size: 11 },
        rect: { x: rect.x + rect.width - pad - escWidth, y: rect.y + pad - 3, width: escWidth, height: 28 },
        onClick: () => this.#close(),
      }),
    );

    const buttonsTop = rect.y + rect.height - pad - hit.primary;
    let y = rect.y + pad + RULES_TITLE_HEIGHT + RULES_SECTION_GAP;

    // "Right now" — skipped while this card *is* the answer to an open decision: "a decision is open, answer it
    // first" is unhelpful when answering it is exactly what the button below does.
    if ((model.status.message || model.priceNote || model.resourceNote) && !this.#choice) {
      this.#drawRightNow(rect.x + pad, y, inner, model);
      y += this.#rightNowHeight(inner, model) + RULES_SECTION_GAP;
    }

    if (model.timing.length > 0) {
      this.#drawTiming(rect.x + pad, y, inner, model);
      y += this.#timingHeight(inner, model) + RULES_SECTION_GAP;
    }

    // "Keywords on this card" / "Traits" — chips a tap opens the Rules overlay at.
    if (model.keywordChips.length > 0) {
      y =
        this.#drawChips(
          rect,
          y,
          inner,
          "keywords on this card",
          model.keywordChips.map((chip) => ({ text: chip.text, glossaryId: chip.glossaryId })),
        ) + RULES_SECTION_GAP;
    }
    if (model.traits.length > 0) {
      y =
        this.#drawChips(
          rect,
          y,
          inner,
          "traits",
          model.traits.map((trait) => ({ text: trait, glossaryId: null })),
        ) + RULES_SECTION_GAP;
    }

    if (model.history.length > 0) {
      this.#drawHistory(rect.x + pad, y, inner, Math.max(0, buttonsTop - RULES_SECTION_GAP - y), model);
    }

    // Why this card cannot be chosen, where the choice buttons would be.
    if (this.#note) {
      const box: Rect = { x: rect.x + pad, y: buttonsTop, width: inner, height: hit.primary };
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
          rect: { x: rect.x + pad, y: buttonsTop, width: buttonWidth, height: hit.primary },
          onClick: choose,
        }),
      );
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "Cancel",
          type: typeRole.label,
          rect: { x: rect.x + pad + 9 + buttonWidth, y: buttonsTop, width: buttonWidth, height: hit.primary },
          onClick: () => this.#close(),
        }),
      );
      return;
    }

    // A card in play with a usable action ability: one button per ability, checked *before* "Play it" below.
    // `model.status.playable` is also true for these (`statusOf` finds either a `playCard` or a `useAbility` match
    // and doesn't tell them apart), so without this order a card with an ability and no play of its own would show
    // "Play it" and silently do nothing when tapped — `#playCard` only ever looks for a `playCard` entry.
    if (model.abilities.length > 0) {
      const instanceId = this.#instanceId;
      const area: Rect = { x: rect.x + pad, y: buttonsTop, width: inner, height: hit.primary };
      const rowHeight =
        model.abilities.length === 1 ? area.height : Math.max(hit.target, area.height / model.abilities.length);
      model.abilities.forEach((ability, index) => {
        const rowRect: Rect = {
          x: area.x,
          y: area.y + area.height - (model.abilities.length - index) * (rowHeight + 4),
          width: area.width,
          height: rowHeight,
        };
        const use = (): void => {
          this.#close();
          if (instanceId) this.game.events.emit("mc-use-ability", instanceId, ability.abilityId);
        };
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

    this.#drawPlayAndPayButtons(rect, model, { x: rect.x + pad, y: buttonsTop, width: inner, height: hit.primary });
  }

  /**
   * True when the subject is a hand card of the viewer — "dim, don't hide": USE AS RESOURCE stays visible
   * (disabled) even with no payment open for this card, rather than disappearing (D08 shows both buttons whenever
   * the card could ever be paid with, not only mid-payment).
   */
  #isHandCard(): boolean {
    const instanceId = this.#instanceId;
    if (!instanceId) return false;
    const { game, perspectiveId } = appSession().store.state;
    if (!game || perspectiveId === null) return false;
    return game.players.find((player) => player.playerId === perspectiveId)?.hand.includes(instanceId) ?? false;
  }

  /** PLAY IT / USE AS RESOURCE — the design's own pair (D08), split when both apply, either one full-width alone. */
  #drawPlayAndPayButtons(rect: Rect, model: InspectModel, area: Rect): void {
    const showPlay = model.status.playable === true;
    const showPay = model.resourceIcons.length > 0 && this.#isHandCard();
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
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Play it",
          type: typeRole.barTitle,
          rect: { x, y: area.y, width, height: area.height },
          onClick: play,
        }),
      );
      x += width + gap;
    }
    if (showPay) {
      const enabled = model.canPayAsResource;
      if (enabled && !showPlay) this.#primaryAction = payWith;
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: "Use as resource",
          type: showPlay ? typeRole.label : typeRole.barTitle,
          rect: { x, y: area.y, width, height: area.height },
          onClick: payWith,
          enabled,
          ...(enabled ? {} : { reason: "Open a card to pay for first" }),
        }),
      );
    }
  }

  /**
   * A labeled row of tappable chips (keywords → the Rules overlay at that term; traits carry no `glossaryId` and
   * are plain text-in-a-box). Returns the next y, just past the chips' own last row — the caller adds
   * `RULES_SECTION_GAP` before whatever comes next, the same convention every other section here follows.
   * Deliberately raw graphics rather than `McButton` per chip: the design's chip is a transparent outline, and
   * every widget skin (`ui/theme.ts#skin`) fills its control — a `McButton` chip would read as a small filled block
   * instead. Each chip still gets its own `PressArm` so a chip that appears mid-rebuild is never accidentally
   * activated by the release of the gesture that opened this sheet (the exact hazard `#dismissArm`'s own comment
   * documents for the scrim).
   */
  #drawChips(
    rect: Rect,
    top: number,
    inner: number,
    heading: string,
    items: readonly { readonly text: string; readonly glossaryId: string | null }[],
  ): number {
    if (items.length === 0) return top;
    label(this, rect.x + RULES_PAD, top, heading, typeRole.label, surface.paper.hex, ink.meta);
    let x = rect.x + RULES_PAD;
    let y = top + 16;
    let rows = 1;
    for (const item of items) {
      const text = this.add.text(
        x + 8,
        y + 5,
        caseOf(typeRole.label, item.text),
        textStyle(typeRole.label, surface.paper.hex),
      );
      const chipWidth = text.width + 16;
      if (x + chipWidth > rect.x + RULES_PAD + inner) {
        x = rect.x + RULES_PAD;
        y += 28;
        rows += 1;
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
    return top + 16 + rows * 28;
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

  /** Draws the whole sheet; returns its body's measured content height, for `#rebuild`'s content-hugging pass. */
  #drawSheet(layout: Extract<InspectLayout, { mode: "sheet" }>, model: InspectModel): number {
    const { sheet, handle, content, footer, footerPrimaryRow, footerQuietRow } = layout;

    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(sheet.x, sheet.y, sheet.width, sheet.height);
    g.lineStyle(border.object, surface.paper.hex, 1).strokeRect(sheet.x, sheet.y, sheet.width, sheet.height);
    // The sheet swallows every tap inside it — it has scrolling content and controls of its own, so "tap anywhere
    // to dismiss" only applies to the dimmed board sliver above it (the scrim zone `#rebuild` already drew) and
    // the explicit Close button in the footer.
    this.add.zone(sheet.x, sheet.y, sheet.width, sheet.height).setOrigin(0, 0).setInteractive();

    const handlePill: Rect = {
      x: sheet.x + sheet.width / 2 - 22,
      y: handle.y + handle.height / 2 - 2,
      width: 44,
      height: 4,
    };
    const pill = this.add.graphics();
    pill.fillStyle(surface.ink.hex, 0.35).fillRect(handlePill.x, handlePill.y, handlePill.width, handlePill.height);

    const contentHeight = this.#drawSheetContent(content, model);
    this.#drawSheetFooter(footer, footerPrimaryRow, footerQuietRow, model);
    return contentHeight;
  }

  /**
   * The sheet's whole scrolling body, in one `McScrollRegion` (`ui/scroll-region.ts`) — P14's own single
   * `overflow-y:auto` flex column: thumbnail/name/type/chips/rules text, then — only when there's something to
   * say — a red "right now" callout, a bordered parchment "keywords" box, and "this game" history rows, each its
   * own real shape rather than three sections folded into one string.
   *
   * Drawn top to bottom in one pass, each element measured for real as it's added rather than pre-measured, the
   * same thing `#drawCardTextBlock` already does for the panels' card face text. The total is returned, because
   * the collapsed sheet hugs it: `#rebuild` draws once to measure and, if that asks for a different sheet height,
   * draws again at the final size within the same frame. Once the last element lands, the accumulated
   * height becomes the region's one logical "row" (`heights` is only ever read for scroll math, never for
   * drawing), and everything drawn so far is reparented into it — the "eagerly draw at the scroll region's real
   * screen position, then move it into the masked/translated layer" trick `table-setup.ts#captureInto` already
   * uses for the identical widget.
   */
  #drawSheetContent(rect: Rect, model: InspectModel): number {
    const before = this.children.list.length;
    const pad = SHEET_CONTENT_PAD;
    const column = sheetTextColumn(rect.width);
    const textLeft = rect.x + column.x;
    const textWidth = column.width;

    const thumb: Rect = { x: rect.x + pad, y: rect.y, width: SHEET_THUMB.width, height: SHEET_THUMB.height };
    const frame = this.add.graphics();
    frame.fillStyle(surface.parchment.hex, 1).fillRect(thumb.x, thumb.y, thumb.width, thumb.height);
    frame.lineStyle(border.object, surface.ink.hex, 1).strokeRect(thumb.x, thumb.y, thumb.width, thumb.height);
    const key = cardArt(this).request(this, model.art);
    if (!drawArt(this, key, thumb)) {
      label(
        this,
        thumb.x + thumb.width / 2,
        thumb.y + thumb.height / 2,
        model.hidden ? "facedown" : "no scan",
        typeRole.label,
        surface.ink.hex,
        ink.meta,
      ).setOrigin(0.5);
    }

    // Name: "fit to width" (a shrinking single line, `fitText`), not a wrap — the same treatment the panels' card
    // panel gives its own name, for a name too long to fit even a hero's own longest printed one.
    let ty = rect.y;
    const name = this.add
      .text(textLeft, ty, caseOf(typeRole.barTitle, model.name), {
        ...textStyle(typeRole.barTitle, surface.ink.hex),
        fontSize: "26px",
      })
      .setLetterSpacing(0.4);
    fitText(name, textWidth, 26);
    ty += name.height + 3;
    const typeLine = label(this, textLeft, ty, model.typeLine, typeRole.label, surface.ink.hex, ink.label);
    typeLine.setWordWrapWidth(textWidth);
    ty += typeLine.height + 7;

    if (model.keywordChips.length > 0) {
      ty = this.#drawSheetHeaderChips(textLeft, ty, textWidth, model.keywordChips) + 7;
    }

    const bodySize = appSession().settings.largeCardText ? 16 : minType.phoneBody + 1;
    const rules = this.add
      .text(textLeft, ty, model.rulesText, textStyle(typeRole.body, surface.ink.hex))
      .setFontSize(bodySize)
      .setLineSpacing(3)
      .setWordWrapWidth(textWidth);
    ty += rules.height;

    if (model.printedText) {
      ty += 8;
      const errataLabel = label(
        this,
        textLeft,
        ty,
        "printed text (superseded by errata)",
        typeRole.label,
        surface.ink.hex,
        ink.meta,
      );
      errataLabel.setWordWrapWidth(textWidth);
      ty += errataLabel.height + 4;
      const printed = this.add
        .text(textLeft, ty, model.printedText, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setFontSize(Math.max(minType.phoneBody, 10))
        .setWordWrapWidth(textWidth);
      ty += printed.height;
    }
    if (model.flavor) {
      ty += 8;
      const flavor = this.add
        .text(textLeft, ty, model.flavor, {
          ...textStyle(typeRole.body, surface.ink.hex, 0.65),
          fontSize: "11px",
          fontStyle: "italic",
        })
        .setWordWrapWidth(textWidth);
      ty += flavor.height;
    }

    let y = Math.max(thumb.y + thumb.height, ty) + SHEET_ROW_GAP;

    // "Right now" — only for a card the player cannot play right now, with the engine's own sentence
    // (`#rightNowSentence`, shared verbatim with panels mode) as the reason. A playable card's footer already says
    // so (an enabled PLAY button); a redundant "Playable." callout on every ordinary card would bury the one case
    // this box exists for. A card whose resources depend on the table (Band Together) shows it too, for what it's
    // worth right now.
    if ((model.status.playable === false || model.resourceNote) && this.#rightNowSentence(model)) {
      y = this.#drawSheetRightNow(rect.x + pad, y, rect.width - pad * 2, model) + SHEET_ROW_GAP;
    }

    if (model.keywordDefinitions.length > 0) {
      y = this.#drawSheetKeywords(rect.x + pad, y, rect.width - pad * 2, model) + SHEET_ROW_GAP;
    }

    if (model.history.length > 0) {
      y = this.#drawSheetHistory(rect.x + pad, y, rect.width - pad * 2, model);
    }

    const contentHeight = Math.max(1, y - rect.y);
    const added = this.children.list.slice(before);
    this.#sheetRegion = new McScrollRegion(this, { rect, heights: [contentHeight], scroll: this.#sheetScroll });
    this.#sheetRegion.content.add(added);
    return contentHeight;
  }

  /**
   * The header's own keyword chip row, wrapping to more rows as needed — the design's outline chip, a tap target
   * into the Rules glossary at that term (`#openRulesAt`). Returns the bottom y, past the last row.
   *
   * Each tap is gated on the chip's *current* on-screen position (`#sheetRegion`'s own viewport rect, not the
   * position it was drawn at): these chips live inside the scrolling region, so a chip scrolled out of view still
   * exists at its own (now off-screen) world position, and Phaser's hit-testing doesn't know about the region's
   * mask — only about where the object actually is. Without the check, a chip scrolled out through the top of the
   * sheet could sit exactly where the dimmed board's "tap anywhere to dismiss" scrim is, and win the tap instead of
   * it (the same "clip" hazard `McButton`'s own `clip` option exists for, in a virtualized list).
   */
  #drawSheetHeaderChips(x: number, y: number, width: number, chips: InspectModel["keywordChips"]): number {
    let cx = x;
    let cy = y;
    for (const chip of chips) {
      const text = this.add
        .text(cx + 6, cy + 3, caseOf(typeRole.label, chip.text), textStyle(typeRole.label, surface.ink.hex))
        .setFontSize(9);
      const chipWidth = text.width + 12;
      if (cx > x && cx + chipWidth > x + width) {
        cx = x;
        cy += 22;
        text.setPosition(cx + 6, cy + 3);
      }
      const box = this.add.graphics();
      box.lineStyle(border.detail, surface.ink.hex, 1).strokeRect(cx, cy, chipWidth, 18);
      this.children.bringToTop(text);
      if (chip.glossaryId) {
        const glossaryId = chip.glossaryId;
        const arm = new PressArm();
        const zone = this.add.zone(cx, cy, chipWidth, 18).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        zone.on("pointerdown", () => arm.down());
        zone.on("pointerout", () => arm.cancel());
        zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (!arm.up()) return;
          const clip = this.#sheetRegion?.rect ?? null;
          if (clip && !pointInRect(pointer.x, pointer.y, clip)) return;
          this.#openRulesAt(glossaryId, chip.text);
        });
      }
      cx += chipWidth + 6;
    }
    return cy + 18;
  }

  /** "Right now" — the phone sheet's own red callout, straight off `#rightNowSentence`, drawn on paper rather than panels' ink ground (border-and-tint, never a shadow, per the design's own depth model). */
  #drawSheetRightNow(x: number, y: number, width: number, model: InspectModel): number {
    label(this, x, y, "right now", typeRole.label, accent.heroRed.hex, 1);
    const boxTop = y + 16;
    const text = this.add
      .text(x + 13, boxTop + 11, this.#rightNowSentence(model), textStyle(typeRole.body, surface.ink.hex))
      .setFontSize(12)
      .setLineSpacing(4)
      .setWordWrapWidth(width - 26);
    const boxHeight = text.height + 22;
    const box = this.add.graphics();
    box.fillStyle(accent.heroRed.hex, 0.16).fillRect(x, boxTop, width, boxHeight);
    box.lineStyle(border.object, accent.heroRed.hex, 1).strokeRect(x, boxTop, width, boxHeight);
    this.children.bringToTop(text);
    return boxTop + boxHeight;
  }

  /**
   * The bordered parchment "keywords" box: every keyword this card prints, with the glossary's own definition
   * (P14's own boxed shape, distinct from the header's tappable chips above it, which name the keywords but don't
   * define them).
   */
  #drawSheetKeywords(x: number, y: number, width: number, model: InspectModel): number {
    const padX = 11;
    const padY = 10;
    const gap = 7;
    const bodyWidth = width - padX * 2;
    const heading = label(this, x + padX, y + padY, "keywords", typeRole.label, surface.ink.hex, ink.meta);
    let ty = y + padY + heading.height + gap;
    const texts: Phaser.GameObjects.Text[] = [heading];
    model.keywordDefinitions.forEach((entry, index) => {
      if (index > 0) ty += 6;
      const term = this.add.text(x + padX, ty, `${entry.label} —`, {
        ...textStyle(typeRole.body, surface.ink.hex),
        fontSize: "11px",
        fontStyle: "700",
      });
      const def = this.add
        .text(x + padX + term.width + 5, ty, entry.definition, textStyle(typeRole.body, surface.ink.hex))
        .setFontSize(Math.max(minType.phoneBody, 10.5))
        .setLineSpacing(3)
        .setWordWrapWidth(Math.max(1, bodyWidth - term.width - 5));
      texts.push(term, def);
      ty += Math.max(term.height, def.height);
    });
    const boxHeight = ty - y + padY;
    const box = this.add.graphics();
    box.fillStyle(surface.parchment.hex, 1).fillRect(x, y, width, boxHeight);
    box.lineStyle(border.object, surface.ink.hex, 1).strokeRect(x, y, width, boxHeight);
    for (const t of texts) this.children.bringToTop(t);
    return y + boxHeight;
  }

  /**
   * "This game" — every accumulated history line for this instance, each with its own round tag and a 3px left
   * rule (P14's own boxless list, distinct from the bordered Keywords box above it).
   */
  #drawSheetHistory(x: number, y: number, width: number, model: InspectModel): number {
    const heading = label(this, x, y, "this game", typeRole.label, surface.ink.hex, ink.meta);
    let ty = y + heading.height + 6;
    const tagWidth = 34;
    const rowPadX = 9;
    for (const line of model.history) {
      const rowTop = ty;
      const tag = this.add.text(x + rowPadX, rowTop + 3, line.roundTag, {
        ...textStyle(typeRole.label, surface.ink.hex, ink.meta),
        fontSize: "9px",
        fontStyle: "800",
      });
      const desc = this.add
        .text(x + rowPadX + tagWidth + rowPadX, rowTop + 3, line.text, textStyle(typeRole.body, surface.ink.hex))
        .setFontSize(Math.max(minType.phoneBody, 10.5))
        .setLineSpacing(3)
        .setWordWrapWidth(Math.max(1, width - rowPadX * 2 - tagWidth));
      const rowHeight = Math.max(tag.height, desc.height) + 6;
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, 1).fillRect(x, rowTop, border.object, rowHeight);
      ty = rowTop + rowHeight + 6;
    }
    return ty - 6;
  }

  #drawSheetFooter(footer: Rect, primaryRow: Rect, quietRow: Rect, model: InspectModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(footer.x, footer.y, footer.width, footer.height);
    this.add.zone(footer.x, footer.y, footer.width, footer.height).setOrigin(0, 0).setInteractive();

    // "Dim, don't hide": PLAY stays in place (disabled, with the engine's own reason) for a hand card that cannot be
    // played this instant, and PAY WITH stays whenever this card could ever be paid with — the same convention
    // `#drawPlayAndPayButtons` follows for panels mode. Neither is omitted just because now is not the moment.
    // A card in play with a usable ability gets its ability buttons instead, as in panels mode (`#drawButtons`):
    // `status.playable` is true for a `useAbility` match too, and Aunt May's sheet offered "Play 1", which sent a
    // play for a card already in play and did nothing.
    const canPlay = model.status.playable === true;
    const showPlay = canPlay || (model.status.playable === false && this.#isHandCard());
    const showPay = model.resourceIcons.length > 0 && this.#isHandCard();
    if (model.abilities.length > 0) {
      const instanceId = this.#instanceId;
      const gap = 6;
      const width = (primaryRow.width - gap * (model.abilities.length - 1)) / model.abilities.length;
      model.abilities.forEach((ability, index) => {
        const use = (): void => {
          this.#close();
          if (instanceId) this.game.events.emit("mc-use-ability", instanceId, ability.abilityId);
        };
        if (index === 0) this.#primaryAction = use;
        this.#buttons.push(
          new McButton(this, {
            kind: index === 0 ? "primary" : "onInk",
            label: ability.label,
            type: model.abilities.length === 1 ? typeRole.rowTitle : typeRole.label,
            rect: { x: primaryRow.x + index * (width + gap), y: primaryRow.y, width, height: primaryRow.height },
            onClick: use,
          }),
        );
      });
    } else if (showPlay || showPay) {
      const gap = showPlay && showPay ? 6 : 0;
      // P14's own 1.4:1 split when both show; either one alone takes the full row.
      const split = sheetPlayPayWidths(primaryRow.width, gap);
      const playWidth = showPlay && showPay ? split.play : primaryRow.width;
      const payWidth = showPlay && showPay ? split.pay : primaryRow.width;
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
        if (canPlay) this.#primaryAction = play;
        this.#buttons.push(
          new McButton(this, {
            kind: "primary",
            label: "Play",
            ...(model.cost !== null ? { value: String(model.cost) } : {}),
            type: typeRole.rowTitle,
            rect: { x, y: primaryRow.y, width: playWidth, height: primaryRow.height },
            onClick: play,
            enabled: canPlay,
            ...(canPlay || !model.status.message ? {} : { reason: model.status.message }),
          }),
        );
        x += playWidth + gap;
      }
      if (showPay) {
        const enabled = model.canPayAsResource;
        if (enabled && !canPlay) this.#primaryAction = payWith;
        this.#buttons.push(
          new McButton(this, {
            kind: "onInk",
            label: "Pay with",
            type: typeRole.rowTitle,
            rect: { x, y: primaryRow.y, width: payWidth, height: primaryRow.height },
            onClick: payWith,
            enabled,
            ...(enabled ? {} : { reason: "Open a card to pay for first" }),
          }),
        );
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
