import {
  activeVillain,
  applyCommand,
  characterProfile,
  legalActions,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
} from "../../testing/harness.js";
import { withDamage, withForm } from "../../testing/staging.js";
import {
  accepting,
  acceptingAndPicking,
  basicAttackCmd,
  basicThwartCmd,
  BLACK_PANTHER,
  CAPTAIN_MARVEL,
  codesOf,
  conjure,
  conjureInHand,
  drive,
  openedCrossHero,
  openedHero,
  printedCost,
  SHE_HULK,
  spawnMinion,
  spawnSideScheme,
  wasOffered,
  withoutSideSchemes,
} from "../cross-hero-testing.js";
import { WAVE7_CARDS, WAVE7_DEPS, wave7StarterDeckSetup } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * angel pack's aspect and basic cards: 42011-42020, 42022, 42023, 42029-42032 (16 cards; 42021 Soaring Hearts is a
 * Team-Up card and is out of this slice). Each is played from a Core hero's deck (Black Panther for Protection,
 * She-Hulk for Aggression, Captain Marvel for Leadership, Spider-Man for Justice and basic) in a Morlock Siege game
 * (Blockbuster, villain ATK 2). No Core identity has AERIAL, X-FORCE or X-MEN, so a gated card is asserted twice:
 * refused or inert for the plain Core hero (card text: "Play only if your identity has ...", "exhaust an AERIAL
 * character you control" as a cost), and working once the Core identity carries the trait through an edited card pool
 * (`identityTraits`; the rules are untouched).
 */
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const dmg = (state: GameState, id: InstanceId): number => inst(state, id).damage;
const handIds = (state: GameState): readonly InstanceId[] => playerOf(state, P1).hand;
const inPlay = (state: GameState, id: InstanceId): boolean => playerOf(state, P1).playArea.includes(id);
const status = (state: GameState, id: InstanceId, name: "stunned" | "confused" | "tough"): number =>
  inst(state, id).statuses[name] ?? 0;
const me = (state: GameState): InstanceId => identityOf(state, P1);

function cast(
  state: GameState,
  code: string,
  opts: { pay?: readonly InstanceId[]; pick?: ReturnType<typeof accepting>; attach?: InstanceId } = {},
) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const pay = opts.pay ?? payWith(given.state, P1, printedCost(code), [id]);
  const run = drive(
    given.state,
    opts.pick ?? firstLegal,
    play(P1, id, pay, opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { ...run, id };
}

function expectRefused(state: GameState, code: string): void {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const actions = legalActions(given.state, P1, WAVE7_DEPS);
  expect(
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id),
  ).toBe(false);
  expect(
    applyCommand(given.state, play(P1, id, payWith(given.state, P1, printedCost(code), [id])), WAVE7_DEPS).ok,
  ).toBe(false);
}

const AERIAL = { identityTraits: ["AERIAL"] } as const;
const XFORCE = { identityTraits: ["X-FORCE"] } as const;
const BP = { coreHero: BLACK_PANTHER } as const;
/** The blank Advance (01186) as the boost card, so a villain attack carries no boost effect. */
const quietBoost = (state: GameState): GameState => stackEncounterDeck(state, "01186");

describe("angel pack aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      "42011",
      "42012",
      "42013",
      "42014",
      "42015",
      "42016",
      "42017",
      "42018",
      "42019",
      "42020",
      "42022",
      "42023",
      "42029",
      "42030",
      "42031",
      "42032",
    ];
    expect(codes).toHaveLength(16);
    for (const code of codes) {
      const card = WAVE7_CARDS.find((c) => (c.id as string) === code)!;
      const aspect = "aspect" in card ? card.aspect : "basic";
      const hero =
        aspect === "leadership"
          ? CAPTAIN_MARVEL
          : aspect === "aggression"
            ? SHE_HULK
            : aspect === "protection"
              ? BLACK_PANTHER
              : undefined;
      const state = openedCrossHero(code, hero ? { coreHero: hero } : {});
      const all = [...playerOf(state, P1).hand, ...playerOf(state, P1).deck];
      expect(codesOf(state, all), code).toContain(code);
    }
  });

  describe("42011 Elixir (protection ally; play only if your identity has X-Force or X-Men)", () => {
    it("refused for Black Panther (neither trait)", () => {
      expectRefused(openedHero("42011", BP), "42011");
    });
    it.each(["X-FORCE", "X-MEN"])(
      "with an %s identity: plays, and after he attacks heals 1 from another character",
      (trait) => {
        const { state: s, id } = cast(openedHero("42011", { ...BP, identityTraits: [trait] }), "42011");
        expect(inPlay(s, id)).toBe(true);
        const hurt = withDamage(s, me(s), 3);
        const run = drive(
          hurt,
          acceptingAndPicking(["42011.elixir-response"], [me(hurt)]),
          basicAttackCmd(hurt, villainOf(hurt), id),
        );
        expect(wasOffered(run.offered, "42011.elixir-response")).toBe(true);
        expect(dmg(run.state, me(run.state))).toBe(2);
      },
    );
  });

  describe("42012 Siryn (protection ally)", () => {
    it("after she attacks, stuns a minion", () => {
      const { state: s, id } = cast(openedHero("42012", BP), "42012");
      expect(inPlay(s, id)).toBe(true);
      // Shocker (01103): no Guard, so the villain can be attacked.
      const m = spawnMinion(s, { code: "01103" });
      const run = drive(
        m.state,
        acceptingAndPicking(["42012.siryn-response"], [m.id]),
        basicAttackCmd(m.state, villainOf(m.state), id),
      );
      expect(wasOffered(run.offered, "42012.siryn-response")).toBe(true);
      expect(status(run.state, m.id, "stunned")).toBe(1);
    });
  });

  describe("42013 Warpath (protection ally, Toughness)", () => {
    it("enters play with a tough status", () => {
      const { state: s, id } = cast(openedHero("42013", BP), "42013");
      expect(status(s, id, "tough")).toBe(1);
    });
    // Owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1): his Response overrides the Hero Action's timing for that
    // event, so it is played in the villain phase (`playFromHand.ignoreActionTiming`). Card text: "After Warpath
    // defends against an attack, play an event with a \"Hero Action\" ability from your hand (paying its costs)."
    it("after he defends (villain phase), plays an event with a Hero Action from hand (Concussive Blow confuses the villain)", () => {
      const { state: s, id } = cast(openedHero("42013", BP), "42013");
      const blow = conjureInHand(s, "41014");
      const accept = accepting(["42013.warpath-response"], { defender: id });
      // The play's payment is asked from inside the response: the cards offered from hand pay for it.
      const paying: typeof accept = (st) => {
        const choice = st.pendingChoice;
        return choice?.prompt.kind === "spendResources" ? choice.options.map((o) => o.optionId) : accept(st);
      };
      const run = drive(quietBoost(blow.state), paying, endTurn(P1));
      expect(wasOffered(run.offered, "42013.warpath-response")).toBe(true);
      expect(status(run.state, villainOf(run.state), "confused")).toBe(1);
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("41014");
    });
  });

  describe("42014 Aerial Intervention (protection event interrupt)", () => {
    const undefended = (extra: object) => {
      const base = moveToHand(openedHero("42014", { ...BP, ...extra }), P1, "42014").state;
      return drive(quietBoost(base), accepting(["42014.aerial-intervention-interrupt"]), endTurn(P1));
    };
    it("a Core hero controls no AERIAL character: not offered, the attack's 2 damage lands", () => {
      const run = undefended({});
      expect(wasOffered(run.offered, "42014.aerial-intervention-interrupt")).toBe(false);
      expect(dmg(run.state, me(run.state))).toBe(2);
    });
    it("with an AERIAL identity: exhausts it and prevents the 2 damage", () => {
      const run = undefended(AERIAL);
      expect(wasOffered(run.offered, "42014.aerial-intervention-interrupt")).toBe(true);
      expect(dmg(run.state, me(run.state))).toBe(0);
    });
  });

  describe("42015 Ever Vigilant (protection event; play only if your identity has AERIAL)", () => {
    it("refused for Black Panther without AERIAL", () => {
      expectRefused(openedHero("42015", BP), "42015");
    });
    it("with an AERIAL identity: readies the hero and removes 2 threat from the main scheme", () => {
      const base = patchInstance(
        withoutSideSchemes(openedHero("42015", { ...BP, ...AERIAL }), 6),
        me(openedHero("42015", { ...BP, ...AERIAL })),
        { exhausted: true },
      );
      const { state } = cast(base, "42015");
      expect(inst(state, me(state)).exhausted).toBe(false);
      expect(mainThreat(state)).toBe(4);
    });
  });

  describe("42016 Taunt (protection event)", () => {
    it("the villain attacks the player, no other character may defend, and 3 cards are drawn", () => {
      const base = openedHero("42016", BP);
      const { state: s, id: ally } = cast(conjureInHand(base, "42012").state, "42012");
      const offered: string[][] = [];
      const given = moveToHand(quietBoost(s), P1, "42016");
      const handBefore = handIds(given.state).length;
      const pick = (st: GameState) => {
        if (st.pendingChoice?.prompt.kind === "declareDefender")
          offered.push(st.pendingChoice.options.map((o) => o.optionId));
        return firstLegal(st);
      };
      const run = drive(given.state, pick, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids)));
      expect(offered.length).toBeGreaterThan(0);
      expect(offered.flat()).not.toContain(ally);
      // Undefended: the villain's ATK 2 lands on the hero.
      expect(dmg(run.state, me(run.state))).toBe(2);
      // Taunt and its 1 resource leave the hand, 3 cards are drawn.
      expect(handIds(run.state)).toHaveLength(handBefore - 2 + 3);
    });
  });

  describe("42017 Render Medical Aid (protection player side scheme)", () => {
    it("when defeated: heals 5 damage among the player's characters (here the identity's 3)", () => {
      const { state: s, id } = cast(openedHero("42017", BP), "42017");
      const hurt = withDamage(patchInstance(s, id, { threat: 1 }), me(s), 3);
      const run = drive(hurt, firstLegal, basicThwartCmd(hurt, id));
      expect(dmg(run.state, me(run.state))).toBe(0);
    });
  });

  describe("42018 Angel's Aerie (protection support)", () => {
    it("adds a fatigue counter after the hero defends; the Alter-Ego Action heals 1 per counter", () => {
      const { state: s, id } = cast(openedHero("42018", BP), "42018");
      const run = drive(quietBoost(s), accepting(["42018.angels-aerie-response"], { defend: true }), endTurn(P1));
      expect(inst(run.state, id).counters.fatigue).toBe(1);
      const ego = withDamage(withForm(run.state, "alterEgo"), me(run.state), 3);
      const used = drive(ego, firstLegal, use(P1, id, "42018.angels-aerie-action"));
      expect(dmg(used.state, me(used.state))).toBe(2);
      expect(inst(used.state, id).counters.fatigue ?? 0).toBe(0);
    });
    it("cannot be used in hero form", () => {
      const { state: s, id } = cast(openedHero("42018", BP), "42018");
      expect(applyCommand(s, use(P1, id, "42018.angels-aerie-action"), WAVE7_DEPS).ok).toBe(false);
    });
  });

  describe("42019 Containment Strategy (protection upgrade on a side scheme)", () => {
    const attached = (hero: string) => {
      // Protection has one Core precon (Black Panther): in Captain Marvel's deck the card is conjured instead.
      const base =
        hero === BLACK_PANTHER ? openedHero("42019", { coreHero: hero }) : openedHero("42031", { coreHero: hero });
      const side = spawnSideScheme(base, 5);
      const run = cast(conjureInHand(side.state, "42019").state, "42019", { attach: side.id });
      return { ...run, scheme: side.id };
    };
    it("attaches to the side scheme; after a hero defends unharmed (Black Panther DEF 2 vs ATK 2), removes 2 threat", () => {
      const a = attached(BLACK_PANTHER);
      expect(inst(a.state, a.id).attachedTo).toBe(a.scheme);
      const run = drive(
        quietBoost(a.state),
        accepting(["42019.containment-strategy-response"], { defend: true }),
        endTurn(P1),
      );
      expect(dmg(run.state, me(run.state))).toBe(0);
      expect(inst(run.state, a.scheme).threat).toBe(3);
    });
    it("after a hero defends and takes damage (Captain Marvel DEF 1 vs ATK 2), removes 1 threat", () => {
      const a = attached(CAPTAIN_MARVEL);
      const run = drive(
        quietBoost(a.state),
        accepting(["42019.containment-strategy-response"], { defend: true }),
        endTurn(P1),
      );
      expect(dmg(run.state, me(run.state))).toBe(1);
      expect(inst(run.state, a.scheme).threat).toBe(4);
    });
  });

  describe("42020 Cannonball (basic ally): reduces consequential damage by the AERIAL cards in hand", () => {
    const attackSoldier = (aerialInHand: number) => {
      let s = cast(openedHero("42020"), "42020");
      for (let i = 0; i < aerialInHand; i++) s = { ...s, state: conjureInHand(s.state, "42014").state };
      const m = spawnMinion(s.state, { code: "01182" });
      const run = drive(m.state, accepting(["42020.cannonball-interrupt"]), basicAttackCmd(m.state, m.id, s.id));
      return { run, ally: s.id };
    };
    it("no AERIAL card in hand: the Hydra Soldier's 2 damage defeats him (2 hit points)", () => {
      const { run, ally } = attackSoldier(0);
      expect(inPlay(run.state, ally)).toBe(false);
    });
    it("1 AERIAL card in hand: 1 damage; 2: none", () => {
      const one = attackSoldier(1);
      expect(dmg(one.run.state, one.ally)).toBe(1);
      const two = attackSoldier(2);
      expect(dmg(two.run.state, two.ally)).toBe(0);
    });
  });

  describe("42022 The Power of Flight (basic resource)", () => {
    it("alone pays for a cost-2 AERIAL card (Ever Vigilant) but not for a cost-2 card that is not", () => {
      const base = openedHero("42022", AERIAL);
      const flight = moveToHand(base, P1, "42022");
      const vigilant = conjureInHand(flight.state, "42015");
      const ok = drive(withoutSideSchemes(vigilant.state, 6), firstLegal, play(P1, vigilant.id, [flight.ids[0]!]));
      expect(mainThreat(ok.state)).toBe(4);
      const plain = conjureInHand(flight.state, "41017");
      expect(applyCommand(plain.state, play(P1, plain.id, [flight.ids[0]!]), WAVE7_DEPS).ok).toBe(false);
    });
  });

  describe("42023 Soaring Acrobatics (basic upgrade)", () => {
    it("a non-AERIAL Core hero's basic attack gets no bonus", () => {
      const { state: s, id } = cast(openedHero("42023"), "42023");
      expect(inst(s, id).attachedTo).toBe(me(s));
      const run = drive(s, accepting(["42023.soaring-acrobatics-interrupt"]), basicAttackCmd(s, villainOf(s)));
      expect(wasOffered(run.offered, "42023.soaring-acrobatics-interrupt")).toBe(false);
      expect(dmg(run.state, villainOf(run.state))).toBe(2);
    });
    it("with an AERIAL identity: exhausts for +1 to the basic power (ATK 2 -> 3)", () => {
      const { state: s, id } = cast(openedHero("42023", AERIAL), "42023");
      const run = drive(s, accepting(["42023.soaring-acrobatics-interrupt"]), basicAttackCmd(s, villainOf(s)));
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
      expect(inst(run.state, id).exhausted).toBe(true);
    });
  });

  describe("42029 Bombs Away (aggression event)", () => {
    it("a Core hero controls no AERIAL character to exhaust: cannot be played", () => {
      expectRefused(openedHero("42029", { coreHero: SHE_HULK }), "42029");
    });
    it("with an AERIAL identity: exhausts it; 3 damage to the villain and to a minion engaged with the player", () => {
      const base = openedHero("42029", { coreHero: SHE_HULK, ...AERIAL });
      const m = spawnMinion(base, { code: "01182" });
      const { state } = cast(m.state, "42029");
      expect(dmg(state, villainOf(state))).toBe(3);
      expect(dmg(state, m.id)).toBe(3);
      expect(inst(state, me(state)).exhausted).toBe(true);
    });
  });

  describe("42030 Eyes in the Sky (justice upgrade)", () => {
    const reveal = (extra: object) => {
      const { state: s, id } = cast(openedHero("42030", extra), "42030");
      // Boost card, the minion dealt to the player, then the card revealed in its place.
      const staged = stackEncounterDeck(s, "01186", "40097", "01186");
      return { ...drive(staged, accepting(["42030.eyes-in-the-sky-interrupt"]), endTurn(P1)), id };
    };
    it("a Core hero has no AERIAL character to exhaust: not offered, the minion enters play", () => {
      const run = reveal({});
      expect(wasOffered(run.offered, "42030.eyes-in-the-sky-interrupt")).toBe(false);
      expect(codesOf(run.state, playerOf(run.state, P1).playArea)).toContain("40097");
    });
    it("with an AERIAL identity: the minion's reveal is cancelled and it is discarded, Eyes in the Sky is discarded", () => {
      const run = reveal(AERIAL);
      expect(wasOffered(run.offered, "42030.eyes-in-the-sky-interrupt")).toBe(true);
      expect(codesOf(run.state, playerOf(run.state, P1).playArea)).not.toContain("40097");
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("42030");
      expect(inst(run.state, me(run.state)).exhausted).toBe(true);
    });
  });

  describe("42031 Flying Formation (leadership event)", () => {
    it("with no AERIAL character, plays and readies nothing", () => {
      const { state } = cast(openedHero("42031", { coreHero: CAPTAIN_MARVEL }), "42031");
      expect(codesOf(state, playerOf(state, P1).discard)).toContain("42031");
    });
    it("with an AERIAL identity that is exhausted: readies it", () => {
      const base = openedHero("42031", { coreHero: CAPTAIN_MARVEL, ...AERIAL });
      const { state } = cast(patchInstance(base, me(base), { exhausted: true }), "42031");
      expect(inst(state, me(state)).exhausted).toBe(false);
    });
  });

  describe("42032 X-Force Recruit (basic upgrade; play only if your identity has X-FORCE)", () => {
    it("refused for a Core hero without X-FORCE", () => {
      expectRefused(openedHero("42032"), "42032");
    });
    it("with an X-FORCE identity: +1 hit point on the host (attached to the identity)", () => {
      const base = openedHero("42032", XFORCE);
      const before = characterProfile(base, me(base), WAVE7_DEPS)!.maxHp;
      const { state, id } = cast(base, "42032", { attach: me(base) });
      expect(inst(state, id).attachedTo).toBe(me(state));
      expect(characterProfile(state, me(state), WAVE7_DEPS)!.maxHp).toBe(before + 1);
    });
  });

  describe("two players (a second Core hero in seat 2)", () => {
    const twoSeats = (code: string, extra: object = {}) =>
      openedHero(code, { ...extra, otherPlayers: [wave7StarterDeckSetup(SHE_HULK)] });

    it("42011 Elixir: heals another friendly character, including the other player's identity", () => {
      const { state: s, id } = cast(twoSeats("42011", { ...BP, ...XFORCE }), "42011");
      const hurt = withDamage(s, identityOf(s, P2), 3);
      const run = drive(
        hurt,
        acceptingAndPicking(["42011.elixir-response"], [identityOf(hurt, P2)]),
        basicAttackCmd(hurt, villainOf(hurt), id),
      );
      expect(dmg(run.state, identityOf(run.state, P2))).toBe(2);
    });
    it("42017 Render Medical Aid: each player heals 5 among the characters they control (seat 2's identity too)", () => {
      const { state: s, id } = cast(twoSeats("42017", BP), "42017");
      const hurt = withDamage(withDamage(patchInstance(s, id, { threat: 1 }), me(s), 3), identityOf(s, P2), 4);
      const run = drive(hurt, firstLegal, basicThwartCmd(hurt, id));
      expect(dmg(run.state, me(run.state))).toBe(0);
      expect(dmg(run.state, identityOf(run.state, P2))).toBe(0);
    });
  });

  // An AERIAL ally is "an AERIAL character you control" even when the Core identity is not: the cost of these cards
  // must be payable by Cannonball (AERIAL, X-FORCE), not only by an AERIAL hero.
  describe("an AERIAL ally pays 'exhaust an AERIAL character you control' for a Core hero", () => {
    const withCannonball = (code: string, extra: object = {}) => {
      const base = openedHero(code, extra);
      return { ...conjure(base, "42020", "play") };
    };
    it("42014 Aerial Intervention: exhausts Cannonball to prevent the villain's 2 damage to the hero", () => {
      const ball = withCannonball("42014", BP);
      const given = moveToHand(ball.state, P1, "42014").state;
      const run = drive(quietBoost(given), accepting(["42014.aerial-intervention-interrupt"]), endTurn(P1));
      expect(wasOffered(run.offered, "42014.aerial-intervention-interrupt")).toBe(true);
      expect(dmg(run.state, me(run.state))).toBe(0);
      expect(inst(run.state, ball.id).exhausted).toBe(true);
    });
    it("42029 Bombs Away: exhausts Cannonball; 3 damage to the villain", () => {
      const ball = withCannonball("42029", { coreHero: SHE_HULK });
      const { state } = cast(ball.state, "42029");
      expect(dmg(state, villainOf(state))).toBe(3);
      expect(inst(state, ball.id).exhausted).toBe(true);
      expect(inst(state, me(state)).exhausted).toBe(false);
    });
    it("42030 Eyes in the Sky: exhausts Cannonball to cancel a revealed non-ELITE minion", () => {
      const ball = withCannonball("42030");
      const { state: s, id } = cast(ball.state, "42030");
      const run = drive(
        stackEncounterDeck(s, "01186", "40097", "01186"),
        accepting(["42030.eyes-in-the-sky-interrupt"]),
        endTurn(P1),
      );
      expect(wasOffered(run.offered, "42030.eyes-in-the-sky-interrupt")).toBe(true);
      expect(codesOf(run.state, playerOf(run.state, P1).playArea)).not.toContain("40097");
      expect(inst(run.state, ball.id).exhausted).toBe(true);
      expect(inst(run.state, id).attachedTo).toBe(null);
    });
    it("42023 Soaring Acrobatics: Cannonball's basic attack gets +1 (ATK 2 -> 3)", () => {
      const ball = withCannonball("42023");
      const { state: s } = cast(ball.state, "42023");
      const run = drive(s, accepting(["42023.soaring-acrobatics-interrupt"]), basicAttackCmd(s, villainOf(s), ball.id));
      expect(wasOffered(run.offered, "42023.soaring-acrobatics-interrupt")).toBe(true);
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
    });
    it("42031 Flying Formation: readies up to 3 AERIAL characters, so one of four exhausted AERIAL characters stays exhausted", () => {
      // An AERIAL identity and three AERIAL allies (the ally limit is 3).
      let s = openedHero("42031", { coreHero: CAPTAIN_MARVEL, ...AERIAL });
      const ids: InstanceId[] = [me(s)];
      s = patchInstance(s, me(s), { exhausted: true });
      for (const code of ["42020", "42012", "42013"]) {
        const c = conjure(s, code, "play");
        s = patchInstance(c.state, c.id, { exhausted: true });
        ids.push(c.id);
      }
      const pickThree = (st: GameState) => {
        const choice = st.pendingChoice;
        return choice?.prompt.kind === "chooseTarget"
          ? choice.options.slice(0, 3).map((o) => o.optionId)
          : firstLegal(st);
      };
      const { state } = cast(s, "42031", { pick: pickThree });
      expect(ids.filter((id) => !inst(state, id).exhausted)).toHaveLength(3);
    });
  });

  describe("42032 X-Force Recruit on an ally", () => {
    it("with an X-FORCE identity, attached to Luke Cage: +1 hit point and he gains the X-FORCE trait", () => {
      const luke = conjure(openedHero("42032", XFORCE), "01076", "play");
      const before = characterProfile(luke.state, luke.id, WAVE7_DEPS)!.maxHp;
      expect(traitsOf(luke.state, luke.id, WAVE7_DEPS).some((t) => (t as string) === "X-FORCE")).toBe(false);
      const { state } = cast(luke.state, "42032", { attach: luke.id });
      expect(characterProfile(state, luke.id, WAVE7_DEPS)!.maxHp).toBe(before + 1);
      expect(traitsOf(state, luke.id, WAVE7_DEPS).some((t) => (t as string) === "X-FORCE")).toBe(true);
    });
  });
});
