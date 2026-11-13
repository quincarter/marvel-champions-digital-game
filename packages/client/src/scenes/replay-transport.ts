/**
 * The replay transport (issue #693): the bar over the Board's action bar zone while a saved game is watched back like a
 * video. Play / pause, step, previous and next round or phase, start and end, speed, a seek bar with round markers that
 * is dragged or tapped, the position, Export replay, Export log and Exit. A banner above it says when the replay was
 * made on another version, plays differently from some command on, or stops short.
 *
 * It decides nothing about the game: `ReplayHost` rebuilds each position (`replay/replay-host.ts`) and the Board draws
 * it. A step publishes that command's events, so the Board animates it as it was played; a seek publishes the table
 * at the new position and nothing to animate. Autoplay steps one command per interval and holds its clock while the
 * previous step is still in flight, the Board is still animating, or the villain-phase walkthrough is still telling the
 * phase (`BoardScene.replayIdle`).
 *
 * Input: Space plays and pauses, Left / Right step, Shift + them or [ ] jump a moment, Home / End, S speed, E export,
 * Escape leaves. On a pad: A play / pause, LB / RB step, LT / RT moment, Y speed, X export, R3 export log, View / Start
 * to the start / end, B leaves, and the d-pad or left stick scrubs (held, it repeats and speeds up). Presses fire through
 * `McButton` / `onTap`; the seek bar is a drag, which seeks on press and keeps seeking as the pointer moves.
 */
import Phaser from "phaser";
import { deliverGameLog, deliverReplayFile } from "../replay/replay-files.js";
import type { ReplayHost, ReplayPositionState } from "../replay/replay-host.js";
import { activeReplay } from "../replay/replay-mode.js";
import { onLanguageChange } from "../language-change.js";
import { t } from "../i18n/translate.js";
import { accent, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints, type CustomSpecs } from "../ui/glyph-hints.js";
import { onTap, tapId } from "../ui/tap.js";
import { fitTight, McButton, paintPanel } from "../ui/widgets.js";
import { skin, textStyle, type WidgetKind } from "../ui/theme.js";
import { padButtonGlyph } from "../view/input-glyph-model.js";
import { detectPlatform } from "../platform/platform.js";
import { replayLinkOf, uploadReplay, type ReplayLinkFailure } from "../replay/replay-link.js";
import { readBarOnTop, writeBarOnTop } from "../view/replay-bar-pref.js";
import type { Rect } from "../view/layout.js";
import {
  STOPPED,
  bannerOf,
  fractionOf,
  nextMoment,
  nextSpeed,
  playFrom,
  positionAtX,
  previousMoment,
  roundAt,
  scrubSteps,
  seekMarkers,
  stepDelayMs,
  tickAutoPlay,
  transportLayout,
  type AutoPlay,
  type ReplaySpeed,
  type TransportControl,
  type TransportLayout,
} from "../view/replay-transport-model.js";
import type { BoardScene } from "./board.js";
import { exitReplay } from "./replay-entry.js";
import { SCENES } from "./keys.js";

/** The overlays that own the keyboard and the pad while they are up. */
const OWNS_INPUT = [
  SCENES.settings,
  SCENES.rules,
  SCENES.controls,
  SCENES.pause,
  SCENES.inspect,
  SCENES.pileView,
  SCENES.deckLeft,
  SCENES.teamUpInfo,
  SCENES.evidence,
  SCENES.saveData,
  SCENES.syncData,
  SCENES.unlocks,
] as const;

/** Standard-layout pad buttons, by what they do here. */
const PAD = {
  play: 0,
  exit: 1,
  export: 2,
  speed: 3,
  back: 4,
  forward: 5,
  prevMoment: 6,
  nextMoment: 7,
  start: 8,
  end: 9,
  exportLog: 11,
  /** Left stick click: moves a phone's bar between the bottom and the top. */
  move: 10,
  /** D-pad up: shares the replay as a link. */
  share: 12,
  left: 14,
  right: 15,
} as const;

const KEYS: Readonly<Partial<Record<TransportControl, string>>> = {
  play: "Space",
  back: "←",
  forward: "→",
  prevMoment: "[",
  nextMoment: "]",
  start: "Home",
  end: "End",
  speed: "S",
  export: "E",
  exit: "Esc",
  move: "M",
  share: "L",
};

