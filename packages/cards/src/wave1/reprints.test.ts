/**
 * The wave 1 reprint mechanism (docs/phase7-wave1-scripting.md "Reprints"). `reprints.ts` derives the reprint
 * list programmatically from `@mc/content`, so this test never hardcodes the 41 reprint ids — a later pack
 * silently adding or losing a reprint would change these counts and fail here.
 */
import { CORE_CARDS, WAVE1_CARDS } from "@mc/content";
import { CORE_ABILITIES } from "../core/index.js";
import { WAVE1_REPRINT_ABILITIES, wave1ReprintPairs } from "./reprints.js";

describe("wave 1 reprints", () => {
  it("finds 41 reprint pairs, matched by (name, type)", () => {
    const pairs = wave1ReprintPairs();
    expect(pairs).toHaveLength(41);
    for (const { wave1, core } of pairs) {
      expect(wave1.name).toBe(core.name);
      expect(wave1.type).toBe(core.type);
      expect(wave1.id).not.toBe(core.id);
    }
  });

  it("every reprint resolves to the exact same Core AbilityDefinition object", () => {
    const pairs = wave1ReprintPairs();
    let checked = 0;
    for (const { wave1: card, core } of pairs) {
      const wRefs =
        card.type === "hero_identity"
          ? [...card.hero.abilities, ...card.alterEgo.abilities]
          : "abilities" in card
            ? card.abilities
            : [];
      const cRefs =
        core.type === "hero_identity"
          ? [...core.hero.abilities, ...core.alterEgo.abilities]
          : "abilities" in core
            ? core.abilities
            : [];
      expect(wRefs.length).toBe(cRefs.length);
      wRefs.forEach((wRef, i) => {
        const cRef = cRefs[i]!;
        expect(WAVE1_REPRINT_ABILITIES[wRef.id]).toBe(CORE_ABILITIES[cRef.id]);
        checked++;
      });
    }
    // 24 ability ids across the 41 reprint cards carry an aliased slug (docs/phase7-wave1.md's task brief); the
    // rest (Energy/Genius/Strength etc.) print no ability at all, so there's nothing to alias for them.
    expect(checked).toBe(24);
  });

  it("does not alias the three named collisions: Hulk, She-Hulk, Iron Man", () => {
    // Hulk: an ally in Core (01050), a hero identity in `hlk` (10001a). She-Hulk: a hero identity in Core
    // (01019a), an ally in `hlk` (10013). Iron Man: a hero identity in Core (01029a), an ally in `drs` (09039).
    // FFG ruling Jan 26, 2026 (4, #7): the hero and the ally are different cards. (name, type) matching already
    // keeps them apart because `hero_identity` and `ally` are different `type`s — this test proves it stays true
    // rather than trusting that reasoning silently.
    const pairs = wave1ReprintPairs();
    for (const name of ["Hulk", "She-Hulk", "Iron Man"]) {
      const matchesForName = pairs.filter((p) => p.wave1.name === name);
      expect(matchesForName, name).toHaveLength(0);
    }
    const hulkAlly = CORE_CARDS.find((c) => c.name === "Hulk" && c.type === "ally");
    const hulkIdentity = WAVE1_CARDS.find((c) => c.name === "Hulk" && c.type === "hero_identity");
    const sheHulkIdentity = CORE_CARDS.find((c) => c.name === "She-Hulk" && c.type === "hero_identity");
    const sheHulkAlly = WAVE1_CARDS.find((c) => c.name === "She-Hulk" && c.type === "ally");
    const ironManIdentity = CORE_CARDS.find((c) => c.name === "Iron Man" && c.type === "hero_identity");
    const ironManAlly = WAVE1_CARDS.find((c) => c.name === "Iron Man" && c.type === "ally");
    expect(hulkAlly, "Core Hulk ally").toBeDefined();
    expect(hulkIdentity, "hlk Hulk identity").toBeDefined();
    expect(sheHulkIdentity, "Core She-Hulk identity").toBeDefined();
    expect(sheHulkAlly, "hlk She-Hulk ally").toBeDefined();
    expect(ironManIdentity, "Core Iron Man identity").toBeDefined();
    expect(ironManAlly, "drs Iron Man ally").toBeDefined();
  });

  it("counts reprints per pack (data sanity: cap has 8)", () => {
    const byPack = new Map<string, number>();
    for (const { wave1 } of wave1ReprintPairs()) {
      byPack.set(wave1.setCode as string, (byPack.get(wave1.setCode as string) ?? 0) + 1);
    }
    expect(byPack.get("cap")).toBe(8);
  });
});
