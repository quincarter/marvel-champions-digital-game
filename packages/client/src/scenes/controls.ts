/**
 * Settings ▸ Controls (`docs/controller-support.md` "Controls screen"): the controller drawn for the active family
 * with the button list beside it, and the keyboard's shortcuts. Read-only for now; the Remap buttons are drawn dashed
 * and disabled.
 *
 * Thin by rule: every word comes from `view/controls-rows.ts`, the drawing from `view/controller-diagram.ts`, the page's
 * shape from `scenes/controls/controls-compose.ts`. Settings changes go through `appSession().settings`, the same set path
 * `scenes/settings.ts` uses.
 *
 * **The screen is one custom element**, `mc-controls-page` (`views/controls/`), composing the sections in
 * `components/controls/` (the controller drawing, the settings rows, the lists, the pad status) under an `mc-top-bar`.
 * The key and pad legend is built from the live bindings every time the scene composes, so a different pad or a changed
 * setting shows at once. The scene keeps the focus route (ring in the panel layer, `dom/dom-ring.ts`), the press shield, the
 * entrance and exit motion and the choices.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/controls/mc-controls-page/mc-controls-page.js";
import type { ControlsEventDetail, ControlsTabId } from "../components/controls/controls.types.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { onInputDeviceChange, inputDevice } from "../platform/input-device.js";
import { appSession } from "../session.js";
import { notifyHintSettingsChanged } from "../ui/input-hints.js";
import { addPressShield } from "../ui/press-shield.js";
import { OverlayMotion } from "../ui/transitions.js";
import {
  glyphSizeAtTrack,
  nextSettingsAfterGlyphSource,
  nextSettingsAfterHintSize,
  nextSettingsAfterHints,
  nextSettingsAfterKeyboardHand,
  nextSettingsAfterNintendo,
  nextSettingsAfterPadFamily,
  steppedGlyphSize,
  type ControlsTab,
} from "../view/controls-rows.js";
import { formFactorFor } from "../view/layout.js";
import { detectPad } from "../view/pad-family.js";
import { padInputNow } from "../view/pad-input-test.js";
import { composeControls } from "./controls/controls-compose.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export { remapButtonsLabel, remapKeysLabel } from "./controls/controls-compose.js";

/** The tab Controls last showed, so it reopens where the player left it (the keyboard when no pad is in use). */
let lastTab: ControlsTab | null = null;

/** Launch data: `tab` opens on that tab (a Settings search result). */
export interface ControlsSceneData {
  readonly tab?: ControlsTab;
}

/** The connected pad, or null: read fresh each compose. */
function connectedPad(): Gamepad | null {
  const pads = globalThis.navigator?.getGamepads?.() ?? [];
  for (const pad of pads) if (pad?.connected) return pad;
  return null;
}

