/**
 * The official promo cards: alternate printings a player earns by playing and can then use in place of a card's normal
 * scan (issue #192). A promo only changes a picture; the engine never sees it, and the card keeps its own rules text
 * wherever the game prints it.
 *
 * Each set names the normal scans it stands in for, by file name. `artFor` swaps the picture at that level, so a set
 * covers every face and stage it was printed for, and a reprint that shares the scan (Tackle in Civil War) comes along.
 * A hero with two promo printings has two sets over the same scans, and a card shows one at a time (`withPromoToggled`).
 *
 * **Earned how (a project decision, the issue asks for "winning X times with the same character"):** a hero's first set
 * takes 3 wins as that hero and a second takes 10; a villain's takes 3 wins against its scenario; an event's takes 3 wins
 * with it in a deck. Read from the save history like every other extra (`progression/extras.ts`).
 *
 * The scans are in `assets/card-art/promos/` (`promo-scans.tsv` says which file is which). Pure data; nothing here is
 * stored.
 */
import { promoArtOf, type ArtSource } from "./art-source.js";

export type PromoEarn =
  | { readonly kind: "heroWins"; readonly identityCardId: string; readonly wins: number }
  | { readonly kind: "scenarioWins"; readonly scenarioIds: readonly string[]; readonly wins: number }
  | { readonly kind: "cardWins"; readonly cardIds: readonly string[]; readonly wins: number };

export interface PromoFace {
  /** The normal scan this picture stands in for, by file name. */
  readonly scan: string;
  /** A reprint's scan it stands in for too, when the reprint has different art of its own. */
  readonly alsoScans?: readonly string[];
  readonly caption: string;
}

export interface PromoSet {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** Which of a card's promo printings this is: the number in the scan's file name. */
  readonly printing: number;
  readonly faces: readonly PromoFace[];
  /** The card a hover over this set's tile names. */
  readonly cardId: string;
  readonly earn: PromoEarn;
}

const HERO_WINS = [3, 10] as const;
const VILLAIN_WINS = 3;
const CARD_WINS = 3;

const hero = (slug: string, title: string, code: string, printings: 1 | 2 = 1, alsoForm?: string): PromoSet[] =>
  HERO_WINS.slice(0, printings).map((wins, index) => ({
    id: index === 0 ? slug : `${slug}-${index + 1}`,
    title,
    subtitle: index === 0 ? "Promo hero" : "Second promo hero",
    printing: index + 1,
    cardId: `${code}a`,
    faces: [
      { scan: `${code}a`, caption: "Hero" },
      { scan: `${code}b`, caption: "Alter ego" },
      ...(alsoForm ? [{ scan: `${code}c`, caption: alsoForm }] : []),
    ],
    earn: { kind: "heroWins", identityCardId: `${code}a`, wins },
  }));

const STAGES = ["Stage I", "Stage II", "Stage III"];

/** A villain's promo: its first `scans.length` stages, in stage order. */
const villain = (slug: string, title: string, scans: readonly string[], ...scenarioIds: string[]): PromoSet => ({
  id: slug,
  title,
  subtitle: "Promo villain",
  printing: 1,
  cardId: scans[0]!,
  faces: scans.map((scan, index) => ({ scan, caption: STAGES[index]! })),
  earn: { kind: "scenarioWins", scenarioIds, wins: VILLAIN_WINS },
});

/** A team's promo: each member's A and B cards. */
const team = (
  slug: string,
  title: string,
  members: readonly (readonly [name: string, code: string])[],
  ...scenarioIds: string[]
): PromoSet => ({
  id: slug,
  title,
  subtitle: "Promo villains",
  printing: 1,
  cardId: `${members[0]![1]}a`,
  faces: members.flatMap(([name, code]) => [
    { scan: `${code}a`, caption: `${name} A` },
    { scan: `${code}b`, caption: `${name} B` },
  ]),
  earn: { kind: "scenarioWins", scenarioIds, wins: VILLAIN_WINS },
});

/** An event's promo. `cardIds` are the printings that count toward it; a reprint on the same scan is one of them. */
const event = (slug: string, title: string, ...cardIds: string[]): PromoSet => ({
  id: slug,
  title,
  subtitle: "Promo event",
  printing: 1,
  cardId: cardIds[0]!,
  faces: [{ scan: cardIds[0]!, caption: title }],
  earn: { kind: "cardWins", cardIds, wins: CARD_WINS },
});

