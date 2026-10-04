/**
 * MojoMania (MC39) told as a cancelled-then-renewed TV show: three issues, each an episode, with Mojo as the
 * showrunner who keeps picking the cast. The box is a scenario pack with no heroes of its own, so its default cast is
 * Gambit (`37001a`) and Rogue (`38001a`) from the same cycle; their lines are written for them and every other
 * hero shows the narrator `fallback` instead (`../story.ts`'s own rule). Original flavor for this app; no rule lives
 * here (see `../story.ts`): the genre-set picks, Longshot and the recorded cards all come from
 * `packages/cards/src/campaigns/mojo.ts` and the run's own log, and the "Handled for you" notes below only restate
 * what those setup instructions already do.
 *
 * **Art:** the insert has no story art, so the box is told through two lettered comic pages the owner supplied
 * (`art/campaigns/mojo/pages/`): `01-broadcast` (a two-page spread) opens issue #1 and `02-and-so-it-goes` is the
 * finale's page. Both are lettered, so the reader adds none of its own captions or bubbles; panel rectangles are
 * measured by eye against each file's own pixels. Issues #2 and #3 and the box's cover have no art of their own yet:
 * their openers use the design's "Panel art: ..." notes and each scenario's own villain picture
 * (`art/scenarios/<id>/villain.*`). Mojo and Spiral brief their own issues through `portraitScenarioId`, which borrows that same villain
 * picture for the round portrait.
 */
import type { AftermathCallCopy, CampaignStory, ComicBeat, ComicPage, SetupCallCopy, StorySpeaker } from "../story.js";

const GAMBIT: StorySpeaker = { kind: "hero", identityId: "37001a", name: "Gambit" };
const ROGUE: StorySpeaker = { kind: "hero", identityId: "38001a", name: "Rogue" };
const VILLAIN: StorySpeaker = { kind: "villain" };
const MOJO: StorySpeaker = { kind: "npc", name: "Mojo", portraitScenarioId: "mojo" };
const SPIRAL: StorySpeaker = { kind: "npc", name: "Spiral", portraitScenarioId: "spiral" };
const MAJOR_DOMO: StorySpeaker = { kind: "npc", name: "Major Domo" };
const LONGSHOT: StorySpeaker = { kind: "npc", name: "Longshot" };

const LONGSHOT_CALL: SetupCallCopy = {
  name: "Longshot",
  explain:
    "Longshot was in play when the last issue ended. One player of your choice may reveal him and take him into play, or you can shuffle him into the encounter deck instead.",
};

const RECORD_CALL: AftermathCallCopy = {
  heading: "Record one card, or none.",
  declineLabel: "Record nothing",
  waiting: "Offered once the hero before has decided.",
  note: "Each hero may record one support or upgrade they control. At the start of the next issue it can be taken into play from any deck, and the main scheme gains threat equal to its cost.",
  showCost: true,
};

const heal = (): SetupCallCopy => ({
  name: "Expert heal",
  explain: "Expert campaign: deal yourself one facedown encounter card to heal your hero to full hit points.",
});

/** One lettered beat: a panel and nothing of ours (the page's own balloons are the story). */
const beat = (
  x: number,
  y: number,
  w: number,
  h: number,
  flags: Pick<ComicBeat, "wideOnly" | "narrowOnly"> = {},
): ComicBeat => ({
  panel: { x, y, w, h },
  lines: [],
  ...flags,
});

/**
 * The broadcast spread (1500x1153). Top row: the Empire State Building, Mojo's wide announcement (its art runs under
 * the building panel, so it starts at x 209 from y 0) and the monitor-wall close-up; bottom row: four panels, then
 * the right column's two stacked panels (the lower holds Major Domo's reaction as an inset). Rectangles are the
 * panels' own borders, found from the gutters in the file's pixels. The wide
 * announcement is read whole on a tablet or desktop and in two halves on a phone, where its lettering would
 * otherwise be too small; the closing whole-spread beat only reads where the area is wide enough.
 */
