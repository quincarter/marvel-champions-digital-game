/**
 * The music player (#191), opened from the music button in the top bar (`scenes/music-button.ts`): what is playing,
 * Shuffle and Next, and the songs earned so far, each a tap away. What is earned and the shuffle order are
 * `view/music-player.ts`'s; the playing is the music controller's (`audio/music-controller.ts`).
 *
 * On a tablet or desktop it is a popover hanging from the music button, closed by the button, a tap outside, ✕ or Esc.
 * On a phone it fills the screen under the top bar, with Back at its top (and the music button and Esc still close it).
 *
 * While it is up, the screens under it take no input, and get it back when it closes, the same rule "Report an issue"
 * follows. The top bar's chrome buttons stay live above it.
 *
 * The scene mounts `mc-music-player` (`@mc/ui`: now-playing, controls, volume slider, track list) as an overlay region,
 * sets its model (`view/music-player-model.ts`) and handles its events; a Lit screen under it (Title's menu on a
 * tablet or desktop) stays shown instead of hiding.
 */
import Phaser from "phaser";
import { ActivationGate } from "../dom/activation-gate.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { renderDeep } from "../dom/element-render.js";
import { focusStopsOf } from "../dom/element-stops.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { shownMusicButton } from "../ui/music-slot.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { musicPlayerModelOf } from "../view/music-player-model.js";
import { volumeAtTrack, steppedVolume, earnedSongsOf, lockedSongCount, type PlayerSong } from "../view/music-player.js";
import { clampMusicVolume } from "../settings.js";
import { extras } from "../progression/progression.js";
import { appSession } from "../session.js";
import { hasDesktopWindow } from "../platform/desktop-window.js";
import {
  followsWindowsMixer,
  knownMixerVolume,
  onMixerChange,
  readMixerVolume,
  writeMixerVolume,
} from "../platform/app-volume.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { CHROME_SCENES, SCENES } from "./keys.js";

