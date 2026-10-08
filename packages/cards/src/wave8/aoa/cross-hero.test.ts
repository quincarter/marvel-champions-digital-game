import { applyCommand, characterProfile, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  accepting,
  attached,
  BASIC_ATTACK,
  BASIC_THWART,
  CAPTAIN_MARVEL,
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
  isPlayable,
  mainThreat,
  me,
  moveToHand,
  openedCrossHero,
  P1,
  patchInstance,
  play,
  playIsRefused,
  playerOf,
  printedCost,
  SHE_HULK,
  SPIDER_MAN,
  villainOf,
  withDamage,
  withForm,
  withMinion,
  withoutSideSchemes,
  withScheme,
} from "../cross-hero-testing.js";
import { WAVE8_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * Age of Apocalypse pack's aspect and basic cards: 45011-45024 (Leadership and basic) and 45041-45052 (Aggression and
 * basic), 26 cards. Each is played from a Core hero's deck (Captain Marvel for Leadership, She-Hulk for Aggression,
 * Spider-Man for basic) in a standard Unus the Untouched game, through the engine's own `legalActions` example command.
 * No Core identity has X-MEN, X-FORCE or MYSTIC, so a gated card is asserted twice: refused for the plain Core hero
 * (card text: "Play only if your identity has ..."), and working once the Core identity carries the trait through an
 * edited card pool (`identityTraits`; the rules are untouched). Card text quoted from `packages/content/src/data/aoa`.
 */
const CM = { coreHero: CAPTAIN_MARVEL } as const;
const SH = { coreHero: SHE_HULK } as const;
const XMEN = { identityTraits: ["X-MEN"] } as const;
const XFORCE = { identityTraits: ["X-FORCE"] } as const;
const MYSTIC = { identityTraits: ["MYSTIC"] } as const;
const SHOCKER = "01103"; // a Core minion: ATK 2, SCH 1, 3 hit points, no Guard
const BREAKIN = "01107"; // a Core side scheme: hazard, no crisis

const handCount = (s: GameState): number => handIds(s).length;
const deckCount = (s: GameState): number => playerOf(s, P1).deck.length;
const hpOf = (s: GameState, id: InstanceId): number => characterProfile(s, id, WAVE8_DEPS)!.maxHp;
/** A Core hero's own identity-specific ally (the Sidekick host). */
const identityAllyCode = (): string => {
  const ally = ["01011", "01012", "01013", "01014", "01015", "01016", "01017"].find(
    (code) => cardData(code)?.type === "ally",
  );
  return ally ?? "01012";
};

