import { expect, test, type Page } from "@playwright/test";
import {
  activeScenes,
  clickFocus,
  clickText,
  findText,
  focusRect,
  guideStepId,
  handInstanceFor,
  pressAt,
  pressKey,
  pressUntil,
  settle,
  trackPageErrors,
  waitFor,
} from "./helpers.js";
import {
  answerChoice,
  boxPageRows,
  clickBoxPageRow,
  findVisibleText,
  hook,
  openApp,
  openBoxPage,
  startMechanicLesson,
  useIdentityAbility,
  type HubRow,
  type Rect,
} from "./wave6-helpers-b.js";
import { skipVillainPhase } from "./wave6-helpers-a.js";

/**
 * The How to play hub and the wave 6 Try-it lessons (guided mode §3.14): the "New in each box" band, the box pages and
 * their cross links, the Rules reference hand-off, one Try-it lesson played to its completion panel and saved, the
 * first steps of the other five, and the Shadowcat villain-phase invariant. Full playthroughs of every lesson are
 * Vitest's job (`guide/mechanic-lessons.test.ts`); this plays the real screens.
 */

const on = async (page: Page, key: string): Promise<boolean> => (await activeScenes(page)).includes(key);
const stepIs = (page: Page, id: string) => async (): Promise<true | null> =>
  (await guideStepId(page)) === id ? true : null;

async function openHub(page: Page): Promise<void> {
  await clickText(page, "How to play");
  await waitFor(async () => ((await on(page, "HowToPlay")) ? true : null), "How to play opens", 8000);
  await settle(page);
}

async function anchor(page: Page): Promise<Rect | null> {
  return hook<Rect>(page, "__mcBoardDebug", "guideAnchorRect");
}

/** Waits for TRY THIS to settle on `target()` (a layout can still be animating in for a moment on a slow runner), then
 * returns the ring. State, not a fixed sleep. */
async function settledAnchorOn(page: Page, target: () => Promise<Rect | null>, label: string): Promise<Rect> {
  return waitFor(
    async () => {
      const ring = await anchor(page);
      const rect = await target();
      return ring && rect && centerIn(ring, rect) ? ring : null;
    },
    label,
    30000,
  );
}

const centerIn = (outer: Rect, inner: Rect): boolean => {
  const cx = inner.x + inner.width / 2;
  const cy = inner.y + inner.height / 2;
  return cx >= outer.x && cx <= outer.x + outer.width && cy >= outer.y && cy <= outer.y + outer.height;
};

async function identityRect(page: Page): Promise<Rect> {
  const rect = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game: { players: { identity: { instanceId: string } }[] } } } };
    };
    const id = appSession().store.state.game.players[0]!.identity.instanceId;
    return (window as unknown as { __mcBoardDebug: { hitRect(i: string): Rect | null } }).__mcBoardDebug.hitRect(id);
  });
  if (!rect) throw new Error("no identity rect");
  return rect;
}

async function handCardRect(page: Page, code: string): Promise<Rect> {
  const id = await handInstanceFor(page, code);
  if (!id) throw new Error(`card ${code} not in hand`);
  const rect = await page.evaluate(
    (i) => (window as unknown as { __mcBoardDebug: { hitRect(i: string): Rect | null } }).__mcBoardDebug.hitRect(i),
    id,
  );
  if (!rect) throw new Error(`no rect for ${code}`);
  return rect;
}

