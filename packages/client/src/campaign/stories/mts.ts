/**
 * The Mad Titan's Shadow (MC21) told through its six fan-made comic pages (`art/campaigns/mts/pages/`, credited to
 * Joey Vazquez in `pages/CREDITS.md`) instead of single-picture panels — the box has `art/README.md`'s "comic
 * reader" art, so `pages` below is read by the reader, and `opener` is left as a plain fallback for any screen not
 * yet wired to it. Original flavor copy for this app; no rule lives here (see `../story.ts`) — every mechanical
 * word (the campaign pool's own contents, log values) comes from `packages/cards/src/campaigns/mts.ts` and the
 * run's own log.
 *
 * **Cast:** Spectrum (Monica Rambeau, `21001a`) and Adam Warlock (`21031a`) ship in this box, so their lines are
 * written for them; every other hero shows the narrator `fallback` instead (`../story.ts`'s own rule).
 *
 * **Page → issue mapping** (`docs/campaign-client-per-box.md` §4): #1 (Ebony Maw) → `p1-titan`; #2 (Proxima
 * Midnight/Corvus Glaive's Tower Defense) and #3 (Thanos) split `p2-order`'s three panels between them (Loki's own
 * schemes on the left third read as #2's build-up, Thanos closing his gauntlet fist on the right third as #3's
 * cliffhanger); #3 also opens with `p3-battle`'s own citywide fight; #4 (Hela) → `p4-hel`; #5 (Loki) → `p5-asgard`;
 * the finale → `p6-feast`, Odin's own banquet.
 *
 * **Panel rectangles** below are measured by eye against each page's own pixel size (`sips -g pixelWidth -g
 * pixelHeight`; 1500×1500 for `p1-titan`/`p6-feast`, 1920×960 for the other four) rather than a border-detection
 * script (`stories/gmw.ts`'s own tool doesn't apply here: these five pages are dense photo-collage spreads with no
 * printed panel borders or gutters to threshold against) — each rectangle is a generous crop around one clearly
 * readable group of figures, checked by eye against the source page. A page's own background (the throne room
 * behind Ebony Maw, the snowfield behind Asgard) is left as the seam between beats rather than boxed on its own.
 */
import type { CampaignStory, ComicPage, StorySpeaker } from "../story.js";
import type { PoolCopy } from "../../view/campaign-pool-model.js";

/**
 * The campaign pool's own short voice (`view/campaign-pool-model.ts`'s `PoolCopy`), one entry per
 * `packages/cards/src/campaigns/mts.ts` pool field. Citations below are the reading (or writing) instruction's own
 * printed page (verified against `docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md`: p. 7 for issue #1's
 * SETUP/VICTORY, p. 13 for #2, p. 17 for #3, p. 21 for #4, p. 25 for #5) — never the log field's own citation
 * ("MC21 p. 28", where the printed log sheet itself lives), which `campaign-pool-model.ts` no longer reads for this.
 */
export const MTS_POOL_COPY: PoolCopy = {
  cosmoInPool: {
    destination: "In play, under {firstPlayer}'s control.",
    source: "Won in #1 · landing pad held",
    stillInPlayFor: "#1 · hold the landing pad",
  },
  securityBreachInPool: {
    destination: "Shuffled into the encounter deck.",
    source: "Let slip in #1 · Knowhere 1B completed",
    stillInPlayFor: "#1 · if Knowhere 1B is completed",
  },
  shawarmaInPool: {
    destination: "One copy shuffled into each deck.",
    source: "Won in #2 · the shop survived",
    stillInPlayFor: "#2 · keep the shop standing",
  },
  blackSwanInPool: {
    destination: "In play, engaged with {firstPlayer}.",
    source: "Escaped in #2 · not in the victory display",
    stillInPlayFor: "#2 · if she escapes",
  },
  systemShockInPool: {
    destination: "One copy shuffled into each deck.",
    source: "Let slip in #3 · Defensive Protocols wasn't beaten",
    stillInPlayFor: "#3: goes into the pool if Defensive Protocols isn't beaten.",
  },
  nornStoneInPool: {
    destination: "One copy shuffled into each deck.",
    source: "Won in #4 · Find the Norn Stones defeated",
    stillInPlayFor: "#4: win Find the Norn Stones.",
  },
  odinInPool: {
    destination: "In play, on his King side.",
    source: "Won in #4 · Odin recovered",
    stillInPlayFor: "#4: put Retrieve Odin's Armor in the victory display. You'll want him for Loki.",
  },
};

