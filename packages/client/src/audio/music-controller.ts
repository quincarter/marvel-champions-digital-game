/**
 * Background music playback and transition management.
 *
 * Runs as a persistent, non-rendering Phaser Scene (`MusicScene`, registered with
 * `SCENES.music`) so its loader, tweens, and sound instances are never destroyed
 * by scene transitions (`Title` → `ScenarioSelect` → `Board` → `GameOver`).
 *
 * Responsibilities:
 *  - Lazy-loading audio tracks on demand into `game.cache.audio`.
 *  - Looping playback with smooth cross-fades between tracks.
 *  - Browser autoplay policy handling (Phaser WebAudioSoundManager queues sound until unlocked).
 *  - Syncing mute state with `settings.sound`.
 */

import Phaser from "phaser";
import type { Settings } from "../settings.js";
import { appSession } from "../session.js";
import { SCENES } from "../scenes/keys.js";
import {
  MUSIC_CATALOG,
  battleTrackFor,
  outcomeTrackFor,
  titleTrackFor,
  type Track,
  finaleTrackFor,
  pickTrack,
  villainTracksFor,
} from "./music-catalog.js";

/** Default BGM volume when unmuted (0.0 to 1.0). Sits cleanly under UI sound. */
export const DEFAULT_MUSIC_VOLUME = 0.45;

/** Crossfade duration in milliseconds (skipped if reduced motion is on). */
const CROSSFADE_DURATION_MS = 800;

export interface MusicController {
  playTitle(): void;
  playBattle(context: {
    readonly scenarioId?: string | undefined;
    readonly campaignId?: string | undefined;
    readonly packCode?: string | undefined;
  }): void;
  playOutcome(scenarioId: string, result: "win" | "loss" | "conceded", packCode?: string): void;
  /**
   * A campaign issue's opener: the theme of the villain about to be fought (`villainTracksFor`), carried on through
   * Setup into the game. Leaves whatever is playing alone when that villain has no battle music yet.
   */
  playVillainTheme(scenarioId: string): void;
  /** Setup: title music, unless `scenarioId`'s own theme is already up (an issue opener started it) — then that. */
  playSetup(scenarioId: string | undefined): void;
  /** The Finale screen: the campaign's `finale` track; keeps the current track when the campaign has none. */
  playFinale(campaignId: string): void;
  /** Extras' jukebox: one chosen track, looped until another screen asks for its own music. */
  playTrack(track: Track): void;
  /** The track the jukebox was last asked for, while it is still the one playing; else null. */
  jukeboxKey(): string | null;
  syncSettings(settings: Settings): void;
  stop(fadeDurationMs?: number): void;
}

export class MusicScene extends Phaser.Scene implements MusicController {
  #currentSound: Phaser.Sound.BaseSound | null = null;
  #currentKey: string | null = null;
  #targetKey: string | null = null;
  #lastTitleKey: string | null = null;
  #mode: "title" | "battle" | "outcome" | "finale" | "jukebox" | "stopped" = "stopped";
  #targetVolume = DEFAULT_MUSIC_VOLUME;

  constructor() {
    super(SCENES.music);
  }

  create(): void {
    // Nothing here is drawn, and saying so matters: `McTextInput` hides its DOM field under any *visible* scene
    // running above its own, and this one runs above every screen for the whole session (`ui/widgets.ts`).
    this.sys.setVisible(false);
    appSession().music = this;
    this.syncSettings(appSession().settings);
  }

