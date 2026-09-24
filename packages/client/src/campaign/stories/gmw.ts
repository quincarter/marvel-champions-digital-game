/**
 * The Galaxy's Most Wanted (MC16) told through its six fan-made comic pages (`art/campaigns/gmw/pages/`,
 * credited to Joey Vazquez in `pages/CREDITS.md`) instead of single-picture panels — the box has
 * `art/README.md`'s "comic reader" art, so `pages` below is read by the reader, and `opener`/`aftermathArt` are
 * left as plain fallbacks for any screen not yet wired to it. Original flavor copy for this app; no rule lives
 * here (see `../story.ts`) — every mechanical word (Market prices, Collection contents, log values) comes from
 * `packages/cards/src/campaigns/gmw.ts` and the run's own log.
 *
 * Page → issue mapping (`docs/campaign-client-per-box.md` §4): #1 → 01-badoon, #2 and #3 split 02-museum's
 * panels between them, #4 → 03-nebula (04-knowhere is the scenario 4 aftermath page, wired when the Aftermath
 * screen gets its own comic pass), #5 → 05-ronan, the finale → 06-finale (wired with the Finale spread).
 */
import type { CampaignStory, ComicPage, StorySpeaker } from "../story.js";

const GROOT: StorySpeaker = { kind: "hero", identityId: "16001a", name: "Groot" };
const ROCKET: StorySpeaker = { kind: "hero", identityId: "16029a", name: "Rocket" };
const STAR_LORD: StorySpeaker = { kind: "npc", name: "Star-Lord" };
const GAMORA: StorySpeaker = { kind: "npc", name: "Gamora" };
const DRAX: StorySpeaker = { kind: "npc", name: "Drax" };
const VILLAIN: StorySpeaker = { kind: "villain" };

/**
 * Panel rectangles below are measured against each page's own pixel size (`sips -g pixelWidth -g pixelHeight`;
 * 1500×1500 for pages 1–4, 1920×993 for pages 5–6): a script thresholds each page for its near-white panel
 * borders against the dark/coloured gutters, locates the border lines around each panel (row/column white-run
 * detection, and for slanted panels the largest connected border blob), and every candidate rectangle is
 * rendered as a crop and reviewed against the source page before being written down (crops kept, ungit-tracked,
 * under `artifacts/qa/gmw-reader/rects/`). A background panel that bleeds off the page with no printed border
 * (page 1's starfield, page 3's dogfight, page 5's Ronan close-up) is measured to the page's own edge. Slanted
 * panels (page 3's two insets) are boxed to the bounding rectangle of the tilted frame, not the frame itself.
 * `02-museum`'s middle panel is genuinely solid black in the source art (the alarm cutting the museum's
 * lights) with no readable content, so no beat points a panel at it; its alarm caption/sfx are carried on the
 * neighboring right-inset beat instead.
 */
