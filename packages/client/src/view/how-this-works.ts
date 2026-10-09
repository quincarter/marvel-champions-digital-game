/**
 * "How this works": the one-line note Inspect's RULES & STATE panel shows for a card whose wording is easy to misread
 * (guided mode section 3.14, `docs/guided-mode.md`). Each note is a paraphrase of the card's own text and the RRG entry
 * behind it (the glossary entry carries the cite), never a transcription, and reads no hidden information, so it is
 * safe to show for any card a player can see.
 *
 * Keyed by the printed id without its face letter ("34002" covers both Phoenix Force sides). Wave 6 (Mutant Genesis and
 * MojoMania) is the first wave to fill it; wave 7 (NeXt Evolution) and wave 8 (Age of Apocalypse) add their own rows after them.
 */
import type { AnyCard } from "@mc/content";

const NOTES = new Map<string, string>();

function note(ids: readonly string[], text: string): void {
  for (const id of ids) NOTES.set(id, text);
}

const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, index) => String(from + index));

// Colossus.
note(["32001"], "Colossus can hold two tough status cards. Each hit discards only one of them.");
note(
  ["32005"],
  "Generates one physical resource for each tough status card on Colossus, so spend it while they are stacked.",
);
note(
  ["32006"],
  "Whenever Colossus loses a tough card, this can spend a steel counter and exhaust to give him a new one.",
);

// Shadowcat.
note(
  ["32030", "32031"],
  "Solid and Phased are her mass form, a form of its own. The card flips after she attacks or defends, and Phase Control flips it once a round, with no hero flip involved.",
);

// Cyclops.
note(["33001"], "Optic Blast costs one resource of any type and can only hit an enemy that has an upgrade attached.");
note(
  ["33004"],
  "You take the first turn of the player phase. Your Temporary upgrades on minions stay in play past the end of the round.",
);
note(
  ["33005", "33006", "33007"],
  "Temporary: discarded at the end of the round unless Field Commander is keeping it on a minion.",
);

// Phoenix.
note(
  ["34002"],
  "Removing the last power counter flips it to UNLEASHED (+2 ATK, -2 THW). Counters bring it back at 4 or more.",
);

// Wolverine.
note(
  ["35002"],
  "The damage is a cost: if a tough card or anything else prevents some of it, you haven't paid and nothing is played.",
);

// Storm.
note(
  ["36001"],
  "Weather Control swaps your Weather in play with one you choose from the facedown Weather deck, then resolves the new Weather's Special.",
);
note(
  ["36002", "36003", "36004", "36005"],
  "Permanent. Its Special only resolves when another ability, like Weather Control, tells you to.",
);

// Gambit.
note(
  ["37001"],
  "Throw de Card removes up to 3 counters but needs at least 1. Thief Extraordinaire's look at the encounter deck is private to you.",
);
note(
  ["37006"],
  "What it gains depends on how many counters Throw de Card removed for this attack, and it still needs that interrupt.",
);

// Rogue.
note(
  ["38001", "38002"],
  "Touched waits off to the side until Skin Contact or Energy Transfer attaches it to another character. Rogue has that character's traits only while it stays there.",
);

// Labeled abilities: a real thwart or defense by your identity.
note(
  ["32188", "32194", "34017"],
  "Labeled (thwart): it counts as a real thwart by you, so patrol or crisis on the main scheme can stop it.",
);
note(
  ["32189"],
  "Counts as a defense and a thwart, so it can't be used while patrol or crisis stops you thwarting the main scheme.",
);

// Mutant Genesis scenarios.
note(
  ["32066"],
  "The first player controls Robert Kelly. He takes the damage of undefended enemy attacks against that player, and you lose if he leaves play.",
);
note(
  ["32141"],
  "Magnet counters collect on the main scheme. At 3, it removes 3 and reveals the next Magnetic card from the encounter deck. They return to the pool when the scheme advances.",
);
note(
  ["32087"],
  "Each time threat here reaches 5 per hero, the first player tucks a deck card under Operation Zero Tolerance and the threat drops by that much.",
);
note(["32100"], "Defeating this gives you a random set-aside Captive ally, put into play under your control.");
note(
  ["32104"],
  "Allies that enemy attacks defeat go facedown under it. At 3 more cards than players, the players lose.",
);
note(
  [...range(32159, 32163), ...range(38029, 38033)],
  "Teamwork: when it engages you and another minion with its trait is in play, it activates against you right away, before its When Revealed.",
);
note(["32164"], "Only the When Defeated abilities resolve. The Acolyte minions stay in play.");
note(range(32176, 32195), "One use: it leaves the game and the campaign pool for good once its effect resolves.");

