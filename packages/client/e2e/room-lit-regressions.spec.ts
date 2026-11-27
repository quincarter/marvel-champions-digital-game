import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Regressions from the phase 3 review (#1049): a live room update while a press is armed, the Epic rename field's
 * cutout through the pop-up's slide, and the deck picker's "Sending your deck" veil owning every input.
 */

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (globalThis as unknown as { __mcRoomCalls?: string[] }).__mcRoomCalls ?? []);

test("a live update during an armed lobby press: the lift presses nothing for the person it now shows", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "a mouse press");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=room-lobby&as=host", { landing: "RoomLobby" });
  const button = page.locator('#mc-ui [data-scene="RoomLobby"] mc-sheet [data-key="seat:s1"]').first();
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  // The same-looking Take back, now for another person.
  await page.evaluate(() =>
    (window as unknown as { __mcLobbyPatchSeat: (id: string, patch: object) => void }).__mcLobbyPatchSeat("s1", {
      holder: "p9",
      holderName: "Bo",
    }),
  );
  await page.mouse.up();
  await settle(page);
  expect(await calls(page), "the lift acted on the new person").toEqual([]);
  await button.click();
  await expect.poll(() => calls(page)).toContainEqual("denySeat(s1,p9)");
  expect(errors).toEqual([]);
});

test("the Epic rename field stays inside its cutout through the pop-up's slide", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "a mouse");
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem("mc-settings") ?? "{}");
    localStorage.setItem("mc-settings", JSON.stringify({ ...raw, reducedMotion: false }));
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openApp(page, "screen=room-lobby&epic=organizer", { landing: "RoomLobby" });
  const rename = page.locator('#mc-ui [data-scene="RoomLobby"] mc-sheet [data-key="rename:t1"]').first();
  await rename.scrollIntoViewIfNeeded();
  await rename.click();
  const samples: { field: number[]; holes: number[][] }[] = [];
  for (let i = 0; i < 14; i++) {
    samples.push(
      await page.evaluate(() => {
        const input = [...document.querySelectorAll("input")].find((el) => el.getBoundingClientRect().width > 0);
        const wrap = document.querySelector('#mc-ui [data-scene="EpicSheetOverlay"]') as HTMLElement | null;
        const f = input?.getBoundingClientRect();
        const clip = wrap?.style.clipPath ?? "";
        const origin = wrap?.getBoundingClientRect();
        const holes: number[][] = [];
        const body = clip.replace(/^path\(evenodd, "/, "").replace(/"\)$/, "");
        // The first subpath is the whole panel; each later one is a hole: `x y H x2 V y2 H x Z`.
        for (const sub of body.split("M").slice(2)) {
          const nums = sub.match(/-?[\d.]+/g)?.map(Number) ?? [];
          if (nums.length >= 4)
            holes.push([
              nums[0]! + (origin?.x ?? 0),
              nums[1]! + (origin?.y ?? 0),
              nums[2]! + (origin?.x ?? 0),
              nums[3]! + (origin?.y ?? 0),
            ]);
        }
        return { field: f ? [f.x, f.y, f.width, f.height] : [], holes };
      }),
    );
    await page.waitForTimeout(40);
  }
  const seen = samples.filter((s) => s.field.length === 4 && s.holes.length > 0);
  expect(seen.length, "the field and a cutout were sampled").toBeGreaterThan(2);
  for (const s of seen) {
    const [fx, fy, fw, fh] = s.field as [number, number, number, number];
    const inside = s.holes.some(
      ([hx, hy, hx2, hy2]) => fx >= hx! - 3 && fy >= hy! - 3 && fx + fw <= hx2! + 3 && fy + fh <= hy2! + 3,
    );
    expect(inside, `field ${JSON.stringify(s.field)} in cutouts ${JSON.stringify(s.holes)}`).toBe(true);
  }
});

test("while a deck is sending, presses, keys and back do nothing until the answer", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "a mouse and keys");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await page.addInitScript(() => {
    (globalThis as unknown as { __mcPickHold: Promise<void> }).__mcPickHold = new Promise<void>((resolve) => {
      (globalThis as unknown as { __mcRelease: () => void }).__mcRelease = resolve;
    });
  });
  await openApp(page, "screen=room-deck-picker&as=guest", { landing: "RoomDeckPicker" });
  const scene = '#mc-ui [data-scene="RoomDeckPicker"]';
  await page.locator(`${scene} mc-deck-grid [data-key^="deck:"]`).first().click();
  const use = page.locator(`${scene} mc-deck-details [data-key="panel:use"]`);
  await expect(use).not.toHaveAttribute("disabled", "", { timeout: 30_000 });
  await use.click();
  // Everything under the veil is inert.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('#mc-ui [data-scene="RoomDeckPicker"] > *')].filter(
            (e) => (e as HTMLElement).inert,
          ).length,
      ),
    )
    .toBeGreaterThanOrEqual(2);
  for (const key of ["Tab", "Enter", "Escape", "ArrowDown", "Enter"]) await pressKey(page, key);
  await page.mouse.click(60, 30);
  await page.mouse.click(300, 400);
  await settle(page);
  expect(await calls(page), "nothing was sent before the answer").toEqual([]);
  expect(await activeScenes(page)).toContain("RoomDeckPicker");
  await page.evaluate(() => (globalThis as unknown as { __mcRelease: () => void }).__mcRelease());
  await waitFor(async () => ((await calls(page)).length > 0 ? true : null), "the held answer arrives", 10_000);
  expect((await calls(page))[0]).toMatch(/^chooseDeck\(s1,/);
  expect(errors).toEqual([]);
});
