/**
 * Fear No Evil (fne) modular sets Disasters (collector 60177 to 60181), Cops (60182 to 60185), Drive (60186 to
 * 60190), The Owl (60191 to 60194), Tombstone (60195 to 60199), Tracksuit Mafia (60200 to 60204) and the Campaign
 * cards (60205 to 60210), transcribed from the Hall of Heroes scans (owner-approved source; MarvelCDB lacks the box's
 * scenario half, docs/phase7-wave11-data-survey.md section 3). Printed set sizes: Disasters 5, Cops 5, Drive 5, The
 * Owl 5, Tombstone 5, Tracksuit Mafia 7, Campaign 6; the records carry quantities that sum to those.
 *
 * Shapes follow MarvelCDB (see kingpin.ts): a two-sided card is a top-level `a` record whose back face is nested as
 * `linked_card` (`hidden: true`). Modular sets are `card_set_type_name_code: "modular"`, the campaign set is
 * `fne_campaign` / "Campaign" like aoa's `aoa_campaign` (campaign environments are faction `encounter`, the campaign
 * ally is faction `campaign` like aoa's campaign allies). Art is not wired in: `imagesrc` is null everywhere.
 */
import type { RawCard } from "../../raw-types.ts";
import type { AddedRecord } from "../types.ts";

type Fields = Record<string, unknown>;

const TYPE_NAMES: Record<string, string> = {
  ally: "Ally",
  attachment: "Attachment",
  environment: "Environment",
  minion: "Minion",
  obligation: "Obligation",
  side_scheme: "Side Scheme",
  treachery: "Treachery",
};

/** Keys MarvelCDB sends as null on a nested back face. */
const NESTED_NULLS: Fields = {
  subname: null,
  cost: null,
  boost: null,
  resource_energy: null,
  resource_physical: null,
  resource_mental: null,
  resource_wild: null,
  hand_size: null,
  health: null,
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
  escalation_threat: null,
  scheme_crisis: null,
  scheme_acceleration: null,
  scheme_amplify: null,
  scheme_hazard: null,
  threat: null,
  deck_limit: null,
  stage: null,
  traits: null,
  real_traits: null,
  meta: null,
  deck_requirements: null,
  deck_options: null,
  restrictions: null,
  flavor: "",
  back_text: null,
  back_flavor: null,
  back_name: null,
  errata: null,
  backimagesrc: null,
};

interface SetInfo {
  readonly code: string;
  readonly name: string;
  readonly faction: "encounter" | "campaign";
}

const DISASTERS: SetInfo = { code: "disasters", name: "Disasters", faction: "encounter" };
const COPS: SetInfo = { code: "cops", name: "Cops", faction: "encounter" };
const DRIVE: SetInfo = { code: "drive", name: "Drive", faction: "encounter" };
const THE_OWL: SetInfo = { code: "the_owl", name: "The Owl", faction: "encounter" };
const TOMBSTONE: SetInfo = { code: "tombstone", name: "Tombstone", faction: "encounter" };
const TRACKSUIT_MAFIA: SetInfo = { code: "tracksuit_mafia", name: "Tracksuit Mafia", faction: "encounter" };
const CAMPAIGN: SetInfo = { code: "fne_campaign", name: "Campaign", faction: "encounter" };
const CAMPAIGN_ALLY: SetInfo = { code: "fne_campaign", name: "Campaign", faction: "campaign" };

function build(
  set: SetInfo,
  code: string,
  type: string,
  position: number,
  setPosition: number,
  nested: boolean,
  f: Fields,
): Fields {
  const text = (f.text as string | null | undefined) ?? null;
  const traits = (f.traits as string | null | undefined) ?? null;
  const out: Fields = {
    pack_code: "fne",
    pack_name: "Fear No Evil",
    pack_legacy: false,
    pack_wave: null,
    type_code: type,
    type_name: TYPE_NAMES[type],
    faction_code: set.faction,
    faction_name: set.faction === "campaign" ? "Campaign" : "Encounter",
    card_set_code: set.code,
    card_set_name: set.name,
    card_set_type_name_code: "modular",
    ...(nested ? { card_set_parent_code: null } : {}),
    position,
    set_position: setPosition,
    code,
    cost_per_hero: false,
    cost_star: false,
    text,
    real_text: text,
    quantity: 1,
    health_per_group: false,
    health_per_hero: false,
    base_threat_fixed: false,
    base_threat_per_group: false,
    base_threat_star: false,
    escalation_threat_fixed: false,
    threat_fixed: false,
    threat_per_group: false,
    real_traits: traits,
    is_unique: false,
    hidden: nested,
    permanent: false,
    double_sided: false,
    attack_star: false,
    thwart_star: false,
    defense_star: false,
    health_star: false,
    recover_star: false,
    scheme_star: false,
    boost_star: false,
    threat_star: false,
    escalation_threat_star: false,
    imagesrc: null,
    spoiler: 1,
  };
  if (nested) {
    Object.assign(out, NESTED_NULLS);
  }
  return { ...out, ...f, real_name: f.name };
}

/** A top-level record. `back`, when given, is nested as `linked_card` and the two are linked by code. */
function card(
  set: SetInfo,
  code: string,
  type: string,
  position: number,
  setPosition: number,
  f: Fields,
  back?: { readonly code: string; readonly fields: Fields },
): RawCard {
  const top = build(set, code, type, position, setPosition, false, {
    ...f,
    ...(back ? { linked_to_code: back.code, linked_to_name: back.fields.name } : {}),
  });
  if (back) {
    top.linked_card = build(set, back.code, type, position, setPosition, true, back.fields);
  }
  return top as unknown as RawCard;
}

const HR = "\n<hr />\n";

// ---- Disasters (5), 60177 to 60181 ---------------------------------------------------------------------------

const MYSTIC_INCURSION = card(DISASTERS, "60177", "environment", 177, 1, {
  name: "Mystic Incursion",
  text: "Uses (2 civilian counters).\n<b>Hero Action</b>: Spend [mental][mental] resources or exhaust a hero or ally you control → remove 1 civilian counter from here (2 counters instead if you exhausted a [[Mystic]] character).",
  traits: "Disaster.",
  boost: 2,
  scheme_crisis: 1,
});

