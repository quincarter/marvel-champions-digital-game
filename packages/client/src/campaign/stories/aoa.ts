/**
 * Age of Apocalypse (MC45) told through its own eight lettered rulebook comic pages. Like Mutant Genesis
 * (`./mut_gen.ts`) and The Rise of Red Skull, the box's official pages are the story: captions and speech balloons are
 * printed into the art, so the eight pages are copied byte-for-byte from `art/campaigns/aoa/rulebook/page_NNN.jpg`
 * into `art/campaigns/aoa/pages/NN-<slug>.jpg` (the folder the comic reader reads) and every `ComicPage` below is
 * `lettered: true`: no beat carries a line of ours, so nothing is lettered over printed balloons. The `rulebook/`
 * folder stays the source of record (`art/README.md`). Everything else in this file (blurbs, briefings, taunts, the
 * finale's copy, the plain-words call copy) is original flavor for this app; no rule lives here (see `../story.ts`).
 *
 * **Cast:** Bishop (`45001a`) and Magik (`45030a`) ship in this box, so their lines are written for them; every other
 * hero shows the narrator `fallback` instead.
 *
 * **Page → issue mapping** (rulebook page → file → where it plays): p. 7 `01-institute` is the page right before
 * Scenario 1's Setup (Unus); p. 9 `02-infinites` is Unus's aftermath (the Infinites, the rescue and the Resistance);
 * p. 10 `03-horsemen` is the opener of Scenario 2 (Four Horsemen); p. 13 `04-citadel` is Scenario 2's aftermath (the
 * Horsemen are down) and the opener of Scenario 3 (Apocalypse); p. 15 `05-dark-beast` opens Scenario 4 (Dark Beast)
 * and its first panel is Apocalypse's aftermath; p. 17 `06-cairo` and p. 18 `07-pyramid` open Scenario 5
 * (En Sabah Nur), the first panel of p. 17 doubling as Dark Beast's aftermath; p. 21 `08-home` is the finale's spread.
 *
 * **Panel rectangles** are measured by eye against each page's own 1800×1800 pixels, one rectangle per printed
 * panel in the rulebook's reading order (tiers top to bottom, left to right); bled panels (a full-width bottom
 * spread, a close-up spilling past its frame) are boxed to the panel they belong to.
 *
 * **Plain-words calls.** The between-games and in-game choices this box raises are worded here once
 * (`setupCalls`, `aftermathCalls`) so no prompt shows only the rulebook's sentence. A reward counts as one of the deck's
 * cards (owner Q25), which is why each note says so.
 */
import type { AftermathCallCopy, CampaignStory, ComicPage, SetupCallCopy, StorySpeaker } from "../story.js";

const BISHOP: StorySpeaker = { kind: "hero", identityId: "45001a", name: "Bishop" };
const MAGIK: StorySpeaker = { kind: "hero", identityId: "45030a", name: "Magik" };

const page = (file: string, panels: readonly { x: number; y: number; w: number; h: number }[]): ComicPage => ({
  file,
  width: 1800,
  height: 1800,
  lettered: true,
  beats: panels.map((panel) => ({ panel, lines: [] })),
});

const PAGES: readonly ComicPage[] = [
  page("01-institute", [
    { x: 52, y: 52, w: 1693, h: 470 },
    { x: 78, y: 528, w: 482, h: 652 },
    { x: 585, y: 552, w: 556, h: 652 },
    { x: 1170, y: 552, w: 578, h: 720 },
    { x: 58, y: 1225, w: 1688, h: 505 },
  ]),
  page("02-infinites", [
    { x: 52, y: 45, w: 1693, h: 375 },
    { x: 52, y: 438, w: 390, h: 590 },
    { x: 475, y: 460, w: 445, h: 565 },
    { x: 945, y: 500, w: 800, h: 800 },
  ]),
  page("03-horsemen", [
    { x: 55, y: 52, w: 730, h: 810 },
    { x: 812, y: 78, w: 480, h: 805 },
    { x: 1320, y: 50, w: 425, h: 890 },
    { x: 0, y: 880, w: 1800, h: 920 },
  ]),
  page("04-citadel", [
    { x: 52, y: 52, w: 430, h: 918 },
    { x: 508, y: 52, w: 845, h: 918 },
    { x: 1362, y: 52, w: 380, h: 918 },
    { x: 0, y: 960, w: 1800, h: 840 },
  ]),
  page("05-dark-beast", [
    { x: 52, y: 52, w: 692, h: 600 },
    { x: 762, y: 52, w: 988, h: 600 },
    { x: 52, y: 672, w: 895, h: 490 },
    { x: 962, y: 672, w: 788, h: 490 },
    { x: 52, y: 1182, w: 1698, h: 540 },
  ]),
  page("06-cairo", [
    { x: 52, y: 52, w: 540, h: 1250 },
    { x: 605, y: 52, w: 445, h: 1250 },
    { x: 1058, y: 52, w: 355, h: 1250 },
    { x: 1428, y: 52, w: 320, h: 1250 },
    { x: 0, y: 1300, w: 1800, h: 500 },
  ]),
  page("07-pyramid", [
    { x: 52, y: 52, w: 450, h: 672 },
    { x: 520, y: 52, w: 485, h: 672 },
    { x: 1028, y: 48, w: 712, h: 970 },
    { x: 52, y: 920, w: 950, h: 490 },
    { x: 0, y: 1065, w: 1800, h: 735 },
  ]),
  page("08-home", [
    { x: 52, y: 40, w: 418, h: 908 },
    { x: 490, y: 40, w: 535, h: 908 },
    { x: 1038, y: 40, w: 705, h: 440 },
    { x: 1038, y: 500, w: 705, h: 448 },
    { x: 45, y: 962, w: 700, h: 490 },
    { x: 520, y: 1000, w: 1280, h: 800 },
  ]),
];

