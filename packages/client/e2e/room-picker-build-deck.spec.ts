import { expect, test } from "@playwright/test";
import { settle, waitFor } from "./helpers.js";
import { installWave6Helpers, screens, trackErrors, visibleTexts, waitForScene } from "./wave6-helpers-a.js";
import { press, stopOf, stopsOf } from "./wave7-deck-builder-helpers.js";

/**
 * A player in a room can make a deck without leaving it (Quin, 2026-11-23): the deck picker always offers Build a deck
 * and Import from MarvelCDB. Run against the dev preview of the picker (`?screen=room-deck-picker&as=guest`,
 * `view/room-lobby-fixture.ts`), which carries its made-up room through the deck builder and back the way a live room
 * stays joined in its worker. Build a deck opens the builder on a new deck; Save then Back returns to the picker with
 * the new deck in the list, selected, its details open and Pick on offer.
 */

const deckKeys = async (page: Parameters<typeof stopsOf>[0]): Promise<string[]> =>
  (await stopsOf(page, "RoomDeckPicker")).map((stop) => stop.key).filter((key) => key.startsWith("deck:"));

test("Build a deck from the picker: build and save a deck, land back on it, ready to Pick", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.addInitScript(() => {
    localStorage.setItem("mc-guide", JSON.stringify({ version: 1, level: "off", chooserSeen: true }));
    localStorage.setItem("mc-room-deck-view", "list");
  });
  await page.goto("/?screen=room-deck-picker&as=guest");
  await waitForScene(page, "RoomDeckPicker");
  await settle(page);
  // Both makers are there whatever the list holds.
  expect(await stopOf(page, "RoomDeckPicker", "build"), "Build a deck").toBeTruthy();
  expect(await stopOf(page, "RoomDeckPicker", "import"), "Import from MarvelCDB").toBeTruthy();
  await waitFor(async () => ((await deckKeys(page)).length > 0 ? true : null), "the decks of this device", 20_000);
  const before = await deckKeys(page);

  await press(page, "RoomDeckPicker", "build");
  await waitForScene(page, "DeckBuilder", 15_000);
  await settle(page);
  // A new deck: Spider-Man, from his published precon (a legal deck a seat can take), then Save and Back.
  await press(page, "DeckBuilder", "identity:01001a");
  await waitFor(
    async () =>
      (await stopOf(page, "DeckBuilder", "save")) ||
      (await stopOf(page, "DeckBuilder", "tab:deck")) ||
      (await stopOf(page, "DeckBuilder", "start:empty"))
        ? true
        : null,
    "the builder or its start step",
    15_000,
  );
  const precon = (await stopsOf(page, "DeckBuilder")).find(
    (stop) => stop.key.startsWith("start:") && stop.key !== "start:empty" && stop.key !== "start:back",
  );
  if (precon) await press(page, "DeckBuilder", precon.key);
  else expect(await stopOf(page, "DeckBuilder", "start:empty"), "a start step offering a precon").toBeUndefined();
  await waitFor(
    async () =>
      (await stopOf(page, "DeckBuilder", "save")) || (await stopOf(page, "DeckBuilder", "tab:deck")) ? true : null,
    "the builder opens",
    15_000,
  );
  await press(page, "DeckBuilder", "save");
  await waitFor(
    async () => ((await visibleTexts(page)).some((t) => t.text === "Saved to your decks.") ? true : null),
    "the deck is saved",
    15_000,
  );
  await press(page, "DeckBuilder", "back");

  // Back in the picker (the made-up room still around it), on the deck just built.
  await waitForScene(page, "RoomDeckPicker", 15_000);
  await settle(page);
  await waitFor(
    async () => ((await deckKeys(page)).length === before.length + 1 ? true : null),
    "one deck more",
    20_000,
  );
  const added = (await deckKeys(page)).filter((key) => !before.includes(key));
  expect(added, "exactly the new deck").toHaveLength(1);
  const use = await stopOf(page, "RoomDeckPicker", "panel:use");
  expect(use, "its details are open, with Pick").toBeTruthy();
  // The deck is judged by a worker: wait for the verdict, then it is usable (no "Checking" or "Not usable" line anywhere).
  await waitFor(
    async () =>
      (await visibleTexts(page)).some((t) => t.scene === "RoomDeckPicker" && /checking|not usable/i.test(t.text))
        ? null
        : true,
    "the new deck is judged usable",
    30_000,
  );
  // The details open are the added deck's: a name shown on its own row is shown again in the panel.
  const row = added[0]!;
  const rowRect = (await stopOf(page, "RoomDeckPicker", row))!.rect;
  const texts = (await visibleTexts(page)).filter((t) => t.scene === "RoomDeckPicker");
  const rowNames = texts.filter(
    (t) =>
      t.x >= rowRect.x &&
      t.x < rowRect.x + rowRect.width &&
      t.y >= rowRect.y &&
      t.y < rowRect.y + rowRect.height &&
      t.text.length > 3,
  );
  const inPanel = texts.filter((t) => t.x >= use!.rect.x - 1);
  expect(rowNames.length, "the new deck's row has words").toBeGreaterThan(0);
  expect(
    rowNames.some((r) => inPanel.some((p) => p.text.includes(r.text))),
    "the open details are the new deck's",
  ).toBe(true);
  expect((await screens(page)).includes("RoomDeckPicker")).toBe(true);
  expect(errors).toEqual([]);
});

test("Import from MarvelCDB opens its link row; something that is no link says so, in Decks' words", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=room-deck-picker&as=guest");
  await waitForScene(page, "RoomDeckPicker");
  await settle(page);
  expect(await stopOf(page, "RoomDeckPicker", "import-field")).toBeUndefined();
  await press(page, "RoomDeckPicker", "import");
  await waitFor(() => stopOf(page, "RoomDeckPicker", "import-field").catch(() => undefined), "the link field", 10_000);
  await press(page, "RoomDeckPicker", "import-field");
  await page.keyboard.type("hello there");
  await press(page, "RoomDeckPicker", "import-go");
  await waitFor(
    async () =>
      (await visibleTexts(page)).some((t) => t.text.includes("doesn't look like a MarvelCDB deck link or id"))
        ? true
        : null,
    "the refusal",
    10_000,
  );
  // The row stays open for another try, and the picker is still the picker.
  expect(await stopOf(page, "RoomDeckPicker", "import-field")).toBeTruthy();
  expect(errors).toEqual([]);
});
