import { WINTER_CARDS, cardId, type EventCard } from "@mc/content";
import { createGame, legalActions, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { BLACK_WIDOW } from "../../aos/black-widow.js";
import { wave9Scenario } from "../../setup.js";
import { WS_DEPS, engageMinion, stagedInPlay, wsGame, wsHeroGame } from "../testing.js";
import { WINTER_SOLDIER_EVENTS, WINTER_SOLDIER_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Winter Soldier's events (54004 to 54006), docs/phase7-wave9.md section 8.4, all scripted and tested clause by clause.
 * Arm Block and Metal Punch read "if you exhausted Cybernetic Arm to pay for this event" through the play note the Arm
 * writes on the event it pays for (`CYBERNETIC_ARM_NOTE`); the Arm also makes that event deal 1 additional damage.
 *
 * Payment cards are Core resources: Energy 01088 ([energy]), Genius 01089 ([mental]), Strength 01090 ([physical]).
 * Rhino (stage I) has 14 hit points; Hydra Mercenary 01101 (guard) 3; Shocker 01103 3.
 */
const DISCHARGE = "54006.electrical-discharge-action";
const ARM_BLOCK = "54004.arm-block-constant";
const METAL_PUNCH = "54005.metal-punch-action";
const ENERGY = "01088";
const GENIUS = "01089";
const STRENGTH = "01090";
const MERCENARY = "01101";
const SHOCKER = "01103";

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const stunnedOf = (s: GameState, id: InstanceId): number => inst(s, id).statuses.stunned;
const inPlay = (s: GameState, id: string): boolean => playerOf(s, P1).playArea.includes(id as InstanceId);
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardCodes = (s: GameState): string[] => playerOf(s, P1).discard.map((id) => codeOf(s, id));

/**
 * Plays Electrical Discharge paid with exactly the cards `payers` (card codes): the first hand cards are turned into
 * those cards by test surgery (the printed deck holds no resource cards), the event is moved into hand.
 */
function discharge(state: GameState, payers: readonly string[], pick: Picker = firstLegal) {
  const event = moveToHand(state, P1, "54006");
  const hand = playerOf(event.state, P1).hand.filter((id) => id !== event.ids[0]);
  const paying = hand.slice(0, payers.length);
  const s = paying.reduce((acc, id, n) => patchInstance(acc, id, { cardId: cardId(payers[n]!) }), event.state);
  return driveEventsPicking(WS_DEPS, s, pick, play(P1, event.ids[0]!, paying));
}

const offered = (s: GameState, id: InstanceId): boolean => {
  const legal = legalActions(s, P1, WS_DEPS);
  if (legal.kind !== "turn") throw new Error(legal.kind);
  return legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};

/** Answers a target prompt with `target` when offered. */
const targeting =
  (target: string): Picker =>
  (s) => {
    const hit = s.pendingChoice!.options.find((o) => o.optionId === target);
    return hit ? [hit.optionId] : firstLegal(s);
  };

const card = (code: string) => WINTER_CARDS.find((c) => c.id === cardId(code)) as EventCard;

describe("Winter Soldier events registry", () => {
  it("registers all three refs, each valid; nothing is skipped", () => {
    expect(Object.keys(WINTER_SOLDIER_EVENTS).sort()).toEqual([ARM_BLOCK, METAL_PUNCH, DISCHARGE]);
    for (const id of Object.keys(WINTER_SOLDIER_EVENTS))
      expect(validateDefinition(WINTER_SOLDIER_EVENTS[id]!)).toEqual([]);
    expect(WINTER_SOLDIER_EVENTS_SKIPPED).toEqual({});
  });
  it("timing words and labels: Electrical Discharge and Metal Punch are Hero Actions (attack), Arm Block a Hero Interrupt (attack/defense)", () => {
    expect(WINTER_SOLDIER_EVENTS[DISCHARGE]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(WINTER_SOLDIER_EVENTS[DISCHARGE]!.label).toEqual(["attack"]);
    expect(WINTER_SOLDIER_EVENTS[METAL_PUNCH]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(WINTER_SOLDIER_EVENTS[METAL_PUNCH]!.label).toEqual(["attack"]);
    expect(WINTER_SOLDIER_EVENTS[ARM_BLOCK]!.trigger).toMatchObject({ kind: "interrupt", forced: false, form: "hero" });
    expect(WINTER_SOLDIER_EVENTS[ARM_BLOCK]!.label).toEqual(["attack", "defense"]);
  });
  it("the printed data names exactly these refs, with costs 1, 3 and 2", () => {
    for (const [code, ref, cost] of [
      ["54004", ARM_BLOCK, 1],
      ["54005", METAL_PUNCH, 3],
      ["54006", DISCHARGE, 2],
    ] as const) {
      expect(card(code).abilities.map((a) => a.id as string)).toEqual([ref]);
      expect(card(code).cost).toBe(cost);
    }
    expect(card("54006").traits.map(String)).toContain("ATTACK");
    // Arm Block is an Attack event by trait, so Cybernetic Arm may pay for it.
    expect(card("54004").traits.map(String)).toEqual(expect.arrayContaining(["ATTACK", "DEFENSE"]));
    expect(card("54005").traits.map(String)).toContain("ATTACK");
  });
});

describe(`${DISCHARGE} (Electrical Discharge 54006): 4 damage to an enemy; paid with [energy], stun it`, () => {
  it("costs 2: two cards are discarded to pay, the event goes to the discard pile", () => {
    const { state } = discharge(wsHeroGame(), [GENIUS, STRENGTH]);
    expect(discardCodes(state)).toEqual(expect.arrayContaining(["54006", GENIUS, STRENGTH]));
    expect(discardCodes(state)).toHaveLength(3);
  });
  it("paid with two [energy] resources: Rhino takes exactly 4 and is stunned", () => {
    const s = wsHeroGame();
    const { state, events } = discharge(s, [ENERGY, ENERGY]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(1);
    const attacks = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack",
    );
    expect(attacks).toMatchObject([{ event: { amount: 4, basic: false } }]);
  });
  it("paid with one [energy] and one [mental]: one [energy] is enough to stun", () => {
    const { state } = discharge(wsHeroGame(), [ENERGY, GENIUS]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(1);
  });
  it("paid with [mental] and [physical] only: 4 damage and no stun", () => {
    const { state } = discharge(wsHeroGame(), [GENIUS, STRENGTH]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(0);
  });
  it("a wild resource counts as [energy]: The Power of Aggression 01055 ([wild]) plus [mental] stuns", () => {
    const { state } = discharge(wsHeroGame(), ["01055", GENIUS]);
    expect(inst(state, villainOf(state)).damage).toBe(4);
    expect(stunnedOf(state, villainOf(state))).toBe(1);
  });
  it("a minion chosen as the target: Shocker (3 hit points) is defeated, and Rhino is untouched and not stunned", () => {
    const s = engageMinion(wsHeroGame(), SHOCKER, "shocker");
    const { state } = discharge(s, [ENERGY, ENERGY], targeting("shocker"));
    expect(inPlay(state, "shocker")).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(stunnedOf(state, villainOf(state))).toBe(0);
  });
  it("defeating a minion: no overkill, so the 1 excess damage is not dealt to anything else", () => {
    const s = engageMinion(wsHeroGame(), MERCENARY, "merc");
    const { state } = discharge(s, [ENERGY, ENERGY], targeting("merc"));
    expect(inPlay(state, "merc")).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).discard.length).toBe(3);
  });
  it("guard: with Hydra Mercenary engaged only it can be chosen, and Rhino takes nothing and is not stunned", () => {
    const s = engageMinion(wsHeroGame(), MERCENARY, "merc");
    const seen: string[][] = [];
    const { state } = discharge(s, [ENERGY, ENERGY], (st) => {
      seen.push(st.pendingChoice!.options.map((o) => o.label));
      return firstLegal(st);
    });
    expect(seen[0]).toEqual(["Hydra Mercenary"]);
    expect(inPlay(state, "merc")).toBe(false);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(stunnedOf(state, villainOf(state))).toBe(0);
  });
  it("is a Hero Action: not offered in alter-ego form, offered in hero form", () => {
    const alterEgo = moveToHand(wsGame(), P1, "54006");
    expect(offered(alterEgo.state, alterEgo.ids[0]!)).toBe(false);
    const hero = moveToHand(wsHeroGame(), P1, "54006");
    expect(offered(hero.state, hero.ids[0]!)).toBe(true);
  });
});

const ARM = "54002.cybernetic-arm-resource";
const BLANK = "01186"; // Advance: no boost icons (the villain schemes when it is dealt)
const ASSAULT = "01187"; // no boost icons
const HAYMAKER = "01087"; // Hero Action (attack): 3 damage, cost 2
const WHIPLASH = "01172"; // minion: ATK 3, 4 hit points, retaliate 1
const WIDOW = "54003";

const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const heroDamage = (s: GameState): number => damageOf(s, identityOf(s));

/** Hero form, with Cybernetic Arm attached when `arm`, and the event `code` in hand. */
function staged(code: string, opts: { readonly arm?: boolean | undefined; readonly ally?: boolean } = {}) {
  let s = wsHeroGame();
  let armId: InstanceId | undefined;
  if (opts.arm) {
    const given = stagedInPlay(s, "54002", { attach: true });
    s = given.state;
    armId = given.id;
  }
  if (opts.ally) s = stagedInPlay(s, WIDOW).state;
  const given = moveToHand(s, P1, code);
  return { state: given.state, event: given.ids[0]!, arm: armId };
}

/** An id of a hand card other than `exclude`, to pay with, `n` of them. */
const handPay = (s: GameState, n: number, ...exclude: readonly InstanceId[]): InstanceId[] =>
  playerOf(s, P1)
    .hand.filter((i) => !exclude.includes(i))
    .slice(0, n);

/**
 * The picker for the villain phase after `endTurn`: Arm Block is declined in the first `skip` windows that offer it and
 * played in the next one, paid with Cybernetic Arm (`arm`) or one hand card; the defender is `defender` when offered,
 * else nobody.
 */
function blocker(
  opts: {
    readonly arm?: InstanceId | undefined;
    readonly skip?: number;
    readonly defender?: InstanceId;
    readonly seen?: string[];
  } = {},
): Picker {
  let skip = opts.skip ?? 0;
  return (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        opts.seen?.push(...ids);
        const hit = ids.find((o) => o.includes("54004.arm-block-constant"));
        if (!hit) return firstLegal(s);
        if (skip > 0) {
          skip--;
          return [];
        }
        return [hit];
      }
      case "payForCard":
        return opts.arm
          ? ids.filter((o) => o.startsWith(`ability:${opts.arm}:`))
          : ids.filter((o) => o.startsWith("hand:")).slice(0, 1);
      case "declareDefender":
        return [opts.defender && ids.includes(opts.defender) ? opts.defender : "decline"];
      default:
        return firstLegal(s);
    }
  };
}

/** Plays Arm Block through the villain's attack: Rhino (ATK 2, no boost icons) attacks the hero in the villain phase. */
function blockVillain(opts: { readonly arm?: boolean } = {}) {
  const t = staged("54004", opts);
  const state = stackEncounterDeck(t.state, ASSAULT, BLANK);
  const done = driveEventsPicking(WS_DEPS, state, blocker({ arm: opts.arm ? t.arm : undefined }), endTurn(P1));
  return { ...done, event: t.event, armId: t.arm };
}
const inPlayId = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).playArea.find((i) => codeOf(s, i) === code)!;

describe(`${ARM_BLOCK} (Arm Block 54004): deal 3 damage to the attacker; with the Arm, prevent all damage from its attack`, () => {
  it("costs 1: paid with one card, the event and the card are discarded", () => {
    const { state, event } = blockVillain();
    expect(discardCodes(state)).toEqual(expect.arrayContaining(["54004"]));
    expect(playerOf(state, P1).discard).toContain(event);
  });
  it("without the Arm: Rhino takes exactly 3 and its attack still hits, 2 damage to the undefended hero", () => {
    const { state } = blockVillain();
    expect(damageOf(state, villainOf(state))).toBe(3);
    expect(heroDamage(state)).toBe(2);
  });
  it("with the Arm: the Arm is exhausted, Rhino takes 3 + 1 = 4 and the hero takes none of the attack", () => {
    const { state, armId } = blockVillain({ arm: true });
    expect(inst(state, armId!).exhausted).toBe(true);
    expect(damageOf(state, villainOf(state))).toBe(4);
    expect(heroDamage(state)).toBe(0);
  });
  it("the (defense) label makes the hero the defender: no ally is offered; declaring the hero defends with DEF 2", () => {
    const offeredDefenders: string[][] = [];
    const t = staged("54004", { ally: true });
    const state = stackEncounterDeck(t.state, ASSAULT, BLANK);
    const base = blocker({ defender: identityOf(state) });
    const pick: Picker = (st) => {
      if (st.pendingChoice!.prompt.kind === "declareDefender")
        offeredDefenders.push(st.pendingChoice!.options.map((o) => o.optionId as string));
      return base(st);
    };
    const done = driveEventsPicking(WS_DEPS, state, pick, endTurn(P1));
    expect(offeredDefenders[0]).toEqual(["decline", identityOf(state)]);
    expect(damageOf(done.state, inPlayId(done.state, WIDOW))).toBe(0);
    expect(heroDamage(done.state)).toBe(0);
  });
  it("an attack event by you: the 3 damage is an initiated attack on the villain, not a basic attack", () => {
    const { events, state } = blockVillain();
    const mine = events.filter(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack",
    );
    expect(mine).toMatchObject([{ event: { amount: 3, basic: false } }]);
    expect(damageOf(state, villainOf(state))).toBe(3);
  });
  it("is paid for once per play: a Cybernetic Arm exhausted earlier for Haymaker does not count for Arm Block", () => {
    const t = staged("54004", { arm: true });
    const haymaker = playerOf(t.state, P1).hand.find((i) => i !== t.event)!;
    const swapped = patchInstance(t.state, haymaker, { cardId: cardId(HAYMAKER) });
    const pay = handPay(swapped, 1, t.event, haymaker);
    const first = driveEventsPicking(
      WS_DEPS,
      swapped,
      firstLegal,
      play(P1, haymaker, pay, { abilities: [resourceAbility(t.arm!, ARM)] }),
    );
    expect(inst(first.state, t.arm!).exhausted).toBe(true);
    // Haymaker 3 + 1 from the Arm; then the villain phase: Arm Block paid with a card (the Arm is still exhausted).
    expect(damageOf(first.state, villainOf(first.state))).toBe(4);
    const staged2 = stackEncounterDeck(first.state, ASSAULT, BLANK);
    const done = driveEventsPicking(WS_DEPS, staged2, blocker(), endTurn(P1));
    expect(damageOf(done.state, villainOf(done.state))).toBe(4 + 3);
    expect(heroDamage(done.state)).toBe(2);
  });
});

describe(`${ARM_BLOCK}: against a minion's attack`, () => {
  /** Whiplash (ATK 3, retaliate 1) with 8 hit points, so Arm Block does not defeat it; the villain's own attack is declined. */
  function againstWhiplash(arm: boolean) {
    const t = staged("54004", { arm });
    const base = engageMinion(t.state, WHIPLASH, "whip");
    const card = base.cardPool[cardId(WHIPLASH)] as unknown as Record<string, unknown>;
    const strong = { ...base, cardPool: { ...base.cardPool, [cardId(WHIPLASH)]: { ...card, hp: 8 } } } as GameState;
    // Rhino's boost card, then the dealt card; a surgery-engaged minion is dealt no boost card of its own.
    const state = stackEncounterDeck(strong, ASSAULT, BLANK);
    const picker = blocker({ arm: arm ? t.arm : undefined, skip: 1 });
    const done = driveEventsPicking(WS_DEPS, state, picker, endTurn(P1));
    return { ...done, whip: "whip" as InstanceId };
  }
  it("without the Arm: Whiplash takes 3 and answers with retaliate 1, then its attack hits for 3; Rhino's own attack, not answered, adds 2", () => {
    const { state, whip } = againstWhiplash(false);
    expect(damageOf(state, whip)).toBe(3);
    expect(damageOf(state, villainOf(state))).toBe(0);
    expect(heroDamage(state)).toBe(2 + 1 + 3);
  });
  it("with the Arm: Whiplash takes 3 + 1 = 4, still answers with retaliate 1 (Arm Block is an attack), and its attack deals nothing", () => {
    const { state, whip } = againstWhiplash(true);
    expect(damageOf(state, whip)).toBe(4);
    expect(damageOf(state, villainOf(state))).toBe(0);
    expect(heroDamage(state)).toBe(2 + 1);
  });
  it("a minion the 3 damage defeats makes no attack and no retaliate: Hydra Mercenary (3 hit points)", () => {
    const t = staged("54004");
    // Hydra Mercenary has guard, so Rhino cannot be attacked while it is engaged: Arm Block is offered only for its attack.
    const state = stackEncounterDeck(engageMinion(t.state, MERCENARY, "merc"), ASSAULT, BLANK);
    const done = driveEventsPicking(WS_DEPS, state, blocker(), endTurn(P1));
    expect(inPlay(done.state, "merc")).toBe(false);
    expect(heroDamage(done.state)).toBe(2);
  });
});

describe(`${ARM_BLOCK}: Black Widow's forced interrupt (ruling January 17, 2026 - Ruling 2)`, () => {
  const WIDOW_DEPS: EngineDeps = { abilities: mergeRegistries(WS_DEPS.abilities, BLACK_WIDOW) };
  const GRUNT = "50073";
  /** Winter Soldier against Black Widow in hero form, her setup minions put in the discard pile. */
  function widowGame(): { readonly state: GameState; readonly villain: InstanceId } {
    const config = wave9Scenario("black-widow", {
      players: [{ starterDeckId: "winter-aggression" }],
      seed: 1,
      difficulty: "standard",
    });
    const created = createGame(config, WIDOW_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WIDOW_DEPS);
    const engaged = Object.keys(settled.instances).filter((id) => settled.instances[id as InstanceId]!.engagedWith);
    const state = {
      ...settled,
      players: settled.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !engaged.includes(i)) })),
      instances: Object.fromEntries(
        Object.entries(settled.instances).map(([id, i]) => [
          id,
          engaged.includes(id) ? { ...i, engagedWith: undefined } : i,
        ]),
      ) as GameState["instances"],
    } as GameState;
    return { state: withForm(state, { heroForm: 0 }), villain: state.villains[0]!.instanceId };
  }
  function blockWidow(arm: boolean) {
    const base = widowGame();
    let s = base.state;
    let armId: InstanceId | undefined;
    if (arm) {
      const given = stagedInPlay(s, "54002", { attach: true });
      s = given.state;
      armId = given.id;
    }
    const given = moveToHand(s, P1, "54004");
    // The Grunt is revealed by her interrupt when Arm Block attacks her, before her boost card; then the dealt card.
    const state = stackEncounterDeck(given.state, GRUNT, ASSAULT, BLANK);
    const done = driveEventsPicking(WIDOW_DEPS, state, blocker({ arm: armId }), endTurn(P1));
    return { ...done, villain: base.villain };
  }
  it("without the Arm: the revealed A.I.M. Grunt takes the 3 damage (5 hit points), Black Widow takes none and her attack is not prevented", () => {
    const { state, villain } = blockWidow(false);
    const grunt = playerOf(state, P1).playArea.find((i) => codeOf(state, i) === GRUNT)!;
    expect(damageOf(state, grunt)).toBe(3);
    expect(damageOf(state, villain)).toBe(0);
    expect(heroDamage(state)).toBe(1 + 1); // her ATK 1, then the Grunt (engaged now) attacks with ATK 1 in the minion step
  });
  it("with the Arm: the Grunt takes 3 + 1 = 4 and the prevention still refers to Black Widow's own attack: the hero takes none of it", () => {
    const { state, villain } = blockWidow(true);
    const grunt = playerOf(state, P1).playArea.find((i) => codeOf(state, i) === GRUNT)!;
    expect(damageOf(state, grunt)).toBe(4);
    expect(damageOf(state, villain)).toBe(0);
    expect(heroDamage(state)).toBe(1); // only the Grunt's own attack later in the phase; hers was prevented
  });
});

