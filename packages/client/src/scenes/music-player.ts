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
 * It is a Lit panel over the canvas (`dom/popup-sheet.ts`, an overlay region), so a Lit screen under it (Title's menu on
 * a tablet or desktop, the top bar's art on a phone) stays shown instead of hiding. The body is `music-player-body.ts`.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { onTap } from "../ui/tap.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { shownMusicButton } from "../ui/music-slot.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { playerPanelRect, volumeAtTrack, steppedVolume, earnedSongsOf, lockedSongCount } from "../view/music-player.js";
import type { PlayerSong } from "../view/music-player.js";
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
import { FocusRoute } from "./focus-route.js";
import { CHROME_SCENES, SCENES } from "./keys.js";
import { drawMusicPlayerBody, SONGS_KEY } from "./music-player-body.js";

/** A popover appears where it hangs, with no slide of its own. */
const STILL = { x: 0, y: 0, alpha: 1, active: true } as const;

export class MusicPlayerOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;
  /** What each control does this draw, by key. */
  #actions = new Map<string, () => void>();
  /** The input this panel turned off, to turn back on when it closes (see `scenes/report-issue.ts`). */
  #disabled: { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[] = [];
  #unsubscribe: (() => void) | null = null;
  #alive = false;
  /** The songs drawn now, for LB / RB. */
  #songs: readonly PlayerSong[] = [];
  /** Shuffle's press, for X. */
  #shuffle: (() => void) | null = null;
  #slideBound = false;
  /** The song list's scroll, kept across a redraw. */
  #scrollTop = 0;
  /** The volume shown: the Windows mixer's, in the Windows app, else the music volume setting. */
  #volume = 100;
  #changedAt = 0;
  #dragging = false;
  /** Where the slider's track is on screen now, for the e2e hook. */
  #volumeRect: Rect | null = null;
  #listRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #stopRects = new Map<string, () => Rect | null>();

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
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.());
    this.#panel.follow(STILL);
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#panel.leaving,
      // B / Esc / Q close it; A presses the focused control, or Play / Pause with nothing focused.
      onCancel: () => this.#close(),
      primary: () => "pause",
      // LB / RB (and R / F, [ / ]) play the previous / next song; X (G) is Shuffle. The list scrolls with the stick.
      onTab: (direction) => this.#step(direction),
      onToggle: () => this.#shuffle?.(),
      onScroll: (_dx, dy) => this.#panel.element?.elementOf(SONGS_KEY)?.scrollBy({ top: dy }),
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
      this.scale.off("resize", onResize, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#glyphs.dispose();
      for (const { scene, pointer, keyboard } of this.#disabled) {
        if (!scene.sys.isActive()) continue;
        if (pointer) scene.input.enabled = true;
        if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
      this.#disabled = [];
    });
    this.#draw();
  }

  #close(): void {
    this.#panel.close();
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
    this.#panel.element?.elementOf(`song:${songs[to]!.id}`)?.scrollIntoView({ block: "nearest" });
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

  #bindSlider(): void {
    const element = this.#panel.element;
    if (!element || this.#slideBound) return;
    this.#slideBound = true;
    element.addEventListener("mc-slide", (event) => {
      const { share, commit } = (event as CustomEvent<{ share: number; commit: boolean }>).detail;
      this.#dragging = !commit;
      this.#setVolume(volumeAtTrack(share, { x: 0, width: 1 }), commit);
    });
    element.addEventListener("mc-step", (event) => {
      const { direction } = (event as CustomEvent<{ direction: -1 | 1 }>).detail;
      this.#setVolume(steppedVolume(this.#volume, direction), true);
    });
  }

  #draw(): void {
    if (!this.#alive) return;
    const list = this.#panel.element?.elementOf(SONGS_KEY);
    if (list) this.#scrollTop = list.scrollTop;
    destroyChildren(this);
    this.#glyphs.reset();

    const { width, height } = this.scale.gameSize;
    const phone = ["phone", "phoneLandscape"].includes(formFactorFor(width, height));
    const icon = shownMusicButton() ?? { x: width - 104, y: 5, width: 44, height: 34 };
    const current = extras();
    const songs = earnedSongsOf(current);
    this.#songs = songs;
    const panel = playerPanelRect(icon, { width, height }, phone, songs.length);
    // Under the panel Phaser still hits a press: this shield keeps it from reaching the screen under, and answers a tap
    // in a hole the panel leaves (outside the popover, over the screen's own art) as "outside".
    const shield = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    onTap(
      shield,
      (pointer) => {
        // A press on the panel reaches Phaser too (its listeners are on the window): only one off it is "outside".
        const inside =
          pointer.x >= panel.x &&
          pointer.x <= panel.x + panel.width &&
          pointer.y >= panel.y &&
          pointer.y <= panel.y + panel.height;
        if (!inside) this.#close();
      },
      "music-player-outside",
    );

    const b = this.#panel.begin(width, height, 0);
    const desktop = hasDesktopWindow() || formFactorFor(width, height) === "desktop";
    const drawn = drawMusicPlayerBody(b, this.#glyphs, {
      screen: { width, height },
      panel,
      icon,
      phone,
      songs,
      locked: lockedSongCount(current),
      playing: appSession().music?.nowPlaying() ?? null,
      paused: appSession().music?.paused() ?? false,
      shuffle: appSession().settings.musicShuffle,
      volume: this.#volume,
      withSlider: desktop,
      actions: {
        close: () => this.#close(),
        outside: () => this.#close(),
        shuffle: () => this.#toggleShuffle(),
        next: () => this.#skip(),
        pause: () => this.#togglePause(),
        step: (direction) => this.#setVolume(steppedVolume(this.#volume, direction), true),
        play: (song) => this.#play(song),
      },
    });
    this.#actions = drawn.actions;
    this.#shuffle = drawn.actions.get("shuffle") ?? null;
    this.#listRect = drawn.listRect;
    this.#panel.mount(b, width, height);
    this.#bindSlider();
    const scroller = this.#panel.element?.elementOf(SONGS_KEY);
    if (scroller) scroller.scrollTop = this.#scrollTop;
    // A stop inside the list reads its box off the panel, so it follows the scroll.
    const panelRef = this.#panel;
    const stops = new Map(
      [...drawn.stops].map(([key, stop]) => {
        if (!key.startsWith("song:")) return [key, stop] as const;
        return [
          key,
          {
            rect: () => {
              const element = panelRef.element?.elementOf(key);
              return (
                (element && panelRef.rectOf(element)) || (typeof stop.rect === "function" ? stop.rect() : stop.rect)
              );
            },
            activate: stop.activate,
            ensureVisible: () => panelRef.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
          },
        ] as const;
      }),
    );
    this.#route?.set(drawn.order, stops);
    this.#stopRects = new Map(
      [...stops].map(([key, stop]) => [key, () => (typeof stop.rect === "function" ? stop.rect() : stop.rect)]),
    );
    this.#volumeRect = drawn.volumeRect;
    this.#exposeDebug();
  }

  #toggleShuffle(): void {
    const session = appSession();
    if (this.#songs.length === 0) return;
    const next = { ...session.settings, musicShuffle: !session.settings.musicShuffle };
    session.music?.syncSettings(next);
    session.settings = next;
    this.#draw();
  }

  #skip(): void {
    if (this.#songs.length === 0) return;
    appSession().music?.next();
    this.#draw();
  }

  #togglePause(): void {
    const music = appSession().music;
    if (!music) return;
    if (music.paused()) music.resume();
    else music.pause();
    this.#draw();
  }

  /** Headless click-through hook only: the player's controls where they are drawn now, for the e2e specs. */
  #exposeDebug(): void {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __mcMusicPlayerDebug?: unknown }).__mcMusicPlayerDebug = {
      stopRect: (id: string): Rect | null => this.#stopRects.get(id)?.() ?? null,
      volumeRect: (): Rect | null => this.#volumeRect,
      listRect: (): Rect => this.#listRect,
      paused: (): boolean => appSession().music?.paused() ?? false,
      nowPlaying: (): string | null => appSession().music?.nowPlaying()?.key ?? null,
      volume: (): number => appSession().settings.musicVolume,
    };
  }
}
