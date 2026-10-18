/**
 * Fear No Evil (MC46) encounter cards, group A: the Bullseye (60065 to 60075), Electro (60076 to 60085) and
 * Hammerhead (60086 to 60096) villain sets. MarvelCDB has none of the box's scenario half (survey §3), so each card
 * is transcribed from its Hall of Heroes scan (`<collector>.jpg` and `_2` / `_3` copies in the scan download folder;
 * read directly, never wired into the data). Records are shaped like the fne.json records MarvelCDB does carry
 * (sparse keys, omitted when null), without the reference fields MarvelCDB would invent (`url`, `octgn_id`,
 * `imagesrc`).
 *
 * Conventions shared by every record below:
 * - A row of N red boost icons is `boost: N`; a leading star in that row is `boost_star: true`.
 * - A bare star where a stat numeral would be (no number printed) leaves the stat omitted (null) and sets the
 *   matching `*_star`; the value comes from the text. "0*" / "1*" (numeral plus star) keeps the numeral.
 * - The wing-and-plus icon on a scheme is the amplify icon (the same glyph as on 60034 Deadliest Man Alive, whose
 *   fne.json record has `scheme_amplify: 1`; the acceleration icon is a plus over a house, see 56025).
 * - A copy count above one is `quantity`; `set_position` is the first copy's N of the printed N/14.
 * - `text` is MarvelCDB markup: `[star]` for the printed star before a line, `<hr />` before the boost line,
 *   `[boost]` / `[per_hero]` / resource icons as MarvelCDB writes them.
 */
import type { RawCard } from "../../raw-types.ts";
import type { AddedRecord } from "../types.ts";

type SetId = "bullseye" | "electro" | "hammerhead";
const SET_NAMES: Record<SetId, string> = { bullseye: "Bullseye", electro: "Electro", hammerhead: "Hammerhead" };

interface Spec {
  readonly set: SetId;
  readonly code: string;
  readonly type: "villain" | "minion" | "attachment" | "side_scheme" | "treachery";
  readonly name: string;
  readonly setPosition: number;
  readonly quantity: number;
  readonly text: string;
  readonly traits?: string;
  readonly flavor?: string;
  readonly illustrator?: string;
  readonly unique?: boolean;
  readonly permanent?: boolean;
  readonly stage?: string;
  readonly health?: number;
  readonly perHero?: boolean;
  readonly scheme?: number | null;
  readonly attack?: number | null;
  readonly schemeStar?: boolean;
  readonly attackStar?: boolean;
  readonly boost?: number;
  readonly boostStar?: boolean;
  readonly baseThreat?: number;
  readonly amplify?: number;
  readonly linkedCode?: string;
  readonly linkedName?: string;
}

const TYPE_NAMES = {
  villain: "Villain",
  minion: "Minion",
  attachment: "Attachment",
  side_scheme: "Side Scheme",
  treachery: "Treachery",
} as const;

/** Builds a record in the key order and omission rules of the fne.json records. */
function rec(s: Spec): RawCard {
  const position = Number.parseInt(s.code.slice(0, 5), 10) - 60000;
  const out: Record<string, unknown> = {
    pack_code: "fne",
    pack_name: "Fear No Evil",
    pack_legacy: false,
    type_code: s.type,
    type_name: TYPE_NAMES[s.type],
    faction_code: "encounter",
    faction_name: "Encounter",
    card_set_code: s.set,
    card_set_name: SET_NAMES[s.set],
    card_set_type_name_code: "villain",
  };
  if (s.linkedCode !== undefined) {
    out.linked_to_code = s.linkedCode;
    out.linked_to_name = s.linkedName;
  }
  Object.assign(out, {
    position,
    set_position: s.setPosition,
    code: s.code,
    name: s.name,
    real_name: s.name,
    cost_per_hero: false,
    cost_star: false,
    text: s.text,
    real_text: s.text,
  });
  if (s.boost !== undefined) out.boost = s.boost;
  out.quantity = s.quantity;
  if (s.health !== undefined) out.health = s.health;
  out.health_per_group = false;
  out.health_per_hero = s.perHero === true;
  if (s.scheme != null) out.scheme = s.scheme;
  if (s.attack != null) out.attack = s.attack;
  if (s.baseThreat !== undefined) {
    out.base_threat = s.baseThreat;
    out.base_threat_fixed = true;
  } else {
    out.base_threat_fixed = false;
  }
  out.base_threat_per_group = false;
  out.base_threat_star = false;
  out.escalation_threat_fixed = false;
  if (s.amplify !== undefined) out.scheme_amplify = s.amplify;
  out.threat_fixed = false;
  out.threat_per_group = false;
  if (s.stage !== undefined) out.stage = s.stage;
  if (s.traits !== undefined) {
    out.traits = s.traits;
    out.real_traits = s.traits;
  }
  if (s.flavor !== undefined) out.flavor = s.flavor;
  if (s.illustrator !== undefined) out.illustrator = s.illustrator;
  out.is_unique = s.unique === true;
  out.hidden = false;
  out.permanent = s.permanent === true;
  out.double_sided = false;
  Object.assign(out, {
    attack_star: s.attackStar === true,
    thwart_star: false,
    defense_star: false,
    health_star: false,
    recover_star: false,
    scheme_star: s.schemeStar === true,
    boost_star: s.boostStar === true,
    threat_star: false,
    escalation_threat_star: false,
    spoiler: 1,
  });
  return out as unknown as RawCard;
}

