import { CORE_CARDS, CW_CARDS, cardId, trait, type AllyCard, type AnyCard } from "@mc/content";
import { applyCommand, createGame, handSize, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { ANT_PACK_CARDS } from "../../../wave2/ant/pack-cards.js";
import {
  P1,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { buildCrossHeroDeck } from "../../../testing/cross-hero.js";
import { CORE_SPIDER_MAN, WAVE10_DEPS, stagedInPlay } from "../../testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { ASPECT_BASIC_BASIC as REGISTRY, ASPECT_BASIC_BASIC_SKIPPED as SKIPPED } from "./basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 10 `cw/aspect-basic/basic` (docs/phase7-wave10-box-heroes.md B3.16, B7.4, B8.4): the Civil War box's basic
 * cards, each played from Core Spider-Man's Justice deck (a basic card works in any hero's deck, definition of done
 * 4b) against Core's Rhino. Spider-Man in hero form: ATK 2, THW 1, hand size 5, with the Avenger trait.
 */
const YELLOWJACKET = "56019.yellowjacket-response";
const IRON_LAD = "56052.iron-lad-interrupt";
const ASSESS = "56053.assess-the-situation-action";

const BY_ID = new Map<string, AnyCard>(WAVE10_CARDS.map((c) => [c.id as string, c]));
const dataOf = (code: string): AnyCard => BY_ID.get(code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const typeOf = (s: GameState, id: InstanceId): string => dataOf(codeOf(s, id)).type;

/** Spider-Man's Justice deck with `code` seated in it (plus `extra` copies of other cards), in hero form. */
function game(code: string, extra: readonly string[] = [], heroForm = true): GameState {
  const seat = buildCrossHeroDeck(WAVE10_CARDS, CORE_SPIDER_MAN, code);
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: CORE_SPIDER_MAN }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE10_CARDS,
  } as never);
  const created = createGame(
    { ...base, requireLegalDecks: false, players: [{ ...seat, deck: [...seat.deck, ...extra.map(cardId)] }] },
    WAVE10_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return heroForm ? withForm(opened, { heroForm: 0 }) : opened;
}

/** Accepts the named optional ability and picks the named cards, declining everything else like `firstLegal`. */
const choosing =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options
      .map((o) => o.optionId)
      .find((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hit === undefined ? firstLegal(state) : [hit];
  };

const run = (state: GameState, pick: Picker, ...commands: Parameters<typeof runWith>[2][]): GameState =>
  settle(runWith(WAVE10_DEPS, state, ...commands), pick, undefined, WAVE10_DEPS);

const abilityRefs = (code: string): string[] => {
  const card = dataOf(code) as AnyCard & { readonly abilities: readonly { readonly id: string }[] };
  return card.abilities.map((a) => a.id as string);
};

describe("registry", () => {
  it("scripts the three refs of the module's cards, none skipped, and each validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([YELLOWJACKET, IRON_LAD, ASSESS].sort());
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY[YELLOWJACKET]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[IRON_LAD]!.trigger).toMatchObject({ kind: "interrupt" });
    expect(REGISTRY[ASSESS]!.trigger).toMatchObject({ kind: "action" });
  });

  it("the card data names exactly those refs, and the three resources print none", () => {
    expect(abilityRefs("56019")).toEqual([YELLOWJACKET]);
    expect(abilityRefs("56052")).toEqual([IRON_LAD]);
    expect(abilityRefs("56053")).toEqual([ASSESS]);
    for (const code of ["56020", "56021", "56022"]) expect(abilityRefs(code), code).toEqual([]);
  });
});

describe("reprints", () => {
  it("56020 Energy, 56021 Genius and 56022 Strength print the icons of 01088, 01089 and 01090 and no ability", () => {
    const pairs = [
      ["56020", "01088", { energy: 2 }],
      ["56021", "01089", { mental: 2 }],
      ["56022", "01090", { physical: 2 }],
    ] as const;
    for (const [reprint, source, icons] of pairs) {
      const a = dataOf(reprint) as AnyCard & { producesIcons: unknown; name: string; deckLimit: number };
      const b = CORE_CARDS.find((c) => c.id === cardId(source)) as unknown as typeof a;
      expect(a.producesIcons, reprint).toEqual(icons);
      expect(a.producesIcons, reprint).toEqual(b.producesIcons);
      expect(a.name, reprint).toBe(b.name);
      expect(a.deckLimit, reprint).toBe(b.deckLimit);
      expect(abilityRefs(source), source).toEqual([]);
    }
  });

  it("56053 Assess the Situation aliases the script of 12033, the same definition object", () => {
    expect(REGISTRY[ASSESS]).toBe(ANT_PACK_CARDS["12033.assess-the-situation-action"]);
    const a = dataOf("56053") as AnyCard & { cost: number; resourceIcons: unknown; traits: unknown; text: unknown };
    const b = dataOf("12033") as typeof a;
    expect(a.cost).toBe(b.cost);
    expect(a.resourceIcons).toEqual(b.resourceIcons);
    expect(a.traits).toEqual(b.traits);
    expect(a.text).toEqual(b.text);
  });
});

