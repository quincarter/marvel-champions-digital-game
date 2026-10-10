import { FALCON_CARDS, PLAYABLE_CARDS, cardId, trait, type AllyCard, type AnyCard } from "@mc/content";
import {
  activeAbilityRefs,
  activeEncounterDeckId,
  allyLimitFor,
  applyCommand,
  keywordTotal,
  replay,
  sessionApply,
  startSession,
  statBonus,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import { LEADERSHIP } from "../../core/aspects/leadership.js";
import { STAR_LORD_KIT } from "../../wave3/stld/star-lord-kit.js";
import { IRONHEART_ALLIES } from "../../wave5/ironheart/allies.js";
import { ANGEL_SUPPORT_UPGRADES_ALLIES } from "../../wave7/angel/support-upgrades-allies.js";
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
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import {
  FALCON_ASPECT_BASIC as REGISTRY,
  FALCON_ASPECT_BASIC_SKIPPED as SKIPPED,
  FLIGHT_SQUADRON_GRANTED_RESPONSE as GRANTED,
} from "./aspect-basic.js";
import { ASPECT_DEPS as DEPS, aspectGame, aspectHero, withLinkedShield } from "./aspect-basic.testing.js";
import { engageMinion, stagedInPlay } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `falcon/aspect-basic` (53014 to 53028, 53034 to 53037), docs/phase7-wave9.md sections 3.43, 3.46, 3.48, 3.51,
 * 3.52. The Falcon Leadership precon against Core's Rhino. Falcon is ATK 2, THW 2, DEF 2 with 10 hit points in hero
 * form and an Aerial; Sam Wilson (alter ego) is REC 3. Only earlier waves and this module are scripted here, so
 * Falcon's own Eagle-Eyed is inert. The refs of 53018, 53019 and 53021 are skipped (named in `SKIPPED`).
 */
const ADAM = "53014";
const AERO = "53015";
const CLOUD = "53016";
const HUGIN = "53017";
const SPECTRUM = "53018";
const DIVERSITY = "53019";
const SQUADRON = "53020";
const RESERVE = "53021";
const TRISKELION = "53022";
const CAPTAIN = "53023"; // the Captain America upgrade
const WINGMAN = "53024";
const POWER_OF_FLIGHT = "53028";
const SHIELD = "53034"; // the linked Captain America's Shield
const STEVE_SHIELD = "03009"; // Steve Rogers' own Captain America's Shield
const WINTER = "53035";
const MISTY = "53036";
const OPS_ROOM = "53037";
const ENERGY = "53025"; // [energy] resource
const GENIUS = "53026"; // [mental] resource
const STRENGTH = "53027"; // [physical] resource
const REDWING = "53002"; // wild-icon Aerial ally
const SPIDEY_ALLY = "01059"; // Core ally without the Aerial trait
const MERCENARY = "01101"; // minion: 1 boost icon, Guard
const SANDMAN = "01102"; // minion: 2 boost icons
const SHOCKER = "01103"; // minion: 2 boost icons
const MINIONS = new Set([MERCENARY, SANDMAN, SHOCKER]);
const MARIA_HILL = "01067"; // Core ally without the Aerial trait, cost 2
const WEAPONS_RUNNER = "01121"; // minion: no boost pips and a boost star
const REPAIR_SEQUENCE = "01146"; // treachery: 1 boost pip and a boost star
const NO_ICONS = "01104"; // treachery: no boost icons
const SHIELD_TOSS = "03006"; // Steve Rogers' event, cost 0: "return Captain America's Shield from play to your hand"

const card = <T extends AnyCard>(code: string): T => FALCON_CARDS.find((c) => c.id === cardId(code)) as unknown as T;
type Printed = AnyCard & {
  readonly text: { readonly current: string; readonly printed: string };
  readonly resourceIcons: Readonly<Record<string, number>>;
};
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const refusal = (s: GameState, command: Command): string | undefined => {
  const result = applyCommand(s, command, DEPS);
  return result.ok ? undefined : result.error.message;
};
const deckOf = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const bonus = (s: GameState, id: InstanceId, stat: "atk" | "thw"): number => statBonus(s, DEPS, id, stat);

interface Plan {
  readonly take?: readonly string[];
  readonly targets?: readonly InstanceId[];
  readonly option?: string;
  readonly player?: PlayerId;
  /** The character to declare as the defender of an enemy attack (absent: nobody defends). */
  readonly defender?: InstanceId;
  /** Every prompt shown: its kind, the option ids and the least and most cards it takes. */
  readonly seen?: { kind: string; options: string[]; min: number; max: number }[];
}
const planner = (plan: Plan = {}): Picker => {
  const queue = [...(plan.targets ?? [])];
  return (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    plan.seen?.push({
      kind: choice.prompt.kind,
      options: offered,
      min: choice.minSelections,
      max: choice.maxSelections,
    });
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = offered.find((o) => plan.take?.some((t) => o.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "declareDefender":
        return plan.defender && offered.includes(plan.defender) ? [plan.defender] : ["decline"];
      case "chooseOption": {
        const hit = plan.option ? choice.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId as string] : firstLegal(s);
      }
      case "choosePlayer": {
        const hit = plan.player ? offered.find((o) => o.includes(plan.player!)) : undefined;
        return hit ? [hit] : firstLegal(s);
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
const basicThwart = (scheme: InstanceId, thwarter: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicAttack = (s: GameState, target: InstanceId, attacker: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** The state with the hand of `p` exactly these (printed) cards, brought from the deck or discard pile. */
function withHand(s: GameState, codes: readonly string[], p: PlayerId = P1) {
  const given = moveToHand(s, p, ...codes);
  const ids = given.ids;
  return {
    ids,
    state: {
      ...given.state,
      players: given.state.players.map((x) => (x.playerId === p ? { ...x, hand: [...ids] } : x)),
    },
  };
}
/** Hugin & Munin and two resources in hand, played for 2 (the resources pay). */
function playedHugin(s: GameState, plan: Plan = {}) {
  const given = withHand(s, [HUGIN, ENERGY, GENIUS]);
  const out = drive(given.state, plan, play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]));
  return { ...out, id: given.ids[0]! };
}
/** The encounter deck with `top` first (in that order), the rest after in their order. */
function stacked(s: GameState, top: readonly InstanceId[]): GameState {
  const id = activeEncounterDeckId(s);
  const pile = s.encounterDecks[id]!;
  const rest = pile.deck.filter((i) => !top.includes(i));
  return { ...s, encounterDecks: { ...s.encounterDecks, [id]: { ...pile, deck: [...top, ...rest] } } };
}
/** Deck instances of a code (minion codes) or of any non-minion card, in deck order. */
const minionsIn = (s: GameState, code: string): InstanceId[] => deckOf(s).deck.filter((i) => codeOf(s, i) === code);
const fillerIn = (s: GameState, n: number): InstanceId[] =>
  deckOf(s)
    .deck.filter((i) => !MINIONS.has(codeOf(s, i)))
    .slice(0, n);

describe("registry", () => {
  it("every registered script validates", () => {
    for (const [id, def] of Object.entries(REGISTRY)) expect(validateDefinition(def), id).toEqual([]);
  });
  it("registers exactly these sixteen ids: fifteen printed refs and Flight Squadron's registry-only response", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        "53014.adam-warlock-response",
        "53015.aero-action",
        "53016.cloud-9-action",
        "53017.hugin-and-munin-response",
        "53020.flight-squadron-constant",
        "53020.flight-squadron-granted-response",
        "53022.the-triskelion-constant",
        "53023.captain-america-action",
        "53023.captain-america-constant",
        "53024.wingman-interrupt",
        "53028.the-power-of-flight-constant",
        "53034.captain-americas-shield-constant",
        "53035.winter-soldier-response",
        "53036.misty-knight-interrupt",
        "53037.ops-room-interrupt",
      ].sort(),
    );
    expect(GRANTED).toBe("53020.flight-squadron-granted-response");
  });
  it("every printed ref of the 19 cards is registered or skipped, none twice; the one extra id is registry-only", () => {
    const codes = [...Array.from({ length: 15 }, (_, i) => String(53014 + i)), "53034", "53035", "53036", "53037"];
    const printed = codes.flatMap((c) => abilityRefIds(card(c)));
    expect(printed).not.toContain(GRANTED); // the data lists one ref for Flight Squadron
    expect(printed).toHaveLength(Object.keys(REGISTRY).length - 1 + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
  });
  it("skips Spectrum, Strength in Diversity and Resource Reserve, each with a reason", () => {
    expect(Object.keys(SKIPPED).sort()).toEqual([
      "53018.spectrum-response",
      "53019.strength-in-diversity-action",
      "53021.resource-reserve-action",
      "53021.resource-reserve-constant",
    ]);
    expect(SKIPPED["53018.spectrum-response"]).toContain("task 31");
    expect(SKIPPED["53019.strength-in-diversity-action"]).toContain("task 34");
    expect(SKIPPED["53021.resource-reserve-constant"]).toContain("task 32");
    for (const [ref, why] of Object.entries(SKIPPED)) expect(why.length, ref).toBeGreaterThan(10);
  });
  it("timing words, forms and costs", () => {
    expect(REGISTRY["53014.adam-warlock-response"]).toMatchObject({ trigger: { kind: "response", forced: false } });
    for (const id of ["53015.aero-action", "53016.cloud-9-action"]) {
      expect(REGISTRY[id], id).toMatchObject({
        trigger: { kind: "action", form: "hero" },
        cost: { exhaustSelf: true },
      });
    }
    expect(REGISTRY["53017.hugin-and-munin-response"]).toMatchObject({
      trigger: { kind: "response", forced: false },
    });
  });
  it("Adam Warlock and Cloud 9 alias their sources' scripts; name, cost, stats, traits, icons and text match the sources", () => {
    expect(REGISTRY["53014.adam-warlock-response"]).toBe(STAR_LORD_KIT["17011.adam-warlock-response"]);
    expect(REGISTRY["53016.cloud-9-action"]).toBe(IRONHEART_ALLIES["29014.cloud-9-action"]);
    expect(DEPS.abilities["17011.adam-warlock-response"]).toBe(STAR_LORD_KIT["17011.adam-warlock-response"]);
    expect(DEPS.abilities["29014.cloud-9-action"]).toBe(IRONHEART_ALLIES["29014.cloud-9-action"]);
    for (const [mine, source] of [
      [ADAM, "17011"],
      [CLOUD, "29014"],
    ] as const) {
      const from = PLAYABLE_CARDS.find((c) => c.id === cardId(source)) as unknown as AllyCard & Printed;
      expect(from, source).toBeDefined();
      const it = card<AllyCard & Printed>(mine);
      for (const key of ["name", "subtitle", "cost", "atk", "thw", "hp", "aspect", "unique", "deckLimit"] as const)
        expect(it[key], `${mine} ${key}`).toEqual(from[key]);
      expect(it.text, mine).toEqual(from.text);
      expect(it.traits).toEqual(from.traits);
      expect(it.keywords).toEqual(from.keywords);
      expect(it.resourceIcons).toEqual(from.resourceIcons);
      expect(it.consequentialDamage).toEqual(from.consequentialDamage);
    }
  });
});

describe("printed data", () => {
  it("every ally of the half: unique Leadership Aerial, ATK 1, THW 1, consequential 1/1", () => {
    const rows: [string, number, number, string, number, string[]][] = [
      [ADAM, 3, 3, "physical", 1, ["AERIAL", "MYSTIC"]],
      [AERO, 3, 3, "energy", 1, ["AERIAL", "AGENT OF ATLAS"]],
      [CLOUD, 3, 3, "mental", 1, ["AERIAL", "CHAMPION"]],
      [HUGIN, 2, 2, "energy", 1, ["AERIAL", "ASGARD", "BIRD"]],
      [SPECTRUM, 5, 3, "energy", 1, ["AERIAL", "AVENGER"]],
    ];
    for (const [code, cost, hp, icon, n, traits] of rows) {
      const c = card<AllyCard & Printed>(code);
      expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique], code).toEqual([cost, 1, 1, hp, "leadership", true]);
      expect(c.consequentialDamage, code).toEqual({ attack: 1, thwart: 1 });
      expect(c.resourceIcons, code).toEqual({ [icon]: n });
      expect(c.traits, code).toEqual(traits.map((t) => trait(t)));
      expect(c.keywords, code).toEqual([]);
    }
  });
  it("Strength in Diversity: Alliance event, cost 2 per player, [wild]; Flight Squadron: Team support, cost 2, [physical]", () => {
    const e = card<Printed & { cost: number; costPerPlayer?: boolean; aspect: string; keywords: unknown[] }>(DIVERSITY);
    expect([e.cost, e.costPerPlayer, e.aspect, e.resourceIcons]).toEqual([2, true, "leadership", { wild: 1 }]);
    expect(e.keywords).toEqual([{ name: "alliance" }]);
    const f = card<Printed & { cost: number; traits: unknown[]; playRestrictions: unknown }>(SQUADRON);
    expect([f.cost, f.traits, f.resourceIcons]).toEqual([2, [trait("TEAM")], { physical: 1 }]);
    expect(f.playRestrictions).toEqual({
      requiresIdentityTrait: trait("AERIAL"),
      maxWithTrait: { trait: trait("TEAM"), per: "player", max: 1 },
    });
  });
  it("Resource Reserve: Location support, cost 1, [physical], max 1 per player", () => {
    const r = card<Printed & { cost: number; traits: unknown[]; playRestrictions: unknown }>(RESERVE);
    expect([r.cost, r.traits, r.resourceIcons, r.playRestrictions]).toEqual([
      1,
      [trait("LOCATION")],
      { physical: 1 },
      { maxPerPlayer: 1 },
    ]);
  });
  it("the current text is the printed text for every card of the module (no errata)", () => {
    for (const n of [...Array.from({ length: 15 }, (_, i) => 53014 + i), 53034, 53035, 53036, 53037]) {
      const c = card<Printed>(String(n));
      expect(c.text.current, String(n)).toBe(c.text.printed);
    }
  });
});

describe("53015.aero-action and 53016.cloud-9-action: exhaust, choose a player, their Aerial characters get +1 until the end of the phase", () => {
  const cases = [
    { code: AERO, id: "53015.aero-action", stat: "atk", other: "thw" },
    { code: CLOUD, id: "53016.cloud-9-action", stat: "thw", other: "atk" },
  ] as const;
  for (const { code, id, stat, other } of cases) {
    describe(id, () => {
      it(`exhausts as the cost; she and Falcon (an Aerial identity) get +1 ${stat.toUpperCase()}, and not +1 ${other.toUpperCase()}`, () => {
        const s = aspectHero();
        const ally = stagedInPlay(s, code);
        expect(bonus(ally.state, ally.id, stat)).toBe(0);
        const out = drive(ally.state, undefined, use(P1, ally.id, id));
        expect(inst(out.state, ally.id).exhausted).toBe(true);
        expect(bonus(out.state, ally.id, stat)).toBe(1);
        expect(bonus(out.state, identityOf(out.state), stat)).toBe(1);
        expect(bonus(out.state, ally.id, other)).toBe(0);
        expect(bonus(out.state, identityOf(out.state), other)).toBe(0);
      });
      it("every Aerial character of that player counts (a second Aerial ally), a non-Aerial ally does not", () => {
        const s = aspectHero({ swap: { "53003": SPIDEY_ALLY } });
        const a = stagedInPlay(s, code);
        const redwing = stagedInPlay(a.state, REDWING);
        const plain = stagedInPlay(redwing.state, SPIDEY_ALLY);
        const out = drive(plain.state, undefined, use(P1, a.id, id));
        expect(bonus(out.state, redwing.id, stat)).toBe(1);
        expect(bonus(out.state, plain.id, stat)).toBe(0);
      });
      it("the chosen player is the other player: P1's Aerial characters get nothing, the other seat's non-Aerial hero neither", () => {
        const s = aspectHero({ second: true });
        const a = stagedInPlay(s, code);
        const seen: NonNullable<Plan["seen"]> = [];
        const out = drive(a.state, { player: P2, seen }, use(P1, a.id, id));
        expect(seen.some((p) => p.kind === "choosePlayer")).toBe(true);
        expect(inst(out.state, a.id).exhausted).toBe(true); // the cost is paid either way
        expect(bonus(out.state, a.id, stat)).toBe(0);
        expect(bonus(out.state, identityOf(out.state), stat)).toBe(0);
        expect(bonus(out.state, identityOf(out.state, P2), stat)).toBe(0);
      });
      it("choosing yourself with another seat in the game gives +1 to your Aerials only", () => {
        const s = aspectHero({ second: true });
        const a = stagedInPlay(s, code);
        const out = drive(a.state, { player: P1 }, use(P1, a.id, id));
        expect(bonus(out.state, a.id, stat)).toBe(1);
        expect(bonus(out.state, identityOf(out.state, P2), stat)).toBe(0);
      });
      it("lasts until the end of the phase: gone once the player phase is over", () => {
        const a = stagedInPlay(aspectHero(), code);
        const out = drive(a.state, undefined, use(P1, a.id, id));
        expect(bonus(out.state, a.id, stat)).toBe(1);
        const later = drive(out.state, undefined, endTurn(P1)).state;
        expect(later.round).toBeGreaterThan(out.state.round); // the phase, and the round, are over
        expect(bonus(later, a.id, stat)).toBe(0);
      });
      it("a Hero Action: refused in alter-ego form, and refused while exhausted", () => {
        const a = stagedInPlay(aspectGame(), code);
        expect(refusal(a.state, use(P1, a.id, id))).toBeDefined();
        const tired = stagedInPlay(aspectHero(), code);
        const spent = patchInstance(tired.state, tired.id, { exhausted: true });
        expect(refusal(spent, use(P1, tired.id, id))).toBeDefined();
        expect(refusal(tired.state, use(P1, tired.id, id))).toBeUndefined();
      });
    });
  }
  it("Aero's bonus is ATK and a basic attack by Aero deals the extra damage: 1 + 1 = 2 to the villain", () => {
    const a = stagedInPlay(aspectHero(), AERO);
    const villain = a.state.activeVillainId!;
    // Aero exhausts to use her ability, so Falcon (ATK 2 + 1) attacks instead.
    const out = drive(a.state, undefined, use(P1, a.id, "53015.aero-action"));
    const before = inst(out.state, villain).damage;
    const hit = drive(out.state, undefined, basicAttack(out.state, villain, identityOf(out.state)));
    expect(inst(hit.state, villain).damage - before).toBe(3);
  });
});

describe("53014.adam-warlock-response: after Adam Warlock attacks, discard a random card; its printed resource decides", () => {
  const ID = "53014.adam-warlock-response";
  /** Adam attacks the villain with `held` as his controller's whole hand. */
  function attacked(held: readonly string[], plan: Plan = {}, prep: (s: GameState) => GameState = (s) => s) {
    const adam = stagedInPlay(aspectHero(), ADAM);
    const given = withHand(adam.state, held);
    const staged = prep(given.state);
    const villain = staged.activeVillainId!;
    const out = drive(staged, { take: [ID], ...plan }, basicAttack(staged, villain, adam.id));
    return { ...out, adam: adam.id, held: given.ids, villain, before: staged };
  }
  const threat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
  it("a [physical] card: it is discarded and 3 threat is removed from the main scheme", () => {
    const out = attacked([STRENGTH], {}, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 5 }));
    expect(playerOf(out.state, P1).hand).toEqual([]);
    expect(playerOf(out.state, P1).discard).toContain(out.held[0]);
    expect(threat(out.state)).toBe(2);
  });
  it("a [physical] card with only 2 threat on the scheme removes 2 and no more", () => {
    const out = attacked([STRENGTH], {}, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 2 }));
    expect(threat(out.state)).toBe(0);
  });
  it("an [energy] card: 3 damage is healed from the chosen identity (5 on Falcon becomes 2)", () => {
    const out = attacked([ENERGY], {}, (s) => patchInstance(s, identityOf(s), { damage: 5 }));
    expect(inst(out.state, identityOf(out.state)).damage).toBe(2);
    expect(playerOf(out.state, P1).discard).toContain(out.held[0]);
  });
  it("a [mental] card: 3 damage to an enemy, on top of the 1 from Adam's attack", () => {
    const out = attacked([GENIUS]);
    // Adam's ATK is 1; Rhino has no defense. 1 from the attack and 3 from the response.
    expect(inst(out.state, out.villain).damage).toBe(4);
  });
  it("a [wild] card: the player chooses one of the three effects (here the heal: 4 damage on Falcon becomes 1)", () => {
    const out = attacked([REDWING], { option: "Heal 3" }, (s) => patchInstance(s, identityOf(s), { damage: 4 }));
    expect(inst(out.state, identityOf(out.state)).damage).toBe(1);
    expect(inst(out.state, out.villain).damage).toBe(1); // only the attack's own damage
  });
  it("a [wild] card and the second option: 3 threat removed instead, no heal", () => {
    const out = attacked([REDWING], { option: "Remove 3" }, (s) =>
      patchInstance(patchInstance(s, s.mainScheme.instanceId, { threat: 4 }), identityOf(s), { damage: 4 }),
    );
    expect(threat(out.state)).toBe(1);
    expect(inst(out.state, identityOf(out.state)).damage).toBe(4);
  });
  it("an empty hand: the response discards nothing and does nothing else", () => {
    const out = attacked([], {}, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 5 }));
    expect(threat(out.state)).toBe(5);
    expect(inst(out.state, out.villain).damage).toBe(1);
  });
  it("declined, the card stays in hand and nothing happens", () => {
    const out = attacked([STRENGTH], { take: [] }, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 5 }));
    expect(playerOf(out.state, P1).hand).toEqual(out.held);
    expect(threat(out.state)).toBe(5);
  });
  it("only a card of the hand is discarded at random: with two cards exactly one leaves", () => {
    const out = attacked([STRENGTH, ENERGY]);
    expect(playerOf(out.state, P1).hand).toHaveLength(1);
  });
});

