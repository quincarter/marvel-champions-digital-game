/**
 * Take your seats groups its roster by hero (GitHub #219, "Decks in sub menu under each hero"): one shelf tile per
 * hero identity, however many decks that hero has (the Leadership and Aggression precons, the player's saved decks,
 * tested community decks). A hero with one matching deck seats it at a tap, as before; a hero with several opens a
 * submenu listing them (`scenes/hero-decks-sheet.ts`).
 *
 * Pure and generic over the item type, like `view/roster-shelves.ts` it builds on: the scene decides which decks pass
 * the search and chips and which shelf each lands on, and this module only collapses the finished shelves to one tile
 * per hero and words each deck's row in the submenu.
 */
import type { Shelf } from "./roster-shelves.js";

/** One hero's matching decks, in the order they were found, and the one whose picture and state stand for the tile. */
export interface HeroDeckGroup<T> {
  readonly heroKey: string;
  readonly decks: readonly T[];
  readonly rep: T;
}

export interface HeroGroupedShelves<T> {
  /** The same shelves with each hero once, as its representative deck; a shelf left with no tile is dropped. */
  readonly shelves: readonly Shelf<T>[];
  /** Every hero shown, by `heroKey`. */
  readonly groups: ReadonlyMap<string, HeroDeckGroup<T>>;
}

/**
 * Collapses `shelves` (one item per deck) to one tile per hero. A hero's tile sits where its first deck sat; later
 * decks of the same hero on other shelves fold into it. The representative is the highest `rank` (the deck at the
 * active seat, then one that can be seated, then the first found) so the tile never says "locked" or "at the table"
 * while another of its decks is free to take.
 */
export function groupShelvesByHero<T>(
  shelves: readonly Shelf<T>[],
  heroKeyOf: (item: T) => string,
  rank: (item: T) => number = () => 0,
): HeroGroupedShelves<T> {
  const decksByHero = new Map<string, T[]>();
  for (const shelf of shelves) {
    for (const item of shelf.items) {
      const key = heroKeyOf(item);
      const decks = decksByHero.get(key);
      if (decks) decks.push(item);
      else decksByHero.set(key, [item]);
    }
  }

  const groups = new Map<string, HeroDeckGroup<T>>();
  for (const [heroKey, decks] of decksByHero) {
    let rep: T = decks[0] as T;
    let best = rank(rep);
    for (const deck of decks.slice(1)) {
      const score = rank(deck);
      if (score > best) {
        rep = deck;
        best = score;
      }
    }
    groups.set(heroKey, { heroKey, decks, rep });
  }

  const placed = new Set<string>();
  const out: Shelf<T>[] = [];
  for (const shelf of shelves) {
    const items: T[] = [];
    for (const item of shelf.items) {
      const key = heroKeyOf(item);
      if (placed.has(key)) continue;
      placed.add(key);
      items.push(groups.get(key)!.rep);
    }
    if (items.length > 0) out.push({ ...shelf, items });
  }
  return { shelves: out, groups };
}

/**
 * The pack each hero's tile belongs on: the pack of the hero's own precon, so a saved or community deck for Captain
 * Marvel lands beside her precons rather than on a shelf of its own. A hero with no precon in the pool has no pack.
 * `preconPackOf` returns a precon's pack code, or null for a deck that is not a precon.
 */
export function heroPacksOf<T>(
  items: readonly T[],
  heroKeyOf: (item: T) => string,
  preconPackOf: (item: T) => string | null,
): ReadonlyMap<string, string> {
  const packs = new Map<string, string>();
  for (const item of items) {
    const pack = preconPackOf(item);
    const key = heroKeyOf(item);
    if (pack !== null && !packs.has(key)) packs.set(key, pack);
  }
  return packs;
}

/**
 * What a deck's tile groups under. With no search text it is the hero, so each hero is one tile with a submenu. While
 * the player is searching it is the deck itself, so every deck the search found gets its own card and none is hidden
 * behind a submenu (the search already matches a deck's own name, saved or community).
 */