export const PROMO_SETS: readonly PromoSet[] = [
  ...hero("spider-man", "Spider-Man", "01001"),
  ...hero("captain-marvel", "Captain Marvel", "01010"),
  ...hero("she-hulk", "She-Hulk", "01019"),
  ...hero("iron-man", "Iron Man", "01029"),
  ...hero("black-panther", "Black Panther", "01040"),
  ...hero("captain-america", "Captain America", "03001"),
  ...hero("ms-marvel", "Ms. Marvel", "05001"),
  ...hero("thor", "Thor", "06001"),
  ...hero("black-widow", "Black Widow", "08001"),
  ...hero("doctor-strange", "Doctor Strange", "09001"),
  ...hero("hulk", "Hulk", "10001"),
  ...hero("colossus", "Colossus", "32001", 2),
  ...hero("shadowcat", "Shadowcat", "32030", 2),
  ...hero("cyclops", "Cyclops", "33001", 2),
  ...hero("phoenix", "Phoenix", "34001", 2),
  ...hero("wolverine", "Wolverine", "35001", 2),
  ...hero("storm", "Storm", "36001", 2),
  ...hero("gambit", "Gambit", "37001", 2),
  ...hero("rogue", "Rogue", "38001", 2),
  ...hero("cable", "Cable", "40001", 2),
  ...hero("domino", "Domino", "40037", 2),
  ...hero("psylocke", "Psylocke", "41001", 2),
  ...hero("angel", "Angel", "42001", 2, "Archangel"),
  ...hero("x-23", "X-23", "43001", 2),
  ...hero("deadpool", "Deadpool", "44001", 2),
  villain("norman-osborn", "Norman Osborn", ["02001a", "02002a", "02003a"], "risky-business"),
  villain("green-goblin", "Green Goblin", ["02014", "02015", "02016"], "mutagen-formula"),
  {
    ...villain("bulldozer", "Bulldozer", ["07047"], "breakout"),
    cardId: "07046",
    faces: [{ scan: "07047", caption: "Bulldozer B" }],
  },
  villain("sabretooth", "Sabretooth", ["32060", "32061"], "sabretooth"),
  villain("sentinel", "Sentinel", ["32084", "32085"], "project-wideawake"),
  villain("master-mold", "Master Mold", ["32109", "32110"], "master-mold"),
  team(
    "brotherhood",
    "Brotherhood of Mutants",
    [
      ["Avalanche", "32121"],
      ["Blob", "32122"],
      ["Pyro", "32123"],
      ["Toad", "32124"],
    ],
    "mansion-attack",
  ),
  villain("magneto", "Magneto", ["32138", "32139"], "magneto"),
  team(
    "marauders",
    "The Marauders",
    [
      ["Arclight", "40070"],
      ["Blockbuster", "40071"],
      ["Chimera", "40072"],
      ["Greycrow", "40073"],
      ["Harpoon", "40074"],
      ["Riptide", "40075"],
      ["Vertigo", "40076"],
    ],
    "morlock-siege",
    "on-the-run",
  ),
  villain("juggernaut", "Juggernaut", ["40118", "40119"], "juggernaut"),
  villain("mister-sinister", "Mister Sinister", ["40136", "40137"], "mister-sinister"),
  villain("stryfe", "Stryfe", ["40163", "40164"], "stryfe"),
  event("avengers-assemble", "Avengers Assemble!", "03015"),
  event("tackle", "Tackle", "05015", "56049"),
  {
    ...event("stealth-strike", "Stealth Strike", "08013", "37014"),
    faces: [{ scan: "08013", alsoScans: ["37014"], caption: "Stealth Strike" }],
  },
  event("desperate-defense", "Desperate Defense", "09015", "16013"),
  event("drop-kick", "Drop Kick", "10014"),
];

/** A face's promo picture. */
export const promoFaceArt = (set: PromoSet, face: PromoFace): ArtSource => promoArtOf(face.scan, set.printing);

/** Every promo picture, for the build to carry alongside the card backs. */
export const PROMO_ART: readonly ArtSource[] = PROMO_SETS.flatMap((set) =>
  set.faces.map((face) => promoFaceArt(set, face)),
);

/** What `artFor` draws for these sets: each normal scan they cover, to its promo picture. */
export function promoArtByScan(sets: readonly PromoSet[]): ReadonlyMap<string, ArtSource> {
  return new Map(
    sets.flatMap((set) =>
      set.faces.flatMap((face) =>
        [face.scan, ...(face.alsoScans ?? [])].map((scan) => [scan, promoFaceArt(set, face)] as const),
      ),
    ),
  );
}

/** Each printing of an event with a promo, to the first: a game with any of them is one win toward it. */
const FIRST_PRINTING: ReadonlyMap<string, string> = new Map(
  PROMO_SETS.flatMap(({ earn }) =>
    earn.kind === "cardWins" ? earn.cardIds.map((id) => [id, earn.cardIds[0]!] as const) : [],
  ),
);

/** The id a deck card's wins are counted under: its first printing, for an event with a promo. */
export const winCardOf = (cardId: string): string => FIRST_PRINTING.get(cardId) ?? cardId;

/**
 * The sets in use after the player turns `id` on or off. A card shows one printing, so turning a set on turns off any
 * set over the same scans.
 */
export function withPromoToggled(inUse: readonly string[], id: string): readonly string[] {
  if (inUse.includes(id)) return inUse.filter((other) => other !== id);
  const scans = new Set(PROMO_SETS.find((set) => set.id === id)?.faces.map((face) => face.scan));
  const clashes = (other: string): boolean =>
    PROMO_SETS.find((set) => set.id === other)?.faces.some((face) => scans.has(face.scan)) ?? false;
  return [...inUse.filter((other) => !clashes(other)), id];
}