describe("Age of Apocalypse aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      ...["45011", "45012", "45013", "45014", "45015", "45016", "45017", "45018", "45019", "45020"],
      ...["45021", "45022", "45023", "45024", "45041", "45042", "45043", "45044", "45045", "45046"],
      ...["45047", "45048", "45049", "45050", "45051", "45052"],
    ];
    expect(codes).toHaveLength(26);
    for (const code of codes) {
      const state = openedCrossHero(code);
      const owner = playerOf(state, P1);
      const all = [...owner.hand, ...owner.deck].map((id) => state.instances[id]!.cardId as string);
      expect(all, code).toContain(code);
    }
  });

  describe("45011 Cable (Leadership ally)", () => {
    it("after he thwarts and defeats a side scheme, draws 1 card", () => {
      const base = openedCrossHero("45011", CM);
      const { after: s, id } = cast(base, "45011");
      expect(inPlay(s, id)).toBe(true);
      const scheme = withScheme(withoutSideSchemes(s, 6), BREAKIN, 1);
      const before = handCount(scheme.state);
      const run = drive(scheme.state, accepting(["45011"]), BASIC_THWART(scheme.state, id, scheme.id));
      expect(handCount(run.state)).toBe(before + 1);
      expect(run.offered.size).toBeGreaterThan(0);
    });
  });

  describe("45012 X-23 (Leadership ally)", () => {
    it("after she attacks and defeats an enemy, she readies", () => {
      const { after: s, id } = cast(openedCrossHero("45012", CM), "45012");
      const m = withMinion(s, SHOCKER, { damage: 2 });
      const run = drive(m.state, accepting(["45012"]), BASIC_ATTACK(m.state, id, m.id));
      expect(inst(run.state, id).exhausted).toBe(false);
      // Control: the same attack on the villain defeats nothing, so she stays exhausted.
      const control = drive(s, accepting(["45012"]), BASIC_ATTACK(s, id, villainOf(s)));
      expect(inst(control.state, id).exhausted).toBe(true);
    });
  });

  describe("45013 Team Training (Leadership support)", () => {
    it("each ally the player controls gets +1 hit point", () => {
      const base = openedCrossHero("45013", CM);
      const ally = inPlayArea(base, "45021");
      const hp = hpOf(ally.state, ally.id);
      const { after: s, id } = cast(ally.state, "45013");
      expect(inPlay(s, id)).toBe(true);
      expect(hpOf(s, ally.id)).toBe(hp + 1);
    });
  });

  describe("45014 Advanced Suit (Leadership upgrade; attach to an X-FORCE or X-MEN ally)", () => {
    it("is not offered with no such ally in play", () => {
      const s = openedCrossHero("45014", CM);
      const given = moveToHand(s, P1, "45014");
      expect(isPlayable(given.state, given.ids[0]!)).toBe(false);
    });
    it("attaches to X-23 (X-FORCE); after she defeats a minion, discarding a card heals her by that card's resources", () => {
      const base = openedCrossHero("45014", CM);
      const xx = inPlayArea(base, "45012");
      const { after: s, id } = cast(withDamage(xx.state, xx.id, 2), "45014");
      expect(inst(s, id).attachedTo).toBe(xx.id);
      const m = withMinion(s, SHOCKER, { damage: 2 });
      const before = dmg(m.state, xx.id);
      const run = drive(m.state, accepting(["45014"]), BASIC_ATTACK(m.state, xx.id, m.id));
      expect(dmg(run.state, xx.id)).toBeLessThan(before);
    });
  });

  describe("45015 Sidekick (Leadership upgrade; attach to an identity-specific ally)", () => {
    it("attaches to the hero's identity-specific ally and gives it +2 hit points; after a basic recovery heals 2 from it", () => {
      const base = openedCrossHero("45015", CM);
      const ally = inPlayArea(base, identityAllyCode());
      const hp = hpOf(ally.state, ally.id);
      const hurt = withDamage(ally.state, ally.id, 3);
      const { after: s, id } = cast(hurt, "45015");
      expect(inst(s, id).attachedTo).toBe(ally.id);
      expect(hpOf(s, ally.id)).toBe(hp + 2);
      const recovering = withDamage(withForm(s, "alterEgo"), me(s), 1);
      const run = drive(recovering, accepting(["45015"]), { type: "basicRecover", playerId: P1 } as never);
      expect(dmg(run.state, ally.id)).toBe(1);
    });
  });

  describe("45016 Side-by-Side (Leadership event; needs a sidekick)", () => {
    it("is not offered with no sidekick; with Sidekick on an ally it readies the hero and heals 1 from both characters", () => {
      const base = openedCrossHero("45016", CM);
      const given = moveToHand(base, P1, "45016");
      expect(isPlayable(given.state, given.ids[0]!)).toBe(false);
      const ally = inPlayArea(base, identityAllyCode());
      const suit = attached(ally.state, "45015", P1, ally.id);
      const staged = patchInstance(
        patchInstance(withDamage(withDamage(suit.state, me(suit.state), 2), ally.id, 2), ally.id, { exhausted: true }),
        me(suit.state),
        { exhausted: true },
      );
      const { after: s } = cast(staged, "45016");
      expect(inst(s, me(s)).exhausted).toBe(false);
      expect(inst(s, ally.id).exhausted).toBe(false);
    });
  });

  describe("45017 Suit Up (Leadership event; Alter-Ego Action)", () => {
    it("searches the deck and discard pile for an ally and an attachable upgrade and adds them to hand", () => {
      const base = withForm(openedCrossHero("45017", CM), "alterEgo");
      const ally = conjure(base, P1, "45012");
      const upgrade = conjure(ally.state, P1, "45014");
      const stocked = ((): GameState => {
        // Put both searchable cards in the deck rather than the hand.
        const ids = [ally.id, upgrade.id];
        return {
          ...upgrade.state,
          players: upgrade.state.players.map((p) =>
            p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => !ids.includes(i)), deck: [...p.deck, ...ids] } : p,
          ),
        };
      })();
      const wanted = [ally.id as string, upgrade.id as string];
      const { after, id } = cast(stocked, "45017", (s) => {
        const c = s.pendingChoice;
        const hit = c?.options.find((o) => wanted.includes(o.optionId));
        return hit ? [hit.optionId] : firstLegal(s);
      });
      expect(inDiscard(after, id)).toBe(true);
      expect(handIds(after)).toContain(ally.id);
      expect(handIds(after)).toContain(upgrade.id);
    });
  });

  describe("45018 Lead from the Front (Leadership event, reprint of 01070)", () => {
    it("gives the chosen player's characters +1 THW and +1 ATK until the end of the phase", () => {
      const base = openedCrossHero("45018", CM);
      const before = characterProfile(base, me(base), WAVE8_DEPS)!;
      const { after: s, id } = cast(base, "45018");
      expect(inDiscard(s, id)).toBe(true);
      const profile = characterProfile(s, me(s), WAVE8_DEPS)!;
      expect(profile.atk).toBe(before.atk + 1);
      expect(profile.thw).toBe(before.thw + 1);
    });
  });

  describe("45020 Legion (Leadership-basic ally; star ability)", () => {
    it("after he uses a basic power, discards the top card of the deck and resolves by its printed resource", () => {
      const { after: s, id } = cast(openedCrossHero("45020", CM), "45020");
      const m = withMinion(s, SHOCKER);
      const deck = deckCount(m.state);
      const run = drive(m.state, accepting(["45020"]), BASIC_ATTACK(m.state, id, m.id));
      expect(deckCount(run.state)).toBe(deck - 1);
    });
  });

  describe("45021 Marrow (basic ally; play only if your identity has X-FORCE or X-MEN)", () => {
    it("refused for a Core hero without either trait", () => {
      expect(playIsRefused(openedCrossHero("45021"), "45021")).toBe(true);
    });
    it.each([XFORCE, XMEN])("with %o: plays, and deals 2 damage to an enemy when she enters play", (traits) => {
      const base = openedCrossHero("45021", traits);
      const { after: s, id } = cast(base, "45021", accepting(["45021"]));
      expect(inPlay(s, id)).toBe(true);
      expect(dmg(s, villainOf(s))).toBe(2);
    });
  });

  describe("45041 Goldballs (Aggression ally; star ability)", () => {
    it("when he attacks, offers discarding up to 3 cards from the deck for +X ATK", () => {
      const { after: s, id } = cast(openedCrossHero("45041", SH), "45041");
      const m = withMinion(s, SHOCKER);
      const deck = deckCount(m.state);
      const pickAll = (st: GameState): string[] => {
        const c = st.pendingChoice;
        if (c?.prompt.kind === "chooseTriggers") return c.options.map((o) => o.optionId);
        return c ? c.options.slice(0, c.maxSelections).map((o) => o.optionId) : [];
      };
      const run = drive(m.state, pickAll, BASIC_ATTACK(m.state, id, m.id));
      expect([...run.offered].some((o) => o.includes("45041"))).toBe(true);
      expect(deckCount(run.state)).toBeLessThan(deck);
    });
  });

  describe("45042 Tempus (Aggression ally; play only if your identity has X-MEN)", () => {
    it("refused for a Core hero without X-MEN", () => {
      expect(playIsRefused(openedCrossHero("45042", SH), "45042")).toBe(true);
    });
    it("with X-MEN: discarding her cancels the villain's scheme and deals the player a facedown encounter card", () => {
      // The villain schemes against an alter-ego player (RRG 1.8 "Villain Phase", Appendix II), so the identity is in alter-ego form.
      const base = withForm(openedCrossHero("45042", { ...SH, ...XMEN }), "alterEgo");
      const { after: s, id } = cast(withoutSideSchemes(base, 6), "45042");
      const declined = drive(s, firstLegal, endTurn(P1));
      const taken = drive(s, accepting(["45042"]), endTurn(P1));
      expect(inDiscard(taken.state, id)).toBe(true);
      expect(inPlay(declined.state, id)).toBe(true);
      expect(mainThreat(taken.state)).toBeLessThan(mainThreat(declined.state));
    });
  });

  describe("45043 Blood Rage (Aggression upgrade)", () => {
    it("after the hero defeats an enemy with a basic attack, exhausting it and taking 1 damage draws 1 card", () => {
      const { after: s, id } = cast(openedCrossHero("45043", SH), "45043");
      expect(inst(s, id).attachedTo !== null || inPlay(s, id)).toBe(true);
      const m = withMinion(s, SHOCKER, { damage: 2 });
      const hand = handCount(m.state);
      const run = drive(m.state, accepting(["45043"]), BASIC_ATTACK(m.state, me(m.state), m.id));
      expect(handCount(run.state)).toBe(hand + 1);
      expect(dmg(run.state, me(run.state))).toBeGreaterThanOrEqual(1);
    });
  });

  describe("45044 Test the Defense (Aggression upgrade)", () => {
    it("after the player plays an ATTACK event, places a test counter on it", () => {
      const { after: s, id } = cast(openedCrossHero("45044", SH), "45044");
      const clobber = conjure(s, P1, "45046");
      const run = drive(
        clobber.state,
        accepting(["45044"]),
        play(P1, clobber.id, [
          ...handIds(clobber.state)
            .filter((h) => h !== clobber.id)
            .slice(0, 2),
        ]),
      );
      expect(Object.values(inst(run.state, id).counters).reduce((n, v) => n + (v ?? 0), 0)).toBe(1);
    });
  });

  describe("45045 Full-Body Charge (Aggression event)", () => {
    it("deals 8 damage to an enemy (here the villain)", () => {
      const base = openedCrossHero("45045", SH);
      const { after: s, id } = cast(base, "45045");
      expect(inDiscard(s, id)).toBe(true);
      expect(dmg(s, villainOf(s))).toBe(8);
    });
  });

  describe("45046 Clobber (Aggression event, reprint of 18012)", () => {
    it("deals 3 damage, and as the first card played this round returns to the hand", () => {
      const { after: s, id } = cast(openedCrossHero("45046", SH), "45046");
      expect(dmg(s, villainOf(s))).toBe(3);
      expect(handIds(s)).toContain(id);
    });
  });

  describe("45048 Triage (basic ally; heal 2 damage from an X-Men character)", () => {
    it("with an X-MEN identity: heals 2 damage from the identity when she enters play", () => {
      const base = openedCrossHero("45048", XMEN);
      const hurt = withDamage(base, me(base), 3);
      const { after: s, id } = cast(hurt, "45048", accepting(["45048"]));
      expect(inPlay(s, id)).toBe(true);
      expect(dmg(s, me(s))).toBe(1);
    });
    it("plays for a plain Core hero too (no play restriction), and heals no one", () => {
      const { after: s, id } = cast(openedCrossHero("45048"), "45048");
      expect(inPlay(s, id)).toBe(true);
    });
  });

  describe("45049 Stepford Cuckoos (basic support; play only if your identity has X-Men)", () => {
    it("refused for a Core hero without X-MEN", () => {
      expect(playIsRefused(openedCrossHero("45049"), "45049")).toBe(true);
    });
    it("with X-MEN: enters play with its 3 psi counters", () => {
      const { after: s, id } = cast(openedCrossHero("45049", XMEN), "45049");
      expect(inPlay(s, id)).toBe(true);
      expect(Object.values(inst(s, id).counters).reduce((n, v) => n + (v ?? 0), 0)).toBe(3);
    });
  });

  describe("45050 Bloodgem (basic upgrade; play only if your identity has MYSTIC)", () => {
    it("refused for a Core hero without MYSTIC", () => {
      expect(playIsRefused(openedCrossHero("45050"), "45050")).toBe(true);
    });
    it("with MYSTIC: its Resource ability exhausts it and takes 2 damage to pay for a card", () => {
      const base = openedCrossHero("45050", MYSTIC);
      const { after: s, id } = cast(base, "45050");
      const target = conjure(s, P1, "45013"); // Team Training, cost 2 (Leadership; paid regardless of aspect)
      const pay = [{ ability: { instanceId: id, abilityId: "45050.bloodgem-resource" } }] as never;
      const other = handIds(target.state).find((h) => h !== target.id)!;
      const command = {
        type: "playCard",
        playerId: P1,
        cardInstanceId: target.id,
        payment: [...(pay as unknown as object[]), { fromHand: other }],
        attachToInstanceId: null,
      } as never;
      const result = applyCommand(target.state, command, WAVE8_DEPS);
      expect(result.ok).toBe(true);
      if (result.ok) expect(dmg(result.state, me(result.state))).toBe(2);
    });
  });

  describe("45051 Basic Spell (basic event; play only if your identity has MYSTIC)", () => {
    it("refused for a Core hero without MYSTIC", () => {
      expect(playIsRefused(openedCrossHero("45051"), "45051")).toBe(true);
    });
    it("with MYSTIC: resolves one of its three effects (heal 3, remove 3 threat, or 3 damage to an enemy)", () => {
      const base = openedCrossHero("45051", MYSTIC);
      const hurt = withDamage(base, me(base), 3);
      const { before, after, id } = cast(hurt, "45051");
      expect(inDiscard(after, id)).toBe(true);
      const changed =
        dmg(after, me(after)) !== dmg(before, me(before)) ||
        mainThreat(after) !== mainThreat(before) ||
        dmg(after, villainOf(after)) !== dmg(before, villainOf(before));
      expect(changed).toBe(true);
    });
  });

  describe("45052 Spiritual Meditation (basic event, reprint of 15019; play only if your identity has Mystic)", () => {
    it("refused for a Core hero without MYSTIC", () => {
      expect(playIsRefused(openedCrossHero("45052"), "45052")).toBe(true);
    });
    it("with MYSTIC: draws 2 and discards 1, at no cost", () => {
      const base = openedCrossHero("45052", MYSTIC);
      const { before, after, id } = cast(base, "45052");
      expect(inDiscard(after, id)).toBe(true);
      expect(deckCount(after)).toBe(deckCount(before) - 2);
      expect(handCount(after)).toBe(handCount(before) - 1 + 2 - 1);
    });
  });

  describe("resources (the Power of ... cards double for their aspect; Energy, Genius and Strength print one icon)", () => {
    const costTwo = (aspect: string, types: readonly string[]): string =>
      (
        [...new Set(["45013", "46021", "47019", "48022", "45041", "46012", "46020"])]
          .map(cardData)
          .find(
            (c) =>
              "aspect" in c && c.aspect === aspect && types.includes(c.type) && (c as { cost?: number }).cost === 2,
          ) ?? cardData("45013")
      ).id as string;

    it("The Power of Leadership alone pays for a cost-2 Leadership card (Team Training) but not for a cost-2 basic card", () => {
      const base = openedCrossHero("45019", CM);
      const power = moveToHand(base, P1, "45019");
      const training = conjure(power.state, P1, "45013");
      expect(applyCommand(training.state, play(P1, training.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(true);
      const beak = conjure(power.state, P1, "46020"); // Beak, basic, cost 2
      expect(applyCommand(beak.state, play(P1, beak.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(false);
      expect(printedCost(costTwo("leadership", ["support"]))).toBe(2);
    });
    it("The Power of Aggression alone pays for a cost-2 Aggression card (Clobber) but not for a cost-2 basic card", () => {
      const base = openedCrossHero("45047", SH);
      const power = moveToHand(base, P1, "45047");
      const clobber = conjure(power.state, P1, "45046");
      expect(applyCommand(clobber.state, play(P1, clobber.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(true);
      const beak = conjure(power.state, P1, "46020");
      expect(applyCommand(beak.state, play(P1, beak.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(false);
    });
    it.each(["45022", "45023", "45024"])(
      "%s Energy, Genius or Strength prints two icons and alone pays for a cost-2 card, not a cost-3 one",
      (code) => {
        const card = cardData(code) as { producesIcons?: Record<string, number>; type: string };
        expect(card.type).toBe("resource");
        expect(Object.values(card.producesIcons ?? {}).reduce((n, v) => n + (v ?? 0), 0)).toBe(2);
        const res = moveToHand(openedCrossHero(code, { coreHero: SPIDER_MAN }), P1, code);
        const training = conjure(res.state, P1, "45013"); // Team Training, cost 2
        expect(applyCommand(training.state, play(P1, training.id, [res.ids[0]!]), WAVE8_DEPS).ok).toBe(true);
        const legion = conjure(res.state, P1, "45020"); // Legion, cost 3
        expect(applyCommand(legion.state, play(P1, legion.id, [res.ids[0]!]), WAVE8_DEPS).ok).toBe(false);
      },
    );
  });
});
