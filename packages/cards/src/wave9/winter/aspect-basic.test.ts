import {
  PLAYABLE_CARDS,
  WINTER_CARDS,
  cardId,
  trait,
  type AllyCard,
  type AnyCard,
  type EventCard,
  type UpgradeCard,
} from "@mc/content";
import {
  applyCommand,
  hasKeyword,
  maxHitPoints,
  restrictedStanding,
  traitsOf as traitsInPlay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
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
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { NOVA_EVENTS } from "../../wave5/nova/events.js";
import { BLANK, ONE_ICON, piles } from "../testing.js";
import { AOS_ASPECT_BASIC } from "../aos/aspect-basic.js";
import { WINTER_ASPECT_BASIC as REGISTRY, WINTER_ASPECT_BASIC_SKIPPED as SKIPPED } from "./aspect-basic.js";
import { ASPECT_DEPS as DEPS, aspectGame, aspectHero, engaged, placed } from "./aspect-basic.testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `winter/aspect-basic` (54012 to 54026, 54032, 54033), docs/phase7-wave9.md sections 3.43, 3.51 and 3.52. The
 * Winter Soldier Aggression precon (it holds every card but White Widow and S.H.I.E.L.D. Deputy, which `swap` brings in,
 * three Sidearms included) against Core's Rhino. Winter
 * Soldier is ATK 2, THW 2, DEF 2 with 11 hit points in hero form, Bucky Barnes REC 3 in alter-ego form. Only Core's
 * cards and this module are scripted here: the Sidearm, Winter Soldier's own cards and the rest of the pack are inert.
 */
const CAP = "54012";
const DEATHLOK = "54013";
const FIREPOWER = "54014";
const ONE_BY_ONE = "54015";
const SPOILING = "54016";
const STANCE = "54017";
const BAMBINO = "54018";
const WALL = "54019";
const SIDEARM = "54020";
const FURY = "54021";
const SUPER = "54022";
const WINTER_WIDOW = "54023";
const ENERGY = "54024";
const GENIUS = "54025";
const STRENGTH = "54026";
const WHITE_WIDOW = "54032";
const DEPUTY = "54033";
const PREP_READY = "54008"; // PREPARATION upgrade, cost 2
const SPIDEY_ALLY = "01059"; // Core ally without the S.H.I.E.L.D. trait
const WIDOW = "54003"; // S.H.I.E.L.D. ally, cost 3, ATK 2, THW 2, 3 hit points
const RIFLE = "54011"; // Weapon upgrade, cost 3
const MASK = "54010"; // a non-Weapon upgrade
const MERCENARY = "01101"; // minion: Guard, ATK 1, 3 hit points
const SANDMAN = "01102"; // minion: ATK 3, 4 hit points, Toughness
const SHOCKER = "01103"; // minion: ATK 2, 3 hit points, When Revealed: 1 damage to each hero
const WHIPLASH = "01172"; // minion: ATK 3, 4 hit points, Retaliate 1
const HAYMAKER = "01087"; // basic attack event, cost 2: 3 damage to an enemy

type WithText = AnyCard & { readonly text: { readonly current: string } };
type WithIcons = AnyCard & { readonly resourceIcons: Readonly<Record<string, number>> };
const card = <T extends AnyCard>(code: string): T => WINTER_CARDS.find((c) => c.id === cardId(code)) as unknown as T;
const traitsOf = (code: string): string[] =>
  ((card(code) as unknown as { traits: unknown[] }).traits ?? []).map((t) => String(t));

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hand = (s: GameState, p: PlayerId = P1): readonly InstanceId[] => playerOf(s, p).hand;
const deck = (s: GameState, p: PlayerId = P1): readonly InstanceId[] => playerOf(s, p).deck;
const discard = (s: GameState, p: PlayerId = P1): readonly InstanceId[] => playerOf(s, p).discard;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const copies = (ids: readonly InstanceId[], s: GameState, code: string): InstanceId[] =>
  ids.filter((i) => codeOf(s, i) === code);
const inPlayArea = (s: GameState, id: InstanceId, p: PlayerId = P1): boolean => playerOf(s, p).playArea.includes(id);
const gone = (s: GameState, id: string): boolean => !playerOf(s, P1).playArea.includes(id as InstanceId);
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const refusal = (s: GameState, command: Command): string | undefined => {
  const result = applyCommand(s, command, DEPS);
  return result.ok ? undefined : result.error.message;
};

/**
 * Answers every prompt: a trigger whose id ends with an entry of `take` is taken (the others declined); a target / card
 * / cost-card prompt takes the next entry of `targets` it offers (each used once), else the first option.
 */
interface Plan {
  readonly take?: readonly string[];
  readonly targets?: readonly InstanceId[];
  /** The label prefix of the option to take at a "choose one" prompt (the first option when absent). */
  readonly option?: string;
  readonly seen?: string[][];
}
const planner = (plan: Plan = {}): Picker => {
  const queue = [...(plan.targets ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    plan.seen?.push(offered);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return ["decline"];
      case "chooseOption": {
        const hit = plan.option ? choice.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId as string] : firstLegal(s);
      }
      case "chooseTarget":
      case "chooseCards":
      case "chooseCostCards": {
        const picks: string[] = [];
        for (const t of [...queue]) {
          if (offered.includes(t) && picks.length < choice.maxSelections) {
            picks.push(t);
            queue.splice(queue.indexOf(t), 1);
          }
        }
        return picks.length > 0 ? picks : firstLegal(s);
      }
      default:
        return firstLegal(s);
    }
  };
};
const drive = (s: GameState, plan: Plan | undefined, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, planner(plan), ...commands);

const basicAttack = (s: GameState, target: InstanceId, attacker: InstanceId = identityOf(s)): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** A hand card `code` (drawn from the deck when not in the hand), and the state with it there. */
function inHand(s: GameState, code: string, p: PlayerId = P1) {
  const given = moveToHand(s, p, code);
  return { state: given.state, id: given.ids[0]! };
}
/** `code` played from the hand, paid with the first `cost` other cards (or `pay`). */
function played(
  s: GameState,
  code: string,
  plan: Plan = {},
  opts: { readonly cost?: number; readonly pay?: readonly InstanceId[]; readonly attachTo?: InstanceId } = {},
) {
  const given = inHand(s, code);
  const cost = opts.cost ?? (card<AnyCard & { cost: number }>(code).cost as number);
  const pay =
    opts.pay ??
    hand(given.state)
      .filter((i) => i !== given.id)
      .slice(0, cost);
  const out = drive(
    given.state,
    plan,
    play(P1, given.id, pay, opts.attachTo ? { attachToInstanceId: opts.attachTo } : {}),
  );
  return { ...out, id: given.id, before: hand(given.state).length };
}
/** An Attack event of the pack, by its printed data. */
const isAttackEvent = (code: string): boolean => {
  const c = WINTER_CARDS.find((x) => x.id === cardId(code)) as unknown as { type: string; traits?: unknown[] };
  return c?.type === "event" && (c.traits ?? []).map(String).includes("ATTACK");
};
const hero = (opts: Parameters<typeof aspectGame>[0] = {}): GameState => aspectHero(opts);

describe("registry", () => {
  it("every registered script validates", () => {
    for (const [id, def] of Object.entries(REGISTRY)) expect(validateDefinition(def), id).toEqual([]);
  });
  it("registers exactly these fifteen refs; every printed ref of the cards of the module is registered or skipped, none twice", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([
      "54012.captain-america-response",
      "54013.deathlok-response",
      "54014.firepower-action",
      "54015.one-by-one-action",
      "54016.spoiling-for-a-fight-action",
      "54017.aggressive-stance-response",
      "54018.bambino-constant",
      "54018.bambino-interrupt",
      "54019.man-on-the-wall-action",
      "54020.shield-sidearm-interrupt",
      "54021.nick-fury-sr-forced-response",
      "54022.super-soldiers-action",
      "54023.winter-widow-soldier-spy-action",
      "54032.white-widow-response",
      "54033.shield-deputy-constant",
    ]);
    const codes = [...Array.from({ length: 15 }, (_, i) => String(54012 + i)), "54032", "54033"];
    const printed = codes.flatMap((code) => abilityRefIds(card(code)));
    expect(printed).toHaveLength(Object.keys(REGISTRY).length + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
  });
  it("skips nothing: every ref is scripted", () => {
    expect(SKIPPED).toEqual({});
  });
  it("timing words, forms, labels and costs", () => {
    expect(REGISTRY["54012.captain-america-response"]).toMatchObject({
      trigger: { kind: "response", forced: false },
    });
    expect(REGISTRY["54012.captain-america-response"]!.cost).toBeUndefined();
    expect(REGISTRY["54013.deathlok-response"]).toMatchObject({ trigger: { kind: "response", forced: false } });
    expect(REGISTRY["54014.firepower-action"]).toMatchObject({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
    });
    expect(REGISTRY["54015.one-by-one-action"]).toMatchObject({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
    });
    expect(REGISTRY["54016.spoiling-for-a-fight-action"]).toMatchObject({ trigger: { kind: "action", form: "hero" } });
    expect(REGISTRY["54016.spoiling-for-a-fight-action"]!.cost).toBeUndefined();
    expect(REGISTRY["54017.aggressive-stance-response"]).toMatchObject({
      trigger: { kind: "response", forced: false, form: "hero" },
      cost: { discardSelf: true },
    });
    expect(REGISTRY["54018.bambino-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY["54018.bambino-interrupt"]).toMatchObject({
      trigger: { kind: "interrupt", forced: false },
      cost: { spendCounters: { counterType: "ammo", amount: 1 } },
    });
    expect(REGISTRY["54018.bambino-interrupt"]!.trigger).not.toHaveProperty("form");
    expect(REGISTRY["54019.man-on-the-wall-action"]).toMatchObject({
      trigger: { kind: "action", form: "hero" },
      cost: { exhaustSelf: true },
    });
  });
  it("Firepower's cost exhausts 1 to 3 Weapon upgrades you control, bound as n", () => {
    expect(REGISTRY["54014.firepower-action"]!.cost).toMatchObject({
      exhaustCards: { min: 1, max: 3, bind: "n" },
    });
  });
  it("One by One aliases Nova's 28014 script, and the source's name, cost and text are the same", () => {
    expect(REGISTRY["54015.one-by-one-action"]).toBe(NOVA_EVENTS["28014.one-by-one-action"]);
    const source = PLAYABLE_CARDS.find((c) => c.id === cardId("28014")) as unknown as WithText & EventCard;
    expect(source).toBeDefined();
    expect(card<WithText>(ONE_BY_ONE).text.current).toBe(source.text.current);
    expect(card<EventCard>(ONE_BY_ONE).name).toBe(source.name);
    expect(card<EventCard>(ONE_BY_ONE).cost).toBe(source.cost);
    expect(card<WithIcons>(ONE_BY_ONE).resourceIcons).toEqual((source as unknown as WithIcons).resourceIcons);
    // 28014 is registered by wave 5 under its own id; this id is a different key, so nothing is defined twice.
    expect(DEPS.abilities["28014.one-by-one-action"]).toBe(NOVA_EVENTS["28014.one-by-one-action"]);
  });
  it("timing words, forms, labels and costs of the second half", () => {
    expect(REGISTRY["54020.shield-sidearm-interrupt"]).toMatchObject({
      trigger: { kind: "interrupt", forced: false },
      cost: { exhaustSelf: true, spendCounters: { counterType: "ammo", amount: 1 } },
    });
    expect(REGISTRY["54020.shield-sidearm-interrupt"]!.trigger).not.toHaveProperty("form");
    expect(REGISTRY["54021.nick-fury-sr-forced-response"]).toMatchObject({
      trigger: { kind: "response", forced: true },
    });
    for (const id of ["54022.super-soldiers-action", "54023.winter-widow-soldier-spy-action"]) {
      expect(REGISTRY[id], id).toMatchObject({ trigger: { kind: "action", form: "hero" }, label: ["attack"] });
      expect(REGISTRY[id]!.cost, id).toBeUndefined();
    }
    expect(REGISTRY["54032.white-widow-response"]).toMatchObject({ trigger: { kind: "response", forced: false } });
    expect(REGISTRY["54033.shield-deputy-constant"]!.trigger).toMatchObject({ kind: "constant" });
  });
  it("Nick Fury, Sr. aliases the box's 50054 script, and the source's name, cost, stats, traits and text are the same", () => {
    expect(REGISTRY["54021.nick-fury-sr-forced-response"]).toBe(AOS_ASPECT_BASIC["50054.nick-fury-sr-forced-response"]);
    const source = PLAYABLE_CARDS.find((c) => c.id === cardId("50054")) as unknown as AllyCard & WithText & WithIcons;
    expect(source).toBeDefined();
    const mine = card<AllyCard & WithText & WithIcons>(FURY);
    for (const key of ["name", "cost", "atk", "thw", "hp", "aspect", "unique", "deckLimit"] as const)
      expect(mine[key], key).toEqual(source[key]);
    expect(mine.text).toEqual(source.text);
    expect(mine.traits).toEqual(source.traits);
    expect(mine.keywords).toEqual(source.keywords);
    expect(mine.resourceIcons).toEqual(source.resourceIcons);
    expect(mine.consequentialDamage).toEqual(source.consequentialDamage);
  });
});