const SPECTRUM: StorySpeaker = { kind: "hero", identityId: "21001a", name: "Spectrum" };
const ADAM_WARLOCK: StorySpeaker = { kind: "hero", identityId: "21031a", name: "Adam Warlock" };
const VILLAIN: StorySpeaker = { kind: "villain" };
const NARRATOR: StorySpeaker = { kind: "narrator" };

const PAGES: readonly ComicPage[] = [
  {
    file: "01-p1-titan",
    width: 1500,
    height: 1500,
    beats: [
      {
        // Top: Ebony Maw kneeling at the foot of Thanos's throne.
        panel: { x: 0, y: 0, w: 1500, h: 820 },
        caption: "The Black Order kneels before its master.",
        lines: [{ speaker: VILLAIN, text: "Bring me the Stones. Bring me every one." }],
      },
      {
        // Middle: Thanos's fists close over the gauntlet.
        panel: { x: 0, y: 822, w: 1500, h: 310 },
        lines: [],
      },
      {
        // Bottom: the Black Order's forces storm Knowhere under covering fire, Cosmo diving for cover.
        panel: { x: 0, y: 1134, w: 1500, h: 366 },
        caption: "Knowhere, under fire.",
        lines: [{ speaker: NARRATOR, text: "The Black Order doesn't knock." }],
      },
    ],
  },
  {
    file: "02-p2-order",
    width: 1920,
    height: 960,
    beats: [
      {
        // Left third: Gamora's escape, Star-Lord and Nebula close behind.
        panel: { x: 0, y: 0, w: 640, h: 960 },
        caption: "Every one of them wants what Thanos wants.",
        lines: [],
      },
      {
        // Middle third: Loki walks a portal corridor toward Ebony Maw and Proxima Midnight's silhouettes.
        panel: { x: 640, y: 0, w: 640, h: 960 },
        lines: [{ speaker: VILLAIN, text: "The Black Order answers to no king. Not yet." }],
      },
      {
        // Right third: Thanos closes his fist around the gauntlet as Loki looks down from a rooftop.
        panel: { x: 1280, y: 0, w: 640, h: 960 },
        caption: "Every stone he takes is a city that falls.",
        lines: [],
        sfx: "KRAKK.",
      },
    ],
  },
  {
    file: "03-p3-battle",
    width: 1920,
    height: 960,
    beats: [
      {
        // Left: the street-level fight — Photon's own energy blast lights the block.
        panel: { x: 0, y: 0, w: 770, h: 960 },
        caption: "Every hero on Earth answers the tower's alarm.",
        lines: [{ speaker: SPECTRUM, text: "I've got the skyline. Somebody take the street!" }],
      },
      {
        // Middle: the tall inset — Star-Lord and Gamora breaking into a vault, Ronan's own fury below.
        panel: { x: 770, y: 0, w: 520, h: 960 },
        lines: [],
      },
      {
        // Top right: Thanos's gauntlet fist closes on a stone, blinding light.
        panel: { x: 1290, y: 0, w: 630, h: 400 },
        lines: [{ speaker: VILLAIN, text: "One more, and the universe kneels with you." }],
      },
      {
        // Bottom right: the Avengers assemble in the air over the tower, Thor's hammer swinging.
        panel: { x: 1290, y: 400, w: 630, h: 560 },
        caption: "Avengers Tower holds. For now.",
        lines: [{ speaker: ADAM_WARLOCK, text: "Hold the line. I'll close the gap." }],
      },
    ],
  },
  {
    file: "04-p4-hel",
    width: 1920,
    height: 960,
    beats: [
      {
        // Top left: the team gathers, the Infinity Gauntlet held up between them.
        panel: { x: 0, y: 0, w: 790, h: 590 },
        caption: "The Stones are gathered. The war isn't over.",
        lines: [],
      },
      {
        // Bottom left: a quiet aftermath — Captain America and Thor, then the crew filing past.
        panel: { x: 0, y: 590, w: 790, h: 370 },
        lines: [{ speaker: NARRATOR, text: "One night off. The universe can wait that long." }],
      },
      {
        // Middle: Thor off duty, She-Hulk beside him, a party in full swing.
        panel: { x: 790, y: 0, w: 530, h: 960 },
        lines: [{ speaker: SPECTRUM, text: "You're allowed to sit down, you know." }],
      },
      {
        // Top right: the party photo, Spider-Man, Photon and friends toasting.
        panel: { x: 1320, y: 0, w: 600, h: 480 },
        lines: [],
        sfx: "CLINK!",
      },
      {
        // Bottom right: Hela's throne of chains, and Odin bound before her.
        panel: { x: 1320, y: 480, w: 600, h: 480 },
        caption: "Hel doesn't send invitations.",
        lines: [{ speaker: VILLAIN, text: "Your king is mine now." }],
      },
    ],
  },
  {
    file: "05-p5-asgard",
    width: 1920,
    height: 960,
    beats: [
      {
        // Top left: Odin kneeling in the ice, Thor at his side, a sword driven into the frost.
        panel: { x: 0, y: 0, w: 600, h: 600 },
        caption: "Asgard's king, chained in his own realm's ice.",
        lines: [],
      },
      {
        // Bottom left: Loki, alone on a borrowed throne.
        panel: { x: 0, y: 600, w: 600, h: 360 },
        lines: [{ speaker: VILLAIN, text: "A throne is a throne, however it's won." }],
      },
      {
        // Middle: the whole team charges Loki's stronghold, Thor's hammer crackling.
        panel: { x: 600, y: 0, w: 700, h: 960 },
        caption: "Open the dungeons. Bring the King home.",
        lines: [{ speaker: ADAM_WARLOCK, text: "Five Lokis or one, he answers for all of them." }],
        sfx: "KA-THOOM!",
      },
      {
        // Right: Loki, gauntlet raised, framed by his own stolen throne room.
        panel: { x: 1300, y: 0, w: 620, h: 960 },
        lines: [{ speaker: VILLAIN, text: "Every stone you gave up chasing me. Was it worth it?" }],
      },
    ],
  },
  {
    file: "06-p6-feast",
    width: 1500,
    height: 1500,
    beats: [
      {
        // Top: Odin, restored to his throne, waves the honor guard aside.
        panel: { x: 0, y: 0, w: 1500, h: 355 },
        caption: "Odin, King again.",
        lines: [{ speaker: NARRATOR, text: "Let them in. Every one of them earned this hall." }],
      },
      {
        // Middle left: Captain America, Odin and Star-Lord, old business set aside.
        panel: { x: 0, y: 355, w: 630, h: 745 },
        lines: [{ speaker: ADAM_WARLOCK, text: "A king who says thank you. That's a first." }],
      },
      {
        // Middle right: the whole table feasting.
        panel: { x: 630, y: 355, w: 870, h: 745 },
        caption: "A hero's welcome, Asgard-sized.",
        lines: [{ speaker: SPECTRUM, text: "I could get used to this part." }],
      },
      {
        // Bottom: Groot, Rocket, and the Black Order's own captive, waist-deep in gold.
        panel: { x: 0, y: 1100, w: 1500, h: 400 },
        lines: [],
        sfx: "CLATTER!",
      },
    ],
  },
];

