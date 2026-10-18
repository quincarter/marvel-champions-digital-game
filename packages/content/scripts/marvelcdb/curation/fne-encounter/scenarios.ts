/**
 * Fear No Evil (MC60) scenario encounter sets, transcribed from the Hall of Heroes scans in
 * `%TEMP%\hohfne\img\` (60121 to 60158; owner-approved source, MarvelCDB lacks the box's scenario half, survey §3).
 * Five sets, 43 printed copies:
 *
 * - Art Museum Heist 60121 to 60127 (9 of 9: 7 records)
 * - The Getaway 60128 to 60133 (8 of 8: 6 records, 60129 is one double-sided attachment)
 * - Protection Racket 60134 to 60141 (9 of 9: 5 main schemes sharing one printed 1A, then 3 records)
 * - The Raft Breakout 60142 to 60150 (9 of 9: 9 records)
 * - Stop the Presses! 60151 to 60158 (9 of 9: 8 records)
 *
 * Conventions (copied from aoa.ts TOWERING_CITADEL and the aos.json / aoa.json records):
 * - Every printed N/M footer counts copies, so `set_position` is the first copy's N and `quantity` the copies printed
 *   (Art Thief 6/9 and 7/9 is one record, set_position 6, quantity 2). The `_2` scans were checked and are the same
 *   card art and text as the first copy.
 * - Two-sided cards are a top-level `a` record with the `b` face nested as `linked_card` (`hidden: true`).
 * - Threat fields: a per-hero icon beside a number means `*_fixed: false`; a bare number means `*_fixed: true`;
 *   "+X" escalation is `escalation_threat: -1` (as aos 50067b, gmw 16091b); a star beside a value is the `*_star` flag.
 * - A bare star in a stat box (no number) is the value `null` with the `*_star` flag (aos 50116, gob 02020).
 * - Boost: each red boost icon is one point of `boost`; the red star icon is `boost_star` (aoa 45110).
 * - Resource icons in text, read against Android Efficiency 01144 and Holding Cell 50107a: lightning is [energy], fist
 *   is [physical], the burst is [wild], the remaining bone-like icon is [mental] (the fourth type).
 * - No art is wired: `imagesrc` is null everywhere.
 */
import type { RawCard } from "../../raw-types.ts";
import type { AddedRecord } from "../types.ts";

type Fields = Record<string, unknown>;

interface SetInfo {
  readonly code: string;
  readonly name: string;
}

const AMH: SetInfo = { code: "art_museum_heist", name: "Art Museum Heist" };
const GETAWAY: SetInfo = { code: "the_getaway", name: "The Getaway" };
const PROTECTION: SetInfo = { code: "protection_racket", name: "Protection Racket" };
const RAFT: SetInfo = { code: "the_raft_breakout", name: "The Raft Breakout" };
const PRESSES: SetInfo = { code: "stop_the_presses", name: "Stop the Presses!" };

const TYPE_NAMES: Readonly<Record<string, string>> = {
  main_scheme: "Main Scheme",
  side_scheme: "Side Scheme",
  attachment: "Attachment",
  minion: "Minion",
  treachery: "Treachery",
  ally: "Ally",
  obligation: "Obligation",
  support: "Support",
  environment: "Environment",
};

/** A full MarvelCDB-shaped record (nulls included, as aoa.ts TOWERING_CITADEL), `over` wins. */
function face(set: SetInfo, type: string, code: string, name: string, over: Fields): Fields {
  const text = (over.text as string | null | undefined) ?? null;
  const traits = (over.traits as string | null | undefined) ?? null;
  const base: Fields = {
    pack_code: "fne",
    pack_name: "Fear No Evil",
    pack_legacy: false,
    type_code: type,
    type_name: TYPE_NAMES[type],
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: set.code,
    card_set_name: set.name,
    card_set_type_name_code: "villain",
    card_set_parent_code: null,
    position: Number.parseInt(code.slice(2, 5), 10),
    set_position: null,
    code,
    name,
    real_name: name,
    subname: null,
    cost: null,
    cost_per_hero: false,
    cost_star: false,
    text,
    real_text: text,
    boost: null,
    quantity: 1,
    resource_energy: null,
    resource_mental: null,
    resource_physical: null,
    resource_wild: null,
    health: null,
    health_per_group: false,
    health_per_hero: false,
    thwart: null,
    thwart_cost: null,
    scheme: null,
    attack: null,
    attack_cost: null,
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
  };
  return { ...base, ...over };
}

/** A one-sided card. */
function single(set: SetInfo, type: string, code: string, name: string, setPosition: number, over: Fields): RawCard {
  return face(set, type, code, name, { set_position: setPosition, ...over }) as unknown as RawCard;
}

/** A two-sided card: the `a` record carries the `b` face as `linked_card`. */
function twoSided(
  set: SetInfo,
  type: string,
  code: string,
  setPosition: number | null,
  a: { name: string; over: Fields },
  b: { name: string; over: Fields },
): RawCard {
  const bCode = `${code}b`;
  const back = face(set, type, bCode, b.name, { set_position: setPosition, hidden: true, ...b.over });
  const front = face(set, type, `${code}a`, a.name, {
    set_position: setPosition,
    linked_to_code: bCode,
    linked_to_name: b.name,
    linked_card: back,
    ...a.over,
  });
  return front as unknown as RawCard;
}

const SHARED_LOSS = "<b>If this stage is completed, the players lose the game.</b>";
const RACKET_LOSS = "<b>If any main scheme is completed or any player is eliminated, the players lose the game.</b>";

/** Main scheme side A stat blocks: none. */
const SIDE_A: Fields = { stage: "1A" };