/**
 * 60068b Damaged Spine, the back of 60068a, nested as `linked_card` the way MarvelCDB nests a back face (compare
 * aoa.json 45081b): every key present with nulls, `hidden: true`, no image.
 */
const DAMAGED_SPINE_TEXT =
  "Permanent.\n[star] <b>Forced Response</b>: After Bullseye schemes, remove 3 damage from here. Then, if there is no damage here, flip this card.";
const DAMAGED_SPINE = {
  pack_code: "fne",
  pack_name: "Fear No Evil",
  pack_legacy: false,
  type_code: "attachment",
  type_name: "Attachment",
  faction_code: "encounter",
  faction_name: "Encounter",
  card_set_code: "bullseye",
  card_set_name: "Bullseye",
  card_set_type_name_code: "villain",
  card_set_parent_code: null,
  position: 68,
  set_position: 4,
  code: "60068b",
  name: "Damaged Spine",
  real_name: "Damaged Spine",
  subname: null,
  cost: null,
  cost_per_hero: false,
  cost_star: false,
  text: DAMAGED_SPINE_TEXT,
  real_text: DAMAGED_SPINE_TEXT,
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
  traits: "Tech.",
  real_traits: "Tech.",
  meta: null,
  flavor: "",
  illustrator: "Andrea Di Vito & Laura Villari",
  is_unique: true,
  hidden: true,
  permanent: true,
  double_sided: false,
  back_text: null,
  back_flavor: null,
  back_name: null,
  attack_star: false,
  thwart_star: false,
  defense_star: false,
  health_star: false,
  recover_star: false,
  scheme_star: true,
  boost_star: false,
  threat_star: false,
  escalation_threat_star: false,
  errata: null,
  imagesrc: null,
  spoiler: 1,
  backimagesrc: null,
} as unknown as RawCard;

const NO_REC = "MarvelCDB has no record of";