describe("printed data", () => {
  it("Captain America: unique Aggression S.H.I.E.L.D. Soldier ally, cost 4, ATK 2, THW 2, HP 3, consequential 1/1, Toughness, [mental]", () => {
    const c = card<AllyCard>(CAP);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique]).toEqual([4, 2, 2, 3, "aggression", true]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits).toEqual([trait("S.H.I.E.L.D."), trait("SOLDIER")]);
    expect(c.keywords).toEqual([{ name: "toughness" }]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
  });
  it("Deathlok: unique Aggression Cyborg S.H.I.E.L.D. ally, cost 3, ATK 1, THW 2, HP 3, consequential 1/2, [physical]", () => {
    const c = card<AllyCard>(DEATHLOK);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique]).toEqual([3, 1, 2, 3, "aggression", true]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 2 });
    expect(c.traits).toEqual([trait("CYBORG"), trait("S.H.I.E.L.D.")]);
    expect(c.keywords).toEqual([]);
    expect(c.resourceIcons).toEqual({ physical: 1 });
  });
  it("Firepower: Aggression ATTACK event, cost 1, [physical], up to 3 copies", () => {
    const c = card<EventCard>(FIREPOWER);
    expect([c.cost, c.aspect, c.deckLimit, c.unique]).toEqual([1, "aggression", 3, false]);
    expect(traitsOf(FIREPOWER)).toEqual(["ATTACK"]);
    expect(card<WithIcons>(FIREPOWER).resourceIcons).toEqual({ physical: 1 });
  });
  it("One by One: Aggression ATTACK event, cost 1, [energy], up to 3 copies", () => {
    const c = card<EventCard>(ONE_BY_ONE);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([1, "aggression", 3]);
    expect(traitsOf(ONE_BY_ONE)).toEqual(["ATTACK"]);
    expect(card<WithIcons>(ONE_BY_ONE).resourceIcons).toEqual({ energy: 1 });
  });
  it("Spoiling for a Fight: Aggression event with no trait, cost 0, [energy], up to 3 copies", () => {
    const c = card<EventCard>(SPOILING);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([0, "aggression", 3]);
    expect(traitsOf(SPOILING)).toEqual([]);
    expect(card<WithIcons>(SPOILING).resourceIcons).toEqual({ energy: 1 });
  });
  it("Aggressive Stance: Aggression PREPARATION upgrade, cost 1, [mental], max 1 per player, up to 3 copies", () => {
    const c = card<UpgradeCard>(STANCE);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([1, "aggression", 3]);
    expect(traitsOf(STANCE)).toEqual(["PREPARATION"]);
    expect(card<WithIcons>(STANCE).resourceIcons).toEqual({ mental: 1 });
    expect((c as unknown as { playRestrictions: unknown }).playRestrictions).toEqual({ maxPerPlayer: 1 });
  });
  it("Bambino: unique Aggression TECH WEAPON upgrade, cost 3, [energy], attaches to a S.H.I.E.L.D. character, Uses (3 ammo)", () => {
    const c = card<UpgradeCard>(BAMBINO);
    expect([c.cost, c.aspect, c.unique, c.deckLimit]).toEqual([3, "aggression", true, 1]);
    expect(traitsOf(BAMBINO)).toEqual(["TECH", "WEAPON"]);
    expect(card<WithIcons>(BAMBINO).resourceIcons).toEqual({ energy: 1 });
    expect(c.keywords).toEqual([{ name: "uses", count: 3, counterType: "ammo" }]);
    expect((c as unknown as { attachesTo: unknown }).attachesTo).toEqual({
      kind: "qualified",
      category: "character",
      trait: trait("S.H.I.E.L.D."),
    });
  });
  it("Man on the Wall: unique Aggression TITLE upgrade, cost 1, [physical], only for a Soldier identity", () => {
    const c = card<UpgradeCard>(WALL);
    expect([c.cost, c.aspect, c.unique]).toEqual([1, "aggression", true]);
    expect(traitsOf(WALL)).toEqual(["TITLE"]);
    expect(card<WithIcons>(WALL).resourceIcons).toEqual({ physical: 1 });
    expect((c as unknown as { playRestrictions: unknown }).playRestrictions).toEqual({
      requiresIdentityTrait: trait("SOLDIER"),
    });
  });
});

describe("54012.captain-america-response: after he enters play, ready a S.H.I.E.L.D. character", () => {
  const ID = "54012.captain-america-response";
  it("costs 4: he enters play ready with Toughness (one tough status) and the hand drops by 5", () => {
    const out = played(hero(), CAP);
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(hasKeyword(out.state, out.id, "toughness", DEPS)).toBe(true);
    expect(inst(out.state, out.id).statuses.tough).toBe(1);
    expect(hand(out.state)).toHaveLength(out.before - 1 - 4);
  });
  it("taken, it readies your exhausted hero", () => {
    const tired = patchInstance(hero(), identityOf(hero()), { exhausted: true });
    const out = played(tired, CAP, { take: [ID], targets: [identityOf(tired)] });
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
  });
  it("taken, it readies an exhausted S.H.I.E.L.D. ally instead and leaves the hero exhausted", () => {
    const widow = placed(hero(), WIDOW);
    const tired = patchInstance(patchInstance(widow.state, widow.id, { exhausted: true }), identityOf(widow.state), {
      exhausted: true,
    });
    const out = played(tired, CAP, { take: [ID], targets: [widow.id] });
    expect(inst(out.state, widow.id).exhausted).toBe(false);
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(true);
  });
  it("he is a S.H.I.E.L.D. character himself: he is among the targets of his own response", () => {
    const given = inHand(hero(), CAP);
    const seen: string[][] = [];
    drive(
      given.state,
      { take: [ID], seen },
      play(
        P1,
        given.id,
        hand(given.state)
          .filter((i) => i !== given.id)
          .slice(0, 4),
      ),
    );
    expect(seen.some((o) => o.includes(given.id) && o.includes(identityOf(given.state)))).toBe(true);
  });
  it("only a S.H.I.E.L.D. character is a target: not the villain, not a Core minion, not a hero without the trait", () => {
    const withMinion = engaged(hero({ second: true }), SHOCKER, "m-shocker");
    const widow = placed(withMinion, WIDOW);
    const seen: string[][] = [];
    played(widow.state, CAP, { take: [ID], seen });
    const targets = seen.find((o) => o.includes(widow.id))!;
    expect(targets).toContain(identityOf(widow.state));
    expect(targets).toContain(widow.id);
    expect(targets).not.toContain("m-shocker");
    expect(targets).not.toContain(villainOf(widow.state));
    expect(targets).not.toContain(identityOf(widow.state, P2));
  });
  it("Bucky Barnes in alter-ego form is a S.H.I.E.L.D. character too: the response readies him", () => {
    const base = aspectGame();
    const tired = patchInstance(base, identityOf(base), { exhausted: true });
    const out = played(tired, CAP, { take: [ID], targets: [identityOf(base)] });
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
  });
  it("declined, nothing is readied", () => {
    const tired = patchInstance(hero(), identityOf(hero()), { exhausted: true });
    const out = played(tired, CAP);
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(true);
  });
  it("is a response to entering play, not to a different ally: Black Widow entering does not offer it", () => {
    const given = inHand(placed(hero(), CAP).state, WIDOW);
    const seen: string[][] = [];
    drive(
      given.state,
      { take: [ID], seen },
      play(
        P1,
        given.id,
        hand(given.state)
          .filter((i) => i !== given.id)
          .slice(0, 3),
      ),
    );
    expect(seen.flat().some((o) => o.endsWith(ID))).toBe(false);
  });
});