// MojoMania.
note(
  ["39003", "39004"],
  "Each crowd flips at 5 ratings counters per hero and keeps them. At 10 per hero it ends the game.",
);
note(
  ["39015"],
  "SHOW environments that would be discarded go to the bottom of the show deck, which player cards can't touch.",
);
note(
  ["39016"],
  "The only way to reach the show deck: removing the last threat here reveals its top card and puts 3 threat per hero back.",
);
note(["39025"], "Threat on a character moves here when that character flips or leaves play.");
note(
  ["39026"],
  "SPINNING waits for an encounter deck reset. STOPPED acts at the start of villain phase step 3, then flips back.",
);
note(
  ["39030"],
  "Hinder 10 puts the threat on this card, not a scheme. Remove it or it moves to the main scheme when your turn ends.",
);
note(
  ["39035", "39041", "39047", "39053", "39060", "39066"],
  "Revealing a SHOW discards the other SETTING environments. It surges only if it came from the encounter deck.",
);
note(
  ["39065"],
  "Incite 3 puts 3 threat on the main scheme when it is revealed. Peril locks out other players' help while you resolve it.",
);
note(["34031"], "Peril: while you resolve it, other players can't help you or play cards.");
note(
  ["39071"],
  "An ally with an encounter back. Revealed, he joins the player who revealed him, and the card gains surge.",
);

// NeXt Evolution.
note(
  ["40130"],
  "The first player controls her, and her THW and ATK copy that player's hero. In alter-ego form they are 0. If she leaves play, you lose.",
);
note(["40006"], "Only Cable removes threat from it. His allies and other heroes can't.");
note(
  ["40013"],
  "The side scheme returns with its starting threat and hinder, not revealed, then 4 threat moves onto it from the main scheme.",
);
note(["40040"], "One attack of 4 damage plus 1 per resource icon on the discarded card. Domino's wild counts twice.");
note(
  ["40043"],
  "Shuffle it back and it counts no icons for the card that discarded it. Leave it in the discard pile and it counts 3.",
);
note(
  ["40081"],
  "Cards under it are not in play. Each defeated villain goes under it, and with 3 villains under it the players win.",
);
note(["40132"], "He takes no damage while any Creeping Willow is in play, whoever it is engaged with.");
note(
  ["41002"],
  "The Katana side is restricted. Past two restricted cards you discard another one, never a Psi blade, which is permanent.",
);
note(
  ["43006"],
  "A plain Action, so it works in alter-ego or hero form. Divide 4 healing between your identity and Honey Badger.",
);
note(
  ["43021"],
  "The four Specialists are set aside, not in any deck. Each player without a Specialization upgrade picks one.",
);
note(
  ["44032"],
  "While it is in play your allies are exhausted and can't ready. On your turn other players can't resolve player card abilities.",
);
note(
  ["44046"],
  "Alter-ego only. Costs 3 per player. A timer counts your break; End break heals every identity 1 per whole minute.",
);

