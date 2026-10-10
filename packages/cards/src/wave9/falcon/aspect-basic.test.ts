import { FALCON_CARDS, PLAYABLE_CARDS, cardId, trait, type AllyCard, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
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
import { STAR_LORD_KIT } from "../../wave3/stld/star-lord-kit.js";
import { IRONHEART_ALLIES } from "../../wave5/ironheart/allies.js";
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
import { driveEventsPicking } from "../../testing/staging.js";
import { FALCON_ASPECT_BASIC as REGISTRY, FALCON_ASPECT_BASIC_SKIPPED as SKIPPED } from "./aspect-basic.js";
import { ASPECT_DEPS as DEPS, aspectGame, aspectHero } from "./aspect-basic.testing.js";
import { engageMinion, stagedInPlay } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `falcon/aspect-basic`, first half (53014 to 53021), docs/phase7-wave9.md sections 3.43, 3.46, 3.48, 3.52. The
 * Falcon Leadership precon against Core's Rhino. Falcon is ATK 2, THW 2, DEF 2 with 10 hit points in hero form and an
 * Aerial; Sam Wilson (alter ego) is REC 3. Only earlier waves and this module are scripted here, so Falcon's own
 * Eagle-Eyed is inert. The refs of 53018, 53019, 53020 and 53021 are skipped (named in `SKIPPED`).
 */
const ADAM = "53014";
const AERO = "53015";
const CLOUD = "53016";
const HUGIN = "53017";
const SPECTRUM = "53018";
const DIVERSITY = "53019";
const SQUADRON = "53020";
const RESERVE = "53021";
const ENERGY = "53025"; // [energy] resource
const GENIUS = "53026"; // [mental] resource
const STRENGTH = "53027"; // [physical] resource
const REDWING = "53002"; // wild-icon Aerial ally
const SPIDEY_ALLY = "01059"; // Core ally without the Aerial trait
const MERCENARY = "01101"; // minion: 1 boost icon, Guard
const SANDMAN = "01102"; // minion: 2 boost icons
const SHOCKER = "01103"; // minion: 2 boost icons
const MINIONS = new Set([MERCENARY, SANDMAN, SHOCKER]);

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
        return ["decline"];
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
  it("registers exactly these four refs", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([
      "53014.adam-warlock-response",
      "53015.aero-action",
      "53016.cloud-9-action",
      "53017.hugin-and-munin-response",
    ]);
  });
  it("every printed ref of the 19 cards is registered or skipped, none twice", () => {
    const codes = [...Array.from({ length: 15 }, (_, i) => String(53014 + i)), "53034", "53035", "53036", "53037"];
    const printed = codes.flatMap((c) => abilityRefIds(card(c)));
    expect(printed).toHaveLength(Object.keys(REGISTRY).length + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
  });
  it("skips Spectrum, Strength in Diversity, Flight Squadron, Resource Reserve and the second half, each with a reason", () => {
    const first = Object.keys(SKIPPED).filter((r) => /^5301|^5302[01]/.test(r));
    expect(first.sort()).toEqual([
      "53018.spectrum-response",
      "53019.strength-in-diversity-action",
      "53020.flight-squadron-constant",
      "53021.resource-reserve-action",
      "53021.resource-reserve-constant",
    ]);
    expect(SKIPPED["53018.spectrum-response"]).toContain("task 31");
    expect(SKIPPED["53019.strength-in-diversity-action"]).toContain("task 34");
    expect(SKIPPED["53021.resource-reserve-constant"]).toContain("task 32");
    for (const [ref, why] of Object.entries(SKIPPED)) expect(why.length, ref).toBeGreaterThan(10);
    expect(SKIPPED["53022.the-triskelion-constant"]).toBe("second half of the module, not started");
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
  it("the current text is the printed text for every card of the half (no errata)", () => {
    for (let n = 53014; n <= 53021; n++) {
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

describe("the skipped cards stay inert", () => {
  it("Spectrum, Strength in Diversity, Flight Squadron and Resource Reserve have no script in this registry", () => {
    for (const ref of Object.keys(SKIPPED)) expect(REGISTRY[ref], ref).toBeUndefined();
  });
  it("the first player's end-of-turn still works with them in the deck (no ability is registered under their ids)", () => {
    const s = aspectHero();
    expect(refusal(s, endTurn(P1))).toBeUndefined();
  });
});
