import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, focusRect, handInstanceFor, pressAt, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, visibleTexts } from "./wave6-helpers-a.js";
import { answerChoice, hook, openApp } from "./wave6-helpers-b.js";
import { SHOTS, SIZES, dumpBoard, wonderManRound2 } from "./qa-wave10-recheck-helpers.js";
import {
  bringIntoView,
  boardText,
  facts,
  idsOf,
  playFromHand,
  press,
  pressCard,
  waitForBoardText,
} from "./x-men-helpers.js";

/**
 * Re-check of docs/qa-wave10-client.md section 4 (pay bar at phone width) after the fixes, and Wonder Man's cards played
 * by hand (section 5). Overpay is a card's own text (Mr. Hollywood, Active Altruism and Everywhere All at Once print
 * it); the order picked cards land on the discard pile is RRG 1.8 "Discard", p. 16. Wonder Man against Rhino,
 * `wonder-man-justice`, staged hand, real touch or mouse input.
 */

const HOLLYWOOD = "58009";
const ALTRUISM = "58003"; // cost 0, overpaid: 1 threat plus 2 for each [energy] overpaid
const BLAST = "58004"; // cost 1
const ENERGY = "58023";
const FILLER = "58016";
const EAAO = "58018"; // X cost
const HAND = [HOLLYWOOD, ALTRUISM, ENERGY, BLAST, FILLER, EAAO];

const threat = (page: Page): Promise<number> =>
  facts(page, (game) =>
    Object.values(game.instances as Record<string, { threat?: number }>).reduce((n, i) => n + (i.threat ?? 0), 0),
  );

/** The pay bar's own texts must sit inside the viewport and not on top of one another. */
async function expectBarFits(page: Page, size: { width: number; height: number }, label: string): Promise<void> {
  const bar = (await visibleTexts(page)).filter(
    (t) =>
      t.scene === "Board" &&
      /^(pay|cancel|paying \d+ \/ \d+|play without overpaying|overpaid by \d+|x \d+|extra|overpay only)$/i.test(
        t.text.trim(),
      ),
  );
  expect(bar.length, `${label}: bar texts found`).toBeGreaterThan(1);
  for (const t of bar) {
    expect(t.x, `${label}: "${t.text}" left edge on screen`).toBeGreaterThanOrEqual(0);
    expect(t.x + t.w, `${label}: "${t.text}" right edge on screen (${size.width})`).toBeLessThanOrEqual(size.width + 4); // letter-spacing pads the text object by ~2 px
    expect(t.y + t.h, `${label}: "${t.text}" bottom edge on screen`).toBeLessThanOrEqual(size.height);
  }
  for (const a of bar)
    for (const b of bar) {
      if (a === b || !size.phone) continue; // desktop text boxes are wider than their glyphs: checked on the screenshot
      // 4 px of slack: a text object is a little wider than its glyphs (letter-spacing).
      const overlap = a.x + 4 < b.x + b.w && a.x + a.w - 4 > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      expect(overlap, `${label}: "${a.text}" overlaps "${b.text}"`).toBe(false);
    }
}

