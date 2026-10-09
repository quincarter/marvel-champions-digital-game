import { AOA_CARDS, AOA_STARTER_DECKS, CORE_CARDS, cardId } from "@mc/content";
import {
  createGame,
  getInstance,
  keywordsOf,
  statBonus,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  picking,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  use,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { MAGIK_IDENTITY } from "./identity.js";
import { MAGIK_SUPPORT_UPGRADES_ALLIES, MAGIK_SUPPORT_UPGRADES_ALLIES_SKIPPED } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magik's ally, support and upgrades (45031 to 45035), docs/phase7-wave8.md section 7.1, 3.50, 3.56. Her real starter
 * deck (`magik-aggression`) against Rhino (Core, standard), the top of the deck stacked by surgery. Printed icons of the
 * cards used as "the top card": Limbo physical, Magik's Crown mental, Mystical Armor energy, Colossus wild, Scrying
 * mental, Stepping Disc energy, Clobber physical.
 */
const COLOSSUS = "45031";
const LIMBO = "45032";
const CROWN = "45033";
const SOULSWORD = "45034";
const ARMOR = "45035";
const SCRYING = "45036";
const DISC = "45037";
const CLOBBER = "45046";

const REF = {
  colossus: "45031.colossus-interrupt",
  limboResponse: "45032.limbo-response",
  limboAction: "45032.limbo-action",
  crown: "45033.magiks-crown-constant",
  crown2: "45033.magiks-crown-constant-2",
  sword: "45034.soulsword-constant",
  sword2: "45034.soulsword-constant-2",
  armor: "45035.mystical-armor-constant",
  armor2: "45035.mystical-armor-constant-2",
} as const;

const DECK = AOA_STARTER_DECKS.find((d) => d.id === "magik-aggression")!;
const MAGIK_SEAT = {
  identityCardId: DECK.identityCardId,
  aspects: DECK.aspects,
  deck: DECK.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, MAGIK_IDENTITY, MAGIK_SUPPORT_UPGRADES_ALLIES),
};
const codeOf = (s: GameState, id: InstanceId): string => (getInstance(s, id)?.cardId as string | undefined) ?? "?";
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const deckOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).deck);
const topOf = (s: GameState): string => deckOf(s)[0] ?? "none";

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  } as never);
  const created = createGame({ ...config, players: [MAGIK_SEAT] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const heroGame = (): GameState => withForm(setupGame(), { heroForm: 0 });
/** The top of the deck is exactly these cards, in order. */
const stacked = (s: GameState, ...top: readonly string[]): GameState => putOnTopOfDeck(s, P1, ...top).state;
const magik = (s: GameState): InstanceId => identityOf(s);
const bonus = (s: GameState, stat: "atk" | "thw" | "def"): number => statBonus(s, DEPS, magik(s), stat);
const keywords = (s: GameState): string[] =>
  keywordsOf(s, magik(s), DEPS)
    .map((k) => `${k.name}${"value" in k && k.value ? ` ${k.value}` : ""}`)
    .sort();

/** Plays the upgrade from the hand onto Magik, paying with the first other cards of the hand. */
function withUpgrade(s0: GameState, code: string): GameState {
  const { state, ids } = moveToHand(s0, P1, code);
  const cost = code === CROWN ? 2 : 1;
  const pay = playerOf(state, P1)
    .hand.filter((id) => id !== ids[0])
    .slice(0, cost);
  const played = applyOk(state, play(P1, ids[0]!, pay, { attachToInstanceId: magik(state) }), DEPS);
  return settle(played.state, firstLegal, undefined, DEPS);
}

describe("registry", () => {
  const refs = Object.values(REF);
  it("registers every ref of the group, each valid and named on its card", () => {
    expect(Object.keys(MAGIK_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...refs].sort());
    for (const ref of refs) expect(validateDefinition(MAGIK_SUPPORT_UPGRADES_ALLIES[ref]!)).toEqual([]);
    for (const id of [COLOSSUS, LIMBO, CROWN, SOULSWORD, ARMOR]) {
      const card = AOA_CARDS.find((c) => c.id === cardId(id)) as never as { abilities: { id: string }[] };
      for (const a of card.abilities) expect(a.id in MAGIK_SUPPORT_UPGRADES_ALLIES).toBe(true);
    }
    expect(MAGIK_SUPPORT_UPGRADES_ALLIES_SKIPPED).toEqual({});
  });
});

describe("Magik's Crown 45033: steady, +1 THW while the top card has mental or wild", () => {
  it("steady, and THW follows the top card: mental +1, wild +1, physical 0", () => {
    const s = heroGame();
    expect(keywords(s)).toEqual([]);
    const crown = withUpgrade(stacked(s, LIMBO), CROWN);
    expect(keywords(crown)).toEqual(["steady"]);
    expect(bonus(crown, "thw")).toBe(0);
    expect(bonus(stacked(crown, SCRYING), "thw")).toBe(1);
    expect(bonus(stacked(crown, COLOSSUS), "thw")).toBe(1);
    expect(bonus(stacked(crown, DISC), "thw")).toBe(0);
  });
  it("follows the top card as it is drawn, with no ability resolving", () => {
    const crown = withUpgrade(stacked(heroGame(), LIMBO), CROWN);
    const before = stacked(crown, SCRYING, LIMBO);
    expect(bonus(before, "thw")).toBe(1);
    const owner = playerOf(before, P1);
    const drawn = {
      ...before,
      players: before.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: owner.deck.slice(1), hand: [...owner.hand, owner.deck[0]!] } : p,
      ),
    };
    expect(topOf(drawn)).toBe(LIMBO);
    expect(bonus(drawn, "thw")).toBe(0);
  });
  it("alter-ego form: nothing (it names Magik, not Illyana Rasputin)", () => {
    const crown = withUpgrade(stacked(heroGame(), SCRYING), CROWN);
    const ego = withForm(crown, "alterEgo");
    expect(keywords(ego)).toEqual([]);
    expect(bonus(ego, "thw")).toBe(0);
  });
});

