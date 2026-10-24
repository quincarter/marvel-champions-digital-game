/**
 * Keyboard and gamepad focus for a screen whose stops are just its controls:
 * Title/Setup, the villain-phase walkthrough and Game Over.
 *
 * The Board and the choice sheet each carry their own route because their
 * stops are cards that move between zones and rows. These screens are simpler —
 * a stop is a control with a rect and something it does — so they share this.
 * The *order* is still stated by the screen (`view/screen-focus.ts`, or a
 * screen's own action list), never taken from the order of its draw calls.
 *
 * Same conventions as everywhere else: Tab walks the route, the arrows move to
 * the nearest stop that way on screen (`view/spatial-nav.ts`), Enter or
 * Space (or the hand's Select key) presses, Inspect (E / O) reads (where a stop has something to read), Escape backs
 * out, and the ring is the selection ring drawn static — a pulse means "the game
 * is waiting for you", and focus is not a prompt.
 */

import type Phaser from "phaser";
import { onInputDeviceChange } from "../platform/input-device.js";
import { shownReportButton } from "../ui/report-slot.js";
import { shownMusicButton } from "../ui/music-slot.js";
import { McSelectionRing } from "../ui/widgets.js";
import { stepKey } from "../view/focus.js";
import type { GamepadIntent } from "../view/gamepad.js";
import type { Rect } from "../view/layout.js";
import { activationTarget } from "../view/primary-activation.js";
import { spatialStep } from "../view/spatial-nav.js";
import { bindGamepad, bindKeyboard } from "./board/input.js";
import { bindExtraInput } from "./extra-input.js";
import { CHROME_SCENES, SCENES } from "./keys.js";
import type { MusicButtonScene } from "./music-button.js";

/** The focus keys of the two top-bar chrome buttons, added to every route while they are on screen. */
export const CHROME_MUSIC_STOP = "chrome:music";
export const CHROME_REPORT_STOP = "chrome:report";

export interface FocusStop {
  /**
   * Where the ring frames this stop. A function rather than a fixed `Rect`
   * for a row inside a scrolling list (`ui/virtual-list.ts`): its on-screen
   * position depends on the list's current scroll offset, which
   * `ensureVisible` below may just have changed, so the rect has to be read
   * *after* that runs rather than captured once when the stop was built.
   */
  readonly rect: Rect | (() => Rect);
  /** What Enter does. A control that can't be used right now does nothing — exactly what a tap on it does. */
  readonly activate: () => void;
  /** What `I` does, when the stop shows a card. */
  readonly inspect?: () => void;
  /**
   * Called right after this stop takes focus, before the ring is drawn — a
   * row inside a virtualized list scrolls itself fully into view here
   * (`McVirtualList.scrollIntoView`), so arrowing onto an off-screen row
   * brings it on screen instead of leaving the ring nowhere a player can see.
   */
  readonly ensureVisible?: () => void;
  /** A slider: Left / Right (and the pad's d-pad) step it instead of moving focus. */
  readonly adjust?: (direction: -1 | 1) => void;
}

