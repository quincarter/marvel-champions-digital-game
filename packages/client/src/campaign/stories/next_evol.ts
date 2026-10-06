/**
 * NeXt Evolution (MC40) told through its own eight lettered rulebook comic pages, the way Mutant Genesis is
 * (`./mut_gen.ts`): the box's official pages are the story, with captions and balloons printed into the art, so the
 * pages are copied byte-for-byte from `art/campaigns/next_evol/rulebook/page_NNN.jpg` into
 * `art/campaigns/next_evol/pages/NN-<slug>.jpg` (the folder the comic reader reads) and every `ComicPage` below is
 * `lettered: true`, with no line of ours over a printed balloon. The `rulebook/` folder stays the source of record.
 * Everything else here (blurbs, briefings, taunts, the finale copy) is original flavor for this app; no rule lives
 * here (see `../story.ts`). The "Handled for you" notes only restate what `packages/cards/src/campaigns/next_evol.ts`
 * already does.
 *
 * **Cast:** Cable (`40001a`) and Domino (`40037a`) ship in this box, so their lines are written for them; every other
 * hero shows the narrator `fallback` instead.
 *
 * **Page to issue mapping** (rulebook page, file, where it plays): p. 8 `01-graymalkin` is the page right before
 * Scenario 1's setup (Morlock Siege); p. 10 `02-construction` before Scenario 2's (On the Run), its first panel reused
 * as Morlock Siege's aftermath; p. 12 `03-harpoon` is On the Run's own aftermath (the interrogation); p. 13
 * `04-omaha` before Scenario 3's (Juggernaut); p. 15 `05-elevator` before Scenario 4's (Mister Sinister), its first
 * panel reused as Juggernaut's aftermath; p. 17 `06-portal` before Scenario 5's (Stryfe), its first panel reused as
 * Mister Sinister's aftermath; p. 19 `07-stryfe-down` is Stryfe's aftermath; p. 20 `08-xavier` is the finale's spread.
 *
 * **Panel rectangles** are measured by eye against each page's own 1800x1800 pixels, one rectangle per printed panel
 * in reading order; inset and bled panels are boxed to the panel they belong to.
 */
import type { CampaignStory, ComicPage, SetupCallCopy, StorySpeaker } from "../story.js";

const CABLE: StorySpeaker = { kind: "hero", identityId: "40001a", name: "Cable" };
const DOMINO: StorySpeaker = { kind: "hero", identityId: "40037a", name: "Domino" };

const page = (file: string, panels: readonly { x: number; y: number; w: number; h: number }[]): ComicPage => ({
  file,
  width: 1800,
  height: 1800,
  lettered: true,
  beats: panels.map((panel) => ({ panel, lines: [] })),
});

const PAGES: readonly ComicPage[] = [
  // Graymalkin: four panels, two over two.
  page("01-graymalkin", [
    { x: 55, y: 48, w: 900, h: 900 },
    { x: 975, y: 48, w: 775, h: 900 },
    { x: 55, y: 968, w: 585, h: 760 },
    { x: 665, y: 975, w: 1085, h: 750 },
  ]),
  // Construction site: the retreat, the rooftop watcher, the Nasty Boys' deal, X-Force closing in.
  page("02-construction", [
    { x: 55, y: 48, w: 1230, h: 465 },
    { x: 120, y: 515, w: 1630, h: 360 },
    { x: 55, y: 893, w: 960, h: 760 },
    { x: 998, y: 938, w: 752, h: 805 },
  ]),
  // The interrogation: Harpoon, Psylocke, Hope, and the call for a teleport.
  page("03-harpoon", [
    { x: 60, y: 45, w: 880, h: 650 },
    { x: 840, y: 85, w: 910, h: 705 },
    { x: 58, y: 745, w: 825, h: 975 },
    { x: 882, y: 842, w: 458, h: 845 },
    { x: 1340, y: 870, w: 410, h: 850 },
  ]),
  // Omaha: three small panels over one big one.
  page("04-omaha", [
    { x: 48, y: 55, w: 412, h: 740 },
    { x: 480, y: 55, w: 508, h: 740 },
    { x: 1008, y: 55, w: 738, h: 790 },
    { x: 0, y: 795, w: 1800, h: 1005 },
  ]),
  // The orphanage basement and the elevator down.
  page("05-elevator", [
    { x: 58, y: 48, w: 1142, h: 725 },
    { x: 1222, y: 48, w: 525, h: 725 },
    { x: 55, y: 790, w: 652, h: 962 },
    { x: 730, y: 790, w: 1018, h: 962 },
  ]),
  // The portal: three tall panels, then Stryfe's.
  page("06-portal", [
    { x: 58, y: 52, w: 412, h: 1350 },
    { x: 470, y: 85, w: 358, h: 1510 },
    { x: 830, y: 142, w: 256, h: 1530 },
    { x: 1085, y: 85, w: 715, h: 1650 },
  ]),
  // Stryfe beaten and the way home.
  page("07-stryfe-down", [
    { x: 55, y: 52, w: 692, h: 1670 },
    { x: 768, y: 52, w: 978, h: 925 },
    { x: 770, y: 1000, w: 462, h: 722 },
    { x: 1250, y: 1040, w: 495, h: 682 },
  ]),
  // The ruined school: its inset plaque, then the whole page.
  page("08-xavier", [
    { x: 95, y: 90, w: 645, h: 425 },
    { x: 0, y: 0, w: 1800, h: 1800 },
  ]),
];

