/**
 * Community decks: every public MarvelCDB decklist this repo has saved and proven (`docs/custom-deck-testing.md`), as
 * one catalog a client can recommend from. These are decks by named MarvelCDB authors, not official precons.
 *
 * **The catalog is the fixture files themselves.** Each `fixtures/**` JSON under `playable/` and under any `wave<N>/`
 * folder is one saved `GET https://marvelcdb.com/api/public/decklist/<id>.json` response, and the same files are what
 * the tests read: `marvelcdb-decklists.ts` (run as `marvelcdb-decklists-<part>.test.ts`) proves every catalog entry
 * (imports against the playable pool, legal under `validateDeck`, plays a seeded game to an outcome that replays
 * deep-equal), so a deck cannot be listed here without being tested there.
 *
 * **Adding a deck is dropping its fixture into a wave's `fixtures/` folder.** A new wave's folder joins through the
 * `../wave*` pattern with no change here. The saved JSON carries the author's MarvelCDB user id but not their name,
 * so an author is named by one line in `COMMUNITY_DECK_AUTHORS`; until then the deck is credited to
 * "MarvelCDB user <id>". To keep a saved decklist out of the catalog, name its id in `NOT_RECOMMENDED`.
 */
import {
  PLAYABLE_CARDS,
  parseMarvelCdbDeckJson,
  type CardId,
  type CoreAspect,
  type DeckContents,
  type ImportProblem,
} from "@mc/content";

// `import.meta.glob` is Vite's static-file loader (the client build and vitest both run it): Vite replaces the call
// below with the files themselves, so there is nothing to feature-test at run time. `@mc/cards`'s tsconfig carries no
// Vite types, hence the cast (the same pattern as the tests that read these fixtures). Outside Vite (the Playwright
// runner loads `@mc/cards` in plain Node for its helpers) the call throws, and the catalog is empty there.
interface ImportMetaGlob {
  readonly glob: (patterns: readonly string[], opts: object) => unknown;
}
function loadFixtures(): Record<string, unknown> {
  try {
    return (import.meta as unknown as ImportMetaGlob).glob(["./fixtures/*.json", "../wave*/**/fixtures/**/*.json"], {
      import: "default",
      eager: true,
    }) as Record<string, unknown>;
  } catch {
    return {};
  }
}
const FIXTURES = loadFixtures();

/**
 * MarvelCDB user id → the author's name as MarvelCDB shows it. Kept by hand (the public decklist JSON has only
 * `user_id`) and never guessed: a name goes in when it has been read from the decklist's own page
 * (`marvelcdb.com/decklist/view/<id>`, whose author link is `/user/profile/<user id>/<name>`). Every name below was
 * read that way on 2026-10-10, or was recorded at fetch time by the wave 5 and wave 9 decklist tests, or was given by
 * the owner (Brian-V, Web-Warrior Fanatic).
 */
export const COMMUNITY_DECK_AUTHORS: Readonly<Record<number, string>> = {
  3: "ImpossibleGerman",
  5: "dr00",
  13: "KennedyHawk",
  34: "zachbunn",
  388: "Mag",
  706: "nungunz",
  720: "jamjams32",
  2326: "Brian-V",
  2504: "Remedy",
  3043: "oxthearsenal",
  3779: "NocturnalAnimal",
  4029: "KingOfRohan",
  6910: "IlEmperatore",
  7491: "L3w15 7",
  7644: "MegiDolaDyne",
  7708: "AxeUnknown",
  8757: "Saan",
  8938: "journeyman2",
  10006: "CVdantespeak",
  11440: "Man-is-Obsolete",
  12314: "Thrawn24",
  13437: "BananaBobert",
  14578: "SoloMarvelChampion",
  16017: "NelsonAllOver",
  16053: "VillainTheory",
  16103: "stilonxy",
  16663: "MiguelCantillo3",
  18463: "enzo",
  18564: "Raftman",
  19074: "JRise33",
  19903: "LeahLorenna",
  27264: "Doublejefferdy",
  28541: "andyr",
  34614: "Ademuruiken",
  34979: "Web-Warrior Fanatic",
  37731: "Tzars",
  38537: "Daring Lime",
  47191: "JuanMC",
  75879: "Juastin",
};

/** MarvelCDB decklist ids saved as fixtures that the game should not recommend. */
const NOT_RECOMMENDED: ReadonlySet<number> = new Set<number>([]);

