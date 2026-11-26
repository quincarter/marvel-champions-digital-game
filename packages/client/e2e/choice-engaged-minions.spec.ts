import { expect, test } from "@playwright/test";
import { activeScenes, findText, installPageHelpers, isPhonePage, settle, waitFor } from "./helpers.js";
import { trackErrors } from "./wave6-helpers-a.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * Issue #1001 (FirePenguin17): two facedown Drones are the same card back, so on a choose-an-enemy sheet in a game of
 * more than one seat each minion tile says who it is engaged with, "vs Iron Man", the way its tile on the board does.
 * The `engaged-target` dev fixture stops on Repulsor Blast's choose-a-target with Iron Man's and Spider-Man's Drones
 * (`store/dev-engaged-target-game.ts`).
 */
test("each Drone on a choose-a-target sheet names the seat it is engaged with", async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installPageHelpers(page);
  await page.goto("/?screen=board&fixture=engaged-target");
  await waitFor(
    async () => ((await activeScenes(page)).includes("ChoiceOverlay") ? true : null),
    "Repulsor Blast's choose-a-target sheet",
    120_000,
  );
  await settle(page, { quietMs: 600, maxMs: 6000 });

  // A tile's note is a text of its own; a list row's is the last line of the row ("Drone minion", then "vs Iron Man").
  const notes = (await findText(page, "vs ", "ChoiceOverlay")).map((match) => match.text.split("\n").at(-1)!);
  expect(
    notes.filter((note) => note.startsWith("vs Iron Man")),
    "Iron Man's Drone",
  ).toHaveLength(1);
  // Spider-Man is in alter-ego form, "Spider-Man (Peter Parker)"; a phone's narrow tile takes a shorter form.
  expect(
    notes.filter((note) => /^vs S(pider)?\.?-Man/.test(note)),
    "Spider-Man's Drone",
  ).toHaveLength(1);
  // The villain is engaged with nobody: two notes, no more.
  expect(notes).toHaveLength(2);

  const name = `choice-engaged-minions-${isPhonePage(page) ? "phone" : "desktop"}.png`;
  await page.screenshot({ path: info.outputPath(name) });
  if (SHOT) await page.screenshot({ path: `${SHOT}/${name}` });
  expect(errors).toEqual([]);
});
