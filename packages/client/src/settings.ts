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
  /** What happens once the villain phase has nothing left for the player to answer: wait on the recap, close it after `VILLAIN_RECAP_PAUSE_MS`, or go straight to the player phase. Defaults off. */
  readonly villainAutoAdvance: VillainAutoAdvance;
  /** Keep every revealed encounter card on screen until the player taps past it, even one with no answer to give. Defaults on. */
  readonly holdEncounterCards: boolean;
  /** How long each step stays up while the villain phase runs on its own (`villainBeatIntervalMs`). */
  readonly villainBeatSpeed: VillainBeatSpeed;
  /** Desktop and tablet dock the villain phase on the right with the table beside it; off draws it full screen. Defaults on. */
  readonly villainDockTable: boolean;
}

export type VillainAutoAdvance = "off" | "afterPause" | "on";
export const VILLAIN_AUTO_ADVANCE_VALUES: readonly VillainAutoAdvance[] = ["off", "afterPause", "on"];

export type VillainBeatSpeed = "slow" | "normal" | "fast";
export const VILLAIN_BEAT_SPEED_VALUES: readonly VillainBeatSpeed[] = ["slow", "normal", "fast"];

/** How long the villain-phase recap stays before closing itself under `villainAutoAdvance: "afterPause"`. */
export const VILLAIN_RECAP_PAUSE_MS = 6000;

/** Milliseconds each villain-phase step stays up while the phase runs on its own, for a `villainBeatSpeed`. */
export function villainBeatIntervalMs(speed: VillainBeatSpeed): number {
  switch (speed) {
    case "slow":
      return 900;
    case "normal":
      return 550;
    case "fast":
      return 320;
  }
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
    villainAutoAdvance: "off",
    holdEncounterCards: true,
    villainBeatSpeed: "normal",
    villainDockTable: true,
  };
}
