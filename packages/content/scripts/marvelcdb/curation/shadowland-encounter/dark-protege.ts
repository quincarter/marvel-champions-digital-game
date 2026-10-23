/**
 * Shadowland (MC65) Dark Protégé, the special villain encounter set (16 printed copies, collector 12A to 17A then 18 to
 * 27: six villains and ten linked cards). Transcribed from the Hall of Heroes previews; conventions in `common.ts`.
 *
 * Seen: the six two-sided villains (12 Archpriestess, 13 Daredevil, 14 Elektra, 15 Gorgon, 16 Lady Bullseye, 17 White
 * Tiger; A face stage letter "A", hit points 15 per player; B face stage letter "B", hit points 18 per player, from the
 * full-size card images) and all ten linked cards (18 Art of the Kill, 19 Krahllak's Blessing, 20 to 23 the minions,
 * 24 Rite of Offering, 25 Shadowy Plot, 26 Darkness Within, 27 Embraced by Darkness).
 *
 * Each villain is a top-level `a` record with the `b` face nested as `linked_card` (`twoSided`): unlike Fear No Evil's
 * Underling villains (one record per stage I/II/III), this pack's villain is one two-sided card whose stage is its face
 * letter.
 */
import type { AddedRecord } from "../types.ts";
import { added, DARK_PROTEGE as SET, HR, single, twoSided } from "./common.ts";

const FOOTER = "DARK PROTÉGÉ";

interface BFace {
  readonly scheme: number;
  readonly attack: number;
  readonly attackStar: boolean;
  readonly traits: string;
  readonly text: string;
  readonly illustrator: string;
}

/** A two-sided villain: the A face as first transcribed, plus the B face (hit points 18 per player, Steady. Toughness.). */
function villain(
  code: string,
  name: string,
  position: number,
  scheme: number,
  attack: number,
  attackStar: boolean,
  traits: string,
  text: string,
  flavor: string | undefined,
  illustrator: string,
  b: BFace,
) {
  return twoSided(
    SET,
    "villain",
    code,
    position,
    {
      name,
      over: {
        stage: "A",
        health: 15,
        health_per_hero: true,
        scheme,
        attack,
        attack_star: attackStar,
        traits,
        is_unique: true,
        illustrator,
        ...(flavor ? { flavor } : {}),
        text,
      },
    },
    {
      name,
      over: {
        stage: "B",
        health: 18,
        health_per_hero: true,
        scheme: b.scheme,
        attack: b.attack,
        attack_star: b.attackStar,
        traits: b.traits,
        is_unique: true,
        illustrator: b.illustrator,
        text: b.text,
      },
    },
  );
}

