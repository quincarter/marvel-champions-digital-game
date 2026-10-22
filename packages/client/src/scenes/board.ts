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
 *  - `motion.ts` — beats and traveling cards;
 *  - `input.ts`, `tap-target.ts` — keyboard, gamepad and the card gesture.
 */

import Phaser from "phaser";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_SCENARIOS } from "../content/pool.js";
import type { AbilityId } from "@mc/content";
import type { CardId } from "@mc/content";
import { cardOf, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import type { VillainPhaseLaunchData, VillainPhaseOverlay } from "./villain-phase.js";
import { cardArt, type CardArt } from "../art/card-art.js";
import { appSession } from "../session.js";
import { accent, dotGrid, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McSelectionRing, McTabs, fitText, paintDotGrid } from "../ui/widgets.js";
import { boardModel, type BoardModel } from "../view/board-model.js";
import { highlights, type Highlights } from "../view/highlights.js";
import { withAttackBarWording } from "../view/attack-bar.js";
import { withForcedActions } from "../view/forced-actions.js";
import { withDefenseLockout } from "../view/defense-lockout.js";
import { appendCardHistory, emptyCardHistoryLog, type CardHistoryLog } from "../view/card-history.js";
import { blindRevealOf, eventsForBlindLog } from "../view/civil-war-blind.js";
import { appendEvents, withSeedLine, emptyLog, type LogState } from "../view/log-lines.js";
import type { PaymentView } from "../view/payment-model.js";
import { tabKeysTouchedBy } from "../view/tab-badges.js";
import { playerName } from "../view/names.js";
import { linearIntent, type GamepadIntent } from "../view/gamepad.js";
import { spatialStep, type FocusDirection } from "../view/spatial-nav.js";
import { sameTarget, stepFocus, type FocusTarget } from "../view/focus.js";
import {
  PHONE_TABS,
  boardLayout,
  formFactorFor,
  scrollLayout,
  type BoardLayout,
  type PhoneTab,
  type Rect,
} from "../view/layout.js";
import { cardSizeFactor } from "../settings.js";
import { onTap, setTapOccluders } from "../ui/tap.js";
import { TableDrag, clampScroll, fullyInWindow, revealScroll, wheelPixels } from "../view/table-scroll.js";
import { choiceDock } from "../view/choice-dock.js";
import { choicePeeking } from "../view/choice-peek.js";
import { villainDockRects, type VillainDockRects, type VillainDockRequest } from "../view/villain-dock.js";
import { sameSeatNote, type VillainSeatNote } from "../view/villain-seat-note.js";
import { drawCompactIdentity } from "./board/compact-identity.js";
import { sameHandTags, type VillainHandTag } from "../view/villain-hand-tags.js";
import { REVIEW_HANDLE_WIDTH, reviewHandleRect, showReviewHandle } from "../view/villain-review.js";
import { sameFacedown, withFacedownHeld, type TableHold } from "../view/villain-replay.js";
import type { SessionState } from "../store/session-store.js";
import { CHROME_SCENES, SCENES } from "./keys.js";
import { tableSoundsOf, type CardSoundInfo } from "../view/sound-effects.js";
import { HoverPreview, isMousePointer } from "../ui/card-hover-preview.js";
import { hoverArea } from "../view/card-hover.js";
import { sheetIsCovered } from "../view/choice-sheet-sync.js";
import { syncSceneClock } from "../ui/scene-clock.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { askToEndTurn } from "./end-turn-confirm.js";
import { showHoldOn } from "./hold-on.js";
import { markAspectLessonDone, silenceWarning } from "../guide/guide-prefs.js";
import { guidePrefs, setGuidePrefs, setGuideRunLevelOverride } from "../guide/guide-store.js";
import { aspectGuideOf } from "../guide/aspects.js";
import { ASPECT_TRYIT_LESSONS } from "../guide/aspect-lessons.js";
import { MECHANIC_TRYIT_LESSONS } from "../guide/mechanic-lessons.js";
import { MECHANIC_TRYITS, mechanicLessonDoneKey } from "../guide/mechanic-tryits.js";
import { drawActionBar } from "./board/action-bar.js";
import { drawCharacter } from "./board/character-panel.js";
import { drawDealtPile } from "./board/dealt-pile.js";
import { dealtCaption, dealtReasonsOf } from "../view/dealt-pile.js";
import { drawChrome, drawPhoneTabs } from "./board/chrome.js";
import { BoardFirstPlayerToken } from "./board/first-player-token.js";
import { emptyFrame, type BoardDrawContext, type BoardFrame } from "./board/context.js";
import { BoardController, type SourceChoiceView } from "./board/controller.js";
import type { GuideGate } from "./board/guide-gate.js";
import { BoardGuideMount } from "./board/guide-mount.js";
import { BoardTipMount } from "./board/tip-mount.js";
import type { GuideStripContent } from "../ui/guide-strip.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import type { LessonObservation } from "../view/lesson-model.js";
import { drawHand, HandScroll } from "./board/hand.js";
import type { RowDrag } from "../view/hand-scroll.js";
import { PlayAreaScroll } from "../view/play-area-row.js";
import { bindGamepad, bindKeyboard, type IntentBinding } from "./board/input.js";
import { BoardMotion } from "./board/motion.js";
import { drawSchemes, SchemeScrollState } from "./board/schemes.js";
import { drawTargetingPanel, type TargetingHover } from "./board/targeting-panel.js";
import { drawSearchedPickSheet } from "./board/searched-pick-sheet.js";
import { focusKey } from "./board/selection.js";
import { addTapTarget } from "./board/tap-target.js";
import { LogPanel } from "./board/log.js";
import { setAsideFooterHeight, setAsideLines, splitSetAside } from "../view/encounter-pile-layout.js";
import { TEAM_UP_ART, teamUpArtFor } from "../art/team-up-art.js";
import { evidenceInputOf } from "../view/evidence-model.js";
import type { PileViewData } from "./pile-view.js";
import type { TeamUpSplashData } from "./team-up-splash.js";
import type { TeamUpInfoData } from "./team-up-info.js";
import type { TeamUpBadge, TeamUpRings } from "./board/team-up-badge.js";
import {
  presentTeamUps,
  teamUpWaitingSeats,
  observeTeamUps,
  resumedGame,
  teamUpDetail,
  teamUpProviders,
  teamUpRoleOf,
  poolTeamUpPairs,
  seatLabel,
  type TeamUpRole,
  teamUpPairsOf,
  type TeamUpPair,
  type TeamUpWatch,
} from "../view/team-up-model.js";
import { drawEncounter, drawEnemies, drawPlayArea, drawScenarioPlayAreas, drawTeam } from "./board/zones.js";
import { avatarSwapAnnouncements } from "../view/avatar-swap-banner.js";
import { levelUpCaptions } from "../view/level-up-banner.js";
import { splitMissionArea, splitNeutralTab } from "../view/mission-area-layout.js";
import { referenceCardViews, type ReferenceCardView } from "../view/reference-cards.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { campaignBeatFor } from "../view/campaign-beat-model.js";
import type { CampaignBeatData } from "./campaign/routes.js";

/** Every Team-Up pair the card pool names; built once, since the pool never changes under a running game. */
const TEAM_UP_PAIRS = teamUpPairsOf(POOL_CARDS);

/** The villain-phase review handle: over the table, under the round band (`motion.ts`, 1150). */
const HANDLE_DEPTH = 950;

/** Emitted on the Board's own `events` on every step of a dock resize (and when it snaps), with the current `VillainDockRects`. */
export const VILLAIN_DOCK_CHANGED = "villain-dock-changed";
const VILLAIN_DOCK_TWEEN_MS = 280;
/** The form cards' fan-out and fold beside the play area (issue #308). */
const FORM_FAN_TWEEN_MS = 280;

/** A card's name and traits, for its sound (`view/sound-effects.ts`). An identity's traits sit on its faces and never count. */
function soundInfoOfCard(cardId: CardId): CardSoundInfo | null {
  const card = CARDS_BY_ID.get(cardId as string) as
    | { readonly name: string; readonly traits?: readonly string[] }
    | undefined;
  return card ? { name: card.name, traits: card.traits ?? [] } : null;
}

export class BoardScene extends Phaser.Scene {
  /** Team-Ups present in the latest state (relevant to this game, both characters in play in any form). */
  #teamUps: readonly TeamUpPair[] = [];
  /** Keys of the present pairs the engine lets a player play cards for now (both showing the hero side). */
  #teamUpPlayable: ReadonlySet<string> = new Set();
  /** Seats showing an alter-ego that holds a present pair up (they carry the yellow blurb). */
  #teamUpWaiting: ReadonlySet<string> = new Set();
  /** Which Team-Up pairs have had their splash this game (`view/team-up-model.ts#observeTeamUps`). Null before the first state. */
  #teamUpWatch: TeamUpWatch | null = null;
  /** Splashes waiting for a clear moment: not over the villain-phase walkthrough or a campaign beat. */
  #pendingSplashes: TeamUpPair[] = [];
  /** The badge the mouse is over, whose short label is showing. */
  #teamUpHover: string | null = null;
  #unsubscribe: (() => void) | null = null;
  #model: BoardModel | null = null;
  #marks: Highlights | null = null;
  #layout: BoardLayout | null = null;
  #log: LogState = emptyLog();
  /**
   * "This card, this game" (Inspect, `view/card-history.ts`): a second, wider fold of the same event stream `#log`
   * folds, kept for as long as this scene is alive — the whole session, since overlays launch on top of Board
   * rather than replacing it. Deliberately not merged into `#log`: that log is the shared table log and drops the
   * bookkeeping (a card drawn, a card discarded to pay) a single card's own history wants back — see that
   * module's own header.
   */
  #cardHistory: CardHistoryLog = emptyCardHistoryLog();
  /** What the last draw left behind: hit rects, focus rects, and the widgets to destroy before the next one. */
  #frame: BoardFrame = emptyFrame();
  #version = -1;
  /** How much of the command trail the table's sounds have played; -1 until the first state, which is never played. */
  #soundTrail = -1;
  /** The game from the previous fresh state; handed to the villain phase scene as its recap's "before". */
  #previousGame: GameState | null = null;
  /**
   * The table log and card history as they stood at each command version, so a Back out (`SessionStore.rewindTo`)
   * restores them exactly instead of keeping lines for the play it undid.
   */
  #logAt = new Map<number, { readonly log: LogState; readonly cardHistory: CardHistoryLog }>();
  #choiceOpen = false;
  /** Set by `#openVillainWalkthrough`'s launch until the walkthrough is actually running (`#tableCoveredForBand`). */
  #walkthroughLaunching = false;
  #saveFailureAnnounced = false;
  /** Which zone the phone board is showing. Ignored on wider layouts. */
  #activeTab: PhoneTab = "me";
  /** Changes that landed on a tab the player isn't looking at, per tab. */
  #tabBadges = new Map<PhoneTab, number>();
  /** The distinct cards behind each badge (`view/tab-badges.ts`). */
  #tabChanged = new Map<PhoneTab, Set<string>>();
  #tabs: McTabs | null = null;
  /** Keyboard focus: what is focused, not where — the "where" is re-derived each draw. */
  #focus: FocusTarget | null = null;
  #focusRing: McSelectionRing | null = null;
  /**
   * Which surface keyboard/pad focus is currently in (§3.10, §7 accessibility fix — guided mode's rail/callout
   * and opportunistic tip toast were unreachable by keyboard/pad). "G"/the pad's X toggles between them
   * (`#actOnIntent`'s own `"toggleGuide"` case); the board's own focus ring (`#drawFocusRing`) only draws while
   * this is `"board"`, and `#syncGuideFocusRegion` self-heals it back to `"board"` the moment whichever guide
   * surface owned it stops having anything focusable (the tutorial stopped, a tip was dismissed, …).
   */
  #focusRegion: "board" | "guide" = "board";
  /** Which mount actually owns focus while `#focusRegion === "guide"` — `#guide` (the rail/callout) is preferred
   * over `#tip` (an opportunistic toast) when both happen to have something focusable, though in practice the two
   * are mutually exclusive on screen (`#tipBlocked()`). */
  #guideFocusOwner: "guide" | "tip" | null = null;
  /** Card scans, shared with every overlay above this scene. */
  #artCache: CardArt | null = null;
  #artUnsubscribe: (() => void) | null = null;
  /** The targeting panel's own hovered tile (docs/phase4-screen-gaps.md §3 "W5") — separate from `#focus`, since a mouse player hovers without ever taking keyboard focus. */
  #targetingHoverId: InstanceId | null = null;
  /**
   * A villain-stage flip the current command's events named, waiting for a clear moment to show (C04's own splash,
   * `scenes/campaign/beat.ts`) — never opened the instant it's detected, or it would land on top of the villain-
   * phase walkthrough that is narrating that very flip, or steal a pending choice's own overlay. Cleared the moment
   * it launches, so a later redraw of the same command never queues (and therefore never shows) it twice.
   */
  #pendingCampaignBeat: CampaignBeatData | null = null;
  /** The guide's board-side mount (guided mode G5c, `docs/guided-mode.md` §4) — only built for a guided run
   * (`appSession().guidedRun`), lazily on the first state that has a game, since `GuideController` needs an
   * initial `LessonObservation` to start from. Desktop/tablet-landscape only in this part; see
   * `scenes/board/guide-mount.ts`'s own header. */
  #guide: BoardGuideMount | null = null;
  /** The opportunistic-tip mount (guided mode G10e part 2, `docs/guided-mode.md` §4 G10e) — unlike `#guide`, built
   * for *every* game with a perspective player, not only a guided tutorial run: an opportunistic tip at the Full
   * guide level is "the main use" in an ordinary game (`scenes/board/tip-mount.ts`'s own header). */
  #tip: BoardTipMount | null = null;
  #hover: HoverPreview | null = null;

  readonly #controller = new BoardController({
    model: () => this.#model,
    marks: () => (this.#controller.readOnly ? null : this.#marks),
    tabbed: () => this.#layout?.tabbed ?? false,
    redraw: () => this.#draw(),
    inspect: (id) => this.#inspect(id),
    hasTile: (id) => this.#frame.focusRects.has(focusKey({ kind: "card", instanceId: id })),
    // A ring on the tab being shown is a stop at the end of the focus route; Enter opens its panel.
    teamUpKeys: () =>
      [...this.#frame.focusRects.keys()].filter((key) => key.startsWith("teamUp:")).map((key) => key.slice(7)),
    openTeamUp: (pairKey) => {
      const pair = this.#teamUps.find((candidate) => candidate.key === pairKey);
      if (pair) this.#openTeamUpInfo(pair);
    },
    confirmEndTurn: (sentence, onConfirm, title) => askToEndTurn(this, sentence, onConfirm, title),
    // A "Hold on!" warning never second-guesses an active guide step: while a lesson is telling the player what to
    // do (e.g. an aspect Try-it lesson's stacked payment), the guide's own instruction wins and the command goes out.
    holdOn: (hint, actions) =>
      this.#guide?.hasCurrentStep()
        ? actions.onAnyway()
        : showHoldOn(this, {
            hint,
            schemeRect: this.#mainSchemeRect(),
            schemeName: this.#mainSchemeName(),
            onSafe: actions.onSafe,
            onAnyway: actions.onAnyway,
            onSilence: () => setGuidePrefs(silenceWarning(guidePrefs(), hint.key)),
          }),
  });
  /** Dev/QA padding of the schemes column, minions, environments and play area (`__mcBoardDebug.setBoardPad`); null in every real game. */
  #debugPad: { sideSchemes?: number; minions?: number; environments?: number; playArea?: number } | null = null;
  /** The schemes column's scroll position, which has to survive the whole-board redraw that rebuilds its region. */
  readonly #schemeScroll = new SchemeScrollState();
  /** The pulsing rings on the valid targets: redrawn alone when the schemes column scrolls under them. */
  #targetRings: McSelectionRing[] = [];
  readonly #hand = new HandScroll(() => this.#draw());
  /** The play area row's scroll: a crowded row keeps its cards readable and scrolls sideways, on every layout. */
  readonly #playAreaScroll = new PlayAreaScroll(() => this.#draw());
  /** The form cards' fan beside the play area (issue #308): where it is going, and how far the animation has got. */
  #formFanOpen = false;
  #formFanT = 0;
  #formFanTween: Phaser.Tweens.Tween | null = null;
  readonly #logPanel = new LogPanel(() => this.#draw());
  readonly #motion = new BoardMotion(this);
  readonly #firstPlayerToken = new BoardFirstPlayerToken();
  /** Dev e2e hook only: who the token is drawn for in place of the game's first player, to see a pass without a round. */
  #debugFirstPlayer: PlayerId | null = null;
  /**
   * How far the table is scrolled at a Card size above Standard (`LayoutOptions.cardScale`): the offset the next draw lays
   * the table's zones out at. 0 at Standard, where nothing scrolls. Clamped to the layout's extent on every draw.
   */
  #tableScroll = 0;
  /** A scroll (wheel, drag, reveal) asked for a redraw: `update` does it once a frame, however many events came. */
  #scrollDirty = false;
  readonly #tableDrag = new TableDrag();
  /** A crowded play area row takes the wheel over it as a sideways scroll; a vertical drag over it still scrolls the table. */
  #rowWheelRect: Rect | null = null;
  /** The Card size the last draw used: a change (Settings opened from Pause) redraws the table at the new size. */
  #drawnCardSize: string | null = null;
  /** The target set a reveal last ran for, so a target prompt scrolls its first target into view once, not every draw. */
  #revealedTargets: string | null = null;

  get #art(): CardArt {
    this.#artCache ??= cardArt(this);
    return this.#artCache;
  }

  /** Built fresh each draw: a live view onto `#targetingHoverId` for `drawTargetingPanel`. */
  get #targetingHover(): TargetingHover {
    return {
      hoveredId: this.#targetingHoverId,
      setHovered: (id) => {
        if (this.#targetingHoverId === id) return;
        this.#targetingHoverId = id;
        this.#draw();
      },
    };
  }

  constructor() {
    super(SCENES.board);
  }

  /** The hand's flick coasts frame by frame; everything else on the table moves by tween or by redraw. */
  override update(_time: number, deltaMs: number): void {
    // Settings can be opened over the board from Pause and change the Card size under it; a wheel or drag asked for a scroll.
    if (this.#scrollDirty || (this.#model && appSession().settings.cardSize !== this.#drawnCardSize)) this.#draw();
    // A drawn card's ghost starting or landing: the ghost is redrawn from its own clock, so something has to ask.
    else if (this.#model && this.#motion.needsRedraw()) this.#draw();
    // The first player token passed while the table was covered: its flight starts the moment the table is back.
    else if (
      this.#model &&
      this.#firstPlayerToken.waiting(this.#debugFirstPlayer ?? this.#model.firstPlayerId) &&
      !this.#tokenCovered()
    )
      this.#draw();
    this.#hand.tick(deltaMs);
    this.#playAreaScroll.row.tick(deltaMs);
    // Checked every frame, not only on a store update: the villain-phase walkthrough and the pending-choice
    // overlay each close themselves (Skip, Continue, an answered decision) without dispatching a command, so a
    // beat queued behind either would otherwise wait for the *next* command instead of opening the moment the way
    // is actually clear.
    this.#tryOpenCampaignBeat();
    this.#tryOpenTeamUpSplash();
    // Same reasoning as the campaign beat above, for the guide's own spotlight — see `BoardGuideMount.pollBanner`'s
    // own doc comment.
    this.#guide?.pollBanner();
    // Same reasoning again, for a tip held back while an overlay/lesson-step was covering it — see
    // `BoardTipMount.pollBlocked`'s own doc comment.
    this.#tip?.pollBlocked(this.#tipBlocked());
  }

  create(): void {
    this.#walkthroughLaunching = false;
    this.#outcomeHeld = false;
    this.#villainReplay = null;
    // Phaser reuses this one instance for every game — "Run it back" and
    // "Continue" start this same scene again — so everything about *a game*
    // starts over here. The log didn't, and a rematch was dealt under the
    // previous game's "The villain is defeated. You win."
    // Before anything is timed: the store delivers the first state synchronously below, and the opening band is
    // timed from it (`ui/scene-clock.ts`).
    syncSceneClock(this);
    this.#motion.reset();
    this.#firstPlayerToken.reset();
    this.#debugFirstPlayer = null;
    this.#log = emptyLog();
    this.#cardHistory = emptyCardHistoryLog();
    appSession().gameLog = this.#log;
    // A fresh game has no villain phase to look back on yet.
    appSession().villainReview = null;
    this.#logPanel.reset();
    this.#tableScroll = 0;
    this.#scrollDirty = false;
    this.#revealedTargets = null;
    this.#version = -1;
    this.#soundTrail = -1;
    this.#previousGame = null;
    this.#logAt.clear();
    this.#tabBadges.clear();
    this.#tabChanged.clear();
    this.#focus = null;
    this.#controller.setUndoFocus(false);
    this.#focusRegion = "board";
    this.#guideFocusOwner = null;
    this.#saveFailureAnnounced = false;
    this.#pendingCampaignBeat = null;
    this.#teamUps = [];
    this.#teamUpPlayable = new Set();
    this.#teamUpWaiting = new Set();
    this.#teamUpWatch = null;
    this.#pendingSplashes = [];
    this.#teamUpHover = null;
    this.#guide?.destroy();
    this.#guide = null;
    // Fresh scheduler state for a fresh game (guided mode G10e part 2) — "Run it back"/"Continue" reuse this same
    // scene instance, and the opening-turn hold/one-per-turn cap must reset the same way `#guide` does above.
    this.#tip = new BoardTipMount(this);
    // A fresh game starts with its form cards folded.
    this.#formFanOpen = false;
    this.#formFanT = 0;
    this.#formFanTween = null;
    // The desktop card hover popover: one listener set on the scene's pointer, not one per card.
    this.#hover = new HoverPreview(this, {
      cards: () => this.#frame.hitRects,
      facedown: () => this.#frame.facedownHovers,
      area: (pointer) => {
        const { width, height } = this.scale.gameSize;
        // A choice sheet the docked villain phase covers is hidden and inert (`sheetIsCovered`): it is no overlay.
        const manager = this.scene.manager;
        const sheetCovered = sheetIsCovered({
          coverActive: this.scene.isActive(SCENES.villainPhase),
          coverIndex: manager.getIndex(SCENES.villainPhase),
          sheetIndex: manager.getIndex(SCENES.choice),
        });
        const overlays = Object.values(SCENES).filter(
          (key) =>
            key !== SCENES.board &&
            key !== SCENES.music &&
            !CHROME_SCENES.has(key) &&
            // Docked in the villain phase's panel, the sheet leaves the table beside it to read (#231).
            !(key === SCENES.choice && (sheetCovered || choiceDock() !== null || choicePeeking())) &&
            this.scene.isActive(key),
        );
        return hoverArea({
          formFactor: formFactorFor(width, height),
          mouse: isMousePointer(pointer),
          scale: appSession().settings.cardHoverScale,
          overlays,
          villainPhaseKey: SCENES.villainPhase,
          dockPanel: this.#villainDockRects?.panel ?? null,
          viewport: { x: 0, y: 0, width, height },
        });
      },
    });
    // When the villain phase closes, the table draws again without it: its review handle (`#drawVillainReviewHandle`)
    // only shows once the phase is gone, and nothing else redraws the Board at that moment.
    const villainPhase = this.scene.get(SCENES.villainPhase);
    const afterVillainPhase = (): void => this.#draw();
    villainPhase.events.on(Phaser.Scenes.Events.SHUTDOWN, afterVillainPhase);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      villainPhase.events.off(Phaser.Scenes.Events.SHUTDOWN, afterVillainPhase),
    );
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    const { store } = appSession();
    this.#unsubscribe = store.subscribe((state) => this.#onState(state));
    const config = store.state.config;
    if (config?.scenarioId) {
      const scenario = POOL_SCENARIOS.find((s) => s.id === config.scenarioId);
      appSession().music?.playBattle({ scenarioId: config.scenarioId, packCode: scenario?.packCode });
    }
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
      // A decision overlay, the villain-phase walkthrough, or Pause (and
      // whatever Pause itself launched) owns the keyboard and the pad while it
      // is up — the walkthrough used to leave arrows walking the board unseen
      // underneath it, and Pause's own Escape must not also reopen itself.
      blocked: () =>
        this.#choiceOpen ||
        this.scene.isActive(SCENES.inspect) ||
        this.scene.isActive(SCENES.villainPhase) ||
        this.scene.isActive(SCENES.pause) ||
        this.scene.isActive(SCENES.rules) ||
        this.scene.isActive(SCENES.settings) ||
        this.scene.isActive(SCENES.roundDebrief) ||
        this.scene.isActive(SCENES.teamUpSplash) ||
        this.scene.isActive(SCENES.teamUpInfo) ||
        this.scene.isActive(SCENES.evidence) ||
        this.scene.isActive(SCENES.pileView) ||
        // Device sync's "which copy?" question owns the keyboard and pad (`conflictPromptOwnsInput`).
        this.scene.isActive(SCENES.syncConflict) ||
        // "Hold on!" owns Escape (it dismisses with nothing sent); without this the board's own Escape opened Pause
        // on top of it.
        this.scene.isActive(SCENES.holdOn),
      onIntent: (intent) => this.#actOnIntent(intent),
    };
    bindKeyboard(this, binding);
    // T opens the Team-Up panel for the first active pair: the keyboard route to the badge's click.
    this.input.keyboard?.on("keydown-T", () => {
      if (!binding.blocked() && this.#teamUps.length > 0) this.#openTeamUpInfo(this.#teamUps[0]!);
    });
    // E opens Baron Zemo's Evidence view, the keyboard route to the chrome's EVIDENCE button.
    this.input.keyboard?.on("keydown-E", () => {
      if (!binding.blocked() && this.#hasEvidence()) this.#openEvidence();
    });
    // Z (and Ctrl/Cmd+Z) is Undo (`view/undo.ts`), the keyboard route to the action bar's Undo button.
    this.input.keyboard?.on("keydown-Z", () => {
      if (!binding.blocked()) void this.#controller.undo();
    });
    // 1 to 3 answer "Which one?" (a played event with several usable Action abilities).
    ["ONE", "TWO", "THREE"].forEach((key, index) => {
      this.input.keyboard?.on(`keydown-${key}`, () => {
        const option = this.#controller.abilityChoice()?.options[index];
        if (option && !binding.blocked()) void this.#controller.chooseEventAbility(option.abilityId);
      });
    });
    // 1 and 2 answer "Where does it go?" (an ally that may enter the mission area as well as the player's own).
    ["ONE", "TWO"].forEach((key, index) => {
      this.input.keyboard?.on(`keydown-${key}`, () => {
        const option = this.#controller.destinationChoice()?.options[index];
        if (option && !binding.blocked()) void this.#controller.chooseDestination(option);
      });
    });
    bindGamepad(this, binding);
    // A wheel/trackpad gesture over the hand scrolls it, on any layout that
    // needs scrolling at all — the tabbed board is the only one that ever
    // does (`drawHand`), so this is a no-op everywhere else.
    this.input.on("wheel", this.#hand.onWheel, this.#hand);
    // And over a crowded play area, which checks the pointer is over its own row.
    this.input.on("wheel", this.#playAreaScroll.row.onWheel, this.#playAreaScroll.row);
    // The same for the game log, which checks the pointer is over it.
    this.input.on("wheel", this.#logPanel.onWheel, this.#logPanel);
    // At a larger Card size the table scrolls: a wheel over it (where no scroll region of its own takes the gesture) and a
    // touch drag. Both only move `#tableScroll`; the next frame redraws.
    this.input.on("wheel", this.#onTableWheel, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.#onTableDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onTableMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.#onTableUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onTableUp, this);
    // The Inspect overlay's "Play it" comes back here, because playing a card
    // is the board's job: the overlay only ever reports what the engine said.
    this.game.events.on("mc-play-card", this.#onInspectPlay, this);
    // Same pattern for the ability picker Inspect opens when a card offers
    // more than one usable ability (see `BoardController.onCharacterTap`): the
    // sheet reports which one was picked, and only the board ever dispatches.
    this.game.events.on("mc-use-ability", this.#onInspectUseAbility, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", onResize, this);
      this.#controller.dispose();
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#artUnsubscribe?.();
      this.#artUnsubscribe = null;
      this.game.events.off("mc-play-card", this.#onInspectPlay, this);
      this.game.events.off("mc-use-ability", this.#onInspectUseAbility, this);
      this.input.off("wheel", this.#hand.onWheel, this.#hand);
      this.input.off("wheel", this.#playAreaScroll.row.onWheel, this.#playAreaScroll.row);
      this.input.off("wheel", this.#logPanel.onWheel, this.#logPanel);
      this.input.off("wheel", this.#onTableWheel, this);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.#onTableDown, this);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.#onTableMove, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.#onTableUp, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#onTableUp, this);
      /**
       * The overlays this scene launches run in parallel over it, so stopping
       * the Board doesn't stop them. When the game ends `#onState` hands off to
       * Game Over before `#syncChoiceOverlay` gets its turn, which left the
       * choice sheet running — invisibly, holding its store subscription —
       * behind the game-over screen. The Board owns them, so it closes them.
       * `#choiceOpen` resets too, or the next Board would think the sheet was
       * already up and never relaunch it.
       */
      for (const overlay of [
        SCENES.choice,
        SCENES.inspect,
        SCENES.pileView,
        SCENES.villainPhase,
        SCENES.pause,
        SCENES.rules,
        SCENES.settings,
        SCENES.campaignBeat,
        SCENES.roundDebrief,
        SCENES.teamUpSplash,
        SCENES.teamUpInfo,
      ]) {
        if (this.scene.isActive(overlay) || this.scene.isSleeping(overlay)) this.scene.stop(overlay);
      }
      this.#choiceOpen = false;
      this.#guide?.destroy();
      this.#guide = null;
      this.#tip = null;
    });
    fadeScreenIn(this);

    // Headless click-through hook only (never referenced by product code) — mirrors every other `?screen=…demo`
    // scene's own `__mc*Debug` accessor (`scenes/guide-panel-demo.ts`, `scenes/guide-callout-demo.ts`, …), so a
    // real guided game can be driven with real pointer coordinates instead of hardcoded pixel guesses.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcBoardDebug?: unknown }).__mcBoardDebug = {
        focusRect: (key: string) => this.#frame.focusRects.get(key) ?? null,
        hitRect: (id: string) => this.#frame.hitRects.get(id as InstanceId) ?? null,
        hoverShown: () => this.#hover?.shownKey ?? null,
        allFocusRects: () => [...this.#frame.focusRects.entries()],
        allPileRects: () => [...this.#frame.pileRects.entries()],
        handStrip: () => this.#frame.handStrip[0] ?? null,
        paymentView: () => this.paymentView(),
        phaseBand: () => this.#motion.debugPhaseBand(),
        phaseBandLog: () => this.#motion.debugPhaseBandLog(),
        pendingChoice: () => appSession().store.state.game?.pendingChoice ?? null,
        guideStepId: () => this.#guide?.debugStepId() ?? null,
        guideStopped: () => this.#guide?.stopped ?? false,
        guideNudge: () => this.#guide?.debugNudge() ?? null,
        guidePanelRects: () => this.#guide?.debugPanelRects() ?? null,
        guideCalloutRects: () => this.#guide?.debugCalloutRects() ?? null,
        guideWaitingStripRects: () => this.#guide?.debugWaitingStripRects() ?? null,
        guideAnchorRect: () => this.#guide?.debugAnchorRect() ?? null,
        tipDisplayed: () => this.#tip?.displayed?.id ?? null,
        tipRects: () => this.#tip?.debugRects() ?? null,
        activeTab: () => this.#activeTab,
        // The first player token: where it is and who holds it; `passFirstPlayerToken` draws it for another seat.
        firstPlayerToken: () => this.#firstPlayerToken.debugState(),
        seatIds: () =>
          this.#model ? [this.#model.perspectiveId, ...this.#model.team.map((seat) => seat.playerId)] : [],
        passFirstPlayerToken: (playerId: string) => {
          this.#debugFirstPlayer = playerId as PlayerId;
          this.#draw();
        },
        // Each Team-Up ring's click target and whether its hover label is showing (dev e2e hook).
        teamUpRings: () =>
          this.children.list
            .filter((o) => o.name.startsWith("teamUpRing:"))
            .map((o) => {
              const b = (o as Phaser.GameObjects.Zone).getBounds();
              const label = this.children.list.find((l) => l.name === `teamUpRingLabel:${o.name.slice(11)}`) as
                | Phaser.GameObjects.Text
                | undefined;
              return {
                key: o.name.slice(11),
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                labelShown: !!label?.visible,
                labelText: label?.text ?? null,
              };
            }),
        // The play area row's scroll position and how far it can go (dev e2e hook).
        playAreaScroll: () => ({
          scrollX: this.#playAreaScroll.row.scrollX,
          maxScroll: this.#playAreaScroll.row.maxScroll,
        }),
        // Dev/QA only: pads the schemes column, the minion row, the environments or the play area to N by cloning
        // under fake ids (they render and scroll like real ones, but are not targetable: the engine knows nothing
        // of them).
        setSideSchemeCount: (count: number | null) => this.#setDebugPad(count === null ? null : { sideSchemes: count }),
        setBoardPad: (
          pad: { sideSchemes?: number; minions?: number; environments?: number; playArea?: number } | null,
        ) => this.#setDebugPad(pad),
        zoneRect: (name: string) => (this.#layout?.zones as Record<string, Rect | null> | undefined)?.[name] ?? null,
      };
    }
  }

  #onState(state: SessionState): void {
    if (!state.game || state.perspectiveId === null) return;
    // The table's sounds (`view/sound-effects.ts`): a card played, then its attack or thwart, then the end-of-turn
    // refill. Read off the command trail, which the store appends a beat after the command's state lands, so a back out
    // or a resumed game's past plays nothing.
    const trail = state.commandTrail;
    if (this.#soundTrail >= 0 && trail.length > this.#soundTrail) {
      const game = state.game;
      appSession().music?.playEffects(
        tableSoundsOf(
          trail.slice(this.#soundTrail),
          soundInfoOfCard,
          (command) => cardOf(game, command.cardInstanceId)?.name ?? null,
        ),
      );
    }
    this.#soundTrail = trail.length;
    this.#syncGuide(state);

    // Fold this command's events onto the log before the state replaces it.
    const fresh = state.version !== this.#version;
    // The game as it stood before this command, for the villain phase recap's "what changed" tiles.
    const previousGame = this.#previousGame;
    if (fresh) this.#previousGame = state.game;
    // Back out rewound the game: put the log back as it was at that version, and skip this update's replay events.
    const rewound = fresh && state.version < this.#version ? this.#logAt.get(state.version) : undefined;
    /** The log as it stood before this command's lines, for a villain phase this command begins (`#logBeforePhase`). */
    let logBefore = this.#log;
    if (rewound) {
      this.#log = rewound.log;
      this.#cardHistory = rewound.cardHistory;
      appSession().gameLog = this.#log;
      for (const version of [...this.#logAt.keys()]) if (version > state.version) this.#logAt.delete(version);
      this.#version = state.version;
      this.#controller.reset();
    } else if (fresh) {
      // A resumed game arrives mid-round with no events saying which round, so
      // an empty log starts counting from the state's round rather than "R0".
      if (this.#log.round === 0) this.#log = { ...this.#log, round: state.game.round };
      // The log opens on the game's seed, so a bug report or a replay can name it.
      if (state.config) this.#log = withSeedLine(this.#log, state.config.seed);
      // A resumed game's first state carries the whole game so far: fold it first, so the panel opens on the recent lines.
      // A blind game's log never names the hidden stage 2 (`eventsForBlindLog`).
      const blind = blindRevealOf(state.config, state.game);
      if (state.resumedHistory.length > 0) {
        const history = eventsForBlindLog(state.resumedHistory, blind);
        this.#log = appendEvents(this.#log, history, state.game, state.perspectiveId, POOL_DEPS);
      }
      const latest = eventsForBlindLog(state.lastEvents, blind);
      logBefore = this.#log;
      this.#log = appendEvents(this.#log, latest, state.game, state.perspectiveId, POOL_DEPS);
      this.#cardHistory = appendCardHistory(this.#cardHistory, state.lastEvents);
      // Mirrored for Pause's "Jump to a moment" (`session.ts`'s own doc comment on `gameLog`).
      appSession().gameLog = this.#log;
      this.#noteTabChanges(state);
      this.#motion.land(state.lastEvents);
      // A hero going down is the one change nobody may miss. The last one
      // standing falling is the game ending instead, and Game Over says that.
      if (!state.game.outcome) {
        // A seat that sits a scenario out is eliminated with no defeat; its `playerSatOut` follows in the same batch.
        const satOut = new Set(
          state.lastEvents.flatMap((event) => (event.type === "playerSatOut" ? [event.playerId] : [])),
        );
        for (const event of state.lastEvents) {
          if (event.type !== "playerEliminated" || satOut.has(event.playerId)) continue;
          this.#motion.announce(
            `${playerName(state.game, event.playerId)} is down`,
            "Defeated — out of the game. The rest of the team fights on",
          );
        }
      }
      // An Avatar of Loki shattering and another taking the villain slot: the panel would change its name unexplained.
      for (const swap of avatarSwapAnnouncements(state.lastEvents, state.game)) {
        this.#motion.announce(swap.title, swap.detail);
      }
      // A progressing identity's Level Up!: her card, stats and abilities change at once, so it gets its own moment.
      for (const caption of levelUpCaptions(state.lastEvents, state.game)) this.#motion.announceLevelUp(caption);
      // Saving failing is silent otherwise — the game plays on — and a refresh
      // would then lose it. Said once, loudly; the chrome chip keeps saying it.
      if (state.saveError !== null && !this.#saveFailureAnnounced) {
        this.#saveFailureAnnounced = true;
        this.#motion.announce("Game not saving", "It may not survive a refresh");
      }
      this.#version = state.version;
      this.#logAt.set(state.version, { log: this.#log, cardHistory: this.#cardHistory });
      // A new state invalidates any half-made selection: the engine may have
      // changed what is legal, and a stale target would just be rejected.
      this.#controller.reset();
    }

    const mine = state.legal?.playerId === state.perspectiveId ? state.legal.actions : null;
    this.#model = this.#withDebugSideSchemes(boardModel(state.game, state.perspectiveId, POOL_DEPS, mine));
    this.#marks = state.legal
      ? withDefenseLockout(
          withForcedActions(
            withAttackBarWording(highlights(state.legal.actions), state.legal.actions, state.game, POOL_DEPS),
            state.legal.actions,
            state.game,
            POOL_DEPS,
          ),
          state.game,
          state.perspectiveId,
          POOL_DEPS,
        )
      : null;
    const present = presentTeamUps(state.game, TEAM_UP_PAIRS);
    this.#teamUps = present.map((entry) => entry.pair);
    this.#teamUpPlayable = new Set(present.filter((entry) => entry.playable).map((entry) => entry.pair.key));
    this.#teamUpWaiting = teamUpWaitingSeats(state.game, present);
    const seen = observeTeamUps(this.#teamUpWatch, this.#teamUps, { resumed: resumedGame(state) });
    this.#teamUpWatch = seen.watch;
    this.#pendingSplashes.push(...seen.announce.filter((pair) => teamUpArtFor(TEAM_UP_ART, pair.names)?.splash));

    if (state.game.outcome) {
      // The engine finished the game inside the command; the rail may still be replaying the beats that ended it, so the
      // outcome waits for it (`releaseOutcome`). A command that ran the whole villain phase to the end opens it too.
      if (fresh) this.#openVillainWalkthrough(state.lastEvents, previousGame, logBefore);
      if (this.#villainReplayHoldsOutcome()) {
        this.#outcomeHeld = true;
        this.#draw();
        return;
      }
      goToScreen(this, SCENES.gameOver);
      return;
    }
    // Only a *new* command can start a villain phase; a plain redraw re-reads
    // the same `lastEvents` and must not re-open a walkthrough the player skipped.
    if (fresh) this.#openVillainWalkthrough(state.lastEvents, previousGame, logBefore);
    if (fresh) this.#queueCampaignBeat(state);
    // Guided mode G8 part 2: only a *new* command's own events ever get folded into the round debrief's
    // accumulator — same reasoning as the villain-phase walkthrough just above (`fresh`'s own doc comment on
    // `#version`), and `#syncGuide` above has already fed this same batch to `onObservation`, so a lesson this
    // batch just finished is already reflected in the controller's state by the time this runs.
    if (fresh) this.#guide?.noteRoundEvents(state.lastEvents);
    this.#syncChoiceOverlay(state);
    this.#tryOpenCampaignBeat();
    // Guided mode G10e part 2: fed *after* the choice/campaign-beat overlays above have had their own chance to
    // open this frame, so `#tipBlocked()` already sees this command's own overlay, not last frame's. Gated on
    // `fresh` the same way `#guide?.noteRoundEvents` is just above — a plain redraw must not re-run the scheduler
    // against the same `lastEvents` a second time (it would auto-hide a tip the instant it was shown).
    if (fresh) {
      const observation: LessonObservation = {
        game: state.game,
        lastEvents: state.lastEvents,
        perspectiveId: state.perspectiveId,
      };
      this.#tip?.onObservation(observation, this.#tipBlocked(), appSession().guidedRun);
    }
    this.#draw();
  }

  /** No opportunistic tip (guided mode G10e part 2) may show while any of these own the screen: the usual overlay
   * list `create()`'s own keyboard/pad `binding.blocked` already checks, plus a scripted lesson step's own
   * callout/panel (`BoardGuideMount#hasCurrentStep`) — the two surfaces would otherwise collide on the same board. */
  #tipBlocked(): boolean {
    return (
      this.#choiceOpen ||
      this.scene.isActive(SCENES.inspect) ||
      this.scene.isActive(SCENES.pileView) ||
      this.scene.isActive(SCENES.villainPhase) ||
      this.scene.isActive(SCENES.pause) ||
      this.scene.isActive(SCENES.rules) ||
      this.scene.isActive(SCENES.settings) ||
      this.scene.isActive(SCENES.roundDebrief) ||
      this.scene.isActive(SCENES.campaignBeat) ||
      this.scene.isActive(SCENES.teamUpSplash) ||
      this.scene.isActive(SCENES.teamUpInfo) ||
      this.scene.isActive(SCENES.holdOn) ||
      (this.#guide?.hasCurrentStep() ?? false)
    );
  }

  /**
   * Feeds this state to the guide's board mount (guided mode G5c, `docs/guided-mode.md` §4): builds it, lazily,
   * on the first state a guided run sees (a `GuideController` needs an initial `LessonObservation` to start
   * from), then keeps it fed on every later state. A no-op for a plain, non-guided game
   * (`appSession().guidedRun` false) — most games never allocate a `BoardGuideMount` at all.
   *
   * **Which run** (guided mode G10d, `docs/guided-mode.md` §4 G10d): `appSession().guidedRunKind` tells this the
   * five-lesson tutorial (`TUTORIAL_LESSONS`) from a one-lesson aspect "Try it" run (`ASPECT_TRYIT_LESSONS`) —
   * `undefined` (every tutorial call site predates this field) reads as tutorial, same as `{ kind: "tutorial" }`.
   * An aspect run has no "How to win" pre-game lesson to mark already-done, no round debrief and no Log lock
   * (`BoardGuideMount`'s own `lockLog`/`roundDebrief` options, both `false` here), and its own completion writes
   * `markAspectLessonDone` instead of the tutorial's `markTutorialFinished`.
   */
  #syncGuide(state: SessionState): void {
    if (!appSession().guidedRun || !state.game) return;
    const observation = { game: state.game, lastEvents: state.lastEvents, perspectiveId: state.perspectiveId };
    if (this.#guide) {
      this.#guide.onObservation(observation);
      return;
    }
    const kind = appSession().guidedRunKind ?? { kind: "tutorial" };
    if (kind.kind === "aspect") {
      const { aspect } = kind;
      const label = aspectGuideOf(aspect)?.name ?? aspect;
      this.#guide = new BoardGuideMount(
        this,
        {
          lessons: [ASPECT_TRYIT_LESSONS[aspect]],
          runLabel: `${label} · Try it`,
          onComplete: () => setGuidePrefs(markAspectLessonDone(guidePrefs(), aspect)),
          completeTitle: `${label} complete`,
          completeBody: "Nice work. Find the other aspects any time in How to play.",
          completePrimaryLabel: "Keep playing",
          completeLeaveShortLabel: "Lessons",
          onLeave: () => this.#leaveLesson({ scene: SCENES.aspectLesson, data: { aspect, backTo: "howToPlay" } }),
        },
        observation,
        { lockLog: false, roundDebrief: false },
      );
      return;
    }
    if (kind.kind === "mechanic") {
      const { mechanic } = kind;
      const label = MECHANIC_TRYITS.find((l) => l.id === mechanic)?.title ?? mechanic;
      this.#guide = new BoardGuideMount(
        this,
        {
          lessons: [MECHANIC_TRYIT_LESSONS[mechanic]],
          runLabel: `${label} · Try it`,
          onComplete: () => setGuidePrefs(markAspectLessonDone(guidePrefs(), mechanicLessonDoneKey(mechanic))),
          completeTitle: "Try it complete",
          completeBody: "Nice work. More under New in this box, in How to play.",
          completePrimaryLabel: "Keep playing",
          completeLeaveShortLabel: "Lessons",
          onLeave: () => this.#leaveLesson({ scene: SCENES.howToPlay, data: {} }),
        },
        observation,
        { lockLog: false, roundDebrief: false },
      );
      return;
    }
    this.#guide = new BoardGuideMount(
      this,
      {
        lessons: TUTORIAL_LESSONS,
        alreadyDone: appSession().guidedRunAlreadyDone ?? ["how-to-win"],
        runLabel: "First game",
      },
      observation,
    );
  }

  /**
   * "Back to lessons" on a finished Try-it: leave the lesson game for the screen it was opened from. Not a
   * concession: nothing is dispatched, so no result is recorded, and the lesson save is filtered out of every result
   * reader (`SaveMeta.guided`; `engine/previous-game-facts.ts`, `progression/`).
   */
  #leaveLesson(to: { readonly scene: string; readonly data: object }): void {
    appSession().guidedRun = false;
    appSession().guidedRunKind = undefined;
    setGuideRunLevelOverride(null);
    goToScreen(this, to.scene, to.data);
  }

  /**
   * The whole of this scene's side of C04's contract (`scenes/campaign/beat.ts`): notice a villain stage flip this
   * command's events named, in a campaign game the story has something to say about, and remember it —
   * `#tryOpenCampaignBeat` is what actually launches it, once a clear moment comes. Pure detection lives in
   * `view/campaign-beat-model.ts` so "only a campaign game, only a stage the story has a line for" is Vitest-tested
   * without a scene.
   */
  #queueCampaignBeat(state: SessionState): void {
    if (!state.game || !state.config) return;
    const beat = campaignBeatFor(state.lastEvents, state.game, state.config);
    if (beat) this.#pendingCampaignBeat = beat;
  }

  /**
   * Opens the queued beat, but never on top of the villain-phase walkthrough that is narrating the very flip it's
   * about, never a second copy of itself, and never over an open pending choice — the beat is flavor, not a
   * decision, and must not be the thing between a player and something the engine is actually waiting on.
   */
  #tryOpenCampaignBeat(): void {
    if (!this.#pendingCampaignBeat) return;
    if (appSession().store.state.game?.pendingChoice) return;
    if (this.scene.isActive(SCENES.villainPhase) || this.scene.isActive(SCENES.campaignBeat)) return;
    const data = this.#pendingCampaignBeat;
    this.#pendingCampaignBeat = null;
    this.scene.launch(SCENES.campaignBeat, data);
  }

  /**
   * Opens the next queued Team-Up splash once the way is clear: never on top of the villain-phase walkthrough or a
   * campaign beat (they narrate their own moment), never a second one over a running splash. It may sit over a pending
   * choice, but it dismisses itself after `TEAM_UP_SPLASH_MS`, and takes the choice's input only for that long.
   */
  #tryOpenTeamUpSplash(): void {
    const pair = this.#pendingSplashes[0];
    if (!pair) return;
    if (
      this.scene.isActive(SCENES.teamUpSplash) ||
      this.scene.isActive(SCENES.villainPhase) ||
      this.scene.isActive(SCENES.campaignBeat) ||
      this.scene.isActive(SCENES.roundDebrief)
    )
      return;
    if (this.#walkthroughLaunching) return;
    // Not over a round/phase band still playing: the band slides across the table and would show through the splash's
    // scrim as a dim red and black stripe. The splash follows the band; it is queued, not dropped.
    if (this.#motion.isTransitioning()) return;
    // Held through setup and the mulligan: the splash opens at the start of the first turn, not over the opening hand.
    if (appSession().store.state.game?.step.phase === "setup") return;
    this.#pendingSplashes.shift();
    const picture = teamUpArtFor(TEAM_UP_ART, pair.names)?.splash;
    if (!picture) return;
    this.scene.launch(SCENES.teamUpSplash, { label: pair.label, picture } satisfies TeamUpSplashData);
  }

  /**
   * The rings for this draw: each active Team-Up that has a closeup, on every seat providing one of its characters.
   * Null with none, so a game without a Team-Up draws exactly as before.
   */
  #teamUpRings(tabbed: boolean): TeamUpRings | undefined {
    const game = appSession().store.state.game;
    if (!game || this.#teamUps.length === 0) return undefined;
    const byPlayer = new Map<string, TeamUpBadge[]>();
    for (const pair of this.#teamUps) {
      const picture = teamUpArtFor(TEAM_UP_ART, pair.names)?.badge;
      if (!picture) continue;
      for (const player of teamUpProviders(game, pair)) {
        byPlayer.set(player, [
          ...(byPlayer.get(player) ?? []),
          {
            key: pair.key,
            label: pair.label,
            picture,
            playable: this.#teamUpPlayable.has(pair.key),
          },
        ]);
      }
    }
    if (byPlayer.size === 0) return undefined;
    return {
      byPlayer,
      waiting: this.#teamUpWaiting,
      tabbed,
      hoverId: this.#teamUpHover,
      onHover: (id) => {
        this.#teamUpHover = id;
      },
      onOpen: (key) => {
        const pair = this.#teamUps.find((candidate) => candidate.key === key);
        if (pair) this.#openTeamUpInfo(pair);
      },
      onReady: () => this.#draw(),
      masks: this.#frame.masks,
      onFocusRect: (pairKey, rect) => {
        const key = focusKey({ kind: "teamUp", pairKey });
        if (!this.#frame.focusRects.has(key)) this.#frame.focusRects.set(key, rect);
      },
    };
  }

  /** The Team-Up role of each card in this seat's hand, for the tag on it. */
  #teamUpRoles(model: BoardModel): ReadonlyMap<InstanceId, TeamUpRole> {
    const game = appSession().store.state.game;
    const roles = new Map<InstanceId, TeamUpRole>();
    if (!game) return roles;
    const pairs = poolTeamUpPairs(game);
    for (const card of model.hand) {
      const role = teamUpRoleOf(game, card.instanceId, pairs);
      if (role) roles.set(card.instanceId, role);
    }
    return roles;
  }

  /** Whether this game gathers evidence (Baron Zemo): its piles or faceup evidence are in the state. */
  #hasEvidence(): boolean {
    const game = appSession().store.state.game;
    return game !== null && evidenceInputOf(game) !== null;
  }

  /** The Evidence view (`scenes/evidence.ts`), over the table. */
  #openEvidence(): void {
    if (this.scene.isActive(SCENES.evidence)) return;
    this.scene.launch(SCENES.evidence, { from: SCENES.board });
  }

  /** The Team-Up panel for `pair`, over the table. */
  #openTeamUpInfo(pair: TeamUpPair): void {
    const game = appSession().store.state.game;
    if (!game || this.scene.isActive(SCENES.teamUpInfo)) return;
    this.#teamUpHover = null;
    const seat = (id: PlayerId): string => seatLabel(game, id);
    const detail = teamUpDetail(game, pair, POOL_CARDS, seat);
    const art = teamUpArtFor(TEAM_UP_ART, pair.names);
    const picture = art?.badge ?? art?.splash ?? null;
    this.scene.launch(SCENES.teamUpInfo, { detail, picture, from: SCENES.board } satisfies TeamUpInfoData);
  }

  /**
   * Opens the villain-phase walkthrough when a villain phase begins.
   *
   * This is the whole of the Board's side of the contract documented at the top
   * of `scenes/villain-phase.ts`: one launch carrying only the game as it stood before the command that began the
   * phase (the recap's "what changed" tiles read it). The overlay subscribes to the store itself, accumulates the
   * phase's beats across the several commands one phase can span, and shows its recap when the phase ends.
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
  #openVillainWalkthrough(events: readonly GameEvent[], before: GameState | null, logBefore: LogState): void {
    if (this.scene.isActive(SCENES.villainPhase)) return;
    const begins = events.some(
      (event) => event.type === "stepChanged" && event.to.phase === "villain" && event.to.kind === "placeThreat",
    );
    if (!begins) return;
    this.#logBeforePhase = logBefore;
    this.scene.launch(SCENES.villainPhase, { before } satisfies VillainPhaseLaunchData);
    this.#walkthroughLaunching = true;
    // Cleared when the walkthrough has been created, not only when a draw happens to see it active: the Board's time
    // does not run while the walkthrough is up, so on a slow machine no draw may have seen it, and the flag then
    // stayed set after it closed and held ROUND N · PLAYER PHASE back forever.
    this.scene.get(SCENES.villainPhase)?.events.once(Phaser.Scenes.Events.CREATE, () => {
      this.#walkthroughLaunching = false;
    });
  }

  /**
   * Whether an overlay covers the table for the round/phase band (`motion.ts#drawPhaseWipe`). Phaser only marks a
   * launched scene active on its next step, so the draw that follows `#openVillainWalkthrough`'s own launch would
   * otherwise see an uncovered table and start the band underneath the walkthrough about to open over it — on a
   * slow runner, far enough to finish unseen (CI, 2026-09-29).
   */
  #tableCoveredForBand(): boolean {
    const walkthrough = this.scene.isActive(SCENES.villainPhase);
    if (walkthrough) this.#walkthroughLaunching = false;
    // The Team-Up splash covers the table too: a band that played under its scrim showed as a red and black stripe
    // behind the picture, and was spent before the splash closed. It is held, and plays once the splash is gone.
    return (
      walkthrough ||
      this.#walkthroughLaunching ||
      this.scene.isActive(SCENES.roundDebrief) ||
      this.scene.isActive(SCENES.teamUpSplash)
    );
  }

  /**
   * Counts what happened on the tabs the player isn't looking at, so a phone
   * board never changes silently off screen. Only meaningful on phone, but the
   * counting is cheap and keeps the badge correct if the window is narrowed
   * mid-game.
   */
  #noteTabChanges(state: SessionState): void {
    if (!state.game || state.perspectiveId === null) return;
    for (const [tab, keys] of tabKeysTouchedBy(state.lastEvents, state.game, state.perspectiveId)) {
      if (tab === this.#activeTab) continue;
      // Distinct cards across commands too: the same villain hit every round is still one changed card.
      const seen = this.#tabChanged.get(tab) ?? new Set<string>();
      for (const key of keys) seen.add(key);
      this.#tabChanged.set(tab, seen);
      this.#tabBadges.set(tab, seen.size);
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

  #setDebugPad(pad: { sideSchemes?: number; minions?: number; environments?: number; playArea?: number } | null): void {
    this.#debugPad = pad;
    const state = appSession().store.state;
    if (state.game && state.perspectiveId) {
      this.#model = this.#withDebugSideSchemes(boardModel(state.game, state.perspectiveId, POOL_DEPS));
    }
    this.#draw();
  }

  #withDebugSideSchemes(model: BoardModel): BoardModel {
    const pad = this.#debugPad;
    if (!import.meta.env.DEV || !pad) return model;
    let padded = model;
    const firstSide = model.sideSchemes[0];
    if (pad.sideSchemes !== undefined && firstSide) {
      const sideSchemes = Array.from(
        { length: pad.sideSchemes },
        (_unused, index) =>
          model.sideSchemes[index] ?? {
            ...firstSide,
            instanceId: `pad-${index}` as InstanceId,
            name: `Side scheme ${index + 1}`,
          },
      );
      padded = { ...padded, sideSchemes };
    }
    if (pad.minions !== undefined) {
      const minions = Array.from(
        { length: pad.minions },
        (_unused, index) =>
          model.minions[index] ?? {
            ...model.villain,
            instanceId: `padm-${index}` as InstanceId,
            name: `Minion ${index + 1}`,
          },
      );
      padded = { ...padded, minions };
    }
    if (pad.playArea !== undefined) {
      // The player's own cards over again (the identity when nothing is in play yet), so a crowded row can be drawn.
      const real = model.myPlayArea.length > 0 ? model.myPlayArea : [model.me];
      const myPlayArea = Array.from(
        { length: pad.playArea },
        (_unused, index) =>
          model.myPlayArea[index] ?? { ...real[index % real.length]!, instanceId: `padp-${index}` as InstanceId },
      );
      padded = { ...padded, myPlayArea };
    }
    const firstEnv = model.environments[0];
    if (pad.environments !== undefined && firstEnv) {
      const environments = Array.from(
        { length: pad.environments },
        (_unused, index) =>
          model.environments[index] ?? {
            ...firstEnv,
            instanceId: `pade-${index}` as InstanceId,
            name: `Environment ${index + 1}`,
          },
      );
      padded = { ...padded, environments };
    }
    return padded;
  }

  #draw(): void {
    const hold = this.#villainReplay?.hold ?? null;
    const live = this.#heldModel(hold);
    if (!live) return;
    // The table's chrome says the phase the rail is on, not the one the engine has already reached.
    const model: BoardModel = hold ? { ...live, round: hold.round, phase: "villain", stepLabel: hold.stepLabel } : live;

    // The positions cards held under whatever was drawn last — the only place
    // "where a card came from" can still be read once this redraw rebuilds
    // the hit rects for where cards are now (`view/travel.ts`).
    const previous = this.#frame;
    for (const button of previous.buttons) button.destroy();
    for (const ring of previous.rings) ring.destroy();
    for (const mask of previous.masks) mask.destroy();
    for (const region of previous.regions) region.destroy();
    this.#targetRings = [];
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#frame = emptyFrame();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const viewport: Rect = { x: 0, y: 0, width, height };
    // Asked before laying out the rest of the table, so nothing the guide rail covers is also a drop target
    // underneath it (guided mode G5c, `scenes/board/guide-mount.ts`'s own header).
    const guideRail = this.#guide?.railOptionFor(viewport) ?? undefined;
    const dock = this.#villainDock;
    // The Card size setting: above Standard the table is laid out taller than its window and scrolls (`scrollLayout`
    // moves the table's zones to the current offset, so every rect below is a screen rect, scrolled or not).
    const cardSize = appSession().settings.cardSize;
    const cardScale = cardSizeFactor(cardSize);
    this.#drawnCardSize = cardSize;
    this.#scrollDirty = false;
    const atRest = boardLayout(viewport, {
      playerCount: model.team.length + 1,
      neutralArea: model.scenarioPlayAreas.some((area) => area.neutral),
      activeTab: this.#activeTab,
      ...(guideRail ? { guideRail } : {}),
      ...(dock?.request === "rail" ? { villainDock: this.#dockShown.width } : {}),
      ...(dock?.request === "band" && this.#dockShown.grow > 0
        ? { villainBand: { tall: true, grow: this.#dockShown.grow } }
        : {}),
      ...(cardScale > 1 ? { cardScale } : {}),
      ...(this.#reviewHandleShown() ? { reviewHandle: REVIEW_HANDLE_WIDTH } : {}),
    });
    const layout = scrollLayout(atRest, this.#tableScroll);
    this.#tableScroll = layout.scrollY;
    const scrolling = layout.maxScroll > 0;
    this.#layout = layout;
    this.#villainDockRects = dock ? villainDockRects(dock.request, layout, this.#dockShown.width) : null;

    const ctx: BoardDrawContext = {
      scene: this,
      art: this.#art,
      // Nothing reads as playable while the villain phase holds the table (`setVillainPhaseOpen`).
      marks: this.#controller.readOnly ? null : this.#marks,
      tabbed: layout.tabbed,
      cardScale,
      controller: this.#controller,
      hand: this.#hand,
      schemeScroll: this.#schemeScroll,
      focusedCard: this.#focusRegion === "board" && this.#focus?.kind === "card" ? this.#focus.instanceId : null,
      playAreaScroll: this.#playAreaScroll,
      formFan: { open: this.#formFanOpen, t: this.#formFanT, setOpen: (open) => this.#setFormFan(open) },
      onRegionScroll: () => this.#refreshRings(),
      frame: this.#frame,
      motion: this.#motion,
      teamUpRings: this.#teamUpRings(layout.tabbed),
      teamUpRoles: this.#teamUpRoles(model),
      villainHandTags: this.#villainHandTags,
      actionsHeld: this.#villainReplay !== null,
      makeTapTarget: (rect, id, onTap, drag, onHover, clip) =>
        this.#makeTapTarget(rect, id, onTap, drag, onHover, clip),
      dealtCaptionOf: (ids) => {
        const game = appSession().store.state.game;
        return dealtCaption(ids.length, game ? dealtReasonsOf(this.#cardHistory, ids, game) : []);
      },
      inspect: (id, siblings) => this.#inspect(id, siblings),
      openPile: (name, ids) => this.#openPile(name, ids),
      inspectReference: (reference) => this.scene.launch(SCENES.inspect, { reference }),
    };

    // The table felt, and nothing else.
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    const { zones } = layout;
    const drawTopBand = (): void => {
      drawChrome(this, zones.chrome!, model, {
        notSaving: appSession().store.state.saveError !== null,
        onMenu: () => this.#openPause(),
        ...(this.#hasEvidence() ? { onEvidence: () => this.#openEvidence() } : {}),
        buttons: this.#frame.buttons,
        motion: this.#motion,
      });
      if (zones.tabs) this.#drawTabs(zones.tabs, model);
    };
    // Scrolled content runs under the chrome and the tab row, so on a scrolling table they are drawn after it, over a
    // ground; at Standard the order is what it always was.
    if (!scrolling) drawTopBand();
    // A scenario play area (the mission area) takes the foot of the enemies zone; with none, the zone is whole. The
    // pod's neutral area (God of Lies) is the pod's shared threat: on a phone it takes the foot of the Threat tab, where
    // there is room for it, and elsewhere it shares the enemies zone's foot strip with any other area.
    const neutralAreas = model.scenarioPlayAreas.filter((area) => area.neutral);
    const neutralOnTab = ctx.tabbed && neutralAreas.length > 0;
    const stripAreas = neutralOnTab ? model.scenarioPlayAreas.filter((area) => !area.neutral) : model.scenarioPlayAreas;
    const references = this.#referenceCards();
    const neutralTab = neutralOnTab && zones.threat ? splitNeutralTab(zones.threat) : null;
    if (zones.threat) drawSchemes(ctx, neutralTab ? neutralTab.schemes : zones.threat, model);
    if (neutralTab && neutralTab.area.height > 0)
      drawScenarioPlayAreas(ctx, neutralTab.area, neutralAreas, references, "stack");
    const missionSplit = zones.enemies
      ? splitMissionArea(zones.enemies, stripAreas.length > 0, { neutral: stripAreas.some((area) => area.neutral) })
      : { enemies: null, area: null };
    if (missionSplit.enemies) drawEnemies(ctx, missionSplit.enemies, model);
    if (missionSplit.area) drawScenarioPlayAreas(ctx, missionSplit.area, stripAreas, references);
    // The set-aside footer's line comes out of the log's space, never the deck and discard's.
    const setAside =
      model.setAside && zones.encounter
        ? splitSetAside(
            zones.encounter,
            zones.log,
            setAsideFooterHeight(
              setAsideLines(model.setAside.count, model.setAside.names, (zones.log ?? zones.encounter).width),
            ),
          )
        : null;
    if (zones.encounter) drawEncounter(ctx, setAside?.encounter ?? zones.encounter, model, setAside?.footer ?? null);
    // The Log panel's own tutorial lock (guided mode G8 part 2, `docs/guided-mode.md` §3.11) — a guided run's Log
    // tab/panel stays visible, dashed and unavailable, with "Lesson 5" as the reason, until the run's last lesson
    // is done. `logGate` is `{ locked: false }` off a guided run, so a plain game never takes this branch.
    const logGate = this.#guide?.logGate() ?? { locked: false, reason: null };
    if (zones.log && logGate.locked) this.#logPanel.drawLocked(this, setAside?.log ?? zones.log, logGate.reason ?? "");
    else if (zones.log) this.#logPanel.draw(this, setAside?.log ?? zones.log, this.#tableLog());
    else this.#logPanel.hide();
    // Always the wide panel: the identity's attachments only show as chips
    // beside its card, and a tall window can give this slot a card-like shape.
    const compactRow = layout.compactPlayerRow === true;
    if (zones.me && compactRow) drawCompactIdentity(ctx, zones.me, model.me, this.#villainSeatNote);
    else if (zones.me) drawCharacter(ctx, zones.me, model.me, { shape: "wide", playerId: model.perspectiveId });
    // The facedown encounter cards dealt to you, tucked in the identity card's corner; after the panel, so the pile takes the pointer.
    if (zones.me) drawDealtPile(ctx, zones.me, compactRow ? "compact" : "wide", model.perspectiveId, model.myDealt);
    if (zones.playArea) drawPlayArea(ctx, zones.playArea, model, compactRow ? { compact: true } : {});
    if (zones.team) drawTeam(ctx, zones.team, model);
    if (zones.log && !logGate.locked) this.#frame.innerScroll.push(setAside?.log ?? zones.log);
    this.#rowWheelRect = zones.playArea && this.#playAreaScroll.row.canScroll ? zones.playArea : null;
    if (scrolling) {
      this.#drawScrollBands(layout);
      drawTopBand();
    } else {
      setTapOccluders(this, []);
    }
    drawHand(ctx, zones.hand!, model);
    drawActionBar(ctx, zones.actionBar!, model);
    this.#drawTargetingPanel(ctx, { x: 0, y: 0, width, height });
    const searchedPick = this.#controller.searchedPick();
    if (searchedPick) drawSearchedPickSheet(ctx, { x: 0, y: 0, width, height }, searchedPick);
    this.#drawTargetRings();
    this.#drawFocusRing();
    this.#drawFirstPlayerToken(model, layout);
    this.#revealTargets();
    // Turns the moves of a fresh state (if any landed) into travels, now that
    // this frame holds where every card ended up. A no-op on every other redraw.
    this.#motion.startTravels(previous, this.#frame, layout);
    // Last, so beats and traveling ghosts float above the table rather than
    // under a later panel.
    this.#motion.drawBeats(
      new Map([
        ...[...this.#frame.focusRects].flatMap(([key, chip]): [InstanceId, Rect][] =>
          key.startsWith("card:") ? [[key.slice(5) as InstanceId, chip]] : [],
        ),
        ...this.#frame.hitRects,
      ]),
    );
    this.#motion.renderTravels(this.#frame);
    // Held while the villain-phase walkthrough or the round debrief covers the table: the walkthrough stays up
    // into the next player phase until the player continues or skips it, and every round after the first the
    // ROUND N · PLAYER PHASE band used to spend itself behind it (owner report, 2026-09-29).
    //
    // Guided mode follow-up to G7c: the band is drawn at a depth above everything else in this scene
    // (`motion.ts#drawWipeBand`'s `setDepth(1150)`), including the guide rail's own panel — a plain depth-0
    // container, so add-order alone can't put the rail back on top of it. Left full-width, the band crossed
    // straight over the rail and hid whatever step copy was under it (found in browser verification: lesson 4's
    // "WHO TAKES THE HIT?" body, at the round-1 villain phase's own band). So on a rail form factor the band's
    // own area starts after the rail instead, the same inset `boardLayout` already gave every other zone.
    const bandArea: Rect = guideRail
      ? { x: guideRail.width, y: 0, width: width - guideRail.width, height }
      : { x: 0, y: 0, width, height };
    this.#motion.drawPhaseWipe(bandArea, () => this.#tableCoveredForBand());
    // Held back while an overlay covers the table, so it isn't spent unseen.
    this.#motion.drawBanners(
      { x: 0, y: 0, width, height },
      !this.#choiceOpen && !this.scene.isActive(SCENES.villainPhase),
      () => this.#draw(),
    );
    // Last of all, so the guide's spotlight/tag/panel sit above everything else this draw put on the table
    // (guided mode G5c, `scenes/board/guide-mount.ts`).
    this.#guide?.draw(layout, viewport);
    // The opportunistic-tip toast (guided mode G10e part 2) — after the guide's own lesson surface, so a step's
    // callout (when one happens to be up, though `#tipBlocked()` normally keeps a tip from arming at all then)
    // never sits under it.
    this.#tip?.draw(viewport, layout.tabbed, zones.actionBar, this.#tipBlocked());
    this.#syncGuideFocusRegion();
    this.#drawVillainReviewHandle(layout, viewport);
    this.#hover?.onDraw();
  }

  /**
   * Self-heals `#focusRegion` back to `"board"` the moment whichever guide surface owned keyboard/pad focus no
   * longer has anything focusable this frame (§3.10, §7 accessibility fix) — the tutorial stopped mid-focus, a
   * step's controls all disappeared, or a tip toast was dismissed by some other means. Without this, "G" would
   * silently do nothing (routed to a mount with no live widget to move focus on), and the board's own focus ring
   * would stay hidden with no way back short of a second, seemingly no-op "G" press.
   */
  #syncGuideFocusRegion(): void {
    if (this.#focusRegion !== "guide") return;
    const available =
      this.#guideFocusOwner === "guide"
        ? (this.#guide?.focusAvailable() ?? false)
        : this.#guideFocusOwner === "tip"
          ? (this.#tip?.focusAvailable() ?? false)
          : false;
    if (available) return;
    this.#guide?.exitFocus();
    this.#tip?.exitFocus();
    this.#focusRegion = "board";
    this.#guideFocusOwner = null;
    this.#drawFocusRing();
  }

  /** The first player token, on the first player's identity card (or the top bar while that card is on another tab). */
  #drawFirstPlayerToken(model: BoardModel, layout: BoardLayout): void {
    // On a phone the first player's card can be on another tab: the token then sits on that tab (Me or Team).
    const chrome = layout.zones.chrome;
    const tabs = layout.zones.tabs;
    const tabIds = PHONE_TABS.filter((tab) => tab !== "team" || model.team.length > 0);
    const holderTab = tabIds.indexOf(
      (this.#debugFirstPlayer ?? model.firstPlayerId) === model.perspectiveId ? "me" : "team",
    );
    const fallback: Rect =
      tabs && holderTab >= 0
        ? {
            x: tabs.x + ((holderTab + 1) * tabs.width) / tabIds.length - 22,
            y: tabs.y - 11,
            width: 24,
            height: 30,
          }
        : chrome
          ? { x: chrome.x + chrome.width * 0.5 - 20, y: chrome.y, width: 40, height: chrome.height }
          : { x: 8, y: 8, width: 40, height: 40 };
    this.#firstPlayerToken.draw(
      this,
      this.#debugFirstPlayer ?? model.firstPlayerId,
      (playerId) => {
        if (playerId === model.perspectiveId) return this.#frame.hitRects.get(model.me.instanceId) ?? null;
        const seat = model.team.find((row) => row.playerId === playerId);
        return seat ? (this.#frame.hitRects.get(seat.identityInstanceId) ?? null) : null;
      },
      fallback,
      this.#tokenCovered(),
    );
  }

  /**
   * Whether the token's pass should wait: while the villain phase replays its steps on the docked table (the engine has
   * already passed it; the replay shows it at its own last step), or while something covers the table outright.
   */
  #tokenCovered(): boolean {
    if (this.#villainReplay !== null) return true;
    const docked = this.#villainDock !== null && this.scene.isActive(SCENES.villainPhase);
    return !docked && this.#tableCoveredForBand();
  }

  #drawTabs(rect: Rect, model: BoardModel): void {
    this.#tabs = drawPhoneTabs(this, rect, model, {
      activeTab: this.#activeTab,
      badges: this.#tabBadges,
      logGate: this.#guide?.logGate() ?? { locked: false, reason: null },
      onSelect: (tab) => {
        if (tab !== this.#activeTab) this.#tableScroll = 0;
        this.#activeTab = tab;
        // Looking at a tab is what clears its badge.
        this.#tabBadges.delete(tab);
        this.#tabChanged.delete(tab);
        this.#draw();
      },
    });
  }

  /**
   * The targeting panel (docs/phase4-screen-gaps.md §3 "W5"): drawn over the whole table whenever the controller is
   * in target-select mode, so the "Choose a target" title bar, each option's outcome, "why not the others?" and the
   * tablet inspector rail sit over the same board a plain pulsing ring used to be the only affordance for.
   */
  #drawTargetingPanel(ctx: BoardDrawContext, viewport: Rect): void {
    const kind = this.#controller.selection.kind;
    // The same panel carries two more questions: which cards pay a cost with a range, and whose play area a card goes to.
    if (
      kind !== "targeting" &&
      kind !== "choosingInPlayCost" &&
      kind !== "choosingController" &&
      kind !== "dividingPower"
    ) {
      return;
    }
    const panel = this.#controller.targetingPanel();
    if (!panel) return;
    const focused = this.#focus?.kind === "card" ? this.#focus.instanceId : null;
    drawTargetingPanel(ctx, viewport, panel, this.#targetingHover, focused);
  }

  /** Pulsing rings on the valid targets while a target is being chosen. */
  /**
   * Where a card is on the table this draw: its own tile, or, for an attachment (Encased in Ice is a target of attacks),
   * the chip that stands for it on its host. Rings and damage numbers go here.
   */
  #cardRect(id: InstanceId): Rect | undefined {
    return this.#frame.hitRects.get(id) ?? this.#frame.focusRects.get(focusKey({ kind: "card", instanceId: id }));
  }

  #drawTargetRings(): void {
    for (const ring of this.#targetRings) {
      ring.destroy();
      const at = this.#frame.rings.indexOf(ring);
      if (at >= 0) this.#frame.rings.splice(at, 1);
    }
    this.#targetRings = [];
    const selection = this.#controller.selection;
    if (selection.kind !== "targeting") return;
    const reduced = appSession().settings.reducedMotion;
    for (const target of selection.action.targets) {
      const rect = this.#cardRect(target);
      if (!rect) continue;
      // A target scrolled under the chrome or the hand has no ring: it would be drawn over them.
      if (this.#hiddenByScroll(target, rect)) continue;
      const ring = new McSelectionRing(this);
      ring.show(rect, "pulse", reduced);
      this.#frame.rings.push(ring);
      this.#targetRings.push(ring);
    }
  }

  /** The schemes column or the play area row scrolled without a redraw: the rings that follow its cards follow them. */
  #refreshRings(): void {
    this.#drawTargetRings();
    this.#drawFocusRing();
  }

  /** What one `GamepadIntent` does, shared by the keyboard and gamepad bindings. */
  #actOnIntent(intent: GamepadIntent): void {
    switch (intent) {
      case "next":
        if (this.#focusRegion === "guide") this.#moveGuideFocus(1);
        else this.#moveFocus(1);
        break;
      case "previous":
        if (this.#focusRegion === "guide") this.#moveGuideFocus(-1);
        else this.#moveFocus(-1);
        break;
      case "up":
      case "down":
      case "left":
      case "right":
        // The guide surface is a short list of its own controls: the arrows step it like Tab does.
        if (this.#focusRegion === "guide") this.#moveGuideFocus(linearIntent(intent) === "next" ? 1 : -1);
        else this.#moveFocusToward(intent);
        break;
      case "activate":
        if (this.#focusRegion === "guide") this.#activateGuideFocus();
        else if (this.#focus) this.#controller.activate(this.#focus);
        break;
      case "inspect":
        if (this.#focus?.kind === "card") this.#inspect(this.#focus.instanceId);
        break;
      case "toggleGuide":
        this.#toggleGuideFocus();
        break;
      case "cancel":
        // Escape/B always releases a guided-mode gate first (§3.10, guided mode G4c, "no one should ever feel
        // locked into a tutorial") — checked ahead of everything below, since a gated step can be open at the same
        // time as an ordinary selection (paying, targeting) and Escape's release must win over `cancel()`'s own
        // "back out of the mode" behavior, not queue behind it.
        if (this.#controller.releaseGuideGate()) {
          // The gate's own `onGateReleased` (guided mode G5c, `guide/guide-controller.ts#onGateReleased`) mutates
          // the guide controller's state synchronously but triggers no redraw of its own — unlike
          // `BoardController#cancel()` below, which always redraws itself. Without this, Escape would release the
          // gate and skip the lesson, but the stale panel/spotlight from the step just skipped would sit on
          // screen until some *other* input happened to redraw the board (found in browser verification).
          this.#draw();
          break;
        }
        // A zone/choice-anchored step never sets a board gate at all (nothing to release above), but §3.10
        // still promises Escape always works there too — see `BoardGuideMount.handleEscape`'s own doc comment.
        if (this.#guide?.handleEscape()) break;
        // A visible tip toast dismisses on Escape, like its own "Got it" (guided mode G10e).
        if (this.#tip?.handleEscape()) break;
        // Escape/B backs out of a mode first, same as everywhere else in this
        // app; with no mode open, it's the keyboard/pad route to Pause
        // (docs/phase4-screen-gaps.md §3 "W4": "Escape when no mode/overlay is
        // open"). `binding.blocked()` already keeps this from firing while an
        // overlay owns input, so reaching here means the board itself is idle.
        if (this.#controller.selection.kind !== "idle") this.#controller.cancel();
        else this.#openPause();
        break;
    }
  }

  /** Opens Pause over the board — the MENU/≡ chrome button and Escape both land here. */
  #openPause(): void {
    if (this.scene.isActive(SCENES.pause)) return;
    this.scene.launch(SCENES.pause);
  }

  /**
   * "G"/pad-X (§3.10, §7 accessibility fix): moves keyboard/pad focus into whichever guide surface is showing
   * (the tutorial rail/callout first, else an opportunistic tip toast) and back out to the board. Prefers the
   * guide mount over the tip mount when both happen to have something focusable, though in practice the two never
   * both draw at once (`#tipBlocked()`). A press with nothing to focus on either surface is simply a no-op — the
   * board's own focus never moves, so there's nothing for the player to lose track of.
   */
  // A full redraw, not just the ring: the guide surface's own "Press G" hint shows only while it isn't focused.
  #toggleGuideFocus(): void {
    if (this.#focusRegion === "guide") {
      this.#guide?.exitFocus();
      this.#tip?.exitFocus();
      this.#focusRegion = "board";
      this.#guideFocusOwner = null;
      this.#draw();
      return;
    }
    if (this.#guide?.enterFocus()) {
      this.#focusRegion = "guide";
      this.#guideFocusOwner = "guide";
      this.#draw();
    } else if (this.#tip?.enterFocus()) {
      this.#focusRegion = "guide";
      this.#guideFocusOwner = "tip";
      this.#draw();
    }
  }

  #moveGuideFocus(direction: 1 | -1): void {
    if (this.#guideFocusOwner === "guide") this.#guide?.moveFocus(direction);
    else if (this.#guideFocusOwner === "tip") this.#tip?.moveFocus(direction);
  }

  #activateGuideFocus(): void {
    if (this.#guideFocusOwner === "guide") this.#guide?.activateFocused();
    else if (this.#guideFocusOwner === "tip") this.#tip?.activateFocused();
  }

  #moveFocus(delta: number): void {
    const order = this.#controller.focusOrder();
    const at = order.findIndex((target) => sameTarget(target, this.#focus));
    const next = stepFocus(order, at, delta);
    this.#setFocus(next >= 0 ? (order[next] ?? null) : null);
  }

  /** An arrow or D-pad press: the nearest focus stop drawn that way on the table (`view/spatial-nav.ts`). */
  #moveFocusToward(direction: FocusDirection): void {
    const order = this.#controller.focusOrder();
    const keys = order.map(focusKey);
    const current =
      this.#focus && order.some((target) => sameTarget(target, this.#focus)) ? focusKey(this.#focus) : null;
    const next = spatialStep(keys, (key) => this.#frame.focusRects.get(key), current, direction);
    this.#setFocus(next === null ? null : (order[keys.indexOf(next)] ?? null));
  }

  #setFocus(focus: FocusTarget | null): void {
    this.#focus = focus;
    // A greyed Undo says why while keyboard focus is on it (drawn by the next draw).
    this.#controller.setUndoFocus(this.#focus?.kind === "undo");
    this.#draw();
    this.#revealFocus();
  }

  /** True when a table card's rect is not wholly in the window the scrolling table is seen through (the hand and the targeting panel are never scrolled). */
  #hiddenByScroll(id: InstanceId, rect: Rect): boolean {
    const layout = this.#layout;
    if (!layout || layout.maxScroll <= 0) return false;
    if (this.#controller.targetingPanel() || this.#controller.searchedPick()) return false;
    if (this.#model?.hand.some((card) => card.instanceId === id)) return false;
    return !fullyInWindow(rect, layout.tableWindow);
  }

  /** Keyboard or pad focus moved onto a table card that is scrolled out of view: scroll it in. */
  #revealFocus(): void {
    const layout = this.#layout;
    const focus = this.#focus;
    if (!layout || layout.maxScroll <= 0 || focus?.kind !== "card" || this.#focusRegion !== "board") return;
    const rect = this.#frame.focusRects.get(focusKey(focus));
    if (!rect || !this.#hiddenByScroll(focus.instanceId, rect)) return;
    this.#scrollTableTo(revealScroll(layout.scrollY, rect, layout.tableWindow, layout.maxScroll));
  }

  /**
   * A target prompt opened with every target out of view (scrolled away on a scrolling table): scroll the first one in,
   * once per set of targets, the way the schemes column already does for its own rows.
   */
  #revealTargets(): void {
    const layout = this.#layout;
    const selection = this.#controller.selection;
    const key = selection.kind === "targeting" ? selection.action.targets.join(",") : null;
    if (key === this.#revealedTargets) return;
    this.#revealedTargets = key;
    if (key === null || !layout || layout.maxScroll <= 0 || selection.kind !== "targeting") return;
    const placed = selection.action.targets.flatMap((id) => {
      const rect = this.#cardRect(id);
      return rect ? [{ id, rect }] : [];
    });
    if (placed.length === 0 || placed.some(({ id, rect }) => !this.#hiddenByScroll(id, rect))) return;
    this.#scrollTableTo(revealScroll(layout.scrollY, placed[0]!.rect, layout.tableWindow, layout.maxScroll));
  }

  #scrollTableTo(next: number): void {
    const layout = this.#layout;
    if (!layout) return;
    const clamped = clampScroll(next, layout.maxScroll);
    if (clamped === layout.scrollY) return;
    this.#tableScroll = clamped;
    this.#scrollDirty = true;
  }

  /** Whether the table may take a wheel or a drag at `pointer`: it scrolls, nothing covers it, and no region of its own owns that spot. */
  #tableTakes(pointer: Phaser.Input.Pointer, wheel = false): boolean {
    const layout = this.#layout;
    if (!layout || layout.maxScroll <= 0) return false;
    const win = layout.tableWindow;
    if (pointer.x < win.x || pointer.x > win.x + win.width || pointer.y < win.y || pointer.y > win.y + win.height)
      return false;
    if (this.#choiceOpen || this.#overlayCoversTable()) return false;
    const own =
      wheel && this.#rowWheelRect ? [...this.#frame.innerScroll, this.#rowWheelRect] : this.#frame.innerScroll;
    return !own.some(
      (r) => pointer.x >= r.x && pointer.x <= r.x + r.width && pointer.y >= r.y && pointer.y <= r.y + r.height,
    );
  }

  /** Any overlay that owns the screen over the table. The docked villain phase leaves the table beside it live. */
  #overlayCoversTable(): boolean {
    const docked = this.#villainDock?.request === "rail";
    return (
      (this.scene.isActive(SCENES.villainPhase) && !docked) ||
      this.scene.isActive(SCENES.inspect) ||
      this.scene.isActive(SCENES.pause) ||
      this.scene.isActive(SCENES.rules) ||
      this.scene.isActive(SCENES.settings) ||
      this.scene.isActive(SCENES.roundDebrief) ||
      this.scene.isActive(SCENES.campaignBeat) ||
      this.scene.isActive(SCENES.teamUpSplash) ||
      this.scene.isActive(SCENES.teamUpInfo) ||
      this.scene.isActive(SCENES.evidence) ||
      this.scene.isActive(SCENES.pileView) ||
      this.scene.isActive(SCENES.holdOn)
    );
  }

  readonly #onTableWheel = (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void => {
    if (!this.#tableTakes(pointer, true)) return;
    const mode = (pointer.event as WheelEvent | undefined)?.deltaMode ?? 0;
    this.#scrollTableTo(this.#layout!.scrollY + wheelPixels(dy, mode));
  };

  readonly #onTableDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.wasTouch && this.#tableTakes(pointer)) this.#tableDrag.down(pointer.id, pointer.x, pointer.y);
  };

  readonly #onTableMove = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.isDown || !pointer.wasTouch) return;
    const delta = this.#tableDrag.move(pointer.id, pointer.x, pointer.y);
    if (delta !== 0 && this.#layout) this.#scrollTableTo(this.#layout.scrollY + delta);
  };

  readonly #onTableUp = (pointer: Phaser.Input.Pointer): void => this.#tableDrag.up(pointer.id);

  /**
   * The ground and the input shield of the pinned bands on a scrolling table: scrolled content passes under the chrome
   * (and the phone's tab row) above the window and the hand and action bar below it. Opaque, so nothing shows through,
   * and interactive, so nothing under them hears a press: Phaser's own hit test stops at the shield, and the tap router
   * is told the same (`setTapOccluders`). The pinned zones draw after this, on top.
   */
  #drawScrollBands(layout: BoardLayout): void {
    const { width, height } = this.scale.gameSize;
    const win = layout.tableWindow;
    const bottomY = win.y + win.height;
    const bands: Rect[] = [
      { x: 0, y: 0, width, height: win.y },
      { x: 0, y: bottomY, width, height: Math.max(0, height - bottomY) },
    ];
    for (const band of bands) {
      if (band.height <= 0) continue;
      this.add.graphics().fillStyle(surface.ink.hex, 1).fillRect(band.x, band.y, band.width, band.height);
      paintDotGrid(this, band, "ink", dotGrid.onInk);
      this.add.zone(band.x, band.y, band.width, band.height).setOrigin(0, 0).setInteractive();
    }
    setTapOccluders(this, bands);
  }

  #drawFocusRing(): void {
    this.#focusRing?.destroy();
    this.#focusRing = null;
    // While focus is in the guide region (§3.10, §7 fix), the board's own ring stays hidden — the guide/tip
    // widget draws its own ring (`McGuidePanel`/`McGuideCallout`/`McTipToast#focusAt`) so there is never a
    // visible ring on both surfaces at once.
    if (this.#focusRegion !== "board") return;
    const focus = this.#focus;
    if (!focus) return;
    // Focus that has fallen off the route (the card was played) is dropped
    // rather than drawn somewhere stale.
    if (!this.#controller.focusOrder().some((target) => sameTarget(target, focus))) {
      this.#focus = null;
      this.#controller.setUndoFocus(false);
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
  #makeTapTarget(
    rect: Rect,
    id: InstanceId,
    onTap?: () => void,
    drag?: RowDrag,
    onHover?: (over: boolean) => void,
    clip?: Rect,
  ): void {
    this.#frame.focusRects.set(focusKey({ kind: "card", instanceId: id }), rect);
    addTapTarget(this, rect, {
      onTap: () => {
        if (!this.#controller.tapInMode(id)) onTap?.();
      },
      onInspect: () => this.#inspect(id),
      onDrag: drag?.onDrag,
      onDragEnd: drag?.onDragEnd,
      key: id as string,
      onHover,
      clip,
    });
  }

  /** The scenario's printed rules cards (God of Lies' Shatter the Illusion), looked up once per game. */
  #referenceCardList: { readonly scenarioId: string | undefined; readonly cards: readonly ReferenceCardView[] } | null =
    null;

  #referenceCards(): readonly ReferenceCardView[] {
    const scenarioId = appSession().store.state.config?.scenarioId;
    const known = this.#referenceCardList;
    if (known && known.scenarioId === scenarioId) return known.cards;
    const cards = referenceCardViews(POOL_SCENARIOS.find((scenario) => scenario.id === scenarioId));
    this.#referenceCardList = { scenarioId, cards };
    return cards;
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

  /**
   * Fans the form cards beside the play area out, or folds them back (issue #308). The column widens or narrows over a
   * short tween, redrawing the table each frame so the play row slides over with it; reduced motion snaps.
   */
  #setFormFan(open: boolean): void {
    if (this.#formFanOpen === open) return;
    this.#formFanOpen = open;
    this.#formFanTween?.stop();
    this.#formFanTween = null;
    const target = open ? 1 : 0;
    if (appSession().settings.reducedMotion || !this.scene.isActive()) {
      this.#formFanT = target;
      this.#draw();
      return;
    }
    const from = this.#formFanT;
    this.#formFanTween = this.tweens.addCounter({
      from,
      to: target,
      duration: FORM_FAN_TWEEN_MS,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        this.#formFanT = tween.getValue() ?? target;
        this.#draw();
      },
      onComplete: () => {
        this.#formFanTween = null;
        this.#formFanT = target;
        this.#draw();
      },
    });
  }

  /** Fans a discard pile out in the pile overlay; an empty pile opens nothing. */
  #openPile(name: string, ids: readonly InstanceId[]): void {
    if (ids.length === 0 || this.scene.isActive(SCENES.pileView)) return;
    this.scene.launch(SCENES.pileView, { from: SCENES.board, name, ids } satisfies PileViewData);
  }

  #onInspectPlay(instanceId: InstanceId): void {
    void this.#controller.playCard(instanceId);
  }

  #onInspectUseAbility(instanceId: InstanceId, abilityId: AbilityId): void {
    this.#controller.useAbilityById(instanceId, abilityId);
  }

  /** "This card, this game" — read by the Inspect overlay (`scenes/inspect.ts#model`), which has no store of its own for it. */
  cardHistory(): CardHistoryLog {
    return this.#cardHistory;
  }

  /** The open payment, if any — read by the Inspect overlay to gate its "Use as resource" button and word "Right now" mid-payment. */
  paymentView(): PaymentView | null {
    return this.#controller.paymentView();
  }

  /** The open "Attack with" / "Thwart with" picker, if any — read by the guide to ring its suggested character. */
  sourceChoice(): SourceChoiceView | null {
    return this.#controller.sourceChoice();
  }

  /**
   * A read-only snapshot of what the last draw put on screen, for `view/guide-anchor.ts` to resolve a lesson
   * step's anchor against (guided mode G4c) — the same two maps `BoardDrawContext.frame` hands every zone module
   * (`scenes/board/context.ts`), reused rather than duplicated. `scenes/guide-spotlight-demo.ts` is the only
   * caller until G5c's guide controller exists.
   */
  guideAnchorFrame(): {
    readonly hitRects: ReadonlyMap<InstanceId, Rect>;
    readonly focusRects: ReadonlyMap<string, Rect>;
    readonly mainSchemeInstanceId: InstanceId | null;
  } {
    const game = appSession().store.state.game;
    return {
      hitRects: this.#frame.hitRects,
      focusRects: this.#frame.focusRects,
      mainSchemeInstanceId: game?.mainScheme.instanceId ?? null,
    };
  }

  /** This draw's own `BoardModel`, for guided mode's thwart-step threat preview (`scenes/board/guide-mount.ts`,
   * `docs/guided-mode.md` §5.1 tile D01) to read the live threat/THW/target numbers it draws from, rather than
   * re-deriving them from `GameState` a second time. `null` before the first draw. */
  guideBoardModel(): BoardModel | null {
    return this.#model;
  }

  /** The live main scheme's own on-screen rect this draw, for G9b's "Hold on!" overlay to anchor beside on a wide
   * viewport (`view/hold-on-model.ts#holdOnLayoutOf`) — null when it isn't resolvable (no game, or off the
   * active phone tab), which that layout treats as "fall back to the centered card". */
  #mainSchemeRect(): Rect | null {
    const id = appSession().store.state.game?.mainScheme.instanceId;
    return id ? (this.#frame.hitRects.get(id) ?? null) : null;
  }

  /** The live main scheme's own card name, for G9b's "Hold on!" overlay's threat-bar facts panel
   * (`view/hold-on-model.ts#holdOnContentOf`) — null when there's no game to read one from. */
  #mainSchemeName(): string | null {
    const game = appSession().store.state.game;
    if (!game) return null;
    return cardOf(game, game.mainScheme.instanceId)?.name ?? null;
  }

  /** True once the round/phase band and the villain-phase walkthrough have both cleared — guided mode G5c's
   * "delay the spotlight until the round/phase banner has cleared" (`docs/guided-mode.md` §4 G4c "For G5c"). The
   * guide controller polls this every redraw rather than the Board pushing a one-shot event, since a step can
   * become current while a banner is already mid-flight from something else entirely (a hero going down). */
  guideBannerClear(): boolean {
    return !this.scene.isActive(SCENES.villainPhase) && !this.#motion.isTransitioning();
  }

  #villainDock: { readonly request: VillainDockRequest; readonly width: number; readonly tall: boolean } | null = null;
  #villainSeatNote: VillainSeatNote | null = null;
  /** The dock as drawn this frame: `#villainDock` is where it is going, this is where an animated resize has got to. */
  #dockShown: { readonly width: number; readonly grow: number } = { width: 0, grow: 0 };
  #dockTween: Phaser.Tweens.Tween | null = null;
  #villainDockRects: VillainDockRects | null = null;

  /**
   * Lays the table out around the docked villain phase (`view/villain-dock.ts`), or back to the whole screen with
   * null. The phase asks for this; the Board redraws at once, so `villainDockRects` answers for the new shape when this
   * returns.
   */
  setVillainDock(
    request: VillainDockRequest | null,
    width: number = 0,
    options: { readonly tall?: boolean } = {},
  ): void {
    const current = this.#villainDock;
    const tall = request === "band" && options.tall === true;
    if (current?.request === request && (request !== "rail" || current.width === width) && current.tall === tall)
      return;
    if (!current && request === null) return;
    const from = this.#dockShown;
    this.#dockTween?.stop();
    this.#dockTween = null;
    this.#villainDock = request === null ? null : { request, width, tall };
    const to = { width, grow: tall ? 1 : 0 };
    // Only a change of size inside the same shape animates; a new shape, or none, snaps.
    const resize = current !== null && current.request === request && (request === "rail" || request === "band");
    if (!resize || appSession().settings.reducedMotion || !this.scene.isActive()) {
      this.#dockShown = to;
      this.#draw();
      this.events.emit(VILLAIN_DOCK_CHANGED, this.#villainDockRects);
      return;
    }
    const step = (t: number): void => {
      this.#dockShown = {
        width: Math.round(from.width + (to.width - from.width) * t),
        grow: from.grow + (to.grow - from.grow) * t,
      };
      this.#draw();
      this.events.emit(VILLAIN_DOCK_CHANGED, this.#villainDockRects);
    };
    this.#dockTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: VILLAIN_DOCK_TWEEN_MS,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => step(tween.getValue() ?? 1),
      onComplete: () => {
        this.#dockTween = null;
        step(1);
      },
    });
  }

  /**
   * What the compact identity panel says while the band is tall (TB1): a status tag beside the hero's name and the HP
   * bar's projected range. Null clears it. Only drawn while `setVillainDock("band", _, { tall: true })` is in force.
   */
  setVillainSeatNote(note: VillainSeatNote | null): void {
    if (sameSeatNote(this.#villainSeatNote, note)) return;
    this.#villainSeatNote = note;
    if (this.#layout?.compactPlayerRow) this.#draw();
  }

  /** The villain phase is replaying (not a review): its table chrome while it is behind the engine, null once it has caught up. */
  #villainReplay: { readonly hold: TableHold | null } | null = null;
  /** The game ended while the villain phase was still replaying; Game Over waits for `releaseOutcome`. */
  #outcomeHeld = false;

  /**
   * While the villain phase replays, the engine has already run to its end: the table would show the next round and
   * "Your turn". Told by the phase, the table keeps the villain phase's round and step in its chrome while the rail is
   * behind, and has no End turn or Undo until the phase closes. Null when no replay is open.
   */
  setVillainReplay(replay: { readonly hold: TableHold | null } | null): void {
    const was = this.#villainReplay;
    const same =
      (was === null) === (replay === null) &&
      was?.hold?.round === replay?.hold?.round &&
      was?.hold?.stepLabel === replay?.hold?.stepLabel &&
      sameFacedown(was?.hold, replay?.hold) &&
      (was?.hold === null) === (replay?.hold === null);
    if (same) return;
    this.#villainReplay = replay;
    this.#draw();
  }

  /**
   * The log as it stood when the villain phase being replayed began. The engine has logged the whole phase already
   * ("You revealed Eviction Notice."), so while the rail is behind, the table's log waits where the phase began and the
   * rail's own phase log tells the phase (issue #311). Null when no phase has begun since the table opened.
   */
  #logBeforePhase: LogState | null = null;

  /** The log the table shows: the live one, or the one from before the phase while the rail is behind the engine. */
  #tableLog(): LogState {
    return this.#villainReplay?.hold && this.#logBeforePhase ? this.#logBeforePhase : this.#log;
  }

  #heldModelCache: { readonly base: BoardModel; readonly key: string; readonly model: BoardModel } | null = null;

  /**
   * The model the table draws: the live one, or while the villain phase replays, one with the encounter cards the rail
   * has not revealed yet back in their facedown piles (`withFacedownHeld`, issue #311).
   */
  #heldModel(hold: TableHold | null): BoardModel | null {
    const live = this.#model;
    const facedown = hold?.facedown;
    const state = appSession().store.state;
    if (!live || !facedown || !state.game || state.perspectiveId === null) return live;
    const key = facedown.map((card) => card.instanceId).join();
    const cached = this.#heldModelCache;
    if (cached && cached.base === live && cached.key === key) return cached.model;
    const model = this.#withDebugSideSchemes(
      boardModel(withFacedownHeld(state.game, facedown), state.perspectiveId, POOL_DEPS),
    );
    this.#heldModelCache = { base: live, key, model };
    return model;
  }

  /** Whether a villain phase replay is (or is about to be) open over this game, so its outcome should wait. */
  #villainReplayHoldsOutcome(): boolean {
    if (this.#walkthroughLaunching) return true;
    if (!this.scene.isActive(SCENES.villainPhase)) return false;
    return !(this.scene.get(SCENES.villainPhase) as VillainPhaseOverlay).isReview();
  }

  /** The villain phase has shown everything (or closed): the held Game Over can come up. */
  releaseOutcome(): void {
    if (!this.#outcomeHeld) return;
    this.#outcomeHeld = false;
    if (appSession().store.state.game?.outcome) goToScreen(this, SCENES.gameOver);
  }

  #villainHandTags: ReadonlyMap<InstanceId, VillainHandTag> | null = null;

  /**
   * While the villain phase is open, docked beside the table or not, the table takes no game action (the owner,
   * 2026-10-14: a hand card played beside the docked phase while it was still stepping through the round's
   * encounter cards). The engine may already be in the next player phase, but the player has not started it yet:
   * Start player phase (or Skip) closes the phase and gives the table back. Inspect and the hover popover still work;
   * decisions are answered on the phase or its sheet, never through the board.
   */
  setVillainPhaseOpen(open: boolean): void {
    this.#controller.setReadOnly(open);
  }

  /**
   * The last villain phase, tucked away (the owner's request, 2026-10-14): through the next player phase a drawer
   * handle on the table's right edge reopens its recap for review (`view/villain-review.ts`). Hidden while any
   * decision or the villain phase itself is up.
   */
  #drawVillainReviewHandle(layout: BoardLayout, viewport: Rect): void {
    if (!this.#reviewHandleShown()) return;
    const review = appSession().villainReview;
    // Level with the play area (the owner, 2026-10-14), else between the chrome and the hand.
    const chrome = layout.zones.chrome;
    const play = layout.zones.playArea;
    const top = play ? play.y : chrome ? chrome.y + chrome.height : viewport.y;
    const bottom = play ? play.y + play.height : (layout.zones.hand?.y ?? viewport.y + viewport.height);
    const rect = reviewHandleRect(viewport, top, bottom);
    const g = this.add.graphics().setDepth(HANDLE_DEPTH);
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, accent.heroRed.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width, rect.height - 2);
    const handleLabel = this.add
      .text(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        `◂ ROUND ${review!.round} VILLAIN PHASE`,
        textStyle({ ...typeRole.label, size: 13 }, surface.paper.hex),
      )
      .setOrigin(0.5)
      .setAngle(-90)
      .setDepth(HANDLE_DEPTH);
    // Turned on its side, its length runs along the handle's height.
    fitText(handleLabel, rect.height - 16, 13);
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(HANDLE_DEPTH);
    // A tap, not any release over it: a sideways swipe of the play area that lifted on the handle opened the recap (#227).
    onTap(
      zone,
      () => {
        if (this.scene.isActive(SCENES.villainPhase)) return;
        this.scene.launch(SCENES.villainPhase, { before: null, review: review! } satisfies VillainPhaseLaunchData);
      },
      "villain-review",
    );
    this.#frame.focusRects.set("villain-review", rect);
  }

  /** Whether the review handle is drawn this frame: the layout keeps a phone's play area out from under it. */
  #reviewHandleShown(): boolean {
    const game = appSession().store.state.game ?? null;
    if (!showReviewHandle(appSession().villainReview, game) || this.#choiceOpen) return false;
    return !this.scene.isActive(SCENES.villainPhase) && !this.scene.isActive(SCENES.inspect);
  }

  /**
   * The villain phase's hand tags (PLAY NOW, WHEN HIT, …; `view/villain-hand-tags.ts`), or null to go back to the
   * hand's own tags. The phase sets them while the hand is in view beside it; the Board redraws when they change.
   */
  setVillainHandTags(tags: ReadonlyMap<InstanceId, VillainHandTag> | null): void {
    if (sameHandTags(this.#villainHandTags, tags)) return;
    this.#villainHandTags = tags;
    this.#draw();
  }

  /** Where the docked villain phase draws, as of the Board's last draw; null when it is not docked. */
  villainDockRects(): VillainDockRects | null {
    return this.#villainDockRects;
  }

  /** Which phone tab is showing right now — off phone this is meaningless, but always some value (`view/layout.ts`'s own `boardLayout` treats `activeTab` the same way). */
  activeTabName(): PhoneTab {
    return this.#activeTab;
  }

  /** Switches the active phone tab programmatically — the guide's own auto-switch (guided mode G5c part 2,
   * `docs/guided-mode.md` §4 G5c "Auto-switch the tab"), which needs the same effect `#drawTabs`' own `onSelect`
   * already has (clear that tab's badge, then a full redraw so the newly-active tab's zones actually appear) but
   * from outside a pointer event, where `#drawTabs` keeps its handler private. A no-op already on `tab`. */
  switchToTab(tab: PhoneTab): void {
    if (this.#activeTab === tab) return;
    this.#activeTab = tab;
    this.#tabBadges.delete(tab);
    this.#tabChanged.delete(tab);
    this.#draw();
  }

  /**
   * Scrolls the sideways hand until `rect` (a card as last drawn) is wholly on screen, then redraws so the guide's
   * ring lands on it. Returns false when the hand cannot scroll (nothing to do). The caller does this once per step.
   */
  guideRevealInHand(rect: Rect): boolean {
    if (!this.#hand.canScroll) return false;
    this.#hand.scrollIntoView(rect);
    this.#draw();
    return true;
  }

  /** The perspective player id for `resolveAnchor`'s `instanceOfCode` — null with no game running. */
  perspectivePlayerId(): SessionState["perspectiveId"] {
    return appSession().store.state.perspectiveId;
  }

  /** Sets (or clears, with `null`) the active lesson step's soft input gate (G4c) — forwarded straight to the
   * controller (`scenes/board/guide-gate.ts`). */
  setGuideGate(gate: GuideGate | null): void {
    this.#controller.setGuideGate(gate);
  }

  /** Escape's own release (G4c) — forwarded straight to the controller. Returns whether a gate was actually open. */
  releaseGuideGate(): boolean {
    return this.#controller.releaseGuideGate();
  }

  /** Requests a full board redraw — the guide mount's own button callbacks (Back/Skip/primary/Collapse/Stop) call
   * this the same shape `BoardController`'s own `redraw` callback already uses: a guide state change (a new step,
   * the rail collapsing) needs the whole table relaid out, not just the guide's own widgets redrawn. */
  requestGuideRedraw(): void {
    this.#draw();
  }

  /** True while a guided run is actually showing on this board (§3.10, G5c part 3) — Pause's own "Stop tutorial"
   * and "Turn guide off" entries stay hidden without this: `appSession().guidedRun` alone isn't enough, since it
   * stays true even after "Stop tutorial" already ran once this game (`session.ts`'s own doc comment on why that
   * flag doesn't clear itself). `#guide` only exists at all for a guided run (`#syncGuide`), so a live one that
   * hasn't stopped itself is exactly "active". */
  guidedRunActive(): boolean {
    return this.#guide !== null && !this.#guide.stopped;
  }

  /** The guide rail's own width, reserved on the left, for a scene launched *above* this one to leave clear
   * beside it (guided mode G7c: the villain-phase walkthrough and the defend choice sheet both cover the whole
   * canvas otherwise, hiding the rail and lesson 4's copy along with it — `docs/guided-mode.md` §4 "Left for
   * G7"). `null` off desktop/tablet landscape, or once no guided run is showing — mirrors `#guide.railOptionFor`'s
   * own contract, read fresh against the live scale since the caller isn't the one laying the board out this
   * frame. */
  guideRailWidth(): number | null {
    const { width, height } = this.scale.gameSize;
    const rail = this.#guide?.railOptionFor({ x: 0, y: 0, width, height });
    return rail ? rail.width : null;
  }

  /** The compact bottom guide strip's own content (guided mode G7c), for a scene launched above this one on a
   * tabbed layout to draw inside its own overlay rather than covering the callout entirely — see
   * `BoardGuideMount.stripContent`'s own doc comment. `null` off a guided run, same as `guideRailWidth`. */
  guideStripContent(): GuideStripContent | null {
    return this.#guide?.stripContent() ?? null;
  }

  /** Inspect's own compact guide strip content (guided mode G7b, `docs/guided-mode.md` §4 "Left for G7") — see
   * `BoardGuideMount.inspectStripContent`'s own doc comment for why this is the step's `doThis`, not `stripText`
   * like `guideStripContent` above. `null` off a guided run, same as `guideStripContent`. */
  inspectStripContent(): { readonly text: string; readonly onSkip: () => void; readonly onStop: () => void } | null {
    return this.#guide?.inspectStripContent() ?? null;
  }

  /** "Stop tutorial" from Pause (§3.10, G5c part 3): the same path the guide panel/callout's own Stop already
   * takes (`BoardGuideMount.stop`), just reachable from outside the board's own button wiring. A no-op with no
   * guide mounted. */
  stopGuide(): void {
    this.#guide?.stop();
  }

  /**
   * The log moments Pause's "Jump to a moment" can rewind to, by log line id: for each point Undo could reach this
   * turn (`BoardController.undoTargets`), the last line the log had at that point. Going back to it is pressing Undo
   * that many times. A point whose log is not on record (from before a reload), or whose last line is the newest
   * line now, is left out; two points that end on the same line keep the nearer one.
   */
  undoMoments(): ReadonlyMap<string, number> {
    const moments = new Map<string, number>();
    const newest = this.#log.lines.at(-1)?.id;
    for (const target of this.#controller.undoTargets()) {
      const line = this.#logAt.get(target)?.log.lines.at(-1);
      if (!line || line.id === newest || moments.has(line.id)) continue;
      moments.set(line.id, target);
    }
    return moments;
  }

  /** Rewinds to one of `undoMoments`' points, as repeated Undo would. */
  undoTo(target: number): Promise<boolean> {
    return this.#controller.undoTo(target);
  }

  /** Spends `id` for the payment currently open, if it's one of its sources. See `BoardController#payWithCard`'s own comment. */
  payWithCard(id: InstanceId): boolean {
    return this.#controller.payWithCard(id);
  }
}
