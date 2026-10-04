/**
 * In-game settings that change how the client draws, not what the game does.
 *
 * Reduced motion is an in-game setting that defaults from the OS preference
 * (PLAN.md Phase 4, accessibility). Nothing here reaches the engine: a setting
 * that could change an outcome would belong in the rules, not in the client.
 */

import type { TableRules } from "@mc/engine";

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
  /**
   * Background music and audio across menus and games.
   */
  readonly sound: boolean;
  /**
   * Ask before an End turn that would still leave a basic attack, thwart or recover open
   * (`view/end-turn-confirm.ts`). Defaults on: ending a turn with something meaningful left is
   * usually a misclick, not a choice. Off restores the old immediate-end behavior.
   */
  readonly confirmBeforeEndTurn: boolean;
  /**
   * The table rule "a hero and an ally with the same name can't both be in play" (`TableRules.sameNameHeroAllyConflict`,
   * owner decision 2026-10-03). Unlike the rest of this file it reaches the engine, as the rule set a NEW game is created
   * with (`tableRulesOf`); a game already started or saved keeps the rules it was created with. Defaults on.
   */
  readonly sameNameHeroAllyConflict: boolean;
}

/** The engine's table rules a new game is created with, from these settings; undefined when none is on (a game's setup then reads exactly as before the option existed). */
export function tableRulesOf(settings: Pick<Settings, "sameNameHeroAllyConflict">): TableRules | undefined {
  return settings.sameNameHeroAllyConflict ? { sameNameHeroAllyConflict: true } : undefined;
}

export function defaultSettings(): Settings {
  const prefersReduced =
    typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    reducedMotion: prefersReduced,
    // Capped at `SHARP_TEXT_RESOLUTION_CEILING`: beyond that the texture cost buys nothing visible.
    textResolution: Math.min(SHARP_TEXT_RESOLUTION_CEILING, Math.max(1, globalThis.devicePixelRatio || 1)),
    largeCardText: false,
    sound: true,
    confirmBeforeEndTurn: true,
    sameNameHeroAllyConflict: true,
  };
}
