/**
 * Everything the game shows or plays that somebody else made, and who made it (the Art & Credits screen,
 * `scenes/credits.ts`, drawn from `view/credits-model.ts`). The owner asked that every piece of art be credited
 * (2026-10-20), so a new art folder with a SOURCE.md or CREDITS.md note needs an entry here: `credits.test.ts`
 * fails when one is missing. `folders` are repo-relative paths (under `art/`, `assets/` or `music/`) that an entry
 * covers; a parent folder covers its children.
 *
 * Where the repo does not record an artist or a source, the credit line says so plainly rather than guessing; those
 * entries also carry `gap: true`, which is the owner's to-do list of credits to fill in.
 */

export type CreditGroup = "game" | "card-art" | "hero-villain-art" | "story" | "music" | "tools";

export interface CreditEntry {
  readonly id: string;
  readonly group: CreditGroup;
  /** What it is. */
  readonly title: string;
  /** Where in the game it appears. */
  readonly shownIn: string;
  /** Who made it: artist, writer, publisher, issue, year. */
  readonly credit: string;
  /** The intellectual-property line for this piece. */
  readonly notice: string;
  /** A web address, shown as text (nothing here opens it). */
  readonly url?: string;
  /** Repo folders this entry covers, for the coverage test. */
  readonly folders?: readonly string[];
  /** True when the artist or source is not recorded in the repo yet. */
  readonly gap?: boolean;
}

export const FAN_PROJECT_NOTICE =
  "This is a fan-made, non-commercial project. Marvel Champions: The Card Game, its card text, artwork and characters are the intellectual property of Fantasy Flight Games and Marvel.";

export const CREDITS_INTRO: readonly string[] = [
  FAN_PROJECT_NOTICE,
  "No art, music or card text here is licensed to you by this project. Each piece stays with the people and companies named below, under their own terms.",
];

export const CREDIT_GROUPS: readonly { readonly id: CreditGroup; readonly title: string }[] = [
  { id: "game", title: "The game" },
  { id: "card-art", title: "Card art and rulebooks" },
  { id: "hero-villain-art", title: "Hero, villain and title art" },
  { id: "story", title: "Story and comic pages" },
  { id: "music", title: "Music and sound" },
  { id: "tools", title: "Tools and libraries" },
];

const FFG_MARVEL = "Marvel Champions is Fantasy Flight Games'. Artwork and characters (c) Marvel.";
const MARVEL = "(c) Marvel. Used in this fan project; no ownership is claimed.";
const ARTIST_NOT_RECORDED = "The artist and original source are not recorded yet.";

const RULEBOOKS: readonly (readonly [string, string, string])[] = [
  ["trors", "The Rise of Red Skull", "mc10_the_rise_of_red_skull_rules_web.pdf"],
  ["gmw", "The Galaxy's Most Wanted", "mc16_galaxys_most_wanted_rules_website-compressed.pdf"],
  ["mts", "The Mad Titan's Shadow", "mc21_the_mad_titans_shadow_rulebook-compressed.pdf"],
  ["sm", "Sinister Motives", "mc27_sinister_motives_rules_v5-compressed.pdf"],
  ["mut_gen", "Mutant Genesis", "mc32_mutant_genesis_rulebook_v5-compressed.pdf"],
  ["next_evol", "NeXt Evolution", "mc40_next_evolution_rulebook-web.pdf"],
  ["aoa", "Age of Apocalypse", "mc45_age_of_apocalypse_rulebook.pdf"],
  ["aos", "Agents of S.H.I.E.L.D.", "mc50_rulebook-web.pdf"],
  ["fne", "Fear No Evil", "mc60_rulebook-web.pdf"],
];

