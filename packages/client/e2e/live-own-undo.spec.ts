import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { clickText, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";
import { test } from "./live-room-helpers.js";

/**
 * "Each player" Undo in a room (GarethMagis, 2026-11-25): the default Undo of a Host control room. A guest takes back
 * its own move with the plain Undo button, the way single player does; the host's device does it at once, with no
 * request for the host to answer. Here the guest flips to hero form on its own turn and takes it back.
 */

async function open(browser: Browser, baseURL: string, url: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await installWave6Helpers(page);
  await quietGuide(page);
  // Auto-advance off (the game's default): the host's screen waits on its own presses, so the phase is paced here.
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  await page.goto(url);
  return { context, page };
}

const flipToHero = (page: Page): Promise<unknown> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => {
        store: {
          dispatch: (c: unknown) => Promise<boolean>;
          state: { legal?: { actions: { legal?: { action: { kind: string }; example: unknown }[] } } };
        };
      };
    };
    const { store } = appSession();
    const flip = store.state.legal?.actions.legal?.find((e) => e.action.kind === "changeForm");
    return flip ? store.dispatch(flip.example) : false;
  });

const yourTurn = async (page: Page): Promise<boolean> =>
  (await visibleTexts(page)).some(
    (t) =>
      t.scene === "Board" &&
      t.text
        .replace(/^[^\w]+/, "")
        .trim()
        .startsWith("Your turn"),
  );

test("a guest's Undo takes back its own move at once, with nothing for the host to answer", async ({
  browser,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "two desktop contexts");
  test.setTimeout(240_000);
  const host = await open(browser, baseURL!, "/?screen=room-play-host&name=Mara&setup=1");
  const code = await waitFor(
    async () => (await host.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
    "the room code",
    60000,
  );
  const guest = await open(browser, baseURL!, `/?screen=room-play-guest&code=${code}&name=Ava`);
  try {
    await waitForScene(host.page, "SetupDeal", 60000);
    await waitForScene(guest.page, "SetupDeal", 60000);
    await clickText(host.page, "Keep all", { sceneKey: "SetupDeal", timeoutMs: 45000 });
    await clickText(guest.page, "Keep all", { sceneKey: "SetupDeal", timeoutMs: 45000 });
    await waitForScene(guest.page, "Board", 60000);
    await clickText(host.page, "End turn", { sceneKey: "Board", timeoutMs: 45000 });
    await waitFor(
      async () => {
        if ((await visibleTexts(host.page)).some((t) => t.scene === "EndTurnConfirmOverlay")) {
          await clickText(host.page, "END TURN", { sceneKey: "EndTurnConfirmOverlay", timeoutMs: 3000 }).catch(
            () => {},
          );
        }
        return (await yourTurn(guest.page)) ? true : null;
      },
      "the guest's turn",
      60000,
    );
    const form = async (): Promise<string | undefined> =>
      (await visibleTexts(guest.page)).find((t) => t.scene === "Board" && /^(HERO|ALTER-EGO) · LEADERSHIP/.test(t.text))
        ?.text;
    expect(await form()).toMatch(/^ALTER-EGO/);
    await flipToHero(guest.page);
    await waitFor(async () => ((await form())?.startsWith("HERO") ? true : null), "the guest in hero form", 30000);
    // The plain Undo button (not "Ask host to undo"), and it takes the flip back by itself.
    expect((await visibleTexts(guest.page)).some((t) => /ask host to undo/i.test(t.text))).toBe(false);
    await clickText(guest.page, "Undo", { sceneKey: "Board", timeoutMs: 15000 });
    await waitFor(async () => ((await form())?.startsWith("ALTER-EGO") ? true : null), "the flip taken back", 30000);
    // Nothing was put to the host.
    expect((await visibleTexts(host.page)).some((t) => /asks? (you )?to undo|wants to undo/i.test(t.text))).toBe(false);
  } finally {
    await guest.context.close();
    await host.context.close();
  }
});
