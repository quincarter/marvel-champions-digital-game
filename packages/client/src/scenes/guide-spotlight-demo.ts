/**
 * Dev-only keyboard demo for `McGuideSpotlight`/`McGuideTag`/the soft input gate (guided mode G4c,
 * `docs/guided-mode.md` §4): `?screen=board&guidedemo=1` starts G5a's `TUTORIAL_CONFIG` game and launches this
 * scene over the live Board, then → / Space cycles the spotlight and tag over four of the tutorial's own anchors —
 * the main scheme, the Flip button, Black Cat in hand, and Thwart — so the spotlight/tag/anchor-resolution/gating
 * path is screenshottable and click-testable well ahead of G5c's actual lesson controller existing. ← cycles back.
 *
 * The action/card steps also set a real `GuideGate` on the live Board controller (`BoardScene.setGuideGate`), so a
 * real pointer click away from the taught control is genuinely inert, a click on it genuinely works, two inert
 * clicks lift the gate on their own, and Escape releases it — all through the actual input path a real lesson step
 * will use, not a mocked one. The zone step (the main scheme) sets no gate: there's no single control to teach
 * there, matching `guide/tutorial-lessons.ts`'s own `"villain-phase-order"`/`"spotlight-scheme"` steps, which are
 * `"acknowledge"` mode with nothing to tap.
 *
 * This scene owns none of the guide's real state: it reads the live store and Board's own frame
 * (`BoardScene.guideAnchorFrame()`) each redraw and calls `resolveAnchor` fresh — the same shape G5c's controller
 * will use, minus the lesson model driving which step is current.
 */
import Phaser from "phaser";
import { cardId } from "@mc/content";
import type { GameState, PlayerId } from "@mc/engine";
import { appSession } from "../session.js";
import { McGuideSpotlight } from "../ui/guide-spotlight.js";
import { McGuideTag, type McGuideTagVariant } from "../ui/guide-tag.js";
import { ACTION_TO_BASIC, instanceOfCode, resolveAnchor } from "../view/guide-anchor.js";
import type { LessonAnchor } from "../view/lesson-model.js";
import type { BoardScene } from "./board.js";
import type { GuideGate } from "./board/guide-gate.js";
import { SCENES } from "./keys.js";

const BLACK_CAT = cardId("01002");

const DEMO_STEPS: readonly { readonly anchor: LessonAnchor; readonly tag: McGuideTagVariant }[] = [
  { anchor: { kind: "zone", id: "mainScheme" }, tag: "tryThis" },
  { anchor: { kind: "action", id: "flip" }, tag: "tryThis" },
  { anchor: { kind: "card", code: BLACK_CAT }, tag: "tryThis" },
  { anchor: { kind: "action", id: "thwart" }, tag: "guidePick" },
];

export class GuideSpotlightDemoScene extends Phaser.Scene {
  #index = 0;
  /** Set by this step's own `onGateReleased`/`onGateEscaped` (Escape, or two inert clicks) — `#reposition` stops
   * redrawing the spotlight once this is true, so the per-frame reposition (needed for a phone tab switch to keep
   * the ring in sync) doesn't fight the hide with the very next frame. Cleared on the next step change. */
  #dismissed = false;
  #spotlight: McGuideSpotlight | null = null;
  #tag: McGuideTag | null = null;

  constructor() {
    super(SCENES.guideSpotlightDemo);
  }

  create(): void {
    this.#spotlight = new McGuideSpotlight(this);
    this.#tag = new McGuideTag(this);

    const step = (delta: number): void => {
      this.#index = (this.#index + delta + DEMO_STEPS.length) % DEMO_STEPS.length;
      this.#applyStep();
    };
    const keyboard = this.input.keyboard;
    keyboard?.on("keydown-RIGHT", () => step(1));
    keyboard?.on("keydown-SPACE", () => step(1));
    keyboard?.on("keydown-LEFT", () => step(-1));
    // A fallback hide for the zone step, which sets no gate for Board's own Escape handling to release (there's
    // nothing to release) — every other step's real release already comes through `onGateReleased` below, via
    // Board's own keyboard binding, which runs independently of this one.
    keyboard?.on("keydown-ESC", () => {
      this.#dismissed = true;
      this.#hide();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#board()?.setGuideGate(null);
      this.#spotlight?.destroy();
      this.#tag?.destroy();
    });

    this.#applyStep();
  }

