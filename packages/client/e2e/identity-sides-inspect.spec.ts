import { expect, test, type Page } from "@playwright/test";
import { findText, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors, visibleTexts } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { press } from "./x-men-helpers.js";

/**
 * Issue #532: Inspect on a hero in the hero picker only showed the identity's hero side, so a player who does not own
 * the pack could not read its Alter-Ego or its other forms before picking it. The sheet's side toggle now steps an
 * identity through Hero, Alter-Ego and each extra form: Ant-Man's Tiny side, Scott Lang, then Giant Ant-Man. Pressed
 * with a real mouse click on the desktop and a real touch tap on the phone; the keyboard's Inspect key steps it too.
 */

const squash = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

const inspectTexts = async (page: Page): Promise<string> =>
  squash(
    (await visibleTexts(page))
      .filter((t) => t.scene === "InspectOverlay")
      .map((t) => t.text)
      .join(" "),
  );

const toggleAt = (page: Page, label: string) =>
  waitFor(
    async () => (await findText(page, label, "InspectOverlay"))[0] ?? null,
    `the "${label}" button on the Inspect sheet`,
    15_000,
  );

/** Presses the toggle labelled `label`, then waits for the button to offer `next`. */
async function step(page: Page, phone: boolean, label: string, next: string): Promise<void> {
  // The other side's scan may still be loading, and the sheet re-lays out when it arrives: find the button after that.
  await settle(page, { quietMs: 500, maxMs: 4000 });
  const button = await toggleAt(page, label);
  await press(page, phone, button.x, button.y);
  await toggleAt(page, next);
}

test("issue #532: Inspect on a hero in the picker steps through Hero, Alter-Ego and Giant form", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page, "screen=seats&unlock=all", { landing: "Seats" });
  await settle(page);

  // The same sheet the picker's Inspect opens on a hero (`scenes/seats.ts`'s `#inspectOption`): the identity card on
  // its hero side, with the seat's pick as the primary button.
  await page.evaluate(() => {
    const game = (
      window as unknown as {
        __mcGame: { scene: { getScene(key: string): { scene: { launch(key: string, data: unknown): void } } } };
      }
    ).__mcGame;
    game.scene.getScene("Seats").scene.launch("InspectOverlay", {
      card: { cardId: "12001a", face: { kind: "hero" } },
      choice: { optionId: "ant-leadership", label: "Take this seat" },
    });
  });
  await toggleAt(page, "Show Alter-Ego");
  // Read once the scan is in (a "No scan" placeholder stands in while it loads).
  await settle(page, { quietMs: 500, maxMs: 4000 });
  const tiny = await inspectTexts(page);
  expect(tiny, "the sheet opens on Ant-Man's Tiny side").toContain("punypest");

  await step(page, phone, "Show Alter-Ego", "Show Giant Ant-Man");
  const scott = await inspectTexts(page);
  expect(scott, "Scott Lang's text").toContain("timetounwind");
  expect(scott).not.toContain("punypest");

  await step(page, phone, "Show Giant Ant-Man", "Show Tiny Ant-Man");
  expect(await inspectTexts(page), "Giant Ant-Man's text").toContain("giantnuisance");

  await step(page, phone, "Show Tiny Ant-Man", "Show Alter-Ego");
  await settle(page, { quietMs: 400, maxMs: 3000 });
  expect(await inspectTexts(page), "back on the Tiny side").toEqual(tiny);

  // The keyboard's Inspect key steps the sheet too (a pad's Inspect button, whose glyph the toggle wears).
  if (!phone) {
    await page.keyboard.press("e");
    await toggleAt(page, "Show Giant Ant-Man");
    expect(await inspectTexts(page)).toContain("timetounwind");
  }

  // Picking from the sheet still works on any side.
  expect((await findText(page, "Take this seat", "InspectOverlay")).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