const PAGES: readonly ComicPage[] = [
  {
    file: "01-badoon",
    width: 1500,
    height: 1500,
    beats: [
      {
        // The full-bleed space scene behind the two bordered insets.
        panel: { x: 0, y: 0, w: 1500, h: 1500 },
        caption: "Somewhere past the Kree border.",
        lines: [],
      },
      {
        // Top-right bordered inset: the team walking the Milano's corridor.
        panel: { x: 985, y: 0, w: 436, h: 1080 },
        lines: [
          { speaker: DRAX, text: "The Badoon fleet is hailing us. They want a word." },
          { speaker: GAMORA, text: "They can have a fist instead." },
        ],
      },
      {
        // Bottom bordered strip: the fight breaks out.
        panel: { x: 73, y: 1088, w: 1351, h: 336 },
        caption: "The Badoon Want a Word",
        lines: [
          { speaker: ROCKET, text: "Word's out, boys — you picked the wrong ride to board!" },
          { speaker: GROOT, text: "I am Groot.", fallback: "Groot has already picked a Badoon up by the collar." },
        ],
        sfx: "KRA-KOOM!",
      },
    ],
  },
  {
    file: "02-museum",
    width: 1500,
    height: 1500,
    beats: [
      {
        // Top strip: the Collector's gallery, wall to wall of stolen specimens.
        panel: { x: 0, y: 0, w: 1500, h: 330 },
        caption: "The Collector keeps a piece of everything. Tonight, he's short a few.",
        lines: [],
      },
      {
        // Left inset: Rocket at the glass, the Collector's hologram calm.
        panel: { x: 62, y: 355, w: 412, h: 727 },
        lines: [
          { speaker: ROCKET, text: "Nice collection. Real shame about the break-in." },
          { speaker: VILLAIN, text: "You misunderstand. Nothing here ever leaves." },
        ],
      },
      {
        // Right inset: the hologram, no longer calm. The middle panel between this and the left inset is
        // deliberately solid black in the source art (the museum's alarm cutting the lights) with no readable
        // content of its own, so its alarm caption/sfx are carried here instead of pointing a beat at blank art.
        panel: { x: 979, y: 355, w: 442, h: 731 },
        caption: "Every alarm in the museum, at once.",
        lines: [{ speaker: VILLAIN, text: "Seal the exits. Nobody leaves my collection." }],
        sfx: "WEEOO-WEEOO!",
      },
      {
        // Bottom strip: the team runs for it, red emergency light.
        panel: { x: 0, y: 1100, w: 1500, h: 400 },
        caption: "The Great Escape",
        lines: [
          { speaker: ROCKET, text: "Run now, gloat later!" },
          { speaker: STAR_LORD, text: "Nobody's gloating till we're clear of the roof!" },
        ],
      },
    ],
  },
  {
    file: "03-nebula",
    width: 1500,
    height: 1500,
    beats: [
      {
        // Top strip: a ship streaking through a warp corridor.
        panel: { x: 0, y: 71, w: 1500, h: 241 },
        caption: "Nebula ran with the Collection before the alarms even finished ringing.",
        lines: [],
      },
      {
        // Left inset (slanted frame; box below is the bounding box of the tilted panel): Nebula's throne
        // room, an alien informant reporting in.
        panel: { x: 60, y: 330, w: 895, h: 685 },
        lines: [{ speaker: VILLAIN, text: "Hey, Ronan. You're in our spot." }],
      },
      {
        // Right inset (slanted frame; bounding box): a device detonating in open space.
        panel: { x: 945, y: 355, w: 465, h: 675 },
        caption: "One less Galactic Artifact for anyone to fight over.",
        lines: [],
        sfx: "THOOM!",
      },
      {
        // Bottom bleed: the dogfight through the nebula.
        panel: { x: 0, y: 1000, w: 1500, h: 500 },
        lines: [{ speaker: GAMORA, text: "She's not running from us. She's running to someone." }],
      },
    ],
  },
  {
    file: "04-knowhere",
    width: 1500,
    height: 1500,
    beats: [
      {
        // Wide top panel: the team back on the observation deck over Knowhere's skyline.
        panel: { x: 0, y: 0, w: 980, h: 1075 },
        caption: "Knowhere. The bill for the Collector's roof comes due.",
        lines: [],
      },
      {
        // Right inset: Nebula, cuffed, walked in by a captor.
        panel: { x: 985, y: 0, w: 425, h: 1075 },
        lines: [{ speaker: VILLAIN, text: "Careful. I bite." }],
      },
      {
        // Bottom strip: Nebula pleading her case, a guard behind her.
        panel: { x: 0, y: 1090, w: 1500, h: 400 },
        lines: [{ speaker: STAR_LORD, text: "Everybody's got a sob story out here. Yours better be good." }],
      },
    ],
  },
  {
    file: "05-ronan",
    width: 1920,
    height: 993,
    beats: [
      {
        // Top strip: Gamora and Nebula, uneasy allies now, a shadow closing in behind them.
        panel: { x: 0, y: 55, w: 855, h: 250 },
        caption: "The Kree don't forgive a debt. They collect it.",
        lines: [],
      },
      {
        // Tall left inset: Groot, Star-Lord and Rocket bracing for the drop.
        panel: { x: 60, y: 295, w: 390, h: 650 },
        lines: [{ speaker: STAR_LORD, text: "Whatever's coming through that door, we hit it first." }],
      },
      {
        // Tall middle inset: a Kree warship's silhouette closing in.
        panel: { x: 460, y: 285, w: 410, h: 650 },
        caption: "Every gun in the sector, pointed at one ship.",
        lines: [],
      },
      {
        // Big right background: Ronan's warship bearing down.
        panel: { x: 850, y: 0, w: 1070, h: 993 },
        lines: [],
        sfx: "SHRAKK!",
      },
      {
        // Bottom-right close-up: Ronan himself, a foreground figure breaking the frame with no printed
        // border (like Star-Lord on page 1) — bled to the page's own right/bottom edges so the crop lands on
        // his face instead of the empty starfield beside it.
        panel: { x: 1530, y: 650, w: 390, h: 343 },
        lines: [{ speaker: VILLAIN, text: "The Stone stays safe. You do not." }],
      },
    ],
  },
  {
    file: "06-finale",
    width: 1920,
    height: 993,
    beats: [
      {
        // The full spread: the whole team airborne, guns and blades out, mid-strike on Ronan's hammer.
        panel: { x: 0, y: 0, w: 1920, h: 993 },
        caption: "Every hero the Badoon, the Collector and Nebula ever crossed, in one place at once.",
        lines: [],
      },
      {
        // Leftmost tall inset: a fighter wing breaking apart under fire.
        panel: { x: 0, y: 0, w: 300, h: 993 },
        lines: [],
        sfx: "KA-BLAM!",
      },
      {
        // Middle tall inset: Nebula, turned ally for the day, firing from the bridge.
        panel: { x: 305, y: 70, w: 275, h: 880 },
        lines: [{ speaker: VILLAIN, text: "Don't get used to this." }],
      },
      {
        // Third tall inset: Captain Marvel and a hero volley lighting up the dark.
        panel: { x: 590, y: 185, w: 350, h: 760 },
        lines: [],
      },
    ],
  },
];