describe(`${ASSESS}: +1 hand size until the end of the phase, played from Spider-Man's deck`, () => {
  it("raises the hand size by exactly one and costs nothing", () => {
    const { state, ids } = moveToHand(game("56053"), P1, "56053");
    expect(handSize(state, P1, WAVE10_DEPS)).toBe(5);
    const after = run(state, firstLegal, play(P1, ids[0]!, []));
    expect(handSize(after, P1, WAVE10_DEPS)).toBe(6);
    expect(playerOf(after, P1).discard).toContain(ids[0]!);
    expect(playerOf(after, P1).hand.length).toBe(playerOf(state, P1).hand.length - 1);
  });

  it("two copies stack to +2", () => {
    const first = moveToHand(game("56053", ["56053"]), P1, "56053", "56053");
    const after = run(first.state, firstLegal, play(P1, first.ids[0]!, []), play(P1, first.ids[1]!, []));
    expect(handSize(after, P1, WAVE10_DEPS)).toBe(7);
  });
});

describe(`${YELLOWJACKET}: search the top 5 for an upgrade (Yellowjacket, errata title)`, () => {
  const ally = dataOf("56019") as AllyCard;

  it("data: the current title is Yellowjacket, ATK 2, THW 2, 3 hit points, Avenger, cost 3, unique", () => {
    expect(ally.name).toBe("Yellowjacket");
    expect(ally.text.current).toContain("After Yellowjacket enters play");
    expect(CW_CARDS.find((c) => c.id === cardId("56019"))).toBe(ally);
    expect([ally.cost, ally.atk, ally.thw, ally.hp, ally.unique]).toEqual([3, 2, 2, 3, true]);
    expect(ally.traits).toEqual([trait("AVENGER")]);
    expect(ally.playRestrictions).toEqual({ requiresIdentityTrait: trait("AVENGER") });
  });

  /** Yellowjacket in hand and the deck reordered: the cards `topPicker` returns first (in order), the rest after. */
  function staged(topPicker: (deck: readonly InstanceId[], s: GameState) => readonly InstanceId[]) {
    const { state, ids } = moveToHand(game("56019"), P1, "56019");
    const deck = playerOf(state, P1).deck;
    const top = topPicker(deck, state);
    const reordered: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [...top, ...deck.filter((i) => !top.includes(i))] } : p,
      ),
    };
    return { state: reordered, yellowjacket: ids[0]!, top };
  }
  const nonUpgrades = (deck: readonly InstanceId[], s: GameState, n: number) =>
    deck.filter((i) => typeOf(s, i) !== "upgrade").slice(0, n);
  const upgrades = (deck: readonly InstanceId[], s: GameState) => deck.filter((i) => typeOf(s, i) === "upgrade");
  const payment = (s: GameState, yellowjacket: InstanceId) =>
    playerOf(s, P1)
      .hand.filter((i) => i !== yellowjacket)
      .slice(0, 3);

  it("with an upgrade fifth from the top and another sixth: the fifth goes to hand, the sixth stays in the deck", () => {
    const { state, yellowjacket, top } = staged((deck, s) => {
      const ups = upgrades(deck, s);
      expect(ups.length, "two upgrades in Spider-Man's deck").toBeGreaterThanOrEqual(2);
      return [...nonUpgrades(deck, s, 4), ups[0]!, ups[1]!];
    });
    const [fifth, sixth] = [top[4]!, top[5]!];
    const pay = payment(state, yellowjacket);
    const handBefore = playerOf(state, P1).hand.length;
    const after = run(state, choosing(YELLOWJACKET, fifth), play(P1, yellowjacket, pay));
    const p = playerOf(after, P1);
    expect(p.playArea).toContain(yellowjacket);
    expect(p.hand).toContain(fifth);
    expect(p.deck).not.toContain(fifth);
    expect(p.deck).toContain(sixth);
    expect(p.hand.length).toBe(handBefore - 1 - 3 + 1);
    expect(p.deck.length).toBe(playerOf(state, P1).deck.length - 1);
  });

  it("an upgrade only sixth from the top is out of reach: nothing is added to the hand", () => {
    const { state, yellowjacket, top } = staged((deck, s) => [...nonUpgrades(deck, s, 5), upgrades(deck, s)[0]!]);
    const sixth = top[5]!;
    const pay = payment(state, yellowjacket);
    const handBefore = playerOf(state, P1).hand.length;
    const after = run(state, choosing(YELLOWJACKET, sixth), play(P1, yellowjacket, pay));
    const p = playerOf(after, P1);
    expect(p.playArea).toContain(yellowjacket);
    expect(p.hand).not.toContain(sixth);
    expect(p.deck).toContain(sixth);
    expect(p.hand.length).toBe(handBefore - 1 - 3);
    expect(p.deck.length).toBe(playerOf(state, P1).deck.length);
  });

  it("only an upgrade can be taken: the one upgrade among the top 5 is the only card offered", () => {
    const { state, yellowjacket, top } = staged((deck, s) => [...nonUpgrades(deck, s, 4), upgrades(deck, s)[0]!]);
    const pay = payment(state, yellowjacket);
    let offered: string[] = [];
    const spy: Picker = (s) => {
      const c = s.pendingChoice;
      if (c && c.options.some((o) => o.optionId === (top[4] as string))) offered = c.options.map((o) => o.optionId);
      return choosing(YELLOWJACKET, top[4] as string)(s);
    };
    run(state, spy, play(P1, yellowjacket, pay));
    expect(offered).toEqual([top[4]]);
  });

  it("declining the optional response adds nothing", () => {
    const { state, yellowjacket, top } = staged((deck, s) => [...nonUpgrades(deck, s, 4), upgrades(deck, s)[0]!]);
    const pay = payment(state, yellowjacket);
    const handBefore = playerOf(state, P1).hand.length;
    const after = run(state, firstLegal, play(P1, yellowjacket, pay));
    const p = playerOf(after, P1);
    expect(p.playArea).toContain(yellowjacket);
    expect(p.hand).not.toContain(top[4]!);
    expect(p.hand.length).toBe(handBefore - 1 - 3);
  });

  it("play only if you have the Avenger trait: refused in alter-ego form, allowed in Spider-Man's hero form", () => {
    const alterEgo = moveToHand(game("56019", [], false), P1, "56019");
    const refused = applyCommand(
      alterEgo.state,
      play(P1, alterEgo.ids[0]!, payment(alterEgo.state, alterEgo.ids[0]!)),
      WAVE10_DEPS,
    );
    expect(refused.ok).toBe(false);
    const hero = moveToHand(game("56019"), P1, "56019");
    const accepted = applyCommand(hero.state, play(P1, hero.ids[0]!, payment(hero.state, hero.ids[0]!)), WAVE10_DEPS);
    expect(accepted.ok).toBe(true);
  });
});