export const MTS_STORY: CampaignStory = {
  campaignId: "mts",
  tagline: "A story in five issues",
  blurb:
    "Thanos wants every Stone in the universe, and the shadow he casts reaches from Knowhere to Asgard. Every card the campaign pool carries forward is a debt paid, or one still owed.",
  rosterBanner:
    "The campaign pool travels with the group, not with any one seat. What one issue wins or loses, every issue after inherits.",
  castIdentityIds: ["21001a", "21031a"],
  poolCopy: MTS_POOL_COPY,
  pages: PAGES,
  issues: [
    {
      nodeId: "ebony-maw",
      title: "The Black Order Lands",
      villain: "Ebony Maw",
      blurb: "Ebony Maw's forces hit Knowhere first, hunting for anything Thanos might still need.",
      recap: "Knowhere held. What the Black Order left behind didn't leave with them.",
      teaser: "Somebody's coming for Knowhere. Let's not make it easy.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: Ebony Maw kneeling before Thanos's throne" },
          caption: "The Black Order kneels before its master.",
          lines: [{ speaker: VILLAIN, text: "Bring me the Stones. Bring me every one." }],
        },
        {
          art: { kind: "villain" },
          lines: [],
        },
        {
          art: { kind: "note", text: "Panel art: the Black Order storms Knowhere" },
          caption: "Knowhere, under fire.",
          lines: [{ speaker: NARRATOR, text: "The Black Order doesn't knock." }],
        },
      ],
      comicBeats: [
        { page: "01-p1-titan", beatIndex: 0 },
        { page: "01-p1-titan", beatIndex: 1 },
        { page: "01-p1-titan", beatIndex: 2 },
      ],
      stageLines: { 2: "Ebony Maw does not repeat himself. He simply takes what's owed." },
      briefing: {
        speaker: ADAM_WARLOCK,
        text: "Knowhere's under siege, and whatever Ebony Maw is looking for, we get there first.",
        fallback: "Knowhere's under siege. Whoever holds it when this is over keeps the campaign pool honest.",
      },
      aftermath: {
        speaker: SPECTRUM,
        text: "Whatever we carry out of here rides with us the rest of the way. Let's make it count.",
      },
      aftermathArt: { kind: "note", text: "Panel art: Knowhere's landing pad, held" },
      rewindTaunt: "The Black Order does not retreat. It regroups.",
    },
    {
      nodeId: "tower-defense",
      title: "Two Villains, One Tower",
      villain: "Proxima Midnight & Corvus Glaive",
      blurb:
        "Proxima Midnight and Corvus Glaive hit Avengers Tower from both sides at once — two main schemes, two villains, one very bad afternoon.",
      recap: "The tower stood. Whatever Thanos's lieutenants left cracked in the walls hasn't been fixed yet.",
      teaser: "Two villains, one tower. Pick your fight.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: Loki walking a portal corridor" },
          lines: [{ speaker: VILLAIN, text: "The Black Order answers to no king. Not yet." }],
        },
        {
          art: { kind: "villain" },
          lines: [],
        },
        {
          art: { kind: "note", text: "Panel art: Avengers Tower under a two-front assault" },
          caption: "Every hero on Earth answers the tower's alarm.",
          lines: [],
        },
      ],
      comicBeats: [
        { page: "02-p2-order", beatIndex: 1 },
        { page: "02-p2-order", beatIndex: 2 },
      ],
      stageLines: { 2: "Proxima Midnight's spear finds every gap in a defense." },
      briefing: {
        speaker: SPECTRUM,
        text: "Two villains, two schemes, one tower. We split up or we lose it all.",
        fallback: "Two villains, two schemes, one tower.",
      },
      rewindTaunt: "Corvus Glaive's blade cuts through anything that isn't already broken.",
    },
    {
      nodeId: "thanos",
      title: "The Mad Titan Himself",
      villain: "Thanos",
      blurb: "Thanos comes to Earth in person for the last Stones anyone's still holding.",
      recap: "Thanos fell back — for now. Whatever the fight cost stays owed either way.",
      teaser: "He's here. In person. For all of it.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: the citywide battle around Avengers Tower" },
          caption: "Every hero on Earth answers the tower's alarm.",
          lines: [{ speaker: SPECTRUM, text: "I've got the skyline. Somebody take the street!" }],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "One more, and the universe kneels with you." }],
        },
        {
          art: { kind: "note", text: "Panel art: the Avengers assemble in the air over the tower" },
          caption: "Avengers Tower holds. For now.",
          lines: [{ speaker: ADAM_WARLOCK, text: "Hold the line. I'll close the gap." }],
        },
      ],
      comicBeats: [
        { page: "03-p3-battle", beatIndex: 0 },
        { page: "03-p3-battle", beatIndex: 2 },
        { page: "03-p3-battle", beatIndex: 3 },
      ],
      stageLines: { 2: "Thanos needs no lieutenants for this. Only Stones." },
      briefing: {
        speaker: ADAM_WARLOCK,
        text: "Thanos himself, and every Stone he's still missing. This is the whole fight.",
        fallback: "Thanos himself, in person, for whatever Stones are left.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Pool resolved in printed order",
          detail: "Allies and deck cards first, then enemies.",
          citation: "MC21 p. 17",
        },
        {
          status: "done",
          title: "Infinity Gauntlet attached to Thanos",
          detail: "Six Stone environments shuffled into their own deck.",
          citation: "MC21 p. 16",
        },
        {
          status: "later",
          title: "Pool keeps growing",
          detail: "A win here can add System Shock. It hurts, so beat Defensive Protocols.",
        },
      ],
      aftermath: {
        speaker: SPECTRUM,
        text: "He'll be back for the rest. Pool everything that's still standing — we'll need it.",
      },
      aftermathArt: { kind: "note", text: "Panel art: the tower, scarred but standing" },
      rewindTaunt: "The Mad Titan does not fear a rematch.",
    },
    {
      nodeId: "hela",
      title: "A Night Off, Then Hel",
      villain: "Hela",
      blurb: "One quiet night at Avengers Tower — then Hela drags Odin down into her own realm.",
      recap: "Hela's grip loosened. What she still holds, she holds for a reason.",
      teaser: "One night off. Hel had other plans.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: the team's own party at Avengers Tower" },
          caption: "One night off. The universe can wait that long.",
          lines: [{ speaker: SPECTRUM, text: "You're allowed to sit down, you know." }],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Your king is mine now." }],
        },
        {
          art: { kind: "note", text: "Panel art: Hela's throne of chains, Odin bound before her" },
          caption: "Hel doesn't send invitations.",
          lines: [],
        },
      ],
      comicBeats: [
        { page: "04-p4-hel", beatIndex: 2 },
        { page: "04-p4-hel", beatIndex: 4 },
      ],
      stageLines: { 2: "Hela does not bargain. She collects." },
      briefing: {
        speaker: SPECTRUM,
        text: "Odin's gone, and Hela's holding him. Norn Stones or not, we're not leaving him there.",
        fallback: "Odin's gone. Hela's holding him, and we're not leaving him there.",
      },
      aftermath: {
        speaker: ADAM_WARLOCK,
        text: "Whatever we're carrying to Asgard, it travels with us now. Loki's waiting.",
      },
      aftermathArt: { kind: "note", text: "Panel art: the Norn Stone, recovered" },
      rewindTaunt: "Hel keeps everything it takes. Nothing leaves twice.",
    },
    {
      nodeId: "loki",
      title: "All Hail King Loki",
      villain: "Loki",
      blurb:
        "One of five Lokis sits Asgard's throne with the Infinity Gauntlet on his hand. Only the campaign pool says which cards make the final fight.",
      recap: "Loki's rule ended. Asgard's crown goes back where it belongs.",
      teaser: "A king in a stolen crown. Time to take it back.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: Loki alone on a borrowed throne" },
          lines: [{ speaker: VILLAIN, text: "A throne is a throne, however it's won." }],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Every stone you gave up chasing me. Was it worth it?" }],
        },
        {
          art: { kind: "note", text: "Panel art: the team storms Loki's stronghold" },
          caption: "Open the dungeons. Bring the King home.",
          lines: [{ speaker: ADAM_WARLOCK, text: "Five Lokis or one, he answers for all of them." }],
        },
      ],
      comicBeats: [
        { page: "05-p5-asgard", beatIndex: 1 },
        { page: "05-p5-asgard", beatIndex: 3 },
        { page: "05-p5-asgard", beatIndex: 2 },
      ],
      stageLines: {
        2: "Loki wears the Gauntlet like it was always his.",
      },
      briefing: {
        speaker: ADAM_WARLOCK,
        text: "Everything we carried, all at once. Odin's here. So is everything we let slip.",
        fallback: "Everything the campaign carried comes due here, all at once.",
      },
      briefingNotes: [
        {
          status: "done",
          title: "Pool resolved in printed order",
          detail: "Groups run top to bottom, matching the printed setup.",
          citation: "MC21 p. 25",
        },
        {
          status: "done",
          title: "Infinity Gauntlet attached to Loki",
          detail: "Six Stone environments shuffled into their own deck.",
          citation: "MC21 p. 16",
        },
        {
          status: "later",
          title: "Pool closes",
          detail: "Final issue. Nothing more is added. The log closes after this one.",
        },
      ],
      rewindTaunt: "There is always another Loki behind the throne.",
    },
  ],
  // MC21 p. 25's own Expert Campaign Only defeat instruction: "If the players lose this game, Loki exerts his
  // rule over all the universe and the players lose the campaign." — Expert Campaign only, the same shape as
  // MC10's own Red Skull loss and MC16's own Ronan loss.
  campaignLost: {
    headline: "Loki\nReigns.",
    line: "Loki claimed Asgard's throne, and the universe with it. This run of the campaign is over.",
  },
  finale: {
    caption: "Odin's table is set for everyone who ever bled for it.",
    headline: "Odin feasts.",
    sfx: "CLATTER!",
    villainLine: "Enjoy your feast. The universe still owes me.",
    heroLines: ["I could get used to this part.", "A king who says thank you. That's a first."],
    page: "06-p6-feast",
    stats: [{ kind: "rewinds", label: "Rewinds" }],
    crewLines: [
      { speaker: SPECTRUM, text: "I could get used to this part.", fallback: "I could get used to this part." },
      {
        speaker: ADAM_WARLOCK,
        text: "A king who says thank you. That's a first.",
        fallback: "A king who says thank you. That's a first.",
      },
    ],
  },
};
