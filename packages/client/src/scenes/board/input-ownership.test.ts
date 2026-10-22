import { describe, expect, test } from "vitest";
import type Phaser from "phaser";
import { SCENES } from "../keys.js";
import { conflictPromptOwnsInput } from "./input.js";

/** A scene whose key is `key`, in a manager where `running` are the active scenes. */
function sceneIn(key: string, running: readonly string[]): Phaser.Scene {
  return { scene: { key, manager: { isActive: (k: string) => running.includes(k) } } } as unknown as Phaser.Scene;
}

describe("who owns the keyboard and pad while a sync question is up", () => {
  test("nothing is held when no question is up", () => {
    expect(conflictPromptOwnsInput(sceneIn(SCENES.title, ["Title"]))).toBe(false);
  });

  test("the conflict prompt holds every other screen, and not itself", () => {
    const running = [SCENES.title, SCENES.syncConflict];
    expect(conflictPromptOwnsInput(sceneIn(SCENES.title, running))).toBe(true);
    expect(conflictPromptOwnsInput(sceneIn(SCENES.syncConflict, running))).toBe(false);
  });

  test("the setup prompt holds Title and Settings, not itself or the sync screen it opens", () => {
    const running = [SCENES.title, SCENES.syncSetupPrompt, SCENES.syncData];
    expect(conflictPromptOwnsInput(sceneIn(SCENES.title, running))).toBe(true);
    expect(conflictPromptOwnsInput(sceneIn(SCENES.settings, running))).toBe(true);
    expect(conflictPromptOwnsInput(sceneIn(SCENES.syncSetupPrompt, running))).toBe(false);
    expect(conflictPromptOwnsInput(sceneIn(SCENES.syncData, running))).toBe(false);
  });

  test("a conflict raised during the prompt's Join or Set up keeps its own keyboard and pad", () => {
    const running = [SCENES.title, SCENES.syncSetupPrompt, SCENES.syncData, SCENES.syncConflict];
    expect(conflictPromptOwnsInput(sceneIn(SCENES.syncConflict, running))).toBe(false);
    // And it holds everything else, the sync screen included.
    expect(conflictPromptOwnsInput(sceneIn(SCENES.syncData, running))).toBe(true);
    expect(conflictPromptOwnsInput(sceneIn(SCENES.syncSetupPrompt, running))).toBe(true);
  });
});
