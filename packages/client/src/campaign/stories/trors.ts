/**
 * The Rise of Red Skull (MC10) told as five issues. Original flavor copy for this app — issues #1–#3 and the
 * finale follow `Marvel Champions game screens/Campaign - *.dc.html` word for word; #4 and #5 are written to match.
 * No rule lives here (see `../story.ts`).
 */
import type { CampaignStory, StorySpeaker } from "../story.js";

const HAWKEYE: StorySpeaker = { kind: "hero", identityId: "04001a", name: "Hawkeye" };
const SPIDER_WOMAN: StorySpeaker = { kind: "hero", identityId: "04031a", name: "Spider-Woman" };
const VILLAIN: StorySpeaker = { kind: "villain" };

export const TRORS_STORY: CampaignStory = {
  campaignId: "trors",
  tagline: "A story in five issues",
  blurb: "Hydra has an Infinity Gem and a plan for the whole world. Every win carries forward. Every scar does too.",
  rosterBanner: "Whoever signs here sees it through. All five issues. No substitutions.",
  castIdentityIds: ["04001a", "04031a"],
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
      stageLines: { 2: "Hydra cannot be cut down. Only pruned.", 3: "Behold the new world!" },
      briefing: {
        speaker: SPIDER_WOMAN,
        text: "Everything we did got us here. Let's make it count.",
        fallback: "Everything the team did led here. Time to make it count.",
      },
      rewindTaunt: "The world was always going to kneel.",
    },
  ],
  campaignLost: {
    headline: "Hydra\nWins.",
    line: "Red Skull conquered the world. This run of the campaign is over.",
  },
  finale: {
    caption: "With the Reality Gem, one flash of yellow light undoes it all.",
    headline: "Hydra falls.",
    sfx: "SHRAKK!",
    villainLine: "Hydra… cannot… be destroyed…",
    heroLines: ["Cut off one head, you get a nap.", "Now put the world back."],
  },
};