  playTitle(): void {
    if (this.#mode === "title" && (this.#currentSound?.isPlaying || this.#targetKey !== null)) {
      return;
    }
    this.#mode = "title";
    const track = titleTrackFor(MUSIC_CATALOG, this.#lastTitleKey);
    if (track) {
      this.#lastTitleKey = track.key;
      this.#requestTrack(track);
    } else {
      this.stop();
    }
  }

  playBattle(context: {
    readonly scenarioId?: string | undefined;
    readonly campaignId?: string | undefined;
    readonly packCode?: string | undefined;
  }): void {
    // An issue opener already started this villain's theme: keep it rather than cutting to another pick.
    if (context.scenarioId && this.#isPlayingOneOf(villainTracksFor(MUSIC_CATALOG, context.scenarioId))) {
      this.#mode = "battle";
      return;
    }
    this.#mode = "battle";
    const track = battleTrackFor(MUSIC_CATALOG, context);
    if (track) {
      this.#requestTrack(track);
    } else {
      this.stop();
    }
  }

  playOutcome(scenarioId: string, result: "win" | "loss" | "conceded", packCode?: string): void {
    this.#mode = "outcome";
    const track = outcomeTrackFor(MUSIC_CATALOG, scenarioId, result, Math.random, packCode);
    if (track) {
      this.#requestTrack(track);
    } else {
      this.stop();
    }
  }

  playVillainTheme(scenarioId: string): void {
    const tracks = villainTracksFor(MUSIC_CATALOG, scenarioId);
    if (tracks.length === 0) return;
    this.#mode = "battle";
    if (this.#isPlayingOneOf(tracks)) return;
    const track = pickTrack(tracks, null);
    if (track) this.#requestTrack(track);
  }

  playSetup(scenarioId: string | undefined): void {
    if (scenarioId && this.#isPlayingOneOf(villainTracksFor(MUSIC_CATALOG, scenarioId))) return;
    this.playTitle();
  }

  /** Whether one of `tracks` is playing now, or is the one being loaded to play next. */
  #isPlayingOneOf(tracks: readonly Track[]): boolean {
    return this.#targetKey !== null && tracks.some((track) => track.key === this.#targetKey);
  }

  playFinale(campaignId: string): void {
    const track = finaleTrackFor(MUSIC_CATALOG, campaignId);
    if (!track) return;
    this.#mode = "finale";
    this.#requestTrack(track);
  }

  playTrack(track: Track): void {
    this.#mode = "jukebox";
    this.#requestTrack(track);
  }

  jukeboxKey(): string | null {
    return this.#mode === "jukebox" ? this.#targetKey : null;
  }

  syncSettings(settings: Settings): void {
    this.sound.mute = !settings.sound;
  }

  stop(fadeDurationMs = CROSSFADE_DURATION_MS): void {
    this.#mode = "stopped";
    this.#targetKey = null;
    if (!this.#currentSound) return;

    const sound = this.#currentSound;
    this.#currentSound = null;
    this.#currentKey = null;

    const reduced = appSession().settings.reducedMotion;
    const duration = reduced ? 0 : fadeDurationMs;

    if (duration <= 0) {
      sound.stop();
      sound.destroy();
    } else {
      this.tweens.add({
        targets: sound,
        volume: 0,
        duration,
        onComplete: () => {
          sound.stop();
          sound.destroy();
        },
      });
    }
  }

  #requestTrack(track: Track): void {
    if (this.#currentKey === track.key && this.#currentSound?.isPlaying) {
      return;
    }

    this.#targetKey = track.key;

    if (this.cache.audio.exists(track.key)) {
      this.#startTrack(track);
      return;
    }

    // Audio needs loading.
    this.load.audio(track.key, track.url);
    this.load.once(`filecomplete-audio-${track.key}`, () => {
      if (this.#targetKey === track.key) {
        this.#startTrack(track);
      }
    });

    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  #startTrack(track: Track): void {
    if (this.#targetKey !== track.key) return;

    const oldSound = this.#currentSound;
    this.#currentSound = null;
    this.#currentKey = track.key;

    const reduced = appSession().settings.reducedMotion;
    const duration = reduced ? 0 : CROSSFADE_DURATION_MS;

    // Fade out previous track.
    if (oldSound) {
      if (duration <= 0) {
        oldSound.stop();
        oldSound.destroy();
      } else {
        this.tweens.add({
          targets: oldSound,
          volume: 0,
          duration,
          onComplete: () => {
            oldSound.stop();
            oldSound.destroy();
          },
        });
      }
    }

    // Start new track.
    const newSound = this.sound.add(track.key, { loop: true, volume: duration > 0 ? 0 : this.#targetVolume });
    newSound.play();
    this.#currentSound = newSound;

    if (duration > 0) {
      this.tweens.add({
        targets: newSound,
        volume: this.#targetVolume,
        duration,
      });
    }
  }
}