test.describe("How to play hub", () => {
  test("the New in each box band lists a page per box, its columns line up, and the box pages link both ways", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await openApp(page);
    await openHub(page);

    expect(await findText(page, "NEW IN EACH BOX", "HowToPlay"), "the band is labeled").not.toHaveLength(0);
    const boxes = (await hook<HubRow[]>(page, "__mcHowToPlayDebug", "boxes"))!;
    const titles = boxes.map((b) => b.title);
    for (const wanted of ["Core rules added later", "New in Mutant Genesis", "New in MojoMania"]) {
      expect(titles, `the band lists "${wanted}"`).toContain(wanted);
    }
    expect(new Set(boxes.map((b) => b.id)).size, "one row per box").toBe(boxes.length);

    // The two columns: every box row sits in the x and width of the rows above it.
    const lessons = (await hook<HubRow[]>(page, "__mcHowToPlayDebug", "lessons"))!;
    const aspects = (await hook<HubRow[]>(page, "__mcHowToPlayDebug", "aspects"))!;
    const reference = (await hook<Rect>(page, "__mcHowToPlayDebug", "reference"))!;
    const left = lessons[0]!;
    const right = aspects[0]!;
    expect(left.x, "the columns are two different x positions").toBeLessThan(right.x);
    for (const row of lessons)
      expect([row.x, row.width], `lesson ${row.id} is in the left column`).toEqual([left.x, left.width]);
    for (const row of aspects)
      expect([row.x, row.width], `aspect ${row.id} is in the right column`).toEqual([right.x, right.width]);
    expect([reference.x, reference.width], "Rules & glossary is in the right column").toEqual([right.x, right.width]);
    boxes.forEach((row, i) => {
      const column = i % 2 === 0 ? left : right;
      expect([row.x, row.width], `box row "${row.title}" is in the ${i % 2 === 0 ? "left" : "right"} column`).toEqual([
        column.x,
        column.width,
      ]);
    });

    // New in Mutant Genesis -> an entry opens the Rules reference on that entry -> back.
    await openBoxPage(page, "New in Mutant Genesis");
    expect(await hook<string>(page, "__mcNewInBoxDebug", "title")).toBe("New in Mutant Genesis");
    const rows = await boxPageRows(page);
    const entry = rows.find((r) => r.kind !== "tryit")!;
    await clickBoxPageRow(page, entry.id);
    await waitFor(
      async () => ((await on(page, "RulesOverlay")) ? true : null),
      "the entry opens the Rules reference",
      6000,
    );
    await settle(page);
    expect(
      await findVisibleText(page, entry.name, "RulesOverlay"),
      `the Rules reference shows "${entry.name}"`,
    ).not.toHaveLength(0);
    await pressKey(page, "Escape");
    await waitFor(
      async () => (!(await on(page, "RulesOverlay")) ? true : null),
      "Escape closes the Rules reference",
      4000,
    );
    expect(await on(page, "NewInBox"), "the box page is still there").toBe(true);

    // "Also a Core rule" goes to the Core page, and its "Added with Mutant Genesis" comes straight back.
    const linked = rows.find((r) => r.link === "Also a Core rule")!;
    expect(linked, "Mutant Genesis has an entry that is also a Core rule").toBeDefined();
    await clickBoxPageRow(page, linked.id, "link");
    await waitFor(
      async () => ((await hook<string>(page, "__mcNewInBoxDebug", "title")) === "Core rules added later" ? true : null),
      "the link opens the Core rules page",
      6000,
    );
    await settle(page);
    const coreRow = (await boxPageRows(page)).find((r) => r.id === linked.id);
    expect(coreRow?.link, "the same entry on the Core page links back").toBe("Added with Mutant Genesis");
    await clickBoxPageRow(page, linked.id, "link");
    await waitFor(
      async () => ((await hook<string>(page, "__mcNewInBoxDebug", "title")) === "New in Mutant Genesis" ? true : null),
      "the link opens Mutant Genesis again",
      6000,
    );

    // Escape leaves the page for the hub.
    await pressKey(page, "Escape");
    await waitFor(async () => ((await on(page, "HowToPlay")) ? true : null), "Escape returns to the hub", 6000);
    expect(errors).toEqual([]);
  });

  test("a fresh profile (nothing unlocked) has no New in each box band", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await openApp(page, "");
    await openHub(page);
    expect(await hook<unknown[]>(page, "__mcHowToPlayDebug", "boxes")).toEqual([]);
    expect(await findText(page, "NEW IN EACH BOX", "HowToPlay")).toEqual([]);
    expect(
      await findText(page, "Continue learning", "HowToPlay"),
      "the rest of the hub is still there",
    ).not.toHaveLength(0);
    expect(errors).toEqual([]);
  });
});

