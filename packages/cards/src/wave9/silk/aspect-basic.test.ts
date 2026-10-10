import {
  CORE_CARDS,
  PLAYABLE_CARDS,
  SILK_CARDS,
  cardId,
  type AllyCard,
  type AnyCard,
  type EventCard,
  type SupportCard,
  type UpgradeCard,
} from "@mc/content";
import type { Command, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  runWith,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { ROGUE_EVENTS } from "../../wave6/rogue/rogue/events.js";
import { BLANK, CHARGE, ONE_ICON, onlyDeck, piles, types } from "../testing.js";
import { SILK_ASPECT_BASIC as REGISTRY, SILK_ASPECT_BASIC_SKIPPED as SKIPPED } from "./aspect-basic.js";
import { ASPECT_DEPS as DEPS, aspectGame, aspectHero, engaged, placed } from "./aspect-basic.testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `silk/aspect-basic`, first half (52013 to 52021), docs/phase7-wave9.md sections 3.51 and 3.52. The Silk
 * Protection precon (it holds every card of the half) against Core's Rhino (ATK 2, SCH 1); Silk is DEF 3 and ATK 2 in
 * hero form, Cindy Moon has REC 3 in alter-ego form. Only Core's cards and this module are scripted here.
 */
type WithAbilities = AnyCard & { readonly abilities: readonly { readonly id: string }[] };
type WithText = AnyCard & { readonly text: { readonly current: string } };
type WithTraits = AnyCard & { readonly traits: readonly unknown[] };
type WithIcons = AnyCard & {
  readonly resourceIcons: Readonly<Record<string, number>>;
  readonly producesIcons?: Readonly<Record<string, number>>;
};
const card = <T extends AnyCard>(code: string): T => SILK_CARDS.find((c) => c.id === cardId(code)) as unknown as T;
const anyCard = (code: string): AnyCard =>
  [...SILK_CARDS, ...CORE_CARDS].find((c) => c.id === cardId(code)) as unknown as AnyCard;
/** The resource icons a hand card prints (a resource card prints them as `producesIcons`). */
const iconsOfCard = (s: GameState, id: InstanceId): Readonly<Record<string, number>> => {
  const c = anyCard(inst(s, id).cardId as string) as WithIcons;
  return c.resourceIcons ?? c.producesIcons ?? {};
};
const traitsOf = (code: string): string[] => (card<WithTraits>(code).traits as unknown as string[]).map(String);

const SCARLET = "52013";
const BYTE = "52014";
const NOT_TODAY = "52015";
const STOP = "52016";
const SINCLAIR = "52017";
const SHIELD = "52018";
const READY = "52019";
const STUN_GUN = "52020";
const WEB = "52021";
const SANDMAN = "01102"; // minion: ATK 3, SCH 2, HP 4, Toughness
const SHOCKER = "01103"; // minion: ATK 2, SCH 1, HP 3

const run = (s: GameState, ...c: Parameters<typeof runWith>[2][]): GameState => runWith(DEPS, s, ...c);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const inPlayArea = (s: GameState, id: InstanceId, p: PlayerId = P1): boolean => playerOf(s, p).playArea.includes(id);
const inDiscard = (s: GameState, id: InstanceId, p: PlayerId = P1): boolean => playerOf(s, p).discard.includes(id);
const handSize = (s: GameState, p: PlayerId = P1): number => playerOf(s, p).hand.length;
const hero = (opts: Parameters<typeof aspectGame>[0] = {}): GameState => aspectHero(opts);
const bothHeroes = (): GameState => withForm(aspectHero({ second: true }), { heroForm: 0 }, P2);

/**
 * Hand ids of `player` whose card prints `type` (or a wild), the first `n`, none of `exclude`: what pays for a cost
 * of a given type.
 */
const iconsFor = (s: GameState, player: PlayerId, type: string, n: number, exclude: readonly InstanceId[] = []) => {
  const picks = playerOf(s, player).hand.filter((id) => {
    if (exclude.includes(id)) return false;
    const icons = iconsOfCard(s, id);
    return (icons[type] ?? 0) + (icons.wild ?? 0) > 0;
  });
  if (picks.length < n) throw new Error(`fewer than ${n} ${type} cards in hand`);
  return picks.slice(0, n);
};

/** Settled play of `code` from the hand, paid with the first `cost` other cards (or `pay`), optionally attached. */
function played(
  state: GameState,
  code: string,
  opts: {
    readonly pay?: readonly InstanceId[];
    readonly cost?: number;
    readonly attachTo?: InstanceId;
    readonly player?: PlayerId;
  } = {},
) {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const cost = opts.cost ?? ((anyCard(code) as unknown as { cost: number }).cost as number) ?? 0;
  const pay =
    opts.pay ??
    playerOf(given.state, player)
      .hand.filter((i) => i !== id)
      .slice(0, cost);
  const before = handSize(given.state, player);
  const after = drive(
    run(given.state, play(player, id, pay, opts.attachTo !== undefined ? { attachToInstanceId: opts.attachTo } : {})),
  );
  return { state: after, id, handBefore: before };
}

/**
 * The villain phase driver: every seat ends its turn on an encounter deck that is exactly `deck` (top first, which
 * gives the boost card of each activation, then the cards dealt). A trigger option whose id ends with an entry of
 * `accept` is taken on the occurrences named by `on` (default: every one); every other optional thing is declined.
 */
interface Plan {
  readonly deck: readonly string[];
  readonly hand?: readonly string[];
  readonly accept?: readonly string[];
  /** Occurrence numbers (0-based, over all offers of the accepted refs) that are accepted; default all. */
  readonly on?: readonly number[];
  /** Instance ids declared as the defender, in order of the attacks; absent entries decline. */
  readonly defenders?: readonly (InstanceId | undefined)[];
  /** Hand ids selected to pay for a card or an ability. */
  readonly pay?: readonly InstanceId[];
  /** Instance ids chosen when a target / card prompt offers them. */
  readonly target?: readonly InstanceId[];
  readonly keep?: readonly InstanceId[];
}
function phase(state: GameState, plan: Plan, commands?: readonly Command[]) {
  const staged = onlyDeck(state, ...plan.deck);
  const offered: string[] = [];
  let offers = 0;
  let defenders = 0;
  const pick: Picker = (s) => {
    const open = s.pendingChoice!;
    const ids = open.options.map((o) => o.optionId as string);
    if (open.prompt.kind === "discardDownToHandSize") {
      const spare = open.options.filter((o) => !(plan.keep ?? []).includes(o.optionId as InstanceId));
      return spare.slice(0, open.minSelections).map((o) => o.optionId);
    }
    if (open.prompt.kind === "declareDefender") {
      const wanted = plan.defenders?.[defenders++];
      return wanted && ids.includes(wanted) ? [wanted] : ["decline"];
    }
    if (open.prompt.kind === "payForCard" || open.prompt.kind === "payForAbility") {
      const spare = open.options.filter(
        (o) => !(plan.keep ?? []).some((k) => o.optionId === k || o.optionId === `hand:${k}`),
      );
      const mine = (plan.pay ?? [])
        .map((id) => (ids.includes(`hand:${id}`) ? `hand:${id}` : id))
        .filter((id) => ids.includes(id));
      return mine.length > 0 ? mine : spare.slice(0, open.prompt.cost).map((o) => o.optionId);
    }
    if (open.prompt.kind === "chooseTriggers") {
      const hit = ids.find((o) => (plan.accept ?? []).some((a) => o.endsWith(a)));
      if (hit) {
        const n = offers++;
        offered.push(hit);
        if (!plan.on || plan.on.includes(n)) return [hit];
      }
      return firstLegal(s);
    }
    if (["chooseTarget", "chooseCards"].includes(open.prompt.kind)) {
      const hits = (plan.target ?? []).filter((t) => ids.includes(t));
      if (hits.length > 0) return hits.slice(0, open.maxSelections);
    }
    return firstLegal(s);
  };
  const given = plan.hand ? moveToHand(staged, P1, ...plan.hand) : { state: staged, ids: [] as InstanceId[] };
  const result = driveEventsPicking(
    DEPS,
    given.state,
    pick,
    ...(commands ?? given.state.players.map((p) => endTurn(p.playerId))),
  );
  return { ...result, given, offered: () => offered.length };
}
const villainPhase = (state: GameState, plan: Plan) => phase(state, plan);

const drive = (s: GameState, opts: { readonly target?: InstanceId | readonly InstanceId[] } = {}): GameState => {
  const targets = opts.target === undefined ? [] : typeof opts.target === "string" ? [opts.target] : opts.target;
  return driveEventsPicking(DEPS, s, (st) => {
    const open = st.pendingChoice!;
    const hits = targets.filter((t) => open.options.some((o) => o.optionId === t));
    if (["chooseTarget", "chooseCards"].includes(open.prompt.kind) && hits.length > 0) {
      return hits.slice(0, open.maxSelections);
    }
    return firstLegal(st);
  }).state;
};

describe("registry", () => {
  it("every registered script validates", () => {
    for (const [id, def] of Object.entries(REGISTRY)) expect(validateDefinition(def), id).toEqual([]);
  });
  it("registers or skips every printed ref of the module's eighteen cards, none twice", () => {
    const codes = [
      ...Array.from({ length: 9 }, (_, i) => String(52013 + i)),
      ...Array.from({ length: 6 }, (_, i) => String(52022 + i)),
      "52032",
      "52033",
      "52034",
    ];
    const printed = codes.flatMap((code) => card<WithAbilities>(code).abilities.map((a) => a.id));
    expect(printed).toHaveLength(Object.keys(REGISTRY).length + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
  });
  it("registers exactly these nine refs of 52013 to 52021", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([
      "52013.scarlet-spider-interrupt",
      "52014.spider-byte-constant",
      "52015.not-today-interrupt",
      "52016.stop-hitting-yourself-response",
      "52017.dr-sinclair-action",
      "52018.energy-shield-interrupt",
      "52019.ready-for-a-fight-interrupt",
      "52020.stun-gun-action",
      "52021.madame-web-response",
    ]);
  });
  it("skips the second half (52022 to 52027, 52032 to 52034) as not started, nothing else", () => {
    expect(Object.keys(SKIPPED).sort()).toEqual([
      "52022.spider-man-response",
      "52023.across-the-spider-verse-action",
      "52024.investigative-journalism-interrupt",
      "52032.spider-man-2099-response",
      "52033.spider-woman-response",
      "52034.quick-quip-action",
    ]);
    for (const reason of Object.values(SKIPPED)) expect(reason).toBe("second half of the module, not started");
  });
  it("trigger kinds, forms, labels and costs", () => {
    expect(REGISTRY["52013.scarlet-spider-interrupt"]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY["52014.spider-byte-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY["52016.stop-hitting-yourself-response"]).toMatchObject({
      trigger: { kind: "response", forced: false, form: "hero" },
      label: ["attack"],
    });
    expect(REGISTRY["52017.dr-sinclair-action"]).toMatchObject({
      trigger: { kind: "action", form: "alterEgo" },
      cost: { exhaustSelf: true, resources: { mental: 1 } },
    });
    expect(REGISTRY["52018.energy-shield-interrupt"]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY["52018.energy-shield-interrupt"]!.cost).toMatchObject({
      resourcesX: { resource: "energy", bind: "x" },
    });
    expect(REGISTRY["52019.ready-for-a-fight-interrupt"]).toMatchObject({
      trigger: { kind: "interrupt", forced: false, would: true },
      cost: { discardSelf: true },
    });
    expect(REGISTRY["52020.stun-gun-action"]).toMatchObject({
      trigger: { kind: "action", form: "hero" },
      cost: { exhaustSelf: true, spendCounters: { counterType: "charge", amount: 2, upTo: true } },
    });
    expect(REGISTRY["52021.madame-web-response"]!.trigger).toMatchObject({ kind: "response", forced: false });
  });
  it("Not Today! aliases Rogue's 38016 script, and the source's name, cost and text are the same", () => {
    expect(REGISTRY["52015.not-today-interrupt"]).toBe(ROGUE_EVENTS["38016.not-today-interrupt"]);
    const source = PLAYABLE_CARDS.find((c) => c.id === cardId("38016")) as unknown as WithText & EventCard;
    expect(source).toBeDefined();
    expect(card<WithText>(NOT_TODAY).text.current).toBe(source.text.current);
    expect(card<EventCard>(NOT_TODAY).name).toBe(source.name);
    expect(card<EventCard>(NOT_TODAY).cost).toBe(source.cost);
  });
});

describe("printed data", () => {
  it("Scarlet Spider: unique Protection ally, cost 3, ATK 1, THW 1, HP 5, consequential 2/2, WEB-WARRIOR, [physical]", () => {
    const c = card<AllyCard>(SCARLET);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique]).toEqual([3, 1, 1, 5, "protection", true]);
    expect(c.consequentialDamage).toEqual({ attack: 2, thwart: 2 });
    expect(traitsOf(SCARLET)).toEqual(["WEB-WARRIOR"]);
    expect(card<WithIcons>(SCARLET).resourceIcons).toEqual({ physical: 1 });
  });
  it("Spider-Byte: unique Protection ally, cost 3, ATK 1, THW 2, HP 2, consequential 1/1, WEB-WARRIOR, [mental]", () => {
    const c = card<AllyCard>(BYTE);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique]).toEqual([3, 1, 2, 2, "protection", true]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(traitsOf(BYTE)).toEqual(["WEB-WARRIOR"]);
    expect(card<WithIcons>(BYTE).resourceIcons).toEqual({ mental: 1 });
  });
  it("Not Today!: Protection DEFENSE event, cost 1, [mental], up to 3 copies, the same name and text as Rogue's 38016", () => {
    const c = card<EventCard>(NOT_TODAY);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([1, "protection", 3]);
    expect(traitsOf(NOT_TODAY)).toEqual(["DEFENSE"]);
    expect(card<WithIcons>(NOT_TODAY).resourceIcons).toEqual({ mental: 1 });
  });
  it("Stop Hitting Yourself: Protection ATTACK event, cost 2, [physical], up to 3 copies", () => {
    const c = card<EventCard>(STOP);
    expect([c.cost, c.aspect, c.deckLimit, c.name]).toEqual([2, "protection", 3, '"Stop Hitting Yourself"']);
    expect(traitsOf(STOP)).toEqual(["ATTACK"]);
    expect(card<WithIcons>(STOP).resourceIcons).toEqual({ physical: 1 });
  });
  it("Dr. Sinclair: Protection PERSONA and THERAPIST support, cost 2, [mental], unique", () => {
    const c = card<SupportCard>(SINCLAIR);
    expect([c.cost, c.aspect, c.unique]).toEqual([2, "protection", true]);
    expect(traitsOf(SINCLAIR)).toEqual(["PERSONA", "THERAPIST"]);
    expect(card<WithIcons>(SINCLAIR).resourceIcons).toEqual({ mental: 1 });
  });
  it("Energy Shield: Protection ITEM and TECH upgrade, cost 0, [energy], attaches to any character, max 1 per character", () => {
    const c = card<UpgradeCard>(SHIELD);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([0, "protection", 3]);
    expect(traitsOf(SHIELD)).toEqual(["ITEM", "TECH"]);
    expect(card<WithIcons>(SHIELD).resourceIcons).toEqual({ energy: 1 });
    expect((c as unknown as { attachesTo: unknown }).attachesTo).toEqual({ kind: "anyCharacter" });
    expect((c as unknown as { playRestrictions: unknown }).playRestrictions).toEqual({ maxPerHost: 1 });
  });
  it("Ready for a Fight: Protection PREPARATION upgrade, cost 1, [physical], Requirement ([physical]), max 1 per player", () => {
    const c = card<UpgradeCard>(READY);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([1, "protection", 3]);
    expect(traitsOf(READY)).toEqual(["PREPARATION"]);
    expect((c as unknown as { keywords: unknown }).keywords).toEqual([{ name: "requirement", icon: "physical" }]);
    expect((c as unknown as { playRestrictions: unknown }).playRestrictions).toEqual({ maxPerPlayer: 1 });
  });
  it("Stun Gun: Protection TECH and WEAPON upgrade, cost 2, [energy], Restricted, Uses (2 charge counters)", () => {
    const c = card<UpgradeCard>(STUN_GUN);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([2, "protection", 3]);
    expect(traitsOf(STUN_GUN)).toEqual(["TECH", "WEAPON"]);
    expect((c as unknown as { keywords: unknown }).keywords).toEqual([
      { name: "restricted" },
      { name: "uses", count: 2, counterType: "charge" },
    ]);
  });
  it("Madame Web: unique Basic ally, cost 3, ATK 1, THW 2, HP 2, consequential 1/1, WEB-WARRIOR, [mental]", () => {
    const c = card<AllyCard>(WEB);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique]).toEqual([3, 1, 2, 2, "basic", true]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(traitsOf(WEB)).toEqual(["WEB-WARRIOR"]);
    expect(card<WithIcons>(WEB).resourceIcons).toEqual({ mental: 1 });
  });
});

