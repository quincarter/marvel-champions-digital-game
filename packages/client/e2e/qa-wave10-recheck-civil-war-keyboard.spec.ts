import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOTS } from "./qa-wave10-recheck-helpers.js";

/**
 * Re-check, area 3: the Civil War scenario builder driven by the keyboard alone (no pointer event, no `act()`): Tab and
 * Shift+Tab move the focus through the builder's own focus order (`view/civil-war-builder-model.ts` `focusOrder`), Enter
 * presses the focused control. Side, leader, stage 2, a swapped modular set, then Start on the review step, ending on
 * Take your seats. `__mcBuilderDebug.focused()` only reads which control has the focus.
 */

interface Tile {
  id: string;
  action: string;
  selected: boolean;
  enabled: boolean;
}
interface View {
  step: number;
  canStart: boolean;
  focusOrder: string[];
  sideChoices: { side: string; name?: string; selected: boolean; action?: string }[];
  leaderChoices: { scenarioId: string; name: string; selected: boolean }[];
  stageRows: { options: { name: string; action: string; selected: boolean }[] }[];
  modular: { chosen: number; sections: { tiles: Tile[] }[] };
  summary: string[];
}

const dbg = <T>(page: Page, method: string): Promise<T> =>
  page.evaluate(
    (m) => (window as unknown as { __mcBuilderDebug: Record<string, () => unknown> }).__mcBuilderDebug[m]!() as never,
    method,
  );
const view = (page: Page): Promise<View> => dbg<View>(page, "view");
const focused = (page: Page): Promise<string | null> => dbg<string | null>(page, "focused");

/** Presses Tab or Shift+Tab, whichever is shorter around the focus order (it wraps), until `key` has the focus. Returns the presses. */
async function tabTo(page: Page, key: string): Promise<number> {
  const order = (await view(page)).focusOrder;
  const target = order.indexOf(key);
  if (target < 0) throw new Error(`${key} is not in the focus order`);
  let presses = 0;
  for (let i = 0; i < 120; i++) {
    const now = await focused(page);
    if (now === key) return presses;
    const at = now === null ? -1 : order.indexOf(now);
    const forward = (target - at + order.length) % order.length;
    const backward = at < 0 ? Infinity : (at - target + order.length) % order.length;
    await page.keyboard.press(backward < forward ? "Shift+Tab" : "Tab");
    presses++;
    await settle(page, { quietMs: 40, maxMs: 300 });
  }
  throw new Error(`The focus never reached ${key}`);
}

const pressCounts: string[] = [];
async function enterOn(page: Page, key: string): Promise<void> {
  pressCounts.push(`${key}:${await tabTo(page, key)}`);
  await page.keyboard.press("Enter");
  await settle(page, { quietMs: 150, maxMs: 800 });
}

