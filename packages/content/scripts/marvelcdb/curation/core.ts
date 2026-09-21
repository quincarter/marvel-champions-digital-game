/**
 * Core Set curation. Evidence abbreviations used below:
 * - "card": the printed card, checked visually against the card image (viewed
 *   for verification only; images are never downloaded into the repo).
 * - "Cerebro": the Cerebro card database (cerebro-beta-bot.herokuapp.com/cards),
 *   an independent transcription used as the second source for every card.
 * - "L2P": Core Set Learn to Play booklet
 *   (https://hallofheroeslcg.com/wp-content/uploads/2019/12/l2p.pdf), linked
 *   from the Hall of Heroes Core Set page in hallofheroes-llms.txt.
 * - "title card": the decklist printed on the back of each Core starter deck's
 *   title card (images linked from the Hall of Heroes Core Set page).
 */
import type { PackCuration } from "./types.ts";

const L2P = "Core Set Learn to Play (https://hallofheroeslcg.com/wp-content/uploads/2019/12/l2p.pdf)";

const BASIC_PRECON: Readonly<Record<string, number>> = {
  "01083": 1, // Mockingbird
  "01084": 1, // Nick Fury
  "01085": 1, // Emergency
  "01086": 1, // First Aid
  "01087": 1, // Haymaker
  "01088": 1, // Energy
  "01089": 1, // Genius
  "01090": 1, // Strength
  "01091": 1, // Avengers Mansion
  "01092": 1, // Helicarrier
  "01093": 1, // Tenacity
};

const AGGRESSION_PRECON: Readonly<Record<string, number>> = {
  "01050": 1, // Hulk
  "01051": 1, // Tigra
  "01052": 2, // Chase Them Down
  "01053": 2, // Relentless Assault
  "01054": 2, // Uppercut
  "01055": 2, // The Power of Aggression
  "01056": 2, // Tac Team
  "01057": 2, // Combat Training
};

const CAPTAIN_MARVEL_KIT: Readonly<Record<string, number>> = {
  "01011": 1, // Spider-Woman
  "01012": 3, // Crisis Interdiction
  "01013": 3, // Photonic Blast
  "01014": 2, // Energy Absorption
  "01015": 1, // Alpha Flight Station
  "01016": 1, // Captain Marvel's Helmet
  "01017": 2, // Cosmic Flight
  "01018": 2, // Energy Channel
};

