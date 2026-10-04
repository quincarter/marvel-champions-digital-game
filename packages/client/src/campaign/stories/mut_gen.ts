/**
 * Mutant Genesis (MC32) told through its own eight lettered rulebook comic pages. Like The Rise of Red Skull
 * (`./trors.ts`), the box's official pages are the story: captions and speech balloons are printed into the art, so
 * the eight pages are copied byte-for-byte from `art/campaigns/mut_gen/rulebook/page_NNN.jpg` into
 * `art/campaigns/mut_gen/pages/NN-<slug>.jpg` (the folder the comic reader reads) and every `ComicPage` below is
 * `lettered: true` — no beat carries a line of ours, so nothing is lettered over printed balloons. The `rulebook/`
 * folder stays the source of record (`art/README.md`). Everything else in this file (blurbs, briefings, taunts,
 * the finale's copy) is original flavor for this app; no rule lives here (see `../story.ts`).
 *
 * **Cast:** Colossus (`32001a`) and Shadowcat (`32030a`) ship in this box, so their lines are written for them;
 * every other hero shows the narrator `fallback` instead.
 *
 * **Page → issue mapping** (rulebook page → file → where it plays): p. 6 `01-washington` is the page right before
 * Scenario 1's Setup (Sabretooth); p. 8 `02-senator` before Scenario 2's (Project Wideawake); p. 11 `03-sentinels`
 * before Scenario 3's (Master Mold), p. 13 `04-gyrich` is Master Mold's own aftermath (Gyrich flees, Magneto takes
 * the Sentinel); p. 14 `05-mansion` before Scenario 4's (Mansion Attack), its last panel reused as that issue's
 * aftermath; p. 17 `06-blackbird` before Scenario 5's (Magneto); p. 20 `07-asteroid-m` is Magneto's aftermath; p. 21
 * `08-sinister` is the finale's own spread (Mister Sinister's entrance, the hook for what comes next).
 *
 * **Panel rectangles** are measured by eye against each page's own 1800×1800 pixels, one rectangle per printed
 * panel in the rulebook's reading order (tiers top to bottom, left to right); inset and bled panels (a Magneto
 * close-up spilling past its frame) are boxed to the panel they belong to.
 */
import type { CampaignStory, ComicPage, StorySpeaker } from "../story.js";

const COLOSSUS: StorySpeaker = { kind: "hero", identityId: "32001a", name: "Colossus" };
const SHADOWCAT: StorySpeaker = { kind: "hero", identityId: "32030a", name: "Shadowcat" };

const page = (file: string, panels: readonly { x: number; y: number; w: number; h: number }[]): ComicPage => ({
  file,
  width: 1800,
  height: 1800,
  lettered: true,
  beats: panels.map((panel) => ({ panel, lines: [] })),
});

