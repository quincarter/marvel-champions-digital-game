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
  // A new deck: Spider-Man, from the empty deck (hero cards only), then Save and Back.
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
  if (await stopOf(page, "DeckBuilder", "start:empty")) await press(page, "DeckBuilder", "start:empty");
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
  expect(await stopOf(page, "RoomDeckPicker", "panel:use"), "its details are open, with Pick").toBeTruthy();
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