  /**
   * Repositions every frame rather than only on resize/step-change, so the ring keeps following its target through
   * anything that moves it without this scene wiring up every one of Board's own redraw triggers — a hand reflow,
   * and (the thing the real spotlight most needs to survive) a phone tab switch, which Board's own tab rail handles
   * entirely inside itself. Cheap: `#reposition` is a plain map lookup and a couple of graphics calls, no different
   * from what `BoardScene#draw` already repaints every redraw.
   */
  override update(): void {
    this.#reposition();
  }

  #board(): BoardScene | undefined {
    return this.scene.get(SCENES.board) as BoardScene | undefined;
  }

  #hide(): void {
    this.#spotlight?.hide();
    this.#tag?.hide();
  }

  /** A step change: sets this step's own gate (resetting any inert-click count the previous step left behind —
   * `GuideGateHolder.set` does this on purpose, a fresh step is two fresh strikes), then draws it. */
  #applyStep(): void {
    const board = this.#board();
    const state = appSession().store.state;
    const perspectiveId = board?.perspectivePlayerId() ?? null;
    if (!board || !state.game || perspectiveId === null) return;

    this.#dismissed = false;
    const step = DEMO_STEPS[this.#index]!;
    board.setGuideGate(this.#gateFor(step.anchor, state.game, perspectiveId));
    this.#reposition();
  }

  /** No gate for a zone step (nothing to tap there); the taught action/card, and only it, for the other kinds. */
  #gateFor(anchor: LessonAnchor, game: GameState, perspectiveId: PlayerId): GuideGate | null {
    const onDismiss = (): void => {
      this.#dismissed = true;
      this.#hide();
    };
    const onGateReleased = onDismiss;
    const onGateEscaped = onDismiss;
    if (anchor.kind === "action") {
      return { actions: new Set([ACTION_TO_BASIC[anchor.id]]), cards: new Set(), onGateReleased, onGateEscaped };
    }
    if (anchor.kind === "card") {
      const instanceId = instanceOfCode(game, perspectiveId, anchor.code);
      if (!instanceId) return null;
      return { actions: new Set(), cards: new Set([instanceId]), onGateReleased, onGateEscaped };
    }
    return null;
  }

  /** Redraws the spotlight/tag at the current step's anchor. Never touches the gate — a resize mid-step must not
   * reset the inert-click count a player is partway through racking up. */
  #reposition(): void {
    if (this.#dismissed) return;
    const board = this.#board();
    const state = appSession().store.state;
    const perspectiveId = board?.perspectivePlayerId() ?? null;
    if (!board || !state.game || perspectiveId === null) {
      this.#hide();
      return;
    }

    const frame = board.guideAnchorFrame();
    const { width, height } = this.scale.gameSize;
    const step = DEMO_STEPS[this.#index]!;
    const resolved = resolveAnchor(
      step.anchor,
      { x: 0, y: 0, width, height },
      { playerCount: state.game.players.length, activeTab: board.activeTabName() },
      {
        cardRects: frame.hitRects,
        focusRects: frame.focusRects,
        instanceOfCode: (code) => instanceOfCode(state.game!, perspectiveId, code),
      },
    );
    if (!resolved) {
      this.#hide();
      return;
    }
    // `resolved.tab` names the tab the target actually lives behind — resolved even when it isn't the one showing,
    // so a real caller can switch to it (G5c's job, not this demo's: see the module header). Drawing the ring at
    // that rect over whatever tab happens to be showing right now would land it on the *wrong tab's* content — a
    // real bug this demo caught (phone, the zone step, `me` showing while `mainScheme` resolved for `threat`) —
    // so this hides instead until the tab actually matches, exactly like the "not currently visible" case above.
    if (resolved.tab !== null && resolved.tab !== board.activeTabName()) {
      this.#hide();
      return;
    }
    this.#spotlight?.show({ x: 0, y: 0, width, height }, resolved.rect);
    this.#tag?.setVariant(step.tag);
    this.#tag?.update(resolved.rect);
  }
}
