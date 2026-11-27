import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * How to win draws as a Lit panel over the canvas (`mc-sheet`, `src/dom/sheet-builder.ts`): its text is found under its
 * scene, the three card scans are pictures in the panel, the "threat" term opens its tooltip (a mouse over it on a
 * desktop, a tap on a phone), the keyboard walks the same stops with the ring drawn in the DOM, Escape closes the
 * tooltip first and then leaves, and a mouse over a card scan shows the card hover popover.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;
type Rect = { x: number; y: number; width: number; height: number };
type DebugName = "termRects" | "tipRect" | "hoverKey";

const focusOf = (page: Page, scene: string): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate((key) => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState[key]!(), scene);

const panel = `#mc-ui [data-scene="HowToWin"]`;
const debug = <T>(page: Page, name: DebugName): Promise<T> =>
  page.evaluate(
    (n) => (window as unknown as Record<string, Record<string, () => unknown>>).__mcHowToWinDebug![n]!(),
    name,
  ) as Promise<T>;

test("How to win is a Lit panel: three card scans, the keyboard walks to the term and Escape closes its tooltip then leaves", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=howtowin", { landing: "HowToWin" });
  await waitForText(page, "ONE WAY TO WIN.", { sceneKey: "HowToWin" });
  expect(await findText(page, "TWO WAYS TO LOSE.", "HowToWin")).not.toHaveLength(0);
  expect(await findText(page, "LESSON 1 OF 5", "HowToWin")).not.toHaveLength(0);
  expect(await findText(page, "EVERY ROUND", "HowToWin")).not.toHaveLength(0);
  await expect(page.locator(panel).getByText("Start the fight")).toHaveCount(1);
  await expect(page.locator(panel).getByText("Tell me more")).toHaveCount(1);
  // The Rhino, The Break-In! and Spider-Man scans are pictures in the panel.
  await expect(page.locator(`${panel} [data-key^="scan:"]`)).toHaveCount(3);

  // Tab walks the route: the close first, then the dotted term, then the two buttons.
  await pressKey(page, "Tab");
  await waitFor(async () => ((await focusOf(page, "HowToWin")).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page, "HowToWin")).focus).toBe("close");
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  await pressKey(page, "Tab");
  expect((await focusOf(page, "HowToWin")).focus).toBe("term:threat");

  // Enter opens the tooltip, with its link; Escape closes it and the screen stays.
  await pressKey(page, "Enter");
  await waitForText(page, "RULES GLOSSARY", { sceneKey: "HowToWin" });
  expect(await debug<Rect | null>(page, "tipRect")).not.toBeNull();
  await pressKey(page, "Escape");
  await waitFor(
    async () => ((await debug<Rect | null>(page, "tipRect")) === null ? true : null),
    "the tooltip closes",
    5000,
  );
  expect(await activeScenes(page)).toContain("HowToWin");

  // The tooltip's link opens the Rules reference at the glossary.
  await pressKey(page, "Enter");
  await waitForText(page, "RULES GLOSSARY", { sceneKey: "HowToWin" });
  await page.locator(`${panel} [data-key="tip-link"]`).click();
  await waitFor(async () => ((await activeScenes(page)).includes("RulesOverlay") ? true : null), "Rules opens", 10_000);
  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("RulesOverlay") ? true : null),
    "Rules closes",
    10_000,
  );

  // Escape leaves for Title; the panel and its ring go with the screen.
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "back on Title", 10_000);
  await expect(page.locator(panel)).toHaveCount(0);
  await expect(page.locator("#mc-ui .mc-focus-ring")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("on a desktop a mouse over the term opens its tooltip and over a card scan shows the card hover popover", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "a mouse");
  test.setTimeout(120_000);
  await openApp(page, "screen=howtowin", { landing: "HowToWin" });
  await waitForText(page, "ONE WAY TO WIN.", { sceneKey: "HowToWin" });
  const [term] = await debug<{ id: string; rect: Rect }[]>(page, "termRects");
  expect(term!.id).toBe("threat");
  await page.mouse.move(term!.rect.x - 4, term!.rect.y - 4);
  await page.mouse.move(term!.rect.x + term!.rect.width / 2, term!.rect.y + term!.rect.height / 2);
  await waitFor(
    async () => ((await debug<Rect | null>(page, "tipRect")) !== null ? true : null),
    "the tooltip opens",
    5000,
  );
  // Moving away from both the term and the tooltip closes it.
  await page.mouse.move(20, 600);
  await page.mouse.move(24, 604);
  await waitFor(
    async () => ((await debug<Rect | null>(page, "tipRect")) === null ? true : null),
    "the tooltip closes",
    5000,
  );

  const scan = page.locator(`${panel} [data-key="scan:win"]`);
  const box = (await scan.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 - 3, box.y + box.height / 2 - 3);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await waitFor(async () => (await debug<string | null>(page, "hoverKey")) ?? null, "the hover popover shows", 10_000);
});

test("on a phone, a tap on the term opens the tooltip and a tap on it again closes it", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch");
  test.setTimeout(120_000);
  await openApp(page, "screen=howtowin", { landing: "HowToWin" });
  await waitForText(page, "ONE WAY TO WIN.", { sceneKey: "HowToWin" });
  const [term] = await debug<{ id: string; rect: Rect }[]>(page, "termRects");
  const at = { x: term!.rect.x + term!.rect.width / 2, y: term!.rect.y + term!.rect.height / 2 };
  await page.touchscreen.tap(at.x, at.y);
  await waitFor(
    async () => ((await debug<Rect | null>(page, "tipRect")) !== null ? true : null),
    "the tooltip opens",
    5000,
  );
  await page.touchscreen.tap(at.x, at.y);
  await waitFor(
    async () => ((await debug<Rect | null>(page, "tipRect")) === null ? true : null),
    "the tooltip closes",
    5000,
  );
});

test("How to win reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "screen=howtowin", { landing: "HowToWin" });
  await waitForText(page, "UNA FORMA DE GANAR.", { sceneKey: "HowToWin" });
  await waitForText(page, "DOS FORMAS DE PERDER.", { sceneKey: "HowToWin" });
  await waitForText(page, "LECCIÓN 1 DE 5", { sceneKey: "HowToWin" });
  await waitForText(page, "CADA RONDA", { sceneKey: "HowToWin" });
  await expect(page.locator(panel).getByText("Cuéntame más")).toHaveCount(1);
  await expect(page.locator(panel).getByText("Empezar la lucha")).toHaveCount(1);
  await expect(page.locator(panel).getByText("amenaza", { exact: false }).first()).toBeVisible();
});