const PAD_OF: Readonly<Record<TransportControl, number>> = {
  play: PAD.play,
  back: PAD.back,
  forward: PAD.forward,
  prevMoment: PAD.prevMoment,
  nextMoment: PAD.nextMoment,
  start: PAD.start,
  end: PAD.end,
  speed: PAD.speed,
  export: PAD.export,
  exportLog: PAD.exportLog,
  exit: PAD.exit,
  move: PAD.move,
  share: PAD.share,
};

const GLYPH_HEIGHT = 12;

type IconId = "play" | "pause" | "back" | "forward" | "prevMoment" | "nextMoment" | "start" | "end" | "up" | "down";

function triangle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, dir: 1 | -1): void {
  g.fillTriangle(cx - dir * size * 0.6, cy - size, cx - dir * size * 0.6, cy + size, cx + dir * size * 0.8, cy);
}

function paintIcon(g: Phaser.GameObjects.Graphics, icon: IconId, rect: Rect, color: number, alpha: number): void {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2 - 2;
  const s = Math.min(rect.width, rect.height) * 0.2;
  g.fillStyle(color, alpha);
  switch (icon) {
    case "play":
      triangle(g, cx, cy, s * 1.25, 1);
      break;
    case "pause":
      g.fillRect(cx - s * 0.95, cy - s * 1.1, s * 0.7, s * 2.2);
      g.fillRect(cx + s * 0.25, cy - s * 1.1, s * 0.7, s * 2.2);
      break;
    case "back":
      triangle(g, cx, cy, s, -1);
      break;
    case "forward":
      triangle(g, cx, cy, s, 1);
      break;
    case "prevMoment":
      triangle(g, cx - s * 0.7, cy, s * 0.85, -1);
      triangle(g, cx + s * 0.7, cy, s * 0.85, -1);
      break;
    case "nextMoment":
      triangle(g, cx - s * 0.7, cy, s * 0.85, 1);
      triangle(g, cx + s * 0.7, cy, s * 0.85, 1);
      break;
    case "up":
      g.fillTriangle(cx - s * 1.1, cy + s * 0.7, cx + s * 1.1, cy + s * 0.7, cx, cy - s * 0.9);
      break;
    case "down":
      g.fillTriangle(cx - s * 1.1, cy - s * 0.7, cx + s * 1.1, cy - s * 0.7, cx, cy + s * 0.9);
      break;
    case "start":
      g.fillRect(cx - s * 1.3, cy - s, s * 0.45, s * 2);
      triangle(g, cx + s * 0.3, cy, s, -1);
      break;
    case "end":
      g.fillRect(cx + s * 0.85, cy - s, s * 0.45, s * 2);
      triangle(g, cx - s * 0.3, cy, s, 1);
      break;
  }
}