export function heroGroupKeyOf(searching: boolean, heroKey: string, deckId: string): string {
  return searching ? deckId : heroKey;
}

/**
 * The tag a hero tile with several decks carries. Decks beyond the precons are counted on their own so the player sees
 * at a glance that they have more than the box: "+2 DECKS" (saved, imported or community), else "2 DECKS" (all precons).
 */
export function deckCountTagOf(count: number, nonPreconCount = 0): string | null {
  if (count <= 1) return null;
  if (nonPreconCount > 0) return `+${nonPreconCount} ${nonPreconCount === 1 ? "DECK" : "DECKS"}`;
  return `${count} DECKS`;
}

/** The facts about one deck that its submenu row words; the scene gathers them from the same sources the shelf tile used. */
export interface HeroDeckRowFacts {
  readonly deckId: string;
  readonly name: string;
  readonly sourceKind: "precon" | "imported" | "userBuilt";
  /** "by andyr · MarvelCDB" for a tested community deck, else null. */
  readonly testedCredit: string | null;
  readonly cardCount: number;
  /** Why this deck cannot be seated (at the table, illegal, over the seat limit), in the player's words. */
  readonly blockedBy: string | null;
  /** What shuts the deck to this player (a locked hero or card wave), or null. */
  readonly lock: string | null;
  /** The "legal but not fully playable" note, or null. */
  readonly warning: string | null;
  /** This deck is the one in the active seat. */
  readonly activeSeat: boolean;
  /** The 1-based seat another seat holds this deck in, or null. */
  readonly otherSeat: number | null;
}

export interface HeroDeckRow {
  readonly deckId: string;
  readonly title: string;
  /** "Precon", "Imported", "Built" or "Tested · by andyr · MarvelCDB". */
  readonly source: string;
  /** "40 cards". */
  readonly cards: string;
  /** Legality in words, never by color alone: "Legal", the warning, or the reason it is shut. */
  readonly status: string;
  readonly statusKind: "ok" | "warning" | "blocked" | "locked";
  /** The Seat button's label: "Seat", "Unlock", or "Seated" for the active seat's own deck. */
  readonly action: string;
  /** False when the button should not seat (the deck is blocked); a locked deck stays pressable, it opens the unlock flow. */
  readonly enabled: boolean;
}

const SOURCE_WORDS = { precon: "Precon", imported: "Imported", userBuilt: "Built" } as const;

/** One submenu row. The decision to seat stays with the scene's own pick code; this only words what the player sees. */
export function heroDeckRowOf(facts: HeroDeckRowFacts): HeroDeckRow {
  const seatedElsewhere = facts.otherSeat !== null && !facts.activeSeat;
  const lock = seatedElsewhere ? null : facts.lock;
  const blocked = seatedElsewhere ? null : facts.blockedBy;
  const base = {
    deckId: facts.deckId,
    title: facts.name,
    source: facts.testedCredit ? `Tested · ${facts.testedCredit}` : SOURCE_WORDS[facts.sourceKind],
    cards: `${facts.cardCount} ${facts.cardCount === 1 ? "card" : "cards"}`,
  };
  if (facts.activeSeat) {
    return { ...base, status: "In this seat", statusKind: "ok", action: "Seated", enabled: false };
  }
  if (seatedElsewhere) {
    return { ...base, status: `In seat ${facts.otherSeat}`, statusKind: "blocked", action: "Seat", enabled: false };
  }
  if (lock) return { ...base, status: lock, statusKind: "locked", action: "Unlock", enabled: true };
  if (blocked) return { ...base, status: blocked, statusKind: "blocked", action: "Seat", enabled: false };
  if (facts.warning) return { ...base, status: facts.warning, statusKind: "warning", action: "Seat", enabled: true };
  return { ...base, status: "Legal", statusKind: "ok", action: "Seat", enabled: true };
}
