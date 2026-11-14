/**
 * Keeps `game-roster.json` (the landing page's heroes, scenarios and deck authors) equal to what the game offers.
 * The landing build can't load the card pool itself without bundling all of it, so it reads this file instead.
 *
 * When this fails because heroes or scenarios were added, regenerate it:
 *   MC_UPDATE_SITE_DATA=1 pnpm --filter @mc/client exec vitest run src/site/landing/game-roster.test.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { COMMUNITY_DECK_AUTHORS, PLAYABLE_SCENARIO_RECORDS, communityDecks } from "@mc/cards";
import { CARDS_BY_ID, POOL_HERO_SHELF_PACKS, POOL_STARTER_DECKS } from "../../content/pool.js";
import type { GameRoster } from "./game-roster.js";

const FILE = new URL("./game-roster.json", import.meta.url);

function rosterNow(): GameRoster {
  const shelfOf = new Map(POOL_HERO_SHELF_PACKS.map((pack) => [pack.code, pack]));
  const waves = new Map<
    string,
    { name: string; order: number; heroes: GameRoster["waves"][number]["heroes"][number][] }
  >();
  const seen = new Set<string>();
  for (const deck of POOL_STARTER_DECKS) {
    const shelf = shelfOf.get(deck.packCode as string);
    const card = CARDS_BY_ID.get(deck.identityCardId as string);
    if (!shelf || !card) continue;
    const name = card.name;
    // One line per hero: a hero with two precons (a campaign box's and a hero pack's) is still one hero to play.
    if (seen.has(name)) continue;
    seen.add(name);
    const wave = waves.get(shelf.cycleId) ?? { name: shelf.cycleName, order: shelf.cycleOrder, heroes: [] };
    wave.heroes.push({ id: deck.identityCardId as string, name, aspects: [...deck.aspects] });
    waves.set(shelf.cycleId, wave);
  }
  const authors = new Set<string>();
  for (const deck of communityDecks()) if (deck.authorNamed) authors.add(deck.author);
  for (const name of Object.values(COMMUNITY_DECK_AUTHORS)) authors.add(name);
  return {
    heroCount: seen.size,
    scenarioCount: PLAYABLE_SCENARIO_RECORDS.length,
    scenarios: PLAYABLE_SCENARIO_RECORDS.map((scenario) => ({ id: scenario.id as string, name: scenario.name })),
    waves: [...waves.values()].sort((a, b) => a.order - b.order).map(({ name, heroes }) => ({ name, heroes })),
    deckAuthors: [...authors].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
  };
}

describe("the landing page's game roster", () => {
  it("matches what the game offers", () => {
    const now = rosterNow();
    if (process.env.MC_UPDATE_SITE_DATA === "1") writeFileSync(FILE, `${JSON.stringify(now, null, 2)}\n`);
    const saved = JSON.parse(readFileSync(FILE, "utf8")) as GameRoster;
    expect(saved).toEqual(now);
  });
});
