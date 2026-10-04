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
 * measured by eye against each file's own pixels. Issues #2 and #3 open on clean single pictures the owner picked
 * (`art/campaigns/mojo/artboards/`, `ComicPage.artboard`): the reader letters them with each beat's caption and
 * bubbles, at the spots measured below on the pictures' own pixels. The hallway beat of issue #2 has no picture yet
 * and shows its "Panel art: ..." note until `artboards/hallway.*` (1672x941) is added. The box's cover is
 * `art/campaigns/mojo/cover.jpg`. Mojo and Spiral brief their own issues through `portraitScenarioId`, which borrows
 * each scenario's villain picture (`art/scenarios/<id>/villain.*`) for the round portrait.
 */
import type {
  AftermathCallCopy,
  CampaignStory,
  ComicBeat,
  ComicPage,
  SetupCallCopy,
  StoryLine,
  StorySpeaker,
} from "../story.js";

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

/**
 * The reading areas the beats are framed for: a 1440x900 window's is 1440x705 (2.04:1) and a 390x844 phone's 390x680
 * (0.574:1). The reader's camera (`view/comic-pan.ts`'s `cinematicCameraPlan`) fills the area with the beat's
 * rectangle and pans along whatever overflows, so a rectangle of another shape gets its far edge cut at rest: that
 * is what clipped the balloons that sit hard against (or cross) these pages' panel borders. Each beat is therefore the
 * panel with a 4% margin, widened (or heightened) around its center to the area's own shape, clamped inside the
 * page, which shows a slice of the neighboring panel instead of cutting a balloon. A tablet's area is close enough
 * that its pan is a few percent.
 */
const WIDE_AREA = 1440 / 705;
const NARROW_AREA = 390 / 680;
const MARGIN = 1.04;

const framedOn =
  (pageWidth: number, pageHeight: number) =>
  (x: number, y: number, w: number, h: number, aspect: number): ComicBeat["panel"] => {
    let nw = w * MARGIN;
    let nh = h * MARGIN;
    if (nw / nh > aspect) nh = nw / aspect;
    else nw = nh * aspect;
    // A page too small to hold the shape gives up the shape, never the panel.
    nw = Math.min(nw, pageWidth);
    nh = Math.min(nh, pageHeight);
    const left = Math.max(0, Math.min(pageWidth - nw, x + w / 2 - nw / 2));
    const top = Math.max(0, Math.min(pageHeight - nh, y + h / 2 - nh / 2));
    return { x: Math.round(left), y: Math.round(top), w: Math.round(nw), h: Math.round(nh) };
  };

/** One lettered panel as the beats a wide area and a phone each read it by (the page's own balloons are the story). */
const beatsOn =
  (pageWidth: number, pageHeight: number) =>
  (x: number, y: number, w: number, h: number, only?: "wide" | "narrow"): ComicBeat[] => {
    const framed = framedOn(pageWidth, pageHeight);
    const wide: ComicBeat = { panel: framed(x, y, w, h, WIDE_AREA), lines: [], wideOnly: true };
    const narrow: ComicBeat = { panel: framed(x, y, w, h, NARROW_AREA), lines: [], narrowOnly: true };
    return only === "wide" ? [wide] : only === "narrow" ? [narrow] : [wide, narrow];
  };

/** The closing beat that pulls back to the whole page: it is the page's own shape, so it is not reframed. */
const wholePage = (pageWidth: number, pageHeight: number): ComicBeat => ({
  panel: { x: 0, y: 0, w: pageWidth, h: pageHeight },
  lines: [],
  wideOnly: true,
});

const broadcast = beatsOn(1500, 1153);

/**
 * The broadcast spread (1500x1153). Top row: the Empire State Building, Mojo's wide announcement (its art runs under
 * the building panel, so it starts at x 209 from y 0) and the monitor-wall close-up; bottom row: four panels, then
 * the right column's two stacked panels (the lower holds Major Domo's reaction as an inset). Rectangles are the
 * panels' own borders, found from the gutters in the file's pixels. A wide area opens on the building's caption and
 * Mojo's whole announcement together (the building alone is a blurred skyscraper slice at that width); a phone gets
 * the building, then the announcement in two halves, where its lettering would otherwise be too small.
 */
const BROADCAST: ComicPage = {
  file: "01-broadcast",
  width: 1500,
  height: 1153,
  lettered: true,
  beats: [
    ...broadcast(22, 22, 180, 462, "narrow"),
    ...broadcast(0, 0, 1118, 585, "wide"),
    ...broadcast(209, 0, 455, 585, "narrow"),
    ...broadcast(664, 0, 454, 585, "narrow"),
    ...broadcast(1120, 26, 375, 555),
    // The bottom row's first three panels, and the right column's two, are tall slivers beside a 2:1 area: framed one
    // by one they would all show the same slice of the row, so a wide area reads them as two groups.
    ...broadcast(0, 595, 1023, 558, "wide"),
    ...broadcast(1031, 604, 469, 549, "wide"),
    ...broadcast(0, 595, 198, 558, "narrow"),
    ...broadcast(209, 595, 309, 558, "narrow"),
    ...broadcast(525, 595, 498, 558, "narrow"),
    ...broadcast(1031, 604, 469, 229, "narrow"),
    ...broadcast(1031, 840, 469, 313, "narrow"),
    wholePage(1500, 1153),
  ],
};

