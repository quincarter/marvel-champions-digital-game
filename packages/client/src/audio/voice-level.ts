/**
 * The volume the music controller last gave each sound, kept on the game's side (#1018).
 *
 * A Phaser Web Audio sound's `volume` getter reads its GainNode's `gain.value`, and a brand-new GainNode reads its
 * default, 1 (full volume), until the browser has rendered the volume just set on it. A fade that took its starting
 * level from that getter could start a new song at full volume and fade it *down* to the player's setting, which is
 * heard as the music ignoring the volume setting. So fades never read a sound's own volume: they start from the level
 * kept here, and a sound with no level yet is silent.
 */
export class VoiceLevels<V extends object> {
  readonly #levels = new WeakMap<V, number>();

  /** The level last set on `voice`, or 0 for one the game has not set yet. */
  get(voice: V): number {
    return this.#levels.get(voice) ?? 0;
  }

  set(voice: V, level: number): void {
    this.#levels.set(voice, clampLevel(level));
  }
}

/** A fade of `voice` to `to`, from the level the game last set on it (never from the sound's own reading). */
export function fadeOf<V extends object>(
  levels: VoiceLevels<V>,
  voice: V,
  to: number,
): { readonly from: number; readonly to: number } {
  return { from: levels.get(voice), to: clampLevel(to) };
}

function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
}
