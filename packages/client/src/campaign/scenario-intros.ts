/**
 * Intros for one-off scenarios: a single picture read beat by beat before the deal, the way a campaign issue opens
 * on its comic page. A scenario with no campaign of its own gets the same "here's the fight" moment without a run
 * behind it.
 *
 * Two sources for that picture (`ScenarioIntroArt`):
 * - `{ kind: "scenario" }` — a one-off artboard drawn for this scenario (`art/scenarios/<scenarioId>/intro.<ext>`,
 *   `art/scenario-art.ts`'s `introArtFor`), lettered by the comic reader itself (Rhino).
 * - `{ kind: "rulebook", campaignId, page }` — the box's own official rulebook comic page
 *   (`art/campaigns/<campaignId>/rulebook/page_NNN.jpg`, `art/campaign-art.ts`'s `campaignRulebookPageFor`),
 *   already lettered (captions and speech balloons are printed into it), so its beats carry no lines of our own —
 *   camera pans/zooms over the box's own page instead of new art (docs/phase7-wave5-handoff.md "Scenario intros
 *   from the rulebook art"). `rulebookIntro` below is `RULEBOOK_CAMPAIGN_IDS`' own builder for this.
 *
 * **Flavor only**, like `story.ts`: nothing here is a rule, and a scenario with no intro (or no art for it) simply
 * goes straight to the deal. Hero lines use `StoryLine.fallback` the same way campaign lines do, so a table without
 * that hero still gets the beat as narration.
 */
import type { ComicPage, StorySpeaker } from "./story.js";

export type ScenarioIntroArt =
  | { readonly kind: "scenario" }
  | { readonly kind: "rulebook"; readonly campaignId: string; readonly page: number };

export interface ScenarioIntro {
  /** `Scenario.id`. */
  readonly scenarioId: string;
  /** The header's billing ("Rhino"). */
  readonly title: string;
  /** Where the picture itself comes from — see `ScenarioIntroArt` above. */
  readonly art: ScenarioIntroArt;
  /**
   * The picture as a one-page comic. `file` is informational (the picture comes from `art` above, not this field);
   * `width`/`height` are the image's own pixels, which every beat's `panel` is measured against.
   */
  readonly page: ComicPage;
}

const SPIDER_MAN: StorySpeaker = { kind: "hero", identityId: "01001a", name: "Spider-Man (Peter Parker)" };
const RHINO: StorySpeaker = { kind: "npc", name: "Rhino" };

const RHINO_INTRO: ScenarioIntro = {
  scenarioId: "rhino",
  title: "Rhino",
  art: { kind: "scenario" },
  page: {
    file: "intro",
    width: 1600,
    height: 1069,
    // Guided: the reader pans and zooms from one crop to the next — Spider-Man, then Rhino, then the whole board.
    lettered: true,
    beats: [
      {
        panel: { x: 100, y: 50, w: 800, h: 660 },
        caption: "Midtown. Lunch hour. Something big is coming up the avenue — fast.",
        lines: [
          {
            speaker: SPIDER_MAN,
            text: "Is that a garbage truck? Please be a garbage truck. Please be a…",
            fallback: "A hero turns toward the rumble just as the cars start flying.",
            // Right of him, past the panel's edge into the gutter, its tail on the top of his head.
            placement: { bubble: { x: 960, y: 200 }, speaker: { x: 675, y: 322 } },
          },
        ],
      },
      {
        panel: { x: 610, y: 60, w: 840, h: 700 },
        sfx: "THOOM! THOOM!",
        lines: [
          {
            speaker: RHINO,
            text: "OUTTA MY WAY! NOBODY STOPS THE RHINO!",
            // In the strip of sky above his back, right of the horn, its tail on his helmet.
            placement: { bubble: { x: 1100, y: 100 }, speaker: { x: 975, y: 330 } },
          },
        ],
      },
      {
        panel: { x: 0, y: 0, w: 1600, h: 1069 },
        lines: [
          {
            speaker: SPIDER_MAN,
            text: "Nope. Not a truck. Okay, big guy — let's find out if that horn's as thick as your head.",
            fallback: "One very large Rhino. No brakes. Someone has to stop him.",
            // Over the buildings top-left, its tail on the top of Spider-Man's head.
            placement: { bubble: { x: 230, y: 120 }, speaker: { x: 662, y: 318 } },
          },
        ],
      },
    ],
  },
};

