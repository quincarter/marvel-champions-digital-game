/**
 * "How this works": the one-line note Inspect's RULES & STATE panel shows for a card whose wording is easy to misread
 * (guided mode section 3.14, `docs/guided-mode.md`). Each note is a paraphrase of the card's own text and the RRG entry
 * behind it (the glossary entry carries the cite), never a transcription, and reads no hidden information, so it is
 * safe to show for any card a player can see.
 *
 * Keyed by the printed id without its face letter ("34002" covers both Phoenix Force sides). Wave 6 (Mutant Genesis and
 * MojoMania) is the first wave to fill it; later waves add their own rows next to these.
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
  "Magnet counters collect on the main scheme. At 3, it removes 3 and reveals the next Magnetic card from the encounter deck.",
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

/** The printed id without its face letter: "34002a" and "34002b" are one card. */
export const baseCardId = (id: string): string => id.replace(/[ab]$/, "");

/** The one-line "How this works" note for `card`, or null for the great majority of cards that need none. */
export function howThisWorksFor(card: AnyCard | undefined): string | null {
  return card ? (NOTES.get(baseCardId(card.id as string)) ?? null) : null;
}

/** Every printed id (face letter stripped) that carries a note, for the coverage test. */
export const HOW_THIS_WORKS_IDS: readonly string[] = [...NOTES.keys()];