describe("53017.hugin-and-munin-response: search the top 10 of the encounter deck for a minion, put it into play engaged with you, ready 1 character per icon", () => {
  const ID = "53017.hugin-and-munin-response";
  /** A game with `minion` at position `at` (1-based) of the encounter deck, behind non-minion cards. */
  function withMinionAt(code: string, at: number, extra: Readonly<Record<number, string>> = {}) {
    const s = aspectHero();
    const minion = minionsIn(s, code)[0]!;
    const filler = fillerIn(s, 12);
    const order: InstanceId[] = [];
    let fill = 0;
    for (let i = 1; i <= 11; i++) {
      if (i === at) order.push(minion);
      else if (extra[i]) order.push(minionsIn(s, extra[i]!).find((m) => !order.includes(m))!);
      else order.push(filler[fill++]!);
    }
    return { state: stacked(s, order), minion };
  }
  const tired = (s: GameState, ...ids: InstanceId[]) =>
    ids.reduce((acc, id) => patchInstance(acc, id, { exhausted: true }), s);

  it("a 1-icon minion first in the deck: it is put into play engaged with you and 1 character is readied", () => {
    const g = withMinionAt(MERCENARY, 1);
    const ally = stagedInPlay(g.state, AERO);
    const base = tired(ally.state, identityOf(ally.state), ally.id);
    const out = playedHugin(base, { take: [ID], targets: [identityOf(base)] });
    expect(playerOf(out.state, P1).playArea).toContain(g.minion);
    expect(inst(out.state, g.minion).engagedWith).toBe(P1);
    expect(deckOf(out.state).deck).not.toContain(g.minion);
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
    expect(inst(out.state, ally.id).exhausted).toBe(true); // exactly 1 readied
  });
  it("a 2-icon minion: 2 characters are readied, one choice each", () => {
    const g = withMinionAt(SANDMAN, 1);
    const ally = stagedInPlay(g.state, AERO);
    const base = tired(ally.state, identityOf(ally.state), ally.id);
    const seen: NonNullable<Plan["seen"]> = [];
    const out = playedHugin(base, { take: [ID], targets: [identityOf(base), ally.id], seen });
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
    expect(inst(out.state, ally.id).exhausted).toBe(false);
    expect(seen.filter((p) => p.kind === "chooseTarget")).toHaveLength(2);
  });
  it("a 2-icon minion with the new ally not a target choice: Hugin & Munin enter ready and stay ready", () => {
    const g = withMinionAt(SHOCKER, 1);
    const ally = stagedInPlay(g.state, AERO);
    const base = tired(ally.state, identityOf(ally.state), ally.id);
    const out = playedHugin(base, { take: [ID], targets: [identityOf(base), ally.id] });
    expect(inst(out.state, out.id).exhausted).toBe(false); // Hugin & Munin enter ready and were not a target
  });
  it("the same character may be chosen for both icons (RRG 'For Each')", () => {
    const g = withMinionAt(SANDMAN, 1);
    const ally = stagedInPlay(g.state, AERO);
    const base = tired(ally.state, identityOf(ally.state), ally.id);
    const out = playedHugin(base, { take: [ID], targets: [identityOf(base), identityOf(base)] });
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
    expect(inst(out.state, ally.id).exhausted).toBe(true);
  });
  it("the 10th card is in reach: a minion there is found; the 11th is not", () => {
    const tenth = withMinionAt(MERCENARY, 10);
    const found = playedHugin(tenth.state, { take: [ID] });
    expect(inst(found.state, tenth.minion).engagedWith).toBe(P1);
    const eleventh = withMinionAt(MERCENARY, 11);
    const missed = playedHugin(eleventh.state, { take: [ID] });
    expect(playerOf(missed.state, P1).playArea).not.toContain(eleventh.minion);
    expect(deckOf(missed.state).deck).toContain(eleventh.minion);
  });
  it("no minion in the top 10: nothing is put into play, nothing readied, the deck is unchanged and Hugin & Munin stay in play", () => {
    const s = aspectHero();
    const top = stacked(s, fillerIn(s, 10));
    const base = tired(top, identityOf(top));
    const before = deckOf(base).deck;
    const out = playedHugin(base, { take: [ID] });
    expect(deckOf(out.state).deck).toEqual(before);
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(true);
    expect(playerOf(out.state, P1).playArea).toContain(out.id);
  });
  it("the search is compulsory when a minion is there: the prompt takes exactly 1 card", () => {
    const g = withMinionAt(MERCENARY, 4);
    const seen: NonNullable<Plan["seen"]> = [];
    playedHugin(g.state, { take: [ID], seen });
    const search = seen.find((p) => p.kind === "chooseCards")!;
    expect(search.options).toEqual([g.minion]);
    expect([search.min, search.max]).toEqual([1, 1]);
  });
  it("only minions are offered, only from the top 10, and with several the player picks: Sandman (2) over the Mercenary (1)", () => {
    const g = withMinionAt(MERCENARY, 3, { 5: SANDMAN, 11: SHOCKER });
    const sandman = deckOf(g.state).deck[4]!;
    const seen: NonNullable<Plan["seen"]> = [];
    const base = tired(g.state, identityOf(g.state));
    const out = playedHugin(base, { take: [ID], targets: [sandman], seen });
    const search = seen.find((p) => p.kind === "chooseCards")!;
    expect(search.options.sort()).toEqual([g.minion, sandman].sort());
    expect(playerOf(out.state, P1).playArea).toContain(sandman);
    expect(deckOf(out.state).deck).toContain(g.minion);
    expect(deckOf(out.state).deck).toHaveLength(deckOf(base).deck.length - 1);
  });
  it("the other cards keep their order: the search does not shuffle the encounter deck", () => {
    const g = withMinionAt(MERCENARY, 3);
    const before = deckOf(g.state).deck.filter((i) => i !== g.minion);
    const out = playedHugin(g.state, { take: [ID] });
    expect(deckOf(out.state).deck).toEqual(before);
  });
  it("declined, no minion enters play", () => {
    const g = withMinionAt(MERCENARY, 1);
    const out = playedHugin(g.state, {});
    expect(playerOf(out.state, P1).playArea).not.toContain(g.minion);
    expect(deckOf(out.state).deck[0]).toBe(g.minion);
  });
  it("engaged with the player who played him, not another seat", () => {
    const g = withMinionAt(MERCENARY, 1);
    const two = aspectHero({ second: true });
    const minion = minionsIn(two, MERCENARY)[0]!;
    const out = playedHugin(stacked(two, [minion]), { take: [ID] });
    expect(g.minion).toBeDefined();
    expect(inst(out.state, minion).engagedWith).toBe(P1);
    expect(playerOf(out.state, P2).playArea).not.toContain(minion);
  });
  it("works in alter-ego form as well (Sam Wilson is readied)", () => {
    const s = aspectGame();
    const minion = minionsIn(s, MERCENARY)[0]!;
    const base = patchInstance(stacked(s, [minion]), identityOf(s), { exhausted: true });
    const out = playedHugin(base, { take: [ID], targets: [identityOf(base)] });
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
  });
  it("the boost icons are read from the printed minion: a minion engaged beforehand does not change the count", () => {
    const g = withMinionAt(MERCENARY, 1);
    const withOther = engageMinion(g.state, SANDMAN, "m-before");
    const ally = stagedInPlay(withOther, AERO);
    const base = tired(ally.state, identityOf(ally.state), ally.id);
    const out = playedHugin(base, { take: [ID], targets: [identityOf(base), ally.id] });
    expect(inst(out.state, identityOf(out.state)).exhausted).toBe(false);
    expect(inst(out.state, ally.id).exhausted).toBe(true); // 1 icon of the Mercenary, not 2
    expect(ofType(out.events, "cardPlayed").length).toBeGreaterThan(0);
  });
});

