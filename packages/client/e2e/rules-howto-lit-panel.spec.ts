import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * How to play and the Rules reference draw as Lit panels over the canvas (`mc-sheet`, `src/dom/sheet-builder.ts`):
 * their text is found under their scenes, the keyboard walks the same stops in the same order with the ring drawn in
 * the DOM, Enter opens an entry, the Rules search filters the glossary, Escape leaves, and on a phone the lift that ends
 * a swipe over a list presses nothing.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page, scene: string): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate((key) => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState[key]!(), scene);

/** The Villain phase tab's own citation: the glossary's cites never carry this wording. */
const CITATION = 'RRG 1.8 p. 47 "Villain Phase"';

const panel = (scene: string) => `#mc-ui [data-scene="${scene}"]`;

/** Presses `key` (Down first, Right when Down goes nowhere) until the route's focus is `target`. */
async function walkTo(page: Page, scene: string, target: string, keys = ["ArrowDown", "ArrowRight"]): Promise<void> {
  for (let step = 0; step < 40; step++) {
    const { focus } = await focusOf(page, scene);
    if (focus === target) return;
    await pressKey(page, keys[step % keys.length]!);
    await page.waitForTimeout(80);
  }
  throw new Error(`the focus never reached ${target} on ${scene}: it is on ${(await focusOf(page, scene)).focus}`);
}

test("How to play is a Lit panel: the keyboard walks its rows, Enter on Rules & glossary opens the Rules reference", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=howtoplay&unlock=all", { landing: "HowToPlay" });
  await waitForText(page, "THE BASICS", { sceneKey: "HowToPlay" });
  expect(await findText(page, "ASPECTS", "HowToPlay"), "the section labels are in the panel").not.toHaveLength(0);
  // The closing band sits below the fold of a list this long: in the panel, not necessarily inside its box.
  await expect(page.locator(panel("HowToPlay")).getByText("Continue learning")).toHaveCount(1);
  await expect(page.locator(`${panel("HowToPlay")} [data-key="list"]`)).toHaveCount(1);

  // The first arrow press takes the first stop, as it did in Phaser (Back ×, then the lessons).
  await pressKey(page, "ArrowDown");
  await waitFor(async () => ((await focusOf(page, "HowToPlay")).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page, "HowToPlay")).focus).toBe("close");
  expect((await focusOf(page, "HowToPlay")).ringShown).toBe(true);
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);

  await walkTo(page, "HowToPlay", "reference");
  await pressKey(page, "Enter");
  await waitFor(async () => ((await activeScenes(page)).includes("RulesOverlay") ? true : null), "Rules opens", 10_000);
  await waitForText(page, "Glossary", { sceneKey: "RulesOverlay" });

  // Escape leaves the Rules reference and lands back on How to play.
  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("RulesOverlay") ? true : null),
    "Rules closes",
    10_000,
  );
  expect(await activeScenes(page)).toContain("HowToPlay");

  // Escape again leaves for Title; the panel and its ring go with the screen.
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "back on Title", 10_000);
  await expect(page.locator(panel("HowToPlay"))).toHaveCount(0);
  await expect(page.locator("#mc-ui .mc-focus-ring")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("The Rules reference is a Lit panel: tabs by keyboard, the search filters the glossary, Escape leaves", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=rules&unlock=all", { landing: "RulesOverlay" });
  await waitForText(page, "Glossary", { sceneKey: "RulesOverlay" });
  await waitForText(page, "Villain phase", { sceneKey: "RulesOverlay" });
  await waitForText(page, "Card list", { sceneKey: "RulesOverlay" });
  // The caption beside the scope buttons draws only where there is room (not on a phone, `scenes/rules.ts`).
  await expect(page.locator(panel("RulesOverlay")).getByText("Filtered to what's on your table")).toHaveCount(
    info.project.name === "phone" ? 0 : 1,
  );

  // The keyboard reaches a tab (Tab walks the route: Back, the scope toggle, then the tabs; on a phone the arrows
  // would step through the list under the tabs) and Enter opens it.
  await walkTo(page, "RulesOverlay", "tab:glossary", ["Tab"]);
  await walkTo(page, "RulesOverlay", "tab:villainPhase", ["ArrowRight"]);
  expect((await focusOf(page, "RulesOverlay")).ringShown).toBe(true);
  await pressKey(page, "Enter");
  await waitForText(page, CITATION, { sceneKey: "RulesOverlay" });
  await expect(page.locator(`${panel("RulesOverlay")} [data-key="tab:villainPhase"]`)).toHaveAttribute("selected", "");
  // The six steps are cards in the list, each a stop of its own.
  await expect(page.locator(`${panel("RulesOverlay")} [data-key^="step:"]`)).toHaveCount(6);

  // The glossary: every term is a card in the list, and a query keeps only the terms that match.
  await walkTo(page, "RulesOverlay", "tab:glossary", ["ArrowLeft"]);
  await pressKey(page, "Enter");
  const entries = page.locator(`${panel("RulesOverlay")} [data-key^="entry:"]`);
  await waitFor(async () => ((await entries.count()) > 5 ? true : null), "the glossary lists terms", 10_000);
  const all = await entries.count();
  const search = page.locator('input[placeholder^="Search rules"]');
  await search.fill("retaliate");
  await waitFor(
    async () => {
      const now = await entries.count();
      return now > 0 && now < all ? true : null;
    },
    "the query narrows the glossary",
    10_000,
  );
  expect(await findText(page, "Retaliate", "RulesOverlay")).not.toHaveLength(0);
  await search.fill("zzzz-no-such-term");
  await waitForText(page, "No rules terms match that search.", { sceneKey: "RulesOverlay" });

  // Escape takes the caret out of the field, then leaves.
  await pressKey(page, "Escape");
  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("RulesOverlay") ? true : null),
    "Rules closes",
    10_000,
  );
  await expect(page.locator(panel("RulesOverlay"))).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("How to play and the Rules reference read in Spanish", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "screen=howtoplay&unlock=all", { landing: "HowToPlay" });
  await waitForText(page, "Aprende a jugar", { sceneKey: "HowToPlay" });
  await waitForText(page, "Lo básico", { sceneKey: "HowToPlay" });
  await waitForText(page, "Aspectos", { sceneKey: "HowToPlay" });
  await expect(page.locator(panel("HowToPlay")).getByText("Reglas y glosario")).toHaveCount(1);
  await expect(page.locator(panel("HowToPlay")).getByText("Seguir aprendiendo")).toHaveCount(1);

  await openApp(page, "screen=rules&unlock=all", { landing: "RulesOverlay" });
  await waitForText(page, "Referencia de reglas", { sceneKey: "RulesOverlay" });
  await waitForText(page, "Glosario", { sceneKey: "RulesOverlay" });
  await waitForText(page, "Fase del villano", { sceneKey: "RulesOverlay" });
  await waitForText(page, "Lista de cartas", { sceneKey: "RulesOverlay" });
  await expect(page.locator(panel("RulesOverlay")).getByText("Filtrado a lo que hay en tu mesa")).toHaveCount(
    info.project.name === "phone" ? 0 : 1,
  );
});