const SINKING_FERRY = card(DISASTERS, "60178", "environment", 178, 2, {
  name: "Sinking Ferry",
  text: "Uses (2 civilian counters).\n<b>Hero Action</b>: Spend [energy][energy] resources or exhaust a hero or ally you control → remove 1 civilian counter from here (2 counters instead if you exhausted an [[Aerial]] character).",
  traits: "Disaster.",
  boost: 2,
  scheme_crisis: 1,
  illustrator: "Sebastián Guidobono",
});

const TOWERING_INFERNO = card(DISASTERS, "60179", "environment", 179, 3, {
  name: "Towering Inferno",
  text: "Uses (2 civilian counters).\n<b>Hero Action</b>: Spend [physical][physical] resources or exhaust a hero or ally you control → remove 1 civilian counter from here (2 counters instead if you exhausted a character that has a tough status card).",
  traits: "Disaster.",
  boost: 2,
  scheme_crisis: 1,
  illustrator: "Sebastián Guidobono",
});

const COLLAPSING_BRIDGE = card(DISASTERS, "60180", "side_scheme", 180, 4, {
  name: "Collapsing Bridge",
  text: "[star] Hinder 2[per_hero].\n<b>Forced Response</b>: After any amount of threat is removed from Collapsing Bridge, place 1 threat here.",
  base_threat: 1,
  base_threat_fixed: true,
  base_threat_star: true,
  scheme_hazard: 1,
  boost: 2,
  illustrator: "Sebastián Guidobono",
});

const BYSTANDERS_IN_PERIL = card(DISASTERS, "60181", "treachery", 181, 5, {
  name: "Bystanders in Peril",
  text: `Peril.\n<b>When Revealed</b>: Place 1 civilian counter on a [[Disaster]] environment. If no counter was placed this way, search the encounter deck and discard pile for a [[Disaster]] environment and reveal it.${HR}[star] <b>Boost</b>: Place 1 civilian counter on a [[Disaster]] environment.`,
  boost: 1,
  boost_star: true,
});

// ---- Cops (5), 60182 to 60185 --------------------------------------------------------------------------------

const COP = card(COPS, "60182", "minion", 182, 1, {
  name: "Cop",
  text: "Quickstrike. Vulnerable.\n[star] <b>Forced Interrupt</b>: When Cop would scheme, it attacks the villain instead.\n<b>When Defeated</b>: Place 2 threat on the main scheme.",
  flavor: '"Stop right there!"',
  quantity: 2,
  health: 3,
  scheme: 0,
  scheme_star: true,
  attack: 2,
  traits: "Police.",
  illustrator: "Facundo Moyano",
});

const CROOKED_COP = card(COPS, "60183", "minion", 183, 3, {
  name: "Crooked Cop",
  text: `Quickstrike. Vulnerable.\n<b>When Defeated</b>: The defeating player deals themselves 1 facedown encounter card.${HR}[star] <b>Boost</b>: Take 2 indirect damage.`,
  health: 4,
  scheme: 1,
  attack: 2,
  boost: null,
  boost_star: true,
  traits: "Criminal. Police.",
  illustrator: "Facundo Moyano",
});

const WANTED = card(COPS, "60184", "obligation", 184, 4, {
  name: "Wanted",
  text: "<b>Hero Action</b>: Discard cards from the encounter deck until a [[Police]] minion is discarded and put it into play engaged with you. Discard this card.",
  boost: 2,
  scheme_acceleration: 1,
});

const POLICE_CORDON = card(COPS, "60185", "side_scheme", 185, 5, {
  name: "Police Cordon",
  text: "[star] Hinder 1[per_hero].\nEach [[Police]] minion gains guard and patrol.\n<b>When Revealed</b>: Search the encounter deck and discard pile for a [[Police]] minion and reveal it.",
  flavor: '"Stand back! This is a crime scene." –Police officer',
  base_threat: 3,
  base_threat_fixed: true,
  base_threat_star: true,
  boost: 3,
});

// ---- Drive (5), 60186 to 60190 -------------------------------------------------------------------------------

const SPORTS_CAR = card(DRIVE, "60186", "attachment", 186, 1, {
  name: "Sports Car",
  text: "Attach to the enemy with the highest ATK without a [[Vehicle]] attachment. Otherwise, this card gains surge.\n<b>Forced Interrupt</b>: When attached character would take any amount of damage, place it here instead. If there is 4 or more damage here, discard this card.",
  attack: 1,
  boost: 2,
  traits: "Vehicle.",
});

const MOTORCYCLE = card(DRIVE, "60187", "attachment", 187, 2, {
  name: "Motorcycle",
  text: "Attach to the enemy with the highest SCH without a [[Vehicle]] attachment. Otherwise, this card gains surge.\n<b>Forced Interrupt</b>: When attached character would take any amount of damage, place it here instead. If there is 3 or more damage here, discard this card.",
  scheme: 1,
  thwart: 1,
  boost: 1,
  traits: "Vehicle.",
});

const UTILITY_VAN = card(DRIVE, "60188", "attachment", 188, 3, {
  name: "Utility Van",
  text: "Attach to the enemy with the fewest remaining hit points without a [[Vehicle]] attachment. Otherwise, this card gains surge.\n<b>Forced Interrupt</b>: When attached character would take any amount of damage, place it here instead. If there is 6 or more damage here, discard this card.",
  boost: 1,
  traits: "Vehicle.",
});

const TRAFFIC_JAM = card(DRIVE, "60189", "side_scheme", 189, 4, {
  name: "Traffic Jam",
  text: "[star] Hinder 2[per_hero].\n<b>Forced Interrupt</b>: When a character with a [[Vehicle]] attachment would:\n• Add threat to a scheme, that threat is added here instead.\n• Remove threat from a scheme, that threat is removed from here instead.",
  base_threat: 2,
  base_threat_fixed: true,
  base_threat_star: true,
  scheme_crisis: 1,
  boost: 3,
  illustrator: "Ivan Fiorelli",
});

const CARJACKING = card(DRIVE, "60190", "treachery", 190, 5, {
  name: "Carjacking",
  text: "<b>When Revealed</b>: Discard cards from the encounter deck until a [[Vehicle]] attachment is discarded and reveal it. If your identity does not have a [[Vehicle]] attachment, you may spend 3 resources of the same type to attach the discarded attachment to your identity instead.",
  boost: 2,
  illustrator: "Joey Vazquez",
});

// ---- The Owl (5), 60191 to 60194 -----------------------------------------------------------------------------