export interface FocusRouteOptions {
  /** True while something above this screen (a sheet, a text field) owns the keyboard and pad. */
  readonly blocked?: () => boolean;
  /** Escape or B. Without one, it just drops focus. */
  readonly onCancel?: () => void;
  /** Page Up/Down (or a pad's shoulder buttons), forwarded as-is — the screen decides what "a page" means (a virtualized list, usually). No-op when omitted. */
  readonly onPage?: (direction: 1 | -1) => void;
  /** Home/End, forwarded as-is. No-op when omitted. */
  readonly onHomeEnd?: (edge: "home" | "end") => void;
  /** Called whenever the focused stop changes by keyboard or pad (null when focus is dropped), so a screen can show what is in focus. */
  readonly onFocusChange?: (key: string | null) => void;
  /**
   * The right stick, forwarded as pixels to scroll (positive down) a frame at a time. A screen with a virtualized list
   * or a scroll region passes its `scrollByPx`; no-op when omitted.
   */
  readonly onScroll?: (dx: number, dy: number, dtMs: number) => void;
  /**
   * LB / RB (and the zone keys: R / F, P / ;, [ / ]) on a screen with tabs or a track list: step to the previous (-1) or
   * next (1) one. Takes the place of `onPage` for the shoulder buttons when given.
   */
  readonly onTab?: (direction: 1 | -1) => void;
  /** X (G / H on the keyboard), for a screen with one extra toggle (the music player's Shuffle). No-op when omitted. */
  readonly onToggle?: () => void;
  /**
   * Menu / Start / +, for a screen that has a pause or menu of its own. Without one it presses the screen's
   * `primary` stop (the same path as A with nothing focused): Start is "forward" on a setup screen.
   */
  readonly onPause?: () => void;
  /** View / Select / - and the Peek key (R / P), for a screen with a Peek-style control. No-op (and no key) when omitted. */
  readonly onView?: () => void;
  /** R3 and the Expand key (F / ;), for a screen with an Expand/Collapse control. No-op (and no key) when omitted. */
  readonly onExpand?: () => void;
  /**
   * The key of the screen's primary commit stop right now (Start, Continue), or null. With nothing focused, Enter / A
   * presses it (`view/primary-activation.ts`); with a stop focused it presses that stop.
   */
  readonly primary?: () => string | null;
}

export class FocusRoute {
  readonly #scene: Phaser.Scene;
  readonly #onCancel: (() => void) | undefined;
  readonly #onPage: ((direction: 1 | -1) => void) | undefined;
  readonly #onHomeEnd: ((edge: "home" | "end") => void) | undefined;
  readonly #onFocusChange: ((key: string | null) => void) | undefined;
  readonly #onPause: (() => void) | undefined;
  readonly #onView: (() => void) | undefined;
  readonly #onExpand: (() => void) | undefined;
  readonly #primary: (() => string | null) | undefined;
  readonly #onTab: ((direction: 1 | -1) => void) | undefined;
  readonly #onToggle: (() => void) | undefined;
  /** The ring is hidden after the mouse takes over, until the next pad or keyboard input. */
  #ringHidden = false;
  #ownOrder: readonly string[] = [];
  #ownStops: ReadonlyMap<string, FocusStop> = new Map();
  #focus: string | null = null;
  #ring: McSelectionRing | null = null;
  #ringColor: number | undefined;

