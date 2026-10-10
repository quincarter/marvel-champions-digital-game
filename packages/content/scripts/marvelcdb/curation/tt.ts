/**
 * Trickster Takeover (MC55, cycle 9 scenario pack) curation: the pack's 66 top-level MarvelCDB records (Enchantress,
 * God of Lies, the Trickster Magic modular set and its four linked allies) and the two scenarios. No hero, player-side,
 * obligation or nemesis cards.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, never wired
 * into the data), "insert" is the MC55 rulebook (https://hallofheroeslcg.com/wp-content/uploads/2025/08/mc55_rulebook-web.pdf,
 * 24 pages, not saved in the repo; page numbers are its printed pages; text extracted and read 2026-10-09, quoted in
 * docs/phase7-wave9-sources.md section 3), "survey" is docs/phase7-wave9-data-survey.md.
 *
 * Scope: single-table play only (the insert's Single Group Mode, one group of 1 to 4 players). Epic Multiplayer Mode
 * (insert pp. 11 to 17: several groups, pods, simultaneous play, an event organizer) is not built.
 */
import { traitOf } from "../normalize/brand.ts";
import type { PackCuration } from "./types.ts";

/** The five Hypnotic Gaze attachments (55007a to 55011a) print no "Attach to" sentence. */
const gaze = (code: string) => ({
  code,
  reason:
    'Hypnotic Gaze prints no "Attach to" sentence: Prime Real Estate 1A\'s Setup attaches a random one to each identity. Without the field the normalizer reports an attachment with no attach rule. Never applied to text.',
  evidence:
    'Raw text of 55004a ("Attach a random Hypnotic Gaze to each identity (players cannot look at the reverse sides). Set each remaining Hypnotic Gaze aside.") and scan 55004a.png; insert p. 7 ("Enchantment attachments are double-sided attachments that are dealt to each player during setup"). The card text itself ("Your identity gains the Defiant trait") names the host as the identity.',
  impliedAttachHost: { kind: "yourIdentity" } as const,
});

/** A counter type the pack's own text defines with no `uses` keyword (`BaseCard.definedCounterTypes`, spec 1.6, 1.15 item 4). */
const counterType = (code: string, type: string, title: string, face: string) => ({
  code,
  reason: `${title}${face} defines the "${type}" counter type in its own text, or the other face of this double-sided card does, with no Uses keyword (the card prints no Uses); the card needs the type so a moved or placed counter is a ${type} counter (RRG 1.8 "All-Purpose Counter", p. 6).`,
  evidence: `Card text (MarvelCDB raw) and scan ${code}.png (read 2026-10-10). docs/phase7-wave9.md section 1.15 item 4 and section 8.1 item 21.`,
  definedCounterTypes: [type],
});

/** A Fading Figment (55029b to 55032b): the back of an Avatar of Loki prints "HIT POINTS \u221e" (scan); MarvelCDB sends health 99. */
const figment = (code: string) => ({
  code,
  reason:
    'The Fading Figment prints "HIT POINTS \u221e" (infinite hit points); MarvelCDB sends `health: 99`, a sentinel, not a printed value. Without the correction the normalizer emits 99 hit points, which a villain card could be reduced to zero from.',
  evidence: `Scan ${code}.png (read 2026-10-10): the footer reads "GOD OF LIES (3/34) / HIT POINTS \u221e", no per player icon, SCH and ATK dashes. RRG 1.8 "Hit Points", p. 22 (infinite hit points). docs/phase7-wave9.md section 1.15 item 3. Same encoding as The Collector's and Hela's Wounded faces.`,
  infiniteHp: true as const,
});

