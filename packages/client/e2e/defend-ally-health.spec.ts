import { expect, test, type Page } from "@playwright/test";
import { findText, pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #298: the defend panel showed what each defender would have left after the attack ("0 OF 4 HP LEFT") but not
 * what it has now, and an ally's damage is not on its card picture, so a hurt War Machine read like a fresh one. Each
 * option now says both ("NOW 2 OF 4 HP → 0 LEFT"). Played from the `?screen=defend-allies` jump: Iron Man against
 * Rhino, War Machine already holding 2 damage and Mockingbird unhurt, on Rhino's second attack.
 *
 * The options are tap controls (#227): a swipe that lifts over one must not pick it. On desktop the option's card
 * picture opens the hover popover and a click on it still picks the option.
 */

interface Hit {
  readonly id: string;
  readonly rect: Rect;
}

const debug = <T>(page: Page, name: string, ...args: unknown[]): Promise<T | null> =>
  page.evaluate(
    ([n, a]) => {
      const dbg = (window as unknown as { __mcVillainPhaseDebug?: Record<string, (...x: unknown[]) => unknown> })
        .__mcVillainPhaseDebug;
      return (dbg?.[n as string]?.(...(a as unknown[])) ?? null) as never;
    },
    [name, args] as const,
  );

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  await settle(page);
  if (phone) await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
  else await pressAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page);
};

/** A finger (phone) or mouse (desktop) drag from `from` to `to`, lifted at `to`. */
async function drag(page: Page, phone: boolean, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  if (!phone) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const picked = async (page: Page, title: string): Promise<boolean> =>
  (await findText(page, `${title} ✓`, "VillainPhaseOverlay")).length > 0;

test("issue #298: each defender says the health it has now, and a swipe that lifts on one picks nothing", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await installWave6Helpers(page);
  await page.goto("/?screen=defend-allies");
  await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 45_000);
  // The jump sends its last command once the board is up, which can redraw the panel under the first press: press
  // START and ANSWER until the defend panel is there.
  const ids = await waitFor(
    async () => {
      const start = await villainDebugRect(page, "startRect");
      if (start) await press(page, phone, start);
      const answer = await villainDebugRect(page, "answerRect");
      if (answer) await press(page, phone, answer);
      const options = await debug<string[]>(page, "defendOptionIds");
      return options && options.length === 4 ? options : null;
    },
    "the defend panel",
    30_000,
  );

  // War Machine has taken 2 of its 4 hit points; Mockingbird is whole.
  // In full where the card has the width, else as the table writes HP.
  for (const [full, short] of [
    ["NOW 2 OF 4 HP → 0 LEFT", "2/4 HP → 0 LEFT"],
    ["NOW 3 OF 3 HP → 0–1 LEFT", "3/3 HP → 0–1 LEFT"],
  ]) {
    const found = [
      ...(await findText(page, full, "VillainPhaseOverlay")),
      ...(await findText(page, short, "VillainPhaseOverlay")),
    ];
    expect(found, full).not.toHaveLength(0);
  }
  if (SHOT) await page.screenshot({ path: `${SHOT}/defend-ally-health-${info.project.name}.png` });

  // A swipe from "No defense" that lifts on War Machine's option picks nothing.
  const decline = (await debug<Rect>(page, "defendOptionRect", ids[0]))!;
  const warMachine = (await debug<Rect>(page, "defendOptionRect", ids[2]))!;
  await drag(
    page,
    phone,
    { x: decline.x + decline.width / 2, y: decline.y + decline.height / 2 },
    { x: warMachine.x + warMachine.width / 2, y: warMachine.y + warMachine.height / 2 },
  );
  await settle(page);
  expect(await picked(page, "War Machine defends"), "a swipe that lifted on War Machine picked it").toBe(false);
  expect(await picked(page, "No defense"), "a swipe from No defense picked it").toBe(false);

  if (!phone) {
    // The option's card picture hovers, and a click on the picture still picks the option.
    const hit = await waitFor(
      async () => {
        const hits = await page.evaluate(
          () =>
            (window as unknown as { __mcVillainHoverDebug?: { hits(): Hit[] } }).__mcVillainHoverDebug?.hits() ?? [],
        );
        return (
          hits.find(
            (h) =>
              h.rect.x >= warMachine.x &&
              h.rect.x + h.rect.width <= warMachine.x + warMachine.width &&
              h.rect.y >= warMachine.y &&
              h.rect.y + h.rect.height <= warMachine.y + warMachine.height,
          ) ?? null
        );
      },
      "War Machine's picture noted for the hover popover",
      10_000,
    );
    await page.mouse.move(4, 4);
    await page.waitForTimeout(150);
    await page.mouse.move(hit.rect.x + hit.rect.width / 2, hit.rect.y + hit.rect.height / 2, { steps: 4 });
    await waitFor(
      async () =>
        (await page.evaluate(
          () =>
            (
              window as unknown as { __mcVillainHoverDebug?: { shown(): string | null } }
            ).__mcVillainHoverDebug?.shown() ?? null,
        )) === hit.id
          ? true
          : null,
      "the hover popover on War Machine's picture",
      5_000,
    );
    if (SHOT) await page.screenshot({ path: `${SHOT}/defend-ally-health-hover.png` });
    await press(page, phone, hit.rect);
  } else {
    await press(page, phone, warMachine);
  }
  await waitFor(async () => ((await picked(page, "War Machine defends")) ? true : null), "War Machine picked", 10_000);
  expect(errors).toEqual([]);
});