const ARCHPRIESTESS = villain(
  "65012",
  "Archpriestess",
  1,
  2,
  1,
  true,
  "Hand.",
  "[star] <b>Forced Response</b>: After Archpriestess attacks you, give a minion a tough status card. If no tough status card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to yourself as a facedown encounter card.",
  undefined,
  "Bruno Frenda",
  {
    scheme: 2,
    attack: 2,
    attackStar: true,
    traits: "Hand.",
    text: "Steady. Toughness.\n[star] <b>Forced Response</b>: After Archpriestess attacks you, give a minion a tough status card. If no tough status card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to yourself as a facedown encounter card.",
    illustrator: "Bruno Frenda",
  },
);
const DAREDEVIL = villain(
  "65013",
  "Daredevil",
  2,
  1,
  2,
  false,
  "Hand. Possessed.",
  "<b>Forced Response</b>: After you or an ally you control attacks Daredevil, choose: Either discard 1 random card from your hand, or Daredevil attacks you. (Limit once per round per player.)",
  '"Hell\'s Kitchen is now under the protection of the Hand!"',
  "Joey Vazquez",
  {
    scheme: 2,
    attack: 2,
    attackStar: false,
    traits: "Hand. Possessed.",
    text: "Steady. Toughness.\n<b>Forced Response</b>: After you or an ally you control attacks Daredevil, choose: Either discard 1 random card from your hand, or Daredevil attacks you. (Limit once per round per player.)",
    illustrator: "Joey Vazquez",
  },
);
const ELEKTRA = villain(
  "65014",
  "Elektra",
  3,
  1,
  2,
  true,
  "Hand. Possessed.",
  "[star] <b>Forced Interrupt</b>: When Elektra attacks you, discard the top card of your deck. If that card's printed cost is an odd number, Elektra gets +1 ATK for this attack; otherwise, this attack gains overkill and piercing.",
  '"The Hand guides me, and death follows."',
  "Joey Vazquez",
  {
    scheme: 2,
    attack: 2,
    attackStar: true,
    traits: "Hand. Possessed.",
    text: "Steady. Toughness.\n[star] <b>Forced Interrupt</b>: When Elektra attacks you, discard the top card of your deck. If that card's printed cost is an odd number, Elektra gets +1 ATK for this attack; otherwise, this attack gains overkill and piercing.",
    illustrator: "Joey Vazquez",
  },
);
const GORGON = villain(
  "65015",
  "Gorgon",
  4,
  1,
  2,
  true,
  "Hand.",
  "[star] <b>Forced Interrupt</b>: When Gorgon attacks you, choose:\n• Spend a [physical] resource.\n• Stun your identity.\n• Take 2 indirect damage.",
  '"I\'ve died and been born again. There is nothing I fear."',
  "Bruno Frenda & Sara Cuomo",
  {
    scheme: 2,
    attack: 2,
    attackStar: true,
    traits: "Hand.",
    text: "Steady. Toughness.\n[star] <b>Forced Interrupt</b>: When Gorgon attacks you, choose:\n• Spend a [physical] resource.\n• Stun your identity.\n• Take 2 indirect damage.",
    illustrator: "Bruno Frenda & Sara Cuomo",
  },
);
const LADY_BULLSEYE = villain(
  "65016",
  "Lady Bullseye",
  5,
  2,
  1,
  true,
  "Hand.",
  "[star] <b>Forced Response</b>: After Lady Bullseye attacks you, if that attack was undefended, take 1 indirect damage; otherwise, place 1 threat on the main scheme.",
  '"I plan to take my time with you."',
  "Joey Vazquez",
  {
    scheme: 2,
    attack: 2,
    attackStar: true,
    traits: "Hand.",
    text: "Steady. Toughness.\n[star] <b>Forced Response</b>: After Lady Bullseye attacks you, if that attack was undefended, take 1 indirect damage; otherwise, place 1 threat on the main scheme.",
    illustrator: "Joey Vazquez",
  },
);
const WHITE_TIGER = villain(
  "65017",
  "White Tiger",
  6,
  1,
  0,
  true,
  "Hand. Possessed.",
  "[star] <b>Forced Response</b>: After White Tiger attacks you, she attacks you again with +1 ATK. (Limit once per round per player.)",
  '"Civilization will fall into chaos and darkness, and we who walk the left-hand path will kneel before the Beast!"',
  "Bruno Frenda & Sara Cuomo",
  {
    scheme: 1,
    attack: 1,
    attackStar: true,
    traits: "Hand. Possessed.",
    text: "Steady. Toughness.\n[star] <b>Forced Response</b>: After White Tiger attacks you, she attacks you again. (Limit once per round per player.)",
    illustrator: "Bruno Frenda & Sara Cuomo",
  },
);

const ART_OF_THE_KILL = single(SET, "attachment", "65018", "Art of the Kill", 7, {
  boost: 1,
  illustrator: "Rowel Palapar",
  text: "Linked (Elektra, Lady Bullseye, or White Tiger).\nAttach to your identity.\n<b>Forced Interrupt</b>: When an enemy attacks you, it gets +1 ATK for that attack. If that attack defeats a character, place 1 threat on the main scheme.\n<b>Alter-Ego Action</b>: Spend [energy][mental][physical] resources → discard this card.",
});

