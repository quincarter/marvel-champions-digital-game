/**
 * `view/hold-on-model.ts` (G9b, docs/guided-mode.md §4): the facts-panel mapping and the P06/T03 layout switch,
 * against synthetic `Hint`s — the heuristics themselves are `guide-hints.test.ts`'s job.
 */
import { describe, expect, test } from "vitest";
import type { Hint } from "./guide-hints.js";
import { holdOnContentOf, holdOnLayoutOf } from "./hold-on-model.js";
import type { Rect } from "./layout.js";

function schemeFinishHint(overrides: Partial<Hint> = {}): Hint {
  return {
    key: "schemeFinish",
    title: "The scheme could complete",
    body: "The main scheme is at 10 of 12 threat. Next villain phase could add 3 more — enough to lose the game.",
    facts: { threat: 10, target: 12, projected: 3, remaining: 2 },
    safeAction: { label: "Thwart first −3" },
    anywayAction: { label: "End turn anyway" },
    ...overrides,
  };
}

describe("holdOnContentOf", () => {
  test("schemeFinish: the threat bar, YOU LOSE when the body says so", () => {
    const content = holdOnContentOf(schemeFinishHint(), "Crossbones' Assault");
    expect(content.subtitle).toBe("The scheme could complete");
    expect(content.facts).toEqual({
      kind: "bar",
      schemeName: "Crossbones' Assault",
      threat: 10,
      target: 12,
      afterThreat: 12,
      stamp: "loses",
    });
    expect(content.safeLabel).toBe("Thwart first");
    expect(content.safeChip).toBe("−3");
    expect(content.anywayLabel).toBe("End turn anyway");
  });

  test("schemeFinish: no scheme name known falls back to the generic label", () => {
    const content = holdOnContentOf(schemeFinishHint());
    expect(content.facts).toEqual({
      kind: "bar",
      schemeName: "Main scheme",
      threat: 10,
      target: 12,
      afterThreat: 12,
      stamp: "loses",
    });
  });

  test("schemeFinish: STAGE ADVANCES when completion doesn't lose", () => {
    const content = holdOnContentOf(
      schemeFinishHint({
        body: "The main scheme is at 10 of 12 threat. Next villain phase could complete this stage.",
      }),
    );
    expect(content.facts).toEqual({
      kind: "bar",
      schemeName: "Main scheme",
      threat: 10,
      target: 12,
      afterThreat: 12,
      stamp: "advances",
    });
  });

  test("schemeClose: the threat bar, COULD LOSE tone, hatch stops at afterThreat rather than target", () => {
    const content = holdOnContentOf(
      {
        key: "schemeClose",
        title: "Close to losing",
        body: "The main scheme will reach at least 6 of 7 threat in the next villain phase. An encounter card could finish it. Thwart now?",
        facts: { threat: 5, target: 7, projected: 1, afterThreat: 6, away: 1 },
        safeAction: { label: "Thwart first −1" },
        anywayAction: { label: "End turn anyway" },
      },
      "The Break-In!",
    );
    expect(content.subtitle).toBe("Close to losing");
    expect(content.facts).toEqual({
      kind: "bar",
      schemeName: "The Break-In!",
      threat: 5,
      target: 7,
      afterThreat: 6,
      stamp: "close",
    });
    expect(content.safeLabel).toBe("Thwart first");
    expect(content.safeChip).toBe("−1");
  });

  test("no safe action: safeLabel and safeChip are null", () => {
    const content = holdOnContentOf(schemeFinishHint({ safeAction: null }));
    expect(content.safeLabel).toBeNull();
    expect(content.safeChip).toBeNull();
  });

  test("safe label without a trailing amount: no chip", () => {
    const content = holdOnContentOf(schemeFinishHint({ safeAction: { label: "Flip to alter-ego" } }));
    expect(content.safeLabel).toBe("Flip to alter-ego");
    expect(content.safeChip).toBeNull();
  });

  test("flipDanger: kept as the plain two-row facts list", () => {
    const content = holdOnContentOf({
      key: "flipDanger",
      title: "Flipping lets the scheme finish",
      body: "The main scheme is at 10 of 12 threat. Flipping now could complete this stage.",
      facts: { threat: 10, target: 12 },
      safeAction: { label: "Stay in hero form" },
      anywayAction: { label: "Flip anyway" },
    });
    expect(content.facts).toEqual({
      kind: "rows",
      rows: [
        { label: "Threat", value: "10 → 12" },
        { label: "Result", value: "STAGE ADVANCES" },
      ],
    });
  });

  test("lethal: HP → 0 and incoming damage", () => {
    const content = holdOnContentOf({
      key: "lethal",
      title: "You could take lethal damage",
      body: "Spider-Man is at 3 of 10 HP. Even with the best block, Rhino's ATK could deal 4 next villain phase.",
      facts: { currentHp: 3, maxHp: 10, totalAtk: 4, bestCaseDamage: 4 },
      safeAction: { label: "Flip to alter-ego" },
      anywayAction: { label: "End turn anyway" },
    });
    expect(content.facts).toEqual({
      kind: "rows",
      rows: [
        { label: "HP", value: "3 → 0" },
        { label: "Incoming", value: "4 dmg" },
      ],
    });
  });

  test("wastedPay: paid vs needed", () => {
    const content = holdOnContentOf({
      key: "wastedPay",
      title: "This pays more than needed",
      body: "The cost is 2, and this payment adds up to 3.",
      facts: { paid: 3, required: 2, overpay: 1 },
      safeAction: { label: "Change payment" },
      anywayAction: { label: "Confirm payment" },
    });
    expect(content.facts).toEqual({
      kind: "rows",
      rows: [
        { label: "Paid", value: "3" },
        { label: "Needed", value: "2" },
      ],
    });
  });

  test("checkboxLabel is the fixed silence copy", () => {
    expect(holdOnContentOf(schemeFinishHint()).checkboxLabel).toBe("Don't warn me about this again");
  });
});

