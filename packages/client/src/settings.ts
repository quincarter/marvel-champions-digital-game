/**
 * In-game settings that change how the client draws, not what the game does.
 *
 * Reduced motion is an in-game setting that defaults from the OS preference
 * (PLAN.md Phase 4, accessibility). Nothing here reaches the engine: a setting
 * that could change an outcome would belong in the rules, not in the client.
 */

import type { TableRules } from "@mc/engine";
import type { KeyboardHand } from "./view/input-shortcuts.js";
import type { PadFamilySetting } from "./view/pad-family.js";

/** The sharp, device-pixel-ratio-matched text resolution `defaultSettings` starts from. Also what "off" restores. */
export const SHARP_TEXT_RESOLUTION_CEILING = 2;

/** The music volume slider's top, as a percent of the music's full level (`Settings.musicVolume`). */
export const MUSIC_VOLUME_MAX = 100;

/** A stored or dragged music volume brought into range and to a whole percent. */
export function clampMusicVolume(volume: number): number {
  if (!Number.isFinite(volume)) return MUSIC_VOLUME_MAX;
  return Math.round(Math.min(MUSIC_VOLUME_MAX, Math.max(0, volume)));
}

/** The key and button hints' size, as a percent of their base size (`Settings.glyphSize`): range, step and default. */
export const GLYPH_SIZE_MIN = 75;
export const GLYPH_SIZE_MAX = 200;
export const GLYPH_SIZE_STEP = 5;
export const GLYPH_SIZE_DEFAULT = 130;

