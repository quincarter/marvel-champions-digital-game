/**
 * The `?screen=past-games&fixture=demo` dev jump (`scenes/boot-dev-jump.ts`): a handful of finished games written into
 * the saves database, for looking at the Past games list (search, aspect chips) without playing any. Each is a
 * summary-only save (a won or lost game with a seat summary and one command), so the list shows it; Watch would not
 * replay it. Nothing here ships: the jump is dev-only.
 */
import { IdbGameStorage } from "../engine/idb-game-storage.js";
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";

const HOUR = 3_600_000;

interface DemoSeat {
  readonly identity: string;
  readonly aspects: readonly string[];
  readonly defeated?: boolean;
  readonly deckName?: string;
}

interface DemoGame {
  readonly scenarioId: string;
  readonly won: boolean;
  readonly seats: readonly DemoSeat[];
}

const GAMES: readonly DemoGame[] = [
  { scenarioId: "rhino", won: true, seats: [{ identity: "01001a", aspects: ["justice"] }] },
  {
    scenarioId: "klaw",
    won: false,
    seats: [
      { identity: "01010a", aspects: ["leadership"], defeated: true },
      { identity: "01019a", aspects: ["aggression"], defeated: true },
    ],
  },
  { scenarioId: "ultron", won: true, seats: [{ identity: "04031a", aspects: ["aggression", "justice"] }] },
  {
    scenarioId: "rhino",
    won: true,
    seats: [
      {
        identity: "21031a",
        aspects: ["aggression", "justice", "leadership", "protection"],
        deckName: "Avatar of Life",
      },
      { identity: "01001a", aspects: ["pool"] },
      { identity: "01010a", aspects: ["protection"] },
    ],
  },
  { scenarioId: "klaw", won: true, seats: [{ identity: "01019a", aspects: [] }] },
];

/** Writes the demo games (newest first by index), replacing any left by an earlier run. */
export async function seedDemoPastGames(): Promise<void> {
  const storage = new IdbGameStorage();
  const now = Date.now();
  for (const [index, game] of GAMES.entries()) {
    const config = {
      scenarioId: game.scenarioId,
      difficulty: "standard",
      players: game.seats.map((seat) => ({ identityCardId: seat.identity, deck: [], aspects: seat.aspects })),
      seed: index + 1,
    } as unknown as SessionConfig;
    const meta: SaveMeta = {
      id: `demo-past-${index}`,
      schema: SAVE_SCHEMA,
      config,
      createdAt: now - (index + 1) * HOUR - 40 * 60_000,
      updatedAt: now - (index + 1) * HOUR,
      status: game.won ? "won" : "lost",
      round: 4 + index,
      commandCount: 60,
      outcome: (game.won
        ? { result: "win", reason: "villainDefeated" }
        : { result: "loss", reason: "allPlayersDefeated" }) as never,
      campaignId: null,
      campaignNodeId: null,
      playedMs: (30 + index * 7) * 60_000,
      summary: {
        lossReason: game.won ? null : "playersDefeated",
        heroesDefeated: game.seats.filter((seat) => seat.defeated).length,
        winners: [],
        alliesPlayed: 0,
        seats: game.seats.map((seat) => ({
          identityCardId: seat.identity,
          aspects: seat.aspects,
          deck: [],
          plays: {},
          activations: {},
          entered: {},
          damage: 12,
          thwart: 5,
          defeated: seat.defeated === true,
          ...(seat.deckName ? { deckName: seat.deckName } : {}),
        })),
      } as never,
    };
    await storage.create(meta, {} as unknown as StateWithoutPool);
  }
}

/**
 * `?screen=stats&fixture=custom&tab=matchups`: one won game of a custom scenario pack, The Rose by PermaKarma, with the
 * pack's records saved in the game as a real one would carry them (issue #937), so the Matchups grid shows the
 * scenario's name and designer rather than its id.
 */
export async function seedCustomScenarioGame(): Promise<void> {
  const now = Date.now();
  const pack = {
    id: "the-rose-bf",
    version: "1.0.0",
    name: "The Rose",
    authors: ["PermaKarma"],
    requires: [],
    cards: [],
    abilities: {},
    decks: [],
    scenarios: [{ id: "the-rose-bf-the-rose", name: "The Rose", recommendedModularSetIds: [] }],
  };
  const config = {
    scenarioId: "the-rose-bf-the-rose",
    difficulty: "standard",
    players: [{ identityCardId: "01010a", deck: [], aspects: ["leadership"] }],
    seed: 9,
    packs: [pack],
  } as unknown as SessionConfig;
  const meta: SaveMeta = {
    id: "demo-custom-scenario",
    schema: SAVE_SCHEMA,
    config,
    createdAt: now - 40 * 60_000,
    updatedAt: now,
    status: "won",
    round: 6,
    commandCount: 60,
    outcome: { result: "win", reason: "villainDefeated" } as never,
    campaignId: null,
    campaignNodeId: null,
    playedMs: 40 * 60_000,
    summary: {
      lossReason: null,
      heroesDefeated: 0,
      winners: [],
      alliesPlayed: 0,
      seats: [
        {
          identityCardId: "01010a",
          aspects: ["leadership"],
          deck: [],
          plays: {},
          activations: {},
          entered: {},
          damage: 14,
          thwart: 6,
          defeated: false,
        },
      ],
    } as never,
  };
  await new IdbGameStorage().create(meta, {} as unknown as StateWithoutPool);
}
