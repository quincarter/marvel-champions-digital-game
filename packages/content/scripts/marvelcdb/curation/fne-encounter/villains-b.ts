/**
 * Fear No Evil (MC60) encounter cards, group B: the Purple Man set (60097 to 60109, 15 copies) and the Typhoid Mary
 * set (60110 to 60120, 15 copies), transcribed from Hall of Heroes scans (`hohfne/img/<collector>[a|b][_n].jpg`, read
 * directly, never wired into the data). MarvelCDB has none of the box's scenario half (survey section 3).
 *
 * Conventions, copied from MarvelCDB's cw/aoa/aos records:
 * - `set_position` is the printed N of "(N/15)"; copies of one card (the footer reads 5/15 and 6/15 on two scans of
 *   Firefighter 101) are one record with the first N and `quantity` the copy count.
 * - A two-sided card is a top-level `a` record with the nested hidden `b` record in `linked_card`.
 * - The orange circle at the foot of a minion's art is its hit points (Bullseye 60033 prints 5 there and MarvelCDB
 *   has health 5); a minion's footer carries no "HIT POINTS" text.
 * - The star beside the red boost icons is `boost_star`; the Y-shaped icons are counted into `boost` (null for none,
 *   MarvelCDB never emits 0). Every Purple Man card prints the star, because the villain stages give every card of
 *   the set a star Boost.
 * - No art reference: `imagesrc` and `backimagesrc` stay null.
 */
import type { RawCard } from "../../raw-types.ts";
import type { AddedRecord } from "../types.ts";

type Fields = Record<string, unknown>;

const TYPE_NAMES: Record<string, string> = {
  villain: "Villain",
  minion: "Minion",
  attachment: "Attachment",
  obligation: "Obligation",
  side_scheme: "Side Scheme",
  treachery: "Treachery",
  environment: "Environment",
};

/** A full MarvelCDB-shaped record (the key set of the nested records in cw.json), with `fields` laid over it. */
function card(
  setCode: string,
  setName: string,
  code: string,
  type: string,
  name: string,
  text: string,
  traits: string | null,
  fields: Fields,
): Fields {
  return {
    pack_code: "fne",
    pack_name: "Fear No Evil",
    pack_legacy: false,
    type_code: type,
    type_name: TYPE_NAMES[type],
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: setCode,
    card_set_name: setName,
    card_set_type_name_code: "villain",
    card_set_parent_code: null,
    position: Number.parseInt(code, 10) - 60000,
    set_position: null,
    code,
    name,
    real_name: name,
    subname: null,
    cost: null,
    cost_per_hero: false,
    cost_star: false,
    // The scans print no errata, so printed and real text agree.
    text,
    real_text: text,
    boost: null,
    quantity: 1,
    resource_energy: null,
    resource_physical: null,
    resource_mental: null,
    resource_wild: null,
    hand_size: null,
    health: null,
    health_per_group: false,
    health_per_hero: false,
    thwart: null,
    thwart_cost: null,
    scheme: null,
    attack: null,
    attack_cost: null,
    defense: null,
    defense_cost: null,
    recover: null,
    recover_cost: null,
    base_threat: null,
    base_threat_fixed: false,
    base_threat_per_group: false,
    base_threat_star: false,
    escalation_threat: null,
    escalation_threat_fixed: false,
    scheme_crisis: null,
    scheme_acceleration: null,
    scheme_amplify: null,
    scheme_hazard: null,
    threat: null,
    threat_fixed: false,
    threat_per_group: false,
    deck_limit: null,
    stage: null,
    traits,
    real_traits: traits,
    meta: null,
    deck_requirements: null,
    deck_options: null,
    restrictions: null,
    flavor: "",
    illustrator: null,
    is_unique: false,
    hidden: false,
    permanent: false,
    double_sided: false,
    back_text: null,
    back_flavor: null,
    back_name: null,
    attack_star: false,
    thwart_star: false,
    defense_star: false,
    health_star: false,
    recover_star: false,
    scheme_star: false,
    boost_star: false,
    threat_star: false,
    escalation_threat_star: false,
    errata: null,
    imagesrc: null,
    spoiler: 1,
    backimagesrc: null,
    ...fields,
  };
}

