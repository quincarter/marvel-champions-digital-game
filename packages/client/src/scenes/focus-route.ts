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
import { chromeStopsOf } from "../view/chrome-stops.js";
import { McSelectionRing } from "../ui/widgets.js";
import { stepKey } from "../view/focus.js";
import type { GamepadIntent } from "../view/gamepad.js";
import type { Rect } from "../view/layout.js";
import type { PadLayer } from "../view/pad-layer-bindings.js";
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
  /**
   * The right stick while this stop is focused, for a stop that holds its own scroll (a text block, a card's rules, a
   * nested list): pixels to scroll this frame (positive down) and the frame's length. Return true when it scrolled;
   * false (at its end, or nothing to scroll) hands the stick on to the screen's `onScroll`.
   */
  readonly scroll?: (dx: number, dy: number, dtMs: number) => boolean;
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
   * next (1) one. Takes the place of `onPage` for the shoulder buttons when given; PageUp / PageDown on the keyboard
   * always go to `onPage`.
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
  /**
   * For a screen whose stops sit off to the side of each other (a Close in a corner over a card grid): an arrow that
   * finds nothing in its 90 degree cone goes to the nearest stop strictly that way instead of staying put.
   */
  readonly reachAcross?: boolean;
  /**
   * Y / the Inspect key, ahead of the focused stop's own `inspect`. Return true when the screen took it (Y shows or
   * hides the filters on Scenario select and Take your seats while a pad is in use). `source` is "key" for the keyboard.
   */
  readonly onInspect?: (source?: "key") => boolean;
  /**
   * LT or RT pulled (a trigger alone has no meaning on most screens; the Board uses them as hold layers): a screen
   * whose rows page sideways pages the focused one. Called once per pull, not while the trigger stays down.
   */
  readonly onTrigger?: (trigger: "lt" | "rt") => void;
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
  readonly #onInspect: ((source?: "key") => boolean) | undefined;
  readonly #reachAcross: boolean;
  /** The ring is hidden after the mouse takes over, until the next pad or keyboard input. */
  #ringHidden = false;
  #chromeFrame = -1;
  #chromeStops: ReadonlyMap<string, FocusStop> = new Map();
  #ownOrder: readonly string[] = [];
  #ownStops: ReadonlyMap<string, FocusStop> = new Map();
  #focus: string | null = null;
  #ring: McSelectionRing | null = null;
  #ringColor: number | undefined;
  /** Where the ring was drawn last, to notice a stop that moved under it. */
  #ringRect: Rect | null = null;

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
    this.#onInspect = options.onInspect;
    this.#reachAcross = options.reachAcross ?? false;
    // The mouse moving hides the ring (it comes back, on the same stop, at the next pad or keyboard input). The change
    // arrives deferred (platform/input-device.ts), never mid-press.
    const unsubscribe = onInputDeviceChange((state) => {
      if (!state.mouseMoving || this.#ringHidden) return;
      this.#ringHidden = true;
      this.#drawRing();
    });
    // A row inside a scrolling list moves when the list scrolls by touch, wheel or drag, not only when focus moves: the
    // ring follows its stop (a stale ring sat above and left of the button it marked, Settings on the Deck).
    const follow = (): void => {
      if (!this.#ring || this.#focus === null) return;
      // Chrome rects are static: only a hidden one (the pad toast covers the bar for a moment) needs a look.
      if (this.#focus === CHROME_MUSIC_STOP || this.#focus === CHROME_REPORT_STOP) {
        const shown = this.#focus === CHROME_MUSIC_STOP ? shownMusicButton() : shownReportButton();
        if (shown === null) this.#drawRing();
        return;
      }
      const stop = this.#ownStops.get(this.#focus);
      if (!stop || typeof stop.rect !== "function") return;
      const rect = stop.rect();
      const last = this.#ringRect;
      if (last && last.x === rect.x && last.y === rect.y && last.width === rect.width && last.height === rect.height)
        return;
      // Move the ring where it stands; no new graphics each frame while a list scrolls.
      this.#ringRect = rect;
      this.#ring.show(rect, "static", true);
    };
    scene.events.on("update", follow);
    const release = (): void => {
      unsubscribe();
      scene.events.off("update", follow);
      scene.events.off("shutdown", release);
      scene.events.off("destroy", release);
    };
    scene.events.once("shutdown", release);
    scene.events.once("destroy", release);
    const onTrigger = options.onTrigger;
    const binding = {
      ...(onTrigger ? { onLayer: (layer: PadLayer | null) => (layer === null ? undefined : onTrigger(layer)) } : {}),
      blocked: options.blocked ?? (() => false),
      onIntent: (intent: GamepadIntent, source?: "key") => this.#onIntent(intent, source),
      onScroll: (dx: number, dy: number, dtMs: number) => {
        const stop = this.#focus === null ? undefined : this.#stopOf(this.#focus);
        if (stop?.scroll?.(dx, dy, dtMs)) return;
        options.onScroll?.(dx, dy, dtMs);
      },
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

  /** Inspect on the focused stop, as Y would (View does it on screens where Y is taken). */
  inspectFocused(): void {
    if (this.#focus) this.#stopOf(this.#focus)?.inspect?.();
  }

  get focused(): string | null {
    return this.#focus;
  }

  /** Moves focus to `key` as a pad step would (stop scrolls into view, ring drawn, onFocusChange hears it). A non-stop key drops focus. */
  focusKey(key: string | null): void {
    this.#ringHidden = false;
    this.#moveTo(key !== null && this.#order.includes(key) ? key : null);
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
    this.#chromeFrame = -1;
    this.#ringColor = ringColor;
    this.#drawRing();
    if (import.meta.env.DEV) this.#publishForE2e();
  }

  /**
   * Dev-only e2e hooks (never referenced by product code): `window.__mcFocusState[sceneKey]()` is the focused key and
   * whether the ring is drawn; `window.__mcFocusRoutes[sceneKey]()` lists this scene's current stops — key and
   * on-screen rect, in route order — so a Playwright run can click a control by what it is rather than by pixel
   * guesses, and read which controls exist right now (a disabled button has no stop).
   */
  #publishForE2e(): void {
    const w = window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]> };
    w.__mcFocusRoutes ??= {};
    const state = window as unknown as {
      __mcFocusState?: Record<string, () => { focus: string | null; ringShown: boolean; ringRect: Rect | null }>;
    };
    state.__mcFocusState ??= {};
    state.__mcFocusState[this.#scene.sys.settings.key] = () => ({
      focus: this.#focus,
      ringShown: this.#ring !== null,
      ringRect: this.#ringRect,
    });
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
    // One answer per frame: a pad step asks for every stop's rect, and nothing here changes within a frame.
    const frame = this.#scene.game.loop.frame;
    if (this.#chromeFrame === frame) return this.#chromeStops;
    const manager = this.#scene.scene.manager;
    const key = this.#scene.sys.settings.key;
    const top = manager
      .getScenes(true)
      .filter((one) => !CHROME_SCENES.has(one.scene.key) && one.scene.key !== SCENES.music)
      .at(-1);
    const found = chromeStopsOf({
      isTop: top === this.#scene,
      excluded: key === SCENES.reportIssue || key === SCENES.musicButton || key === SCENES.reportButton,
      music: shownMusicButton(),
      report: shownReportButton(),
      own: this.#ownOrder.flatMap((own) => this.#rectOfOwn(own) ?? []),
    });
    const out = new Map<string, FocusStop>();
    if (found.music) {
      out.set(CHROME_MUSIC_STOP, {
        rect: found.music,
        activate: () => (manager.getScene(SCENES.musicButton) as MusicButtonScene | null)?.togglePlayer(),
      });
    }
    if (found.report) {
      out.set(CHROME_REPORT_STOP, {
        rect: found.report,
        activate: () => {
          if (!this.#scene.scene.isActive(SCENES.reportIssue)) this.#scene.scene.launch(SCENES.reportIssue);
        },
      });
    }
    this.#chromeFrame = frame;
    this.#chromeStops = out;
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

  #onIntent(intent: GamepadIntent, source?: "key"): void {
    // The mouse hid the ring: the first move, press or inspect only brings it back, on the stop it was on. A press
    // with the ring hidden acts as nothing focused (the primary), never on a stop the player cannot see.
    if (this.#ringHidden) {
      const reveals =
        intent === "up" ||
        intent === "down" ||
        intent === "left" ||
        intent === "right" ||
        intent === "next" ||
        intent === "previous" ||
        intent === "inspect";
      this.#ringHidden = false;
      this.#drawRing();
      // With a stop focused the press only brings the ring back; A never presses what the player cannot see, nor the
      // screen's primary (Start covers "forward"). With nothing focused a direction moves as usual.
      if (intent === "activate" || (reveals && this.#focus !== null)) return;
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
        this.#moveTo(spatialStep(this.#order, (key) => this.#rectOf(key), this.#focus, intent, this.#reachAcross));
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
        if (this.#onInspect?.(source)) break;
        if (this.#focus) this.#stopOf(this.#focus)?.inspect?.();
        break;
      case "pageNext":
      case "pagePrevious":
        // LB / RB are the tab buttons; the keyboard's PageUp / PageDown always page.
        if (this.#onTab && source !== "key") this.#onTab(intent === "pageNext" ? 1 : -1);
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
    this.#ringRect = null;
    if (this.#focus !== null && !this.#order.includes(this.#focus)) this.#focus = null;
    const stop = this.#focus === null ? undefined : this.#stopOf(this.#focus);
    if (!stop || this.#ringHidden) return;
    const rect = typeof stop.rect === "function" ? stop.rect() : stop.rect;
    this.#ringRect = rect;
    this.#ring = new McSelectionRing(this.#scene, this.#ringColor);
    this.#ring.show(rect, "static", true);
  }
}