const BROADCAST: ComicPage = {
  file: "01-broadcast",
  width: 1500,
  height: 1153,
  lettered: true,
  beats: [
    beat(22, 22, 180, 462),
    beat(209, 0, 909, 585, { wideOnly: true }),
    beat(209, 0, 455, 585, { narrowOnly: true }),
    beat(664, 0, 454, 585, { narrowOnly: true }),
    beat(1120, 26, 375, 555),
    beat(0, 595, 198, 558),
    beat(209, 595, 309, 558),
    beat(525, 595, 498, 558),
    beat(1031, 604, 469, 229),
    beat(1031, 840, 469, 313),
    beat(0, 0, 1500, 1153, { wideOnly: true }),
  ],
};

/**
 * The X-Babies page (976x1500): three stacked panels. Each is read whole on a wide area and in two overlapping halves
 * on a phone (the halves share the middle so no balloon is cut);
 * the closing whole-page beat only reads where the area is wide enough.
 */
const AND_SO_IT_GOES: ComicPage = {
  file: "02-and-so-it-goes",
  width: 976,
  height: 1500,
  lettered: true,
  beats: [
    beat(46, 57, 885, 395, { wideOnly: true }),
    beat(46, 57, 490, 395, { narrowOnly: true }),
    beat(441, 57, 490, 395, { narrowOnly: true }),
    beat(46, 468, 885, 435, { wideOnly: true }),
    beat(46, 468, 490, 435, { narrowOnly: true }),
    beat(441, 468, 490, 435, { narrowOnly: true }),
    beat(46, 917, 885, 493, { wideOnly: true }),
    beat(46, 917, 490, 493, { narrowOnly: true }),
    beat(441, 917, 490, 493, { narrowOnly: true }),
    beat(0, 0, 976, 1500, { wideOnly: true }),
  ],
};

const refs = (page: string, count: number) => Array.from({ length: count }, (_, beatIndex) => ({ page, beatIndex }));