const PAGES: readonly ComicPage[] = [
  page("01-washington", [
    { x: 60, y: 60, w: 1680, h: 460 },
    { x: 60, y: 535, w: 1240, h: 810 },
    { x: 1230, y: 535, w: 510, h: 810 },
    { x: 60, y: 1360, w: 1680, h: 350 },
  ]),
  page("02-senator", [
    { x: 75, y: 50, w: 880, h: 690 },
    { x: 960, y: 50, w: 790, h: 670 },
    { x: 75, y: 740, w: 950, h: 580 },
    { x: 950, y: 730, w: 800, h: 600 },
    { x: 75, y: 1320, w: 1680, h: 680 },
  ]),
  page("03-sentinels", [
    { x: 60, y: 60, w: 900, h: 1480 },
    { x: 900, y: 60, w: 840, h: 520 },
    { x: 800, y: 580, w: 940, h: 500 },
    { x: 700, y: 1080, w: 1040, h: 430 },
    { x: 60, y: 1520, w: 1680, h: 270 },
  ]),
  page("04-gyrich", [
    { x: 65, y: 60, w: 925, h: 500 },
    { x: 990, y: 60, w: 750, h: 500 },
    { x: 65, y: 560, w: 290, h: 850 },
    { x: 320, y: 560, w: 1420, h: 380 },
    { x: 350, y: 930, w: 1390, h: 490 },
    { x: 420, y: 1420, w: 1320, h: 590 },
  ]),
  page("05-mansion", [
    { x: 55, y: 60, w: 740, h: 500 },
    { x: 800, y: 60, w: 950, h: 500 },
    { x: 55, y: 560, w: 1050, h: 1180 },
    { x: 1000, y: 630, w: 750, h: 740 },
    { x: 930, y: 1350, w: 820, h: 390 },
  ]),
  page("06-blackbird", [
    { x: 60, y: 60, w: 780, h: 640 },
    { x: 845, y: 60, w: 900, h: 610 },
    { x: 60, y: 700, w: 1690, h: 490 },
    { x: 60, y: 1200, w: 740, h: 520 },
    { x: 790, y: 1200, w: 950, h: 520 },
  ]),
  page("07-asteroid-m", [
    { x: 60, y: 60, w: 470, h: 990 },
    { x: 520, y: 60, w: 1220, h: 320 },
    { x: 520, y: 380, w: 1220, h: 560 },
    { x: 60, y: 1050, w: 430, h: 690 },
    { x: 440, y: 960, w: 740, h: 780 },
    { x: 1090, y: 930, w: 650, h: 810 },
  ]),
  page("08-sinister", [
    { x: 60, y: 60, w: 1680, h: 300 },
    { x: 60, y: 370, w: 950, h: 500 },
    { x: 1000, y: 370, w: 740, h: 500 },
    { x: 60, y: 880, w: 1680, h: 260 },
    { x: 60, y: 1150, w: 1680, h: 590 },
  ]),
];

const beats = (file: string, count: number) =>
  Array.from({ length: count }, (_, beatIndex) => ({ page: file, beatIndex }));

