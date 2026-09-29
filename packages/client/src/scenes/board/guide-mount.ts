/**
 * The guide's thin Phaser adapter for the Board (guided mode G5c part 1, `docs/guided-mode.md` §4): mounts
 * `GuideController` (`guide/guide-controller.ts`, pure) onto a live game, and turns its `view()` snapshot into
 * `McGuidePanel`/`McGuideSpotlight`/`McGuideTag` draws plus the board's own soft input gate
 * (`scenes/board/guide-gate.ts`). Desktop and tablet-landscape only in this part — the phone callout path and its
 * tab auto-switch are G5c part 2.
 *
 * **Gate discipline**: `BoardScene.setGuideGate` is only ever called from `#syncGate`, and only when the current
 * step's own id actually changed — never on a plain redraw — per `docs/guided-mode.md` §4 G4c "For G5c": "set the
 * gate only on a step change, never per redraw" (a fresh `GuideGateHolder.set` resets the two-inert-clicks counter,
 * so calling it every frame would make the soft gate impossible to escape by clicking through it).
 *
 * **Banner discipline**: the spotlight/tag are held back while `BoardScene#guideBannerClear()` is false — the
 * round/phase band, or the villain-phase walkthrough overlay, is covering (or about to cover) the very thing being
 * taught (`docs/guided-mode.md` §4 G4c "For G5c": "delay the spotlight until the round/phase banner has cleared").
 * The panel itself is not held back: its rail sits beside the table, not over it, so there's nothing for the band
 * to collide with.
 *
 * **The defend-choice anchor is a known, deliberate special case, in two ways.** First, a `LessonAnchor` names
 * *what's being taught*, not *which of several open options* — the sheet can offer "No defense" alongside one or
 * more defenders, so lesson 4's own `{ kind: "choice", id: "defend" }` (`guide/tutorial-lessons.ts`) can't say
 * "Black Cat" on its own; this module names her card directly (`BLACK_CAT`) via `#syncChoicePick`. A later aspect
 * lesson with its own defend step (G10d) will need a real per-step way to name "which option" — a `LessonStep`
 * field, most likely — rather than a second hardcoded card here. Second, the `GUIDE PICK` stamp itself is drawn
 * by `ChoiceOverlay`, not by this module's own `McGuideSpotlight`/`McGuideTag` — see `#drawSpotlight`'s own
 * comment for why (a later-launched scene renders above Board, so a tag added to Board's own display list would
 * sit *underneath* the choice sheet's scrim).
 *
 * **Every Phaser widget here is rebuilt fresh on every `draw()` call, never held across redraws.** `BoardScene#draw`
 * empties its *entire* display list every single redraw (`ui/destroy-children.ts`'s own header: "what every
 * scene's redraw means by 'start from a blank screen'"), the same way every other Board zone module works
 * (`scenes/board/log.ts`'s `LogPanel.draw(scene, rect, …)` is the same shape). `McGuidePanel`/`McGuideSpotlight`/
 * `McGuideTag` were written assuming a persistent host scene that only they redraw (their own demo scenes:
 * `scenes/guide-panel-demo.ts` et al.) — holding one as a `BoardGuideMount` field and calling `.update()` on it
 * across draws crashes the moment a later `destroyChildren(this)` has already destroyed its container out from
 * under it (found in browser verification: "Cannot read properties of undefined (reading 'sys')" the first time a
 * board redraw fired after the panel first drew). So this module keeps only *plain state* across draws
 * (`#collapsed`, the controller itself) and constructs a fresh widget instance inside `draw()` whenever one needs
 * to appear this frame — cheap, and consistent with how every other Board widget already survives this scene's
 * own redraw discipline.
 */
import { cardId } from "@mc/content";
import type { BoardScene } from "../board.js";
import type { ChoiceOverlay } from "../choice.js";
import { SCENES } from "../keys.js";
import { GuideController, type GuideControllerOptions } from "../../guide/guide-controller.js";
import { McGuidePanel } from "../../ui/guide-panel.js";
import { McGuideSpotlight } from "../../ui/guide-spotlight.js";
import { McGuideTag } from "../../ui/guide-tag.js";
import { GUIDE_PANEL_COLLAPSED_WIDTH, guideRailWidthFor } from "../../view/guide-panel-model.js";
import { instanceOfCode, resolveAnchor, type AnchorFrame } from "../../view/guide-anchor.js";
import { formFactorFor, type BoardLayout, type Rect } from "../../view/layout.js";
import type { LessonObservation } from "../../view/lesson-model.js";

const RAIL_FORM_FACTORS: ReadonlySet<string> = new Set(["desktop", "tabletLandscape"]);
const BLACK_CAT = cardId("01002");

export class BoardGuideMount {
  readonly #scene: BoardScene;
  readonly #controller: GuideController;
  #observation: LessonObservation;
  #collapsed = false;
  #lastGateStepId: string | null = null;
  /** This frame's panel, if one was drawn — kept only so a headless click-through can reach its rects
   * (`debugPanelRects`); never read to decide what to draw next frame (that's `#collapsed`, plain state). */
  #lastPanel: McGuidePanel | null = null;
  /** `BoardScene#guideBannerClear()` as of the last `pollBanner` call — see that method's own doc comment. */
  #lastBannerClear = true;