describe("Soulsword 45034: basic attacks gain piercing, +1 ATK while the top card has physical or wild", () => {
  it("ATK follows the top card: physical +1, wild +1, energy 0, empty deck 0", () => {
    const sword = withUpgrade(stacked(heroGame(), DISC), SOULSWORD);
    expect(bonus(sword, "atk")).toBe(0);
    expect(bonus(stacked(sword, CLOBBER), "atk")).toBe(1);
    expect(bonus(stacked(sword, COLOSSUS), "atk")).toBe(1);
    const empty = {
      ...sword,
      players: sword.players.map((p) => (p.playerId === P1 ? { ...p, deck: [] } : p)),
    };
    expect(bonus(empty, "atk")).toBe(0);
  });
  it("a basic attack on a tough enemy with Clobber on top: piercing, 3 damage dealt and the tough card discarded", () => {
    const base = withUpgrade(stacked(heroGame(), CLOBBER), SOULSWORD);
    const rhino = base.activeVillainId!;
    const s = patchInstance(base, rhino, { statuses: { ...inst(base, rhino).statuses, tough: 1 } });
    const hit = driveEventsPicking(DEPS, s, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: magik(s),
      targetInstanceId: rhino,
    }).state;
    expect(inst(hit, rhino).damage - inst(s, rhino).damage).toBe(3);
    expect(inst(hit, rhino).statuses.tough).toBe(0);
  });
  it("without Soulsword the same attack is stopped by the tough card", () => {
    const base = stacked(heroGame(), CLOBBER);
    const rhino = base.activeVillainId!;
    const s = patchInstance(base, rhino, { statuses: { ...inst(base, rhino).statuses, tough: 1 } });
    const hit = driveEventsPicking(DEPS, s, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: magik(s),
      targetInstanceId: rhino,
    }).state;
    expect(inst(hit, rhino).damage).toBe(inst(s, rhino).damage);
    expect(inst(hit, rhino).statuses.tough).toBe(0);
  });
});

