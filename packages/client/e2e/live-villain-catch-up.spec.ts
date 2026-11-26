import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { clickText, waitFor } from "./helpers.js";
import { answerChoiceSheet, installWave6Helpers, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";
import { test } from "./live-room-helpers.js";

/**
 * A guest's villain phase screen after a catch-up (issue #1017): a host and a seated guest in a real room, the host
 * leading the villain phase screen (the lobby's default). From the guest's own defend to the end of the phase, the
 * room holds the host's moves and hands them on as one batch, the way the host's log goes out after its connection
 * blips. A guest takes such a batch with no events of its own; its screen used to stay on the defend until Skip. Now it
 * takes the moves it missed from the command trail, reaches the recap and closes with the host's. Along the way, the
 * guest's screen words the host's defend as the host's, not "declare your defender".
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

const texts = async (page: Page, scene: string): Promise<string[]> =>
  (await visibleTexts(page)).filter((t) => t.scene === scene).map((t) => t.text);

const yourTurn = async (page: Page): Promise<boolean> =>
  (await visibleTexts(page)).some((t) => t.scene === "Board" && t.text.replace(/^[^\w]+/, "").trim() === "Your turn");

/** Ends this seat's turn in hero form, answering the confirm and the end-of-turn discard. */
async function playTurn(page: Page, label: string): Promise<void> {
  await waitFor(async () => ((await yourTurn(page)) ? true : null), `${label}'s turn`, 60000);
  await flipToHero(page);
  await clickText(page, "End turn", { sceneKey: "Board", timeoutMs: 15000 });
  await waitFor(
    async () => {
      const all = await visibleTexts(page);
      if (all.some((t) => t.scene === "EndTurnConfirmOverlay")) {
        await clickText(page, "END TURN", { sceneKey: "EndTurnConfirmOverlay", timeoutMs: 3000 }).catch(
          () => undefined,
        );
        return null;
      }
      return (await yourTurn(page)) ? null : true;
    },
    `${label} ending the turn`,
    30000,
  );
}

const HOST_BUTTONS = ["START VILLAIN PHASE", "ANSWER", "LET IT RESOLVE", "NEXT CARD", "START PLAYER PHASE"];

test("a guest's villain phase screen takes a catch-up batch and closes with the host's", async ({
  browser,
  baseURL,
  room,
}, info) => {
  test.skip(info.project.name !== "desktop", "two desktop contexts");
  test.setTimeout(300_000);
  const host = await open(browser, baseURL!, "/?screen=room-play-host&name=Mara&setup=1");
  const code = await waitFor(
    async () => (await host.page.evaluate(() => (globalThis as { __mcRoomCode?: string | null }).__mcRoomCode)) ?? null,
    "the room code",
    60000,
  );
  const guest = await open(browser, baseURL!, `/?screen=room-play-guest&code=${code}&name=Ava`);
  // What went wrong on the guest's device, if anything (a seat worker that fails takes the guest out of the room).
  const guestErrors: string[] = [];
  guest.page.on("pageerror", (error) => guestErrors.push(String(error)));
  guest.page.on("console", (message) => {
    if (message.type() === "error" || /seat|room/i.test(message.text())) guestErrors.push(message.text().slice(0, 300));
  });
  try {
    await waitForScene(host.page, "SetupDeal", 60000);
    await waitForScene(guest.page, "SetupDeal", 60000);
    await clickText(host.page, "Keep all", { sceneKey: "SetupDeal", timeoutMs: 45000 });
    await clickText(guest.page, "Keep all", { sceneKey: "SetupDeal", timeoutMs: 45000 });
    await waitForScene(host.page, "Board", 60000);
    await waitForScene(guest.page, "Board", 60000);
    // Both heroes in hero form, so Rhino attacks each of them.
    await playTurn(host.page, "the host");
    await playTurn(guest.page, "the guest");

    const wordedAsGuests: string[] = [];
    let holding = false;
    let released = false;
    let guestReachedRecap = false;
    let shotDefend = false;
    let shotRecap = false;
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const h = await texts(host.page, "VillainPhaseOverlay");
      const g = await texts(guest.page, "VillainPhaseOverlay");
      const hostChoice = (await visibleTexts(host.page)).some((t) => t.scene === "ChoiceOverlay");
      const guestChoice = (await visibleTexts(guest.page)).some((t) => t.scene === "ChoiceOverlay");
      // While the host's own defend waits, the guest's screen must not call it the guest's.
      if (h.some((t) => t.startsWith("ANSWER")) && g.some((t) => /declare your defender/i.test(t))) {
        wordedAsGuests.push(g.join(" | "));
      }
      if (g.some((t) => t.startsWith("RECAP"))) guestReachedRecap = true;
      // `SHOOT_DIR`: the PR's screenshots of the guest's screen, worded from the guest's own hero.
      const shoot = process.env.SHOOT_DIR;
      if (shoot && !shotDefend && g.some((t) => /DECLARES A DEFENDER/.test(t))) {
        shotDefend = true;
        await guest.page.screenshot({ path: `${shoot}/guest-host-defend-desktop.png` });
      }
      if (shoot && !shotRecap && g.some((t) => t.startsWith("RECAP"))) {
        shotRecap = true;
        await guest.page.screenshot({ path: `${shoot}/guest-recap-after-batch-desktop.png` });
      }
      if (holding && h.some((t) => t.startsWith("RECAP"))) {
        room.holdHostCommands(false);
        holding = false;
        released = true;
      }
      if (released && h.length === 0 && g.length === 0) break;
      // A card opened to read (a stray press on the table) is closed first.
      if ((await visibleTexts(host.page)).some((t) => /^RULES & STATE$/i.test(t.text))) {
        await host.page.keyboard.press("Escape");
        continue;
      }
      // The phase's own controls first; a decision sheet only when the phase panel offers nothing to press.
      const label = HOST_BUTTONS.find((b) => h.some((t) => t.startsWith(b)));
      if (label && (label !== "START PLAYER PHASE" || guestReachedRecap || !released)) {
        // The host closes the recap only once the guest's screen has caught up to it.
        await clickText(host.page, label, { sceneKey: "VillainPhaseOverlay", timeoutMs: 3000 }).catch(() => undefined);
      }
      // ANSWER opens the decision sheet; a decision with nothing on the phase panel to press is answered as it stands.
      if (label === "ANSWER" || (!label && hostChoice)) {
        await host.page.waitForTimeout(600);
        await answerChoiceSheet(host.page).catch(() => undefined);
      }
      if (g.some((t) => t.startsWith("ANSWER"))) {
        // The guest's own defend: from here to the end of the phase the host's moves reach the room as one batch.
        if (!holding && !released) {
          room.holdHostCommands(true);
          holding = true;
        }
        await clickText(guest.page, "ANSWER", { sceneKey: "VillainPhaseOverlay", timeoutMs: 3000 }).catch(
          () => undefined,
        );
      }
      // The guest answers only its own defend; after that its screen just follows (no stray press on its recap).
      if (guestChoice && !released && !g.some((t) => t.startsWith("RECAP")))
        await answerChoiceSheet(guest.page).catch(() => undefined);
      await host.page.waitForTimeout(400);
    }
    if (guestErrors.length > 0) console.log("guest console:", guestErrors.join(" || "));
    expect(released, "the host's moves were held and handed on as one batch").toBe(true);
    expect(guestReachedRecap, "the guest's screen reached the recap after the batch").toBe(true);
    expect(wordedAsGuests, "the host's defend worded as the guest's own").toEqual([]);
    // Both screens closed: the guest's with the host's, not by Skip.
    expect(await texts(guest.page, "VillainPhaseOverlay")).toEqual([]);
  } finally {
    room.holdHostCommands(false);
    await guest.context.close();
    await host.context.close();
  }
});
