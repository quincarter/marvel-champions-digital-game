/**
 * Sinister Motives (MC27) told through its eight fan-made comic pages (`art/campaigns/sm/pages/`, credited to Joey
 * Vazquez in `pages/CREDITS.md`) instead of single-picture panels — the box has `art/README.md`'s "comic reader"
 * art, so `pages` below is read by the reader, and `opener` is left as a plain fallback for any screen not yet
 * wired to it. Original flavor copy for this app; no rule lives here (see `../story.ts`) — every mechanical word
 * (the reputation track's own log fields, node numbers) comes from `packages/cards/src/campaigns/sm.ts` and the
 * run's own log.
 *
 * **Cast:** Ghost-Spider (Gwen Stacy, `27001a`) and Spider-Man (Miles Morales, `27030a`) ship in this box, so their
 * lines are written for them; every other hero shows the narrator `fallback` instead (`../story.ts`'s own rule).
 *
 * **Page → issue mapping** (`docs/campaign-client-per-box.md` §4): the design canvas's own slices are named for
 * their content rather than numbered by scenario, so the mapping below is read off the art itself, not off the
 * slug: `p1-swing` is the campaign's own cold open (no scenario is named on it, so it opens issue #1 alongside its
 * own page); `p2-sandman` → #1 (Sandman); `p3-oscorp` is Eddie Brock's own containment tube at the Oscorp/S.H.I.E.L.D.
 * facility Gwen and Miles are shown investigating — the symbiote's origin, so it opens issue #2 (Venom) rather than
 * showing Venom already loose; `p4-mysterio` reads as illusions (the shattering-mirror-shard band, and the
 * duplicated Green Goblin masks layered over a fight that already has a Venom and a Goblin in it at once) rather
 * than a second real monster, matching issue #3 (Mysterio) manufacturing exactly that kind of doubled, unstable
 * scene; `p5-six` is the full team-up splash (Vulture, Scorpion and a caped Kraven-alike beside the Goblin) → #4
 * (The Sinister Six); `p6-goblin` is a single merged Venom/Goblin figure in its own bottom-row panel → #5 (Venom
 * Goblin); `p7-shield` (a S.H.I.E.L.D. containment truck loading a restrained captive) closes #5's own Aftermath,
 * the villain finally in custody; `p8-home` (Miles swinging home to a family dinner) is the Finale's own spread.
 *
 * **Panel rectangles** below are measured by eye against each page's own pixel size (`sips -g pixelWidth -g
 * pixelHeight`; 1500×1510 for `01-p1-swing`/`08-p8-home`, 1450×1450 for the other six), the same "generous crop
 * around one clearly readable group of figures" reading `stories/mts.ts`'s own doc comment describes, rather than
 * a border-detection script — several of these pages mix clean-gutter grid panels with a dense diagonal-band
 * splash (`01-p1-swing`, `05-p5-six`) the way MTS's own five collage pages did throughout, so one consistent
 * by-eye pass reads better than switching methods panel to panel.
 *
 * **Every page is `cinematic: true`**, the same choice `mts.ts` made and its own doc comment explains: the
 * reader's continuous camera always fills the reading area with the current panel and pans/zooms panel to panel
 * (including across a page turn) rather than GMW's older dimmed-spotlight-on-a-lit-box look.
 */
import type { CampaignStory, ComicPage, StorySpeaker } from "../story.js";

const GHOST_SPIDER: StorySpeaker = { kind: "hero", identityId: "27001a", name: "Ghost-Spider" };
const SPIDER_MAN: StorySpeaker = { kind: "hero", identityId: "27030a", name: "Spider-Man" };
const VILLAIN: StorySpeaker = { kind: "villain" };
const NARRATOR: StorySpeaker = { kind: "narrator" };

