import { describe, expect, test } from "vitest";
import type { McGuidePanelContent } from "../ui/guide-panel.js";
import { calloutContentOf } from "./guide-callout-content.js";

const BASE_PANEL: McGuidePanelContent = {
  contextLabel: "Lesson 2 of 5",
  lessons: [{ id: "flip", label: "Hero & alter-ego", status: "current" }],
  stepLabel: "STEP 1 OF 5",
  title: "You're Peter Parker",
  body: "Flip once per turn.",
  tip: null,
  progressTicks: 1,
  progressCurrent: 0,
  backLabel: null,
  primaryLabel: null,
  continueHint: "Flip to Spider-Man",
  nudge: null,
};

describe("calloutContentOf", () => {
  test("maps a step's panel content straight across, including doThis as continueHint", () => {
    const content = calloutContentOf(BASE_PANEL, false);
    expect(content).toMatchObject({
      stepLabel: "STEP 1 OF 5",
      title: "You're Peter Parker",
      body: "Flip once per turn.",
      continueHint: "Flip to Spider-Man",
      primaryLabel: null,
      secondaryLabel: null,
      nudge: null,
    });
  });

  test("appends the panel's tip as a paragraph, since the callout has no separate tip box", () => {
    const content = calloutContentOf({ ...BASE_PANEL, tip: "Energy prints two resources." }, false);
    expect(content.body).toBe("Flip once per turn.\n\nEnergy prints two resources.");
  });

  test("only carries a secondary (Back) label when the caller says there is one to show", () => {
    const withBack = { ...BASE_PANEL, backLabel: "Back", continueHint: null };
    expect(calloutContentOf(withBack, true).secondaryLabel).toBe("Back");
    expect(calloutContentOf(withBack, false).secondaryLabel).toBeNull();
  });

  test("drops Back in favor of continueHint — the callout can't show both at once", () => {
    // `BASE_PANEL` already carries both a `backLabel`-worthy step and `continueHint` ("Flip to Spider-Man") — an
    // await step past the first in its lesson, same shape as lesson 5's "Thwart it" (found in browser
    // verification: a bare "Back" button with no instruction at all).
    const withBack = { ...BASE_PANEL, backLabel: "Back" };
    const content = calloutContentOf(withBack, true);
    expect(content.secondaryLabel).toBeNull();
    expect(content.continueHint).toBe("Flip to Spider-Man");
  });

  test("carries the waiting state's own title/body across, with no lesson list or context label", () => {
    const waiting: McGuidePanelContent = {
      contextLabel: "Guide",
      lessons: [
        { id: "how-to-win", label: "How to win", status: "done" },
        { id: "hero-and-alter-ego", label: "Hero & alter-ego", status: "done" },
        { id: "paying-for-cards", label: "Paying for cards", status: "upcoming" },
      ],
      stepLabel: null,
      title: "Next: Paying for cards",
      body: "Flip to Spider-Man when you're ready.",
      tip: null,
      progressTicks: null,
      progressCurrent: null,
      backLabel: null,
      primaryLabel: null,
      continueHint: null,
      nudge: null,
    };
    const content = calloutContentOf(waiting, false);
    expect(content.title).toBe("Next: Paying for cards");
    expect(content.body).toBe("Flip to Spider-Man when you're ready.");
    expect(content.primaryLabel).toBeNull();
    expect(content.continueHint).toBeNull();
    // `McGuideCalloutContent` has no lessons/contextLabel field at all — the type itself is the guarantee that
    // the lesson list is dropped, not carried empty.
  });

  test("carries the complete state's own Close primary label across", () => {
    const complete: McGuidePanelContent = {
      contextLabel: "Guide",
      lessons: null,
      stepLabel: null,
      title: "Tutorial complete",
      body: "Nice work.",
      tip: null,
      progressTicks: null,
      progressCurrent: null,
      backLabel: null,
      primaryLabel: "Close",
      continueHint: null,
      nudge: null,
    };
    expect(calloutContentOf(complete, false).primaryLabel).toBe("Close");
  });
});