export const CORE_CURATION: PackCuration = {
  packCode: "core",
  cycle: { id: "core", name: "Core Set", order: 0 },
  pack: {
    name: "Core Set",
    releaseDate: "2019-11-01",
    releaseDateSource: "Hall of Heroes Core Set page (https://hallofheroeslcg.com/core-set-2/)",
  },
  outDir: "src/data/core",
  exportPrefix: "CORE",

  corrections: [
    {
      code: "01105",
      name: '"I\'m Tough!"',
      reason: "MarvelCDB drops the exclamation mark from the title.",
      evidence: 'card; Cerebro; L2P p.23 ("“I’m Tough!” (x2)")',
    },
    {
      code: "01156",
      name: "Usurp the Throne",
      reason: 'MarvelCDB capitalizes "The".',
      evidence: 'Cerebro; L2P p.20 ("Usurp the Throne")',
    },
    {
      code: "01152",
      textReplace: { find: "After the villain take damage", replace: "After the villain takes damage" },
      reason:
        'MarvelCDB typo. (Name note: L2P p.23 lists this card as "Vibranium Chassis"; the printed title is Vibranium Armor, which MarvelCDB and Cerebro both use.)',
      evidence: "card; Cerebro",
    },
    {
      code: "01153",
      attack: 1,
      reason: "MarvelCDB omits the +1 ATK stat box printed on the attachment.",
      evidence: 'card (+1 ATK box); Cerebro (Attack "+1")',
    },
    {
      code: "01158",
      boost: 0,
      reason: "MarvelCDB lists 1 boost icon; the card's boost area has only the boost star.",
      evidence: 'card; Cerebro (Boost "{s}")',
    },
    {
      code: "01172",
      traits: ["Criminal"],
      reason: "MarvelCDB omits Whiplash's printed CRIMINAL trait.",
      evidence: "card; Cerebro",
    },
    {
      code: "01135",
      textReplace: { find: "Until the end of his attack", replace: "Until the end of this attack" },
      reason: "MarvelCDB wording differs from the print.",
      evidence: "card; Cerebro",
    },
    {
      code: "01136",
      textReplace: { find: "Then shuffle the encounter deck.", replace: "Shuffle the encounter deck." },
      ignoreFields: ["base_threat", "base_threat_fixed", "scheme_hazard"],
      reason:
        'MarvelCDB adds a "Then" not on the card, and carries base_threat=3 / scheme_hazard=1 on a villain — Ultron (III) has no threat value or scheme icon printed.',
      evidence: "card; Cerebro",
    },
    {
      code: "01131",
      ignoreFields: ["base_threat", "base_threat_fixed"],
      reason: "MarvelCDB carries base_threat=3 on a minion; Tiger Shark has no threat value printed.",
      evidence: "card; Cerebro",
    },
    {
      code: "01127",
      textReplace: { find: "Klaw loses those hit points.", replace: "Klaw loses these hit points." },
      reason: "MarvelCDB wording differs from the print.",
      evidence: "card; Cerebro",
    },
    {
      code: "01140",
      textReplace: { find: "in it's owners discard pile", replace: "in its owner's discard pile" },
      reason: "MarvelCDB typo.",
      evidence: "card; Cerebro",
    },
    {
      code: "01147",
      textReplace: { find: "If no attack was made this way", replace: "If no attacks were made this way" },
      reason: "MarvelCDB wording differs from the print.",
      evidence: "card; Cerebro",
    },
    {
      code: "01165",
      textReplace: { find: "form. Choose:", replace: "form. Choose one:" },
      reason:
        'Eviction Notice prints "Choose one:" (the other four Core obligations print "Choose:", as MarvelCDB has them).',
      evidence: "card (all five Core obligations checked)",
    },
    {
      code: "01055",
      textReplace: { find: "paying for a Aggression", replace: "paying for an Aggression" },
      reason: "MarvelCDB typo.",
      evidence: "card; Cerebro",
    },
    {
      code: "01082",
      textReplace: { find: "discard indomitable", replace: "discard Indomitable" },
      reason: "MarvelCDB capitalization.",
      evidence: "card; Cerebro",
    },
    {
      code: "01100",
      textReplace: { find: "resources → discard this card", replace: "resources → discard this card." },
      reason: "MarvelCDB drops the final period.",
      evidence: "card; Cerebro",
    },
    {
      code: "01117a",
      textReplace: { find: "Advance to stage 2B", replace: "Advance to stage 2B." },
      reason: "MarvelCDB drops the final period.",
      evidence: "card; Cerebro",
    },
    {
      code: "01139b",
      textReplace: { find: "the players lose the game", replace: "the players lose the game." },
      reason: "MarvelCDB drops the final period.",
      evidence: "card; Cerebro",
    },
    {
      code: "01137a",
      textReplace: { find: "Advanced to stage 1B.", replace: "Advance to stage 1B." },
      reason: "MarvelCDB typo.",
      evidence: "card; Cerebro",
    },
    {
      code: "01096",
      textReplace: { find: "This character enter play", replace: "This character enters play" },
      reason: "MarvelCDB typo in Toughness reminder text.",
      evidence: "matches the Toughness reminder on every other Core card",
    },
  ],

  errata: [
    {
      code: "01026",
      version: "RRG 1.5",
      changedFields: ["text"],
      note: "Removed the (thwart) label: the ability is no longer a thwart.",
      evidence: 'MarvelCDB errata field; card (printed with "(thwart)")',
      printedReplace: { find: "Alter-Ego Action:", replace: "Alter-Ego Action (thwart):" },
    },
    {
      code: "01183",
      version: "RRG 1.6",
      changedFields: ["text"],
      note: 'Added periods to "M.O.D.O.K." (printed "MODOK").',
      evidence: 'MarvelCDB errata field; card (printed "MODOK")',
      printedReplace: { find: "M.O.D.O.K.", replace: "MODOK" },
    },
    {
      code: "01184",
      version: "RRG 1.5",
      changedFields: ["name"],
      note: 'Added periods to the card title (printed "MODOK"; current "M.O.D.O.K.").',
      evidence: 'MarvelCDB errata field; card (printed "MODOK")',
    },
  ],

  scriptingNotes: {
    "01008.web-shooter-resource":
      "Removing the web counter is part of the cost. Uses keyword: discard Web-Shooter when its last counter is removed.",
    "01018.energy-channel-action":
      "X is chosen by the player and bound to the number of [energy] resources spent; put that many energy counters here.",
    "01026.superhuman-law-division-action":
      "Errata (RRG 1.5): no longer labeled (thwart), so it is not a thwart (confused/Crisis/‘after you thwart’ don't apply).",
    "01043a.wakanda-forever-action":
      "Resolve the Special ability on each Black Panther-trait upgrade you control, in the order you choose; each is one step of a sequence, and the Special abilities read whether they are the final step. Same ability on 01043a–d.",
    "01043b.wakanda-forever-action": "Identical to 01043a.wakanda-forever-action (different resource icon only).",
    "01043c.wakanda-forever-action": "Identical to 01043a.wakanda-forever-action (different resource icon only).",
    "01043d.wakanda-forever-action": "Identical to 01043a.wakanda-forever-action (different resource icon only).",
    "01046.energy-daggers-special":
      "Special: only usable when Wakanda Forever! resolves it. 1 damage to the villain and each enemy engaged with the chosen player, 2 instead if this is the final step.",
    "01047.panther-claws-special":
      "Special (attack): only usable via Wakanda Forever!; 4 damage instead of 2 on the final step.",
    "01048.tactical-genius-special":
      "Special (thwart): only usable via Wakanda Forever!; 2 threat instead of 1 on the final step.",
    "01049.vibranium-suit-special":
      "Special (attack): only usable via Wakanda Forever!; moves damage (removes it from your hero, deals it to the enemy); 2 instead of 1 on the final step.",
    "01057.combat-training-constant":
      '"Your hero" is the hero of the player who controls this upgrade (Play under any player\'s control).',
    "01065.heroic-intuition-constant":
      '"Your hero" is the hero of the player who controls this upgrade (Play under any player\'s control).',
    "01081.armored-vest-constant":
      '"Your hero" is the hero of the player who controls this upgrade (Play under any player\'s control).',
    "01066.hawkeye-constant":
      "Enters play with 4 arrow counters. Not the Uses keyword: Hawkeye is not discarded when the counters run out.",
    "01084.nick-fury-forced-response":
      "Two effects in one paragraph: the enters-play choice, and a delayed effect — at the end of the round, if Nick Fury is still in play, discard him.",
    "01097a.setup": '"Advance to stage 1B" is the whole ability; advancing to the B side is implicit in the engine.',
    "01099.charge-forced-interrupt":
      "The [star] is a reminder icon. +3 ATK is in statModifiers (applies while attached). Rhino's attack gains overkill (excess damage to a defending ally goes to its controller); discard Charge at the end of that attack.",
    "01113.klaw-forced-interrupt":
      "Klaw (I) has a printed ATK of 0: his attack damage comes entirely from boost cards.",
    "01116a.setup":
      "Search the encounter deck for Defense Network and reveal it, shuffle; then advance to 1B (implicit).",
    "01117a.when-revealed": '"Advance to stage 2B" is implicit in the engine.',
    "01127.the-immortal-klaw-constant":
      "The villain gets +10 hit points while this side scheme is in play; it loses them when the scheme leaves play.",
    "01136.ultron-constant":
      "Two constant effects: each Drone minion (facedown Drones and Advanced Ultron Drones) gets +1 ATK/+1 hit point; Ultron cannot take damage while any Drone minion is in play.",
    "01137a.setup": "Put the Ultron Drones environment into play, shuffle; then advance to 1B (implicit).",
    "01138a.when-revealed": '"Advance to stage 2B" is implicit in the engine.',
    "01139a.when-revealed": '"Advance to stage 3B" is implicit in the engine.',
    "01139b.countdown-to-oblivion-constant": "Threat cannot be removed from this main scheme stage by any means.",
    "01140.ultron-drones-constant":
      "Sets the base ATK/SCH/hit points of facedown Drone minions (player cards put into play facedown engaged with a player).",
    "01140.ultron-drones-forced-response":
      "A defeated facedown Drone goes to its owner's (the player's) discard pile, not the encounter discard pile.",
    "01132.melter-constant":
      "The [star] is a reminder icon. The engaged player must defend Melter's attacks with an ally they control, if able.",
    "01162.titania-constant":
      'Printed ATK is X (data carries atk: "X"). X = Titania\'s remaining hit points, continuously.',
    "01163.genetically-enhanced-constant":
      "Two effects: if no minions are in play when revealed, this card gains surge (and has nothing to attach to); the attached minion gets +3 hit points.",
    "01107.when-revealed": "1 per player additional threat, on top of the printed starting threat.",
    "01109.when-revealed": "1 per player additional threat, on top of the printed starting threat.",
    "01125.when-revealed": "1 per player additional threat, on top of the printed starting threat.",
    "01126.when-revealed": "1 per player additional threat, on top of the printed starting threat.",
    "01161.when-revealed": "1 per player additional threat, on top of the printed starting threat.",
    "01171.when-revealed": "1 per player additional threat, on top of the printed starting threat.",
    "01176.when-revealed": "1 per player additional threat, on top of the printed starting threat.",
    "01155.obligation":
      "Obligation flow: dealt to the T'Challa player (identity.obligationCardId). They may flip to alter-ego, then choose one: exhaust T'Challa (cost) → remove this card from the game; or the second bullet, then discard this obligation.",
    "01160.obligation":
      "Obligation flow: dealt to the Jennifer Walters player. May flip to alter-ego, then choose one: exhaust Jennifer Walters (cost) → remove from the game; or give the main scheme 1 acceleration token, then discard.",
    "01165.obligation":
      "Obligation flow: dealt to the Peter Parker player. May flip to alter-ego, then choose one: exhaust Peter Parker (cost) → remove from the game; or discard 1 random card, this card gains surge, then discard.",
    "01170.obligation":
      "Obligation flow: dealt to the Tony Stark player. May flip to alter-ego, then choose one: exhaust Tony Stark (cost) → remove from the game; or exhaust each upgrade you control, then discard.",
    "01175.obligation":
      "Obligation flow: dealt to the Carol Danvers player. May flip to alter-ego, then choose one: exhaust Carol Danvers (cost) → remove from the game; or you are stunned, this card gains surge, then discard.",
  },

  cardNotes: {
    "01050":
      'Printed THW is "—" (cannot thwart), not 0. Data carries thw: null (schema PrintedStat); the engine refuses thwarts by a character with a "—" THW.',
    "01162":
      'Printed ATK is X (= remaining hit points); data carries atk: "X" plus the constant ability 01162.titania-constant.',
    "01184": 'Title errata (RRG 1.5): printed "MODOK", current "M.O.D.O.K." — `name` holds the current title.',
    "01097a": "Main scheme stage names are not representable per stage yet; single-stage scheme, so no loss here.",
    "01116a":
      'Two-stage main scheme deck: stage 1 is "Underground Distribution", stage 2 is "Secret Rendezvous" (01117). MainSchemeStage has no per-stage name yet, so `name` is the stage-1 name — flagged as a schema follow-up.',
    "01137a":
      'Three-stage main scheme deck: "The Crimson Cowl" (1), "Assault on NORAD" (2, 01138), "Countdown to Oblivion" (3, 01139). MainSchemeStage has no per-stage name yet — flagged as a schema follow-up.',
  },

  scenarios: [
    {
      id: "rhino",
      name: "Rhino",
      villainSetCode: "rhino",
      recommendedModularSetCodes: ["bomb_scare"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence: `${L2P} p.23 "Core Scenarios"; The Break-In! 1A Contents text`,
    },
    {
      id: "klaw",
      name: "Klaw",
      villainSetCode: "klaw",
      recommendedModularSetCodes: ["masters_of_evil"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence: `${L2P} p.23 "Core Scenarios"; Underground Distribution 1A Contents text`,
    },
    {
      id: "ultron",
      name: "Ultron",
      villainSetCode: "ultron",
      recommendedModularSetCodes: ["under_attack"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence: `${L2P} p.23 "Core Scenarios"; The Crimson Cowl 1A Contents text`,
    },
  ],

  starterDecks: [
    {
      id: "core-spider-man-justice",
      name: "Spider-Man (Justice) — Core Set starter deck",
      identityCode: "01001a",
      aspect: "justice",
      cards: {
        "01002": 1,
        "01003": 2,
        "01004": 2,
        "01005": 3,
        "01006": 1,
        "01007": 2,
        "01008": 2,
        "01009": 2,
        "01058": 1,
        "01059": 1,
        "01060": 2,
        "01061": 2,
        "01062": 2,
        "01063": 2,
        "01064": 2,
        "01065": 2,
        ...BASIC_PRECON,
      },
      obligationCode: "01165",
      nemesisCodes: ["01166", "01167", "01168", "01169"],
      verified: true,
      sources: [
        "Spider-Man starter deck title card, printed decklist (image linked from the Hall of Heroes Core Set page, https://hallofheroeslcg.com/core-set-2/)",
        `${L2P} p.21 "Starter Decks — Spider-Man / Justice"`,
        'MarvelCDB decklist #2419 "Spider-Man (Justice) - Core Set Starter Deck" (cross-check, identical)',
      ],
    },
    {
      id: "core-captain-marvel-leadership",
      name: "Captain Marvel (Leadership) — Core Set starter deck",
      identityCode: "01010a",
      aspect: "leadership",
      cards: {
        ...CAPTAIN_MARVEL_KIT,
        "01066": 1,
        "01067": 1,
        "01068": 1,
        "01069": 2,
        "01070": 2,
        "01071": 2,
        "01072": 2,
        "01073": 1,
        "01074": 2,
        ...BASIC_PRECON,
      },
      obligationCode: "01175",
      nemesisCodes: ["01176", "01177", "01178", "01179"],
      verified: true,
      sources: [
        `${L2P} p.21 "Starter Decks — Captain Marvel / Leadership"`,
        'MarvelCDB decklist #2418 "Captain Marvel (Leadership) - Core Set Starter Deck" (cross-check, identical)',
      ],
      note: "The Learn to Play starter-deck page says this list differs from the pre-sorted tutorial deck; see core-captain-marvel-aggression-tutorial.",
    },
    {
      id: "core-captain-marvel-aggression-tutorial",
      name: "Captain Marvel (Aggression) — Core Set tutorial deck",
      identityCode: "01010a",
      aspect: "aggression",
      cards: { ...CAPTAIN_MARVEL_KIT, ...AGGRESSION_PRECON, ...BASIC_PRECON },
      obligationCode: "01175",
      nemesisCodes: ["01176", "01177", "01178", "01179"],
      verified: true,
      sources: [
        "Captain Marvel starter deck title card, printed decklist (image linked from the Hall of Heroes Core Set page, https://hallofheroeslcg.com/core-set-2/)",
        `${L2P} p.5 setup step 6 ("the Captain Marvel deck consists of the remaining Captain Marvel cards, as well as the Aggression (red) and basic (gray) cards from that Starter Pack")`,
      ],
      note: "The deck pre-sorted in the Core box for the tutorial game. Shares its Aggression cards with the She-Hulk and Iron Man starter decks.",
    },
    {
      id: "core-she-hulk-aggression",
      name: "She-Hulk (Aggression) — Core Set starter deck",
      identityCode: "01019a",
      aspect: "aggression",
      cards: {
        "01020": 1,
        "01021": 1,
        "01022": 2,
        "01023": 2,
        "01024": 3,
        "01025": 1,
        "01026": 1,
        "01027": 2,
        "01028": 2,
        ...AGGRESSION_PRECON,
        ...BASIC_PRECON,
      },
      obligationCode: "01160",
      nemesisCodes: ["01161", "01162", "01163", "01164"],
      verified: true,
      sources: [
        `${L2P} p.21 "Starter Decks — She-Hulk / Aggression"`,
        'MarvelCDB decklist #2420 "She-Hulk (Aggression) - Core Set Starter Deck" (cross-check, identical)',
      ],
      note: "L2P p.20: cannot be played at the same time as the Iron Man starter deck from one Core Set (shared Aggression cards); it recommends swapping in Spider-Man's Justice cards.",
    },
    {
      id: "core-iron-man-aggression",
      name: "Iron Man (Aggression) — Core Set starter deck",
      identityCode: "01029a",
      aspect: "aggression",
      cards: {
        "01030": 1,
        "01031": 3,
        "01032": 2,
        "01033": 1,
        "01034": 1,
        "01035": 1,
        "01036": 1,
        "01037": 1,
        "01038": 2,
        "01039": 2,
        ...AGGRESSION_PRECON,
        ...BASIC_PRECON,
      },
      obligationCode: "01170",
      nemesisCodes: ["01171", "01172", "01173", "01174"],
      verified: true,
      sources: [
        `${L2P} p.20 "Starter Decks — Iron Man / Aggression"`,
        'MarvelCDB decklist #2417 "Iron Man (Aggression) - Core Set Starter Deck" (cross-check, identical)',
      ],
      note: "L2P p.20: cannot be played at the same time as the She-Hulk starter deck from one Core Set (shared Aggression cards).",
    },
    {
      id: "core-black-panther-protection",
      name: "Black Panther (Protection) — Core Set starter deck",
      identityCode: "01040a",
      aspect: "protection",
      cards: {
        "01041": 1,
        "01042": 1,
        "01043a": 1,
        "01043b": 1,
        "01043c": 1,
        "01043d": 2,
        "01044": 3,
        "01045": 1,
        "01046": 1,
        "01047": 1,
        "01048": 1,
        "01049": 1,
        "01075": 1,
        "01076": 1,
        "01077": 2,
        "01078": 2,
        "01079": 2,
        "01080": 2,
        "01081": 2,
        "01082": 2,
        ...BASIC_PRECON,
      },
      obligationCode: "01155",
      nemesisCodes: ["01156", "01157", "01158", "01159"],
      verified: true,
      sources: [
        `${L2P} p.20 "Starter Decks — Black Panther / Protection" ("Wakanda Forever! (x5)" = all five printed variants)`,
        'MarvelCDB decklist #2416 "Black Panther (Protection) - Core Set Starter Deck" (cross-check, identical incl. variants 43a–c ×1, 43d ×2)',
      ],
    },
  ],
};