describe("52014.spider-byte-constant: costs 1 less for each Tech card you control", () => {
  /** Plays Spider-Byte paying `n` other hand cards; true if the engine accepts that payment. */
  const accepts = (state: GameState, n: number): boolean => {
    const given = moveToHand(state, P1, BYTE);
    const id = given.ids[0]!;
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== id)
      .slice(0, n);
    try {
      run(given.state, play(P1, id, pay));
      return true;
    } catch {
      return false;
    }
  };
  const costWith = (state: GameState): number => [0, 1, 2, 3].find((n) => accepts(state, n))!;
  const withCards = (...codes: string[]): GameState => codes.reduce((s, code) => placed(s, code).state, aspectGame());

  it("no Tech card: the full cost of 3 (2 resources are refused)", () => {
    expect(accepts(aspectGame(), 2)).toBe(false);
    expect(costWith(aspectGame())).toBe(3);
  });
  it("one Tech card (Energy Shield): 2", () => {
    expect(costWith(withCards(SHIELD))).toBe(2);
  });
  it("two Tech cards (Energy Shield, Stun Gun): 1", () => {
    expect(costWith(withCards(SHIELD, STUN_GUN))).toBe(1);
  });
  it("three Tech cards: 0, and a fourth does not take the cost below 0", () => {
    expect(costWith(withCards(SHIELD, SHIELD, STUN_GUN))).toBe(0);
    expect(costWith(withCards(SHIELD, SHIELD, STUN_GUN, STUN_GUN))).toBe(0);
    const state = withCards(SHIELD, SHIELD, STUN_GUN);
    const out = played(state, BYTE, { pay: [] });
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(handSize(out.state)).toBe(out.handBefore - 1);
  });
  it("a card without the trait does not count (Ready for a Fight, Dr. Sinclair): still 3", () => {
    expect(costWith(withCards(READY, SINCLAIR))).toBe(3);
  });
  it("a Tech card in the hand is not one you control: still 3", () => {
    const given = moveToHand(aspectGame(), P1, SHIELD, STUN_GUN);
    expect(costWith(given.state)).toBe(3);
  });
  it("another player's Tech card is not one you control: still 3; yours alongside it counts alone", () => {
    const put = placed(aspectGame({ second: true }), SHIELD);
    const theirs: GameState = {
      ...put.state,
      players: put.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== put.id) }
          : p.playerId === P2
            ? { ...p, playArea: [...p.playArea, put.id] }
            : p,
      ),
    };
    const owned = patchInstance(theirs, put.id, { controllerId: P2 });
    expect(costWith(owned)).toBe(3);
    expect(costWith(placed(owned, STUN_GUN).state)).toBe(2);
  });
  it("paying the reduced cost spends exactly that many cards: enters play ready, the hand drops by the cost plus the card", () => {
    const out = played(withCards(SHIELD, STUN_GUN), BYTE, { cost: 1 });
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(handSize(out.state)).toBe(out.handBefore - 1 - 1);
  });
});

