/**
 * The guide's thin Phaser adapter for the Board (guided mode G5c, `docs/guided-mode.md` §4): mounts
 * `GuideController` (`guide/guide-controller.ts`, pure) onto a live game, and turns its `view()` snapshot into
 * `McGuidePanel`/`McGuideCallout`/`McGuideSpotlight`/`McGuideTag` draws plus the board's own soft input gate
 * (`scenes/board/guide-gate.ts`). Desktop and tablet landscape get the rail (`McGuidePanel`); phone, phone
 * landscape and tablet portrait (`view/layout.ts`'s own `isTabbed`) get the anchored `McGuideCallout` instead,
 * with the same content and the same spotlight/tag, plus a one-shot auto-switch of the active phone tab when a
 * step's own anchor lives behind one the player isn't currently looking at (`#maybeSwitchTab`, G5c part 2).
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
import {
  GuideController,
  type GuideControllerOptions,
  type GuideControllerView,
} from "../../guide/guide-controller.js";
import { McGuideCallout } from "../../ui/guide-callout.js";
import { McGuidePanel } from "../../ui/guide-panel.js";
import { McGuideSpotlight } from "../../ui/guide-spotlight.js";
import { McGuideTag } from "../../ui/guide-tag.js";
import { GUIDE_PANEL_COLLAPSED_WIDTH, guideRailWidthFor } from "../../view/guide-panel-model.js";
import { instanceOfCode, resolveAnchor, type AnchorFrame, type ResolvedAnchor } from "../../view/guide-anchor.js";
import { calloutContentOf } from "../../view/guide-callout-content.js";
import { formFactorFor, isTabbed, type BoardLayout, type PhoneTab, type Rect } from "../../view/layout.js";
import type { LessonAnchor, LessonObservation } from "../../view/lesson-model.js";

const RAIL_FORM_FACTORS: ReadonlySet<string> = new Set(["desktop", "tabletLandscape"]);
const BLACK_CAT = cardId("01002");
/** Lesson 3's own payment source (`guide/tutorial-config.ts`'s stacked hand) — see `#syncPayingOverride`'s own
 * doc comment for why this module, not the lesson data, names it. */
const ENERGY = cardId("01088");
const PLAY_BLACK_CAT_STEP_ID = "play-black-cat";
/** `scenes/board/payment-bar.ts`'s own `focusRects` key for its Pay button. */
const PAY_CONTROL_ID = "payment:pay";