const KRAHLLAKS_BLESSING = single(SET, "attachment", "65019", "Krahllak's Blessing", 8, {
  boost: 1,
  traits: "Condition. Spell.",
  text: "Linked (Archpriestess, Daredevil, or Gorgon).\nAttach to the villain.\n<b>Forced Interrupt</b>: When attached villain would take any amount of damage from a character, reduce that amount by 3. Attached villain attacks that character. Discard this card.",
});

const DARKNESS_WITHIN = single(SET, "treachery", "65026", "Darkness Within", 15, {
  boost: 1,
  boost_star: true,
  text: `Linked (Archpriestess, Gorgon, or Lady Bullseye).\n<b>When Revealed</b>: Change to hero form. The villain attacks you.${HR}[star] <b>Boost</b>: If this activation is an attack, it gains overkill.`,
});

const EMBRACED_BY_DARKNESS = single(SET, "treachery", "65027", "Embraced by Darkness", 16, {
  boost: 1,
  boost_star: true,
  illustrator: "Eduardo Mello",
  text: `Linked (Daredevil, Elektra, or White Tiger).\n<b>When Revealed</b>: The villain schemes. If 2 or less threat was placed on the main scheme this way, discard the top 3 cards of the encounter deck.${HR}[star] <b>Boost</b>: If this activation is an attack, place 2 threat on the main scheme.`,
});

const ARCHPRIESTESS_MINION = single(SET, "minion", "65020", "Archpriestess", 9, {
  traits: "Hand. Mystic.",
  is_unique: true,
  scheme: 2,
  attack: 1,
  health: 5,
  boost: 2,
  text: "Linked (Gorgon, Lady Bullseye, or White Tiger).\nVillainous.\n<b>When Revealed</b>: Each other minion engaged with you attacks you. If no attack was made this way, discard the top 3 cards of the encounter deck.",
});

const GORGON_MINION = single(SET, "minion", "65021", "Gorgon", 10, {
  traits: "Brute. Hand.",
  is_unique: true,
  scheme: 0,
  attack: 1,
  health: 5,
  boost: 2,
  text: "Linked (Daredevil, Elektra, or Lady Bullseye).\nGuard. Villainous.\n<b>Forced Response</b>: After a character attacks and damages Gorgon, stun that character.",
});

const LADY_BULLSEYE_MINION = single(SET, "minion", "65022", "Lady Bullseye", 11, {
  traits: "Hand.",
  is_unique: true,
  scheme: 1,
  attack: 1,
  attack_star: true,
  health: 5,
  boost: 2,
  text: "Linked (Archpriestess, Gorgon, or White Tiger).\nVillainous.\n[star] <b>Forced Interrupt</b>: When Lady Bullseye attacks you, this attack gains ranged and she attacks the ally with the highest printed cost you control, if able.",
});

const WHITE_TIGER_MINION = single(SET, "minion", "65023", "White Tiger", 12, {
  traits: "Hand.",
  is_unique: true,
  scheme: 1,
  attack: 2,
  health: 5,
  boost: 2,
  text: "Linked (Archpriestess, Daredevil, or Elektra).\nVillainous.\n<b>When Revealed</b>: Take 2 indirect damage.",
});

const RITE_OF_OFFERING = single(SET, "side_scheme", "65024", "Rite of Offering", 13, {
  base_threat: 1,
  base_threat_fixed: true,
  scheme_hazard: 1,
  text: "Linked (Archpriestess, Elektra, or White Tiger).\n<b>When Defeated</b>: The defeating player removes an ally they control from the game. If no ally was removed this way, that player takes 3 damage.",
});

