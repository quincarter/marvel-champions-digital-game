import { expect, test, type Page } from "@playwright/test";
import { pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { hook, openApp } from "./wave6-helpers-b.js";

/**
 * Take your seats: Random seats a random hero in the active seat (#911). It picks from what the roster offers, so a
 * hero the roster marks not seatable (not ready, illegal) or already at another seat is never the pick, and the other
 * seats are left as they were. Runs on the desktop and phone projects; the control's rect comes from `__mcSeatsDebug`, the same
 * one the screen draws, and the press goes through the pointer (a tap on the phone project).
 */

const seats = async (page: Page): Promise<string[]> => (await hook<string[]>(page, "__mcSeatsDebug", "seats")) ?? [];
const activeSeat = async (page: Page): Promise<number> =>
  (await hook<number>(page, "__mcSeatsDebug", "activeSeat")) ?? 0;

test("Random seats a hero in the active seat and leaves the other seats alone", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=seats&players=2", { landing: "Seats" });
  await waitFor(async () => ((await seats(page)).length === 2 ? true : null), "two seats drawn", 30_000);
  await settle(page);

  const unseatable = (await hook<string[]>(page, "__mcSeatsDebug", "unseatable")) ?? [];
  const seen = new Set<string>();
  // Seating a hero moves the active seat on to the next empty one, as a tile tap does, so each press reads the seat it
  // fills first. The presses fill seats 3 and 4, then reroll seat 4.
  for (let press = 0; press < 6; press++) {
    const active = await activeSeat(page);
    const before = await seats(page);
    const was = before[active];
    await pressHookStop(page, "__mcSeatsDebug", "hero-random");
    await waitFor(async () => ((await seats(page))[active] !== was ? true : null), "a hero seated by Random", 15_000);
    const now = await seats(page);
    expect(now[active]).toBeTruthy();
    expect(now[active]).not.toBe(was);
    // Every other seat is as it was.
    before.forEach((deck, seat) => {
      if (seat !== active) expect(now[seat]).toBe(deck);
    });
    // Whatever the roster marks not seatable (a not-ready pack's hero, an illegal deck) is never the pick.
    expect(unseatable).not.toContain(now[active]);
    seen.add(now[active]!);
  }
  // Six presses cannot all land on one hero, whichever random numbers came up.
  expect(seen.size).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