export interface CommunityDeck {
  readonly marvelcdbId: number;
  /** The deck's name on MarvelCDB. */
  readonly name: string;
  readonly heroName: string;
  readonly identityCardId: CardId;
  readonly aspects: readonly CoreAspect[];
  /** The author's MarvelCDB name, or "MarvelCDB user <id>" while `COMMUNITY_DECK_AUTHORS` has no line for them. */
  readonly author: string;
  readonly authorId: number;
  /** False while `author` is the "MarvelCDB user <id>" placeholder. */
  readonly authorNamed: boolean;
  /** `https://marvelcdb.com/decklist/view/<id>`. */
  readonly url: string;
  /** The decklist's MarvelCDB version ("1.0", "2.0"). */
  readonly version: string;
  /** ISO 8601, MarvelCDB's `date_creation`: when the author published this decklist. */
  readonly publishedAt: string | null;
  /**
   * ISO 8601, MarvelCDB's `date_update` when the fixture was saved. Not shown to players: it moves without the deck
   * changing (a re-fetch days later returned later dates for unchanged decklists), so it does not say "revised".
   */
  readonly updatedAt: string | null;
  /** MarvelCDB's own tags ("solo", "multiplayer", "theme", "beginner"). */
  readonly tags: readonly string[];
  /** The author's write-up, as Markdown. Empty when the fixture was saved without it. */
  readonly description: string;
  readonly contents: DeckContents;
  /** The fixture file, relative to this module. */
  readonly fixture: string;
}

/** A saved decklist that did not import against the playable pool, so it is not offered. */
export interface SkippedCommunityDeck {
  readonly fixture: string;
  readonly heroCode: string | null;
  readonly problems: readonly ImportProblem[];
}

export const communityDeckUrl = (marvelcdbId: number): string => `https://marvelcdb.com/decklist/view/${marvelcdbId}`;

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const isoDate = (value: unknown): string | null =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

function build(): { readonly decks: readonly CommunityDeck[]; readonly skipped: readonly SkippedCommunityDeck[] } {
  const decks = new Map<number, CommunityDeck>();
  const skipped: SkippedCommunityDeck[] = [];
  for (const fixture of Object.keys(FIXTURES).sort()) {
    const raw = FIXTURES[fixture] as Record<string, unknown> | null;
    const marvelcdbId = raw?.["id"];
    if (!raw || typeof marvelcdbId !== "number" || NOT_RECOMMENDED.has(marvelcdbId) || decks.has(marvelcdbId)) continue;
    const result = parseMarvelCdbDeckJson(raw, PLAYABLE_CARDS);
    if (!result.ok) {
      skipped.push({ fixture, heroCode: text(raw["hero_code"]) || null, problems: result.problems });
      continue;
    }
    const authorId = typeof raw["user_id"] === "number" ? raw["user_id"] : 0;
    const named = COMMUNITY_DECK_AUTHORS[authorId];
    decks.set(marvelcdbId, {
      marvelcdbId,
      name: (result.deckName ?? text(raw["name"])).trim(),
      heroName: result.heroName ?? text(raw["hero_name"]),
      identityCardId: result.contents.identityCardId,
      aspects: result.contents.aspects,
      author: named ?? `MarvelCDB user ${authorId}`,
      authorId,
      authorNamed: named !== undefined,
      url: communityDeckUrl(marvelcdbId),
      version: text(raw["version"]),
      publishedAt: isoDate(raw["date_creation"]),
      updatedAt: isoDate(raw["date_update"]),
      tags: text(raw["tags"])
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      description: text(raw["description_md"]),
      contents: result.contents,
      fixture,
    });
  }
  const ordered = [...decks.values()].sort(
    (a, b) => (a.identityCardId as string).localeCompare(b.identityCardId as string) || a.marvelcdbId - b.marvelcdbId,
  );
  return { decks: ordered, skipped };
}

let built: ReturnType<typeof build> | null = null;

/** Every community deck, by hero (identity card id) and then MarvelCDB id. Parsed once, on first use. */
export function communityDecks(): readonly CommunityDeck[] {
  return (built ??= build()).decks;
}

/** Saved decklists left out because they did not import against the playable pool (a hero or card not released here yet). */
export function skippedCommunityDecks(): readonly SkippedCommunityDeck[] {
  return (built ??= build()).skipped;
}
