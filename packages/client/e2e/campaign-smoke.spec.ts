import { expect, test, type Page } from "@playwright/test";
import { campaignSagaRows } from "../src/view/campaign-saga-model.js";
import { clickText, waitFor } from "./helpers.js";
import {
  assertNoRawText,
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

/**
 * Campaign smoke (wave 6 QA): every campaign on the Saga shelf that `?unlock=all` opens, from the Title to the first
 * round of its issue #1. The list comes from the same model the Saga screen draws (`campaignSagaRows`: a box with a
 * definition is open under `?unlock=all`), so a new box is covered the day it ships.
 *
 * Title → Campaign → the volume → Cover → Sign the roster (the cast is pre-filled) → Sign & open issue #1 → the
 * opener (skipped) → Briefing (the briefer's line, no raw text, every call answered with its first legal option) →
 * Open issue #1 → Setup deal (keep the hands) → the Board in round 1, with no page or console error. Every screen
 * is also checked for raw text ("(Not printed", "undefined", "[object"): this is the net that would have caught
 * MojoMania's empty roster and its raw briefing.
 */

const OPEN_VOLUMES = campaignSagaRows([])
  .filter((row) => row.hasDefinition)
  .map((row) => ({ number: row.volume.number, id: row.volume.campaignId, name: row.volume.name }));

/** Box name as drawn: uppercase, lines joined ("THE RISE\nOF RED SKULL"), curly apostrophes folded to straight. */
const flat = (text: string): string =>
  text
    .replace(/\s+/g, " ")
    .replace(/[‘’]/g, "'")
    .trim()
    .toUpperCase();

/** The default cast a box pre-fills, by volume id, where the issue names it (MojoMania's own roster was once empty). */
const EXPECTED_CAST: Readonly<Record<string, readonly string[]>> = { mojo: ["GAMBIT", "ROGUE"] };

/**
 * Sign the roster names a clash when two seated heroes share a name with the other's ally (Groot and Rocket, Colossus and
 * Shadowcat: the table rule is on by default), and Sign opens the sheet first. Answered here the way a player would:
 * each card kept as a resource, and, where a card can be replaced and `replaceOne` says so, the last one replaced.
 */
async function answerNameConflicts(page: Page, replaceOne: boolean): Promise<void> {
  await waitForScene(page, "NameConflictOverlay");
  await page.waitForTimeout(500);
  const entries =
    (await page.evaluate(
      () =>
        (
          window as unknown as { __mcNameConflictDebug?: { entries(): { status: string }[] } }
        ).__mcNameConflictDebug?.entries() ?? [],
    )) ?? [];
  expect(entries.length, "the sheet lists the clash").toBeGreaterThan(0);
  for (let i = 0; i < entries.length; i++) {
    if (replaceOne && i === entries.length - 1) {
      await clickStop(page, `replace:${i}`, "NameConflictOverlay");
      await clickStop(page, "confirm", "NameConflictOverlay");
    } else {
      await clickStop(page, `keep:${i}`, "NameConflictOverlay");
    }
    await page.waitForTimeout(300);
  }
  await clickStop(page, "continue", "NameConflictOverlay");
}

/** Answers the briefing's decisions with the first legal option until "Open issue" is available. */
async function answerBriefing(page: Page, boxName: string): Promise<void> {
  const seenPrompts: string[] = [];
  let lastSig = "";
  let repeats = 0;
  for (let step = 0; step < 60; step++) {
    await assertNoRawText(page, `${boxName} briefing step ${step}`);
    const scenes = await screens(page);
    if (scenes.includes("CampaignMarket")) {
      // A Market-shaped call (a shop of cards): take nothing and check out.
      await clickStop(page, "done", "CampaignMarket");
      await page.waitForTimeout(500);
      continue;
    }
    const route = await routeStops(page, "CampaignBriefing");
    if (!route) {
      await page.waitForTimeout(300);
      continue;
    }
    const keys = route.stops.map((s) => s.key);
    if (keys.includes("open")) return;
    const sig = keys.join("|");
    repeats = sig === lastSig ? repeats + 1 : 0;
    lastSig = sig;
    if (repeats > 12) throw new Error(`${boxName} briefing is stuck, controls: ${sig}`);
    seenPrompts.push(sig);

    const first = (prefix: string): string | undefined => keys.find((k) => k.startsWith(prefix));
    const confirm = ["call-confirm", "rb-confirm", "role-confirm", "call-accept"].find((k) => keys.includes(k));
    const options = keys.filter((k) => k.startsWith("call-option:"));
    const pick =
      confirm ??
      first("role:") ??
      first("rb-card:") ??
      // Several picks needed: take the next option each time the screen is unchanged after a click.
      (options.length > 0 ? options[Math.min(repeats, options.length - 1)] : undefined) ??
      first("rb-chip:") ??
      keys.find((k) => k === "call-decline");
    if (!pick) throw new Error(`${boxName} briefing asks something with no answerable control: ${sig}`);
    await clickStop(page, pick, "CampaignBriefing");
    await page.waitForTimeout(450);
    // A card tile opens the Inspect sheet with "Take this card" (a deck-building call): take it.
    if ((await screens(page)).includes("InspectOverlay")) {
      await clickText(page, "TAKE THIS CARD", { sceneKey: "InspectOverlay", timeoutMs: 4000 });
      await page.waitForTimeout(450);
    }
  }
  throw new Error(`${boxName} briefing never offered Open issue`);
}

for (const volume of OPEN_VOLUMES) {
  test(`${volume.name} opens issue #1 and reaches round 1`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await installWave6Helpers(page);
    await page.goto("/?unlock=all");
    await openSaga(page);

    // The Saga shelf: this volume's tile is open, and tapping it features it.
    await clickStop(page, `vol-${volume.number}`, "CampaignSaga");
    await page.waitForTimeout(500);
    await assertNoRawText(page, `${volume.name} saga`);
    await clickStop(page, "cta", "CampaignSaga");

    // Cover: the title, a blurb, and a way forward.
    await waitForScene(page, "CampaignCover");
    await page.waitForTimeout(800);
    const cover = await visibleTexts(page);
    // The title may be drawn as two balanced lines ("THE RISE" / "OF RED SKULL"), so read the cover's text in order.
    expect(flat(cover.map((t) => t.text).join(" ")), `cover shows the title ${volume.name}`).toContain(
      flat(volume.name),
    );
    expect(
      cover.some((t) => t.text.trim().length >= 40),
      "cover has a blurb of real text",
    ).toBe(true);
    await assertNoRawText(page, `${volume.name} cover`);
    await clickStop(page, "cta", "CampaignCover");

    // Roster: the default cast is pre-filled, so signing is one click.
    await waitForScene(page, "CampaignRoster");
    await page.waitForTimeout(800);
    const roster = await visibleTexts(page);
    expect(
      roster.some((t) => /^\+ SEAT #1$/i.test(t.text.trim())),
      "seat 1 is filled, not an empty slot",
    ).toBe(false);
    for (const hero of EXPECTED_CAST[volume.id] ?? []) {
      expect(
        roster.some((t) => t.text.trim().toUpperCase() === hero),
        `${hero} is on the roster`,
      ).toBe(true);
    }
    await assertNoRawText(page, `${volume.name} roster`);
    const clash = await hasStop(page, "conflict-notice", "CampaignRoster");
    await clickStop(page, "cta", "CampaignRoster");
    if (clash) await answerNameConflicts(page, volume.id === "mut_gen");

    // The opener comic reader (skipped), then the Briefing.
    await waitFor(
      async () => {
        const s = await screens(page);
        return s.includes("CampaignOpener") || s.includes("CampaignBriefing") ? s : null;
      },
      "opener or briefing",
      20000,
    );
    // Skip may need a second press: the reader ignores input while it fades in.
    for (let tries = 0; tries < 8 && (await screens(page)).includes("CampaignOpener"); tries++) {
      await page.waitForTimeout(700);
      await clickText(page, "SKIP", { sceneKey: "CampaignOpener", timeoutMs: 3000 }).catch(() => undefined);
    }
    await waitForScene(page, "CampaignBriefing");
    await page.waitForTimeout(800);

    // The briefer speaks: a line of real text above the "Handled for you" heading, in the speech bubble.
    const briefing = await visibleTexts(page);
    const handled = briefing.find((t) => /^handled for you$/i.test(t.text.trim()));
    expect(handled, "briefing has a Handled for you section").toBeTruthy();
    const speech = briefing.filter((t) => t.y > 70 && t.y < handled!.y && t.text.trim().length >= 25);
    expect(speech.length, "the briefer's line is shown").toBeGreaterThan(0);

    await answerBriefing(page, volume.name);
    expect(await hasStop(page, "open", "CampaignBriefing")).toBe(true);
    await page.waitForTimeout(500);
    await assertNoRawText(page, `${volume.name} briefing, all answered`);
    await clickStop(page, "open", "CampaignBriefing");

    // Setup deal (keep every hand) and the board, in round 1.
    await driveToBoard(page, { timeoutMs: 90000 });
    expect(await boardRound(page), "the board is in round 1").toBe(1);
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });
}
