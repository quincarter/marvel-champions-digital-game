import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The Extras reader and the side-story reader draw as Lit panels over the canvas. The reader's contents has a real
 * `<input>` search (`mc-search-field`): typing filters the sections after a short pause, the clear button empties it,
 * Escape leaves the field and a second Escape backs out, A / Enter on its stop puts the caret in; the section is a
 * natively scrolling article; a phone shows the contents and the section one at a time. The side story keeps its comic
 * picture in the canvas and the chrome in the panel.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page, scene: string): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate((key) => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState[key]!(), scene);

const READER = `#mc-ui [data-scene="ExtrasReader"]`;
const STORY = `#mc-ui [data-scene="SideStoryReader"]`;
const search = (page: Page) => page.locator(`${READER} [data-key="search"] input`);
const rows = (page: Page) => page.locator(`${READER} [data-key^="toc:"]`);

async function openReader(page: Page): Promise<void> {
  await openApp(page, "screen=extras-reader&book=book:rrg", { landing: "ExtrasReader" });
  await waitFor(async () => ((await rows(page).count()) > 5 ? true : null), "the contents list", 30_000);
}

test("the reader searches the book with a real input: typing filters, clear empties, Escape leaves the field then the screen", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openReader(page);
  await expect(search(page)).toHaveAttribute("placeholder", "Search this book…");
  const all = await rows(page).count();

  await search(page).click();
  await search(page).pressSequentially("retaliate");
  await waitFor(
    async () => {
      const now = await rows(page).count();
      return now > 0 && now < all ? now : null;
    },
    "the query narrows the contents",
    10_000,
  );
  expect(await findText(page, "RETALIATE", "ExtrasReader")).not.toHaveLength(0);

  // Escape takes the caret out of the field and the screen stays; the text stays too.
  await page.keyboard.press("Escape");
  await expect(search(page)).not.toBeFocused();
  await expect(search(page)).toHaveValue("retaliate");
  expect(await activeScenes(page)).toContain("ExtrasReader");

  // The clear button empties it at once and the whole contents come back.
  await page.locator(`${READER} [data-key="search"] .clear`).click();
  await expect(search(page)).toHaveValue("");
  await waitFor(async () => ((await rows(page).count()) === all ? true : null), "the contents are whole again", 10_000);

  // A query nothing matches says so.
  await search(page).fill("zzzzqqqq");
  await waitForText(page, "No section mentions that.", { sceneKey: "ExtrasReader" });
  await search(page).fill("");
  await waitFor(async () => ((await rows(page).count()) === all ? true : null), "the contents are whole again", 10_000);

  // Escape with the caret out backs out of the reader to Extras' Rulebooks tab (a phone's contents pane is the first).
  await search(page).press("Escape");
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Extras") ? true : null), "back on Extras", 15_000);
  expect(errors).toEqual([]);
});

test("the keyboard reaches the search stop, Enter puts the caret in, and a section opens as a scrolling article", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openReader(page);
  await pressKey(page, "Tab");
  await waitFor(async () => ((await focusOf(page, "ExtrasReader")).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page, "ExtrasReader")).focus).toBe("back");
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  await pressKey(page, "Tab");
  expect((await focusOf(page, "ExtrasReader")).focus).toBe("search");
  await page.keyboard.press("Enter");
  await expect(search(page)).toBeFocused();
  await page.keyboard.type("golden");
  await page.keyboard.press("Enter");
  await expect(search(page)).not.toBeFocused();
  await waitFor(
    async () => ((await findText(page, "THE GOLDEN RULES", "ExtrasReader")).length > 0 ? true : null),
    "the golden rules section is listed",
    10_000,
  );

  // Open the section: its text is an article in the panel, scrolled natively.
  await rows(page).first().click();
  const article = page.locator(`${READER} [data-key="reader-text"]`);
  await expect(article).toHaveCount(1);
  await expect(article.locator("h2.title")).toContainText(/golden/i);
  const scroller = article.locator(".scroller");
  const overflow = await scroller.evaluate((el) => el.scrollHeight - el.clientHeight);
  if (overflow > 40) {
    await scroller.hover();
    await page.mouse.wheel(0, 300);
    await waitFor(
      async () => ((await scroller.evaluate((el) => el.scrollTop)) > 0 ? true : null),
      "the text scrolls",
      5000,
    );
  }
  // NEXT moves on a section and the text starts from its top.
  await page.locator(`${READER} [data-key="next"]`).click();
  await waitFor(
    async () => ((await scroller.evaluate((el) => el.scrollTop)) === 0 ? true : null),
    "starts from the top",
    5000,
  );
});

test("on a phone the contents and a section are separate panes, and a swipe over the contents opens no section", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "a touch layout");
  test.setTimeout(120_000);
  await openReader(page);
  await expect(page.locator(`${READER} [data-key="reader-text"]`)).toHaveCount(0);
  const first = (await rows(page).nth(3).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = first.x + first.width / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: first.y + 10, id: 1 }] });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: first.y + 10 - i * 18, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(600);
  await expect(page.locator(`${READER} [data-key="reader-text"]`)).toHaveCount(0);
  // A tap opens one, and CONTENTS comes back.
  await rows(page).first().tap();
  await expect(page.locator(`${READER} [data-key="reader-text"]`)).toHaveCount(1);
  await page.locator(`${READER} [data-key="contents"]`).tap();
  await expect(page.locator(`${READER} [data-key="reader-text"]`)).toHaveCount(0);
});

test("the reader reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "screen=extras-reader&book=book:rrg", { landing: "ExtrasReader" });
  await expect(search(page)).toHaveAttribute("placeholder", "Buscar en este libro…");
  await search(page).fill("zzzzqqqq");
  await waitForText(page, "Ninguna sección menciona eso.", { sceneKey: "ExtrasReader" });
});

test("a side story keeps its comic in the canvas: NEXT turns the beat, CLOSE and Escape go back to Extras", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=side-story", { landing: "SideStoryReader" });
  await waitForText(page, "SIDE STORY", { sceneKey: "SideStoryReader" });
  expect(await findText(page, "PAGE 1", "SideStoryReader")).not.toHaveLength(0);
  const beat = (): Promise<number> =>
    page.evaluate(() => (window as unknown as { __mcSideStoryDebug: { beat(): number } }).__mcSideStoryDebug.beat());
  expect(await beat()).toBe(0);
  await page.locator(`${STORY} [data-key="next"]`).click();
  await waitFor(async () => ((await beat()) === 1 ? true : null), "NEXT turns the beat", 10_000);
  await expect(page.locator(`${STORY} [data-key="back"]`)).toHaveCount(1);
  await page.locator(`${STORY} [data-key="back"]`).click();
  await waitFor(async () => ((await beat()) === 0 ? true : null), "BACK returns", 10_000);
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes("Extras") ? true : null), "back on Extras", 15_000);
  expect(errors).toEqual([]);
});

test("a side story reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, "screen=side-story", { landing: "SideStoryReader" });
  await waitForText(page, "HISTORIA APARTE", { sceneKey: "SideStoryReader" });
  await waitForText(page, "PÁGINA 1", { sceneKey: "SideStoryReader" });
  await expect(page.locator(STORY).getByText("SIGUIENTE")).toHaveCount(1);
});
