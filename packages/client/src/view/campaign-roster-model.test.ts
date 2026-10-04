import { describe, expect, test } from "vitest";
import type { CardId, Deck } from "@mc/content";
import { TRORS_STORY } from "../campaign/stories/trors.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import { aspectStampOf } from "./aspect-stamp.js";
import { preconDecks } from "./deck-list-model.js";
import { pickerEntriesOf, preconRosterOf, rosterDeckOptions, rosterModelOf } from "./campaign-roster-model.js";
import { pairCatalogOf } from "./seat-recommendations.js";
import { DEFAULT_UNLOCK_PREFS, NO_PROGRESS, Unlocks } from "../progression/unlocks.js";

const precons = preconDecks(POOL_VERSION);
const hawkeye = precons.find((d) => d.identityCardId === "04001a")!;
const spiderWoman = precons.find((d) => d.identityCardId === "04031a")!;

describe("preconRosterOf", () => {
  test("MC10's cast pre-fills seats 1 and 2, leaving 3 and 4 empty", () => {
    const seats = preconRosterOf(TRORS_STORY.castIdentityIds as readonly CardId[], POOL_VERSION);
    expect(seats).toHaveLength(4);
    expect(seats[0]?.identityCardId).toBe("04001a");
    expect(seats[1]?.identityCardId).toBe("04031a");
    expect(seats[2]).toBeNull();
    expect(seats[3]).toBeNull();
  });
});

describe("rosterModelOf", () => {
  test("the box's precon roster signs, with the labels the design prints", () => {
    const seats: (Deck | null)[] = [hawkeye, spiderWoman, null, null];
    const model = rosterModelOf(seats, POOL_CARDS);
    expect(model.canSign).toBe(true);
    expect(model.blockedReason).toBeNull();
    expect(model.seats[0]).toMatchObject({ identityName: "Hawkeye", aspectsLabel: "Leadership · starter deck" });
    expect(model.seats[1]?.identityName).toBe("Spider-Woman");
  });

  test("no seats signed cannot be signed", () => {
    const model = rosterModelOf([null, null, null, null], POOL_CARDS);
    expect(model.canSign).toBe(false);
    expect(model.blockedReason).toMatch(/seat/i);
  });

  test("two seats with the same identity cannot be signed (MC10 p. 3)", () => {
    const model = rosterModelOf([hawkeye, hawkeye, null, null], POOL_CARDS);
    expect(model.canSign).toBe(false);
    expect(model.blockedReason).toMatch(/different hero/);
  });

  test("an illegal deck blocks signing", () => {
    const brokenDeck: Deck = { ...hawkeye, cards: [] };
    const model = rosterModelOf([brokenDeck, null, null, null], POOL_CARDS);
    expect(model.canSign).toBe(false);
    expect(model.seats[0]?.legal).toBe(false);
  });
});

describe("rosterDeckOptions", () => {
  test("an identity already seated elsewhere is listed, not dropped — just marked blocked", () => {
    const seats: (Deck | null)[] = [hawkeye, null, null, null];
    const options = rosterDeckOptions(seats, 2, [], POOL_VERSION);
    const hawkeyeOption = options.find((o) => o.deck.identityCardId === "04001a");
    expect(hawkeyeOption).toMatchObject({ blocked: true, blockedReason: "Already seated at #1" });
    const spiderWomanOption = options.find((o) => o.deck.identityCardId === "04031a");
    expect(spiderWomanOption).toMatchObject({ blocked: false, blockedReason: null });
  });

  test("a seat's own current deck is never blocked in its own picker", () => {
    const seats: (Deck | null)[] = [hawkeye, null, null, null];
    const options = rosterDeckOptions(seats, 1, [], POOL_VERSION);
    const hawkeyeOption = options.find((o) => o.deck.identityCardId === "04001a");
    expect(hawkeyeOption?.blocked).toBe(false);
  });

  test("every precon is listed regardless of scroll position — nothing is ever excluded outright", () => {
    const seats: (Deck | null)[] = [hawkeye, spiderWoman, null, null];
    const options = rosterDeckOptions(seats, 3, [], POOL_VERSION);
    expect(options.length).toBe(precons.length);
  });
});

describe("rosterDeckOptions rows", () => {
  test("each row carries the hero's identity id, its aspect stamps in stamp colors, and the deck source", () => {
    const options = rosterDeckOptions([null, null, null, null], 1, [], POOL_VERSION);
    const row = options.find((o) => o.deck.identityCardId === "04001a")!;
    expect(row.identityId).toBe("04001a");
    expect(row.sourceLabel).toBe("Precon");
    expect(row.stamps.map((s) => s.label)).toEqual(row.deck.aspects.map((a) => aspectStampOf(a).label));
    expect(row.stamps[0]).toEqual(aspectStampOf(row.deck.aspects[0]!));
  });

  test("two rows for one hero in different aspects get different badge colors", () => {
    const options = rosterDeckOptions([null, null, null, null], 1, [], POOL_VERSION);
    const byHero = new Map<string, number[]>();
    for (const o of options) {
      const fills = byHero.get(o.identityId) ?? [];
      fills.push(o.stamps[0]?.fill ?? -1);
      byHero.set(o.identityId, fills);
    }
    for (const fills of byHero.values()) expect(new Set(fills).size).toBe(fills.length);
  });

  test("a deck with no aspect has no badges", () => {
    const bare: Deck = { ...hawkeye, aspects: [] };
    const options = rosterDeckOptions([null, null, null, null], 1, [bare], POOL_VERSION);
    expect(options.at(-1)?.stamps).toEqual([]);
  });
});