const beats = (file: string, count: number) =>
  Array.from({ length: count }, (_, beatIndex) => ({ page: file, beatIndex }));

/** Evacuate Survivors, Sabotage the Sea Wall and Find Lost Mutants hand out a card when defeated (MC45 p. 24). */
const REWARD_NOTE = "A reward is one of your deck's cards: it counts toward deck size.";
const rewardCall = (kind: "an upgrade" | "a support" | "a campaign ally", note: string): AftermathCallCopy => ({
  heading: `Take ${kind}, or none.`,
  declineLabel: "Take nothing",
  waiting: "Offered once the hero before has decided.",
  nothing: "Nothing to take.",
  note,
});
const UPGRADE_CALL = rewardCall(
  "an upgrade",
  `Pick one upgrade from any aspect. Each hero may add one copy for the rest of the campaign. ${REWARD_NOTE}`,
);
const SUPPORT_CALL = rewardCall(
  "a support",
  `Pick one support from any aspect. Each hero may add one copy for the rest of the campaign. ${REWARD_NOTE}`,
);
const ALLY_CALL = rewardCall(
  "a campaign ally",
  `One copy of each ally, so a pick is taken for the whole table. ${REWARD_NOTE}`,
);

/** The reward cells of scenarios 1 to 4: the rows that give a card when defeated. */
const rewardCalls = (): Record<string, AftermathCallCopy> =>
  Object.fromEntries(
    [1, 2, 3, 4].flatMap((n) => [
      [`mc45.s${n}.victory.evacuate.defeated`, UPGRADE_CALL],
      [`mc45.s${n}.victory.sabotage.defeated`, SUPPORT_CALL],
      [`mc45.s${n}.victory.find.defeated`, ALLY_CALL],
    ]),
  );

const HEAL: SetupCallCopy = {
  name: "Expert heal",
  explain: "Expert campaign: place 3 threat on the mission to heal your hero to full hit points, or decline.",
};
const ALLY_SEARCH: SetupCallCopy = {
  name: "Ally search",
  explain: "Search your deck for an ally and add it to your hand. It counts toward your hand size.",
};