describe("Mystical Armor 45035: retaliate 1, +1 DEF while the top card has energy or wild", () => {
  it("retaliate 1, and DEF follows the top card: energy +1, wild +1, mental 0", () => {
    const armor = withUpgrade(stacked(heroGame(), SCRYING), ARMOR);
    expect(keywords(armor)).toEqual(["retaliate 1"]);
    expect(bonus(armor, "def")).toBe(0);
    expect(bonus(stacked(armor, DISC), "def")).toBe(1);
    expect(bonus(stacked(armor, COLOSSUS), "def")).toBe(1);
  });
  it("all three together with a wild on top: THW +1, ATK +1, DEF +1", () => {
    let s = stacked(heroGame(), COLOSSUS);
    for (const code of [CROWN, SOULSWORD, ARMOR]) s = withUpgrade(s, code);
    s = stacked(s, COLOSSUS);
    expect([bonus(s, "thw"), bonus(s, "atk"), bonus(s, "def")]).toEqual([1, 1, 1]);
  });
});

describe("Limbo 45032: swap a card of the hand with the top card of the deck", () => {
  /** Limbo in play (paid with a card of the hand), a known hand and a known top. */
  function limboGame(): { s: GameState; limbo: InstanceId } {
    const s0 = stacked(heroGame(), LIMBO);
    const { state, ids } = moveToHand(s0, P1, LIMBO);
    const pay = playerOf(state, P1).hand.filter((id) => id !== ids[0])[0]!;
    const played = settle(applyOk(state, play(P1, ids[0]!, [pay]), DEPS).state, firstLegal, undefined, DEPS);
    return { s: played, limbo: ids[0]! };
  }
  const pickSwap = (handCode: string) => (s: GameState) => {
    const choice = s.pendingChoice!;
    const wanted = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === handCode);
    return wanted && choice.prompt.kind !== "chooseTriggers" ? [wanted.optionId] : picking(...[])(s);
  };

  it("Action: exhausts Limbo; the chosen hand card goes on top, the top card enters the hand, nothing is drawn", () => {
    const { s: base, limbo } = limboGame();
    const s = stacked(base, SCRYING, CLOBBER);
    const hand = handOf(s);
    const swapped = hand[0]!;
    const run = driveEventsPicking(DEPS, s, pickSwap(swapped), use(P1, limbo, REF.limboAction));
    expect(inst(run.state, limbo).exhausted).toBe(true);
    expect(topOf(run.state)).toBe(swapped);
    expect(deckOf(run.state)[1]).toBe(CLOBBER);
    expect(handOf(run.state)).toHaveLength(hand.length);
    expect(handOf(run.state)).toContain(SCRYING);
    expect(playerOf(run.state, P1).discard).toEqual(playerOf(s, P1).discard);
  });
  it("Action cannot be used while Limbo is exhausted", () => {
    const { s, limbo } = limboGame();
    const once = driveEventsPicking(DEPS, s, firstLegal, use(P1, limbo, REF.limboAction)).state;
    const again = (() => {
      try {
        applyOk(once, use(P1, limbo, REF.limboAction), DEPS);
        return true;
      } catch {
        return false;
      }
    })();
    expect(again).toBe(false);
  });
  it("Response: offered after the villain phase begins, exhausts Limbo and swaps", () => {
    const { s, limbo } = limboGame();
    const prepared = stacked(s, SCRYING, CLOBBER);
    const hand = handOf(prepared);
    let offered = false;
    const run = driveEventsPicking(
      DEPS,
      prepared,
      (st) => {
        const choice = st.pendingChoice!;
        if (choice.prompt.kind === "chooseTriggers") {
          const own = choice.options.find((o) => o.optionId.endsWith(REF.limboResponse));
          if (own) {
            offered = true;
            return [own.optionId];
          }
        }
        return pickSwap(hand[0]!)(st);
      },
      endTurn(P1),
    );
    expect(offered).toBe(true);
    expect(inst(run.state, limbo).exhausted).toBe(true);
    expect(handOf(run.state)).toContain(SCRYING);
  });
});