/** The same state with it being `p`'s turn (the player phase hands the turn from one seat to the next). */
const turnOf = (s: GameState, p: PlayerId): GameState => ({
  ...s,
  step: { phase: "player", kind: "turn", activePlayerId: p, remainingPlayerIds: [] } as GameState["step"],
});
/** Hands `id` (a card of P1) to `to`, as owner and controller: for a play-restriction test on another seat. */
function handedTo(s: GameState, id: InstanceId, to: PlayerId): GameState {
  const moved = patchInstance(s, id, { ownerId: to, controllerId: to });
  return {
    ...moved,
    players: moved.players.map((p) =>
      p.playerId === P1
        ? { ...p, hand: p.hand.filter((i) => i !== id), deck: p.deck.filter((i) => i !== id) }
        : p.playerId === to
          ? { ...p, hand: [...p.hand, id] }
          : p,
    ),
  };
}
/** `id` (any card, in a hand or set aside) put on `host` as an upgrade controlled by `controller`, faceup and ready. */
function placedOn(s: GameState, id: InstanceId, host: InstanceId, controller: PlayerId = P1): GameState {
  const without = (zone: readonly InstanceId[]) => zone.filter((i) => i !== id);
  const off: GameState = {
    ...s,
    encounterSetAside: without(s.encounterSetAside),
    players: s.players.map((p) => ({
      ...p,
      hand: without(p.hand),
      deck: without(p.deck),
      discard: without(p.discard),
    })),
  };
  const placed = patchInstance(off, id, { faceup: true, controllerId: controller, attachedTo: host });
  return patchInstance(placed, host, { attachments: [...placed.instances[host]!.attachments, id] });
}
/** A copy of the linked shield 53034 (owned by `P1`) on `host`: a second one beside the one `withLinkedShield` sets aside. */
function shieldOn(s: GameState, host: InstanceId): { readonly state: GameState; readonly id: InstanceId } {
  const extra = withLinkedShield(s, "shield-in-play");
  return { id: extra.id, state: placedOn(patchInstance(extra.state, extra.id, { ownerId: P1 }), extra.id, host) };
}
/** The first copy of `code` (from hand, deck or discard) attached to `host`, faceup and ready, controlled by P1. */
function stagedOn(
  s: GameState,
  code: string,
  host: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(s, P1, code);
  return { id: given.ids[0]!, state: placedOn(given.state, given.ids[0]!, host) };
}
const printedHp = (code: string): number =>
  (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as unknown as { hp: number }).hp;