/** A finger drag from `from` to `to`, lifted at `to` (real touch events, as the villain review handle spec's). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const centerOf = async (page: Page, selector: string): Promise<{ x: number; y: number }> => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test("on a phone, the lift that ends a swipe over How to play's rows presses nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch swipe");
  test.setTimeout(120_000);
  await openApp(page, "screen=howtoplay&unlock=all", { landing: "HowToPlay" });
  await waitForText(page, "THE BASICS", { sceneKey: "HowToPlay" });
  const list = page.locator(`${panel("HowToPlay")} [data-key="list"]`);
  const first = await centerOf(page, `${panel("HowToPlay")} [data-key^="lesson:"]`);
  const rows = page.locator(`${panel("HowToPlay")} [data-key^="aspect:"]`);
  const target = await rows.first().boundingBox();
  // Down the list from a lesson row, lifted over an aspect row: a scroll, and the row under the finger stays unpressed.
  await swipe(page, first, { x: first.x, y: Math.min(780, (target?.y ?? 400) + 30) });
  await page.waitForTimeout(600);
  expect(await activeScenes(page)).toContain("HowToPlay");
  expect(await activeScenes(page)).not.toContain("HowToWin");
  expect(await activeScenes(page)).not.toContain("AspectLesson");
  expect(await activeScenes(page)).not.toContain("RulesOverlay");
  await expect(list).toHaveCount(1);
});

test("on a phone, the lift that ends a swipe over the Rules reference's list presses no tab and no card", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "a touch swipe");
  test.setTimeout(120_000);
  await openApp(page, "screen=rules&unlock=all", { landing: "RulesOverlay" });
  await waitForText(page, "Glossary", { sceneKey: "RulesOverlay" });
  await expect(page.locator(`${panel("RulesOverlay")} [data-key="tab:glossary"]`)).toHaveAttribute("selected", "");
  const view = page.viewportSize()!;
  const tab = await centerOf(page, `${panel("RulesOverlay")} [data-key="tab:villainPhase"]`);
  // From low in the glossary up to the tab rail: a scroll of the list that lifts over the Villain phase tab.
  await swipe(page, { x: view.width / 2, y: view.height - 120 }, { x: tab.x, y: tab.y });
  await page.waitForTimeout(600);
  expect(await findText(page, CITATION, "RulesOverlay"), "the Villain phase tab was not pressed").toHaveLength(0);
  await expect(page.locator(`${panel("RulesOverlay")} [data-key="tab:glossary"]`)).toHaveAttribute("selected", "");
  expect(await activeScenes(page)).not.toContain("InspectOverlay");
});

test("on a desktop, a card picture in the Rules reference shows the hover popover; a tap, a right-click and a hold open Inspect", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "a mouse");
  test.setTimeout(120_000);
  // From How to play there is no game under the Rules reference, so nothing covers the popover.
  await openApp(page, "screen=howtoplay&unlock=all", { landing: "HowToPlay" });
  await waitForText(page, "THE BASICS", { sceneKey: "HowToPlay" });
  await walkTo(page, "HowToPlay", "reference");
  await pressKey(page, "Enter");
  await waitFor(async () => ((await activeScenes(page)).includes("RulesOverlay") ? true : null), "Rules opens", 10_000);
  const thumb = page.locator(`${panel("RulesOverlay")} [data-key*=":card:"]`).first();
  await expect(thumb).toHaveCount(1);
  await thumb.scrollIntoViewIfNeeded();
  const box = (await thumb.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const inspect = async (): Promise<boolean> => (await activeScenes(page)).includes("InspectOverlay");
  const closeInspect = async (): Promise<void> => {
    await pressKey(page, "Escape");
    await waitFor(async () => ((await inspect()) ? null : true), "Inspect closes", 10_000);
  };

  // Resting the mouse on the picture shows the popover (the panel passes the mouse on to Phaser).
  await page.mouse.move(at.x - 3, at.y - 3);
  await page.mouse.move(at.x, at.y);
  await waitFor(
    () =>
      page.evaluate(
        () =>
          (window as unknown as { __mcRulesDebug: { hoverKey(): string | null } }).__mcRulesDebug.hoverKey() ?? null,
      ),
    "the hover popover shows",
    10_000,
  );

  // A tap opens Inspect, as it did.
  await page.mouse.click(at.x, at.y);
  await waitFor(inspect, "a tap opens Inspect", 10_000);
  await closeInspect();
  // A right-click does too, with no browser menu.
  await page.mouse.click(at.x, at.y, { button: "right" });
  await waitFor(inspect, "a right-click opens Inspect", 10_000);
  await closeInspect();
  // So does a press-and-hold, and its release does not open it a second time.
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await waitFor(inspect, "a hold opens Inspect", 10_000);
  await closeInspect();
  await page.waitForTimeout(400);
  expect(await inspect(), "the hold's release did not open Inspect again").toBe(false);
});

test("a card hold armed in the Rules reference raises no Inspect once another modal opens over it", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "a mouse");
  test.setTimeout(120_000);
  // Opened from How to play, like the hover test above: no game is under it, so every entry shows its card pictures.
  await openApp(page, "screen=howtoplay&unlock=all", { landing: "HowToPlay" });
  await waitForText(page, "THE BASICS", { sceneKey: "HowToPlay" });
  await walkTo(page, "HowToPlay", "reference");
  await pressKey(page, "Enter");
  await waitFor(async () => ((await activeScenes(page)).includes("RulesOverlay") ? true : null), "Rules opens", 10_000);
  await waitForText(page, "Glossary", { sceneKey: "RulesOverlay" });
  const thumb = page.locator(`${panel("RulesOverlay")} [data-key*=":card:"]`).first();
  await expect(thumb).toHaveCount(1);
  await thumb.scrollIntoViewIfNeeded();
  const box = (await thumb.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // Arm the hold, then let a modal take the screen before its timer fires.
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.evaluate(() => {
    // A scene drawn above the Rules reference (later in the draw order; Pause is registered before it, so it is under it).
    const game = (globalThis as unknown as { __mcGame: { scene: { run(key: string): void } } }).__mcGame;
    game.scene.run("SettingsOverlay");
  });
  await waitFor(
    async () => ((await activeScenes(page)).includes("SettingsOverlay") ? true : null),
    "a modal opens",
    10_000,
  );
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await activeScenes(page), "no Inspect was delivered to the covered panel").not.toContain("InspectOverlay");
});