const PAGES: readonly ComicPage[] = [
  {
    file: "01-p1-swing",
    width: 1500,
    height: 1510,
    cinematic: true,
    beats: [
      {
        // Top: Spider-Man and Ghost-Spider launch off a rooftop together, the skyline behind them.
        panel: { x: 0, y: 0, w: 1500, h: 830 },
        caption: "Two spiders, one city.",
        lines: [{ speaker: SPIDER_MAN, text: "Race you to the bridge." }],
      },
      {
        // A diagonal band cutting the frame: Spider-Man's cape-line and web arcing past the sunburst.
        panel: { x: 0, y: 700, w: 1500, h: 360 },
        sfx: "THWIP!",
        lines: [],
      },
      {
        // Bottom: Ghost-Spider drops through the frame, Spider-Man a small silhouette in the distance.
        panel: { x: 0, y: 1040, w: 1500, h: 470 },
        caption: "New York doesn't know it yet, but it's about to get crowded.",
        lines: [{ speaker: GHOST_SPIDER, text: "Last one to Queens buys the pizza." }],
      },
    ],
  },
  {
    file: "02-p2-sandman",
    width: 1450,
    height: 1450,
    cinematic: true,
    beats: [
      {
        // Top left: Sandman reaches over the block, pedestrians scattering below.
        panel: { x: 0, y: 0, w: 1060, h: 640 },
        caption: "Every grain of him wants something back.",
        lines: [{ speaker: VILLAIN, text: "Get out of my way!" }],
      },
      {
        // Top right: the two of them thrown clear, silhouetted against open sky.
        panel: { x: 1060, y: 0, w: 390, h: 640 },
        lines: [],
      },
      {
        // Middle band: Sandman's arm coils around Ghost-Spider mid-air, Spider-Man caught in the sand behind him.
        panel: { x: 0, y: 640, w: 1450, h: 390 },
        lines: [{ speaker: GHOST_SPIDER, text: "He's not holding still long enough to hit!" }],
      },
      {
        // Bottom: Sandman looms, a dazed Ghost-Spider and Spider-Man down in the grit.
        panel: { x: 0, y: 1030, w: 1450, h: 420 },
        caption: "Sandman doesn't need a plan. He just needs time.",
        lines: [{ speaker: SPIDER_MAN, text: "Okay. New plan." }],
      },
    ],
  },
  {
    file: "03-p3-oscorp",
    width: 1450,
    height: 1450,
    cinematic: true,
    beats: [
      {
        // Top left: Ghost-Spider looks past a containment tube at a man suspended in green fluid.
        panel: { x: 0, y: 0, w: 700, h: 400 },
        caption: "Oscorp keeps its worst ideas in the sub-basement.",
        lines: [],
      },
      {
        // Top right: the same tube, Spider-Man's own reflection caught in the glass.
        panel: { x: 700, y: 0, w: 750, h: 400 },
        lines: [{ speaker: SPIDER_MAN, text: "Whoever that is, he's not doing great in there." }],
      },
      {
        // Middle left: S.H.I.E.L.D. guards moving the tube deeper into the facility.
        panel: { x: 0, y: 400, w: 700, h: 390 },
        lines: [],
      },
      {
        // Middle right: Ghost-Spider webs the lock, Spider-Man already through the vent above.
        panel: { x: 700, y: 400, w: 750, h: 390 },
        lines: [{ speaker: GHOST_SPIDER, text: "Whatever they're keeping down here, it isn't staying kept." }],
      },
      {
        // Bottom left: the Oscorp tower, wide, at night.
        panel: { x: 0, y: 790, w: 500, h: 660 },
        caption: "OSCORP",
        lines: [],
      },
      {
        // Bottom middle: Spider-Man falling toward the breach below, silhouetted against fire.
        panel: { x: 500, y: 790, w: 430, h: 660 },
        lines: [],
      },
      {
        // Bottom right: the tube shatters. Something with teeth climbs out of it.
        panel: { x: 930, y: 790, w: 520, h: 660 },
        caption: "Eddie Brock isn't Eddie Brock anymore.",
        lines: [{ speaker: VILLAIN, text: "We are Venom." }],
        sfx: "KRAKKK!",
      },
    ],
  },
  {
    file: "04-p4-mysterio",
    width: 1450,
    height: 1450,
    cinematic: true,
    beats: [
      {
        // Top left: Venom looms behind Spider-Man and Ghost-Spider on a rooftop — too calm, too staged.
        panel: { x: 0, y: 0, w: 490, h: 790 },
        caption: "Something about this fight doesn't add up.",
        lines: [{ speaker: SPIDER_MAN, text: "That's not how he moves. That's not how any of this moves." }],
      },
      {
        // Top middle: the same Venom, alone, two shadow-figures watching from a rooftop door.
        panel: { x: 490, y: 0, w: 480, h: 790 },
        lines: [],
      },
      {
        // Top right: a hole punched clean through a ceiling, Ghost-Spider crouched in the wreckage above Venom.
        panel: { x: 970, y: 0, w: 480, h: 790 },
        lines: [{ speaker: GHOST_SPIDER, text: "None of this is real. Look for the seams." }],
      },
      {
        // Middle band: the whole scene fractures into mirror-shards, a dozen copies of one fight.
        panel: { x: 0, y: 790, w: 1450, h: 280 },
        sfx: "SHHHK!",
        caption: "He was never fighting Venom. He was fighting a screen full of them.",
        lines: [],
      },
      {
        // Bottom: rows of the same Green Goblin mask flicker on and off around the real Venom, real heroes.
        panel: { x: 0, y: 1070, w: 1450, h: 380 },
        lines: [{ speaker: VILLAIN, text: "Which one of me is going to hit you first? Guess." }],
      },
    ],
  },
  {
    file: "05-p5-six",
    width: 1450,
    height: 1450,
    cinematic: true,
    beats: [
      {
        // Narrow left strip: a dark corridor of hunched, winged shapes, Venom and the team small at the bottom.
        panel: { x: 0, y: 0, w: 470, h: 1450 },
        caption: "Beck's illusions cleared. What's left underneath is worse.",
        lines: [],
      },
      {
        // The wide splash: the whole roster at once — Vulture, a hooded hunter, a masked bomber and the Goblin,
        // Ghost-Spider firing a web-line up into the middle of it.
        panel: { x: 470, y: 0, w: 980, h: 1450 },
        caption: "Six villains. One night. Somebody didn't do the math.",
        lines: [{ speaker: SPIDER_MAN, text: "Six of them?! Since when do villains share?!" }],
        sfx: "THWIP!",
      },
    ],
  },
  {
    file: "06-p6-goblin",
    width: 1450,
    height: 1450,
    cinematic: true,
    beats: [
      {
        // Top left: Venom and the team on a rooftop, the Goblin peeling away overhead.
        panel: { x: 0, y: 0, w: 500, h: 790 },
        caption: "One villain left standing. That should have been good news.",
        lines: [],
      },
      {
        // Top middle: Venom alone against the skyline, crouched, waiting.
        panel: { x: 500, y: 0, w: 450, h: 790 },
        lines: [],
      },
      {
        // Top right: the Goblin's mask fills a broken doorway, a pumpkin bomb lit in one hand.
        panel: { x: 950, y: 0, w: 500, h: 790 },
        lines: [{ speaker: VILLAIN, text: "Trick or treat." }],
        sfx: "FWOOM!",
      },
      {
        // Middle band: crystalline spikes tear across the frame — the symbiote and the serum, meeting badly.
        panel: { x: 0, y: 790, w: 1450, h: 280 },
        lines: [],
      },
      {
        // Bottom: Venom and the Goblin's faces overlap, fused into one shrieking thing.
        panel: { x: 0, y: 1070, w: 1450, h: 380 },
        caption: "They shouldn't be able to do that. They just did.",
        lines: [{ speaker: VILLAIN, text: "We are so much more than either of them." }],
      },
    ],
  },
  {
    file: "07-p7-shield",
    width: 1450,
    height: 1450,
    cinematic: true,
    beats: [
      {
        // Full-height left panel: a S.H.I.E.L.D. containment truck loads a restrained figure under a gaudy Times
        // Square skyline, Captain America and the team watching it close.
        panel: { x: 0, y: 0, w: 760, h: 1450 },
        caption: "Whatever that was, it's somebody else's problem tonight.",
        lines: [{ speaker: GHOST_SPIDER, text: "Contained. Not fixed. There's a difference." }],
      },
      {
        // Top right: the containment cylinder inside the truck, agents bracing it between them.
        panel: { x: 760, y: 0, w: 690, h: 790 },
        lines: [{ speaker: SPIDER_MAN, text: "Keep an eye on that thing. It's had a bad night." }],
      },
      {
        // Bottom right: Nick Fury, close, unimpressed, between the two of them.
        panel: { x: 760, y: 790, w: 690, h: 660 },
        lines: [{ speaker: NARRATOR, text: "Fury doesn't say thank you. He just stops frowning for a second." }],
      },
    ],
  },
  {
    file: "08-p8-home",
    width: 1500,
    height: 1510,
    cinematic: true,
    beats: [
      {
        // Top: Spider-Man swings home over quiet rooftops, the moon behind him.
        panel: { x: 0, y: 0, w: 1500, h: 350 },
        caption: "Some nights end in Times Square. Some nights just end.",
        lines: [],
      },
      {
        // Second band: Miles, half in costume, raiding the fridge at 2am.
        panel: { x: 0, y: 350, w: 1500, h: 400 },
        lines: [{ speaker: SPIDER_MAN, text: "One sandwich. I earned one sandwich." }],
      },
      {
        // Bottom left: his parents in the kitchen doorway, arms crossed, not fooled for a second.
        panel: { x: 0, y: 750, w: 750, h: 760 },
        lines: [{ speaker: NARRATOR, text: "They know. They have known for a while." }],
      },
      {
        // Bottom right: the family hugs it out anyway, sandwich and all.
        panel: { x: 750, y: 750, w: 750, h: 760 },
        caption: "Home held too. That's the part nobody puts on the news.",
        lines: [{ speaker: SPIDER_MAN, text: "Love you guys." }],
      },
    ],
  },
];

