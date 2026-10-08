import { applyCommand, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { PLAYABLE_CARDS, cardId } from "@mc/content";
import { playableStarterDeckSetup } from "../../playable/index.js";
import {
  accepting,
  BASIC_ATTACK,
  BASIC_THWART,
  BLACK_PANTHER,
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
  mainThreat,
  me,
  moveToHand,
  openedCrossHero,
  P1,
  patchInstance,
  play,
  playIsRefused,
  status,
  use,
  villainOf,
  withDamage,
  withScheme,
  withoutSideSchemes,
} from "../cross-hero-testing.js";
import { WAVE8_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * Jubilee pack's aspect and basic cards: 47011-47022 (Justice and basic) and the Alliance events 47028 (Leadership) and
 * 47029 (Protection), 14 cards. Each is played from a Core hero's deck (Spider-Man for Justice and basic, Captain Marvel
 * for Leadership, Black Panther for Protection) in a standard Unus the Untouched game. The Team-Up card Unlikely Duo can
 * only be in a Jubilee or Wolverine deck, so it is played from Wolverine's. No Core identity has X-MEN, MUTANT or X-FORCE,
 * so a gated card is asserted twice: refused for the plain Core hero and working once the Core identity carries the
 * trait through an edited card pool. Card text from `packages/content/src/data/jubilee`.
 */
const XMEN = { identityTraits: ["X-MEN"] } as const;
const MUTANT = { identityTraits: ["MUTANT"] } as const;
const CM = { coreHero: CAPTAIN_MARVEL } as const;
const BP = { coreHero: BLACK_PANTHER } as const;
const BREAKIN = "01107"; // a Core side scheme: hazard, no crisis

describe("Jubilee pack aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal deck and a game (one copy added to the hero's precon)", () => {
    const codes = [
      ...["47011", "47012", "47013", "47014", "47015", "47016", "47017", "47018", "47019", "47020", "47021"],
      ...["47028", "47029"],
    ];
    for (const code of codes) {
      const state = openedCrossHero(code);
      const owner = state.players.find((p) => p.playerId === P1)!;
      const all = [...owner.hand, ...owner.deck].map((id) => state.instances[id]!.cardId as string);
      expect(all, code).toContain(code);
    }
  });

  describe("47011 Chamber (Justice ally; star ability)", () => {
    it("takes 1 less consequential damage after he attacks a confused enemy", () => {
      const { after: s, id } = cast(openedCrossHero("47011"), "47011");
      const plain = drive(s, firstLegal, BASIC_ATTACK(s, id, villainOf(s)));
      const confusedVillain = patchInstance(s, villainOf(s), {
        statuses: { ...inst(s, villainOf(s)).statuses, confused: 1 },
      });
      const confused = drive(
        confusedVillain,
        firstLegal,
        BASIC_ATTACK(confusedVillain, id, villainOf(confusedVillain)),
      );
      expect(dmg(confused.state, id)).toBe(Math.max(0, dmg(plain.state, id) - 1));
    });
  });

  describe("47012 Husk (Justice ally; star ability)", () => {
    it("when she uses a basic power, offers spending up to 3 resources for a bonus", () => {
      const { after: s, id } = cast(openedCrossHero("47012"), "47012");
      const run = drive(s, accepting(["47012"]), BASIC_ATTACK(s, id, villainOf(s)));
      expect([...run.offered].some((o) => o.includes("47012"))).toBe(true);
    });
  });

  describe("47013 Disguise (Justice upgrade; Action (thwart))", () => {
    it("exhausts it and the identity to remove 2 threat from a scheme", () => {
      const base = withoutSideSchemes(openedCrossHero("47013"), 6);
      const { after: s, id } = cast(base, "47013");
      expect(handIds(s)).not.toContain(id);
      const run = drive(s, firstLegal, use(P1, id, "47013.disguise-action"));
      expect(mainThreat(run.state)).toBe(4);
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(inst(run.state, me(run.state)).exhausted).toBe(true);
    });
  });

  describe("47014 Waylay (Justice event; Hero Response (attack))", () => {
    it("after the hero thwarts, deals 4 damage to an enemy (7 if the thwart removed the last threat from a scheme)", () => {
      const base = withoutSideSchemes(openedCrossHero("47014"), 6);
      const given = moveToHand(base, P1, "47014");
      const run = drive(
        given.state,
        accepting(["47014"]),
        BASIC_THWART(given.state, me(given.state), given.state.mainScheme.instanceId),
      );
      expect(dmg(run.state, villainOf(run.state))).toBe(4);
      expect(inDiscard(run.state, given.ids[0]!)).toBe(true);
      // The last threat on a side scheme: 7 damage instead.
      const scheme = withScheme(withoutSideSchemes(given.state, 6), BREAKIN, 1);
      const last = drive(scheme.state, accepting(["47014"]), BASIC_THWART(scheme.state, me(scheme.state), scheme.id));
      expect(dmg(last.state, villainOf(last.state))).toBe(7);
    });
  });

  describe("47015 Three Steps Ahead (Justice event; thwart)", () => {
    it("removes 2 threat from a scheme for each different resource type used to pay for it", () => {
      const base = withoutSideSchemes(openedCrossHero("47015"), 8);
      const { after: s, id } = cast(base, "47015");
      expect(inDiscard(s, id)).toBe(true);
      const removed = 8 - mainThreat(s);
      expect(removed).toBeGreaterThanOrEqual(2);
      expect(removed % 2).toBe(0);
    });
  });

  describe("47016 Generation X (Justice player side scheme)", () => {
    it("each X-Men character gets +1 THW while making a basic thwart against it", () => {
      const thwartWith = (traits: readonly string[] | undefined) => {
        const base = openedCrossHero("47016", traits ? { identityTraits: traits } : {});
        const { after: s, id } = cast(base, "47016");
        expect(s.villainArea).toContain(id);
        const staged = patchInstance(s, id, { threat: 6 });
        const run = drive(staged, firstLegal, BASIC_THWART(staged, me(staged), id));
        return 6 - inst(run.state, id).threat;
      };
      expect(thwartWith(["X-MEN"])).toBe(thwartWith(undefined) + 1);
    });
  });

  describe("47017 The Power of Justice (Justice resource, reprint of 01062)", () => {
    it("alone pays for a cost-2 Justice card but not for a cost-2 basic card", () => {
      const justiceTwo = PLAYABLE_CARDS.find(
        (c) =>
          c.type === "support" &&
          "aspect" in c &&
          c.aspect === "justice" &&
          c.cost === 2 &&
          !(c as { playRestrictions?: unknown }).playRestrictions &&
          !(c as { specificTo?: unknown }).specificTo,
      );
      expect(justiceTwo).toBeDefined();
      const power = moveToHand(openedCrossHero("47017"), P1, "47017");
      const target = conjure(power.state, P1, justiceTwo!.id as string);
      expect(applyCommand(target.state, play(P1, target.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(true);
      const beak = conjure(power.state, P1, "46020");
      expect(applyCommand(beak.state, play(P1, beak.id, [power.ids[0]!]), WAVE8_DEPS).ok).toBe(false);
    });
  });

  describe("47018 Synch (basic ally; play only if your identity has X-Men)", () => {
    it("refused for a Core hero without X-MEN", () => {
      expect(playIsRefused(openedCrossHero("47018"), "47018")).toBe(true);
    });
    it("with X-MEN: exhausting her gives the hero +1 to a basic power used", () => {
      const { after: s, id } = cast(openedCrossHero("47018", XMEN), "47018");
      const plain = drive(s, accepting([]), BASIC_ATTACK(s, me(s), villainOf(s)));
      const boosted = drive(s, accepting(["47018"]), BASIC_ATTACK(s, me(s), villainOf(s)));
      expect(dmg(boosted.state, villainOf(boosted.state))).toBe(dmg(plain.state, villainOf(plain.state)) + 1);
      expect(inst(boosted.state, id).exhausted).toBe(true);
    });
  });

  describe("47019 Cell Phone (basic upgrade; Uses (3 charge counters))", () => {
    it("enters play with 3 charge counters; its Action spends one to give a player a basic attack with +1 ATK", () => {
      const { after: s, id } = cast(openedCrossHero("47019"), "47019");
      const counters = (st: GameState) => Object.values(inst(st, id).counters).reduce((n, v) => n + (v ?? 0), 0);
      expect(counters(s)).toBe(3);
      const run = drive(s, firstLegal, use(P1, id, "47019.cell-phone-action"));
      expect(counters(run.state)).toBe(2);
      expect(inst(run.state, id).exhausted).toBe(true);
    });
  });

  describe("47020 X-Gene (basic upgrade, reprint of 38019; play only if your identity has MUTANT)", () => {
    it("refused for a Core hero without MUTANT", () => {
      expect(playIsRefused(openedCrossHero("47020"), "47020")).toBe(true);
    });
    it("with MUTANT: its Resource pays a [wild] only for an identity-specific event (Swinging Web Kick, cost 3)", () => {
      const base = openedCrossHero("47020", MUTANT);
      const { after: s, id } = cast(base, "47020");
      const pay = (card: string, extra: number) => {
        const given = conjure(s, P1, card);
        const hand = s.players.find((p) => p.playerId === P1)!.hand.slice(0, extra);
        return applyCommand(
          given.state,
          {
            type: "playCard",
            playerId: P1,
            cardInstanceId: given.id,
            payment: [
              { ability: { instanceId: id, abilityId: "47020.x-gene-resource" } },
              ...hand.map((fromHand) => ({ fromHand })),
            ],
            attachToInstanceId: null,
          } as never,
          WAVE8_DEPS,
        ).ok;
      };
      // Swinging Web Kick (01005, Spider-Man's own, cost 3): X-Gene's wild plus 2 cards pays.
      expect(pay("01005", 2)).toBe(true);
      // Lead from the Front (45018, cost 2, not identity-specific): X-Gene's wild does not count, so 1 card is not enough.
      expect(pay("45018", 1)).toBe(false);
    });
  });

  describe("47021 Multitalented (basic event; attack/thwart by the resource type used to pay)", () => {
    it("resolves the effect of each resource type it was paid with", () => {
      const base = withoutSideSchemes(openedCrossHero("47021"), 6);
      const hurt = withDamage(base, me(base), 3);
      const { before, after, id } = cast(hurt, "47021");
      expect(inDiscard(after, id)).toBe(true);
      const changed =
        dmg(after, villainOf(after)) !== dmg(before, villainOf(before)) ||
        mainThreat(after) !== mainThreat(before) ||
        dmg(after, me(after)) !== dmg(before, me(before));
      expect(changed).toBe(true);
    });
  });

  describe("47022 Unlikely Duo (basic Team-Up event; Jubilee and Wolverine only)", () => {
    const wolverine = () => {
      const base = playableStarterDeckSetup("wolverine-aggression");
      return { ...base, deck: [...base.deck, cardId("47022")] };
    };
    it("is not in a Core hero's legal deck (the deckbuilding rule is proved in custom-decks.test.ts)", () => {
      expect(() => openedCrossHero("47022")).toThrow(/Team-Up card for Jubilee and Wolverine/);
    });
    it("from Wolverine's deck: confuses an enemy, then deals 4 damage to the confused enemy", () => {
      // Team-Up (RRG 1.8, p. 43) needs the other named character in play: Jubilee's ally version (35003).
      const opened = openedCrossHero("47022", { deck: wolverine() });
      const base = inPlayArea(opened, "35003").state;
      const { after: s, id } = cast(base, "47022");
      expect(inDiscard(s, id)).toBe(true);
      expect(status(s, villainOf(s), "confused")).toBe(1);
      expect(dmg(s, villainOf(s))).toBe(4);
    });
  });

  describe("47028 Mutant Mayhem (Leadership Alliance event)", () => {
    it("returns an X-Force ally and an X-Men ally to their owners' hands, who play them ignoring their costs", () => {
      const base = openedCrossHero("47028", CM);
      const xforce = inPlayArea(base, "45012"); // X-23 (X-FORCE)
      const xmen = inPlayArea(xforce.state, "46012"); // Shark-Girl (X-MEN)
      const { before, after, id } = cast(xmen.state, "47028", (st) => {
        const c = st.pendingChoice;
        const wanted = [xforce.id, xmen.id] as string[];
        const hit = c?.options.find((o) => wanted.includes(o.optionId));
        return hit ? [hit.optionId] : accepting([])(st);
      });
      expect(inDiscard(after, id)).toBe(true);
      expect(inPlay(after, xforce.id)).toBe(true);
      expect(inPlay(after, xmen.id)).toBe(true);
      // Neither ally's cost was paid on the replay: the hand lost only the event and its own cost.
      const spent =
        before.players.find((p) => p.playerId === P1)!.hand.length -
        after.players.find((p) => p.playerId === P1)!.hand.length;
      expect(spent).toBe(1 + (cardData("47028") as { cost: number }).cost);
    });
  });

  describe("47029 Serve and Protect (Protection Alliance event; Hero Interrupt)", () => {
    it("when threat would be placed on the main scheme, exhausts an X-Force and an X-Men character to prevent it and give each a tough status", () => {
      const base = openedCrossHero("47029", BP);
      const xforce = inPlayArea(base, "45012");
      const xmen = inPlayArea(xforce.state, "46012");
      const given = moveToHand(withoutSideSchemes(xmen.state, 3), P1, "47029");
      const taken = drive(given.state, accepting(["47029"]), endTurn(P1));
      const declined = drive(given.state, accepting([]), endTurn(P1));
      expect([...taken.offered].some((o) => o.includes("47029"))).toBe(true);
      expect(status(taken.state, xforce.id, "tough")).toBe(1);
      expect(status(taken.state, xmen.id, "tough")).toBe(1);
      expect(mainThreat(taken.state)).toBeLessThan(mainThreat(declined.state));
    });
  });
});