  /**
   * Binds the scene's keyboard and pad. Both listeners live on the scene's own
   * input plugins, which drop them when the scene shuts down, so there is
   * nothing to unbind.
   */
  constructor(scene: Phaser.Scene, options: FocusRouteOptions = {}) {
    this.#scene = scene;
    this.#onCancel = options.onCancel;
    this.#onPage = options.onPage;
    this.#onHomeEnd = options.onHomeEnd;
    this.#onFocusChange = options.onFocusChange;
    this.#onPause = options.onPause;
    this.#onView = options.onView;
    this.#onExpand = options.onExpand;
    this.#primary = options.primary;
    this.#onTab = options.onTab;
    this.#onToggle = options.onToggle;
    // The mouse moving hides the ring (it comes back, on the same stop, at the next pad or keyboard input). The change
    // arrives deferred (platform/input-device.ts), never mid-press.
    const unsubscribe = onInputDeviceChange((state) => {
      if (!state.mouseMoving || this.#ringHidden) return;
      this.#ringHidden = true;
      this.#drawRing();
    });
    scene.events.once("shutdown", unsubscribe);
    scene.events.once("destroy", unsubscribe);
    const binding = {
      blocked: options.blocked ?? (() => false),
      onIntent: (intent: GamepadIntent) => this.#onIntent(intent),
      ...(options.onScroll ? { onScroll: options.onScroll } : {}),
    };
    bindKeyboard(scene, binding);
    bindGamepad(scene, binding);
    if (options.onTab) {
      const onTab = options.onTab;
      bindExtraInput(scene, {
        blocked: binding.blocked,
        zones: { previous: () => this.#tab(onTab, -1), next: () => this.#tab(onTab, 1) },
      });
    }
    // View and R3 arrive as intents above; their keys (Peek and Expand: R / F left-handed, P / ; right-handed) have no
    // intent in the shared keyboard binding.
    if (options.onView || options.onExpand) {
      bindExtraInput(scene, {
        blocked: binding.blocked,
        peekExpand: {
          ...(options.onView ? { peek: options.onView } : {}),
          ...(options.onExpand ? { expand: options.onExpand } : {}),
        },
      });
    }
  }

  get focused(): string | null {
    return this.#focus;
  }

  /**
   * This rebuild's route and controls. Call it last in a rebuild, after the
   * scene has cleared and redrawn its display list, so the ring sits over the
   * control it frames. Focus survives by key; a key that left the route is dropped.
   *
   * `ringColor` is for a ground the red ring would vanish into — Game Over's
   * Hero Red loss screen.
   */
  set(order: readonly string[], stops: ReadonlyMap<string, FocusStop>, ringColor?: number): void {
    this.#ownOrder = order.filter((key) => stops.has(key));
    this.#ownStops = stops;
    this.#ringColor = ringColor;
    this.#drawRing();
    if (import.meta.env.DEV) this.#publishForE2e();
  }

  /**
   * Dev-only e2e hooks (never referenced by product code): `window.__mcFocusState[sceneKey]()` is the focused key and whether the ring is drawn; `window.__mcFocusRoutes[sceneKey]()` lists this scene's
   * current stops — key and on-screen rect, in route order — so a Playwright run can click a control by what it is
   * rather than by pixel guesses, and read which controls exist right now (a disabled button has no stop).
   */
  #publishForE2e(): void {
    const w = window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]> };
    w.__mcFocusRoutes ??= {};
    const state = window as unknown as {
      __mcFocusState?: Record<string, () => { focus: string | null; ringShown: boolean }>;
    };
    state.__mcFocusState ??= {};
    state.__mcFocusState[this.#scene.sys.settings.key] = () => ({ focus: this.#focus, ringShown: this.#ring !== null });
    w.__mcFocusRoutes[this.#scene.sys.settings.key] = () =>
      this.#order.map((key) => {
        const rect = this.#stopOf(key)!.rect;
        return { key, rect: typeof rect === "function" ? rect() : rect };
      });
  }

  /**
   * The music note and the bug in the top bar, as focus stops, while they are drawn and this is the screen on top:
   * pressing up or right from the top row reaches them on every screen. A screen that already has a stop over one of
   * them keeps its own.
   */
  #chrome(): ReadonlyMap<string, FocusStop> {
    const out = new Map<string, FocusStop>();
    const manager = this.#scene.scene.manager;
    const key = this.#scene.sys.settings.key;
    if (key === SCENES.reportIssue || key === SCENES.musicButton || key === SCENES.reportButton) return out;
    const top = manager
      .getScenes(true)
      .filter((one) => !CHROME_SCENES.has(one.scene.key) && one.scene.key !== SCENES.music)
      .at(-1);
    if (top !== this.#scene) return out;
    const covered = (rect: Rect): boolean =>
      this.#ownOrder.some((own) => {
        const r = this.#rectOfOwn(own);
        return (
          r !== null &&
          r.x < rect.x + rect.width &&
          rect.x < r.x + r.width &&
          r.y < rect.y + rect.height &&
          rect.y < r.y + r.height
        );
      });
    const music = shownMusicButton();
    if (music && !covered(music)) {
      out.set(CHROME_MUSIC_STOP, {
        rect: music,
        activate: () => (manager.getScene(SCENES.musicButton) as MusicButtonScene | null)?.togglePlayer(),
      });
    }
    const report = shownReportButton();
    if (report && !covered(report)) {
      out.set(CHROME_REPORT_STOP, {
        rect: report,
        activate: () => {
          if (!this.#scene.scene.isActive(SCENES.reportIssue)) this.#scene.scene.launch(SCENES.reportIssue);
        },
      });
    }
    return out;
  }

  get #order(): readonly string[] {
    return [...this.#ownOrder, ...this.#chrome().keys()];
  }

  #stopOf(key: string): FocusStop | undefined {
    return this.#ownStops.get(key) ?? this.#chrome().get(key);
  }

  #rectOfOwn(key: string): Rect | null {
    const rect = this.#ownStops.get(key)?.rect;
    if (!rect) return null;
    return typeof rect === "function" ? rect() : rect;
  }

  #tab(onTab: (direction: 1 | -1) => void, direction: 1 | -1): void {
    this.#ringHidden = false;
    onTab(direction);
    this.#drawRing();
  }

  #onIntent(intent: GamepadIntent): void {
    // The mouse hid the ring: the first move, press or inspect only brings it back, on the stop it was on. A press
    // with the ring hidden acts as nothing focused (the primary), never on a stop the player cannot see.
    if (this.#ringHidden) {
      const wasHidden = intent === "up" || intent === "down" || intent === "left" || intent === "right";
      const steps = wasHidden || intent === "next" || intent === "previous" || intent === "inspect";
      this.#ringHidden = false;
      if (steps) {
        this.#drawRing();
        return;
      }
      if (intent === "activate") {
        const key = activationTarget(null, this.#primary?.() ?? null, true);
        this.#drawRing();
        if (key !== null) this.#stopOf(key)?.activate();
        return;
      }
      this.#drawRing();
    }
    switch (intent) {
      case "next":
      case "previous":
        this.#moveTo(stepKey(this.#order, this.#focus, intent === "next" ? 1 : -1));
        break;
      case "up":
      case "down":
      case "left":
      case "right": {
        const adjust =
          this.#focus !== null && (intent === "left" || intent === "right")
            ? this.#stopOf(this.#focus)?.adjust
            : undefined;
        if (adjust) {
          adjust(intent === "left" ? -1 : 1);
          break;
        }
        this.#moveTo(spatialStep(this.#order, (key) => this.#rectOf(key), this.#focus, intent));
        break;
      }
      case "activate":
        {
          // A stop exists only while its control can be pressed, so a primary that has one is enabled.
          const key = activationTarget(this.#focus, this.#primary?.() ?? null, true);
          if (key !== null) this.#stopOf(key)?.activate();
        }
        break;
      case "inspect":
        if (this.#focus) this.#stopOf(this.#focus)?.inspect?.();
        break;
      case "pageNext":
      case "pagePrevious":
        if (this.#onTab) this.#onTab(intent === "pageNext" ? 1 : -1);
        else this.#onPage?.(intent === "pageNext" ? 1 : -1);
        this.#drawRing();
        break;
      case "home":
      case "end":
        this.#onHomeEnd?.(intent);
        this.#drawRing();
        break;
      case "pause":
        if (this.#onPause) {
          this.#onPause();
        } else {
          // Start is "forward": it presses the screen's primary stop, as A does with nothing focused.
          const key = activationTarget(null, this.#primary?.() ?? null, true);
          if (key !== null) this.#stopOf(key)?.activate();
        }
        break;
      case "toggleGuide":
        this.#onToggle?.();
        break;
      case "view":
        this.#onView?.();
        break;
      case "expand":
        this.#onExpand?.();
        break;
      case "cancel":
        if (this.#onCancel) {
          this.#onCancel();
        } else {
          this.#focus = null;
          this.#drawRing();
        }
        break;
    }
  }

  #moveTo(key: string | null): void {
    this.#focus = key;
    if (this.#focus) this.#stopOf(this.#focus)?.ensureVisible?.();
    this.#drawRing();
    this.#onFocusChange?.(this.#focus);
  }

  #rectOf(key: string): Rect | null {
    const rect = this.#stopOf(key)?.rect;
    if (!rect) return null;
    return typeof rect === "function" ? rect() : rect;
  }

  #drawRing(): void {
    // Destroying a ring whose graphics a display-list sweep already took is safe.
    this.#ring?.destroy();
    this.#ring = null;
    if (this.#focus !== null && !this.#order.includes(this.#focus)) this.#focus = null;
    const stop = this.#focus === null ? undefined : this.#stopOf(this.#focus);
    if (!stop || this.#ringHidden) return;
    this.#ring = new McSelectionRing(this.#scene, this.#ringColor);
    this.#ring.show(typeof stop.rect === "function" ? stop.rect() : stop.rect, "static", true);
  }
}
