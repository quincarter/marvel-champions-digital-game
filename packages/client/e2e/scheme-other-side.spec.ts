import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors, visibleTexts } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";
import { press } from "./x-men-helpers.js";

/**
 * Issue #295: a main scheme in play shows its B side, and a player who missed what happened on the A side could not
 * read it. Inspect on the scheme now has a "Show A side" button (and "Show B side" back), tapped with a real mouse
 * click on the desktop and a real touch tap on the phone.
 */

const squash = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The main scheme's instance id. */
const mainSchemeId = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const { appSession } = (await import("/src/session.ts")) as unknown as {
      appSession: () => { store: { state: { game?: { mainScheme: { instanceId: string } } } } };
    };
    return appSession().store.state.game!.mainScheme.instanceId;
  });

const inspectTexts = async (page: Page): Promise<string> =>
  squash(
    (await visibleTexts(page))
      .filter((t) => t.scene === "InspectOverlay")
      .map((t) => t.text)
      .join(" "),
  );

const toggleAt = async (page: Page, label: string) => {
  const found = await waitFor(
    async () => {
      const matches = await findText(page, label, "InspectOverlay");
      return matches[0] ?? null;
    },
    `the "${label}" button on the Inspect sheet`,
    15_000,
  );
  return found;
};

test("issue #295: Inspect on the main scheme flips to its other side and back", async ({ page }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page);

  const schemeId = await mainSchemeId(page);
  await page.evaluate((instanceId) => {
    const game = (window as unknown as { __mcGame: { scene: { launch: (k: string, d: unknown) => void } } }).__mcGame;
    game.scene.launch("InspectOverlay", { instanceId });
  }, schemeId);
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect", 10_000);
  await settle(page, { quietMs: 500, maxMs: 3000 });

  // The scheme in play shows its B side, so the button offers the A side.
  const toA = await toggleAt(page, "Show A side");
  const bBefore = await inspectTexts(page);
  expect(await findText(page, "Show B side", "InspectOverlay")).toEqual([]);

  await press(page, phone, toA.x, toA.y);
  const toB = await toggleAt(page, "Show B side");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  const aAfter = await inspectTexts(page);
  expect(aAfter, "the sheet redrew with the A side's text").not.toEqual(bBefore);
  // Rhino's 1A is the setup side: it lists the scenario's contents.
  expect(aAfter).toContain("contents");
  expect(await findText(page, "Show A side", "InspectOverlay")).toEqual([]);

  // And back: the B side's text returns.
  await press(page, phone, toB.x, toB.y);
  await toggleAt(page, "Show A side");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  expect(await inspectTexts(page)).toEqual(bBefore);
  expect(errors).toEqual([]);
});
