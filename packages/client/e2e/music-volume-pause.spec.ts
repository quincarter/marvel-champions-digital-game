import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, tapAt, waitFor } from "./helpers.js";
import { openApp, type Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #243: the music player has Pause (Play while paused) and, on a desktop form factor, a volume slider with − and
 * +. The volume is kept between launches; a press along the slider sets it there. A phone has Pause only (its own
 * volume buttons set the loudness), and a swipe of the song list that lifts over Pause presses nothing (issue #227).
 */

interface PlayerDebug {
  stopRect(id: string): Rect | null;
  volumeRect(): Rect | null;
  listRect(): Rect;
  paused(): boolean;
  volume(): number;
}

const player = <K extends keyof PlayerDebug>(page: Page, key: K, arg?: string) =>
  page.evaluate(
    ([k, a]) => {
      const hook = (window as unknown as { __mcMusicPlayerDebug?: Record<string, (x?: string) => unknown> })
        .__mcMusicPlayerDebug;
      return (hook?.[k!]?.(a) ?? null) as ReturnType<PlayerDebug[K]> | null;
    },
    [key, arg] as const,
  );

const centre = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

async function press(page: Page, phone: boolean, at: { x: number; y: number }): Promise<void> {
  if (phone) await tapAt(page, at.x, at.y);
  else await pressAt(page, at.x, at.y);
}

async function openPlayer(page: Page, phone: boolean): Promise<void> {
  const button = await waitFor(
    () =>
      page.evaluate(
        () =>
          (window as unknown as { __mcMusicButtonDebug?: { rect(): Rect | null } }).__mcMusicButtonDebug?.rect() ??
          null,
      ),
    "the music button on Title",
    30_000,
  );
  await settle(page);
  await press(page, phone, centre(button));
  await waitFor(
    async () => ((await activeScenes(page)).includes("MusicPlayerOverlay") ? true : null),
    "the music player opens",
    15_000,
  );
  await waitFor(() => player(page, "stopRect", "pause"), "the Pause button", 15_000);
  await settle(page);
}

/** A finger swipe from `from` to `to`, lifted at `to` (a real touch sequence over CDP). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("issue #243: Pause, and a music volume that is kept between launches", async ({ page }, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  await openApp(page);
  await openPlayer(page, phone);
  expect(await player(page, "volume")).toBe(100);
  expect(await player(page, "paused")).toBe(false);

  // Pause, then Play again.
  const pause = (await player(page, "stopRect", "pause"))!;
  await press(page, phone, centre(pause));
  await waitFor(async () => ((await player(page, "paused")) ? true : null), "the music pauses", 5_000);

  if (phone) {
    expect(await player(page, "volumeRect"), "no volume slider on a phone").toBeNull();
    expect(await player(page, "stopRect", "volume-up")).toBeNull();
    if (SHOT) await page.screenshot({ path: `${SHOT}/music-volume-pause-phone.png` });
    // A swipe up the song list that lifts over Pause presses nothing.
    const list = (await player(page, "listRect"))!;
    const over = centre((await player(page, "stopRect", "pause"))!);
    await swipe(page, { x: over.x, y: list.y + list.height - 40 }, over);
    await settle(page);
    expect(await player(page, "paused"), "a swipe that lifted on Pause did not press it").toBe(true);
    return;
  }

  // A press a quarter of the way along the slider sets the volume to about a quarter.
  const track = (await player(page, "volumeRect"))!;
  // The zone runs a knob's radius past each end of the track.
  const knob = 9;
  const quarter = { x: track.x + knob + (track.width - knob * 2) * 0.25, y: track.y + track.height / 2 };
  await press(page, phone, quarter);
  await waitFor(
    async () => {
      const volume = (await player(page, "volume")) ?? 100;
      return volume >= 20 && volume <= 30 ? volume : null;
    },
    "the volume follows the press",
    5_000,
  );
  // + steps it up to the next mark of ten.
  const before = (await player(page, "volume"))!;
  await press(page, phone, centre((await player(page, "stopRect", "volume-up"))!));
  await waitFor(
    async () => ((await player(page, "volume")) === Math.floor(before / 10) * 10 + 10 ? true : null),
    "+ steps the volume up",
    5_000,
  );
  const saved = (await player(page, "volume"))!;
  if (SHOT) await page.screenshot({ path: `${SHOT}/music-volume-pause-${info.project.name}.png` });

  // A fresh launch keeps the volume; the pause is for the session.
  await openApp(page);
  await openPlayer(page, phone);
  expect(await player(page, "volume")).toBe(saved);
});
