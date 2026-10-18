import { CORE_STARTER_DECKS, WONDER_MAN_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  createGame,
  legalActions,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  changeForm,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { stagedInPlay } from "../../wave9/falcon/testing.js";
import { CORE_SPIDER_MAN, WAVE10_DEPS, WONDER_MAN_DECK, heroPackConfig, wonderManHeroGame } from "../testing.js";
import { WONDER_MAN_BASIC as REGISTRY, WONDER_MAN_BASIC_SKIPPED as SKIPPED } from "./basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 10 `wonder_man/basic` (docs/phase7-wave10-hero-packs.md H8.4, HS7): 58022 Swordsman, 58024 Jarvis and 58034
 * Avengers Compound, played from real Wonder Man games against Core's Rhino. 58023 Energy prints no ability (a reprint
 * of 01088). No ruling in marvel-champions-rulings-post-rrg-1-7.md names these cards.
 */
const SWORDSMAN = "58022";
const SWORDSMAN_CONSTANT = "58022.swordsman-constant";
const SWORDSMAN_RESPONSE = "58022.swordsman-response";
const JARVIS = "58024";
const JARVIS_REF = "58024.jarvis-response";
const COMPOUND = "58034";
const COMPOUND_REF = "58034.avengers-compound-action";
const CHARGE = "01099"; // Rhino's attachment, 2 boost icons
const OWN = [SWORDSMAN_CONSTANT, SWORDSMAN_RESPONSE, JARVIS_REF, COMPOUND_REF];

const dataOf = (code: string) =>
  WONDER_MAN_CARDS.find((c) => c.id === cardId(code)) as unknown as {
    abilities: { id: string }[];
    playRestrictions?: unknown;
  };
const run = (state: GameState, pick: Picker, ...commands: Command[]) =>
  driveEventsPicking(WAVE10_DEPS, state, pick, ...commands);

describe("registry", () => {
  it("scripts every ref the cards print, each validating, and nothing is skipped", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...OWN].sort());
    for (const id of Object.keys(REGISTRY)) {
      expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
      expect(Object.keys(SKIPPED)).not.toContain(id);
    }
    for (const code of [SWORDSMAN, JARVIS, COMPOUND]) {
      for (const ref of dataOf(code).abilities) expect(REGISTRY[ref.id] ?? SKIPPED[ref.id], ref.id).toBeDefined();
    }
    expect(Object.keys(SKIPPED)).toEqual([]);
  });

  it("58023 Energy prints no ability; Avengers Compound's play restriction is printed data", () => {
    expect(dataOf("58023").abilities).toEqual([]);
    expect(dataOf(COMPOUND).playRestrictions).toBeDefined();
  });

  it("prints the timings: Swordsman a constant and a hero response, Jarvis a response, the Compound an action", () => {
    expect(REGISTRY[SWORDSMAN_CONSTANT]!.trigger.kind).toBe("constant");
    expect(REGISTRY[SWORDSMAN_RESPONSE]).toMatchObject({ trigger: { kind: "response", form: "hero" } });
    expect(REGISTRY[JARVIS_REF]!.trigger.kind).toBe("response");
    expect(REGISTRY[COMPOUND_REF]!.trigger.kind).toBe("action");
  });
});

/** Swordsman (and anything else named) put into play ready under P1. */
function withInPlay(state: GameState, ...codes: string[]) {
  let current = state;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const staged = stagedInPlay(current, code);
    current = staged.state;
    ids.push(staged.id);
  }
  return { state: current, ids };
}

const toughOnVillain = (s: GameState): GameState => {
  const v = s.activeVillainId!;
  return patchInstance(s, v, { statuses: { ...inst(s, v).statuses, tough: 1 } });
};
const attackBy = (s: GameState, attacker: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: s.activeVillainId!,
});

describe("58022 Swordsman: his basic attacks gain piercing", () => {
  it("his basic attack goes through a tough status card (and discards it), where Wonder Man's own is prevented", () => {
    const { state: base, ids } = withInPlay(wonderManHeroGame({ deps: WAVE10_DEPS }), SWORDSMAN);
    const sword = ids[0]!;
    const state = toughOnVillain(base);
    const villain = state.activeVillainId!;

    const byWonderMan = run(state, firstLegal, attackBy(state, identityOf(state))).state;
    expect(inst(byWonderMan, villain).damage).toBe(0);
    expect(inst(byWonderMan, villain).statuses.tough).toBe(0);

    const bySwordsman = run(state, firstLegal, attackBy(state, sword)).state;
    expect(inst(bySwordsman, villain).damage).toBe(2);
    expect(inst(bySwordsman, villain).statuses.tough).toBe(0);
    expect(inst(bySwordsman, sword).exhausted).toBe(true);
  });
});

