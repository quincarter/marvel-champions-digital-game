import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORE_CARDS, type AnyCard } from "@mc/content";
import { gallerySectionsOf, galleryRowsOf } from "./pack-gallery-model.js";

const core = (type: string): AnyCard => CORE_CARDS.find((c) => c.type === type)!;
// A real card of the type with the pack's id and set patched in, so every card has the shape the inspect model reads.
const card = (n: string, type: string, extra: Record<string, unknown> = {}): AnyCard =>
  ({ ...core(type), id: `x.carnage-nep.${n}`, name: `Card ${n}`, encounterSetIds: [], ...extra }) as unknown as AnyCard;

const NEMESIS = "carnage-nep-nemesis";
const TWISTED = "carnage-nep-twisted-killers";
// Shaped like Carnage's manifest: a hero kit, an obligation, a nemesis set and a modular set.
const carnage = [
  card("01a", "hero_identity"),
  card("02", "ally", { aspect: "hero:x.carnage-nep.01a" }),
  card("14", "obligation"),
  card("15", "minion", { encounterSetIds: [NEMESIS] }),
  card("16", "side_scheme", { encounterSetIds: [NEMESIS] }),
  card("19", "minion", { encounterSetIds: [TWISTED] }),
  card("20", "side_scheme", { encounterSetIds: [TWISTED] }),
  card("21", "attachment", { encounterSetIds: [TWISTED] }),
];
const encounterSets = [
  { id: NEMESIS, name: "Carnage Nemesis", nemesisOfIdentityId: "x.carnage-nep.01a" },
  { id: TWISTED, name: "Twisted Killers" },
];
const summary = (sections: ReturnType<typeof gallerySectionsOf>["sections"]) =>
  sections.map((s) => [s.id, s.title, s.cards.length]);

describe("the pack gallery grouped by set", () => {
  it("splits a hero pack into hero, obligation, nemesis set and each modular set under its name", () => {
    const { sections } = gallerySectionsOf({ cards: carnage, decks: [], baseCards: new Map(), encounterSets });
    expect(summary(sections)).toEqual([
      ["hero", "Hero", 2],
      ["obligation", "Obligation", 1],
      ["nemesis", "Carnage Nemesis", 2],
      ["modular", "Twisted Killers", 3],
    ]);
    expect(sections[3]!.setId).toBe(TWISTED);
    // Every group heads its own row with its count.
    const headings = galleryRowsOf(sections, 4).filter((row) => row.kind === "heading");
    expect(headings.map((row) => (row.kind === "heading" ? [row.title, row.count] : []))).toEqual([
      ["Hero", 2],
      ["Obligation", 1],
      ["Carnage Nemesis", 2],
      ["Twisted Killers", 3],
    ]);
  });

  it("takes the nemesis set from the identity's nemesisEncounterSetId, whatever the set's id and data say", () => {
    const set = "carnage-nep-sinister-six";
    const cards = [
      card("01a", "hero_identity", { nemesisEncounterSetId: set }),
      card("15", "minion", { encounterSetIds: [set] }),
      card("19", "minion", { encounterSetIds: [TWISTED] }),
    ];
    // The set has no "nemesis" in its id and no nemesisOfIdentityId.
    const { sections } = gallerySectionsOf({
      cards,
      decks: [],
      baseCards: new Map(),
      encounterSets: [
        { id: set, name: "Sinister Six" },
        { id: TWISTED, name: "Twisted Killers" },
      ],
    });
    expect(summary(sections)).toEqual([
      ["hero", "Hero", 1],
      ["nemesis", "Nemesis set: Sinister Six", 1],
      ["modular", "Twisted Killers", 1],
    ]);
  });

  it("titles a nemesis group by its name: a bare 'Nemesis' says so, a name with nemesis in it stays", () => {
    const titleOf = (name: string) => {
      const set = "carnage-nep-six";
      const cards = [
        card("01a", "hero_identity", { nemesisEncounterSetId: set }),
        card("15", "minion", { encounterSetIds: [set] }),
      ];
      const { sections } = gallerySectionsOf({
        cards,
        decks: [],
        baseCards: new Map(),
        encounterSets: [{ id: set, name }],
      });
      return sections.find((s) => s.id === "nemesis")!.title;
    };
    expect(titleOf("Nemesis")).toBe("Nemesis set");
    expect(titleOf("Carnage Nemesis")).toBe("Carnage Nemesis");
    expect(titleOf("Kraven's Hunters")).toBe("Nemesis set: Kraven's Hunters");
  });

  it("groups from the ids alone when a preview has no set data", () => {
    const { sections } = gallerySectionsOf({ cards: carnage, decks: [], baseCards: new Map() });
    expect(summary(sections)).toEqual([
      ["hero", "Hero", 2],
      ["obligation", "Obligation", 1],
      ["nemesis", "Nemesis set", 2],
      ["modular", "Twisted Killers", 3],
    ]);
  });

  it("puts a scenario's own set before its modular sets, and its villain first", () => {
    const cards = [
      card("30", "minion", { encounterSetIds: ["x-mod"] }),
      card("31", "minion", { encounterSetIds: ["x-own"] }),
      card("32", "main_scheme", { encounterSetIds: ["x-own"] }),
      card("33", "villain", { encounterSetIds: ["x-own"] }),
      card("34", "treachery"),
    ];
    const { sections } = gallerySectionsOf({
      cards,
      decks: [],
      baseCards: new Map(),
      encounterSets: [
        { id: "x-mod", name: "Bomb Scare" },
        { id: "x-own", name: "Rhino" },
      ],
    });
    expect(summary(sections)).toEqual([
      ["villain", "Villain and scheme", 2],
      ["scenario", "Rhino", 1],
      ["modular", "Bomb Scare", 1],
      ["encounter", "Encounter cards", 1],
    ]);
  });

  it("groups the real Carnage pack when it has been fetched", () => {
    const dir = join(__dirname, "../../../../content-packs/community/carnage-nep");
    if (!existsSync(join(dir, "cards"))) return;
    const cards = readdirSync(join(dir, "cards"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(join(dir, "cards", file), "utf8")) as AnyCard);
    const sets = readdirSync(join(dir, "encounter-sets")).map(
      (file) => JSON.parse(readFileSync(join(dir, "encounter-sets", file), "utf8")) as (typeof encounterSets)[number],
    );
    const { sections } = gallerySectionsOf({ cards, decks: [], baseCards: new Map(), encounterSets: sets });
    expect(sections.map((s) => [s.id, s.title])).toEqual([
      ["hero", "Hero"],
      ["obligation", "Obligation"],
      ["nemesis", "Carnage Nemesis"],
      ["modular", "Twisted Killers"],
    ]);
    expect(sections.reduce((n, s) => n + s.cards.length, 0)).toBe(cards.length);
  });
});
