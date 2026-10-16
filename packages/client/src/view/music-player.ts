/**
 * The music player (#191): the songs the player has earned, the shuffle order they play in, and where the music
 * button, its "Now playing" announcement and the player panel are drawn.
 *
 * A song is earned where Extras' Music tab opens it (`progression/extras.ts`): the title and battle themes from the
 * start, a villain's themes by playing, beating or losing to them. Shuffle plays every earned song once, in a random
 * order, before any repeats, and never the same song twice in a row.
 *
 * Pure: no Phaser, no storage. `scenes/music-button.ts` and `scenes/music-player.ts` draw from it, and
 * `audio/music-controller.ts` plays from it.
 */
import type { Track } from "../audio/music-catalog.js";
import { EXTRAS_ENTRIES, trackTitleOf, type Extras, type ExtrasEntry } from "../progression/extras.js";
import type { Rect } from "./layout.js";

export interface PlayerSong {
  readonly id: string;
  readonly title: string;
  /** Where the song plays in the game: "Battle · Rhino · Victory · Core Set". */
  readonly where: string;
  readonly track: Track;
}

/** The earned songs, in the jukebox's own order. */
export function earnedSongsOf(
  extras: Pick<Extras, "isOpen">,
  entries: readonly ExtrasEntry[] = EXTRAS_ENTRIES.music,
): PlayerSong[] {
  const songs: PlayerSong[] = [];
  for (const entry of entries) {
    if (entry.content.kind !== "track" || !extras.isOpen(entry.unlock)) continue;
    songs.push({ id: entry.id, title: entry.title, where: entry.subtitle, track: entry.content.track });
  }
  return songs;
}

/** How many songs are still to earn. */
export function lockedSongCount(
  extras: Pick<Extras, "isOpen">,
  entries: readonly ExtrasEntry[] = EXTRAS_ENTRIES.music,
): number {
  return entries.filter((entry) => entry.content.kind === "track" && !extras.isOpen(entry.unlock)).length;
}

/** The song title a track plays as, for "Now playing". */
export function nowPlayingTitleOf(track: Track): string {
  return trackTitleOf(track);
}

/**
 * `pool` in a random order (Fisher-Yates), never starting with `avoidKey` (the song playing now) when there is any
 * other song to start with.
 */
export function shuffledQueue(
  pool: readonly Track[],
  avoidKey: string | null = null,
  random: () => number = Math.random,
): Track[] {
  const queue = [...pool];
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const other = Math.min(index, Math.floor(random() * (index + 1)));
    [queue[index], queue[other]] = [queue[other]!, queue[index]!];
  }
  if (queue.length > 1 && queue[0]!.key === avoidKey) [queue[0], queue[queue.length - 1]] = [queue.at(-1)!, queue[0]!];
  return queue;
}

/**
 * The next song to shuffle to, and the queue left after it. Songs no longer in `pool` drop out of the queue, and an
 * empty queue is dealt again from `pool`, avoiding `playingKey` so a new round never repeats the song just heard.
 */
export function nextShuffled(
  queue: readonly Track[],
  pool: readonly Track[],
  playingKey: string | null,
  random: () => number = Math.random,
): { readonly track: Track | null; readonly queue: Track[] } {
  const keys = new Set(pool.map((track) => track.key));
  let left = queue.filter((track) => keys.has(track.key) && (pool.length < 2 || track.key !== playingKey));
  if (left.length === 0) left = shuffledQueue(pool, playingKey, random);
  const [track = null, ...rest] = left;
  return { track, queue: rest };
}

/** A song's clock, `m:ss`: "1:05". */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** How long "Now playing" stays open before it folds back into the music button. */
export const NOW_PLAYING_HOLD_MS = 3200;
/** How long the button takes to open out into "Now playing", and to fold back. */
export const NOW_PLAYING_OPEN_MS = 280;
/** A song that starts while no screen shows the button is still announced if the button turns up this soon after. */
export const NOW_PLAYING_LATE_MS = 2500;

/** The music button's slot: the Report button's size, just left of it. */
export function musicSlotBeside(report: Rect, gap = 8): Rect {
  return { x: report.x - gap - report.width, y: report.y, width: report.width, height: report.height };
}

/**
 * Desktop and tablet: the music button opens out to its left into a pill reading "Now playing" and the song, sized to
 * the text and never past `minX` (what else is on the bar).
 */
export function nowPlayingPill(icon: Rect, textWidth: number, minX: number): Rect {
  const right = icon.x + icon.width;
  const width = Math.max(icon.width, Math.min(icon.width + textWidth + 18, right - minX));
  return { x: right - width, y: icon.y, width, height: icon.height };
}

/** Phone: a notification that slides down from the top of the screen, just under the top bar. */
export function nowPlayingBanner(icon: Rect, screenWidth: number): Rect {
  const gutter = 8;
  return { x: gutter, y: icon.y + icon.height + 10, width: screenWidth - gutter * 2, height: 56 };
}

export const PLAYER_ROW_HEIGHT = 52;
/** The panel's header, the now-playing block and the Shuffle / Next row, above the song list. */
export const PLAYER_HEAD_HEIGHT = 44 + 64 + 56;
/** The line under the list saying how many songs are still to earn. */
export const PLAYER_FOOT_HEIGHT = 36;
const POPOVER_WIDTH = 380;

/**
 * Where the player opens. On a phone it fills the screen below the top bar, so the bar's music button (and the Back
 * button in the panel) close it. On a tablet or desktop it is a popover hanging from the music button, as tall as its
 * songs need and no taller than the screen allows.
 */
export function playerPanelRect(
  icon: Rect,
  screen: { readonly width: number; readonly height: number },
  phone: boolean,
  songCount: number,
): Rect {
  const top = icon.y + icon.height + (phone ? 6 : 8);
  if (phone) return { x: 0, y: top, width: screen.width, height: Math.max(0, screen.height - top) };
  const width = Math.min(POPOVER_WIDTH, screen.width - 16);
  const x = Math.max(8, Math.min(icon.x + icon.width - width, screen.width - 8 - width));
  const wanted = PLAYER_HEAD_HEIGHT + Math.max(1, songCount) * PLAYER_ROW_HEIGHT + PLAYER_FOOT_HEIGHT + 8;
  return { x, y: top, width, height: Math.max(0, Math.min(wanted, screen.height - top - 8)) };
}