test.describe("Try-it lessons", () => {
  test("Storm: the Weather deck plays to its completion panel, and the completion is saved", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await openApp(page);
    await startMechanicLesson(page, "storm");
    expect(await guideStepId(page)).toBe("intro");

    await clickText(page, "Got it", { sceneKey: "Board" });
    await waitFor(stepIs(page, "flip"), "the flip step", 8000);
    await settledAnchorOn(page, () => focusRect(page, "basic:changeForm"), "TRY THIS rings the Flip button");
    await clickFocus(page, "basic:changeForm");
    await waitFor(stepIs(page, "weather-control"), "the Weather Control step", 8000);
    await settledAnchorOn(page, () => identityRect(page), "TRY THIS rings Storm's panel");

    await useIdentityAbility(page, "Weather Control");
    await answerChoice(page, 1); // Hurricane: its Special asks for a scheme
    if (await on(page, "ChoiceOverlay")) await answerChoice(page, 0);
    await waitFor(stepIs(page, "special-resolved"), "the Special resolves", 10000);
    await settle(page);
    await clickText(page, "Got it", { sceneKey: "Board" });
    await waitFor(
      async () => ((await findVisibleText(page, "Try it complete", "Board")).length > 0 ? true : null),
      "the completion panel",
      8000,
    );

    // Saved: after a reload the lesson's row on the Mutant Genesis page says Done.
    await page.reload();
    await waitFor(async () => ((await on(page, "Title")) ? true : null), "Title after reload", 30000);
    await openHub(page);
    await openBoxPage(page, "New in Mutant Genesis");
    expect(await findText(page, "Done", "NewInBox"), "only Storm's Try-it row carries a Done mark").toHaveLength(1);
    expect(errors).toEqual([]);
  });

  const LESSONS = [
    { id: "phoenix", third: { card: "34024" } },
    { id: "gambit", third: { identity: true } },
    { id: "rogue", third: { identity: true } },
    { id: "colossus", third: { card: "32009" } },
  ] as const;
  for (const lesson of LESSONS) {
    test(`${lesson.id}: the first step renders, and TRY THIS rings the flip button and then the next target`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const errors = trackPageErrors(page);
      await openApp(page);
      await startMechanicLesson(page, lesson.id);
      expect(await guideStepId(page), "the lesson opens on its intro").toBe("intro");
      expect(await findVisibleText(page, "Lesson 1 of 1", "Board"), "the guide rail is up").not.toHaveLength(0);

      await clickText(page, "Got it", { sceneKey: "Board" });
      await waitFor(stepIs(page, "flip"), "the flip step", 8000);
      await settledAnchorOn(page, () => focusRect(page, "basic:changeForm"), "TRY THIS rings the Flip button");
      await waitFor(
        async () => ((await findVisibleText(page, "try this")).length > 0 ? true : null),
        "the TRY THIS tag is drawn",
        8000,
      );

      await clickFocus(page, "basic:changeForm");
      // A hero's "after you change form" prompt may open; the step moves on either way.
      await waitFor(
        async () => {
          if (await on(page, "ChoiceOverlay")) await answerChoice(page, 0);
          return (await guideStepId(page)) !== "flip" ? true : null;
        },
        "the step after flip",
        30000,
      );
      await settledAnchorOn(
        page,
        () => ("card" in lesson.third ? handCardRect(page, lesson.third.card) : identityRect(page)),
        "TRY THIS sits on the real target",
      );
      expect(errors).toEqual([]);
    });
  }

  test("shadowcat: the step never changes while the villain-phase overlay is up, and moves on once it closes", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await openApp(page);
    await startMechanicLesson(page, "shadowcat");
    expect(await guideStepId(page)).toBe("intro");
    await clickText(page, "Got it", { sceneKey: "Board" });
    await waitFor(stepIs(page, "phase-control"), "the Phase Control step", 8000);
    await settledAnchorOn(page, () => identityRect(page), "TRY THIS rings Kitty's panel, right of the rail");

    await useIdentityAbility(page, "Kitty Pryde");
    await waitFor(stepIs(page, "flip"), "Phase Control is done", 8000);
    await clickFocus(page, "basic:changeForm");
    await waitFor(stepIs(page, "end-turn"), "the end-turn step", 8000);
    await clickFocus(page, "basic:endTurn");
    await waitFor(async () => ((await on(page, "EndTurnConfirmOverlay")) ? true : null), "the end-turn confirm", 30000);
    await settle(page);
    await clickText(page, "End turn", { sceneKey: "EndTurnConfirmOverlay" });
    // Either a discard-to-hand-size prompt or the villain phase follows.
    await waitFor(
      async () => {
        if (await on(page, "VillainPhaseOverlay")) return true;
        if (await on(page, "ChoiceOverlay")) await answerChoice(page, 0);
        return null;
      },
      "the villain phase opens",
      60000,
    );
    await waitFor(stepIs(page, "declare-defender"), "the defend step", 30000);
    const defendOptions = async (): Promise<[string, Rect][]> =>
      ((await hook<[string, Rect][]>(page, "__mcChoiceDebug", "allRects")) ?? []).filter(
        ([key]) => key.startsWith("option:") && key !== "option:decline",
      );
    await waitFor(async () => ((await defendOptions()).length > 0 ? true : null), "the defend options", 30000);
    await settle(page);
    const options = await defendOptions();
    expect(options, "Shadowcat is offered as the defender").toHaveLength(1);
    const o = options[0]![1];
    await pressAt(page, o.x + o.width / 2, o.y + o.height / 2);
    await settle(page);
    await clickText(page, "Confirm", { sceneKey: "ChoiceOverlay" });

    // One evaluate per sample, so the overlay and the step are read at the same instant, and "overlay up" is the
    // client's own `blocked()`: the walkthrough scene active with no decision pending.
    const sample = (): Promise<{ blocked: boolean; overlay: boolean; step: string | null }> =>
      page.evaluate(async () => {
        // The module import is the only await, and it comes first: every read below is then synchronous, so the
        // overlay, the pending choice and the step are one instant even when a slow runner stalls between frames.
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => { store: { state: { game: { pendingChoice: unknown } | null } } };
        };
        const w = window as unknown as {
          __mcGame: { scene: { scenes: { sys: { isActive: () => boolean; settings: { key: string } } }[] } };
          __mcBoardDebug: { guideStepId(): string | null };
        };
        const overlay = w.__mcGame.scene.scenes.some(
          (sc) => sc.sys.settings.key === "VillainPhaseOverlay" && sc.sys.isActive(),
        );
        const pending = appSession().store.state.game?.pendingChoice ?? null;
        return { blocked: overlay && pending === null, overlay, step: w.__mcBoardDebug.guideStepId() };
      });
    // Motion is off for the suite, so the walkthrough stays up until the player closes it: no timing to catch. Wait
    // for it to be up with no decision pending, read the step over several samples, then close it and see the step move.
    await waitFor(async () => ((await sample()).blocked ? true : null), "the overlay is up after the defense", 30000);
    const underOverlay = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const now = await sample();
      if (now.blocked) underOverlay.add(now.step ?? "none");
      await page.waitForTimeout(200); // sampling interval
    }
    expect([...underOverlay], "one step the whole time the overlay is up").toEqual(["declare-defender"]);
    await pressUntil(
      page,
      () => skipVillainPhase(page),
      async () => !(await on(page, "VillainPhaseOverlay")),
      "the walkthrough is closed",
    );
    await waitFor(stepIs(page, "back-to-solid"), "the lesson moves on once the overlay closes", 8000);
    expect(errors).toEqual([]);
  });
});
