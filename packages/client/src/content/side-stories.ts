/**
 * Side stories: short comics apart from the campaign issues, each earned in the Trophy Room and read from the Extras
 * screen's Side Stories shelf (`progression/extras.ts`) in the side-story reader (`scenes/side-story-reader.ts`).
 * The pages are `art/side-stories/<id>/` (`art/side-stories-art.ts`); this table says what each story is called,
 * what opens it, whose work it is, and how its pages read.
 *
 * The pages are Marvel's own printed pages, lettering and all, so every page is `lettered`: the reader draws no
 * captions or bubbles of its own and fits each beat's panel whole into the frame. Each page reads panel by panel in
 * the page's own order (its tiers, left to right) and ends on the whole page. Panel rectangles are measured against
 * each file's own pixels: the white gutters of pages 11 and 16 by a script over the image, the bled panels of page 6
 * and the single splash of page 17 by eye, widened to take in each panel's balloons.
 */
import type { ComicBeat, ComicPage } from "../campaign/story.js";

export interface SideStory {
  /** The folder under `art/side-stories/`. */
  readonly id: string;
  readonly title: string;
  /** The small line under the title on the shelf. */
  readonly subtitle: string;
  /** The Trophy Room achievement (`progression/achievements.ts`) that opens it. */
  readonly achievementId: string;
  /** One line of credit, shown in the reader's header; `content/credits.ts` carries the full entry. */
  readonly credit: string;
  /** In reading order. Each page's `file` is its file name in the story's folder, without the extension. */
  readonly pages: readonly ComicPage[];
}

type Rect = ComicBeat["panel"];

/** A page read panel by panel, then whole. */
function letteredPage(file: string, width: number, height: number, panels: readonly Rect[]): ComicPage {
  return {
    file,
    width,
    height,
    lettered: true,
    beats: [...panels, { x: 0, y: 0, w: width, h: height }].map((panel) => ({ panel, lines: [] })),
  };
}

/** Two columns by three tiers, read left to right, top to bottom: pages 11 and 16 share the grid. */
function sixPanelGrid(rows: readonly (readonly [number, number])[], columns: readonly (readonly [number, number])[]) {
  return rows.flatMap(([y0, y1]) => columns.map(([x0, x1]) => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })));
}

export const SIDE_STORIES: readonly SideStory[] = [
  {
    id: "thor-she-hulk-badlands-date",
    title: "Worthy of a Second Date?",
    subtitle: "Thor and She-Hulk · Avengers (2018) #11",
    achievementId: "worthy-of-a-second-date",
    credit: "Avengers (2018) #11 · Jason Aaron, Cory Smith, Ed McGuinness, Karl Kesel · © Marvel",
    pages: [
      letteredPage("page-06", 1987, 3056, [
        // Jennifer and her mead, the inset at the top left.
        { x: 0, y: 0, w: 540, h: 1060 },
        // Thor's turkey leg and "Is this where you bring all the girls…?", the rest of the top tier.
        { x: 540, y: 55, w: 1447, h: 1045 },
        // The battle dragons, with the silhouettes' balloons.
        { x: 0, y: 1100, w: 1987, h: 760 },
        // Mead for the dragons: the bottom tier and its balloons.
        { x: 0, y: 1770, w: 1987, h: 1286 },
      ]),
      letteredPage(
        "page-11",
        1987,
        3056,
        sixPanelGrid(
          [
            [127, 1023],
            [1048, 1943],
            [1970, 2930],
          ],
          [
            [58, 983],
            [1002, 1929],
          ],
        ),
      ),
      letteredPage(
        "page-16",
        1987,
        3056,
        sixPanelGrid(
          [
            [140, 1105],
            [1131, 2020],
            [2047, 2927],
          ],
          [
            [60, 985],
            [1011, 1930],
          ],
        ),
      ),
      // One splash with no lettering: the dragons and the kiss, then the whole picture.
      letteredPage("page-17", 1292, 2615, [{ x: 0, y: 0, w: 1292, h: 1180 }]),
    ],
  },
];

/** A side story by id, or null. */
export function sideStoryFor(id: string): SideStory | null {
  return SIDE_STORIES.find((story) => story.id === id) ?? null;
}