const alliesInPlay = (s: GameState, p: PlayerId = P1): InstanceId[] =>
  playerOf(s, p).playArea.filter((i) => REGISTRY && (card(codeOf(s, i)) as AnyCard | undefined)?.type === "ally");

describe("printed data of the second half", () => {
  it("The Triskelion: unique Leadership Location S.H.I.E.L.D. support, cost 1, [energy]", () => {
    const c = card<Printed & { cost: number; unique: boolean; aspect: string; traits: unknown[] }>(TRISKELION);
    expect([c.type, c.cost, c.unique, c.aspect, c.resourceIcons]).toEqual([
      "support",
      1,
      true,
      "leadership",
      { energy: 1 },
    ]);
    expect(c.traits).toEqual([trait("LOCATION"), trait("S.H.I.E.L.D.")]);
  });
  it("Captain America: unique Leadership Title upgrade, cost 0, [physical]", () => {
    const c = card<Printed & { cost: number; unique: boolean; aspect: string; traits: unknown[] }>(CAPTAIN);
    expect([c.type, c.cost, c.unique, c.aspect, c.resourceIcons, c.traits]).toEqual([
      "upgrade",
      0,
      true,
      "leadership",
      { physical: 1 },
      [trait("TITLE")],
    ]);
  });
  it("Wingman: Leadership Title upgrade, cost 0, [mental], attaches to an Aerial ally, max 1 per ally", () => {
    const c = card<
      Printed & { cost: number; aspect: string; traits: unknown[]; attachesTo: unknown; playRestrictions: unknown }
    >(WINGMAN);
    expect([c.type, c.cost, c.aspect, c.resourceIcons, c.traits]).toEqual([
      "upgrade",
      0,
      "leadership",
      { mental: 1 },
      [trait("TITLE")],
    ]);
    expect(c.attachesTo).toEqual({ kind: "qualified", category: "ally", trait: trait("AERIAL") });
    expect(c.playRestrictions).toEqual({ maxPerHost: 1 });
  });
  it("Energy, Genius and Strength: basic resources worth 2 of their icon, no ability; The Power of Flight worth 1 [energy]", () => {
    const rows: [string, Record<string, number>][] = [
      [ENERGY, { energy: 2 }],
      [GENIUS, { mental: 2 }],
      [STRENGTH, { physical: 2 }],
      [POWER_OF_FLIGHT, { energy: 1 }],
    ];
    for (const [code, icons] of rows) {
      const c = card<AnyCard & { aspect: string; producesIcons: unknown; traits: unknown[] }>(code);
      expect([c.type, c.aspect, c.producesIcons, c.traits], code).toEqual(["resource", "basic", icons, []]);
    }
    for (const code of [ENERGY, GENIUS, STRENGTH]) expect(abilityRefIds(card(code)), code).toEqual([]);
  });
  it("Captain America's Shield: unique Leadership Item upgrade, cost 1, [wild], Linked (Captain America upgrade) and Restricted", () => {
    const c = card<Printed & { cost: number; unique: boolean; aspect: string; traits: unknown[]; keywords: unknown[] }>(
      SHIELD,
    );
    expect([c.type, c.cost, c.unique, c.aspect, c.resourceIcons, c.traits]).toEqual([
      "upgrade",
      1,
      true,
      "leadership",
      { wild: 1 },
      [trait("ITEM")],
    ]);
    expect(c.keywords).toEqual([{ name: "linked", cardTitle: "Captain America upgrade" }, { name: "restricted" }]);
  });
  it("Winter Soldier (Bucky Barnes): unique Aggression S.H.I.E.L.D. Soldier ally, cost 3, ATK 2, THW 1, 3 HP, consequential 1/1, [mental]", () => {
    const c = card<AllyCard & Printed>(WINTER);
    expect([c.subtitle, c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique, c.resourceIcons, c.keywords]).toEqual([
      "Bucky Barnes",
      3,
      2,
      1,
      3,
      "aggression",
      true,
      { mental: 1 },
      [],
    ]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits).toEqual([trait("S.H.I.E.L.D."), trait("SOLDIER")]);
  });
  it("Misty Knight: unique Justice Hero for Hire ally, cost 4, ATK 1, THW 1, 3 HP, consequential 1/1, [physical]", () => {
    const c = card<AllyCard & Printed>(MISTY);
    expect([c.cost, c.atk, c.thw, c.hp, c.aspect, c.unique, c.resourceIcons, c.keywords]).toEqual([
      4,
      1,
      1,
      3,
      "justice",
      true,
      { physical: 1 },
      [],
    ]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits).toEqual([trait("HERO FOR HIRE")]);
  });
  it("Ops Room: Protection S.H.I.E.L.D. support, cost 2, [energy], Uses (3 alert counters), three copies", () => {
    const c = card<
      Printed & {
        cost: number;
        unique: boolean;
        aspect: string;
        traits: unknown[];
        keywords: unknown[];
        deckLimit: number;
      }
    >(OPS_ROOM);
    expect([c.cost, c.unique, c.aspect, c.resourceIcons, c.traits, c.deckLimit]).toEqual([
      2,
      false,
      "protection",
      { energy: 1 },
      [trait("S.H.I.E.L.D.")],
      3,
    ]);
    expect(c.keywords).toEqual([{ name: "uses", count: 3, counterType: "alert" }]);
  });
});

describe("timing words and aliases of the second half", () => {
  it("each ability is the timing its text prints", () => {
    expect(REGISTRY["53020.flight-squadron-constant"]).toMatchObject({ trigger: { kind: "constant" } });
    expect(REGISTRY[GRANTED]).toMatchObject({
      trigger: { kind: "response", forced: false },
      cost: { exhaustSelf: true },
    });
    expect(REGISTRY["53023.captain-america-constant"]).toMatchObject({ trigger: { kind: "constant" } });
    expect(REGISTRY["53023.captain-america-action"]).toMatchObject({
      trigger: { kind: "action", form: "hero" },
      cost: { exhaustSelf: true },
    });
    expect(REGISTRY["53024.wingman-interrupt"]).toMatchObject({ trigger: { kind: "interrupt", forced: false } });
    expect(REGISTRY["53035.winter-soldier-response"]).toMatchObject({ trigger: { kind: "response", forced: false } });
    expect(REGISTRY["53036.misty-knight-interrupt"]).toMatchObject({ trigger: { kind: "interrupt", forced: false } });
    expect(REGISTRY["53037.ops-room-interrupt"]).toMatchObject({ trigger: { kind: "interrupt", forced: false } });
    expect(REGISTRY["53034.captain-americas-shield-constant"]).toMatchObject({ trigger: { kind: "constant" } });
  });
  it("The Triskelion and The Power of Flight alias their sources' scripts; name, cost, traits, icons and text match 01073 and 42022", () => {
    expect(REGISTRY["53022.the-triskelion-constant"]).toBe(LEADERSHIP["01073.the-triskelion-constant"]);
    expect(REGISTRY["53028.the-power-of-flight-constant"]).toBe(
      ANGEL_SUPPORT_UPGRADES_ALLIES["42022.the-power-of-flight-constant"],
    );
    expect(DEPS.abilities["01073.the-triskelion-constant"]).toBe(LEADERSHIP["01073.the-triskelion-constant"]);
    expect(DEPS.abilities["42022.the-power-of-flight-constant"]).toBe(
      ANGEL_SUPPORT_UPGRADES_ALLIES["42022.the-power-of-flight-constant"],
    );
    for (const [mine, source] of [
      [TRISKELION, "01073"],
      [POWER_OF_FLIGHT, "42022"],
    ] as const) {
      const from = PLAYABLE_CARDS.find((c) => c.id === cardId(source)) as unknown as Printed & Record<string, unknown>;
      expect(from, source).toBeDefined();
      const it = card<Printed & Record<string, unknown>>(mine);
      for (const key of ["type", "name", "cost", "aspect", "unique", "deckLimit", "producesIcons", "resourceIcons"])
        expect(it[key], `${mine} ${key}`).toEqual(from[key]);
      expect(it.text, mine).toEqual(from.text);
      expect(it.traits).toEqual(from.traits);
      expect(it.keywords).toEqual(from.keywords);
    }
  });
});

describe("53022.the-triskelion-constant: increase your ally limit by 1", () => {
  it("with The Triskelion in play the limit is 4, without it 3", () => {
    const s = aspectHero();
    expect(allyLimitFor(s, DEPS, P1)).toBe(3);
    const t = stagedInPlay(s, TRISKELION);
    expect(allyLimitFor(t.state, DEPS, P1)).toBe(4);
  });
});

describe("53028.the-power-of-flight-constant: double the resources it generates while paying for an Aerial card", () => {
  /** Hand: `held` (a resource worth 1 per copy), then the card to play; plays `play` paying with the first `n` cards. */
  function played(target: string, n: number, extra: Readonly<Record<string, string>> = {}) {
    return withHand(aspectHero({ swap: { "53003": MARIA_HILL, ...extra } }), [
      target,
      ...Array.from({ length: n }, () => POWER_OF_FLIGHT),
    ]);
  }
  it("one copy pays 2 for an Aerial ally of cost 2 (Hugin & Munin)", () => {
    const given = played(HUGIN, 1);
    const out = drive(given.state, undefined, play(P1, given.ids[0]!, [given.ids[1]!]));
    expect(playerOf(out.state, P1).playArea).toContain(given.ids[0]!);
    expect(playerOf(out.state, P1).discard).toContain(given.ids[1]!);
  });
  it("one copy pays only 1 for a card that is not Aerial: Maria Hill (cost 2) is refused, then paid with two copies", () => {
    const one = played(MARIA_HILL, 1);
    expect(refusal(one.state, play(P1, one.ids[0]!, [one.ids[1]!]))).toBeDefined();
    const two = played(MARIA_HILL, 2);
    expect(refusal(two.state, play(P1, two.ids[0]!, [two.ids[1]!, two.ids[2]!]))).toBeUndefined();
  });
  it("one copy cannot pay for an Aerial card of cost 3 (Aero): 2 resources", () => {
    const given = played(AERO, 1);
    expect(refusal(given.state, play(P1, given.ids[0]!, [given.ids[1]!]))).toBeDefined();
    const two = played(AERO, 2);
    expect(refusal(two.state, play(P1, two.ids[0]!, [two.ids[1]!, two.ids[2]!]))).toBeUndefined();
  });
});