export const SM_STORY: CampaignStory = {
  campaignId: "sm",
  tagline: "A story in five issues",
  blurb:
    "Every villain Spider-Man ever ducked comes looking for their turn at once, and every scenario the team wins or loses moves a mark down the reputation track — a debt or a favor riding into whatever's next.",
  rosterBanner:
    "How this run's reputation track sits carries into every scenario after it — a mark can hand the group a head start, or a problem it didn't have last time.",
  castIdentityIds: ["27001a", "27030a"],
  pages: PAGES,
  issues: [
    {
      nodeId: "sandman",
      title: "Wall-to-Wall",
      villain: "Sandman",
      blurb: "Flint Marko tears through midtown looking for a payday, one street at a time.",
      recap: "Sandman went back in the sand he came out of. The block's still standing. Mostly.",
      teaser: "Somebody's turning Fifth Avenue into a beach. Let's not let him finish.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: Spider-Man and Ghost-Spider launching off a rooftop together" },
          caption: "Two spiders, one city.",
          lines: [{ speaker: SPIDER_MAN, text: "Race you to the bridge." }],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Get out of my way!" }],
        },
        {
          art: { kind: "note", text: "Panel art: Sandman reaching over the block, pedestrians scattering below" },
          caption: "Every grain of him wants something back.",
          lines: [],
        },
      ],
      comicBeats: [
        { page: "01-p1-swing", beatIndex: 0 },
        { page: "02-p2-sandman", beatIndex: 0 },
        { page: "02-p2-sandman", beatIndex: 1 },
        { page: "02-p2-sandman", beatIndex: 2 },
        { page: "02-p2-sandman", beatIndex: 3 },
      ],
      stageLines: { 2: "Sandman doesn't hold a shape long enough to hit twice the same way." },
      stageNotes: { 2: "Reforms out of most attacks — go for a big hit while he's still solid." },
      briefing: {
        speaker: SPIDER_MAN,
        text: "First name on the list is Flint Marko, and he's already rearranged three blocks.",
        fallback: "First name on the list is Flint Marko, and he's already rearranged three blocks of midtown.",
      },
      aftermath: {
        speaker: GHOST_SPIDER,
        text: "One down. Reputation's already moving — let's see what it costs us before this is over.",
      },
      // `aftermathBeats` only drives the *summary* phase's own guided read, once a pick is committed
      // (`scenes/campaign/aftermath.ts`'s `#drawComicAftermath`) — reuses this issue's own last comic beat
      // (Sandman looming over a dazed Spider-Man and Ghost-Spider) rather than nothing.
      aftermathBeats: [{ page: "02-p2-sandman", beatIndex: 3 }],
      // The *picking* phase's own left panel (`#drawArt`) reads `aftermathArt` directly, never `aftermathBeats` —
      // a "note" placeholder here drew literal placeholder text even though this box already ships this
      // scenario's own villain art (`art/scenarios/sandman`), the same `{ kind: "villain" }` convention this
      // issue's own opener panels already use above. Real art now, not a second uncommissioned "after" panel.
      aftermathArt: { kind: "villain" },
      rewindTaunt: "Sand doesn't stay beaten. It just waits for the wind to change.",
    },
    {
      nodeId: "venom",
      title: "Something in the Tank",
      villain: "Venom",
      blurb: "Oscorp's sub-basement is holding something in a tube marked Do Not Open. It's already open.",
      recap: "Venom's loose in the city now, not the lab. That's not the improvement it sounds like.",
      teaser: "There's a man in a tank two floors down who really shouldn't be. Let's go look anyway.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: a man suspended in green fluid inside an Oscorp containment tube" },
          caption: "Oscorp keeps its worst ideas in the sub-basement.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "We are Venom." }],
        },
        {
          art: { kind: "note", text: "Panel art: the tube shattered, something with teeth climbing out of it" },
          caption: "Eddie Brock isn't Eddie Brock anymore.",
          lines: [],
        },
      ],
      comicBeats: [
        { page: "03-p3-oscorp", beatIndex: 0 },
        { page: "03-p3-oscorp", beatIndex: 1 },
        { page: "03-p3-oscorp", beatIndex: 2 },
        { page: "03-p3-oscorp", beatIndex: 3 },
        { page: "03-p3-oscorp", beatIndex: 4 },
        { page: "03-p3-oscorp", beatIndex: 5 },
        { page: "03-p3-oscorp", beatIndex: 6 },
      ],
      stageLines: { 2: "Venom stops pretending to be Eddie Brock about here." },
      briefingNotes: [
        {
          status: "done",
          title: "Reputation track carries over",
          detail: "Whatever the group marked last issue is already in effect for this one.",
          citation: "MC27 p. 22",
        },
        {
          status: "later",
          title: "The track keeps moving",
          detail: "Win or lose, tonight adds its own marks before the next issue's Setup runs.",
        },
      ],
      briefing: {
        speaker: GHOST_SPIDER,
        text: "Whatever they had chained up under Oscorp isn't chained up anymore, and it isn't happy about the wait.",
        fallback: "Whatever Oscorp had chained up in its sub-basement isn't chained up anymore.",
      },
      aftermath: {
        speaker: SPIDER_MAN,
        text: "Eddie's still in there somewhere. Doesn't make it less dangerous. Keep the reputation log honest.",
      },
      aftermathArt: { kind: "note", text: "Panel art: the breach, sealed, the tube dark and empty" },
      rewindTaunt: "The symbiote doesn't get tired. It gets patient.",
    },
    {
      nodeId: "mysterio",
      title: "Smoke and Mirrors",
      villain: "Mysterio",
      blurb: "Quentin Beck stages a fight that never happened, and the whole city believes it.",
      recap: "The screens went dark. What Mysterio actually wanted stayed a little bit unclear.",
      teaser: "None of what you're about to see is real. Try to remember that once it starts.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: Venom looming behind the team on a rooftop, too staged to be real" },
          caption: "Something about this fight doesn't add up.",
          lines: [{ speaker: SPIDER_MAN, text: "That's not how he moves. That's not how any of this moves." }],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "Which one of me is going to hit you first? Guess." }],
        },
        {
          art: {
            kind: "note",
            text: "Panel art: the scene fracturing into mirror-shards, a dozen copies of one fight",
          },
          caption: "He was never fighting Venom. He was fighting a screen full of them.",
          lines: [],
        },
      ],
      comicBeats: [
        { page: "04-p4-mysterio", beatIndex: 0 },
        { page: "04-p4-mysterio", beatIndex: 1 },
        { page: "04-p4-mysterio", beatIndex: 2 },
        { page: "04-p4-mysterio", beatIndex: 3 },
        { page: "04-p4-mysterio", beatIndex: 4 },
      ],
      stageLines: {
        2: "Mysterio never actually throws a punch. Everything you're fighting is somebody else's face on him.",
      },
      stageNotes: { 2: "Look past the illusion for the domes — they're the real target." },
      briefing: {
        speaker: SPIDER_MAN,
        text: "Beck doesn't fight fair, and half of what we're about to see won't even be real. Watch for the seams.",
        fallback: "Quentin Beck doesn't fight fair, and half of what's coming won't even be real.",
      },
      aftermath: {
        speaker: GHOST_SPIDER,
        text: "The domes are down. Whatever Beck actually wanted, we'll find out the hard way, same as always.",
      },
      aftermathArt: { kind: "note", text: "Panel art: a shattered illusion dome, smoke still rising off it" },
      rewindTaunt: "Beck doesn't need a second take. He's got a hundred of them queued up.",
    },
    {
      nodeId: "sinister-six",
      title: "Six of a Kind",
      villain: "The Sinister Six",
      blurb: "Every villain the team's already beaten shows up again, all at once, all with the same grudge.",
      recap: "Six villains walked in. However many walked out, the count in the log is what matters now.",
      teaser: "They found a way to share the grudge. That's new. That's bad.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: a dark corridor of hunched, winged shapes closing in" },
          caption: "Beck's illusions cleared. What's left underneath is worse.",
          lines: [],
        },
        {
          art: { kind: "villain" },
          lines: [],
        },
        {
          art: {
            kind: "note",
            text: "Panel art: the whole roster at once — Vulture, a hooded hunter, a masked bomber, the Goblin",
          },
          caption: "Six villains. One night. Somebody didn't do the math.",
          lines: [{ speaker: SPIDER_MAN, text: "Six of them?! Since when do villains share?!" }],
        },
      ],
      comicBeats: [
        { page: "05-p5-six", beatIndex: 0 },
        { page: "05-p5-six", beatIndex: 1 },
      ],
      stageLines: { 2: "Six villains means six ways for this to get worse at once." },
      briefing: {
        speaker: GHOST_SPIDER,
        text: "They're not taking turns tonight. Every name on the list shows up together, or none of us go home.",
        fallback: "Every villain on the list shows up together tonight, or none of the team goes home.",
      },
      aftermath: {
        speaker: SPIDER_MAN,
        text: "Whoever's left standing after that walks straight into whatever's coming next. Log it.",
      },
      aftermathArt: { kind: "note", text: "Panel art: the wreckage, six villains' worth, none of them still standing" },
      rewindTaunt: "Six villains and only one of them needs to still be free to try this again.",
    },
    {
      nodeId: "venom-goblin",
      title: "One Last Trick",
      villain: "Venom Goblin",
      blurb: "The symbiote and the serum met somewhere they shouldn't have, and neither of them let go.",
      recap: "New York's finally quiet. What's left of the Goblin and the symbiote is somebody else's file now.",
      teaser: "This is the one nobody's coming back from clean. Let's make sure it's them, not us.",
      opener: [
        {
          art: { kind: "note", text: "Panel art: the Goblin's mask filling a broken doorway, a pumpkin bomb lit" },
          lines: [{ speaker: VILLAIN, text: "Trick or treat." }],
        },
        {
          art: { kind: "villain" },
          lines: [{ speaker: VILLAIN, text: "We are so much more than either of them." }],
        },
        {
          art: {
            kind: "note",
            text: "Panel art: Venom and the Goblin's faces overlapping, fused into one shrieking thing",
          },
          caption: "They shouldn't be able to do that. They just did.",
          lines: [],
        },
      ],
      comicBeats: [
        { page: "06-p6-goblin", beatIndex: 0 },
        { page: "06-p6-goblin", beatIndex: 1 },
        { page: "06-p6-goblin", beatIndex: 2 },
        { page: "06-p6-goblin", beatIndex: 3 },
        { page: "06-p6-goblin", beatIndex: 4 },
      ],
      stageLines: { 2: "There's no more Osborn under the mask to reason with. Just the two of them, agreeing." },
      briefingNotes: [
        {
          status: "done",
          title: "The reputation track closes out here",
          detail: "Every mark the group made across the whole run is finally spent, for better or worse.",
          citation: "MC27 p. 22",
        },
        {
          status: "later",
          title: "Optional final score",
          detail: "The log can record how far the track got, once this one's decided either way.",
        },
      ],
      briefing: {
        speaker: SPIDER_MAN,
        text: "This is the one where everything we let ride finally comes due. All of it, tonight.",
        fallback: "Everything the run let ride finally comes due tonight, all at once.",
      },
      aftermathBeats: [{ page: "07-p7-shield", beatIndex: 0 }],
      aftermath: {
        speaker: GHOST_SPIDER,
        text: "Contained. Not fixed. There's a difference, and S.H.I.E.L.D. gets to worry about it now.",
      },
      aftermathArt: { kind: "note", text: "Panel art: a S.H.I.E.L.D. containment truck loading a restrained captive" },
      rewindTaunt: "The Goblin's had worse nights than this. He's not done yet.",
    },
  ],
  campaignLost: {
    headline: "The\nCity Burns.",
    line: "Venom Goblin took New York, and the reputation the team spent the whole run building went with it. This run of the campaign is over.",
  },
  finale: {
    caption: "Some nights end in Times Square. Some nights just end.",
    headline: "Home held.",
    sfx: "THWIP!",
    villainLine: "Enjoy the quiet. It's not going to last.",
    heroLines: ["One sandwich. I earned one sandwich.", "Love you guys."],
    page: "08-p8-home",
    stats: [{ kind: "rewinds", label: "Rewinds" }],
    crewLines: [
      { speaker: SPIDER_MAN, text: "One sandwich. I earned one sandwich.", fallback: "One sandwich. Earned it." },
      { speaker: GHOST_SPIDER, text: "Last one to Queens buys the pizza.", fallback: "Last one home buys the pizza." },
    ],
  },
};
