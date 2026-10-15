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
  /**
   * How much larger than its on-table size a card is drawn in the hover popover (`scenes/board/hover-preview.ts`), or
   * "off". Desktop with a mouse only: a phone or tablet has long-press Inspect instead, and ignores this. Defaults 2.5x.
   */
  readonly cardHoverScale: CardHoverScale;
  /**
   * How large cards are drawn everywhere they are shown: the table (which then scrolls), the villain phase, and the
   * deck and collection screens (whose grids take fewer columns and scroll). A player asked for the cards closer, to
   * read them (2026-10-14). Defaults to standard, the size every screen was designed at.
   */
  readonly cardSize: CardSize;
}

/**
 * "standard" is Fit to screen (each screen's own sizing). "same" is Same size everywhere: a card comes out about the
 * size a desktop draws it on every device, so a phone and a tablet scale up and scroll (the owner, 2026-10-14).
 */
export type CardSize = "standard" | "same" | "large" | "xlarge";
export const CARD_SIZE_VALUES: readonly CardSize[] = ["standard", "same", "large", "xlarge"];

/**
 * How much larger than a desktop a screen of this size already draws nothing: the factor that brings its cards up to
 * a desktop card's size. A phone's slots run about two thirds of a desktop's, a tablet's about four fifths.
 */
export function sameSizeFactor(width: number, height: number): number {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  if (short < 500) return 1.5;
  if (long < 1280) return 1.25;
  return 1;
}

/**
 * The multiplier a `cardSize` stands for on a screen of this size (CSS px, the game's own size): 1 for Fit to screen,
 * the screen's own `sameSizeFactor` for Same size everywhere, 1.25 and 1.5 for Large and Extra large.
 */
export function cardSizeFactor(
  size: CardSize,
  width: number = globalThis.innerWidth ?? 1440,
  height: number = globalThis.innerHeight ?? 900,
): number {
  switch (size) {
    case "xlarge":
      return 1.5;
    case "large":
      return 1.25;
    case "same":
      return sameSizeFactor(width, height);
    default:
      return 1;
  }
}

/** Up to 4x: anything larger got in the way (the owner, 2026-10-14). */
export type CardHoverScale = "off" | "1.5x" | "2x" | "2.5x" | "3x" | "4x";
export const CARD_HOVER_SCALE_VALUES: readonly CardHoverScale[] = ["off", "1.5x", "2x", "2.5x", "3x", "4x"];

/** The size multiplier a `cardHoverScale` stands for; null for "off". */
export function cardHoverFactor(scale: CardHoverScale): number | null {
  return scale === "off" ? null : Number.parseFloat(scale);
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
    cardHoverScale: "2.5x",
    cardSize: "standard",
  };
}