describe("53020.flight-squadron-constant: if each of your allies has the Aerial trait, increase your ally limit by 1", () => {
  const limit = (s: GameState) => allyLimitFor(s, DEPS, P1);
  it("with Flight Squadron and no ally the limit is 4 (each of zero allies is Aerial); without the card it is 3", () => {
    const s = aspectHero();
    expect(limit(s)).toBe(3);
    expect(limit(stagedInPlay(s, SQUADRON).state)).toBe(4);
  });
  it("only Aerial allies: 4, and it stays 4 with three of them", () => {
    let s = stagedInPlay(aspectHero(), SQUADRON).state;
    for (const code of [AERO, CLOUD, REDWING]) s = stagedInPlay(s, code).state;
    expect(alliesInPlay(s)).toHaveLength(3);
    expect(limit(s)).toBe(4);
  });
  it("one non-Aerial ally among Aerial ones: 3", () => {
    let s = stagedInPlay(aspectHero({ swap: { "53003": MARIA_HILL } }), SQUADRON).state;
    s = stagedInPlay(s, AERO).state;
    expect(limit(s)).toBe(4);
    s = stagedInPlay(s, MARIA_HILL).state;
    expect(limit(s)).toBe(3);
  });
  it("only allies you control count: another seat's non-Aerial ally does not lower your limit", () => {
    let s = stagedInPlay(aspectHero({ second: true, swap: { "53003": MARIA_HILL } }), SQUADRON).state;
    const maria = stagedInPlay(s, MARIA_HILL);
    s = patchInstance(maria.state, maria.id, { controllerId: P2 });
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== maria.id) }
          : { ...p, playArea: [...p.playArea, maria.id] },
      ),
    };
    expect(limit(s)).toBe(4);
  });
  it("a fourth Aerial ally can be played with all four kept (the limit is 4)", () => {
    let s = stagedInPlay(aspectHero(), SQUADRON).state;
    for (const code of [AERO, CLOUD, REDWING]) s = stagedInPlay(s, code).state;
    const given = withHand(s, [HUGIN, ENERGY, GENIUS]);
    const out = drive(given.state, undefined, play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]));
    expect(alliesInPlay(out.state)).toHaveLength(4);
    expect(out.state.pendingChoice).toBeFalsy();
  });
  it("without the card the same fourth ally forces one out (the limit is 3)", () => {
    let s = aspectHero();
    for (const code of [AERO, CLOUD, REDWING]) s = stagedInPlay(s, code).state;
    const given = withHand(s, [HUGIN, ENERGY, GENIUS]);
    const out = drive(given.state, undefined, play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]));
    expect(alliesInPlay(out.state)).toHaveLength(3);
  });
});

describe("53020.flight-squadron-granted-response (registry-only): after you play an Aerial card, exhaust this card -> ready an ally you control", () => {
  /** The real card data: 53020 lists its constant alone, whose `gainsAbility` rule gives the card the response. */
  const game = (swap: Readonly<Record<string, string>> = {}) => aspectHero({ swap });
  const live = (s: GameState, id: InstanceId) => activeAbilityRefs(s, id, DEPS).map((ref) => ref.id as string);
  /** Squadron and an exhausted Redwing in play, then Aero played from hand (an Aerial ally). */
  function afterPlaying(code: string, s0: GameState, plan: Plan = {}) {
    const squadron = stagedInPlay(s0, SQUADRON);
    const tired = stagedInPlay(squadron.state, REDWING);
    const exhausted = patchInstance(tired.state, tired.id, { exhausted: true });
    const given = withHand(exhausted, [code, ENERGY, GENIUS]);
    const out = drive(
      given.state,
      { take: [GRANTED], ...plan },
      play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]),
    );
    return { ...out, squadron: squadron.id, redwing: tired.id, played: given.ids[0]! };
  }
  it("is registered, validates, and is granted to the card by its constant under the ally limit's condition", () => {
    expect(validateDefinition(REGISTRY[GRANTED]!)).toEqual([]);
    expect(REGISTRY[GRANTED]).toMatchObject({ trigger: { kind: "response", forced: false } });
    const constant = REGISTRY["53020.flight-squadron-constant"] as unknown as {
      trigger: { rules: { kind: string; while: unknown; abilityId?: string; to?: unknown }[] };
    };
    const [limit, grant] = constant.trigger.rules;
    expect(limit).toMatchObject({ kind: "allyLimit", amount: 1 });
    expect(grant).toMatchObject({ kind: "gainsAbility", abilityId: GRANTED });
    expect(grant!.to).toBeUndefined(); // "this card gains"
    expect(grant!.while).toBeDefined();
    expect(grant!.while).toEqual(limit!.while);
  });
  it("on the real data the card lists one ref and has both abilities in play; out of play, or with a non-Aerial ally, only its own", () => {
    expect(abilityRefIds(card(SQUADRON))).toEqual(["53020.flight-squadron-constant"]);
    const squadron = stagedInPlay(game({ "53003": MARIA_HILL }), SQUADRON);
    expect(live(squadron.state, squadron.id)).toEqual(["53020.flight-squadron-constant", GRANTED]);
    const aero = stagedInPlay(squadron.state, AERO);
    expect(live(aero.state, squadron.id)).toContain(GRANTED);
    const maria = stagedInPlay(aero.state, MARIA_HILL);
    expect(live(maria.state, squadron.id)).toEqual(["53020.flight-squadron-constant"]);
    // A copy still in the deck gains nothing.
    const inDeck = playerOf(game(), P1).deck.find((i) => codeOf(game(), i) === SQUADRON)!;
    expect(live(game(), inDeck)).not.toContain(GRANTED);
  });
  it("only Aerial allies: playing an Aerial card offers it; taking it exhausts Flight Squadron and readies the chosen ally", () => {
    const s = game();
    const out = afterPlaying(AERO, s, { targets: [] });
    expect(out.events.length).toBeGreaterThan(0);
    expect(inst(out.state, out.squadron).exhausted).toBe(true);
    expect(inst(out.state, out.redwing).exhausted).toBe(false); // the first legal ally is Redwing, the only exhausted one
  });
  it("the ally to ready is the player's choice among allies they control", () => {
    const s = game();
    const squadron = stagedInPlay(s, SQUADRON);
    const aero = stagedInPlay(squadron.state, AERO);
    const cloud = stagedInPlay(aero.state, CLOUD);
    const both = patchInstance(patchInstance(cloud.state, aero.id, { exhausted: true }), cloud.id, { exhausted: true });
    const given = withHand(both, [HUGIN, ENERGY, GENIUS]);
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(
      given.state,
      { take: [GRANTED], targets: [cloud.id], seen },
      play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]),
    );
    const pick = seen.find((p) => p.kind === "chooseTarget" && p.options.includes(cloud.id))!;
    expect(pick.options).toContain(aero.id);
    expect(pick.options).not.toContain(identityOf(given.state));
    expect(inst(out.state, cloud.id).exhausted).toBe(false);
    expect(inst(out.state, aero.id).exhausted).toBe(true);
  });
  it("one non-Aerial ally in play: the response is not offered", () => {
    const s = game({ "53003": MARIA_HILL });
    const withMaria = stagedInPlay(s, MARIA_HILL);
    const out = afterPlaying(AERO, withMaria.state, { seen: [] });
    const seen: NonNullable<Plan["seen"]> = [];
    afterPlaying(AERO, withMaria.state, { seen });
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(GRANTED)))).toBe(false);
    expect(inst(out.state, out.squadron).exhausted).toBe(false);
    expect(inst(out.state, out.redwing).exhausted).toBe(true);
  });
  it("a card that is not Aerial: not offered", () => {
    const seen: NonNullable<Plan["seen"]> = [];
    const out = afterPlaying(TRISKELION, game(), { seen, targets: [] });
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(GRANTED)))).toBe(false);
    expect(inst(out.state, out.squadron).exhausted).toBe(false);
  });
  it("declined: nothing is exhausted or readied", () => {
    const out = afterPlaying(AERO, game(), { take: [] });
    expect(inst(out.state, out.squadron).exhausted).toBe(false);
    expect(inst(out.state, out.redwing).exhausted).toBe(true);
  });
  it("an exhausted Flight Squadron cannot pay: not offered", () => {
    const s = game();
    const squadron = stagedInPlay(s, SQUADRON);
    const spent = patchInstance(squadron.state, squadron.id, { exhausted: true });
    const given = withHand(spent, [AERO, ENERGY, GENIUS]);
    const seen: NonNullable<Plan["seen"]> = [];
    drive(given.state, { take: [GRANTED], seen }, play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]));
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(GRANTED)))).toBe(false);
  });
  it("Flight Squadron leaving play takes the response with it: not offered for the next Aerial card", () => {
    const s = game();
    const squadron = stagedInPlay(s, SQUADRON);
    const gone: GameState = {
      ...squadron.state,
      players: squadron.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== squadron.id), discard: [squadron.id, ...p.discard] }
          : p,
      ),
    };
    const given = withHand(gone, [AERO, ENERGY, GENIUS]);
    const seen: NonNullable<Plan["seen"]> = [];
    drive(given.state, { take: [GRANTED], seen }, play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]));
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(GRANTED)))).toBe(false);
    expect(live(given.state, squadron.id)).not.toContain(GRANTED);
  });
  it("a game that takes the response replays from its log to the same state", () => {
    const squadron = stagedInPlay(game(), SQUADRON);
    const tired = stagedInPlay(squadron.state, REDWING);
    const given = withHand(patchInstance(tired.state, tired.id, { exhausted: true }), [AERO, ENERGY, GENIUS]);
    let session = startSession(given.state);
    const apply = (command: Command) => {
      const result = sessionApply(session, command, DEPS);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    };
    apply(play(P1, given.ids[0]!, [given.ids[1]!, given.ids[2]!]));
    const pick = planner({ take: [GRANTED], targets: [tired.id] });
    while (session.state.pendingChoice) {
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      });
    }
    expect(inst(session.state, squadron.id).exhausted).toBe(true);
    expect(inst(session.state, tired.id).exhausted).toBe(false);
    const replayed = replay(session.log, DEPS);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});

