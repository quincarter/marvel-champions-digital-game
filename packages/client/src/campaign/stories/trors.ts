/**
 * The Rise of Red Skull (MC10) told as five issues. Original flavor copy for this app — issues #1–#3 and the
 * finale follow `Marvel Champions game screens/Campaign - *.dc.html` word for word; #4 and #5 are written to match.
 * No rule lives here (see `../story.ts`).
 *
 * **Guided read over the box's own official pages.** Unlike GMW's unlettered fan pages, MC10's rulebook comic
 * (`docs/campaign-modes/mc10_the_rise_of_red_skull_rules_web.pdf`) is already lettered — captions and speech
 * balloons are printed into the art. Rather than teach the art pipeline a second "box's official pages get loaded
 * a different way" branch, the 8 pages are copied byte-for-byte from `art/campaigns/trors/rulebook/page_NNN.jpg`
 * into `art/campaigns/trors/pages/NN-<slug>.jpg` — the convention `art/campaign-art.ts`'s glob and the comic
 * reader already read for GMW — and every `ComicPage` below is marked `lettered: true` so the reader shows none of
 * its own captions/bubbles over them (`ui/comic-reader.ts`) and fits each panel into the frame instead of cropping
 * it to cover. The `rulebook/` folder stays as the source of record; the client never loads it directly
 * (`art/README.md`).
 *
 * **Page → issue mapping**, by story content: #1 (crossbones) → 01-siege plus 02-crossbones' first panel (her
 * takedown); #2 (absorbing-man) → the rest of 02-crossbones plus 03-absorbing-man's first panel; #3 (taskmaster) →
 * the rest of 03-absorbing-man, all of 04-hydra-tower, and 05-taskmaster's first panel; #4 (zola) → the rest of
 * 05-taskmaster plus 06-zola's first panel; #5 (red-skull) → the rest of 06-zola plus all of 07-red-skull.
 * 08-epilogue is the finale's own page — recorded here for the Finale screen's later comic pass, not wired to any
 * issue yet (`campaign/story.ts`'s `finale` block still carries the plain flavor text).
 *
 * **Panel rectangles** below are measured against each page's own pixel size (1800×1800 throughout): a script
 * (PIL/numpy) locates each page's black panel borders against the white gutters between them, every candidate
 * rectangle rendered as a numbered overlay and checked against the source page before being written down here
 * (kept, ungit-tracked, under `artifacts/qa/trors-reader/rects/`). Reading order follows each page's own tiers,
 * left to right, top to bottom, the way the rulebook itself reads — including panels that bleed to a page's own
 * edge with no printed border (04-hydra-tower's skyline strip) and an inset that breaks its neighbor's frame with
 * no border of its own (07-red-skull's foreground Hawkeye, boxed to the page's own edges the same way GMW's page 5
 * bleeds Ronan's close-up).
 */
import type { CampaignStory, ComicPage, StorySpeaker } from "../story.js";

const HAWKEYE: StorySpeaker = { kind: "hero", identityId: "04001a", name: "Hawkeye" };
const SPIDER_WOMAN: StorySpeaker = { kind: "hero", identityId: "04031a", name: "Spider-Woman" };
const VILLAIN: StorySpeaker = { kind: "villain" };