for (const size of [
  { name: "390x844", width: 390, height: 844 },
  { name: "1440x900", width: 1440, height: 900 },
] as const) {
  test.describe(`Civil War builder by keyboard at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("side, leader, stage 2, a set swap and Start are all reachable with Tab and Enter", async ({ page }) => {
      test.setTimeout(180_000);
      const errors = trackPageErrors(page);
      await openApp(page, "unlock=all&screen=civil-war-builder&entry=build", { landing: "CivilWarBuilder" });
      await waitFor(
        async () => ((await page.evaluate(() => "__mcBuilderDebug" in window)) ? true : null),
        "the builder's debug hook",
        10000,
      );
      await settle(page);
      let v = await view(page);
      expect(v.step, "Build your own opens on the side step").toBe(1);

      // 1. Side: the unselected side.
      const otherSide = v.sideChoices.find((s) => !s.selected)!;
      const sideKey = otherSide.action ?? `civil:side:${otherSide.side}`;
      await enterOn(page, sideKey);
      v = await view(page);
      expect(v.sideChoices.find((s) => s.selected)?.side, "Enter on a side picks it").toBe(otherSide.side);

      // 2. Leader: go to the step through the rail, then pick the leader that is not selected.
      await enterOn(page, "civil:step:2");
      v = await view(page);
      expect(v.step).toBe(2);
      const otherLeader = v.leaderChoices.find((l) => !l.selected)!;
      await enterOn(page, `civil:leader:${otherLeader.scenarioId}`);
      v = await view(page);
      expect(v.leaderChoices.find((l) => l.selected)?.scenarioId).toBe(otherLeader.scenarioId);
      expect(await focused(page), "focus stays on the control just pressed").toBe(
        `civil:leader:${otherLeader.scenarioId}`,
      );

      // 3. Stage 2: the first option not selected in the stage 2 row.
      await enterOn(page, "civil:step:3");
      v = await view(page);
      expect(v.step).toBe(3);
      const row = v.stageRows[v.stageRows.length - 1]!;
      const pick = row.options.find((o) => !o.selected) ?? row.options[0]!;
      await enterOn(page, pick.action);
      v = await view(page);
      expect(v.stageRows[v.stageRows.length - 1]!.options.find((o) => o.selected)?.action).toBe(pick.action);

      // 4. Modular sets: take one out and put another in (four is the most).
      await enterOn(page, "civil:step:4");
      v = await view(page);
      expect(v.step).toBe(4);
      const tiles = v.modular.sections.flatMap((s) => s.tiles);
      const out = tiles.find((t) => t.selected && t.enabled);
      if (out) {
        await enterOn(page, out.action);
        v = await view(page);
      }
      const into = v.modular.sections
        .flatMap((s) => s.tiles)
        .find((t) => !t.selected && t.enabled && t.id !== out?.id)!;
      await enterOn(page, into.action);
      v = await view(page);
      expect(
        v.modular.sections.flatMap((s) => s.tiles).find((t) => t.id === into.id)?.selected,
        "Enter on a set tile picks it",
      ).toBe(true);
      await page.screenshot({ path: `${SHOTS}/wave10-recheck-keyboard-${size.name}-sets.png` });

      // 5. Review, then Start by keyboard.
      await enterOn(page, "civil:step:5");
      v = await view(page);
      expect(v.step).toBe(5);
      expect(v.canStart).toBe(true);
      expect(v.summary.join(" | ")).toContain(otherLeader.name);
      await page.screenshot({ path: `${SHOTS}/wave10-recheck-keyboard-${size.name}-review.png` });
      await enterOn(page, "civil:start");
      test.info().annotations.push({ type: "presses", description: pressCounts.join(" ") });
      await waitFor(async () => ((await activeScenes(page)).includes("Seats") ? true : null), "Take your seats", 10000);
      expect(errors).toEqual([]);
    });

    test("Shift+Tab walks the focus order backwards and Enter on a refused Start says why instead of going on", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await openApp(page, "unlock=all&screen=civil-war-builder&entry=build", { landing: "CivilWarBuilder" });
      await waitFor(
        async () => ((await page.evaluate(() => "__mcBuilderDebug" in window)) ? true : null),
        "the builder's debug hook",
        10000,
      );
      await settle(page);
      // Take every selected set out by keyboard so that Start is refused (fewer than three sets).
      await enterOn(page, "civil:step:4");
      for (let guard = 0; guard < 6; guard++) {
        const v = await view(page);
        const chosen = v.modular.sections.flatMap((s) => s.tiles).find((t) => t.selected && t.enabled);
        if (!chosen || v.modular.chosen < 3) break;
        await enterOn(page, chosen.action);
      }
      const v = await view(page);
      expect(v.modular.chosen).toBeLessThan(3);
      expect(v.canStart).toBe(false);
      await enterOn(page, "civil:start");
      const status = await dbg<string>(page, "status");
      expect(status, "a refused Start says why").not.toBe("");
      expect((await activeScenes(page)).includes("Seats"), "Start did not go on").toBe(false);
      expect(await focused(page), "the focus is still on Start after a refused press").toBe("civil:start");
    });

    // FINDING (should-fix): forward from Random the order is Random, Random and blind, Preconstructed, Back, Start, but
    // Shift+Tab from Start lands on Random, skipping the three controls between, and then on a set tile. A keyboard
    // player stepping back from Start cannot reach Back or Random and blind that way.
    test.fail("Shift+Tab from Start steps back through Back, Preconstructed and Random and blind", async ({ page }) => {
      test.setTimeout(120_000);
      await openApp(page, "unlock=all&screen=civil-war-builder&entry=build", { landing: "CivilWarBuilder" });
      await waitFor(
        async () => ((await page.evaluate(() => "__mcBuilderDebug" in window)) ? true : null),
        "the builder's debug hook",
        10000,
      );
      await settle(page);
      // On the sets step, where the grid of every set sits in the focus order.
      await enterOn(page, "civil:step:4");
      await tabTo(page, "civil:start");
      await page.screenshot({ path: `${SHOTS}/wave10-recheck-keyboard-${size.name}-start-focus.png` });
      const back: string[] = [];
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("Shift+Tab");
        await settle(page, { quietMs: 60, maxMs: 300 });
        back.push((await focused(page)) ?? "none");
      }
      expect(back).toEqual(["civil:back", "civil:preconstructed", "civil:random-blind", "civil:random"]);
    });
  });
}