const SHADOWY_PLOT = single(SET, "side_scheme", "65025", "Shadowy Plot", 14, {
  base_threat: 2,
  base_threat_fixed: true,
  scheme_crisis: 1,
  text: "Linked (Daredevil, Gorgon, or Lady Bullseye).\n<b>When Defeated</b>: The defeating player looks at the top 3 cards of the encounter deck, reveals 1 of them, and discards the rest.",
});

function villainEvidence(scan: string, n: number, collector: string, body: string, bBody: string): string {
  return `Scan ${scan} (footer "${FOOTER} (${n}/16) / HIT POINTS 15" with the per player icon, ${collector}). Unique star, VILLAIN, stage letter A (top right). ${body} ${bBody}`;
}

function bEvidence(code: string, n: number, collector: string, body: string): string {
  return `The B side is nested as linked_card. Image ${code}.webp: footer "${FOOTER} (${n}/16) / HIT POINTS 18" with the per player icon, ${collector}. Unique star, VILLAIN, stage letter B (top right). ${body} Second check (D3, 2026-10-22): agrees.`;
}

export const DARK_PROTEGE_RECORDS: readonly AddedRecord[] = [
  added(
    ARCHPRIESTESS,
    villainEvidence(
      "mc65_cards_archpriestess.png",
      1,
      "12A, Bruno Frenda",
      'SCH 2, ATK 1 with a star, "HAND." "(star) Forced Response: After Archpriestess attacks you, give a minion a tough status card. If no tough status card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to yourself as a facedown encounter card." No flavor.',
      bEvidence(
        "65012B",
        1,
        "12B, Bruno Frenda",
        'SCH 2, ATK 2 with a star, "HAND." "Steady. Toughness." then "(star) Forced Response: After Archpriestess attacks you, give a minion a tough status card. If no tough status card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to yourself as a facedown encounter card." (the A-side ability repeated verbatim). No flavor.',
      ),
    ),
  ),
  added(
    DAREDEVIL,
    villainEvidence(
      "mc65_cards__daredevil.png",
      2,
      "13A, Joey Vazquez",
      'SCH 1, ATK 2, "HAND. POSSESSED." "Forced Response: After you or an ally you control attacks Daredevil, choose: Either discard 1 random card from your hand, or Daredevil attacks you. (Limit once per round per player.)" (no star before Forced Response). Flavor: "Hell\'s Kitchen is now under the protection of the Hand!"',
      bEvidence(
        "65013B",
        2,
        "13B, Joey Vazquez",
        'SCH 2, ATK 2 (no star), "HAND. POSSESSED." "Steady. Toughness." then "Forced Response: After you or an ally you control attacks Daredevil, choose: Either discard 1 random card from your hand, or Daredevil attacks you. (Limit once per round per player.)" (no star before Forced Response, as the A side). No flavor.',
      ),
    ),
  ),
  added(
    ELEKTRA,
    villainEvidence(
      "mc65_cards__elektra.png",
      3,
      "14A, Joey Vazquez",
      'SCH 1, ATK 2 with a star, "HAND. POSSESSED." "(star) Forced Interrupt: When Elektra attacks you, discard the top card of your deck. If that card\'s printed cost is an odd number, Elektra gets +1 ATK for this attack; otherwise, this attack gains overkill and piercing." Flavor: "The Hand guides me, and death follows."',
      bEvidence(
        "65014B",
        3,
        "14B, Joey Vazquez",
        'SCH 2, ATK 2 with a star, "HAND. POSSESSED." "Steady. Toughness." then the A-side Forced Interrupt verbatim (odd printed cost: +1 ATK; otherwise overkill and piercing). No flavor.',
      ),
    ),
  ),
  added(
    GORGON,
    villainEvidence(
      "mc65_cards__gorgon.png",
      4,
      "15A, Bruno Frenda & Sara Cuomo",
      'SCH 1, ATK 2 with a star, "HAND." "(star) Forced Interrupt: When Gorgon attacks you, choose: * Spend a (physical) resource. * Stun your identity. * Take 2 indirect damage." Flavor: "I\'ve died and been born again. There is nothing I fear." The resource icon is the fist-like blob of Tenacity 01093, [physical].',
      bEvidence(
        "65015B",
        4,
        "15B, Bruno Frenda & Sara Cuomo",
        'SCH 2, ATK 2 with a star, "HAND." "Steady. Toughness." then the A-side Forced Interrupt with its three bullets verbatim (fist-like blob [physical]). No flavor.',
      ),
    ),
  ),
  added(
    LADY_BULLSEYE,
    villainEvidence(
      "mc65_cards_lady-bullseye.png",
      5,
      "16A, Joey Vazquez",
      'SCH 2, ATK 1 with a star, "HAND." "(star) Forced Response: After Lady Bullseye attacks you, if that attack was undefended, take 1 indirect damage; otherwise, place 1 threat on the main scheme." Flavor: "I plan to take my time with you."',
      bEvidence(
        "65016B",
        5,
        "16B, Joey Vazquez",
        'SCH 2, ATK 2 with a star, "HAND." "Steady. Toughness." then the A-side Forced Response verbatim. No flavor.',
      ),
    ),
  ),
  added(
    WHITE_TIGER,
    villainEvidence(
      "mc65_cards_white-tiger.png",
      6,
      "17A, Bruno Frenda & Sara Cuomo",
      'SCH 1, ATK 0 with a star, "HAND. POSSESSED." "(star) Forced Response: After White Tiger attacks you, she attacks you again with +1 ATK. (Limit once per round per player.)" Flavor: "Civilization will fall into chaos and darkness, and we who walk the left-hand path will kneel before the Beast!"',
      bEvidence(
        "65017B",
        6,
        "17B, Bruno Frenda & Sara Cuomo (the illustrator line is cut off at the foot of the image; credit taken from the A side)",
        'SCH 1, ATK 1 with a star, "HAND. POSSESSED." "Steady. Toughness." then "(star) Forced Response: After White Tiger attacks you, she attacks you again. (Limit once per round per player.)" (the B side has no "with +1 ATK", unlike the A side). No flavor.',
      ),
    ),
  ),
  added(
    ART_OF_THE_KILL,
    'Scan mc65_cards_art_of_the_kill.png (footer "DARK PROTÉGÉ (7/16)", 18, Rowel Palapar). ATTACHMENT (side-title layout), no traits line, no stat box, one boost icon. "Linked (Elektra, Lady Bullseye, or White Tiger). Attach to your identity. Forced Interrupt: When an enemy attacks you, it gets +1 ATK for that attack. If that attack defeats a character, place 1 threat on the main scheme. Alter-Ego Action: Spend (energy)(mental)(physical) resources -> discard this card." Resource icons in print order: lightning bolt [energy], node-and-link cluster [mental] (the glyph of the "Spend a [mental] resource" on Media Coverage 02049), fist-like blob [physical] (Tenacity 01093). Second pass (D3) corrected a first-pass [energy][physical][mental] order.',
  ),
  added(
    KRAHLLAKS_BLESSING,
    'Scan mc65_cards_krahllaks_blessing.png (footer "DARK PROTÉGÉ (8/16)", 19, no illustrator printed). ATTACHMENT, "CONDITION. SPELL.", no stat box, one boost icon. "Linked (Archpriestess, Daredevil, or Gorgon). Attach to the villain. Forced Interrupt: When attached villain would take any amount of damage from a character, reduce that amount by 3. Attached villain attacks that character. Discard this card."',
  ),
  added(
    ARCHPRIESTESS_MINION,
    `Image 65020.webp (footer "${FOOTER} (9/16)", 20, no illustrator printed). MINION, unique star, "HAND. MYSTIC.", SCH 2, ATK 1, hit points 5 (the orange circle at the foot of the art, as Fear No Evil minions), two red boost icons, no boost star. "Linked (Gorgon, Lady Bullseye, or White Tiger). Villainous. When Revealed: Each other minion engaged with you attacks you. If no attack was made this way, discard the top 3 cards of the encounter deck." Second check (D3, 2026-10-22): agrees.`,
  ),
  added(
    GORGON_MINION,
    `Image 65021.webp (footer "${FOOTER} (10/16)", 21, no illustrator printed). MINION, unique star, "BRUTE. HAND.", SCH 0, ATK 1, hit points 5 (orange circle), two red boost icons, no boost star. "Linked (Daredevil, Elektra, or Lady Bullseye). Guard. Villainous. Forced Response: After a character attacks and damages Gorgon, stun that character." Second check (D3, 2026-10-22): agrees.`,
  ),
  added(
    LADY_BULLSEYE_MINION,
    `Image 65022.webp (footer "${FOOTER} (11/16)", 22, no illustrator printed). MINION, unique star, "HAND.", SCH 1, ATK 1 with a star, hit points 5 (orange circle), two red boost icons, no boost star. "Linked (Archpriestess, Gorgon, or White Tiger). Villainous. (star) Forced Interrupt: When Lady Bullseye attacks you, this attack gains ranged and she attacks the ally with the highest printed cost you control, if able." Second check (D3, 2026-10-22): agrees.`,
  ),
  added(
    WHITE_TIGER_MINION,
    `Image 65023.webp (footer "${FOOTER} (12/16)", 23, no illustrator printed). MINION, unique star, "HAND.", SCH 1, ATK 2, hit points 5 (orange circle), two red boost icons, no boost star. "Linked (Archpriestess, Daredevil, or Elektra). Villainous. When Revealed: Take 2 indirect damage." Second check (D3, 2026-10-22): agrees.`,
  ),
  added(
    RITE_OF_OFFERING,
    `Image 65024.webp (landscape, footer "${FOOTER} (13/16)", 24, no illustrator printed). SIDE SCHEME, no traits, starting threat 1 (bare number, no per player icon, so fixed), no boost icons. One scheme icon, the card-and-plus glyph, which Strategic Positioning 65008 prints as the hazard icon, so scheme_hazard 1. "Linked (Archpriestess, Elektra, or White Tiger). When Defeated: The defeating player removes an ally they control from the game. If no ally was removed this way, that player takes 3 damage." Second check (D3, 2026-10-22): agrees.`,
  ),
  added(
    SHADOWY_PLOT,
    `Image 65025.webp (landscape, footer "${FOOTER} (14/16)", 25, no illustrator printed). SIDE SCHEME, no traits, starting threat 2 (bare number, so fixed), no boost icons. One scheme icon, the exclamation point in a burst, the glyph Hall of Punishment 65048 and Dead End 65042 print as the crisis icon, so scheme_crisis 1. "Linked (Daredevil, Gorgon, or Lady Bullseye). When Defeated: The defeating player looks at the top 3 cards of the encounter deck, reveals 1 of them, and discards the rest." Second check (D3, 2026-10-22): agrees.`,
  ),
  added(
    DARKNESS_WITHIN,
    'Scan mc65_cards_darkness_within.png (footer "DARK PROTÉGÉ (15/16)", 26, no illustrator printed). TREACHERY, no traits, boost icons star plus one. "Linked (Archpriestess, Gorgon, or Lady Bullseye). When Revealed: Change to hero form. The villain attacks you. [rule] (star) Boost: If this activation is an attack, it gains overkill."',
  ),
  added(
    EMBRACED_BY_DARKNESS,
    'Scan mc65_cards_embraced_by_darkness.png (footer "DARK PROTÉGÉ (16/16)", 27, Eduardo Mello). TREACHERY, no traits, boost icons star plus one. "Linked (Daredevil, Elektra, or White Tiger). When Revealed: The villain schemes. If 2 or less threat was placed on the main scheme this way, discard the top 3 cards of the encounter deck. [rule] (star) Boost: If this activation is an attack, place 2 threat on the main scheme."',
  ),
];