describe("54013.deathlok-response: after he enters play, search your deck and discard pile for S.H.I.E.L.D. Sidearm and attach it to him", () => {
  const ID = "54013.deathlok-response";
  /** Every Sidearm instance of P1 (the precon holds three). */
  const sidearms = (s: GameState): InstanceId[] =>
    [...deck(s), ...discard(s), ...hand(s)].filter((i) => codeOf(s, i) === SIDEARM);
  /** Moves `ids` from wherever they are to the player's discard pile / hand. */
  const moveTo = (s: GameState, ids: readonly InstanceId[], to: "discard" | "hand"): GameState => ({
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            deck: p.deck.filter((i) => !ids.includes(i)),
            discard: to === "discard" ? [...p.discard.filter((i) => !ids.includes(i)), ...ids] : p.discard,
            hand: to === "hand" ? [...p.hand.filter((i) => !ids.includes(i)), ...ids] : p.hand,
          }
        : p,
    ),
  });

  it("costs 3: he enters play ready; with the response declined nothing is attached", () => {
    const out = played(hero(), DEATHLOK);
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(hand(out.state)).toHaveLength(out.before - 1 - 3);
    expect(inst(out.state, out.id).attachments).toEqual([]);
    expect(copies(deck(out.state), out.state, SIDEARM)).toHaveLength(3);
  });
  it("taken, one Sidearm of the deck is attached to him, faceup and ready, holding its 3 ammo counters", () => {
    const start = hero();
    expect(sidearms(start)).toHaveLength(3);
    const out = played(start, DEATHLOK, { take: [ID] });
    const attached = inst(out.state, out.id).attachments;
    expect(attached).toHaveLength(1);
    const side = inst(out.state, attached[0]!);
    expect(side.cardId).toBe(cardId(SIDEARM));
    expect(side).toMatchObject({ attachedTo: out.id, faceup: true, exhausted: false, counters: { ammo: 3 } });
    expect(copies(deck(out.state), out.state, SIDEARM)).toHaveLength(2);
    expect(deck(out.state)).toHaveLength(deck(moveToHand(start, P1, DEATHLOK).state).length - 1);
  });
  it("the deck is shuffled afterwards", () => {
    const out = played(hero(), DEATHLOK, { take: [ID] });
    const shuffles = ofType(out.events, "deckShuffled");
    expect(shuffles.length).toBeGreaterThanOrEqual(1);
  });
  it("the discard pile is searched too: with every copy there, a discarded Sidearm is attached", () => {
    const start = hero();
    const ids = sidearms(start);
    const staged = moveTo(start, ids, "discard");
    const out = played(staged, DEATHLOK, { take: [ID], targets: [ids[1]!] });
    expect(inst(out.state, out.id).attachments).toEqual([ids[1]]);
    expect(discard(out.state)).not.toContain(ids[1]);
    expect(copies(discard(out.state), out.state, SIDEARM)).toHaveLength(2);
  });
  it("copies in the deck and the discard pile are all offered, and the player picks one", () => {
    const start = hero();
    const ids = sidearms(start);
    const staged = moveTo(start, [ids[0]!], "discard");
    const seen: string[][] = [];
    const out = played(staged, DEATHLOK, { take: [ID], targets: [ids[0]!], seen });
    expect(seen.some((o) => ids.every((i) => o.includes(i)))).toBe(true);
    expect(inst(out.state, out.id).attachments).toEqual([ids[0]]);
  });
  it("a Sidearm in the hand is not searched for: with the others in the deck, one of those is attached", () => {
    const start = hero();
    const ids = sidearms(start);
    const staged = moveTo(start, [ids[0]!], "hand");
    const out = played(
      staged,
      DEATHLOK,
      { take: [ID] },
      {
        pay: hand(staged)
          .filter((i) => codeOf(staged, i) !== SIDEARM)
          .slice(0, 3),
      },
    );
    const attached = inst(out.state, out.id).attachments;
    expect(attached).toHaveLength(1);
    expect(attached[0]).not.toBe(ids[0]);
    expect(hand(out.state)).toContain(ids[0]);
  });
  it("with no Sidearm in the deck or discard pile the response finds nothing (the deck is still shuffled)", () => {
    const start = hero();
    const ids = sidearms(start);
    const staged = moveTo(start, ids, "hand");
    const out = played(
      staged,
      DEATHLOK,
      { take: [ID] },
      {
        pay: hand(staged)
          .filter((i) => !ids.includes(i))
          .slice(0, 3),
      },
    );
    expect(inst(out.state, out.id).attachments).toEqual([]);
    expect(hand(out.state).filter((i) => ids.includes(i))).toHaveLength(3);
  });
  it("works from alter-ego form too (a Response, not a Hero Response)", () => {
    const out = played(aspectGame(), DEATHLOK, { take: [ID] });
    expect(inst(out.state, out.id).attachments).toHaveLength(1);
  });
});

describe("54014.firepower-action: Hero Action (attack), exhaust up to 3 Weapon upgrades; for each, an enemy takes 3 damage", () => {
  const withWeapons = (codes: readonly string[], base: GameState = hero()) => {
    let s = base;
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const put = placed(s, code, { attach: true });
      s = put.state;
      ids.push(put.id);
    }
    return { state: s, ids };
  };
  const fire = (s: GameState, weaponIds: readonly InstanceId[], plan: Plan = {}) => {
    const given = inHand(s, FIREPOWER);
    const pay = hand(given.state)
      .filter((i) => i !== given.id)
      .slice(0, 1);
    return {
      ...drive(given.state, plan, play(P1, given.id, pay, { costChoices: { exhausted: weaponIds } })),
      id: given.id,
      before: hand(given.state).length,
    };
  };

  it("one Weapon exhausted: one enemy takes 3 damage (a Shocker, 3 hit points, is defeated); the event costs 1 and is discarded", () => {
    const base = engaged(hero(), SHOCKER, "m-shocker");
    const { state, ids } = withWeapons([SIDEARM], base);
    const out = fire(state, ids, { targets: ["m-shocker" as InstanceId] });
    expect(inst(out.state, ids[0]!).exhausted).toBe(true);
    expect(gone(out.state, "m-shocker")).toBe(true);
    expect(discard(out.state)).toContain(out.id);
    expect(hand(out.state)).toHaveLength(out.before - 2);
  });
  it("three Weapons exhausted: three separate 3-damage hits, each at an enemy of its own choice (the villain takes 6 of them)", () => {
    const base = engaged(hero(), SHOCKER, "m-shocker");
    const { state, ids } = withWeapons([SIDEARM, RIFLE, BAMBINO], base);
    const out = fire(state, ids, { targets: ["m-shocker" as InstanceId, villainOf(base), villainOf(base)] });
    for (const id of ids) expect(inst(out.state, id).exhausted, id).toBe(true);
    expect(gone(out.state, "m-shocker")).toBe(true);
    expect(damageOn(out.state, villainOf(out.state))).toBe(6);
  });
  it("a defeated enemy is not offered to the next hit", () => {
    const base = engaged(hero(), SHOCKER, "m-shocker");
    const { state, ids } = withWeapons([SIDEARM, RIFLE], base);
    const seen: string[][] = [];
    fire(state, ids, { targets: ["m-shocker" as InstanceId], seen });
    const enemyPrompts = seen.filter((o) => o.includes(villainOf(base)));
    expect(enemyPrompts).toHaveLength(2);
    expect(enemyPrompts[0]).toContain("m-shocker");
    expect(enemyPrompts[1]).not.toContain("m-shocker");
  });
  it("only as many hits as Weapons exhausted: two exhausted, the third left ready and unused", () => {
    const { state, ids } = withWeapons([SIDEARM, RIFLE, BAMBINO]);
    const out = fire(state, [ids[0]!, ids[1]!]);
    expect(damageOn(out.state, villainOf(out.state))).toBe(6);
    expect(inst(out.state, ids[2]!).exhausted).toBe(false);
  });
  it('cannot be played with no Weapon upgrade (an "up to" cost cannot be 0, RRG 1.8 Cost, p. 14)', () => {
    const given = inHand(hero(), FIREPOWER);
    expect(
      refusal(
        given.state,
        play(
          P1,
          given.id,
          hand(given.state)
            .filter((i) => i !== given.id)
            .slice(0, 1),
        ),
      ),
    ).toBeDefined();
  });
  it("at most 3 Weapons: naming a fourth is refused", () => {
    const { state, ids } = withWeapons([SIDEARM, SIDEARM, SIDEARM, RIFLE]);
    const given = inHand(state, FIREPOWER);
    const pay = hand(given.state)
      .filter((i) => i !== given.id)
      .slice(0, 1);
    expect(refusal(given.state, play(P1, given.id, pay, { costChoices: { exhausted: ids } }))).toBeDefined();
    expect(
      refusal(given.state, play(P1, given.id, pay, { costChoices: { exhausted: ids.slice(0, 3) } })),
    ).toBeUndefined();
  });
  it("a non-Weapon upgrade (Winter Mask) is no pick", () => {
    const { state } = withWeapons([MASK]);
    const given = inHand(state, FIREPOWER);
    expect(
      refusal(
        given.state,
        play(
          P1,
          given.id,
          hand(given.state)
            .filter((i) => i !== given.id)
            .slice(0, 1),
        ),
      ),
    ).toBeDefined();
  });
  it("an exhausted Weapon cannot be exhausted again: with all of them exhausted it cannot be played", () => {
    const { state, ids } = withWeapons([SIDEARM]);
    const tired = patchInstance(state, ids[0]!, { exhausted: true });
    const given = inHand(tired, FIREPOWER);
    expect(
      refusal(
        given.state,
        play(
          P1,
          given.id,
          hand(given.state)
            .filter((i) => i !== given.id)
            .slice(0, 1),
        ),
      ),
    ).toBeDefined();
  });
  it("a Weapon on an ally you control counts", () => {
    const widow = placed(hero(), WIDOW);
    const put = placed(widow.state, SIDEARM, { attach: widow.id });
    const out = fire(put.state, [put.id]);
    expect(inst(out.state, put.id).exhausted).toBe(true);
    expect(damageOn(out.state, villainOf(out.state))).toBe(3);
  });
  it("a Weapon another player controls is no pick", () => {
    const base = hero({ second: true });
    const theirs = placed(base, SIDEARM, { attach: identityOf(base, P2), player: P1 });
    const swapped = patchInstance(theirs.state, theirs.id, { controllerId: P2 });
    const given = inHand(swapped, FIREPOWER);
    expect(
      refusal(
        given.state,
        play(
          P1,
          given.id,
          hand(given.state)
            .filter((i) => i !== given.id)
            .slice(0, 1),
        ),
      ),
    ).toBeDefined();
  });
  it("this attack gains ranged: Whiplash's Retaliate 1 deals no damage to the hero", () => {
    const base = engaged(hero(), WHIPLASH, "m-whiplash");
    const { state, ids } = withWeapons([SIDEARM], base);
    const out = fire(state, ids, { targets: ["m-whiplash" as InstanceId] });
    expect(damageOn(out.state, "m-whiplash" as InstanceId)).toBe(3);
    expect(damageOn(out.state, identityOf(out.state))).toBe(0);
  });
  it("by contrast a basic attack on Whiplash takes the Retaliate 1", () => {
    const base = engaged(hero(), WHIPLASH, "m-whiplash");
    const out = drive(base, {}, basicAttack(base, "m-whiplash" as InstanceId));
    expect(damageOn(out.state, identityOf(out.state))).toBe(1);
  });
  it("it is an attack: Guard applies, so with a Hydra Mercenary engaged the villain is not a target", () => {
    const base = engaged(hero(), MERCENARY, "m-mercenary");
    const { state, ids } = withWeapons([SIDEARM], base);
    const seen: string[][] = [];
    fire(state, ids, { seen });
    const enemyPrompt = seen.find((o) => o.includes("m-mercenary"))!;
    expect(enemyPrompt).not.toContain(villainOf(base));
  });
  it("Hero Action: refused in alter-ego form", () => {
    const base = aspectGame();
    const { state, ids } = withWeapons([SIDEARM], base);
    const given = inHand(state, FIREPOWER);
    expect(ids).toHaveLength(1);
    expect(
      refusal(
        given.state,
        play(
          P1,
          given.id,
          hand(given.state)
            .filter((i) => i !== given.id)
            .slice(0, 1),
        ),
      ),
    ).toBeDefined();
  });
});