describe(`${METAL_PUNCH} (Metal Punch 54005): 7 damage to an enemy; paid with the Arm, the attack gains overkill`, () => {
  /** Metal Punch (cost 3) played at `target`, paid with three hand cards or, with the Arm, the Arm and two. */
  function punch(target: string | undefined, opts: { readonly arm?: boolean; readonly minion?: string } = {}) {
    const t = staged("54005", { arm: opts.arm });
    const s = opts.minion ? engageMinion(t.state, opts.minion, "target") : t.state;
    const pay = handPay(s, opts.arm ? 2 : 3, t.event);
    const payment = opts.arm ? { abilities: [resourceAbility(t.arm!, ARM)] } : undefined;
    const done = driveEventsPicking(
      WS_DEPS,
      s,
      target ? targeting(target) : firstLegal,
      play(P1, t.event, pay, payment),
    );
    return { ...done, event: t.event, arm: t.arm };
  }
  it("costs 3: three cards are discarded, the event goes to the discard pile", () => {
    const { state } = punch(undefined);
    expect(playerOf(state, P1).discard).toHaveLength(4);
  });
  it("without the Arm: Rhino takes exactly 7", () => {
    const { state } = punch(undefined);
    expect(damageOf(state, villainOf(state))).toBe(7);
  });
  it("with the Arm (and two cards): the Arm is exhausted and Rhino takes 7 + 1 = 8", () => {
    const { state, arm } = punch(undefined, { arm: true });
    expect(inst(state, arm!).exhausted).toBe(true);
    expect(damageOf(state, villainOf(state))).toBe(8);
    expect(playerOf(state, P1).discard).toHaveLength(3);
  });
  it("without the Arm no overkill: Shocker (3 hit points) is defeated and the 4 excess damage is lost", () => {
    const { state } = punch("target", { minion: SHOCKER });
    expect(inPlay(state, "target")).toBe(false);
    expect(damageOf(state, villainOf(state))).toBe(0);
  });
  it("with the Arm the attack gains overkill: 8 damage defeats Shocker (3) and 8 - 3 = 5 is dealt to Rhino", () => {
    const { state } = punch("target", { arm: true, minion: SHOCKER });
    expect(inPlay(state, "target")).toBe(false);
    expect(damageOf(state, villainOf(state))).toBe(5);
  });
  it("the Arm exhausted earlier in the turn for Haymaker does not count: Metal Punch paid with cards has no overkill", () => {
    const t = staged("54005", { arm: true });
    const haymaker = playerOf(t.state, P1).hand.find((i) => i !== t.event)!;
    const swapped = patchInstance(t.state, haymaker, { cardId: cardId(HAYMAKER) });
    const first = driveEventsPicking(
      WS_DEPS,
      swapped,
      firstLegal,
      play(P1, haymaker, handPay(swapped, 1, t.event, haymaker), { abilities: [resourceAbility(t.arm!, ARM)] }),
    );
    expect(damageOf(first.state, villainOf(first.state))).toBe(4);
    const s = engageMinion(first.state, SHOCKER, "target");
    const done = driveEventsPicking(WS_DEPS, s, targeting("target"), play(P1, t.event, handPay(s, 3, t.event)));
    expect(inPlay(done.state, "target")).toBe(false);
    expect(damageOf(done.state, villainOf(done.state))).toBe(4);
  });
  it("is labeled (attack): guard applies, so with Hydra Mercenary engaged only it can be chosen", () => {
    const { state } = punch(undefined, { minion: MERCENARY });
    expect(inPlay(state, "target")).toBe(false);
    expect(damageOf(state, villainOf(state))).toBe(0);
  });
  it("is a Hero Action: refused in alter-ego form, offered in hero form", () => {
    const alterEgo = moveToHand(wsGame(), P1, "54005");
    expect(offered(alterEgo.state, alterEgo.ids[0]!)).toBe(false);
    const hero = moveToHand(wsHeroGame(), P1, "54005");
    expect(offered(hero.state, hero.ids[0]!)).toBe(true);
  });
});

describe(`${ARM_BLOCK}: form`, () => {
  it("is a Hero Interrupt: with the hero in alter-ego form it is neither offered to play nor does the villain attack", () => {
    const given = moveToHand(wsGame(), P1, "54004");
    const seen: string[] = [];
    const done = driveEventsPicking(WS_DEPS, given.state, blocker({ seen }), endTurn(P1));
    expect(seen.filter((o) => o.includes("54004"))).toEqual([]);
    expect(damageOf(done.state, villainOf(done.state))).toBe(0);
    expect(playerOf(done.state, P1).hand).toContain(given.ids[0]);
  });
});