describe("rosterDeckOptions with progression", () => {
  test("a hero the player hasn't unlocked is listed, blocked, with what opens it", () => {
    const seats = preconRosterOf(TRORS_STORY.castIdentityIds as readonly CardId[], POOL_VERSION);
    const options = rosterDeckOptions(seats, 3, [], POOL_VERSION, (deck) =>
      deck.identityCardId === "03001a" ? "Beat Rhino to unlock Wave 1" : null,
    );
    const cap = options.find((o) => o.deck.identityCardId === "03001a")!;
    expect(cap).toMatchObject({ blocked: true, blockedReason: "Beat Rhino to unlock Wave 1" });
    expect(options.find((o) => o.deck.identityCardId === "01001a")).toMatchObject({ blocked: false });
    // Already seated wins over a lock: that is the reason the player can act on here.
    expect(options.find((o) => o.deck.identityCardId === "04001a")?.blockedReason).toBe("Already seated at #1");
  });
});

describe("rosterDeckOptions with the real unlocks", () => {
  test("locks a precon, never a deck the player imported or built", () => {
    const u = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS });
    const capPrecon = precons.find((d) => d.identityCardId === "03001a")!;
    const built = { ...capPrecon, id: "my-cap", source: { kind: "built" } } as unknown as Deck;
    const options = rosterDeckOptions([null, null, null, null], 1, [built], POOL_VERSION, (deck) => u.deckLock(deck));
    expect(options.find((o) => o.deck.id === capPrecon.id)).toMatchObject({ blocked: true });
    expect(options.find((o) => o.deck.id === built.id)).toMatchObject({ blocked: false, blockedReason: null });
  });
});

describe("pickerEntriesOf", () => {
  const catalog = pairCatalogOf(CARDS_BY_ID);
  const deck = (slug: string): Deck => preconDecks(POOL_VERSION).find((d) => (d.id as string) === `precon:${slug}`)!;
  const entries = (seats: (Deck | null)[], seatNumber: number) =>
    pickerEntriesOf(seats, seatNumber, rosterDeckOptions(seats, seatNumber, [], POOL_VERSION), CARDS_BY_ID, catalog);

  test("seat 1's picker is the plain list, with no headings", () => {
    const list = entries([deck("gambit-justice"), deck("rogue-protection"), null, null], 1);
    expect(list.every((e) => e.kind === "option" && !e.recommended)).toBe(true);
  });

  test("seat 3 with Gambit and Rogue seated: a Recommended group first, then the whole list under its own heading", () => {
    const seats = [deck("gambit-justice"), deck("rogue-protection"), null, null];
    const list = entries(seats, 3);
    expect(list[0]).toEqual({ kind: "heading", text: "Recommended for seat #3" });
    const second = list.findIndex((e, i) => i > 0 && e.kind === "heading");
    expect(list[second]).toEqual({ kind: "heading", text: "All heroes" });
    const group = list.slice(1, second);
    expect(group.length).toBeGreaterThan(0);
    expect(group.every((e) => e.kind === "option" && e.recommended && e.rec !== null)).toBe(true);
    // The full list is unchanged: every option, once, in the options' own order.
    const full = list.slice(second + 1);
    expect(full.map((e) => (e.kind === "option" ? e.optionIndex : -1))).toEqual(
      rosterDeckOptions(seats, 3, [], POOL_VERSION).map((_, i) => i),
    );
  });

  test("Team-Up partners lead the group, and an already-seated hero is never in it", () => {
    const seats = [deck("phoenix-justice"), deck("core-spider-man-justice"), null, null];
    const options = rosterDeckOptions(seats, 3, [], POOL_VERSION);
    const list = pickerEntriesOf(seats, 3, options, CARDS_BY_ID, catalog);
    const group = list.slice(
      1,
      list.findIndex((e, i) => i > 0 && e.kind === "heading"),
    );
    const names = group.map((e) => (e.kind === "option" ? options[e.optionIndex]!.deck.id : ""));
    expect(names.slice(0, 2).sort()).toEqual(["precon:cyclops-leadership", "precon:storm-leadership"]);
    expect(names).not.toContain("precon:phoenix-justice");
    expect(names).not.toContain("precon:core-spider-man-justice");
  });

  test("with nobody else seated there is nothing to recommend against", () => {
    const list = entries([null, null, null, null], 2);
    expect(list.every((e) => e.kind === "option" && !e.recommended)).toBe(true);
  });
});
