import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, tapAt, waitFor } from "./helpers.js";
import { declineMulligans, openApp, startGame, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #337: the card language button in the top bar, beside the music button. A globe and the language's code; a tap
 * opens the list, choosing Español sets `Settings.cardLanguage` and the button reads ES. With `?nativelang` (a dev-only
 * link standing in for a native install) a tap opens the "Other languages" note instead.
 */

test.use({ locale: "en-US" });

interface ButtonDebug {
  rect(): Rect | null;
  label(): string;
}

const hook = (page: Page) =>
  page.evaluate(() => {
    const debug = (window as unknown as { __mcLanguageButtonDebug?: ButtonDebug }).__mcLanguageButtonDebug;
    return debug ? { rect: debug.rect(), label: debug.label() } : null;
  });
const labelOf = async (page: Page): Promise<string | null> => (await hook(page))?.label ?? null;

const centre = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

async function press(page: Page, phone: boolean, at: { x: number; y: number }): Promise<void> {
  if (phone) await tapAt(page, at.x, at.y);
  else await pressAt(page, at.x, at.y);
}

const savedLanguage = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { cardLanguage: string } };
    };
    return appSession().settings.cardLanguage;
  });

const stopRect = (page: Page, key: string): Promise<Rect | null> =>
  page.evaluate((k) => {
    const routes = (window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]> })
      .__mcFocusRoutes;
    return routes?.["LanguagePopupOverlay"]?.().find((stop) => stop.key === k)?.rect ?? null;
  }, key);

const buttonRect = (page: Page) =>
  waitFor(async () => (await hook(page))?.rect ?? null, "the language button on Title", 30_000);

test("issue #337: the language button lists the languages and Español switches the setting and the label", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await openApp(page);
  const button = await buttonRect(page);
  // "Now playing" is usually out by now: the globe stays visible beside it.
  if (SHOT) await page.screenshot({ path: `${SHOT}/language-button-pill-${info.project.name}.png` });
  await settle(page);
  expect(await labelOf(page)).toBe("EN");
  expect(await savedLanguage(page)).toBe("en");

  // It does not sit on the music button.
  const music = await page.evaluate(
    () =>
      (window as unknown as { __mcMusicButtonDebug?: { rect(): Rect | null } }).__mcMusicButtonDebug?.rect() ?? null,
  );
  expect(music).not.toBeNull();
  expect(button.x + button.width).toBeLessThanOrEqual(music!.x);

  await press(page, phone, centre(button));
  await waitFor(
    async () => ((await activeScenes(page)).includes("LanguagePopupOverlay") ? true : null),
    "the list opens",
    10_000,
  );
  const spanish = await waitFor(() => stopRect(page, "es"), "the Español row", 10_000);
  expect(await stopRect(page, "en")).not.toBeNull();
  await settle(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/language-button-${info.project.name}.png` });

  await press(page, phone, centre(spanish));
  await waitFor(
    async () => ((await activeScenes(page)).includes("LanguagePopupOverlay") ? null : true),
    "the list closes",
    10_000,
  );
  expect(await savedLanguage(page)).toBe("es");
  await waitFor(async () => ((await labelOf(page)) === "ES" ? true : null), "the button reads ES", 10_000);

  // Escape and a tap outside both close the list without changing the language.
  await press(page, phone, centre(button));
  await waitFor(async () => (await stopRect(page, "en")) ?? null, "the list opens again", 10_000);
  if (!phone) {
    await page.keyboard.press("Escape");
    await waitFor(
      async () => ((await activeScenes(page)).includes("LanguagePopupOverlay") ? null : true),
      "Escape closes the list",
      10_000,
    );
    await press(page, phone, centre(button));
    await waitFor(async () => (await stopRect(page, "en")) ?? null, "the list opens a third time", 10_000);
  }
  await press(page, phone, { x: 12, y: 300 });
  await waitFor(
    async () => ((await activeScenes(page)).includes("LanguagePopupOverlay") ? null : true),
    "a tap outside closes the list",
    10_000,
  );
  expect(await savedLanguage(page)).toBe("es");
});

test("issue #337: on a native install the button opens the Other languages note", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await openApp(page, "unlock=all&nativelang");
  const button = await buttonRect(page);
  await settle(page);
  await press(page, phone, centre(button));
  await waitFor(
    async () => ((await activeScenes(page)).includes("LanguagePopupOverlay") ? true : null),
    "the note opens",
    10_000,
  );
  await waitFor(() => stopRect(page, "downloads"), "the Downloads link", 10_000);
  expect(await stopRect(page, "web")).not.toBeNull();
  expect(await stopRect(page, "es")).toBeNull();
  await settle(page);
  if (SHOT) await page.screenshot({ path: `${SHOT}/language-info-${info.project.name}.png` });
  await press(page, phone, centre((await stopRect(page, "close"))!));
  await waitFor(
    async () => ((await activeScenes(page)).includes("LanguagePopupOverlay") ? null : true),
    "the close button closes the note",
    10_000,
  );
  expect(await savedLanguage(page)).toBe("en");
});

/** Card face textures the table has loaded in a language other than the build's (`art:<lang>:<path>`). */
const faceTexturesIn = (page: Page, lang: string): Promise<number> =>
  page.evaluate(
    (l) =>
      (window as unknown as { __mcGame: { textures: { getTextureKeys(): string[] } } }).__mcGame.textures
        .getTextureKeys()
        .filter((key) => key.startsWith(`art:${l}:`)).length,
    lang,
  );

test("issue #337: switching language mid-game redraws the cards already on the table", async ({ page }, info) => {
  test.setTimeout(150_000);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await declineMulligans(page);
  await settle(page, { quietMs: 800, maxMs: 8000 });
  expect(await faceTexturesIn(page, "es")).toBe(0);

  // Switched the way the globe and Settings both do (`appSession().settings`; the picker has its own test above):
  // nothing about the game changes, only the language.
  await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: Record<string, unknown> };
    };
    appSession().settings = { ...appSession().settings, cardLanguage: "es" };
  });

  // The table's own tiles ask for the Spanish scans without a hover, an Inspect or a game move.
  await waitFor(
    async () => ((await faceTexturesIn(page, "es")) >= 4 ? true : null),
    "Spanish faces on the table",
    20_000,
  );
  await settle(page, { quietMs: 800, maxMs: 8000 });
  if (SHOT) await page.screenshot({ path: `${SHOT}/language-switch-table-${info.project.name}.png` });
});
