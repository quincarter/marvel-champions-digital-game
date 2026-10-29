import { expect, test, type Page } from "@playwright/test";
import { getBoardDebug, pressAt, settle, waitFor } from "./helpers.js";
import { PAD, installPad, padHold, padRelease, padTap, padWake } from "./pad-e2e-helpers.js";
import { trackErrors } from "./wave6-helpers-a.js";
import type { Rect } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Multi-seat solo play: one person plays every seat, so a decision can need a teammate's hand read first (will another
 * seat have the card the Helicarrier would pay for this round?). PEEK AT TABLE's banner has a button per seat that puts
 * that seat's side of the table (hero, play area, hand) under it, and Back from any seat puts the table on the seat
 * deciding with the decision in front again. Outside a decision, the team rail's View does the same. Played from a
 * three-seat Ultron game paused on its first mulligan (`?screen=board&fixture=drones&seats=3&choice=1`).
 */

interface PeekDebug {
  peeking(): boolean;
  peekRect(): Rect | null;
  backRect(): Rect | null;
  seatRects(): readonly Rect[];
}

const peekDebug = <K extends keyof PeekDebug>(page: Page, name: K): Promise<ReturnType<PeekDebug[K]> | null> =>
  page.evaluate(
    (n) =>
      ((window as unknown as { __mcChoicePeekDebug?: Record<string, () => unknown> }).__mcChoicePeekDebug?.[n]?.() ??
        null) as never,
    name,
  );

/** The seat the table shows to be read (`SessionState.peekSeat`), as its seat index, or -1 for the board's own. */
const peekedSeat = (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const mod = await import("/src/session.ts");
    const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store.state as {
      game: { players: { playerId: string }[] } | null;
      peekSeat: string | null;
      perspectiveId: string | null;
    };
    if (!state.game || state.peekSeat === null) return -1;
    return state.game.players.findIndex((player) => player.playerId === state.peekSeat);
  });

const sheetOptionCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const dbg = (window as unknown as { __mcChoiceDebug?: { allRects(): (readonly [string, unknown])[] } })
      .__mcChoiceDebug;
    return (dbg?.allRects() ?? []).filter(([key]) => key.startsWith("option:")).length;
  });

const press = async (page: Page, phone: boolean, rect: Rect): Promise<void> => {
  await settle(page);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
  await settle(page);
};

const URL = "/?screen=board&fixture=drones&seats=3&choice=1";

async function openSheet(page: Page): Promise<Rect> {
  await page.goto(URL);
  const peek = await waitFor(() => peekDebug(page, "peekRect"), "PEEK AT TABLE on the sheet", 30_000);
  await waitFor(async () => ((await sheetOptionCount(page)) > 0 ? true : null), "the sheet's options", 10_000);
  return peek;
}

test("PEEK AT TABLE switches the table to a teammate's side and Back puts it on the seat deciding", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await press(page, phone, await openSheet(page));
  await waitFor(async () => ((await peekDebug(page, "peeking")) ? true : null), "peeking at the table", 10_000);

  const seats = (await peekDebug(page, "seatRects"))!;
  expect(seats, "one button per seat").toHaveLength(3);
  expect(await peekedSeat(page), "the table starts on the seat deciding").toBe(-1);

  await press(page, phone, seats[1]!);
  await waitFor(async () => ((await peekedSeat(page)) === 1 ? true : null), "the second seat's side", 10_000);
  if (SHOT) await page.screenshot({ path: `${SHOT}/seat-peek-teammate-${info.project.name}.png` });

  await press(page, phone, seats[2]!);
  await waitFor(async () => ((await peekedSeat(page)) === 2 ? true : null), "the third seat's side", 10_000);

  // The deciding seat's own button is the way home without leaving the peek.
  await press(page, phone, seats[0]!);
  await waitFor(async () => ((await peekedSeat(page)) === -1 ? true : null), "back on the seat deciding", 10_000);
  expect(await peekDebug(page, "peeking"), "still peeking").toBe(true);

  // Back from a teammate's side: the table and the decision both come back.
  await press(page, phone, seats[1]!);
  await waitFor(async () => ((await peekedSeat(page)) === 1 ? true : null), "the second seat's side again", 10_000);
  await press(page, phone, (await peekDebug(page, "backRect"))!);
  await waitFor(async () => ((await peekDebug(page, "peeking")) ? null : true), "back to the decision", 10_000);
  expect(await peekedSeat(page), "the table is on the seat deciding").toBe(-1);
  await waitFor(async () => ((await sheetOptionCount(page)) > 0 ? true : null), "the sheet's options back", 10_000);
  expect(errors).toEqual([]);
});

test("on a pad, LB + a face button picks the seat and View goes back to the decision", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "a controller is a desktop's");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installPad(page);
  await openSheet(page);
  await padWake(page);
  await padTap(page, PAD.view);
  await waitFor(async () => ((await peekDebug(page, "peeking")) ? true : null), "peeking at the table", 10_000);

  // LB + B: the second seat.
  await padHold(page, PAD.lb);
  await padTap(page, PAD.b);
  await padRelease(page, PAD.lb);
  await waitFor(async () => ((await peekedSeat(page)) === 1 ? true : null), "the second seat's side", 10_000);
  if (SHOT) await page.screenshot({ path: `${SHOT}/seat-peek-pad-${info.project.name}.png` });

  // B on a teammate's side goes home first; View then brings the decision back.
  await padTap(page, PAD.b);
  await waitFor(async () => ((await peekedSeat(page)) === -1 ? true : null), "back on the seat deciding", 10_000);
  await padHold(page, PAD.lb);
  await padTap(page, PAD.x);
  await padRelease(page, PAD.lb);
  await waitFor(async () => ((await peekedSeat(page)) === 2 ? true : null), "the third seat's side", 10_000);
  await padTap(page, PAD.view);
  await waitFor(async () => ((await peekDebug(page, "peeking")) ? null : true), "back to the decision", 10_000);
  expect(await peekedSeat(page)).toBe(-1);
  expect(errors).toEqual([]);
});

test("outside a decision, the team rail's LB combo shows a teammate's side and B goes back", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "a controller is a desktop's");
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installPad(page);
  await page.goto("/?screen=board&fixture=drones&seats=3");
  // The fixture plays its setup out first: wait for the first player's turn and a board that has drawn it.
  await waitFor(
    () =>
      page.evaluate(async () => {
        const mod = await import("/src/session.ts");
        const state = (mod as unknown as { appSession: () => { store: { state: unknown } } }).appSession().store
          .state as { game: { step: { kind: string } } | null; inFlight: boolean };
        return state.game?.step.kind === "turn" && !state.inFlight ? true : null;
      }),
    "the first player's turn",
    30_000,
  );
  await waitFor(() => getBoardDebug(page), "the board", 30_000);
  await settle(page, { quietMs: 1500 });
  await padWake(page);
  await padHold(page, PAD.lb);
  await padTap(page, PAD.b);
  await padRelease(page, PAD.lb);
  await waitFor(async () => ((await peekedSeat(page)) === 1 ? true : null), "the second seat's side", 10_000);
  if (SHOT) await page.screenshot({ path: `${SHOT}/seat-peek-rail-${info.project.name}.png` });
  await padTap(page, PAD.b);
  await waitFor(async () => ((await peekedSeat(page)) === -1 ? true : null), "back on the seat that acts", 10_000);
  expect(errors).toEqual([]);
});