const FLIGHT_SERUM = card(THE_OWL, "60191", "attachment", 191, 1, {
  name: "Flight Serum",
  text: "Attach to a non-[[Aerial]] enemy. Otherwise, this card gains surge.\nAttached enemy gains [[Aerial]].\n<b>Hero Action</b>: Discard an [[Attack]] event from your hand → discard this card.",
  flavor: `"We're fighting on my home turf: the sky!" –The Owl`,
  quantity: 2,
  scheme: 1,
  attack: 1,
  traits: "Superpower.",
});

const MISTER_FISH = card(THE_OWL, "60192", "minion", 192, 3, {
  name: "Mister Fish",
  text: "[star] Mister Fish's attacks gain piercing and ranged.\n<b>When Revealed</b>: Mister Fish engages the player whose identity has the fewest remaining hit points.",
  flavor: '"No one laughs at Mister Fish!"',
  health: 4,
  scheme: 1,
  attack: 2,
  attack_star: true,
  boost: 2,
  traits: "Criminal. Maggia.",
  is_unique: true,
});

const THE_OWL_MINION = card(THE_OWL, "60193", "minion", 193, 4, {
  name: "The Owl",
  text: `Quickstrike.\n[star] The Owl's attacks gain piercing.${HR}[star] <b>Boost</b>: If this activation is an attack, it gains piercing.`,
  health: 5,
  scheme: 3,
  attack: 2,
  attack_star: true,
  boost: null,
  boost_star: true,
  traits: "Aerial. Criminal.",
  illustrator: "Afif Khaled",
  is_unique: true,
});

const SWOOP_DOWN = card(THE_OWL, "60194", "treachery", 194, 5, {
  name: "Swoop Down",
  text: "<b>When Revealed (Alter-Ego)</b>: The villain and each minion engaged with you schemes. Each [[Aerial]] enemy gets +2 SCH for its activation.\n<b>When Revealed (Hero)</b>: The villain and each minion engaged with you attacks you. Each [[Aerial]] enemy gets +2 ATK for its activation.",
  boost: 3,
});

// ---- Tombstone (5), 60195 to 60199 ---------------------------------------------------------------------------

const COLD_AS_ICE = card(TOMBSTONE, "60195", "attachment", 195, 1, {
  name: "Cold as Ice",
  text: "Attach to the minion with the highest base hit points and give that minion a tough status card. Otherwise, this card gains surge.\n[star] <b>Forced Response</b>: After attached minion schemes, confuse the first player's identity and discard Cold as Ice.",
  flavor: `"I'll get him to talk." –Tombstone`,
  scheme: 2,
  scheme_star: true,
  boost: 2,
});

const HARD_AS_MARBLE = card(TOMBSTONE, "60196", "attachment", 196, 2, {
  name: "Hard as Marble",
  text: "Attach to the minion with the highest base hit points and give that minion a tough status card. Otherwise, this card gains surge.\n[star] <b>Forced Response</b>: After attached minion attacks, stun the attacked character and discard Hard as Marble.",
  attack: 2,
  attack_star: true,
  boost: 2,
});

const BEETLE = card(TOMBSTONE, "60197", "minion", 197, 3, {
  name: "Beetle",
  text: "Villainous.\n<b>When Revealed</b>: Search the encounter deck and discard pile for an attachment that can attach to a minion and attach it to Beetle.",
  health: 5,
  scheme: 1,
  attack: 1,
  boost: 2,
  traits: "Aerial. Criminal.",
  is_unique: true,
});

const TOMBSTONE_MINION = card(TOMBSTONE, "60198", "minion", 198, 4, {
  name: "Tombstone",
  text: `Quickstrike.${HR}[star] <b>Boost</b>: Give the villain a tough status card.`,
  flavor: '"End of the day, this is what I love: a great fight!"',
  health: 8,
  scheme: 2,
  attack: 2,
  boost: null,
  boost_star: true,
  traits: "Criminal.",
  illustrator: "Sebastián Guidobono",
  is_unique: true,
});

const HIT_LIST = card(TOMBSTONE, "60199", "side_scheme", 199, 5, {
  name: "Hit List",
  text: "<b>Forced Response</b>: After the villain phase begins, deal 3 indirect damage to the first player. For each ally defeated this way, remove 1[per_hero] threat from Hit List.",
  base_threat: 3,
  boost: 3,
  illustrator: "Facundo Moyano",
});

// ---- Tracksuit Mafia (7), 60200 to 60204 ---------------------------------------------------------------------

const IVAN_BANIONIS = card(TRACKSUIT_MAFIA, "60200", "minion", 200, 1, {
  name: "Ivan Banionis",
  text: "Teamwork ([[Tracksuit]]).\n<b>When Revealed</b>: Place 1 acceleration token here.\n[star] <b>Forced Response</b>: After Ivan Banionis schemes, place 1 acceleration token here.",
  health: 5,
  scheme: 0,
  scheme_star: true,
  attack: 2,
  boost: 2,
  traits: "Criminal. Tracksuit.",
  illustrator: "Ivan Fiorelli",
  is_unique: true,
});

const THE_CLOWN = card(TRACKSUIT_MAFIA, "60201", "minion", 201, 2, {
  name: "The Clown",
  text: "Teamwork ([[Tracksuit]]). Villainous.\n[star] <b>Forced Response</b>: After The Clown schemes, give him 1 facedown boost card.",
  flavor: '"..."',
  health: 6,
  scheme: 0,
  scheme_star: true,
  attack: 1,
  boost: 2,
  traits: "Assassin. Tracksuit.",
  illustrator: "Sebastián Guidobono",
  is_unique: true,
});

const TRACKSUIT_MAFIOSO = card(TRACKSUIT_MAFIA, "60202", "minion", 202, 3, {
  name: "Tracksuit Mafioso",
  text: "Retaliate 2. Teamwork ([[Tracksuit]]). Vulnerable.\n<b>When Defeated</b>: Tuck this card under the Tracksuit Mafia side scheme. Otherwise, stun and confuse the character that defeated Tracksuit Mafioso.",
  health: 7,
  scheme: 3,
  attack: 0,
  boost: 3,
  traits: "Criminal. Tracksuit.",
  illustrator: "Ivan Fiorelli",
  is_unique: true,
});