describe("53023.captain-america-constant: play only if you are the Bucky Barnes or Sam Wilson player", () => {
  it("Falcon's player may play it in hero form, and in alter-ego form as Sam Wilson", () => {
    for (const make of [aspectHero, aspectGame]) {
      const given = withHand(make(), [CAPTAIN]);
      expect(
        refusal(given.state, play(P1, given.ids[0]!, [], { attachToInstanceId: identityOf(given.state) })),
      ).toBeUndefined();
    }
  });
  it("the Winter Soldier player (Bucky Barnes) may play it", () => {
    const s = aspectHero({ bucky: true });
    const given = withHand(s, [CAPTAIN]);
    const mine = turnOf(handedTo(given.state, given.ids[0]!, P2), P2);
    expect(refusal(mine, play(P2, given.ids[0]!, [], { attachToInstanceId: identityOf(mine, P2) }))).toBeUndefined();
  });
  it("any other identity cannot: Spider-Man's player is refused", () => {
    const s = aspectHero({ second: true });
    const given = withHand(s, [CAPTAIN]);
    const theirs = turnOf(handedTo(given.state, given.ids[0]!, P2), P2);
    expect(refusal(theirs, play(P2, given.ids[0]!, [], { attachToInstanceId: identityOf(theirs, P2) }))).toBeDefined();
  });
});

describe("53023.captain-america-action: exhaust and spend a [physical] resource -> find Captain America's Shield, add it to your hand; if it leaves play this way, deal 4 damage to an enemy", () => {
  const ID = "53023.captain-america-action";
  /** Falcon (hero) with the upgrade in play, the linked shield set aside, a [physical] resource and a wild one in hand. */
  function ready(opts: Parameters<typeof aspectHero>[0] = {}) {
    const linked = withLinkedShield(aspectHero(opts));
    const cap = stagedInPlay(linked.state, CAPTAIN, { attach: true });
    const given = withHand(cap.state, [STRENGTH, GENIUS, REDWING]);
    return {
      state: given.state,
      cap: cap.id,
      linked: linked.id,
      strength: given.ids[0]!,
      genius: given.ids[1]!,
      wild: given.ids[2]!,
    };
  }
  const villainDamage = (s: GameState) => inst(s, s.activeVillainId!).damage;
  it("the cost is exhausting the upgrade and a [physical] resource; the linked shield goes to your hand, owned and controlled by you", () => {
    const g = ready();
    const out = drive(g.state, undefined, use(P1, g.cap, ID, [{ fromHand: g.strength }]));
    expect(inst(out.state, g.cap).exhausted).toBe(true);
    expect(playerOf(out.state, P1).discard).toContain(g.strength);
    expect(playerOf(out.state, P1).hand).toContain(g.linked);
    expect(out.state.encounterSetAside).not.toContain(g.linked);
    expect([inst(out.state, g.linked).ownerId, inst(out.state, g.linked).controllerId]).toEqual([P1, P1]);
    expect(villainDamage(out.state)).toBe(0); // it did not leave play
  });
  it("a [mental] resource does not pay; a [wild] one does", () => {
    const g = ready();
    expect(refusal(g.state, use(P1, g.cap, ID, [{ fromHand: g.genius }]))).toBeDefined();
    expect(refusal(g.state, use(P1, g.cap, ID, []))).toBeDefined();
    expect(refusal(g.state, use(P1, g.cap, ID, [{ fromHand: g.wild }]))).toBeUndefined();
  });
  it("a Hero Action: refused in alter-ego form and while exhausted", () => {
    const g = ready();
    const alter = stagedInPlay(withLinkedShield(aspectGame()).state, CAPTAIN, { attach: true });
    const given = withHand(alter.state, [STRENGTH]);
    expect(refusal(given.state, use(P1, alter.id, ID, [{ fromHand: given.ids[0]! }]))).toBeDefined();
    const tired = patchInstance(g.state, g.cap, { exhausted: true });
    expect(refusal(tired, use(P1, g.cap, ID, [{ fromHand: g.strength }]))).toBeDefined();
  });
  it("without a shield anywhere (none set aside) there is nothing to find: the ability cannot be used and no cost is paid", () => {
    const cap = stagedInPlay(aspectHero(), CAPTAIN, { attach: true });
    const given = withHand(cap.state, [STRENGTH]);
    expect(refusal(given.state, use(P1, cap.id, ID, [{ fromHand: given.ids[0]! }]))).toBeDefined();
  });
  it("the shield is found once chosen: the prompt takes exactly 1 card and offers the one copy", () => {
    const g = ready();
    const seen: NonNullable<Plan["seen"]> = [];
    drive(g.state, { seen }, use(P1, g.cap, ID, [{ fromHand: g.strength }]));
    const pick = seen.find((p) => p.kind === "chooseCards")!;
    expect(pick.options).toEqual([g.linked]);
    expect([pick.min, pick.max]).toEqual([1, 1]);
  });
  it("a shield found in play leaves play: it goes to your hand and 4 damage is dealt to the enemy you choose", () => {
    const g = ready();
    const shield = shieldOn(g.state, identityOf(g.state));
    // The linked copy set aside is also a candidate; the player picks the one in play.
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(shield.state, { targets: [shield.id], seen }, use(P1, g.cap, ID, [{ fromHand: g.strength }]));
    expect(seen.find((p) => p.kind === "chooseCards")!.options.sort()).toEqual([g.linked, shield.id].sort());
    expect(playerOf(out.state, P1).hand).toContain(shield.id);
    expect(inst(out.state, shield.id).attachedTo).toBeNull();
    expect(inst(out.state, identityOf(out.state)).attachments).not.toContain(shield.id);
    expect(villainDamage(out.state)).toBe(4);
    expect(out.state.encounterSetAside).toContain(g.linked); // the other copy stays where it was
  });
  it("the same shield chosen while set aside deals no damage", () => {
    const g = ready();
    const shield = shieldOn(g.state, identityOf(g.state));
    const out = drive(shield.state, { targets: [g.linked] }, use(P1, g.cap, ID, [{ fromHand: g.strength }]));
    expect(playerOf(out.state, P1).hand).toContain(g.linked);
    expect(villainDamage(out.state)).toBe(0);
  });
  it("the 4 damage goes to an enemy of the player's choice: a minion engaged with them", () => {
    const g = ready();
    const shield = shieldOn(g.state, identityOf(g.state));
    const withMinion = engageMinion(shield.state, MERCENARY, "m-target");
    const minion = "m-target" as InstanceId;
    const out = drive(withMinion, { targets: [shield.id, minion] }, use(P1, g.cap, ID, [{ fromHand: g.strength }]));
    // 4 damage defeats the 3-hit-point Mercenary; the villain, who could have been chosen, took none.
    expect(
      ofType(out.events, "damageDealt")
        .filter((e) => e.targetInstanceId === minion)
        .map((e) => e.amount),
    ).toEqual([4]);
    expect(playerOf(out.state, P1).playArea).not.toContain(minion);
    expect(villainDamage(out.state)).toBe(0);
  });
});

describe("ruling June 25, 2026 - Ruling 1: Falcon with the Captain America upgrade and Steve Rogers in the game", () => {
  const ID = "53023.captain-america-action";
  const toss = (s: GameState) => playerOf(s, P2).hand.find((i) => codeOf(s, i) === SHIELD_TOSS)!;
  const withToss = (s: GameState) => moveToHand(s, P2, SHIELD_TOSS).state;
  const steveShield = (s: GameState) => playerOf(s, P2).hand.find((i) => codeOf(s, i) === STEVE_SHIELD)!;
  /** Both players in hero form, Falcon holding the upgrade and a [physical] resource; Steve's shield in his hand. */
  function table() {
    const base = withForm(withLinkedShield(aspectHero({ steve: true })).state, { heroForm: 0 }, P2);
    const cap = stagedInPlay(base, CAPTAIN, { attach: true });
    const given = withHand(cap.state, [STRENGTH]);
    return { state: given.state, cap: cap.id, strength: given.ids[0]! };
  }
  /** Falcon takes Steve's shield (not the linked copy) into his hand, then plays it on his own identity. */
  function falconHoldsSteveShield() {
    const t = table();
    const stolen = steveShield(t.state);
    const taken = drive(t.state, { targets: [stolen] }, use(P1, t.cap, ID, [{ fromHand: t.strength }]));
    const paid = moveToHand(taken.state, P1, GENIUS); // a resource to pay the shield's cost 1 with
    const pay = paid.state;
    const payId = paid.ids[0]!;
    const shieldId = stolen;
    return { t, taken, pay, payId, shieldId };
  }
  it("(1) Falcon takes Steve's shield into his own hand, and it is still Steve's card", () => {
    const { taken, shieldId } = falconHoldsSteveShield();
    expect(playerOf(taken.state, P1).hand).toContain(shieldId);
    expect(playerOf(taken.state, P2).hand).not.toContain(shieldId);
    expect(inst(taken.state, shieldId).ownerId).toBe(P2);
    expect(inst(taken.state, shieldId).controllerId).toBe(P1);
  });
  it("(1) Falcon plays it under his control: attached to Falcon, owned by Steve, and it gives Falcon +1 DEF and retaliate 1 (Steve gets nothing)", () => {
    const { pay, payId, shieldId } = falconHoldsSteveShield();
    const played = drive(pay, undefined, play(P1, shieldId, [payId], { attachToInstanceId: identityOf(pay) }));
    expect(inst(played.state, shieldId).attachedTo).toBe(identityOf(played.state));
    expect([inst(played.state, shieldId).ownerId, inst(played.state, shieldId).controllerId]).toEqual([P2, P1]);
    expect(statBonus(played.state, DEPS, identityOf(played.state), "def")).toBe(1);
    expect(keywordTotal(played.state, identityOf(played.state), "retaliate", DEPS)).toBe(1);
    expect(statBonus(played.state, DEPS, identityOf(played.state, P2), "def")).toBe(0);
    expect(keywordTotal(played.state, identityOf(played.state, P2), "retaliate", DEPS)).toBe(0);
  });
  it("(1) if it is discarded it returns to Steve's discard pile", () => {
    const { t, taken, shieldId } = falconHoldsSteveShield();
    // Adam Warlock's response discards a random card from Falcon's hand; the shield is the only card there.
    const alone: GameState = {
      ...taken.state,
      players: taken.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [shieldId] } : p)),
    };
    const adam = stagedInPlay(alone, ADAM);
    const villain = adam.state.activeVillainId!;
    const out = drive(adam.state, { take: ["53014.adam-warlock-response"] }, basicAttack(adam.state, villain, adam.id));
    expect(playerOf(out.state, P1).hand).toEqual([]);
    expect(playerOf(out.state, P1).discard).not.toContain(shieldId);
    expect(playerOf(out.state, P2).discard).toContain(shieldId);
    expect(t.cap).toBeDefined();
  });
  it("(2) Steve cannot pay Shield Toss with the shield under Falcon's control, and can with his own", () => {
    const own = table();
    const tossed = withToss(own.state);
    const tossId = toss(tossed);
    // Steve controls his own shield in play: Shield Toss is playable.
    const steveHolds = turnOf(placedOn(tossed, steveShield(tossed), identityOf(own.state, P2), P2), P2);
    expect(refusal(steveHolds, play(P2, tossId))).toBeUndefined();
    // Falcon takes the shield and plays it: Shield Toss is refused for Steve, whose hand and play area lack the shield.
    const { pay, payId, shieldId } = falconHoldsSteveShield();
    const played = drive(
      withToss(pay),
      undefined,
      play(P1, shieldId, [payId], { attachToInstanceId: identityOf(pay) }),
    );
    expect(inst(played.state, shieldId).controllerId).toBe(P1);
    expect(refusal(turnOf(played.state, P2), play(P2, toss(played.state)))).toBeDefined();
  });
});

