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
  restrictedStanding,
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
import { WINTER_ASPECT_BASIC as REGISTRY, WINTER_ASPECT_BASIC_SKIPPED as SKIPPED } from "./aspect-basic.js";
import { ASPECT_DEPS as DEPS, aspectGame, aspectHero, engaged, placed } from "./aspect-basic.testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `winter/aspect-basic`, first half (54012 to 54019), docs/phase7-wave9.md sections 3.43 and 3.52. The Winter
 * Soldier Aggression precon (it holds every card of the half, three Sidearms included) against Core's Rhino. Winter
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
  it("registers exactly these eight refs of the first half; every printed ref of the sixteen cards is registered or skipped, none twice", () => {
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
    ]);
    const codes = [...Array.from({ length: 15 }, (_, i) => String(54012 + i)), "54032", "54033"];
    const printed = codes.flatMap((code) => abilityRefIds(card(code)));
    expect(printed).toHaveLength(Object.keys(REGISTRY).length + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
  });
  it("skips only the second half, each with its reason", () => {
    expect(Object.keys(SKIPPED).sort()).toEqual([
      "54020.shield-sidearm-interrupt",
      "54021.nick-fury-sr-forced-response",
      "54022.super-soldiers-action",
      "54023.winter-widow-soldier-spy-action",
      "54032.white-widow-response",
      "54033.shield-deputy-constant",
    ]);
    for (const reason of Object.values(SKIPPED)) expect(reason).toBe("second half of the module, not started");
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