const TRACKSUIT_BRO = card(TRACKSUIT_MAFIA, "60203", "minion", 203, 4, {
  name: "Tracksuit Bro",
  text: "Teamwork ([[Tracksuit]]). Vulnerable.\n<b>When Defeated</b>: Tuck this card under the Tracksuit Mafia side scheme. Otherwise, shuffle this card into the encounter deck.",
  flavor: '"Bro."',
  quantity: 3,
  health: 3,
  scheme: 1,
  attack: 2,
  boost: 2,
  traits: "Criminal. Tracksuit.",
  illustrator: "Sebastián Guidobono",
});

const TRACKSUIT_MAFIA_SCHEME = card(TRACKSUIT_MAFIA, "60204", "side_scheme", 204, 7, {
  name: "Tracksuit Mafia",
  text: "<b>When Revealed</b>: Discard cards from the top of the encounter deck until a [[Tracksuit]] minion is discarded and tuck that minion here.\n<b>Forced Response</b>: After a player reveals a [[Tracksuit]] minion from the encounter deck, that player reveals 1 minion tucked here.",
  base_threat: 3,
  boost: 2,
  illustrator: "Ivan Fiorelli",
});

// ---- Campaign (6), 60205 to 60210 ----------------------------------------------------------------------------

const ART_MUSEUM_HEIST = card(
  CAMPAIGN,
  "60205a",
  "environment",
  205,
  1,
  {
    name: "Art Museum Heist",
    text: "<b>Setup</b>: Give each identity a tough status card.",
    flavor: "You draw inspiration from the works of art you secured against theft.",
    traits: "Completed.",
    illustrator: "Allie Preswick",
  },
  {
    code: "60205b",
    fields: {
      name: "Art Museum Heist",
      text: "<b>Setup</b>: Each player chooses to stun or confuse their identity (in expert mode, do both instead).",
      flavor: "You are demoralized by your failure to prevent the museum art theft.",
      traits: "Failed.",
      illustrator: "Allie Preswick",
    },
  },
);

const THE_GETAWAY = card(
  CAMPAIGN,
  "60206a",
  "environment",
  206,
  2,
  {
    name: "The Getaway",
    text: "<b>Setup</b>: After resolving mulligans, each player may search their deck and discard pile for an upgrade and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.",
    flavor: "The bank provides you a generous reward as thanks for returning the stolen money.",
    traits: "Completed.",
    illustrator: "Kaihound",
  },
  {
    code: "60206b",
    fields: {
      name: "The Getaway",
      text: "In expert mode, attachments cannot be discarded from play during the first round.\n<b>Setup</b>: Each player searches the encounter deck for an attachment and reveals it. Deal a facedown encounter card to each player who could not.",
      flavor: "Your enemies have put their ill-gotten gains towards improving their armaments.",
      traits: "Failed.",
      illustrator: "Kaihound",
    },
  },
);

const PROTECTION_RACKET = card(
  CAMPAIGN,
  "60207a",
  "environment",
  207,
  3,
  {
    name: "Protection Racket",
    text: "<b>Setup</b>: After resolving mulligans, each player may search their deck and discard pile for a support and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.",
    flavor: "You stood up for the neighborhood businesses, giving the community the courage to rally around you.",
    traits: "Completed.",
    illustrator: "Andrea Di Vito & Laura Villari",
  },
  {
    code: "60207b",
    fields: {
      name: "Protection Racket",
      text: "<b>Setup</b>: Each player chooses and discards 1 card from their hand (in expert mode, 2 cards instead).",
      flavor: "Threats against the neighborhood businesses have left the community too frightened to help you.",
      traits: "Failed.",
      illustrator: "Andrea Di Vito & Laura Villari",
    },
  },
);

const THE_RAFT_BREAKOUT = card(
  CAMPAIGN,
  "60208a",
  "environment",
  208,
  4,
  {
    name: "The Raft Breakout",
    text: "<b>Setup</b>: After resolving mulligans, each player may search their deck and discard pile for an ally and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.",
    flavor: "Your work in securing the Raft has freed up other heroes to help you take down the next villain.",
    traits: "Completed.",
    illustrator: "Joey Vazquez",
  },
  {
    code: "60208b",
    fields: {
      name: "The Raft Breakout",
      text: "<b>Setup</b>: Shuffle each minion in The Raft Breakout encounter set into the encounter deck (in expert mode, deal 1 of those minions at random to each player as a facedown encounter card before shuffling in the rest).",
      flavor: "Many dangerous fugitives are on the loose thanks to your failure at the Raft.",
      traits: "Failed.",
      illustrator: "Joey Vazquez",
    },
  },
);

const STOP_THE_PRESSES = card(
  CAMPAIGN,
  "60209a",
  "environment",
  209,
  5,
  {
    name: "Stop the Presses!",
    text: "<b>Setup</b>: Each player puts 1 [[Daily Bugle]] support <i>(that has not been removed from the campaign)</i> into play from the Stop the Presses! encounter set.",
    flavor:
      "J. Jonah Jameson has promised the help of his Daily Bugle staff in gratitude for protecting his newspaper. You don't expect it to last.",
    traits: "Completed.",
    illustrator: "Afif Khaled",
  },
  {
    code: "60209b",
    fields: {
      name: "Stop the Presses!",
      text: "<b>Setup</b>: Deal each player 1 facedown encounter card (in expert mode, 2 encounter cards instead).",
      flavor:
        "Following the ransacking of the Daily Bugle offices, every media outlet in the city is too scared to help in your efforts to stop the crime wave, and you suspect some are even working with the criminals.",
      traits: "Failed.",
      illustrator: "Afif Khaled",
    },
  },
);

const TYPHOID_MARY = card(
  CAMPAIGN_ALLY,
  "60210a",
  "ally",
  210,
  6,
  {
    name: "Typhoid Mary",
    subname: "Mary Walker",
    text: "Setup. Victory -1.\n[star] <b>Forced Response</b>: After you reveal a minion, remove all damage from here and flip this card.",
    resource_mental: 1,
    health: 3,
    thwart: 2,
    thwart_cost: 1,
    attack: 1,
    attack_cost: 1,
    traits: "Mutant. Psionic.",
    illustrator: "Bruno Frenda",
    is_unique: true,
  },
  {
    code: "60210b",
    fields: {
      name: "Bloody Mary",
      subname: "Mary Walker",
      text: "Victory -1.\n[star] <b>Forced Response</b>: After you reveal a side scheme, remove all damage from here and flip this card.",
      resource_physical: 1,
      health: 3,
      thwart: 1,
      thwart_cost: 1,
      attack: 2,
      attack_cost: 1,
      traits: "Mutant. Psionic.",
      illustrator: "Bruno Frenda",
      is_unique: true,
    },
  },
);

