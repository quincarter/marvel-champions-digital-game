/**
 * The Board: the table itself.
 *
 * This scene draws `BoardModel` and `Highlights` and nothing else. It holds no
 * game state, makes no legality decision, and computes no stat — it subscribes
 * to the store, asks the view models what to show, and sends every command back
 * through the store's single `dispatch` (PLAN.md Phase 4, "Phaser is a view,
 * never an authority").
 *
 * Interaction follows the design: tapping an action-bar button with targets
 * enters target-select mode (the button inverts to red), the valid targets
 * pulse, and everything not targetable drops to 35–42% rather than being
 * hidden, so the board never reflows mid-decision.
 */

import Phaser from "phaser";
import { CORE_DEPS } from "@mc/cards";
import type { AbilityId, ResourceIconType } from "@mc/content";
import type { Command, GameEvent, InstanceId, LegalAction, PlayerId, ZoneId } from "@mc/engine";
import { cardArt, drawArt, type ArtFit, type CardArt } from "../art/card-art.js";
import { CARD_BACKS, type ArtSource } from "../art/art-source.js";
import { appSession } from "../session.js";
import { abilityLabelOf, abilityShortLabelOf } from "../view/ability-label.js";
import { cardName } from "../view/names.js";
import { accent, dotGrid, hit, ink, motion, signal, status as statusTokens, surface, threatMeter, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, McHpPlate, McSelectionRing, McStatBadge, McTabs, fitText, label, paintDotGrid, paintPanel, type StatKey } from "../ui/widgets.js";
import { boardModel, type BoardModel, type CharacterPanel, type HandCardView, type SchemePanel, type StatTile } from "../view/board-model.js";
import {
  beginPayment,
  paymentView,
  togglePayment,
  type PaymentState,
  type PaymentView,
} from "../view/payment-model.js";
import { abilityActionsFor, highlights, type BasicAction, type Highlights, type IllegalReason, type UsableAbilityAction } from "../view/highlights.js";
import { appendEvents, emptyLog, type LogState } from "../view/log-lines.js";
import { tabsTouchedBy } from "../view/tab-badges.js";
import { beatsFrom, type Beat } from "../view/beats.js";
import { travelsFrom, type Travel } from "../view/travel.js";
import { gamepadIntentFor, type GamepadIntent } from "../view/gamepad.js";
import { focusOrder, sameTarget, stepFocus, type FocusTarget } from "../view/focus.js";
import {
  boardLayout,
  cardRow,
  cardStatColumn,
  CARD_ASPECT,
  PHONE_TABS,
  statBlockLayout,
  type BoardLayout,
  type PhoneTab,
  type Rect,
  type StatBlock,
} from "../view/layout.js";
import type { SessionState } from "../store/session-store.js";
import { SCENES } from "./keys.js";

/** What the player has picked so far, when an action needs a target or a payment. */
type Selection =
  | { readonly kind: "idle" }
  /** An action-bar button or a hand card is chosen; now pick what it aims at. */
  | { readonly kind: "targeting"; readonly action: LegalAction; readonly prompt: string }
  /**
   * A card is chosen and aimed; now pick what pays for it. The design makes
   * this a mode over the hand rather than a dialog (`Board - Phone`: a red
   * "PAYING 1 / 3" bar above a hand you tap), so it lives in this scene.
   */
  | { readonly kind: "paying"; readonly payment: PaymentState };

