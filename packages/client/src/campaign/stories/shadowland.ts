/**
 * Shadowland (MC65) told as three issues, one per scenario. Original flavor copy for this app, paraphrasing the
 * insert's own story paragraphs (MC65 pp. 7, 11 and 16). No rule lives here (see `../story.ts`): the campaign's
 * Creeping Corruption, recorded cards and removed villains all come from `packages/cards/src/campaigns/shadowland.ts`
 * and the run's own log.
 *
 * **Art:** the insert has no comic page, so the box is told through the owner-supplied pictures in
 * `art/campaigns/shadowland/` (SOURCE.md there): five Hall of Heroes panels open the issues as artboard pages
 * (`ComicPage.artboard`, one wide and one phone framing each), and six lettered pages of Marvel's 2010 _Shadowland_
 * event are the Aftermath's read between issues, in the order the owner shared them (two, two, two). Every comic page
 * carries the series credit (`ComicPage.credit`, comic pages only: the five panels are Marvel Champions art), which the readers print on screen. The comic pages' panel rectangles
 * were measured by eye against each file's own pixels, as MojoMania's were. The pack is a scenario pack with no heroes
 * of its own, so no beat is written for a particular hero and every line is narration.
 */
import type { CampaignStory, ComicBeat, ComicBeatRef, ComicPage, IssueStory } from "../story.js";
import { beatsOn, wholePage } from "../comic-beats.js";
import { SHADOWLAND_COMIC_CREDIT } from "../../progression/shadowland-extras.js";

/** Printed under the page counter wherever a Shadowland picture is read. */
const CREDIT = SHADOWLAND_COMIC_CREDIT;

/**
 * A 700x500 panel (Marvel Champions: Shadowland art, so no `credit`: no other box's FFG art prints one) as the wide beat (2.04:1 reading area, middle band) and the phone beat (0.574:1, middle strip). */
const panelPage = (file: string, note: string, caption: string, focusX = 350): ComicPage => ({
  file,
  width: 700,
  height: 500,
  artboard: true,
  note,
  beats: [
    { panel: { x: 0, y: 80, w: 700, h: 343 }, caption, lines: [], wideOnly: true },
    {
      panel: { x: Math.max(0, Math.min(700 - 288, focusX - 144)), y: 0, w: 288, h: 500 },
      caption,
      lines: [],
      narrowOnly: true,
    },
  ],
});

/** A lettered comic page: one wide and one phone beat per panel rectangle (x, y, w, h in the file's pixels). */
const letteredPage = (
  file: string,
  width: number,
  height: number,
  panels: readonly (readonly [number, number, number, number])[],
): ComicPage => {
  const beats: readonly ComicBeat[] = [
    ...panels.flatMap(([x, y, w, h]) => beatsOn(width, height)(x, y, w, h)),
    wholePage(width, height),
  ];
  return { file, width, height, lettered: true, credit: CREDIT, beats };
};

const PAGES: readonly ComicPage[] = [
  panelPage(
    "shadowland-daredevil",
    "Daredevil in black amid Hand ninjas, a moonlit tower behind him",
    "The Hand has built Shadowland in Hell's Kitchen, and a moonlit figure atop the tenshu commands its ninjas.",
  ),
  panelPage(
    "hand-ninja",
    "A masked ninja with sai in purple smoke",
    "Ninjas ring the fortress. Each one is a blade that has not been drawn yet.",
  ),
  panelPage(
    "dojo",
    "A dim corridor with a great gear",
    "Inside, the corridors shift without warning. Something strikes from the dark and is gone.",
  ),
  panelPage(
    "daredevil-flame",
    "Daredevil wrapped in pink flame",
    "The corruption works on whoever it can reach, and none of them are safe.",
    300,
  ),
  panelPage(
    "throne",
    "A hooded figure on a stone throne, purple energy",
    "In the final chamber the Hand's leader casts a ritual that will spread like the roots of a black flower.",
  ),
  letteredPage("01-iron-fist", 982, 1521, [
    [40, 0, 942, 260],
    [35, 275, 947, 275],
    [35, 565, 947, 335],
    [30, 920, 952, 600],
  ]),
  letteredPage("02-spider-man", 1280, 1984, [
    [50, 40, 420, 375],
    [487, 40, 750, 375],
    [50, 430, 1185, 590],
    [50, 1035, 1185, 360],
    [50, 1420, 610, 545],
    [680, 1420, 555, 545],
  ]),
  letteredPage("03-radar-sense", 1280, 1989, [
    [35, 35, 1210, 725],
    [35, 775, 1210, 465],
    [35, 1255, 515, 720],
    [550, 1255, 730, 720],
  ]),
  letteredPage("04-all-who-dare", 900, 1366, [
    [45, 45, 805, 775],
    [45, 830, 805, 200],
    [45, 1040, 805, 280],
  ]),
  letteredPage("05-wakey-wakey", 1016, 1600, [
    [20, 40, 970, 610],
    [20, 655, 970, 200],
    [20, 885, 680, 700],
    [705, 890, 290, 700],
  ]),
  letteredPage("06-end-your-suffering", 1260, 2000, [
    [25, 40, 695, 480],
    [740, 40, 510, 480],
    [25, 535, 1230, 680],
    [25, 1235, 515, 725],
    [555, 1235, 430, 725],
    [1000, 1235, 255, 725],
  ]),
];

/** Every beat of a page, in order. */
const readPage = (file: string): readonly ComicBeatRef[] => {
  const page = PAGES.find((candidate) => candidate.file === file)!;
  return page.beats.map((_, beatIndex) => ({ page: file, beatIndex }));
};
const read = (...files: string[]): readonly ComicBeatRef[] => files.flatMap(readPage);