/**
 * Colossus in the hand with four other cards (hand size 5, so ending the turn draws nothing). `blank`: the four others
 * are turned into an encounter card (01186) that prints no resource icon, so the hand cannot pay his cost of 3.
 */
function colossusHand(blank: boolean): { s: GameState; colossus: InstanceId } {
  const { state, ids } = moveToHand(heroGame(), P1, COLOSSUS);
  const colossus = ids[0]!;
  const owner = playerOf(state, P1);
  const others = owner.hand.filter((i) => i !== colossus).slice(0, 4);
  const hand = [colossus, ...others];
  let s: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand, deck: [...p.deck, ...p.hand.filter((i) => !hand.includes(i))] } : p,
    ),
  };
  if (blank) for (const i of others) s = patchInstance(s, i, { cardId: cardId("01186") });
  return { s, colossus };
}

/** Ends Magik's turn and takes the Colossus interrupt whenever it is offered, paying with the first three cards. */
function villainPhase(s: GameState) {
  const offers: string[] = [];
  const run = driveEventsPicking(
    DEPS,
    s,
    (st) => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") {
        const own = c.options.find((o) => o.optionId.endsWith(REF.colossus));
        if (own) {
          offers.push(own.optionId);
          return [own.optionId];
        }
      }
      if (c.prompt.kind === "spendResources") return c.options.slice(0, 3).map((o) => o.optionId);
      if (c.prompt.kind === "chooseCards") return [c.options[0]!.optionId];
      return firstLegal(st);
    },
    endTurn(P1),
  );
  return { ...run, offers };
}

describe("Colossus 45031: an in-hand interrupt that plays him (paying his cost) and declares him the defender, ready", () => {
  it("when the cost can be paid: he is played for 3, becomes the defender ready, and his tough card absorbs the attack", () => {
    const { s, colossus } = colossusHand(false);
    const { state, events, offers } = villainPhase(s);
    expect(offers.length).toBeGreaterThanOrEqual(1);
    const types = events.map((e) => e.type);
    expect(events.find((e) => e.type === "cardPlayed" && e.instanceId === colossus)).toMatchObject({
      resourcesPaid: 3,
    });
    // The ability's declaration is logged like the Declare Defender step's own, marked as an effect's.
    expect(events.filter((e) => e.type === "defenderDeclared" && e.defenderInstanceId === colossus)).toEqual([
      expect.objectContaining({ type: "defenderDeclared", defenderInstanceId: colossus, playerId: P1, byEffect: true }),
    ]);
    expect(types).toContain("statusGiven");
    expect(types).toContain("damagePrevented");
    expect(types).toContain("statusRemoved");
    expect(playerOf(state, P1).playArea).toContain(colossus);
    expect(inst(state, colossus).damage).toBe(0);
    expect(inst(state, colossus).exhausted).toBe(false);
    // The first attack never reached Magik (Colossus was its defender, no prompt was asked); only the second activation of
    // the turn, which the interrupt does not answer, damaged her.
    const onMagik = events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === magik(state));
    expect(onMagik).toHaveLength(1);
    expect(events.filter((e) => e.type === "damagePrevented")).toHaveLength(1);
  });

  it("with a hand that cannot pay 3 the interrupt is not offered, and he stays in the hand (RRG p. 24, step 2)", () => {
    const { s, colossus } = colossusHand(true);
    const { state, offers, events } = villainPhase(s);
    expect(offers).toEqual([]);
    expect(playerOf(state, P1).playArea).not.toContain(colossus);
    expect(handOf(state)).toContain(COLOSSUS);
    expect(events.some((e) => e.type === "cardPlayed" && e.instanceId === colossus)).toBe(false);
  });
});