const PHONE: Rect = { x: 0, y: 0, width: 390, height: 844 };
const TABLET_LANDSCAPE: Rect = { x: 0, y: 0, width: 1024, height: 768 };
const DESKTOP: Rect = { x: 0, y: 0, width: 1440, height: 900 };
const SCHEME_RECT: Rect = { x: 700, y: 200, width: 220, height: 120 };

describe("holdOnLayoutOf", () => {
  test("phone: centred card, no leader, regardless of a scheme rect", () => {
    const layout = holdOnLayoutOf({ viewport: PHONE, boxWidth: 340, boxHeight: 300, schemeRect: SCHEME_RECT });
    expect(layout.leader).toBeNull();
    expect(layout.box.x).toBeCloseTo((390 - 340) / 2);
    expect(layout.box.width).toBe(340);
  });

  test("no scheme rect known: centred card even on a wide viewport", () => {
    const layout = holdOnLayoutOf({ viewport: DESKTOP, boxWidth: 340, boxHeight: 300, schemeRect: null });
    expect(layout.leader).toBeNull();
    expect(layout.box.x).toBeCloseTo((1440 - 340) / 2);
  });

  test("tablet-landscape with a scheme rect: anchored beside it, with a leader line to its centre", () => {
    const nearLeftEdge: Rect = { x: 400, y: 200, width: 200, height: 120 };
    const layout = holdOnLayoutOf({
      viewport: TABLET_LANDSCAPE,
      boxWidth: 340,
      boxHeight: 300,
      schemeRect: nearLeftEdge,
    });
    expect(layout.leader).not.toBeNull();
    expect(layout.leader?.to.x).toBeCloseTo(nearLeftEdge.x + nearLeftEdge.width / 2);
    expect(layout.leader?.to.y).toBeCloseTo(nearLeftEdge.y + nearLeftEdge.height / 2);
    // Room to the right of the scheme within a 1024-wide viewport: box sits to its right.
    expect(layout.box.x).toBeCloseTo(nearLeftEdge.x + nearLeftEdge.width + 24);
  });

  test("no room to the right: falls back to the scheme's left", () => {
    const nearRightEdge: Rect = { x: 900, y: 200, width: 220, height: 120 };
    const layout = holdOnLayoutOf({
      viewport: TABLET_LANDSCAPE,
      boxWidth: 340,
      boxHeight: 300,
      schemeRect: nearRightEdge,
    });
    expect(layout.box.x).toBeLessThan(nearRightEdge.x);
  });

  test("box stays within the viewport vertically", () => {
    const nearTop: Rect = { x: 700, y: 0, width: 220, height: 40 };
    const layout = holdOnLayoutOf({ viewport: TABLET_LANDSCAPE, boxWidth: 340, boxHeight: 500, schemeRect: nearTop });
    expect(layout.box.y).toBeGreaterThanOrEqual(16);
    expect(layout.box.y + layout.box.height).toBeLessThanOrEqual(768 - 16 + 0.01);
  });
});