describe("54015.one-by-one-action: Hero Action (attack), 2 damage to an enemy; if it defeats that enemy, 2 damage to an enemy", () => {
  const cast = (s: GameState, plan: Plan) => {
    const given = inHand(s, ONE_BY_ONE);
    return {
      ...drive(
        given.state,
        plan,
        play(
          P1,
          given.id,
          hand(given.state)
            .filter((i) => i !== given.id)
            .slice(0, 1),
        ),
      ),
      id: given.id,
    };
  };
  it("a target that survives takes 2 and there is no second hit", () => {
    const base = engaged(hero(), SHOCKER, "m-shocker");
    const out = cast(base, { targets: ["m-shocker" as InstanceId] });
    expect(damageOn(out.state, "m-shocker" as InstanceId)).toBe(2);
    expect(damageOn(out.state, villainOf(out.state))).toBe(0);
    expect(discard(out.state)).toContain(out.id);
  });
  it("a target it defeats (a Shocker already at 1 damage): a second enemy of the player's choice takes 2", () => {
    const base = patchInstance(engaged(hero(), SHOCKER, "m-shocker"), "m-shocker" as InstanceId, { damage: 1 });
    const out = cast(base, { targets: ["m-shocker" as InstanceId, villainOf(base)] });
    expect(gone(out.state, "m-shocker")).toBe(true);
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
  });
  it("costs 1 and is refused in alter-ego form", () => {
    const given = inHand(aspectGame(), ONE_BY_ONE);
    expect(
      refusal(
        given.state,
        play(
          P1,
          given.id,
          hand(given.state)
            .filter((i) => i !== given.id)
            .slice(0, 1),
        ),
      ),
    ).toBeDefined();
  });
});

