import {
  activeEncounterDeck,
  applyCommand,
  cardsInPlay,
  characterProfile,
  legalActions,
  type GameState,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { PLAYABLE_CARDS } from "@mc/content";
import {
  accepting,
  BASIC_THWART,
  BLACK_PANTHER,
  cast,
  cardData,
  conjure,
  dmg,
  drive,
  endTurn,
  firstLegal,
  handIds,
  inDiscard,
  inPlay,
  inPlayArea,
  inst,
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
  status,
  villainOf,
  withDamage,
  withForm,
  withMinion,
  withoutSideSchemes,
} from "../cross-hero-testing.js";
import { WAVE8_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * Nightcrawler pack's aspect and basic cards: 48012-48025 (Protection and basic) and the Alliance events 48031
 * (Aggression) and 48032 (Justice), 16 cards. Each is played from a Core hero's deck (Black Panther for Protection,
 * She-Hulk for Aggression, Spider-Man for Justice and basic) in a standard Unus the Untouched game. Card text from
 * `packages/content/src/data/ncrawler`.
 */
const BP = { coreHero: BLACK_PANTHER } as const;
const SH = { coreHero: SHE_HULK } as const;
const MUTANT = { identityTraits: ["MUTANT"] } as const;
const SHOCKER = "01103"; // a Core minion: ATK 2, SCH 1, 3 hit points, no Guard

/** The first card of the active encounter pile that satisfies `test`, as a code. */
const encounterCode = (state: GameState, test: (code: string) => boolean): string => {
  const piles = activeEncounterDeck(state);
  const hit = [...piles.deck, ...piles.discard].map((i) => state.instances[i]!.cardId as string).find(test);
  if (!hit) throw new Error("no matching encounter card");
  return hit;
};
describe("Nightcrawler pack aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      ...["48012", "48013", "48014", "48015", "48016", "48017", "48018", "48019", "48020", "48021"],
      ...["48022", "48023", "48024", "48025", "48031", "48032"],
    ];
    expect(codes).toHaveLength(16);
    for (const code of codes) {
      const state = openedCrossHero(code);
      const owner = state.players.find((p) => p.playerId === P1)!;
      const all = [...owner.hand, ...owner.deck].map((id) => state.instances[id]!.cardId as string);
      expect(all, code).toContain(code);
    }
  });

  describe("48012 Rogue (Protection ally)", () => {
    it("Action: deals 1 damage to another friendly character; until the end of the round she adds its base ATK to hers", () => {
      const base = openedCrossHero("48012", BP);
      const xx = inPlayArea(base, "45012"); // X-23, ATK printed
      const { after: s, id } = cast(xx.state, "48012");
      const before = characterProfile(s, id, WAVE8_DEPS)!;
      // The engine's own example command carries the cost's damage target (the first friendly character it offers).
      const actions = legalActions(s, P1, WAVE8_DEPS);
      const hit =
        actions.kind === "turn"
          ? actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === id)
          : undefined;
      expect(hit).toBeDefined();
      const run = drive(s, firstLegal, hit!.example);
      expect(dmg(run.state, xx.id) + dmg(run.state, me(run.state))).toBe(1);
      const after = characterProfile(run.state, id, WAVE8_DEPS)!;
      expect(after.atk).toBeGreaterThan(before.atk);
      expect(after.atk - before.atk).toBeGreaterThan(0);
    });
  });

  describe("48013 Northstar (Protection ally)", () => {
    it("when a boost card is turned faceup during an attack, offers 1 damage to him to cancel its boost icons", () => {
      const base = openedCrossHero("48013", BP);
      const boosted = encounterCode(base, (code) => {
        const card = cardData(code) as { boostIcons?: number; boost?: unknown };
        return (
          code !== "01186" &&
          ((card.boostIcons ?? 0) > 0 || card.boost !== undefined) &&
          cardData(code).type !== "minion"
        );
      });
      const { after: s, id } = cast(stackEncounterDeck(base, boosted), "48013");
      const run = drive(s, accepting(["48013"], { defender: me(s) }), endTurn(P1));
      expect(inPlay(s, id)).toBe(true);
      // Offered whenever the boost card has at least one boost icon; the card chosen has.
      expect([...run.offered].some((o) => o.includes("48013"))).toBe(true);
      expect(dmg(run.state, id)).toBe(1);
    });
  });

  describe("48014 Change of Fortune (Protection upgrade; play under any player's control)", () => {
    it("enters play under the player's control", () => {
      const { after: s, id } = cast(openedCrossHero("48014", BP), "48014");
      expect(inst(s, id).controllerId).toBe(P1);
      expect(handIds(s)).not.toContain(id);
    });
  });

  describe("48015 Under Control (Protection upgrade; attach to a minion)", () => {
    it("attaches to a minion; after the hero defends against its attack and takes no damage, deals 4 damage to it", () => {
      const m = withMinion(withoutSideSchemes(openedCrossHero("48015", BP), 6), SHOCKER);
      const { after: attachedTo, id } = cast(m.state, "48015");
      expect(inst(attachedTo, id).attachedTo).toBe(m.id);
      // The villain is stunned so its attack does not exhaust the hero first: the minion's attack is the one defended.
      const s = patchInstance(attachedTo, villainOf(attachedTo), {
        statuses: { ...inst(attachedTo, villainOf(attachedTo)).statuses, stunned: 1 },
      });
      const run = drive(s, accepting(["48015"], { defender: me(s) }), endTurn(P1));
      // The hero defended Shocker's ATK 2 and took none of it (DEF stops it entirely), so the response dealt 4 damage.
      expect([...run.offered].some((o) => o.includes("48015"))).toBe(true);
      expect(run.events.some((e) => e.type === "damageDealt" && e.targetInstanceId === m.id && e.amount === 4)).toBe(
        true,
      );
    });
  });

  describe('48016 "Come Get Me, Bub!" (Protection event)', () => {
    it("discards encounter cards until a minion, engages it, heals 3 from the identity and gives it a tough status", () => {
      const base = openedCrossHero("48016", BP);
      const hurt = withDamage(base, me(base), 3);
      // A plain minion on top of the deck: Shocker (01103) takes the place of the first minion in Unus's encounter deck.
      const first = encounterCode(hurt, (code) => cardData(code).type === "minion");
      const piles = activeEncounterDeck(hurt);
      const slot = [...piles.deck, ...piles.discard].find((i) => hurt.instances[i]!.cardId === first)!;
      const swapped = patchInstance(hurt, slot, { cardId: SHOCKER as never });
      const { after: s, id } = cast(stackEncounterDeck(swapped, SHOCKER), "48016");
      expect(inDiscard(s, id)).toBe(true);
      expect(dmg(s, me(s))).toBe(0);
      expect(status(s, me(s), "tough")).toBe(1);
      expect(Object.values(s.instances).filter((i) => i.cardId === SHOCKER && i.engagedWith === P1)).toHaveLength(1);
    });
  });

  describe("48017 Powerful Punch (Protection event, reprint of 32014; Hero Interrupt)", () => {
    it("when an enemy initiates an attack, deals 4 damage to that enemy", () => {
      const given = moveToHand(openedCrossHero("48017", BP), P1, "48017");
      const run = drive(given.state, accepting(["48017"], { defender: me(given.state) }), endTurn(P1));
      expect([...run.offered].some((o) => o.includes("48017"))).toBe(true);
      expect(
        run.events.some(
          (e) => e.type === "damageDealt" && e.amount === 4 && e.targetInstanceId === villainOf(run.state),
        ),
      ).toBe(true);
      expect(inDiscard(run.state, given.ids[0]!)).toBe(true);
    });
  });

  describe("48018 Riposte (Protection event; Hero Interrupt (defense))", () => {
    it("when the hero defends, +2 DEF; taking no damage deals 3 damage to the attacker", () => {
      const given = moveToHand(openedCrossHero("48018", BP), P1, "48018");
      const run = drive(given.state, accepting(["48018"], { defender: me(given.state) }), endTurn(P1));
      expect([...run.offered].some((o) => o.includes("48018"))).toBe(true);
      expect(dmg(run.state, me(run.state))).toBe(0);
      // Riposte's own 3 damage to the attacker (the Black Panther's identity adds 1 more of its own, so not the total).
      expect(
        run.events.some((e) => e.type === "damageDealt" && e.amount === 3 && e.sourceInstanceId === given.ids[0]),
      ).toBe(true);
    });
  });

  describe("48019 The Power of Protection (Protection resource, reprint of 01079)", () => {
    it("alone pays for a cost-2 Protection card but not for a cost-2 basic card", () => {
      const protectionTwo = PLAYABLE_CARDS.find(
        (c) =>
          (c.type === "support" || c.type === "ally") &&
          "aspect" in c &&
          c.aspect === "protection" &&
          c.cost === 2 &&
          !(c as { playRestrictions?: unknown }).playRestrictions &&
          !(c as { specificTo?: unknown }).specificTo,
      );
      expect(protectionTwo).toBeDefined();
      const power = moveToHand(openedCrossHero("48019", BP), P1, "48019");
      const target = conjure(power.state, P1, protectionTwo!.id as string);
      expect(applyCommand(target.state, play(P1, target.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(true);
      const beak = conjure(power.state, P1, "46020");
      expect(applyCommand(beak.state, play(P1, beak.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(false);
    });
  });

  describe("48020 Astonishing X-Men (Protection player side scheme)", () => {
    it("enters the villain area; when defeated, stuns and confuses each enemy in play", () => {
      const base = withMinion(openedCrossHero("48020", BP), SHOCKER);
      const { after: s, id } = cast(base.state, "48020");
      expect(s.villainArea).toContain(id);
      const almost = patchInstance(s, id, { threat: 1 });
      const run = drive(almost, accepting(["48020"]), BASIC_THWART(almost, me(almost), id));
      for (const enemy of [villainOf(run.state), base.id]) {
        expect(status(run.state, enemy, "stunned")).toBe(1);
        expect(status(run.state, enemy, "confused")).toBe(1);
      }
    });
  });

  describe("48021 Gambit (basic ally)", () => {
    it("after he enters play, looks at the top 3 encounter cards and tucks one under him", () => {
      const base = openedCrossHero("48021");
      const piles = activeEncounterDeck(base).deck.length;
      const { after: s, id } = cast(base, "48021", accepting(["48021"]));
      expect(inPlay(s, id)).toBe(true);
      const under = inst(s, id).tucked.length + inst(s, id).boostCards.length;
      expect(under).toBe(1);
      expect(activeEncounterDeck(s).deck.length).toBe(piles - 1);
    });
  });

  describe("48022 Moira MacTaggert (basic support, reprint of 38018; play only if your identity has MUTANT)", () => {
    it("refused for a Core hero without MUTANT", () => {
      expect(playIsRefused(openedCrossHero("48022"), "48022")).toBe(true);
    });
    it("with MUTANT: after the alter-ego changes into hero form, exhausting her draws 1 card", () => {
      const alterEgo = withForm(openedCrossHero("48022", MUTANT), "alterEgo");
      const { after: s, id } = cast(alterEgo, "48022");
      const toHero = { type: "changeForm", playerId: P1 } as never;
      const taken = drive(s, accepting(["48022"]), toHero);
      const declined = drive(s, accepting([]), toHero);
      expect(handIds(taken.state).length).toBe(handIds(declined.state).length + 1);
      expect(inst(taken.state, id).exhausted).toBe(true);
    });
  });

  describe("48023 Energy, 48024 Genius, 48025 Strength (basic resources)", () => {
    it.each(["48023", "48024", "48025"])(
      "%s prints two icons and alone pays for a cost-2 card, not a cost-3 one",
      (code) => {
        const card = cardData(code) as { producesIcons?: Record<string, number>; type: string };
        expect(card.type).toBe("resource");
        expect(Object.values(card.producesIcons ?? {}).reduce((n, v) => n + (v ?? 0), 0)).toBe(2);
        const res = moveToHand(openedCrossHero(code, { coreHero: SPIDER_MAN }), P1, code);
        const two = conjure(res.state, P1, "46020"); // Beak, cost 2
        expect(applyCommand(two.state, play(P1, two.id, [res.ids[0]!]), WAVE8_DEPS).ok).toBe(true);
        const three = conjure(res.state, P1, "45020"); // Legion, cost 3
        expect(applyCommand(three.state, play(P1, three.id, [res.ids[0]!]), WAVE8_DEPS).ok).toBe(false);
      },
    );
  });

  describe("48031 Combine Forces (Aggression Alliance event)", () => {
    it("exhausts an X-Force and an X-Men character to defeat a non-Elite minion", () => {
      const base = openedCrossHero("48031", SH);
      const xforce = inPlayArea(base, "45012");
      const xmen = inPlayArea(xforce.state, "46012");
      const m = withMinion(xmen.state, SHOCKER);
      const { after: s, id } = cast(m.state, "48031");
      expect(inDiscard(s, id)).toBe(true);
      expect(cardsInPlay(s)).not.toContain(m.id);
      expect(inst(s, xforce.id).exhausted).toBe(true);
      expect(inst(s, xmen.id).exhausted).toBe(true);
    });
  });

  describe("48032 Gunboat Diplomacy (Justice Alliance event)", () => {
    it("exhausts an X-Force and an X-Men character; removes X threat and deals X damage, X their combined THW", () => {
      const base = withoutSideSchemes(openedCrossHero("48032"), 8);
      const xforce = inPlayArea(base, "45012");
      const xmen = inPlayArea(xforce.state, "46012");
      const x =
        characterProfile(xmen.state, xforce.id, WAVE8_DEPS)!.thw +
        characterProfile(xmen.state, xmen.id, WAVE8_DEPS)!.thw;
      const { before, after, id } = cast(xmen.state, "48032");
      expect(inDiscard(after, id)).toBe(true);
      expect(inst(after, xforce.id).exhausted).toBe(true);
      expect(inst(after, xmen.id).exhausted).toBe(true);
      // X threat removed from among schemes and X damage dealt among enemies (here the villain and no minion).
      const removed = 8 - after.instances[after.mainScheme.instanceId]!.threat;
      expect(removed).toBe(x);
      expect(dmg(after, villainOf(after)) - dmg(before, villainOf(before))).toBe(x);
    });
  });
});