/** The encounter deck's top cards turned into `code` (a boost card for each attack the villain makes). */
const boostedWith = (s: GameState, code: string): GameState =>
  activeEncounterDeck(s)
    .deck.slice(0, 8)
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(code) }), s);

/**
 * Declines defending (or defends with `defender`); takes Swordsman's response when offered and `take`; anything else as
 * it comes. `offered` counts the times the response was on offer.
 */
function villainPhasePick(take: boolean, defender?: (s: GameState) => string) {
  const seen = { offered: 0 };
  const pick: Picker = (s) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "declareDefender" && defender) return [defender(s)];
    if (c.prompt.kind === "chooseTriggers") {
      const mine = c.options.filter((o) => o.optionId.includes(SWORDSMAN_RESPONSE));
      if (mine.length > 0) {
        seen.offered++;
        return take ? [mine[0]!.optionId] : [];
      }
    }
    return firstLegal(s);
  };
  return { pick, seen };
}
const HYDRA_MERCENARY = "01101"; // 1 boost icon
const ADVANCE = "01186"; // 0 boost icons

describe("58022 Swordsman: the response", () => {
  const swordsmanGame = (opts: { exhausted?: boolean; boost?: string } = {}) => {
    const { state, ids } = withInPlay(wonderManHeroGame({ deps: WAVE10_DEPS }), SWORDSMAN);
    const sword = ids[0]!;
    return {
      sword,
      state: boostedWith(
        opts.exhausted ? patchInstance(state, sword, { exhausted: true }) : state,
        opts.boost ?? HYDRA_MERCENARY,
      ),
    };
  };

  it("a boost card turned faceup in an undefended attack: he is declared, takes the damage (ATK 2 + 1 icon), and stays ready", () => {
    const { state, sword } = swordsmanGame();
    const { pick, seen } = villainPhasePick(true);
    const out = run(state, pick, endTurn(P1));
    expect(seen.offered).toBe(1);
    const declared = out.events.filter((e: GameEvent) => e.type === "defenderDeclared");
    expect(declared).toHaveLength(1);
    expect(declared[0]).toMatchObject({ defenderInstanceId: sword, byEffect: true });
    expect(inst(out.state, sword).damage).toBe(3);
    expect(inst(out.state, sword).exhausted).toBe(false);
    expect(inst(out.state, identityOf(out.state)).damage).toBe(0);
  });

  it("with 4 hit points he is defeated by 2 ATK and 2 icons, the damage dealt to him and not the hero", () => {
    const { state, sword } = swordsmanGame({ boost: CHARGE });
    const out = run(state, villainPhasePick(true).pick, endTurn(P1));
    expect(playerOf(out.state, P1).playArea).not.toContain(sword);
    expect(inst(out.state, identityOf(out.state)).damage).toBe(0);
  });

  it("an exhausted Swordsman is still declared (no exhaust is needed)", () => {
    const { state, sword } = swordsmanGame({ exhausted: true });
    const out = run(state, villainPhasePick(true).pick, endTurn(P1));
    expect(inst(out.state, sword).damage).toBe(3);
    expect(out.events.filter((e: GameEvent) => e.type === "defenderDeclared")).toHaveLength(1);
    expect(inst(out.state, identityOf(out.state)).damage).toBe(0);
  });

  it("a boost card with no icons still triggers it: he takes just the 2 ATK", () => {
    const { state, sword } = swordsmanGame({ boost: ADVANCE });
    const { pick, seen } = villainPhasePick(true);
    const out = run(state, pick, endTurn(P1));
    expect(seen.offered).toBe(1);
    expect(inst(out.state, sword).damage).toBe(2);
  });

  it("optional: declined, the hero takes the whole attack and Swordsman nothing", () => {
    const { state, sword } = swordsmanGame();
    const { pick, seen } = villainPhasePick(false);
    const out = run(state, pick, endTurn(P1));
    expect(seen.offered).toBe(1);
    expect(inst(out.state, sword).damage).toBe(0);
    expect(inst(out.state, identityOf(out.state)).damage).toBe(3);
  });

  it("a defended attack (the hero defends): the response is not offered", () => {
    const { state, sword } = swordsmanGame();
    const { pick, seen } = villainPhasePick(true, (s) => identityOf(s));
    const out = run(state, pick, endTurn(P1));
    expect(seen.offered).toBe(0);
    expect(inst(out.state, sword).damage).toBe(0);
  });

  it("in alter-ego form it is a Hero Response and is not offered", () => {
    const { state, sword } = swordsmanGame();
    const { pick, seen } = villainPhasePick(true);
    const out = run(withForm(state, "alterEgo"), pick, endTurn(P1));
    expect(seen.offered).toBe(0);
    expect(inst(out.state, sword).damage).toBe(0);
  });

  it("another player's undefended attack: offered to Swordsman's controller too (the print says 'an undefended attack'), and taken, he defends for that player", () => {
    // Wonder Man (P1, Swordsman in play) beside Core's Spider-Man (P2), both in hero form, Rhino's boost cards 0 icons.
    const config = heroPackConfig(WONDER_MAN_DECK);
    const deck = CORE_STARTER_DECKS.find((d) => d.id === CORE_SPIDER_MAN)!;
    const spider = {
      identityCardId: deck.identityCardId,
      aspects: deck.aspects,
      deck: deck.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
    };
    const created = createGame({ ...config, players: [config.players[0]!, spider] }, WAVE10_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const open = withForm(
      withForm(
        settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS),
        { heroForm: 0 },
        P1,
      ),
      { heroForm: 0 },
      P2,
    );
    const { state: placed, ids } = withInPlay(open, SWORDSMAN);
    const sword = ids[0]!;
    const state = boostedWith(placed, ADVANCE);
    const p2Identity = identityOf(state, P2);
    // Takes the response only for the attack on P2 (the prompt's event names the attacked player).
    const offeredFor: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") {
        const mine = c.options.filter((o) => o.optionId.includes(SWORDSMAN_RESPONSE));
        if (mine.length > 0) {
          const ev = c.prompt.event as { attackedPlayerId?: string; playerId?: string };
          const attacked = (ev.attackedPlayerId ?? ev.playerId) as string;
          offeredFor.push(`${c.playerId}:${attacked}`);
          return attacked === P2 ? [mine[0]!.optionId] : [];
        }
      }
      return firstLegal(s);
    };
    const first = run(state, pick, endTurn(P1));
    const out = run(first.state, pick, endTurn(P2));
    // Offered to his controller (P1) for each of Rhino's two undefended attacks, on P1 and on P2.
    expect(offeredFor).toEqual([`${P1}:${P1}`, `${P1}:${P2}`]);
    const declared = [...first.events, ...out.events].filter((e: GameEvent) => e.type === "defenderDeclared");
    expect(declared).toHaveLength(1);
    expect(declared[0]).toMatchObject({ defenderInstanceId: sword, byEffect: true });
    expect(inst(out.state, sword).damage).toBe(2);
    expect(inst(out.state, sword).exhausted).toBe(false);
    expect(inst(out.state, p2Identity).damage).toBe(0);
  });
});