const issue = (
  fields: Omit<IssueStory, "opener" | "briefing" | "aftermath" | "aftermathArt" | "comicBeats" | "aftermathBeats"> & {
    /** Page files read as the opener, and then as the Aftermath after a win. */
    readonly opens: readonly string[];
    readonly then: readonly string[];
    readonly art: string;
    readonly caption: string;
    readonly briefing: string;
    readonly aftermath: string;
  },
): IssueStory => {
  const { art, caption, briefing, aftermath, opens: _opens, then: _then, ...rest } = fields;
  return {
    ...rest,
    comicBeats: read(...fields.opens),
    aftermathBeats: read(...fields.then),
    opener: [{ art: { kind: "note", text: art }, caption, lines: [] }],
    briefing: { speaker: { kind: "narrator" }, text: briefing, fallback: briefing },
    aftermath: { speaker: { kind: "narrator" }, text: aftermath },
    aftermathArt: { kind: "villain" },
  };
};

export const SHADOWLAND_STORY: CampaignStory = {
  campaignId: "shadowland",
  tagline: "A story in three issues",
  blurb:
    "The Hand has raised a fortress in the middle of Hell's Kitchen. Fight through its streets, its trap-filled halls and its heart, while a creeping corruption works on your resolve.",
  rosterBanner:
    "Each hero keeps one identity for the whole campaign, and the corruption each of you carries follows you from issue to issue.",
  // The box ships no heroes, so the roster pre-fills two from its own cycle (Fear No Evil, same unlock gate): Luke Cage, of
  // the Shadowland story's street-level cast, and Jessica Jones. Not Daredevil or Elektra: as an identity either removes
  // that Dark Protégé villain from the campaign (MC65 p. 9), which a default should not do on its own.
  castIdentityIds: ["62001a", "61001a"],
  rosterNote: "Shadowland ships no heroes of its own: bring any hero.",
  pages: PAGES,
  issues: [
    issue({
      nodeId: "shadows-in-the-night",
      title: "Shadows in the Night",
      villain: "Dark Protégé",
      blurb: "A fortress of ninjas looms over Hell's Kitchen, and a figure on its roof is giving the orders.",
      recap: "The silhouette on the tenshu is down, but the corruption has already taken root in you.",
      teaser: "Someone is shouting commands from the top of the tower. Go and meet them.",
      opens: ["shadowland-daredevil", "hand-ninja"],
      then: ["01-iron-fist", "02-spider-man"],
      art: "Daredevil in black amid Hand ninjas, a moonlit tower behind him",
      caption:
        "The Hand has built Shadowland in Hell's Kitchen, and a moonlit figure atop the tenshu commands its ninjas.",
      stageLines: { 2: "The Hand's protégé leaps down from the tower to meet you in the streets." },
      briefing:
        "Ninjas ring the fortress. The one giving orders from the tenshu is coming down to the streets to fight.",
      aftermath: "One protégé is defeated and will not return to this campaign. The corruption stays.",
      rewindTaunt: "The Hand has all night.",
    }),
    issue({
      nodeId: "shadow-labyrinth",
      title: "Shadow Labyrinth",
      villain: "Dark Protégé",
      blurb: "The compound is a shifting maze of dead ends, tripwires and poison darts.",
      recap: "You came through the maze, and whatever struck from the shadows has faded away.",
      teaser: "The walls are moving. Find the way through before the maze finds you.",
      opens: ["dojo", "daredevil-flame"],
      then: ["03-radar-sense", "04-all-who-dare"],
      art: "A dim corridor of shifting walls, tripwires and poison darts",
      caption: "Inside, the corridors shift without warning. Something strikes from the dark and is gone.",
      stageLines: { 2: "The walls lurch and the path closes behind you." },
      briefing: "There is no map: the walls shift, the traps are everywhere and someone is watching from the dark.",
      aftermath: "The labyrinth is behind you. Another protégé is gone, and the heart of the fortress is ahead.",
      rewindTaunt: "The maze rearranges itself and begins again.",
    }),
    issue({
      nodeId: "heart-of-shadow",
      title: "Heart of Shadow",
      villain: "Krahllak",
      blurb: "At the center of Shadowland, the Hand's master of dark magic is spreading a ritual across the city.",
      recap: "The ritual is broken, and the black flower withers in New York.",
      teaser: "The final chamber. The ritual is already turning on you.",
      opens: ["throne"],
      then: ["05-wakey-wakey", "06-end-your-suffering"],
      art: "A hooded figure on a stone throne, purple energy rising around it",
      caption:
        "In the final chamber the Hand's leader casts a ritual that will spread like the roots of a black flower.",
      stageLines: { 2: "The ritual turns on you, and the corruption surges." },
      briefing: "Krahllak aims his ritual at you. The corruption you carry is the weapon he is using.",
      aftermath: "The ritual is ended and the corruption loosens its grip. Shadowland is finished.",
      rewindTaunt: "Krahllak's ritual closes over you.",
    }),
  ],
  campaignLost: {
    headline: "The Hand\nWins.",
    line: "A lost game costs nothing in this campaign: reset the scenario and try again.",
  },
  finale: {
    caption: "Shadowland falls",
    headline: "Shadowland\nFalls.",
    sfx: "KRA-KOOM!",
    villainLine: "The black flower will bloom again.",
    heroLines: ["The Hand built a fortress on a neighborhood. The neighborhood took it back."],
  },
};