export const AOA_STORY: CampaignStory = {
  campaignId: "aoa",
  tagline: "A story in five issues",
  blurb:
    "The heroes jumped through time to stop a killer and landed in a world where Apocalypse already won. Five scenarios, a mission and an Overseer drawn fresh for each, and a professor to save.",
  rosterBanner:
    "Each hero stays for all five scenarios. What each mission leaves behind, good or bad, rides with the whole table.",
  aftermathCalls: rewardCalls(),
  setupCalls: {
    "mc45.setup.ally-search": ALLY_SEARCH,
    "mc45.setup.ally-search.expert": {
      name: "Ally search",
      explain:
        "Expert campaign: search your deck for an ally that shares a trait with your hero and add it to your hand.",
    },
    "mc45.setup.carried.desperate-measures": {
      name: "Desperate Measures",
      explain:
        "Liberate the Seattle Core was defeated, so each hero may shuffle one Desperate Measures into their deck for this game. It counts toward deck size.",
    },
    "mc45.s2.setup.heal": HEAL,
    "mc45.s3.setup.heal": HEAL,
    "mc45.s4.setup.heal": HEAL,
    "mc45.s5.setup.heal": HEAL,
  },
  castIdentityIds: ["45001a", "45030a"],
  pages: PAGES,
  issues: [
    {
      nodeId: "unus",
      title: "Welcome to the Resistance",
      villain: "Unus",
      blurb: "The time jump went wrong. The institute is burning, and something is already hunting the heroes.",
      recap: "Unus is down and the Infinites are scattered. The Resistance has a place for the heroes.",
      teaser: "This is not the year they meant to land in. Get out of the fire.",
      opener: [],
      comicBeats: beats("01-institute", 5),
      stageLines: { 2: "Unus has never been touched, and he does not mean to start now." },
      briefing: {
        speaker: BISHOP,
        text: "Something changed the timeline. We find out what later. First we live through the next hour.",
        fallback:
          "Something changed the timeline. The heroes have to survive the next hour before they can learn what.",
      },
      aftermath: {
        speaker: MAGIK,
        text: "Hold on to me. I know a place where they cannot follow.",
      },
      aftermathBeats: beats("02-infinites", 4),
      aftermathArt: { kind: "villain" },
      rewindTaunt: "The Infinites do not stop coming. Neither does Unus.",
    },
    {
      nodeId: "four-horsemen",
      title: "The Four Horsemen",
      villain: "The Four Horsemen",
      blurb: "Magneto tells them what happened to this world, and the Horsemen arrive before he finishes.",
      recap: "The Horsemen have fallen, and word travels fast to the one who sent them.",
      teaser: "Apocalypse's best are on the way. Hold the line.",
      opener: [],
      comicBeats: beats("03-horsemen", 4),
      stageLines: { 2: "The Horsemen ride together, and each of them has a reason to be here." },
      briefing: {
        speaker: MAGIK,
        text: "Magneto says this world is Apocalypse's. His Horsemen say the same, loudly.",
        fallback: "Magneto says this world belongs to Apocalypse. His four Horsemen agree, loudly.",
      },
      aftermath: {
        speaker: BISHOP,
        text: "They are down. Apocalypse will have heard by now.",
      },
      aftermathBeats: [
        { page: "04-citadel", beatIndex: 1 },
        { page: "04-citadel", beatIndex: 2 },
      ],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "The Horsemen are in no hurry. They have all the time there is.",
    },
    {
      nodeId: "apocalypse",
      title: "The Citadel",
      villain: "Apocalypse",
      blurb: "Apocalypse knows they are coming. The heroes go to meet him at his own door.",
      recap: "Apocalypse is down. The fight is over. The mess is not.",
      teaser: "The strong survive and the weak perish. Prove which you are.",
      opener: [],
      comicBeats: beats("04-citadel", 4),
      stageLines: { 2: "Apocalypse stops testing them and starts to finish it." },
      briefing: {
        speaker: BISHOP,
        text: "He is expecting us. Good. It means he is not looking anywhere else.",
        fallback: "Apocalypse knows the heroes are coming. It means he is not looking anywhere else.",
      },
      aftermath: {
        speaker: MAGIK,
        text: "He fell, and his army did not notice. Something else is running this.",
      },
      aftermathBeats: [{ page: "05-dark-beast", beatIndex: 0 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "I have lasted since before your history began. You will not end me today.",
    },
    {
      nodeId: "dark-beast",
      title: "The Portal",
      villain: "Dark Beast",
      blurb: "A time portal could put everything right, and the man opening it has plans of his own.",
      recap: "Dark Beast is stopped. The portal is open, and nobody is sure where it ends.",
      teaser: "The way home is right there. So is the one who built it.",
      opener: [],
      comicBeats: beats("05-dark-beast", 5),
      stageLines: { 2: "Dark Beast stops pretending to help." },
      briefing: {
        speaker: MAGIK,
        text: "He said he could open the way back. I should have asked why he was smiling.",
        fallback: "Dark Beast says he can open the way back. Nobody asks why he is smiling.",
      },
      aftermath: {
        speaker: BISHOP,
        text: "The portal is open. Whatever is on the other side, we are going.",
      },
      aftermathBeats: [{ page: "06-cairo", beatIndex: 0 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "I built this machine. I will bring him back, and you will watch.",
    },
    {
      nodeId: "en-sabah-nur",
      title: "Save the Professor",
      villain: "En Sabah Nur",
      blurb: "Cairo, years ago, and a professor who has no idea what is about to happen to him.",
      recap: "The Professor is safe, the cure is in hand, and the school is still standing.",
      teaser: "It is the right place and the right time. Do not be late again.",
      opener: [],
      comicBeats: [...beats("06-cairo", 5), ...beats("07-pyramid", 5)],
      stageLines: { 2: "The man in the pyramid has been waiting for this a very long time." },
      briefing: {
        speaker: BISHOP,
        text: "One chance. Protect the Professor, and the rest of this unwinds.",
        fallback: "The heroes have one chance. Protect the Professor, and the rest of this unwinds.",
      },
      aftermath: {
        speaker: MAGIK,
        text: "He is safe. Take us home.",
      },
      aftermathArt: { kind: "villain" },
      rewindTaunt: "You thought yourself the strongest. Come, show me again.",
    },
  ],
  campaignLost: {
    headline: "Apocalypse\nStands.",
    line: "The Professor was lost, and the world the heroes landed in stays the world they leave behind. This run of the campaign is over.",
  },
  finale: {
    caption: "Sometime later, the gates of the institute open once more.",
    headline: "Welcome home.",
    sfx: "THWOOM!",
    villainLine: "Not like this. I must escape and fight again...",
    heroLines: ["We have the cure. Let us get it to the Professor.", "Home. Finally."],
    page: "08-home",
    comicBeats: beats("08-home", 6),
    stats: [{ kind: "rewinds", label: "Rewinds" }],
    crewLines: [
      {
        speaker: BISHOP,
        text: "We have the cure. Let us get it to the Professor.",
        fallback: "We have the cure. Let us get it to the Professor.",
      },
      { speaker: MAGIK, text: "Home. Finally.", fallback: "Home. Finally." },
    ],
  },
};