describe("52020.stun-gun-action: Hero Action, exhaust and remove 1 or 2 charge counters; 1 stuns a minion, 2 the villain", () => {
  const ID = "52020.stun-gun-action";
  const stage = (counters = 2, minions: readonly [string, string][] = [[SANDMAN, "m-sandman"]]) => {
    const gun = placed(hero(), STUN_GUN, { charge: counters }, P1, true);
    const state = minions.reduce((s, [code, slot]) => engaged(s, code, slot), gun.state);
    return { state, gun: gun.id };
  };
  const stunned = (s: GameState, id: InstanceId) => inst(s, id).statuses.stunned;
  const stunnedAny = (s: GameState) => Object.values(s.instances).filter((i) => i.statuses.stunned > 0).length;

  it("costs 2 and enters play ready with 2 charge counters", () => {
    const out = played(hero(), STUN_GUN);
    expect(inst(out.state, out.id).attachedTo).toBe(identityOf(out.state));
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(inst(out.state, out.id).counters).toEqual({ charge: 2 });
    expect(handSize(out.state)).toBe(out.handBefore - 1 - 2);
  });
  it("1 counter stuns the chosen minion and nothing else: the gun exhausts, 2 counters become 1", () => {
    const { state, gun } = stage();
    const after = drive(run(state, use(P1, gun, ID, [], undefined, { counters: 1 })), {
      target: "m-sandman" as InstanceId,
    });
    expect(stunned(after, "m-sandman" as InstanceId)).toBe(1);
    expect(stunned(after, villainOf(after))).toBe(0);
    expect(inst(after, gun).exhausted).toBe(true);
    expect(inst(after, gun).counters).toEqual({ charge: 1 });
  });
  it("2 counters stun the villain and not the minion: the last counter removed discards the gun (Uses, RRG 1.8 p. 46)", () => {
    const { state, gun } = stage();
    const after = drive(run(state, use(P1, gun, ID, [], undefined, { counters: 2 })));
    expect(stunned(after, villainOf(after))).toBe(1);
    expect(stunned(after, "m-sandman" as InstanceId)).toBe(0);
    expect(inDiscard(after, gun)).toBe(true);
    expect(inst(after, identityOf(after)).attachments).not.toContain(gun);
  });
  it("without a choice the cost removes as many counters as it can (2): the villain", () => {
    const { state, gun } = stage();
    const after = drive(run(state, use(P1, gun, ID)));
    expect(stunned(after, villainOf(after))).toBe(1);
    expect(inDiscard(after, gun)).toBe(true);
  });
  it("with two minions engaged the player picks which one is stunned", () => {
    const { state, gun } = stage(2, [
      [SANDMAN, "m-sandman"],
      [SHOCKER, "m-shocker"],
    ]);
    const after = drive(run(state, use(P1, gun, ID, [], undefined, { counters: 1 })), {
      target: "m-shocker" as InstanceId,
    });
    expect(stunned(after, "m-shocker" as InstanceId)).toBe(1);
    expect(stunned(after, "m-sandman" as InstanceId)).toBe(0);
  });
  it("with 1 counter left only 1 can be removed: asking for 2 is refused, 1 stuns a minion and discards the gun", () => {
    const { state, gun } = stage(1);
    expect(() => run(state, use(P1, gun, ID, [], undefined, { counters: 2 }))).toThrow();
    const after = drive(run(state, use(P1, gun, ID, [], undefined, { counters: 1 })), {
      target: "m-sandman" as InstanceId,
    });
    expect(stunned(after, "m-sandman" as InstanceId)).toBe(1);
    expect(inDiscard(after, gun)).toBe(true);
  });
  it("'1 or 2' is not 0: removing no counters is refused (RRG 1.8 'Cost', p. 14)", () => {
    const { state, gun } = stage();
    expect(() => run(state, use(P1, gun, ID, [], undefined, { counters: 0 }))).toThrow();
  });
  it("a stunned villain stays stunned (one status card)", () => {
    const { state, gun } = stage();
    const once = drive(run(state, use(P1, gun, ID, [], undefined, { counters: 2 })));
    expect(stunned(once, villainOf(once))).toBe(1);
  });
  it("1 counter with no minion in play is still payable and stuns nothing (reported: the engine does not refuse a mode with no target)", () => {
    const { state, gun } = stage(2, []);
    const after = drive(run(state, use(P1, gun, ID, [], undefined, { counters: 1 })));
    expect(inst(after, gun).counters).toEqual({ charge: 1 });
    expect(inst(after, gun).exhausted).toBe(true);
    expect(stunnedAny(after)).toBe(0);
  });
  it("Hero Action: refused in alter-ego form", () => {
    const gun = placed(aspectGame(), STUN_GUN, { charge: 2 }, P1, true);
    expect(() => run(gun.state, use(P1, gun.id, ID))).toThrow();
  });
  it("cannot be used while exhausted", () => {
    const { state, gun } = stage();
    expect(() => run(patchInstance(state, gun, { exhausted: true }), use(P1, gun, ID))).toThrow();
  });
});