export const MOJO_STORY: CampaignStory = {
  campaignId: "mojo",
  tagline: "A show in three episodes",
  blurb:
    "Mojo has pulled the heroes into the Mojoverse for a new season, and the ratings are the only thing that matters. Three episodes, a different genre every time, and one lucky ally who may or may not make it to the credits.",
  rosterBanner:
    "Each hero stays for all three episodes. The genre sets you use and the cards you record carry from one issue to the next.",
  aftermathCalls: { "mojo.s1.victory.card": RECORD_CALL, "mojo.s2.victory.card": RECORD_CALL },
  setupCalls: {
    "mojo.s2.setup.longshot": LONGSHOT_CALL,
    "mojo.s3.setup.longshot": LONGSHOT_CALL,
    "mojo.s2.setup.recorded-card": {
      name: "Recorded card",
      explain:
        "You may take the card you recorded from any player's deck and put it into play. The main scheme gains threat equal to its cost, so it is a trade: a head start for you, more pressure on the table.",
    },
    "mojo.s3.setup.recorded-cards": {
      name: "Recorded cards",
      explain:
        "You may take each card you recorded from any player's deck and put it into play. The main scheme gains threat equal to the total cost of the cards you take, so it is a trade: a head start for you, more pressure on the table.",
    },
    "mojo.s2.setup.heal": heal(),
    "mojo.s3.setup.heal": heal(),
  },
  rosterNote:
    "Gambit and Rogue are the default cast, and their story beats are written for them. Any other hero gets the same beats with narrator captions.",
  castIdentityIds: ["37001a", "38001a"],
  pages: [BROADCAST, AND_SO_IT_GOES],
  issues: [
    {
      nodeId: "magog",
      title: "Live from the Mojo-seum",
      villain: "MaGog",
      blurb: "The pilot goes out live, with a gladiator, a studio audience and no one allowed to leave.",
      recap: "MaGog took his bow and the crowd has opinions. Mojo is already planning the next episode.",
      teaser: "The cameras are rolling and the audience is hungry. Time to put on a show.",
      opener: [
        {
          art: {
            kind: "note",
            text: "Panel art: a floodlit arena, a roaring crowd, a camera crane swinging over the heroes",
          },
          caption: "Welcome to the Mojoverse, where every fight is a broadcast.",
          lines: [{ speaker: MOJO, text: "Smile, darlings. You are on in five, four, three..." }],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "The crowd wants a champion. I am happy to be the only one." }],
        },
        {
          art: { kind: "note", text: "Panel art: a ratings board behind the stands, one bar creeping up" },
          caption: "The only way out is to make the crowd love you. Or at least stop booing.",
          lines: [],
        },
      ],
      comicBeats: refs("01-broadcast", 11),
      stageLines: {},
      briefing: {
        speaker: MOJO,
        text: "A pilot needs a big name and a bigger crowd. I have MaGog. You have, well, you. Do try to be entertaining.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Longshot is shuffled into the encounter deck",
          detail:
            "Setup shuffles him in with everything else. If he is in play when you win, the campaign remembers it.",
          citation: "Insert p. 9",
        },
        {
          status: "done",
          title: "Your genre set joins the encounter deck",
          detail: "The set you chose is shuffled in with MaGog's own cards, so this episode plays in that genre.",
          citation: "Insert p. 7",
        },
        {
          status: "later",
          title: "Heroes are locked in",
          detail: "Each player's hero is recorded now and stays the same for all three issues.",
          citation: "Insert p. 9",
        },
        {
          status: "later",
          title: "A win checks off the genre set and records a card",
          detail:
            "You will not be able to pick this set again in issue #2, and each player may record a support or upgrade.",
          citation: "Insert p. 9",
        },
      ],
      aftermath: {
        speaker: GAMBIT,
        text: "Mon ami, I think we just got renewed. That is not the good news it sounds like.",
        fallback: "The crowd is on its feet, and that is not the good news it sounds like. The show has been renewed.",
      },
      aftermathArt: { kind: "villain" },
      rewindTaunt: "That was a rehearsal. Mojo will cut and reshoot until it plays right.",
    },
    {
      nodeId: "spiral",
      title: "Off Script",
      villain: "Spiral",
      blurb: "The star of the second episode has no intention of finishing it, and she brought a lot of swords.",
      recap: "Spiral is cornered, at least for this episode. The heroes did not get a thank-you note from the network.",
      teaser: "One of the cast has gone missing. Worse, she did it on purpose.",
      opener: [
        {
          art: {
            kind: "note",
            text: "Panel art: a half-built set of three genres stitched together, a blank spot where a star should be",
          },
          caption: "Episode two begins with an empty chair and a producer very unhappy about it.",
          lines: [
            { speaker: MAJOR_DOMO, text: "She is gone, sir. Again. Her contract said nothing about the swords." },
          ],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "I was your best actress. Now I am your worst problem." }],
        },
        {
          art: { kind: "note", text: "Panel art: a hallway of studio doors, each opening onto a different genre" },
          caption: "Every door leads somewhere else, and she knows which one she is hiding behind.",
          lines: [],
        },
      ],
      stageLines: {
        2: "Spiral stops running and starts performing. The audience, for once, is the one in the line of fire.",
        3: "Spiral has had enough of scripts. From here, every scene is hers.",
      },
      briefing: {
        speaker: SPIRAL,
        text: "Mojo wants me back on set. Mojo wants a lot of things. Find me if you can, and bring a stunt double.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Three genre sets, none you have used",
          detail:
            "Sets checked off in issue #1 are not offered again. Each one you pick is shuffled into the encounter deck.",
          citation: "Insert p. 13",
        },
        {
          status: "done",
          title: "Longshot comes back, or is shuffled in",
          detail:
            "If he was in play when issue #1 ended, one player may reveal him. If no one does, or he was not in play, he is shuffled into the encounter deck.",
          citation: "Insert p. 13",
        },
        {
          status: "done",
          title: "Recorded cards come into play",
          detail:
            "Each player may take the card they recorded from any player's deck and put it into play. Threat is added to the main scheme equal to the total cost of those cards.",
          citation: "Insert p. 13",
        },
        {
          status: "later",
          title: "A win checks off all three sets",
          detail:
            "Those sets are no longer available in issue #3, and each player may record another support or upgrade.",
          citation: "Insert p. 14",
        },
      ],
      aftermath: {
        speaker: ROGUE,
        text: "She got away from us twice and cornered herself once. I will take it.",
        fallback: "Spiral slipped away twice and cornered herself once. That counts as a win for this episode.",
      },
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Spiral does not do retakes. She does encores.",
    },
    {
      nodeId: "mojo",
      title: "Series Finale",
      villain: "Mojo",
      blurb: "The showrunner steps in front of the camera, and every genre he has ever aired is on the table.",
      recap: "Mojo is off the air. The heroes are home, the credits have rolled, and nobody got a residual.",
      teaser: "The network wants a finale. Mojo wants a ratings record. You want to leave.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: the Wheel of Genres, glowing, with every genre's icon in turn" },
          caption: "For the finale, Mojo is using every genre at once.",
          lines: [
            {
              speaker: MOJO,
              text: "Season finale, darlings. If we are going out, we are going out with a bang. Several bangs.",
            },
          ],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "I made you famous. The least you can do is lose well." }],
        },
        {
          art: { kind: "note", text: "Panel art: Longshot at the edge of the frame, cautiously raising a hand" },
          caption: "One more face in the cast list, and it is a friendly one.",
          lines: [{ speaker: LONGSHOT, text: "I am lucky. I just do not know how long that lasts." }],
        },
      ],
      stageLines: {
        2: "Mojo drops the host act. It was never a show to him. It was a leash, and you are on it.",
        3: "The set is coming down around the heroes and Mojo is still smiling. The cameras are still on.",
      },
      briefing: {
        speaker: MOJO,
        text: "Tonight we go out in every genre I own. Do not worry, I will tell you when to look surprised.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "One genre set, plus one for each hero",
          detail:
            "The sets you pick are set aside, and the first one you pick comes in first. If fewer unchecked sets remain than you need, checked-off ones can be chosen once the others are.",
          citation: "Insert p. 17",
        },
        {
          status: "done",
          title: "Longshot comes back, or is shuffled in",
          detail:
            "If he was in play when issue #2 ended, one player may reveal him. If no one does, or he was not in play, he is shuffled into the encounter deck.",
          citation: "Insert p. 17",
        },
        {
          status: "done",
          title: "Every recorded card comes into play",
          detail:
            "Each player may take each card they recorded and put it into play. Threat is added to the main scheme equal to their total cost.",
          citation: "Insert p. 17",
        },
        {
          status: "later",
          title: "A win finishes the campaign",
          detail: "Beat Mojo and MojoMania is complete.",
          citation: "Insert p. 17",
        },
      ],
      aftermath: {
        speaker: ROGUE,
        text: "We got the last word, and that is more than anyone gets on television. Let us go home.",
        fallback: "The heroes got the last word, which is more than anyone gets on television.",
      },
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Cut! From the top, please. The audience is still paying.",
    },
  ],
  campaignLost: {
    headline: "The Show\nGoes On.",
    line: "Mojo gets his ratings and the heroes do not get a finale. This run of the campaign is over.",
  },
  finale: {
    caption: "Somewhere in the Mojoverse, a network executive is already pitching a spin-off.",
    headline: "That's a wrap.",
    sfx: "CLAP!",
    villainLine: "Do not go far. I have notes for next season.",
    heroLines: ["Next time, I get a stunt double.", "Tell them we are not renewing."],
    page: "02-and-so-it-goes",
    comicBeats: refs("02-and-so-it-goes", 10),
    stats: [{ kind: "rewinds", label: "Rewinds" }],
    crewLines: [
      {
        speaker: GAMBIT,
        text: "Next time, I get a stunt double.",
        fallback: "Next time, someone else gets the stunt double.",
      },
      {
        speaker: ROGUE,
        text: "Tell them we are not renewing.",
        fallback: "Someone tell the network the cast is not renewing.",
      },
    ],
  },
};
