import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { clickFocus, clickText, findText, focusRect, pressAt, pressHookStop, settle, waitFor } from "./helpers.js";
import { activeScenes } from "./helpers.js";
import {
  answerChoiceSheet,
  boardRound,
  clickStop,
  driveToBoard,
  screens,
  skipVillainPhase,
  hasStop,
  installWave6Helpers,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { gameFacts, hook } from "./wave6-helpers-b.js";

/**
 * Wave 7 custom deck, seen in the browser (docs/wave-definition-of-done.md section 4b): Psylocke's real MarvelCDB
 * decklist 32089 ("Ten Percent Luck, Twenty Percent Skill") is imported on the Decks screen through the link field
 * (the network reply is served by page.route from the decklist fixture the cards package's own legality test uses),
 * seated for Morlock Siege, dealt, and played for one round to round 2. Psylocke's two Psi-Knife upgrades are
 * permanent (printed "Permanent"), so they must start in play (RRG p. 18, "Permanent").
 */

const DECKLIST_ID = 32089;
const FIXTURE = fileURLToPath(new URL("../../cards/src/wave7/fixtures/decklists/psylocke.json", import.meta.url));
const SHOTS =
  "/private/tmp/claude-501/-Users-quincarter-Documents-Dev-marvel-champions-game/144e988e-5813-49ba-b244-097ac3ae5667/scratchpad/deck-import";

interface DeckRow {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly selected: boolean;
  readonly status: string;
  readonly legal: boolean;
  readonly problems: string[];
  readonly warning: string | null;
  readonly cardCount: number;
}

const shot = (page: Page, name: string): Promise<Buffer> =>
  page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width ?? 0}.png` });

const slotTotal = (): number =>
  Object.values((JSON.parse(readFileSync(FIXTURE, "utf8")) as { slots: Record<string, number> }).slots).reduce(
    (sum, n) => sum + n,
    0,
  );

const statusLine = (page: Page) => hook<{ text: string; tone: string }>(page, "__mcDecksDebug", "status");

/** Presses a hook-routed control, then lets the screen settle. */
async function press(page: Page, hookName: string, key: string): Promise<void> {
  await pressHookStop(page, hookName, key);
  await settle(page);
}

/** Facts about the table read from the engine state: the seated hero, round, and the Psi-Knives attached to her identity. */
const facts = (page: Page) =>
  gameFacts<{ hero: string; psiKnives: number; round: number }>(
    page,
    `(s) => { const g = s.game, p = g.players[0], n = (id) => g.cardPool[g.instances[id].cardId].name;
      return { hero: n(p.identity.instanceId), round: g.round,
        psiKnives: g.instances[p.identity.instanceId].attachments.filter((id) => n(id) === "Psi-Knife").length }; }`,
  );

test("Psylocke's MarvelCDB deck 32089: imported on Decks, seated for Morlock Siege, and played to round 2", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  let hits = 0;
  await page.route(`**/api/marvelcdb-import/decklist/${DECKLIST_ID}`, (route) => {
    hits++;
    return route.fulfill({ status: 200, contentType: "application/json", body: readFileSync(FIXTURE, "utf8") });
  });
  await page.addInitScript(() => {
    localStorage.setItem("mc-guide", JSON.stringify({ version: 1, level: "off", chooserSeen: true }));
  });
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page);

  // Decks & Collection: import by link, the way a player pastes a MarvelCDB URL.
  await clickText(page, "Decks", { sceneKey: "Title" });
  await waitForScene(page, "Decks", 10000);
  await settle(page);
  await press(page, "__mcDecksDebug", "ie-marvelcdb-toggle");
  await press(page, "__mcDecksDebug", "marvelcdb-field");
  await page.keyboard.type(`https://marvelcdb.com/decklist/view/${DECKLIST_ID}`);
  await settle(page);
  await press(page, "__mcDecksDebug", "marvelcdb-import");
  await waitFor(async () => (await statusLine(page)) ?? null, "an import message", 10000);
  expect(hits, "the link field asked for that decklist").toBe(1);
  expect((await statusLine(page))?.tone, `import status (${(await statusLine(page))?.text})`).toBe("success");
  expect((await statusLine(page))?.text).toBe('Imported "Ten Percent Luck, Twenty Percent Skill".');
  const decks = ((await hook<DeckRow[]>(page, "__mcDecksDebug", "decks")) ?? []).filter((d) => d.source === "imported");
  expect(decks, "one imported deck").toHaveLength(1);
  const deck = decks[0]!;
  expect(deck.name).toBe("Ten Percent Luck, Twenty Percent Skill");
  expect(deck.status).toBe("Legal");
  expect(deck.legal).toBe(true);
  expect(deck.problems).toEqual([]);
  expect(deck.warning, "no unscripted-card warning").toBeNull();
  expect(deck.cardCount, "the decklist's own card count").toBe(slotTotal());
  await settle(page);
  await shot(page, "1-decks-after-import");

  // Play this deck -> Take your seats (seat 1) -> back to Scenario select for Morlock Siege -> Seats again.
  await clickText(page, "Play this deck", { sceneKey: "Decks", timeoutMs: 30000 });
  await waitForScene(page, "Seats", 30000);
  await waitFor(async () => (await hasStop(page, "back", "Seats")) || null, "Seats controls", 15000);
  await settle(page);
  await clickStop(page, "back", "Seats");
  await waitForScene(page, "ScenarioSelect", 15000);
  await waitFor(async () => (await hasStop(page, "next", "ScenarioSelect")) || null, "scenario list", 15000);
  await settle(page);
  await clickStop(page, "scenario-chip:product:next_evol", "ScenarioSelect");
  await settle(page);
  await clickStop(page, "scenario-search", "ScenarioSelect");
  await page.keyboard.type("Morlock");
  await settle(page);
  await clickStop(page, "scenario:morlock-siege", "ScenarioSelect");
  await settle(page);
  await clickStop(page, "next", "ScenarioSelect");
  await waitForScene(page, "Seats", 15000);
  await settle(page);
  // Going back to Scenario select rebuilt the draft with the default seat; seat the imported deck by its own tile.
  const deckTile = await waitFor(
    async () =>
      ((await hook<{ key: string }[]>(page, "__mcSeatsDebug", "stops")) ?? []).find((s) =>
        s.key.startsWith(`hero:${deck.id}`),
      ) ?? null,
    "the imported deck's tile on Take your seats",
    15000,
  );
  await press(page, "__mcSeatsDebug", deckTile.key);
  await settle(page);
  const seatTexts = (await visibleTexts(page)).filter((t) => t.scene === "Seats").map((t) => t.text);
  // The seat card names the hero and aspect (the deck's own name is on its tile, which is the one pressed above).
  expect(seatTexts, "seat 1 is Psylocke").toContain("Psylocke");
  expect(seatTexts, "seat 1 shows the deck's aspect and hand size").toContain("Aggression · 10 HP · hand 4");
  await clickStop(page, "play", "Seats");
  await waitForScene(page, "Setup", 15000);
  await settle(page);
  await clickStop(page, "deal-it-out", "Setup");
  await driveToBoard(page, { timeoutMs: 120000 });

  const start = await facts(page);
  expect(start.hero).toBe("Psylocke");
  expect(start.round).toBe(1);
  expect(start.psiKnives, "both permanent Psi-Knife upgrades start in play").toBe(2);

  // One basic power: Psylocke starts as Betsy (alter-ego), so flip to hero form first, then thwart.
  await flipAndThwart(page);
  await settle(page);
  expect(
    await gameFacts<boolean>(page, `(s) => s.game.instances[s.game.players[0].identity.instanceId].exhausted`),
    "the basic power exhausted her identity",
  ).toBe(true);

  await shot(page, "3-turn-1");
  const round = await endTurnToRound2(page);
  expect(round).toBe(2);
  expect(await boardRound(page)).toBe(2);
  expect((await facts(page)).round).toBe(2);
  expect(await activeScenes(page)).not.toContain("GameOver");
  await shot(page, "4-round-2");
  expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
});