describe(`${IRON_LAD}: exhaust another Avenger ally to add its matching power`, () => {
  const SPIDER_WOMAN = "01011"; // Avenger ally, ATK 2, THW 2
  const TIGRA = "01051"; // Avenger ally, ATK 2, THW 1
  const DAREDEVIL = "01058"; // ally without the Avenger trait
  const stat = (code: string, which: "atk" | "thw"): number => {
    const value = (dataOf(code) as AllyCard)[which];
    return typeof value === "number" ? value : 0;
  };

  /** Iron Lad and `others` in play, all ready; the villain and the main scheme are the targets. */
  function table(others: readonly string[]) {
    let s = game("56052", others);
    const lad = stagedInPlay(s, "56052");
    s = lad.state;
    const ids: Record<string, InstanceId> = {};
    for (const code of others) {
      const placed = stagedInPlay(s, code);
      s = placed.state;
      ids[code] = placed.id;
    }
    s = patchInstance(s, s.mainScheme.instanceId, { threat: 20 });
    return { state: s, lad: lad.id, ids, villain: s.activeVillainId! };
  }
  const attack = (s: GameState, attacker: InstanceId, pick: Picker) =>
    run(s, pick, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: s.activeVillainId!,
    });
  const thwart = (s: GameState, thwarter: InstanceId, pick: Picker) =>
    run(s, pick, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: thwarter,
      schemeInstanceId: s.mainScheme.instanceId,
    });
  /** A picker that records whether the interrupt was ever offered, then answers like `choosing`. */
  const watching = (wanted: readonly string[]) => {
    const seen = { offered: false };
    const pick: Picker = (s) => {
      if (s.pendingChoice?.options.some((o) => o.optionId.endsWith(IRON_LAD))) seen.offered = true;
      return choosing(...wanted)(s);
    };
    return { seen, pick };
  };

  it("data: cost 2, ATK 1, THW 1, 3 hit points, Avenger", () => {
    const lad = dataOf("56052") as AllyCard;
    expect([lad.cost, lad.atk, lad.thw, lad.hp]).toEqual([2, 1, 1, 3]);
    expect(lad.traits).toEqual([trait("AVENGER")]);
  });

  it("without the ability Iron Lad's basic attack deals his own 1 damage and takes 1 consequential damage", () => {
    const t = table([SPIDER_WOMAN]);
    const after = attack(t.state, t.lad, firstLegal);
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage + 1);
    expect(inst(after, t.lad).damage).toBe(1);
    expect(inst(after, t.ids[SPIDER_WOMAN]!).exhausted).toBe(false);
  });

  it("an attack adds the exhausted ally's ATK: Iron Lad (1) and Spider-Woman (2) deal 3, Iron Lad alone takes damage", () => {
    const t = table([SPIDER_WOMAN]);
    const after = attack(t.state, t.lad, choosing(IRON_LAD, t.ids[SPIDER_WOMAN]!));
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage + 1 + stat(SPIDER_WOMAN, "atk"));
    expect(inst(after, t.ids[SPIDER_WOMAN]!).exhausted).toBe(true);
    expect(inst(after, t.lad).exhausted).toBe(true);
    expect(inst(after, t.lad).damage).toBe(1);
    expect(inst(after, t.ids[SPIDER_WOMAN]!).damage).toBe(0);
  });

  it("a thwart adds the ally's THW, not its ATK: Tigra (ATK 2, THW 1) adds 1 to a thwart and 2 to an attack", () => {
    const t = table([TIGRA]);
    const thwarted = thwart(t.state, t.lad, choosing(IRON_LAD, t.ids[TIGRA]!));
    expect(inst(thwarted, t.state.mainScheme.instanceId).threat).toBe(20 - 1 - stat(TIGRA, "thw"));
    expect(inst(thwarted, t.ids[TIGRA]!).exhausted).toBe(true);
    const attacked = attack(t.state, t.lad, choosing(IRON_LAD, t.ids[TIGRA]!));
    expect(inst(attacked, t.villain).damage).toBe(inst(t.state, t.villain).damage + 1 + stat(TIGRA, "atk"));
  });

  it("a thwart with Spider-Woman (THW 2) removes 3 threat", () => {
    const t = table([SPIDER_WOMAN]);
    const after = thwart(t.state, t.lad, choosing(IRON_LAD, t.ids[SPIDER_WOMAN]!));
    expect(inst(after, t.state.mainScheme.instanceId).threat).toBe(20 - 3);
  });

  it("the bonus lasts for that use only: a later basic attack by Iron Lad deals his 1 again", () => {
    const t = table([SPIDER_WOMAN]);
    const first = attack(t.state, t.lad, choosing(IRON_LAD, t.ids[SPIDER_WOMAN]!));
    const readied = patchInstance(first, t.lad, { exhausted: false });
    const before = inst(readied, t.villain).damage;
    const second = attack(readied, t.lad, firstLegal);
    expect(inst(second, t.villain).damage).toBe(before + 1);
  });

  it("with two Avenger allies ready, the player picks which one is exhausted", () => {
    const t = table([SPIDER_WOMAN, TIGRA]);
    const after = attack(t.state, t.lad, choosing(IRON_LAD, t.ids[TIGRA]!));
    expect(inst(after, t.ids[TIGRA]!).exhausted).toBe(true);
    expect(inst(after, t.ids[SPIDER_WOMAN]!).exhausted).toBe(false);
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage + 1 + stat(TIGRA, "atk"));
  });

  it("an ally without the Avenger trait is not a legal cost: the interrupt is never offered", () => {
    const t = table([DAREDEVIL]);
    const w = watching([IRON_LAD, t.ids[DAREDEVIL]!]);
    const after = attack(t.state, t.lad, w.pick);
    expect(w.seen.offered).toBe(false);
    expect(inst(after, t.ids[DAREDEVIL]!).exhausted).toBe(false);
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage + 1);
  });

  it("an exhausted Avenger ally cannot pay: nothing is offered and it stays exhausted", () => {
    const t = table([SPIDER_WOMAN]);
    const tired = patchInstance(t.state, t.ids[SPIDER_WOMAN]!, { exhausted: true });
    const w = watching([]);
    const after = attack(tired, t.lad, w.pick);
    expect(w.seen.offered).toBe(false);
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage + 1);
  });

  it("Iron Lad alone is not 'another' ally: he cannot exhaust himself to pay", () => {
    const t = table([]);
    const w = watching([]);
    const after = attack(t.state, t.lad, w.pick);
    expect(w.seen.offered).toBe(false);
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage + 1);
  });

  /** The `abilityNotOffered` events a basic attack by Iron Lad emits, when it opens no choice. */
  const notOffered = (s: GameState, attacker: InstanceId) => {
    const result = applyCommand(
      s,
      { type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: s.activeVillainId! },
      WAVE10_DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.events.filter((e) => e.type === "abilityNotOffered");
  };

  it("with no other ready Avenger ally the engine says the interrupt was not offered: its cost cannot be paid (#431)", () => {
    for (const others of [[], [DAREDEVIL]]) {
      const t = table(others);
      expect(notOffered(t.state, t.lad)).toEqual([
        expect.objectContaining({ instanceId: t.lad, abilityId: IRON_LAD, timing: "interrupt", reason: "cannotPay" }),
      ]);
    }
  });

  it("with a ready Avenger ally the interrupt is offered and nothing says it was not", () => {
    const t = table([SPIDER_WOMAN]);
    const result = applyCommand(
      t.state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: t.lad, targetInstanceId: t.villain },
      WAVE10_DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.filter((e) => e.type === "abilityNotOffered")).toEqual([]);
    expect(result.state.pendingChoice?.options.some((o) => o.optionId.endsWith(IRON_LAD))).toBe(true);
  });

  it("another character's attack is not Iron Lad's use: nothing is said about his interrupt", () => {
    const t = table([DAREDEVIL]);
    expect(notOffered(t.state, t.ids[DAREDEVIL]!)).toEqual([]);
  });

  /** Applies `command` and answers every choice with `pick`, keeping every event on the way. */
  function playing(s: GameState, pick: Picker, command: Parameters<typeof applyCommand>[1]) {
    const events: GameEvent[] = [];
    let result = applyCommand(s, command, WAVE10_DEPS);
    for (let guard = 0; ; guard++) {
      if (!result.ok) throw new Error(result.error.message);
      events.push(...result.events);
      const choice = result.state.pendingChoice;
      if (!choice || result.state.outcome || guard > 200) return { state: result.state, events };
      result = applyCommand(
        result.state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(result.state),
        },
        WAVE10_DEPS,
      );
    }
  }
  /** What a basic attack can hit: a minion engaged with the player (one with guard must be), else the villain. */
  const targetOf = (s: GameState): InstanceId =>
    Object.values(s.instances).find((i) => i.engagedWith === P1 && typeOf(s, i.instanceId) === "minion")?.instanceId ??
    s.activeVillainId!;
  const attackWith = (s: GameState, attacker: InstanceId, pick: Picker) =>
    playing(s, pick, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: targetOf(s),
    });
  /**
   * Ends the turn and plays the villain phase out (no defender), to the next round's player turn. The main scheme is
   * cleared first (`table` loads it with 20 threat for the thwart tests), and the hero healed (no one defends), so the
   * villain phase does not end the game.
   */
  const nextRound = (s: GameState): GameState => {
    const hero = playerOf(s, P1).identity.instanceId;
    const cleared = patchInstance(patchInstance(s, s.mainScheme.instanceId, { threat: 0 }), hero, { damage: 0 });
    const ended = playing(cleared, firstLegal, { type: "endTurn", playerId: P1 }).state;
    expect(ended.outcome ?? null, JSON.stringify(ended.outcome)).toBeNull();
    expect(ended.round).toBe(s.round + 1);
    return ended;
  };
  const offeredIn = (events: readonly GameEvent[]) =>
    events.some((e) => e.type === "abilityResolved" && (e.abilityId as string) === IRON_LAD);
  const notOfferedIn = (events: readonly GameEvent[]) =>
    events.filter((e) => e.type === "abilityNotOffered" && (e.abilityId as string) === IRON_LAD);

  it("across a game: offered while another Avenger ally is ready, then not, with the reason, once none is (#431)", () => {
    const t = table([SPIDER_WOMAN]);
    const woman = t.ids[SPIDER_WOMAN]!;
    // Round 1: Spider-Woman is ready, so Iron Lad's interrupt is offered and taken; nothing says it was not.
    const first = attackWith(t.state, t.lad, choosing(IRON_LAD, woman));
    expect(offeredIn(first.events)).toBe(true);
    expect(notOfferedIn(first.events)).toEqual([]);
    expect(inst(first.state, woman).exhausted).toBe(true);
    // Round 2: both ready again, but Spider-Woman attacks first, so no other Avenger ally is ready for Iron Lad.
    const round2 = nextRound(first.state);
    expect(inst(round2, woman).exhausted).toBe(false);
    const herAttack = attackWith(round2, woman, firstLegal);
    const second = attackWith(herAttack.state, t.lad, choosing(IRON_LAD, woman));
    expect(offeredIn(second.events)).toBe(false);
    expect(notOfferedIn(second.events)).toEqual([expect.objectContaining({ reason: "cannotPay" })]);
  });

  it("across a game: not offered with no other Avenger ally, then offered for each of two that arrive, one per use (#431)", () => {
    // Spider-Woman and Tigra are in the deck, to be put into play later; Iron Lad starts alone.
    const placed = stagedInPlay(game("56052", [SPIDER_WOMAN, TIGRA]), "56052");
    const t = { state: placed.state, lad: placed.id };
    // Round 1: Iron Lad alone. Not offered, and the engine says why.
    const first = attackWith(t.state, t.lad, firstLegal);
    expect(offeredIn(first.events)).toBe(false);
    expect(notOfferedIn(first.events)).toEqual([expect.objectContaining({ reason: "cannotPay" })]);
    // Round 2: Spider-Woman and Tigra join him. Offered; Spider-Woman is the one exhausted.
    let round2 = nextRound(first.state);
    const woman = stagedInPlay(round2, SPIDER_WOMAN);
    const tigra = stagedInPlay(woman.state, TIGRA);
    round2 = tigra.state;
    const second = attackWith(round2, t.lad, choosing(IRON_LAD, woman.id));
    expect(offeredIn(second.events)).toBe(true);
    expect(notOfferedIn(second.events)).toEqual([]);
    expect([inst(second.state, woman.id).exhausted, inst(second.state, tigra.id).exhausted]).toEqual([true, false]);
    // Round 3: Spider-Woman attacks on her own first; Tigra is the other Avenger ally left, so she pays this time.
    const round3 = nextRound(second.state);
    const herAttack = attackWith(round3, woman.id, firstLegal);
    const third = attackWith(herAttack.state, t.lad, choosing(IRON_LAD, tigra.id));
    expect(offeredIn(third.events)).toBe(true);
    expect(notOfferedIn(third.events)).toEqual([]);
    expect(inst(third.state, tigra.id).exhausted).toBe(true);
  });

  it("a stunned Iron Lad has not used a basic power: the stun is removed, nothing is dealt, the ally stays ready", () => {
    const t = table([SPIDER_WOMAN]);
    const stunned = patchInstance(t.state, t.lad, {
      statuses: { ...inst(t.state, t.lad).statuses, stunned: 1 },
    });
    const after = attack(stunned, t.lad, choosing(IRON_LAD, t.ids[SPIDER_WOMAN]!));
    expect(inst(after, t.lad).statuses.stunned).toBe(0);
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage);
    expect(inst(after, t.ids[SPIDER_WOMAN]!).exhausted).toBe(false);
  });

  it("only Iron Lad's own basic power counts: Spider-Woman's attack deals her 2 and Tigra stays ready", () => {
    const t = table([SPIDER_WOMAN, TIGRA]);
    const after = attack(t.state, t.ids[SPIDER_WOMAN]!, choosing(IRON_LAD, t.ids[TIGRA]!));
    expect(inst(after, t.villain).damage).toBe(inst(t.state, t.villain).damage + stat(SPIDER_WOMAN, "atk"));
    expect(inst(after, t.ids[TIGRA]!).exhausted).toBe(false);
  });
});
