/**
 * The catalog of mechanic "Try it" lessons (guided mode §3.14: a hero-defining mechanic gets a short scripted
 * situation the player acts in), one row per lesson, in the order a box's page lists them. Each lesson has its own
 * stacked config (`guide/mechanic-tryit-config.ts`) and lesson data (`guide/mechanic-lessons.ts`); this file is only
 * what the "New in this box" pages need to show a row and to know where it belongs.
 *
 * A mechanic lesson is "done" the way an aspect lesson is: its id is added to `GuidePrefs.aspectLessonsDone` under
 * `mechanicLessonDoneKey`, so nothing about the saved prefs changes shape.
 */
import type { GlossaryBoxId } from "@mc/content";

/** Grows with each lesson built (guided mode §3.14); `mechanic-lessons.ts` and `mechanic-tryit-config.ts` are keyed by it. */
export type MechanicTryItId =
  | "storm"
  | "phoenix"
  | "shadowcat"
  | "gambit"
  | "rogue"
  | "colossus"
  | "psylocke"
  | "angel"
  | "cable"
  | "x23"
  | "iceman"
  | "magik"
  | "magneto"
  | "jubilee"
  | "bishop"
  | "nightcrawler";

export interface MechanicTryIt {
  readonly id: MechanicTryItId;
  /** The box page this lesson is listed on. */
  readonly box: GlossaryBoxId;
  /** The row's title, e.g. "Storm: the Weather deck". */
  readonly title: string;
  /** One line under the title. */
  readonly tagline: string;
}

/** Every lesson built so far, in listing order. */
export const MECHANIC_TRYITS: readonly MechanicTryIt[] = [
  {
    id: "storm",
    box: "cycle6",
    title: "Storm: the Weather deck",
    tagline: "Swap the Weather in play, then use its Special.",
  },
  {
    id: "phoenix",
    box: "cycle6",
    title: "Phoenix: Restrained and Unleashed",
    tagline: "Spend power counters until Phoenix Force flips.",
  },
  {
    id: "shadowcat",
    box: "cycle6",
    title: "Shadowcat: Solid and Phased",
    tagline: "Phase through a hit, then watch the mass form flip back.",
  },
  {
    id: "gambit",
    box: "cycle6",
    title: "Gambit: charge counters",
    tagline: "Build charge counters, then spend them on an attack.",
  },
  {
    id: "rogue",
    box: "cycle6",
    title: "Rogue: Touched",
    tagline: "Attach Touched to Rhino and see what the host gives her.",
  },
  {
    id: "colossus",
    box: "cycle6",
    title: "Colossus: two tough cards",
    tagline: "Hold two tough cards, then turn them into resources.",
  },
  {
    id: "psylocke",
    box: "cycle7",
    title: "Psylocke: Psi-Knife and Psi-Katana",
    tagline: "Attack, then flip a blade to its Katana side.",
  },
  {
    id: "angel",
    box: "cycle7",
    title: "Angel: three faces",
    tagline: "Pick Archangel, then change to Angel next round.",
  },
  {
    id: "cable",
    box: "cycle7",
    title: "Cable: player side schemes",
    tagline: "Thwart one, then play a second at the limit.",
  },
  {
    id: "x23",
    box: "cycle7",
    title: "X-23: Specialists",
    tagline: "Defeat Specialized Training and take a Specialist.",
  },
  {
    id: "bishop",
    box: "cycle8",
    title: "Bishop: Energy Absorption",
    tagline: "Take a hit, and your deck feeds your hand.",
  },
  {
    id: "magik",
    box: "cycle8",
    title: "Magik: the faceup top card",
    tagline: "Play Limbo, then choose which card shows on top.",
  },
  {
    id: "iceman",
    box: "cycle8",
    title: "Iceman: Frostbite",
    tagline: 'Attack, accept "Freeze!", and watch Frostbite attach.',
  },
  {
    id: "jubilee",
    box: "cycle8",
    title: "Jubilee: different resource types",
    tagline: "Pay for Firecracker with two types and stun Rhino.",
  },
  {
    id: "nightcrawler",
    box: "cycle8",
    title: "Nightcrawler: Bamf!",
    tagline: "Attach Bamf! to Rhino, then teleport in to defend.",
  },
  {
    id: "magneto",
    box: "cycle8",
    title: "Magneto: Magnetic Pull",
    tagline: "Discard until a MAGNETIC card and add it to your hand.",
  },
];

/** The key a finished mechanic lesson is stored under in `GuidePrefs.aspectLessonsDone`. */
export const mechanicLessonDoneKey = (id: MechanicTryItId): string => `mechanic:${id}`;
