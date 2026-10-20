/**
 * Shadowland (MC65) Dark Protégé, the special villain encounter set (16 printed copies, collector 12A to 17A then 18 to
 * 27: six villains and ten linked cards). Transcribed from the Hall of Heroes previews; conventions in `common.ts`.
 *
 * Seen: the six A-side villain faces (12A Archpriestess, 13A Daredevil, 14A Elektra, 15A Gorgon, 16A Lady Bullseye, 17A
 * White Tiger; stage letter "A", hit points 15 per player) and four linked cards (18 Art of the Kill, 19 Krahllak's
 * Blessing, 26 Darkness Within, 27 Embraced by Darkness). Not previewed, so not transcribed: the six B sides (12B to
 * 17B, assumed to be the other face of each villain card) and the six linked cards 20 to 25.
 */
import type { AddedRecord } from "../types.ts";
import { added, DARK_PROTEGE as SET, HR, single } from "./common.ts";

const FOOTER = "DARK PROTÉGÉ";

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
) {
  return single(SET, "villain", code, name, position, {
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
  });
}

const ARCHPRIESTESS = villain(
  "65012a",
  "Archpriestess",
  1,
  2,
  1,
  true,
  "Hand.",
  "[star] <b>Forced Response</b>: After Archpriestess attacks you, give a minion a tough status card. If no tough status card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to yourself as a facedown encounter card.",
  undefined,
  "Bruno Frenda",
);
const DAREDEVIL = villain(
  "65013a",
  "Daredevil",
  2,
  1,
  2,
  false,
  "Hand. Possessed.",
  "<b>Forced Response</b>: After you or an ally you control attacks Daredevil, choose: Either discard 1 random card from your hand, or Daredevil attacks you. (Limit once per round per player.)",
  '"Hell\'s Kitchen is now under the protection of the Hand!"',
  "Joey Vazquez",
);
const ELEKTRA = villain(
  "65014a",
  "Elektra",
  3,
  1,
  2,
  true,
  "Hand. Possessed.",
  "[star] <b>Forced Interrupt</b>: When Elektra attacks you, discard the top card of your deck. If that card's printed cost is an odd number, Elektra gets +1 ATK for this attack; otherwise, this attack gains overkill and piercing.",
  '"The Hand guides me, and death follows."',
  "Joey Vazquez",
);
const GORGON = villain(
  "65015a",
  "Gorgon",
  4,
  1,
  2,
  true,
  "Hand.",
  "[star] <b>Forced Interrupt</b>: When Gorgon attacks you, choose:\n• Spend a [physical] resource.\n• Stun your identity.\n• Take 2 indirect damage.",
  '"I\'ve died and been born again. There is nothing I fear."',
  "Bruno Frenda & Sara Cuomo",
);
const LADY_BULLSEYE = villain(
  "65016a",
  "Lady Bullseye",
  5,
  2,
  1,
  true,
  "Hand.",
  "[star] <b>Forced Response</b>: After Lady Bullseye attacks you, if that attack was undefended, take 1 indirect damage; otherwise, place 1 threat on the main scheme.",
  '"I plan to take my time with you."',
  "Joey Vazquez",
);
const WHITE_TIGER = villain(
  "65017a",
  "White Tiger",
  6,
  1,
  0,
  true,
  "Hand. Possessed.",
  "[star] <b>Forced Response</b>: After White Tiger attacks you, she attacks you again with +1 ATK. (Limit once per round per player.)",
  '"Civilization will fall into chaos and darkness, and we who walk the left-hand path will kneel before the Beast!"',
  "Bruno Frenda & Sara Cuomo",
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

function villainEvidence(scan: string, n: number, collector: string, body: string): string {
  return `Scan ${scan} (footer "${FOOTER} (${n}/16) / HIT POINTS 15" with the per player icon, ${collector}). Unique star, VILLAIN, stage letter A (top right). ${body} The B side is not previewed and is not transcribed.`;
}

export const DARK_PROTEGE_RECORDS: readonly AddedRecord[] = [
  added(
    ARCHPRIESTESS,
    villainEvidence(
      "mc65_cards_archpriestess.png",
      1,
      "12A, Bruno Frenda",
      'SCH 2, ATK 1 with a star, "HAND." "(star) Forced Response: After Archpriestess attacks you, give a minion a tough status card. If no tough status card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to yourself as a facedown encounter card." No flavor.',
    ),
  ),
  added(
    DAREDEVIL,
    villainEvidence(
      "mc65_cards__daredevil.png",
      2,
      "13A, Joey Vazquez",
      'SCH 1, ATK 2, "HAND. POSSESSED." "Forced Response: After you or an ally you control attacks Daredevil, choose: Either discard 1 random card from your hand, or Daredevil attacks you. (Limit once per round per player.)" (no star before Forced Response). Flavor: "Hell\'s Kitchen is now under the protection of the Hand!"',
    ),
  ),
  added(
    ELEKTRA,
    villainEvidence(
      "mc65_cards__elektra.png",
      3,
      "14A, Joey Vazquez",
      'SCH 1, ATK 2 with a star, "HAND. POSSESSED." "(star) Forced Interrupt: When Elektra attacks you, discard the top card of your deck. If that card\'s printed cost is an odd number, Elektra gets +1 ATK for this attack; otherwise, this attack gains overkill and piercing." Flavor: "The Hand guides me, and death follows."',
    ),
  ),
  added(
    GORGON,
    villainEvidence(
      "mc65_cards__gorgon.png",
      4,
      "15A, Bruno Frenda & Sara Cuomo",
      'SCH 1, ATK 2 with a star, "HAND." "(star) Forced Interrupt: When Gorgon attacks you, choose: * Spend a (physical) resource. * Stun your identity. * Take 2 indirect damage." Flavor: "I\'ve died and been born again. There is nothing I fear." The resource icon is the fist-like blob of Tenacity 01093, [physical].',
    ),
  ),
  added(
    LADY_BULLSEYE,
    villainEvidence(
      "mc65_cards_lady-bullseye.png",
      5,
      "16A, Joey Vazquez",
      'SCH 2, ATK 1 with a star, "HAND." "(star) Forced Response: After Lady Bullseye attacks you, if that attack was undefended, take 1 indirect damage; otherwise, place 1 threat on the main scheme." Flavor: "I plan to take my time with you."',
    ),
  ),
  added(
    WHITE_TIGER,
    villainEvidence(
      "mc65_cards_white-tiger.png",
      6,
      "17A, Bruno Frenda & Sara Cuomo",
      'SCH 1, ATK 0 with a star, "HAND. POSSESSED." "(star) Forced Response: After White Tiger attacks you, she attacks you again with +1 ATK. (Limit once per round per player.)" Flavor: "Civilization will fall into chaos and darkness, and we who walk the left-hand path will kneel before the Beast!"',
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
    DARKNESS_WITHIN,
    'Scan mc65_cards_darkness_within.png (footer "DARK PROTÉGÉ (15/16)", 26, no illustrator printed). TREACHERY, no traits, boost icons star plus one. "Linked (Archpriestess, Gorgon, or Lady Bullseye). When Revealed: Change to hero form. The villain attacks you. [rule] (star) Boost: If this activation is an attack, it gains overkill."',
  ),
  added(
    EMBRACED_BY_DARKNESS,
    'Scan mc65_cards_embraced_by_darkness.png (footer "DARK PROTÉGÉ (16/16)", 27, Eduardo Mello). TREACHERY, no traits, boost icons star plus one. "Linked (Daredevil, Elektra, or White Tiger). When Revealed: The villain schemes. If 2 or less threat was placed on the main scheme this way, discard the top 3 cards of the encounter deck. [rule] (star) Boost: If this activation is an attack, place 2 threat on the main scheme."',
  ),
];
