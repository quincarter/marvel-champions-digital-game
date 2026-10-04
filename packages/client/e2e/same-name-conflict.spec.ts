import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickFocus, clickText, handInstanceFor, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, driveToBoard, hasStop, installWave6Helpers, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { findVisibleText, gameFacts, handRectFor, hook, inspectAt, openApp } from "./wave6-helpers-b.js";

/**
 * Same-name conflicts (owner, 2026-10-03). Colossus (seat 1) and Shadowcat (seat 2): Colossus's own cards include the
 * Shadowcat ally, and Shadowcat's deck holds the basic Colossus ally. Take your seats names the clash, Play opens the
 * sheet, and each card is replaced or kept as a resource before the table is dealt.
 *
 * Seed 4 deals Colossus the Shadowcat ally (32002) in his opening hand with the Colossus ally replaced out of
 * Shadowcat's deck (the recommended replacement is the first card of the picker). Found by searching seeds against the
 * starter decks, so a changed deck or deal order fails here by name and the seed gets re-picked.
 */

const SEED = "4";
const SHEET = "NameConflictOverlay";

interface Entry {
  readonly line: string;
  readonly deckId: string;
  readonly cardId: string;
  readonly status: "pending" | "replaced" | "kept";
}

const sheet = {
  entries: (page: Page) => hook<Entry[]>(page, "__mcNameConflictDebug", "entries").then((e) => e ?? []),
  selected: (page: Page) => hook<string | null>(page, "__mcNameConflictDebug", "selected"),
  candidates: (page: Page) =>
    hook<{ id: string; name: string; tier: number }[]>(page, "__mcNameConflictDebug", "candidates").then(
      (c) => c ?? [],
    ),
};

/** Title → New game (the guide is quiet, as in the other setup specs), landing on Scenario select. */
async function startNewGame(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await page.waitForTimeout(600);
  await clickText(page, "NEW GAME", { sceneKey: "Title" });
  await waitForScene(page, "ScenarioSelect");
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15000);
}

/** Scenario select (Rhino) to Take your seats with Colossus in seat 1 and Shadowcat in seat 2. */
async function seatColossusAndShadowcat(page: Page): Promise<void> {
  await clickStop(page, "scenario:rhino", "ScenarioSelect");
  await page.waitForTimeout(300);
  await clickStop(page, "next", "ScenarioSelect");
  await waitForScene(page, "Seats");
  await waitFor(async () => (await hasStop(page, "hero-search", "Seats")) || null, "hero search", 10000);
  for (const [name, deck] of [
    ["Colossus", "colossus-protection"],
    ["Shadowcat", "shadowcat-aggression"],
  ] as const) {
    await clickStop(page, "hero-search", "Seats");
    await page.waitForTimeout(200);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(name);
    // A Team-Up partner is also on the Recommended shelf, which sits above the full list and is on screen.
    const recommended = `hero-rec:precon:${deck}`;
    await clickStop(page, (await hasStop(page, recommended, "Seats")) ? recommended : `hero:precon:${deck}`, "Seats");
    await page.waitForTimeout(300);
  }
}

const noticeText = (page: Page): Promise<unknown[]> =>
  findVisibleText(page, "can't be played with these heroes", "Seats");

/** The seated cards of both players in the dealt game, by card id (deck and hand together). */
async function dealtCardIds(page: Page): Promise<string[][]> {
  return gameFacts<string[][]>(
    page,
    `(state) => state.game.players.map((p) => [...p.hand, ...p.deck].map((id) => state.game.instances[id].cardId))`,
  );
}

async function setSameNameSetting(page: Page, on: boolean): Promise<void> {
  await clickStop(page, "settings", "Title");
  await waitForScene(page, "SettingsOverlay");
  await page.waitForTimeout(500);
  const rows = (await findVisibleText(page, "Same-name hero and ally", "SettingsOverlay")).length;
  expect(rows, "Settings has the same-name row").toBeGreaterThan(0);
  const isOn = await page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { settings: { sameNameHeroAllyConflict: boolean } };
    };
    return appSession().settings.sameNameHeroAllyConflict;
  });
  if (isOn !== on) {
    // The toggle is the button at the row's right end.
    const row = (await routeStops(page, "SettingsOverlay"))?.stops.find(
      (stop) => stop.key === "row:same-name-conflict",
    );
    if (!row) throw new Error("no same-name row in Settings");
    await page.mouse.click(row.rect.x + row.rect.width - 40, row.rect.y + row.rect.height / 2);
  }
  await waitFor(
    async () =>
      (await page.evaluate(async () => {
        const { appSession } = (await import("/src/session.ts")) as unknown as {
          appSession: () => { settings: { sameNameHeroAllyConflict: boolean } };
        };
        return appSession().settings.sameNameHeroAllyConflict;
      })) === on
        ? true
        : null,
    `the setting reads ${on ? "on" : "off"}`,
  );
  await clickStop(page, "back", "SettingsOverlay");
  await waitFor(async () => (!(await hasStop(page, "back", "SettingsOverlay")) ? true : null), "Settings closes");
}