describe("54016.spoiling-for-a-fight-action: discard from the top of the encounter deck until a minion; put it into play engaged with you; ready your hero", () => {
  const cast = (s: GameState, plan: Plan = {}) => {
    const given = inHand(s, SPOILING);
    return { ...drive(given.state, plan, play(P1, given.id, [])), id: given.id };
  };
  const exhaustedHero = (s: GameState): GameState => patchInstance(s, identityOf(s), { exhausted: true });

  it("costs 0: the cards above the first minion are discarded with it, the minion is engaged with you and the hero readies", () => {
    const stacked = stackEncounterDeck(exhaustedHero(hero()), BLANK, ONE_ICON, SHOCKER);
    const topThree = piles(stacked).deck.slice(0, 3);
    const out = cast(stacked);
    const minion = topThree[2]!;
    expect(inst(out.state, minion)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(playerOf(out.state, P1).playArea).toContain(minion);
    expect(piles(out.state).discard).toEqual(expect.arrayContaining([topThree[0], topThree[1]]));
    expect(piles(out.state).discard).not.toContain(minion);
    expect(piles(out.state).deck[0]).not.toBe(minion);
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
    expect(discard(out.state)).toContain(out.id);
  });
  it("a minion on top: only it is taken, nothing else is discarded", () => {
    const stacked = stackEncounterDeck(exhaustedHero(hero()), SANDMAN, BLANK);
    const [top, next] = piles(stacked).deck.slice(0, 2);
    const before = piles(stacked).discard.length;
    const out = cast(stacked);
    expect(inst(out.state, top!).engagedWith).toBe(P1);
    expect(piles(out.state).deck[0]).toBe(next);
    expect(piles(out.state).discard).toHaveLength(before);
  });
  it("only the first minion is taken: a second one below stays in the deck", () => {
    const stacked = stackEncounterDeck(hero(), BLANK, SANDMAN, SHOCKER);
    const [, first, second] = piles(stacked).deck.slice(0, 3);
    const out = cast(stacked);
    expect(inst(out.state, first!).engagedWith).toBe(P1);
    expect(piles(out.state).deck).toContain(second);
  });
  it("it is put into play, not revealed: Shocker's When Revealed (1 damage to each hero) does not happen, and no surge", () => {
    const stacked = stackEncounterDeck(hero(), SHOCKER);
    const shocker = piles(stacked).deck[0]!;
    const out = cast(stacked);
    expect(damageOn(out.state, identityOf(out.state))).toBe(0);
    expect(inst(out.state, shocker).engagedWith).toBe(P1);
  });
  it("an already ready hero stays ready", () => {
    const out = cast(stackEncounterDeck(hero(), SANDMAN));
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
  });
  it("Hero Action: refused in alter-ego form", () => {
    const given = inHand(stackEncounterDeck(aspectGame(), SANDMAN), SPOILING);
    expect(refusal(given.state, play(P1, given.id, []))).toBeDefined();
  });
});

describe("54017.aggressive-stance-response: after you engage a minion, discard this card to search your deck for an Attack event", () => {
  const ID = "54017.aggressive-stance-response";
  /** Stance attached to the hero, a minion on top of the encounter deck, and Spoiling for a Fight in hand. */
  const stage = () => {
    const stance = placed(hero(), STANCE, { attach: true });
    const stacked = stackEncounterDeck(stance.state, SANDMAN);
    return { state: stacked, stance: stance.id };
  };
  const spoil = (s: GameState, plan: Plan) => {
    const given = inHand(s, SPOILING);
    return { ...drive(given.state, plan, play(P1, given.id, [])), before: hand(given.state).length };
  };
  const attackEvents = (s: GameState) => deck(s).filter((i) => isAttackEvent(codeOf(s, i)));

  it("costs 1, attaches to your identity, enters ready", () => {
    const out = played(hero(), STANCE, {}, { attachTo: identityOf(hero()) });
    expect(inst(out.state, out.id)).toMatchObject({ attachedTo: identityOf(out.state), exhausted: false });
    expect(hand(out.state)).toHaveLength(out.before - 1 - 1);
  });
  it("max 1 per player: a second copy cannot be played while one is attached", () => {
    const first = placed(hero(), STANCE, { attach: true });
    const second = inHand(first.state, STANCE);
    expect(
      refusal(
        second.state,
        play(
          P1,
          second.id,
          hand(second.state)
            .filter((i) => i !== second.id)
            .slice(0, 1),
          {
            attachToInstanceId: identityOf(second.state),
          },
        ),
      ),
    ).toBeDefined();
  });
  it("taken after a minion engages you: discarded, the chosen Attack event goes to hand and the deck is shuffled", () => {
    const { state, stance } = stage();
    const options = attackEvents(state);
    expect(options.length).toBeGreaterThan(1);
    const wanted = options.find((i) => codeOf(state, i) === FIREPOWER)!;
    const out = spoil(state, { take: [ID], targets: [wanted] });
    expect(discard(out.state)).toContain(stance);
    expect(inst(out.state, identityOf(out.state)).attachments).not.toContain(stance);
    expect(hand(out.state)).toContain(wanted);
    expect(deck(out.state)).not.toContain(wanted);
    expect(ofType(out.events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
  });
  it("only Attack events are offered (every Attack event of the deck, Arm Block included): not Spoiling for a Fight (no trait), an ally or an upgrade", () => {
    const { state } = stage();
    const seen: string[][] = [];
    const spoilIn = inHand(state, SPOILING);
    drive(spoilIn.state, { take: [ID], seen }, play(P1, spoilIn.id, []));
    const prompt = seen.find(
      (o) => o.every((i) => i in state.instances) && o.some((i) => codeOf(state, i as InstanceId) === FIREPOWER),
    )!;
    expect(prompt).toBeDefined();
    for (const id of prompt) expect(isAttackEvent(codeOf(state, id as InstanceId))).toBe(true);
    expect(prompt.map((i) => codeOf(state, i as InstanceId))).not.toContain(SPOILING);
    expect(prompt).toHaveLength(
      deck(state).filter((i) => codeOf(state, i) !== SPOILING && isAttackEvent(codeOf(state, i))).length,
    );
  });
  it("declined, Stance stays attached and the hand gains nothing", () => {
    const { state, stance } = stage();
    const out = spoil(state, {});
    expect(inst(out.state, identityOf(out.state)).attachments).toContain(stance);
    expect(hand(out.state)).toHaveLength(out.before - 1);
  });
  it("is a Hero Response: in alter-ego form it is not offered when a minion engages you in the villain phase", () => {
    const stance = placed(aspectGame(), STANCE, { attach: true });
    const stacked = stackEncounterDeck(stance.state, BLANK, SANDMAN);
    const seen: string[][] = [];
    const out = driveEventsPicking(DEPS, stacked, planner({ take: [ID], seen }), endTurn(P1));
    expect(seen.flat().some((o) => o.endsWith(ID))).toBe(false);
    expect(inst(out.state, stance.id).attachedTo).toBe(identityOf(out.state));
  });
  it("in hero form the same villain-phase engagement offers it", () => {
    const stance = placed(hero(), STANCE, { attach: true });
    const stacked = stackEncounterDeck(stance.state, BLANK, SANDMAN);
    const seen: string[][] = [];
    const out = driveEventsPicking(DEPS, stacked, planner({ take: [ID], seen }), endTurn(P1));
    expect(seen.flat().some((o) => o.endsWith(ID))).toBe(true);
    expect(discard(out.state)).toContain(stance.id);
  });
  it("a minion engaging another player does not offer it", () => {
    const stance = placed(hero({ second: true }), STANCE, { attach: true });
    // Winter Soldier ends the turn first; Spider-Man (the second seat) is dealt the minion.
    const stacked = stackEncounterDeck(stance.state, BLANK, BLANK, SANDMAN);
    const seen: string[][] = [];
    driveEventsPicking(DEPS, stacked, planner({ take: [ID], seen }), endTurn(P1), endTurn(P2));
    expect(seen.flat().filter((o) => o.endsWith(ID)).length).toBeLessThanOrEqual(1);
  });
});

describe("54018.bambino: restricted on an identity; basic attack interrupt for +3 damage and overkill", () => {
  const INT = "54018.bambino-interrupt";
  it("costs 3, attaches to a S.H.I.E.L.D. character: your identity enters with 3 ammo counters, ready", () => {
    const out = played(hero(), BAMBINO, {}, { attachTo: identityOf(hero()) });
    expect(inst(out.state, out.id)).toMatchObject({
      attachedTo: identityOf(out.state),
      exhausted: false,
      counters: { ammo: 3 },
    });
    expect(hand(out.state)).toHaveLength(out.before - 1 - 3);
  });
  it("can attach to a S.H.I.E.L.D. ally, not to a character without the trait", () => {
    const widow = placed(hero({ second: true }), WIDOW);
    const given = inHand(widow.state, BAMBINO);
    const pay = hand(given.state)
      .filter((i) => i !== given.id)
      .slice(0, 3);
    expect(refusal(given.state, play(P1, given.id, pay, { attachToInstanceId: widow.id }))).toBeUndefined();
    expect(
      refusal(given.state, play(P1, given.id, pay, { attachToInstanceId: identityOf(given.state, P2) })),
    ).toBeDefined();
    const minion = engaged(given.state, SHOCKER, "m-shocker");
    expect(refusal(minion, play(P1, given.id, pay, { attachToInstanceId: "m-shocker" as InstanceId }))).toBeDefined();
  });
  it("restricted while attached to an identity: it counts 1 toward the restricted limit", () => {
    const put = placed(hero(), BAMBINO, { attach: true, counters: { ammo: 3 } });
    expect(hasKeyword(put.state, put.id, "restricted", DEPS)).toBe(true);
    expect(restrictedStanding(put.state, DEPS, P1).load).toBe(1);
  });
  it("not restricted on an ally (the constant is conditional on the identity)", () => {
    const widow = placed(hero(), WIDOW);
    const put = placed(widow.state, BAMBINO, { attach: widow.id, counters: { ammo: 3 } });
    expect(hasKeyword(put.state, put.id, "restricted", DEPS)).toBe(false);
    expect(restrictedStanding(put.state, DEPS, P1).load).toBe(0);
  });
  it("a basic attack by the attached hero: taken, the villain takes 2 + 3 = 5 and Bambino loses 1 ammo counter", () => {
    const put = placed(hero(), BAMBINO, { attach: true, counters: { ammo: 3 } });
    const out = drive(put.state, { take: [INT] }, basicAttack(put.state, villainOf(put.state)));
    expect(damageOn(out.state, villainOf(out.state))).toBe(5);
    expect(inst(out.state, put.id).counters).toEqual({ ammo: 2 });
    expect(inst(out.state, put.id).exhausted).toBe(false);
  });
  it("declined, the attack deals 2 and the counters stay", () => {
    const put = placed(hero(), BAMBINO, { attach: true, counters: { ammo: 3 } });
    const out = drive(put.state, {}, basicAttack(put.state, villainOf(put.state)));
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
    expect(inst(out.state, put.id).counters).toEqual({ ammo: 3 });
  });
  it("overkill: 5 damage to a Shocker (3 hit points) spills 2 onto the villain", () => {
    const base = engaged(hero(), SHOCKER, "m-shocker");
    const put = placed(base, BAMBINO, { attach: true, counters: { ammo: 3 } });
    const out = drive(put.state, { take: [INT] }, basicAttack(put.state, "m-shocker" as InstanceId));
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
  });
  it("without the interrupt a 2 damage attack on a Shocker kills nothing and spills nothing", () => {
    const base = engaged(hero(), SHOCKER, "m-shocker");
    const put = placed(base, BAMBINO, { attach: true, counters: { ammo: 3 } });
    const out = drive(put.state, {}, basicAttack(put.state, "m-shocker" as InstanceId));
    expect(damageOn(out.state, "m-shocker" as InstanceId)).toBe(2);
    expect(damageOn(out.state, villainOf(out.state))).toBe(0);
  });
  it("the last ammo counter: the attack is boosted, the counter removed and Bambino discarded (Uses)", () => {
    const put = placed(hero(), BAMBINO, { attach: true, counters: { ammo: 1 } });
    const out = drive(put.state, { take: [INT] }, basicAttack(put.state, villainOf(put.state)));
    expect(damageOn(out.state, villainOf(out.state))).toBe(5);
    expect(discard(out.state)).toContain(put.id);
    expect(inst(out.state, identityOf(out.state)).attachments).not.toContain(put.id);
  });
  it("with no ammo left it is not offered", () => {
    const put = placed(hero(), BAMBINO, { attach: true, counters: { ammo: 0 } });
    const seen: string[][] = [];
    const out = drive(put.state, { take: [INT], seen }, basicAttack(put.state, villainOf(put.state)));
    expect(seen.flat().some((o) => o.endsWith(INT))).toBe(false);
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
  });
  it("on an ally it works for the ally's basic attack: Black Widow (ATK 2) deals 5 and takes 1 consequential damage", () => {
    const widow = placed(hero(), WIDOW);
    const put = placed(widow.state, BAMBINO, { attach: widow.id, counters: { ammo: 3 } });
    const out = drive(put.state, { take: [INT] }, basicAttack(put.state, villainOf(put.state), widow.id));
    expect(damageOn(out.state, villainOf(out.state))).toBe(5);
    expect(inst(out.state, put.id).counters).toEqual({ ammo: 2 });
    expect(damageOn(out.state, widow.id)).toBe(1);
  });
  it("on an ally it is not offered for the hero's own basic attack", () => {
    const widow = placed(hero(), WIDOW);
    const put = placed(widow.state, BAMBINO, { attach: widow.id, counters: { ammo: 3 } });
    const seen: string[][] = [];
    const out = drive(put.state, { take: [INT], seen }, basicAttack(put.state, villainOf(put.state)));
    expect(seen.flat().some((o) => o.endsWith(INT))).toBe(false);
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
  });
  it("only for a basic attack: an attack event (Haymaker, 3 damage) is not offered it", () => {
    const put = placed(hero({ swap: { [WALL]: HAYMAKER } }), BAMBINO, { attach: true, counters: { ammo: 3 } });
    const given = inHand(put.state, HAYMAKER);
    const seen: string[][] = [];
    const out = drive(
      given.state,
      { take: [INT], seen },
      play(
        P1,
        given.id,
        hand(given.state)
          .filter((i) => i !== given.id)
          .slice(0, 2),
      ),
    );
    expect(seen.flat().some((o) => o.endsWith(INT))).toBe(false);
    expect(damageOn(out.state, villainOf(out.state))).toBe(3);
    expect(inst(out.state, put.id).counters).toEqual({ ammo: 3 });
  });
  it("is not a hero-only interrupt: usable by an alter-ego-form player through an ally's basic attack", () => {
    const widow = placed(aspectGame(), WIDOW);
    const put = placed(widow.state, BAMBINO, { attach: widow.id, counters: { ammo: 3 } });
    const out = drive(put.state, { take: [INT] }, basicAttack(put.state, villainOf(put.state), widow.id));
    expect(damageOn(out.state, villainOf(out.state))).toBe(5);
  });
});

describe("54019.man-on-the-wall-action: Hero Action, exhaust; reduce the cost of the next card you play this phase by 1 per minion engaged with you", () => {
  const ID = "54019.man-on-the-wall-action";
  const stage = (minions: number, second = false) => {
    let s = hero({ second });
    for (let i = 0; i < minions; i += 1) s = engaged(s, SHOCKER, `m-${i}`);
    return placed(s, WALL, { attach: true });
  };
  const useIt = (s: GameState, wall: InstanceId) => drive(s, {}, use(P1, wall, ID)).state;
  /** The hand cards `code` costs after the use: the hand drop of a play paid with exactly `paid` cards. */
  const playPaying = (s: GameState, code: string, paid: number) => {
    const given = inHand(s, code);
    const pay = hand(given.state)
      .filter((i) => i !== given.id)
      .slice(0, paid);
    return { state: drive(given.state, {}, play(P1, given.id, pay)).state, id: given.id, given, paid: pay };
  };

  it("costs 1, attaches to your identity; refused for a non-Soldier identity", () => {
    const out = played(hero(), WALL, {}, { attachTo: identityOf(hero()) });
    expect(inst(out.state, out.id)).toMatchObject({ attachedTo: identityOf(out.state), exhausted: false });
    expect(hand(out.state)).toHaveLength(out.before - 2);
    // Spider-Man (the second seat) is not a Soldier.
    const base = hero({ second: true });
    const spider = identityOf(base, P2);
    const card2 = hand(base, P2)[0]!;
    const swapped = patchInstance(base, card2, { cardId: cardId(WALL) });
    const pay = hand(swapped, P2)
      .filter((i) => i !== card2)
      .slice(0, 1);
    expect(refusal(swapped, play(P2, card2, pay, { attachToInstanceId: spider }))).toBeDefined();
  });
  it("two minions engaged: the next card costs 2 less (Winter Rifle 3 -> 1)", () => {
    const { state, id } = stage(2);
    const used = useIt(state, id);
    expect(inst(used, id).exhausted).toBe(true);
    const out = playPaying(used, RIFLE, 1);
    expect(inPlayArea(out.state, out.id) || inst(out.state, out.id).attachedTo !== null).toBe(true);
  });
  it("two minions engaged: Rifle cannot be played with 0 payment (3 - 2 = 1)", () => {
    const { state, id } = stage(2);
    const used = useIt(state, id);
    const given = inHand(used, RIFLE);
    expect(refusal(given.state, play(P1, given.id, [], { attachToInstanceId: identityOf(given.state) }))).toBeDefined();
  });
  it("the reduction is by the count as the action resolves: a third minion afterwards changes nothing", () => {
    const { state, id } = stage(2);
    const used = engaged(useIt(state, id), SHOCKER, "m-late");
    const given = inHand(used, RIFLE);
    expect(refusal(given.state, play(P1, given.id, [], { attachToInstanceId: identityOf(given.state) }))).toBeDefined();
    const pay = hand(given.state)
      .filter((i) => i !== given.id)
      .slice(0, 1);
    expect(
      refusal(given.state, play(P1, given.id, pay, { attachToInstanceId: identityOf(given.state) })),
    ).toBeUndefined();
  });
  it("the cost never goes below 0: three minions and a cost-1 card is free (Aggressive Stance)", () => {
    const { state, id } = stage(3);
    const used = useIt(state, id);
    const given = inHand(used, STANCE);
    expect(
      refusal(given.state, play(P1, given.id, [], { attachToInstanceId: identityOf(given.state) })),
    ).toBeUndefined();
  });
  it("only the next card: after it, the following card costs full price", () => {
    const { state, id } = stage(3);
    const used = useIt(state, id);
    const first = inHand(used, STANCE);
    const afterFirst = drive(
      first.state,
      {},
      play(P1, first.id, [], { attachToInstanceId: identityOf(first.state) }),
    ).state;
    const second = inHand(afterFirst, ONE_BY_ONE);
    expect(refusal(second.state, play(P1, second.id, []))).toBeDefined();
    const pay = hand(second.state)
      .filter((i) => i !== second.id)
      .slice(0, 1);
    expect(refusal(second.state, play(P1, second.id, pay))).toBeUndefined();
  });
  it("with no minion engaged the reduction is 0", () => {
    const { state, id } = stage(0);
    const used = useIt(state, id);
    expect(inst(used, id).exhausted).toBe(true);
    const given = inHand(used, STANCE);
    expect(refusal(given.state, play(P1, given.id, [], { attachToInstanceId: identityOf(given.state) }))).toBeDefined();
  });
  it("a minion engaged with another player is not counted", () => {
    const base = engaged(hero({ second: true }), SHOCKER, "m-theirs", P2);
    const { state, id } = (() => {
      const put = placed(base, WALL, { attach: true });
      return { state: put.state, id: put.id };
    })();
    const used = useIt(state, id);
    const given = inHand(used, STANCE);
    expect(refusal(given.state, play(P1, given.id, [], { attachToInstanceId: identityOf(given.state) }))).toBeDefined();
  });
  it("cannot be used while exhausted, and not in alter-ego form", () => {
    const { state, id } = stage(1);
    expect(refusal(patchInstance(state, id, { exhausted: true }), use(P1, id, ID))).toBeDefined();
    const alter = placed(aspectGame(), WALL, { attach: true });
    expect(refusal(alter.state, use(P1, alter.id, ID))).toBeDefined();
  });
});

/** Moves `ids` of the player to the top of their discard pile. */
const toDiscard = (s: GameState, ids: readonly InstanceId[]): GameState => ({
  ...s,
  players: s.players.map((p) =>
    p.playerId === P1
      ? {
          ...p,
          deck: p.deck.filter((i) => !ids.includes(i)),
          hand: p.hand.filter((i) => !ids.includes(i)),
          discard: [...p.discard, ...ids],
        }
      : p,
  ),
});
const firstCopy = (s: GameState, code: string): InstanceId =>
  copies([...deck(s), ...hand(s), ...discard(s)], s, code)[0]!;
const paying = (s: GameState, id: InstanceId, n: number): InstanceId[] =>
  hand(s)
    .filter((i) => i !== id)
    .slice(0, n);

describe("second half printed data", () => {
  it("S.H.I.E.L.D. Sidearm: Aggression WEAPON upgrade, cost 1, [mental], up to 3 copies, Uses (3 ammo), limit 1 per character", () => {
    const c = card<UpgradeCard>(SIDEARM);
    expect([c.cost, c.aspect, c.unique, c.deckLimit]).toEqual([1, "aggression", false, 3]);
    expect(traitsOf(SIDEARM)).toEqual(["WEAPON"]);
    expect(card<WithIcons>(SIDEARM).resourceIcons).toEqual({ mental: 1 });
    expect(c.keywords).toEqual([{ name: "uses", count: 3, counterType: "ammo" }]);
    const extra = c as unknown as { attachesTo: unknown; playRestrictions: unknown };
    expect(extra.attachesTo).toEqual({ kind: "qualified", category: "character", trait: trait("S.H.I.E.L.D.") });
    expect(extra.playRestrictions).toEqual({ maxPerHost: 1 });
  });
  it("Nick Fury, Sr.: unique basic ally, cost 4, ATK 2, THW 2, HP 3, consequential 1/1, S.H.I.E.L.D. SOLDIER, [mental]", () => {
    const c = card<AllyCard>(FURY);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique, c.deckLimit]).toEqual([4, 2, 2, 3, "basic", true, 1]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits).toEqual([trait("S.H.I.E.L.D."), trait("SOLDIER")]);
    expect(c.keywords).toEqual([]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
  });
  it("Super-Soldiers: basic ATTACK event, cost 3, [physical], Team-Up (Captain America and Winter Soldier), max 1 per deck", () => {
    const c = card<EventCard>(SUPER);
    expect([c.cost, c.aspect, c.deckLimit, c.unique]).toEqual([3, "basic", 1, false]);
    expect(traitsOf(SUPER)).toEqual(["ATTACK"]);
    expect(card<WithIcons>(SUPER).resourceIcons).toEqual({ physical: 1 });
    expect(c.keywords).toEqual([{ name: "teamUp", names: ["Captain America", "Winter Soldier"] }]);
  });
  it("Winter, Widow, Soldier, Spy: basic ATTACK event, cost 2, [energy], Team-Up (Black Widow and Winter Soldier), max 1 per deck", () => {
    const c = card<EventCard>(WINTER_WIDOW);
    expect(c.name).toBe("Winter, Widow, Soldier, Spy");
    expect([c.cost, c.aspect, c.deckLimit, c.unique]).toEqual([2, "basic", 1, false]);
    expect(traitsOf(WINTER_WIDOW)).toEqual(["ATTACK"]);
    expect(card<WithIcons>(WINTER_WIDOW).resourceIcons).toEqual({ energy: 1 });
    expect(c.keywords).toEqual([{ name: "teamUp", names: ["Black Widow", "Winter Soldier"] }]);
  });
  it("the resources: basic, max 1 per deck, two icons of one type each, no ability", () => {
    const expected: Record<string, Record<string, number>> = {
      [ENERGY]: { energy: 2 },
      [GENIUS]: { mental: 2 },
      [STRENGTH]: { physical: 2 },
    };
    for (const [code, icons] of Object.entries(expected)) {
      const c = card<AnyCard & { producesIcons: unknown; aspect: string; deckLimit: number }>(code);
      expect(c.type, code).toBe("resource");
      expect([c.aspect, c.deckLimit, c.producesIcons], code).toEqual(["basic", 1, icons]);
      expect(abilityRefIds(c), code).toEqual([]);
    }
    expect(card<AnyCard & { name: string }>(ENERGY).name).toBe("Energy");
    expect(card<AnyCard & { name: string }>(GENIUS).name).toBe("Genius");
    expect(card<AnyCard & { name: string }>(STRENGTH).name).toBe("Strength");
  });
  it("White Widow: unique Protection S.H.I.E.L.D. SPY ally, cost 4, ATK 1, THW 2, HP 3, consequential 1/1, [mental]", () => {
    const c = card<AllyCard>(WHITE_WIDOW);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique, c.deckLimit]).toEqual([4, 1, 2, 3, "protection", true, 1]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits).toEqual([trait("S.H.I.E.L.D."), trait("SPY")]);
    expect(c.keywords).toEqual([]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
  });
  it("S.H.I.E.L.D. Deputy: basic TITLE upgrade, cost 0, [mental], up to 3 copies; the current text carries the RRG 1.8 p. 70 maximum", () => {
    const c = card<UpgradeCard>(DEPUTY);
    expect([c.cost, c.aspect, c.unique, c.deckLimit]).toEqual([0, "basic", false, 3]);
    expect(traitsOf(DEPUTY)).toEqual(["TITLE"]);
    expect(card<WithIcons>(DEPUTY).resourceIcons).toEqual({ mental: 1 });
    const extra = c as unknown as {
      attachesTo: unknown;
      playRestrictions: unknown;
      text: { printed: string; current: string };
    };
    expect(extra.attachesTo).toEqual({ kind: "friendlyCharacter" });
    expect(extra.playRestrictions).toEqual({ requiresIdentityTrait: trait("S.H.I.E.L.D."), maxPerHost: 1 });
    expect(extra.text.printed).not.toContain("Max 1 per character");
    expect(extra.text.current).toContain("Attach to a friendly character. Max 1 per character.");
  });
});

describe("54020.shield-sidearm-interrupt: attached character's basic attack; exhaust, remove 1 ammo counter -> 1 damage to an enemy", () => {
  const INT = "54020.shield-sidearm-interrupt";
  const SHOCK = "m-shocker" as InstanceId;
  const stage = (counters: Record<string, number> = { ammo: 3 }, host?: "widow") => {
    const base = engaged(hero(), SHOCKER, "m-shocker");
    if (host === "widow") {
      const widow = placed(base, WIDOW);
      const side = placed(widow.state, SIDEARM, { attach: widow.id, counters });
      return { state: side.state, side: side.id, widow: widow.id };
    }
    const side = placed(base, SIDEARM, { attach: true, counters });
    return { state: side.state, side: side.id, widow: null as unknown as InstanceId };
  };

  it("costs 1 and a normal play gives it its 3 ammo counters: attached to your identity, ready", () => {
    const out = played(hero(), SIDEARM, {}, { attachTo: identityOf(hero()) });
    expect(inst(out.state, out.id)).toMatchObject({
      attachedTo: identityOf(out.state),
      exhausted: false,
      counters: { ammo: 3 },
    });
    expect(hand(out.state)).toHaveLength(out.before - 1 - 1);
  });
  it("attaches to a S.H.I.E.L.D. ally; not to a character without the trait (Spider-Man), nor to a minion", () => {
    const widow = placed(hero({ second: true }), WIDOW);
    const given = inHand(widow.state, SIDEARM);
    const pay = paying(given.state, given.id, 1);
    expect(refusal(given.state, play(P1, given.id, pay, { attachToInstanceId: widow.id }))).toBeUndefined();
    expect(
      refusal(given.state, play(P1, given.id, pay, { attachToInstanceId: identityOf(given.state, P2) })),
    ).toBeDefined();
    const minion = engaged(given.state, SHOCKER, "m-shocker");
    expect(refusal(minion, play(P1, given.id, pay, { attachToInstanceId: SHOCK }))).toBeDefined();
  });
  it("limit 1 per character: a second Sidearm cannot go on the same character, but can on another", () => {
    const widow = placed(hero(), WIDOW);
    const first = placed(widow.state, SIDEARM, { attach: widow.id, counters: { ammo: 3 } });
    const second = inHand(first.state, SIDEARM);
    const pay = paying(second.state, second.id, 1);
    expect(refusal(second.state, play(P1, second.id, pay, { attachToInstanceId: widow.id }))).toBeDefined();
    expect(
      refusal(second.state, play(P1, second.id, pay, { attachToInstanceId: identityOf(second.state) })),
    ).toBeUndefined();
  });
  it("a basic attack by the attached hero, taken: Sidearm exhausts and loses 1 ammo; the chosen Shocker takes 1, the villain 2", () => {
    const { state, side } = stage();
    const out = drive(state, { take: [INT], targets: [SHOCK] }, basicAttack(state, villainOf(state)));
    expect(damageOn(out.state, SHOCK)).toBe(1);
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
    expect(inst(out.state, side)).toMatchObject({ exhausted: true, counters: { ammo: 2 } });
  });
  it("the 1 damage can go to the villain as well: 2 + 1 = 3", () => {
    const { state } = stage();
    const out = drive(state, { take: [INT], targets: [villainOf(state)] }, basicAttack(state, villainOf(state)));
    expect(damageOn(out.state, villainOf(out.state))).toBe(3);
    expect(damageOn(out.state, SHOCK)).toBe(0);
  });
  it("the 1 damage is added to damage already on the enemy: a Shocker at 1 damage goes to 2", () => {
    const { state } = stage();
    const hurt = patchInstance(state, SHOCK, { damage: 1 });
    const out = drive(hurt, { take: [INT], targets: [SHOCK] }, basicAttack(hurt, villainOf(hurt)));
    expect(damageOn(out.state, SHOCK)).toBe(2);
  });
  it("declined, the attack deals 2, the counters stay and Sidearm stays ready", () => {
    const { state, side } = stage();
    const out = drive(state, {}, basicAttack(state, villainOf(state)));
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
    expect(damageOn(out.state, SHOCK)).toBe(0);
    expect(inst(out.state, side)).toMatchObject({ exhausted: false, counters: { ammo: 3 } });
  });
  it("the last ammo counter: the damage is dealt and Sidearm is discarded (Uses)", () => {
    const { state, side } = stage({ ammo: 1 });
    const out = drive(state, { take: [INT], targets: [SHOCK] }, basicAttack(state, villainOf(state)));
    expect(damageOn(out.state, SHOCK)).toBe(1);
    expect(discard(out.state)).toContain(side);
    expect(inst(out.state, identityOf(out.state)).attachments).not.toContain(side);
  });
  it("with no ammo counters left it is not offered", () => {
    const { state } = stage({ ammo: 0 });
    const seen: string[][] = [];
    const out = drive(state, { take: [INT], seen }, basicAttack(state, villainOf(state)));
    expect(seen.flat().some((o) => o.endsWith(INT))).toBe(false);
    expect(damageOn(out.state, villainOf(out.state))).toBe(2);
  });
  it("exhausted, it is not offered even with ammo (exhausting it is part of the cost)", () => {
    const { state, side } = stage();
    const tired = patchInstance(state, side, { exhausted: true });
    const seen: string[][] = [];
    const out = drive(tired, { take: [INT], seen }, basicAttack(tired, villainOf(tired)));
    expect(seen.flat().some((o) => o.endsWith(INT))).toBe(false);
    expect(inst(out.state, side).counters).toEqual({ ammo: 3 });
  });
  it("on an ally it works for the ally's basic attack: Black Widow (ATK 2) and the Sidearm deal 2 + 1 to the villain, she takes 1", () => {
    const { state, side, widow } = stage({ ammo: 3 }, "widow");
    const out = drive(state, { take: [INT], targets: [villainOf(state)] }, basicAttack(state, villainOf(state), widow));
    expect(damageOn(out.state, villainOf(out.state))).toBe(3);
    expect(inst(out.state, side)).toMatchObject({ exhausted: true, counters: { ammo: 2 } });
    expect(damageOn(out.state, widow)).toBe(1);
  });
  it("on an ally it is not offered for the hero's own basic attack", () => {
    const { state } = stage({ ammo: 3 }, "widow");
    const seen: string[][] = [];
    drive(state, { take: [INT], seen }, basicAttack(state, villainOf(state)));
    expect(seen.flat().some((o) => o.endsWith(INT))).toBe(false);
  });
  it("only for a basic attack: playing an attack event (Haymaker) does not offer it", () => {
    const { state, side } = stage();
    const swapped = placed(hero({ swap: { [WALL]: HAYMAKER } }), SIDEARM, { attach: true, counters: { ammo: 3 } });
    const given = inHand(swapped.state, HAYMAKER);
    const seen: string[][] = [];
    const out = drive(given.state, { take: [INT], seen }, play(P1, given.id, paying(given.state, given.id, 2)));
    expect(seen.flat().some((o) => o.endsWith(INT))).toBe(false);
    expect(inst(out.state, swapped.id).counters).toEqual({ ammo: 3 });
    expect(inst(state, side).counters).toEqual({ ammo: 3 });
  });
  it("usable in alter-ego form through an ally's basic attack (no form restriction)", () => {
    const widow = placed(aspectGame(), WIDOW);
    const side = placed(widow.state, SIDEARM, { attach: widow.id, counters: { ammo: 3 } });
    const out = drive(
      side.state,
      { take: [INT], targets: [villainOf(side.state)] },
      basicAttack(side.state, villainOf(side.state), widow.id),
    );
    expect(damageOn(out.state, villainOf(out.state))).toBe(3);
  });
});

describe("54021.nick-fury-sr-forced-response: the box's 50054 script, on the pack's reprint", () => {
  const ID = "54021.nick-fury-sr-forced-response";
  const enter = (state: GameState, option: string, targets: readonly InstanceId[] = []) =>
    played(state, FURY, { option, targets });
  it("costs 4 and enters ready; Draw 2 puts two cards in the hand beyond the cost", () => {
    const out = enter(hero(), "Draw 2");
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(hand(out.state)).toHaveLength(out.before - 1 - 4 + 2);
  });
  it("Remove 3 threat: the main scheme at 5 goes to 2", () => {
    const base = hero();
    const scheme = base.mainScheme.instanceId;
    const raised = patchInstance(base, scheme, { threat: 5 });
    const out = enter(raised, "Remove 3 threat", [scheme]);
    expect(inst(out.state, scheme).threat).toBe(2);
  });
  it("Give a S.H.I.E.L.D. character a tough status card: Winter Soldier gets exactly one", () => {
    const out = enter(hero(), "Give a S.H.I.E.L.D.", [identityOf(hero())]);
    expect(inst(out.state, identityOf(out.state)).statuses.tough).toBe(1);
    expect(inst(out.state, out.id).statuses.tough).toBe(0);
  });
  it("at the end of the round he is discarded", () => {
    const out = enter(hero(), "Draw 2");
    expect(inPlayArea(out.state, out.id)).toBe(true);
    const ended = drive(out.state, {}, endTurn(P1));
    expect(inPlayArea(ended.state, out.id)).toBe(false);
    expect(discard(ended.state)).toContain(out.id);
  });
  it("is a Forced Response: with the option chosen no player prompt asks whether to use it", () => {
    const seen: string[][] = [];
    played(hero(), FURY, { option: "Draw 2", take: [], seen });
    expect(seen.flat().some((o) => o.endsWith(ID))).toBe(false);
  });
});

describe("54022.super-soldiers-action: Team-Up (Captain America and Winter Soldier); Hero Action (attack), 6 damage to an enemy, each a tough status card", () => {
  const cast = (s: GameState, plan: Plan = {}) => {
    const given = inHand(s, SUPER);
    return { ...drive(given.state, plan, play(P1, given.id, paying(given.state, given.id, 3))), id: given.id, given };
  };
  it("costs 3; 6 damage to the chosen enemy; Captain America and Winter Soldier each get one tough status card, no other character does", () => {
    const cap = placed(hero(), CAP);
    const widow = placed(cap.state, WIDOW);
    const out = cast(widow.state, { targets: [villainOf(widow.state)] });
    expect(damageOn(out.state, villainOf(out.state))).toBe(6);
    expect(inst(out.state, cap.id).statuses.tough).toBe(1);
    expect(inst(out.state, identityOf(out.state)).statuses.tough).toBe(1);
    expect(inst(out.state, widow.id).statuses.tough).toBe(0);
    expect(discard(out.state)).toContain(out.id);
    expect(hand(out.state)).toHaveLength(hand(out.given.state).length - 1 - 3);
  });
  it("6 damage kills a Shocker (3 hit points) with no spill to the villain", () => {
    const cap = placed(engaged(hero(), SHOCKER, "m-shocker"), CAP);
    const out = cast(cap.state, { targets: ["m-shocker" as InstanceId] });
    expect(gone(out.state, "m-shocker")).toBe(true);
    expect(damageOn(out.state, villainOf(out.state))).toBe(0);
  });
  it("a character already holding a tough status card keeps one (a character has at most one)", () => {
    const cap = placed(hero(), CAP);
    const armed = patchInstance(cap.state, cap.id, { statuses: { ...inst(cap.state, cap.id).statuses, tough: 1 } });
    const out = cast(armed, { targets: [villainOf(armed)] });
    expect(inst(out.state, cap.id).statuses.tough).toBe(1);
    expect(inst(out.state, identityOf(out.state)).statuses.tough).toBe(1);
  });
  it("Team-Up: refused with Captain America not in play, played with him in play", () => {
    const given = inHand(hero(), SUPER);
    const pay = paying(given.state, given.id, 3);
    expect(refusal(given.state, play(P1, given.id, pay))).toMatch(/Captain America/);
    const cap = placed(given.state, CAP);
    expect(refusal(cap.state, play(P1, given.id, pay))).toBeUndefined();
  });
  it("Team-Up names Winter Soldier too: in alter-ego form (Bucky Barnes) it cannot be played", () => {
    const cap = placed(aspectGame(), CAP);
    const given = inHand(cap.state, SUPER);
    expect(refusal(given.state, play(P1, given.id, paying(given.state, given.id, 3)))).toBeDefined();
  });
  it("Captain America exhausted or damaged still counts: he only has to be in play", () => {
    const cap = placed(hero(), CAP);
    const tired = patchInstance(cap.state, cap.id, { exhausted: true, damage: 2 });
    const given = inHand(tired, SUPER);
    expect(refusal(given.state, play(P1, given.id, paying(given.state, given.id, 3)))).toBeUndefined();
  });
  it("costs 3: paying only 2 is refused", () => {
    const cap = placed(hero(), CAP);
    const given = inHand(cap.state, SUPER);
    expect(refusal(given.state, play(P1, given.id, paying(given.state, given.id, 2)))).toBeDefined();
  });
});

describe("54023.winter-widow-soldier-spy-action: Team-Up (Black Widow and Winter Soldier); put a Preparation upgrade from your discard pile into play; 4 damage to an enemy", () => {
  const cast = (s: GameState, plan: Plan = {}) => {
    const given = inHand(s, WINTER_WIDOW);
    // Paid with cards that are not Preparation upgrades: the payment goes to the discard pile before the effect.
    const pay = hand(given.state)
      .filter((i) => i !== given.id && ![STANCE, PREP_READY].includes(codeOf(given.state, i)))
      .slice(0, 2);
    return { ...drive(given.state, plan, play(P1, given.id, pay)), id: given.id, given };
  };
  /** Black Widow in play and an empty discard pile (the dealt game starts with a Preparation upgrade in it). */
  const stage = () => {
    const widow = placed(hero(), WIDOW);
    const s = widow.state;
    return {
      ...widow,
      state: {
        ...s,
        players: s.players.map((p) => (p.playerId === P1 ? { ...p, deck: [...p.deck, ...p.discard], discard: [] } : p)),
      } as GameState,
    };
  };

  it("costs 2; the Preparation upgrade in the discard pile is put into play on your hero, ready, and 4 damage goes to the enemy", () => {
    const widow = stage();
    const stance = firstCopy(widow.state, STANCE);
    const state = toDiscard(widow.state, [stance]);
    const out = cast(state, { targets: [stance, villainOf(state)] });
    expect(inst(out.state, stance)).toMatchObject({
      attachedTo: identityOf(out.state),
      exhausted: false,
      faceup: true,
    });
    expect(inst(out.state, identityOf(out.state)).attachments).toContain(stance);
    expect(discard(out.state)).not.toContain(stance);
    expect(damageOn(out.state, villainOf(out.state))).toBe(4);
    expect(discard(out.state)).toContain(out.id);
    expect(hand(out.state)).toHaveLength(hand(out.given.state).length - 1 - 2);
  });
  it("two Preparation upgrades in the discard pile: the chosen one enters play, the other stays", () => {
    const widow = stage();
    const stance = firstCopy(widow.state, STANCE);
    const ready = firstCopy(widow.state, PREP_READY);
    const state = toDiscard(widow.state, [stance, ready]);
    const out = cast(state, { targets: [ready, villainOf(state)] });
    expect(inst(out.state, identityOf(out.state)).attachments).toEqual([ready]);
    expect(discard(out.state)).toContain(stance);
    expect(discard(out.state)).not.toContain(ready);
  });
  it("only a Preparation upgrade is offered: Winter Mask (a non-Preparation upgrade) in the discard pile stays there", () => {
    const widow = stage();
    const mask = firstCopy(widow.state, MASK);
    const stance = firstCopy(widow.state, STANCE);
    const state = toDiscard(widow.state, [mask, stance]);
    const seen: string[][] = [];
    const out = cast(state, { seen, targets: [stance, villainOf(state)] });
    expect(seen.flat()).not.toContain(mask);
    expect(seen.find((o) => o.includes(stance))).toEqual([stance]);
    expect(inst(out.state, identityOf(out.state)).attachments).toEqual([stance]);
    expect(discard(out.state)).toContain(mask);
  });
  it("a Preparation upgrade in the deck or hand is not taken: with the discard pile empty of them, nothing enters play and the 4 damage is still dealt", () => {
    const widow = stage();
    const out = cast(widow.state, { targets: [villainOf(widow.state)] });
    expect(inst(out.state, identityOf(out.state)).attachments).toEqual([]);
    expect(damageOn(out.state, villainOf(out.state))).toBe(4);
    expect(copies(deck(out.state), out.state, STANCE)).toHaveLength(3);
  });
  it("4 damage to a Shocker kills it (3 hit points) with no spill", () => {
    const base = engaged(stage().state, SHOCKER, "m-shocker");
    const out = cast(base, { targets: ["m-shocker" as InstanceId] });
    expect(gone(out.state, "m-shocker")).toBe(true);
    expect(damageOn(out.state, villainOf(out.state))).toBe(0);
  });
  it("Team-Up: refused with Black Widow not in play, played with her in play; refused in alter-ego form", () => {
    const given = inHand(hero(), WINTER_WIDOW);
    const pay = paying(given.state, given.id, 2);
    expect(refusal(given.state, play(P1, given.id, pay))).toMatch(/Black Widow/);
    const widow = placed(given.state, WIDOW);
    expect(refusal(widow.state, play(P1, given.id, pay))).toBeUndefined();
    const alter = placed(aspectGame(), WIDOW);
    const g2 = inHand(alter.state, WINTER_WIDOW);
    expect(refusal(g2.state, play(P1, g2.id, paying(g2.state, g2.id, 2)))).toBeDefined();
  });
});

describe("54032.white-widow-response: after you resolve the ability of a Preparation card you control, heal White Widow by its printed cost", () => {
  const ID = "54032.white-widow-response";
  const SWAP = { [MASK]: WHITE_WIDOW };
  /** White Widow with `damage`, Stance (cost 1) on the hero, a Sandman on top of the deck, Spoiling for a Fight in hand. */
  const stageStance = (damage: number) => {
    const base = hero({ swap: SWAP });
    const ww = placed(base, WHITE_WIDOW);
    const hurt = patchInstance(ww.state, ww.id, { damage });
    const stance = placed(hurt, STANCE, { attach: true });
    return { state: stackEncounterDeck(stance.state, SANDMAN), ww: ww.id, stance: stance.id };
  };
  const spoil = (s: GameState, plan: Plan) => {
    const given = inHand(s, SPOILING);
    return drive(given.state, plan, play(P1, given.id, []));
  };

  it("costs 4 and enters ready", () => {
    const out = played(hero({ swap: SWAP }), WHITE_WIDOW);
    expect(inPlayArea(out.state, out.id)).toBe(true);
    expect(inst(out.state, out.id).exhausted).toBe(false);
    expect(hand(out.state)).toHaveLength(out.before - 1 - 4);
  });
  it("Aggressive Stance (printed cost 1) resolved: taken, White Widow heals 1 (2 damage to 1)", () => {
    const { state, ww, stance } = stageStance(2);
    const out = spoil(state, { take: ["54017.aggressive-stance-response", ID] });
    expect(discard(out.state)).toContain(stance);
    expect(damageOn(out.state, ww)).toBe(1);
  });
  it("the response is optional: declined, her damage stays", () => {
    const { state, ww } = stageStance(2);
    const out = spoil(state, { take: ["54017.aggressive-stance-response"] });
    expect(damageOn(out.state, ww)).toBe(2);
  });
  it("a Preparation of printed cost 2 (Defensive Stance 08032, stopping Whiplash's Retaliate) heals 2 (2 damage to 0; never below 0)", () => {
    const DEFENSIVE = "08032";
    const WHIP = "m-whip" as InstanceId;
    for (const [damage, expected] of [
      [2, 0],
      [1, 0],
    ] as const) {
      const base = hero({ swap: { ...SWAP, [BAMBINO]: DEFENSIVE } });
      const ww = placed(base, WHITE_WIDOW);
      const hurt = patchInstance(ww.state, ww.id, { damage });
      const prep = placed(hurt, DEFENSIVE, { attach: true });
      const withWhip = engaged(prep.state, WHIPLASH, "m-whip");
      const out = drive(withWhip, { take: ["08032.defensive-stance-interrupt", ID] }, basicAttack(withWhip, WHIP));
      expect(discard(out.state)).toContain(prep.id);
      expect(damageOn(out.state, identityOf(out.state))).toBe(0);
      expect(damageOn(out.state, ww.id), `damage ${damage}`).toBe(expected);
    }
  });
  it("an ability of a card that is not a Preparation (Man on the Wall) does not offer it", () => {
    const base = hero({ swap: SWAP });
    const ww = placed(base, WHITE_WIDOW);
    const hurt = patchInstance(ww.state, ww.id, { damage: 2 });
    const wall = placed(hurt, WALL, { attach: true });
    const seen: string[][] = [];
    const out = drive(wall.state, { take: [ID], seen }, use(P1, wall.id, "54019.man-on-the-wall-action"));
    expect(seen.flat().some((o) => o.endsWith(ID))).toBe(false);
    expect(damageOn(out.state, ww.id)).toBe(2);
  });
});

describe("54033.shield-deputy-constant: attached character gets +1 hit point and gains S.H.I.E.L.D.; max 1 per character (RRG 1.8 p. 70)", () => {
  const SWAP = { [MASK]: DEPUTY, [BAMBINO]: DEPUTY };
  const deputyGame = (opts: { second?: boolean } = {}) => hero({ swap: SWAP, ...opts });
  const attach = (s: GameState, host: InstanceId, player: PlayerId = P1) => {
    const given = inHand(s, DEPUTY, player);
    return { ...given, command: play(player, given.id, [], { attachToInstanceId: host }) };
  };
  it("costs 0 and attaches to your hero: 11 hit points become 12, ready, S.H.I.E.L.D. stays", () => {
    const base = deputyGame();
    expect(maxHitPoints(base, identityOf(base), DEPS)).toBe(11);
    const out = played(base, DEPUTY, {}, { cost: 0, attachTo: identityOf(base) });
    expect(inst(out.state, out.id)).toMatchObject({ attachedTo: identityOf(out.state), exhausted: false });
    expect(maxHitPoints(out.state, identityOf(out.state), DEPS)).toBe(12);
    expect(hand(out.state)).toHaveLength(out.before - 1);
    expect(traitsInPlay(out.state, identityOf(out.state), DEPS).map(String)).toContain("S.H.I.E.L.D.");
  });
  it("on an ally: Black Widow's 3 hit points become 4", () => {
    const widow = placed(deputyGame(), WIDOW);
    const out = played(widow.state, DEPUTY, {}, { cost: 0, attachTo: widow.id });
    expect(maxHitPoints(out.state, widow.id, DEPS)).toBe(4);
  });
  it("on another player's character without the trait (Spider-Man): +1 hit point and the S.H.I.E.L.D. trait are gained", () => {
    const base = deputyGame({ second: true });
    const spidey = identityOf(base, P2);
    const hp = maxHitPoints(base, spidey, DEPS);
    expect(traitsInPlay(base, spidey, DEPS).map(String)).not.toContain("S.H.I.E.L.D.");
    const { state, command } = (() => {
      const a = attach(base, spidey);
      return { state: a.state, command: a.command };
    })();
    const out = drive(state, {}, command);
    expect(maxHitPoints(out.state, spidey, DEPS)).toBe(hp! + 1);
    expect(traitsInPlay(out.state, spidey, DEPS).map(String)).toContain("S.H.I.E.L.D.");
  });
  it("on an ally without the trait: the ally gains S.H.I.E.L.D.", () => {
    const base = deputyGame({ second: true });
    const ally = placed(base, SPIDEY_ALLY, { player: P2 });
    expect(traitsInPlay(ally.state, ally.id, DEPS).map(String)).not.toContain("S.H.I.E.L.D.");
    const a = attach(ally.state, ally.id);
    const out = drive(a.state, {}, a.command);
    expect(traitsInPlay(out.state, ally.id, DEPS).map(String)).toContain("S.H.I.E.L.D.");
  });
  it("the bonuses end when it leaves: discarded, the hit points and the granted trait are gone", () => {
    const base = deputyGame({ second: true });
    const a = attach(base, identityOf(base, P2));
    const on = drive(a.state, {}, a.command);
    const off = toDiscardAttachment(on.state, a.id, identityOf(on.state, P2));
    expect(traitsInPlay(off, identityOf(off, P2), DEPS).map(String)).not.toContain("S.H.I.E.L.D.");
    expect(maxHitPoints(off, identityOf(off, P2), DEPS)).toBe(maxHitPoints(base, identityOf(base, P2), DEPS));
  });
  it("max 1 per character: a second Deputy cannot attach to the same character, but can to another", () => {
    const widow = placed(deputyGame(), WIDOW);
    const first = placed(widow.state, DEPUTY, { attach: widow.id });
    const second = inHand(first.state, DEPUTY);
    expect(refusal(second.state, play(P1, second.id, [], { attachToInstanceId: widow.id }))).toBeDefined();
    expect(
      refusal(second.state, play(P1, second.id, [], { attachToInstanceId: identityOf(second.state) })),
    ).toBeUndefined();
  });
  it("friendly characters only: not attachable to a minion", () => {
    const withMinion = engaged(deputyGame(), SHOCKER, "m-shocker");
    const a = attach(withMinion, "m-shocker" as InstanceId);
    expect(refusal(a.state, a.command)).toBeDefined();
  });
  it("play only if your identity has the S.H.I.E.L.D. trait: Winter Soldier may; Spider-Man (another seat's hand) may not", () => {
    const base = deputyGame({ second: true });
    const mine = attach(base, identityOf(base));
    expect(refusal(mine.state, mine.command)).toBeUndefined();
    const handed: GameState = {
      ...mine.state,
      players: mine.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => i !== mine.id) }
          : p.playerId === P2
            ? { ...p, hand: [...p.hand, mine.id] }
            : p,
      ),
    };
    const theirs = patchInstance(handed, mine.id, { ownerId: P2, controllerId: P2 });
    expect(refusal(theirs, play(P2, mine.id, [], { attachToInstanceId: identityOf(theirs, P2) }))).toBeDefined();
  });
});

