/**
 * Fear No Evil (fne) Kingpin scenario set, collector 60159 to 60176, transcribed from the Hall of Heroes scans
 * (owner-approved source; MarvelCDB lacks the box's scenario half, docs/phase7-wave11-data-survey.md section 3).
 * The set prints as 22 copies (footer KINGPIN (N/22)); the records below carry quantities that sum to 22.
 *
 * Shapes follow MarvelCDB: a two-sided card is a top-level `a` record (sparse, like aos 50165a) whose back face is
 * nested as `linked_card` (full key set, nulls included, `hidden: true`, like aos 50165b). Art is not wired in:
 * `imagesrc` is null everywhere (the scans are gitignored, non-redistributed).
 */
import type { RawCard } from "../../raw-types.ts";
import type { AddedRecord } from "../types.ts";

type Fields = Record<string, unknown>;

const TYPE_NAMES: Record<string, string> = {
  villain: "Villain",
  main_scheme: "Main Scheme",
  minion: "Minion",
  attachment: "Attachment",
  side_scheme: "Side Scheme",
  treachery: "Treachery",
  environment: "Environment",
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

function build(code: string, type: string, position: number, setPosition: number, nested: boolean, f: Fields): Fields {
  const text = (f.text as string | null | undefined) ?? null;
  const traits = (f.traits as string | null | undefined) ?? null;
  const out: Fields = {
    pack_code: "fne",
    pack_name: "Fear No Evil",
    pack_legacy: false,
    pack_wave: null,
    type_code: type,
    type_name: TYPE_NAMES[type],
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: "kingpin",
    card_set_name: "Kingpin",
    card_set_type_name_code: "villain",
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
  const merged = { ...out, ...f, real_name: f.name };
  return merged;
}

/** A top-level record. `back`, when given, is nested as `linked_card` and the two are linked by code. */
function card(
  code: string,
  type: string,
  position: number,
  setPosition: number,
  f: Fields,
  back?: { readonly code: string; readonly fields: Fields },
): RawCard {
  const top = build(code, type, position, setPosition, false, {
    ...f,
    ...(back ? { linked_to_code: back.code, linked_to_name: back.fields.name } : {}),
  });
  if (back) {
    top.linked_card = build(back.code, type, position, setPosition, true, back.fields);
  }
  return top as unknown as RawCard;
}

const HR = "\n<hr />\n";

// ---- 60159 Kingpin, normal mode (A1 / A2), 1/22 -------------------------------------------------------------

const KINGPIN_A1 = card(
  "60159a",
  "villain",
  159,
  1,
  {
    name: "Kingpin",
    text: "Stalwart.\nKingpin cannot be dealt damage or have upgrades attached. <i>(The players must garner Public Support to face him directly.)</i>\n[star] <b>Forced Interrupt</b>: When Kingpin would attack you, he schemes instead.",
    health: 25,
    health_per_hero: true,
    scheme: 2,
    attack: 0,
    attack_star: true,
    stage: "A1",
    traits: "Criminal.",
    illustrator: "Bruno Frenda",
    is_unique: true,
  },
  {
    code: "60159b",
    fields: {
      name: "Kingpin",
      text: "Steady.\n[star] <b>Forced Interrupt</b>: When Kingpin activates against you, if you are not engaged with a minion, give Kingpin 1 additional boost card for this activation.",
      health: 25,
      health_per_hero: true,
      scheme: 2,
      scheme_star: true,
      attack: 2,
      attack_star: true,
      stage: "A2",
      traits: "Criminal. Martial Artist.",
      illustrator: "Bruno Frenda",
      is_unique: true,
    },
  },
);

// ---- 60160 Kingpin, expert mode (B1 / B2), 2/22 -------------------------------------------------------------

const KINGPIN_B1 = card(
  "60160a",
  "villain",
  160,
  2,
  {
    name: "Kingpin",
    text: "Stalwart.\nKingpin cannot be dealt damage or have upgrades attached. <i>(The players must garner Public Support to face him directly.)</i>\n[star] <b>Forced Interrupt</b>: When Kingpin would attack you, he schemes instead.",
    health: 28,
    health_per_hero: true,
    scheme: 3,
    attack: 0,
    attack_star: true,
    stage: "B1",
    traits: "Criminal.",
    illustrator: "Bruno Frenda",
    is_unique: true,
  },
  {
    code: "60160b",
    fields: {
      name: "Kingpin",
      text: "Steady.\n[star] <b>Forced Interrupt</b>: When Kingpin activates against you, if you are not engaged with a minion, give Kingpin 1 additional boost card for this activation and this activation gains overkill if it is an attack.",
      health: 28,
      health_per_hero: true,
      scheme: 3,
      scheme_star: true,
      attack: 3,
      attack_star: true,
      stage: "B2",
      traits: "Criminal. Martial Artist.",
      illustrator: "Bruno Frenda",
      is_unique: true,
    },
  },
);

// ---- 60161 The King's Gambit (1A / 1B), 3/22 ----------------------------------------------------------------

const KINGS_GAMBIT = card(
  "60161a",
  "main_scheme",
  161,
  3,
  {
    name: "The King's Gambit",
    text: "<b>Contents</b>: Kingpin (A1). <i>(Kingpin (B1) instead for expert mode.)</i> Kingpin encounter set. Two modular encounter sets <i>(Tombstone and Tracksuit Mafia)</i>.\n<b>Setup</b>: Each player reveals their set-aside nemesis minion. Each player whose nemesis minion shares a title with a character in play instead removes their nemesis minion from the game, then finds an [[Underling]] minion that is not in play and reveals it.",
    stage: "1A",
  },
  {
    code: "60161b",
    fields: {
      name: "The King's Gambit",
      text: "<b>When Revealed</b>: Put Public Support into play, [[Low]] side faceup.\n<b>Hero Action</b>: Remove 5 threat from here <i>(4 threat instead in expert mode)</i>. Shuffle the encounter discard pile into the encounter deck, then discard cards from the top of the encounter deck until a minion is discarded and reveal that minion.\n<b>If this stage is completed, the players lose the game.</b>",
      base_threat: 3,
      escalation_threat: 1,
      threat: 11,
      stage: "1B",
    },
  },
);

// ---- 60162 Endgame (2A / 2B), 4/22 --------------------------------------------------------------------------

const ENDGAME = card(
  "60162a",
  "main_scheme",
  162,
  4,
  {
    name: "Endgame",
    text: "<b>When Revealed</b>: Each player finds their nemesis minion and reveals it. Each player whose nemesis minion did not enter play this way finds an [[Underling]] minion that is not in play and reveals it. In expert mode, the first player finds and reveals the Organized Crime side scheme.",
    flavor: '"Enough games. I want these do-gooders dealt with. Permanently!" –Kingpin',
    stage: "2A",
  },
  {
    code: "60162b",
    fields: {
      name: "Endgame",
      text: "Each minion gains guard.\n<b>If this stage is completed, the players lose the game.</b>",
      flavor:
        '"You so-called heroes have been a thorn in all of our sides for far too long. Together we will destroy you and rule this city!" –Kingpin',
      base_threat: 0,
      escalation_threat: 1,
      threat: 7,
      stage: "2B",
    },
  },
);

// ---- 60163 Public Support (Low / High), 5/22 ----------------------------------------------------------------

const PUBLIC_SUPPORT = card(
  "60163a",
  "environment",
  163,
  5,
  {
    name: "Public Support",
    text: "<b>Forced Response</b>: After a minion is defeated, place 1 support counter here.\n<b>Forced Interrupt</b>: When the villain phase begins, if there are at least 2[per_hero]+2 support counters here, flip Kingpin and advance the main scheme to stage 2A. Then, flip this card.",
    traits: "Low.",
    illustrator: "Facundo Moyano",
  },
  {
    code: "60163b",
    fields: {
      name: "Public Support",
      text: "<b>Interrupt</b>: When an enemy would be given a facedown boost card, remove 1[per_hero] support counters from here instead.\n<b>Forced Response</b>: After a minion is defeated, place 1 support counter here.",
      flavor: '"So nice of them to show some gratitude! For once." –Jessica Jones',
      traits: "High.",
    },
  },
);

// ---- 60164 to 60168 attachments, 6/22 to 10/22 --------------------------------------------------------------

const BEAR_HUG = card("60164", "attachment", 164, 6, {
  name: "Bear Hug",
  text: `If Kingpin has the [[Martial Artist]] trait, attach to your hero. Otherwise, this card gains surge.\nUses (3 grip counters).\nYou cannot change to alter-ego form.\n<b>Forced Interrupt</b>: When you would thwart or attack, remove 1 grip counter from here instead.`,
  boost: 2,
  traits: "Condition.",
});

const JAMES_WESLEY = card("60165", "attachment", 165, 7, {
  name: "James Wesley",
  text: `<b>When Revealed</b>: Attach to Kingpin and give him a facedown boost card.\n<b>Hero Action</b>: Discard a [[Thwart]] event from your hand → discard James Wesley. Kingpin schemes.${HR}[star] <b>Boost</b>: Attach this card to Kingpin.`,
  scheme: 1,
  boost: null,
  boost_star: true,
  traits: "Persona.",
  illustrator: "Simone Ragazzoni",
  is_unique: true,
});

const KINGPINS_CANE = card("60166", "attachment", 166, 8, {
  name: "Kingpin's Cane",
  text: `<b>When Revealed</b>: Attach to Kingpin. You are stunned.\n<b>Forced Response</b>: After Kingpin attacks and damages a hero, stun that hero. If a hero is stunned this way, discard this card.${HR}[star] <b>Boost</b>: You are stunned. If you were already stunned, take 1 damage.`,
  attack: 1,
  boost: 1,
  boost_star: true,
  traits: "Weapon.",
  is_unique: true,
});

const MOUNTAIN_OF_MUSCLE = card("60167", "attachment", 167, 9, {
  name: "Mountain of Muscle",
  text: "If Kingpin has the [[Martial Artist]] trait, attach to Kingpin. Otherwise, this card gains surge.\nKingpin gains retaliate 1.\n<b>Forced Interrupt</b>: When Kingpin would take any amount of damage, place it here instead. Then, if there is 8 or more damage here, discard this card.",
  boost: 2,
  traits: "Condition.",
});

const VANESSA_FISK = card("60168", "attachment", 168, 10, {
  name: "Vanessa Fisk",
  text: `<b>When Revealed</b>: Attach to Kingpin. You are confused.\n<b>Hero Action</b>: Discard an [[Attack]] event from your hand → discard Vanessa Fisk. Kingpin attacks you.${HR}[star] <b>Boost</b>: You are confused. If you were already confused, place 1 threat on the main scheme.`,
  scheme: 1,
  boost: null,
  boost_star: true,
  traits: "Persona.",
  illustrator: "Simone Ragazzoni",
  is_unique: true,
});

// ---- 60169 to 60172 minions, 11/22 to 14/22 -----------------------------------------------------------------

const BLACK_CAT = card("60169", "minion", 169, 11, {
  name: "Black Cat",
  text: "Villainous.\nWhile there is 4 threat here, treat Black Cat as an ally that takes 2 consequential damage after she attacks or thwarts.\n<b>Hero Action</b>: Spend a [mental] resource → place 1 threat here. If there is 4 threat here, take control of Black Cat as an ally.",
  health: 6,
  scheme: 1,
  thwart: 1,
  attack: 1,
  boost: 2,
  traits: "Thief. Underling.",
  is_unique: true,
});

const DIAMONDBACK = card("60170", "minion", 170, 12, {
  name: "Diamondback",
  text: `Villainous.\n[star] <b>Forced Interrupt</b>: When Diamondback attacks you, take 1 damage.${HR}[star] <b>Boost</b>: Take 1 damage.`,
  health: 6,
  scheme: 1,
  attack: 1,
  attack_star: true,
  boost: 2,
  boost_star: true,
  traits: "Criminal. Underling.",
  illustrator: "Bruno Frenda",
  is_unique: true,
});

const SPOT = card("60171", "minion", 171, 13, {
  name: "Spot",
  text: "Enters play with 1 spot counter on him.\n<b>Forced Interrupt</b>: When Spot would be dealt damage from an attack, if there is at least 1 spot counter here, remove 1 spot counter from here and deal that damage to the attacker instead. Otherwise, place 1 spot counter here.",
  health: 5,
  scheme: 2,
  attack: 2,
  boost: 3,
  traits: "Criminal. Underling.",
  is_unique: true,
});

const STILT_MAN = card("60172", "minion", 172, 14, {
  name: "Stilt-Man",
  text: "Enters play with 2 stilt counters on him.\n[star] Stilt-Man gets +1 SCH and +1 ATK for each stilt counter on him.\n<b>Forced Interrupt</b>: When Stilt-Man would take any amount of damage, remove 1 stilt counter from him instead.",
  health: 4,
  scheme: 1,
  scheme_star: true,
  attack: 1,
  attack_star: true,
  boost: 3,
  traits: "Criminal. Underling.",
  illustrator: "Sebastián Guidobono",
  is_unique: true,
});

// ---- 60173, 60174 side schemes, 15/22 and 16/22 -------------------------------------------------------------

const KINGPINS_INFLUENCE = card("60173", "side_scheme", 173, 15, {
  name: "Kingpin's Influence",
  text: "<b>When Defeated</b>: The player who defeated this scheme places 3 threat on their nemesis side scheme. If it is not in play, they find it and reveal it.",
  flavor: "Kingpin uses a combination of lies, bribes, and threats to get others to do his bidding.",
  base_threat: 2,
  scheme_acceleration: 1,
  boost: 3,
});

const ORGANIZED_CRIME = card("60174", "side_scheme", 174, 16, {
  name: "Organized Crime",
  text: "Each minion gets +2 hit points.",
  flavor: '"We\'re stronger when we work together." –Kingpin',
  base_threat: 3,
  boost: 2,
});

// ---- 60175, 60176 treacheries, 17/22 to 22/22 ---------------------------------------------------------------

const BAG_OF_TRICKS = card("60175", "treachery", 175, 17, {
  name: "Bag of Tricks",
  text: `<b>When Revealed</b>: Reveal a random card from your set-aside nemesis set. If no card is revealed this way, this card gains surge.${HR}[star] <b>Boost</b>: Give this character a random card from your set-aside nemesis set as an additional boost card.`,
  quantity: 3,
  boost: null,
  boost_star: true,
  illustrator: "Joey Vazquez",
});

const UNRELENTING_HATE = card("60176", "treachery", 176, 20, {
  name: "Unrelenting Hate",
  text: `<b>When Revealed</b>: Your nemesis minion activates against you. If your nemesis minion is not in play, find it and reveal it. If you cannot find it, find an [[Underling]] minion that is not in play and reveal it.${HR}[star] <b>Boost</b>: If this activation is an attack, it gains overkill.`,
  quantity: 3,
  boost: 1,
  boost_star: true,
});

export const KINGPIN: readonly AddedRecord[] = [
  {
    record: KINGPIN_A1,
    reason: "Kingpin (A1/A2), box scenario half MarvelCDB lacks; owner approved Hall of Heroes scans.",
    evidence:
      "Scans 60159a.jpg and 60159b.jpg (footer KINGPIN (1/22) / HIT POINTS 25 per player, 159A/159B, Bruno Frenda). A1: unique star, VILLAIN, SCH 2, ATK star (no number), CRIMINAL.; 'Stalwart. Kingpin cannot be dealt damage or have upgrades attached. (The players must garner Public Support to face him directly.) [star] Forced Interrupt: When Kingpin would attack you, he schemes instead.' A2: SCH 2*, ATK 2*, CRIMINAL. MARTIAL ARTIST.; 'Steady. [star] Forced Interrupt: When Kingpin activates against you, if you are not engaged with a minion, give Kingpin 1 additional boost card for this activation.' ATK printed as a bare star on A1 is recorded the way MarvelCDB does it (attack 0, attack_star true).",
  },
  {
    record: KINGPIN_B1,
    reason: "Kingpin (B1/B2, expert), box scenario half MarvelCDB lacks.",
    evidence:
      "Scans 60160a.jpg and 60160b.jpg (footer KINGPIN (2/22) / HIT POINTS 28 per player, 160A/160B). B1: SCH 3, ATK star, CRIMINAL., same text as A1. B2: SCH 3*, ATK 3*, CRIMINAL. MARTIAL ARTIST.; same as A2 plus ' and this activation gains overkill if it is an attack.' after '...for this activation'.",
  },
  {
    record: KINGS_GAMBIT,
    reason: "The King's Gambit (1A/1B) main scheme, box scenario half MarvelCDB lacks.",
    evidence:
      "Scans 60161a.jpg and 60161b.jpg (footer KINGPIN (3/22), 161A/161B). 1A: 'Contents: Kingpin (A1). (Kingpin (B1) instead for expert mode.) Kingpin encounter set. Two modular encounter sets (Tombstone and Tracksuit Mafia). Setup: Each player reveals their set-aside nemesis minion. Each player whose nemesis minion shares a title with a character in play instead removes their nemesis minion from the game, then finds an UNDERLING minion that is not in play and reveals it.' 1B: threat 11 with per player icon (top left; the digits read '11'), escalation +1 per player, starting threat 3 per player; 'When Revealed: Put Public Support into play, LOW side faceup. Hero Action: Remove 5 threat from here (4 threat instead in expert mode). Shuffle the encounter discard pile into the encounter deck, then discard cards from the top of the encounter deck until a minion is discarded and reveal that minion. If this stage is completed, the players lose the game.' Recorded as threat 11 per hero, base_threat 3 per hero, escalation_threat 1 per hero (non-fixed, as aoa 45121b).",
  },
  {
    record: ENDGAME,
    reason: "Endgame (2A/2B) main scheme, box scenario half MarvelCDB lacks.",
    evidence:
      "Scans 60162a.jpg, 60162b.jpg (footer KINGPIN (4/22), 162A/162B). 2A flavor: \"Enough games. I want these do-gooders dealt with. Permanently!\" -Kingpin; 'When Revealed: Each player finds their nemesis minion and reveals it. Each player whose nemesis minion did not enter play this way finds an UNDERLING minion that is not in play and reveals it. In expert mode, the first player finds and reveals the Organized Crime side scheme.' 2B: threat 7 per player, +1 per player escalation, starting threat 0 per player (icon printed); flavor \"You so-called heroes have been a thorn in all of our sides for far too long. Together we will destroy you and rule this city!\" -Kingpin; 'Each minion gains guard. If this stage is completed, the players lose the game.'",
  },
  {
    record: PUBLIC_SUPPORT,
    reason: "Public Support (Low/High) double-sided environment, box scenario half MarvelCDB lacks.",
    evidence:
      "Scans 60163a.jpg, 60163b.jpg (footer KINGPIN (5/22), no card-number suffix printed). LOW. (Facundo Moyano): 'Forced Response: After a minion is defeated, place 1 support counter here. Forced Interrupt: When the villain phase begins, if there are at least 2[per player]+2 support counters here, flip Kingpin and advance the main scheme to stage 2A. Then, flip this card.' HIGH. (no illustrator printed): 'Interrupt: When an enemy would be given a facedown boost card, remove 1[per player] support counters from here instead. Forced Response: After a minion is defeated, place 1 support counter here.' flavor \"So nice of them to show some gratitude! For once.\" -Jessica Jones. Neither face prints boost icons or stats.",
  },
  {
    record: BEAR_HUG,
    reason: "Bear Hug attachment, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60164.jpg (footer KINGPIN (6/22), 164, no illustrator printed). ATTACHMENT, CONDITION., two boost icons, no stat box, not unique. Text: 'If Kingpin has the MARTIAL ARTIST trait, attach to your hero. Otherwise, this card gains surge. Uses (3 grip counters). You cannot change to alter-ego form. Forced Interrupt: When you would thwart or attack, remove 1 grip counter from here instead.' The scan reads 'from here' (not 'from this card').",
  },
  {
    record: JAMES_WESLEY,
    reason: "James Wesley attachment, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60165.jpg (footer KINGPIN (7/22), 165, Simone Ragazzoni). Unique star, ATTACHMENT, PERSONA., stat box +1 SCH, boost icon is the star only. 'When Revealed: Attach to Kingpin and give him a facedown boost card. Hero Action: Discard a THWART event from your hand -> discard James Wesley. Kingpin schemes. [rule] [star] Boost: Attach this card to Kingpin.'",
  },
  {
    record: KINGPINS_CANE,
    reason: "Kingpin's Cane attachment, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60166.jpg (footer KINGPIN (8/22), 166, no illustrator printed). Unique star, ATTACHMENT, WEAPON., stat box +1 ATK, boost icons star plus one. 'When Revealed: Attach to Kingpin. You are stunned. Forced Response: After Kingpin attacks and damages a hero, stun that hero. If a hero is stunned this way, discard this card. [rule] [star] Boost: You are stunned. If you were already stunned, take 1 damage.'",
  },
  {
    record: MOUNTAIN_OF_MUSCLE,
    reason: "Mountain of Muscle attachment, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60167.jpg (footer KINGPIN (9/22), 167, no illustrator printed). ATTACHMENT, CONDITION., two boost icons, no stat box, not unique. 'If Kingpin has the MARTIAL ARTIST trait, attach to Kingpin. Otherwise, this card gains surge. Kingpin gains retaliate 1. Forced Interrupt: When Kingpin would take any amount of damage, place it here instead. Then, if there is 8 or more damage here, discard this card.'",
  },
  {
    record: VANESSA_FISK,
    reason: "Vanessa Fisk attachment, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60168.jpg (footer KINGPIN (10/22), 168, Simone Ragazzoni). Unique star, ATTACHMENT, PERSONA., stat box +1 SCH, boost icon is the star only. 'When Revealed: Attach to Kingpin. You are confused. Hero Action: Discard an ATTACK event from your hand -> discard Vanessa Fisk. Kingpin attacks you. [rule] [star] Boost: You are confused. If you were already confused, place 1 threat on the main scheme.'",
  },
  {
    record: BLACK_CAT,
    reason: "Black Cat minion, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60169.jpg (footer KINGPIN (11/22), 169, no illustrator printed). Unique star, MINION, THIEF. UNDERLING., one combined stat box 'SCH/THW 1' (recorded as scheme 1 and thwart 1; no MarvelCDB precedent for a minion thwart), ATK 1, hit points 6 (orange circle, no per player icon), two boost icons. 'Villainous. While there is 4 threat here, treat Black Cat as an ally that takes 2 consequential damage after she attacks or thwarts. Hero Action: Spend a [resource icon] resource -> place 1 threat here. If there is 4 threat here, take control of Black Cat as an ally.' UNCERTAIN: the resource glyph (zoomed in) is a node-and-link cluster, which is the Mental resource icon, transcribed [mental]; not confirmed against a second source.",
  },
  {
    record: DIAMONDBACK,
    reason: "Diamondback minion, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60170.jpg (footer KINGPIN (12/22), 170, Bruno Frenda). Unique star, MINION, CRIMINAL. UNDERLING., SCH 1, ATK 1*, hit points 6, boost icons star plus two. 'Villainous. [star] Forced Interrupt: When Diamondback attacks you, take 1 damage. [rule] [star] Boost: Take 1 damage.'",
  },
  {
    record: SPOT,
    reason: "Spot minion, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60171.jpg (footer KINGPIN (13/22), 171, no illustrator printed). Unique star, MINION, CRIMINAL. UNDERLING., SCH 2, ATK 2, hit points 5, three boost icons. 'Enters play with 1 spot counter on him. Forced Interrupt: When Spot would be dealt damage from an attack, if there is at least 1 spot counter here, remove 1 spot counter from here and deal that damage to the attacker instead. Otherwise, place 1 spot counter here.'",
  },
  {
    record: STILT_MAN,
    reason: "Stilt-Man minion, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60172.jpg (footer KINGPIN (14/22), 172, Sebastian Guidobono). Unique star, MINION, CRIMINAL. UNDERLING., SCH 1*, ATK 1*, hit points 4, three boost icons. 'Enters play with 2 stilt counters on him. [star] Stilt-Man gets +1 SCH and +1 ATK for each stilt counter on him. Forced Interrupt: When Stilt-Man would take any amount of damage, remove 1 stilt counter from him instead.'",
  },
  {
    record: KINGPINS_INFLUENCE,
    reason: "Kingpin's Influence side scheme, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60173.jpg (footer KINGPIN (15/22), 173, no illustrator printed). SIDE SCHEME, no traits, starting threat 2 per player, one acceleration icon (card with plus; compared to Core 01109 Bomb Scare), three boost icons. Flavor: 'Kingpin uses a combination of lies, bribes, and threats to get others to do his bidding.' 'When Defeated: The player who defeated this scheme places 3 threat on their nemesis side scheme. If it is not in play, they find it and reveal it.'",
  },
  {
    record: ORGANIZED_CRIME,
    reason: "Organized Crime side scheme, box scenario half MarvelCDB lacks.",
    evidence:
      "Scan 60174.jpg (footer KINGPIN (16/22), 174, no illustrator printed). SIDE SCHEME, no traits, starting threat 3 per player, no scheme icons, two boost icons. Flavor: \"We're stronger when we work together.\" -Kingpin. Text: 'Each minion gets +2 hit points.'",
  },
  {
    record: BAG_OF_TRICKS,
    reason: "Bag of Tricks treachery (3 copies, 17/22 to 19/22), box scenario half MarvelCDB lacks.",
    evidence:
      "Scans 60175.jpg, 60175_2.jpg, 60175_3.jpg (footers KINGPIN (17/22), (18/22), (19/22), all 175, Joey Vazquez; identical text and art). TREACHERY, no traits, boost icon is the star only. 'When Revealed: Reveal a random card from your set-aside nemesis set. If no card is revealed this way, this card gains surge. [rule] [star] Boost: Give this character a random card from your set-aside nemesis set as an additional boost card.'",
  },
  {
    record: UNRELENTING_HATE,
    reason: "Unrelenting Hate treachery (3 copies, 20/22 to 22/22), box scenario half MarvelCDB lacks.",
    evidence:
      "Scans 60176.jpg, 60176_2.jpg, 60176_3.jpg (footers KINGPIN (20/22), (21/22), (22/22), all 176; identical text and art; no illustrator printed). TREACHERY, no traits, boost icons star plus one. 'When Revealed: Your nemesis minion activates against you. If your nemesis minion is not in play, find it and reveal it. If you cannot find it, find an UNDERLING minion that is not in play and reveal it. [rule] [star] Boost: If this activation is an attack, it gains overkill.'",
  },
];
