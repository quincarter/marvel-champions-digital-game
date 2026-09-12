/// <reference types="node" />
import { readFileSync } from "node:fs";
import {
  imageRef,
  imageUrl,
  validateCard,
  validateScenario,
  validateStarterDeck,
  type AnyCard,
  type AttachmentCard,
  type EnvironmentCard,
  type HeroIdentityCard,
  type MainSchemeCard,
  type MinionCard,
  type ObligationCard,
  type SideSchemeCard,
  type UpgradeCard,
  type VillainCard,
} from "../schema/index.js";
import {
  CORE_CARDS,
  CORE_DROPPED_SOURCE_RECORDS,
  CORE_ENCOUNTER_SETS,
  CORE_PACK,
  CORE_PROVENANCE,
  CORE_SCENARIOS,
  CORE_STARTER_DECKS,
} from "./core/index.js";

interface RawRecord {
  code: string;
  card_set_code?: string | null;
  quantity: number;
  type_code: string;
  linked_card?: RawRecord | null;
  [key: string]: unknown;
}
const rawCacheText = readFileSync(new URL("../../raw/marvelcdb/core.json", import.meta.url), "utf8");
const rawCache = JSON.parse(rawCacheText) as { cards: RawRecord[] };

const byId = new Map<string, AnyCard>(CORE_CARDS.map((c) => [c.id, c]));
function card<T extends AnyCard>(id: string, type: T["type"]): T {
  const c = byId.get(id);
  if (!c) throw new Error(`no card ${id}`);
  expect(c.type).toBe(type);
  return c as T;
}
const abilityIds = (c: { abilities: readonly { id: string }[] }) => c.abilities.map((a) => a.id);

/** Printed cards with no rules text at all; the validator allows blank text on these card types/stages. */
const PRINTED_BLANK_TEXT = ["01014", "01044", "01094", "01156"];