describe("54024 / 54025 / 54026: the Energy, Genius and Strength resources pay two of their type", () => {
  for (const [code, label] of [
    [ENERGY, "Energy"],
    [GENIUS, "Genius"],
    [STRENGTH, "Strength"],
  ] as const) {
    it(`${label} alone pays Haymaker's cost of 2; one other card does not`, () => {
      const base = hero({ swap: { [MASK]: HAYMAKER, [WALL]: code } });
      const res = inHand(base, code);
      const haymaker = inHand(res.state, HAYMAKER);
      const other = paying(haymaker.state, haymaker.id, 5).find((i) => i !== res.id)!;
      expect(refusal(haymaker.state, play(P1, haymaker.id, [res.id]))).toBeUndefined();
      expect(refusal(haymaker.state, play(P1, haymaker.id, [other]))).toBeDefined();
      const out = drive(haymaker.state, { targets: [villainOf(haymaker.state)] }, play(P1, haymaker.id, [res.id]));
      expect(damageOn(out.state, villainOf(out.state))).toBe(3);
      expect(discard(out.state)).toContain(res.id);
    });
  }
});

/** The Deputy's removal, as discarding it would: off its host into the owner's discard pile. */
function toDiscardAttachment(s: GameState, id: InstanceId, host: InstanceId): GameState {
  const detached = patchInstance(s, host, { attachments: inst(s, host).attachments.filter((i) => i !== id) });
  const owner = inst(detached, id).ownerId ?? P1;
  return {
    ...patchInstance(detached, id, { attachedTo: null }),
    players: detached.players.map((p) => (p.playerId === owner ? { ...p, discard: [...p.discard, id] } : p)),
  };
}
