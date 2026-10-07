import type { GameState, StackEntry, TriggerEventKind } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { stackRowLabel } from "./defend-choice.js";
import { TRIGGER_EVENT_WORDS, triggerEventWords } from "./trigger-event-words.js";

const kinds = Object.keys(TRIGGER_EVENT_WORDS) as TriggerEventKind[];

/** A bare identifier: any lowercase-then-capital run (camelCase), or the id itself. */
const bareIdentifier = (text: string, kind: string): boolean => text === kind || /[a-z][A-Z]/.test(text);

describe("TRIGGER_EVENT_WORDS", () => {
  test("covers a real set of kinds, each worded as a phrase and never as its own id", () => {
    expect(kinds.length).toBeGreaterThan(50);
    for (const kind of kinds) {
      const words = triggerEventWords(kind);
      expect(bareIdentifier(words, kind), `${kind} -> ${words}`).toBe(false);
      expect(words, kind).not.toBe(kind);
    }
  });
});

describe("stackRowLabel for an event frame", () => {
  const entry = (eventKind: TriggerEventKind, stage: string | null): StackEntry =>
    ({
      frameId: "f1",
      depth: 0,
      kind: "event",
      subjectInstanceId: null,
      eventKind,
      timing: null,
      stage,
      awaiting: null,
      openWindow: false,
    }) as unknown as StackEntry;

  test("no kind at any stage prints a raw engine id", () => {
    for (const kind of kinds) {
      for (const stage of ["interrupts", "responses", "apply", null]) {
        const label = stackRowLabel({} as GameState, entry(kind, stage));
        expect(label, `${kind}/${stage}`).not.toMatch(/[a-z][A-Z]/);
      }
    }
  });

  test("the stack panel's own example reads in words", () => {
    expect(stackRowLabel({} as GameState, entry("enemyAttack", "responses"))).toBe("Response window — an enemy attack");
  });
});