/** Flips Betsy to Psylocke, then thwarts the main scheme by real presses (a lone source and target need no picker). */
async function flipAndThwart(page: Page): Promise<void> {
  await clickFocus(page, "basic:changeForm");
  await waitFor(
    async () => ((await gameFacts<string>(page, `(s) => s.game.players[0].identity.form`)) === "hero" ? true : null),
    "the flip to hero form",
    10000,
  );
  await settle(page);
  await clickFocus(page, "basic:thwart");
  await settle(page);
  // The thwart may ask something first (Psylocke's own upgrades); answer with the first legal option until none is open.
  for (let i = 0; i < 6 && (await activeScenes(page)).includes("ChoiceOverlay"); i++) {
    await answerChoiceSheet(page);
    await settle(page);
  }
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * End turn, then the villain phase with every prompt answered the simplest legal way. Flipping to hero form leaves
 * Psylocke holding 6 cards against a hero hand size of 4, so the turn ends with "Discard 2 to hand size" (RRG p. 14,
 * hand size): its cards are toggled by presses that are not repeated (a repeated press would toggle a card back off,
 * which the shared helper's "press again if nothing changed" does), then Confirm.
 */
async function endTurnToRound2(page: Page): Promise<number> {
  await clickFocus(page, "basic:endTurn");
  const start = Date.now();
  let sig = "";
  let same = 0;
  while (Date.now() - start < 120_000) {
    const scenes = await screens(page);
    if (scenes.includes("ChoiceOverlay")) {
      const choice = await gameFacts<{ kind: string; min: number; options: string[] } | null>(
        page,
        `(s) => { const c = s.game.pendingChoice; return c ? { kind: c.prompt.kind, min: c.minSelections, options: c.options.map((o) => o.optionId) } : null; }`,
      );
      if (choice?.kind === "discardDownToHandSize") {
        // The sheet re-lays out its cards after each pick, so every card's rect is read fresh before its press.
        const rectNow = async (key: string): Promise<Rect | undefined> =>
          ((await hook<[string, Rect][]>(page, "__mcChoiceDebug", "allRects")) ?? []).find(([k]) => k === key)?.[1];
        for (const [i, id] of choice.options.slice(0, choice.min).entries()) {
          await settle(page);
          const r = await rectNow(`option:${id}`);
          if (!r) throw new Error(`no rect for discard option ${id}`);
          await pressAt(page, r.x + r.width / 2, r.y + r.height / 2, { verify: false });
          await waitFor(
            async () => ((await findText(page, `SELECTED ${i + 1}`, "ChoiceOverlay")).length > 0 ? true : null),
            `discard pick ${i + 1} registers`,
            5000,
          );
        }
        await settle(page);
        const confirm = await rectNow("confirm");
        if (!confirm) throw new Error("the discard sheet has no Confirm control");
        await pressAt(page, confirm.x + confirm.width / 2, confirm.y + confirm.height / 2);
      } else await answerChoiceSheet(page);
    } else if (scenes.includes("VillainPhaseOverlay")) {
      await skipVillainPhase(page);
    } else if (scenes.includes("GameOver")) {
      throw new Error("the game ended before round 2");
    } else if (scenes.includes("Board")) {
      const round = await boardRound(page);
      if (round !== null && round > 1 && (await focusRect(page, "basic:endTurn"))) return round;
    }
    same = scenes.join(",") === sig ? same + 1 : 0;
    sig = scenes.join(",");
    if (same > 80) throw new Error(`stuck on ${sig} during the villain phase`);
    await page.waitForTimeout(250); // loop pacing, not a blind wait
  }
  throw new Error("round 2 never started");
}