for (const size of SIZES) {
  test.describe(`Wonder Man pay bar at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.phone, isMobile: size.phone });

    test("Mr. Hollywood: overpay-only tag and note, held until covered, then counted as overpaid; Pay fits", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await installWave6Helpers(page);
      await openApp(page);
      await wonderManRound2(page, HAND);
      const [hollywood] = await idsOf(page, HOLLYWOOD, "play");
      const blast = (await handInstanceFor(page, BLAST))!;
      await playFromHand(page, size.phone, blast, async () => (await boardText(page, /^PAYING/i)) !== undefined);
      await settle(page, { quietMs: 400, maxMs: 2000 });
      // Fixed since the first pass (F9): the tile reads "EXTRA" on a phone and the bar carries the reason.
      await waitForBoardText(page, size.phone ? /^extra$/i : /^overpay only$/i, "overpay-only tag");
      await waitForBoardText(page, /Only to overpay/i, "the reason is on screen");
      await expectBarFits(page, size, "cost 1, nothing picked");
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-wm-${size.name}-held.png` });

      await pressCard(page, size.phone, hollywood!);
      const spent = () =>
        page.evaluate(
          (id) =>
            (
              window as unknown as {
                __mcBoardDebug: { paymentView(): { sources: { instanceId: string; spent: boolean }[] } };
              }
            ).__mcBoardDebug
              .paymentView()
              .sources.find((s) => s.instanceId === id)?.spent,
          hollywood,
        );
      expect(await spent(), "held: a tap on him does nothing").toBe(false);

      const energy = (await handInstanceFor(page, ENERGY))!;
      await bringIntoView(page, `card:${energy}`);
      await pressCard(page, size.phone, energy);
      await pressCard(page, size.phone, hollywood!);
      expect(await spent()).toBe(true);
      await waitForBoardText(page, /Overpaid by 2/i, "overpaid by Energy's extra and Hollywood's");
      await expectBarFits(page, size, "overpaid by 2");
      // Payment-order tags (RRG p. 16 "Discard"): the event itself is discarded on top of its payment, so the last
      // pick is tagged "under <card>" (a phone: "2▼"). The desktop tile clips the card name: see the report.
      await waitForBoardText(page, size.phone ? /^[0-9][▲▼]$/ : /^spent/i, "the picks carry an order tag");
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-wm-${size.name}-overpaid.png` });
      const pay = await waitForBoardText(page, /^pay$/i, "Pay");
      await press(page, size.phone, pay.x, pay.y);
      await settle(page);
    });

    test("Active Altruism at cost 0: 'Play without overpaying', then Mr. Hollywood overpays it for 3 threat", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await installWave6Helpers(page);
      await openApp(page);
      await wonderManRound2(page, HAND);
      const [hollywood] = await idsOf(page, HOLLYWOOD, "play");
      const before = await threat(page);
      const altruism = (await handInstanceFor(page, ALTRUISM))!;
      await playFromHand(page, size.phone, altruism, async () => (await boardText(page, /^PAYING/i)) !== undefined);
      await settle(page, { quietMs: 400, maxMs: 2000 });
      const plain = await waitForBoardText(page, /^Play without overpaying$/i, "plain default at cost 0");
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-wm-${size.name}-plain.png` });
      await expectBarFits(page, size, "play without overpaying");
      expect(plain.x + plain.w).toBeLessThanOrEqual(size.width);
      await pressCard(page, size.phone, hollywood!);
      await waitForBoardText(page, /Overpaid by 1/i, "Hollywood's energy is overpaid");
      await expectBarFits(page, size, "overpaid by 1 at cost 0");
      const confirm = await waitForBoardText(page, /^pay$/i, "Pay replaces the default");
      await press(page, size.phone, confirm.x, confirm.y);
      await answerChoice(page, 1);
      await settle(page);
      expect(before - (await threat(page)), "1 threat plus 2 for the [energy] overpaid").toBe(3);
    });

    test("Everywhere All at Once: the X stepper raises and lowers X, and X 2 paid exactly removes threat", async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await installWave6Helpers(page);
      await openApp(page);
      await wonderManRound2(page, HAND);
      const eaao = (await handInstanceFor(page, EAAO))!;
      await playFromHand(page, size.phone, eaao, async () => (await boardText(page, /^PAYING/i)) !== undefined);
      await settle(page, { quietMs: 400, maxMs: 2000 });
      const picker = () =>
        page.evaluate(
          () =>
            (
              window as unknown as { __mcBoardDebug: { paymentView(): { xPicker: { value: number } | null } } }
            ).__mcBoardDebug.paymentView().xPicker?.value,
        );
      expect(await picker()).toBe(1);
      const more = (await focusRect(page, "xMore"))!;
      await press(page, size.phone, more.x + more.width / 2, more.y + more.height / 2);
      await settle(page, { quietMs: 300, maxMs: 1000 });
      expect(await picker(), "plus raised X").toBe(2);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wave10-recheck-wm-${size.name}-x2.png` });
      const less = (await focusRect(page, "xLess"))!;
      await press(page, size.phone, less.x + less.width / 2, less.y + less.height / 2);
      await settle(page, { quietMs: 300, maxMs: 1000 });
      expect(await picker(), "minus lowered it").toBe(1);
      await press(page, size.phone, more.x + more.width / 2, more.y + more.height / 2);
      await settle(page, { quietMs: 300, maxMs: 1000 });
      await expectBarFits(page, size, "X 2");
      // X 2 costs 2: pay with Energy (2 resources) so the card is paid exactly, no overpay.
      const energy = (await handInstanceFor(page, ENERGY))!;
      await bringIntoView(page, `card:${energy}`);
      await pressCard(page, size.phone, energy);
      await waitForBoardText(page, /^pay$/i, "Pay is offered once X is covered");
      expect(await boardText(page, /Overpaid by/i), "exactly paid, nothing overpaid").toBeUndefined();
      const pay = (await boardText(page, /^pay$/i))!;
      const before = await threat(page);
      await press(page, size.phone, pay.x, pay.y);
      await settle(page, { quietMs: 400, maxMs: 3000 });
      // "Choose X schemes": the decision sheet needs both schemes selected before Confirm.
      await waitFor(async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null), "choice", 8000);
      await settle(page);
      const optionRects = async () =>
        (
          (await hook<[string, { x: number; y: number; width: number; height: number }][]>(
            page,
            "__mcChoiceDebug",
            "allRects",
          )) ?? []
        ).filter(([key]) => key.startsWith("option:"));
      expect((await optionRects()).length, "the sheet offers both schemes").toBe(2);
      for (let i = 0; i < 2; i++) {
        // Re-read the rects before each press: the sheet redraws after a pick.
        const r = (await optionRects())[i]![1];
        await pressAt(page, r.x + r.width / 2, r.y + r.height / 2);
        await settle(page, { quietMs: 300, maxMs: 1200 });
      }
      await clickText(page, "Confirm", { sceneKey: "ChoiceOverlay" });
      await settle(page, { quietMs: 400, maxMs: 3000 });
      // The main scheme held 1 threat and Bomb Scare 3: 2 from each, capped at what each holds.
      expect(before - (await threat(page)), "1 + 2 removed").toBe(3);
      expect(await dumpBoard(page)).not.toMatch(/undefined|NaN|\[object/);
    });
  });
}
