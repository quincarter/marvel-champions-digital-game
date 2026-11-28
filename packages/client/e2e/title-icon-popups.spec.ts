import { expect, test, type Page } from "@playwright/test";
import { activeScenes, isPhonePage, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The Title's top-row icons (theme, language, music, report, Discord) with Spanish selected: each opens its pop-up over
 * the Title without the Title's menu going away (the pop-ups are Lit panels that draw above the Title's panel, not
 * Phaser scenes that hide it), reads fully in Spanish, and once closed leaves a Title button that still presses.
 * Music is the one that replaces the menu on a phone: its player fills the screen under the top bar by design.
 */

test.use({ locale: "es-ES" });

const wrap = (page: Page, scene: string) => page.locator(`#mc-ui [data-scene="${scene}"]`);
const titleMenu = (page: Page) => wrap(page, "Title").locator("mc-title-panel");

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function openSpanishTitle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const raw = localStorage.getItem("mc-settings");
    const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem("mc-settings", JSON.stringify({ ...settings, cardLanguage: "es" }));
  });
  await openApp(page, "");
  await waitForText(page, "Nueva partida", { sceneKey: "Title" });
  await expect(titleMenu(page)).toBeVisible();
}

/** A Title stop's box (`chrome:music`, `decks`, ...), once the route has it. */
const stopOf = (page: Page, key: string): Promise<Rect> =>
  waitFor(
    () =>
      page.evaluate((k) => {
        const routes = (window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string; rect: Rect }[]> })
          .__mcFocusRoutes;
        return routes?.["Title"]?.().find((stop) => stop.key === k)?.rect ?? null;
      }, key),
    `the Title's ${key} stop`,
    30_000,
  );

async function press(page: Page, rect: Rect): Promise<void> {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (isPhonePage(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const sceneUp = (page: Page, scene: string, up: boolean) =>
  waitFor(
    async () => ((await activeScenes(page)).includes(scene) === up ? true : null),
    `${scene} ${up ? "opens" : "closes"}`,
    15_000,
  );

/** The Title's menu is drawn (its wrapper is not hidden). */
const menuShown = (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('#mc-ui [data-scene="Title"]');
    return element !== null && element.style.visibility !== "hidden";
  });

/** A Title button still takes a press: Extras opens, and the screen can come back. */
async function titleStillPresses(page: Page): Promise<void> {
  await expect(titleMenu(page)).toBeVisible();
  await titleMenu(page).getByText("Extras", { exact: true }).click();
  await sceneUp(page, "Extras", true);
}

/** Whether the screen point holds a part of `scene`'s panel (not the canvas under it, and not a hole in it). */
const panelAt = (page: Page, scene: string, x: number, y: number) =>
  page.evaluate(
    ([key, px, py]) =>
      document.elementFromPoint(px as number, py as number)?.closest(`#mc-ui [data-scene="${key as string}"]`) != null,
    [scene, x, y] as const,
  );

const noEnglish = async (page: Page, scene: string, words: RegExp): Promise<void> => {
  const text = (await wrap(page, scene).innerText()).replace(/\s+/g, " ");
  expect(text, `${scene} still has English words`).not.toMatch(words);
};

test("language: the menu opens over the Title, which stays; a second tap closes it and the Title presses", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await openSpanishTitle(page);
  const globe = await stopOf(page, "chrome:language");
  await press(page, globe);
  await sceneUp(page, "LanguagePopupOverlay", true);
  expect(await menuShown(page), "the Title's menu is still drawn under the language list").toBe(true);
  const list = wrap(page, "LanguagePopupOverlay");
  await expect(list.getByText("Español", { exact: false }).first()).toBeVisible();
  await expect(list.getByText("English", { exact: false }).first()).toBeVisible();
  await press(page, globe);
  await sceneUp(page, "LanguagePopupOverlay", false);
  await titleStillPresses(page);
  expect(errors).toEqual([]);
});

test("music: the player opens in Spanish, replaces the menu on a phone only, and closes to a working Title", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await openSpanishTitle(page);
  const note = await stopOf(page, "chrome:music");
  await press(page, note);
  await sceneUp(page, "MusicPlayerOverlay", true);
  const player = wrap(page, "MusicPlayerOverlay");
  await expect(player.getByText(/Música/i).first()).toBeVisible();
  await expect(player.getByText(/\d+ de \d+ ganadas/i)).toBeVisible();
  await expect(player.getByText(/Sonando ahora/i).first()).toBeVisible();
  await expect(player.getByText(/Aleatorio: no/i)).toBeVisible();
  await expect(player.getByText(/Siguiente/i).first()).toBeVisible();
  await expect(player.getByText(/Pausa/i).first()).toBeVisible();
  await expect(player.getByText(/Pantalla de título/i).first()).toBeVisible();
  await expect(player.getByText(/Cualquier batalla/i).first()).toBeVisible();
  await expect(player.getByText(/Te faltan \d+ por ganar/i)).toBeVisible();
  await noEnglish(
    page,
    "MusicPlayerOverlay",
    /\b(Back|earned|Now playing|Any battle|Title screen|more to earn|Shuffle)\b/,
  );
  const menu = await stopOf(page, "new-game");
  if (isPhonePage(page)) {
    // A phone's player fills the screen under the top bar: it, not the Title's menu, is what is pressed there.
    expect(await panelAt(page, "MusicPlayerOverlay", menu.x + menu.width / 2, menu.y + menu.height / 2)).toBe(true);
  } else {
    expect(await menuShown(page), "a popover leaves the Title's menu drawn").toBe(true);
  }
  await press(page, note);
  await sceneUp(page, "MusicPlayerOverlay", false);
  await titleStillPresses(page);
  expect(errors).toEqual([]);
});