export class BoardGuideMount {
  readonly #scene: BoardScene;
  readonly #controller: GuideController;
  #observation: LessonObservation;
  #collapsed = false;
  #lastGateStepId: string | null = null;
  /** This frame's panel, if one was drawn — kept only so a headless click-through can reach its rects
   * (`debugPanelRects`); never read to decide what to draw next frame (that's `#collapsed`, plain state). */
  #lastPanel: McGuidePanel | null = null;
  /** This frame's phone/tablet-portrait callout, if one was drawn — the same "debug hook only" role `#lastPanel`
   * plays for the rail (`debugCalloutRects`), G5c part 2. */
  #lastCallout: McGuideCallout | null = null;
  /** `BoardScene#guideBannerClear()` as of the last `pollBanner` call — see that method's own doc comment. */
  #lastBannerClear = true;
  /** This frame's resolved anchor, if any — kept only for `debugAnchorRect` (G5c part 2 verification hook). */
  #lastResolved: ResolvedAnchor | null = null;
  /**
   * The step id the tab auto-switch decision was already made for (G5c part 2, `docs/guided-mode.md` §4 G5c
   * "Auto-switch the tab") — `undefined` matches nothing, so the very first step always gets a decision.
   * `#maybeSwitchTab` only ever *acts* the first time a given step id is seen here; every later draw for the same
   * step, whatever the player does with the tab bar in the meantime, is left alone — "do it only once per step,
   * so the player can switch away freely afterwards".
   */
  #tabSwitchStepId: string | null | undefined = undefined;

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
    if (!this.#controller.view().active) return false;
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
    if (this.#controller.hidden) return;
    const clear = this.#scene.guideBannerClear();
    if (clear && !this.#lastBannerClear) this.#scene.requestGuideRedraw();
    this.#lastBannerClear = clear;
  }

  /** True once nothing should show at all — "Stop tutorial", or the complete state's own "Close" (G5c part 2:
   * `GuideController#hidden`) — the host keeps calling `draw()` (a no-op past this point: `view()` always reports
   * `active: false`), it just never has to construct a fresh mount again. */
  get stopped(): boolean {
    return this.#controller.hidden;
  }

  /** Headless click-through hook only (never referenced by product code, JSON-safe): the current step's own id,
   * or `null` with nothing current (including the waiting/complete states — mirrors every other `?screen=…demo`
   * scene's own `__mc*Debug` accessor). */
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

  /** Debug-only: this frame's phone/tablet-portrait callout rects (G5c part 2), for a headless script to click a
   * real screen coordinate. `null` when no callout drew this frame (on a rail form factor, or nothing current). */
  debugCalloutRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } | null {
    return this.#lastCallout?.debugRects() ?? null;
  }

  /** Debug-only: the current step's own resolved anchor rect (G5c part 2 verification) — the same rect the
   * spotlight/tag would ring, whether or not the spotlight actually drew this frame (a banner covering it, or the
   * anchor living on a phone tab the player isn't on). `null` with no anchor, or nothing currently resolvable. */
  debugAnchorRect(): Rect | null {
    return this.#lastResolved?.rect ?? null;
  }

  /** The guide rail's own width to reserve in this frame's `boardLayout` call, or `null` off desktop/tablet
   * landscape, or once the guide is hidden — `BoardScene#draw` reads this *before* laying out the rest of the
   * table, so nothing the rail covers is also a drop target underneath it. */
  railOptionFor(viewport: Rect): { readonly side: "left"; readonly width: number } | null {
    if (this.#controller.hidden) return null;
    const formFactor = formFactorFor(viewport.width, viewport.height);
    if (!RAIL_FORM_FACTORS.has(formFactor)) return null;
    const width = this.#collapsed ? GUIDE_PANEL_COLLAPSED_WIDTH : guideRailWidthFor(viewport.width, formFactor);
    return { side: "left", width };
  }

  /**
   * Draws the panel/callout, spotlight and tag for this frame (each a fresh instance — see this module's own
   * header), and syncs the board's own gate. `layout` is the very `BoardLayout` `BoardScene#draw` already built
   * this frame — `railOptionFor` told it how wide to leave the rail, so a rail-form-factor draw only ever puts
   * the panel inside that reserved space. Call *after* every zone has drawn (schemes, action bar, hand, …), since
   * resolving a card/action anchor reads the hit rects those draws just registered, and *before*
   * `destroyChildren` runs again (i.e. once per `BoardScene#draw`, same as everything else on the table).
   *
   * **The tab auto-switch can end this call early (G5c part 2).** The anchor is resolved once, up front, since
   * both the spotlight/tag and the phone/tablet-portrait callout need it. When that resolution says the anchor
   * lives on a phone tab the player isn't looking at, and this is the first draw for the current step,
   * `#maybeSwitchTab` calls `BoardScene#switchToTab`, which runs its own full `BoardScene#draw()` — including a
   * fresh call to this very method, this time matching — before returning here. This call has created nothing
   * yet at that point (the switch check runs before any `new McGuidePanel`/`McGuideCallout`/spotlight), so it
   * just returns rather than drawing a second, stale copy on top of what the nested redraw already put down.
   */
  draw(layout: BoardLayout, viewport: Rect): void {
    this.#syncPayingOverride(this.#controller.view().step?.id ?? null);
    const view = this.#controller.view();
    this.#syncGate(view.step?.id ?? null, view.gate);
    this.#lastPanel = null;
    this.#lastCallout = null;

    const formFactor = formFactorFor(viewport.width, viewport.height);
    const onRail = RAIL_FORM_FACTORS.has(formFactor);
    const tabbed = isTabbed(formFactor);

    const resolved = this.#resolveAnchorRect(view.anchor, viewport);
    this.#lastResolved = resolved;
    if (tabbed && this.#maybeSwitchTab(view.step?.id ?? null, resolved?.tab ?? null)) return;

    if (onRail && view.active && view.panel) {
      const panel = new McGuidePanel(this.#scene, {
        side: "left",
        onBack: () => this.#act(() => this.#controller.back()),
        onPrimary: () => this.#act(() => this.#controller.primary()),
        // Waiting/complete have no current step to skip (`view.step` is null then) — the header's Skip control
        // only draws when `onSkip` is wired, so it's simply left out rather than shown as a no-op.
        ...(view.step ? { onSkip: () => this.#act(() => this.#controller.skip()) } : {}),
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
    } else if (tabbed && view.active && view.panel) {
      // Assigned directly here, in `draw()`'s own scope (mirroring `#lastPanel` just above), rather than inside
      // `#drawCallout` itself — TS's own narrowing of a private field only reliably tracks assignments made in the
      // same function body, not ones made by a called method.
      this.#lastCallout = this.#drawCallout(view, resolved, viewport);
    }

    this.#drawSpotlight(view.anchor, resolved, view.tagVariant, viewport);
    // The spotlight's own dim bands (`McGuideSpotlight#show`) bring themselves to the top of the display list on
    // every call, which would otherwise leave the rail/callout sitting under the dim (found in browser
    // verification, G5c fix: the yellow rail read muddy, since it isn't inside the spotlight's own cutout). The
    // rail sits beside the table, not over it, and the callout must render above the dim too (G5c part 2) — only
    // the board itself should ever be dimmed — so both are brought back above the dim/ring every frame either
    // drew, right after the spotlight, rather than the spotlight skipping their bounds (a real cutout carve-out
    // would have to track them too, for no benefit: neither is ever the thing being spotlit).
    if (this.#lastPanel) this.#scene.children.bringToTop(this.#lastPanel.container);
    if (this.#lastCallout) this.#scene.children.bringToTop(this.#lastCallout.container);
  }

  /**
   * Resolves `anchor` to a screen rect once per draw, shared by the spotlight/tag and the phone/tablet-portrait
   * callout's own anchoring (G5c part 2) — both need the identical rect, and the tab-switch decision needs to
   * see it before either widget is built. Mirrors the pre-part-2 `#drawSpotlight`'s own resolution, unchanged:
   * a choice anchor is never resolved here (the choice sheet owns its own `GUIDE PICK` stamp, `#syncChoicePick`),
   * and `null` covers every other "nothing to show yet" case (no anchor, no game, or the anchor genuinely isn't
   * on screen right now).
   */
  #resolveAnchorRect(anchor: LessonAnchor | null, viewport: Rect): ResolvedAnchor | null {
    if (!anchor || anchor.kind === "choice" || !this.#observation.game) return null;
    const frame = this.#scene.guideAnchorFrame();
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    const anchorFrame: AnchorFrame = {
      cardRects: frame.hitRects,
      focusRects: frame.focusRects,
      instanceOfCode: (code) => (perspectiveId ? instanceOfCode(game, perspectiveId, code) : null),
      mainSchemeInstanceId: frame.mainSchemeInstanceId,
    };
    return resolveAnchor(
      anchor,
      viewport,
      { playerCount: game.players.length, activeTab: this.#scene.activeTabName() },
      anchorFrame,
    );
  }

  /**
   * The tab auto-switch itself (G5c part 2, `docs/guided-mode.md` §4 G5c "Auto-switch the tab"): the *first* time
   * `stepId` is seen here, and only then, a non-null `tab` that doesn't match the board's own active tab is
   * switched to via `BoardScene#switchToTab` (which redraws on its own — see `draw()`'s own header for why this
   * method's caller must stop immediately when this returns `true`). Every later call for the same `stepId` is a
   * no-op read of `#tabSwitchStepId`'s guard, whatever the player has done with the tab bar since — that's what
   * lets them switch away freely without being yanked back (§3.10's spirit, applied to tabs rather than a gate).
   */
  #maybeSwitchTab(stepId: string | null, tab: PhoneTab | null): boolean {
    if (stepId === this.#tabSwitchStepId) return false;
    this.#tabSwitchStepId = stepId;
    if (!tab || this.#scene.activeTabName() === tab) return false;
    this.#scene.switchToTab(tab);
    return true;
  }

  /**
   * The phone/tablet-portrait callout (G5c part 2): the same `view.panel` content the rail draws, mapped to
   * `McGuideCalloutContent` (`calloutContentOf`). Anchored to `resolved`'s own rect only when the anchor is
   * actually showing on the current tab (`resolved.tab === null`) — when it isn't (the player switched away
   * after the one auto-switch, or a step's own anchor just doesn't live on this tab), the callout falls back to
   * `McGuideCallout`'s own anchor-less centered layout rather than pointing at a rect that isn't on screen; the
   * spotlight is hidden for the same reason (`#drawSpotlight`), but the callout stays up with its text either
   * way — the player already has the lesson's words, only the "look here" ring goes away.
   */
  #drawCallout(view: GuideControllerView, resolved: ResolvedAnchor | null, viewport: Rect): McGuideCallout | null {
    if (!view.panel) return null;
    const anchorRect = resolved && !resolved.tab ? resolved.rect : null;
    const callout = new McGuideCallout(this.#scene, {
      onPrimary: () => this.#act(() => this.#controller.primary()),
      ...(view.panel.backLabel ? { onSecondary: () => this.#act(() => this.#controller.back()) } : {}),
      // Waiting/complete have no current step to skip — same reasoning as the rail's own `onSkip` above.
      ...(view.step ? { onSkip: () => this.#act(() => this.#controller.skip()) } : {}),
      onStop: () => this.#stop(),
    });
    callout.update(calloutContentOf(view.panel, Boolean(view.panel.backLabel)), anchorRect, viewport);
    return callout;
  }

  #drawSpotlight(
    anchor: ReturnType<GuideController["view"]>["anchor"],
    resolved: ResolvedAnchor | null,
    tagVariant: ReturnType<GuideController["view"]>["tagVariant"],
    viewport: Rect,
  ): void {
    // A choice anchor never gets Board's own spotlight/tag — see `ChoiceOverlay#guidePickInstanceId`'s own doc
    // comment for why (a later-launched scene renders *above* Board, so a tag added to Board's own display list
    // would sit underneath the choice sheet's scrim, not on top of it). The sheet draws its own `GUIDE PICK`
    // stamp instead, via `#syncChoicePick`.
    this.#syncChoicePick(anchor);
    if (!resolved || !this.#scene.guideBannerClear()) return;
    // `resolved.tab` set means the anchor isn't actually on the currently active phone tab right now — either
    // this step's one auto-switch (`#maybeSwitchTab`) hasn't happened yet this exact draw (it would already have
    // returned above), or the player switched away from it on their own since. Either way there's nothing to
    // ring on *this* screen — "hide the spotlight until they come back" (`docs/guided-mode.md` §4 G5c item 1) —
    // while the callout stays up with its text regardless (`#drawCallout`'s own doc comment).
    if (resolved.tab) return;
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

  /**
   * Lesson 3's own sub-steps (guided-mode.md §4 G5c fix): "Play Black Cat" reads as one step in the lesson data
   * (`guide/tutorial-lessons.ts`), but it's really three targets the player has to hit in sequence — Black Cat
   * herself, then Energy (the source to tap), then Pay — driven entirely by the live payment bar, which is
   * client-side UI state `GuideController`'s own `LessonObservation` never carries (it isn't part of engine
   * `GameState`). This module is the one place that already hardcodes the tutorial's own card codes
   * (`#syncChoicePick`'s `BLACK_CAT`), so it's the override's home too, rather than teaching the Phaser draw code
   * itself which card to ring — see `GuideStepOverride`'s own doc comment for the split.
   */
  #syncPayingOverride(stepId: string | null): void {
    if (stepId !== PLAY_BLACK_CAT_STEP_ID) {
      this.#controller.setOverride(PLAY_BLACK_CAT_STEP_ID, null);
      return;
    }
    const game = this.#observation.game;
    const perspectiveId = this.#observation.perspectiveId;
    const payment = this.#scene.paymentView();
    const blackCatId = game && perspectiveId ? instanceOfCode(game, perspectiveId, BLACK_CAT) : null;
    if (!payment || !game || !perspectiveId || payment.subject === null || payment.subject !== blackCatId) {
      this.#controller.setOverride(PLAY_BLACK_CAT_STEP_ID, null);
      return;
    }
    if (payment.paid > 0) {
      this.#controller.setOverride(PLAY_BLACK_CAT_STEP_ID, {
        anchor: { kind: "control", id: PAY_CONTROL_ID },
        doThis: "Pay",
      });
      return;
    }
    const energyInstanceId = instanceOfCode(game, perspectiveId, ENERGY);
    this.#controller.setOverride(
      PLAY_BLACK_CAT_STEP_ID,
      energyInstanceId !== null ? { anchor: { kind: "card", code: ENERGY }, doThis: "Tap Energy, then Pay" } : null,
    );
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