export class MusicPlayerOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-music-player"]> | null = null;
  #glyphs!: ControlGlyphs;
  /** The input this panel turned off, to turn back on when it closes (see `scenes/report-issue.ts`). */
  #disabled: { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[] = [];
  #unsubscribe: (() => void) | null = null;
  #alive = false;
  /** The songs drawn now, for LB / RB. */
  #songs: readonly PlayerSong[] = [];
  /** The volume shown: the Windows mixer's, in the Windows app, else the music volume setting. */
  #volume = 100;
  #changedAt = 0;
  #dragging = false;
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.musicPlayer);
  }

  create(): void {
    this.#alive = true;
    this.#disabled = this.scene.manager
      .getScenes(true)
      .filter((scene) => scene !== this && !CHROME_SCENES.has(scene.scene.key) && scene.input)
      .map((scene) => ({ scene, pointer: scene.input.enabled, keyboard: scene.input.keyboard?.enabled === true }))
      .filter(({ pointer, keyboard }) => pointer || keyboard);
    for (const { scene, pointer, keyboard } of this.#disabled) {
      if (pointer) scene.input.enabled = false;
      if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
    // Under the panel Phaser still hits a press: this shield keeps it from reaching the screen under.
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const mounted = mountElement(this, "mc-music-player", { x: 0, y: 0, width, height }, { overlay: true });
    this.#mounted = mounted;
    const gate = new ActivationGate(this);
    const { element } = mounted;
    element.addEventListener("mc-activate", (event) => {
      const { key } = (event as CustomEvent<{ key: string }>).detail;
      if (gate.take()) this.#press(key);
    });
    element.addEventListener("mc-slide", (event) => {
      const { share, commit } = (event as CustomEvent<{ share: number; commit: boolean }>).detail;
      this.#dragging = !commit;
      this.#setVolume(volumeAtTrack(share, { x: 0, width: 1 }), commit);
    });
    element.addEventListener("mc-step", (event) => {
      const { direction } = (event as CustomEvent<{ direction: -1 | 1 }>).detail;
      this.#setVolume(steppedVolume(this.#volume, direction), true);
    });
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // B / Esc / Q close it; A presses the focused control, or Play / Pause with nothing focused.
      onCancel: () => this.scene.stop(),
      primary: () => "pause",
      // LB / RB (and R / F, [ / ]) play the previous / next song; X (G) is Shuffle. The list scrolls with the stick.
      onTab: (direction) => this.#step(direction),
      onToggle: () => this.#stops.get("shuffle")?.activate(),
      onScroll: (_dx, dy) => this.#mounted?.element.scroller?.scrollBy({ top: dy }),
    });
    const offTrack = appSession().music?.onTrackStart(() => this.#redrawSoon());
    const offPause = appSession().music?.onPauseChange(() => this.#redrawSoon());
    const mixer = followsWindowsMixer();
    this.#volume = clampMusicVolume(mixer ? (knownMixerVolume() ?? 100) : appSession().settings.musicVolume);
    // The Windows volume mixer can move while the player is open: read it now, then follow the shell's change events,
    // except while the slider is in the hand or its last change is still on its way.
    const show = (read: number | null): void => {
      if (!this.#alive || read === null || read === this.#volume || this.#dragging) return;
      if (Date.now() - this.#changedAt < 1000) return;
      this.#volume = read;
      this.#draw();
    };
    if (mixer) void readMixerVolume().then(show);
    const offMixer = mixer ? onMixerChange(({ volume }) => show(volume)) : null;
    this.#unsubscribe = () => {
      offTrack?.();
      offPause?.();
      offMixer?.();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      gate.destroy();
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#glyphs.dispose();
      this.#mounted = null;
      for (const { scene, pointer, keyboard } of this.#disabled) {
        if (!scene.sys.isActive()) continue;
        if (pointer) scene.input.enabled = true;
        if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
      this.#disabled = [];
    });
    this.#draw();
  }

  /** What a control's key does: the buttons, a song row, a tap outside the panel. */
  #press(key: string): void {
    const music = appSession().music;
    const session = appSession();
    if (key === "close" || key === "outside") this.scene.stop();
    else if (key === "shuffle" || key === "next") {
      if (this.#songs.length === 0) return;
      if (key === "next") music?.next();
      else {
        const next = { ...session.settings, musicShuffle: !session.settings.musicShuffle };
        music?.syncSettings(next);
        session.settings = next;
      }
      this.#draw();
    } else if (key === "pause") {
      if (!music) return;
      if (music.paused()) music.resume();
      else music.pause();
      this.#draw();
    } else if (key.startsWith("song:")) {
      const song = this.#songs.find((one) => `song:${one.id}` === key);
      if (song) this.#play(song);
    }
  }

  #redrawSoon(): void {
    if (!this.#alive) return;
    this.time.delayedCall(0, () => this.#draw());
  }

  /** Plays the song before or after the one playing in the earned list, wrapping; the first (last) when none is. */
  #step(direction: 1 | -1): void {
    const songs = this.#songs;
    const music = appSession().music;
    if (!music || songs.length === 0) return;
    // RB is the Next button's twin: with Shuffle on it takes the shuffle's own pick.
    if (direction === 1 && appSession().settings.musicShuffle) {
      music.next();
      return;
    }
    const at = songs.findIndex((song) => song.track.key === music.nowPlaying()?.key);
    const to = at < 0 ? (direction === 1 ? 0 : songs.length - 1) : (at + direction + songs.length) % songs.length;
    this.#play(songs[to]!);
    this.#stops.get(`song:${songs[to]!.id}`)?.ensureVisible?.();
  }

  #play(song: PlayerSong): void {
    const music = appSession().music;
    if (!music || music.nowPlaying()?.key === song.track.key) return;
    music.playTrack(song.track);
    this.#draw();
  }

  /** Heard now; saved only when `save` (a drag saves once, on release). The mixer is the Windows app's own slider. */
  #setVolume(volume: number, save: boolean): void {
    const session = appSession();
    this.#volume = clampMusicVolume(volume);
    if (followsWindowsMixer()) {
      this.#changedAt = Date.now();
      writeMixerVolume(this.#volume);
    } else {
      const next = { ...session.settings, musicVolume: this.#volume };
      session.music?.syncSettings(next);
      if (save) session.settings = next;
    }
    this.#draw();
  }

  #draw(): void {
    const mounted = this.#mounted;
    if (!mounted || !this.#alive) return;
    const { region, element } = mounted;
    const { width, height } = this.scale.gameSize;
    region.setRect({ x: 0, y: 0, width, height });
    const form = formFactorFor(width, height);
    const current = extras();
    this.#songs = earnedSongsOf(current);
    const music = appSession().music;
    this.#glyphs.reset();
    const g = this.#glyphs;
    element.model = musicPlayerModelOf({
      screen: { width, height },
      phone: form === "phone" || form === "phoneLandscape",
      icon: shownMusicButton() ?? { x: width - 104, y: 5, width: 44, height: 34 },
      songs: this.#songs,
      locked: lockedSongCount(current),
      playing: music?.nowPlaying() ?? null,
      paused: music?.paused() ?? false,
      shuffle: appSession().settings.musicShuffle,
      volume: this.#volume,
      withSlider: hasDesktopWindow() || form === "desktop",
      glyphs: Object.fromEntries(
        [
          ["close", "cancel"],
          ["shuffle", "guide"],
          ["next", "zoneNext"],
          ["pause", "activate"],
        ].flatMap(([key, id]) => {
          const glyph = g.glyph(key!, [id as "cancel"], "paper", 40);
          return glyph ? [[key!, glyph]] : [];
        }),
      ),
    });
    g.settled();
    void renderDeep(element).then(() => {
      if (this.#mounted !== mounted) return;
      this.#stops = focusStopsOf(element, (target) => region.rectOf(target));
      const order = [...this.#stops.keys()];
      this.#route?.set(order, this.#stops);
      this.#exposeDebug(region.rectOf.bind(region), element);
    });
  }

  /** Headless click-through hook only: the player's controls where they are drawn now, for the e2e specs. */
  #exposeDebug(rectOf: (target: Element) => Rect, element: HTMLElementTagNameMap["mc-music-player"]): void {
    if (!import.meta.env.DEV) return;
    const rect = (target: Element | null): Rect | null => (target ? rectOf(target) : null);
    (window as unknown as { __mcMusicPlayerDebug?: unknown }).__mcMusicPlayerDebug = {
      stopRect: (id: string): Rect | null => {
        const stop = this.#stops.get(id);
        if (!stop) return null;
        return typeof stop.rect === "function" ? stop.rect() : stop.rect;
      },
      volumeRect: (): Rect | null => rect(element.volumeTrack),
      listRect: (): Rect | null => rect(element.scroller),
      paused: (): boolean => appSession().music?.paused() ?? false,
      nowPlaying: (): string | null => appSession().music?.nowPlaying()?.key ?? null,
      volume: (): number => appSession().settings.musicVolume,
    };
  }
}