test("music: Back (phone) or the close button closes the player and the Title presses", async ({ page }) => {
  await openSpanishTitle(page);
  await press(page, await stopOf(page, "chrome:music"));
  await sceneUp(page, "MusicPlayerOverlay", true);
  await wrap(page, "MusicPlayerOverlay")
    .locator("mc-button")
    .filter({ hasText: /Atrás|✕/ })
    .first()
    .click();
  await sceneUp(page, "MusicPlayerOverlay", false);
  await titleStillPresses(page);
});

test("report: the dialog opens over the Title in Spanish, dims the icon row, and closes to a working Title", async ({
  page,
}) => {
  const errors = trackPageErrors(page);
  await openSpanishTitle(page);
  // Read before the dialog opens: the Title's route is not walked while a pop-up is up.
  const music = await stopOf(page, "chrome:music");
  await press(page, await stopOf(page, "chrome:report"));
  await sceneUp(page, "ReportIssueOverlay", true);
  expect(await menuShown(page), "the Title's menu is still drawn under the dialog").toBe(true);
  const dialog = wrap(page, "ReportIssueOverlay");
  for (const words of [
    /Informar de un problema/i,
    /Haz una captura de pantalla/i,
    /Ocultar para la captura/i,
    /Copiar registro/i,
    /Descargar registro/i,
    /Informar de un fallo/i,
    /Sugerir una función/i,
    /Pedir un mazo/i,
    /Charlar en Discord/i,
  ])
    await expect(dialog.getByText(words).first()).toBeVisible();
  await noEnglish(
    page,
    "ReportIssueOverlay",
    /\b(Report an issue|Snap a screenshot|Copy log|Download log|Request a deck)\b/,
  );
  // The icon row is under the dialog's scrim, as it was when Phaser drew it, not cut out of it.
  expect(await panelAt(page, "ReportIssueOverlay", music.x + music.width / 2, music.y + music.height / 2)).toBe(true);
  await page.keyboard.press("Escape");
  await sceneUp(page, "ReportIssueOverlay", false);
  await titleStillPresses(page);
  expect(errors).toEqual([]);
});

test("theme and Discord: the Title's menu stays and still presses after each", async ({ page }) => {
  await openSpanishTitle(page);
  page.context().on("page", (popup) => void popup.close());
  await press(page, await stopOf(page, "chrome:theme"));
  expect(await menuShown(page)).toBe(true);
  await press(page, await stopOf(page, "chrome:theme"));
  const discord = await stopOf(page, "chrome:discord").catch(() => null);
  if (discord) {
    await press(page, discord);
    expect(await menuShown(page)).toBe(true);
  }
  await titleStillPresses(page);
});