export const TT_CURATION: PackCuration = {
  packCode: "tt",
  cycle: { id: "cycle9", name: "Agents of S.H.I.E.L.D.", order: 9 },
  pack: {
    name: "Trickster Takeover",
    releaseDate: "2025-08-15",
    releaseDateSource:
      "Hall of Heroes Trickster Takeover page (https://hallofheroeslcg.com/trickster-takeover/), used as a pointer; the date is not stated in the MC55 insert. UNVERIFIED against a primary FFG source.",
  },
  outDir: "src/data/tt",
  exportPrefix: "TT",
  handAuthoredModules: [],

  corrections: [
    gaze("55007a"),
    gaze("55008a"),
    gaze("55009a"),
    gaze("55010a"),
    gaze("55011a"),
    {
      code: "55034a",
      reason:
        'Intense Focus prints no "Attach to" sentence: Mischief and Mayhem 1A\'s Setup attaches it to the Avatar of Loki villain in expert mode (and the God of Lies 1B When Revealed does it in standard mode). Without the field the normalizer reports an attachment with no attach rule. Never applied to text.',
      evidence:
        'Raw text of 55033a Setup step 3: "In standard mode, set the Intense Focus attachment aside. In expert mode, attach it to the Avatar of Loki villain in play." Raw text of 55027b: "Each group in standard mode attaches their set-aside Intense Focus to the Avatar of Loki villain in their game area." The card text ("The Avatar of Loki villain gets +2 hit points and gains steady") names the host. Needs the villain-by-trait host (`qualified`, category `villain`).',
      impliedAttachHost: { kind: "qualified", category: "villain", trait: traitOf("AVATAR OF LOKI") },
    },
    {
      code: "55035",
      reason: 'MarvelCDB reads "Attach to your identiy."; the card prints "Attach to your identity."',
      evidence:
        'Scan 55035.png (read 2026-10-09): "Attach to your identity." Survey section 7 (S16). Without the fix the normalizer finds no attach rule.',
      textReplace: { find: "Attach to your identiy.", replace: "Attach to your identity." },
    },
    {
      code: "55022",
      reason:
        'MarvelCDB reads "When Revealed"; Spellbound prints "When Defeated". The ability id becomes `55022.when-defeated` (it was `55022.when-revealed`).',
      evidence:
        'Scan 55022.png (read 2026-10-10): "When Defeated: Each player whose identity has the Defiant trait places 1 charm counter on the Enchantment card in their play area. Each player whose identity has the Enthralled trait discards a card they control." Threat 4 with a single crisis-type icon; no boost box. docs/phase7-wave9.md section 1.15 item 1.',
      textReplace: { find: "When Revealed", replace: "When Defeated" },
    },
    figment("55029b"),
    figment("55030b"),
    figment("55031b"),
    figment("55032b"),
    {
      code: "55028b",
      reason:
        "Worlds Collide's B side prints only a target threat (2 per group): no starting threat and no acceleration. MarvelCDB sends null for both without a `*_fixed` flag, which reads as missing data.",
      evidence:
        'Scan 55028b.png (read 2026-10-09): only the "2 per group" target badge, no starting-threat or acceleration badge. Insert p. 18: "Worlds Collide cannot have acceleration tokens placed on it." Survey section 5.2 (S3). RRG 1.8 "Dash (Value)", p. 15.',
      dashedThreatFields: ["startingThreat", "acceleration"],
    },
    counterType("55007a", "charm", "Hypnotic Gaze", " (Enchantment side)"),
    counterType("55007b", "charm", "Hypnotic Gaze", " (Trance side)"),
    counterType("55008a", "charm", "Hypnotic Gaze", " (Enchantment side)"),
    counterType("55008b", "charm", "Hypnotic Gaze", " (Trance side)"),
    counterType("55009a", "charm", "Hypnotic Gaze", " (Enchantment side)"),
    counterType("55009b", "charm", "Hypnotic Gaze", " (Trance side)"),
    counterType("55010a", "charm", "Hypnotic Gaze", " (Enchantment side)"),
    counterType("55010b", "charm", "Hypnotic Gaze", " (Trance side)"),
    counterType("55011a", "charm", "Hypnotic Gaze", " (Enchantment side)"),
    counterType("55011b", "charm", "Hypnotic Gaze", " (Trance side)"),
    counterType("55029a", "shatter", "Avatar of Loki", " (Avatar side)"),
    counterType("55029b", "shatter", "Fading Figment", " (Figment side)"),
    counterType("55030a", "shatter", "Avatar of Loki", " (Avatar side)"),
    counterType("55030b", "shatter", "Fading Figment", " (Figment side)"),
    counterType("55031a", "shatter", "Avatar of Loki", " (Avatar side)"),
    counterType("55031b", "shatter", "Fading Figment", " (Figment side)"),
    counterType("55032a", "shatter", "Avatar of Loki", " (Avatar side)"),
    counterType("55032b", "shatter", "Fading Figment", " (Figment side)"),
    counterType("55052", "synergy", "Synergy environment", ""),
    counterType("55053", "synergy", "Synergy environment", ""),
    counterType("55054", "synergy", "Synergy environment", ""),
    counterType("55055", "synergy", "Synergy environment", ""),
  ],

  errata: [],

  // The Avatars of Loki flip to Fading Figment (a different title on the back, 55029b to 55032b); Loki, God of Lies
  // 55027a/b keeps one title on both faces.
  villainFaceNamesMayDiffer: ["god_of_lies"],

  scriptingNotes: {
    "55029b.when-revealed":
      "Shatter the illusion: follow the Shatter the Illusion rules card (scenario `referenceCards`, no MarvelCDB record) in order, each step fully resolved, before this When Revealed's second sentence. Its steps, transcribed from the owner's photo (docs/phase7-wave9-handoff.md, Trickster Takeover reference cards): 1. Remove each shatter counter from the Fading Figment, then deal damage to Loki, God of Lies equal to the number of shatter counters removed this way. 2. Swap the Fading Figment in play with a random set-aside villain, AVATAR OF LOKI side faceup, then set the hit point dial of that Avatar of Loki villain to its printed hit point value. 3. Deal each player 1 facedown encounter card. Insert pp. 19 to 20 (swapping) and p. 23 FAQ (the first player resolves it). The Fading Figment prints infinite hit points (`infiniteHp`).",
    "55030b.when-revealed":
      "Shatter the illusion: follow the Shatter the Illusion rules card (scenario `referenceCards`, no MarvelCDB record) in order, each step fully resolved, before this When Revealed's second sentence. Its steps, transcribed from the owner's photo (docs/phase7-wave9-handoff.md, Trickster Takeover reference cards): 1. Remove each shatter counter from the Fading Figment, then deal damage to Loki, God of Lies equal to the number of shatter counters removed this way. 2. Swap the Fading Figment in play with a random set-aside villain, AVATAR OF LOKI side faceup, then set the hit point dial of that Avatar of Loki villain to its printed hit point value. 3. Deal each player 1 facedown encounter card. Insert pp. 19 to 20 (swapping) and p. 23 FAQ (the first player resolves it). The Fading Figment prints infinite hit points (`infiniteHp`).",
    "55031b.when-revealed":
      "Shatter the illusion: follow the Shatter the Illusion rules card (scenario `referenceCards`, no MarvelCDB record) in order, each step fully resolved, before this When Revealed's second sentence. Its steps, transcribed from the owner's photo (docs/phase7-wave9-handoff.md, Trickster Takeover reference cards): 1. Remove each shatter counter from the Fading Figment, then deal damage to Loki, God of Lies equal to the number of shatter counters removed this way. 2. Swap the Fading Figment in play with a random set-aside villain, AVATAR OF LOKI side faceup, then set the hit point dial of that Avatar of Loki villain to its printed hit point value. 3. Deal each player 1 facedown encounter card. Insert pp. 19 to 20 (swapping) and p. 23 FAQ (the first player resolves it). The Fading Figment prints infinite hit points (`infiniteHp`).",
    "55032b.when-revealed":
      "Shatter the illusion: follow the Shatter the Illusion rules card (scenario `referenceCards`, no MarvelCDB record) in order, each step fully resolved, before this When Revealed's second sentence. Its steps, transcribed from the owner's photo (docs/phase7-wave9-handoff.md, Trickster Takeover reference cards): 1. Remove each shatter counter from the Fading Figment, then deal damage to Loki, God of Lies equal to the number of shatter counters removed this way. 2. Swap the Fading Figment in play with a random set-aside villain, AVATAR OF LOKI side faceup, then set the hit point dial of that Avatar of Loki villain to its printed hit point value. 3. Deal each player 1 facedown encounter card. Insert pp. 19 to 20 (swapping) and p. 23 FAQ (the first player resolves it). The Fading Figment prints infinite hit points (`infiniteHp`).",
    "55028a.setup":
      "Single Group Mode only (MC55 insert p. 10): resolve this Setup first, then Mischief and Mayhem 1A's (55033a.setup). Keep Loki, God of Lies, his hit point dial and Worlds Collide in a separate game area outside the players' game area; they are not in anyone's game area and only cards that refer to them by title can affect them (insert pp. 10 and 18). Epic Multiplayer Mode (a separate game area per group, pods, an event organizer, simultaneous play, insert pp. 11 to 17) is NOT built; with one group, 'create a separate game area for each player group' creates the one group's area. The scenario names this card in `neutralCards.mainSchemeCardId` (it is not `mainSchemeCardId`: the players interact with Mischief and Mayhem). Of the two Setup abilities this one resolves first, then 55033a.setup.",
    "55033a.setup":
      "Setup steps (printed): 1. put a random Avatar of Loki villain into play, set each other one and the Shatter the Illusion card aside (the scenario lists the four Avatars as `villainCardId` 55029a plus `setAsideVillainCardIds`, with `startingVillain` bySetup; Loki, God of Lies is `neutralCards.villainCardId`, in the neutral game area, never the villain players interact with); this Setup resolves second, after 55028a.setup; 2. put each Synergy environment into play; 3. standard mode: set Intense Focus aside; expert mode: attach it to the Avatar of Loki villain in play (55034a has `impliedAttachHost`, villain with trait AVATAR OF LOKI). Swapping Avatars (insert p. 19): replace the Avatar in play with a random set-aside one without leave-play, enter-play or reveal; sustained damage, attachments, status cards, counters and tokens transfer; the old one is set aside. Shatter counters stay until the Avatar would be defeated (insert p. 18).",
    "55028b.worlds-collide-constant-2":
      "Per group icon (insert p. 4): the target threat is 2 per group (`targetThreat.perGroup: 2`). In single-table play there is one group, so the target is 2. The engine's `scale()` (packages/engine/src/query.ts) does not read `perGroup` yet. Worlds Collide cannot have acceleration tokens and no ability that says 'the main scheme' affects it (insert p. 18). If the threat reaches the target the players lose; if Loki, God of Lies is not defeated when all player phases end, all lose (insert p. 21).",
    "55027a.loki-god-of-lies-constant":
      "Flips to side B when Loki has 10 [per hero] or fewer remaining hit points (a state-based flip, not a trigger). His hit points are only reduced by the Fading Figment's shatter step (insert p. 20). In single-table play the [per hero] icon counts the players at the table; the Worlds Collide text says it counts all game areas.",
    "55027b.when-revealed":
      "Standard mode: each group attaches its set-aside Intense Focus to the Avatar of Loki villain in its game area; expert mode: each group flips Intense Focus to its Total Focus side. Single-table play: one group. Defeating Loki, God of Lies wins the game for all players (second sentence of the same face).",
    "55041.the-mangog-constant":
      "'Any player in your pod can attack The Mangog as if it were in their game area.' In Single Group Mode the only group in the pod is the table (insert p. 10), so this is a normal attack. Hit points are 10 per group (`hpPerGroup`): 10 at one table.",
    "55041.when-defeated":
      "'Each group in your pod places 3 shatter counters on their Avatar of Loki villain and 1 synergy counter on one of their Synergy environments.' One group in single-table play. Max 1 synergy counter per Synergy environment (printed on each).",
    "55046.door-between-worlds-constant":
      "'Any player in your pod can thwart Door Between Worlds as if it were in their game area.' In Single Group Mode a normal thwart (insert p. 10). Starting threat is 7 per group (`startingThreat.perGroup: 7`): 7 at one table.",
    "55046.when-defeated":
      "Same as The Mangog's When Defeated: 3 shatter counters on the Avatar of Loki villain and 1 synergy counter on one Synergy environment, for the one group.",
    "55007b.trance-of-envy-forced-action":
      "Forced Action (new, insert p. 7): a player may perform it at any time in the player phase they could take an action, and the player phase cannot end until every possible Forced Action among all players has been performed. If the card is discarded or the cost cannot be paid (for example the card is exhausted when the cost exhausts it), it cannot be performed and the phase may end. FAQ (insert p. 22): a Temptation attachment's Forced Action is mandatory even when it has no benefit.",
    "55007a.hypnotic-gaze-constant":
      "Permanent. The five Hypnotic Gaze cards (Enchantment) are dealt face down to each identity by Prime Real Estate 1A's Setup (55004a.setup), the rest set aside; the Trance side is hidden until Hypnotic Gaze flips (insert p. 7). The data carries `impliedAttachHost: yourIdentity` because the card prints no Attach sentence. The 'Preparation' wording is not used by this pack.",
    "55063.absorbing-man-constant":
      "Linked (Absorbing Man minion): the printed keyword names the minion with the word 'minion', so `cardTitle` is 'Absorbing Man minion' (survey S17); the linked minion is 55056. Set aside at setup for any scenario using Trickster Magic (insert p. 2), never in a deck. Same for 55064 Titania (55057), 55065 Whirlwind (55058), 55066 Zzzax (55059). The defeater of the minion puts the ally into play under their control (the minions' When Defeated).",
  },
  cardNotes: {
    "55016":
      "Crown of the Enchantress prints a star in its SCH stat box with no number (scan 55016.png, read 2026-10-10; MarvelCDB `scheme_star: true`, `scheme` null): a reminder that its star Forced Response exists, so there is no `statModifiers.sch`. Same as Charge (`core` 01099). docs/phase7-wave9.md section 1.15 item 7.",
  },

  scenarios: [
    {
      id: "enchantress",
      name: "Enchantress",
      villainSetCode: "enchantress_villain",
      // 55004a Contents: "Enchantress and Standard encounter sets. One modular set (Trickster Magic)."
      recommendedModularSetCodes: ["trickster_magic"],
      standardSetCodes: ["standard"],
      // The Expert set is the RRG's rule, not the pack's: neither the insert nor the Contents line names it. RRG 1.8
      // "Modes of Play" (p. 28): expert mode means "using the listed expert mode villain stages, and add the Expert
      // encounter set to encounter deck."
      expertSetCodes: ["expert"],
      // 55004a Contents: "Enchantress (I) and Enchantress (II). (Enchantress (II) and Enchantress (III) instead for expert mode.)"
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 1,
      evidence:
        'Prime Real Estate 1A (55004a) Contents: "Enchantress (I) and Enchantress (II). (Enchantress (II) and Enchantress (III) instead for expert mode.) Enchantress and Standard encounter sets. One modular set (Trickster Magic)." Setup: "Set the Future of Despair side scheme aside. Attach a random Hypnotic Gaze to each identity (players cannot look at the reverse sides). Set each remaining Hypnotic Gaze aside." Insert pp. 6 to 7 (scenario 1). The Trickster Magic modular set is the one required modular set; its four linked allies are set aside at setup for any scenario using it (insert p. 2). The Expert encounter set comes from RRG 1.8 "Modes of Play" (p. 28), not from the pack (see expertSetCodes).',
    },
    {
      id: "god-of-lies",
      name: "God of Lies",
      villainSetCode: "god_of_lies",
      // Single Group Mode (insert p. 10, docs/phase7-wave9.md section 1.15): the villain is the Avatar of Loki in play,
      // drawn at random among the four by Mischief and Mayhem 1A's Setup (55033a step 1, `startingVillain: "bySetup"`;
      // 55029a is the first in printed order, a placeholder). Loki, God of Lies 55027a/b and Worlds Collide 55028a are
      // in a neutral game area, neither the villain nor a main scheme (`neutralCards`).
      villainCardCode: "55029a",
      setAsideVillainCardCodes: ["55030a", "55031a", "55032a"],
      startingVillain: "bySetup",
      neutralCardCodes: { villainCardCode: "55027a", mainSchemeCardCode: "55028a" },
      recommendedModularSetCodes: ["trickster_magic"],
      standardSetCodes: ["standard"],
      // The Expert set: RRG 1.8 "Modes of Play" (p. 28), as for the Enchantress scenario.
      expertSetCodes: ["expert"],
      // One villain card with two faces, no escalation by mode.
      villainStages: { standard: [1, 1], expert: [1, 1] },
      modularSetCount: 1,
      // The two unnumbered rules cards in the box (no MarvelCDB record), for the client's Inspect. Text transcribed from
      // the owner's photos (docs/phase7-wave9-handoff.md, "Trickster Takeover reference cards"); the scans are tracked
      // in docs/campaign-modes/mc55-reference-cards/ and the image is a repo-relative path to them.
      referenceCards: [
        {
          id: "shatter-the-illusion",
          title: "Shatter the Illusion",
          text: "When a Fading Figment is revealed, follow these steps to shatter Loki's illusion: 1. Remove each shatter counter from Fading Figment, then deal damage to Loki, God of Lies equal to the number of shatter counters removed this way. 2. Swap the Fading Figment in play with a random set-aside villain, AVATAR OF LOKI side faceup, then set the hit point dial of that AVATAR OF LOKI villain to its printed hit point value. 3. Deal each player 1 facedown encounter card.",
          image: "docs/campaign-modes/mc55-reference-cards/shatter-the-illusion.png",
        },
        {
          id: "epic-multiplayer-reminder",
          title: "Epic Multiplayer Reminder",
          text: "Group Pods: A pod is a collection of groups. It is recommended that each pod not exceed 12 to 16 players, or roughly 3 to 4 groups within the same pod. Per Group Icon: If on a card in a group's game area, the [per group] icon next to a value multiplies that value by the number of groups that began the scenario in that pod. Playing in Separate Game Areas: Each player group is in its own game area. Unless explicitly stated, players, cards, and components in one game area cannot affect another game area. Cross-Group Communication: Cross-group communication is allowed and highly encouraged!",
          image: "docs/campaign-modes/mc55-reference-cards/epic-multiplayer-reminder.png",
        },
      ],
      // Loki, God of Lies 55027b: "If Loki, God of Lies is defeated, all players in all groups win the game." The
      // Avatars never win by themselves (Forced Interrupt: when defeated, place 5 shatter counters and flip).
      victory: "cardAbility",
      evidence:
        'Worlds Collide A (55028a) Contents: "Loki, God of Lies (1). God of Lies and Standard encounter sets. One modular encounter set (Trickster Magic)." Setup: "Create a separate game area for each player group. Each group follows the instructions on Mischief and Mayhem (1A)." Insert p. 10 (Single Group Mode): "first resolve the Setup ability on the Worlds Collide (A) main scheme, then resolve the Setup ability on the Mischief and Mayhem (1A) main scheme"; Loki, his hit point dial and Worlds Collide sit in a separate game area and "can only be affected by cards that refer to them by name"; "In Single Group Mode, the only group in your pod is your own group". Mischief and Mayhem 1A Setup: "Put a random Avatar of Loki villain into play. Set each other Avatar of Loki villain and the Shatter the Illusion card aside. Put each Synergy environment into play. In standard mode, set the Intense Focus attachment aside. In expert mode, attach it to the Avatar of Loki villain in play." Insert pp. 18 to 21 (rules for both modes). Single-table play only: Epic Multiplayer Mode is not built. The Expert encounter set comes from RRG 1.8 "Modes of Play" (p. 28), not from the pack.',
    },
  ],
  starterDecks: [],
};
