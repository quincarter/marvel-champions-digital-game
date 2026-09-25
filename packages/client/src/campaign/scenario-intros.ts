/**
 * Intros for one-off scenarios: a single artboard (`art/scenarios/<scenarioId>/intro.<ext>`) read beat by beat
 * before the deal, the way a campaign issue opens on its comic page. A scenario with no campaign of its own gets
 * the same "here's the fight" moment without a run behind it.
 *
 * **Flavor only**, like `story.ts`: nothing here is a rule, and a scenario with no intro (or no art for it) simply
 * goes straight to the deal. Hero lines use `StoryLine.fallback` the same way campaign lines do, so a table without
 * that hero still gets the beat as narration.
 */
import type { ComicPage, StorySpeaker } from "./story.js";

export interface ScenarioIntro {
  /** `Scenario.id`. */
  readonly scenarioId: string;
  /** The header's billing ("Rhino"). */
  readonly title: string;
  /**
   * The artboard as a one-page comic. `file` is informational (the picture is `art/scenarios/<id>/intro.*`);
   * `width`/`height` are the image's own pixels, which every beat's `panel` is measured against.
   */
  readonly page: ComicPage;
}

const SPIDER_MAN: StorySpeaker = { kind: "hero", identityId: "01001a", name: "Spider-Man" };
const RHINO: StorySpeaker = { kind: "npc", name: "Rhino" };

const RHINO_INTRO: ScenarioIntro = {
  scenarioId: "rhino",
  title: "Rhino",
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

const INTROS: readonly ScenarioIntro[] = [RHINO_INTRO];

/** The intro for a scenario, or null when it has none. */
export function scenarioIntroFor(scenarioId: string): ScenarioIntro | null {
  return INTROS.find((intro) => intro.scenarioId === scenarioId) ?? null;
}