export const CREDITS: readonly CreditEntry[] = [
  {
    id: "game",
    group: "game",
    title: "Marvel Champions: Digital Edition",
    shownIn: "The whole game",
    credit:
      "Built by Quin Carter, with code from Francisco Merchan Cordero. Open source under the GNU AGPL-3.0 (code only).",
    notice: "The AGPL covers this project's code, not Marvel's or Fantasy Flight Games' material.",
    url: "https://github.com/quincarter/marvel-champions-digital-game",
  },
  {
    id: "watchers",
    group: "game",
    title: "The Watchers: bug reporters",
    shownIn: "Thanks only",
    credit:
      "PermaKarma, Zack Burnley, dwballance and Joelstrd, and everyone who reported a bug or asked for a feature.",
    notice: "Thank you.",
  },
  {
    id: "original-game",
    group: "game",
    title: "Marvel Champions: The Card Game",
    shownIn: "Every rule, card and scenario",
    credit:
      "Designed by Michael Boggs, Nate French and Caleb Grace. Published by Fantasy Flight Games (Asmodee) under license from Marvel. The Rules Reference, FAQ and errata are theirs.",
    notice: FFG_MARVEL,
    url: "https://www.fantasyflightgames.com/en/products/marvel-champions-the-card-game/",
  },
  {
    id: "card-data",
    group: "game",
    title: "Card data and community rulings",
    shownIn: "Deck lists, deck import, rulings text",
    credit:
      "MarvelCDB (marvelcdb.com) for card data and deck import; Hall of Heroes (hallofheroeslcg.com) for rulings transcriptions, keyword lists and card references. Community sites, never the rules authority.",
    notice: "Card text is (c) Fantasy Flight Games and Marvel.",
    url: "https://marvelcdb.com",
  },

  {
    id: "card-scans",
    group: "card-art",
    title: "Card scans",
    shownIn: "Every card face, hover preview and inspect view",
    credit:
      "Card images from Hall of Heroes and MarvelCDB, fetched by the project's content scripts. Each card's illustrator is printed on the card itself; the artists are Fantasy Flight Games' and Marvel's commissioned illustrators.",
    notice: FFG_MARVEL,
    url: "https://hallofheroeslcg.com",
    folders: ["assets/card-art"],
  },
  ...RULEBOOKS.map(([id, name, pdf]): CreditEntry => ({
    id: `rulebook-${id}`,
    group: "card-art",
    title: `${name}: rulebook comic pages`,
    shownIn: "Scenario intros and campaign stories (where that box's pages are wired in)",
    credit: `The comic pages printed in the ${name} campaign rulebook (${pdf}), rendered from the official PDF. Fantasy Flight Games / Marvel. The page artists are credited in the rulebook itself.`,
    notice: FFG_MARVEL,
    folders: [`art/campaigns/${id}/rulebook`],
  })),

  {
    id: "hero-art",
    group: "hero-villain-art",
    title: "Hero pictures",
    shownIn: "Take your seats (hero select), Extras artwork",
    credit: `One picture per hero identity. ${ARTIST_NOT_RECORDED}`,
    notice: FFG_MARVEL,
    folders: ["art/heroes"],
    gap: true,
  },
  {
    id: "villain-art",
    group: "hero-villain-art",
    title: "Villain pictures and scenario intros",
    shownIn: "Scenario select, Game Over, one-off scenario intros, Extras artwork",
    credit: `Villain, victory and defeat pictures for each scenario, and the intro artboards. ${ARTIST_NOT_RECORDED}`,
    notice: FFG_MARVEL,
    folders: ["art/scenarios", "art/outcomes"],
    gap: true,
  },
  {
    id: "teamup-art",
    group: "hero-villain-art",
    title: "Team-Up splash pictures and badges",
    shownIn: "The Board, the first time a Team-Up becomes active",
    credit: `One splash and one badge per Team-Up pair. ${ARTIST_NOT_RECORDED}`,
    notice: FFG_MARVEL,
    folders: ["art/teamups"],
    gap: true,
  },
  {
    id: "pack-art",
    group: "hero-villain-art",
    title: "Pack covers and promo pictures",
    shownIn: "Pack shelf headers (when a cover is in place)",
    credit: `Pack covers and promo pictures. ${ARTIST_NOT_RECORDED}`,
    notice: FFG_MARVEL,
    folders: ["art/packs"],
    gap: true,
  },
  {
    id: "title-art",
    group: "hero-villain-art",
    title: "Title screen pictures",
    shownIn: "The Title screen (one at random) and Extras artwork",
    credit: `Box art, promotional art and wallpapers, among them the Core Set box, the Back to Basics back cover, the Mutant Genesis X-Men, the Rise of Apocalypse and the Spider-Verse team. ${ARTIST_NOT_RECORDED}`,
    notice: FFG_MARVEL,
    folders: ["art/title"],
    gap: true,
  },
  {
    id: "extras-art",
    group: "hero-villain-art",
    title: "Extras artwork shelf",
    shownIn: "Extras, Artwork tab (Psylocke and Angel, and the pictures opened by play)",
    credit: `Always-open pictures such as Psylocke and Angel. ${ARTIST_NOT_RECORDED}`,
    notice: FFG_MARVEL,
    folders: ["art/extras"],
    gap: true,
  },

  {
    id: "vazquez-gmw",
    group: "story",
    title: "The Galaxy's Most Wanted: comic pages",
    shownIn: "Campaign comic reader",
    credit: "Six fan-made Guardians of the Galaxy comic storyboards by Joey Vazquez, drawn for this campaign.",
    notice: "Characters (c) Marvel. Pages (c) Joey Vazquez.",
    folders: ["art/campaigns/gmw/pages"],
  },
  {
    id: "vazquez-mts",
    group: "story",
    title: "The Mad Titan's Shadow: comic pages",
    shownIn: "Campaign comic reader",
    credit: "Six fan-made Marvel Champions comic storyboards by Joey Vazquez, drawn for this campaign.",
    notice: "Characters (c) Marvel. Pages (c) Joey Vazquez.",
    folders: ["art/campaigns/mts/pages"],
  },
  {
    id: "vazquez-sm",
    group: "story",
    title: "Sinister Motives: comic pages",
    shownIn: "Campaign comic reader",
    credit: "Eight fan-made Marvel Champions comic storyboards by Joey Vazquez, drawn for this campaign.",
    notice: "Characters (c) Marvel. Pages (c) Joey Vazquez.",
    folders: ["art/campaigns/sm/pages"],
  },
  {
    id: "campaign-covers",
    group: "story",
    title: "Campaign covers and story pictures",
    shownIn: "Saga tiles, campaign covers, story panels, the MojoMania pages",
    credit: `Cover and single-picture story art for the campaign boxes, including the MojoMania broadcast and X-Babies pages. ${ARTIST_NOT_RECORDED}`,
    notice: FFG_MARVEL,
    folders: ["art/campaigns"],
    gap: true,
  },
  {
    id: "fne-art-heist",
    group: "story",
    title: "Fear No Evil: Art Museum Heist and The Getaway pages",
    shownIn: "The Art Museum Heist and The Getaway issue openers in the Fear No Evil campaign",
    // The owner, 2026-10-20.
    credit:
      "Ten comic pages, five each for the Art Museum Heist and The Getaway, built from panels of Black Cat (2019) #1 (Marvel Comics). Written by Jed MacKay; art by Travel Foreman, Mike Dowling and Nao Fuji; cover by J. Scott Campbell.",
    notice: MARVEL,
    folders: ["art/campaigns/fne/pages"],
  },
  {
    id: "shadowland-comic",
    group: "story",
    title: "Shadowland (2010): comic pages",
    shownIn: "Not shown yet; kept for the Shadowland story and Extras",
    credit:
      "Six lettered pages from Marvel's 2010 Shadowland event (the possessed Daredevil and the Hand), written by Andy Diggle with art by Billy Tan. The issue each page comes from is not confirmed yet.",
    notice: MARVEL,
    folders: ["art/scenarios/_pending/shadowland"],
    gap: true,
  },
  {
    id: "shadowland-panels",
    group: "story",
    title: "Shadowland story panels",
    shownIn: "Not shown yet; raw material for the Shadowland scenario intro",
    // The owner, 2026-10-20, from their library entry for the issue.
    credit:
      "Five panel pictures from Shadowland #5 (of 5) (Marvel Comics, 2010), found at the foot of Hall of Heroes' Shadowland page. Written by Andy Diggle; pencils by Billy Tan; inks by Victor Olazaba; colors by Guru eFX; cover by John Cassaday.",
    notice: MARVEL,
    url: "https://hallofheroeslcg.com/shadowland/",
  },
  {
    id: "avengers-11",
    group: "story",
    title: 'Avengers (2018) #11, "Worthy of a Second Date?": four pages',
    shownIn: "Not shown yet; the earned mini comic for the Thor and She-Hulk Team-Up achievement",
    credit:
      "Marvel Comics, released December 12, 2018 (cover-dated January 2019). Written by Jason Aaron; pencils by Cory Smith, Ed McGuinness and Karl Kesel; cover by Ed McGuinness. Pages 6, 11, 16 and 17. Inkers, colorist and letterer are not listed in the owner's library entry, so they are not recorded yet.",
    notice: MARVEL,
    url: "https://www.marvel.com/comics/issue/67768/avengers_2018_11",
    folders: ["art/extras/_pending/thor-she-hulk-badlands-date"],
    gap: true,
  },

  {
    id: "soundtrack",
    group: "music",
    title: "Soundtrack",
    shownIn: "Title, gameplay, scenario and campaign themes, the Extras jukebox",
    credit:
      "Original instrumental music generated with Google Gemini from prompts written for this project (the owner, 2026-10-20): no vocals, and not modeled on any existing theme.",
    notice:
      "AI-generated music made with Google Gemini, under Google's terms for generated content; no human composer is credited. Not licensed to you by this project.",
    folders: ["music"],
  },
  {
    id: "sfx",
    group: "music",
    title: "Sound effects",
    shownIn: "Card plays, attacks, thwarts, hand refills, Extras and achievement unlocks",
    credit:
      'Short royalty-free sounds gathered from assorted free sound libraries online (the owner, 2026-10-20). The "Achievement unlocked" sound is "Level Complete" by Universfield (Pixabay).',
    notice: "Royalty-free sounds, used under each library's own license.",
  },

  {
    id: "phaser",
    group: "tools",
    title: "Phaser 4 and rexUI",
    shownIn: "Every screen",
    credit: "Phaser by Phaser Studio (MIT). phaser4-rex-plugins (rexUI) by Rex Rainbow (MIT).",
    notice: "MIT licensed.",
    url: "https://phaser.io",
  },
  {
    id: "shells",
    group: "tools",
    title: "Tauri, Capacitor and Vite",
    shownIn: "The desktop, phone and web builds",
    credit: "Tauri (MIT or Apache-2.0), Capacitor by Ionic (MIT), Vite (MIT).",
    notice: "Open source under their own licenses.",
  },
  {
    id: "fonts",
    group: "tools",
    title: "Fonts",
    shownIn: "Headings, body and numbers",
    credit:
      "Bangers by Vernon Adams, IBM Plex Mono by IBM, Public Sans by the U.S. Web Design System, all via Fontsource.",
    notice: "SIL Open Font License 1.1.",
  },
];

export const creditGaps = (): readonly CreditEntry[] => CREDITS.filter((entry) => entry.gap);