describe("52017.dr-sinclair-action: Alter-Ego Action, exhaust and spend a [mental] resource; heal REC; you may discard a status card; any player", () => {
  const ID = "52017.dr-sinclair-action";
  const stage = (opts: { second?: boolean } = {}) => {
    const put = placed(aspectGame(opts), SINCLAIR);
    return { state: put.state, sinclair: put.id };
  };
  /** P1 (or `player`) uses Sinclair paying a [mental] card, taking the status option whose label starts `choose`. */
  const useIt = (s: GameState, sinclair: InstanceId, choose: string, player: PlayerId = P1) => {
    const pay = iconsFor(s, player, "mental", 1);
    const after = driveEventsPicking(
      DEPS,
      s,
      (st) => {
        const open = st.pendingChoice!;
        const hit = open.options.find((o) => o.label.startsWith(choose));
        return hit && open.prompt.kind === "chooseOption" ? [hit.optionId] : firstLegal(st);
      },
      use(
        player,
        sinclair,
        ID,
        pay.map((fromHand) => ({ fromHand })),
      ),
    );
    return { state: after.state, paid: pay[0]! };
  };

  it("costs 2 and enters play ready, also in alter-ego form", () => {
    const out = played(aspectGame(), SINCLAIR);
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(handSize(out.state)).toBe(out.handBefore - 1 - 2);
  });
  it("heals exactly REC (3) from Cindy Moon: 5 damage becomes 2; Sinclair exhausts, one card of the hand is spent", () => {
    const { state, sinclair } = stage();
    const hurt = patchInstance(state, identityOf(state), { damage: 5 });
    const { state: after, paid } = useIt(hurt, sinclair, "Do not");
    expect(inst(after, identityOf(after)).damage).toBe(2);
    expect(inst(after, sinclair).exhausted).toBe(true);
    expect(inDiscard(after, paid)).toBe(true);
    expect(handSize(after)).toBe(handSize(hurt) - 1);
  });
  it("the heal stops at 0 damage: 2 damage becomes 0", () => {
    const { state, sinclair } = stage();
    const after = useIt(patchInstance(state, identityOf(state), { damage: 2 }), sinclair, "Do not").state;
    expect(inst(after, identityOf(after)).damage).toBe(0);
  });
  it("'you may discard 1 status card': taking the stunned option discards it", () => {
    const { state, sinclair } = stage();
    const given = patchInstance(state, identityOf(state), {
      damage: 4,
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    const after = useIt(given, sinclair, "Discard the stunned").state;
    expect(inst(after, identityOf(after)).statuses).toEqual({ stunned: 0, confused: 0, tough: 0 });
    expect(inst(after, identityOf(after)).damage).toBe(1);
  });
  it("declining the discard keeps the status card; only the one chosen goes when there are two", () => {
    const { state, sinclair } = stage();
    const given = patchInstance(state, identityOf(state), { statuses: { stunned: 1, confused: 1, tough: 0 } });
    const kept = useIt(given, sinclair, "Do not").state;
    expect(inst(kept, identityOf(kept)).statuses).toEqual({ stunned: 1, confused: 1, tough: 0 });
    const one = useIt(given, sinclair, "Discard the confused").state;
    expect(inst(one, identityOf(one)).statuses).toEqual({ stunned: 1, confused: 0, tough: 0 });
  });
  it("any player may trigger it: P2's alter-ego is healed by P2's REC, P2 pays, P1's identity is untouched", () => {
    const { state, sinclair } = stage({ second: true });
    const hurt = patchInstance(
      patchInstance(state, identityOf(state, P2), { damage: 4, statuses: { stunned: 1, confused: 0, tough: 0 } }),
      identityOf(state),
      { damage: 3 },
    );
    const { state: after, paid } = useIt(hurt, sinclair, "Discard the stunned", P2);
    expect(inst(after, identityOf(after, P2)).damage).toBe(1);
    expect(inst(after, identityOf(after, P2)).statuses.stunned).toBe(0);
    expect(inst(after, identityOf(after)).damage).toBe(3);
    expect(inst(after, sinclair).exhausted).toBe(true);
    expect(inDiscard(after, paid, P2)).toBe(true);
    expect(handSize(after, P1)).toBe(handSize(hurt, P1));
  });
  it("Alter-Ego Action: refused in hero form, for the controller and for another player", () => {
    const { state, sinclair } = stage({ second: true });
    const pay = iconsFor(state, P1, "mental", 1).map((fromHand) => ({ fromHand }));
    expect(() => run(withForm(state, { heroForm: 0 }), use(P1, sinclair, ID, pay))).toThrow();
    const payTwo = iconsFor(state, P2, "mental", 1).map((fromHand) => ({ fromHand }));
    expect(() => run(withForm(state, { heroForm: 0 }, P2), use(P2, sinclair, ID, payTwo))).toThrow();
  });
  it("needs a [mental] resource: a card without the icon does not pay", () => {
    const { state, sinclair } = stage();
    const physical = playerOf(state, P1).hand.find((id) => {
      const icons = iconsOfCard(state, id);
      return (icons.mental ?? 0) + (icons.wild ?? 0) === 0;
    });
    expect(physical).toBeDefined();
    expect(() => run(state, use(P1, sinclair, ID, [{ fromHand: physical! }]))).toThrow();
    expect(() => run(state, use(P1, sinclair, ID, []))).toThrow();
  });
  it("cannot be used while exhausted", () => {
    const { state, sinclair } = stage();
    const pay = iconsFor(state, P1, "mental", 1).map((fromHand) => ({ fromHand }));
    expect(() => run(patchInstance(state, sinclair, { exhausted: true }), use(P1, sinclair, ID, pay))).toThrow();
  });
});

describe("52021.madame-web-response: after she enters play, look at the top X encounter cards (X = Web-Warrior cards you control), you may discard 1, the rest back in any order", () => {
  const ID = "52021.madame-web-response";
  const DECK = ["01098", "01100", "01099", "01186", "01187", "01188"];
  const deckCodes = (s: GameState): string[] => piles(s).deck.map((i) => inst(s, i).cardId as string);
  const discardCodes = (s: GameState): string[] => piles(s).discard.map((i) => inst(s, i).cardId as string);
  /** Plays Madame Web (cost 3) on the stacked deck and takes the response; `discard` is the code discarded, if any. */
  const playWeb = (state: GameState, discard?: string, accept = true) => {
    const staged = onlyDeck(state, ...DECK);
    const given = moveToHand(staged, P1, WEB);
    const id = given.ids[0]!;
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== id)
      .slice(0, 3);
    const looked: string[] = [];
    const out = driveEventsPicking(
      DEPS,
      given.state,
      (s) => {
        const open = s.pendingChoice!;
        if (open.prompt.kind === "chooseTriggers") {
          const hit = open.options.find((o) => o.optionId.endsWith(ID));
          return hit && accept ? [hit.optionId] : firstLegal(s);
        }
        if (open.prompt.kind === "chooseCards") {
          looked.push(...open.options.map((o) => inst(s, o.optionId as InstanceId).cardId as string));
          const hit = open.options.find((o) => discard && inst(s, o.optionId as InstanceId).cardId === discard);
          return hit ? [hit.optionId] : firstLegal(s);
        }
        return firstLegal(s);
      },
      play(P1, id, pay),
    );
    return { ...out, looked, id };
  };

  it("costs 3 and enters play ready", () => {
    const out = playWeb(hero());
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
  });
  it("alter-ego Cindy is not a Web-Warrior: X is 1 (Madame Web alone), so one card is looked at", () => {
    const out = playWeb(aspectGame());
    expect(out.looked).toEqual([DECK[0]]);
  });
  it("hero Silk is a Web-Warrior: X is 2, the top two are looked at and the third is untouched", () => {
    const out = playWeb(hero());
    expect(out.looked).toEqual(DECK.slice(0, 2));
    expect(deckCodes(out.state)).toHaveLength(DECK.length);
    expect(deckCodes(out.state)[2]).toBe(DECK[2]);
  });
  it("Scarlet Spider and Spider-Byte in play: X is 4", () => {
    const state = placed(placed(hero(), SCARLET).state, BYTE).state;
    expect(playWeb(state).looked).toEqual(DECK.slice(0, 4));
  });
  it("only Web-Warrior cards you control count: a non-Web-Warrior ally and another player's Web-Warrior do not", () => {
    const withSinclair = placed(hero({ second: true }), SINCLAIR).state;
    expect(playWeb(withSinclair).looked).toEqual(DECK.slice(0, 2));
    const theirs = placed(hero({ second: true }), SCARLET);
    const moved: GameState = {
      ...theirs.state,
      players: theirs.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== theirs.id) }
          : { ...p, playArea: [...p.playArea, theirs.id] },
      ),
    };
    expect(playWeb(patchInstance(moved, theirs.id, { controllerId: P2 })).looked).toEqual(DECK.slice(0, 2));
  });
  it("discarding one of the cards looked at puts it in the encounter discard pile; the other goes back on top", () => {
    const out = playWeb(hero(), DECK[0]);
    expect(discardCodes(out.state)).toEqual([DECK[0]]);
    expect(deckCodes(out.state)).toEqual(DECK.slice(1));
  });
  it("discarding none (X is 2) leaves both on top in some order and nothing in the discard pile", () => {
    const out = playWeb(hero());
    expect(discardCodes(out.state)).toEqual([]);
    expect(deckCodes(out.state).slice(0, 2).sort()).toEqual(DECK.slice(0, 2).sort());
    expect(deckCodes(out.state).slice(2)).toEqual(DECK.slice(2));
  });
  it("at most 1 card may be discarded: the prompt allows one", () => {
    const state = placed(placed(hero(), SCARLET).state, BYTE).state;
    const staged = onlyDeck(state, ...DECK);
    const given = moveToHand(staged, P1, WEB);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.ids[0])
      .slice(0, 3);
    let seen: { min: number; max: number } | undefined;
    driveEventsPicking(
      DEPS,
      given.state,
      (s) => {
        const open = s.pendingChoice!;
        if (open.prompt.kind === "chooseTriggers") return [open.options.find((o) => o.optionId.endsWith(ID))!.optionId];
        if (open.prompt.kind === "chooseCards") seen = { min: open.minSelections, max: open.maxSelections };
        return firstLegal(s);
      },
      play(P1, given.ids[0]!, pay),
    );
    expect(seen).toEqual({ min: 0, max: 1 });
  });
  it("the response is optional: declined, the deck is unchanged and nothing is discarded", () => {
    const out = playWeb(hero(), undefined, false);
    expect(deckCodes(out.state)).toEqual(DECK);
    expect(discardCodes(out.state)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Villain-phase groups. Rhino: ATK 2, SCH 1. Every deck below is exactly the cards listed: the first is the boost card of
// the first activation, the rest are dealt (Rhino's attachments attach to him and touch no player).
// ---------------------------------------------------------------------------------------------------------------------
const ASSAULT = "01187"; // Core treachery, 0 boost icons
const DEALT = "01100"; // Enhanced Ivory Horn: the card dealt to a player, it attaches to Rhino and touches nobody
/** The main scheme given enough threat for a removal of 2 to take the whole 2. */
const withThreat = (s: GameState, threat = 3): GameState => patchInstance(s, schemeOf(s), { threat });
const silkId = (s: GameState): InstanceId => identityOf(s);
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;

describe("52013.scarlet-spider-interrupt: when another Web-Warrior character would take damage, Scarlet Spider takes it instead", () => {
  const REF = "52013.scarlet-spider-interrupt";
  const stage = (boost = BLANK) => {
    const scarlet = placed(hero(), SCARLET);
    return { state: scarlet.state, scarlet: scarlet.id, deck: [boost, DEALT] };
  };

  it("costs 3 and enters play ready", () => {
    const out = played(hero(), SCARLET);
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(handSize(out.state)).toBe(out.handBefore - 1 - 3);
  });
  it("Silk (a Web-Warrior in hero form) would take Rhino's 2: Scarlet Spider takes exactly 2 and Silk none", () => {
    const { state, scarlet, deck } = stage();
    const r = villainPhase(state, { deck, accept: [REF] });
    expect(r.offered()).toBe(1);
    expect(damageOf(r.state, scarlet)).toBe(2);
    expect(damageOf(r.state, silkId(r.state))).toBe(0);
  });
  it("the whole amount moves: a 1-icon boost makes it 3", () => {
    const { state, scarlet, deck } = stage(ONE_ICON);
    const r = villainPhase(state, { deck, accept: [REF] });
    expect(damageOf(r.state, scarlet)).toBe(3);
    expect(damageOf(r.state, silkId(r.state))).toBe(0);
  });
  it("declined: Silk takes the 2 and Scarlet Spider none", () => {
    const { state, scarlet, deck } = stage();
    const r = villainPhase(state, { deck });
    expect(damageOf(r.state, silkId(r.state))).toBe(2);
    expect(damageOf(r.state, scarlet)).toBe(0);
  });
  it("it is still damage from the attack: Silk's DEF 3 stops 2, so there is no damage to move and no offer", () => {
    const { state, deck } = stage();
    const r = villainPhase(state, { deck, accept: [REF], defenders: [silkId(state)] });
    expect(r.offered()).toBe(0);
  });
  it("another Web-Warrior ally (Spider-Byte, 2 hit points) defending: Scarlet Spider takes the 2, Spider-Byte survives", () => {
    const { state, scarlet, deck } = stage();
    const byte = placed(state, BYTE);
    const declined = villainPhase(byte.state, { deck, defenders: [byte.id] });
    expect(inDiscard(declined.state, byte.id)).toBe(true);
    const r = villainPhase(byte.state, { deck, accept: [REF], defenders: [byte.id] });
    expect(damageOf(r.state, scarlet)).toBe(2);
    expect(damageOf(r.state, byte.id)).toBe(0);
    expect(inPlayArea(r.state, byte.id)).toBe(true);
  });
  it("consequential damage counts: Spider-Byte's 1 from attacking goes to Scarlet Spider", () => {
    const { state, scarlet } = stage();
    const byte = placed(state, BYTE);
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: byte.id,
      targetInstanceId: villainOf(byte.state),
    };
    const r = phase(byte.state, { deck: [BLANK], accept: [REF] }, [attack]);
    expect(r.offered()).toBe(1);
    expect(damageOf(r.state, scarlet)).toBe(1);
    expect(damageOf(r.state, byte.id)).toBe(0);
    expect(damageOf(r.state, villainOf(r.state))).toBe(1);
  });
  it("'another': damage to Scarlet Spider herself is not offered and she takes it", () => {
    const { state, scarlet, deck } = stage();
    const r = villainPhase(state, { deck, accept: [REF], defenders: [scarlet] });
    expect(r.offered()).toBe(0);
    expect(damageOf(r.state, scarlet)).toBe(2);
  });
  it("her own tough status card absorbs the redirected damage (it is damage she would take)", () => {
    const { state, scarlet, deck } = stage();
    const toughened = patchInstance(state, scarlet, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const r = villainPhase(toughened, { deck, accept: [REF] });
    expect(damageOf(r.state, scarlet)).toBe(0);
    expect(inst(r.state, scarlet).statuses.tough).toBe(0);
    expect(damageOf(r.state, silkId(r.state))).toBe(0);
  });
  it("a character without the trait is not covered: Silk defends (no damage, no offer), Spider-Man (P2, AVENGER) takes his 2 with no offer", () => {
    const both = placed(bothHeroes(), SCARLET);
    const r = villainPhase(both.state, {
      deck: [BLANK, ASSAULT, DEALT, "01098"],
      accept: [REF],
      defenders: [identityOf(both.state, P1)],
    });
    expect(r.offered()).toBe(0);
    expect(damageOf(r.state, identityOf(r.state, P2))).toBe(2);
    expect(damageOf(r.state, both.id)).toBe(0);
  });
});

describe("52015.not-today-interrupt: when your hero defends, +2 DEF for that attack; taking no damage removes 2 threat from a scheme", () => {
  const REF = "52015.not-today-interrupt";
  const threatRemoved = (events: readonly GameEvent[]) =>
    types(events, "threatRemoved").reduce((n, e) => n + e.amount, 0);

  it("costs 1: a boost of 2 icons (ATK 4) beats DEF 3 for 1 damage, but with +2 DEF (5) no damage is taken and 2 threat comes off", () => {
    const state = withThreat(hero());
    const deck = [CHARGE, DEALT];
    const declined = villainPhase(state, {
      deck,
      hand: [NOT_TODAY],
      accept: [REF],
      on: [],
      defenders: [silkId(state)],
    });
    expect(damageOf(declined.state, silkId(declined.state))).toBe(1);
    expect(threatRemoved(declined.events)).toBe(0);
    const used = villainPhase(state, { deck, hand: [NOT_TODAY], accept: [REF], defenders: [silkId(state)] });
    expect(used.offered()).toBe(1);
    expect(damageOf(used.state, silkId(used.state))).toBe(0);
    expect(threatRemoved(used.events)).toBe(2);
    expect(inDiscard(used.state, used.given.ids[0]!)).toBe(true);
    expect(handSize(used.state)).toBe(handSize(declined.state) - 2);
  });
  it("the 2 threat comes off the main scheme: it ends 2 lower than when the card is declined", () => {
    const state = withThreat(hero());
    const plan = { deck: [CHARGE, DEALT], hand: [NOT_TODAY], accept: [REF], defenders: [silkId(state)] };
    const declined = villainPhase(state, { ...plan, on: [] });
    const used = villainPhase(state, plan);
    expect(inst(declined.state, schemeOf(declined.state)).threat - inst(used.state, schemeOf(used.state)).threat).toBe(
      2,
    );
  });
  it("the bonus is for the attack it is played on: undefended Rhino deals 2, then Silk defends Sandman (ATK 3) with DEF 5 and takes none", () => {
    const state = engaged(withThreat(hero()), SANDMAN, "m-sandman");
    const used = villainPhase(state, {
      deck: [BLANK, DEALT, "01104"],
      hand: [NOT_TODAY],
      accept: [REF],
      defenders: [undefined, silkId(state)],
    });
    expect(used.offered()).toBe(1);
    expect(damageOf(used.state, silkId(used.state))).toBe(2);
    expect(threatRemoved(used.events)).toBe(2);
  });
  it("without a defense it is not offered (the hero must defend)", () => {
    const r = villainPhase(hero(), { deck: [BLANK, DEALT], hand: [NOT_TODAY], accept: [REF] });
    expect(r.offered()).toBe(0);
    expect(damageOf(r.state, silkId(r.state))).toBe(2);
  });
  it("Hero Interrupt: not playable in alter-ego form", () => {
    const given = moveToHand(aspectGame(), P1, NOT_TODAY);
    expect(() => run(given.state, play(P1, given.ids[0]!, playerOf(given.state, P1).hand.slice(0, 1)))).toThrow();
  });
});

describe("52016.stop-hitting-yourself-response: after you defend and take no damage, deal damage to that enemy equal to your DEF", () => {
  const REF = "52016.stop-hitting-yourself-response";
  const NT = "52015.not-today-interrupt";

  it("costs 2: Silk's DEF 3 stops Rhino's 2, and Rhino takes exactly 3 damage", () => {
    const state = hero();
    const r = villainPhase(state, {
      deck: [BLANK, DEALT],
      hand: [STOP],
      accept: [REF],
      defenders: [silkId(state)],
    });
    expect(r.offered()).toBe(1);
    expect(damageOf(r.state, villainOf(r.state))).toBe(3);
    expect(damageOf(r.state, silkId(r.state))).toBe(0);
    expect(inDiscard(r.state, r.given.ids[0]!)).toBe(true);
  });
  it("declined: Rhino takes no damage", () => {
    const state = hero();
    const r = villainPhase(state, {
      deck: [BLANK, DEALT],
      hand: [STOP],
      accept: [REF],
      on: [],
      defenders: [silkId(state)],
    });
    expect(r.offered()).toBe(1);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });
  it("it costs 2 resources: the hand shrinks by the card and two payments", () => {
    const state = hero();
    const plan = { deck: [BLANK, DEALT], hand: [STOP], defenders: [silkId(state)] };
    const declined = villainPhase(state, plan);
    const used = villainPhase(state, { ...plan, accept: [REF] });
    expect(handSize(declined.state) - handSize(used.state)).toBe(3);
  });
  it("damage taken: a 2-icon boost (ATK 4 against DEF 3) deals 1 to Silk, so it is not offered", () => {
    const state = hero();
    const r = villainPhase(state, {
      deck: [CHARGE, DEALT],
      hand: [STOP],
      accept: [REF],
      defenders: [silkId(state)],
    });
    expect(r.offered()).toBe(0);
    expect(damageOf(r.state, silkId(r.state))).toBe(1);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });
  it("no defense: not offered", () => {
    const r = villainPhase(hero(), { deck: [BLANK, DEALT], hand: [STOP], accept: [REF] });
    expect(r.offered()).toBe(0);
  });
  it("the damage is the DEF for that attack: with Not Today! (+2) it is 5 (ruling December 17, 2025, Ruling 2)", () => {
    const state = hero();
    const given = moveToHand(state, P1, NOT_TODAY, STOP);
    const r = villainPhase(given.state, {
      deck: [BLANK, DEALT],
      accept: [NT, REF],
      defenders: [silkId(state)],
      keep: given.ids,
    });
    expect(damageOf(r.state, villainOf(r.state))).toBe(5);
  });
  it("'that enemy': a minion's attack is answered on the minion (Sandman, 3 damage of 4 hit points), not Rhino", () => {
    const state = engaged(hero(), SANDMAN, "m-sandman");
    const r = villainPhase(state, {
      deck: [BLANK, DEALT, "01104"],
      hand: [STOP],
      accept: [REF],
      defenders: [undefined, silkId(state)],
    });
    expect(r.offered()).toBe(1);
    expect(damageOf(r.state, "m-sandman" as InstanceId)).toBe(3);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });
  it("Hero Response: not playable in alter-ego form", () => {
    const given = moveToHand(aspectGame(), P1, STOP);
    expect(() => run(given.state, play(P1, given.ids[0]!, playerOf(given.state, P1).hand.slice(0, 2)))).toThrow();
  });
});

describe("52018.energy-shield-interrupt: when attached character would take damage, spend X [energy] resources to prevent X of it", () => {
  const REF = "52018.energy-shield-interrupt";
  /** Silk (hero) wearing a Shield, with `n` Stun Guns (one [energy] each) in hand to pay with. */
  const stage = (n: number, host?: (s: GameState) => InstanceId) => {
    const base = hero();
    const worn = played(base, SHIELD, { cost: 0, attachTo: host ? host(base) : identityOf(base) });
    const guns = n > 0 ? moveToHand(worn.state, P1, ...Array.from({ length: n }, () => STUN_GUN)) : null;
    return { state: guns?.state ?? worn.state, shield: worn.id, guns: guns?.ids ?? [], worn };
  };
  const deck = (boost: string) => [boost, DEALT];

  it("costs 0, attaches to the character it is played on, and is ready", () => {
    const { shield, state, worn } = stage(0);
    expect(inst(state, shield).attachedTo).toBe(identityOf(state));
    expect(handSize(worn.state)).toBe(worn.handBefore - 1);
  });
  it("undefended, Rhino's 2: declined it all lands; X = 1 prevents 1 (1 damage); X = 2 prevents 2 (none)", () => {
    const { state, guns } = stage(2);
    const declined = villainPhase(state, { deck: deck(BLANK) });
    expect(damageOf(declined.state, silkId(declined.state))).toBe(2);
    const one = villainPhase(state, { deck: deck(BLANK), accept: [REF], pay: [guns[0]!], keep: guns });
    expect(one.offered()).toBe(1);
    expect(damageOf(one.state, silkId(one.state))).toBe(1);
    expect(inDiscard(one.state, guns[0]!)).toBe(true);
    expect(inDiscard(one.state, guns[1]!)).toBe(false);
    const two = villainPhase(state, { deck: deck(BLANK), accept: [REF], pay: guns, keep: guns });
    expect(damageOf(two.state, silkId(two.state))).toBe(0);
    expect(guns.every((g) => inDiscard(two.state, g))).toBe(true);
  });
  it("a 1-icon boost makes it 3: X = 2 leaves exactly 1", () => {
    const { state, guns } = stage(2);
    const r = villainPhase(state, { deck: deck(ONE_ICON), accept: [REF], pay: guns, keep: guns });
    expect(damageOf(r.state, silkId(r.state))).toBe(1);
  });
  it("one card printing two [energy] icons pays X = 2 (Energy, 52025)", () => {
    const base = stage(0).state;
    const energy = moveToHand(base, P1, "52025");
    const r = villainPhase(energy.state, { deck: deck(BLANK), accept: [REF], pay: energy.ids, keep: energy.ids });
    expect(damageOf(r.state, silkId(r.state))).toBe(0);
    expect(inDiscard(r.state, energy.ids[0]!)).toBe(true);
  });
  it("the resources must be [energy]: a card with no energy icon pays nothing and the damage lands", () => {
    const { state } = stage(0);
    const none = playerOf(state, P1).hand.find((id) => {
      const icons = iconsOfCard(state, id);
      return (icons.energy ?? 0) + (icons.wild ?? 0) === 0;
    })!;
    const r = villainPhase(state, { deck: deck(BLANK), accept: [REF], pay: [none], keep: [none] });
    expect(damageOf(r.state, silkId(r.state))).toBe(2);
    expect(inDiscard(r.state, none)).toBe(false);
  });
  it("it covers only the attached character: worn by Silk, damage to Scarlet Spider (defending) is not offered", () => {
    const base = placed(hero(), SCARLET);
    const worn = played(base.state, SHIELD, { cost: 0, attachTo: identityOf(base.state) });
    const r = villainPhase(worn.state, {
      deck: deck(BLANK),
      accept: [REF],
      defenders: [base.id],
    });
    expect(r.offered()).toBe(0);
    expect(damageOf(r.state, base.id)).toBe(2);
  });
  it("attached to an ally (Scarlet Spider), it covers that ally: X = 1 on her 2 damage", () => {
    const ally = placed(hero(), SCARLET);
    const worn = played(ally.state, SHIELD, { cost: 0, attachTo: ally.id });
    const guns = moveToHand(worn.state, P1, STUN_GUN);
    const r = villainPhase(guns.state, {
      deck: deck(BLANK),
      accept: [REF],
      defenders: [ally.id],
      pay: guns.ids,
      keep: guns.ids,
    });
    expect(damageOf(r.state, ally.id)).toBe(1);
  });
  it("Max 1 per character: a second Energy Shield cannot be attached to the same character, but can to another", () => {
    const ally = placed(hero(), SCARLET);
    const worn = played(ally.state, SHIELD, { cost: 0, attachTo: ally.id });
    const second = moveToHand(worn.state, P1, SHIELD);
    expect(() => run(second.state, play(P1, second.ids[0]!, [], { attachToInstanceId: ally.id }))).toThrow();
    const other = drive(
      run(second.state, play(P1, second.ids[0]!, [], { attachToInstanceId: identityOf(second.state) })),
    );
    expect(inst(other, second.ids[0]!).attachedTo).toBe(identityOf(other));
  });
});

describe("52019.ready-for-a-fight-interrupt: when an enemy would scheme, discard it, change to hero form; that enemy attacks you instead", () => {
  const REF = "52019.ready-for-a-fight-interrupt";
  /** Ready for a Fight played for real, paid with a [physical] card (its Requirement). */
  const wearing = (base: GameState) => {
    const given = moveToHand(base, P1, READY);
    return played(given.state, READY, { pay: iconsFor(given.state, P1, "physical", 1, given.ids) });
  };
  const deck = [BLANK, "01104", DEALT];

  it("costs 1 with Requirement ([physical]): a [physical] card pays, a card without the icon is refused; it attaches to your identity", () => {
    const given = moveToHand(aspectGame(), P1, READY);
    const id = given.ids[0]!;
    const physical = iconsFor(given.state, P1, "physical", 1, [id]);
    const other = playerOf(given.state, P1).hand.find((h) => {
      if (h === id) return false;
      const icons = (anyCard(inst(given.state, h).cardId as string) as WithIcons).resourceIcons ?? {};
      return (icons.physical ?? 0) + (icons.wild ?? 0) === 0;
    })!;
    expect(() => run(given.state, play(P1, id, [other]))).toThrow();
    const after = drive(run(given.state, play(P1, id, physical)));
    expect(inst(after, id).attachedTo).toBe(identityOf(after));
    expect(handSize(after)).toBe(handSize(given.state) - 2);
  });
  it("Max 1 per player: a second copy cannot be played while one is in play", () => {
    const worn = wearing(aspectGame());
    const second = moveToHand(worn.state, P1, READY, "52027");
    const physical = iconsFor(second.state, P1, "physical", 1, [second.ids[0]!]);
    expect(() => run(second.state, play(P1, second.ids[0]!, physical))).toThrow();
  });
  it("accepted on Rhino's scheme: you change to hero form, Rhino attacks Silk for 2 instead, no threat is placed by it, Ready is discarded", () => {
    const worn = wearing(aspectGame());
    const declined = villainPhase(worn.state, { deck });
    const used = villainPhase(worn.state, { deck, accept: [REF] });
    expect(used.offered()).toBe(1);
    expect(playerOf(used.state, P1).identity.form).toBe("hero");
    expect(damageOf(used.state, silkId(used.state))).toBe(2);
    expect(inDiscard(used.state, worn.id)).toBe(true);
    expect(types(used.events, "schemeResolved")).toHaveLength(types(declined.events, "schemeResolved").length - 1);
    expect(types(used.events, "attackResolved")).toHaveLength(1);
    expect(inst(declined.state, schemeOf(declined.state)).threat - inst(used.state, schemeOf(used.state)).threat).toBe(
      1,
    );
  });
  it("declined: Silk stays in alter-ego form, Rhino schemes (1 threat), Ready for a Fight stays attached", () => {
    const worn = wearing(aspectGame());
    const r = villainPhase(worn.state, { deck, accept: [REF], on: [] });
    expect(r.offered()).toBe(1);
    expect(playerOf(r.state, P1).identity.form).toBe("alterEgo");
    expect(types(r.events, "attackResolved")).toHaveLength(0);
    expect(inst(r.state, worn.id).attachedTo).toBe(identityOf(r.state));
  });
  it("the attack is made against you in hero form: Silk defending with DEF 3 takes no damage from the 2", () => {
    const worn = wearing(aspectGame());
    const r = villainPhase(worn.state, { deck, accept: [REF], defenders: [identityOf(worn.state)] });
    expect(playerOf(r.state, P1).identity.form).toBe("hero");
    expect(damageOf(r.state, silkId(r.state))).toBe(0);
  });
  it("it triggers on any enemy's scheme: Sandman (SCH 2, ATK 3) schemes, the player changes form and Sandman attacks for 3", () => {
    const worn = wearing(aspectGame());
    const state = engaged(worn.state, SANDMAN, "m-sandman");
    // Rhino's scheme (first offer) is declined; the minion's (second offer) is accepted.
    const r = villainPhase(state, { deck: [BLANK, DEALT, "01104"], accept: [REF], on: [1] });
    expect(r.offered()).toBe(2);
    expect(playerOf(r.state, P1).identity.form).toBe("hero");
    expect(damageOf(r.state, silkId(r.state))).toBe(3);
    expect(types(r.events, "attackResolved").map((a) => a.enemyInstanceId)).toEqual(["m-sandman"]);
    expect(inDiscard(r.state, worn.id)).toBe(true);
  });
  it("in hero form the enemy attacks rather than schemes, so it is not offered", () => {
    const worn = wearing(hero());
    const r = villainPhase(worn.state, { deck, accept: [REF] });
    expect(r.offered()).toBe(0);
    expect(inst(r.state, worn.id).attachedTo).toBe(identityOf(r.state));
  });
});
