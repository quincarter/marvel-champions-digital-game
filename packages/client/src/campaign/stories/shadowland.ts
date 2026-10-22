/**
 * Shadowland (MC65) told as three issues, one per scenario. Original flavor copy for this app, paraphrasing the
 * insert's own story paragraphs (MC65 pp. 7, 11 and 16). No rule lives here (see `../story.ts`): the campaign's
 * Creeping Corruption, recorded cards and removed villains all come from `packages/cards/src/campaigns/shadowland.ts`
 * and the run's own log.
 *
 * **Art (follow-up):** the insert has no comic page. Owner-supplied pictures wait in
 * `art/scenarios/_pending/shadowland/` (five story panels and six lettered pages of Marvel's 2010 Shadowland event);
 * they are not wired yet, so the openers use "Panel art" notes and the box has no `pages`. The pack is a scenario
 * pack with no heroes of its own, so no beat is written for a particular hero and every line is narration.
 */
import type { CampaignStory, IssueStory } from "../story.js";

const issue = (
  fields: Omit<IssueStory, "opener" | "briefing" | "aftermath" | "aftermathArt"> & {
    readonly art: string;
    readonly caption: string;
    readonly briefing: string;
    readonly aftermath: string;
  },
): IssueStory => {
  const { art, caption, briefing, aftermath, ...rest } = fields;
  return {
    ...rest,
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
  issues: [
    issue({
      nodeId: "shadows-in-the-night",
      title: "Shadows in the Night",
      villain: "Dark Protégé",
      blurb: "A fortress of ninjas looms over Hell's Kitchen, and a figure on its roof is giving the orders.",
      recap: "The silhouette on the tenshu is down, but the corruption has already taken root in you.",
      teaser: "Someone is shouting commands from the top of the tower. Go and meet them.",
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
