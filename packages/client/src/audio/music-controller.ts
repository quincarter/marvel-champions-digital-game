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
 *  - Shuffling the songs earned in Extras (#191, `settings.musicShuffle` or the music player's Shuffle), one after
 *    another, in place of each screen's own music; and telling the music button when a song starts.
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
  interludeToStart,
  pickTrack,
  villainTracksFor,
} from "./music-catalog.js";
import { extras } from "../progression/progression.js";
import { earnedSongsOf, musicGainOf, nextShuffled } from "../view/music-player.js";
import { SOUND_EFFECT_VOLUME, type SoundEffect } from "../view/sound-effects.js";
import extrasUnlockedUrl from "./sfx/extras-unlocked.mp3?url";
import handRefillUrl from "./sfx/hand-refill.mp3?url";
import basicAttackUrl from "./sfx/basic-attack.mp3?url";
import basicThwartUrl from "./sfx/basic-thwart.mp3?url";
import cardPlayedUrl from "./sfx/card-played.mp3?url";
import spellCastUrl from "./sfx/spell-cast.mp3?url";
import cloakOfLevitationUrl from "./sfx/cloak-of-levitation.mp3?url";
import shieldTossUrl from "./sfx/shield-toss.mp3?url";

/** The longest one sound effect holds the next back. */
const EFFECT_GAP_MAX_MS = 600;

const SOUND_EFFECT_URLS: Readonly<Record<SoundEffect, string>> = {
  "extras-unlocked": extrasUnlockedUrl,
  "hand-refill": handRefillUrl,
  "basic-attack": basicAttackUrl,
  "basic-thwart": basicThwartUrl,
  "card-played": cardPlayedUrl,
  "spell-cast": spellCastUrl,
  "cloak-of-levitation": cloakOfLevitationUrl,
  "shield-toss": shieldTossUrl,
};

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
  /**
   * The between-scenario campaign screens (Briefing, Rewind, Run, Dossier): the campaign's `interlude` track, started
   * once and carried across those screens. Leaves what is playing alone when the campaign has none.
   */
  playInterlude(campaignId: string): void;
  /**
   * Extras' jukebox and the music player: one chosen track, looped until another screen asks for its own music. With
   * shuffle on, the shuffle goes on from it instead.
   */
  playTrack(track: Track): void;
  /** The track the jukebox or the music player was last asked for, while it is still the one playing; else null. */
  jukeboxKey(): string | null;
  /** The music player's Next: the next earned song, shuffled. */
  next(): void;
  /** The song playing now (or loading to play next), or null in silence. */
  nowPlaying(): Track | null;
  /** Whether the player paused the music (#243): it stays paused, across songs and screens, until resumed. */
  paused(): boolean;
  /** Pauses the music where it is; a song that starts while paused waits, paused, at its start. */
  pause(): void;
  /** Picks the music up where it was paused. */
  resume(): void;
  /** How far into the playing song, in seconds, for the expanded player's progress bar; null in silence. */
  progress(): { readonly seek: number; readonly duration: number } | null;
  /** Calls `listener` each time a song starts; returns the way to stop. */
  onTrackStart(listener: (track: Track) => void): () => void;
  /** A sound effect over the music (`view/sound-effects.ts`), loaded on first use; muted with the music. */
  playEffect(effect: SoundEffect): void;
  /** Several, one after another: each starts as the one before it ends (or `EFFECT_GAP_MAX_MS` in, for a long one). */
  playEffects(effects: readonly SoundEffect[]): void;
  syncSettings(settings: Settings): void;
  stop(fadeDurationMs?: number): void;
}

export class MusicScene extends Phaser.Scene implements MusicController {
  #currentSound: Phaser.Sound.BaseSound | null = null;
  #currentKey: string | null = null;
  #targetKey: string | null = null;
  #lastTitleKey: string | null = null;
  #targetTrack: Track | null = null;
  #mode: "title" | "battle" | "outcome" | "interlude" | "finale" | "jukebox" | "shuffle" | "stopped" = "stopped";
  #targetVolume = DEFAULT_MUSIC_VOLUME;
  #shuffleOn = false;
  #paused = false;
  /** The shuffle's songs still to come this round. */
  #queue: Track[] = [];
  /** The current screen's own music request, made again when shuffle is turned off. */
  #ambient: (() => void) | null = null;
  readonly #listeners = new Set<(track: Track) => void>();
  /** Sound effects handed to the loader already, so a second play while one loads does not queue it twice. */
  readonly #effectsQueued = new Set<SoundEffect>();