export const GMW_STORY: CampaignStory = {
  campaignId: "gmw",
  tagline: "A story in five issues",
  blurb:
    "The galaxy's most wanted just became the galaxy's most hunted. Every unit spent buys a little more firepower. Every unit saved buys nothing at all.",
  rosterBanner: "Whoever signs here spends the Collection with the rest of the crew. Choose wisely — it's shared.",
  castIdentityIds: ["16001a", "16029a"],
  pages: PAGES,
  issues: [
    {
      nodeId: "brotherhood-of-badoon",
      title: "The Badoon Want a Word",
      villain: "Brotherhood of Badoon",
      blurb: "A Badoon war fleet boards the Milano over a debt nobody remembers signing for.",
      recap: "The Badoon fleet fell back. Whatever they were hunting stayed on board.",
      teaser: "Word's out, boys — you picked the wrong ride to board!",
      opener: [
        {
          art: { kind: "note", text: "Panel art: a Badoon war fleet closing on the Milano" },
          caption: "Somewhere past the Kree border.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "The Badoon Empire does not ask twice." }],
          sfx: "KRA-KOOM!",
        },
        {
          art: { kind: "artboard", name: "badoon-squad", text: "Panel art: the crew squares off with the Badoon" },
          lines: [
            { speaker: ROCKET, text: "Word's out, boys — you picked the wrong ride to board!" },
            { speaker: GROOT, text: "I am Groot.", fallback: "Groot has already picked a Badoon up by the collar." },
          ],
        },
      ],
      comicBeats: [
        { page: "01-badoon", beatIndex: 0 },
        { page: "01-badoon", beatIndex: 1 },
        { page: "01-badoon", beatIndex: 2 },
      ],
      stageLines: { 2: "Terrestrial invasion. You cannot stop what is already landed." },
      briefing: {
        speaker: ROCKET,
        text: "Badoon on the hull and a debt collector on the comms. Let's make this quick.",
        fallback: "Badoon on the hull, and a debt collector on the comms.",
      },
      aftermath: {
        speaker: STAR_LORD,
        text: "Whatever they wanted this bad is worth cash somewhere. Pool it — we're keeping the lights on.",
      },
      aftermathArt: { kind: "note", text: "Panel art: the wrecked Badoon boarding pods" },
      rewindTaunt: "The Brotherhood does not miss twice.",
    },
    {
      nodeId: "infiltrate-the-museum",
      title: "The Collection",
      villain: "The Collector",
      blurb: "The Collector's gallery holds a wing of stolen specimens. Getting them out means getting in first.",
      recap: "The gallery's cases opened. What came out of them is worth more than what stayed in.",
      teaser: "Nice collection. Real shame about the break-in.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: wall-to-wall specimen cases" },
          caption: "The Collector keeps a piece of everything. Tonight, he's short a few.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "You misunderstand. Nothing here ever leaves." }],
        },
        {
          art: { kind: "note", text: "Panel art: Rocket at the glass, cracking a case" },
          lines: [{ speaker: ROCKET, text: "Funny. I was gonna say the same thing about your wallet." }],
        },
      ],
      comicBeats: [
        { page: "02-museum", beatIndex: 0 },
        { page: "02-museum", beatIndex: 1 },
      ],
      stageLines: { 2: "Alert every hall. Nothing leaves my collection." },
      briefing: {
        speaker: GROOT,
        text: "I am Groot.",
        fallback: "The gallery's stolen specimens are getting out tonight, one way or another.",
      },
      aftermath: {
        speaker: STAR_LORD,
        text: "Everything that fit in a bag is coming with us. Split it — the Collection's ours now.",
      },
      aftermathArt: { kind: "note", text: "Panel art: an emptied specimen wing" },
      rewindTaunt: "Every specimen returns to its case eventually.",
    },
    {
      nodeId: "escape-the-museum",
      title: "The Great Escape",
      villain: "The Collector",
      blurb: "Every alarm in the building is live and the exits are closing. Run now, gloat later.",
      recap: "The roof came off the Collector's museum. The crew, and the Collection, made it off first.",
      teaser: "Run now, gloat later!",
      opener: [
        {
          art: { kind: "note", text: "Panel art: red alarm lights down every hallway" },
          caption: "Every alarm in the museum, at once.",
          lines: [],
          sfx: "WEEOO-WEEOO!",
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Seal the exits. Nobody leaves my collection." }],
        },
        {
          art: { kind: "note", text: "Panel art: the crew sprinting for the roof" },
          lines: [
            { speaker: ROCKET, text: "Run now, gloat later!" },
            { speaker: STAR_LORD, text: "Nobody's gloating till we're clear of the roof!" },
          ],
        },
      ],
      comicBeats: [
        { page: "02-museum", beatIndex: 2 },
        { page: "02-museum", beatIndex: 3 },
      ],
      stageLines: { 2: "The roof is not an exit. It is a dead end with a view." },
      briefing: {
        speaker: ROCKET,
        text: "Roof's the only way out and it's got a Collector-shaped problem on it. Let's go.",
        fallback: "The roof is the only way out, and it has a Collector-shaped problem on it.",
      },
      aftermath: {
        speaker: GAMORA,
        text: "We're clear. Barely. Spend what you grabbed before the next debt collector shows up.",
      },
      aftermathArt: { kind: "note", text: "Panel art: the Milano lifting off the museum roof" },
      rewindTaunt: "Nobody leaves my collection.",
    },
    {
      nodeId: "nebula",
      title: "Somewhere Past the Kree Border",
      villain: "Nebula",
      blurb: "Nebula ran with the Collection before the alarms stopped ringing. Catching her means catching up.",
      recap: "Nebula's ship went down. What she was running turned out to matter more than the chase.",
      teaser: "She's not running from us. She's running to someone.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: a ship streaking through a warp corridor" },
          caption: "Nebula ran with the Collection before the alarms even finished ringing.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Hey, Ronan. You're in our spot." }],
        },
        {
          art: { kind: "note", text: "Panel art: the dogfight through the nebula" },
          lines: [{ speaker: GAMORA, text: "She's not running from us. She's running to someone." }],
        },
      ],
      comicBeats: [
        { page: "03-nebula", beatIndex: 0 },
        { page: "03-nebula", beatIndex: 1 },
        { page: "03-nebula", beatIndex: 2 },
        { page: "03-nebula", beatIndex: 3 },
      ],
      stageLines: { 2: "You cannot catch what is already gone." },
      briefing: {
        speaker: GAMORA,
        text: "Nebula's got a head start and someone waiting on the other end. We close the gap now.",
        fallback: "Nebula has a head start and someone waiting on the other end.",
      },
      aftermath: {
        speaker: STAR_LORD,
        text: "She's not talking. Not yet. Pool what you found on her ship — we'll need it for what's next.",
      },
      aftermathArt: { kind: "note", text: "Panel art: Nebula's ship, boarded and dark" },
      rewindTaunt: "You cannot catch what is already gone.",
    },
    {
      nodeId: "ronan-the-accuser",
      title: "Hey, Ronan. You're in Our Spot.",
      villain: "Ronan the Accuser",
      blurb: "The Kree don't forgive a debt — they collect it, with Ronan himself holding the bill.",
      recap: "Ronan's warship fell silent. The Stone he came for never left the Milano.",
      teaser: "The Stone stays safe. You do not.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: a Kree warship closing on the Milano" },
          caption: "The Kree don't forgive a debt. They collect it.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "The Stone stays safe. You do not." }],
          sfx: "SHRAKK!",
        },
        {
          art: { kind: "note", text: "Panel art: the crew bracing for the boarding" },
          lines: [{ speaker: STAR_LORD, text: "Whatever's coming through that door, we hit it first." }],
        },
      ],
      comicBeats: [
        { page: "05-ronan", beatIndex: 0 },
        { page: "05-ronan", beatIndex: 1 },
        { page: "05-ronan", beatIndex: 2 },
        { page: "05-ronan", beatIndex: 3 },
        { page: "05-ronan", beatIndex: 4 },
      ],
      stageLines: { 2: "Justice is not negotiated. It is delivered." },
      briefing: {
        speaker: GROOT,
        text: "I am Groot.",
        fallback: "Ronan wants the Stone and everyone standing between him and it. Nobody's moving.",
      },
      rewindTaunt: "The Accuser does not lose. He is merely delayed.",
    },
  ],
  finale: {
    caption: "Every hero the Badoon, the Collector and Nebula ever crossed, in one place at once.",
    headline: "Ronan falls.",
    sfx: "KA-BLAM!",
    villainLine: "This is not... an ending...",
    heroLines: ["Wanted list's looking a lot shorter.", "Somebody's buying the next round. Not it."],
  },
};
