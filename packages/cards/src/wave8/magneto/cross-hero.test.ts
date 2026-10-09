import {
  activeEncounterDeck,
  applyCommand,
  cardsInPlay,
  characterProfile,
  legalActions,
  traitsOf,
  type GameState,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  accepting,
  BASIC_ATTACK,
  BASIC_THWART,
  CAPTAIN_MARVEL,
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
  mainThreat,
  me,
  moveToHand,
  openedCrossHero,
  P1,
  patchInstance,
  play,
  playIsRefused,
  playerOf,
  SPIDER_MAN,
  stackEncounterDeck,
  status,
  use,
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
 * Magneto pack's aspect and basic cards: 49012-49026 (Leadership and basic) and 49037 Children of the Atom, 16 cards.
 * 49033-49036 (Surge, Anole, Bling!, Indra) are Linked to New Recruits and can be in no deck, so they are proved only
 * through New Recruits. Each card is played from a Core hero's deck (Captain Marvel for Leadership, Spider-Man for basic)
 * in a standard Unus the Untouched game. Card text from `packages/content/src/data/magneto`.
 */
const CM = { coreHero: CAPTAIN_MARVEL } as const;
const XMEN = { identityTraits: ["X-MEN"] } as const;
const SHOCKER = "01103"; // a Core minion: ATK 2, SCH 1, 3 hit points, no Guard
const X23 = "45012"; // an X-FORCE ally
const SHARK_GIRL = "46012"; // an X-MEN ally

/** `pick` that chooses `wanted` ids when a prompt offers them, accepts `triggers`, and otherwise takes the first legal answer. */
const choosing =
  (wanted: readonly string[], triggers: readonly string[] = []) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    const hit = choice?.options.find((o) => wanted.includes(o.optionId));
    if (choice && choice.prompt.kind !== "chooseTriggers" && hit) return [hit.optionId];
    return accepting(triggers)(state);
  };

