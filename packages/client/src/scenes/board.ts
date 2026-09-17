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
 *
 * This file is the scene's lifecycle, its overlays and the order of a draw.
 * The pieces live in `scenes/board/`:
 *  - `controller.ts` — target-select and payment modes, and every dispatch;
 *  - `selection.ts` — the selection type and the plain rules for reading it;
 *  - `context.ts` — what each draw hands the zone modules;
 *  - `chrome.ts`, `schemes.ts`, `zones.ts`, `character-panel.ts`, `hand.ts`,
 *    `payment-bar.ts`, `action-bar.ts` — one zone each;
 *  - `motion.ts` — beats and travelling cards;
 *  - `input.ts`, `tap-target.ts` — keyboard, gamepad and the card gesture.
 */

import Phaser from "phaser";
import { POOL_DEPS } from "../content/pool.js";
import type { AbilityId } from "@mc/content";
import type { GameEvent, InstanceId } from "@mc/engine";
import { cardArt, type CardArt } from "../art/card-art.js";
import { appSession } from "../session.js";
import { dotGrid, surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { McSelectionRing, McTabs, paintDotGrid } from "../ui/widgets.js";
import { boardModel, type BoardModel } from "../view/board-model.js";
import { highlights, type Highlights } from "../view/highlights.js";
import { appendEvents, emptyLog, type LogState } from "../view/log-lines.js";
import { tabsTouchedBy } from "../view/tab-badges.js";
import { playerName } from "../view/names.js";
import type { GamepadIntent } from "../view/gamepad.js";
import { sameTarget, stepFocus, type FocusTarget } from "../view/focus.js";
import { boardLayout, type BoardLayout, type PhoneTab, type Rect } from "../view/layout.js";
import type { SessionState } from "../store/session-store.js";
import { SCENES } from "./keys.js";
import { drawActionBar } from "./board/action-bar.js";
import { drawCharacter } from "./board/character-panel.js";
import { drawChrome, drawPhoneTabs } from "./board/chrome.js";
import { emptyFrame, type BoardDrawContext, type BoardFrame } from "./board/context.js";
import { BoardController } from "./board/controller.js";
import { drawHand, HandScroll } from "./board/hand.js";
import { bindGamepad, bindKeyboard, type IntentBinding } from "./board/input.js";
import { BoardMotion } from "./board/motion.js";
import { drawSchemes } from "./board/schemes.js";
import { focusKey } from "./board/selection.js";
import { addTapTarget } from "./board/tap-target.js";
import { LogPanel } from "./board/log.js";
import { drawEncounter, drawEnemies, drawPlayArea, drawTeam } from "./board/zones.js";

export class BoardScene extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #model: BoardModel | null = null;
  #marks: Highlights | null = null;
  #layout: BoardLayout | null = null;
  #log: LogState = emptyLog();
  /** What the last draw left behind: hit rects, focus rects, and the widgets to destroy before the next one. */
  #frame: BoardFrame = emptyFrame();
  #version = -1;
  #choiceOpen = false;
  #saveFailureAnnounced = false;
  /** Which zone the phone board is showing. Ignored on wider layouts. */
  #activeTab: PhoneTab = "me";
  /** Changes that landed on a tab the player isn't looking at, per tab. */
  #tabBadges = new Map<PhoneTab, number>();
  #tabs: McTabs | null = null;
  /** Keyboard focus: what is focused, not where — the "where" is re-derived each draw. */
  #focus: FocusTarget | null = null;
  #focusRing: McSelectionRing | null = null;
  /** Card scans, shared with every overlay above this scene. */
  #artCache: CardArt | null = null;
  #artUnsubscribe: (() => void) | null = null;

  readonly #controller = new BoardController({
    model: () => this.#model,
    marks: () => this.#marks,
    tabbed: () => this.#layout?.tabbed ?? false,
    redraw: () => this.#draw(),
    inspect: (id) => this.#inspect(id),
  });
  readonly #hand = new HandScroll(() => this.#draw());
  readonly #logPanel = new LogPanel(() => this.#draw());
  readonly #motion = new BoardMotion(this);

  get #art(): CardArt {
    this.#artCache ??= cardArt(this);
    return this.#artCache;
  }

  constructor() {
    super(SCENES.board);
  }

  create(): void {
    // Phaser reuses this one instance for every game — "Run it back" and
    // "Continue" start this same scene again — so everything about *a game*
    // starts over here. The log didn't, and a rematch was dealt under the
    // previous game's "The villain is defeated. You win."
    this.#log = emptyLog();
    this.#logPanel.reset();
    this.#version = -1;
    this.#tabBadges.clear();
    this.#focus = null;
    this.#saveFailureAnnounced = false;
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
    const binding: IntentBinding = {
      // A decision overlay or the villain-phase walkthrough owns the keyboard
      // and the pad while it is up — the walkthrough used to leave arrows
      // walking the board unseen underneath it.
      blocked: () => this.#choiceOpen || this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.villainPhase),
      onIntent: (intent) => this.#actOnIntent(intent),
    };
    bindKeyboard(this, binding);
    bindGamepad(this, binding);
    // A wheel/trackpad gesture over the hand scrolls it, on any layout that
    // needs scrolling at all — the tabbed board is the only one that ever
    // does (`drawHand`), so this is a no-op everywhere else.
    this.input.on("wheel", this.#hand.onWheel, this.#hand);
    // The same for the game log, which checks the pointer is over it.
    this.input.on("wheel", this.#logPanel.onWheel, this.#logPanel);
    // The Inspect overlay's "Play it" comes back here, because playing a card
    // is the board's job: the overlay only ever reports what the engine said.
    this.game.events.on("mc-play-card", this.#onInspectPlay, this);
    // Same pattern for the ability picker Inspect opens when a card offers
    // more than one usable ability (see `BoardController.onCharacterTap`): the
    // sheet reports which one was picked, and only the board ever dispatches.
    this.game.events.on("mc-use-ability", this.#onInspectUseAbility, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#artUnsubscribe?.();
      this.#artUnsubscribe = null;
      this.game.events.off("mc-play-card", this.#onInspectPlay, this);
      this.game.events.off("mc-use-ability", this.#onInspectUseAbility, this);
      this.input.off("wheel", this.#hand.onWheel, this.#hand);
      this.input.off("wheel", this.#logPanel.onWheel, this.#logPanel);
      /**
       * The overlays this scene launches run in parallel over it, so stopping
       * the Board doesn't stop them. When the game ends `#onState` hands off to
       * Game Over before `#syncChoiceOverlay` gets its turn, which left the
       * choice sheet running — invisibly, holding its store subscription —
       * behind the game-over screen. The Board owns them, so it closes them.
       * `#choiceOpen` resets too, or the next Board would think the sheet was
       * already up and never relaunch it.
       */
      for (const overlay of [SCENES.choice, SCENES.inspect, SCENES.villainPhase]) {
        if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
      }
      this.#choiceOpen = false;
    });
  }

  #onState(state: SessionState): void {
    if (!state.game || state.perspectiveId === null) return;

    // Fold this command's events onto the log before the state replaces it.
    const fresh = state.version !== this.#version;
    if (fresh) {
      // A resumed game arrives mid-round with no events saying which round, so
      // an empty log starts counting from the state's round rather than "R0".
      if (this.#log.round === 0) this.#log = { ...this.#log, round: state.game.round };
      this.#log = appendEvents(this.#log, state.lastEvents, state.game, state.perspectiveId, POOL_DEPS);
      this.#noteTabChanges(state);
      this.#motion.land(state.lastEvents);
      // A hero going down is the one change nobody may miss. The last one
      // standing falling is the game ending instead, and Game Over says that.
      if (!state.game.outcome) {
        for (const event of state.lastEvents) {
          if (event.type !== "playerEliminated") continue;
          this.#motion.announce(`${playerName(state.game, event.playerId)} is down`, "Defeated — out of the game. The rest of the team fights on");
        }
      }
      // Saving failing is silent otherwise — the game plays on — and a refresh
      // would then lose it. Said once, loudly; the chrome chip keeps saying it.
      if (state.saveError !== null && !this.#saveFailureAnnounced) {
        this.#saveFailureAnnounced = true;
        this.#motion.announce("Game not saving", "It may not survive a refresh");
      }
      this.#version = state.version;
      // A new state invalidates any half-made selection: the engine may have
      // changed what is legal, and a stale target would just be rejected.
      this.#controller.reset();
    }

    this.#model = boardModel(state.game, state.perspectiveId, POOL_DEPS);
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
    // "where a card came from" can still be read once this redraw rebuilds
    // the hit rects for where cards are now (`view/travel.ts`).
    const previous = this.#frame;
    for (const button of previous.buttons) button.destroy();
    for (const ring of previous.rings) ring.destroy();
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#frame = emptyFrame();
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const layout = boardLayout({ x: 0, y: 0, width, height }, {
      playerCount: model.team.length + 1,
      activeTab: this.#activeTab,
    });
    this.#layout = layout;

    const ctx: BoardDrawContext = {
      scene: this,
      art: this.#art,
      marks: this.#marks,
      tabbed: layout.tabbed,
      controller: this.#controller,
      hand: this.#hand,
      frame: this.#frame,
      makeTapTarget: (rect, id, onTap, onDrag) => this.#makeTapTarget(rect, id, onTap, onDrag),
      inspect: (id, siblings) => this.#inspect(id, siblings),
    };

    // The table felt, and nothing else.
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    const { zones } = layout;
    drawChrome(this, zones.chrome!, model, appSession().store.state.saveError !== null);
    if (zones.tabs) this.#drawTabs(zones.tabs, model);
    if (zones.threat) drawSchemes(ctx, zones.threat, model);
    if (zones.enemies) drawEnemies(ctx, zones.enemies, model);
    if (zones.encounter) drawEncounter(ctx, zones.encounter, model);
    if (zones.log) this.#logPanel.draw(this, zones.log, this.#log);
    else this.#logPanel.hide();
    if (zones.me) drawCharacter(ctx, zones.me, model.me);
    if (zones.playArea) drawPlayArea(ctx, zones.playArea, model);
    if (zones.team) drawTeam(ctx, zones.team, model);
    drawHand(ctx, zones.hand!, model);
    drawActionBar(ctx, zones.actionBar!, model);
    this.#drawTargetRings();
    this.#drawFocusRing();
    // Turns the moves of a fresh state (if any landed) into travels, now that
    // this frame holds where every card ended up. A no-op on every other redraw.
    this.#motion.startTravels(previous, this.#frame, layout);
    // Last, so beats and travelling ghosts float above the table rather than
    // under a later panel.
    this.#motion.drawBeats(this.#frame.hitRects);
    this.#motion.renderTravels();
    // Held back while an overlay covers the table, so it isn't spent unseen.
    this.#motion.drawBanners(
      { x: 0, y: 0, width, height },
      !this.#choiceOpen && !this.scene.isActive(SCENES.villainPhase),
      () => this.#draw(),
    );
  }

  #drawTabs(rect: Rect, model: BoardModel): void {
    this.#tabs = drawPhoneTabs(this, rect, model, {
      activeTab: this.#activeTab,
      badges: this.#tabBadges,
      onSelect: (tab) => {
        this.#activeTab = tab;
        // Looking at a tab is what clears its badge.
        this.#tabBadges.delete(tab);
        this.#draw();
      },
    });
  }

  /** Pulsing rings on the valid targets while a target is being chosen. */
  #drawTargetRings(): void {
    const selection = this.#controller.selection;
    if (selection.kind !== "targeting") return;
    const reduced = appSession().settings.reducedMotion;
    for (const target of selection.action.targets) {
      const rect = this.#frame.hitRects.get(target);
      if (!rect) continue;
      const ring = new McSelectionRing(this);
      ring.show(rect, "pulse", reduced);
      this.#frame.rings.push(ring);
    }
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
        if (this.#focus) this.#controller.activate(this.#focus);
        break;
      case "inspect":
        if (this.#focus?.kind === "card") this.#inspect(this.#focus.instanceId);
        break;
      case "cancel":
        if (this.#controller.selection.kind !== "idle") this.#controller.cancel();
        break;
    }
  }

  #moveFocus(delta: number): void {
    const order = this.#controller.focusOrder();
    const at = order.findIndex((target) => sameTarget(target, this.#focus));
    const next = stepFocus(order, at, delta);
    this.#focus = next >= 0 ? (order[next] ?? null) : null;
    this.#draw();
  }

  #drawFocusRing(): void {
    this.#focusRing?.destroy();
    this.#focusRing = null;
    const focus = this.#focus;
    if (!focus) return;
    // Focus that has fallen off the route (the card was played) is dropped
    // rather than drawn somewhere stale.
    if (!this.#controller.focusOrder().some((target) => sameTarget(target, focus))) {
      this.#focus = null;
      return;
    }
    const rect = this.#frame.focusRects.get(focusKey(focus));
    if (!rect) return;
    this.#focusRing = new McSelectionRing(this);
    // Static, not pulsing: the ring says "here you are", not "act now".
    this.#focusRing.show(rect, "static", true);
  }

  /**
   * Registers a card as focusable and tappable. An open target or payment
   * prompt gets the tap first; otherwise it falls through to `onTap`.
   */
  #makeTapTarget(rect: Rect, id: InstanceId, onTap?: () => void, onDrag?: (deltaX: number) => void): void {
    this.#frame.focusRects.set(focusKey({ kind: "card", instanceId: id }), rect);
    addTapTarget(this, rect, {
      onTap: () => {
        if (!this.#controller.tapInMode(id)) onTap?.();
      },
      onInspect: () => this.#inspect(id),
      onDrag,
    });
  }

  /**
   * Opens the Inspect overlay over the board. ◂ ▸ step through `siblings` when
   * given (your discard pile), else through the hand when the card came from there.
   */
  #inspect(id: InstanceId, siblings?: readonly InstanceId[]): void {
    const list = siblings ?? this.#model?.hand.map((card) => card.instanceId) ?? [];
    this.scene.launch(SCENES.inspect, {
      instanceId: id,
      ...(list.includes(id) ? { siblings: list } : {}),
    });
  }

  #onInspectPlay(instanceId: InstanceId): void {
    void this.#controller.playCard(instanceId);
  }

  #onInspectUseAbility(instanceId: InstanceId, abilityId: AbilityId): void {
    this.#controller.useAbilityById(instanceId, abilityId);
  }
}
