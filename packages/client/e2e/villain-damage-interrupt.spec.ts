import { expect, test } from "@playwright/test";
import { pressAt, settle, waitFor } from "./helpers.js";
import { villainDebugRect } from "./overlay-helpers.js";
import { installWave6Helpers, trackErrors, visibleTexts } from "./wave6-helpers-a.js";

/**
 * Issue #394 (reported by @zackburnley): on a phone, Backflip's interrupt window squeezed the attack's breakdown to one
 * line and cut its end, the damage total the player decides on. Played from the `?screen=villain-damage-interrupt`
 * jump: a real Rhino game paused on Backflip's window for 2 damage.
 */
test("Backflip's window keeps the attack's damage total on screen and says what it prevents", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mc-settings",
      JSON.stringify({ version: 1, villainAutoAdvance: "off", flipEncounterCards: false, holdEncounterCards: false }),
    ),
  );
  // The reporter's phone: at 390 × 844 the whole line still fits, so the cut never happens there.
  if (phone) await page.setViewportSize({ width: 360, height: 788 });
  await installWave6Helpers(page);
  await page.goto("/?screen=villain-damage-interrupt");

  const start = await waitFor(() => villainDebugRect(page, "startRect"), "START VILLAIN PHASE", 30_000);
  await settle(page);
  if (phone) await page.touchscreen.tap(start.x + start.width / 2, start.y + start.height / 2);
  else await pressAt(page, start.x + start.width / 2, start.y + start.height / 2);
  await waitFor(() => villainDebugRect(page, "resolveRect"), "the interrupt window", 15_000);
  await settle(page);

  // What is drawn, not the Text's whole string: a cut line keeps its full `text` but draws only its first lines.
  const drawn = await waitFor(
    () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __mcVillainPhaseDebug?: { breakdownBeat(): { shown: string; cut: boolean } | null };
            }
          ).__mcVillainPhaseDebug?.breakdownBeat() ?? null,
      ),
    "the attack's breakdown",
    10_000,
  );
  expect(drawn.shown).toMatch(/DAMAGE 2/);
  if (phone) {
    expect(drawn.cut).toBe(true);
    expect(drawn.shown).toMatch(/^DAMAGE 2 = /);
  }
  // The green stamp on the window says what Backflip saves before the player chooses.
  const texts = await visibleTexts(page);
  expect(texts.some((t) => t.text === "PREVENTS")).toBe(true);
  expect(texts.some((t) => t.text === "2 DAMAGE")).toBe(true);
  // And the hit points now and if it resolves, read off the engine resolving the window on a copy.
  expect(texts.some((t) => t.text === "Spider-Man: 10 HP now · 8 HP if it resolves")).toBe(true);
  // The window's two tags stay inside the screen: on a phone the second stacks under the first.
  const width = page.viewportSize()!.width;
  const tags = (await visibleTexts(page)).filter((t) => /^(CARD ABILITY|FROM YOUR HAND)/.test(t.text));
  expect(tags.map((t) => t.text)).toEqual(expect.arrayContaining(["FROM YOUR HAND"]));
  for (const t of tags) expect(t.x + t.w / 2).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `test-results/villain-damage-interrupt-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