/** A stored or dragged hint size brought into range and to a step of 5. */
export function clampGlyphSize(percent: number): number {
  if (!Number.isFinite(percent)) return GLYPH_SIZE_DEFAULT;
  const stepped = Math.round(percent / GLYPH_SIZE_STEP) * GLYPH_SIZE_STEP;
  return Math.min(GLYPH_SIZE_MAX, Math.max(GLYPH_SIZE_MIN, stepped));
}

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
   * Shuffle the songs earned in Extras (#191) in place of each screen's own music: menus, Setup and every game. A
   * story moment (a campaign opener's villain theme, Game over, the Finale) still plays its own song. Defaults off.
   */
  readonly musicShuffle: boolean;
  /**
   * The music's loudness, 0 to `MUSIC_VOLUME_MAX` percent of its full level, set from the music player's slider (#243)
   * and kept between launches. Sound effects keep their own levels. Defaults to full.
   */
  readonly musicVolume: number;
  /** The sound effects' loudness, 0 to `MUSIC_VOLUME_MAX` percent of each effect's own level (#243). Defaults to full. */
  readonly effectsVolume: number;
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
  /** Desktop app only: show what you are playing on your Discord profile while Discord is open (`platform/discord-presence.ts`). Defaults on. */
  readonly discordPresence: boolean;
  /** Stop on each encounter card dealt facedown and show its back until the player presses Flip Encounter Card (#287). Defaults on. */
  readonly flipEncounterCards: boolean;
  /** How long Flip Encounter Card takes to turn the card over: 1 s, 0.5 s, or instantly (`flipDurationMs`). Defaults normal. */
  readonly flipEncounterSpeed: FlipEncounterSpeed;
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
  /**
   * Inspect on a phone held upright: "large" stacks a full-width scan over the text (issue #358), "sideBySide" is the
   * older small scan beside the text. Phone portrait only; every other form factor keeps its own layout. Defaults large.
   */
  readonly inspectCard: InspectCard;
  /** The hover popover over a hero (or alter-ego) identity card. Defaults on (the owner, 2026-10-14). */
  readonly hoverHeroCard: boolean;
  /** The hover popover over a villain card. Defaults on. */
  readonly hoverVillainCard: boolean;
  /**
   * Ultron's facedown Drones drawn with Hall of Heroes' Drone card art, once earned (Settings ▸ More ▸ Earned items,
   * `progression/earned-items.ts`; issue #291). Defaults on: earning it is what turns it on.
   */
  readonly ultronDroneArt: boolean;
  /**
   * How the first player token travels to a new first player, on the Set the table screen and around the table
   * (`view/first-player-token-motion.ts`). Defaults to a toss (the owner, 2026-10-16). Reduced motion places it instead.
   */
  readonly firstPlayerTokenMotion: FirstPlayerTokenMotion;
  /**
   * The desktop app's window: a normal window, an undecorated window over the whole monitor, or the OS's own
   * fullscreen (`platform/desktop-window.ts`). Desktop (Tauri) only; the web and the phone apps ignore it.
   */
  readonly displayMode: DisplayMode;
  /**
   * The resolution the desktop app draws at, in the monitor's own pixels, or "native" for the monitor's own. In
   * Borderless and Fullscreen a lower one is drawn at that size and scaled to fill the screen, black bars where the
   * shapes differ; in Windowed it is the window's size (native: a maximized window). The OS's own display resolution
   * is never changed, so closing the game has nothing to put back. Desktop (Tauri) only.
   */
  readonly resolution: Resolution;
  /**
   * Lighten the game while the device is in power saving mode (`platform/power-saving.ts`): reduced motion, 1x text and
   * a 30 fps cap. Off plays as usual whatever the device says (the owner, 2026-10-18). Defaults on.
   */
  readonly powerSavingAdjust: boolean;
  /**
   * How many device pixels the game draws per CSS pixel (`platform/screen-settings.ts`): "native" for the screen's own
   * density (1080p on a 1080 x 2400 phone, 1.5x under Windows' 150% scaling), or a lower multiplier that is lighter on
   * the GPU, memory and battery. Defaults to what this device's hardware is recommended (`platform/device-tier.ts`):
   * native on a high-end one.
   */
  readonly renderScale: RenderScale;
  /**
   * How big the desktop app draws everything (Settings > Window): the webview's zoom, for a 4K TV left at 100% OS
   * scaling. Only the desktop app reads it; defaults to 100%.
   */
  readonly interfaceSize: InterfaceSize;
  /**
   * The frame rate the game holds to: the screen's own refresh rate (120 Hz on a 120 Hz phone), or a 60 or 30 fps cap.
   * On Android the app also asks the OS for a matching refresh rate. Defaults to the screen's own, or 60 on a phone the
   * hardware check rates below high-end; power saving mode defaults it to 30 (`POWER_SAVING_FPS`).
   */
  readonly frameRate: FrameRate;
  /**
   * How long the "Achievement unlocked" popup stays up (`scenes/achievement-toast.ts`), or "off" for none. Defaults to
   * 5 s (the owner, 2026-10-20).
   */
  readonly achievementPopupTime: AchievementPopupTime;
  /** Where the "Achievement unlocked" popup shows. Defaults to the title bar (the owner, 2026-10-20: keep it out of the way). */
  readonly achievementPopupPlace: AchievementPopupPlace;
  /** How large the "Achievement unlocked" popup is drawn. Defaults to small (the owner, 2026-10-20). Its opened list keeps one size. */
  readonly achievementPopupSize: AchievementPopupSize;
  /**
   * Which button labels the controller glyphs show (`view/pad-family.ts`): follow the detected pad, or a family the
   * player picks when detection is wrong. Defaults to auto.
   */
  readonly padGlyphFamily: PadFamilySetting;
  /**
   * On a Nintendo-layout pad, buttons act by their printed label: A (right) confirms, B (bottom) backs out, as on a
   * Switch. Ignored for other pads and under Steam Input, which swaps for itself (the owner, 2026-10-24). Defaults on.
   */
  readonly nintendoLayout: boolean;
  /**
   * Which hand the one-handed keyboard map sits under (`view/input-shortcuts.ts`): left (WASD) by default, right (IJKL)
   * for a mouse in the left hand (the owner, 2026-10-24).
   */
  readonly keyboardHand: KeyboardHand;
  /** Key and button glyphs beside the controls they trigger, while a keyboard or controller is in use. Defaults on. */
  readonly inputGlyphs: boolean;
  /** How big those hints draw, in percent of the base size: 75 to 200 in steps of 5 (`clampGlyphSize`). Defaults to 130. */
  readonly glyphSize: number;
}

export type AchievementPopupTime = "off" | "3s" | "5s" | "8s" | "10s";
export const ACHIEVEMENT_POPUP_TIME_VALUES: readonly AchievementPopupTime[] = ["off", "3s", "5s", "8s", "10s"];

/** Milliseconds an achievement popup holds for a `achievementPopupTime`; 0 for "off". */
export function achievementPopupHoldMs(time: AchievementPopupTime): number {
  return time === "off" ? 0 : Number.parseInt(time, 10) * 1000;
}

/** "titleBar" sits in the screens' top bar strip; the rest are centered across the screen at that height. */
export type AchievementPopupPlace = "titleBar" | "top" | "middle" | "bottom";
export type AchievementPopupSize = "small" | "medium" | "large";
export const ACHIEVEMENT_POPUP_SIZE_VALUES: readonly AchievementPopupSize[] = ["small", "medium", "large"];

/** The scale an `achievementPopupSize` draws the popup at: medium is the size it was designed at. */
export function achievementPopupScale(size: AchievementPopupSize): number {
  return size === "small" ? 0.8 : size === "large" ? 1.3 : 1;
}

export const ACHIEVEMENT_POPUP_PLACE_VALUES: readonly AchievementPopupPlace[] = ["titleBar", "top", "middle", "bottom"];

/** "native": the screen's own pixel density. A multiplier is capped at the screen's own (`renderScaleFactorOf`). */
export type RenderScale = "native" | "2x" | "1.5x" | "1x";
export const RENDER_SCALE_VALUES: readonly RenderScale[] = ["native", "2x", "1.5x", "1x"];

/** No phone is denser than this; above it the buffer would cost more than any screen can show. */
export const MAX_RENDER_SCALE = 4;

/** The device pixels per CSS pixel a `renderScale` draws at on a screen of this density. */
export function renderScaleFactorOf(choice: RenderScale, devicePixelRatio: number): number {
  const native = Math.min(MAX_RENDER_SCALE, Math.max(1, devicePixelRatio || 1));
  return choice === "native" ? native : Math.min(native, Number.parseFloat(choice));
}

/** The desktop app's interface size: the webview zoom (`platform/desktop-window.ts`). */
export type InterfaceSize = "100%" | "125%" | "150%" | "175%" | "200%";
export const INTERFACE_SIZE_VALUES: readonly InterfaceSize[] = ["100%", "125%", "150%", "175%", "200%"];

/** The webview zoom factor an `interfaceSize` stands for: 1.5 for "150%". */
export function interfaceSizeFactor(size: InterfaceSize): number {
  return Number.parseInt(size, 10) / 100;
}

/** "screen": no cap, the screen's own refresh rate. */
export type FrameRate = "screen" | "60" | "30";
export const FRAME_RATE_VALUES: readonly FrameRate[] = ["screen", "60", "30"];

/** The game loop's fps limit for a `frameRate`: 0 for none. */
export function fpsLimitOf(rate: FrameRate): number {
  return rate === "screen" ? 0 : Number(rate);
}

export type DisplayMode = "windowed" | "borderless" | "fullscreen";
export const DISPLAY_MODE_VALUES: readonly DisplayMode[] = ["windowed", "borderless", "fullscreen"];

/** "native", or a width and height in physical pixels such as "1920x1080". */
export type Resolution = "native" | `${number}x${number}`;

/** The width and height a `Resolution` names; null for "native" or anything malformed. */
export function resolutionPixelsOf(
  size: Resolution | string,
): { readonly width: number; readonly height: number } | null {
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(size);
  if (match === null) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export type FirstPlayerTokenMotion = "toss" | "slide" | "bounce" | "spin" | "instant";
export const FIRST_PLAYER_TOKEN_MOTION_VALUES: readonly FirstPlayerTokenMotion[] = [
  "toss",
  "slide",
  "bounce",
  "spin",
  "instant",
];

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

export type InspectCard = "large" | "sideBySide";
export const INSPECT_CARD_VALUES: readonly InspectCard[] = ["large", "sideBySide"];

export type VillainAutoAdvance = "off" | "afterPause" | "on";
export const VILLAIN_AUTO_ADVANCE_VALUES: readonly VillainAutoAdvance[] = ["off", "afterPause", "on"];

export type VillainBeatSpeed = "slow" | "normal" | "fast";
export const VILLAIN_BEAT_SPEED_VALUES: readonly VillainBeatSpeed[] = ["slow", "normal", "fast"];

export type FlipEncounterSpeed = "slow" | "normal" | "off";
export const FLIP_ENCOUNTER_SPEED_VALUES: readonly FlipEncounterSpeed[] = ["slow", "normal", "off"];

/** Milliseconds the facedown encounter card takes to turn over; 0 turns it at once (the press still stops on each card). */
export function flipDurationMs(speed: FlipEncounterSpeed): number {
  switch (speed) {
    case "slow":
      return 1000;
    case "normal":
      return 500;
    case "off":
      return 0;
  }
}

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

/** What the device says right now that some defaults follow. */
export interface DeviceConditions {
  /** The device is in power saving mode (`platform/power-saving.ts`). */
  readonly powerSaving?: boolean;
  /**
   * The screen settings recommended for this device's hardware (`platform/device-tier.ts`): Render resolution and Frame
   * rate start there instead of Native and the screen's own rate.
   */
  readonly screen?: { readonly renderScale: RenderScale; readonly frameRate: FrameRate };
}

/**
 * The settings a player who changed nothing gets on this device. Power saving mode turns reduced motion on, text down
 * to 1x and the frame rate down to 30 fps while it lasts; a player who set either themselves keeps their own choice (`resolveSettings`).
 */
export function defaultSettings(device: DeviceConditions = {}): Settings {
  const prefersReduced =
    typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const powerSaving = device.powerSaving === true;
  return {
    reducedMotion: prefersReduced || powerSaving,
    // Capped at `SHARP_TEXT_RESOLUTION_CEILING`: beyond that the texture cost buys nothing visible.
    textResolution: powerSaving
      ? 1
      : Math.min(SHARP_TEXT_RESOLUTION_CEILING, Math.max(1, globalThis.devicePixelRatio || 1)),
    largeCardText: false,
    sound: true,
    musicShuffle: false,
    musicVolume: MUSIC_VOLUME_MAX,
    effectsVolume: MUSIC_VOLUME_MAX,
    confirmBeforeEndTurn: true,
    sameNameHeroAllyConflict: true,
    villainAutoAdvance: "off",
    holdEncounterCards: true,
    discordPresence: true,
    flipEncounterCards: true,
    flipEncounterSpeed: "normal",
    villainBeatSpeed: "normal",
    villainDockTable: true,
    cardHoverScale: "2.5x",
    cardSize: "standard",
    inspectCard: "large",
    hoverHeroCard: true,
    hoverVillainCard: true,
    ultronDroneArt: true,
    firstPlayerTokenMotion: "toss",
    displayMode: "windowed",
    resolution: "native",
    powerSavingAdjust: true,
    renderScale: device.screen?.renderScale ?? "native",
    interfaceSize: "100%",
    frameRate: powerSaving ? "30" : (device.screen?.frameRate ?? "screen"),
    achievementPopupTime: "5s",
    achievementPopupPlace: "titleBar",
    achievementPopupSize: "small",
    padGlyphFamily: "auto",
    nintendoLayout: true,
    keyboardHand: "left",
    inputGlyphs: true,
    glyphSize: GLYPH_SIZE_DEFAULT,
  };
}
