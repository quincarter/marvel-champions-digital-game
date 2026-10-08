import { activeEncounterDeck, applyCommand, characterProfile, countSchemeIcons, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  accepting,
  attached,
  BASIC_ATTACK,
  BASIC_THWART,
  cast,
  cardData,
  conjure,
  dmg,
  drive,
  firstLegal,
  handIds,
  inDiscard,
  inPlay,
  inPlayArea,
  inst,
  isPlayable,
  mainThreat,
  me,
  moveToHand,
  openedCrossHero,
  P1,
  patchInstance,
  play,
  playIsRefused,
  SHE_HULK,
  SPIDER_MAN,
  stackEncounterDeck,
  villainOf,
  withDamage,
  withForm,
  withMinion,
  withScheme,
  withoutSideSchemes,
} from "../cross-hero-testing.js";
import { WAVE8_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * Iceman pack's aspect and basic cards, 46012-46023 (12 cards): Aggression 46012-46018 and basic 46019-46023. Each is
 * played from a Core hero's deck (She-Hulk for Aggression, Spider-Man for basic) in a standard Unus the Untouched game.
 * The upgrade-keyed cards are staged with a Core upgrade (Suppressing Fire 46014, attached by surgery) on the enemy, the
 * way the card's text reads: "an enemy with an upgrade attached". Card text from `packages/content/src/data/iceman`.
 */
const SH = { coreHero: SHE_HULK } as const;
const XMEN = { identityTraits: ["X-MEN"] } as const;
const SHOCKER = "01103"; // a Core minion: ATK 2, SCH 1, 3 hit points, no Guard
const CROWD_CONTROL = "01108"; // a Core side scheme with a crisis icon
const UPGRADE = "46014"; // any upgrade: Suppressing Fire

describe("Iceman pack aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      "46012",
      "46013",
      "46014",
      "46015",
      "46016",
      "46017",
      "46018",
      "46019",
      "46020",
      "46021",
      "46022",
      "46023",
    ];
    for (const code of codes) {
      const state = openedCrossHero(code);
      const owner = state.players.find((p) => p.playerId === P1)!;
      const all = [...owner.hand, ...owner.deck].map((id) => state.instances[id]!.cardId as string);
      expect(all, code).toContain(code);
    }
  });

  describe("46012 Shark-Girl (Aggression ally; star ability)", () => {
    it("gets +1 ATK for each upgrade attached to the enemy she attacks", () => {
      const { after: s, id } = cast(openedCrossHero("46012", SH), "46012");
      const bare = drive(s, firstLegal, BASIC_ATTACK(s, id, villainOf(s)));
      const marked = attached(s, UPGRADE, P1, villainOf(s));
      const run = drive(marked.state, firstLegal, BASIC_ATTACK(marked.state, id, villainOf(marked.state)));
      expect(dmg(run.state, villainOf(run.state))).toBe(dmg(bare.state, villainOf(bare.state)) + 1);
    });
  });

  describe("46013 Glob (Aggression ally; play only if your identity has X-Men)", () => {
    it("refused for a Core hero without X-MEN", () => {
      expect(playIsRefused(openedCrossHero("46013", SH), "46013")).toBe(true);
    });
    it("with X-MEN: deals 2 damage to an enemy with an upgrade attached when he enters play", () => {
      const base = openedCrossHero("46013", { ...SH, ...XMEN });
      const marked = attached(base, UPGRADE, P1, villainOf(base));
      const { after: s, id } = cast(marked.state, "46013", accepting(["46013"]));
      expect(inPlay(s, id)).toBe(true);
      expect(dmg(s, villainOf(s))).toBe(2);
    });
  });

  describe("46014 Suppressing Fire (Aggression upgrade; attach to a minion)", () => {
    it("is not offered with no minion in play", () => {
      const given = moveToHand(openedCrossHero("46014", SH), P1, "46014");
      expect(isPlayable(given.state, given.ids[0]!)).toBe(false);
    });
    it("attaches to a minion; when the hero attacks and defeats it, heals 2 damage from the hero", () => {
      const m = withMinion(openedCrossHero("46014", SH), SHOCKER, { damage: 2 });
      const { after: s, id } = cast(m.state, "46014");
      expect(inst(s, id).attachedTo).toBe(m.id);
      const hurt = withDamage(s, me(s), 3);
      const run = drive(hurt, accepting(["46014"]), BASIC_ATTACK(hurt, me(hurt), m.id));
      expect(dmg(run.state, me(run.state))).toBe(1);
    });
  });

  describe("46015 Surprise Move (Aggression event; Hero Interrupt)", () => {
    it("on a basic attack against an enemy with an upgrade attached, the hero gets +2 ATK for the attack", () => {
      const base = openedCrossHero("46015", SH);
      const marked = attached(base, UPGRADE, P1, villainOf(base));
      const given = moveToHand(marked.state, P1, "46015");
      const plain = drive(
        given.state,
        accepting([]),
        BASIC_ATTACK(given.state, me(given.state), villainOf(given.state)),
      );
      const boosted = drive(
        given.state,
        accepting(["46015"]),
        BASIC_ATTACK(given.state, me(given.state), villainOf(given.state)),
      );
      expect(dmg(boosted.state, villainOf(boosted.state))).toBe(dmg(plain.state, villainOf(plain.state)) + 2);
      expect(inDiscard(boosted.state, given.ids[0]!)).toBe(true);
    });
    it("is not offered when the enemy has no upgrade attached", () => {
      const given = moveToHand(openedCrossHero("46015", SH), P1, "46015");
      const run = drive(
        given.state,
        accepting(["46015"]),
        BASIC_ATTACK(given.state, me(given.state), villainOf(given.state)),
      );
      expect([...run.offered].some((o) => o.includes("46015"))).toBe(false);
    });
  });

  describe("46016 Take That! (Aggression event)", () => {
    it("is not offered with no enemy bearing an upgrade", () => {
      const given = moveToHand(openedCrossHero("46016", SH), P1, "46016");
      expect(isPlayable(given.state, given.ids[0]!)).toBe(false);
    });
    it("deals 7 damage to an enemy with an upgrade attached", () => {
      const base = openedCrossHero("46016", SH);
      const marked = attached(base, UPGRADE, P1, villainOf(base));
      const { after: s, id } = cast(marked.state, "46016");
      expect(inDiscard(s, id)).toBe(true);
      expect(dmg(s, villainOf(s))).toBe(7);
    });
  });

  describe("46017 Looking for Trouble (Aggression event; thwart)", () => {
    it("discards encounter cards until a minion, puts it into play engaged with the player, and removes 3 threat from the main scheme", () => {
      const base = withoutSideSchemes(openedCrossHero("46017", SH), 6);
      // A minion that is really in Unus's encounter deck (the standard set's), put on top.
      const piles = activeEncounterDeck(base);
      const minion = [...piles.deck, ...piles.discard]
        .map((i) => base.instances[i]!)
        .find((i) => cardData(i.cardId as string).type === "minion")!;
      const code = minion.cardId as string;
      const stacked = stackEncounterDeck(base, code);
      const { after: s } = cast(stacked, "46017");
      expect(mainThreat(s)).toBe(3);
      const engaged = Object.values(s.instances).filter((i) => i.cardId === code && i.engagedWith === P1);
      expect(engaged).toHaveLength(1);
    });
  });

  describe("46018 Keep Up the Pressure (Aggression player side scheme)", () => {
    it("enters the villain area as a side scheme with threat", () => {
      const { after: s, id } = cast(openedCrossHero("46018", SH), "46018");
      expect(s.villainArea).toContain(id);
      expect(inst(s, id).threat).toBeGreaterThan(0);
    });
    it("when defeated, a player may search for an Attack event and add it to hand", () => {
      const base = openedCrossHero("46018", SH);
      const clobber = conjure(base, P1, "45046");
      const stocked = {
        ...clobber.state,
        players: clobber.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((h) => h !== clobber.id), deck: [...p.deck, clobber.id] } : p,
        ),
      };
      const { after: s, id } = cast(stocked, "46018");
      const almost = patchInstance(s, id, { threat: 1 });
      const pick = (st: GameState): readonly string[] => {
        const c = st.pendingChoice;
        const hit = c?.options.find((o) => o.optionId === clobber.id);
        return hit ? [hit.optionId] : accepting(["46018"])(st);
      };
      const run = drive(almost, pick, BASIC_THWART(almost, me(almost), id));
      expect(handIds(run.state)).toContain(clobber.id);
    });
  });

  describe("46019 Shadowcat (basic ally; play only if your identity has X-Men)", () => {
    it("refused for a Core hero without X-MEN", () => {
      expect(playIsRefused(openedCrossHero("46019"), "46019")).toBe(true);
    });
    it("with X-MEN: after she is played, a chosen side scheme loses its crisis icon until the end of the round", () => {
      const base = openedCrossHero("46019", XMEN);
      const scheme = withScheme(withoutSideSchemes(base, 6), CROWD_CONTROL, 3);
      const crisisBefore = countSchemeIcons(scheme.state, WAVE8_DEPS, "crisis");
      expect(crisisBefore).toBeGreaterThan(0);
      const { after: s, id } = cast(scheme.state, "46019", accepting(["46019"]));
      expect(inPlay(s, id)).toBe(true);
      expect(countSchemeIcons(s, WAVE8_DEPS, "crisis")).toBeLessThan(crisisBefore);
    });
  });

  describe("46020 Beak (basic ally)", () => {
    it("after she is played from hand, removes 1 threat from a scheme for each X-Men ally the player controls (herself included)", () => {
      const base = withoutSideSchemes(openedCrossHero("46020"), 6);
      const alone = cast(base, "46020", accepting(["46020"]));
      expect(mainThreat(alone.after)).toBe(5);
      const other = inPlayArea(base, "46012"); // Shark-Girl, an X-MEN ally
      const pair = cast(other.state, "46020", accepting(["46020"]));
      expect(mainThreat(pair.after)).toBe(4);
    });
  });

  describe("46021 Team-Building Exercise (basic support; the Q27 play-from-hand interaction is proved in rulings.qa.test.ts)", () => {
    it("enters play from a Core hero's deck, and its Hero Action exhausts it", () => {
      const { after: s, id } = cast(openedCrossHero("46021"), "46021");
      expect(inPlay(s, id)).toBe(true);
      const used = applyCommand(
        s,
        {
          type: "useAbility",
          playerId: P1,
          cardInstanceId: id,
          abilityId: "46021.team-building-exercise-action",
          payment: [],
        } as never,
        WAVE8_DEPS,
      );
      expect(used.ok).toBe(true);
      if (used.ok) expect(inst(used.state, id).exhausted).toBe(true);
    });
  });

  describe("46022 Recuperation (basic event; Alter-Ego Action)", () => {
    it("heals damage from the alter-ego equal to its REC", () => {
      const base = withForm(openedCrossHero("46022"), "alterEgo");
      const hurt = withDamage(base, me(base), 5);
      const rec = characterProfile(hurt, me(hurt), WAVE8_DEPS)!.rec;
      const { after: s, id } = cast(hurt, "46022");
      expect(inDiscard(s, id)).toBe(true);
      expect(dmg(s, me(s))).toBe(Math.max(0, 5 - rec));
    });
  });

  describe("46023 The Power in All of Us (basic resource)", () => {
    it("alone pays for a cost-2 basic card (Beak) but not for a cost-2 Leadership card (Team Training)", () => {
      const power = moveToHand(openedCrossHero("46023", { coreHero: SPIDER_MAN }), P1, "46023");
      const beak = conjure(power.state, P1, "46020");
      expect(applyCommand(beak.state, play(P1, beak.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(true);
      const training = conjure(power.state, P1, "45013");
      expect(applyCommand(training.state, play(P1, training.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(false);
      expect(cardData("46023").type).toBe("resource");
    });
  });
});