const pageTwo = beatsOn(976, 1500);

/**
 * The X-Babies page (976x1500): three stacked panels. Each is read whole on a wide area and in two overlapping halves
 * on a phone (the halves share the middle so no balloon is cut); the closing whole-page beat only reads where the
 * area is wide enough.
 */
const AND_SO_IT_GOES: ComicPage = {
  file: "02-and-so-it-goes",
  width: 976,
  height: 1500,
  lettered: true,
  beats: [
    ...pageTwo(46, 57, 885, 395, "wide"),
    ...pageTwo(46, 57, 490, 395, "narrow"),
    ...pageTwo(441, 57, 490, 395, "narrow"),
    ...pageTwo(46, 468, 885, 435, "wide"),
    ...pageTwo(46, 468, 490, 435, "narrow"),
    ...pageTwo(441, 468, 490, 435, "narrow"),
    ...pageTwo(46, 917, 885, 493, "wide"),
    ...pageTwo(46, 917, 490, 493, "narrow"),
    ...pageTwo(441, 917, 490, 493, "narrow"),
    wholePage(976, 1500),
  ],
};

/** What one illustrated beat says; its wide and phone framings are two beats of the same page. */
interface SceneContent {
  readonly caption?: string;
  readonly lines: readonly StoryLine[];
}

/**
 * One artboard picture as a wide beat (the desktop/tablet reading area's 2.04:1 shape, bubbles at their
 * `placement`) and a phone beat (0.574:1; a phone stacks its bubbles itself, so the lines carry no placement).
 * Each rectangle is the area's own shape so the bubble's page coordinates land where they were measured.
 */
const illustrated = (
  wide: ComicBeat["panel"],
  narrow: ComicBeat["panel"],
  content: SceneContent,
): readonly ComicBeat[] => [
  { panel: wide, ...content, wideOnly: true },
  {
    panel: narrow,
    ...(content.caption ? { caption: content.caption } : {}),
    lines: content.lines.map(({ placement: _placement, ...line }) => line),
    narrowOnly: true,
  },
];

/** Issue #2, beat 1: Major Domo and the empty director's chair (1672x941). Bubble on the floor, right of him. */
const EMPTY_SET: ComicPage = {
  file: "empty-set",
  width: 1672,
  height: 941,
  artboard: true,
  beats: illustrated(
    { x: 0, y: 60, w: 1672, h: 820 },
    { x: 700, y: 0, w: 540, h: 941 },
    {
      caption: "Episode two starts with an empty chair and a very unhappy producer.",
      lines: [
        {
          speaker: MAJOR_DOMO,
          text: "She walked off, sir. Swords were not in the contract.",
          // On the lit floor right of him, its tail on the right edge of his head.
          placement: { bubble: { x: 1390, y: 700 }, speaker: { x: 1100, y: 362 } },
        },
      ],
    },
  ),
};

/** Issue #2, beat 2: Spiral alone on the catwalk (1672x941). Bubble in the dark rigging right of her. */
const SPIRAL_PAGE: ComicPage = {
  file: "spiral",
  width: 1672,
  height: 941,
  artboard: true,
  beats: illustrated(
    { x: 0, y: 0, w: 1672, h: 820 },
    { x: 580, y: 0, w: 540, h: 941 },
    {
      // No caption: her face is at the very top of the picture and a caption would sit on it.
      lines: [
        {
          speaker: VILLAIN,
          text: "I was your best actress. Now I am your worst problem.",
          placement: { bubble: { x: 1410, y: 120 }, speaker: { x: 905, y: 105 } },
        },
      ],
    },
  ),
};

/**
 * Issue #2, beat 3: a hallway of studio doors, not drawn yet. The rectangles assume the picture will be the same
 * 1672x941 as its neighbors; until then the reader shows `note` with the caption and line over it.
 */
const HALLWAY: ComicPage = {
  file: "hallway",
  width: 1672,
  height: 941,
  artboard: true,
  note: "Panel art: a hallway of studio doors, each opening onto a different genre",
  beats: illustrated(
    { x: 0, y: 60, w: 1672, h: 820 },
    { x: 566, y: 0, w: 540, h: 941 },
    {
      caption: "Every door leads to another genre. She is behind one of them.",
      lines: [
        {
          speaker: ROGUE,
          text: "Pick a door, sugar. We are going through all of them.",
          fallback: "Someone has to pick a door. The heroes mean to try them all.",
        },
      ],
    },
  ),
};