const PAGES: readonly ComicPage[] = [
  {
    file: "01-siege",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      { panel: { x: 0, y: 0, w: 470, h: 1195 }, lines: [] },
      { panel: { x: 495, y: 0, w: 1305, h: 1195 }, lines: [] },
      { panel: { x: 0, y: 1215, w: 1800, h: 585 }, lines: [] },
    ],
  },
  {
    file: "02-crossbones",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      { panel: { x: 0, y: 0, w: 590, h: 1800 }, lines: [] },
      { panel: { x: 610, y: 0, w: 1190, h: 395 }, lines: [] },
      { panel: { x: 610, y: 415, w: 1190, h: 1000 }, lines: [] },
      { panel: { x: 995, y: 1430, w: 805, h: 370 }, lines: [] },
    ],
  },
  {
    file: "03-absorbing-man",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      { panel: { x: 0, y: 0, w: 1310, h: 900 }, lines: [] },
      { panel: { x: 1330, y: 0, w: 470, h: 900 }, lines: [] },
      { panel: { x: 0, y: 920, w: 940, h: 290 }, lines: [] },
      { panel: { x: 960, y: 920, w: 840, h: 320 }, lines: [] },
      { panel: { x: 0, y: 1250, w: 1800, h: 550 }, lines: [] },
    ],
  },
  {
    file: "04-hydra-tower",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      { panel: { x: 0, y: 0, w: 395, h: 1195 }, lines: [] },
      { panel: { x: 415, y: 0, w: 395, h: 1195 }, lines: [] },
      { panel: { x: 825, y: 0, w: 975, h: 1195 }, lines: [] },
      { panel: { x: 0, y: 1215, w: 1800, h: 585 }, lines: [] },
    ],
  },
  {
    file: "05-taskmaster",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      { panel: { x: 0, y: 0, w: 1800, h: 460 }, lines: [] },
      { panel: { x: 75, y: 480, w: 530, h: 790 }, lines: [] },
      { panel: { x: 630, y: 480, w: 530, h: 790 }, lines: [] },
      { panel: { x: 1190, y: 480, w: 535, h: 790 }, lines: [] },
      { panel: { x: 0, y: 1290, w: 1800, h: 510 }, lines: [] },
    ],
  },
  {
    file: "06-zola",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      { panel: { x: 0, y: 0, w: 770, h: 1195 }, lines: [] },
      { panel: { x: 790, y: 0, w: 1010, h: 495 }, lines: [] },
      { panel: { x: 790, y: 515, w: 1010, h: 680 }, lines: [] },
      { panel: { x: 0, y: 1215, w: 585, h: 585 }, lines: [] },
      { panel: { x: 605, y: 1215, w: 1195, h: 585 }, lines: [] },
    ],
  },
  {
    file: "07-red-skull",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      // The full-bleed battle spread; Hawkeye breaks its own frame in the foreground with no printed border.
      { panel: { x: 0, y: 0, w: 1800, h: 1800 }, lines: [] },
      // The Red Skull inset, bottom right — two near-identical panels of him in the source art, boxed together.
      { panel: { x: 605, y: 1215, w: 1045, h: 585 }, lines: [] },
    ],
  },
  {
    // The finale's own page — recorded for the Finale screen's later comic pass (see the module doc comment
    // above); no issue's `comicBeats` points at it yet.
    file: "08-epilogue",
    width: 1800,
    height: 1800,
    lettered: true,
    beats: [
      { panel: { x: 0, y: 0, w: 585, h: 1195 }, lines: [] },
      { panel: { x: 605, y: 0, w: 320, h: 1195 }, lines: [] },
      { panel: { x: 770, y: 0, w: 320, h: 1195 }, lines: [] },
      { panel: { x: 1130, y: 0, w: 670, h: 1195 }, lines: [] },
      { panel: { x: 0, y: 1215, w: 750, h: 585 }, lines: [] },
      { panel: { x: 770, y: 1215, w: 1030, h: 585 }, lines: [] },
    ],
  },
];