/** A control drawn as an icon: the design's own button panel with a shape in it, a pointer cursor, a tap that fires on release. */
class IconButton {
  readonly #g: Phaser.GameObjects.Graphics;
  readonly #zone: Phaser.GameObjects.Zone;
  readonly #rect: Rect;
  readonly #kind: WidgetKind;
  readonly #icon: IconId;
  readonly #enabled: boolean;
  #hovered = false;

  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    kind: WidgetKind,
    icon: IconId,
    enabled: boolean,
    activate: () => void,
    id: string,
    onTip: ((over: boolean) => void) | null = null,
  ) {
    this.#rect = rect;
    this.#kind = kind;
    this.#icon = icon;
    this.#enabled = enabled;
    this.#g = scene.add.graphics();
    this.#zone = scene.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: enabled });
    this.#zone.on("pointerover", () => {
      this.#hovered = true;
      this.#paint();
      onTip?.(true);
    });
    this.#zone.on("pointerout", () => {
      this.#hovered = false;
      this.#paint();
      onTip?.(false);
    });
    onTap(this.#zone, () => (enabled ? activate() : undefined), tapId("replay", rect, id));
    this.#paint();
  }

  #paint(): void {
    const state = !this.#enabled ? "unavailable" : this.#hovered ? "hover" : "rest";
    this.#g.clear();
    paintPanel(this.#g, this.#rect, this.#kind, state);
    const s = skin(this.#kind, state);
    paintIcon(this.#g, this.#icon, this.#rect, s.text, s.textAlpha);
  }

  destroy(): void {
    this.#g.destroy();
    this.#zone.destroy();
  }
}

function isAbort(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && (cause as { name?: unknown }).name === "AbortError";
}

export class ReplayTransportOverlay extends Phaser.Scene {
  #host: ReplayHost | null = null;
  #state: ReplayPositionState | null = null;
  #auto: AutoPlay = STOPPED;
  #speed: ReplaySpeed = 1;
  #busy = 0;
  #drag: { readonly pointerId: number; position: number } | null = null;
  #track: Rect | null = null;
  #layout: TransportLayout | null = null;
  #drawnKey = "";
  #flash: string | null = null;
  #hints!: GlyphHints;
  #buttons: McButton[] = [];
  #icons: IconButton[] = [];
  #padDown = new Map<number, boolean[]>();
  #scrub = { dir: 0 as -1 | 0 | 1, heldMs: 0, lastMs: -1 };
  /** False once the scene is shutting down: a request that fails because the replay closed is then no error. */
  #alive = false;
  /** A phone's bar is at the top of the screen (`view/replay-bar-pref.ts`). */
  #barOnTop = false;
  #tip: Phaser.GameObjects.GameObject[] = [];
  /** The replay is being uploaded for a link. */
  #sharing = false;

  constructor() {
    super(SCENES.replayTransport);
  }

  create(): void {
    const host = activeReplay();
    if (!host) {
      this.scene.stop();
      return;
    }
    this.#host = host;
    this.#alive = true;
    this.#barOnTop = readBarOnTop();
    this.#tip = [];
    this.#sharing = false;
    this.#auto = STOPPED;
    this.#speed = 1;
    this.#busy = 0;
    this.#drag = null;
    this.#drawnKey = "";
    this.#flash = null;
    this.#hints = new GlyphHints(this);
    // A pad button held as this opens (the A that chose "Watch replay") is not a press here.
    this.#padDown.clear();
    this.#readPads();
    const unPosition = host.onPosition((state) => {
      this.#state = state;
      this.#draw();
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    const unLanguage = onLanguageChange(() => this.#draw());
    this.input.keyboard?.on("keydown", this.#onKey, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.#onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.#endDrag, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#endDrag, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      unPosition();
      unLanguage();
      this.scale.off("resize", onResize, this);
      this.input.keyboard?.off("keydown", this.#onKey, this);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.#onMove, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.#endDrag, this);
      this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.#endDrag, this);
      this.#hints.dispose();
      this.#clear();
      this.#host = null;
      if (import.meta.env.DEV) delete (globalThis as { __mcReplayDebug?: unknown }).__mcReplayDebug;
    });
    if (import.meta.env.DEV) {
      (globalThis as { __mcReplayDebug?: unknown }).__mcReplayDebug = {
        state: () => ({ position: this.#state?.position ?? 0, playing: this.#auto.playing, speed: this.#speed }),
        rect: (id: TransportControl | "seek") =>
          id === "seek" ? (this.#layout?.seek ?? null) : (this.#layout?.controls.get(id) ?? null),
        togglePlay: () => this.#togglePlay(),
        step: (forward: boolean) => (forward ? this.#stepForward() : this.#stepBack()),
        seek: (n: number) => this.#seek(n),
      };
    }
    this.#draw();
  }

  override update(_time: number, delta: number): void {
    const host = this.#host;
    const state = this.#state;
    if (!host || !state) return;
    const board = this.#board();
    if (this.#placementKey(board) !== this.#drawnKey) this.#draw();
    this.#pollPads(delta);
    const wasPlaying = this.#auto.playing;
    const waiting = this.#busy > 0 || this.#drag !== null || !(board?.replayIdle() ?? true);
    const next = tickAutoPlay(this.#auto, delta, {
      speed: this.#speed,
      waiting,
      position: state.position,
      length: state.info.length,
    });
    this.#auto = next.state;
    if (next.step) this.#settle(this.#stepForward().then((moved) => !moved && this.#stop()));
    if (wasPlaying !== this.#auto.playing) this.#draw();
  }

  /** Swallows what a request that outlived its replay throws; any other failure is logged, never unhandled. */
  #settle(job: Promise<unknown>): void {
    job.catch((cause: unknown) => {
      if (this.#alive && activeReplay() === this.#host) console.warn("replay", cause);
    });
  }

  /** The bar's rect and the title bar's, as the board has them now: what a redraw is keyed on. */
  #placementKey(board: BoardScene | null): string {
    const title = board?.replayTitleBar() ?? null;
    const bar = board?.replayBarRect(title !== null && this.#barOnTop) ?? null;
    const of = (rect: Rect | null): string => (rect ? `${rect.x},${rect.y},${rect.width},${rect.height}` : "-");
    return `${of(bar)}|${of(title)}|${this.#barOnTop}`;
  }

  #board(): BoardScene | null {
    return this.scene.isActive(SCENES.board) ? (this.scene.get(SCENES.board) as BoardScene) : null;
  }

  // ---- what the controls do -------------------------------------------------------------------------------------

  #stop(): void {
    if (!this.#auto.playing) return;
    this.#auto = STOPPED;
    this.#draw();
  }

  #togglePlay(): void {
    const state = this.#state;
    if (!state) return;
    if (this.#auto.playing) {
      this.#stop();
      return;
    }
    if (playFrom(state.position, state.info.length).restart) this.#settle(this.#seek(0));
    // The first step comes at once, then one per interval.
    this.#auto = { playing: true, elapsedMs: stepDelayMs(this.#speed) };
    this.#draw();
  }

  async #run<T>(job: () => Promise<T>): Promise<T> {
    this.#busy += 1;
    try {
      return await job();
    } finally {
      this.#busy -= 1;
    }
  }

  async #stepForward(): Promise<boolean> {
    const host = this.#host;
    return host ? this.#run(() => host.step()) : false;
  }

  async #stepBack(): Promise<boolean> {
    const host = this.#host;
    if (!host) return false;
    return this.#run(() => host.stepBack());
  }

  async #seek(n: number): Promise<void> {
    const host = this.#host;
    if (host) await this.#run(() => host.seek(n));
  }

  #jumpMoment(direction: 1 | -1): void {
    const state = this.#state;
    if (!state) return;
    const { moments, length } = state.info;
    this.#settle(
      this.#seek(direction > 0 ? nextMoment(moments, state.position, length) : previousMoment(moments, state.position)),
    );
  }

  #cycleSpeed(): void {
    this.#speed = nextSpeed(this.#speed);
    this.#draw();
  }

  #say(text: string): void {
    this.#flash = text;
    this.#draw();
    this.time.delayedCall(4000, () => {
      if (this.#flash !== text) return;
      this.#flash = null;
      this.#draw();
    });
  }

  async #export(kind: "replay" | "log"): Promise<void> {
    const host = this.#host;
    if (!host) return;
    try {
      if (kind === "replay") {
        const { bytes, name } = await host.exportFile();
        await deliverReplayFile(bytes, name);
      } else {
        const { text, name } = await host.exportLog();
        await deliverGameLog(text, name);
      }
    } catch (cause) {
      if (isAbort(cause)) return;
      console.warn("replay export failed", cause);
      this.#say(t("replay.exportFailed"));
    }
  }

  #exit(): void {
    this.#auto = STOPPED;
    exitReplay(this);
  }

  #act(control: TransportControl): void {
    const state = this.#state;
    switch (control) {
      case "play":
        this.#togglePlay();
        break;
      case "back":
        this.#stop();
        this.#settle(this.#stepBack());
        break;
      case "forward":
        this.#stop();
        this.#settle(this.#stepForward());
        break;
      case "prevMoment":
        this.#stop();
        this.#jumpMoment(-1);
        break;
      case "nextMoment":
        this.#stop();
        this.#jumpMoment(1);
        break;
      case "start":
        this.#stop();
        this.#settle(this.#seek(0));
        break;
      case "end":
        this.#stop();
        if (state) this.#settle(this.#seek(state.info.length));
        break;
      case "speed":
        this.#cycleSpeed();
        break;
      case "export":
        this.#settle(this.#export("replay"));
        break;
      case "exportLog":
        this.#settle(this.#export("log"));
        break;
      case "exit":
        this.#exit();
        break;
      case "share":
        this.#settle(this.#share());
        break;
      case "move":
        if (this.#layout?.kind !== "phone") break;
        this.#barOnTop = !this.#barOnTop;
        writeBarOnTop(this.#barOnTop);
        this.#draw();
        break;
    }
  }

  /** The failure wording of a share that did not make a link. */
  #failureText(failure: ReplayLinkFailure): string {
    switch (failure) {
      case "rate-limited":
        return t("replay.link.rateLimited");
      case "too-large":
        return t("replay.link.tooLarge");
      case "not-found":
        return t("replay.link.gone");
      case "unavailable":
        return t("replay.link.offline");
    }
  }

  /**
   * Share link: uploads the replay, then hands the link to the system's share sheet where there is one (an
   * AbortError is the player closing it), else copies it and says so in the banner.
   */
  async #share(): Promise<void> {
    const host = this.#host;
    if (!host || this.#sharing) return;
    this.#sharing = true;
    this.#draw();
    try {
      const { bytes } = await host.exportFile();
      const uploaded = await uploadReplay(bytes);
      if (!uploaded.ok) {
        this.#say(this.#failureText(uploaded.failure));
        return;
      }
      const url = replayLinkOf(uploaded.value, detectPlatform() !== "web");
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ url, title: t("replay.title") });
          return;
        } catch (cause) {
          if (isAbort(cause)) return;
          // A share the browser refused (the press is too old by now) falls back to copying.
        }
      }
      await navigator.clipboard.writeText(url);
      this.#say(t("replay.link.copied"));
    } catch (cause) {
      if (isAbort(cause) || !this.#alive) return;
      console.warn("replay share failed", cause);
      this.#say(t("replay.link.offline"));
    } finally {
      this.#sharing = false;
      if (this.#alive) this.#draw();
    }
  }

  // ---- input ----------------------------------------------------------------------------------------------------

  #blocked(): boolean {
    return OWNS_INPUT.some((key) => this.scene.isActive(key));
  }

  /** The villain-phase walkthrough takes Escape (it skips) and Enter before the transport does. */
  #walkthroughOwns(code: string): boolean {
    return this.scene.isActive(SCENES.villainPhase) && (code === "Escape" || code === "Enter");
  }

  #onKey(event: KeyboardEvent): void {
    if (this.#blocked() || this.#walkthroughOwns(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    const control = ((): TransportControl | null => {
      switch (event.code) {
        case "Space":
          return "play";
        case "ArrowLeft":
          return event.shiftKey ? "prevMoment" : "back";
        case "ArrowRight":
          return event.shiftKey ? "nextMoment" : "forward";
        case "BracketLeft":
          return "prevMoment";
        case "BracketRight":
          return "nextMoment";
        case "Home":
          return "start";
        case "End":
          return "end";
        case "KeyS":
          return "speed";
        case "KeyE":
          return "export";
        case "KeyL":
          return "share";
        case "KeyM":
          return "move";
        case "Escape":
          return "exit";
        default:
          return null;
      }
    })();
    if (!control) return;
    event.preventDefault();
    if (event.repeat && control !== "back" && control !== "forward") return;
    this.#act(control);
  }

  #readPads(): readonly { readonly index: number; readonly pad: Gamepad }[] {
    const pads = globalThis.navigator?.getGamepads?.() ?? [];
    const out: { index: number; pad: Gamepad }[] = [];
    for (const pad of pads) {
      if (!pad?.connected || (pad.mapping && pad.mapping !== "standard")) continue;
      out.push({ index: pad.index, pad });
      this.#padDown.set(
        pad.index,
        pad.buttons.map((button) => button.pressed || button.value > 0.5),
      );
    }
    return out;
  }

  #pollPads(delta: number): void {
    const blocked = this.#blocked();
    const before = new Map(this.#padDown);
    let dir: -1 | 0 | 1 = 0;
    for (const { index, pad } of this.#readPads()) {
      const was = before.get(index) ?? [];
      const now = this.#padDown.get(index) ?? [];
      const edge = (button: number): boolean => now[button] === true && was[button] !== true;
      // While the villain walkthrough is up the pad is its own (A / B, X, Y, the bumpers and triggers for the defend's
      // picks, View, Start and the d-pad all do something there): nothing here fires until it closes.
      if (blocked || this.scene.isActive(SCENES.villainPhase)) continue;
      if (edge(PAD.play)) this.#act("play");
      if (edge(PAD.exit)) this.#act("exit");
      if (edge(PAD.move)) this.#act("move");
      if (edge(PAD.share)) this.#act("share");
      if (edge(PAD.export)) this.#act("export");
      if (edge(PAD.exportLog)) this.#act("exportLog");
      if (edge(PAD.speed)) this.#act("speed");
      if (edge(PAD.back)) this.#act("back");
      if (edge(PAD.forward)) this.#act("forward");
      if (edge(PAD.prevMoment)) this.#act("prevMoment");
      if (edge(PAD.nextMoment)) this.#act("nextMoment");
      if (edge(PAD.start)) this.#act("start");
      if (edge(PAD.end)) this.#act("end");
      const stick = pad.axes[0] ?? 0;
      if (now[PAD.left] === true || stick < -0.5) dir = -1;
      else if (now[PAD.right] === true || stick > 0.5) dir = 1;
    }
    this.#scrubBy(dir, delta);
  }

  /** The d-pad / left stick: held, it moves the position a step at a time and then faster, never a page. */
  #scrubBy(dir: -1 | 0 | 1, delta: number): void {
    const state = this.#state;
    if (dir === 0 || !state) {
      this.#scrub = { dir: 0, heldMs: 0, lastMs: -1 };
      return;
    }
    if (dir !== this.#scrub.dir) this.#scrub = { dir, heldMs: 0, lastMs: -1 };
    else this.#scrub.heldMs += delta;
    const steps = scrubSteps(this.#scrub.heldMs, this.#scrub.lastMs);
    if (steps === 0) return;
    this.#scrub.lastMs = this.#scrub.heldMs;
    this.#stop();
    const target = Math.max(0, Math.min(state.info.length, state.position + dir * steps));
    if (target !== state.position) this.#settle(this.#seek(target));
  }

  #beginDrag(pointer: Phaser.Input.Pointer): void {
    const track = this.#track;
    const state = this.#state;
    if (!track || !state) return;
    this.#stop();
    this.#drag = { pointerId: pointer.id, position: state.position };
    this.#dragTo(pointer.x);
  }

  #onMove(pointer: Phaser.Input.Pointer): void {
    if (this.#drag && pointer.id === this.#drag.pointerId) this.#dragTo(pointer.x);
  }

  #dragTo(x: number): void {
    const track = this.#track;
    const state = this.#state;
    const drag = this.#drag;
    if (!track || !state || !drag) return;
    const position = positionAtX(x, track.x, track.width, state.info.length);
    if (position === drag.position && position === state.position) return;
    drag.position = position;
    this.#settle(this.#seek(position));
    this.#draw();
  }

  #endDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.#drag || pointer.id !== this.#drag.pointerId) return;
    this.#drag = null;
    this.#draw();
  }

  // ---- drawing --------------------------------------------------------------------------------------------------

  #clear(): void {
    for (const button of this.#buttons) button.destroy();
    for (const icon of this.#icons) icon.destroy();
    this.#buttons = [];
    this.#icons = [];
  }

  #glyphs(control: TransportControl): CustomSpecs {
    return (set, snapshot) => {
      if (set === "keyboard") {
        const key = KEYS[control];
        return key ? [{ kind: "key", label: key, name: t("replay.keyName", { key }) }] : null;
      }
      const glyph = padButtonGlyph(PAD_OF[control], snapshot.state, snapshot.settings);
      return glyph ? [glyph] : null;
    };
  }

  /** A glyph on the control: along its bottom edge for an icon, over its top edge for a word (which fills the middle). */
  #hint(control: TransportControl, rect: Rect, onTop = false): void {
    this.#hints.custom(
      this.#glyphs(control),
      GLYPH_HEIGHT,
      ({ width, height }) => ({
        x: rect.x + (rect.width - width) / 2,
        y: onTop ? rect.y : rect.y + rect.height - height / 2 - 1,
      }),
      { ground: "ink" },
    );
  }

  #draw(): void {
    const host = this.#host;
    const state = this.#state;
    this.#clear();
    destroyChildren(this);
    this.#hints.reset();
    const board = this.#board();
    this.#tip = [];
    const titleBar = board?.replayTitleBar() ?? null;
    const onTop = titleBar !== null && this.#barOnTop;
    const bar = board?.replayBarRect(onTop) ?? null;
    this.#drawnKey = this.#placementKey(board);
    if (!host || !state || !bar) return;
    const { info } = state;
    const layout = transportLayout(bar, { titleBar, onTop });
    this.#layout = layout;
    this.#track = layout.track;

    // The bar's own ground, and a rule along its top edge.
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);
    ground
      .fillStyle(surface.paperOnInk.hex, 0.35)
      .fillRect(bar.x, onTop ? bar.y + bar.height - 1 : bar.y, bar.width, 1);
    // On a phone the title bar's own words end where play and the steps begin.
    if (layout.titleCover) {
      const cover = layout.titleCover;
      ground.fillStyle(surface.ink.hex, 1).fillRect(cover.x, cover.y, cover.width, cover.height);
    }

    this.#drawBanner(layout, info, onTop);
    this.#drawSeek(layout, state);

    const shown = this.#drag?.position ?? state.position;
    const round = roundAt(info.moments, shown, 1);
    const label = t(layout.shortLabel ? "replay.positionShort" : "replay.position", {
      round,
      at: shown,
      total: info.length,
    });
    const text = this.add
      .text(
        layout.label.x + layout.label.width / 2,
        layout.label.y + layout.label.height / 2,
        label,
        textStyle({ ...typeRole.menuButton, size: layout.shortLabel ? 13 : 15 }, surface.paperOnInk.hex),
      )
      .setOrigin(0.5, 0.5);
    fitTight(text, layout.label.width, layout.shortLabel ? 13 : 15);

    const playing = this.#auto.playing;
    const atStart = state.position <= 0;
    const atEnd = state.position >= info.length;
    const icon = (control: TransportControl, glyph: IconId, enabled: boolean, kind: WidgetKind = "onInk"): void => {
      const rect = layout.controls.get(control);
      if (!rect) return;
      this.#icons.push(
        new IconButton(
          this,
          rect,
          kind,
          glyph,
          enabled,
          () => this.#act(control),
          control,
          (over) => this.#showTip(over ? rect : null, this.#nameOf(control)),
        ),
      );
      this.#hint(control, rect);
    };
    icon("start", "start", !atStart);
    icon("prevMoment", "prevMoment", !atStart);
    icon("back", "back", !atStart);
    icon("play", playing ? "pause" : "play", info.length > 0, "primary");
    icon("forward", "forward", !atEnd);
    icon("nextMoment", "nextMoment", !atEnd);
    icon("end", "end", !atEnd);
    icon("move", onTop ? "down" : "up", true);

    const word = (control: TransportControl, labelText: string, kind: WidgetKind = "onInk", wrap = false): void => {
      const rect = layout.controls.get(control);
      if (!rect) return;
      this.#buttons.push(
        new McButton(this, {
          kind,
          label: labelText,
          type: { ...typeRole.label, size: 12 },
          rect,
          wrap,
          enabled: control !== "share" || !this.#sharing,
          onClick: () => this.#act(control),
          ...(control === "speed"
            ? { onHover: (over: boolean) => this.#showTip(over ? rect : null, this.#nameOf(control)) }
            : {}),
        }),
      );
      this.#hint(control, rect, true);
    };
    word("speed", `${this.#speed}×`);
    const narrow = layout.kind !== "row" || layout.shortLabel;
    word("share", this.#sharing ? t("replay.link.sharing") : t("replay.share"), "onInk", true);
    word("exportLog", t("replay.exportLog"), "onInk", true);
    word("export", narrow ? t("replay.exportShort") : t("replay.export"), "onInk", true);
    word("exit", t("replay.exit"));
  }

  /** What an icon control is called: its tooltip on a desktop, where a pointer hovers. */
  #nameOf(control: TransportControl): string {
    switch (control) {
      case "play":
        return t(this.#auto.playing ? "replay.pause" : "replay.play");
      case "back":
        return t("replay.stepBack");
      case "forward":
        return t("replay.stepForward");
      case "prevMoment":
        return t("replay.prevMoment");
      case "nextMoment":
        return t("replay.nextMoment");
      case "start":
        return t("replay.toStart");
      case "end":
        return t("replay.toEnd");
      case "speed":
        return t("replay.speed", { speed: this.#speed });
      case "move":
        return t(this.#barOnTop ? "replay.moveBarBottom" : "replay.moveBarTop");
      case "share":
        return t("replay.share");
      case "export":
        return t("replay.export");
      case "exportLog":
        return t("replay.exportLog");
      case "exit":
        return t("replay.exit");
    }
  }

  /** A small label by `rect` (above it, or below near the top of the screen); null takes it away. */
  #showTip(rect: Rect | null, text: string): void {
    for (const object of this.#tip) object.destroy();
    this.#tip = [];
    if (!rect) return;
    const label = this.add
      .text(0, 0, text, textStyle({ ...typeRole.rowTitle, size: 12 }, surface.ink.hex))
      .setOrigin(0.5, 0.5);
    const width = Math.min(label.width + 16, this.scale.gameSize.width - 8);
    const height = label.height + 8;
    const below = rect.y < 40;
    const x = Math.max(4, Math.min(this.scale.gameSize.width - width - 4, rect.x + rect.width / 2 - width / 2));
    const y = below ? rect.y + rect.height + 4 : rect.y - height - 4;
    const box = this.add.graphics();
    box.fillStyle(surface.paper.hex, 1).fillRect(x, y, width, height);
    box.lineStyle(1, surface.ink.hex, 1).strokeRect(x, y, width, height);
    box.setDepth(1000);
    label.setPosition(x + width / 2, y + height / 2).setDepth(1001);
    this.#tip = [box, label];
  }

  #drawBanner(layout: TransportLayout, info: ReplayPositionState["info"], onTop: boolean): void {
    const banner = bannerOf(info);
    const message = this.#flash
      ? this.#flash
      : banner
        ? t(
            banner.kind === "failure"
              ? "replay.banner.failure"
              : banner.kind === "diverged"
                ? "replay.banner.diverged"
                : banner.kind === "divergedSetup"
                  ? "replay.banner.divergedSetup"
                  : "replay.banner.otherBuild",
            { n: banner.n },
          )
        : null;
    if (!message) return;
    const rect = layout.banner;
    // Two lines on a narrow screen, so the strip is as tall as it needs to be, growing upward from the bar.
    const wide = rect.width >= 640;
    const height = wide ? rect.height : rect.height * 2 - 2;
    const strip: Rect = { x: rect.x, y: onTop ? rect.y : rect.y + rect.height - height, width: rect.width, height };
    const g = this.add.graphics();
    g.fillStyle(0xf2b01e, 1).fillRect(strip.x, strip.y, strip.width, strip.height);
    const label = this.add
      .text(
        strip.x + 8,
        strip.y + strip.height / 2,
        message,
        textStyle({ ...typeRole.rowTitle, size: 12 }, surface.inkOnHue.hex),
      )
      .setOrigin(0, 0.5)
      .setWordWrapWidth(strip.width - 16);
    if (!wide) label.setMaxLines(2);
    else fitTight(label, strip.width - 16, 12);
  }

  #drawSeek(layout: TransportLayout, state: ReplayPositionState): void {
    const { info } = state;
    const track = layout.track;
    const shown = this.#drag?.position ?? state.position;
    const fraction = fractionOf(shown, info.length);
    const g = this.add.graphics();
    g.fillStyle(surface.paperOnInk.hex, 0.28).fillRect(track.x, track.y, track.width, track.height);
    g.fillStyle(accent.heroRed.hex, 1).fillRect(track.x, track.y, Math.round(track.width * fraction), track.height);
    const midY = track.y + track.height / 2;
    for (const marker of seekMarkers(info.moments, info.length)) {
      const x = Math.round(track.x + track.width * marker.fraction);
      const half = marker.major ? track.height / 2 + 6 : track.height / 2 + 2;
      g.fillStyle(surface.paperOnInk.hex, marker.major ? 0.95 : 0.55).fillRect(x - 1, midY - half, 2, half * 2);
    }
    const thumbX = Math.round(track.x + track.width * fraction);
    g.fillStyle(surface.paperOnInk.hex, 1).fillCircle(thumbX, midY, 9);
    g.lineStyle(3, accent.heroRed.hex, 1).strokeCircle(thumbX, midY, 9);
    const zone = this.add
      .zone(layout.seek.x, layout.seek.y, layout.seek.width, layout.seek.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.#beginDrag(pointer));
    zone.on("pointerover", () => this.#showTip(this.#drag ? null : layout.seek, t("replay.seekBar")));
    zone.on("pointerout", () => this.#showTip(null, ""));
  }
}