export class ControlsOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-controls-page"]> | null = null;
  #glyphs!: ControlGlyphs;
  #motion = new OverlayMotion();
  #anchor: Phaser.GameObjects.Graphics | null = null;
  #tab: ControlsTab = "controller";
  /** The last input the test line under the caption has seen, and whether it is showing (a pad is connected). */
  #inputSeen: string | null = null;
  #hasTestLine = false;
  #stamp = 0;

  constructor() {
    super(SCENES.controls);
  }

  create(data: ControlsSceneData = {}): void {
    // Phaser hands a later launch with no data this same object again: take the tab once.
    this.sys.settings.data = {};
    this.#motion = new OverlayMotion();
    this.input.enabled = true;
    this.#tab = data.tab ?? lastTab ?? (inputDevice().mode === "keyboard" ? "keyboard" : "controller");
    this.#inputSeen = null;
    const { width, height } = this.scale.gameSize;
    // Swallows presses that land on no control, so a touch scroll over blank space cannot reach the screen behind.
    addPressShield(this, { x: 0, y: 0, width, height });
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    this.#anchor = this.add.graphics();
    const mounted = mountElement(this, "mc-controls-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    mounted.region.follow(this.#anchor);
    mounted.element.addEventListener("mc-controls", (event) => this.#heard(event.detail));
    const unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    // The input test reads the browser's own pad each frame while this screen is up, and redraws only on a new input.
    const pollInput = (): void => {
      if (!this.#hasTestLine) return;
      const now = padInputNow(globalThis.navigator?.getGamepads?.() ?? []);
      if (now === null || now === this.#inputSeen) return;
      this.#inputSeen = now;
      this.#draw();
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, pollInput);
    const redraw = (): void => {
      if (this.sys.isActive()) this.#draw();
    };
    this.scale.on("resize", redraw, this);
    const offLanguage = onLanguageChange(redraw);
    // Only a change of input mode or pad redraws: the mouse flipping between moving and resting must not rebuild the
    // screen under a click in progress.
    let lastMode = inputDevice().mode;
    let lastPad = inputDevice().pad;
    const unsubscribe = onInputDeviceChange((state) => {
      if (state.mode === lastMode && state.pad === lastPad) return;
      lastMode = state.mode;
      lastPad = state.pad;
      redraw();
    });
    window.addEventListener("gamepadconnected", redraw);
    window.addEventListener("gamepaddisconnected", redraw);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#close(),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) =>
        this.#scroller()?.scrollBy({ top: direction * Math.max(120, (this.#scroller()?.clientHeight ?? 0) - 60) }),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      this.events.off(Phaser.Scenes.Events.UPDATE, pollInput);
      offLanguage();
      unsubscribe();
      unbind();
      this.#glyphs.dispose();
      window.removeEventListener("gamepadconnected", redraw);
      window.removeEventListener("gamepaddisconnected", redraw);
      this.#mounted = null;
    });
    if (import.meta.env.DEV) this.#exposeDebug();
    this.#draw();
  }

  /** Headless click-through hook only: the hint slider's parts where they are drawn now, for the e2e specs. */
  #exposeDebug(): void {
    (window as unknown as { __mcControlsDebug?: unknown }).__mcControlsDebug = {
      hintSlider: () => {
        const mounted = this.#mounted;
        if (!mounted) return null;
        const slider = mounted.element.shadowRoot
          ?.querySelector("mc-controls-settings")
          ?.shadowRoot?.querySelector("mc-volume-slider");
        const box = slider?.shadowRoot;
        const rectOf = (target: Element | null | undefined) => (target ? mounted.region.rectOf(target) : null);
        const [down, up] = [...(box?.querySelectorAll("mc-button") ?? [])];
        const track = rectOf(box?.querySelector(".track"));
        const percent = rectOf(box?.querySelector(".label"));
        const viewport = rectOf(this.#scroller());
        const downRect = rectOf(down);
        const upRect = rectOf(up);
        return viewport && track && downRect && upRect && percent
          ? { track, down: downRect, up: upRect, percent, viewport }
          : null;
      },
      revealHintSlider: () => mountedSlider(this.#mounted?.element)?.scrollIntoView({ block: "nearest" }),
    };
  }

  #scroller(): HTMLElement | null {
    return this.#mounted?.element.scroller ?? null;
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #setTab(tab: ControlsTab): void {
    if (tab === this.#tab) return;
    this.#tab = tab;
    lastTab = tab;
    this.#scroller()?.scrollTo({ top: 0 });
    this.#draw();
  }

  #set(next: ReturnType<typeof nextSettingsAfterHints>): void {
    appSession().settings = next;
    // The board behind this screen draws its hints from the settings: tell it (the hints toggle, the pad's look).
    notifyHintSettingsChanged();
    this.#draw();
  }

  /** The Hint size row's new value (a tap or drag on the track, a step): saved and the hints on the board resized. */
  #setHintSize(value: number): void {
    const current = appSession().settings;
    if (current.glyphSize !== value) appSession().settings = nextSettingsAfterHintSize(current, value);
    notifyHintSettingsChanged();
    this.#draw();
  }

  #heard(detail: ControlsEventDetail): void {
    if (this.#motion.leaving) return;
    const settings = appSession().settings;
    switch (detail.type) {
      case "back":
        return this.#close();
      case "tab":
        return this.#setTab(detail.id);
      case "choose":
        if (detail.row === "labels") this.#set(nextSettingsAfterPadFamily(settings, detail.value as never));
        else if (detail.row === "source") this.#set(nextSettingsAfterGlyphSource(settings, detail.value as never));
        else this.#set(nextSettingsAfterKeyboardHand(settings, detail.value as never));
        return;
      case "toggle":
        return this.#set(
          detail.row === "nintendo" ? nextSettingsAfterNintendo(settings) : nextSettingsAfterHints(settings),
        );
      case "hint-slide":
        return this.#setHintSize(glyphSizeAtTrack(detail.share, { x: 0, width: 1 }));
      case "hint-step":
        return this.#setHintSize(steppedGlyphSize(settings.glyphSize, detail.direction));
    }
  }

  #draw(): void {
    const mounted = this.#mounted;
    if (this.#motion.leaving || !mounted) return;
    const { region, element } = mounted;
    const { width, height } = this.scale.gameSize;
    const stamp = ++this.#stamp;
    const form = formFactorFor(width, height);
    const phone = form === "phone" || form === "phoneLandscape";
    // One pad for the status line and the drawing: the last one used, else the first connected.
    const connected = connectedPad();
    const pad = inputDevice().pad ?? (connected === null ? null : detectPad(connected.id));
    const testPad = this.#tab === "controller" ? connected : null;
    this.#hasTestLine = testPad !== null;
    this.#glyphs.reset();
    const backGlyph = this.#glyphs.glyph("back", ["cancel"], "ink", 44);
    this.#glyphs.settled();
    region.setRect({ x: 0, y: 0, width, height });
    element.model = composeControls({
      settings: appSession().settings,
      tab: this.#tab as ControlsTabId,
      phone,
      pad,
      connectedId: connected?.id ?? null,
      testMapping: testPad?.mapping ?? null,
      inputSeen: this.#inputSeen,
      backLabel: phone ? "◂" : "◂ " + t("guide.back"),
      backGlyph: hintGlyphOf(backGlyph),
    });
    this.#motion.enter(this, { scrim: [], panels: this.#anchor ? [this.#anchor] : [] });
    void renderDeep(element).then(() => {
      if (stamp !== this.#stamp || !this.#mounted) return;
      const stops = focusStopsOf(element, (target) => region.rectOf(target));
      // The Hint size row steps with left and right on the pad and keyboard.
      const size = stops.get("row:hintSize");
      if (size)
        stops.set("row:hintSize", {
          ...size,
          adjust: (direction) => this.#setHintSize(steppedGlyphSize(appSession().settings.glyphSize, direction)),
        } satisfies FocusStop);
      const order = [
        "back",
        "tab:controller",
        "tab:keyboard",
        ...[...stops.keys()].filter((key) => key.startsWith("row:")),
      ];
      this.#route?.set(
        order.filter((key) => stops.has(key)),
        stops,
      );
    });
  }
}

/** The Hint size slider element, through the page's open shadow roots. */
function mountedSlider(page: HTMLElement | undefined): HTMLElement | null {
  return (
    page?.shadowRoot
      ?.querySelector("mc-controls-settings")
      ?.shadowRoot?.querySelector<HTMLElement>("mc-volume-slider") ?? null
  );
}