describe("53024.wingman-interrupt: when another Aerial ally would take consequential damage, exhaust attached ally -> prevent 1 of that damage", () => {
  const ID = "53024.wingman-interrupt";
  /** Aero wears Wingman; Cloud 9 is the other Aerial ally; Cloud 9 attacks the villain and takes 1 consequential damage. */
  function table(swap: Readonly<Record<string, string>> = {}) {
    const s = aspectHero({ swap });
    const aero = stagedInPlay(s, AERO);
    const cloud = stagedInPlay(aero.state, CLOUD);
    const wing = stagedOn(cloud.state, WINGMAN, aero.id);
    return { state: wing.state, aero: aero.id, cloud: cloud.id, wing: wing.id };
  }
  const attack = (g: { state: GameState }, attacker: InstanceId, plan: Plan = { take: [ID] }) =>
    drive(g.state, plan, basicAttack(g.state, g.state.activeVillainId!, attacker));
  it("prevents the 1 consequential damage and exhausts the attached ally", () => {
    const g = table();
    const out = attack(g, g.cloud);
    expect(inst(out.state, g.cloud).damage).toBe(0);
    expect(inst(out.state, g.aero).exhausted).toBe(true);
  });
  it("declined: the ally takes the 1 damage and nothing is exhausted", () => {
    const g = table();
    const out = attack(g, g.cloud, { take: [] });
    expect(inst(out.state, g.cloud).damage).toBe(1);
    expect(inst(out.state, g.aero).exhausted).toBe(false);
  });
  it("consequential damage from a thwart is prevented too", () => {
    const g = table();
    const main = g.state.mainScheme.instanceId;
    const state = patchInstance(g.state, main, { threat: 4 });
    const out = drive(state, { take: [ID] }, basicThwart(main, g.cloud));
    expect(inst(out.state, main).threat).toBe(3);
    expect(inst(out.state, g.cloud).damage).toBe(0);
    expect(inst(out.state, g.aero).exhausted).toBe(true);
  });
  it("not offered for the attached ally's own damage: 'another' Aerial ally", () => {
    const g = table();
    const seen: NonNullable<Plan["seen"]> = [];
    const out = attack(g, g.aero, { take: [ID], seen });
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
    expect(inst(out.state, g.aero).damage).toBe(1);
    expect(inst(out.state, g.aero).exhausted).toBe(true); // exhausted by its own basic attack, not by Wingman
  });
  it("not offered for a non-Aerial ally's consequential damage", () => {
    const s = aspectHero({ swap: { "53003": MARIA_HILL } });
    const aero = stagedInPlay(s, AERO);
    const maria = stagedInPlay(aero.state, MARIA_HILL);
    const wing = stagedOn(maria.state, WINGMAN, aero.id);
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(wing.state, { take: [ID], seen }, basicAttack(wing.state, wing.state.activeVillainId!, maria.id));
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
    expect(inst(out.state, maria.id).damage).toBe(1);
    expect(inst(out.state, aero.id).exhausted).toBe(false);
  });
  it("not offered while the attached ally is exhausted (it cannot pay)", () => {
    const g = table();
    const tired = patchInstance(g.state, g.aero, { exhausted: true });
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(tired, { take: [ID], seen }, basicAttack(tired, tired.activeVillainId!, g.cloud));
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
    expect(inst(out.state, g.cloud).damage).toBe(1);
  });
  it("not offered for damage that is not consequential: the villain's attack on an Aerial defender", () => {
    const g = table();
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(g.state, { take: [ID], defender: g.cloud, seen }, endTurn(P1));
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
    expect(inst(out.state, g.cloud).damage).toBeGreaterThan(0);
  });
  it("two Wingmen on two allies: the other ally's own Wingman can answer, the attacked ally's cannot", () => {
    const g = table();
    const second = stagedOn(g.state, WINGMAN, g.cloud);
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(
      second.state,
      { take: [ID], seen },
      basicAttack(second.state, second.state.activeVillainId!, g.cloud),
    );
    const offered = seen.filter((p) => p.kind === "chooseTriggers");
    expect(offered.flatMap((p) => p.options).filter((o) => o.endsWith(ID))).toHaveLength(1); // Aero's, not Cloud 9's own
    expect(inst(out.state, g.cloud).damage).toBe(0);
  });
});

describe("53035.winter-soldier-response: after Winter Soldier attacks and defeats an enemy, remove 2 threat from a scheme", () => {
  const ID = "53035.winter-soldier-response";
  const MINION = "m-win" as InstanceId;
  /** Winter Soldier in play, the main scheme at `threat`, a Hydra Mercenary engaged with `hp` hit points left. */
  function table(threat: number, left: number) {
    const s = aspectHero({ swap: { "53003": WINTER } });
    const w = stagedInPlay(s, WINTER);
    const m = engageMinion(w.state, MERCENARY, "m-win");
    const hp = printedHp(MERCENARY);
    const hurt = patchInstance(patchInstance(m, MINION, { damage: hp - left }), m.mainScheme.instanceId, { threat });
    return { state: hurt, w: w.id, main: m.mainScheme.instanceId };
  }
  it("a defeat: 2 threat is removed from the main scheme", () => {
    const g = table(5, 2);
    const out = drive(g.state, { take: [ID] }, basicAttack(g.state, MINION, g.w));
    expect(playerOf(out.state, P1).playArea).not.toContain(MINION);
    expect(inst(out.state, g.main).threat).toBe(3);
  });
  it("only what is there: 1 threat on the scheme removes 1", () => {
    const g = table(1, 2);
    const out = drive(g.state, { take: [ID] }, basicAttack(g.state, MINION, g.w));
    expect(inst(out.state, g.main).threat).toBe(0);
  });
  it("the scheme is the player's choice: the prompt offers the main scheme", () => {
    const g = table(5, 2);
    const seen: NonNullable<Plan["seen"]> = [];
    drive(g.state, { take: [ID], targets: [g.main], seen }, basicAttack(g.state, MINION, g.w));
    expect(seen.some((p) => p.kind === "chooseTarget" && p.options.includes(g.main))).toBe(true);
  });
  it("the enemy survives (3 hit points left, ATK 2): no response, no threat removed", () => {
    const g = table(5, 3);
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(g.state, { take: [ID], seen }, basicAttack(g.state, MINION, g.w));
    expect(seen.some((p) => p.kind === "chooseTriggers")).toBe(false);
    expect(inst(out.state, MINION).damage).toBe(printedHp(MERCENARY) - 3 + 2);
    expect(inst(out.state, g.main).threat).toBe(5);
  });
  it("exactly lethal: 2 hit points left against ATK 2 still defeats", () => {
    const g = table(5, 2);
    const out = drive(g.state, { take: [ID] }, basicAttack(g.state, MINION, g.w));
    expect(inst(out.state, g.main).threat).toBe(3);
  });
  it("declined: the enemy is defeated and the threat stays", () => {
    const g = table(5, 2);
    const out = drive(g.state, { take: [] }, basicAttack(g.state, MINION, g.w));
    expect(playerOf(out.state, P1).playArea).not.toContain(MINION);
    expect(inst(out.state, g.main).threat).toBe(5);
  });
  it("another character's defeat is not his: Falcon defeats the minion and Winter Soldier is not asked", () => {
    const g = table(5, 2);
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(g.state, { take: [ID], seen }, basicAttack(g.state, MINION, identityOf(g.state)));
    expect(playerOf(out.state, P1).playArea).not.toContain(MINION);
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
    expect(inst(out.state, g.main).threat).toBe(5);
  });
  it("he takes 1 consequential damage from the attack", () => {
    const g = table(5, 2);
    const out = drive(g.state, { take: [ID] }, basicAttack(g.state, MINION, g.w));
    expect(inst(out.state, g.w).damage).toBe(1);
  });
});