  constructor(scene: BoardScene, options: GuideControllerOptions, observation: LessonObservation) {
    this.#scene = scene;
    this.#observation = observation;
    this.#controller = new GuideController(options, observation);
  }

  /** Feeds a fresh store observation to the controller — call on every `BoardScene#onState`. */
  onObservation(observation: LessonObservation): void {
    this.#observation = observation;
    this.#controller.onObservation(observation);
  }

  /**
   * Escape's own release for a step with **no board gate at all** — a zone or choice anchor never sets one
   * (`guide/guide-controller.ts#gateFor`'s own doc comment: nothing to tap for "look at the main scheme", and
   * the choice sheet already owns input while it's open), so `BoardController.releaseGuideGate()` has nothing to
   * release and returns `false` for those steps. §3.10 ("Escape always works") applies to *every* guide surface,
   * not only a gated one, so the board's own Escape route (`BoardScene#actOnIntent`'s `"cancel"` case) falls
   * back to this whenever `releaseGuideGate()` didn't handle it. Returns whether there was anything to skip, so
   * the caller knows whether to fall through to its own cancel/Pause behavior.
   */
  handleEscape(): boolean {
    if (this.#controller.stopped || !this.#controller.view().active) return false;
    this.#controller.onGateReleased();
    this.#scene.requestGuideRedraw();
    return true;
  }

  /**
   * Call every frame (`BoardScene#update`, which already runs every frame for the hand's own flick) so the
   * spotlight/tag actually appear the moment a round/phase band or the villain-phase walkthrough clears on its
   * own timer, not only on the next store update. Without this, a step whose gate became clear while nothing was
   * dispatching (the common case: the band is a purely client-side animation with its own clock, not a reaction
   * to a command) would wait for the *next* unrelated redraw to ever show its spotlight — found in browser
   * verification: lesson 5's "Thwart it" step never got its ring until some other input happened to redraw the
   * board. Requests a redraw only on the false→true edge, never every frame, so this stays as cheap as the
   * `BoardScene#guideBannerClear()` check itself.
   */
  pollBanner(): void {
    if (this.#controller.stopped) return;
    const clear = this.#scene.guideBannerClear();
    if (clear && !this.#lastBannerClear) this.#scene.requestGuideRedraw();
    this.#lastBannerClear = clear;
  }

  /** True once "Stop tutorial" has been pressed — the host keeps calling `draw()` (a no-op past this point: `view()`
   * always reports `active: false`), it just never has to construct a fresh mount again. */
  get stopped(): boolean {
    return this.#controller.stopped;
  }

  /** Headless click-through hook only (never referenced by product code, JSON-safe): the current step's own id,
   * or `null` with nothing current — mirrors every other `?screen=…demo` scene's own `__mc*Debug` accessor. */
  debugStepId(): string | null {
    return this.#controller.view().step?.id ?? null;
  }

  /** Headless click-through hook only: the panel's own nudge line, or `null` when none is armed. */
  debugNudge(): string | null {
    return this.#controller.view().panel?.nudge ?? null;
  }

  /** Debug-only: this frame's panel rects, for a headless script to click a real screen coordinate. `null` when
   * no panel drew this frame (off rail form factors, or nothing current). */
  debugPanelRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } | null {
    return this.#lastPanel?.debugRects() ?? null;
  }

  /** The guide rail's own width to reserve in this frame's `boardLayout` call, or `null` off desktop/tablet
   * landscape, or once the guide has stopped — `BoardScene#draw` reads this *before* laying out the rest of the
   * table, so nothing the rail covers is also a drop target underneath it. */
  railOptionFor(viewport: Rect): { readonly side: "left"; readonly width: number } | null {
    if (this.#controller.stopped) return null;
    const formFactor = formFactorFor(viewport.width, viewport.height);
    if (!RAIL_FORM_FACTORS.has(formFactor)) return null;
    const width = this.#collapsed ? GUIDE_PANEL_COLLAPSED_WIDTH : guideRailWidthFor(viewport.width, formFactor);
    return { side: "left", width };
  }

  /**
   * Draws the panel, spotlight and tag for this frame (each a fresh instance — see this module's own header),
   * and syncs the board's own gate. `layout` is the very `BoardLayout` `BoardScene#draw` already built this
   * frame — `railOptionFor` told it how wide to leave this rail, so this only ever draws inside that reserved
   * space. Call *after* every zone has drawn (schemes, action bar, hand, …), since resolving a card/action
   * anchor reads the hit rects those draws just registered, and *before* `destroyChildren` runs again (i.e. once
   * per `BoardScene#draw`, same as everything else on the table).
   */
  draw(layout: BoardLayout, viewport: Rect): void {
    const view = this.#controller.view();
    this.#syncGate(view.step?.id ?? null, view.gate);
    this.#lastPanel = null;

    const formFactor = formFactorFor(viewport.width, viewport.height);
    const onRail = RAIL_FORM_FACTORS.has(formFactor);
    if (onRail && view.active && view.panel) {
      const panel = new McGuidePanel(this.#scene, {
        side: "left",
        onBack: () => this.#act(() => this.#controller.back()),
        onPrimary: () => this.#act(() => this.#controller.primary()),
        onSkip: () => this.#act(() => this.#controller.skip()),
        onStop: () => this.#stop(),
        onCollapse: () => this.#act(() => (this.#collapsed = true)),
        onExpand: () => this.#act(() => (this.#collapsed = false)),
      });
      if (this.#collapsed) panel.collapse();
      const chromeHeight = layout.zones.chrome?.height ?? 0;
      const railRect: Rect = {
        x: viewport.x,
        y: viewport.y + chromeHeight,
        width: this.railOptionFor(viewport)?.width ?? 0,
        height: viewport.height - chromeHeight,
      };
      panel.update(view.panel, railRect);
      this.#lastPanel = panel;
    }

    this.#drawSpotlight(view.anchor, view.tagVariant, viewport);
  }

  #drawSpotlight(
    anchor: ReturnType<GuideController["view"]>["anchor"],
    tagVariant: ReturnType<GuideController["view"]>["tagVariant"],
    viewport: Rect,
  ): void {
    // A choice anchor never gets Board's own spotlight/tag — see `ChoiceOverlay#guidePickInstanceId`'s own doc
    // comment for why (a later-launched scene renders *above* Board, so a tag added to Board's own display list
    // would sit underneath the choice sheet's scrim, not on top of it). The sheet draws its own `GUIDE PICK`
    // stamp instead, via `#syncChoicePick`.
    this.#syncChoicePick(anchor);
    if (!anchor || anchor.kind === "choice" || !this.#scene.guideBannerClear() || !this.#observation.game) return;
    const frame = this.#scene.guideAnchorFrame();
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    const anchorFrame: AnchorFrame = {
      cardRects: frame.hitRects,
      focusRects: frame.focusRects,
      instanceOfCode: (code) => (perspectiveId ? instanceOfCode(game, perspectiveId, code) : null),
      mainSchemeInstanceId: frame.mainSchemeInstanceId,
    };
    const resolved = resolveAnchor(
      anchor,
      viewport,
      { playerCount: game.players.length, activeTab: this.#scene.activeTabName() },
      anchorFrame,
    );
    if (!resolved) return;
    new McGuideSpotlight(this.#scene).show(viewport, resolved.rect);
    if (tagVariant) new McGuideTag(this.#scene, tagVariant).update(resolved.rect);
  }

  /**
   * Tells the open declareDefender sheet which defender to stamp `GUIDE PICK` on — the tutorial's own Black Cat
   * (this module's own header explains why that card is hardcoded here rather than named generically). Clears
   * the sheet's pick whenever the current step isn't this particular choice step, so a stamp never survives past
   * the step that asked for it.
   */
  #syncChoicePick(anchor: ReturnType<GuideController["view"]>["anchor"]): void {
    const overlay = this.#scene.scene.get(SCENES.choice) as ChoiceOverlay | undefined;
    if (!overlay) return;
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    if (anchor?.kind === "choice" && anchor.id === "defend" && game && perspectiveId) {
      overlay.setGuidePick(instanceOfCode(game, perspectiveId, BLACK_CAT));
    } else {
      overlay.setGuidePick(null);
    }
  }

  /** Applies a controller reducer, then asks the host for a full board redraw — the same "the whole table
   * relayouts" shape every other board control uses (`BoardController`'s own `redraw` callback). */
  #act(fn: () => void): void {
    fn();
    this.#scene.requestGuideRedraw();
  }

  /** "Stop tutorial" (§3.10): ends guidance for this game, clears the board's own gate outright, and requests a
   * redraw so every guide surface disappears immediately — `draw()` won't recreate any of them once
   * `#controller.stopped` is true. The game keeps going. */
  #stop(): void {
    this.#controller.stop();
    this.#scene.setGuideGate(null);
    this.#lastGateStepId = null;
    this.#scene.requestGuideRedraw();
  }

  /** Only calls `BoardScene.setGuideGate` when the current step's own id changed — never on a plain redraw (this
   * module's own header). */
  #syncGate(stepId: string | null, gate: ReturnType<GuideController["view"]>["gate"]): void {
    if (stepId === this.#lastGateStepId) return;
    this.#lastGateStepId = stepId;
    this.#scene.setGuideGate(gate);
  }

  /** No-op: every Phaser widget this module draws is already ephemeral, torn down by the Board's own
   * `destroyChildren` on its very next redraw (this module's own header) — kept only so `BoardScene` has a
   * single, uniform "tear the guide down" call at scene shutdown / a fresh game, whether or not that redraw
   * ever actually happens again. */
  destroy(): void {
    // Nothing owned here outlives a single `draw()` call.
  }
}
