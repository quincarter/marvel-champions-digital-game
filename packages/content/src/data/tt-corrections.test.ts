import { describe, expect, it } from "vitest";
import { validateCard, validateScenario } from "../schema/index.js";
import type { AnyCard, Scenario, VillainCard } from "../schema/index.js";
import { TT_CARDS, TT_SCENARIOS } from "./index.js";

/** Trickster Takeover (MC55) corrections of docs/phase7-wave9.md section 1.15 (data items 18 to 21 and 26 of section 8.1). */
const card = (id: string): AnyCard => {
  const found = TT_CARDS.find((c) => (c.id as string) === id);
  if (!found) throw new Error(`no tt card ${id}`);
  return found;
};
/** The card's printed text and abilities (every tt card is an encounter card). */
const textOf = (id: string) => {
  const c = card(id);
  if (!("text" in c) || !("abilities" in c)) throw new Error(`${id} has no text`);
  return c;
};
const scenario = (id: string): Scenario => {
  const found = TT_SCENARIOS.find((s) => (s.id as string) === id);
  if (!found) throw new Error(`no tt scenario ${id}`);
  return found;
};

describe("tt corrections", () => {
  it("item 18: the God of Lies record puts an Avatar in play by Setup and keeps Loki and Worlds Collide neutral", () => {
    const s = scenario("god-of-lies");
    expect(validateScenario(s).errors).toEqual([]);
    expect(s.villainCardId as string).toBe("55029a");
    expect(s.setAsideVillainCardIds?.map(String)).toEqual(["55030a", "55031a", "55032a"]);
    expect(s.startingVillain).toBe("bySetup");
    expect(s.mainSchemeCardId as string).toBe("55033a");
    expect(s.neutralCards).toEqual({ villainCardId: "55027a", mainSchemeCardId: "55028a" });
    expect(s.setAsideCardIds).toBeUndefined();
    expect(s.victory).toBe("cardAbility");
    for (const id of [s.neutralCards!.villainCardId, s.neutralCards!.mainSchemeCardId])
      expect(TT_CARDS.some((c) => c.id === id)).toBe(true);
  });

  it("item 18: the Enchantress record has no neutral cards, and neutralCards cannot repeat a used card", () => {
    expect(scenario("enchantress").neutralCards).toBeUndefined();
    const god = scenario("god-of-lies");
    const clash = { ...god, neutralCards: { villainCardId: god.villainCardId, mainSchemeCardId: god.mainSchemeCardId } };
    expect(validateScenario(clash).errors.join("\n")).toMatch(/neutralCards lists/);
  });

  it("item 19: Spellbound's ability is When Defeated; Wrapped in Chains reads identity", () => {
    const spellbound = textOf("55022");
    expect(spellbound.abilities.map((a) => a.id as string)).toEqual(["55022.when-defeated"]);
    expect(spellbound.text.printed).toMatch(/^When Defeated: Each player whose identity has the Defiant trait/);
    expect(spellbound.text.current).toBe(spellbound.text.printed);
    const chains = textOf("55035");
    expect(chains.text.printed).toContain("Attach to your identity.");
    expect(chains.text.printed).not.toContain("identiy");
    expect(validateCard(chains).errors).toEqual([]);
  });

  it("item 20: the four Fading Figments print infinite hit points", () => {
    for (const id of ["55029a", "55030a", "55031a", "55032a"]) {
      const villain = card(id) as VillainCard;
      const figment = villain.sides.find((side) => side.side === "B")!.stages[0]!;
      expect(villain.sides[1]!.name).toBe("Fading Figment");
      expect(figment.infiniteHp, id).toBe(true);
      expect(figment.hp, id).toEqual({ base: 0, perPlayer: 0 });
      const avatar = villain.sides.find((side) => side.side === "A")!.stages[0]!;
      expect(avatar.infiniteHp, id).toBeUndefined();
      expect(avatar.hp, id).toEqual({ base: 0, perPlayer: 15 });
    }
  });

  it("item 21: counter types the text defines, and only those", () => {
    const expected: Record<string, readonly string[]> = {};
    for (const n of [55007, 55008, 55009, 55010, 55011]) expected[`${n}a`] = ["charm"];
    for (const n of [55029, 55030, 55031, 55032]) expected[`${n}a`] = ["shatter"];
    for (const n of [55052, 55053, 55054, 55055]) expected[String(n)] = ["synergy"];
    for (const c of TT_CARDS) {
      expect(c.definedCounterTypes, c.id as string).toEqual(expected[c.id as string]);
    }
    for (const id of Object.keys(expected)) expect(card(id).definedCounterTypes).toEqual(expected[id]);
  });

  it("item 26: Crown of the Enchantress has a star in its SCH box and no SCH modifier", () => {
    const crown = textOf("55016");
    expect(crown.type).toBe("attachment");
    expect("statModifiers" in crown ? crown.statModifiers?.sch : undefined).toBeUndefined();
    expect(crown.text.printed).toContain("[star] Forced Response");
  });
});