/**
 * A one-off intro built from the box's own official rulebook page: two beats over the same 1800×1800 square every
 * `extract-artboards` render is (a closer crop, then the whole page) rather than hand-placed panels, since the
 * page's own printed lettering is the story already — no captions/lines of ours to place beat by beat.
 * `campaignId`/`page` must resolve through `campaignRulebookPageFor` (`art/campaign-art.ts`) or the scene shows
 * nothing; `scenarioIntroFor`'s own pool test below guards that.
 */
function rulebookIntro(scenarioId: string, title: string, campaignId: string, page: number): ScenarioIntro {
  return {
    scenarioId,
    title,
    art: { kind: "rulebook", campaignId, page },
    page: {
      file: `${campaignId}/page_${String(page).padStart(3, "0")}`,
      width: 1800,
      height: 1800,
      lettered: true,
      beats: [
        { panel: { x: 300, y: 150, w: 1200, h: 1200 }, lines: [] },
        { panel: { x: 0, y: 0, w: 1800, h: 1800 }, lines: [] },
      ],
    },
  };
}

/**
 * Sinister Motives, The Galaxy's Most Wanted, The Mad Titan's Shadow and The Rise of Red Skull each reuse the page
 * right before their scenario's own Setup instructions begin in the box's rulebook (the printed page that reveals
 * that scenario's villain), per docs/phase7-wave5-handoff.md "Scenario intros from the rulebook art". Ronan the
 * Accuser's own page (17) fell outside what `extract-artboards` captured for GMW, so it's omitted here and falls
 * back to no intro, same as any scenario with none.
 */
const RULEBOOK_INTROS: readonly ScenarioIntro[] = [
  rulebookIntro("sandman", "Sandman", "sm", 8),
  rulebookIntro("venom", "Venom", "sm", 10),
  rulebookIntro("mysterio", "Mysterio", "sm", 12),
  rulebookIntro("sinister-six", "The Sinister Six", "sm", 14),
  rulebookIntro("venom-goblin", "Venom Goblin", "sm", 16),
  rulebookIntro("brotherhood-of-badoon", "Brotherhood of Badoon", "gmw", 7),
  rulebookIntro("infiltrate-the-museum", "Infiltrate the Museum", "gmw", 9),
  rulebookIntro("escape-the-museum", "Escape the Museum", "gmw", 11),
  rulebookIntro("nebula", "Nebula", "gmw", 13),
  rulebookIntro("ebony-maw", "Ebony Maw", "mts", 5),
  rulebookIntro("tower-defense", "Tower Defense", "mts", 9),
  rulebookIntro("thanos", "Thanos", "mts", 15),
  rulebookIntro("hela", "Hela", "mts", 19),
  rulebookIntro("loki", "Loki", "mts", 23),
  rulebookIntro("crossbones", "Crossbones", "trors", 4),
  rulebookIntro("absorbing-man", "Absorbing Man", "trors", 6),
  rulebookIntro("taskmaster", "Taskmaster", "trors", 9),
  rulebookIntro("zola", "Zola", "trors", 11),
  rulebookIntro("red-skull", "Red Skull", "trors", 14),
];

const INTROS: readonly ScenarioIntro[] = [RHINO_INTRO, ...RULEBOOK_INTROS];

/** The intro for a scenario, or null when it has none. */
export function scenarioIntroFor(scenarioId: string): ScenarioIntro | null {
  return INTROS.find((intro) => intro.scenarioId === scenarioId) ?? null;
}