/** Takes Jarvis's response when offered and `mode` (a label fragment) at his choice; anything else as it comes. */
function jarvisPick(take: boolean, mode: string) {
  const seen = { offered: 0, modes: [] as string[] };
  const pick: Picker = (s) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "chooseTriggers") {
      const mine = c.options.filter((o) => o.optionId.includes(JARVIS_REF));
      if (mine.length > 0) {
        seen.offered++;
        return take ? [mine[0]!.optionId] : [];
      }
    }
    if (c.prompt.kind === "chooseOption" && c.options.some((o) => o.label.includes("REC"))) {
      seen.modes = c.options.map((o) => o.label);
      return [c.options.find((o) => o.label.includes(mode))!.optionId];
    }
    return firstLegal(s);
  };
  return { pick, seen };
}
const withStatuses = (s: GameState, statuses: Partial<{ stunned: number; confused: number; tough: number }>) =>
  patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, ...statuses } });

describe("58024 Jarvis: after an Avenger hero changes into alter-ego form", () => {
  const jarvisGame = () => {
    const { state, ids } = withInPlay(wonderManHeroGame({ deps: WAVE10_DEPS }), JARVIS);
    return { state: withDamage(state, identityOf(state), 8), jarvis: ids[0]! };
  };
  const recoverFrom = (s: GameState): number => {
    const before = inst(s, identityOf(s)).damage;
    const out = run(s, firstLegal, { type: "basicRecover", playerId: P1 });
    return before - inst(out.state, identityOf(out.state)).damage;
  };

  it("exhausts Jarvis and gives the identity +2 REC until the end of the phase: 3 + 2 healed", () => {
    const { state, jarvis } = jarvisGame();
    const { pick, seen } = jarvisPick(true, "REC");
    const out = run(state, pick, changeForm(P1));
    expect(seen.offered).toBe(1);
    expect(inst(out.state, jarvis).exhausted).toBe(true);
    expect(out.state.players[0]!.identity.form).toBe("alterEgo");
    expect(recoverFrom(out.state)).toBe(5);
  });

  it("without Jarvis's response the same recover heals 3", () => {
    const { state } = jarvisGame();
    const out = run(state, jarvisPick(false, "REC").pick, changeForm(P1));
    expect(recoverFrom(out.state)).toBe(3);
  });

  it("the other mode discards a status card of the identity's (the player's choice of which)", () => {
    const { state, jarvis } = jarvisGame();
    const stunnedAndTough = withStatuses(state, { stunned: 1, tough: 1 });
    const { pick, seen } = jarvisPick(true, "stunned");
    const out = run(stunnedAndTough, pick, changeForm(P1));
    expect(seen.modes).toHaveLength(3); // REC, stunned, tough; no confused option
    const st = inst(out.state, identityOf(out.state)).statuses;
    expect([st.stunned, st.tough, st.confused]).toEqual([0, 1, 0]);
    expect(inst(out.state, jarvis).exhausted).toBe(true);
    expect(recoverFrom(out.state)).toBe(3);
  });

  it("an identity holding no status card has only the REC mode: it is taken without a choice", () => {
    const { state } = jarvisGame();
    const { pick, seen } = jarvisPick(true, "REC");
    const out = run(state, pick, changeForm(P1));
    expect(seen.modes).toEqual([]);
    expect(recoverFrom(out.state)).toBe(5);
  });

  it("an exhausted Jarvis cannot be used", () => {
    const { state, jarvis } = jarvisGame();
    const { pick, seen } = jarvisPick(true, "REC");
    run(patchInstance(state, jarvis, { exhausted: true }), pick, changeForm(P1));
    expect(seen.offered).toBe(0);
  });

  it("changing into hero form is not the trigger", () => {
    const { state, ids } = withInPlay(withForm(wonderManHeroGame({ deps: WAVE10_DEPS }), "alterEgo"), JARVIS);
    const { pick, seen } = jarvisPick(true, "REC");
    run(state, pick, changeForm(P1));
    expect(ids).toHaveLength(1);
    expect(seen.offered).toBe(0);
  });
});