describe("Magneto pack aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      ...["49012", "49013", "49014", "49015", "49016", "49017", "49018", "49019", "49020", "49021"],
      ...["49022", "49023", "49024", "49025", "49026", "49037"],
    ];
    expect(codes).toHaveLength(16);
    for (const code of codes) {
      const state = openedCrossHero(code, code === "49020" ? XMEN : {});
      const owner = playerOf(state, P1);
      const all = [...owner.hand, ...owner.deck].map((id) => state.instances[id]!.cardId as string);
      expect(all, code).toContain(code);
    }
  });

  describe("49012 M (Leadership ally)", () => {
    it("after she enters play, defeats a minion with fewer remaining hit points than hers", () => {
      const m = withMinion(openedCrossHero("49012", CM), SHOCKER);
      const { after: s, id } = cast(m.state, "49012", accepting(["49012"]));
      expect(inPlay(s, id)).toBe(true);
      expect(cardsInPlay(s)).not.toContain(m.id);
    });
  });

  describe("49013 Kid Omega (Leadership ally)", () => {
    it("after he enters play, spending an [energy] resource deals 1 damage to each enemy (or a [mental] one removes 1 threat from each scheme)", () => {
      const base = withoutSideSchemes(openedCrossHero("49013", CM), 6);
      const m = withMinion(base, SHOCKER);
      const { before, after, id } = cast(m.state, "49013", accepting(["49013"]));
      expect(inPlay(after, id)).toBe(true);
      const dealt =
        dmg(after, m.id) === dmg(before, m.id) + 1 &&
        dmg(after, villainOf(after)) === dmg(before, villainOf(before)) + 1;
      const removed = mainThreat(after) === mainThreat(before) - 1;
      expect(dealt || removed).toBe(true);
    });
  });

  describe("49014 Phoenix (Leadership ally)", () => {
    it("after she enters play, readies a chosen X-Men ally and heals 1 damage from it", () => {
      const base = openedCrossHero("49014", CM);
      const ally = inPlayArea(base, SHARK_GIRL);
      const staged = patchInstance(withDamage(ally.state, ally.id, 2), ally.id, { exhausted: true });
      const { after: s } = cast(staged, "49014", choosing([ally.id as string], ["49014"]));
      expect(inst(s, ally.id).exhausted).toBe(false);
      expect(dmg(s, ally.id)).toBe(1);
    });
  });

  describe("49015 Cyclops (Leadership ally)", () => {
    it("after he enters play, the chosen enemy takes 1 more damage from each attack until the end of the phase", () => {
      const base = openedCrossHero("49015", CM);
      const { after: s } = cast(base, "49015", accepting(["49015"]));
      const marked = drive(s, firstLegal, BASIC_ATTACK(s, me(s), villainOf(s)));
      const { after: control } = cast(openedCrossHero("49015", CM), "49015", accepting([]));
      const plain = drive(control, firstLegal, BASIC_ATTACK(control, me(control), villainOf(control)));
      expect(dmg(marked.state, villainOf(marked.state))).toBe(dmg(plain.state, villainOf(plain.state)) + 1);
    });
  });

  describe("49016 Won't Stay Down (Leadership support; play only if your identity has X-Force or X-Men)", () => {
    it("refused for a Core hero with neither trait", () => {
      expect(playIsRefused(openedCrossHero("49016", CM), "49016")).toBe(true);
    });
    it("with X-MEN: Alter-Ego Action discards it to return an X-Force or X-Men ally from the discard pile to hand", () => {
      const base = withForm(openedCrossHero("49016", { ...CM, ...XMEN }), "alterEgo");
      const ally = conjure(base, P1, X23);
      const inPile = {
        ...ally.state,
        players: ally.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((h) => h !== ally.id), discard: [...p.discard, ally.id] } : p,
        ),
      };
      const { after: s, id } = cast(inPile, "49016");
      const run = drive(s, choosing([ally.id as string]), use(P1, id, "49016.wont-stay-down-action"));
      expect(handIds(run.state)).toContain(ally.id);
      expect(inDiscard(run.state, id)).toBe(true);
    });
  });

  describe("49017 Squared Off (Leadership event)", () => {
    it("discards encounter cards until a minion, engages it, then plays an ally from hand for 3 less", () => {
      const base = openedCrossHero("49017", CM);
      const cable = conjure(base, P1, "45011"); // Cable, cost 4: plays for 1
      const piles = activeEncounterDeck(cable.state);
      const first = [...piles.deck, ...piles.discard].find(
        (i) => cardData(cable.state.instances[i]!.cardId as string).type === "minion",
      )!;
      const swapped = patchInstance(cable.state, first, { cardId: SHOCKER as never });
      const { after: s, id } = cast(stackEncounterDeck(swapped, SHOCKER), "49017", choosing([cable.id as string]));
      expect(inDiscard(s, id)).toBe(true);
      expect(inPlay(s, cable.id)).toBe(true);
      expect(Object.values(s.instances).filter((i) => i.cardId === SHOCKER && i.engagedWith === P1)).toHaveLength(1);
    });
  });

  describe("49018 Noble Sacrifice (Leadership event)", () => {
    it("discards an ally to heal the hero by its printed hit points and give the hero a tough status", () => {
      const base = openedCrossHero("49018", CM);
      const ally = inPlayArea(base, SHARK_GIRL);
      const hurt = withDamage(ally.state, me(ally.state), 4);
      const { after: s, id } = cast(hurt, "49018");
      expect(inDiscard(s, id)).toBe(true);
      expect(inDiscard(s, ally.id)).toBe(true);
      expect(dmg(s, me(s))).toBeLessThan(4);
      expect(status(s, me(s), "tough")).toBe(1);
    });
  });

  describe('49019 "You Got This!" (Leadership event; Hero Response)', () => {
    it("after the hero exhausts to attack, discarding an ally adds its ATK to the hero's and readies the hero", () => {
      const base = openedCrossHero("49019", CM);
      const ally = inPlayArea(base, X23);
      const given = moveToHand(ally.state, P1, "49019");
      const plain = drive(
        given.state,
        accepting([]),
        BASIC_ATTACK(given.state, me(given.state), villainOf(given.state)),
      );
      const boosted = drive(
        given.state,
        choosing([ally.id as string], ["49019"]),
        BASIC_ATTACK(given.state, me(given.state), villainOf(given.state)),
      );
      expect(inDiscard(boosted.state, ally.id)).toBe(true);
      expect(inst(boosted.state, me(boosted.state)).exhausted).toBe(false);
      expect(dmg(boosted.state, villainOf(boosted.state))).toBeGreaterThan(dmg(plain.state, villainOf(plain.state)));
    });
  });

  describe("49020 New Recruits (Leadership player side scheme; play only if your identity has X-Men)", () => {
    it("refused for a Core hero without X-MEN", () => {
      expect(playIsRefused(openedCrossHero("49020", CM), "49020")).toBe(true);
    });
    it("with X-MEN: the deck's game sets aside the four Linked allies; defeating it adds one to a hand", () => {
      const base = openedCrossHero("49020", { ...CM, ...XMEN });
      const linked = ["49033", "49034", "49035", "49036"];
      const aside = Object.values(base.instances).filter((i) => linked.includes(i.cardId as string));
      expect(aside.map((i) => i.cardId).sort()).toEqual(linked);
      const { after: s, id } = cast(base, "49020");
      expect(s.villainArea).toContain(id);
      const almost = patchInstance(s, id, { threat: 1 });
      const run = drive(almost, firstLegal, BASIC_THWART(almost, me(almost), id));
      const gained = handIds(run.state).filter((h) => linked.includes(run.state.instances[h]!.cardId as string));
      expect(gained).toHaveLength(1);
    });
  });

  describe("49021 White Queen (basic ally; play only if your identity has X-Force or X-Men)", () => {
    it("refused for a Core hero with neither trait", () => {
      expect(playIsRefused(openedCrossHero("49021"), "49021")).toBe(true);
    });
    it("with X-MEN: after she enters play, discards a status card from a character", () => {
      const base = openedCrossHero("49021", XMEN);
      const stunned = patchInstance(base, villainOf(base), {
        statuses: { ...inst(base, villainOf(base)).statuses, stunned: 1 },
      });
      const { after: s, id } = cast(stunned, "49021", accepting(["49021"]));
      expect(inPlay(s, id)).toBe(true);
      expect(status(s, villainOf(s), "stunned")).toBe(0);
    });
  });

  describe("49022 Face the Past (basic event; Max 1 per deck)", () => {
    it("reveals the hero's nemesis minion, readies the hero and draws 3 cards, and is removed from the game", () => {
      const base = patchInstance(openedCrossHero("49022"), me(openedCrossHero("49022")), { exhausted: true });
      const { before, after, id } = cast(base, "49022");
      expect(inst(after, me(after)).exhausted).toBe(false);
      // The event leaves the hand (cost 0) and 3 cards are drawn.
      expect(handIds(after).length).toBe(handIds(before).length + 2);
      expect(inDiscard(after, id)).toBe(false);
      expect(handIds(after)).not.toContain(id);
      expect(Object.values(after.instances).some((i) => i.engagedWith === P1)).toBe(true);
    });
  });

  describe("49023 Deft Focus (basic upgrade, reprint of 16024)", () => {
    it("enters play, and its Hero Action exhausts it", () => {
      const { after: s, id } = cast(openedCrossHero("49023"), "49023");
      expect(inst(s, id).controllerId).toBe(P1);
      const actions = legalActions(s, P1, WAVE8_DEPS);
      const hit =
        actions.kind === "turn"
          ? actions.legal.find((a) => a.action.kind === "useAbility" && a.action.instanceId === id)
          : undefined;
      expect(hit).toBeDefined();
      const run = drive(s, firstLegal, hit!.example);
      expect(inst(run.state, id).exhausted).toBe(true);
    });
  });

  describe("49024 Energy, 49025 Genius, 49026 Strength (basic resources)", () => {
    it.each(["49024", "49025", "49026"])(
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

  describe("49037 Children of the Atom (basic support; play under any player's control)", () => {
    it("each X-Force, X-Men and X-Factor character the player controls gains all three traits", () => {
      const base = openedCrossHero("49037");
      const ally = inPlayArea(base, X23); // X-FORCE only
      const has = (st: GameState, trait: string): boolean =>
        traitsOf(st, ally.id, WAVE8_DEPS).some((t) => (t as string) === trait);
      expect(has(ally.state, "X-MEN")).toBe(false);
      const { after: s, id } = cast(ally.state, "49037");
      expect(inst(s, id).controllerId).toBe(P1);
      expect(has(s, "X-MEN")).toBe(true);
      expect(has(s, "X-FACTOR")).toBe(true);
      expect(has(s, "X-FORCE")).toBe(true);
      expect(characterProfile(s, ally.id, WAVE8_DEPS)).toBeDefined();
    });
  });
});