/** Issue #3, beat 1: Mojo hanging in his dome of screens (763x1168). Bubble over the screens right of his head. */
const SCREENS: ComicPage = {
  file: "screens",
  width: 763,
  height: 1168,
  artboard: true,
  beats: illustrated(
    { x: 0, y: 395, w: 763, h: 374 },
    { x: 40, y: 0, w: 670, h: 1168 },
    {
      caption: "For the finale, every screen in the Mojoverse is tuned to you.",
      lines: [
        {
          speaker: MOJO,
          text: "Season finale, darlings. Every genre, one night only.",
          placement: { bubble: { x: 620, y: 500 }, speaker: { x: 418, y: 590 } },
        },
      ],
    },
  ),
};

/** Issue #3, beat 2: Mojo looming over the camera (1440x1609). Bubble in the dark top left, tail on his face. */
const MOJO_LOOMS: ComicPage = {
  file: "mojo-looms",
  width: 1440,
  height: 1609,
  artboard: true,
  beats: illustrated(
    { x: 0, y: 50, w: 1440, h: 706 },
    { x: 150, y: 0, w: 924, h: 1609 },
    {
      lines: [
        {
          speaker: VILLAIN,
          text: "I made you famous. The least you can do is lose well.",
          placement: { bubble: { x: 290, y: 215 }, speaker: { x: 590, y: 420 } },
        },
      ],
    },
  ),
};

/** Issue #3, beat 3: Longshot in a sunny garden (1207x1800), a cutaway. Bubble in the orange sky, left of him. */
const LONGSHOT_PAGE: ComicPage = {
  file: "longshot",
  width: 1207,
  height: 1800,
  artboard: true,
  beats: illustrated(
    { x: 0, y: 60, w: 1207, h: 592 },
    { x: 174, y: 0, w: 1033, h: 1800 },
    {
      caption: "Cut to a commercial break: a sunny garden and one friendly face.",
      lines: [
        {
          speaker: LONGSHOT,
          text: "I am lucky. I just do not know how long that lasts.",
          placement: { bubble: { x: 250, y: 300 }, speaker: { x: 800, y: 370 } },
        },
      ],
    },
  ),
};

const refs = (page: string, count: number) => Array.from({ length: count }, (_, beatIndex) => ({ page, beatIndex }));

/** An illustrated opener's guided read: each picture's wide beat, then its phone beat (the reader keeps one). */
const readPictures = (...files: string[]) => files.flatMap((file) => refs(file, 2));

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
  pages: [BROADCAST, AND_SO_IT_GOES, EMPTY_SET, SPIRAL_PAGE, HALLWAY, SCREENS, MOJO_LOOMS, LONGSHOT_PAGE],
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
      comicBeats: refs("01-broadcast", BROADCAST.beats.length),
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
            kind: "artboard",
            name: "empty-set",
            text: "Panel art: an empty director's chair on a half-built set",
          },
          caption: "Episode two starts with an empty chair and a very unhappy producer.",
          lines: [{ speaker: MAJOR_DOMO, text: "She walked off, sir. Swords were not in the contract." }],
        },
        {
          art: { kind: "artboard", name: "spiral", text: "Panel art: Spiral on the studio catwalk, swords out" },
          lines: [{ speaker: VILLAIN, text: "I was your best actress. Now I am your worst problem." }],
        },
        {
          art: {
            kind: "artboard",
            name: "hallway",
            text: "Panel art: a hallway of studio doors, each opening onto a different genre",
          },
          caption: "Every door leads to another genre. She is behind one of them.",
          lines: [
            {
              speaker: ROGUE,
              text: "Pick a door, sugar. We are going through all of them.",
              fallback: "Someone has to pick a door. The heroes mean to try them all.",
            },
          ],
        },
      ],
      comicBeats: readPictures("empty-set", "spiral", "hallway"),
      // Rewind's torn photo is the villain's own beat, not the placeholder.
      rewindPanel: { page: "spiral", beatIndex: 0 },
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
          art: { kind: "artboard", name: "screens", text: "Panel art: Mojo hanging in a dome of screens" },
          caption: "For the finale, every screen in the Mojoverse is tuned to you.",
          lines: [{ speaker: MOJO, text: "Season finale, darlings. Every genre, one night only." }],
        },
        {
          art: { kind: "artboard", name: "mojo-looms", text: "Panel art: Mojo looming over the camera" },
          lines: [{ speaker: VILLAIN, text: "I made you famous. The least you can do is lose well." }],
        },
        {
          art: { kind: "artboard", name: "longshot", text: "Panel art: Longshot smiling in a sunny garden" },
          caption: "Cut to a commercial break: a sunny garden and one friendly face.",
          lines: [{ speaker: LONGSHOT, text: "I am lucky. I just do not know how long that lasts." }],
        },
      ],
      comicBeats: readPictures("screens", "mojo-looms", "longshot"),
      rewindPanel: { page: "mojo-looms", beatIndex: 0 },
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
    comicBeats: refs("02-and-so-it-goes", AND_SO_IT_GOES.beats.length),
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