describe("58034 Avengers Compound: tuck an ally from hand here, or play the ally tucked here", () => {
  const HAWKEYE = "58013"; // ally, cost 3?
  function compoundGame(opts: { hand?: string[]; tucked?: string; payers?: number } = {}) {
    // The hand-built deck holds no Compound: the last deck card becomes one (an instance is its card id).
    const game = wonderManHeroGame({ deps: WAVE10_DEPS });
    const last = playerOf(game, P1).deck.at(-1)!;
    const staged = stagedInPlay(patchInstance(game, last, { cardId: cardId(COMPOUND) }), COMPOUND);
    const compound = staged.id;
    let state = staged.state;
    // An empty hand, then exactly the named cards and the payers.
    const p = playerOf(state, P1);
    state = {
      ...state,
      players: state.players.map((pl) =>
        pl.playerId === P1 ? { ...pl, hand: [], deck: [...pl.deck, ...p.hand] } : pl,
      ),
    };
    let tuckedId: InstanceId | undefined;
    if (opts.tucked) {
      const given = moveToHand(state, P1, opts.tucked);
      tuckedId = given.ids[0]!;
      state = {
        ...given.state,
        players: given.state.players.map((pl) =>
          pl.playerId === P1 ? { ...pl, hand: pl.hand.filter((i) => i !== tuckedId) } : pl,
        ),
      };
      state = patchInstance(state, compound, { tucked: [tuckedId] });
    }
    const handIds: InstanceId[] = [];
    for (const code of opts.hand ?? []) {
      const given = moveToHand(state, P1, code);
      state = given.state;
      handIds.push(given.ids[0]!);
    }
    return { state, compound, tuckedId, handIds };
  }
  /** Tucks `ally` when asked which; pays with every card on offer. */
  const compoundPick =
    (...ally: InstanceId[]): Picker =>
    (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseCards") {
        const hit = c.options.find((o) => ally.includes(o.optionId as InstanceId));
        if (hit) return [hit.optionId];
      }
      if (c.prompt.kind === "spendResources")
        return c.options.filter((o) => !ally.some((a) => o.optionId.endsWith(a))).map((o) => o.optionId);
      return firstLegal(s);
    };
  const handOf = (s: GameState) => playerOf(s, P1).hand;
  const inPlayArea = (s: GameState, id: InstanceId) => playerOf(s, P1).playArea.includes(id);
  const abilityLegal = (s: GameState, id: InstanceId): boolean => {
    const actions = legalActions(s, P1, WAVE10_DEPS);
    return (
      actions.kind === "turn" &&
      actions.legal.some(
        (a) => a.action.kind === "useAbility" && a.action.instanceId === id && a.action.abilityId === COMPOUND_REF,
      )
    );
  };

  it("with nothing tucked, tucks the chosen ally from hand here: it leaves the hand, Compound exhausts", () => {
    const { state, compound, handIds } = compoundGame({ hand: [HAWKEYE, SWORDSMAN] });
    const [hawkeye, sword] = handIds as [InstanceId, InstanceId];
    const out = run(state, compoundPick(sword), use(P1, compound, COMPOUND_REF));
    expect(inst(out.state, compound).tucked).toEqual([sword]);
    expect(handOf(out.state)).toEqual([hawkeye]);
    expect(inst(out.state, compound).exhausted).toBe(true);
    expect(inPlayArea(out.state, sword)).toBe(false);
  });

  it("with an ally tucked, plays it as if from hand at its cost (4 resources for Swordsman); the cards paid are discarded", () => {
    const { state, compound, tuckedId, handIds } = compoundGame({
      tucked: SWORDSMAN,
      hand: ["58023", "58013", "58014"],
    });
    const out = run(state, compoundPick(), use(P1, compound, COMPOUND_REF));
    expect(inPlayArea(out.state, tuckedId!)).toBe(true);
    // "As if it were in your hand": logged from the tuck, counting as from the hand (RRG 1.8 FAQ p. 64).
    expect(out.events.find((e) => e.type === "cardPlayed" && e.instanceId === tuckedId)).toMatchObject({
      from: "tucked",
      countsAsFrom: "hand",
    });
    expect(inst(out.state, compound).tucked).toEqual([]);
    expect(handOf(out.state)).toEqual([]);
    for (const id of handIds) expect(playerOf(out.state, P1).discard).toContain(id);
    expect(inst(out.state, compound).exhausted).toBe(true);
  });

  it("once the tucked ally is played, with nothing tucked and no ally in hand it cannot be used again", () => {
    const first = compoundGame({ tucked: SWORDSMAN, hand: ["58023", "58013", "58014"] });
    const played = run(first.state, compoundPick(), use(P1, first.compound, COMPOUND_REF)).state;
    const again = patchInstance(played, first.compound, { exhausted: false });
    // Nothing tucked and no ally in hand: neither option can be done, so it is not initiated.
    expect(abilityLegal(again, first.compound)).toBe(false);
  });

  it("with an ally tucked and another in hand, the play happens (nothing more can be tucked) and the hand ally is kept", () => {
    const { state, compound, tuckedId, handIds } = compoundGame({
      tucked: SWORDSMAN,
      hand: ["58023", "58013", "58014", "58015"],
    });
    const out = run(state, compoundPick(handIds[3]!), use(P1, compound, COMPOUND_REF));
    expect(inPlayArea(out.state, tuckedId!)).toBe(true);
    expect(inst(out.state, compound).tucked).toEqual([]);
    expect(handOf(out.state)).toContain(handIds[3]);
  });

  it("with nothing tucked and no ally in hand it cannot be used", () => {
    const { state, compound } = compoundGame({ hand: ["58023"] });
    expect(abilityLegal(state, compound)).toBe(false);
  });

  it("an exhausted Compound cannot be used", () => {
    const { state, compound } = compoundGame({ hand: [SWORDSMAN] });
    expect(abilityLegal(state, compound)).toBe(true);
    expect(abilityLegal(patchInstance(state, compound, { exhausted: true }), compound)).toBe(false);
  });
});