/** Per-hero main scheme side B stat block: target, base (start) and escalation threat. */
function schemeB(target: number, base: number, escalation: number, perHero: boolean, over: Fields): Fields {
  return {
    stage: "1B",
    threat: target,
    threat_fixed: !perHero,
    base_threat: base,
    base_threat_fixed: !perHero,
    escalation_threat: escalation,
    escalation_threat_fixed: !perHero,
    ...over,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Art Museum Heist (60121 to 60127)
// ---------------------------------------------------------------------------------------------------------------

const ART_MUSEUM_HEIST_MAIN = twoSided(
  AMH,
  "main_scheme",
  "60121",
  1,
  {
    name: "Art Museum Heist",
    over: {
      ...SIDE_A,
      illustrator: "Allie Preswick",
      text: "<b>Contents</b>: Chosen [[Underling]] villain <i>(see rulebook p. 5)</i>. Chosen villain's set, Art Museum Heist set, and Standard set. Two modular encounter sets <i>(Cops and The Owl)</i>.\n<b>Setup</b>: Find this encounter set's 4 [[Art]] attachments and attach 1 at random to the villain. Shuffle the other 3 into the encounter deck.",
    },
  },
  {
    name: "Art Museum Heist",
    over: schemeB(9, 1, -1, true, {
      escalation_threat_star: true,
      illustrator: "Allie Preswick",
      text:
        "[star] X is 1 more than the number of [[Art]] attachments on the villain.\n<b>Forced Response</b>: After an enemy makes an undefended attack against an identity, attach 1 [[Art]] attachment on that identity to the villain.\n" +
        SHARED_LOSS,
    }),
  },
);

const ART_BOOST_ICONS: Fields = { boost: 2, scheme: 1, thwart: 1, traits: "Art.", is_unique: true };

function artAttachment(code: string, name: string, setPosition: number, illustrator: string, text: string): RawCard {
  return single(AMH, "attachment", code, name, setPosition, { ...ART_BOOST_ICONS, illustrator, text });
}

const IMPOSSIBLE_OBJECT = artAttachment(
  "60122",
  "Impossible Object",
  2,
  "Sebastián Guidobono",
  "Surge.\nAttach to the villain.\n<b>Forced Response</b>: After this card attaches to a character, confuse that character.\n<b>Hero Action</b>: Spend a [mental] resource or exhaust your hero → attach this card to your hero.",
);
const INSPIRING_POTTERY = artAttachment(
  "60123",
  "Inspiring Pottery",
  3,
  "Sebastián Guidobono",
  "Surge.\nAttach to the villain.\nAttached character gains stalwart.\n<b>Hero Action</b>: Spend a [wild] resource or exhaust your hero → attach this card to your hero.",
);
const REPLICA_SHIELD = artAttachment(
  "60124",
  "Replica Shield",
  4,
  "Facundo Moyano",
  "Surge.\nAttach to the villain.\n<b>Forced Response</b>: After this card attaches to a character, give that character a tough status card.\n<b>Hero Action</b>: Spend a [physical] resource or exhaust your hero → attach this card to your hero.",
);
const STUNNING_LANDSCAPE = artAttachment(
  "60125",
  "Stunning Landscape",
  5,
  "Facundo Moyano",
  "Surge.\nAttach to the villain.\n<b>Forced Response</b>: After this card attaches to a character, stun that character.\n<b>Hero Action</b>: Spend a [energy] resource or exhaust your hero → attach this card to your hero.",
);

const ART_THIEF = single(AMH, "minion", "60126", "Art Thief", 6, {
  quantity: 2,
  traits: "Thief.",
  scheme: 2,
  attack: 2,
  health: 3,
  boost_star: true,
  illustrator: "Aitor Prieto",
  text: "<b>When Revealed</b>: Search the encounter deck and discard pile for an [[Art]] attachment and attach it to the villain. If you cannot, move an [[Art]] attachment from an identity to the villain.\n<hr />\n[star] <b>Boost</b>: Move an [[Art]] attachment from an identity to the villain.",
});

const TUG_OF_WAR = single(AMH, "treachery", "60127", "Tug of War", 8, {
  quantity: 2,
  boost: 1,
  illustrator: "Andrea Di Vito & Laura Villari",
  text: "<b>When Revealed</b>: You may spend [physical][physical][physical] resources to move an [[Art]] attachment from the villain to your identity. Otherwise, move an [[Art]] attachment from an identity to the villain and this card gains surge.",
});

// ---------------------------------------------------------------------------------------------------------------
// The Getaway (60128 to 60133)
// ---------------------------------------------------------------------------------------------------------------

const GETAWAY_MAIN = twoSided(
  GETAWAY,
  "main_scheme",
  "60128",
  1,
  {
    name: "The Getaway",
    over: {
      ...SIDE_A,
      illustrator: "Kaihound",
      text: "<b>Contents</b>: Chosen [[Underling]] villain <i>(see rulebook p. 5)</i>. Chosen villain's set, The Getaway set, and Standard set. Two modular encounter sets <i>(Cops and Drive)</i>.\n<b>Setup</b>: Place 1 speed counter here (2 counters instead in expert mode). Attach the Out Front attachment (129A) to the villain.",
    },
  },
  {
    name: "The Getaway",
    over: schemeB(9, 2, 2, true, {
      illustrator: "Kaihound",
      text:
        "<b>Forced Interrupt</b>: When the round ends, if there is threat here, do each of the following:\n1. Place 1 speed counter here.\n2. If Alongside is in play, flip it to Out Front. Otherwise, place 1 additional speed counter here.\n" +
        SHARED_LOSS,
    }),
  },
);

const OUT_FRONT_ALONGSIDE = twoSided(
  GETAWAY,
  "attachment",
  "60129",
  2,
  {
    name: "Out Front",
    over: {
      attack_star: true,
      permanent: true,
      illustrator: "Bruno Frenda",
      text: "Permanent. Attach to the villain.\nIf there is no threat on the main scheme, flip this card.\n[star] Attached villain's attacks gain ranged.\n<b>Forced Interrupt</b>: When the villain would be dealt any amount of damage, remove that amount of threat from the main scheme instead <i>(ignoring crisis ([crisis]) icons)</i>.",
    },
  },
  {
    name: "Alongside",
    over: {
      permanent: true,
      illustrator: "Sebastián Guidobono",
      flavor: "New York City traffic is brutal.",
      text: "Permanent.\n<b>When Revealed</b>: Each player takes 1 indirect damage. The villain takes 2[per_hero] damage.",
    },
  },
);

const ESCORT_VEHICLE = single(GETAWAY, "minion", "60130", "Escort Vehicle", 3, {
  traits: "Vehicle.",
  scheme: 2,
  attack: 2,
  health: 5,
  boost: 3,
  illustrator: "Sebastián Guidobono",
  text: "Guard. Patrol.\nIf the number of speed counters on the main scheme is at least:\n• 3 — This minion gains toughness.\n• 6 — This minion also gains quickstrike.\n• 9 — This minion also gains surge.",
});

const JACKKNIFED_TANKER_TRUCK = single(GETAWAY, "side_scheme", "60131", "Jackknifed Tanker Truck", 4, {
  base_threat: 2,
  base_threat_fixed: true,
  base_threat_star: true,
  scheme_crisis: 1,
  boost: 2,
  illustrator: "Sebastián Guidobono",
  flavor: '"Eat your heart out, Johnny Blaze!" –Echo',
  text: "[star] Hinder 1[per_hero].\nThe villain cannot be dealt damage.",
});

const BURNING_RUBBER = single(GETAWAY, "treachery", "60132", "Burning Rubber", 5, {
  quantity: 2,
  boost: 1,
  illustrator: "Sebastián Guidobono",
  flavor: `Skr${"e".repeat(7)}!`,
  text: "<b>When Revealed</b>: For each speed counter on the main scheme, choose:\n• Spend 1 resource of any type.\n• Place 1 threat on the main scheme.",
});

const PEDESTRIANS = single(GETAWAY, "treachery", "60133", "Pedestrians", 7, {
  quantity: 2,
  boost: 1,
  illustrator: "Ivan Fiorelli",
  flavor: '"Hope you\'ve got your seatbelts on!" –Iron Fist',
  text: "<b>When Revealed</b>: For each speed counter on the main scheme, choose:\n• Exhaust a character you control.\n• Take 1 indirect damage.",
});

// ---------------------------------------------------------------------------------------------------------------
// Protection Racket (60134 to 60141)
// ---------------------------------------------------------------------------------------------------------------

const RACKET_A_TEXT =
  "<b>Contents</b>: Chosen [[Underling]] villain <i>(see rulebook p. 5)</i>. Chosen villain's set, Protection Racket set, and Standard set. Two modular encounter sets <i>(Disasters and Tracksuit Mafia)</i>.\n<b>Setup</b>: Each player chooses a single Protection Racket main scheme (at random in expert mode), places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play.";

/** One of the five Protection Racket main schemes: the shared 1A (set_position unprinted) over its own 1B. */
function racketScheme(
  code: string,
  setPosition: number,
  name: string,
  illustrator: string,
  text: string,
  flavor = "",
): RawCard {
  return twoSided(
    PROTECTION,
    "main_scheme",
    code,
    setPosition,
    {
      name: "Protection Racket",
      over: {
        ...SIDE_A,
        // The shared 1A prints "(?/9)" and the collector number "???": no position of its own.
        set_position: null,
        illustrator: "Andrea Di Vito & Laura Villari",
        text: RACKET_A_TEXT,
      },
    },
    { name, over: schemeB(10, 0, 1, false, { illustrator, flavor, text }) },
  );
}

const BATTLE_IN_THE_BODEGA = racketScheme(
  "60134",
  1,
  "Battle in the Bodega",
  "Afif Khaled",
  "<b>Forced Response</b>: After a character in this play area is attacked, deal 1 damage to the attacker and place 1 threat here. (Limit once per phase in standard mode.)\n" +
    RACKET_LOSS,
);
const BULL_IN_A_CHINA_SHOP = racketScheme(
  "60135",
  2,
  "Bull in a China Shop",
  "Afif Khaled",
  "<b>Forced Interrupt</b>: When excess damage is dealt to an ally (in expert mode, an ally or a minion) in this play area, place an equal amount of threat on this scheme.\n" +
    RACKET_LOSS,
);
const HUNG_OUT_TO_DRY = racketScheme(
  "60136",
  3,
  "Hung Out to Dry",
  "Joey Vazquez",
  "<b>Forced Response</b>: After a character enters play in this play area, deal 1 damage to it and place 1 threat here.\n" +
    RACKET_LOSS,
  '"Calm down. It\'s on the gentle cycle."\n–Jessica Jones',
);
const PAWN_SHOP_SHOWDOWN = racketScheme(
  "60137",
  4,
  "Pawn Shop Showdown",
  "Joey Vazquez",
  "Reduce the cost of the first upgrade played into this play area each round by 1.\n<b>Forced Response</b>: After an attachment or upgrade enters play in this play area, place 1 threat here.\n" +
    RACKET_LOSS,
);
const A_SLICE_OF_THE_PIZZA_DOUGH = racketScheme(
  "60138",
  5,
  "A Slice of the Pizza Dough",
  "Andrea Di Vito & Laura Villari",
  "<b>Forced Response</b>: After a character in this play area defeats another character or a side scheme <i>(in any play area)</i>, heal 1 damage from the defeating character and place 1 threat here.\n" +
    RACKET_LOSS,
);

const SHOP_PROPRIETOR = single(PROTECTION, "ally", "60139", "Shop Proprietor", 6, {
  traits: "Civilian.",
  health: 3,
  thwart: 1,
  thwart_cost: 2,
  attack: 1,
  attack_cost: 2,
  illustrator: "Sebastián Guidobono",
  text: "<b>When Revealed</b>: Put Shop Proprietor into play under your control. This card gains surge.\n<b>Forced Interrupt</b>: When this ally leaves play, place 4 threat on the main scheme in your play area.",
});

const MAN_BULL = single(PROTECTION, "minion", "60140", "Man-Bull", 7, {
  traits: "Brute.",
  is_unique: true,
  scheme: 2,
  attack: 4,
  attack_star: true,
  health: 6,
  boost: 2,
  boost_star: true,
  text: "[star] <b>Forced Response</b>: After Man-Bull attacks, place threat on the main scheme equal to the excess damage dealt by this attack.\n<hr />\n[star] <b>Boost</b>: If this activation is an attack, place threat on the main scheme equal to the excess damage dealt by this attack.",
});

const CHANGE_OF_VENUE = single(PROTECTION, "treachery", "60141", "Change of Venue", 8, {
  quantity: 2,
  boost: 1,
  boost_star: true,
  illustrator: "Allie Preswick",
  text: 'Surge.\n<b>When Revealed</b>: Swap your main scheme with a random set-aside main scheme. Place the threat from the previous scheme on the new scheme.\n<hr />\n[star] <b>Boost</b>: Resolve this card\'s "<b>When Revealed</b>" ability.',
});

// ---------------------------------------------------------------------------------------------------------------
// The Raft Breakout (60142 to 60150)
// ---------------------------------------------------------------------------------------------------------------

const RAFT_MAIN = twoSided(
  RAFT,
  "main_scheme",
  "60142",
  1,
  {
    name: "The Raft Breakout",
    over: {
      ...SIDE_A,
      illustrator: "Joey Vazquez",
      text: "<b>Contents</b>: Chosen [[Underling]] villain <i>(see rulebook p. 5)</i>. Chosen villain's set, The Raft Breakout set, and Standard set. Two modular encounter sets <i>(The Owl and Tombstone)</i>.\n<b>Setup</b>: Attach Master Key to the villain. Each player discards cards from the encounter deck until they discard a [[Prisoner]] minion and reveal that minion.",
    },
  },
  {
    name: "The Raft Breakout",
    over: schemeB(11, 2, 1, true, {
      illustrator: "Joey Vazquez",
      flavor: '"Go forth and wreak havoc!"\n–Proxima Midnight',
      text:
        'Each minion gains: "<b>When Defeated</b>: Remove 1 threat from the main scheme (2 threat instead if this minion has the [[Elite]] trait)."\n' +
        SHARED_LOSS,
    }),
  },
);

const MASTER_KEY = single(RAFT, "attachment", "60143", "Master Key", 2, {
  is_unique: true,
  permanent: true,
  traits: "Item.",
  scheme_star: true,
  illustrator: "Ivan Fiorelli",
  flavor: ">Security overridden.\n>Door lock disengaged.",
  text: "Attach to the villain.\nPermanent.\n[star] <b>Forced Response</b>: After the villain schemes against you, deal each of that activation's boost cards that is a minion to yourself as a facedown encounter card.",
});

const ABSORBING_MAN = single(RAFT, "minion", "60144", "Absorbing Man", 3, {
  is_unique: true,
  traits: "Brute. Elite. Prisoner.",
  scheme: 1,
  attack: 1,
  attack_star: true,
  health: 6,
  boost: 3,
  illustrator: "Eleonora Carlini",
  text: "Villainous.\n[star] <b>Forced Interrupt</b>: When Absorbing Man attacks you, tuck the top card of your deck under him. Absorbing Man gets +1 ATK for this attack for each different resource type <i>([energy], [mental], [physical], and [wild])</i> on cards tucked under him.",
});

const BARON_ZEMO = single(RAFT, "minion", "60145", "Baron Zemo", 4, {
  is_unique: true,
  traits: "Elite. Hydra. Prisoner.",
  scheme: 2,
  attack: 1,
  health: 6,
  boost: 3,
  illustrator: "Afif Khaled",
  text: "Villainous.\nTreat each ally with threat on it as a [[Deceived]] minion with a blank text box. Its SCH is equal to its base THW and it does not take consequential damage.\n<b>When Revealed</b>: Place 1 threat on an ally without threat on it. It engages its controller.",
});

const DRANG = single(RAFT, "minion", "60146", "Drang", 5, {
  is_unique: true,
  traits: "Badoon. Elite. Prisoner.",
  scheme: 1,
  attack: 1,
  attack_star: true,
  health: 6,
  boost: 3,
  illustrator: "Joey Vazquez",
  flavor: '"Ship, target my coordinates!"',
  text: "Villainous.\n[star] <b>Forced Response</b>: After Drang attacks you, place 1 barrage counter on him. Then, take 1 indirect damage for each barrage counter on Drang.",
});

const MYSTERIO = single(RAFT, "minion", "60147", "Mysterio", 6, {
  is_unique: true,
  traits: "Criminal. Elite. Prisoner.",
  scheme: 2,
  attack: 1,
  attack_star: true,
  health: 6,
  boost: 3,
  illustrator: "Joey Vazquez",
  text: "Villainous.\n[star] <b>Forced Response</b>: After Mysterio attacks you, deal each of that activation's boost cards that is a treachery to yourself as a facedown encounter card.",
});

const PROXIMA_MIDNIGHT = single(RAFT, "minion", "60148", "Proxima Midnight", 7, {
  is_unique: true,
  traits: "Black Order. Elite. Prisoner.",
  scheme: 1,
  attack: 2,
  attack_star: true,
  health: 7,
  boost: 3,
  illustrator: "Joey Vazquez",
  text: "Villainous.\n[star] <b>Forced Interrupt</b>: When Proxima Midnight attacks you, choose to either place 1 threat on the main scheme, or Proxima Midnight gets +2 ATK for this attack.",
});

const RHINO = single(RAFT, "minion", "60149", "Rhino", 8, {
  is_unique: true,
  traits: "Brute. Elite. Prisoner.",
  scheme: 1,
  attack: 3,
  attack_star: true,
  health: 7,
  boost: 3,
  boost_star: true,
  illustrator: "Kaihound",
  text: "Toughness. Villainous.\n[star] Rhino's attacks gain overkill.\n<hr />\n[star] <b>Boost</b>: Give the activating enemy a tough status card.",
});

const IMPRISONED = single(RAFT, "obligation", "60150", "Imprisoned", 9, {
  boost_star: true,
  illustrator: "Facundo Moyano",
  text: "You cannot thwart, attack, or change to alter-ego form.\n<b>Hero Action</b>: Spend 3 resources of any type or exhaust characters you control with a total THW of 3 or more → discard this card.\n<hr />\n[star] <b>Boost</b>: Reveal this card.",
});

// ---------------------------------------------------------------------------------------------------------------
// Stop the Presses! (60151 to 60158)
// ---------------------------------------------------------------------------------------------------------------

const PRESSES_MAIN = twoSided(
  PRESSES,
  "main_scheme",
  "60151",
  1,
  {
    name: "Stop the Presses!",
    over: {
      ...SIDE_A,
      illustrator: "Afif Khaled",
      text: "<b>Contents</b>: Chosen [[Underling]] villain <i>(see rulebook p. 5)</i>. Chosen villain's set, Stop the Presses! set, and Standard set. Two modular encounter sets <i>(Tombstone and Tracksuit Mafia)</i>.\n<b>Setup</b>: Put the Daily Bugle environment into play. Each player puts a random [[Daily Bugle]] support from this encounter set into play under their control. Remove each remaining [[Daily Bugle]] support from the game.",
    },
  },
  {
    name: "Stop the Presses!",
    over: schemeB(9, 1, 1, true, {
      illustrator: "Afif Khaled",
      text: "<b>Forced Response</b>: After an enemy makes an undefended attack against you, choose:\n• Place 2 threat here (3 threat instead in expert mode).\n• Remove 1 stamina counter from a [[Daily Bugle]] support you control.\n<b>If a [[Daily Bugle]] support leaves play or this stage is completed, the players lose the game.</b>",
    }),
  },
);

const DAILY_BUGLE = single(PRESSES, "environment", "60152", "Daily Bugle", 2, {
  is_unique: true,
  flavor:
    "Under the ownership of J. Jonah Jameson, the Daily Bugle became one of the most-read newspapers in the United States.",
  text: "<b>Alter-Ego Action</b>: Exhaust a [[Daily Bugle]] support you control → place 1 stamina counter on that support. <i>(Any player can do this.)</i>",
});

function bugleSupport(code: string, name: string, setPosition: number, text: string): RawCard {
  return single(PRESSES, "support", code, name, setPosition, {
    cost: 2,
    is_unique: true,
    traits: "Daily Bugle. Persona.",
    resource_mental: 1,
    text: `Uses (3 stamina counters).\n${text}`,
  });
}

const BEN_URICH = bugleSupport(
  "60153",
  "Ben Urich",
  3,
  "<b>Action</b>: Exhaust Ben Urich and remove 1 stamina counter from him → look at the top 2 cards of the encounter deck. You may discard 1 of those cards. <i>(Put the rest back in the same order.)</i>",
);
const BETTY_BRANT = bugleSupport(
  "60154",
  "Betty Brant",
  4,
  '<b>Interrupt</b>: When a boost card is turned faceup, exhaust Betty Brant and remove 1 stamina counter from her → cancel that card\'s boost icons and "<b>Boost</b>" ability. Give the activating enemy another boost card for this activation.',
);
const J_JONAH_JAMESON = bugleSupport(
  "60155",
  "J. Jonah Jameson",
  5,
  "<b>Action</b>: Exhaust J. Jonah Jameson, remove 1 stamina counter from him, and deal yourself 1 facedown encounter card → draw 2 cards.",
);
const ROBBIE_ROBERTSON = bugleSupport(
  "60156",
  "Robbie Robertson",
  6,
  "<b>Response</b>: After a player is dealt a facedown encounter card, exhaust Robbie Robertson and remove 1 stamina counter from him → look at that encounter card. You may discard it and deal that player another facedown encounter card.",
);

const EXCLUSIVE_INTERVIEW = single(PRESSES, "side_scheme", "60157", "Exclusive Interview", 7, {
  base_threat: 6,
  base_threat_fixed: true,
  boost: 1,
  illustrator: "Sebastián Guidobono",
  flavor: '"I\'d love for your audience to hear my side of the story. Now, where to begin...?"',
  text: "[[Daily Bugle]] supports cannot ready.\n<b>When Revealed</b>: Exhaust each [[Daily Bugle]] support.",
});

const BREAKING_NEWS = single(PRESSES, "treachery", "60158", "Breaking News", 8, {
  quantity: 2,
  boost_star: true,
  illustrator: "Sebastián Guidobono",
  text: "<b>When Revealed</b>: Choose:\n• Exhaust a [[Daily Bugle]] support <i>(under any player's control)</i> and remove 1 stamina counter from it.\n• Place 2 threat on the main scheme.\n<hr />\n[star] <b>Boost</b>: Exhaust a [[Daily Bugle]] support <i>(under any player's control)</i>.",
});

// ---------------------------------------------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------------------------------------------

const ART_ICON_NOTE =
  'Attachment, stat burst "+1 SCH/THW" (recorded as scheme 1 and thwart 1: precedent: encounter attachments with a combined SCH/ATK burst are coded with both scheme and attack set, e.g. aoa 45066, aos 50115; second check 2026-10-18 agrees), two boost icons, unique marker before the title, trait ART.';

const RACKET_A_EVIDENCE =
  'Side A identical in scans 60134a to 60138a (five byte-identical files, md5 0270041702f5d760d18811bf5053db31): "1A", footer "PROTECTION RACKET (?/9)", collector number "???", art credit "Andrea Di Vito & Laura Villari". The set_position of each a face is null (unprinted); each is emitted as the front of its own 1B because the five 1B faces are five separate printed cards (1/9 to 5/9). Second check 2026-10-18: structure confirmed. The rulebook (mc60 p. 13 setup, "Main Scheme Deck: Protection Racket (x5)": each player chooses one main scheme, places it and flips it to 1B) means five double-sided cards whose 1A faces are identical and whose 1B faces differ; one record per physical card is right, and Hall of Heroes names the 1A scans per card (60134a to 60138a). The null set_position on the 1A faces is the printed "?"; MarvelCDB would more likely give a and b the same position, harmless here.';

const RACKET_B_COMMON =
  'Side B "1B": threat target 10 with no per-hero icon (fixed), escalation "+1" with no icon (fixed), base threat "0" with no icon (fixed), footer "PROTECTION RACKET (N/9)".';

export const SCENARIOS: readonly AddedRecord[] = [
  // Art Museum Heist
  {
    record: ART_MUSEUM_HEIST_MAIN,
    reason:
      "MarvelCDB lacks the Fear No Evil scenario half; Art Museum Heist main scheme 1A/1B (owner approved Hall of Heroes).",
    evidence:
      'Scans 60121a.jpg, 60121b.jpg. Side A "1A", footer ART MUSEUM HEIST (1/9) 121A, Allie Preswick: Contents (Chosen UNDERLING villain (see rulebook p. 5); chosen villain\'s set, Art Museum Heist set, Standard set; two modular sets Cops and The Owl) and Setup (find the 4 ART attachments, attach 1 at random to the villain, shuffle the other 3 into the encounter deck). Side B "1B", footer 121B: threat target 9 with per-hero icon, escalation "+X" with per-hero icon and a star, base threat 1 with per-hero icon; text "(star) X is 1 more than the number of ART attachments on the villain." / Forced Response about undefended attacks against an identity / "If this stage is completed, the players lose the game."',
  },
  {
    record: IMPOSSIBLE_OBJECT,
    reason: "Art Museum Heist ART attachment (mental resource, confuses the host).",
    evidence: `Scan 60122.jpg, footer ART MUSEUM HEIST (2/9) 122, Sebastian Guidobono. ${ART_ICON_NOTE} Text: Surge. Attach to the villain. Forced Response confuse that character. Hero Action: Spend a (bone-like icon, read as mental) resource or exhaust your hero -> attach to your hero. The icon is the one left over after energy (lightning), physical (fist) and wild (burst, as in 50107a); the four ART attachments cover the four types. Second check 2026-10-18: confirmed by the legend on Absorbing Man 60144, which prints the four icons in the order energy (bolt), mental (this bone-like glyph), physical (fist), wild (burst).`,
  },
  {
    record: INSPIRING_POTTERY,
    reason: "Art Museum Heist ART attachment (wild resource, stalwart).",
    evidence: `Scan 60123.jpg, footer ART MUSEUM HEIST (3/9) 123, Sebastian Guidobono. ${ART_ICON_NOTE} Text: Surge. Attach to the villain. Attached character gains stalwart. Hero Action: Spend a (burst icon, wild) resource or exhaust your hero -> attach to your hero.`,
  },
  {
    record: REPLICA_SHIELD,
    reason: "Art Museum Heist ART attachment (physical resource, tough status card).",
    evidence: `Scan 60124.jpg, footer ART MUSEUM HEIST (4/9) 124, Facundo Moyano. ${ART_ICON_NOTE} Text: Surge. Attach to the villain. Forced Response: give that character a tough status card. Hero Action: Spend a (fist icon, physical) resource or exhaust your hero -> attach to your hero.`,
  },
  {
    record: STUNNING_LANDSCAPE,
    reason: "Art Museum Heist ART attachment (energy resource, stuns the host).",
    evidence: `Scan 60125.jpg, footer ART MUSEUM HEIST (5/9) 125, Facundo Moyano. ${ART_ICON_NOTE} Text: Surge. Attach to the villain. Forced Response: stun that character. Hero Action: Spend a (lightning icon, energy) resource or exhaust your hero -> attach to your hero.`,
  },
  {
    record: ART_THIEF,
    reason: "Art Museum Heist minion, two copies (6/9 and 7/9).",
    evidence:
      'Scans 60126.jpg (6/9) and 60126_2.jpg (7/9), same card, Aitor Prieto, footer 126. Minion, SCH 2, ATK 2, hit points 3 (no per-hero icon), red boost star icon only, trait THIEF. When Revealed: search the encounter deck and discard pile for an ART attachment and attach it to the villain; if you cannot, move an ART attachment from an identity to the villain. "(star) Boost: Move an ART attachment from an identity to the villain."',
  },
  {
    record: TUG_OF_WAR,
    reason: "Art Museum Heist treachery, two copies (8/9 and 9/9).",
    evidence:
      'Scans 60127.jpg (8/9) and 60127_2.jpg (9/9), same card, Andrea Di Vito & Laura Villari, footer 127. Treachery, one boost icon, no boost text. When Revealed: "You may spend (fist)(fist)(fist) resources to move an ART attachment from the villain to your identity. Otherwise, move an ART attachment from an identity to the villain and this card gains surge."',
  },
  // The Getaway
  {
    record: GETAWAY_MAIN,
    reason: "The Getaway main scheme 1A/1B (speed counters).",
    evidence:
      'Scans 60128a.jpg, 60128b.jpg. Side A "1A", footer THE GETAWAY (1/8) 128A, Kaihound: Contents (Chosen UNDERLING villain; chosen villain\'s set, The Getaway set, Standard set; two modular sets Cops and Drive), Setup: place 1 speed counter here (2 in expert mode), attach the Out Front attachment ((FNE symbol) 129A) to the villain. The card prints the set symbol before "129A"; it is dropped from the text. Side B "1B", footer 128B: threat target 9 per-hero, escalation "+2" per-hero, base threat 2 per-hero; Forced Interrupt when the round ends with threat here: 1. place 1 speed counter, 2. if Alongside is in play flip it to Out Front, otherwise place 1 additional speed counter; "If this stage is completed, the players lose the game."',
  },
  {
    record: OUT_FRONT_ALONGSIDE,
    reason: "The Getaway double-sided attachment 129A Out Front / 129B Alongside (one physical card, 2/8).",
    evidence:
      'Scans 60129a.jpg (Out Front, Bruno Frenda, footer THE GETAWAY (2/8) 129A) and 60129b.jpg (Alongside, Sebastian Guidobono, footer (2/8) 129B). Both attachments, no boost icons. Out Front: ATK stat burst holds a bare star (attack null, attack_star true), no traits; "Permanent. Attach to the villain. If there is no threat on the main scheme, flip this card. (star) Attached villain\'s attacks gain ranged. Forced Interrupt: When the villain would be dealt any amount of damage, remove that amount of threat from the main scheme instead (ignoring crisis (icon) icons)." (the italic reminder has no "any" before "crisis"). Second check 2026-10-18: the reminder prints AFTER "instead" (text had it before); fixed. Alongside: no stat, no traits; "Permanent. When Revealed: Each player takes 1 indirect damage. The villain takes 2(per-hero) damage." italic flavor "New York City traffic is brutal."',
  },
  {
    record: ESCORT_VEHICLE,
    reason: "The Getaway minion with speed-counter tiers.",
    evidence:
      'Scan 60130.jpg, footer THE GETAWAY (3/8) 130, Sebastian Guidobono. Minion, SCH 2, ATK 2, hit points 5 (no per-hero icon), three boost icons, trait VEHICLE. Text: "Guard. Patrol. If the number of speed counters on the main scheme is at least: 3 - This minion gains toughness. 6 - This minion also gains quickstrike. 9 - This minion also gains surge."',
  },
  {
    record: JACKKNIFED_TANKER_TRUCK,
    reason: "The Getaway side scheme.",
    evidence:
      'Scan 60131.jpg, footer THE GETAWAY (4/8) 131, Sebastian Guidobono. Side scheme, base threat "2" with a star and no per-hero icon, one crisis icon (the same icon 129A calls "crisis"), two boost icons, no traits. Italic flavor "Eat your heart out, Johnny Blaze!" -Echo. Text: "(star) Hinder 1(per-hero). The villain cannot be dealt damage."',
  },
  {
    record: BURNING_RUBBER,
    reason: "The Getaway treachery, two copies (5/8 and 6/8).",
    evidence:
      'Scans 60132.jpg (5/8) and 60132_2.jpg (6/8), same card, Sebastian Guidobono, footer 132. Treachery, one boost icon. When Revealed: "For each speed counter on the main scheme, choose: Spend 1 resource of any type. / Place 1 threat on the main scheme." Italic flavor "Skreeeeeee!" (the count of e is read as 7 and may be off by one).',
  },
  {
    record: PEDESTRIANS,
    reason: "The Getaway treachery, two copies (7/8 and 8/8).",
    evidence:
      'Scans 60133.jpg (7/8) and 60133_2.jpg (8/8), same card, Ivan Fiorelli, footer 133. Treachery, one boost icon. When Revealed: "For each speed counter on the main scheme, choose: Exhaust a character you control. / Take 1 indirect damage." Italic flavor "Hope you\'ve got your seatbelts on!" -Iron Fist.',
  },
  // Protection Racket
  {
    record: BATTLE_IN_THE_BODEGA,
    reason: "Protection Racket main scheme 1/9: Battle in the Bodega.",
    evidence: `Scans 60134a.jpg, 60134b.jpg. ${RACKET_A_EVIDENCE} ${RACKET_B_COMMON} Afif Khaled, footer 134. Text: Forced Response after a character in this play area is attacked, deal 1 damage to the attacker and place 1 threat here (Limit once per phase in standard mode.) / "If any main scheme is completed or any player is eliminated, the players lose the game."`,
  },
  {
    record: BULL_IN_A_CHINA_SHOP,
    reason: "Protection Racket main scheme 2/9: Bull in a China Shop.",
    evidence: `Scans 60135a.jpg (byte-identical to 60134a.jpg), 60135b.jpg. ${RACKET_B_COMMON} Afif Khaled, footer 135. Text: Forced Interrupt when excess damage is dealt to an ally (in expert mode, an ally or a minion) in this play area, place an equal amount of threat on this scheme. / players-lose line.`,
  },
  {
    record: HUNG_OUT_TO_DRY,
    reason: "Protection Racket main scheme 3/9: Hung Out to Dry.",
    evidence: `Scans 60136a.jpg (byte-identical to 60134a.jpg), 60136b.jpg. ${RACKET_B_COMMON} Joey Vazquez, footer 136. Italic flavor "Calm down. It's on the gentle cycle." -Jessica Jones. Text: Forced Response after a character enters play in this play area, deal 1 damage to it and place 1 threat here. / players-lose line.`,
  },
  {
    record: PAWN_SHOP_SHOWDOWN,
    reason: "Protection Racket main scheme 4/9: Pawn Shop Showdown.",
    evidence: `Scans 60137a.jpg (byte-identical to 60134a.jpg), 60137b.jpg. ${RACKET_B_COMMON} Joey Vazquez, footer 137. Text: "Reduce the cost of the first upgrade played into this play area each round by 1." Forced Response after an attachment or upgrade enters play in this play area, place 1 threat here. / players-lose line.`,
  },
  {
    record: A_SLICE_OF_THE_PIZZA_DOUGH,
    reason: "Protection Racket main scheme 5/9: A Slice of the Pizza Dough.",
    evidence: `Scans 60138a.jpg (byte-identical to 60134a.jpg), 60138b.jpg. ${RACKET_B_COMMON} Andrea Di Vito & Laura Villari, footer 138. Text: Forced Response after a character in this play area defeats another character or a side scheme (in any play area; italic), heal 1 damage from the defeating character and place 1 threat here. / players-lose line.`,
  },
  {
    record: SHOP_PROPRIETOR,
    reason: "Protection Racket encounter ally (type ALLY, no cost).",
    evidence:
      'Scan 60139.jpg, footer PROTECTION RACKET (6/9) 139, Sebastian Guidobono. Type ALLY, grey frame, cost box holds a dash (cost null), THW 1 with two hollow consequential-damage stars, ATK 1 with two hollow stars (thwart_cost 2, attack_cost 2), hit points 3, no boost icons, trait CIVILIAN. Text: "When Revealed: Put Shop Proprietor into play under your control. This card gains surge. Forced Interrupt: When this ally leaves play, place 4 threat on the main scheme in your play area." Uncertain: whether MarvelCDB would record the pips as thwart_cost/attack_cost (it does for aos 50091); the hollow stars are read as consequential damage. Second check 2026-10-18: verified against aos 50091 Rescued Captive (scan in assets/card-art/bundles/cards/50091.jpg shows one hollow star each and raw has thwart_cost 1, attack_cost 1, faction encounter, no cost); Shop Proprietor shows two stars each, so thwart_cost 2 and attack_cost 2 follow the same coding. Cost dash gives cost null as for 50091.',
  },
  {
    record: MAN_BULL,
    reason: "Protection Racket unique minion.",
    evidence:
      'Scan 60140.jpg, footer PROTECTION RACKET (7/9) 140. No illustrator line is printed (only the copyright). Minion, unique marker, SCH 2, ATK "4" with a star, hit points 6, boost: red star icon plus two boost icons (boost 2, boost_star), trait BRUTE. Text: "(star) Forced Response: After Man-Bull attacks, place threat on the main scheme equal to the excess damage dealt by this attack." / "(star) Boost: If this activation is an attack, place threat on the main scheme equal to the excess damage dealt by this attack."',
  },
  {
    record: CHANGE_OF_VENUE,
    reason: "Protection Racket treachery, two copies (8/9 and 9/9).",
    evidence:
      'Scans 60141.jpg (8/9) and 60141_2.jpg (9/9), same card, Allie Preswick, footer 141. Treachery, red star icon plus one boost icon (boost 1, boost_star). Text: "Surge. When Revealed: Swap your main scheme with a random set-aside main scheme. Place the threat from the previous scheme on the new scheme." / "(star) Boost: Resolve this card\'s "When Revealed" ability."',
  },
  // The Raft Breakout
  {
    record: RAFT_MAIN,
    reason: "The Raft Breakout main scheme 1A/1B.",
    evidence:
      'Scans 60142a.jpg, 60142b.jpg. Side A "1A", footer THE RAFT BREAKOUT (1/9) 142A, Joey Vazquez: Contents (Chosen UNDERLING villain; set; Standard; two modular sets The Owl and Tombstone), Setup: attach Master Key to the villain; each player discards from the encounter deck until they discard a PRISONER minion and reveals it. Side B "1B", footer 142B: threat target 11 per-hero, escalation "+1" per-hero, base threat 2 per-hero; italic "Go forth and wreak havoc!" -Proxima Midnight; text: Each minion gains: "When Defeated: Remove 1 threat from the main scheme (2 threat instead if this minion has the ELITE trait)." / "If this stage is completed, the players lose the game."',
  },
  {
    record: MASTER_KEY,
    reason: "The Raft Breakout unique permanent attachment.",
    evidence:
      'Scan 60143.jpg, footer THE RAFT BREAKOUT (2/9) 143, Ivan Fiorelli. Attachment, unique marker, SCH stat burst holds a bare star (scheme null, scheme_star true), no boost icons, trait ITEM. Text: "Attach to the villain. Permanent. (star) Forced Response: After the villain schemes against you, deal each of that activation\'s boost cards that is a minion to yourself as a facedown encounter card." Italic notes ">Security overridden." and ">Door lock disengaged." (the ">" signs print).',
  },
  {
    record: ABSORBING_MAN,
    reason: "The Raft Breakout PRISONER minion.",
    evidence:
      'Scan 60144.jpg, footer THE RAFT BREAKOUT (3/9) 144, Eleonora Carlini. Minion, unique, SCH 1, ATK "1" with a star, hit points 6, three boost icons, traits BRUTE. ELITE. PRISONER. Text: "Villainous. (star) Forced Interrupt: When Absorbing Man attacks you, tuck the top card of your deck under him. Absorbing Man gets +1 ATK for this attack for each different resource type (energy, mental, physical, and wild icons) on cards tucked under him."',
  },
  {
    record: BARON_ZEMO,
    reason: "The Raft Breakout PRISONER minion.",
    evidence:
      'Scan 60145.jpg, footer THE RAFT BREAKOUT (4/9) 145, Afif Khaled. Minion, unique, SCH 2, ATK 1 (no star), hit points 6, three boost icons, traits ELITE. HYDRA. PRISONER. Text: "Villainous. Treat each ally with threat on it as a DECEIVED minion with a blank text box. Its SCH is equal to its base THW and it does not take consequential damage. When Revealed: Place 1 threat on an ally without threat on it. It engages its controller." The Treat ability prints no star.',
  },
  {
    record: DRANG,
    reason: "The Raft Breakout PRISONER minion.",
    evidence:
      'Scan 60146.jpg, footer THE RAFT BREAKOUT (5/9) 146, Joey Vazquez. Minion, unique, SCH 1, ATK "1" with a star, hit points 6, three boost icons, traits BADOON. ELITE. PRISONER. Text: "Villainous. (star) Forced Response: After Drang attacks you, place 1 barrage counter on him. Then, take 1 indirect damage for each barrage counter on Drang." Italic flavor "Ship, target my coordinates!"',
  },
  {
    record: MYSTERIO,
    reason: "The Raft Breakout PRISONER minion.",
    evidence:
      'Scan 60147.jpg, footer THE RAFT BREAKOUT (6/9) 147, Joey Vazquez. Minion, unique, SCH 2, ATK "1" with a star, hit points 6, three boost icons, traits CRIMINAL. ELITE. PRISONER. Text: "Villainous. (star) Forced Response: After Mysterio attacks you, deal each of that activation\'s boost cards that is a treachery to yourself as a facedown encounter card."',
  },
  {
    record: PROXIMA_MIDNIGHT,
    reason: "The Raft Breakout PRISONER minion.",
    evidence:
      'Scan 60148.jpg, footer THE RAFT BREAKOUT (7/9) 148, Joey Vazquez. Minion, unique, SCH 1, ATK "2" with a star, hit points 7, three boost icons, traits BLACK ORDER. ELITE. PRISONER. Text: "Villainous. (star) Forced Interrupt: When Proxima Midnight attacks you, choose to either place 1 threat on the main scheme, or Proxima Midnight gets +2 ATK for this attack."',
  },
  {
    record: RHINO,
    reason: "The Raft Breakout PRISONER minion with a boost star.",
    evidence:
      'Scan 60149.jpg, footer THE RAFT BREAKOUT (8/9) 149, Kaihound. Minion, unique, SCH 1, ATK "3" with a star, hit points 7, boost: red star icon plus three boost icons (boost 3, boost_star), traits BRUTE. ELITE. PRISONER. Text: "Toughness. Villainous. (star) Rhino\'s attacks gain overkill." / "(star) Boost: Give the activating enemy a tough status card."',
  },
  {
    record: IMPRISONED,
    reason: "The Raft Breakout obligation (no hero named: the scenario's own set).",
    evidence:
      'Scan 60150.jpg, footer THE RAFT BREAKOUT (9/9) 150, Facundo Moyano. Obligation, red boost star icon only, no "Give to" line printed. Text: "You cannot thwart, attack, or change to alter-ego form. Hero Action: Spend 3 resources of any type or exhaust characters you control with a total THW of 3 or more -> discard this card." / "(star) Boost: Reveal this card."',
  },
  // Stop the Presses!
  {
    record: PRESSES_MAIN,
    reason: "Stop the Presses! main scheme 1A/1B.",
    evidence:
      'Scans 60151a.jpg, 60151b.jpg. Side A "1A", footer STOP THE PRESSES! (1/9) 151A, Afif Khaled: Contents (Chosen UNDERLING villain; set; Standard; two modular sets Tombstone and Tracksuit Mafia), Setup: put the Daily Bugle environment into play; each player puts a random DAILY BUGLE support from this set into play under their control; remove each remaining DAILY BUGLE support from the game. Side B "1B", footer 151B: threat target 9 per-hero, escalation "+1" per-hero, base threat 1 per-hero; Forced Response after an enemy makes an undefended attack against you, choose: place 2 threat here (3 in expert mode) / remove 1 stamina counter from a DAILY BUGLE support you control; "If a DAILY BUGLE support leaves play or this stage is completed, the players lose the game."',
  },
  {
    record: DAILY_BUGLE,
    reason: "Stop the Presses! unique environment.",
    evidence:
      'Scan 60152.jpg, footer STOP THE PRESSES! (2/9) 152. No illustrator line is printed. Environment, unique marker, no traits, no boost. Text: "Alter-Ego Action: Exhaust a DAILY BUGLE support you control -> place 1 stamina counter on that support. (Any player can do this.)" Italic flavor "Under the ownership of J. Jonah Jameson, the Daily Bugle became one of the most-read newspapers in the United States."',
  },
  {
    record: BEN_URICH,
    reason: "Stop the Presses! Daily Bugle support (grey frame, put into play at setup).",
    evidence:
      'Scan 60153.jpg, footer STOP THE PRESSES! (3/9) 153, no illustrator line. Support, cost 2, unique, traits DAILY BUGLE. PERSONA., bottom-left resource icon (bone-like, read as mental). Text: "Uses (3 stamina counters). Action: Exhaust Ben Urich and remove 1 stamina counter from him -> look at the top 2 cards of the encounter deck. You may discard 1 of those cards. (Put the rest back in the same order.)" Uncertain: the frame is grey like a basic card; faction encounter follows the task brief. Second check 2026-10-18: bottom-left icon is the mental glyph (legend on 60144); the cost-2 grey support with a resource pip is faction encounter like mut_gen 32089 (encounter ally, cost 2, one resource), so no change. Faction could be basic in MarvelCDB; unverifiable.',
  },
  {
    record: BETTY_BRANT,
    reason: "Stop the Presses! Daily Bugle support.",
    evidence:
      'Scan 60154.jpg, footer STOP THE PRESSES! (4/9) 154, no illustrator line. Support, cost 2, unique, DAILY BUGLE. PERSONA., mental icon (second check 2026-10-18: confirmed against the 60144 legend). Text: "Uses (3 stamina counters). Interrupt: When a boost card is turned faceup, exhaust Betty Brant and remove 1 stamina counter from her -> cancel that card\'s boost icons and "Boost" ability. Give the activating enemy another boost card for this activation."',
  },
  {
    record: J_JONAH_JAMESON,
    reason: "Stop the Presses! Daily Bugle support.",
    evidence:
      'Scan 60155.jpg, footer STOP THE PRESSES! (5/9) 155, no illustrator line. Support, cost 2, unique, DAILY BUGLE. PERSONA., mental icon (second check 2026-10-18: confirmed against the 60144 legend). Text: "Uses (3 stamina counters). Action: Exhaust J. Jonah Jameson, remove 1 stamina counter from him, and deal yourself 1 facedown encounter card -> draw 2 cards."',
  },
  {
    record: ROBBIE_ROBERTSON,
    reason: "Stop the Presses! Daily Bugle support.",
    evidence:
      'Scan 60156.jpg, footer STOP THE PRESSES! (6/9) 156, no illustrator line. Support, cost 2, unique, DAILY BUGLE. PERSONA., mental icon (second check 2026-10-18: confirmed against the 60144 legend). Text: "Uses (3 stamina counters). Response: After a player is dealt a facedown encounter card, exhaust Robbie Robertson and remove 1 stamina counter from him -> look at that encounter card. You may discard it and deal that player another facedown encounter card."',
  },
  {
    record: EXCLUSIVE_INTERVIEW,
    reason: "Stop the Presses! side scheme.",
    evidence:
      'Scan 60157.jpg, footer STOP THE PRESSES! (7/9) 157, Sebastian Guidobono. Side scheme, base threat "6" with no star and no per-hero icon (fixed), one boost icon, no crisis/acceleration icon, no traits. Italic flavor "I\'d love for your audience to hear my side of the story. Now, where to begin...?" Text: "DAILY BUGLE supports cannot ready. When Revealed: Exhaust each DAILY BUGLE support."',
  },
  {
    record: BREAKING_NEWS,
    reason: "Stop the Presses! treachery, two copies (8/9 and 9/9).",
    evidence:
      'Scans 60158.jpg (8/9) and 60158_2.jpg (9/9), same card, Sebastian Guidobono, footer 158. Treachery, red boost star icon only. Text: "When Revealed: Choose: Exhaust a DAILY BUGLE support (under any player\'s control; italic) and remove 1 stamina counter from it. / Place 2 threat on the main scheme." / "(star) Boost: Exhaust a DAILY BUGLE support (under any player\'s control; italic)."',
  },
];