const PM = (code: string, type: string, name: string, text: string, traits: string | null, fields: Fields): Fields =>
  card("purple_man", "Purple Man", code, type, name, text, traits, fields);
const TM = (code: string, type: string, name: string, text: string, traits: string | null, fields: Fields): Fields =>
  card("typhoid_mary", "Typhoid Mary", code, type, name, text, traits, fields);

/** Joins a front record with its hidden back; MarvelCDB links both ways and nests the back in the front. */
function twoSided(front: Fields, back: Fields): RawCard {
  return {
    ...front,
    linked_to_code: back.code,
    linked_to_name: back.name,
    linked_card: { ...back, hidden: true },
  } as unknown as RawCard;
}

const one = (fields: Fields): RawCard => fields as unknown as RawCard;

const VULNERABLE = "Vulnerable. <i>(Discard this character if it is stunned or confused.)</i>";
const INFLUENCED = "Each [[Influenced]] minion gains";
const PM_BOOST =
  'Each boost card from the Purple Man encounter set gains: "[star] <b>Boost</b>: After this activation, deal this card to yourself as a facedown encounter card."';
const NO_MARVELCDB = "MarvelCDB has no record of the box's scenario half";

export const VILLAINS_B: readonly AddedRecord[] = [
  // ---------------------------------------------------------------- Purple Man (60097 to 60109)
  {
    record: one(
      PM("60097", "villain", "Purple Man", `${INFLUENCED} guard.\n${PM_BOOST}`, "Psionic. Underling.", {
        set_position: 1,
        health: 13,
        health_per_hero: true,
        scheme: 1,
        attack: 0,
        scheme_star: true,
        attack_star: true,
        stage: "I",
        is_unique: true,
        illustrator: "Bruno Frenda",
      }),
    ),
    reason: `Purple Man villain stage I: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60097.jpg: "+PURPLE MAN" stage I, VILLAIN, SCH 1 star, ATK 0 star, PSIONIC. UNDERLING. "Each INFLUENCED minion gains guard. Each boost card from the Purple Man encounter set gains: "star Boost: After this activation, deal this card to yourself as a facedown encounter card."" Footer PURPLE MAN (1/15) / HIT POINTS 13 per hero, Bruno Frenda, 97.',
  },
  {
    record: one(
      PM("60098", "villain", "Purple Man", `${INFLUENCED} guard and villainous.\n${PM_BOOST}`, "Psionic. Underling.", {
        set_position: 2,
        health: 15,
        health_per_hero: true,
        scheme: 2,
        attack: 1,
        scheme_star: true,
        attack_star: true,
        stage: "II",
        is_unique: true,
        illustrator: "Bruno Frenda",
      }),
    ),
    reason: `Purple Man villain stage II: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60098.jpg: "+PURPLE MAN" stage II, SCH 2 star, ATK 1 star, PSIONIC. UNDERLING. "Each INFLUENCED minion gains guard and villainous." plus the same boost-set paragraph. Footer PURPLE MAN (2/15) / HIT POINTS 15 per hero, Bruno Frenda, 98.',
  },
  {
    record: one(
      PM(
        "60099",
        "villain",
        "Purple Man",
        `${INFLUENCED} guard, patrol, and villainous.\n${PM_BOOST}`,
        "Psionic. Underling.",
        {
          set_position: 3,
          health: 17,
          health_per_hero: true,
          scheme: 3,
          attack: 1,
          scheme_star: true,
          attack_star: true,
          stage: "III",
          is_unique: true,
          illustrator: "Bruno Frenda",
        },
      ),
    ),
    reason: `Purple Man villain stage III: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60099.jpg: "+PURPLE MAN" stage III, SCH 3 star, ATK 1 star, PSIONIC. UNDERLING. "Each INFLUENCED minion gains guard, patrol, and villainous." plus the same boost-set paragraph. Footer PURPLE MAN (3/15) / HIT POINTS 17 per hero, Bruno Frenda, 99.',
  },
  {
    record: one(
      PM(
        "60100",
        "attachment",
        "Converted",
        "Treat attached ally as an [[Influenced]] minion with a blank text box. Attached minion's SCH is equal to its base THW and it does not take consequential damage.\n<b>When Revealed</b>: Attach to the highest-cost ally you control and engage it. Otherwise, this card gains surge.",
        "Condition.",
        { set_position: 4, boost: 3, boost_star: true, illustrator: "Allie Preswick" },
      ),
    ),
    reason: `Purple Man set attachment Converted: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60100.jpg: CONVERTED, ATTACHMENT, CONDITION. "Treat attached ally as an INFLUENCED minion with a blank text box. Attached minion\'s SCH is equal to its base THW and it does not take consequential damage. When Revealed: Attach to the highest-cost ally you control and engage it. Otherwise, this card gains surge." Footer PURPLE MAN (4/15), Allie Preswick, 100. Boost icons: star plus 3. No stats printed.',
  },
  {
    record: one(
      PM(
        "60101",
        "minion",
        "Firefighter",
        `${VULNERABLE}\n[star] Firefighter's attacks gain piercing.\n<b>When Defeated</b>: Discard the highest-cost support or upgrade from play.`,
        "Civilian. Influenced.",
        {
          set_position: 5,
          quantity: 2,
          health: 3,
          scheme: 1,
          attack: 1,
          attack_star: true,
          boost_star: true,
          illustrator: "Ivan Fiorelli",
        },
      ),
    ),
    reason: `Purple Man set minion Firefighter (2 copies): ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60101.jpg (5/15) and 60101_2.jpg (6/15), identical: FIREFIGHTER, MINION, SCH 1, ATK 1 star, hit-point circle 3, CIVILIAN. INFLUENCED. "Vulnerable. (Discard this character if it is stunned or confused.) star Firefighter\'s attacks gain piercing. When Defeated: Discard the highest-cost support or upgrade from play." Boost icons: star only. Ivan Fiorelli, 101.',
  },
  {
    record: one(
      PM(
        "60102",
        "minion",
        "Judge",
        `${VULNERABLE}\n<b>When Defeated</b>: Place 3 threat on the main scheme.`,
        "Civilian. Influenced.",
        {
          set_position: 7,
          health: 2,
          scheme: 3,
          attack: 0,
          boost: 2,
          boost_star: true,
          flavor: '"Say one more word about Mr. Killgrave, and I\'ll hold you in contempt!"',
          illustrator: "Eleonora Carlini",
        },
      ),
    ),
    reason: `Purple Man set minion Judge: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60102.jpg: JUDGE, MINION, SCH 3, ATK 0, hit-point circle 2, CIVILIAN. INFLUENCED. "Vulnerable. (...) When Defeated: Place 3 threat on the main scheme." Flavor "Say one more word about Mr. Killgrave, and I\'ll hold you in contempt!" Footer PURPLE MAN (7/15), Eleonora Carlini, 102. Boost icons: star plus 2.',
  },
  {
    record: one(
      PM(
        "60103",
        "minion",
        "Security Guard",
        `Patrol. ${VULNERABLE}\n<b>When Defeated</b>: Discard the ally with the highest ATK <i>(among allies)</i> in play.`,
        "Civilian. Influenced.",
        {
          set_position: 8,
          health: 4,
          scheme: 0,
          attack: 2,
          boost: 1,
          boost_star: true,
          flavor: '"Suspect is in custody."',
          illustrator: "Andrea Di Vito & Laura Villari",
        },
      ),
    ),
    reason: `Purple Man set minion Security Guard: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60103.jpg: SECURITY GUARD, MINION, SCH 0, ATK 2, hit-point circle 4, CIVILIAN. INFLUENCED. "Patrol. Vulnerable. (...) When Defeated: Discard the ally with the highest ATK (among allies) in play." Flavor "Suspect is in custody." Footer PURPLE MAN (8/15), credit printed "Andrea Di Vito Laura Villari" (ampersand missing in the print; MarvelCDB writes it with one), 103. Boost icons: star plus 1.',
  },
  {
    record: one(
      PM(
        "60104",
        "minion",
        "Skater Punk",
        `${VULNERABLE}\n<b>When Defeated</b>: Deal 3 damage to the defeating player's identity.`,
        "Civilian. Influenced.",
        {
          set_position: 9,
          health: 2,
          scheme: 1,
          attack: 2,
          boost_star: true,
          flavor: '"I\'m actually more into post-punk."',
          illustrator: "Allie Preswick",
        },
      ),
    ),
    reason: `Purple Man set minion Skater Punk: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60104.jpg: SKATER PUNK, MINION, SCH 1, ATK 2, hit-point circle 2, CIVILIAN. INFLUENCED. "Vulnerable. (...) When Defeated: Deal 3 damage to the defeating player\'s identity." Flavor "I\'m actually more into post-punk." Footer PURPLE MAN (9/15), Allie Preswick, 104. Boost icons: star only.',
  },
  {
    record: one(
      PM(
        "60105",
        "obligation",
        '"Fight."',
        "Uses (3 command counters).\n<b>Forced Action</b>: Exhaust this card and remove 1 command counter from it → deal 2 damage to a hero or ally.",
        null,
        {
          set_position: 10,
          boost: 1,
          boost_star: true,
          flavor: `"Aren't love and hate just two sides of the same coin?" —Purple Man`,
          illustrator: "Joey Vazquez",
        },
      ),
    ),
    reason: `Purple Man set obligation "Fight.": ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60105.jpg: "FIGHT." OBLIGATION, "Uses (3 command counters). Forced Action: Exhaust this card and remove 1 command counter from it -> deal 2 damage to a hero or ally." Flavor "Aren\'t love and hate just two sides of the same coin?" -Purple Man. Footer PURPLE MAN (10/15), Joey Vazquez, 105. Boost icons: star plus 1.',
  },
  {
    record: one(
      PM(
        "60106",
        "obligation",
        '"Protect."',
        "Uses (3 command counters).\n<b>Forced Action</b>: Exhaust this card and remove 1 command counter from it → give the villain a tough status card.",
        null,
        {
          set_position: 11,
          boost: 1,
          boost_star: true,
          flavor: `"You are to escort me to...everywhere I go." —Purple Man`,
          illustrator: "Allie Preswick",
        },
      ),
    ),
    reason: `Purple Man set obligation "Protect.": ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60106.jpg: "PROTECT." OBLIGATION, "Uses (3 command counters). Forced Action: Exhaust this card and remove 1 command counter from it -> give the villain a tough status card." Flavor "You are to escort me to...everywhere I go." -Purple Man. Footer PURPLE MAN (11/15), Allie Preswick, 106. Boost icons: star plus 1.',
  },
  {
    record: one(
      PM(
        "60107",
        "obligation",
        '"Serve."',
        "Uses (3 command counters).\n<b>Forced Action</b>: Exhaust this card and remove 1 command counter from it → place 2 threat on the main scheme.",
        null,
        {
          set_position: 12,
          boost: 1,
          boost_star: true,
          flavor: `"Clear your schedule. I am now your top priority." —Purple Man`,
          illustrator: "Allie Preswick",
        },
      ),
    ),
    reason: `Purple Man set obligation "Serve.": ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60107.jpg: "SERVE." OBLIGATION, "Uses (3 command counters). Forced Action: Exhaust this card and remove 1 command counter from it -> place 2 threat on the main scheme." Flavor "Clear your schedule. I am now your top priority." -Purple Man. Footer PURPLE MAN (12/15), Allie Preswick, 107. Boost icons: star plus 1.',
  },
  {
    record: one(
      PM(
        "60108",
        "side_scheme",
        "Power of Suggestion",
        "[star] Hinder 3[per_hero].\nEach minion gains the [[Influenced]] trait.",
        null,
        {
          set_position: 13,
          base_threat: 2,
          base_threat_fixed: true,
          base_threat_star: true,
          scheme_amplify: 1,
          boost: 3,
          boost_star: true,
          flavor: `"Feel my will conquering yours." —Purple Man`,
        },
      ),
    ),
    reason: `Purple Man set side scheme Power of Suggestion: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60108.jpg (landscape): POWER OF SUGGESTION, SIDE SCHEME, threat "2 star" (no per-hero icon, so fixed), amplify icon (same glyph as 60034 Deadliest Man Alive, which MarvelCDB has as scheme_amplify 1). Flavor "Feel my will conquering yours." -Purple Man. "star Hinder 3 per hero. Each minion gains the INFLUENCED trait." Footer PURPLE MAN (13/15), no illustrator printed, 108. Boost icons: star plus 3.',
  },
  {
    record: one(
      PM(
        "60109",
        "treachery",
        "Sway the Masses",
        "<b>When Revealed</b>: Choose an [[Influenced]] minion from the encounter discard pile and reveal it. Otherwise, this card gains surge.",
        null,
        {
          set_position: 14,
          quantity: 2,
          boost: 2,
          boost_star: true,
          flavor: "Nothing is more dangerous than a persuasive man with a loudspeaker.",
        },
      ),
    ),
    reason: `Purple Man set treachery Sway the Masses (2 copies): ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60109.jpg (14/15) and 60109_2.jpg (15/15), identical: SWAY THE MASSES, TREACHERY, "When Revealed: Choose an INFLUENCED minion from the encounter discard pile and reveal it. Otherwise, this card gains surge." Flavor "Nothing is more dangerous than a persuasive man with a loudspeaker." No illustrator printed, 109. Boost icons: star plus 2.',
  },

  // ---------------------------------------------------------------- Typhoid Mary (60110 to 60120)
  {
    record: twoSided(
      TM(
        "60110a",
        "villain",
        "Typhoid Mary",
        "<b>Forced Interrupt</b>: When Typhoid Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 10[per_hero].",
        "Mutant. Psionic. Underling.",
        {
          set_position: 1,
          health: 10,
          health_per_hero: true,
          scheme: 2,
          attack: 1,
          stage: "A",
          is_unique: true,
          flavor: '"It\'s time I tell my story. My life. The way I want to tell it."',
          illustrator: "Bruno Frenda",
        },
      ),
      TM(
        "60110b",
        "villain",
        "Bloody Mary",
        "<b>Forced Interrupt</b>: When Bloody Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 10[per_hero].",
        "Mutant. Psionic. Underling.",
        {
          set_position: 1,
          health: 10,
          health_per_hero: true,
          scheme: 1,
          attack: 2,
          stage: "A",
          is_unique: true,
          flavor: '"I\'ll never let anyone hurt us again."',
          illustrator: "Bruno Frenda",
        },
      ),
    ),
    reason: `Typhoid Mary villain stage A (Typhoid / Bloody Mary): ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60110a.jpg and 60110b.jpg. A: "+TYPHOID MARY" stage letter A, SCH 2, ATK 1, MUTANT. PSIONIC. UNDERLING., "Forced Interrupt: When Typhoid Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 10 per hero." Flavor "It\'s time I tell my story. My life. The way I want to tell it." Footer TYPHOID MARY (1/15) / HIT POINTS 10 per hero, 110A. B: "+BLOODY MARY" stage letter A (both faces print A), SCH 1, ATK 2, same text with Bloody Mary / her, flavor "I\'ll never let anyone hurt us again.", footer (1/15) / HIT POINTS 10 per hero, 110B. Both faces credit Bruno Frenda.',
  },
  {
    record: twoSided(
      TM(
        "60111a",
        "villain",
        "Typhoid Mary",
        "Toughness.\n<b>Forced Interrupt</b>: When Typhoid Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 13[per_hero].",
        "Mutant. Psionic. Underling.",
        {
          set_position: 2,
          health: 13,
          health_per_hero: true,
          scheme: 3,
          attack: 1,
          stage: "B",
          is_unique: true,
          flavor: '"It\'s time I tell my story. My life. The way I want to tell it."',
          illustrator: "Bruno Frenda",
        },
      ),
      TM(
        "60111b",
        "villain",
        "Bloody Mary",
        "<b>When Revealed</b>: Deal 1 damage to each identity.\n<b>Forced Interrupt</b>: When Bloody Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 13[per_hero].",
        "Mutant. Psionic. Underling.",
        {
          set_position: 2,
          health: 13,
          health_per_hero: true,
          scheme: 1,
          attack: 3,
          stage: "B",
          is_unique: true,
          flavor: '"I\'ll never let anyone hurt us again."',
          illustrator: "Bruno Frenda",
        },
      ),
    ),
    reason: `Typhoid Mary villain stage B (Typhoid / Bloody Mary): ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60111a.jpg and 60111b.jpg. A: "+TYPHOID MARY" stage letter B, SCH 3, ATK 1, "Toughness. Forced Interrupt: When Typhoid Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 13 per hero." Footer (2/15) / HIT POINTS 13 per hero, 111A. B: "+BLOODY MARY" stage letter B, SCH 1, ATK 3, "When Revealed: Deal 1 damage to each identity. Forced Interrupt: When Bloody Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 13 per hero." Footer (2/15) / HIT POINTS 13 per hero, 111B. Illustrator Bruno Frenda on both.',
  },
  {
    record: one(
      TM(
        "60112",
        "environment",
        "Disturbed Psyche",
        "Setup.\n<b>Setup</b>: Put the villain into play on a random side <i>(and reveal it)</i>.\n<b>Forced Interrupt</b>: When the villain phase ends, flip the villain.\n<b>If there are 3 or more tokens here, the players win the game!</b>",
        null,
        { set_position: 3, illustrator: "Bruno Frenda" },
      ),
    ),
    reason: `Typhoid Mary set environment Disturbed Psyche: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60112.jpg: DISTURBED PSYCHE, ENVIRONMENT, "Setup. Setup: Put the villain into play on a random side (and reveal it). Forced Interrupt: When the villain phase ends, flip the villain. If there are 3 or more tokens here, the players win the game!" (last sentence bold). No traits, no boost icons. Footer TYPHOID MARY (3/15), Bruno Frenda, 112.',
  },
  {
    record: twoSided(
      TM(
        "60113a",
        "side_scheme",
        "Establish Trust",
        "Permanent. Setup.\n[star] In expert mode, this card gains hinder 3[per_hero].\n<b>When Defeated</b>: Place 1 threat token on Disturbed Psyche. Flip this card.",
        null,
        {
          set_position: 4,
          base_threat: 8,
          base_threat_fixed: false,
          base_threat_star: true,
          permanent: true,
          flavor: "\"Mary, it's me. I don't want to fight you.\" —Matt Murdock",
          illustrator: "Facundo Moyano",
        },
      ),
      TM(
        "60113b",
        "attachment",
        "Mary Walker",
        "Attach to the villain. Permanent.\n[star] Attached villain cannot activate.\n<b>Forced Response</b>: After the villain takes damage or the round ends, deal each player 1 facedown encounter card and flip this card.",
        "Persona.",
        {
          set_position: 4,
          scheme: null,
          attack: null,
          scheme_star: true,
          attack_star: true,
          permanent: true,
          is_unique: true,
          flavor: '"One of us is tender, one of us is not, and one of us takes vengeance."',
          illustrator: "Andrea Di Vito & Laura Villari",
        },
      ),
    ),
    reason: `Typhoid Mary set double-sided Establish Trust / Mary Walker: ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60113a.jpg and 60113b.jpg. A (landscape): ESTABLISH TRUST, SIDE SCHEME, threat "8 per hero star" (per-hero icon and a star), "Permanent. Setup. star In expert mode, this card gains hinder 3 per hero. When Defeated: Place 1 threat token on Disturbed Psyche. Flip this card." Flavor "Mary, it\'s me. I don\'t want to fight you." -Matt Murdock. Footer TYPHOID MARY (4/15), Facundo Moyano, 113A. B: "+MARY WALKER", ATTACHMENT, PERSONA., SCH star and ATK star printed (the stars replace the numbers: scheme and attack null, scheme_star and attack_star true), "Attach to the villain. Permanent. star Attached villain cannot activate. Forced Response: After the villain takes damage or the round ends, deal each player 1 facedown encounter card and flip this card." Flavor "One of us is tender, one of us is not, and one of us takes vengeance." Footer (4/15), Andrea Di Vito & Laura Villari, 113B. Neither face prints boost icons.',
  },
  {
    record: one(
      TM(
        "60114",
        "attachment",
        "Telekinesis",
        "Attach to the villain.\n<b>Hero Action</b>: Spend [mental] [mental] resources → discard this card.\n<hr />\n[star] <b>Boost</b>: If Typhoid Mary is activating, take 3 indirect damage. Exhaust each character damaged this way.",
        "Psionic. Superpower.",
        { set_position: 5, scheme: 2, boost: 1, boost_star: true, illustrator: "Bruno Frenda" },
      ),
    ),
    reason: `Typhoid Mary set attachment Telekinesis: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60114.jpg: TELEKINESIS, ATTACHMENT, PSIONIC. SUPERPOWER., +2 SCH. "Attach to the villain. Hero Action: Spend [two node-link icons, read as the mental resource glyph] resources -> discard this card. star Boost: If Typhoid Mary is activating, take 3 indirect damage. Exhaust each character damaged this way." Footer TYPHOID MARY (5/15), Bruno Frenda, 114. Boost icons: star plus 1.',
  },
  {
    record: one(
      TM(
        "60115",
        "treachery",
        "Psionic Slash",
        "<b>When Revealed</b>: If the Mary Walker attachment is in play, flip it and reveal Establish Trust. The villain schemes.\n<hr />\n[star] <b>Boost</b>: If Typhoid Mary is activating, deal 3 damage to an ally you control.",
        null,
        { set_position: 6, quantity: 2, boost_star: true, illustrator: "Bruno Frenda" },
      ),
    ),
    reason: `Typhoid Mary set treachery Psionic Slash (2 copies): ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60115.jpg (6/15) and 60115_2.jpg (7/15), identical: PSIONIC SLASH, TREACHERY, "When Revealed: If the Mary Walker attachment is in play, flip it and reveal Establish Trust. The villain schemes. star Boost: If Typhoid Mary is activating, deal 3 damage to an ally you control." Bruno Frenda, 115. Boost icons: star only.',
  },
  {
    record: one(
      TM(
        "60116",
        "treachery",
        "Psi Nova",
        "<b>When Revealed</b>: Deal 1 damage to each character you control. You are stunned.\n<hr />\n[star] <b>Boost</b>: If Typhoid Mary is activating, you are stunned.",
        null,
        {
          set_position: 8,
          boost: 2,
          boost_star: true,
          flavor: '"ENOUGH!" —Typhoid Mary',
          illustrator: "Bruno Frenda",
        },
      ),
    ),
    reason: `Typhoid Mary set treachery Psi Nova: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60116.jpg: PSI NOVA, TREACHERY, "When Revealed: Deal 1 damage to each character you control. You are stunned. star Boost: If Typhoid Mary is activating, you are stunned." Flavor "ENOUGH!" -Typhoid Mary. Footer TYPHOID MARY (8/15), Bruno Frenda, 116. Boost icons: star plus 2.',
  },
  {
    record: one(
      TM(
        "60117",
        "attachment",
        "Assembled Armor",
        "Attach to the villain.\n<b>Forced Interrupt</b>: When the villain would take any amount of damage, place it here instead. Then, if there is 5 or more damage here (8 or more in expert mode), discard this attachment.\n<hr />\n[star] <b>Boost</b>: If Bloody Mary is activating, you are confused.",
        "Armor.",
        { set_position: 9, attack: 2, boost: 1, boost_star: true, illustrator: "Bruno Frenda" },
      ),
    ),
    reason: `Typhoid Mary set attachment Assembled Armor: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60117.jpg: ASSEMBLED ARMOR, ATTACHMENT, ARMOR., +2 ATK. "Attach to the villain. Forced Interrupt: When the villain would take any amount of damage, place it here instead. Then, if there is 5 or more damage here (8 or more in expert mode), discard this attachment. star Boost: If Bloody Mary is activating, you are confused." Footer TYPHOID MARY (9/15), Bruno Frenda, 117. Boost icons: star plus 1.',
  },
  {
    record: one(
      TM(
        "60118",
        "treachery",
        "Hail of Blades",
        "<b>When Revealed</b>: If the Mary Walker attachment is in play, flip it and reveal Establish Trust. The villain attacks you <i>(even if you are in alter-ego form)</i>.\n<hr />\n[star] <b>Boost</b>: If Bloody Mary is activating, take 2 damage.",
        null,
        { set_position: 10, quantity: 2, boost_star: true, illustrator: "Bruno Frenda" },
      ),
    ),
    reason: `Typhoid Mary set treachery Hail of Blades (2 copies): ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60118.jpg (10/15) and 60118_2.jpg (11/15), identical: HAIL OF BLADES, TREACHERY, "When Revealed: If the Mary Walker attachment is in play, flip it and reveal Establish Trust. The villain attacks you (even if you are in alter-ego form). star Boost: If Bloody Mary is activating, take 2 damage." Bruno Frenda, 118. Boost icons: star only.',
  },
  {
    record: one(
      TM(
        "60119",
        "treachery",
        "Scavenged Bulwark",
        "Surge.\n<b>When Revealed</b>: Give the villain a tough status card.\n<hr />\n[star] <b>Boost</b>: If Bloody Mary is activating, give her a tough status card.",
        null,
        {
          set_position: 12,
          boost: 2,
          boost_star: true,
          flavor: `"If we steel ourselves with as much armor as possible...they can't touch us." —Bloody Mary`,
          illustrator: "Bruno Frenda",
        },
      ),
    ),
    reason: `Typhoid Mary set treachery Scavenged Bulwark: ${NO_MARVELCDB}.`,
    evidence:
      'Scan 60119.jpg: SCAVENGED BULWARK, TREACHERY, "Surge. When Revealed: Give the villain a tough status card. star Boost: If Bloody Mary is activating, give her a tough status card." Flavor "If we steel ourselves with as much armor as possible...they can\'t touch us." -Bloody Mary. Footer TYPHOID MARY (12/15), Bruno Frenda, 119. Boost icons: star plus 2.',
  },
  {
    record: one(
      TM(
        "60120",
        "minion",
        "Hand Lookout",
        "Guard. Toughness.\n<hr />\n[star] <b>Boost</b>: Give the activating enemy an additional boost card.",
        "Hand. Ninja.",
        {
          set_position: 13,
          quantity: 3,
          health: 4,
          scheme: 0,
          attack: 2,
          boost: 1,
          boost_star: true,
          flavor: `"Let's all keep an eye out for each other. It's the only way to survive in this city." —Typhoid Mary`,
          illustrator: "Ivan Fiorelli",
        },
      ),
    ),
    reason: `Typhoid Mary set minion Hand Lookout (3 copies): ${NO_MARVELCDB}.`,
    evidence:
      'Scans 60120.jpg (13/15), 60120_2.jpg (14/15), 60120_3.jpg (15/15), identical: HAND LOOKOUT, MINION, SCH 0, ATK 2, hit-point circle 4, HAND. NINJA., "Guard. Toughness. star Boost: Give the activating enemy an additional boost card." Flavor "Let\'s all keep an eye out for each other. It\'s the only way to survive in this city." -Typhoid Mary. Ivan Fiorelli, 120. Boost icons: star plus 1.',
  },
];