// Age of Apocalypse (wave 8). Notes on a reading the owner has not confirmed describe what the game does today.
note(
  ["45001"],
  "Damage from an attack discards that many cards from your deck. Resource cards among them go to your hand; the rest stay in the discard pile.",
);
note(
  ["45007"],
  "Bishop readies only if a resource card paid for it. Extra resources beyond the cost did not pay, and a cost of 0 never counts.",
);
note(
  ["45008"],
  "You draw only if a resource card paid for it. Extra resources beyond the cost did not pay, and a cost of 0 never counts.",
);
note(
  ["45030"],
  "In hero form your top card is faceup, and once per phase you may play it for 1 less. Her upgrades read its resource icon, and a wild icon counts as every type.",
);
note(
  ["45032"],
  "Swap a card in your hand with the top card of your deck, as an action or when the villain phase begins.",
);
note(
  ["45038", "45039", "45040"],
  "Reads the top card of your deck when it resolves, so it can change what the card does. A wild icon counts as every type.",
);
note(
  ["46001"],
  '"Freeze!" attaches a set-aside Frostbite when you make a basic attack or defense against an enemy. Frostbite returns when its host activates or leaves play.',
);
note(["46015", "46016"], "Needs an enemy with any upgrade attached. A Frostbite counts.");
note(["46009"], "Choose one: 4 damage and a Frostbite, or 6 damage to an enemy that already has a Frostbite attached.");
note(
  ["47004", "47005", "47006", "47007", "47008", "47009", "47015"],
  "Counts the different resource types that paid, not the cards. Extra resources beyond the cost did not pay. A wild counts as the type you declare.",
);
note(
  ["47023"],
  "Changing to hero form on your turn costs 2 resources of the same type. Playing any Jubilee event removes this card from the game.",
);
note(
  ["47019"],
  "The chosen player makes a basic attack or thwart with a character they control, at +1 THW and +1 ATK. It costs one charge counter.",
);
note(
  ["48006"],
  "When the attached enemy attacks, discard it to make Nightcrawler the defender without exhausting him. That is a basic defense.",
);
note(
  ["48007"],
  "One attack made of two parts: 3 damage to an enemy, then 3 to each enemy with Bamf! attached. Guard is checked for each enemy.",
);
note(
  ["48033"],
  "A minion that schemes is dealt to that player as a facedown encounter card, then passed to the next player if there is one.",
);
note(
  ["49001"],
  "Magnetic Pull discards until a MAGNETIC card, once per round, and adds it to your hand. Armor reads the icons discarded, and Old Grievances counts the cards.",
);
note(
  ["49004"],
  "Reads the icons of the cards Magnetic Pull discarded, the MAGNETIC one too: mental +1 THW, physical +1 ATK, energy +1 DEF, each until the end of the round.",
);
note(["49006"], "Damage you would take goes onto this card instead of you. At 6 or more it is discarded.");
note(
  ["49007"],
  "Hero form only, and not for ELITE minions. The attached minion cannot activate and its text box is blank.",
);
note(
  ["49015"],
  "Every instance of attack damage to the chosen enemy this phase gets +1, so a multi-hit attack adds it each time.",
);
note(
  ["49019"],
  "Adds the ally's matching power: the stat that actually powered your attack or thwart, not the other one.",
);
note(["45059"], "Threat on Gene Pool sets what he has: 3 retaliate 1, 6 also stalwart, 9 also an amplify icon.");
note(
  ["45081", "45082", "45083", "45084"],
  "Cannot be defeated while another villain has at least 1 hit point. The active counter moves right after a villain activates.",
);
note(
  ["45090", "45091"],
  "Counts the villain as having at least 1 hit point. After you attack it, you resolve its Forced Response as if it just attacked you, then this is discarded.",
);
note(
  ["45103"],
  "When Apocalypse would be defeated, he heals instead and this scheme loses threat equal to the numeral in his printed hit points.",
);
note(["45104"], "Threat cannot be removed from this scheme while a Prelate minion is in play.");
note(
  ["45105"],
  "The Tyrant's Throne: threat cannot be removed while a Prelate is in play. Its other side, No Longer Worthy: Apocalypse takes no damage while a Prelate is in play, and defeating him wins.",
);
note(
  ["45118"],
  "His attack resolves the Special on a Setting environment in play. With several in play, the resolving player chooses one.",
);
note(
  ["45127", "45133", "45139"],
  "Several Settings can be in play at once. A Special resolves when Dark Beast attacks you or a card asks for it.",
);
note(
  ["45075"],
  "Permanent. At 3 more counters than players they clear: your nemesis minion activates, or the nemesis set comes in.",
);
note(["45147"], "Adds a power counter each villain phase. At 4, remove them and reveal the next Superpower card.");
note(
  ["45171"],
  "Cannot be discarded. Exhaust it to make a mission attempt, or to reduce the next ally played to the mission by 2.",
);
note(
  ["45176"],
  "A campaign reward. The attached ally gets +1 THW, +1 ATK and +1 hit point, and counts as having a wild resource icon too.",
);
note(
  ["45166", "45167", "45168", "45169", "45170"],
  "A mission: players cannot thwart it. Allies at the mission make attempts, and it cannot be defeated while any minion is there.",
);

/** The printed id without its face letter: "34002a" and "34002b" are one card. */
export const baseCardId = (id: string): string => id.replace(/[ab]$/, "");

/** The one-line "How this works" note for `card`, or null for the great majority of cards that need none. */
export function howThisWorksFor(card: AnyCard | undefined): string | null {
  return card ? (NOTES.get(baseCardId(card.id as string)) ?? null) : null;
}

/** Every printed id (face letter stripped) that carries a note, for the coverage test. */
export const HOW_THIS_WORKS_IDS: readonly string[] = [...NOTES.keys()];
