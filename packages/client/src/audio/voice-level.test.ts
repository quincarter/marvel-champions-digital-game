import { describe, expect, it } from "vitest";
import { VoiceLevels, fadeOf } from "./voice-level.js";

/** A fresh Web Audio sound: its volume reads as full until the browser renders the level set on it (#1018). */
const freshSound = (): { volume: number } => ({ volume: 1 });

describe("VoiceLevels and fadeOf (#1018)", () => {
  it("fades a new song in from silence, whatever the sound's own volume reads", () => {
    const levels = new VoiceLevels<{ volume: number }>();
    const sound = freshSound();
    // The music at 20%: 0.45 (the music's full level) × 20%.
    expect(fadeOf(levels, sound, 0.09)).toEqual({ from: 0, to: 0.09 });
  });

  it("never starts a fade above the player's setting", () => {
    const levels = new VoiceLevels<{ volume: number }>();
    const sound = freshSound();
    const fade = fadeOf(levels, sound, 0.09);
    expect(Math.max(fade.from, fade.to)).toBeLessThanOrEqual(0.09);
  });

  it("fades a song out from the level the game last set on it", () => {
    const levels = new VoiceLevels<{ volume: number }>();
    const sound = freshSound();
    levels.set(sound, 0.2);
    expect(fadeOf(levels, sound, 0)).toEqual({ from: 0.2, to: 0 });
  });

  it("keeps levels between 0 and 1", () => {
    const levels = new VoiceLevels<{ volume: number }>();
    const sound = freshSound();
    levels.set(sound, 3);
    expect(levels.get(sound)).toBe(1);
    levels.set(sound, Number.NaN);
    expect(levels.get(sound)).toBe(0);
    expect(fadeOf(levels, sound, -1).to).toBe(0);
  });
});