export const MUT_GEN_STORY: CampaignStory = {
  campaignId: "mut_gen",
  tagline: "A story in five issues",
  blurb:
    "Washington wants an answer to the mutant question, and its answer is a fleet of Sentinels. The X-Men have one night to prove they are people, not a threat, and every win and loss rides forward with each hero's role.",
  rosterBanner:
    "Each hero takes a role for the whole campaign, and what you build into your deck along the way follows you issue to issue.",
  castIdentityIds: ["32001a", "32030a"],
  pages: PAGES,
  issues: [
    {
      nodeId: "sabretooth",
      title: "The Brotherhood Is Here",
      villain: "Sabretooth",
      blurb: "A senator's speech goes out live, and the Brotherhood answers it in the worst possible way.",
      recap: "Sabretooth is down and the senator is safe. He does not thank anyone.",
      teaser: "A man is about to get himself killed on live television. Get to him first.",
      opener: [],
      comicBeats: beats("01-washington", 4),
      stageLines: { 2: "Sabretooth enjoys this more the longer it goes." },
      briefing: {
        speaker: SHADOWCAT,
        text: "The senator wants us gone and Sabretooth wants him dead. We save him anyway.",
        fallback: "The senator wants the X-Men gone and Sabretooth wants him dead. The team saves him anyway.",
      },
      aftermath: {
        speaker: COLOSSUS,
        text: "He is safe. That he is angry at us is a thing for another day.",
      },
      aftermathBeats: [{ page: "02-senator", beatIndex: 0 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Sabretooth has all night and nothing else to do.",
    },
    {
      nodeId: "project-wideawake",
      title: "Deploy the Sentinels",
      villain: "Project Wideawake",
      blurb: "Gratitude would have been nice. Instead the senator makes a phone call, and the Sentinels wake up.",
      recap: "The first wave of Sentinels is scrap, and the project behind them is only getting started.",
      teaser: "The senator made a call on the way out. Something large is waking up.",
      opener: [],
      comicBeats: beats("02-senator", 5),
      stageLines: { 2: "The Sentinels do not tire, and they do not stop to ask which of you is the mutant." },
      briefing: {
        speaker: COLOSSUS,
        text: "We saved him and he called in an army. I do not understand people sometimes.",
        fallback: "The X-Men saved the senator and he called in an army of Sentinels.",
      },
      aftermath: {
        speaker: SHADOWCAT,
        text: "That was only the first wave. Whoever built them built a lot of them.",
      },
      aftermathBeats: [{ page: "03-sentinels", beatIndex: 0 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Sentinels learn from every fight. Next time they will remember this one.",
    },
    {
      nodeId: "master-mold",
      title: "The Mold",
      villain: "Master Mold",
      blurb: "The Sentinels' maker is waiting at the end of the line, and an unexpected ally is on the way.",
      recap: "Master Mold is stopped for now, and Magneto has plans of his own for it.",
      teaser: "Magneto knows where the factory is. Whether to trust him is another question.",
      opener: [],
      comicBeats: beats("03-sentinels", 5),
      stageLines: { 2: "Master Mold is the factory, the plan and the army, all at once." },
      briefing: {
        speaker: SHADOWCAT,
        text: "Magneto says he will show us the Sentinel factory. I do not like that I believe him.",
        fallback: "Magneto offers to show the X-Men the Sentinel factory. Nobody likes how much sense that makes.",
      },
      aftermath: {
        speaker: COLOSSUS,
        text: "Gyrich runs. Magneto takes the machine. We have won, and we have lost something too.",
      },
      aftermathBeats: beats("04-gyrich", 6),
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Master Mold builds a new Sentinel for every one you break.",
    },
    {
      nodeId: "mansion-attack",
      title: "Mansion Attack",
      villain: "The Brotherhood",
      blurb: "While the X-Men were off fighting someone else's war, someone came to the school.",
      recap: "The mansion is still standing, and the Brotherhood's raiders are in custody.",
      teaser: "Class is about to be interrupted. Get home.",
      opener: [],
      comicBeats: beats("05-mansion", 5),
      stageLines: { 2: "This is a home, not a battlefield. They did not ask, and neither did the Brotherhood." },
      briefing: {
        speaker: COLOSSUS,
        text: "They are attacking where the students sleep. That I will not allow.",
        fallback: "The Brotherhood is attacking the school where the students sleep. That cannot be allowed.",
      },
      aftermath: {
        speaker: SHADOWCAT,
        text: "Everyone is okay. We have prisoners and a very long to-do list.",
      },
      aftermathBeats: [{ page: "05-mansion", beatIndex: 4 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Nobody is safe at home tonight. Let the Brotherhood in again and find out.",
    },
    {
      nodeId: "magneto",
      title: "Asteroid M",
      villain: "Magneto",
      blurb: "Magneto has Master Mold and a space station. The X-Men have a jet and not much time.",
      recap: "Asteroid M is falling and Magneto with it. The X-Men get out with moments to spare.",
      teaser: "Fuel up the Blackbird. Magneto is not waiting.",
      opener: [],
      comicBeats: beats("06-blackbird", 5),
      stageLines: { 2: "Magneto stops holding back. Metal bends for him, and so do the walls." },
      briefing: {
        speaker: SHADOWCAT,
        text: "Prisoners later. Right now we stop Magneto from waking Master Mold again.",
        fallback: "The prisoners can wait. First, the X-Men stop Magneto from reactivating Master Mold.",
      },
      aftermath: {
        speaker: COLOSSUS,
        text: "We got out. Barely. Home has never looked better.",
      },
      aftermathBeats: beats("07-asteroid-m", 6),
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Magneto does not need to win tonight. He only needs the Sentinels to.",
    },
  ],
  campaignLost: {
    headline: "The\nSentinels Win.",
    line: "Magneto took Master Mold and the project went on without the X-Men. This run of the campaign is over.",
  },
  finale: {
    caption: "In Washington, someone is already offering a more sinister answer.",
    headline: "Not over.",
    sfx: "THOOM!",
    villainLine: "Why stop at the Sentinels?",
    heroLines: ["We held. For tonight, that is enough.", "Home is still standing."],
    page: "08-sinister",
    stats: [{ kind: "rewinds", label: "Rewinds" }],
    crewLines: [
      {
        speaker: COLOSSUS,
        text: "We held. For tonight, that is enough.",
        fallback: "We held. For tonight, that is enough.",
      },
      { speaker: SHADOWCAT, text: "Home is still standing.", fallback: "Home is still standing." },
    ],
  },
};
