import { expect, test, type Page } from "@playwright/test";
import { findText, settle, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #390: the title menu reads in the language the player picked (`Settings.cardLanguage`), and a switch while it
 * is up redraws it in place. The switch goes the way the globe and Settings both do (`appSession().settings`); the
 * picker itself has its own spec (`language-button.spec.ts`).
 */

const shown = async (page: Page, text: string): Promise<boolean> => (await findText(page, text, "Title")).length > 0;

async function setLanguage(page: Page, lang: "en" | "es"): Promise<void> {
  await page.evaluate(async (lang) => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: Record<string, unknown> };
    };
    appSession().settings = { ...appSession().settings, cardLanguage: lang };
  }, lang);
}

test("the title menu switches to Spanish and back while it is up", async ({ page }, info) => {
  await openApp(page);
  await settle(page);
  expect(await shown(page, "Trophy Room")).toBe(true);

  await setLanguage(page, "es");
  await waitFor(async () => ((await shown(page, "Sala de logros")) ? true : null), "the Spanish menu", 15_000);
  expect(await shown(page, "Trophy Room")).toBe(false);
  expect(await shown(page, "Nueva partida")).toBe(true);
  expect(await shown(page, "Novedades ↗")).toBe(true);
  await settle(page);
  await page.screenshot({ path: info.outputPath("title-es.png") });
  if (SHOT) await page.screenshot({ path: `${SHOT}/title-es-${info.project.name}.png` });

  await setLanguage(page, "en");
  await waitFor(async () => ((await shown(page, "Trophy Room")) ? true : null), "the English menu again", 15_000);
  expect(await shown(page, "Sala de logros")).toBe(false);
});

test("a player whose language is Spanish opens the game on a Spanish menu", async ({ page }) => {
  await page.addInitScript(() => {
    const raw = localStorage.getItem("mc-settings");
    const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem("mc-settings", JSON.stringify({ ...settings, cardLanguage: "es" }));
  });
  await openApp(page);
  await settle(page);
  expect(await shown(page, "Nueva partida")).toBe(true);
  expect(await shown(page, "New game")).toBe(false);
});
