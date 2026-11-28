import { expect, test, type Page } from "@playwright/test";
import { clickText, findText, isSceneUp, settle, waitFor } from "./helpers.js";
import { communityHeroPackIds, serveCatalog, stageCatalog } from "./pack-catalog-helpers.js";
import {
  boardRound,
  clickStop,
  driveToBoard,
  hasStop,
  installWave6Helpers,
  openSaga,
  routeStops,
  screens,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { hook, quietGuide, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #978: a custom (Mod Store) hero joins a campaign. A community hero pack is installed from the store, its
 * precon is picked for seat 1 of The Rise of Red Skull's roster (the picker no longer leaves custom heroes out), the
 * roster is signed, and issue #1 opens and reaches round 1 on the Board with the pack's hero at the table.
 */

/** `scripts/shoot-app.mjs`'s sizes. */
const SHOT_SIZES = {
  se: { width: 375, height: 667 },
  pixel: { width: 412, height: 924 },
  "tablet-portrait": { width: 768, height: 1024 },
  tablet: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 980 },
};

interface RowText {
  name: string;
  rect: Rect;
}

const pickerRows = async (page: Page): Promise<RowText[]> =>
  (await hook<RowText[]>(page, "__mcRosterPickerDebug", "rowTexts")) ?? [];

async function installFromStore(page: Page, packId: string): Promise<void> {
  await page.goto(`/?screen=mod-store&pack=${packId}&unlock=all`);
  await waitForScene(page, "ModStore");
  // The first visit's heads-up holds the store's input until it is answered.
  await waitForScene(page, "ModNoticeOverlay");
  await clickText(page, "Got it", { sceneKey: "ModNoticeOverlay" });
  await waitFor(async () => (!(await isSceneUp(page, "ModNoticeOverlay")) ? true : null), "the notice closes");
  await settle(page);
  await clickText(page, "INSTALL (", { sceneKey: "ModStore", timeoutMs: 30_000 });
  await waitFor(
    async () => ((await findText(page, "REMOVE", "ModStore")).length > 0 ? true : null),
    `${packId} installs`,
    90_000,
  );
  await settle(page);
}

test("issue #978: a Mod Store hero signs a campaign roster and plays issue #1", async ({ page, baseURL }, info) => {
  test.setTimeout(300_000);
  const [packId] = communityHeroPackIds();
  expect(packId, "a community hero pack is fetched (pnpm packs:fetch)").toBeTruthy();
  const staged = await stageCatalog(baseURL!, [packId!]);
  const heroName = staged.heroName[packId!]!;
  const errors = trackErrors(page);
  await serveCatalog(page, staged);
  await installWave6Helpers(page);
  await quietGuide(page);
  await installFromStore(page, packId!);

  await page.goto("/?unlock=all");
  await openSaga(page);
  await clickStop(page, "vol-1", "CampaignSaga");
  await settle(page);
  await clickStop(page, "cta", "CampaignSaga");
  await waitForScene(page, "CampaignCover");
  await settle(page);
  await clickStop(page, "cta", "CampaignCover");
  await waitForScene(page, "CampaignRoster");
  await settle(page);

  // Seat 1's picker: the pack's hero is listed, and the "can't join a campaign yet" note is gone.
  await clickStop(page, "seat-1", "CampaignRoster");
  await settle(page);
  expect(
    (await visibleTexts(page)).some((t) => /can't join a campaign/i.test(t.text)),
    "no note leaving custom heroes out",
  ).toBe(false);
  await clickStop(page, "pick-search", "CampaignRoster");
  await page.keyboard.type(heroName.split(" ")[0]!);
  // The installed pack loads a moment after the page does (longer under load); the roster redraws when it lands.
  const row = await waitFor(
    async () => {
      const found = (await pickerRows(page)).find((r) => r.name.toUpperCase().includes(heroName.toUpperCase()));
      return found ?? null;
    },
    `${heroName} is in the picker`,
    30_000,
  );
  if (SHOT) await page.screenshot({ path: `${SHOT}/campaign-custom-hero-picker-${info.project.name}.png` });
  // The search's answer redraws the list: aim at where the row is once it has settled.
  await settle(page);
  const placed = (await pickerRows(page)).find((r) => r.name.toUpperCase().includes(heroName.toUpperCase())) ?? row;
  const at = { x: placed.rect.x + placed.rect.width / 2, y: placed.rect.y + placed.rect.height / 2 };
  if (info.project.name === "phone") await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
  await settle(page);
  await waitFor(
    async () => ((await hook<boolean>(page, "__mcRosterPickerDebug", "open")) === false ? true : null),
    "the picker closes on the pick",
  );
  expect(
    (await visibleTexts(page)).some(
      (t) => t.scene === "CampaignRoster" && t.text.toUpperCase().includes(heroName.toUpperCase()),
    ),
    `${heroName} sits at seat 1`,
  ).toBe(true);
  if (SHOT) {
    // The PR's screenshots: the seated roster at every size the repo checks a screen at.
    const original = page.viewportSize();
    for (const [size, viewport] of Object.entries(SHOT_SIZES)) {
      await page.setViewportSize(viewport);
      await settle(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOT}/campaign-custom-hero-roster-${info.project.name}-${size}.png` });
    }
    if (original) await page.setViewportSize(original);
    await settle(page);
  }

  // Sign (answering a name clash, if the seated heroes have one, by keeping every card), skip the opener.
  await clickStop(page, "cta", "CampaignRoster");
  const next = await waitFor(
    async () => {
      const s = await screens(page);
      if (s.includes("NameConflictOverlay")) return "sheet";
      return s.includes("CampaignOpener") || s.includes("CampaignBriefing") ? "on" : null;
    },
    "the sheet or the opener",
    20_000,
  );
  if (next === "sheet") {
    await settle(page);
    for (let i = 0; await hasStop(page, `keep:${i}`, "NameConflictOverlay"); i++) {
      await clickStop(page, `keep:${i}`, "NameConflictOverlay");
      await settle(page);
    }
    await clickStop(page, "continue", "NameConflictOverlay");
  }
  for (let tries = 0; tries < 10 && !(await screens(page)).includes("CampaignBriefing"); tries++) {
    await settle(page);
    await clickText(page, "SKIP", { sceneKey: "CampaignOpener", timeoutMs: 3000 }).catch(() => undefined);
  }
  await waitForScene(page, "CampaignBriefing");
  await waitFor(
    async () => ((await routeStops(page, "CampaignBriefing"))?.stops.some((s) => s.key === "open") ? true : null),
    "Open issue #1",
    30_000,
  );
  await clickStop(page, "open", "CampaignBriefing");

  await driveToBoard(page, { timeoutMs: 90_000 });
  expect(await boardRound(page), "the board is in round 1").toBe(1);
  if (SHOT) await page.screenshot({ path: `${SHOT}/campaign-custom-hero-board-${info.project.name}.png` });
  expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  staged.dispose();
});