const beats = (file: string, count: number) =>
  Array.from({ length: count }, (_, beatIndex) => ({ page: file, beatIndex }));

const heal = (): SetupCallCopy => ({
  name: "Expert heal",
  explain: "Expert campaign: pay this scenario's price to heal your hero to full hit points.",
});

export const NEXT_EVOL_STORY: CampaignStory = {
  campaignId: "next_evol",
  tagline: "A story in five issues",
  blurb:
    "The Marauders have come for Hope Summers, and X-Force has to get to her first. From the Morlock tunnels to a time portal, every side scheme you pick leaves an environment behind for the next fight.",
  rosterBanner:
    "Each hero stays for the whole campaign. The side schemes you pick and the environments you earn carry from one issue to the next.",
  setupCalls: {
    "mc40.s2.setup.morlocks-saved": {
      name: "Morlock help",
      explain:
        "Each Morlock you saved lets a player of your choice search their deck for one card and add it to their hand.",
    },
    "mc40.s4.setup.hope": {
      name: "Hope's injuries",
      explain:
        "Hope was hurt last issue. The group chooses: put that much damage on her, or put that much threat on Teleported Away.",
    },
    "mc40.s5.setup.hope": {
      name: "Hope's injuries",
      explain:
        "Hope was hurt last issue. The group chooses: put that much damage on her, or put that much threat on Stryfe's Grasp.",
    },
    "mc40.s2.setup.heal": heal(),
    "mc40.s3.setup.heal": heal(),
    "mc40.s4.setup.heal": heal(),
    "mc40.s5.setup.heal": heal(),
  },
  castIdentityIds: ["40001a", "40037a"],
  pages: PAGES,
  issues: [
    {
      nodeId: "morlock-siege",
      title: "Morlock Siege",
      villain: "The Marauders",
      blurb: "Hope called for backup from the Morlock tunnels. The Marauders came knocking first.",
      recap: "The Marauders fall back from the tunnels. The Morlocks you saved will not forget it.",
      teaser: "The Morlocks are under siege and Hope is holding the line. X-Force is on its way.",
      opener: [],
      comicBeats: beats("01-graymalkin", 4),
      stageLines: {},
      briefing: {
        speaker: CABLE,
        text: "Hope called for backup. We find the Marauders, we protect the Morlocks, and she stays out of it.",
        fallback: "Hope called for backup. The team will find the Marauders and protect the Morlocks.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Your side scheme comes into play",
          detail: "The group picks one player side scheme. It enters play and its encounter card is shuffled in.",
          repeatDetail:
            "The side scheme you picked last time comes into play again, with its encounter card shuffled in. Nothing is asked.",
          citation: "MC40 p. 9",
        },
        {
          status: "later",
          title: "Defeated Marauders are recorded",
          detail: "Each Marauder you rout is remembered, so none returns as the lone villain in the next issue.",
          citation: "MC40 p. 9",
        },
        {
          status: "later",
          title: "Morlocks you save count",
          detail: "Each Morlock still in play on a win will help you at the start of the next issue.",
          citation: "MC40 p. 9",
        },
      ],
      aftermath: {
        speaker: DOMINO,
        text: "They ran. Marauders do not run unless they got what they came for.",
        fallback: "The Marauders ran. They do not do that unless they got what they came for.",
      },
      aftermathBeats: [{ page: "02-construction", beatIndex: 0 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "The tunnels are quiet now. Try again, and we will be louder.",
    },
    {
      nodeId: "on-the-run",
      title: "On the Run",
      villain: "A Marauder",
      blurb: "One Marauder has Hope, and the Nasty Boys are waiting to take her off his hands.",
      recap: "Hope is free and the Marauder who held her is tied up and talking.",
      teaser: "A Marauder is running with Hope. Stop him before the handoff.",
      opener: [],
      comicBeats: beats("02-construction", 4),
      stageLines: {},
      briefing: {
        speaker: DOMINO,
        text: "They left us a trail. Follow it, take the girl back, and keep their boss out of the building.",
        fallback: "They left a trail. The team follows it to take Hope back.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "A new Marauder, chosen at random",
          detail: "Marauders you already routed are out of the deck, so the villain is one you have not beaten.",
          citation: "MC40 p. 11",
        },
        {
          status: "done",
          title: "Morlocks you saved lend a hand",
          detail: "For each one, a player of your choice searches their deck for a card and adds it to their hand.",
          citation: "MC40 p. 11",
        },
        {
          status: "done",
          title: "An earned environment helps you",
          detail: "If you earned one last issue, it is in play, and every enemy now gets a tough status card.",
          citation: "MC40 p. 11",
        },
        {
          status: "later",
          title: "A new side scheme, a new environment",
          detail: "A scheme you did not choose before. Defeat it to earn its environment for every issue after.",
          repeatDetail:
            "The scheme you picked last time comes back. Defeat it to earn its environment for every issue after.",
          citation: "MC40 p. 7",
        },
      ],
      aftermath: {
        speaker: CABLE,
        text: "Harpoon talked. An orphanage in Omaha. Hope wants to come, and I cannot talk her out of it.",
        fallback: "The captured Marauder talked. There is an orphanage in Omaha, and Hope insists on coming.",
      },
      aftermathBeats: beats("03-harpoon", 5),
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Hope is gone and so are we. Better luck at the next handoff.",
    },
    {
      nodeId: "juggernaut",
      title: "Juggernaut",
      villain: "Juggernaut",
      blurb: "The doors of the State Home for Foundlings do not open. They explode.",
      recap: "The Juggernaut is down, and the way into the basement is open.",
      teaser: "Something big is guarding an orphanage in Omaha. It is not subtle.",
      opener: [],
      comicBeats: beats("04-omaha", 4),
      stageLines: {
        2: "Juggernaut stops being surprised. Now he just keeps coming, and he is gaining speed.",
        3: "Nothing slows him down anymore. Hit him hard, and soon.",
      },
      briefing: {
        speaker: DOMINO,
        text: "Big guy, bad attitude, and he only goes faster. Do not let him get a running start.",
        fallback: "The Juggernaut only gets faster. The team must not let him build up a run.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Every earned environment is in play",
          detail: "Each one is put into play, and the Juggernaut starts with a momentum counter for each.",
          citation: "MC40 p. 14",
        },
        {
          status: "done",
          title: "Black Tom Cassidy is dealt out",
          detail: "A card or two from his set is dealt facedown to each player. One card goes into the encounter deck.",
          citation: "MC40 p. 14",
        },
        {
          status: "later",
          title: "Hope's damage is recorded",
          detail: "How hurt Hope is when you win carries into the next issue.",
          citation: "MC40 p. 14",
        },
      ],
      aftermath: {
        speaker: CABLE,
        text: "He is down, and Hope walks beside me. Keep close, and do not trust a hidden door.",
        fallback: "The Juggernaut is down. Hope stays close, and the team heads in.",
      },
      aftermathBeats: [{ page: "05-elevator", beatIndex: 0 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "The Juggernaut cannot be stopped. It also cannot be talked out of a rematch.",
    },
    {
      nodeId: "mister-sinister",
      title: "Mister Sinister",
      villain: "Mister Sinister",
      blurb: "Down the hidden elevator, a lab full of vats and a smiling man who has been expecting Hope.",
      recap: "Sinister is beaten, but not caught. A portal swallows him and Hope follows.",
      teaser: "The basement hides a laboratory, and Mister Sinister is hosting.",
      opener: [],
      comicBeats: beats("05-elevator", 4),
      stageLines: {
        2: "Sinister drops the host act. Every experiment in this lab is now his weapon.",
        3: "He has what he came for, or close. Do not give him the rest.",
      },
      briefing: {
        speaker: CABLE,
        text: "Sinister wants Hope for his final experiment. He does not get her, and he does not get a minute alone.",
        fallback: "Mister Sinister wants Hope for his final experiment. The team will not let him have her.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Teleported Away comes into play",
          detail: "It starts with extra threat for each earned environment in play.",
          citation: "MC40 p. 16",
        },
        {
          status: "done",
          title: "Hope's damage carries over",
          detail: "The group chooses: put that damage on Hope, or put that much threat on Teleported Away.",
          citation: "MC40 p. 16",
        },
        {
          status: "later",
          title: "Hope's damage is recorded again",
          detail: "How hurt she is when you win carries into the final issue.",
          citation: "MC40 p. 16",
        },
      ],
      aftermath: {
        speaker: DOMINO,
        text: "He opened a portal and ran. Then Hope went in after him, which was not in the plan.",
        fallback: "Sinister escaped through a portal, and Hope followed him. That was not in the plan.",
      },
      aftermathBeats: [{ page: "06-portal", beatIndex: 0 }],
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Sinister has run this experiment before. It always ends the same way.",
    },
    {
      nodeId: "stryfe",
      title: "Stryfe",
      villain: "Stryfe",
      blurb: "Through the portal, Cable's clone has Hope in his grip, and her power is getting loose.",
      recap: "Stryfe is down, the time teleporter is set for home, and Hope is safe.",
      teaser: "Stryfe has Hope. The clock is in her power, and it is running out.",
      opener: [],
      comicBeats: beats("06-portal", 4),
      stageLines: {
        2: "Stryfe stops toying with you. His telepathy is heavy, and Hope is feeling every pound of it.",
        3: "Hope's power is slipping its leash. End this before it ends everything.",
      },
      briefing: {
        speaker: CABLE,
        text: "He is my clone and he is stronger than I am. He is not stronger than all of us.",
        fallback: "Stryfe is stronger than Cable alone. He is not stronger than X-Force.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Earned environments are in play",
          detail: "Stryfe's Grasp starts with extra threat for each one. Hope's damage can go there instead.",
          citation: "MC40 p. 18",
        },
        {
          status: "done",
          title: "Each player reveals a minion or Psionic card",
          detail:
            "In player order, discard from the encounter deck until one turns up, then reshuffle the discard pile.",
          citation: "MC40 p. 18",
        },
        {
          status: "later",
          title: "A win finishes the campaign",
          detail: "Beat Stryfe and the campaign is won. On expert, a loss here ends the campaign.",
          citation: "MC40 p. 18",
        },
      ],
      aftermath: {
        speaker: CABLE,
        text: "Stryfe is down. Set the teleporter for the school. We are taking Hope home.",
        fallback: "Stryfe is down. The teleporter is set for the school, and the team takes Hope home.",
      },
      aftermathBeats: beats("07-stryfe-down", 4),
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Stryfe has the better of you here. Try again before time runs out.",
    },
  ],
  campaignLost: {
    headline: "Stryfe\nEscapes.",
    line: "Stryfe slips away into the past and Hope with him. This run of the campaign is over.",
  },
  finale: {
    caption: "The portal opens on Xavier's school. It is not the school they left.",
    headline: "Not over.",
    sfx: "WHOOOM!",
    villainLine: "Welcome home, X-Force. You are late.",
    heroLines: ["We are where and when we should be. Something is wrong.", "Home is on fire. Let us find out why."],
    page: "08-xavier",
    comicBeats: beats("08-xavier", 2),
    stats: [{ kind: "rewinds", label: "Rewinds" }],
    crewLines: [
      {
        speaker: CABLE,
        text: "We are where and when we should be. Something is wrong.",
        fallback: "We are where and when we should be. Something is wrong.",
      },
      {
        speaker: DOMINO,
        text: "Home is on fire. Let us find out why.",
        fallback: "Home is on fire. The team means to find out why.",
      },
    ],
  },
};
