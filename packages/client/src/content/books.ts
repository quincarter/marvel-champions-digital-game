/**
 * The rulebooks Extras can open: the Rules Reference, FFG's rulings since RRG 1.7, and every campaign box's
 * rulebook. Each reads as plain text from the repo's markdown conversion (`view/book-model.ts`), and links out to
 * the original PDFs.
 *
 * **The markdown is loaded on demand.** It is ~900 KB across the files, so each is its own lazily imported chunk
 * (`?raw`), fetched the first time that book is opened, never at startup.
 *
 * **The PDFs are linked, not shipped.** They are ~170 MB in the repo (`docs/campaign-modes/`, the RRG at the root),
 * far too much for every web, desktop and mobile build to carry. A link opens the repo's own copy on GitHub, which
 * shows a PDF in the browser; `books.test.ts` fails if a link names a file the repo doesn't have.
 */
import { parseBook, type BookParseOptions, type BookSection } from "../view/book-model.js";

/** The public repo's copy of a file, by its path from the repo root. */
export const REPO_FILE_URL = (path: string): string =>
  `https://github.com/quincarter/marvel-champions-digital-game/blob/main/${path.split("/").map(encodeURIComponent).join("/")}`;

export interface BookPdf {
  readonly label: string;
  /** From the repo root. */
  readonly path: string;
}

export interface BookSpec {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** The markdown, from the repo root. */
  readonly source: string;
  readonly parse: BookParseOptions;
  readonly pdfs: readonly BookPdf[];
  /** The campaign box (`Campaign.id`) a campaign rulebook belongs to, for its cover art. */
  readonly campaignId?: string;
}

const CAMPAIGN_PARSE: BookParseOptions = {
  splitAt: [2],
  skipTitles: /^(Table of Contents|Scenarios in this Expansion)$/i,
};

const campaign = (
  code: string,
  name: string,
  file: string,
  rulebook: string,
  log: string | null,
  campaignId?: string,
): BookSpec => ({
  id: `book:${code.toLowerCase()}`,
  title: name,
  subtitle: `${code} rulebook${log ? " · campaign log" : ""}`,
  source: `docs/campaign-modes/markdown/${file}`,
  parse: { ...CAMPAIGN_PARSE, preamble: name },
  pdfs: [
    { label: "Rulebook PDF", path: `docs/campaign-modes/${rulebook}` },
    ...(log ? [{ label: "Campaign log PDF", path: `docs/campaign-modes/log-sheets/${log}` }] : []),
  ],
  ...(campaignId ? { campaignId } : {}),
});

/** Every book, in the order the Rulebooks tab shows them: the rules first, then the boxes in release order. */
export const BOOKS: readonly BookSpec[] = [
  {
    id: "book:rrg",
    title: "Rules Reference",
    subtitle: "Version 1.8 · July 2026",
    source: "mc_rulesreference_v18_compressed.md",
    parse: { splitAt: [1, 2, 4, 5, 6], preamble: "Rules Reference" },
    pdfs: [{ label: "Rules Reference PDF", path: "mc_rulesreference_v18_compressed.pdf" }],
  },
  {
    id: "book:rulings",
    title: "FFG Rulings since RRG 1.7",
    subtitle: "December 2025 onward · transcribed by Hall of Heroes",
    source: "marvel-champions-rulings-post-rrg-1-7.md",
    parse: { splitAt: [1, 2, 3], skipTitles: /^Table of Contents$/i },
    pdfs: [],
  },
  campaign(
    "MC10",
    "The Rise of Red Skull",
    "mc10_the_rise_of_red_skull.md",
    "mc10_the_rise_of_red_skull_rules_web.pdf",
    "mc10_the_rise_of_red_skull_campaign-log.pdf",
    "trors",
  ),
  campaign(
    "MC16",
    "The Galaxy's Most Wanted",
    "mc16_galaxys_most_wanted.md",
    "mc16_galaxys_most_wanted_rules_website-compressed.pdf",
    "mc16_galaxys_most_wanted_campaignlog_website-compressed.pdf",
    "gmw",
  ),
  campaign(
    "MC21",
    "The Mad Titan's Shadow",
    "mc21_the_mad_titans_shadow.md",
    "mc21_the_mad_titans_shadow_rulebook-compressed.pdf",
    "mc21_the_mad_titans_shadow_rulebook-compressed-campaign_log.pdf",
    "mts",
  ),
  campaign(
    "MC27",
    "Sinister Motives",
    "mc27_sinister_motives.md",
    "mc27_sinister_motives_rules_v5-compressed.pdf",
    "mc27_sinister_motives_campaignlog.pdf",
    "sm",
  ),
  campaign(
    "MC32",
    "Mutant Genesis",
    "mc32_mutant_genesis.md",
    "mc32_mutant_genesis_rulebook_v5-compressed.pdf",
    "mc32_mutant_genesis_campaign_log.pdf",
    "mut_gen",
  ),
  campaign(
    "MC40",
    "NeXt Evolution",
    "mc40_next_evolution.md",
    "mc40_next_evolution_rulebook-web.pdf",
    "mc40_next_evolution_campaign_log-compressed.pdf",
    "next_evol",
  ),
  campaign(
    "MC45",
    "Age of Apocalypse",
    "mc45_age_of_apocalypse.md",
    "mc45_age_of_apocalypse_rulebook.pdf",
    "mc45_age_of_apocalypse_campaign_log.pdf",
    "aoa",
  ),
  campaign(
    "MC50",
    "Agents of S.H.I.E.L.D.",
    "mc50_agents_of_shield.md",
    "mc50_rulebook-web.pdf",
    "mc50_agents_of_shield_campaign_log.pdf",
    "aos",
  ),
  // Civil War has no campaign mode (MC56 p. 3), so no log sheet and no Saga volume.
  campaign("MC56", "Civil War", "mc56_civil_war.md", "mc56_rulebook-web_1.pdf", null),
  campaign("MC60", "Fear No Evil", "mc60_fear_no_evil.md", "mc60_rulebook-web.pdf", "mc60_campaign_log.pdf", "fne"),
];

// One lazy chunk per file; the key is the path from this module, so it's matched on the path from the repo root.
const SOURCES = import.meta.glob(
  [
    "../../../../mc_rulesreference_v18_compressed.md",
    "../../../../marvel-champions-rulings-post-rrg-1-7.md",
    "../../../../docs/campaign-modes/markdown/mc*.md",
  ],
  { query: "?raw", import: "default" },
) as Record<string, () => Promise<string>>;

const loaderFor = (source: string): (() => Promise<string>) | undefined =>
  Object.entries(SOURCES).find(([key]) => key.endsWith(`/${source}`))?.[1];

/** Whether the build has this book's text. */
export const hasBookText = (book: BookSpec): boolean => loaderFor(book.source) !== undefined;

const parsed = new Map<string, Promise<readonly BookSection[]>>();

/** A book's sections, fetched and parsed once per session. */
export function loadBook(book: BookSpec): Promise<readonly BookSection[]> {
  let sections = parsed.get(book.id);
  if (!sections) {
    const load = loaderFor(book.source);
    sections = load ? load().then((markdown) => parseBook(markdown, book.parse)) : Promise.resolve([]);
    sections.catch(() => parsed.delete(book.id));
    parsed.set(book.id, sections);
  }
  return sections;
}

export const bookById = (id: string): BookSpec | undefined => BOOKS.find((book) => book.id === id);