describe("Core Set data — integrity", () => {
  it("every record passes validateCard()", () => {
    const failures = CORE_CARDS.map((c) => ({ id: c.id, errors: validateCard(c).errors })).filter((f) => f.errors.length > 0);
    expect(failures).toEqual([]);
  });

  it("the blank-text cards really are blank in the source", () => {
    const blank = (c: AnyCard) =>
      c.type === "villain" ? c.sides[0].stages[0].text.current === "" : "text" in c && c.text.current === "";
    expect(PRINTED_BLANK_TEXT.every((id) => blank(byId.get(id) as AnyCard))).toBe(true);
  });

  it("printed '—' and 'X' stats and later main-scheme stage titles survive ingestion", () => {
    const hulk = byId.get("01050");
    expect(hulk?.type === "ally" && hulk.thw).toBeNull();
    const titania = byId.get("01162");
    expect(titania?.type === "minion" && titania.atk).toBe("X");
    const names = (id: string) => {
      const c = byId.get(id);
      return c?.type === "main_scheme" ? c.stages.map((s) => s.name ?? null) : [];
    };
    expect(names("01116a")).toEqual([null, "Secret Rendezvous"]);
    expect(names("01137a")).toEqual([null, "Assault on NORAD", "Countdown to Oblivion"]);
  });

  it("scenarios and starter decks validate", () => {
    for (const s of CORE_SCENARIOS) expect(validateScenario(s).errors).toEqual([]);
    for (const d of CORE_STARTER_DECKS) expect(validateStarterDeck(d).errors).toEqual([]);
  });

  it("ids are unique and sorted; every card belongs to the core pack", () => {
    const ids = CORE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    for (const c of CORE_CARDS) {
      expect(c.setCode).toBe(CORE_PACK.code);
      expect(c.cycleId).toBe(CORE_PACK.cycleId);
    }
  });

  it("every AbilityReference id is unique pack-wide, well-formed, and prefixed by one of its card's source codes", () => {
    const seen = new Set<string>();
    const provenance = new Map(CORE_PROVENANCE.map((p) => [p.cardId as string, p]));
    for (const c of CORE_CARDS) {
      for (const ref of allAbilityRefs(c)) {
        expect(ref.id).toMatch(/^\d{5}[a-z]?\.[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(seen.has(ref.id), `duplicate ${ref.id}`).toBe(false);
        seen.add(ref.id);
        expect(provenance.get(c.id)?.marvelcdbCodes).toContain(ref.id.split(".")[0]);
      }
    }
    expect(seen.size).toBeGreaterThan(150);
  });

  it("no HTML, trait markup, or unknown icon tokens survive in any text", () => {
    for (const c of CORE_CARDS) {
      for (const t of allTexts(c)) {
        expect(t, c.id).not.toMatch(/<[a-z/]|\[\[|&[a-z]+;/);
        for (const token of t.match(/\[[a-z_]+\]/g) ?? []) {
          expect(["[energy]", "[mental]", "[physical]", "[wild]", "[per_hero]", "[star]"]).toContain(token);
        }
      }
    }
  });
});

describe("Core Set data — matches the raw MarvelCDB cache", () => {
  const dropped = new Set(CORE_DROPPED_SOURCE_RECORDS.map((d) => d.marvelcdbCode));
  const rawRecords = rawCache.cards.flatMap((r) => (r.linked_card ? [r, r.linked_card] : [r]));

  it("the raw cache keeps MarvelCDB's asset/reference fields verbatim", () => {
    // The cache is a verbatim copy of the API response: imagesrc/backimagesrc/meta/
    // octgn_id/url are references, not image bytes, and are kept for downstream use
    // (art lookup, cross-referencing OCTGN/MarvelCDB). No art is stored in the repo.
    for (const field of ["imagesrc", "backimagesrc", "meta", "octgn_id", "url"]) {
      expect(rawCacheText, field).toContain(`"${field}":`);
    }
    const spiderMan = rawCache.cards.find((r) => r.code === "01001a");
    expect(spiderMan?.["imagesrc"]).toBe("/bundles/cards/01001a.png");
    expect(spiderMan?.["url"]).toBe("https://marvelcdb.com/card/01001a");
    expect(spiderMan?.["octgn_id"]).toEqual(expect.any(String));
    // …including inside linked_card, which used to be stripped recursively.
    expect(spiderMan?.linked_card?.["imagesrc"]).toBe("/bundles/cards/01001b.png");
  });

  it("has 205 top-level records and drops only MarvelCDB aggregates", () => {
    expect(rawCache.cards).toHaveLength(205);
    expect([...dropped].sort()).toEqual(["01097", "01116", "01117", "01137", "01138", "01139", "01144"]);
  });

  it("every non-aggregate MarvelCDB code ends up in exactly one card, per card_set_code", () => {
    const rawBySet = new Map<string, string[]>();
    for (const r of rawRecords) {
      if (dropped.has(r.code)) continue;
      const set = r.card_set_code ?? String(r["faction_code"]);
      rawBySet.set(set, [...(rawBySet.get(set) ?? []), r.code]);
    }
    const emittedBySet = new Map<string, string[]>();
    for (const p of CORE_PROVENANCE) emittedBySet.set(p.cardSetCode, [...(emittedBySet.get(p.cardSetCode) ?? []), ...p.marvelcdbCodes]);
    expect([...emittedBySet.keys()].sort()).toEqual([...rawBySet.keys()].sort());
    for (const [set, codes] of rawBySet) expect(emittedBySet.get(set)?.slice().sort(), set).toEqual(codes.slice().sort());
  });

  it("physical copy counts per card_set_code match the raw quantities", () => {
    const rawCopies = new Map<string, number>();
    for (const r of rawCache.cards) {
      if (dropped.has(r.code)) continue;
      const set = r.card_set_code ?? String(r["faction_code"]);
      rawCopies.set(set, (rawCopies.get(set) ?? 0) + r.quantity);
    }
    const setOf = new Map(CORE_PROVENANCE.map((p) => [p.cardId as string, p.cardSetCode]));
    const copies = new Map<string, number>();
    for (const c of CORE_CARDS) {
      const n = c.type === "villain" ? c.sides[0].stages.length : c.type === "main_scheme" ? c.stages.length : c.quantityInSet;
      const set = setOf.get(c.id) as string;
      copies.set(set, (copies.get(set) ?? 0) + n);
    }
    expect(Object.fromEntries(copies)).toEqual(Object.fromEntries(rawCopies));
    // Learn to Play p.23 encounter-set sizes, as an independent check on the grouping.
    expect(copies.get("rhino")).toBe(21);
    expect(copies.get("standard")).toBe(7);
    expect(copies.get("expert")).toBe(3);
    expect(copies.get("ultron")).toBe(25);
  });
});

describe("Core Set data — spot checks across card types", () => {
  it("Spider-Man identity: faces, stats, abilities, obligation/nemesis links", () => {
    const spidey = card<HeroIdentityCard>("01001a", "hero_identity");
    expect(spidey.hp).toBe(10);
    expect(spidey.hero).toMatchObject({ faceName: "Spider-Man", atk: 2, thw: 1, def: 3, handSize: 5, traits: ["AVENGER"], keywords: [] });
    expect(spidey.hero.abilities).toEqual([{ id: "01001a.spider-sense", label: "Spider-Sense" }]);
    expect(spidey.alterEgo).toMatchObject({ faceName: "Peter Parker", rec: 3, handSize: 6, traits: ["GENIUS"], keywords: [] });
    expect(abilityIds(spidey.alterEgo)).toEqual(["01001b.scientist"]);
    expect(spidey.obligationCardId).toBe("01165");
    expect(spidey.nemesisEncounterSetId).toBe("spider_man_nemesis");
    expect(spidey.alterEgo.text.current).toBe("Scientist — Resource: Generate a [mental] resource. (Limit once per round.)");
  });

  it("Black Panther: Retaliate 1 on the hero face only; Foresight is a named Setup ability", () => {
    const bp = card<HeroIdentityCard>("01040a", "hero_identity");
    expect(bp.hero.keywords).toEqual([{ name: "retaliate", value: 1 }]);
    expect(bp.hero.abilities).toEqual([]);
    expect(bp.alterEgo.keywords).toEqual([]);
    expect(bp.alterEgo.abilities).toEqual([{ id: "01040b.foresight", label: "Foresight" }]);
  });

  it("She-Hulk's quoted ability names become clean labels and slugs", () => {
    const sh = card<HeroIdentityCard>("01019a", "hero_identity");
    expect(sh.hero.abilities).toEqual([{ id: "01019a.do-you-even-lift", label: "Do You Even Lift?" }]);
    expect(sh.alterEgo.abilities).toEqual([{ id: "01019b.i-object", label: "I Object!" }]);
  });

  it("Rhino: one villain card, stages I/II/III with per-player HP, Toughness on III", () => {
    const rhino = card<VillainCard>("01094", "villain");
    const stages = rhino.sides[0].stages;
    expect(stages.map((s) => [s.stageNumber, s.hp, s.atk, s.sch])).toEqual([
      [1, { base: 0, perPlayer: 14 }, 2, 1],
      [2, { base: 0, perPlayer: 15 }, 3, 1],
      [3, { base: 0, perPlayer: 16 }, 4, 1],
    ]);
    expect(stages.map((s) => s.keywords)).toEqual([[], [], [{ name: "toughness" }]]);
    expect(stages.map(abilityIds)).toEqual([[], ["01095.when-revealed"], ["01096.when-revealed"]]);
    expect(rhino.collectorNumber).toBe("94/95/96");
  });

  it("Klaw (I) has a printed ATK of 0 and the [star] forced interrupt on every stage", () => {
    const klaw = card<VillainCard>("01113", "villain");
    expect(klaw.sides[0].stages.map((s) => s.atk)).toEqual([0, 1, 2]);
    expect(klaw.sides[0].stages.map(abilityIds)).toEqual([
      ["01113.klaw-forced-interrupt"],
      ["01114.when-revealed", "01114.klaw-forced-interrupt"],
      ["01115.klaw-forced-interrupt"],
    ]);
  });

  it("Ultron (III): the MarvelCDB threat/hazard artifact is not carried; no Toughness", () => {
    const ultron = card<VillainCard>("01134", "villain");
    const iii = ultron.sides[0].stages[2];
    expect(iii?.hp).toEqual({ base: 0, perPlayer: 27 });
    expect(iii?.keywords).toEqual([]);
    expect(iii?.abilities.map((a) => a.id)).toEqual(["01136.ultron-constant", "01136.when-revealed"]);
    expect(CORE_PROVENANCE.find((p) => p.cardId === "01134")?.corrections.join()).toMatch(/scheme_hazard/);
  });

  it("The Break-In!: 1B is 7 per player with 1 per player acceleration; the 1A setup is on the A side", () => {
    const scheme = card<MainSchemeCard>("01097a", "main_scheme");
    expect(scheme.stages).toHaveLength(1);
    const [s] = scheme.stages;
    expect(s.stageNumber).toBe(1);
    expect(s.startingThreat).toEqual({ base: 0, perPlayer: 0 });
    expect(s.targetThreat).toEqual({ base: 0, perPlayer: 7 });
    expect(s.acceleration).toEqual({ base: 0, perPlayer: 1 });
    expect(s.abilities).toEqual([]);
    expect(abilityIds(s.aSide)).toEqual(["01097a.setup"]);
    expect(s.aSide.text.current).toMatch(/^Contents: Rhino \(I\) and Rhino \(II\)\./);
  });

  it("Klaw and Ultron main scheme decks keep every stage in order with A/B abilities", () => {
    const klaw = card<MainSchemeCard>("01116a", "main_scheme");
    expect(klaw.stages.map((s) => [s.stageNumber, s.targetThreat.perPlayer])).toEqual([[1, 6], [2, 8]]);
    expect(klaw.stages.map((s) => [abilityIds(s.aSide), abilityIds(s)])).toEqual([
      [["01116a.setup"], ["01116b.when-revealed"]],
      [["01117a.when-revealed"], []],
    ]);
    const ultron = card<MainSchemeCard>("01137a", "main_scheme");
    expect(ultron.stages.map((s) => [s.stageNumber, s.targetThreat.perPlayer])).toEqual([[1, 3], [2, 10], [3, 5]]);
    expect(abilityIds(ultron.stages[2] as MainSchemeCard["stages"][0])).toEqual(["01139b.countdown-to-oblivion-constant"]);
    expect(ultron.stages[0].aSide.text.current).toMatch(/Advance to stage 1B\.$/);
  });

  it("Charge: +3 ATK stat box, attaches to the villain, 2 boost icons, [star] forced interrupt (no Boost ability)", () => {
    const charge = card<AttachmentCard>("01099", "attachment");
    expect(charge.statModifiers).toEqual({ atk: 3 });
    expect(charge.attachesTo).toEqual({ kind: "villain" });
    expect(charge.boostIcons).toBe(2);
    expect(charge.quantityInSet).toBe(2);
    expect(abilityIds(charge)).toEqual(["01099.charge-forced-interrupt"]);
  });

  it("encounter attachments: host rules and stat boxes", () => {
    expect(card<AttachmentCard>("01141", "attachment").statModifiers).toEqual({ sch: 1 });
    expect(card<AttachmentCard>("01153", "attachment").statModifiers).toEqual({ atk: 1 }); // hand-corrected
    expect(card<AttachmentCard>("01142", "attachment").attachesTo).toEqual({ kind: "namedCard", name: "Ultron Drones" });
    expect(card<AttachmentCard>("01163", "attachment").attachesTo).toEqual({ kind: "minionWithHighestPrintedHp" });
    const bio = card<AttachmentCard>("01185", "attachment");
    expect(bio.attachesTo).toEqual({ kind: "minionWithHighestPrintedHp", withoutAttachmentNamed: "Biomechanical Upgrades" });
    expect(bio.keywords).toEqual([{ name: "surge" }]);
    expect(card<AttachmentCard>("01119", "attachment").statModifiers).toBeUndefined();
  });

  it("Web-Shooter: Uses (3 web) and a resource ability", () => {
    const ws = card<UpgradeCard>("01008", "upgrade");
    expect(ws.keywords).toEqual([{ name: "uses", count: 3, counterType: "web" }]);
    expect(abilityIds(ws)).toEqual(["01008.web-shooter-resource"]);
    expect(ws.attachesTo).toBeUndefined();
  });

  it("player upgrades: host rules and play restrictions", () => {
    const webbedUp = card<UpgradeCard>("01009", "upgrade");
    expect(webbedUp.attachesTo).toEqual({ kind: "enemy" });
    expect(webbedUp.playRestrictions).toEqual({ form: "hero", maxPerHost: 1 });
    expect(card<UpgradeCard>("01007", "upgrade").attachesTo).toEqual({ kind: "minion" });
    expect(card<UpgradeCard>("01074", "upgrade").attachesTo).toEqual({ kind: "ally" });
    expect(card<UpgradeCard>("01057", "upgrade").playRestrictions).toEqual({ anyPlayerControl: true, maxPerPlayer: 1 });
    const channel = card<UpgradeCard>("01018", "upgrade");
    expect(channel.cost).toBe(0);
    expect(channel.playRestrictions).toEqual({ maxPerPlayer: 1 });
    expect(abilityIds(channel)).toEqual(["01018.energy-channel-action", "01018.energy-channel-hero-action"]);
  });

  it("Hawkeye: ally stats, consequential damage, arrow counters as a constant (not Uses)", () => {
    const hawkeye = byId.get("01066");
    expect(hawkeye?.type).toBe("ally");
    if (hawkeye?.type !== "ally") return;
    expect(hawkeye).toMatchObject({ cost: 3, atk: 1, thw: 1, hp: 3, consequentialDamage: { attack: 1, thwart: 1 }, resourceIcons: { energy: 1 } });
    expect(hawkeye.keywords).toEqual([]);
    expect(abilityIds(hawkeye)).toEqual(["01066.hawkeye-constant", "01066.hawkeye-response"]);
  });

  it("Hulk's printed THW dash is carried as null (PrintedStat '—') with a recorded data decision", () => {
    const hulk = byId.get("01050");
    expect(hulk?.type === "ally" && hulk.thw).toBeNull();
    expect(CORE_PROVENANCE.find((p) => p.cardId === "01050")?.corrections.join()).toMatch(/cannot thwart/);
  });

  it("Wakanda Forever! variants are distinct cards with their own resource icon", () => {
    const variants = ["01043a", "01043b", "01043c", "01043d"].map((id) => byId.get(id));
    expect(variants.map((v) => v?.type)).toEqual(["event", "event", "event", "event"]);
    expect(variants.map((v) => v?.quantityInSet)).toEqual([1, 1, 1, 2]);
    expect(variants.map((v) => (v?.type === "event" ? v.resourceIcons : undefined))).toEqual([
      { energy: 1 },
      { mental: 1 },
      { physical: 1 },
      { wild: 1 },
    ]);
    expect(variants.map((v) => (v?.type === "event" ? abilityIds(v) : []))).toEqual([
      ["01043a.wakanda-forever-action"],
      ["01043b.wakanda-forever-action"],
      ["01043c.wakanda-forever-action"],
      ["01043d.wakanda-forever-action"],
    ]);
  });

  it("Android Efficiency: three printed variants, each with its own boost ability", () => {
    const ids = CORE_CARDS.filter((c) => c.name === "Android Efficiency").map((c) => c.id);
    expect(ids).toEqual(["01144a", "01144b", "01144c"]);
    for (const id of ids) {
      const c = byId.get(id);
      expect(c?.type === "treachery" && abilityIds(c)).toEqual([`${id}.when-revealed`, `${id}.boost`]);
    }
  });

  it("Titania: printed ATK X is carried as \"X\" plus a noted constant ability", () => {
    const titania = card<MinionCard>("01162", "minion");
    expect([titania.atk, titania.sch, titania.hp, titania.boostIcons]).toEqual(["X", 1, 6, 2]);
    expect(titania.abilities[0]?.id).toBe("01162.titania-constant");
    expect(titania.abilities[0]?.notesForScripting).toMatch(/remaining hit points/);
  });

  it("minion keywords: Guard, Toughness, Quickstrike, Retaliate, Surge + Boost", () => {
    expect(card<MinionCard>("01120", "minion").keywords).toEqual([{ name: "guard" }, { name: "toughness" }]);
    expect(card<MinionCard>("01167", "minion").keywords).toEqual([{ name: "quickstrike" }]);
    expect(card<MinionCard>("01184", "minion").keywords).toEqual([{ name: "retaliate", value: 2 }]);
    const runner = card<MinionCard>("01121", "minion");
    expect(runner.keywords).toEqual([{ name: "surge" }]);
    expect(abilityIds(runner)).toEqual(["01121.boost"]);
    expect(abilityIds(card<MinionCard>("01182", "minion"))).toEqual(["01182.when-defeated"]);
    expect(card<MinionCard>("01172", "minion").traits).toEqual(["CRIMINAL"]); // hand-corrected
  });

  it("Ultron Drones environment", () => {
    const drones = card<EnvironmentCard>("01140", "environment");
    expect(abilityIds(drones)).toEqual(["01140.ultron-drones-constant", "01140.ultron-drones-forced-response"]);
    expect(drones.text.current).toMatch(/its owner's discard pile\.$/);
  });

  it("side schemes: scaling and icons", () => {
    const crowd = card<SideSchemeCard>("01108", "side_scheme");
    expect([crowd.startingThreat, crowd.icons, crowd.abilities]).toEqual([{ base: 0, perPlayer: 2 }, ["crisis"], []]);
    const breakin = card<SideSchemeCard>("01107", "side_scheme");
    expect([breakin.startingThreat, breakin.icons, abilityIds(breakin)]).toEqual([
      { base: 2, perPlayer: 0 },
      ["hazard"],
      ["01107.when-revealed"],
    ]);
    const bomb = card<SideSchemeCard>("01109", "side_scheme");
    expect([bomb.startingThreat, bomb.icons]).toEqual([{ base: 2, perPlayer: 0 }, ["acceleration"]]);
    const immortal = card<SideSchemeCard>("01127", "side_scheme");
    expect([immortal.startingThreat, immortal.icons]).toEqual([{ base: 0, perPlayer: 3 }, ["acceleration"]]);
  });

  it("an obligation: Eviction Notice", () => {
    const eviction = card<ObligationCard>("01165", "obligation");
    expect(eviction.encounterSetIds).toEqual([]);
    expect(eviction.boostIcons).toBe(2);
    expect(abilityIds(eviction)).toEqual(["01165.obligation"]);
    expect(eviction.text.current).toMatch(/You may flip to alter-ego form\. Choose one:/);
  });

  it("a nemesis set: Spider-Man's", () => {
    const set = CORE_ENCOUNTER_SETS.find((s) => s.id === "spider_man_nemesis");
    expect(set?.nemesisOfIdentityId).toBe("01001a");
    const members = CORE_CARDS.filter((c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes("spider_man_nemesis"));
    expect(members.map((c) => [c.id, c.type])).toEqual([
      ["01166", "side_scheme"],
      ["01167", "minion"],
      ["01168", "treachery"],
      ["01169", "treachery"],
    ]);
  });

  it("errata keep printed and current text side by side", () => {
    const sld = byId.get("01026");
    expect(sld?.type).toBe("support");
    if (sld?.type !== "support") return;
    expect(sld.text.printed).toMatch(/^Alter-Ego Action \(thwart\):/);
    expect(sld.text.current).toMatch(/^Alter-Ego Action:/);
    expect(sld.errata?.currentVersion).toBe("RRG 1.5");
    const chair = card<SideSchemeCard>("01183", "side_scheme");
    expect(chair.text.printed).toContain("If MODOK is not in play");
    expect(chair.text.current).toContain("If M.O.D.O.K. is not in play");
    expect(card<MinionCard>("01184", "minion").name).toBe("M.O.D.O.K.");
  });

  it("hand-corrected transcription errors", () => {
    expect(byId.get("01105")?.name).toBe('"I\'m Tough!"');
    expect(byId.get("01156")?.name).toBe("Usurp the Throne");
    const herb = byId.get("01158");
    expect(herb?.type === "treachery" && [herb.boostIcons, abilityIds(herb)]).toEqual([0, ["01158.when-revealed", "01158.boost"]]);
  });

  it("deck limits come from the cards", () => {
    const limit = (id: string) => {
      const c = byId.get(id);
      return c && "deckLimit" in c ? c.deckLimit : undefined;
    };
    expect([limit("01088"), limit("01055"), limit("01005"), limit("01014")]).toEqual([1, 2, 3, 2]);
  });
});

describe("Core Set data — artwork references", () => {
  const rawByCode = new Map(rawCache.cards.flatMap((r) => (r.linked_card ? [r, r.linked_card] : [r])).map((r) => [r.code, r]));
  const src = (code: string) => rawByCode.get(code)?.["imagesrc"];

  /**
   * Every printed face, wherever the schema keeps it. A card's faces live in
   * different places by type, so a coverage test has to know all of them —
   * this mirrors `printedFaces` in the normalizer.
   */
  function faces(c: AnyCard): { what: string; image?: string }[] {
    switch (c.type) {
      case "hero_identity":
        return [
          { what: "hero", ...(c.hero.image ? { image: c.hero.image } : {}) },
          { what: "alterEgo", ...(c.alterEgo.image ? { image: c.alterEgo.image } : {}) },
        ];
      case "villain":
        return c.sides.flatMap((side) =>
          side.stages.map((st) => ({ what: `${side.side}${st.stageNumber}`, ...(st.image ? { image: st.image } : {}) })),
        );
      case "main_scheme":
        return c.stages.flatMap((st) => [
          { what: `${st.stageNumber}A`, ...(st.aSide.image ? { image: st.aSide.image } : {}) },
          { what: `${st.stageNumber}B`, ...(st.image ? { image: st.image } : {}) },
        ]);
      default:
        return [{ what: "front", ...(c.images?.front ? { image: c.images.front } : {}) }];
    }
  }

  it("every printed face of every card has an artwork reference", () => {
    const missing = CORE_CARDS.flatMap((c) => faces(c).filter((f) => !f.image).map((f) => `${c.id}:${f.what}`));
    expect(missing).toEqual([]);
  });

  it("references are the source's own paths, never bytes and never a baked URL", () => {
    for (const c of CORE_CARDS) {
      for (const face of faces(c)) {
        // A site-relative path: the host is resolved by `imageUrl`, so the data
        // stays references rather than thousands of URLs (CLAUDE.md IP boundary).
        expect(face.image, `${c.id}:${face.what}`).toMatch(/^\/bundles\/cards\/[\w-]+\.png$/);
      }
    }
  });

  it("a single-faced card takes its front straight from the source record", () => {
    const suit = card<AttachmentCard>("01098", "attachment");
    expect(suit.images?.front).toBe(src("01098"));
    expect(suit.images?.front).toBe("/bundles/cards/01098.png");
    // MarvelCDB gives these no back image, so the schema shouldn't invent one.
    expect(suit.images?.back).toBeUndefined();
  });

  it("a hero identity's faces come from the record and its linked card", () => {
    // The alter-ego is published as a linked card that "flips", not as a back
    // image, so the pair is assembled during ingestion.
    const identities = CORE_CARDS.filter((c): c is HeroIdentityCard => c.type === "hero_identity");
    expect(identities).toHaveLength(5);
    for (const hero of identities) {
      const id = hero.id;
      const raw = rawByCode.get(id);
      const linked = raw?.linked_card;
      expect(raw, id).toBeDefined();
      expect(linked, id).toBeDefined();
      expect(linked?.type_code, id).toBe("alter_ego");
      expect(hero.hero.image, id).toBe(raw?.["imagesrc"]);
      expect(hero.alterEgo.image, id).toBe(linked?.["imagesrc"]);
      // The card-level pair mirrors the two faces: front hero, back alter-ego.
      expect(hero.images?.front, id).toBe(hero.hero.image);
      expect(hero.images?.back, id).toBe(hero.alterEgo.image);
      expect(hero.hero.image, id).not.toBe(hero.alterEgo.image);
    }
  });

  it("Spider-Man's two faces are the a/b pair", () => {
    const spiderMan = card<HeroIdentityCard>("01001a", "hero_identity");
    expect(spiderMan.hero.image).toBe("/bundles/cards/01001a.png");
    expect(spiderMan.alterEgo.image).toBe("/bundles/cards/01001b.png");
  });

  it("a villain carries one reference per stage, since each stage is its own card", () => {
    const rhino = card<VillainCard>("01094", "villain");
    expect(rhino.sides[0].stages.map((s) => s.image)).toEqual([
      src("01094"),
      src("01095"),
      src("01096"),
    ]);
    // No card-level pair: there is no single "front" for a three-stage villain.
    expect(rhino.images).toBeUndefined();
  });

  it("a main scheme carries a reference for each side of each stage", () => {
    const breakIn = card<MainSchemeCard>("01097a", "main_scheme");
    const stage = breakIn.stages[0];
    // The A side's image only exists on the aggregate record MarvelCDB also
    // publishes (`01097`), which ingestion drops as a duplicate.
    expect(stage.aSide.image).toBe("/bundles/cards/01097.png");
    expect(stage.image).toBe("/bundles/cards/01097b.png");
    expect(breakIn.images).toBeUndefined();
  });

  it("every stage of a multi-stage main scheme gets its own pair", () => {
    for (const c of CORE_CARDS.filter((x): x is MainSchemeCard => x.type === "main_scheme")) {
      const refs = c.stages.flatMap((s) => [s.aSide.image, s.image]);
      expect(new Set(refs).size, c.id).toBe(refs.length);
    }
  });

  it("imageUrl resolves a reference against the source host, and leaves an absolute one alone", () => {
    const spiderMan = card<HeroIdentityCard>("01001a", "hero_identity");
    expect(imageUrl(spiderMan.hero.image!)).toBe("https://marvelcdb.com/bundles/cards/01001a.png");
    expect(imageUrl(spiderMan.hero.image!, "https://mirror.example/")).toBe("https://mirror.example/bundles/cards/01001a.png");
    expect(imageUrl(imageRef("https://cdn.example/x.png"))).toBe("https://cdn.example/x.png");
  });
});

describe("Core Set scenarios and starter decks", () => {
  it("scenarios wire villain, main scheme, modular, standard/expert sets and stage ranges", () => {
    expect(CORE_SCENARIOS.map((s) => [s.id, s.villainCardId, s.mainSchemeCardId, s.recommendedModularSetIds])).toEqual([
      ["rhino", "01094", "01097a", ["bomb_scare"]],
      ["klaw", "01113", "01116a", ["masters_of_evil"]],
      ["ultron", "01134", "01137a", ["under_attack"]],
    ]);
    for (const s of CORE_SCENARIOS) {
      expect(s.standardEncounterSetIds).toEqual(["standard"]);
      expect(s.expertEncounterSetIds).toEqual(["expert"]);
      expect(s.villainStages).toEqual({ standard: [1, 2], expert: [2, 3] });
    }
  });

  it("six verified Core decks, each 40 cards within one box's quantities and deck limits", () => {
    expect(CORE_STARTER_DECKS.map((d) => [d.identityCardId, d.aspects])).toEqual([
      ["01001a", ["justice"]],
      ["01010a", ["leadership"]],
      ["01010a", ["aggression"]],
      ["01019a", ["aggression"]],
      ["01029a", ["aggression"]],
      ["01040a", ["protection"]],
    ]);
    for (const d of CORE_STARTER_DECKS) {
      expect(d.provenance.verified).toBe(true);
      expect(d.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
      for (const e of d.cards) {
        const c = byId.get(e.cardId);
        expect(c && "deckLimit" in c, e.cardId).toBe(true);
        if (!c || !("deckLimit" in c)) continue;
        expect(e.quantity).toBeLessThanOrEqual(Math.min(c.quantityInSet, c.deckLimit));
      }
    }
  });

  it("the precons are not designed to be built simultaneously from one box", () => {
    // Every deck includes the single Mockingbird (quantity 1), and L2P p.20 says the
    // She-Hulk and Iron Man decks share the Aggression cards.
    const mockingbird = CORE_STARTER_DECKS.filter((d) => d.cards.some((e) => e.cardId === "01083")).length;
    expect(mockingbird).toBe(CORE_STARTER_DECKS.length);
    expect(byId.get("01083")?.quantityInSet).toBe(1);
  });
});

function allAbilityRefs(c: AnyCard): { id: string }[] {
  switch (c.type) {
    case "hero_identity":
      return [...c.hero.abilities, ...c.alterEgo.abilities];
    case "villain":
      return c.sides.flatMap((s) => s.stages.flatMap((st) => st.abilities));
    case "main_scheme":
      return c.stages.flatMap((s) => [...s.aSide.abilities, ...s.abilities]);
    default:
      return [...c.abilities];
  }
}

function allTexts(c: AnyCard): string[] {
  const t = (x: { printed: string; current: string }) => [x.printed, x.current];
  switch (c.type) {
    case "hero_identity":
      return [...t(c.hero.text), ...t(c.alterEgo.text)];
    case "villain":
      return c.sides.flatMap((s) => s.stages.flatMap((st) => t(st.text)));
    case "main_scheme":
      return c.stages.flatMap((s) => [...t(s.text), ...t(s.aSide.text)]);
    default:
      return t(c.text);
  }
}
