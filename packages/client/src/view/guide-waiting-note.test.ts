import { describe, expect, it } from "vitest";
import { waitingNoteKeyOf, waitingNoteVisible } from "./guide-waiting-note.js";

describe("waitingNoteKeyOf", () => {
  it("has no key while a scripted step is current", () => {
    expect(waitingNoteKeyOf({ step: { id: "flip" }, panel: { title: "You're Peter Parker" } })).toBeNull();
  });

  it("has no key with no panel at all", () => {
    expect(waitingNoteKeyOf({ step: null, panel: null })).toBeNull();
  });

  it("keys the waiting state by the panel's own title", () => {
    expect(waitingNoteKeyOf({ step: null, panel: { title: "Next: The villain phase" } })).toBe(
      "Next: The villain phase",
    );
  });

  it("keys the complete state distinctly from any waiting title", () => {
    expect(waitingNoteKeyOf({ step: null, panel: { title: "Tutorial complete" } })).toBe("Tutorial complete");
  });
});

describe("waitingNoteVisible", () => {
  it("shows a note with nothing dismissed yet", () => {
    expect(waitingNoteVisible("Next: The villain phase", null)).toBe(true);
  });

  it("stays hidden once the player's × dismissed this exact note", () => {
    expect(waitingNoteVisible("Next: The villain phase", "Next: The villain phase")).toBe(false);
  });

  it("shows again once the note's own identity changed — a later, different note was never dismissed", () => {
    expect(waitingNoteVisible("Next: Threat & thwarting", "Next: The villain phase")).toBe(true);
  });

  it("never shows with no note at all, dismissed or not", () => {
    expect(waitingNoteVisible(null, "Next: The villain phase")).toBe(false);
    expect(waitingNoteVisible(null, null)).toBe(false);
  });
});