export const MODULAR_CAMPAIGN: readonly AddedRecord[] = [
  {
    record: MYSTIC_INCURSION,
    reason:
      "Mystic Incursion (Disasters 1/5) environment, box scenario half MarvelCDB lacks; owner approved Hall of Heroes scans.",
    evidence:
      "Scan 60177.jpg (footer DISASTERS (1/5), 177, no illustrator printed). ENVIRONMENT, DISASTER., two boost icons, hazard icon (exclamation burst). 'Uses (2 civilian counters). Hero Action: Spend [2 resource icons] resources or exhaust a hero or ally you control -> remove 1 civilian counter from here (2 counters instead if you exhausted a MYSTIC character).' UNCERTAIN: the resource glyph is a node-and-link cluster, transcribed [mental] (Mental icon); the Mystic trait suggests but does not confirm the icon. Second check 2026-10-18: all fields re-read against the scan and match except the icon. The exclamation burst is the CRISIS icon (compare Core 01108 Crowd Control, whose printed rule text reads 'Crisis Icon'), not hazard (hazard is the plus-in-a-card glyph, Core 01107 Breakin' & Takin', 45086 The Ravages of War); scheme_hazard 1 -> scheme_crisis 1. The node-and-link resource glyph is the Mental icon (same glyph as the middle resource on Core 01142 Upgraded Drones, between energy lightning and physical fist), so [mental][mental] is confirmed.",
  },
  {
    record: SINKING_FERRY,
    reason: "Sinking Ferry (Disasters 2/5) environment.",
    evidence:
      "Scan 60178.jpg (footer DISASTERS (2/5), 178, Sebastian Guidobono). ENVIRONMENT, DISASTER., two boost icons, hazard icon. 'Uses (2 civilian counters). Hero Action: Spend [2 resource icons] resources or exhaust a hero or ally you control -> remove 1 civilian counter from here (2 counters instead if you exhausted an AERIAL character).' Resource glyph is a lightning bolt, transcribed [energy]. Second check 2026-10-18: all fields re-read against the scan and match except the icon. The exclamation burst is the CRISIS icon (compare Core 01108 Crowd Control, whose printed rule text reads 'Crisis Icon'), not hazard (hazard is the plus-in-a-card glyph, Core 01107 Breakin' & Takin', 45086 The Ravages of War); scheme_hazard 1 -> scheme_crisis 1. Lightning bolt = Energy as on 01142.",
  },
  {
    record: TOWERING_INFERNO,
    reason: "Towering Inferno (Disasters 3/5) environment.",
    evidence:
      "Scan 60179.jpg (footer DISASTERS (3/5), 179, Sebastian Guidobono). ENVIRONMENT, DISASTER., two boost icons, hazard icon. 'Uses (2 civilian counters). Hero Action: Spend [2 resource icons] resources or exhaust a hero or ally you control -> remove 1 civilian counter from here (2 counters instead if you exhausted a character that has a tough status card).' Resource glyph is a fist, transcribed [physical]. Second check 2026-10-18: all fields re-read against the scan and match except the icon. The exclamation burst is the CRISIS icon (compare Core 01108 Crowd Control, whose printed rule text reads 'Crisis Icon'), not hazard (hazard is the plus-in-a-card glyph, Core 01107 Breakin' & Takin', 45086 The Ravages of War); scheme_hazard 1 -> scheme_crisis 1. Fist = Physical as on 01142.",
  },
  {
    record: COLLAPSING_BRIDGE,
    reason: "Collapsing Bridge (Disasters 4/5) side scheme.",
    evidence:
      "Scan 60180.jpg (landscape, footer DISASTERS (4/5), 180, Sebastian Guidobono). SIDE SCHEME, no traits, starting threat '1*' with no per-player icon (recorded base_threat 1, base_threat_fixed true, base_threat_star true), acceleration icon (plus on a card; compared to Kingpin's Influence), two boost icons. '[star] Hinder 2[per player icon]. Forced Response: After any amount of threat is removed from Collapsing Bridge, place 1 threat here.' Second check 2026-10-18: the icon is plus-in-a-card = HAZARD, not acceleration (acceleration is plus on a house roof, Core 01109 Bomb Scare; hazard glyph matches 01107 Breakin' & Takin' and 45086 The Ravages of War); scheme_acceleration 1 -> scheme_hazard 1. Starting threat '1*' has no per-player icon: fixed true, star true (a starred value with no per-player icon; MarvelCDB's lone precedent, jj 61032 Indomitable Will '2*', stores fixed false with star true, so the fixed flag is the one uncertain bit; fixed true is what the printing shows). Other fields match.",
  },
  {
    record: BYSTANDERS_IN_PERIL,
    reason: "Bystanders in Peril (Disasters 5/5) treachery.",
    evidence:
      "Scan 60181.jpg (footer DISASTERS (5/5), 181, no illustrator printed). TREACHERY, boost icons star plus one (boost 1, star). 'Peril. When Revealed: Place 1 civilian counter on a DISASTER environment. If no counter was placed this way, search the encounter deck and discard pile for a DISASTER environment and reveal it. [rule] [star] Boost: Place 1 civilian counter on a DISASTER environment.'",
  },
  {
    record: COP,
    reason: "Cop (Cops 1/5 and 2/5, 2 copies) minion.",
    evidence:
      "Scans 60182.jpg and 60182_2.jpg (footers COPS (1/5) and (2/5), both 182, Facundo Moyano; identical text and art). MINION, POLICE., SCH star (a bare star, recorded scheme 0 + scheme_star as Kingpin's ATK), ATK 2, hit points 3, no boost icons. 'Quickstrike. Vulnerable. [star] Forced Interrupt: When Cop would scheme, it attacks the villain instead. When Defeated: Place 2 threat on the main scheme.' Flavor \"Stop right there!\" Not unique.",
  },
  {
    record: CROOKED_COP,
    reason: "Crooked Cop (Cops 3/5) minion.",
    evidence:
      "Scan 60183.jpg (footer COPS (3/5), 183, Facundo Moyano). MINION, CRIMINAL. POLICE., SCH 1, ATK 2, hit points 4, boost icon star only. 'Quickstrike. Vulnerable. When Defeated: The defeating player deals themselves 1 facedown encounter card. [rule] [star] Boost: Take 2 indirect damage.'",
  },
  {
    record: WANTED,
    reason: "Wanted (Cops 4/5) obligation.",
    evidence:
      "Scan 60184.jpg (footer COPS (4/5), 184, no illustrator printed). OBLIGATION, no traits, two boost icons, one scheme icon (plus in a house shape with a bar beneath). 'Hero Action: Discard cards from the encounter deck until a POLICE minion is discarded and put it into play engaged with you. Discard this card.' UNCERTAIN: the scheme icon is transcribed as crisis (scheme_crisis 1) from its house shape; not confirmed against a second source. Second check 2026-10-18: the icon is the plus-on-a-house-roof with a bar beneath, identical to the ACCELERATION icon on obligations aoa 45178 Panicked Refugees and aos 50179 Arrest Warrant (crisis is the exclamation burst, 01108; amplify is plus with a jet shape, 60034); scheme_crisis 1 -> scheme_acceleration 1. Other fields match.",
  },
  {
    record: POLICE_CORDON,
    reason: "Police Cordon (Cops 5/5) side scheme.",
    evidence:
      "Scan 60185.jpg (landscape, footer COPS (5/5), 185, no illustrator printed). SIDE SCHEME, starting threat '3*' with no per-player icon (base_threat 3, fixed, star), three boost icons, no scheme icons. Flavor \"Stand back! This is a crime scene.\" -Police officer. '[star] Hinder 1[per player]. Each POLICE minion gains guard and patrol. When Revealed: Search the encounter deck and discard pile for a POLICE minion and reveal it.' Second check 2026-10-18: all fields match; '3*' with no per-player icon kept as fixed true, star true (see Collapsing Bridge note on the MarvelCDB precedent).",
  },
  {
    record: SPORTS_CAR,
    reason: "Sports Car (Drive 1/5) attachment.",
    evidence:
      "Scan 60186.jpg (footer DRIVE (1/5), 186, no illustrator printed). ATTACHMENT, VEHICLE., stat box +1 ATK, two boost icons. 'Attach to the enemy with the highest ATK without a VEHICLE attachment. Otherwise, this card gains surge. Forced Interrupt: When attached character would take any amount of damage, place it here instead. If there is 4 or more damage here, discard this card.'",
  },
  {
    record: MOTORCYCLE,
    reason: "Motorcycle (Drive 2/5) attachment.",
    evidence:
      "Scan 60187.jpg (footer DRIVE (2/5), 187, no illustrator printed). ATTACHMENT, VEHICLE., combined stat box '+1 SCH/THW' (recorded scheme 1 and thwart 1, as Black Cat's SCH/THW), one boost icon. 'Attach to the enemy with the highest SCH without a VEHICLE attachment. Otherwise, this card gains surge. Forced Interrupt: When attached character would take any amount of damage, place it here instead. If there is 3 or more damage here, discard this card.'",
  },
  {
    record: UTILITY_VAN,
    reason: "Utility Van (Drive 3/5) attachment.",
    evidence:
      "Scan 60188.jpg (footer DRIVE (3/5), 188, no illustrator printed). ATTACHMENT, VEHICLE., no stat box, one boost icon. 'Attach to the enemy with the fewest remaining hit points without a VEHICLE attachment. Otherwise, this card gains surge. Forced Interrupt: When attached character would take any amount of damage, place it here instead. If there is 6 or more damage here, discard this card.'",
  },
  {
    record: TRAFFIC_JAM,
    reason: "Traffic Jam (Drive 4/5) side scheme.",
    evidence:
      "Scan 60189.jpg (landscape, footer DRIVE (4/5), 189, Ivan Fiorelli). SIDE SCHEME, starting threat '2*' with no per-player icon (base_threat 2, fixed, star), hazard icon, three boost icons. '[star] Hinder 2[per player]. Forced Interrupt: When a character with a VEHICLE attachment would: [bullet] Add threat to a scheme, that threat is added here instead. [bullet] Remove threat from a scheme, that threat is removed from here instead.' Second check 2026-10-18: the exclamation-burst icon is CRISIS, not hazard (see Mystic Incursion note); scheme_hazard 1 -> scheme_crisis 1. '2*' with no per-player icon kept as fixed true, star true. Other fields match.",
  },
  {
    record: CARJACKING,
    reason: "Carjacking (Drive 5/5) treachery.",
    evidence:
      "Scan 60190.jpg (footer DRIVE (5/5), 190, Joey Vazquez). TREACHERY, two boost icons. 'When Revealed: Discard cards from the encounter deck until a VEHICLE attachment is discarded and reveal it. If your identity does not have a VEHICLE attachment, you may spend 3 resources of the same type to attach the discarded attachment to your identity instead.'",
  },
  {
    record: FLIGHT_SERUM,
    reason: "Flight Serum (The Owl 1/5 and 2/5, 2 copies) attachment.",
    evidence:
      "Scans 60191.jpg and 60191_2.jpg (footers THE OWL (1/5) and (2/5), both 191, no illustrator printed; identical). ATTACHMENT, SUPERPOWER., stat box +1 SCH and +1 ATK, no boost icons. 'Attach to a non-AERIAL enemy. Otherwise, this card gains surge. Attached enemy gains AERIAL. Hero Action: Discard an ATTACK event from your hand -> discard this card.' Flavor \"We're fighting on my home turf: the sky!\" -The Owl.",
  },
  {
    record: MISTER_FISH,
    reason: "Mister Fish (The Owl 3/5) minion.",
    evidence:
      "Scan 60192.jpg (footer THE OWL (3/5), 192, no illustrator printed). Unique star, MINION, CRIMINAL. MAGGIA., SCH 1, ATK 2*, hit points 4, two boost icons. '[star] Mister Fish's attacks gain piercing and ranged. When Revealed: Mister Fish engages the player whose identity has the fewest remaining hit points.' Flavor \"No one laughs at Mister Fish!\"",
  },
  {
    record: THE_OWL_MINION,
    reason: "The Owl (The Owl 4/5) minion.",
    evidence:
      "Scan 60193.jpg (footer THE OWL (4/5), 193, Afif Khaled). Unique star, MINION, AERIAL. CRIMINAL., SCH 3, ATK 2*, hit points 5, boost icon star only. 'Quickstrike. [star] The Owl's attacks gain piercing. [rule] [star] Boost: If this activation is an attack, it gains piercing.' Hall of Heroes misspells the set heading 'The Owel'; the card prints THE OWL.",
  },
  {
    record: SWOOP_DOWN,
    reason: "Swoop Down (The Owl 5/5) treachery.",
    evidence:
      "Scan 60194.jpg (footer THE OWL (5/5), 194, no illustrator printed). TREACHERY, three boost icons. 'When Revealed (Alter-Ego): The villain and each minion engaged with you schemes. Each AERIAL enemy gets +2 SCH for its activation. When Revealed (Hero): The villain and each minion engaged with you attacks you. Each AERIAL enemy gets +2 ATK for its activation.'",
  },
  {
    record: COLD_AS_ICE,
    reason: "Cold as Ice (Tombstone 1/5) attachment.",
    evidence:
      "Scan 60195.jpg (footer TOMBSTONE (1/5), 195, no illustrator printed). ATTACHMENT, no traits, stat box '+2*' SCH (recorded scheme 2, scheme_star), two boost icons. 'Attach to the minion with the highest base hit points and give that minion a tough status card. Otherwise, this card gains surge. [star] Forced Response: After attached minion schemes, confuse the first player's identity and discard Cold as Ice.' Flavor \"I'll get him to talk.\" -Tombstone.",
  },
  {
    record: HARD_AS_MARBLE,
    reason: "Hard as Marble (Tombstone 2/5) attachment.",
    evidence:
      "Scan 60196.jpg (footer TOMBSTONE (2/5), 196, no illustrator printed). ATTACHMENT, no traits, stat box '+2*' ATK (attack 2, attack_star), two boost icons. 'Attach to the minion with the highest base hit points and give that minion a tough status card. Otherwise, this card gains surge. [star] Forced Response: After attached minion attacks, stun the attacked character and discard Hard as Marble.'",
  },
  {
    record: BEETLE,
    reason: "Beetle (Tombstone 3/5) minion.",
    evidence:
      "Scan 60197.jpg (footer TOMBSTONE (3/5), 197, no illustrator printed). Unique star, MINION, AERIAL. CRIMINAL., SCH 1, ATK 1, hit points 5, two boost icons. 'Villainous. When Revealed: Search the encounter deck and discard pile for an attachment that can attach to a minion and attach it to Beetle.'",
  },
  {
    record: TOMBSTONE_MINION,
    reason: "Tombstone (Tombstone 4/5) minion.",
    evidence:
      "Scan 60198.jpg (footer TOMBSTONE (4/5), 198, Sebastian Guidobono). Unique star, MINION, CRIMINAL., SCH 2, ATK 2, hit points 8, boost icon star only. 'Quickstrike. [rule] [star] Boost: Give the villain a tough status card.' Flavor \"End of the day, this is what I love: a great fight!\"",
  },
  {
    record: HIT_LIST,
    reason: "Hit List (Tombstone 5/5) side scheme.",
    evidence:
      "Scan 60199.jpg (landscape, footer TOMBSTONE (5/5), 199, Facundo Moyano). SIDE SCHEME, no traits, starting threat 3 with per-player icon (non-fixed), three boost icons, no scheme icons. 'Forced Response: After the villain phase begins, deal 3 indirect damage to the first player. For each ally defeated this way, remove 1[per player] threat from Hit List.'",
  },
  {
    record: IVAN_BANIONIS,
    reason: "Ivan Banionis (Tracksuit Mafia 1/7) minion.",
    evidence:
      "Scan 60200.jpg (footer TRACKSUIT MAFIA (1/7), 200, Ivan Fiorelli). Unique star, MINION, CRIMINAL. TRACKSUIT., SCH 0* (recorded scheme 0, scheme_star), ATK 2, hit points 5, two boost icons. 'Teamwork (TRACKSUIT). When Revealed: Place 1 acceleration token here. [star] Forced Response: After Ivan Banionis schemes, place 1 acceleration token here.'",
  },
  {
    record: THE_CLOWN,
    reason: "The Clown (Tracksuit Mafia 2/7) minion.",
    evidence:
      "Scan 60201.jpg (footer TRACKSUIT MAFIA (2/7), 201, Sebastian Guidobono). Unique star, MINION, ASSASSIN. TRACKSUIT., SCH 0*, ATK 1, hit points 6, two boost icons. 'Teamwork (TRACKSUIT). Villainous. [star] Forced Response: After The Clown schemes, give him 1 facedown boost card.' Flavor \"...\"",
  },
  {
    record: TRACKSUIT_MAFIOSO,
    reason: "Tracksuit Mafioso (Tracksuit Mafia 3/7) minion.",
    evidence:
      "Scan 60202.jpg (footer TRACKSUIT MAFIA (3/7), 202, Ivan Fiorelli). Unique star, MINION, CRIMINAL. TRACKSUIT., SCH 3, ATK 0, hit points 7, three boost icons. 'Retaliate 2. Teamwork (TRACKSUIT). Vulnerable. When Defeated: Tuck this card under the Tracksuit Mafia side scheme. Otherwise, stun and confuse the character that defeated Tracksuit Mafioso.' The scan prints it exactly so (the 'Otherwise' clause has no obvious antecedent on the card; flag for rules review). Second check 2026-10-18: re-read the scan, the wording is printed exactly so; all fields match. Still flagged: the 'Otherwise' branch presumably covers the case where there is no Tracksuit Mafia side scheme to tuck under.",
  },
  {
    record: TRACKSUIT_BRO,
    reason: "Tracksuit Bro (Tracksuit Mafia 4/7 to 6/7, 3 copies) minion.",
    evidence:
      'Scans 60203.jpg, 60203_2.jpg, 60203_3.jpg (footers TRACKSUIT MAFIA (4/7), (5/7), (6/7), all 203, Sebastian Guidobono). Not unique, MINION, CRIMINAL. TRACKSUIT., SCH 1, ATK 2, hit points 3, two boost icons. \'Teamwork (TRACKSUIT). Vulnerable. When Defeated: Tuck this card under the Tracksuit Mafia side scheme. Otherwise, shuffle this card into the encounter deck.\' Rules text and art identical; only the flavor differs per copy: 4/7 "Bro.", 5/7 "Bro?", 6/7 "BRO!". Second check 2026-10-18: all fields match the three scans. Keeping one record with quantity 3 is right: the copies share one collector number (203) and MarvelCDB stores one code with one flavor per code. Recorded as one record with quantity 3 and the first copy\'s flavor.',
  },
  {
    record: TRACKSUIT_MAFIA_SCHEME,
    reason: "Tracksuit Mafia (Tracksuit Mafia 7/7) side scheme.",
    evidence:
      "Scan 60204.jpg (landscape, footer TRACKSUIT MAFIA (7/7), 204, Ivan Fiorelli). SIDE SCHEME, no traits, starting threat 3 with per-player icon, two boost icons, no scheme icons. 'When Revealed: Discard cards from the top of the encounter deck until a TRACKSUIT minion is discarded and tuck that minion here. Forced Response: After a player reveals a TRACKSUIT minion from the encounter deck, that player reveals 1 minion tucked here.' Second check 2026-10-18: all fields match (threat 3 with per-player icon, two boost icons).",
  },
  {
    record: ART_MUSEUM_HEIST,
    reason: "Art Museum Heist (Campaign 1/6) two-sided campaign environment (Completed / Failed).",
    evidence:
      "Scans 60205a.jpg and 60205b.jpg (footer CAMPAIGN (1/6), 205A/205B, Allie Preswick). ENVIRONMENT. Completed side trait COMPLETED.: 'Setup: Give each identity a tough status card.' italic: 'You draw inspiration from the works of art you secured against theft.' Failed side trait FAILED.: 'Setup: Each player chooses to stun or confuse their identity (in expert mode, do both instead).' italic: 'You are demoralized by your failure to prevent the museum art theft.' The italic narrative lines are stored as flavor. No stats or boost icons.",
  },
  {
    record: THE_GETAWAY,
    reason: "The Getaway (Campaign 2/6) two-sided campaign environment.",
    evidence:
      "Scans 60206a.jpg and 60206b.jpg (footer CAMPAIGN (2/6), 206A/206B, Kaihound). Completed: 'Setup: After resolving mulligans, each player may search their deck and discard pile for an upgrade and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.' italic: 'The bank provides you a generous reward as thanks for returning the stolen money.' Failed: 'In expert mode, attachments cannot be discarded from play during the first round. Setup: Each player searches the encounter deck for an attachment and reveals it. Deal a facedown encounter card to each player who could not.' italic: 'Your enemies have put their ill-gotten gains towards improving their armaments.'",
  },
  {
    record: PROTECTION_RACKET,
    reason: "Protection Racket (Campaign 3/6) two-sided campaign environment.",
    evidence:
      "Scans 60207a.jpg and 60207b.jpg (footer CAMPAIGN (3/6), 207A/207B, Andrea Di Vito & Laura Villari). Completed: 'Setup: After resolving mulligans, each player may search their deck and discard pile for a support and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.' italic: 'You stood up for the neighborhood businesses, giving the community the courage to rally around you.' Failed: 'Setup: Each player chooses and discards 1 card from their hand (in expert mode, 2 cards instead).' italic: 'Threats against the neighborhood businesses have left the community too frightened to help you.'",
  },
  {
    record: THE_RAFT_BREAKOUT,
    reason: "The Raft Breakout (Campaign 4/6) two-sided campaign environment.",
    evidence:
      "Scans 60208a.jpg and 60208b.jpg (footer CAMPAIGN (4/6), 208A/208B, Joey Vazquez). Completed: 'Setup: After resolving mulligans, each player may search their deck and discard pile for an ally and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.' italic: 'Your work in securing the Raft has freed up other heroes to help you take down the next villain.' Failed: 'Setup: Shuffle each minion in The Raft Breakout encounter set into the encounter deck (in expert mode, deal 1 of those minions at random to each player as a facedown encounter card before shuffling in the rest).' italic: 'Many dangerous fugitives are on the loose thanks to your failure at the Raft.'",
  },
  {
    record: STOP_THE_PRESSES,
    reason: "Stop the Presses! (Campaign 5/6) two-sided campaign environment.",
    evidence:
      "Scans 60209a.jpg and 60209b.jpg (footer CAMPAIGN (5/6), 209A/209B, Afif Khaled). Completed: 'Setup: Each player puts 1 DAILY BUGLE support (that has not been removed from the campaign) into play from the Stop the Presses! encounter set.' (parenthetical italic on the card) italic: 'J. Jonah Jameson has promised the help of his Daily Bugle staff in gratitude for protecting his newspaper. You don't expect it to last.' Failed: 'Setup: Deal each player 1 facedown encounter card (in expert mode, 2 encounter cards instead).' italic: 'Following the ransacking of the Daily Bugle offices, every media outlet in the city is too scared to help in your efforts to stop the crime wave, and you suspect some are even working with the criminals.'",
  },
  {
    record: TYPHOID_MARY,
    reason: "Typhoid Mary / Bloody Mary (Campaign 6/6) two-sided campaign ally.",
    evidence:
      "Scans 60210a.jpg and 60210b.jpg (footer CAMPAIGN (6/6), 210A/210B, Bruno Frenda; grey campaign frame). Unique star, ALLY, subtitle MARY WALKER, MUTANT. PSIONIC., cost box shows a dash (recorded cost null), hit points 3 (orange circle). A (Typhoid Mary): THW 2 and ATK 1, each with one consequential-damage icon (thwart_cost 1, attack_cost 1), Mental resource icon bottom left; 'Setup. Victory -1. [star] Forced Response: After you reveal a minion, remove all damage from here and flip this card.' B (Bloody Mary): THW 1 and ATK 2, each with one consequential icon, Physical (fist) resource icon; 'Victory -1. [star] Forced Response: After you reveal a side scheme, remove all damage from here and flip this card.' Faction recorded as campaign like aoa's campaign allies. UNCERTAIN: the dash cost (null vs 0), and that the icons under THW/ATK are consequential-damage icons (assumed from the aoa campaign allies' thwart_cost/attack_cost). Second check 2026-10-18: the cost box is a dash. MarvelCDB omits the cost key on cost-less allies (aos 50091 Rescued Captive, mojo 39071 Longshot, next_evol 40079 Morlock and 40130 Hope Summers carry no cost), so the explicit cost: null on the A face was removed (the nested B face still gets null from the nested-null template). The small icons under THW and ATK are the consequential-damage icon as on aoa 45172 Destiny (thwart_cost 1, attack_cost 1). Resource glyphs confirmed (node = Mental on A, fist = Physical on B). Rulebook (mc60_fear_no_evil.md, Campaign Setup step 13) puts '210A' into play, consistent with the Setup keyword on side A. Text hyphen in 'Victory -1' matches the raw caches. Other fields match.",
  },
];