export const TRORS_STORY: CampaignStory = {
  campaignId: "trors",
  tagline: "A story in five issues",
  blurb: "Hydra has an Infinity Gem and a plan for the whole world. Every win carries forward. Every scar does too.",
  rosterBanner: "Whoever signs here sees it through. All five issues. No substitutions.",
  castIdentityIds: ["04001a", "04031a"],
  pages: PAGES,
  issues: [
    {
      nodeId: "crossbones",
      title: "Blitz on the Mountain",
      villain: "Crossbones",
      blurb: "Hydra hits a S.H.I.E.L.D. weapons lab under the Adirondacks. Whatever walks out with him stays in play.",
      recap: "Crossbones walked out with the Gem. The prototypes stayed behind.",
      teaser: "Knock knock. Hydra's here for the toys.",
      opener: [
        {
          art: { kind: "artboard", name: "mountain-facility", text: "Panel art: mountain facility at night" },
          caption:
            "The Adirondacks. 4 a.m. Under this mountain, S.H.I.E.L.D. builds weapons it swears it'll never use.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Knock knock, P.E.G.A.S.U.S. Hydra's here for the toys." }],
          sfx: "KRA-KOOM!",
        },
        {
          art: { kind: "artboard", name: "heroes-drop-in", text: "Panel art: the heroes drop in", focusY: 0.8 },
          lines: [
            {
              speaker: HAWKEYE,
              text: "Two of us versus an army? I like those odds.",
              fallback: "Two heroes. One army. Somebody likes those odds.",
            },
            { speaker: SPIDER_WOMAN, text: "You like all odds, Clint." },
          ],
        },
      ],
      comicBeats: [
        { page: "01-siege", beatIndex: 0 },
        { page: "01-siege", beatIndex: 1 },
        { page: "01-siege", beatIndex: 2 },
        { page: "02-crossbones", beatIndex: 0 },
      ],
      stageLines: { 2: "Warm-up's over. Now I stop playing nice.", 3: "Hail Hydra. Say it with me." },
      stageNotes: { 2: "Piercing while armed" },
      briefing: {
        speaker: HAWKEYE,
        text: "Crossbones, a mountain full of prototypes, and a clock. Let's go.",
        fallback: "Crossbones, a mountain full of prototypes, and a clock.",
      },
      aftermath: {
        speaker: { kind: "npc", name: "S.H.I.E.L.D. quartermaster" },
        text: "Crossbones got the Gem, not the prototypes. They're yours — one each. Don't make me regret it.",
      },
      aftermathArt: { kind: "artboard", name: "pegasus-wrecked", text: "Panel art: wrecked P.E.G.A.S.U.S. lab" },
      rewindTaunt: "You came all this way to lose in a basement?",
    },
    {
      nodeId: "absorbing-man",
      title: "The Wall in the Snow",
      villain: "Absorbing Man",
      blurb:
        "Madame Hydra runs with the Gem. Crusher Creel stands in the way, and every turn he holds you buys her time.",
      recap: "Madame Hydra ran with the Gem. Crusher Creel stood in the way.",
      teaser: "Go around me? There ain't no around.",
      opener: [
        {
          art: { kind: "artboard", name: "hydra-convoy", text: "Panel art: a Hydra convoy in the snow", focusX: 0.15 },
          caption: "Twelve miles of mountain road. One truck carries the Gem. One man blocks the road.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Hit me with whatever you got. I'll be made of it in a second." }],
          sfx: "THOOM!",
        },
        {
          art: {
            kind: "artboard",
            name: "hydra-convoy",
            text: "Panel art: taillights vanishing",
            focusX: 0.85,
            focusY: 0.65,
          },
          lines: [
            {
              speaker: SPIDER_WOMAN,
              text: "Every minute we spend on him, she's another mile gone.",
              fallback: "Every minute spent on him, she's another mile gone.",
            },
          ],
        },
      ],
      comicBeats: [
        { page: "02-crossbones", beatIndex: 1 },
        { page: "02-crossbones", beatIndex: 2 },
        { page: "02-crossbones", beatIndex: 3 },
        { page: "03-absorbing-man", beatIndex: 0 },
      ],
      stageLines: { 2: "Stone, steel, snow — pick one. I already did." },
      briefing: {
        speaker: SPIDER_WOMAN,
        text: "He's a wall. We don't have to break him, we have to get past him.",
        fallback: "He's a wall. Nobody has to break him — just get past him.",
      },
      aftermath: {
        speaker: { kind: "npc", name: "S.H.I.E.L.D. field surgeon" },
        text: "Creel hit you hard enough to leave a mark. I can make the mark work for you. It doesn't come off.",
      },
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Told ya. Ain't no around.",
    },
    {
      nodeId: "taskmaster",
      title: "Welcome to Hydra City",
      villain: "Taskmaster",
      blurb: "New York wakes up under a Hydra flag. Rescue the heroes he's locked up and they'll join your deck.",
      recap: "Hydra City fell back to New York. The heroes he caged walked out with you.",
      teaser: "I've watched every fight you've ever had.",
      opener: [
        {
          art: {
            kind: "artboard",
            name: "hydra-manhattan",
            text: "Panel art: Hydra banners over Manhattan",
            focusX: 0.45,
            focusY: 0.2,
          },
          caption: "The Reality Gem flickers once. New York wakes up with a Hydra flag on every roof.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Your friends are in cages. You're next. I know your moves already." }],
        },
        {
          art: {
            kind: "artboard",
            name: "hydra-manhattan",
            text: "Panel art: the downed Quinjet",
            focusX: 0,
            focusY: 0.6,
          },
          lines: [
            {
              speaker: HAWKEYE,
              text: "Then we do something he's never seen. Improvise.",
              fallback: "Then do something he's never seen.",
            },
          ],
        },
      ],
      comicBeats: [
        { page: "03-absorbing-man", beatIndex: 1 },
        { page: "03-absorbing-man", beatIndex: 2 },
        { page: "03-absorbing-man", beatIndex: 3 },
        { page: "03-absorbing-man", beatIndex: 4 },
        { page: "04-hydra-tower", beatIndex: 0 },
        { page: "04-hydra-tower", beatIndex: 1 },
        { page: "04-hydra-tower", beatIndex: 2 },
        { page: "04-hydra-tower", beatIndex: 3 },
        { page: "05-taskmaster", beatIndex: 0 },
      ],
      stageLines: { 2: "Predictable. Every last one of you." },
      briefing: {
        speaker: SPIDER_WOMAN,
        text: "Quinjet's down, the city's flipped, and Taskmaster's hunting us. Here's what we walk in with.",
        fallback: "Quinjet's down, the city's flipped, and Taskmaster's hunting. Here's what the team walks in with.",
      },
      aftermath: {
        speaker: { kind: "npc", name: "A freed hero" },
        text: "You got us out. We're with you until this is over.",
      },
      aftermathArt: {
        kind: "artboard",
        name: "hydra-manhattan",
        text: "Panel art: opened cells",
        focusX: 0.85,
        focusY: 0.7,
      },
      rewindTaunt: "Told you. I've seen every move you've got.",
    },
    {
      nodeId: "zola",
      title: "The Mind in the Machine",
      villain: "Zola",
      blurb:
        "Arnim Zola's lab holds the allies Hydra couldn't turn. Leave them in his prison and they're gone for good.",
      recap: "Zola's body broke. His prison opened, or it didn't — the log remembers which.",
      teaser: "Flesh is a rough draft. Allow me to edit you.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: a lab of glass tanks" },
          caption: "Beneath the city, a laboratory that hums. Every tank holds someone who said no to Hydra.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Welcome, specimens. I have prepared a place for each of you." }],
        },
        {
          art: { kind: "note", text: "Panel art: hands on the glass" },
          lines: [
            {
              speaker: SPIDER_WOMAN,
              text: "Get the prison open first. Everything else can wait.",
              fallback: "The prison has to open first. Everything else can wait.",
            },
          ],
        },
      ],
      comicBeats: [
        { page: "05-taskmaster", beatIndex: 1 },
        { page: "05-taskmaster", beatIndex: 2 },
        { page: "05-taskmaster", beatIndex: 3 },
        { page: "05-taskmaster", beatIndex: 4 },
        { page: "06-zola", beatIndex: 0 },
      ],
      stageLines: { 2: "A new body. The old one had become sentimental." },
      briefing: {
        speaker: HAWKEYE,
        text: "Zola's got people in jars. We're taking them home.",
        fallback: "Zola has people in jars. They're going home.",
      },
      aftermath: {
        speaker: { kind: "npc", name: "S.H.I.E.L.D. field surgeon" },
        text: "You beat his machines in hero form. That mark of yours can take more now — if you want it.",
      },
      aftermathArt: { kind: "artboard", name: "zola-lab", text: "Panel art: Zola's broken chassis", focusY: 0.65 },
      rewindTaunt: "An imperfect experiment. We simply run it again.",
    },
    {
      nodeId: "red-skull",
      title: "Hail Nothing",
      villain: "Red Skull",
      blurb: "The Skull himself, the Gem in his hand and every delay you bought now counting against him.",
      recap: "Hydra fell. The Reality Gem put the world back.",
      teaser: "Kneel, and I may let you watch.",
      opener: [
        {
          art: {
            kind: "artboard",
            name: "skull-citadel",
            text: "Panel art: the Skull's citadel",
            focusY: 0.15,
            focusX: 1,
          },
          caption: "The last door. Behind it, a man who believes the whole world owes him its knees.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "With one Gem I rewrote a city. Imagine what I do with the world." }],
        },
        {
          art: {
            kind: "artboard",
            name: "skull-citadel",
            text: "Panel art: the heroes at the door",
            focusY: 0.85,
            focusX: 0,
          },
          lines: [
            {
              speaker: HAWKEYE,
              text: "Imagine what we do to that Gem.",
              fallback: "Somebody has to take that Gem off him.",
            },
          ],
        },
      ],
      comicBeats: [
        { page: "06-zola", beatIndex: 1 },
        { page: "06-zola", beatIndex: 2 },
        { page: "06-zola", beatIndex: 3 },
        { page: "06-zola", beatIndex: 4 },
        { page: "07-red-skull", beatIndex: 0 },
        { page: "07-red-skull", beatIndex: 1 },
      ],
      stageLines: { 2: "Hydra cannot be cut down. Only pruned.", 3: "Behold the new world!" },
      briefing: {
        speaker: SPIDER_WOMAN,
        text: "Everything we did got us here. Let's make it count.",
        fallback: "Everything the team did led here. Time to make it count.",
      },
      rewindTaunt: "The world was always going to kneel.",
    },
  ],
  finale: {
    caption: "With the Reality Gem, one flash of yellow light undoes it all.",
    headline: "Hydra falls.",
    sfx: "SHRAKK!",
    villainLine: "Hydra… cannot… be destroyed…",
    heroLines: ["Cut off one head, you get a nap.", "Now put the world back."],
  },
};
