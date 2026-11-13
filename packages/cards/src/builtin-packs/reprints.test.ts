import { CORE_CARDS, abilityId, cardId, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { CORE_ABILITIES } from "../core/index.js";
import { reprintAliases } from "./reprints.js";

/** A Core support with one scripted ability, to reprint under a made-up code. */
const original = CORE_CARDS.find(
  (card) => card.type === "support" && card.abilities.length === 1 && card.abilities[0]!.id in CORE_ABILITIES,
)!;
if (original.type !== "support") throw new Error("Core has a support with one scripted ability");
const [ref] = original.abilities;
const slug = ref!.id.slice(ref!.id.indexOf(".") + 1);

/** `original` reprinted as card `99001`, with its ability refs renamed by `rename`. */
const reprintOf = (rename: (slug: string) => string = (s) => s, overrides: Partial<AnyCard> = {}): AnyCard =>
  ({
    ...original,
    id: cardId("99001"),
    abilities: original.abilities.map((r) => ({ ...r, id: abilityId(`99001.${rename(slug)}`) })),
    ...overrides,
  }) as AnyCard;

const wording = { earlierAbilities: "TEST_ABILITIES" };

describe("reprintAliases", () => {
  it("aliases a reprint's ability to the earlier card's own definition", () => {
    const later = reprintOf();
    const built = reprintAliases([later], CORE_CARDS, CORE_ABILITIES, wording);
    expect(built.pairs).toEqual([{ card: later, earlier: original }]);
    expect(built.registry[`99001.${slug}`]).toBe(CORE_ABILITIES[ref!.id]);
    expect(built.problems).toEqual([]);
  });

  it("skips a later card that is itself an earlier card", () => {
    const built = reprintAliases([original], CORE_CARDS, CORE_ABILITIES, wording);
    expect(built.pairs).toEqual([]);
    expect(built.registry).toEqual({});
  });

  it("pairs by name and type, never by name alone", () => {
    const built = reprintAliases(
      [reprintOf(undefined, { type: "ally" } as never)],
      CORE_CARDS,
      CORE_ABILITIES,
      wording,
    );
    expect(built.pairs.some((pair) => pair.earlier === original)).toBe(false);
  });

  it("refuses a reprint whose ability count differs", () => {
    const later = { ...reprintOf(), abilities: [] } as AnyCard;
    const built = reprintAliases([later], CORE_CARDS, CORE_ABILITIES, wording);
    expect(built.registry).toEqual({});
    expect(built.problems).toEqual([
      `99001 (${original.name}) matches ${original.id} by name/type but has 0 ability ref(s) against 1 — not auto-aliased, script by hand`,
    ]);
  });

  it("refuses a reprint whose ability slug differs, aliasing none of it", () => {
    const built = reprintAliases([reprintOf(() => "something-else")], CORE_CARDS, CORE_ABILITIES, wording);
    expect(built.registry).toEqual({});
    expect(built.problems).toEqual([
      `99001 (${original.name}) matches ${original.id} by name/type but ability #0 slugs differ (99001.something-else vs ${ref!.id}) — not auto-aliased, script by hand`,
    ]);
  });

  it("refuses a reprint of an unscripted ability, in the wave's own words", () => {
    const built = reprintAliases([reprintOf()], CORE_CARDS, {}, wording);
    expect(built.registry).toEqual({});
    expect(built.problems).toEqual([
      `99001 (${original.name}) matches ${original.id}, but ${ref!.id} is not in TEST_ABILITIES — not auto-aliased, script by hand`,
    ]);
  });
});