describe("53036.misty-knight-interrupt: when Misty Knight thwarts, look at the top 2 encounter cards, discard 1; she gets +1 THW per icon in its boost area", () => {
  const ID = "53036.misty-knight-interrupt";
  const thwart = (s: GameState, misty: InstanceId): Command => basicThwart(s.mainScheme.instanceId, misty);
  const top = (s: GameState) => deckOf(s).deck.map((i) => codeOf(s, i));
  /** Misty in play, the main scheme at 8 threat, the encounter deck stacked with `codes` on top. */
  function table(...codes: string[]) {
    const s = aspectHero({ swap: { "53003": MISTY } });
    const m = stagedInPlay(s, MISTY);
    const stack = codes.map((code) => deckOf(m.state).deck.find((i) => codeOf(m.state, i) === code)!);
    const staged = patchInstance(stacked(m.state, stack), m.state.mainScheme.instanceId, { threat: 8 });
    return { state: staged, misty: m.id, ids: stack };
  }
  const threat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
  it("discards the chosen card of the top 2 and removes THW + its icons: Sandman (2) over the Mercenary (1) is 1 + 2 = 3", () => {
    const g = table(MERCENARY, SANDMAN);
    const out = drive(g.state, { take: [ID], targets: [g.ids[1]!] }, thwart(g.state, g.misty));
    expect(threat(out.state)).toBe(5);
    expect(deckOf(out.state).discard).toContain(g.ids[1]);
    expect(deckOf(out.state).deck[0]).toBe(g.ids[0]); // the other stays on top
    expect(deckOf(out.state).deck).toHaveLength(deckOf(g.state).deck.length - 1);
  });
  it("the other choice: the Mercenary (1 icon) is 1 + 1 = 2", () => {
    const g = table(MERCENARY, SANDMAN);
    const out = drive(g.state, { take: [ID], targets: [g.ids[0]!] }, thwart(g.state, g.misty));
    expect(threat(out.state)).toBe(6);
    expect(deckOf(out.state).deck[0]).toBe(g.ids[1]);
  });
  it("a card with no icons adds nothing: 1", () => {
    const g = table(NO_ICONS, MERCENARY);
    const out = drive(g.state, { take: [ID], targets: [g.ids[0]!] }, thwart(g.state, g.misty));
    expect(threat(out.state)).toBe(7);
  });
  it("a boost star counts as an icon: Weapons Runner (0 pips, 1 star) adds 1", () => {
    const g = table(MERCENARY, SANDMAN);
    const star = patchInstance(g.state, g.ids[1]!, { cardId: cardId(WEAPONS_RUNNER) });
    const out = drive(star, { take: [ID], targets: [g.ids[1]!] }, thwart(star, g.misty));
    expect(threat(out.state)).toBe(6);
  });
  it("pips and a star both count: Repair Sequence (1 pip, 1 star) adds 2", () => {
    const g = table(MERCENARY, SANDMAN);
    const both = patchInstance(g.state, g.ids[1]!, { cardId: cardId(REPAIR_SEQUENCE) });
    const out = drive(both, { take: [ID], targets: [g.ids[1]!] }, thwart(both, g.misty));
    expect(threat(out.state)).toBe(5);
  });
  it("the discard is compulsory and only the top 2 are offered", () => {
    const g = table(MERCENARY, SANDMAN, SHOCKER);
    const seen: NonNullable<Plan["seen"]> = [];
    drive(g.state, { take: [ID], seen }, thwart(g.state, g.misty));
    const look = seen.find((p) => p.kind === "chooseCards")!;
    expect(look.options.sort()).toEqual([g.ids[0], g.ids[1]].sort());
    expect([look.min, look.max]).toEqual([1, 1]);
  });
  it("declined: nothing is looked at or discarded, and her basic thwart removes 1", () => {
    const g = table(MERCENARY, SANDMAN);
    const before = top(g.state);
    const out = drive(g.state, { take: [] }, thwart(g.state, g.misty));
    expect(threat(out.state)).toBe(7);
    expect(top(out.state)).toEqual(before);
  });
  it("only her own thwart: Falcon's thwart does not offer it", () => {
    const g = table(MERCENARY, SANDMAN);
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(g.state, { take: [ID], seen }, thwart(g.state, identityOf(g.state)));
    expect(seen.some((p) => p.kind === "chooseTriggers")).toBe(false);
    expect(threat(out.state)).toBe(6); // Falcon's THW 2
  });
  it("the bonus is for this thwart only: her next thwart in the round removes 1 again (after exhausting, readied)", () => {
    const g = table(NO_ICONS, SANDMAN, MERCENARY);
    const first = drive(g.state, { take: [ID], targets: [g.ids[1]!] }, thwart(g.state, g.misty));
    expect(threat(first.state)).toBe(5);
    expect(bonus(first.state, g.misty, "thw")).toBe(0);
  });
  it("she takes 1 consequential damage after the thwart", () => {
    const g = table(MERCENARY, SANDMAN);
    const out = drive(g.state, { take: [ID], targets: [g.ids[1]!] }, thwart(g.state, g.misty));
    expect(inst(out.state, g.misty).damage).toBe(1);
  });
});

describe("53037.ops-room-interrupt: when a friendly character would take damage while defending, remove 1 alert counter -> prevent 1 of that damage and remove 1 threat from a scheme", () => {
  const ID = "53037.ops-room-interrupt";
  const hero = (swap: Readonly<Record<string, string>> = {}) => aspectHero({ swap: { "53003": OPS_ROOM, ...swap } });
  /** Ops Room (3 counters) and Aero in play. */
  function table() {
    const room = stagedInPlay(hero(), OPS_ROOM, { counters: { alert: 3 } });
    const aero = stagedInPlay(room.state, AERO);
    return { state: aero.state, room: room.id, aero: aero.id };
  }
  const threat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
  it("played for 2 it enters with 3 alert counters", () => {
    const given = withHand(hero(), [OPS_ROOM, ENERGY]);
    const out = drive(given.state, undefined, play(P1, given.ids[0]!, [given.ids[1]!]));
    expect(inst(out.state, given.ids[0]!).counters.alert).toBe(3);
  });
  it("an ally defends: it takes 1 less damage, a counter is removed and 1 threat leaves the main scheme", () => {
    const g = table();
    const used = drive(g.state, { take: [ID], defender: g.aero }, endTurn(P1));
    const refused = drive(g.state, { take: [], defender: g.aero }, endTurn(P1));
    expect(inst(refused.state, g.aero).damage).toBeGreaterThan(0);
    expect(inst(refused.state, g.aero).damage - inst(used.state, g.aero).damage).toBe(1);
    expect(inst(used.state, g.room).counters.alert).toBe(2);
    expect(inst(refused.state, g.room).counters.alert).toBe(3);
    expect(threat(refused.state) - threat(used.state)).toBe(1);
  });
  it("undefended attack: Falcon takes the damage and Ops Room is not offered", () => {
    const g = table();
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(g.state, { take: [ID], seen }, endTurn(P1));
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
    expect(inst(out.state, g.room).counters.alert).toBe(3);
  });
  it("a defending hero whose DEF absorbs the whole attack (ATK 2, DEF 2) takes no damage: nothing to prevent, not offered", () => {
    const g = table();
    const seen: NonNullable<Plan["seen"]> = [];
    const out = drive(g.state, { take: [ID], defender: identityOf(g.state), seen }, endTurn(P1));
    // Falcon exhausts defending the first attack, so the second is undefended and not "while defending".
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
    expect(inst(out.state, g.room).counters.alert).toBe(3);
  });
  it("a defending hero who would take damage is protected too: a 2-icon boost makes it 2, one is prevented", () => {
    const g = table();
    const boost = minionsIn(g.state, SANDMAN)[0]!;
    const rigged = stacked(g.state, [boost]);
    const used = drive(rigged, { take: [ID], defender: identityOf(rigged) }, endTurn(P1));
    const declined = drive(rigged, { take: [], defender: identityOf(rigged) }, endTurn(P1));
    const falcon = identityOf(rigged);
    expect(inst(declined.state, falcon).damage - inst(used.state, falcon).damage).toBe(1);
    expect(inst(used.state, g.room).counters.alert).toBe(2);
    expect(inst(used.state, rigged.mainScheme.instanceId).threat).toBe(
      inst(declined.state, rigged.mainScheme.instanceId).threat - 1,
    );
  });
  it("the last counter removed discards the card (RRG Uses)", () => {
    const room = stagedInPlay(hero(), OPS_ROOM, { counters: { alert: 1 } });
    const aero = stagedInPlay(room.state, AERO);
    const out = drive(aero.state, { take: [ID], defender: aero.id }, endTurn(P1));
    expect(playerOf(out.state, P1).playArea).not.toContain(room.id);
    expect(playerOf(out.state, P1).discard).toContain(room.id);
  });
  it("with no counter left it is not offered", () => {
    const room = stagedInPlay(hero(), OPS_ROOM, { counters: { alert: 0 } });
    const aero = stagedInPlay(room.state, AERO);
    const seen: NonNullable<Plan["seen"]> = [];
    drive(aero.state, { take: [ID], defender: aero.id, seen }, endTurn(P1));
    expect(seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.endsWith(ID)))).toBe(false);
  });
  it("declined: no counter is removed, no threat leaves and the full damage is taken", () => {
    const g = table();
    const out = drive(g.state, { take: [], defender: g.aero }, endTurn(P1));
    expect(inst(out.state, g.room).counters.alert).toBe(3);
  });
});

describe("53034.captain-americas-shield-constant: your hero gets +1 DEF and gains retaliate 1", () => {
  const worn = (s: GameState) => stagedInPlay(s, SHIELD, { attach: true });
  const withShield = (state: GameState) => {
    const linked = withLinkedShield(state);
    return placedOn(patchInstance(linked.state, linked.id, { ownerId: P1 }), linked.id, identityOf(linked.state));
  };
  it("in hero form: +1 DEF and retaliate 1", () => {
    const s = withShield(aspectHero());
    expect(statBonus(s, DEPS, identityOf(s), "def")).toBe(1);
    expect(keywordTotal(s, identityOf(s), "retaliate", DEPS)).toBe(1);
  });
  it("without it: no bonus and no retaliate", () => {
    const s = aspectHero();
    expect(statBonus(s, DEPS, identityOf(s), "def")).toBe(0);
    expect(keywordTotal(s, identityOf(s), "retaliate", DEPS)).toBe(0);
  });
  it("in alter-ego form there is no hero: nothing", () => {
    const s = withShield(aspectGame());
    expect(statBonus(s, DEPS, identityOf(s), "def")).toBe(0);
    expect(keywordTotal(s, identityOf(s), "retaliate", DEPS)).toBe(0);
  });
  it("another player's hero gets nothing from your shield", () => {
    const s = withShield(aspectHero({ second: true }));
    const other = withForm(s, { heroForm: 0 }, P2);
    expect(statBonus(other, DEPS, identityOf(other, P2), "def")).toBe(0);
    expect(keywordTotal(other, identityOf(other, P2), "retaliate", DEPS)).toBe(0);
  });
  it("the villain attacks Falcon undefended: each attack draws retaliate 1, 1 damage to the villain, and none without the shield", () => {
    const out = drive(withShield(aspectHero()), undefined, endTurn(P1));
    const base = drive(aspectHero(), undefined, endTurn(P1));
    const attacks = ofType(out.events, "attackResolved").length;
    expect(attacks).toBeGreaterThan(0);
    const hits = ofType(out.events, "damageDealt").filter(
      (e) => e.targetInstanceId === out.state.activeVillainId && e.sourceInstanceId === identityOf(out.state),
    );
    expect(hits.map((e) => e.amount)).toEqual(Array.from({ length: attacks }, () => 1));
    expect(inst(out.state, out.state.activeVillainId!).damage).toBe(attacks);
    expect(inst(base.state, base.state.activeVillainId!).damage).toBe(0);
  });
  it("is the same effect as Steve Rogers' shield 03009 (cost 1, [wild], Restricted)", () => {
    expect(worn).toBeDefined();
    const mine = card<Printed & { cost: number }>(SHIELD);
    const steve = PLAYABLE_CARDS.find((c) => c.id === cardId(STEVE_SHIELD)) as unknown as Printed & { cost: number };
    expect([mine.cost, mine.resourceIcons]).toEqual([steve.cost, steve.resourceIcons]);
  });
});

describe("the linked shield at setup", () => {
  it.todo(
    "a Falcon deck holding the Captain America upgrade 53023 has 53034 set aside outside the deck: setup.ts linkedCardsByTitle matches the keyword's title 'Captain America upgrade' against card names, and 53023 is named 'Captain America' (content or engine)",
  );
});

describe("the skipped cards stay inert", () => {
  it("Spectrum, Strength in Diversity and Resource Reserve have no script in this registry", () => {
    for (const ref of Object.keys(SKIPPED)) expect(REGISTRY[ref], ref).toBeUndefined();
  });
  it("the first player's end-of-turn still works with them in the deck (no ability is registered under their ids)", () => {
    const s = aspectHero();
    expect(refusal(s, endTurn(P1))).toBeUndefined();
  });
});