test.describe("Same-name hero and ally conflicts", () => {
  test("Colossus and Shadowcat: the notice, the sheet, one card replaced and one kept as a resource, then the game", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await startNewGame(page);
    await seatColossusAndShadowcat(page);

    // The notice under the seat cards names the count in words.
    await waitFor(async () => ((await noticeText(page)).length > 0 ? true : null), "the conflict notice", 8000);
    expect(await findVisibleText(page, "2 cards can't be played with these heroes", "Seats")).toHaveLength(1);

    // Play does not go on: it opens the sheet, one short line per clash, Continue not yet available.
    await clickStop(page, "play", "Seats");
    await waitForScene(page, SHEET);
    await page.waitForTimeout(600);
    const entries = await sheet.entries(page);
    expect(entries.map((e) => e.line)).toEqual([
      "Colossus's deck: Shadowcat (Kitty Pryde) ally · Shadowcat is seated",
      "Shadowcat's deck: Colossus ally · Colossus is seated",
    ]);
    expect(entries.map((e) => e.status)).toEqual(["pending", "pending"]);
    expect(await findVisibleText(page, "Keep as a resource", SHEET)).not.toHaveLength(0);
    // Continue does nothing while a card is unanswered; the Shadowcat ally is Colossus's own card, so it has no Replace.
    await clickStop(page, "continue", SHEET);
    await page.waitForTimeout(400);
    expect((await activeScenes(page)).includes(SHEET), "the sheet stays open").toBe(true);
    expect(await hasStop(page, "replace:0", SHEET), "a hero's own card offers no Replace").toBe(false);
    expect(await hasStop(page, "replace:1", SHEET), "the basic Colossus ally does").toBe(true);

    // Colossus's Shadowcat ally is one of his own cards: kept as a resource.
    await clickStop(page, "keep:0", SHEET);
    await waitFor(
      async () => ((await sheet.entries(page))[0]?.status === "kept" ? true : null),
      "the first card is kept",
    );

    // The basic Colossus ally in Shadowcat's deck is replaced from the picker, the recommended card preselected.
    await clickStop(page, "replace:1", SHEET);
    await waitFor(
      async () => ((await sheet.candidates(page)).length > 0 ? true : null),
      "the picker lists cards",
      15000,
    );
    const candidates = await sheet.candidates(page);
    expect(candidates[0]!.tier, "an ally leads the list").toBe(0);
    const recommended = await sheet.selected(page);
    expect(recommended, "the recommended card is preselected").toBe(candidates[0]!.id);
    expect(
      candidates.some((c) => c.name === "Colossus"),
      "the same card is not offered back",
    ).toBe(false);
    await clickStop(page, "confirm", SHEET);
    await waitFor(
      async () => ((await sheet.entries(page))[1]?.status === "replaced" ? true : null),
      "the second card is replaced",
    );

    // Every card answered: Continue goes on to Table setup, which names the table rule in its summary.
    await clickStop(page, "continue", SHEET);
    await waitForScene(page, "Setup");
    await page.waitForTimeout(600);
    expect(
      await findVisibleText(page, "Hero and ally of one name", "Setup"),
      "the summary names the rule",
    ).not.toHaveLength(0);

    // The seed that deals Colossus the Shadowcat ally, then deal.
    await clickStop(page, "seed", "Setup");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(SEED);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await clickStop(page, "deal-it-out", "Setup");
    await driveToBoard(page, { timeoutMs: 90000 });

    // The replaced card is not in Shadowcat's deck, its replacement is; the kept one is still in Colossus's.
    const [colossus, shadowcat] = await dealtCardIds(page);
    expect(shadowcat, "the Colossus ally was replaced out of Shadowcat's deck").not.toContain("32048");
    expect(shadowcat, "the recommended replacement is in its place").toContain(recommended);
    expect(colossus, "the kept Shadowcat ally is still in Colossus's deck").toContain("32002");

    // The kept card cannot be played (Inspect says why) but is offered as a resource.
    expect(await handInstanceFor(page, "32002"), "seed 4 deals Colossus the Shadowcat ally").not.toBeNull();
    await inspectAt(page, await handRectFor(page, "32002"), "right");
    expect(
      await findVisibleText(page, "already in play", "InspectOverlay"),
      "Inspect says why it cannot be played",
    ).not.toHaveLength(0);
    expect(
      await findVisibleText(page, "Use as resource", "InspectOverlay"),
      "Use as resource is offered",
    ).not.toHaveLength(0);
    await page.keyboard.press("Escape");
    await waitFor(
      async () => ((await findVisibleText(page, "Use as resource", "InspectOverlay")).length === 0 ? true : null),
      "Inspect closes",
    );

    // And it pays: flip to hero form, start Piotr's Studio, spend the Shadowcat ally on its cost.
    await clickFocus(page, "basic:changeForm");
    await waitFor(
      async () =>
        (await gameFacts<string>(page, "(state) => state.game.players[0].identity.form")) === "hero" ? true : null,
      "Colossus is a hero",
    );
    await page.waitForTimeout(500);
    // Flipping asks whether to trigger Perseverance's response: declined.
    await waitFor(
      async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
      "the trigger sheet",
    );
    await page.waitForTimeout(400);
    await clickText(page, "Decline", { sceneKey: "ChoiceOverlay" });
    await waitFor(
      async () => (!(await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
      "the sheet closes",
    );
    const studio = await handInstanceFor(page, "32003");
    expect(studio, "Piotr's Studio is in hand").not.toBeNull();
    await clickFocus(page, `card:${studio}`);
    const ally = await handInstanceFor(page, "32002");
    await waitFor(
      async () =>
        (await page.evaluate(() => {
          const v = (
            window as unknown as { __mcBoardDebug?: { paymentView(): { sources: unknown[] } | null } }
          ).__mcBoardDebug?.paymentView();
          return v ? true : null;
        })) || null,
      "a payment opens",
    );
    await clickFocus(page, `card:${ally}`);
    const spent = await waitFor(
      async () =>
        page.evaluate((id) => {
          const v = (
            window as unknown as {
              __mcBoardDebug?: { paymentView(): { sources: { instanceId: string | null; spent: boolean }[] } | null };
            }
          ).__mcBoardDebug?.paymentView();
          return v?.sources.find((s) => s.instanceId === id)?.spent ? true : null;
        }, ally),
      "the Shadowcat ally is spent on the payment",
    );
    expect(spent).toBe(true);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });

  test("with the setting off there is no prompt, and the table rule is not in the summary", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await setSameNameSetting(page, false);
    await startNewGame(page);
    await seatColossusAndShadowcat(page);

    // FFG's own rule still clashes the Shadowcat ally in Colossus's deck; the option's pair (the Colossus ally) is gone.
    await waitFor(async () => ((await noticeText(page)).length > 0 ? true : null), "the conflict notice", 8000);
    expect(await findVisibleText(page, "1 card can't be played with these heroes", "Seats")).toHaveLength(1);
    await clickStop(page, "play", "Seats");
    await waitForScene(page, SHEET);
    await page.waitForTimeout(500);
    expect((await sheet.entries(page)).map((e) => e.line)).toEqual([
      "Colossus's deck: Shadowcat (Kitty Pryde) ally · Shadowcat is seated",
    ]);
    await clickStop(page, "keep:0", SHEET);
    await clickStop(page, "continue", SHEET);
    await waitForScene(page, "Setup");
    await page.waitForTimeout(600);
    expect(
      await findVisibleText(page, "Hero and ally of one name", "Setup"),
      "no table rule in the summary",
    ).toHaveLength(0);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });

  test("a table with no clash goes straight to Table setup", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = trackPageErrors(page);
    await installWave6Helpers(page);
    await openApp(page, "unlock=all", { landing: "Title" });
    await startNewGame(page);
    await clickStop(page, "scenario:rhino", "ScenarioSelect");
    await page.waitForTimeout(300);
    await clickStop(page, "next", "ScenarioSelect");
    await waitForScene(page, "Seats");
    await page.waitForTimeout(800);
    expect(await noticeText(page), "no notice for one hero").toHaveLength(0);
    await clickStop(page, "play", "Seats");
    await waitForScene(page, "Setup");
    expect(errors).toEqual([]);
  });
});
