/**
 * In-game settings that change how the client draws, not what the game does.
 *
 * Reduced motion is an in-game setting that defaults from the OS preference
 * (PLAN.md Phase 4, accessibility). Nothing here reaches the engine: a setting
 * that could change an outcome would belong in the rules, not in the client.
 */

/** The sharp, device-pixel-ratio-matched text resolution `defaultSettings` starts from. Also what "off" restores. */
export const SHARP_TEXT_RESOLUTION_CEILING = 2;

export interface Settings {
  readonly reducedMotion: boolean;
  /** Text resolution multiplier; set from the device pixel ratio so text stays sharp. */
  readonly textResolution: number;
  /**
   * Card rules/flavor text rendered larger (docs/phase4-screen-gaps.md §3 "W4"
   * Settings: "large card text"). Read today only by `scenes/inspect.ts`'s rules-text
   * panel — the one screen whose whole job is "read this card's full text" — rather
   * than every text object app-wide; a future pass can widen where it applies.
   */
  readonly largeCardText: boolean;
}

export function defaultSettings(): Settings {
  const prefersReduced =
    typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    reducedMotion: prefersReduced,
    // Capped at `SHARP_TEXT_RESOLUTION_CEILING`: beyond that the texture cost buys nothing visible.
    textResolution: Math.min(SHARP_TEXT_RESOLUTION_CEILING, Math.max(1, globalThis.devicePixelRatio || 1)),
    largeCardText: false,
  };
}