export const VILLAINS_A: readonly AddedRecord[] = [
  // ---- Bullseye (14 copies) ----
  {
    record: rec({
      set: "bullseye",
      code: "60065",
      type: "villain",
      name: "Bullseye",
      setPosition: 1,
      quantity: 1,
      stage: "I",
      health: 14,
      perHero: true,
      scheme: 0,
      schemeStar: true,
      attack: 1,
      attackStar: true,
      traits: "Assassin. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      text: "<b>When Revealed</b>: Set aside Adamantium-Laced Spine (68A).\n[star] <b>Forced Interrupt</b>: When Bullseye activates, each of his boost cards gains [boost]. If this activation is an attack, it gains ranged.",
    }),
    reason: `${NO_REC} 60065 Bullseye (stage I), part of the box's scenario half.`,
    evidence:
      'Scan 60065-1.jpg: VILLAIN, "+ Bullseye", stage I, SCH 0 (star), ATK 1 (star), "ASSASSIN. UNDERLING.", "When Revealed: Set aside Adamantium-Laced Spine (set icon 68A). (star) Forced Interrupt: When Bullseye activates, each of his boost cards gains (boost icon). If this activation is an attack, it gains ranged." Footer "BULLSEYE (1/14) / HIT POINTS 14 (per-hero icon)", Joey Vazquez, 65. The set-icon reference to 68A is written "(68A)".',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60066",
      type: "villain",
      name: "Bullseye",
      setPosition: 2,
      quantity: 1,
      stage: "II",
      health: 16,
      perHero: true,
      scheme: 1,
      schemeStar: true,
      attack: 2,
      attackStar: true,
      traits: "Assassin. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      text: "<b>When Revealed</b>: Find Adamantium-Laced Spine and attach it to Bullseye.\n[star] <b>Forced Interrupt</b>: When Bullseye activates, each of his boost cards gains [boost]. If this activation is an attack, it gains ranged.",
    }),
    reason: `${NO_REC} 60066 Bullseye (stage II).`,
    evidence:
      'Scan 60066-1.jpg: VILLAIN, stage II, SCH 1 (star), ATK 2 (star), "ASSASSIN. UNDERLING.", "When Revealed: Find Adamantium-Laced Spine and attach it to Bullseye. (star) Forced Interrupt: When Bullseye activates, each of his boost cards gains (boost icon). If this activation is an attack, it gains ranged." Footer "BULLSEYE (2/14) / HIT POINTS 16 (per-hero)", 66.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60067",
      type: "villain",
      name: "Bullseye",
      setPosition: 3,
      quantity: 1,
      stage: "III",
      health: 18,
      perHero: true,
      scheme: 1,
      schemeStar: true,
      attack: 3,
      attackStar: true,
      traits: "Assassin. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      text: "<b>When Revealed</b>: Find Deranged Bloodlust and reveal it.\n[star] <b>Forced Interrupt</b>: When Bullseye activates, each of his boost cards gains [boost]. If this activation is an attack, it gains ranged.",
    }),
    reason: `${NO_REC} 60067 Bullseye (stage III).`,
    evidence:
      'Scan 60067-1.jpg: VILLAIN, stage III, SCH 1 (star), ATK 3 (star), "ASSASSIN. UNDERLING.", "When Revealed: Find Deranged Bloodlust and reveal it. (star) Forced Interrupt: When Bullseye activates, each of his boost cards gains (boost icon). If this activation is an attack, it gains ranged." Footer "BULLSEYE (3/14) / HIT POINTS 18 (per-hero)", 67.',
  },
  {
    record: {
      ...rec({
        set: "bullseye",
        code: "60068a",
        type: "attachment",
        name: "Adamantium-Laced Spine",
        setPosition: 4,
        quantity: 1,
        traits: "Tech.",
        unique: true,
        permanent: true,
        linkedCode: "60068b",
        linkedName: "Damaged Spine",
        text: "Permanent.\n<b>Forced Interrupt</b>: When Bullseye would take damage, prevent all but 3 of that damage. Place the prevented damage here. Then, if there is 6 or more damage here, flip this card.",
      }),
      linked_card: DAMAGED_SPINE,
    } as unknown as RawCard,
    reason: `${NO_REC} 60068a Adamantium-Laced Spine and its back 60068b Damaged Spine (one double-sided card).`,
    evidence:
      'Scans 60068a-1.jpg and 60068b-1.jpg (both footers "BULLSEYE (4/14)", collector 68A / 68B). Side A: ATTACHMENT, "+ Adamantium-Laced Spine", "TECH.", "Permanent. Forced Interrupt: When Bullseye would take damage, prevent all but 3 of that damage. Place the prevented damage here. Then, if there is 6 or more damage here, flip this card." No stat box, no boost icons, no illustrator printed. Side B: "+ Damaged Spine", ATTACHMENT, SCH (bare star, no numeral), "TECH.", "Permanent. (star) Forced Response: After Bullseye schemes, remove 3 damage from here. Then, if there is no damage here, flip this card." Andrea Di Vito & Laura Villari. The B face SCH is a bare star, so scheme is null with scheme_star true.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60069",
      type: "attachment",
      name: "Raise the Stakes",
      setPosition: 5,
      quantity: 1,
      traits: "Condition.",
      attackStar: true,
      boost: 3,
      illustrator: "Joey Vazquez",
      text: "Attach to Bullseye.\n[star] <b>Forced Interrupt</b>: When Bullseye attacks, give him 1 additional boost card for this attack. If this attack defeats a friendly character, remove them and this card from the game. Otherwise, shuffle this card into the encounter deck.",
    }),
    reason: `${NO_REC} 60069 Raise the Stakes.`,
    evidence:
      'Scan 60069-1.jpg: ATTACHMENT, "Raise the Stakes", ATK (bare star, no numeral), "CONDITION.", "Attach to Bullseye. (star) Forced Interrupt: When Bullseye attacks, give him 1 additional boost card for this attack. If this attack defeats a friendly character, remove them and this card from the game. Otherwise, shuffle this card into the encounter deck." Three boost icons, no boost star. "BULLSEYE (5/14)", Joey Vazquez, 69. Bare-star ATK: attack null, attack_star true.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60070",
      type: "attachment",
      name: "Deadly Sai",
      setPosition: 6,
      quantity: 1,
      traits: "Weapon.",
      attack: 2,
      attackStar: true,
      boost: 2,
      illustrator: "Joey Vazquez",
      text: "Attach to Bullseye.\n[star] Bullseye's attacks lose ranged and gain piercing.\n<b>Hero Response</b>: After your hero defends against an attack from Bullseye, spend 2 different resources → discard this card.",
    }),
    reason: `${NO_REC} 60070 Deadly Sai.`,
    evidence:
      'Scan 60070-1.jpg: ATTACHMENT, "Deadly Sai", ATK +2 (star), "WEAPON.", "Attach to Bullseye. (star) Bullseye\'s attacks lose ranged and gain piercing. Hero Response: After your hero defends against an attack from Bullseye, spend 2 different resources -> discard this card." Two boost icons, no star. "BULLSEYE (6/14)", Joey Vazquez, 70.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60071",
      type: "attachment",
      name: "Incessant Pursuit",
      setPosition: 7,
      quantity: 3,
      traits: "Condition.",
      boost: 1,
      illustrator: "Allie Preswick",
      text: "Attach to an ally without Incessant Pursuit attached. Otherwise, this card gains surge.\n<b>Forced Interrupt</b>: When the villain would attack you, it attacks attached ally instead and the attack gains overkill. If this attack defeats attached ally, remove them from the game.",
    }),
    reason: `${NO_REC} 60071 Incessant Pursuit (3 copies, 7/14 to 9/14).`,
    evidence:
      'Scans 60071-1.jpg, 60071_2-1.jpg, 60071_3-1.jpg (footers "BULLSEYE (7/14)", "(8/14)", "(9/14)", all collector 71, identical text): ATTACHMENT, "Incessant Pursuit", no stat box, "CONDITION.", "Attach to an ally without Incessant Pursuit attached. Otherwise, this card gains surge. Forced Interrupt: When the villain would attack you, it attacks attached ally instead and the attack gains overkill. If this attack defeats attached ally, remove them from the game." One boost icon, no star. Allie Preswick.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60072",
      type: "minion",
      name: "Lady Bullseye",
      setPosition: 10,
      quantity: 1,
      health: 6,
      scheme: 2,
      attack: 1,
      attackStar: true,
      boost: 3,
      traits: "Assassin. Hand.",
      unique: true,
      text: "Villainous. <i>(When this minion activates, give it a boost card.)</i>\n[star] <b>Forced Interrupt</b>: When resolving boost cards during Lady Bullseye's attack, if that attack is undefended, give her 1 additional boost card for this attack.",
    }),
    reason: `${NO_REC} 60072 Lady Bullseye.`,
    evidence:
      'Scan 60072-1.jpg: MINION, "+ Lady Bullseye", SCH 2, ATK 1 (star), hit point circle 6, "ASSASSIN. HAND.", "Villainous. (When this minion activates, give it a boost card.) (star) Forced Interrupt: When resolving boost cards during Lady Bullseye\'s attack, if that attack is undefended, give her 1 additional boost card for this attack." Three boost icons, no star. "BULLSEYE (10/14)", 72. No illustrator printed.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60073",
      type: "side_scheme",
      name: "Deranged Bloodlust",
      setPosition: 11,
      quantity: 1,
      baseThreat: 4,
      amplify: 1,
      boost: 1,
      boostStar: true,
      text: "<b>When Revealed</b>: Place additional threat here equal to Bullseye's stage number.\n<hr />\n[star] <b>Boost</b>: After this activation, reveal this card.",
    }),
    reason: `${NO_REC} 60073 Deranged Bloodlust.`,
    evidence:
      'Scan 60073-1.jpg (landscape): SIDE SCHEME, "Deranged Bloodlust", threat 4 (no per-hero icon), one amplify icon, "When Revealed: Place additional threat here equal to Bullseye\'s stage number." / "(star) Boost: After this activation, reveal this card." Boost row: star plus one boost icon. "BULLSEYE (11/14)", 73. No illustrator or traits printed.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60074",
      type: "treachery",
      name: "Everything is a Weapon",
      setPosition: 12,
      quantity: 1,
      boost: 1,
      boostStar: true,
      illustrator: "Eleonora Carlini",
      text: "<b>When Revealed (Alter-Ego)</b>: Take 2 indirect damage.\n<b>When Revealed (Hero)</b>: Choose: Either Bullseye activates against you, or remove an ally you control from the game.\n<hr />\n[star] <b>Boost</b>: If Bullseye is attacking, give him an additional boost card and this attack gains piercing.",
    }),
    reason: `${NO_REC} 60074 Everything is a Weapon.`,
    evidence:
      'Scan 60074-1.jpg: TREACHERY, "Everything is a Weapon", no traits, "When Revealed (Alter-Ego): Take 2 indirect damage. When Revealed (Hero): Choose: Either Bullseye activates against you, or remove an ally you control from the game." / "(star) Boost: If Bullseye is attacking, give him an additional boost card and this attack gains piercing." Boost row: star plus one boost icon. "BULLSEYE (12/14)", Eleonora Carlini, 74.',
  },
  {
    record: rec({
      set: "bullseye",
      code: "60075",
      type: "treachery",
      name: "Unerring Desire",
      setPosition: 13,
      quantity: 2,
      boost: 3,
      boostStar: true,
      text: "<b>When Revealed</b>: Choose to either give this card to the villain as a facedown boost card, or remove a [[Persona]] support you control from the game.\n<hr />\n[star] <b>Boost</b>: If this activation is an attack, it gains overkill.",
    }),
    reason: `${NO_REC} 60075 Unerring Desire (2 copies, 13/14 and 14/14).`,
    evidence:
      'Scans 60075-1.jpg and 60075_2-1.jpg (footers "BULLSEYE (13/14)" and "(14/14)", collector 75, identical text): TREACHERY, "Unerring Desire", no traits, "When Revealed: Choose to either give this card to the villain as a facedown boost card, or remove a PERSONA support you control from the game." / "(star) Boost: If this activation is an attack, it gains overkill." Boost row: star plus three boost icons. No illustrator printed.',
  },

  // ---- Electro (14 copies) ----
  {
    record: rec({
      set: "electro",
      code: "60076",
      type: "villain",
      name: "Electro",
      setPosition: 1,
      quantity: 1,
      stage: "I",
      health: 15,
      perHero: true,
      scheme: 1,
      schemeStar: true,
      attack: 1,
      traits: "Criminal. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      text: "<b>When Revealed</b>: Find Electric Charge, attach it to Electro, and place 2[per_hero] charge counters on it.\n[star] <b>Forced Response</b>: After Electro schemes, place 1 charge counter on Electric Charge.",
    }),
    reason: `${NO_REC} 60076 Electro (stage I).`,
    evidence:
      'Scan 60076.jpg: VILLAIN, "+ Electro", stage I, SCH 1 (star), ATK 1 (no star), "CRIMINAL. UNDERLING.", "When Revealed: Find Electric Charge, attach it to Electro, and place 2 (per-hero icon) charge counters on it. (star) Forced Response: After Electro schemes, place 1 charge counter on Electric Charge." Footer "ELECTRO (1/14) / HIT POINTS 15 (per-hero)", Joey Vazquez, 76.',
  },
  {
    record: rec({
      set: "electro",
      code: "60077",
      type: "villain",
      name: "Electro",
      setPosition: 2,
      quantity: 1,
      stage: "II",
      health: 17,
      perHero: true,
      scheme: 1,
      schemeStar: true,
      attack: 2,
      traits: "Criminal. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      text: "<b>When Revealed</b>: Find Electric Charge, attach it to Electro, and place 2[per_hero] charge counters on it.\n[star] <b>Forced Response</b>: After Electro schemes, place 1 charge counter on Electric Charge.",
    }),
    reason: `${NO_REC} 60077 Electro (stage II).`,
    evidence:
      'Scan 60077.jpg: VILLAIN, stage II, SCH 1 (star), ATK 2 (no star), "CRIMINAL. UNDERLING.", text identical to stage I: "When Revealed: Find Electric Charge, attach it to Electro, and place 2 (per-hero icon) charge counters on it. (star) Forced Response: After Electro schemes, place 1 charge counter on Electric Charge." Footer "ELECTRO (2/14) / HIT POINTS 17 (per-hero)", 77.',
  },
  {
    record: rec({
      set: "electro",
      code: "60078",
      type: "villain",
      name: "Electro",
      setPosition: 3,
      quantity: 1,
      stage: "III",
      health: 20,
      perHero: true,
      scheme: 2,
      schemeStar: true,
      attack: 2,
      amplify: 1,
      traits: "Criminal. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      text: "<b>When Revealed</b>: Place 3[per_hero] charge counters on Electric Charge.\n[star] <b>Forced Response</b>: After Electro schemes, place 2 charge counters on Electric Charge.",
    }),
    reason: `${NO_REC} 60078 Electro (stage III).`,
    evidence:
      'Scan 60078.jpg: VILLAIN, stage III, SCH 2 (star), ATK 2 (no star), one amplify icon at the bottom of the text box, "CRIMINAL. UNDERLING.", "When Revealed: Place 3 (per-hero icon) charge counters on Electric Charge. (star) Forced Response: After Electro schemes, place 2 charge counters on Electric Charge." Footer "ELECTRO (3/14) / HIT POINTS 20 (per-hero)", 78.',
  },
  {
    record: rec({
      set: "electro",
      code: "60079",
      type: "attachment",
      name: "Electric Charge",
      setPosition: 4,
      quantity: 1,
      traits: "Condition.",
      permanent: true,
      attackStar: true,
      text: "Permanent.\n[star] <b>Forced Interrupt</b>: When Electro attacks, remove 1 charge counter from here → give Electro an additional boost card for this attack. This attack gains overkill.\n<b>Hero Action</b>: Spend a [energy] resource or 2 resources of any type → remove 1 charge counter from here.",
    }),
    reason: `${NO_REC} 60079 Electric Charge.`,
    evidence:
      'Scan 60079.jpg: ATTACHMENT, "Electric Charge" (no unique marker before the title), ATK (bare star, no numeral), "CONDITION.", "Permanent. (star) Forced Interrupt: When Electro attacks, remove 1 charge counter from here -> give Electro an additional boost card for this attack. This attack gains overkill. Hero Action: Spend a (energy icon) resource or 2 resources of any type -> remove 1 charge counter from here." No boost icons, no illustrator. "ELECTRO (4/14)", 79. Bare-star ATK: attack null, attack_star true.',
  },
  {
    record: rec({
      set: "electro",
      code: "60080",
      type: "attachment",
      name: "Drained of Power",
      setPosition: 5,
      quantity: 1,
      traits: "Condition.",
      boost: 2,
      illustrator: "Ivan Fiorelli",
      text: "Uses (3 drain counters).\n<b>When Revealed</b>: Attach to your identity and exhaust each upgrade you control.\n<b>Forced Interrupt</b>: When an upgrade you control would ready, you may spend a [energy] resource or 2 resources of any type. If you do, remove 1 drain counter from here <i>(and ready that upgrade)</i>. Otherwise, that upgrade does not ready.",
    }),
    reason: `${NO_REC} 60080 Drained of Power.`,
    evidence:
      'Scan 60080.jpg: ATTACHMENT, "Drained of Power", no stat box, "CONDITION.", "Uses (3 drain counters). When Revealed: Attach to your identity and exhaust each upgrade you control. Forced Interrupt: When an upgrade you control would ready, you may spend a (energy icon) resource or 2 resources of any type. If you do, remove 1 drain counter from here (and ready that upgrade, italic). Otherwise, that upgrade does not ready." Two boost icons, no star. "ELECTRO (5/14)", Ivan Fiorelli, 80.',
  },
  {
    record: rec({
      set: "electro",
      code: "60081",
      type: "minion",
      name: "Whiplash",
      setPosition: 6,
      quantity: 1,
      health: 5,
      scheme: 2,
      attack: 2,
      boost: 3,
      traits: "Criminal.",
      unique: true,
      flavor: '"Shocked to see me?"',
      text: "<b>Forced Interrupt</b>: When Whiplash is attacked, remove 1 charge counter from Electric Charge → discard the top card of the encounter deck. Deal 1 damage to the attacker for each boost icon ([boost]) on the discarded card.",
    }),
    reason: `${NO_REC} 60081 Whiplash.`,
    evidence:
      'Scan 60081.jpg: MINION, "+ Whiplash", SCH 2, ATK 2 (no stars), hit point circle 5, "CRIMINAL.", "Forced Interrupt: When Whiplash is attacked, remove 1 charge counter from Electric Charge -> discard the top card of the encounter deck. Deal 1 damage to the attacker for each boost icon (boost icon) on the discarded card." Flavor "Shocked to see me?" Three boost icons, no star. "ELECTRO (6/14)", 81. No illustrator printed.',
  },
  {
    record: rec({
      set: "electro",
      code: "60082",
      type: "side_scheme",
      name: "Charging Up",
      setPosition: 7,
      quantity: 2,
      baseThreat: 6,
      amplify: 1,
      boost: 3,
      illustrator: "Joey Vazquez",
      flavor: "Electro is drawing electricity from the power grid. You need to cut off her supply!",
      text: "<b>When Defeated</b>: Place 3 charge counters on Electric Charge.",
    }),
    reason: `${NO_REC} 60082 Charging Up (2 copies, 7/14 and 8/14).`,
    evidence:
      'Scans 60082.jpg and 60082_2.jpg (footers "ELECTRO (7/14)" and "(8/14)", collector 82, identical text): SIDE SCHEME (landscape), "Charging Up", threat 6 (no per-hero icon), one amplify icon, flavor "Electro is drawing electricity from the power grid. You need to cut off her supply!", "When Defeated: Place 3 charge counters on Electric Charge." Three boost icons, no star. Joey Vazquez.',
  },
  {
    record: rec({
      set: "electro",
      code: "60083",
      type: "treachery",
      name: "Chain Lightning",
      setPosition: 9,
      quantity: 2,
      boost: 1,
      text: "<b>When Revealed</b>: For each character you control, choose:\n• Exhaust that character.\n• Deal 1 damage to that character (3 damage instead if there are any charge counters on Electric Charge). Remove 1 charge counter from Electric Charge.",
    }),
    reason: `${NO_REC} 60083 Chain Lightning (2 copies, 9/14 and 10/14).`,
    evidence:
      'Scans 60083.jpg and 60083_2.jpg (footers "ELECTRO (9/14)" and "(10/14)", collector 83, identical text): TREACHERY, "Chain Lightning", no traits, "When Revealed: For each character you control, choose: * Exhaust that character. * Deal 1 damage to that character (3 damage instead if there are any charge counters on Electric Charge). Remove 1 charge counter from Electric Charge." One boost icon, no star, no illustrator.',
  },
  {
    record: rec({
      set: "electro",
      code: "60084",
      type: "treachery",
      name: "Energy Overload",
      setPosition: 11,
      quantity: 2,
      boost: 2,
      text: "<b>When Revealed</b>: If you have no cards with a printed [energy] resource in your hand, this card gains surge. Otherwise, for each card with a printed [energy] resource in your hand, choose:\n• Discard that card.\n• Stun a character you control.",
    }),
    reason: `${NO_REC} 60084 Energy Overload (2 copies, 11/14 and 12/14).`,
    evidence:
      'Scans 60084.jpg and 60084_2.jpg (footers "ELECTRO (11/14)" and "(12/14)", collector 84, identical text): TREACHERY, "Energy Overload", no traits, "When Revealed: If you have no cards with a printed (energy icon) resource in your hand, this card gains surge. Otherwise, for each card with a printed (energy icon) resource in your hand, choose: * Discard that card. * Stun a character you control." Two boost icons, no star, no illustrator.',
  },
  {
    record: rec({
      set: "electro",
      code: "60085",
      type: "treachery",
      name: "Shocking Revelation",
      setPosition: 13,
      quantity: 2,
      boost: 2,
      text: "<b>When Revealed</b>: Discard the top card of your deck for each card you control. For each card with a printed [energy] resource discarded this way, choose:\n• Take 1 indirect damage.\n• Place 1 charge counter on Electric Charge.",
    }),
    reason: `${NO_REC} 60085 Shocking Revelation (2 copies, 13/14 and 14/14).`,
    evidence:
      'Scans 60085.jpg and 60085_2.jpg (footers "ELECTRO (13/14)" and "(14/14)", collector 85, identical text): TREACHERY, "Shocking Revelation", no traits, "When Revealed: Discard the top card of your deck for each card you control. For each card with a printed (energy icon) resource discarded this way, choose: * Take 1 indirect damage. * Place 1 charge counter on Electric Charge." Two boost icons, no star, no illustrator.',
  },

  // ---- Hammerhead (14 copies) ----
  {
    record: rec({
      set: "hammerhead",
      code: "60086",
      type: "villain",
      name: "Hammerhead",
      setPosition: 1,
      quantity: 1,
      stage: "I",
      health: 14,
      perHero: true,
      scheme: 2,
      attack: 1,
      attackStar: true,
      traits: "Criminal. Maggia. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      flavor: '"That\'s one tough noggin!"—Luke Cage',
      text: "[star] <b>Forced Response</b>: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 1 damage to them.",
    }),
    reason: `${NO_REC} 60086 Hammerhead (stage I).`,
    evidence:
      'Scan 60086.jpg: VILLAIN, "+ Hammerhead", stage I, SCH 2 (no star), ATK 1 (star), "CRIMINAL. MAGGIA. UNDERLING.", "(star) Forced Response: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 1 damage to them." Flavor "That\'s one tough noggin!"-Luke Cage. Footer "HAMMERHEAD (1/14) / HIT POINTS 14 (per-hero)", Joey Vazquez, 86.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60087",
      type: "villain",
      name: "Hammerhead",
      setPosition: 2,
      quantity: 1,
      stage: "II",
      health: 15,
      perHero: true,
      scheme: 2,
      attack: 2,
      attackStar: true,
      traits: "Criminal. Maggia. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      flavor: '"That\'s one tough noggin!"—Luke Cage',
      text: "Toughness. Retaliate 1.\n[star] <b>Forced Response</b>: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 1 damage to them.",
    }),
    reason: `${NO_REC} 60087 Hammerhead (stage II).`,
    evidence:
      'Scan 60087.jpg: VILLAIN, stage II, SCH 2 (no star), ATK 2 (star), "CRIMINAL. MAGGIA. UNDERLING.", "Toughness. Retaliate 1. (star) Forced Response: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 1 damage to them." Same flavor. Footer "HAMMERHEAD (2/14) / HIT POINTS 15 (per-hero)", 87.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60088",
      type: "villain",
      name: "Hammerhead",
      setPosition: 3,
      quantity: 1,
      stage: "III",
      health: 16,
      perHero: true,
      scheme: 3,
      attack: 3,
      attackStar: true,
      traits: "Criminal. Maggia. Underling.",
      unique: true,
      illustrator: "Joey Vazquez",
      flavor: '"That\'s one tough noggin!"—Luke Cage',
      text: "Toughness. Retaliate 2.\n[star] <b>Forced Response</b>: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 2 damage to them.",
    }),
    reason: `${NO_REC} 60088 Hammerhead (stage III).`,
    evidence:
      'Scan 60088.jpg: VILLAIN, stage III, SCH 3 (no star), ATK 3 (star), "CRIMINAL. MAGGIA. UNDERLING.", "Toughness. Retaliate 2. (star) Forced Response: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 2 damage to them." Same flavor. Footer "HAMMERHEAD (3/14) / HIT POINTS 16 (per-hero)", 88.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60089",
      type: "attachment",
      name: "Energy Gatling Gun",
      setPosition: 4,
      quantity: 1,
      traits: "Tech.",
      attack: 1,
      boost: 2,
      illustrator: "Eleonora Carlini",
      flavor: "\"Use the stun setting so's I can talk to 'em after.\"—Hammerhead",
      text: "Attach to Hammerhead.\n<b>Forced Response</b>: After Hammerhead attacks, if the attacked character was not defeated, discard this card → Hammerhead attacks that character again.",
    }),
    reason: `${NO_REC} 60089 Energy Gatling Gun.`,
    evidence:
      'Scan 60089.jpg: ATTACHMENT, "Energy Gatling Gun" (no unique marker), ATK +1 (no star), "TECH.", "Attach to Hammerhead. Forced Response: After Hammerhead attacks, if the attacked character was not defeated, discard this card -> Hammerhead attacks that character again." Flavor "Use the stun setting so\'s I can talk to \'em after."-Hammerhead. Two boost icons, no star. "HAMMERHEAD (4/14)", Eleonora Carlini, 89.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60090",
      type: "attachment",
      name: "Hardheaded",
      setPosition: 5,
      quantity: 1,
      traits: "Condition.",
      scheme: 1,
      boost: 1,
      boostStar: true,
      text: "Attach to Hammerhead.\nHammerhead gains stalwart.\n<b>Hero Action</b>: Spend [energy] [mental] [physical] resources → discard this card.\n<hr />\n[star] <b>Boost</b>: Give the activating enemy a tough status card.",
    }),
    reason: `${NO_REC} 60090 Hardheaded.`,
    evidence:
      'Scan 60090.jpg: ATTACHMENT, "Hardheaded", SCH +1 (no star), "CONDITION.", "Attach to Hammerhead. Hammerhead gains stalwart. Hero Action: Spend (three resource icons) resources -> discard this card." / "(star) Boost: Give the activating enemy a tough status card." Boost row: star plus one boost icon. "HAMMERHEAD (5/14)", 90, no illustrator. UNCERTAIN: the three spend icons are read as energy (lightning bolt), mental, physical (fist); the middle glyph is small and was identified by shape only.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60091",
      type: "minion",
      name: "Chameleon",
      setPosition: 6,
      quantity: 1,
      health: 5,
      scheme: 1,
      schemeStar: true,
      attack: 1,
      boost: 3,
      traits: "Criminal. Maggia.",
      unique: true,
      flavor: '"I am invisible because I am the same thing you look at every dreadful, dull day."',
      text: "[star] Chameleon gets +X SCH, where X is the highest THW value among characters in play.\n<b>When Revealed</b>: Chameleon schemes.",
    }),
    reason: `${NO_REC} 60091 Chameleon.`,
    evidence:
      'Scan 60091.jpg: MINION, "+ Chameleon", SCH 1 (star), ATK 1 (no star), hit point circle 5, "CRIMINAL. MAGGIA.", "(star) Chameleon gets +X SCH, where X is the highest THW value among characters in play. When Revealed: Chameleon schemes." Flavor "I am invisible because I am the same thing you look at every dreadful, dull day." Three boost icons, no star. "HAMMERHEAD (6/14)", 91, no illustrator.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60092",
      type: "minion",
      name: "Maggia Enforcers",
      setPosition: 7,
      quantity: 2,
      health: 3,
      schemeStar: true,
      attack: 2,
      traits: "Criminal. Maggia.",
      flavor: '"Before I ran my own gang I was a Maggia enforcer."—Hammerhead',
      text: "Guard.\n[star] Maggia Enforcers's SCH is equal to the number of [[Maggia]] enemies in play <i>(including this one)</i>.",
    }),
    reason: `${NO_REC} 60092 Maggia Enforcers (2 copies, 7/14 and 8/14).`,
    evidence:
      'Scans 60092.jpg and 60092_2.jpg (footers "HAMMERHEAD (7/14)" and "(8/14)", collector 92, identical text): MINION, "Maggia Enforcers" (no unique marker), SCH (bare star, no numeral), ATK 2 (no star), hit point circle 3, "CRIMINAL. MAGGIA.", "Guard. (star) Maggia Enforcers\'s SCH is equal to the number of MAGGIA enemies in play (including this one)." Flavor "Before I ran my own gang I was a Maggia enforcer."-Hammerhead. No boost icons printed (boost null), no illustrator. Bare-star SCH: scheme null, scheme_star true.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60093",
      type: "minion",
      name: "Maggia Underboss",
      setPosition: 9,
      quantity: 2,
      health: 4,
      scheme: 1,
      schemeStar: true,
      attack: 1,
      attackStar: true,
      boost: 1,
      traits: "Criminal. Maggia.",
      illustrator: "Facundo Moyano",
      flavor: '"Where others see weakness, I see opportunity."',
      text: "Villainous.\n[star] <b>Forced Interrupt</b>: When Maggia Underboss activates against you, if you are stunned, give it an additional boost card for this activation.",
    }),
    reason: `${NO_REC} 60093 Maggia Underboss (2 copies, 9/14 and 10/14).`,
    evidence:
      'Scans 60093.jpg and 60093_2.jpg (footers "HAMMERHEAD (9/14)" and "(10/14)", collector 93, identical text): MINION, "Maggia Underboss" (no unique marker), SCH 1 (star), ATK 1 (star), hit point circle 4, "CRIMINAL. MAGGIA.", "Villainous. (star) Forced Interrupt: When Maggia Underboss activates against you, if you are stunned, give it an additional boost card for this activation." Flavor "Where others see weakness, I see opportunity." One boost icon, no star. Facundo Moyano. The card prints bare "Villainous." with no reminder text.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60094",
      type: "side_scheme",
      name: "Consolidate Power",
      setPosition: 11,
      quantity: 1,
      baseThreat: 6,
      boost: 1,
      flavor: '"Welcome to the big time."—Hammerhead',
      text: "<b>Forced Response</b>: After a minion is defeated, give it to the villain as a facedown boost card.",
    }),
    reason: `${NO_REC} 60094 Consolidate Power.`,
    evidence:
      'Scan 60094.jpg (landscape): SIDE SCHEME, "Consolidate Power", threat 6 (no per-hero icon, no scheme icon), flavor "Welcome to the big time."-Hammerhead, "Forced Response: After a minion is defeated, give it to the villain as a facedown boost card." One boost icon, no star. "HAMMERHEAD (11/14)", 94, no illustrator.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60095",
      type: "side_scheme",
      name: "Power Struggle",
      setPosition: 12,
      quantity: 1,
      baseThreat: 5,
      amplify: 1,
      boost: 1,
      text: "<b>When Revealed</b>: Defeat the minion with the fewest remaining hit points in play. Discard cards from the encounter deck until you discard a minion. Reveal that minion.",
    }),
    reason: `${NO_REC} 60095 Power Struggle.`,
    evidence:
      'Scan 60095.jpg (landscape): SIDE SCHEME, "Power Struggle", threat 5 (no per-hero icon), one amplify icon, "When Revealed: Defeat the minion with the fewest remaining hit points in play. Discard cards from the encounter deck until you discard a minion. Reveal that minion." One boost icon, no star. "HAMMERHEAD (12/14)", 95, no illustrator.',
  },
  {
    record: rec({
      set: "hammerhead",
      code: "60096",
      type: "treachery",
      name: '"Head First!"',
      setPosition: 13,
      quantity: 2,
      boost: 2,
      flavor: '"Know how I got to the top?"—Hammerhead',
      text: "<b>When Revealed (Alter-Ego)</b>: This card gains surge.\n<b>When Revealed (Hero)</b>: Hammerhead attacks you. If you are stunned, Hammerhead gets +2 ATK for this attack and this attack gains overkill.",
    }),
    reason: `${NO_REC} 60096 "Head First!" (2 copies, 13/14 and 14/14).`,
    evidence:
      'Scans 60096.jpg and 60096_2.jpg (footers "HAMMERHEAD (13/14)" and "(14/14)", collector 96, identical text): TREACHERY, title with printed quotation marks "Head First!", no traits, "When Revealed (Alter-Ego): This card gains surge. When Revealed (Hero): Hammerhead attacks you. If you are stunned, Hammerhead gets +2 ATK for this attack and this attack gains overkill." Flavor "Know how I got to the top?"-Hammerhead. Two boost icons, no star, no illustrator.',
  },
];