  constructor() {
    super(SCENES.music);
  }

  create(): void {
    // Nothing here is drawn, and saying so matters: `McTextInput` hides its DOM field under any *visible* scene
    // running above its own, and this one runs above every screen for the whole session (`ui/widgets.ts`).
    this.sys.setVisible(false);
    appSession().music = this;
    this.#shuffleOn = appSession().settings.musicShuffle;
    this.syncSettings(appSession().settings);
    // The sound effects are small (a few hundred KB in all): load them now, so the first punch or deal of a session is
    // not late while its file loads and decodes (the owner, 2026-10-17: "a bit delayed").
    for (const effect of Object.keys(SOUND_EFFECT_URLS) as SoundEffect[]) this.#queueEffect(effect);
    this.load.start();
  }

  playTitle(): void {
    this.#ambient = () => this.playTitle();
    if (this.#shuffleAmbient()) return;
    this.#title();
  }

  #title(): void {
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
    this.#ambient = () => this.playBattle(context);
    if (this.#shuffleAmbient()) return;
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
    this.#ambient = () => this.playSetup(scenarioId);
    if (scenarioId && this.#isPlayingOneOf(villainTracksFor(MUSIC_CATALOG, scenarioId))) return;
    if (this.#shuffleAmbient()) return;
    this.#title();
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

  playInterlude(campaignId: string): void {
    this.#ambient = () => this.playInterlude(campaignId);
    if (this.#shuffleAmbient()) return;
    const track = interludeToStart(MUSIC_CATALOG, campaignId, this.#targetKey);
    if (!track) {
      // Already up (or the box has none): only take the mode over when it is already the interlude playing.
      if (this.#targetKey !== null && this.#mode !== "interlude") {
        const own = MUSIC_CATALOG.campaigns.get(campaignId)?.interlude ?? [];
        if (own.some((t) => t.key === this.#targetKey)) this.#mode = "interlude";
      }
      return;
    }
    this.#mode = "interlude";
    this.#requestTrack(track);
  }

  playTrack(track: Track): void {
    this.#mode = this.#shuffleOn ? "shuffle" : "jukebox";
    this.#queue = this.#queue.filter((queued) => queued.key !== track.key);
    this.#requestTrack(track);
  }

  jukeboxKey(): string | null {
    return this.#mode === "jukebox" || this.#mode === "shuffle" ? this.#targetKey : null;
  }

  next(): void {
    this.#mode = this.#shuffleOn ? "shuffle" : "jukebox";
    this.#advance();
  }

  nowPlaying(): Track | null {
    return this.#targetTrack;
  }

  paused(): boolean {
    return this.#paused;
  }

  pause(): void {
    this.#paused = true;
    if (this.#currentSound?.isPlaying) this.#currentSound.pause();
  }

  resume(): void {
    this.#paused = false;
    if (this.#currentSound?.isPaused) this.#currentSound.resume();
  }

  progress(): { readonly seek: number; readonly duration: number } | null {
    // `seek` is on both of Phaser's real sound classes (Web Audio and HTML5), not on `BaseSound`.
    const sound = this.#currentSound as (Phaser.Sound.BaseSound & { readonly seek?: number }) | null;
    if (!sound?.isPlaying && !sound?.isPaused) return null;
    return { seek: sound.seek ?? 0, duration: sound.duration };
  }

  playEffect(effect: SoundEffect): void {
    this.playEffects([effect]);
  }

  playEffects(effects: readonly SoundEffect[]): void {
    const [effect, ...rest] = effects;
    if (!effect || !appSession().settings.sound) return;
    const key = `sfx:${effect}`;
    const play = (): void => {
      const sound = this.sound.add(key, { volume: SOUND_EFFECT_VOLUME[effect] });
      sound.once(Phaser.Sound.Events.COMPLETE, () => sound.destroy());
      sound.play();
      // The next one comes in as this one ends, or sooner for a long one: the card, then its attack.
      if (rest.length > 0) {
        const gap = sound.duration > 0 ? Math.min(EFFECT_GAP_MAX_MS, sound.duration * 1000) : EFFECT_GAP_MAX_MS;
        this.time.delayedCall(gap, () => this.playEffects(rest));
      }
    };
    if (this.cache.audio.exists(key)) {
      play();
      return;
    }
    // Still loading from `create`'s preload: play it the moment it arrives.
    this.load.once(`filecomplete-audio-${key}`, play);
    if (!this.#effectsQueued.has(effect)) this.#queueEffect(effect);
    if (!this.load.isLoading()) this.load.start();
  }

  #queueEffect(effect: SoundEffect): void {
    this.#effectsQueued.add(effect);
    this.load.audio(`sfx:${effect}`, SOUND_EFFECT_URLS[effect]);
  }

  onTrackStart(listener: (track: Track) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  syncSettings(settings: Settings): void {
    this.sound.mute = !settings.sound;
    const volume = musicGainOf(settings.musicVolume, DEFAULT_MUSIC_VOLUME);
    if (volume !== this.#targetVolume) {
      this.#targetVolume = volume;
      // The slider is heard as it moves: a fade still running into the old level gives way to the new one.
      const sound = this.#currentSound as (Phaser.Sound.BaseSound & { volume?: number }) | null;
      if (sound && "volume" in sound) {
        this.tweens.killTweensOf(sound);
        sound.volume = volume;
      }
    }
    const was = this.#shuffleOn;
    this.#shuffleOn = settings.musicShuffle;
    if (was === this.#shuffleOn) return;
    if (this.#shuffleOn) {
      // A story moment keeps its song; anything else gives way to the shuffle now.
      if (this.#mode !== "outcome" && this.#mode !== "finale") this.#startShuffle();
    } else if (this.#mode === "shuffle") {
      // Back to the screen's own music. A screen with none to give (a campaign with no interlude) keeps the song, looping.
      this.#ambient?.();
      if (this.#mode === "shuffle") this.#mode = "jukebox";
    }
  }

  /** The earned songs: the shuffle's pool. */
  #pool(): Track[] {
    return earnedSongsOf(extras()).map((song) => song.track);
  }

  /** With shuffle on, a screen's own music request keeps the shuffle going, or starts it. False: play as asked. */
  #shuffleAmbient(): boolean {
    if (!this.#shuffleOn) return false;
    if (this.#mode === "shuffle" && this.#targetKey !== null) return true;
    return this.#startShuffle();
  }

  /** Starts the shuffle on its next song; false when nothing is earned to shuffle. */
  #startShuffle(): boolean {
    const next = nextShuffled(this.#queue, this.#pool(), this.#targetKey);
    if (!next.track) return false;
    this.#mode = "shuffle";
    this.#queue = next.queue;
    this.#requestTrack(next.track);
    return true;
  }

  /** The next shuffled song, in whichever of the player's modes is on. */
  #advance(): void {
    const next = nextShuffled(this.#queue, this.#pool(), this.#targetKey);
    if (!next.track) return;
    this.#queue = next.queue;
    this.#requestTrack(next.track);
  }

  stop(fadeDurationMs = CROSSFADE_DURATION_MS): void {
    this.#mode = "stopped";
    this.#targetKey = null;
    this.#targetTrack = null;
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
    this.#targetTrack = track;

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

    // Start new track. A shuffled song plays once and hands on to the next; any other loops.
    const shuffling = this.#mode === "shuffle";
    const newSound = this.sound.add(track.key, { loop: !shuffling, volume: duration > 0 ? 0 : this.#targetVolume });
    newSound.once(Phaser.Sound.Events.COMPLETE, () => {
      if (this.#currentSound !== newSound) return;
      // Shuffle was turned off while the song played: it loops on as the jukebox's.
      if (this.#mode === "shuffle") this.#advance();
      else newSound.play();
    });
    newSound.play();
    if (this.#paused) newSound.pause();
    this.#currentSound = newSound;
    for (const listener of this.#listeners) listener(track);

    if (duration > 0) {
      this.tweens.add({
        targets: newSound,
        volume: this.#targetVolume,
        duration,
      });
    }
  }
}