export class BoardScene extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #model: BoardModel | null = null;
  #marks: Highlights | null = null;
  #layout: BoardLayout | null = null;
  #log: LogState = emptyLog();
  #selection: Selection = { kind: "idle" };
  #buttons: McButton[] = [];
  #rings: McSelectionRing[] = [];
  /** Card rect by instance id, so a target tap can be hit-tested and ringed. */
  #hitRects = new Map<InstanceId, Rect>();
  #version = -1;
  #choiceOpen = false;
  /** Which zone the phone board is showing. Ignored on wider layouts. */
  #activeTab: PhoneTab = "me";
  /** Changes that landed on a tab the player isn't looking at, per tab. */
  #tabBadges = new Map<PhoneTab, number>();
  #tabs: McTabs | null = null;
  /** Beats still floating, with when each started, so a redraw doesn't kill them. */
  #beats: { readonly beat: Beat; readonly startedAt: number }[] = [];
  /**
   * `cardMoved` events from the most recently landed *fresh* state, waiting
   * for the one `#draw()` that can turn them into travels — the first draw
   * after they land is the only point that has both `#hitRects` (freshly
   * rebuilt, "where a card is now") and a snapshot of the draw before it
   * ("where a card was"). Consumed and cleared by `#startTravels`.
   */
  #pendingMoves: readonly GameEvent[] = [];
  /** Travels still in flight, with when each started — the same `beats.ts` trick, so a redraw mid-flight re-derives the ghost's position instead of losing it. */
  #travels: { readonly travel: Travel; readonly startedAt: number }[] = [];
  /** Keyboard focus: what is focused, not where — the "where" is re-derived each draw. */
  #focus: FocusTarget | null = null;
  /** Rects of everything focusable this draw, so the ring knows where to go. */
  #focusRects = new Map<string, Rect>();
  #focusRing: McSelectionRing | null = null;
  /** Card scans, shared with every overlay above this scene. */
  #artCache: CardArt | null = null;
  #artUnsubscribe: (() => void) | null = null;
  /**
   * The tabbed hand's horizontal scroll, in unscrolled-layout pixels — how far
   * the row has been dragged or scrolled left. `cardRow`'s own output never
   * shrinks or shifts for this; the scene subtracts it from every slot's `x`
   * at draw time, the same separation `#activeTab` keeps between "what the
   * layout computed" and "what the player is currently looking at."
   */
  #handScrollX = 0;
  /** This draw's ceiling for `#handScrollX`, recomputed by `#drawHand` every draw. */
  #handMaxScroll = 0;
  /** The hand's own content rect, unscrolled — where a wheel/drag gesture has to land to scroll it. */
  #handContentRect: Rect | null = null;
  /** Whether the tabbed hand shows every card at full size (and scrolls further) instead of collapsing the overflow to spines. */
  #handFannedOut = false;

  get #art(): CardArt {
    this.#artCache ??= cardArt(this);
    return this.#artCache;
  }

  constructor() {
    super(SCENES.board);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    const { store } = appSession();
    this.#unsubscribe = store.subscribe((state) => this.#onState(state));
    const onResize = (): void => this.#draw();
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
    // A scan arrives after the frame that asked for it, so the board redraws
    // once per batch rather than holding the table back on the network.
    this.#artUnsubscribe = this.#art.onArrived(() => this.#draw());
    this.#bindKeys();
    this.#bindGamepad();
    // A wheel/trackpad gesture over the hand scrolls it, on any layout that
    // needs scrolling at all — the tabbed board is the only one that ever
    // does (`#drawHand`), so this is a no-op everywhere else.
    this.input.on("wheel", this.#onWheel, this);
    // The Inspect overlay's "Play it" comes back here, because playing a card
    // is the board's job: the overlay only ever reports what the engine said.
    this.game.events.on("mc-play-card", this.#onInspectPlay, this);
    // Same pattern for the ability picker Inspect opens when a card offers
    // more than one usable ability (see #onCharacterTap): the sheet reports
    // which one was picked, and only the board ever dispatches.
    this.game.events.on("mc-use-ability", this.#onInspectUseAbility, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#artUnsubscribe?.();
      this.#artUnsubscribe = null;
      this.game.events.off("mc-play-card", this.#onInspectPlay, this);
      this.game.events.off("mc-use-ability", this.#onInspectUseAbility, this);
      this.input.off("wheel", this.#onWheel, this);
    });
  }

  /** A wheel or trackpad gesture over the hand's own rect scrolls it horizontally. */
  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, deltaX: number, deltaY: number): void {
    const rect = this.#handContentRect;
    if (!rect || this.#handMaxScroll <= 0) return;
    if (pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    // A vertical mouse wheel is still "scroll the hand" here — there is
    // nothing in this rect to scroll vertically, and a trackpad's horizontal
    // deltaX takes priority when a gesture actually has one. Positive scrolls
    // right (reveals more of the hand), matching a page's own vertical wheel.
    this.#scrollHandBy(deltaX !== 0 ? deltaX : deltaY);
  }

  /** Moves the hand's scroll by a pixel delta (positive reveals more to the right), clamped to what `#drawHand` last measured. */
  #scrollHandBy(delta: number): void {
    if (this.#handMaxScroll <= 0) return;
    const next = Math.min(this.#handMaxScroll, Math.max(0, this.#handScrollX + delta));
    if (next === this.#handScrollX) return;
    this.#handScrollX = next;
    this.#draw();
  }

  #onState(state: SessionState): void {
    if (!state.game || state.perspectiveId === null) return;

    // Fold this command's events onto the log before the state replaces it.
    const fresh = state.version !== this.#version;
    if (fresh) {
      this.#log = appendEvents(this.#log, state.lastEvents, state.game, state.perspectiveId);
      this.#noteTabChanges(state);
      this.#startBeats(state.lastEvents);
      this.#pendingMoves = state.lastEvents;
      this.#version = state.version;
      // A new state invalidates any half-made selection: the engine may have
      // changed what is legal, and a stale target would just be rejected.
      this.#selection = { kind: "idle" };
    }

    this.#model = boardModel(state.game, state.perspectiveId, CORE_DEPS);
    this.#marks = state.legal ? highlights(state.legal.actions) : null;

    if (state.game.outcome) {
      this.scene.start(SCENES.gameOver);
      return;
    }
    // Only a *new* command can start a villain phase; a plain redraw re-reads
    // the same `lastEvents` and must not re-open a walkthrough the player skipped.
    if (fresh) this.#openVillainWalkthrough(state.lastEvents);
    this.#syncChoiceOverlay(state);
    this.#draw();
  }

  /**
   * Opens the villain-phase walkthrough when a villain phase begins.
   *
   * This is the whole of the Board's side of the contract documented at the top
   * of `scenes/villain-phase.ts`: a bare, payload-free launch. The overlay
   * subscribes to the store itself, accumulates the phase's beats across the
   * several commands one phase can span, and closes itself when the phase ends.
   *
   * `placeThreat` is villain-phase step one, so this fires exactly once per
   * phase and never on the later within-phase step changes — which is what lets
   * a player who skipped the walkthrough stay skipped for the rest of that phase.
   *
   * The `isActive` guard is load-bearing. `launch` is NOT a no-op on an
   * already-running scene in Phaser 4.2.1: it queues `SceneManager.start`, which
   * for a scene in RUNNING..SLEEPING calls `sys.shutdown()` then `sys.start()` —
   * a restart that would throw away the overlay's accumulated beats and its
   * reveal cursor mid-phase. (`run()` is no safer: a RUNNING scene falls through
   * its sleeping/paused branches to the same `start()`.)
   */
  #openVillainWalkthrough(events: readonly GameEvent[]): void {
    if (this.scene.isActive(SCENES.villainPhase)) return;
    const begins = events.some(
      (event) => event.type === "stepChanged" && event.to.phase === "villain" && event.to.kind === "placeThreat",
    );
    if (begins) this.scene.launch(SCENES.villainPhase);
  }

  /**
   * Counts what happened on the tabs the player isn't looking at, so a phone
   * board never changes silently off screen. Only meaningful on phone, but the
   * counting is cheap and keeps the badge correct if the window is narrowed
   * mid-game.
   */
  #noteTabChanges(state: SessionState): void {
    if (!state.game || state.perspectiveId === null) return;
    for (const [tab, count] of tabsTouchedBy(state.lastEvents, state.game, state.perspectiveId)) {
      if (tab === this.#activeTab) continue;
      this.#tabBadges.set(tab, (this.#tabBadges.get(tab) ?? 0) + count);
    }
  }

  /**
   * The pending-choice overlay runs in parallel over this scene, so the board
   * stays visible underneath while a decision is open.
   */
  #syncChoiceOverlay(state: SessionState): void {
    const open = state.game?.pendingChoice != null;
    if (open && !this.#choiceOpen) {
      this.#choiceOpen = true;
      this.scene.launch(SCENES.choice);
    } else if (!open && this.#choiceOpen) {
      this.#choiceOpen = false;
      this.scene.stop(SCENES.choice);
    }
  }

  #draw(): void {
    const model = this.#model;
    if (!model) return;

    // The positions cards held under whatever was drawn last — the only place
    // "where a card came from" can still be read once this redraw clears the
    // board and rebuilds `#hitRects` for where cards are now (`view/travel.ts`).
    const previousHitRects = new Map(this.#hitRects);

    for (const button of this.#buttons) button.destroy();
    for (const ring of this.#rings) ring.destroy();
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#buttons = [];
    this.#rings = [];
    this.#hitRects.clear();
    this.#focusRects.clear();
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const layout = boardLayout({ x: 0, y: 0, width, height }, {
      playerCount: model.team.length + 1,
      activeTab: this.#activeTab,
    });
    this.#layout = layout;

    // The table felt, and nothing else.
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    this.#drawChrome(layout.zones.chrome!, model);
    if (layout.zones.tabs) this.#drawTabs(layout.zones.tabs, model);
    if (layout.zones.threat) this.#drawSchemes(layout.zones.threat, model);
    if (layout.zones.enemies) this.#drawEnemies(layout.zones.enemies, model);
    if (layout.zones.encounter) this.#drawEncounter(layout.zones.encounter, model);
    if (layout.zones.log) this.#drawLog(layout.zones.log);
    if (layout.zones.me) this.#drawIdentity(layout.zones.me, model);
    if (layout.zones.playArea) this.#drawPlayArea(layout.zones.playArea, model);
    if (layout.zones.team) this.#drawTeam(layout.zones.team, model);
    this.#drawHand(layout.zones.hand!, model);
    this.#drawActionBar(layout.zones.actionBar!, model);
    this.#drawTargetRings();
    this.#drawFocusRing();
    // Turns this redraw's `#pendingMoves` (if any landed) into travels, now
    // that `#hitRects` holds where every card ended up. A no-op on every
    // redraw that isn't the first one after a fresh state (resize, focus
    // movement, a tab switch) — `#pendingMoves` is already empty by then.
    this.#startTravels(previousHitRects);
    // Last, so beats and travelling ghosts float above the table rather than
    // under a later panel.
    this.#drawBeats();
    this.#renderTravels();
  }

  /**
   * Keyboard navigation.
   *
   * Arrows and Tab walk `focusOrder`, Enter and Space act on what is focused,
   * `I` inspects it, and Escape backs out of a mode. A canvas has no focus of
   * its own, so all of this is ours to state — including the visible ring,
   * which is the selection ring drawn static rather than pulsing (a pulse means
   * "the board is waiting for you", and focus is not a prompt).
   *
   * Every case below reduces to one of `GamepadIntent`'s five meanings and
   * hands off to `#actOnIntent`, the same place the gamepad binding
   * (`#bindGamepad`) hands off to — so the two input methods provably drive
   * one route rather than two that happen to agree today.
   */
  #bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on("keydown", (event: KeyboardEvent) => {
      // A decision overlay owns the keyboard while it is up.
      if (this.#choiceOpen || this.scene.isActive(SCENES.inspect)) return;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "Tab":
          event.preventDefault();
          this.#actOnIntent(event.shiftKey && event.key === "Tab" ? "previous" : "next");
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          this.#actOnIntent("previous");
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          this.#actOnIntent("activate");
          break;
        case "i":
        case "I":
          this.#actOnIntent("inspect");
          break;
        case "Escape":
          this.#actOnIntent("cancel");
          break;
        default:
          break;
      }
    });
  }

  /**
   * Gamepad navigation, over the same route the keyboard walks.
   *
   * `phaser4-rex-plugins` is the other agent's widget layer's concern, not
   * input's — this is Phaser's own built-in gamepad plugin (`main.ts` turns it
   * on; it is off by default). `gamepadIntentFor` (`view/gamepad.ts`) is the
   * only thing that knows a button index means "next" or "cancel"; this
   * method only listens and forwards, exactly as `#bindKeys` does for the
   * keyboard's own keys.
   *
   * `Gamepad.on("down", ...)` (bound below via the plugin, not the pad
   * instance) fires once per press, not once per held frame, so there is no
   * repeat-rate to manage the way a keyboard's OS auto-repeat already handles
   * itself. Continuous analog-stick movement is not wired — a D-pad or the
   * face buttons cover every intent this board has, and a stick's constant
   * drift would need its own deadzone-and-repeat timer this pass doesn't
   * need to take on.
   */
  #bindGamepad(): void {
    const gamepad = this.input.gamepad;
    if (!gamepad) return;
    gamepad.on("down", (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (this.#choiceOpen || this.scene.isActive(SCENES.inspect)) return;
      const intent = gamepadIntentFor(button.index);
      if (intent) this.#actOnIntent(intent);
    });
  }

  /** What one `GamepadIntent` does, shared by the keyboard and gamepad bindings. */
  #actOnIntent(intent: GamepadIntent): void {
    switch (intent) {
      case "next":
        this.#moveFocus(1);
        break;
      case "previous":
        this.#moveFocus(-1);
        break;
      case "activate":
        this.#activateFocus();
        break;
      case "inspect":
        if (this.#focus?.kind === "card") this.#inspect(this.#focus.instanceId);
        break;
      case "cancel":
        if (this.#selection.kind !== "idle") {
          this.#selection = { kind: "idle" };
          this.#draw();
        }
        break;
    }
  }

  /** The focus route for whatever the board is currently asking for. */
  #focusOrder(): readonly FocusTarget[] {
    const model = this.#model;
    if (!model) return [];
    if (this.#selection.kind === "targeting") {
      return focusOrder({ kind: "targeting", targets: this.#selection.action.targets }, this.#marks);
    }
    if (this.#selection.kind === "paying") {
      return focusOrder(
        { kind: "paying", sources: this.#selection.payment.query.sources.map((source) => source.instanceId) },
        this.#marks,
      );
    }
    return focusOrder({ kind: "idle", hand: model.hand.map((card) => card.instanceId) }, this.#marks);
  }

  #moveFocus(delta: number): void {
    const order = this.#focusOrder();
    const at = order.findIndex((target) => sameTarget(target, this.#focus));
    const next = stepFocus(order, at, delta);
    this.#focus = next >= 0 ? (order[next] ?? null) : null;
    this.#draw();
  }

  #activateFocus(): void {
    const focus = this.#focus;
    if (!focus) return;
    if (focus.kind === "basic") {
      if (focus.action === "endTurn") void this.#dispatchExample("endTurn");
      else this.#chooseBasic(focus.action);
      return;
    }
    // A card means whatever a tap on it would mean right now.
    if (this.#selection.kind === "paying") this.#spendByInstance(focus.instanceId);
    else if (this.#selection.kind === "targeting") void this.#commitTarget(focus.instanceId);
    // A card in play with a usable ability, not a hand card: `#playCard` only
    // ever looks for a `playCard` entry, so a card that's on the focus route
    // solely because of `usableAbilities` needs the ability path instead.
    else if (this.#marks?.usableAbilities.has(focus.instanceId)) this.#onCharacterTap(focus.instanceId);
    else void this.#playCard(focus.instanceId);
  }

  #drawFocusRing(): void {
    this.#focusRing?.destroy();
    this.#focusRing = null;
    const focus = this.#focus;
    if (!focus) return;
    // Focus that has fallen off the route (the card was played) is dropped
    // rather than drawn somewhere stale.
    if (!this.#focusOrder().some((target) => sameTarget(target, focus))) {
      this.#focus = null;
      return;
    }
    const rect = this.#focusRects.get(focusKey(focus));
    if (!rect) return;
    this.#focusRing = new McSelectionRing(this);
    // Static, not pulsing: the ring says "here you are", not "act now".
    this.#focusRing.show(rect, "static", true);
  }

  /**
   * Starts the beats for a command. They are held as data rather than as game
   * objects, so a redraw between now and their end re-creates them at whatever
   * their anchor's new position is instead of wiping them.
   */
  #startBeats(events: readonly GameEvent[]): void {
    // Reduced motion still gets the beat — it just doesn't travel (#drawBeats).
    this.#beats = beatsFrom(events).map((beat) => ({ beat, startedAt: this.time.now }));
  }

  /**
   * Floats each live beat off its anchor. A beat whose anchor is off screen —
   * a hidden phone tab, a card that has since left play — is simply not drawn;
   * the tab badge is what reports those.
   */
  #drawBeats(): void {
    const now = this.time.now;
    const reduced = appSession().settings.reducedMotion;
    const lifetime = reduced ? motion.damageMs : motion.damageMs * 2.4;
    this.#beats = this.#beats.filter((entry) => now - entry.startedAt < lifetime);

    this.#beats.forEach(({ beat, startedAt }, index) => {
      const rect = this.#hitRects.get(beat.anchor);
      if (!rect) return;
      const elapsed = now - startedAt;
      const remaining = lifetime - elapsed;

      const text = this.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2 - elapsed / 14, beat.text, {
          ...textStyle(typeRole.stat, BEAT_COLORS[beat.tone]),
          // A stroke is the only way a number stays readable over card art.
          stroke: cssOf(surface.ink.hex),
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(1000 + index);

      if (reduced) {
        // Held still, then gone: the information without the movement.
        this.time.delayedCall(remaining, () => text.destroy());
        return;
      }
      this.tweens.add({
        targets: text,
        y: text.y - 26,
        alpha: { from: 1, to: 0 },
        duration: remaining,
        ease: "Quad.easeOut",
        onComplete: () => text.destroy(),
      });
    });
  }

  /**
   * Consumes `#pendingMoves` (if this is the first draw since they landed) and
   * turns them into travels, using `previousHitRects` for "where a card was"
   * and the just-rebuilt `#hitRects` for "where it is now". A no-op — cheaply,
   * since `#pendingMoves` is empty — on every redraw this command didn't cause.
   */
  #startTravels(previousHitRects: ReadonlyMap<InstanceId, Rect>): void {
    if (this.#pendingMoves.length === 0) return;
    const events = this.#pendingMoves;
    this.#pendingMoves = [];

    const layout = this.#layout;
    const perspectiveId = appSession().store.state.perspectiveId;
    if (!layout || perspectiveId === null) return;

    const anchorBefore = (instanceId: InstanceId, zone: ZoneId): Rect | null =>
      previousHitRects.get(instanceId) ?? this.#pileAnchor(zone, layout, perspectiveId, previousHitRects);
    const anchorAfter = (instanceId: InstanceId, zone: ZoneId): Rect | null =>
      this.#hitRects.get(instanceId) ?? this.#pileAnchor(zone, layout, perspectiveId, this.#hitRects);

    const now = this.time.now;
    this.#travels.push(...travelsFrom(events, anchorBefore, anchorAfter).map((travel) => ({ travel, startedAt: now })));
  }

  /**
   * The coarser rect a whole zone gets when no specific card is drawn there —
   * the encounter deck box, the enemies band, the hand banner a card is about
   * to leave or just arrived from. `attachment`/`boost` resolve to their host's
   * own rect, so an upgrade reads as flying onto the card it attached to.
   *
   * Zones this board draws only as a number, never a box — a player's own deck
   * or discard pile chief among them — resolve to `null`, so a move to or from
   * one of those simply has no travel (see `view/travel.ts`'s file comment).
   */
  #pileAnchor(zone: ZoneId, layout: BoardLayout, perspectiveId: PlayerId, rects: ReadonlyMap<InstanceId, Rect>): Rect | null {
    switch (zone.kind) {
      case "encounterDeck":
      case "encounterDiscard":
        return layout.zones.encounter;
      case "villainArea":
        return layout.zones.enemies;
      case "hand":
      case "deck":
      case "discard":
        return zone.playerId === perspectiveId ? layout.zones.hand : layout.zones.team;
      case "playArea":
        return zone.playerId === perspectiveId ? layout.zones.playArea : layout.zones.team;
      case "identity":
        return zone.playerId === perspectiveId ? layout.zones.me : layout.zones.team;
      case "attachment":
      case "boost":
        return rects.get(zone.hostInstanceId) ?? null;
      default:
        return null;
    }
  }

  /**
   * Draws every live travel as a ghost panel morphing from its "from" rect to
   * its "to" rect, then lets it go. Reduced motion drops the flight entirely —
   * the real card already sits at its destination, drawn moments ago by the
   * rest of `#draw()` — the same "keep the information, drop the movement"
   * rule `#drawBeats` follows.
   *
   * Every travel is redrawn from its own elapsed time on every `#draw()` call,
   * the same trick `#drawBeats` uses: `this.children.removeAll(true)` destroys
   * last frame's ghost along with everything else, so this recreates it
   * already partway along its path rather than snapping it back to `from`.
   */
  #renderTravels(): void {
    const now = this.time.now;
    this.#travels = this.#travels.filter((entry) => now - entry.startedAt < motion.cardMoveMs);
    if (appSession().settings.reducedMotion) return;

    for (const { travel, startedAt } of this.#travels) {
      const elapsed = now - startedAt;
      const remaining = motion.cardMoveMs - elapsed;
      if (remaining <= 0) continue;
      const progress = elapsed / motion.cardMoveMs;

      const fromCenter = { x: travel.from.x + travel.from.width / 2, y: travel.from.y + travel.from.height / 2 };
      const toCenter = { x: travel.to.x + travel.to.width / 2, y: travel.to.y + travel.to.height / 2 };
      const scaleTo = { x: travel.to.width / travel.from.width, y: travel.to.height / travel.from.height };

      const ghost = this.add.graphics().setDepth(900);
      ghost.fillStyle(surface.parchment.hex, 0.55).fillRect(-travel.from.width / 2, -travel.from.height / 2, travel.from.width, travel.from.height);
      ghost.lineStyle(3, accent.heroRed.hex, 0.85).strokeRect(-travel.from.width / 2, -travel.from.height / 2, travel.from.width, travel.from.height);
      ghost.setPosition(lerp(fromCenter.x, toCenter.x, progress), lerp(fromCenter.y, toCenter.y, progress));
      ghost.setScale(lerp(1, scaleTo.x, progress), lerp(1, scaleTo.y, progress));

      this.tweens.add({
        targets: ghost,
        x: toCenter.x,
        y: toCenter.y,
        scaleX: scaleTo.x,
        scaleY: scaleTo.y,
        duration: remaining,
        ease: "Quad.easeOut",
        onComplete: () => ghost.destroy(),
      });
    }
  }

  /**
   * Round chip, phase toggle and the current step, on the ink chrome bar.
   *
   * The phase toggle is the first thing to go when the bar is narrow: it says
   * the same thing the step label already says, and two overlapping labels say
   * less than one. The 1st-player mark goes next.
   */
  #drawChrome(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

    // The live round chip is the one red besides the forward action.
    const chip: Rect = { x: rect.x + 8, y: rect.y + 5, width: 54, height: rect.height - 10 };
    const chipG = this.add.graphics();
    chipG.fillStyle(accent.heroRed.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
    this.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, `RD ${model.round}`, textStyle(typeRole.statSmall, surface.paper.hex))
      .setOrigin(0.5);

    let left = chip.x + chip.width + 10;
    const showToggle = rect.width >= 640;
    if (showToggle) {
      // Two-state phase toggle: whichever side's clock is running is filled.
      (["player", "villain"] as const).forEach((phase, index) => {
        const box: Rect = { x: left + index * 86, y: chip.y, width: 82, height: chip.height };
        const active = model.phase === phase;
        const bg = this.add.graphics();
        bg.fillStyle(active ? surface.paper.hex : surface.ink.hex, 1).fillRect(box.x, box.y, box.width, box.height);
        bg.lineStyle(2, surface.paper.hex, active ? 1 : ink.meta).strokeRect(box.x, box.y, box.width, box.height);
        this.add
          .text(box.x + box.width / 2, box.y + box.height / 2, phase.toUpperCase(), textStyle(typeRole.label, active ? surface.ink.hex : surface.paper.hex, active ? 1 : ink.meta))
          .setOrigin(0.5)
          .setLetterSpacing(typeRole.label.letterSpacing);
      });
      left += 86 * 2 + 18;
    }

    const firstPlayer = model.firstPlayerId === model.perspectiveId && rect.width >= 520;
    const rightEdge = rect.x + rect.width - (firstPlayer ? 86 : 10);
    this.add
      .text(left, rect.y + rect.height / 2, model.stepLabel, textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary))
      .setOrigin(0, 0.5)
      .setWordWrapWidth(Math.max(40, rightEdge - left))
      .setMaxLines(1);

    if (firstPlayer) {
      this.add
        .text(rect.x + rect.width - 10, rect.y + rect.height / 2, "1ST PLAYER", textStyle(typeRole.label, signal.caution.hex))
        .setOrigin(1, 0.5)
        .setLetterSpacing(typeRole.label.letterSpacing);
    }
  }

  /**
   * The phone board's zone rail. Only one tabbed zone has a rectangle at a time
   * (`layout.ts`), so this is what makes the other four reachable at all.
   *
   * A tab the player isn't on carries a change badge, because a card that moves
   * to a hidden zone would otherwise happen silently.
   */
  #drawTabs(rect: Rect, model: BoardModel): void {
    const labels: Record<PhoneTab, string> = {
      threat: "Threat",
      enemies: "Enemies",
      me: "Me",
      team: "Team",
      log: "Log",
    };
    // A solo game has no other seats, so it has no Team tab to offer.
    const tabs = PHONE_TABS.filter((tab) => tab !== "team" || model.team.length > 0);

    this.#tabs = new McTabs(this, {
      rect,
      tabs: tabs.map((tab) => ({
        id: tab,
        label: labels[tab],
        ...(this.#tabBadges.get(tab) ? { badge: this.#tabBadges.get(tab)! } : {}),
      })),
      activeId: this.#activeTab,
      onSelect: (id) => {
        this.#activeTab = id as PhoneTab;
        // Looking at a tab is what clears its badge.
        this.#tabBadges.delete(this.#activeTab);
        this.#draw();
      },
    });
  }

  #drawSchemes(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "card", "rest");
    let y = rect.y + 10;

    y = this.#drawScheme({ x: rect.x + 10, y, width: rect.width - 20, height: 92 }, model.mainScheme);
    for (const side of model.sideSchemes.slice(0, 3)) {
      y = this.#drawScheme({ x: rect.x + 10, y: y + 6, width: rect.width - 20, height: 52 }, side);
    }
  }

  /**
   * A scheme with the design's threat meter: fill is always Hero Red. The art
   * sits in a column on the left with a 3px rule beside it, which is how the
   * Long Table canvas frames a scheme.
   */
  #drawScheme(rect: Rect, scheme: SchemePanel): number {
    this.#hitRects.set(scheme.instanceId, rect);
    const g = this.add.graphics();
    paintPanel(g, rect, "card", this.#targetState(scheme.instanceId));

    const dim = this.#dimAlpha(scheme.instanceId);
    // The art column earns its place whenever the name and the meter still fit
    // beside it. The old threshold was tuned for the long table and silently
    // dropped the main scheme's card on every narrower panel.
    const artWidth = rect.width >= 170 ? Math.round(Math.min(96, rect.width * 0.3)) : 0;
    if (artWidth > 0) {
      const column: Rect = { x: rect.x + 3, y: rect.y + 3, width: artWidth, height: rect.height - 6 };
      const frame = this.add.graphics();
      frame.fillStyle(surface.parchment.hex, dim).fillRect(column.x, column.y, column.width, column.height);
      const key = this.#art.request(this, scheme.art);
      if (!drawArt(this, key, column, { alpha: dim, focusY: 0.3 })) {
        label(this, column.x + column.width / 2, column.y + column.height / 2, "art", typeRole.label, surface.ink.hex, ink.meta * dim).setOrigin(0.5);
      }
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
    }

    const textLeft = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
    const textWidth = rect.x + rect.width - 8 - textLeft;
    this.add
      .text(textLeft, rect.y + 6, scheme.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
      .setWordWrapWidth(textWidth)
      .setMaxLines(2);
    label(this, textLeft, rect.y + 30, scheme.subtitle, typeRole.label, surface.ink.hex, ink.label * dim);

    const meter: Rect = { x: textLeft, y: rect.y + rect.height - 26, width: textWidth, height: 18 };
    const mg = this.add.graphics();
    mg.fillStyle(surface.parchment.hex, dim).fillRect(meter.x, meter.y, meter.width, meter.height);
    // Drawn against `meterMax`, not `target`: a side scheme has no threshold but
    // still has somewhere it started from, and a bar that empties as it is
    // thwarted says more than a bare number beside a main scheme that has one.
    if (scheme.meterMax && scheme.meterMax > 0) {
      const ratio = Math.min(1, scheme.threat / scheme.meterMax);
      mg.fillStyle(threatMeter.fill.hex, dim).fillRect(meter.x, meter.y, meter.width * ratio, meter.height);
    }
    mg.lineStyle(2, surface.ink.hex, dim).strokeRect(meter.x, meter.y, meter.width, meter.height);
    this.add
      .text(
        meter.x + meter.width / 2,
        meter.y + meter.height / 2,
        scheme.target === null ? `${scheme.threat} THREAT` : `${scheme.threat} / ${scheme.target} THREAT`,
        textStyle(typeRole.statSmall, surface.ink.hex, dim),
      )
      .setOrigin(0.5);

    this.#makeTapTarget(rect, scheme.instanceId);
    return rect.y + rect.height;
  }

  #drawEnemies(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "card", "rest");

    const villainRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: Math.min(280, rect.width - 20), height: 128 };
    this.#drawCharacter(villainRect, model.villain);

    const minionTop = villainRect.y + villainRect.height + 8;
    const minionArea: Rect = {
      x: rect.x + 10,
      y: minionTop,
      width: rect.width - 20,
      height: Math.max(0, rect.y + rect.height - minionTop - 10),
    };
    if (model.minions.length > 0 && minionArea.height > 40) {
      const slots = cardRow(minionArea, model.minions.length, { gap: 8, maxHeight: minionArea.height });
      model.minions.forEach((minion, index) => this.#drawCharacter(slots[index]!, minion));
    }
  }

  /**
   * The design's entity card: an art band, then name + status, then a stat
   * triplet in 2px boxes (Components.dc.html, "Art band, then name + status,
   * then consequence, then a stat triplet"). A panel too short for a band
   * drops it rather than squeezing it — the compact variant in the same sheet.
   */
  #drawCharacter(rect: Rect, panel: CharacterPanel): void {
    this.#hitRects.set(panel.instanceId, rect);
    const dim = this.#dimAlpha(panel.instanceId);
    // Captured before the frame is painted, because on a card-shaped panel the
    // *frame* turns with the card — it is the card's border, not a box the card
    // sits in. See `#turnSideways`.
    const firstDrawn = this.children.list.length;
    const g = this.add.graphics();
    paintPanel(g, rect, "card", this.#targetState(panel.instanceId));

    // A panel that is already roughly card-shaped *is* the card: the scan fills
    // it and the live numbers ride on top. A wider panel gives the card a
    // column down its left and the numbers the room beside it. Either way the
    // scan is never cropped — a card with its edges cut off reads as broken
    // rather than as art.
    if (rect.width < MIN_PANEL_TEXT_WIDTH + 60 || rect.width < rect.height * 0.95) {
      this.#drawCardShapedPanel(rect, panel, dim, firstDrawn);
      return;
    }

    // As tall as the panel allows, so the card is the thing you see — capped
    // only by leaving the numbers beside it a readable column.
    const artWidth = Math.round(
      Math.min(rect.width - MIN_PANEL_TEXT_WIDTH - 14, (rect.height - 6) * CARD_ASPECT),
    );
    const artColumn: Rect | null =
      artWidth > 0
        ? { x: rect.x + 3, y: rect.y + 3, width: artWidth, height: Math.min(rect.height - 6, Math.round(artWidth / CARD_ASPECT)) }
        : null;
    if (artColumn) {
      const column = artColumn;
      this.#drawArtSlot(column, panel.art, dim);
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
    }

    const left = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
    const textWidth = Math.max(40, rect.x + rect.width - 8 - left);
    /**
     * Stats in a row beside the card, the HP plate under them, pinned to the foot
     * of the text column — never over the card on a wide panel. An identity's scan
     * is shown whole so its rules text can be read, and badges stacked over its
     * printed icons covered that text ("Spider-Sense — Interrupt…"). Laid out
     * before anything above it is placed, so the chips know where to stop.
     */
    const statBlock = statBlockLayout(
      { x: left, y: rect.y, width: textWidth, height: rect.height - 8 },
      panel.stats.filter((tile) => tile.label !== "HP").length,
      panel.hp !== null,
    );
    let top = rect.y + 6;

    const name = this.add
      .text(left, top, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
      .setWordWrapWidth(textWidth)
      .setMaxLines(2);
    // Wrapped, not shrunk: "Alter-ego · Justice" losing "Justice" to an
    // ellipsis loses the aspect, which is a thing the player needs to know.
    const subtitle = label(this, left, top + name.height + 4, panel.subtitle, typeRole.label, surface.ink.hex, ink.label * dim)
      .setWordWrapWidth(textWidth)
      .setMaxLines(2);
    top = subtitle.y + subtitle.height + 6;

    // Status pips: initial only, in the hue that exists nowhere else.
    panel.statuses.forEach(({ status }, index) => {
      const pip: Rect = { x: rect.x + rect.width - 26 - index * 24, y: rect.y + 6, width: 20, height: 20 };
      const pg = this.add.graphics();
      pg.fillStyle(statusTokens[status].hex, dim).fillRect(pip.x, pip.y, pip.width, pip.height);
      pg.lineStyle(3, surface.ink.hex, dim).strokeRect(pip.x, pip.y, pip.width, pip.height);
      this.add
        .text(pip.x + pip.width / 2, pip.y + pip.height / 2, status.charAt(0).toUpperCase(), textStyle(typeRole.statSmall, surface.ink.hex, dim))
        .setOrigin(0.5);
    });

    if (panel.exhausted) {
      top = this.#drawExhaustedBadge(left, top, textWidth, dim);
    }
    if (panel.boostCount > 0) {
      label(this, left, top, `boost ?? ×${panel.boostCount}`, typeRole.label, surface.ink.hex, ink.meta * dim);
      top += 14;
    }
    const abilityLine = this.#abilityLine(panel.instanceId);
    if (abilityLine) {
      // `setMaxLines(1)` with word wrap drops every word past the first line
      // without a trace; `fitText` shrinks to the design's floor and then
      // ellipsizes, so a clipped label at least admits it is clipped.
      fitText(label(this, left, top, abilityLine, typeRole.label, signal.heal.hex, ink.body * dim), textWidth, typeRole.label.size);
      top += 14;
    }

    /**
     * Attachments hanging off this card — an upgrade on your identity, a
     * condition on an ally, an attachment on an enemy.
     *
     * These used to be name-only labels, which was reported from play as "I
     * cannot see those cards and know when I can use those upgrades" —
     * Spider-Man's two Web-Shooters sat here as two identical words. A chip is
     * still the right shape (an upgrade lives *on* its host, and giving each
     * one a card-sized slot would push the host off the table), so the fix is
     * to make the chip do the two things the player wanted:
     *
     *  - **say when it can be used**, with the same green `▶` the board already
     *    uses for an ability you can trigger right now; and
     *  - **open the card**, because the only way to read an upgrade's wording
     *    was to already know where it was.
     *
     * It is a tap target like any other card, so it also answers a target
     * prompt or a payment tap — a Web-Shooter *is* a resource for a payment,
     * and before this there was no way to spend one from the table.
     */
    /**
     * Collected, not registered here: the panel's own tap target is added at
     * the end of this method, and a later interactive zone sits higher in the
     * display list — so a chip registered now would be swallowed by the panel
     * behind it. They go on *after* it.
     */
    const chipTargets: { readonly rect: Rect; readonly instanceId: InstanceId }[] = [];
    for (const attachment of panel.attachments.slice(0, 4)) {
      if (top + 16 > rect.y + rect.height - 8 - statBlock.height - 4) break;
      const usable = this.#selection.kind === "idle" && (this.#marks?.usableAbilities.has(attachment.instanceId) ?? false);
      const chip: Rect = { x: left, y: top, width: textWidth, height: 16 };
      const cg = this.add.graphics();
      cg.fillStyle(surface.parchment.hex, dim).fillRect(chip.x, chip.y, chip.width, chip.height);
      cg.lineStyle(2, usable ? signal.heal.hex : surface.ink.hex, dim * (attachment.exhausted ? ink.disabled : 1))
        .strokeRect(chip.x, chip.y, chip.width, chip.height);
      fitText(
        label(
          this,
          chip.x + 3,
          chip.y + 3,
          usable ? `▶ ${attachment.name}` : attachment.name,
          typeRole.label,
          usable ? signal.heal.hex : surface.ink.hex,
          (usable ? ink.body : ink.label) * dim,
        ),
        chip.width - 6,
        typeRole.label.size,
      );
      chipTargets.push({ rect: chip, instanceId: attachment.instanceId });
      top += 19;
    }

    this.#drawStatBlock(statBlock, panel, dim);

    this.#makeTapTarget(rect, panel.instanceId, () => this.#onCharacterTap(panel.instanceId));
    // After the panel, so an attachment chip wins the pointer over the host it
    // is drawn on top of.
    for (const target of chipTargets) {
      this.#makeTapTarget(target.rect, target.instanceId, () => {
        // A tap uses it when there is something to use; otherwise it shows the
        // card, which is the other half of what was being asked for.
        if (this.#usableAbilitiesFor(target.instanceId).length > 0) this.#onCharacterTap(target.instanceId);
        else this.#inspect(target.instanceId);
      });
    }
  }

  /**
   * A card-shaped panel — a minion in a row, an ally in the play area.
   *
   * The scan fills it, because the slot and the scan are the same shape and the
   * card already prints its own name and printed stats. Only what the *game*
   * knows goes on top: the statuses, and a strip carrying the numbers that
   * change (current HP, modified ATK) which the printed card cannot show.
   */
  #drawCardShapedPanel(rect: Rect, panel: CharacterPanel, dim: number, firstDrawn: number): void {
    // `firstDrawn` is the caller's index, taken *before* the panel frame, so an
    // exhausted card turns frame and all. The tap target is added after the
    // rotation and stays square to the slot — see `#turnSideways`.
    const inner: Rect = { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: rect.height - 6 };
    const key = this.#art.request(this, panel.art);
    if (!drawArt(this, key, inner, { fit: "cover", alpha: dim })) {
      const ground = this.add.graphics();
      ground.fillStyle(surface.parchment.hex, dim).fillRect(inner.x, inner.y, inner.width, inner.height);
      this.add
        .text(inner.x + inner.width / 2, inner.y + 14, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
        .setOrigin(0.5, 0)
        .setWordWrapWidth(inner.width - 8)
        .setMaxLines(2);
    }

    this.#drawStatusPips(rect, panel, dim);

    // Live stats over the printed icons, where the eye already looks for them on
    // this card, and hit points along the foot. Same widgets as the wide panel.
    if (panel.stats.length > 0 && rect.height > 60) {
      const column = cardStatColumn(inner, panel.stats.filter((tile) => tile.label !== "HP").length, panel.hp !== null);
      this.#drawStatBlock(column, panel, dim);
    }
    const abilityLine = this.#abilityLine(panel.instanceId);
    if (abilityLine && rect.height >= 40) {
      fitText(
        label(this, inner.x + 4, inner.y + 4, abilityLine, typeRole.label, signal.heal.hex, ink.body * dim),
        inner.width - 8,
        typeRole.label.size,
      );
    }

    // The card itself turns, the way it does on the table. No word needed.
    if (panel.exhausted) this.#turnSideways(rect, this.children.list.slice(firstDrawn));

    this.#makeTapTarget(rect, panel.instanceId, () => this.#onCharacterTap(panel.instanceId));
  }

  /**
   * A panel's stats, drawn into a laid-out block: a starburst per stat and the
   * hit-point plate. The wide panel and the card-shaped one share this, so a
   * hero, an ally, a minion and the villain all read their numbers one way.
   */
  #drawStatBlock(block: StatBlock, panel: CharacterPanel, dim: number): void {
    panel.stats
      .filter((tile) => tile.label !== "HP")
      .forEach((tile, index) => {
        const slot = block.badges[index];
        if (!slot || tile.label === "HP") return;
        new McStatBadge(this, {
          cx: slot.cx,
          cy: slot.cy,
          size: slot.size,
          stat: BADGE_STAT[tile.label],
          value: tile.value,
          bonus: tile.bonus,
          alpha: dim,
        });
      });
    if (block.hp && panel.hp) {
      new McHpPlate(this, {
        rect: block.hp,
        current: panel.hp.current,
        max: panel.hp.max,
        bonus: panel.stats.find((tile) => tile.label === "HP")?.bonus ?? 0,
        alpha: dim,
      });
    }
  }

  /**
   * Turns a card-shaped panel a quarter turn, the table's own sign for
   * exhausted (RRG "Exhaust": the card is turned sideways).
   *
   * A word in the corner was what this used to be, and it was missed in play —
   * it sat over the card's own cost and name at label size. Rotation is the
   * signal the physical game already uses, it reads at a glance from across the
   * board, and it is a *shape* cue rather than a colour one, so it satisfies
   * the design's colourblind rule without needing a second treatment.
   *
   * **The frame turns too.** A first version rotated only the contents and left
   * the panel border upright, which read as a small card adrift in a big empty
   * box — the border is the *card's* border, not a box the card sits in. The
   * whole panel is therefore in the rotated group.
   *
   * It is scaled so the turned card spans the slot's width, which keeps it from
   * reaching into its neighbours, and it stays centred on the slot so nothing
   * reflows and the tap target stays where the pointer expects it. The board
   * shows through above and below, the way a turned card leaves table visible
   * around it.
   *
   * Objects are re-parented into a container rather than each being rotated,
   * so the whole face — scan, status pips, the ink stat strip — turns as one
   * piece. That also makes this a single `rotation` to tween when the animation
   * pass lands, rather than a dozen.
   */
  #turnSideways(rect: Rect, drawn: readonly Phaser.GameObjects.GameObject[]): void {
    if (drawn.length === 0) return;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const fit = Math.min(rect.width / rect.height, rect.height / rect.width);
    for (const object of drawn) {
      const placed = object as Phaser.GameObjects.GameObject & { x?: number; y?: number };
      if (typeof placed.x === "number") placed.x -= cx;
      if (typeof placed.y === "number") placed.y -= cy;
    }
    this.add
      .container(cx, cy, [...drawn])
      .setRotation(Math.PI / 2)
      .setScale(fit);
  }

  /**
   * The exhausted badge, for a panel too wide to turn.
   *
   * An identity sits in a wide panel with its card in a column and its numbers
   * beside it, so turning it would turn the numbers too. It gets a filled chip
   * in the design's "spent" ink instead. Returns the next free `y`.
   */
  #drawExhaustedBadge(x: number, y: number, maxWidth: number, dim: number): number {
    const caption = label(this, 0, 0, "exhausted", typeRole.label, surface.paper.hex, dim);
    const width = Math.min(maxWidth, Math.ceil(caption.width) + 14);
    const height = Math.ceil(caption.height) + 6;
    const chip = this.add.graphics();
    chip.fillStyle(signal.spent.hex, dim).fillRect(x, y, width, height);
    caption.setPosition(x + 7, y + 3);
    this.children.bringToTop(caption);
    return y + height + 5;
  }

  /** Status pips: initial only, in the hue that exists nowhere else. */
  #drawStatusPips(rect: Rect, panel: CharacterPanel, dim: number): void {
    panel.statuses.forEach(({ status }, index) => {
      const pip: Rect = { x: rect.x + rect.width - 26 - index * 24, y: rect.y + 6, width: 20, height: 20 };
      const pg = this.add.graphics();
      pg.fillStyle(statusTokens[status].hex, dim).fillRect(pip.x, pip.y, pip.width, pip.height);
      pg.lineStyle(3, surface.ink.hex, dim).strokeRect(pip.x, pip.y, pip.width, pip.height);
      this.add
        .text(pip.x + pip.width / 2, pip.y + pip.height / 2, status.charAt(0).toUpperCase(), textStyle(typeRole.statSmall, surface.ink.hex, dim))
        .setOrigin(0.5);
    });
  }

  /**
   * One card slot: the whole scan when it has arrived, and the designed
   * fallback frame when it hasn't. The frame is drawn either way as the
   * ground, so a scan that loads mid-game paints over its own placeholder and
   * there is never a hole where a picture is about to be.
   */
  #drawArtSlot(slot: Rect, source: ArtSource | null, dim: number, fit: ArtFit = "contain"): void {
    const frame = this.add.graphics();
    frame.fillStyle(surface.parchment.hex, dim).fillRect(slot.x, slot.y, slot.width, slot.height);

    const key = this.#art.request(this, source);
    if (!drawArt(this, key, slot, { fit, alpha: dim }) && slot.height >= 26) {
      // The design's empty art slot: present, not filled yet.
      label(this, slot.x + slot.width / 2, slot.y + slot.height / 2, "art", typeRole.label, surface.ink.hex, ink.meta * dim).setOrigin(0.5);
    }
  }

  /**
   * The encounter piles. The deck is a facedown stack, so it shows the
   * encounter back — the same back every facedown encounter card shows, which
   * is what makes a stack read as a stack rather than as a number in a box.
   * The discard is faceup at the table, so it shows its top card.
   */
  #drawEncounter(rect: Rect, model: BoardModel): void {
    const half = (rect.height - 6) / 2;
    const piles: readonly { name: string; count: number; y: number; art: ArtSource | null }[] = [
      { name: "ENC DECK", count: model.encounterPiles.deck, y: rect.y, art: CARD_BACKS.encounter },
      { name: "DISCARD", count: model.encounterPiles.discard, y: rect.y + half + 6, art: model.encounterDiscardTop },
    ];
    for (const { name, count, y, art } of piles) {
      const box: Rect = { x: rect.x, y, width: rect.width, height: half };
      const g = this.add.graphics();
      paintPanel(g, box, count > 0 ? "card" : "quiet", count > 0 ? "rest" : "unavailable");

      const inner: Rect = { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: box.height - 6 };
      const drawn = count > 0 && drawArt(this, this.#art.request(this, art), inner, { fit: "cover" }) !== null;

      label(this, box.x + 6, box.y + 6, name, typeRole.label, drawn ? surface.paper.hex : surface.ink.hex, drawn ? ink.body : ink.label);
      // The count rides on an ink chip over the art, so it stays readable.
      const chip: Rect = { x: box.x + 4, y: box.y + box.height - 26, width: box.width - 8, height: 22 };
      if (drawn) {
        const chipG = this.add.graphics();
        chipG.fillStyle(surface.ink.hex, 0.78).fillRect(chip.x, chip.y, chip.width, chip.height);
      }
      this.add
        .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(count), textStyle(typeRole.stat, drawn ? surface.paper.hex : surface.ink.hex))
        .setOrigin(0.5);
    }
  }

  /** The game log, virtualized: only the lines that fit exist as objects. */
  #drawLog(rect: Rect): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    label(this, rect.x + 6, rect.y + 5, "LOG", typeRole.label, surface.ink.hex, ink.label);

    const lineHeight = 26;
    const capacity = Math.max(0, Math.floor((rect.height - 24) / lineHeight));
    const visible = this.#log.lines.slice(-capacity);
    visible.forEach((line, index) => {
      const y = rect.y + 22 + index * lineHeight;
      label(this, rect.x + 6, y, line.ref, typeRole.mono, surface.ink.hex, ink.meta);
      this.add
        .text(rect.x + 6, y + 11, line.text, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setWordWrapWidth(rect.width - 12)
        // Two lines on the table at most; the rest is one tap away in Inspect.
        .setMaxLines(1);
    });
  }

  #drawIdentity(rect: Rect, model: BoardModel): void {
    this.#drawCharacter(rect, model.me);
  }

  #drawPlayArea(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    label(this, rect.x + 8, rect.y + 6, "your play area", typeRole.label, surface.ink.hex, ink.label);

    const inner: Rect = { x: rect.x + 8, y: rect.y + 22, width: rect.width - 16, height: rect.height - 30 };
    if (model.myPlayArea.length === 0) {
      // A dashed slot: present, not yet filled.
      const empty = this.add.graphics();
      paintPanel(empty, inner, "quiet", "unavailable");
      this.add
        .text(inner.x + inner.width / 2, inner.y + inner.height / 2, "Play a card to put it here", textStyle(typeRole.body, surface.ink.hex, ink.meta))
        .setOrigin(0.5);
      return;
    }
    const slots = cardRow(inner, model.myPlayArea.length, { gap: 8, maxHeight: inner.height });
    model.myPlayArea.forEach((panel, index) => this.#drawCharacter(slots[index]!, panel));
  }

  #drawTeam(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    label(this, rect.x + 8, rect.y + 6, "other heroes", typeRole.label, surface.ink.hex, ink.label);

    const rowHeight = Math.min(58, (rect.height - 28) / Math.max(1, model.team.length));
    model.team.forEach((seat, index) => {
      const row: Rect = { x: rect.x + 8, y: rect.y + 24 + index * (rowHeight + 4), width: rect.width - 16, height: rowHeight };
      const rg = this.add.graphics();
      paintPanel(rg, row, "card", seat.eliminated ? "unavailable" : "rest");
      const alpha = seat.eliminated ? ink.illegal : 1;
      this.add.text(row.x + 6, row.y + 5, seat.name, textStyle(typeRole.rowTitle, surface.ink.hex, alpha));
      label(
        this,
        row.x + 6,
        row.y + 22,
        `${seat.form === "hero" ? "Hero" : "Alter-ego"} · ${seat.hp ? `${seat.hp.current}/${seat.hp.max} HP` : "—"} · ${seat.handCount} cards`,
        typeRole.label,
        surface.ink.hex,
        ink.label * alpha,
      );
      if (seat.done) {
        label(this, row.x + row.width - 40, row.y + 5, "done", typeRole.label, signal.heal.hex, ink.body);
      }
      if (seat.isFirstPlayer) {
        label(this, row.x + row.width - 40, row.y + 22, "1st", typeRole.label, signal.caution.hex, ink.body);
      }
    });
  }

  /**
   * The hand row. On the tabbed board (`Board - Phone`) a crowded hand fans
   * instead of shrinking below a readable size: full-size cards for as many
   * as fit, the rest collapsed to spines, the whole row scrollable by wheel
   * or drag, with a "Fan out" pill to trade the spines for more scrolling in
   * exchange for every card being immediately readable (PLAN.md Phase 4,
   * "the phone hand crowds at six cards"). The long table never crowds this
   * badly at any realistic hand size, so it keeps the older shrink-and-
   * overlap row (`cardRow`'s default).
   */
  #drawHand(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

    // While paying, the caption line gives way to the payment bar: the hand is
    // the instrument of the payment, so the count belongs directly over it.
    const payment = this.#paymentView();
    const tabbed = this.#layout?.tabbed ?? false;
    let top = rect.y + 20;
    if (payment) {
      this.#drawPaymentBar({ x: rect.x, y: rect.y, width: rect.width, height: hit.target }, payment);
      top = rect.y + hit.target + 4;
    } else {
      label(
        this,
        rect.x + 10,
        rect.y + 4,
        `hand ${model.hand.length} · deck ${model.myPiles.deck} · discard ${model.myPiles.discard}`,
        typeRole.label,
        surface.paper.hex,
        ink.label,
      );
    }

    const inner: Rect = { x: rect.x + 10, y: top, width: rect.width - 20, height: rect.y + rect.height - top - 8 };
    const fan: boolean | "expanded" = tabbed ? (this.#handFannedOut ? "expanded" : true) : false;
    const slots = cardRow(inner, model.hand.length, { gap: 6, maxHeight: inner.height, fan });

    const rowRight = slots.reduce((max, slot) => Math.max(max, slot.x + slot.width), inner.x);
    this.#handMaxScroll = Math.max(0, rowRight - (inner.x + inner.width));
    this.#handScrollX = this.#handMaxScroll > 0 ? Math.min(this.#handScrollX, this.#handMaxScroll) : 0;
    this.#handContentRect = inner;

    // The pill only earns its place once there's something to fan or unfan —
    // a hand that already fits has nothing to expand and nowhere to scroll.
    if (tabbed && !payment && (this.#handMaxScroll > 0 || this.#handFannedOut)) {
      this.#drawFanToggle(rect);
    }

    model.hand.forEach((card, index) => {
      const slot = slots[index];
      if (!slot) return;
      const drawn: Rect = { ...slot, x: slot.x - this.#handScrollX };
      this.#hitRects.set(card.instanceId, drawn);
      this.#focusRects.set(focusKey({ kind: "card", instanceId: card.instanceId }), drawn);
      if (slot.kind === "spine") this.#drawHandSpine(drawn, card, index, payment);
      else this.#drawHandCard(drawn, card, payment);
    });
  }

  /**
   * The tabbed hand's "Fan out" pill (`Board - Phone`): toggles between the
   * default row (full-size cards for as many as fit, the rest collapsed to
   * spines) and every card shown full-size, both scrollable. An outlined chip
   * rather than a filled button, the design's own language for a toggle
   * rather than a committing action.
   */
  #drawFanToggle(handRect: Rect): void {
    const width = 62;
    const chip: Rect = { x: handRect.x + handRect.width - width - 8, y: handRect.y + 3, width, height: 14 };
    const g = this.add.graphics();
    g.lineStyle(2, surface.paper.hex, 1).strokeRect(chip.x, chip.y, chip.width, chip.height);
    this.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, (this.#handFannedOut ? "Collapse" : "Fan out").toUpperCase(), textStyle(typeRole.label, surface.paper.hex))
      .setOrigin(0.5)
      .setLetterSpacing(typeRole.label.letterSpacing);
    const zone = this.add.zone(chip.x, chip.y, chip.width, chip.height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => {
      this.#handFannedOut = !this.#handFannedOut;
      // A fresh view onto whatever shape the row just took, rather than
      // leaving the player scrolled to a position that meant something
      // different a moment ago.
      this.#handScrollX = 0;
      this.#draw();
    });
  }

  /**
   * A collapsed hand card (`cardRow`'s "spine" slot): a position number and
   * the card's name running vertically, standing in for a card that has no
   * room to show its face this draw. Still a full tap target — tap, hold and
   * right-click all mean exactly what they mean on a full card
   * (`#makeTapTarget`) — and still drags to scroll like every other card in
   * this row.
   */
  #drawHandSpine(slot: Rect, card: HandCardView, handIndex: number, payment: PaymentView | null): void {
    const spent = payment?.spent.has(card.instanceId) ?? false;
    const subject = payment?.subject === card.instanceId;
    const available = payment
      ? subject || spent || payment.spendable.has(card.instanceId)
      : (this.#marks?.playable.has(card.instanceId) ?? false);
    const alpha = available ? 1 : ink.illegal;

    const g = this.add.graphics();
    paintPanel(g, slot, "card", subject ? "selected" : available ? "rest" : "unavailable");
    if (subject) {
      const ring = new McSelectionRing(this);
      ring.show(slot, "static", true);
      this.#rings.push(ring);
    }

    label(this, slot.x + 3, slot.y + 4, String(handIndex + 1), typeRole.label, surface.ink.hex, ink.label * alpha);

    const name = this.add
      .text(slot.x + slot.width / 2, slot.y + slot.height - 6, card.name, textStyle(typeRole.label, surface.ink.hex, alpha))
      .setOrigin(0.5, 1)
      .setAngle(-90);
    // Pre-rotation width becomes the strip's readable height once turned on
    // its side, so that — not `slot.width` — is what `fitText` has to fit.
    fitText(name, slot.height - 22, typeRole.label.size);

    if (spent) {
      const wash = this.add.graphics();
      wash.fillStyle(surface.ink.hex, 0.3).fillRect(slot.x, slot.y, slot.width, slot.height);
    }

    this.#makeTapTarget(slot, card.instanceId, () => this.#tapHandCard(card.instanceId), (deltaX) => this.#scrollHandBy(-deltaX));
  }

  /**
   * "PAYING 1 / 3 — Photon Blast → Klaw. Tap cards to spend." on Hero Red, with
   * Pay and Cancel, exactly as `Board - Phone` frames the mode.
   *
   * The mock's bar carries only Cancel, and commits the moment the count fills.
   * This one has an explicit Pay because a payment can legitimately exceed the
   * printed cost — "spend X [energy]" counts every resource beyond the fixed
   * cost, so auto-committing at the first sufficient selection would take that
   * choice away (docs/phase2-core-set.md §3, "Spend X").
   */
  #drawPaymentBar(rect: Rect, payment: PaymentView): void {
    const g = this.add.graphics();
    g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

    this.add
      .text(rect.x + 12, rect.y + rect.height / 2, `PAYING ${payment.paid} / ${payment.required}`, textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0, 0.5)
      .setLetterSpacing(1);

    const buttonWidth = Math.max(64, Math.min(120, rect.width * 0.16));
    const buttonsLeft = rect.x + rect.width - buttonWidth * 2 - 18;

    // The line of prose is the first thing to go when the bar is narrow: the
    // card being paid for already wears a "paying for" tag, so the sentence is
    // repeating itself, and a sentence running under the Pay button is worse
    // than no sentence.
    const headlineLeft = rect.x + 170;
    const headlineRoom = buttonsLeft - headlineLeft - 12;
    if (headlineRoom > 90) {
      const outstanding = payment.outstanding.length > 0 ? ` Still needs ${payment.outstanding.join(", ")}.` : "";
      this.add
        .text(headlineLeft, rect.y + rect.height / 2, `${payment.headline}. Tap cards to spend.${outstanding}`, textStyle(typeRole.emphasis, surface.paper.hex))
        .setOrigin(0, 0.5)
        .setWordWrapWidth(headlineRoom)
        .setMaxLines(1);
    }
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Pay",
        type: typeRole.label,
        rect: { x: buttonsLeft, y: rect.y + 4, width: buttonWidth, height: rect.height - 8 },
        enabled: payment.command !== null,
        ...(payment.blockedBy ? { reason: payment.blockedBy } : {}),
        onClick: () => void this.#commitPayment(),
      }),
    );
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "Cancel",
        type: typeRole.label,
        rect: { x: rect.x + rect.width - buttonWidth - 10, y: rect.y + 4, width: buttonWidth, height: rect.height - 8 },
        onClick: () => {
          this.#selection = { kind: "idle" };
          this.#draw();
        },
      }),
    );
  }

  async #commitPayment(): Promise<void> {
    const payment = this.#paymentView();
    if (!payment?.command) return;
    this.#selection = { kind: "idle" };
    await this.#dispatch(payment.command);
  }

  /**
   * One card in hand, in the Long Table canvas's layout: a header strip of cost
   * chip + name + type line, an art band, the rules text, then the resource
   * pips the card generates when spent. An illegal card keeps its place at 38%
   * ink and carries the engine's own reason as a badge ("dim, don't hide").
   */
  #drawHandCard(slot: Rect, card: HandCardView, payment: PaymentView | null): void {
    // While paying, "available" stops meaning "playable" and starts meaning
    // "spendable": the only question in front of the player is what to spend.
    const spent = payment?.spent.has(card.instanceId) ?? false;
    // The card being paid *for* is the subject of the mode, not a candidate in
    // it. It has to look different from a card being spent: marking both the
    // same way said "these two cards are going away", when one of them is the
    // thing you are buying.
    const subject = payment?.subject === card.instanceId;
    const available = payment
      ? subject || spent || payment.spendable.has(card.instanceId)
      : (this.#marks?.playable.has(card.instanceId) ?? false);
    const alpha = available ? 1 : ink.illegal;

    const cg = this.add.graphics();
    paintPanel(cg, slot, "card", subject ? "selected" : available ? "rest" : "unavailable");
    if (subject) {
      // The design's treatment for the card being paid for: the red ring.
      const ring = new McSelectionRing(this);
      ring.show(slot, "static", true);
      this.#rings.push(ring);
    }

    // A hand slot keeps the physical card's 2.5:3.5, and a scan is that same
    // shape, so the scan *is* the card face: it fills the slot with nothing
    // cropped and nothing letterboxed, and it already prints the name, cost,
    // type and rules text better than we can redraw them at this size.
    const inner: Rect = { x: slot.x + 3, y: slot.y + 3, width: slot.width - 6, height: slot.height - 6 };
    const key = this.#art.request(this, card.art);
    const drawn = drawArt(this, key, inner, { fit: "cover", alpha });
    if (!drawn) this.#drawHandCardFallback(inner, card, alpha);

    // Chrome the scan cannot carry, because it is about this game rather than
    // this card: what the engine will not let you do with it right now, and
    // which side of a payment this card is on.
    const tag = payment
      ? subject
        ? { text: "paying for", ground: accent.heroRed.hex }
        : spent
          ? { text: "spent", ground: surface.ink.hex }
          : null
      : (() => {
          const reason = this.#marks?.unplayable.get(card.instanceId);
          return reason ? { text: shortReason(reason), ground: surface.ink.hex } : null;
        })();
    if (tag && slot.width >= 70) {
      // Inside the card during payment: the payment bar sits directly above the
      // hand, and a tag hung over the top edge disappears behind it.
      this.add
        .text(slot.x + slot.width - 3, payment ? slot.y + 4 : slot.y - 9, caseOf(typeRole.label, tag.text), textStyle(typeRole.label, surface.paper.hex))
        .setOrigin(1, 0)
        .setLetterSpacing(typeRole.label.letterSpacing)
        .setPadding(4, 2, 4, 2)
        .setBackgroundColor(cssOf(tag.ground));
    }
    if (spent) {
      // A spent card is on its way to the discard pile. Enough of a wash to
      // read as "gone", not so much that the hand looks broken.
      const wash = this.add.graphics();
      wash.fillStyle(surface.ink.hex, 0.3).fillRect(slot.x + 3, slot.y + 3, slot.width - 6, slot.height - 6);
    }

    this.#makeTapTarget(slot, card.instanceId, () => this.#tapHandCard(card.instanceId), (deltaX) => this.#scrollHandBy(-deltaX));
  }

  /**
   * The generated card face, for a card with no scan. Header strip of cost chip
   * plus name and type line, then the rules text, then the resource pips —
   * the Long Table canvas's layout, and the designed behaviour for a missing
   * scan rather than an error state.
   */
  #drawHandCardFallback(slot: Rect, card: HandCardView, alpha: number): void {
    const headerHeight = Math.min(30, Math.max(22, Math.round(slot.height * 0.2)));
    const header: Rect = { x: slot.x, y: slot.y, width: slot.width, height: headerHeight };
    let nameLeft = header.x + 4;
    if (card.cost !== null) {
      const chip: Rect = { x: header.x, y: header.y, width: 20, height: header.height };
      const chipG = this.add.graphics();
      chipG.fillStyle(signal.cost.hex, alpha).fillRect(chip.x, chip.y, chip.width, chip.height);
      this.add
        .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(card.cost), textStyle(typeRole.statSmall, surface.paper.hex, alpha))
        .setOrigin(0.5);
      nameLeft = chip.x + chip.width + 4;
    }
    this.add
      .text(nameLeft, header.y + 1, card.name, textStyle(typeRole.rowTitle, surface.ink.hex, alpha))
      .setWordWrapWidth(header.x + header.width - nameLeft)
      .setMaxLines(1);
    label(this, nameLeft, header.y + 15, card.typeLine, typeRole.label, surface.ink.hex, ink.label * alpha);
    const headerRule = this.add.graphics();
    headerRule.fillStyle(surface.ink.hex, alpha).fillRect(header.x, header.y + header.height, header.width, 2);

    const pipRow = card.resourceIcons.length > 0 ? 16 : 0;
    const textTop = header.y + header.height + 5;
    this.add
      .text(slot.x + 2, textTop, card.rulesText, textStyle(typeRole.body, surface.ink.hex, ink.secondary * alpha))
      .setWordWrapWidth(slot.width - 4)
      .setMaxLines(Math.max(1, Math.floor((slot.y + slot.height - pipRow - 4 - textTop) / 15)));

    // One colour for every resource, with the type carried by a glyph rather
    // than a hue: the palette has one "resource" signal, and an indicator must
    // never rely on colour alone (PLAN.md Phase 4, accessibility).
    card.resourceIcons.forEach((icon, iconIndex) => {
      const box: Rect = { x: slot.x + 3 + iconIndex * 15, y: slot.y + slot.height - 15, width: 12, height: 12 };
      if (box.x + box.width > slot.x + slot.width - 2) return;
      const pip = this.add.graphics();
      pip.fillStyle(signal.cost.hex, alpha).fillRect(box.x, box.y, box.width, box.height);
      this.add
        .text(box.x + box.width / 2, box.y + box.height / 2, RESOURCE_GLYPH[icon], textStyle(typeRole.label, surface.paper.hex, alpha))
        .setOrigin(0.5);
    });
  }

  /**
   * The action bar, parked at the thumb.
   *
   * Phone stacks it the way the design canvas does — a 44px abilities row over
   * a 52px commit row — because five controls side by side at 375px are five
   * controls nobody can hit. Wider layouts keep them on one line with End turn
   * at the right.
   */
  #drawActionBar(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

    const marks = this.#marks;
    const basics: readonly BasicAction[] = ["attack", "thwart", "recover", "changeForm"];
    const stacked = rect.height >= hit.target + hit.primary;
    const labels: Record<BasicAction, string> = {
      attack: "Attack",
      thwart: "Thwart",
      recover: "Recover",
      // "Flip to alter-ego" does not fit a quarter of a phone; the short form
      // still says which way the flip goes.
      changeForm: stacked ? (model.myForm === "hero" ? "To A-E" : "To hero") : model.myForm === "hero" ? "Flip to alter-ego" : "Flip to hero",
      endTurn: "End turn",
    };

    const endTurnWidth = stacked ? rect.width - 20 : Math.min(180, rect.width * 0.28);
    const basicsWidth = stacked ? rect.width - 20 : rect.width - endTurnWidth - 30;
    const cellWidth = (basicsWidth - (basics.length - 1) * 6) / basics.length;

    basics.forEach((action, index) => {
      const button = marks?.basics.find((basic) => basic.action === action);
      const targeting = this.#selection.kind === "targeting" && basicKindOf(this.#selection.action) === action;
      const cell: Rect = { x: rect.x + 10 + index * (cellWidth + 6), y: rect.y + 4, width: cellWidth, height: hit.target - 8 };
      this.#focusRects.set(focusKey({ kind: "basic", action }), cell);
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: labels[action],
          type: typeRole.label,
          rect: cell,
          enabled: button?.enabled ?? false,
          selected: targeting,
          ...(button?.reason ? { reason: button.reason } : {}),
          onClick: () => this.#chooseBasic(action),
        }),
      );
    });

    // The one red fill in the bar: the forward action of the table.
    const endTurn = marks?.basics.find((basic) => basic.action === "endTurn");
    const endTurnRect: Rect = stacked
      ? { x: rect.x + 10, y: rect.y + hit.target, width: endTurnWidth, height: hit.primary - 6 }
      : { x: rect.x + rect.width - endTurnWidth - 10, y: rect.y + 4, width: endTurnWidth, height: hit.primary - 10 };
    this.#focusRects.set(focusKey({ kind: "basic", action: "endTurn" }), endTurnRect);
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "End turn",
        type: typeRole.barTitle,
        rect: endTurnRect,
        enabled: endTurn?.enabled ?? false,
        ...(endTurn?.reason ? { reason: endTurn.reason } : {}),
        onClick: () => void this.#dispatchExample("endTurn"),
      }),
    );

    // The advisory line: a prompt while targeting, otherwise the engine's last
    // rejection. Caution yellow, never red — red is the action, not the alarm.
    const message =
      this.#selection.kind === "targeting"
        ? this.#selection.prompt
        : this.#selection.kind === "paying"
          ? "" // The payment bar above the hand is already saying it.
          : (appSession().store.state.error ?? "");
    if (message && !stacked) {
      this.add
        .text(rect.x + 10, rect.y + rect.height - 14, message, textStyle(typeRole.body, signal.caution.hex))
        .setOrigin(0, 0.5)
        .setMaxLines(1);
    }
  }

  /** Pulsing rings on the valid targets while a target is being chosen. */
  #drawTargetRings(): void {
    if (this.#selection.kind !== "targeting") return;
    const reduced = appSession().settings.reducedMotion;
    for (const target of this.#selection.action.targets) {
      const rect = this.#hitRects.get(target);
      if (!rect) continue;
      const ring = new McSelectionRing(this);
      ring.show(rect, "pulse", reduced);
      this.#rings.push(ring);
    }
  }

  /**
   * "Out of scope" opacity while a decision is open (dim, don't hide). During
   * targeting that means "not a legal target"; during payment it means "not
   * something you can spend" — a resource ability in play is, and the villain
   * is not.
   */
  #dimAlpha(id: InstanceId): number {
    return this.#targetState(id) === "unavailable" ? ink.illegal : 1;
  }

  #targetState(id: InstanceId): "rest" | "selected" | "unavailable" {
    if (this.#selection.kind === "targeting") {
      return this.#selection.action.targets.includes(id) ? "selected" : "unavailable";
    }
    if (this.#selection.kind === "paying") {
      const sources = this.#selection.payment.query.sources;
      if (this.#selection.payment.picked.some((optionId) => sources.find((s) => s.optionId === optionId)?.instanceId === id)) {
        return "selected";
      }
      return sources.some((source) => source.instanceId === id) ? "rest" : "unavailable";
    }
    return "rest";
  }

  /**
   * A tap acts; a press-and-hold or a right-click inspects.
   *
   * The table's primary gesture has to stay "tap the thing you mean", so
   * Inspect takes the second gesture rather than a chrome button per card. The
   * hold threshold is `INSPECT_HOLD_MS`: long enough that a decisive tap never
   * opens a sheet, short enough to feel deliberate.
   *
   * `onDrag`, when given, turns a horizontal drag starting on this card into a
   * scroll instead of a tap — the tabbed hand's cards are the only tap targets
   * that ever sit inside a scrollable row (`#drawHand`), so every other caller
   * simply never passes it and this is a no-op there.
   */
  #makeTapTarget(rect: Rect, id: InstanceId, fallback?: () => void, onDrag?: (deltaX: number) => void): void {
    this.#focusRects.set(focusKey({ kind: "card", instanceId: id }), rect);
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    let held: Phaser.Time.TimerEvent | null = null;
    let inspected = false;
    let dragging = false;
    let downX = 0;
    const cancelHold = (): void => {
      held?.remove();
      held = null;
    };

    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      inspected = false;
      dragging = false;
      downX = pointer.x;
      if (pointer.rightButtonDown()) {
        inspected = true;
        this.#inspect(id);
        return;
      }
      held = this.time.delayedCall(INSPECT_HOLD_MS, () => {
        inspected = true;
        this.#inspect(id);
      });
    });
    if (onDrag) {
      zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.isDown || inspected) return;
        if (!dragging && Math.abs(pointer.x - downX) < DRAG_THRESHOLD_PX) return;
        // Once a gesture reads as a drag it stays one for its whole length —
        // a hold that was about to fire would otherwise still open Inspect
        // out from under a scroll the player is mid-way through.
        dragging = true;
        cancelHold();
        onDrag(pointer.x - pointer.prevPosition.x);
      });
    }
    zone.on("pointerout", cancelHold);
    zone.on("pointerup", () => {
      cancelHold();
      // A hold or a drag already did something; the release must not also act on it.
      if (inspected || dragging) return;
      if (this.#selection.kind === "paying") {
        this.#spendByInstance(id);
        return;
      }
      if (this.#selection.kind === "targeting") {
        void this.#commitTarget(id);
        return;
      }
      fallback?.();
    });
  }

  /** Opens the Inspect overlay over the board, stepping through the hand when it came from there. */
  #inspect(id: InstanceId): void {
    const siblings = this.#model?.hand.map((card) => card.instanceId) ?? [];
    this.scene.launch(SCENES.inspect, {
      instanceId: id,
      ...(siblings.includes(id) ? { siblings } : {}),
    });
  }

  /**
   * Enters target-select mode, or dispatches immediately when the action needs
   * no target. The engine decided both: `targets` came from `legalActions`.
   */
  #chooseBasic(action: BasicAction): void {
    const entry = this.#legalFor(action);
    if (!entry) return;
    if (entry.targets.length === 0) {
      void this.#dispatch(entry.example);
      return;
    }
    if (entry.targets.length === 1) {
      // One legal target is not a decision; aim and go.
      void this.#dispatch(entry.example);
      return;
    }
    this.#selection = { kind: "targeting", action: entry, prompt: `Choose a target to ${action}` };
    this.#draw();
  }

  async #commitTarget(id: InstanceId): Promise<void> {
    if (this.#selection.kind !== "targeting") return;
    const { action } = this.#selection;
    if (!action.targets.includes(id)) return;
    this.#selection = { kind: "idle" };
    // An aimed action that also costs something still owes the player the
    // payment decision; only a free one goes straight to the engine.
    if (action.needsPayment && this.#openPayment(action, id)) return;
    await this.#dispatch(retarget(action.example, id));
  }

  /**
   * Plays a hand card. A card that costs something opens the payment mode
   * rather than spending whatever the engine found first: what you spend is a
   * real decision, and the engine's `example` payment is only a proof that
   * *some* payment works.
   */
  /**
   * What tapping a hand card does.
   *
   * On a tall layout the hand is a row of thumbnails a centimetre wide — too
   * small to read, and far too small to commit a turn on. So a tap there opens
   * the card first and the sheet offers to play it, which is the second step
   * the phone needs and the desktop does not: at desk widths the card is
   * already legible, and a hold still opens the sheet.
   */
  #tapHandCard(instanceId: InstanceId): void {
    if (this.#layout?.tabbed && this.#selection.kind === "idle") {
      this.#inspect(instanceId);
      return;
    }
    void this.#playCard(instanceId);
  }

  async #playCard(instanceId: InstanceId): Promise<void> {
    const entry = this.#marks?.playable.has(instanceId)
      ? this.#legalEntries().find((candidate) => candidate.action.kind === "playCard" && candidate.action.instanceId === instanceId)
      : undefined;
    if (!entry) return;
    if (entry.needsPayment && this.#openPayment(entry, null)) return;
    await this.#dispatch(entry.example);
  }

  /** Every `useAbility` entry `legalActions` currently lists for one card, in order. */
  #usableAbilitiesFor(instanceId: InstanceId): readonly UsableAbilityAction[] {
    const actions = appSession().store.state.legal?.actions;
    return actions ? abilityActionsFor(actions, instanceId) : [];
  }

  /**
   * A tap on a card in play, while idle: nothing when it has no usable
   * ability (the common case, for most cards, most of the time); the ability
   * itself when it has exactly one, the same "a decisive gesture just acts"
   * rule the hand already follows for playing a card; the Inspect sheet when
   * it has more than one, because a real choice between two abilities needs
   * a real picker — Inspect already shows the card's full rules text, so the
   * player can read what each one does before committing to one
   * (`inspectModel.abilities`, `scenes/inspect.ts`). No Core card reaches the
   * second case today (checked by replaying three full games through
   * `legalActions`), but the ability DSL doesn't rule it out.
   */
  #onCharacterTap(instanceId: InstanceId): void {
    const abilities = this.#usableAbilitiesFor(instanceId);
    if (abilities.length === 0) return;
    if (abilities.length === 1) {
      this.#useAbility(abilities[0]!);
      return;
    }
    this.#inspect(instanceId);
  }

  /** The Inspect sheet's ability picker reports its pick here; it never dispatches itself. */
  #onInspectUseAbility(instanceId: InstanceId, abilityId: AbilityId): void {
    const entry = this.#usableAbilitiesFor(instanceId).find((candidate) => candidate.action.abilityId === abilityId);
    if (entry) this.#useAbility(entry);
  }

  /**
   * Triggers one action ability, the same three-step machinery `#chooseBasic`
   * / `#commitTarget` already use for basic actions: enter target-select mode
   * when the engine lists more than one legal target, open payment when the
   * engine says it costs something, otherwise dispatch its `example` command
   * straight away. Nothing here decides a target, a price, or legality —
   * `legalActions` and `paymentFor` already did.
   */
  #useAbility(entry: UsableAbilityAction): void {
    if (entry.targets.length > 1) {
      const { game } = appSession().store.state;
      const name = game ? abilityLabelOf(game, entry.action.instanceId, entry.action.abilityId, CORE_DEPS) : "this ability";
      this.#selection = { kind: "targeting", action: entry, prompt: `Choose a target for ${name}` };
      this.#draw();
      return;
    }
    const target = entry.targets[0] ?? null;
    if (entry.needsPayment && this.#openPayment(entry, target)) return;
    void this.#dispatch(entry.example);
  }

  /**
   * The small "you can do something here" line on a card in play — the one
   * control PLAN.md's Phase 4 open item said the board was missing entirely.
   * Reuses `signal.heal`, the token the palette already spends on "this is a
   * good, legal state" (recover, HP gain, deck-legal), rather than inventing
   * a new one; the leading glyph keeps the affordance readable without color
   * (PLAN.md Phase 4 accessibility, "never color alone"). Hidden mid-decision
   * — while targeting or paying for a *different* action, tapping this card
   * would be intercepted for that instead, and a line promising otherwise
   * would be wrong.
   */
  #abilityLine(instanceId: InstanceId): string | null {
    if (this.#selection.kind !== "idle" || !this.#marks?.usableAbilities.has(instanceId)) return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    const abilities = this.#usableAbilitiesFor(instanceId);
    if (abilities.length === 0) return null;
    // The card's own name is already on the card, so the line carries the cost —
    // see `abilityShortLabelOf`. "Use" is the fallback for an ability the engine
    // prices at nothing, which is still worth a tap target.
    const text =
      abilities.length === 1
        ? (abilityShortLabelOf(game, instanceId, abilities[0]!.action.abilityId, CORE_DEPS) ?? "use")
        : `${abilities.length} abilities — tap to choose`;
    return `▶ ${text}`;
  }

  /**
   * Enters payment mode for an action. Returns false when the engine says the
   * action needs no payment after all, so the caller can just dispatch it.
   */
  #openPayment(entry: LegalAction, target: InstanceId | null): boolean {
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return false;
    const payment = beginPayment(game, perspectiveId, entry.action, target, CORE_DEPS);
    if (!payment) return false;
    this.#selection = { kind: "paying", payment };
    this.#draw();
    return true;
  }

  /** Tapping a card during payment spends it, if the engine listed it as spendable. */
  #spendByInstance(id: InstanceId): void {
    if (this.#selection.kind !== "paying") return;
    const source = this.#selection.payment.query.sources.find((candidate) => candidate.instanceId === id);
    if (source) this.#togglePayment(source.optionId);
  }

  /** Spends or un-spends one source. The engine re-judges the whole selection. */
  #togglePayment(optionId: string): void {
    if (this.#selection.kind !== "paying") return;
    this.#selection = { kind: "paying", payment: togglePayment(this.#selection.payment, optionId) };
    this.#draw();
  }

  /** The payment as the engine currently sees it, or null outside payment mode. */
  #paymentView(): PaymentView | null {
    if (this.#selection.kind !== "paying") return null;
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return null;
    const { payment } = this.#selection;
    const subject = payment.action.kind === "playCard" || payment.action.kind === "useAbility" ? payment.action.instanceId : null;
    const headline = [
      subject ? cardName(game, subject) : "This action",
      payment.target ? `→ ${cardName(game, payment.target)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return paymentView(game, perspectiveId, payment, headline, CORE_DEPS);
  }

  #onInspectPlay(instanceId: InstanceId): void {
    void this.#playCard(instanceId);
  }

  async #dispatchExample(kind: BasicAction): Promise<void> {
    const entry = this.#legalFor(kind);
    if (entry) await this.#dispatch(entry.example);
  }

  async #dispatch(command: Command): Promise<void> {
    const { store } = appSession();
    const before = store.state.version;
    await store.dispatch(command);
    // A rejection doesn't change the version, so redraw to show the message.
    if (store.state.version === before) this.#draw();
  }

  #legalEntries(): readonly LegalAction[] {
    const { store } = appSession();
    const actions = store.state.legal?.actions;
    return actions?.kind === "turn" ? actions.legal : [];
  }

  #legalFor(action: BasicAction): LegalAction | undefined {
    const kind = BASIC_TO_KIND[action];
    return this.#legalEntries().find((entry) => entry.action.kind === kind);
  }
}

/**
 * The type of a resource, as a glyph. Colour says "resource"; the glyph says
 * which one, so the distinction survives colourblindness and a 12px pip.
 */
const RESOURCE_GLYPH: Readonly<Record<ResourceIconType, string>> = {
  physical: "P",
  mental: "M",
  energy: "E",
  wild: "*",
};

/**
 * The engine's reason as a tag that fits on a card corner. The full sentence
 * stays available — this only picks the short form of a code the engine gave.
 */
function shortReason(reason: IllegalReason): string {
  switch (reason.code) {
    case "wrong_form":
      return "wrong form";
    case "insufficient_resources":
      return "can't afford";
    case "already_exhausted":
      return "exhausted";
    case "limit_reached":
      return "limit";
    case "no_valid_target":
      return "no target";
    case "card_type_not_playable":
      return "not an action";
    case "already_changed_form":
      return "already flipped";
    default:
      return "illegal";
  }
}

/**
 * How long a press has to last before it inspects instead of acting. Below
 * this, a tap is a tap; above it, the player clearly meant to look.
 */
const INSPECT_HOLD_MS = 420;

/**
 * How far a pointer has to move, in pixels, before a press on a card in a
 * scrollable row (the tabbed hand) reads as a drag rather than the start of a
 * tap or a hold. Below this, a slightly unsteady tap still taps.
 */
const DRAG_THRESHOLD_PX = 8;

/**
 * The narrowest a panel's text column may get before the panel stops being
 * "card plus numbers" and becomes the card itself. Below this the name wraps to
 * one word a line and the stat tiles have nowhere to sit.
 */
const MIN_PANEL_TEXT_WIDTH = 104;

/** Which starburst each stat tile draws as. */
const BADGE_STAT: Record<Exclude<StatTile["label"], "HP">, StatKey> = {
  THW: "thw",
  ATK: "atk",
  DEF: "def",
  SCH: "sch",
  REC: "rec",
};

/** One string per focusable thing, so a rect can be looked up by what it is. */
const focusKey = (target: FocusTarget): string =>
  target.kind === "card" ? `card:${target.instanceId}` : `basic:${target.action}`;

/** Each beat speaks in the signal that already means that thing everywhere else. */
const BEAT_COLORS: Record<Beat["tone"], number> = {
  damage: accent.heroRed.hex,
  heal: signal.heal.hex,
  threat: accent.heroRed.hex,
  status: signal.caution.hex,
  defeat: surface.paper.hex,
};

/** Linear interpolation, for a travel ghost recreated partway through its flight. */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const BASIC_TO_KIND: Record<BasicAction, string> = {
  attack: "basicAttack",
  thwart: "basicThwart",
  recover: "basicRecover",
  changeForm: "changeForm",
  endTurn: "endTurn",
};

const basicKindOf = (entry: LegalAction): BasicAction | null => {
  for (const [action, kind] of Object.entries(BASIC_TO_KIND)) {
    if (entry.action.kind === kind) return action as BasicAction;
  }
  return null;
};

/**
 * Re-aims the engine's example command at the target the player picked. Only
 * the target field changes: the payment and cost picks the engine found stay
 * exactly as it produced them.
 */
function retarget(command: Command, target: InstanceId): Command {
  switch (command.type) {
    case "basicAttack":
      return { ...command, targetInstanceId: target };
    case "basicThwart":
      return { ...command, schemeInstanceId: target };
    case "playCard":
      return { ...command, attachToInstanceId: target };
    case "useAbility": {
      // A `useAbility` command carries no target field of its own — every
      // target `legalActions` lists for one is a cost-choice pick (RRG "pay
      // the printed cost of a card in a discard pile", `AbilityCost.payPrintedCostOf`),
      // named by the slot the ability's own cost declares. No Core ability
      // reaches this today (`legal.targets` is always empty for the three
      // Core action abilities that exist), so this reads the registry rather
      // than guessing a shape for content that doesn't exist yet.
      const slot = CORE_DEPS.abilities[command.abilityId]?.cost?.payPrintedCostOf?.slot;
      return slot ? { ...command, costChoices: { ...command.costChoices, [slot]: [target] } } : command;
    }
    default:
      return command;
  }
}
