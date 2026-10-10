import {
  AOS_CARDS,
  cardId,
  type AllyCard,
  type EventCard,
  type ResourceCard,
  type SupportCard,
  type AnyCard,
} from "@mc/content";
import { type GameState, type InstanceId, type PlayerId } from "@mc/engine";
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
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { AOS_ASPECT_BASIC as REGISTRY, AOS_ASPECT_BASIC_SKIPPED as SKIPPED } from "./aspect-basic.js";
import { ASPECT_DEPS as DEPS, aspectGame, engaged, placed } from "./aspect-basic.testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 9 `aos/aspect-basic`, first half (50012 to 50028), docs/phase7-wave9.md sections 3.6, 3.7, 3.10, 3.35. The printed
 * precon `maria-hill-leadership` (it holds every card of the half) against Rhino; Maria Hill's identity module is live
 * (she gives her allies the S.H.I.E.L.D. trait).
 */
type WithAbilities = AnyCard & { readonly abilities: readonly { readonly id: string }[] };
const card = <T extends AnyCard>(code: string): T => AOS_CARDS.find((c) => c.id === cardId(code)) as unknown as T;
const hero = (opts: Parameters<typeof aspectGame>[0] = {}): GameState => withForm(aspectGame(opts), { heroForm: 0 });
const run = (s: GameState, ...c: Parameters<typeof runWith>[2][]): GameState => runWith(DEPS, s, ...c);
const counters = (s: GameState, id: InstanceId) => inst(s, id).counters;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const inPlayArea = (s: GameState, id: InstanceId, p: PlayerId = P1): boolean => playerOf(s, p).playArea.includes(id);
const inDiscard = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).discard.includes(id);
const inHandOf = (s: GameState, id: InstanceId, p: PlayerId = P1): boolean => playerOf(s, p).hand.includes(id);
const fromHand = (...ids: readonly InstanceId[]) => ids.map((id) => ({ fromHand: id }));

/** Answers trigger prompts with an id ending `respond`, target/option/card prompts with `target` / `option` when offered. */
const picker =
  (
    opts: {
      readonly target?: InstanceId | readonly InstanceId[];
      readonly respond?: string;
      readonly option?: string | readonly string[];
    } = {},
  ): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers" && opts.respond) {
      const hit = offered.find((o) => o.endsWith(opts.respond!));
      return hit ? [hit] : firstLegal(s);
    }
    const targets = opts.target === undefined ? [] : typeof opts.target === "string" ? [opts.target] : opts.target;
    if (["chooseTarget", "chooseCards", "chooseCostCards"].includes(choice.prompt.kind)) {
      const hits = targets.filter((t) => offered.includes(t));
      if (hits.length > 0) return hits.slice(0, choice.maxSelections);
    }
    if ((choice.prompt.kind === "chooseOption" || choice.prompt.kind === "choosePlayer") && opts.option) {
      const wanted = typeof opts.option === "string" ? [opts.option] : opts.option;
      const hit = choice.options.find((o) => wanted.some((w) => o.label.startsWith(w) || o.optionId === w));
      return hit ? [hit.optionId] : firstLegal(s);
    }
    return firstLegal(s);
  };
const drive = (s: GameState, opts?: Parameters<typeof picker>[0]): GameState =>
  settle(s, picker(opts), undefined, DEPS);

const VICTORIA = "50012";
const SLINGSHOT = "50013";
const ORG_SUPPORT = "50014";
const AGENTS = "50015";
const COMMAND_TEAM = "50016";
const CIRCE = "50017";
const BELLEROPHON = "50018";
const DOUGLASS = "50019";
const PERICLES = "50020";
const DUGAN = "50021";
const WARD = "50022";
const MAY = "50023";
const SPIES = "50024";
const FRONT_ORG = "50028";
const FURY_ALLY = "50002"; // a S.H.I.E.L.D. ally, cost 4
const ILIAD = "50009"; // a S.H.I.E.L.D. support, 3 mission counters
const STAFF = "50008"; // a S.H.I.E.L.D. support, 3 staff counters

describe("registry", () => {
  it("every registered script validates", () => {
    for (const [id, def] of Object.entries(REGISTRY)) expect(validateDefinition(def), id).toEqual([]);
  });
  it("registers or skips every printed ref of 50012 to 50028 and 50047 to 50058, none twice", () => {
    const codes = [
      ...Array.from({ length: 17 }, (_, i) => String(50012 + i)),
      ...Array.from({ length: 12 }, (_, i) => String(50047 + i)),
    ];
    const printed = codes.flatMap((code) => card<WithAbilities>(code).abilities.map((a) => a.id));
    expect(printed).toHaveLength(Object.keys(REGISTRY).length + Object.keys(SKIPPED).length);
    for (const ref of printed) expect(ref in REGISTRY !== ref in SKIPPED, ref).toBe(true);
    expect(Object.keys(REGISTRY).filter((r) => r in SKIPPED)).toEqual([]);
  });
  it("registers exactly these thirteen refs", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        "50012.victoria-hand-response",
        "50013.slingshot-action",
        "50015.agents-of-shield-constant",
        "50016.command-team-action",
        "50017.the-circe-action",
        "50018.the-bellerophon-action",
        "50019.the-douglass-action",
        "50020.the-pericles-action",
        "50021.dum-dum-dugan-interrupt",
        "50022.grant-ward-constant",
        "50022.grant-ward-forced-response",
        "50023.melinda-may-response",
        "50024.super-spies-action",
      ].sort(),
    );
  });
  it("trigger kinds, forms and costs", () => {
    expect(REGISTRY["50012.victoria-hand-response"]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY["50013.slingshot-action"]).toMatchObject({ activeIn: "hand", cost: { resources: { energy: 1 } } });
    expect(REGISTRY["50015.agents-of-shield-constant"]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY["50015.agents-of-shield-constant"]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY["50016.command-team-action"]!.cost).toEqual({
      exhaustSelf: true,
      spendCounters: { counterType: "command", amount: 1 },
    });
    expect(REGISTRY["50017.the-circe-action"]!.cost).toMatchObject({ spendCounters: { counterType: "deploy" } });
    expect(REGISTRY["50018.the-bellerophon-action"]!.cost).toMatchObject({ spendCounters: { counterType: "missile" } });
    expect(REGISTRY["50019.the-douglass-action"]!.cost).toMatchObject({ spendCounters: { counterType: "operation" } });
    expect(REGISTRY["50020.the-pericles-action"]!.cost).toMatchObject({ spendCounters: { counterType: "supply" } });
    expect(REGISTRY["50021.dum-dum-dugan-interrupt"]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY["50022.grant-ward-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY["50022.grant-ward-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["50023.melinda-may-response"]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY["50024.super-spies-action"]!.trigger).toMatchObject({ kind: "action", form: "hero" });
  });
  it("skips Organizational Support and Front Organization with a reason, and the second half as not started", () => {
    expect(SKIPPED["50014.organizational-support-interrupt"]).toMatch(/generate/);
    expect(SKIPPED["50028.front-organization-interrupt"]).toMatch(/cardLeavesPlay/);
    expect(SKIPPED["50051.intelligence-response"]).toBe("second half of the module, not started");
    expect(Object.keys(SKIPPED)).toHaveLength(16);
  });
  it("Energy, Genius and Strength print no ability", () => {
    for (const code of ["50025", "50026", "50027"]) expect(card<WithAbilities>(code).abilities).toEqual([]);
  });
});

describe("printed data", () => {
  it("Victoria Hand: unique Leadership ally, cost 3, ATK 1, THW 2, HP 2, consequential 1/1, S.H.I.E.L.D., [mental]", () => {
    const c = card<AllyCard>(VICTORIA);
    expect([c.cost, c.atk, c.thw, c.hp, c.unique, c.aspect]).toEqual([3, 1, 2, 2, true, "leadership"]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D."]);
    expect(c.resourceIcons).toEqual({ mental: 1 });
  });
  it("Slingshot: unique Leadership ally, cost 3, ATK 2, THW 2, HP 3, S.H.I.E.L.D. and SPY, [energy]", () => {
    const c = card<AllyCard>(SLINGSHOT);
    expect([c.cost, c.atk, c.thw, c.hp, c.unique, c.aspect]).toEqual([3, 2, 2, 3, true, "leadership"]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D.", "SPY"]);
    expect(c.resourceIcons).toEqual({ energy: 1 });
  });
  it("Organizational Support: Leadership resource producing [mental], up to 3 copies", () => {
    const c = card<ResourceCard>(ORG_SUPPORT);
    expect([c.aspect, c.producesIcons, c.deckLimit]).toEqual(["leadership", { mental: 1 }, 3]);
  });
  it("Agents of S.H.I.E.L.D.: Leadership TEAM support, cost 3, any player's control, max 1 Team card per player", () => {
    const c = card<SupportCard>(AGENTS);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([3, "leadership", 3]);
    expect(c.traits.map(String)).toEqual(["TEAM"]);
    expect(c.playRestrictions).toMatchObject({ anyPlayerControl: true, maxWithTrait: { per: "player", max: 1 } });
  });
  it("Command Team: cost 2, Uses (3 command counters), S.H.I.E.L.D.", () => {
    const c = card<SupportCard>(COMMAND_TEAM);
    expect([c.cost, c.aspect]).toEqual([2, "leadership"]);
    expect(c.keywords).toEqual([{ name: "uses", count: 3, counterType: "command" }]);
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D."]);
  });
  it("the four vehicles: unique, cost 6, S.H.I.E.L.D. and VEHICLE, with their aspects and Uses counters", () => {
    const rows = [
      [CIRCE, "leadership", 2, "deploy"],
      [BELLEROPHON, "aggression", 3, "missile"],
      [DOUGLASS, "justice", 3, "operation"],
      [PERICLES, "protection", 2, "supply"],
    ] as const;
    for (const [code, aspect, count, counterType] of rows) {
      const c = card<SupportCard>(code);
      expect([c.cost, c.unique, c.aspect], code).toEqual([6, true, aspect]);
      expect(c.keywords, code).toEqual([{ name: "uses", count, counterType }]);
      expect(c.traits.map(String), code).toEqual(["S.H.I.E.L.D.", "VEHICLE"]);
    }
  });
  it("Dum Dum Dugan: unique basic ally, cost 5, ATK 3, THW 3, HP 5, consequential 2 and 3, S.H.I.E.L.D.", () => {
    const c = card<AllyCard>(DUGAN);
    expect([c.cost, c.atk, c.thw, c.hp, c.unique, c.aspect]).toEqual([5, 3, 3, 5, true, "basic"]);
    expect(c.consequentialDamage).toEqual({ attack: 2, thwart: 3 });
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D."]);
  });
  it("Grant Ward: unique basic ally, cost 0, ATK 2, THW 2, HP 3, consequential 1/1, S.H.I.E.L.D. and SPY", () => {
    const c = card<AllyCard>(WARD);
    expect([c.cost, c.atk, c.thw, c.hp, c.unique, c.aspect]).toEqual([0, 2, 2, 3, true, "basic"]);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D.", "SPY"]);
  });
  it("Melinda May: unique basic ally, cost 4, ATK 2, THW 2, HP 3, S.H.I.E.L.D. and SPY", () => {
    const c = card<AllyCard>(MAY);
    expect([c.cost, c.atk, c.thw, c.hp, c.unique, c.aspect]).toEqual([4, 2, 2, 3, true, "basic"]);
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D.", "SPY"]);
  });
  it("Super Spies: basic event, cost 0, wild icon, Team-Up (Maria Hill and Nick Fury), at most 1 per deck", () => {
    const c = card<EventCard>(SPIES);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([0, "basic", 1]);
    expect(c.keywords).toEqual([{ name: "teamUp", names: ["Maria Hill", "Nick Fury"] }]);
    expect(c.resourceIcons).toEqual({ wild: 1 });
  });
  it("Energy, Genius and Strength: basic resources producing two icons of one type, max 1 per deck", () => {
    const rows = [
      ["50025", { energy: 2 }],
      ["50026", { mental: 2 }],
      ["50027", { physical: 2 }],
    ] as const;
    for (const [code, icons] of rows) {
      const c = card<ResourceCard>(code);
      expect([c.aspect, c.producesIcons, c.deckLimit], code).toEqual(["basic", icons, 1]);
    }
  });
  it("Front Organization: basic LOCATION support, cost 0, any player's control, max 1 per player", () => {
    const c = card<SupportCard>(FRONT_ORG);
    expect([c.cost, c.aspect, c.deckLimit]).toEqual([0, "basic", 3]);
    expect(c.traits.map(String)).toEqual(["LOCATION"]);
    expect(c.playRestrictions).toEqual({ anyPlayerControl: true, maxPerPlayer: 1 });
  });
});

/** Plays `code` from P1's hand paying with `pay` other hand cards; prompts answered by `opts`. */
const playIt = (state: GameState, code: string, pay: number, opts?: Parameters<typeof picker>[0]) => {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const handBefore = playerOf(given.state, P1).hand.length;
  const after = drive(run(given.state, play(P1, id, payWith(given.state, P1, pay, [id]))), opts);
  return { state: after, id, handBefore };
};

describe("50012.victoria-hand-response: after Victoria Hand enters play, ready a S.H.I.E.L.D. support", () => {
  const withExhausted = (code: string, c: Record<string, number>) => {
    const put = placed(aspectGame(), code, c);
    return { ...put, state: patchInstance(put.state, put.id, { exhausted: true }) };
  };
  it("costs 3; readying an exhausted Iliad keeps its 3 mission counters", () => {
    const staged = withExhausted(ILIAD, { mission: 3 });
    const { state, id, handBefore } = playIt(staged.state, VICTORIA, 3, {
      respond: "50012.victoria-hand-response",
      target: staged.id,
    });
    expect(inPlayArea(state, id)).toBe(true);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 4);
    expect(inst(state, staged.id).exhausted).toBe(false);
    expect(counters(state, staged.id)).toEqual({ mission: 3 });
  });
  it("offers only S.H.I.E.L.D. supports: a support without the trait is not a target", () => {
    const iliad = withExhausted(ILIAD, { mission: 3 });
    const org = placed(iliad.state, FRONT_ORG);
    const org2 = patchInstance(org.state, org.id, { exhausted: true });
    const given = moveToHand(org2, P1, VICTORIA);
    const asked = settle(
      run(given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 3, [given.ids[0]!]))),
      picker({ respond: "50012.victoria-hand-response" }),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      DEPS,
    );
    expect(asked.pendingChoice!.options.map((o) => o.optionId)).toEqual([iliad.id]);
  });
  it("the response is optional: declining readies nothing", () => {
    const staged = withExhausted(ILIAD, { mission: 3 });
    const { state } = playIt(staged.state, VICTORIA, 3);
    expect(inst(state, staged.id).exhausted).toBe(true);
  });
  it("with no S.H.I.E.L.D. support in play she still enters play and nothing is readied", () => {
    const { state, id } = playIt(aspectGame(), VICTORIA, 3, { respond: "50012.victoria-hand-response" });
    expect(inPlayArea(state, id)).toBe(true);
  });
  it("readies another player's S.H.I.E.L.D. support too (the text does not say 'you control')", () => {
    const base = aspectGame({ players: 2 });
    const put = placed(base, ILIAD, { mission: 3 });
    const theirs = patchInstance(put.state, put.id, { exhausted: true, controllerId: P2 });
    const { state } = playIt(theirs, VICTORIA, 3, { respond: "50012.victoria-hand-response", target: put.id });
    expect(inst(state, put.id).exhausted).toBe(false);
  });
});

describe("50013.slingshot-action: spend an [energy] resource, put her into play from your hand under any player's control", () => {
  const ACTION = "50013.slingshot-action";
  /** Slingshot and a Command Team ([energy]) in P1's hand. */
  const stage = (state: GameState) => {
    const given = moveToHand(state, P1, SLINGSHOT, COMMAND_TEAM);
    return { state: given.state, sling: given.ids[0]!, energy: given.ids[1]! };
  };
  it("costs 3 from hand with a payment of the printed cost", () => {
    const { state, id } = playIt(aspectGame(), SLINGSHOT, 3);
    expect(inPlayArea(state, id)).toBe(true);
  });
  it("paying one [energy] resource puts her into play under your control, ready", () => {
    const { state, sling, energy } = stage(aspectGame());
    const handBefore = playerOf(state, P1).hand.length;
    const after = drive(run(state, use(P1, sling, ACTION, fromHand(energy))), { option: "p1" });
    expect(inPlayArea(after, sling)).toBe(true);
    expect(inst(after, sling).controllerId).toBe(P1);
    expect(inst(after, sling).exhausted).toBe(false);
    expect(inDiscard(after, energy)).toBe(true);
    expect(playerOf(after, P1).hand).toHaveLength(handBefore - 2);
  });
  it("a hand card without an [energy] icon cannot pay", () => {
    const given = moveToHand(aspectGame(), P1, SLINGSHOT, VICTORIA); // Victoria prints [mental]
    expect(() => run(given.state, use(P1, given.ids[0]!, ACTION, fromHand(given.ids[1]!)))).toThrow();
  });
  it("another player may be chosen to control her", () => {
    const { state, sling, energy } = stage(aspectGame({ players: 2 }));
    const after = drive(run(state, use(P1, sling, ACTION, fromHand(energy))), { option: "p2" });
    expect(inPlayArea(after, sling, P2)).toBe(true);
    expect(inst(after, sling).controllerId).toBe(P2);
    expect(inPlayArea(after, sling, P1)).toBe(false);
  });
  it("at the end of the phase, if she is still in play, she returns to her owner's hand", () => {
    const { state, sling, energy } = stage(aspectGame());
    const mid = drive(run(state, use(P1, sling, ACTION, fromHand(energy))), { option: "p1" });
    expect(inPlayArea(mid, sling)).toBe(true);
    const ended = drive(run(mid, { type: "endTurn", playerId: P1 }));
    expect(inPlayArea(ended, sling)).toBe(false);
    expect(inHandOf(ended, sling)).toBe(true);
  });
});

describe("50013.slingshot-action: the 'still in play' clause", () => {
  it("if she left play before the phase ended, she is not returned to hand", () => {
    const given = moveToHand(aspectGame(), P1, SLINGSHOT, COMMAND_TEAM);
    const [sling, energy] = given.ids as [InstanceId, InstanceId];
    const mid = drive(run(given.state, use(P1, sling, "50013.slingshot-action", fromHand(energy))), { option: "p1" });
    // Staging surgery: she is defeated (to her owner's discard pile) before the phase ends.
    const gone: GameState = {
      ...mid,
      players: mid.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== sling), discard: [...p.discard, sling] }
          : p,
      ),
    };
    const ended = drive(run(gone, endTurn(P1)));
    expect(inHandOf(ended, sling)).toBe(false);
    expect(inDiscard(ended, sling)).toBe(true);
  });
});

describe("50015.agents-of-shield-constant: with S.H.I.E.L.D. characters only, cancel a revealed encounter card", () => {
  const ID = "50015.agents-of-shield-constant";
  const TOUGH = "01105"; // "I'm Tough!": When Revealed: give Rhino a tough status card
  const NEXT = "01104"; // "Hard to Keep Down", the card revealed after the cancel
  /** Ends P1's turn with `01186` (the villain's boost), then TOUGH, then NEXT on top of the encounter deck. */
  const reveal = (state: GameState, opts: Parameters<typeof picker>[0] = {}) =>
    drive(run(stackEncounterDeck(state, "01186", TOUGH, NEXT), endTurn(P1)), opts);
  const asked = (state: GameState): readonly string[] => {
    const s = settle(
      run(stackEncounterDeck(state, "01186", TOUGH, NEXT), endTurn(P1)),
      picker(),
      (x) => x.pendingChoice?.prompt.kind === "chooseTriggers",
      DEPS,
    );
    return s.pendingChoice?.options.map((o) => o.optionId as string) ?? [];
  };
  const encounterDiscard = (s: GameState): string[] =>
    Object.values(s.encounterDecks)
      .flatMap((d) => d.discard)
      .map((i) => s.instances[i]!.cardId as string);
  const toughOf = (s: GameState) => inst(s, villainOf(s)).statuses.tough;

  it("declined: the card resolves and Rhino gets a tough status card", () => {
    const base = placed(aspectGame(), AGENTS);
    expect(toughOf(reveal(base.state))).toBe(1);
  });
  it("accepted: the card's effects are cancelled (no tough), it is discarded, another card is revealed, Agents exhausts", () => {
    const base = placed(aspectGame(), AGENTS);
    const after = reveal(base.state, { respond: ID });
    expect(toughOf(after)).toBe(0);
    expect(encounterDiscard(after)).toContain(TOUGH);
    expect(encounterDiscard(after)).toContain(NEXT);
    expect(inst(after, base.id).exhausted).toBe(true);
  });
  it("is offered to a Maria Hill whose every character is S.H.I.E.L.D., even with a non-S.H.I.E.L.D. ally (Maria gives her allies the trait)", () => {
    const base = placed(placed(aspectGame(), AGENTS).state, FURY_ALLY);
    expect(asked(base.state).some((o) => o.endsWith(ID))).toBe(true);
  });
  it("is spent once: the 'another card' it reveals (a second I'm Tough!) is not offered to the exhausted Agents again", () => {
    const base = placed(aspectGame(), AGENTS);
    const after = drive(run(stackEncounterDeck(base.state, "01186", TOUGH, TOUGH), endTurn(P1)), { respond: ID });
    expect(toughOf(after)).toBe(1); // the first was cancelled, the second resolved
    expect(inst(after, base.id).exhausted).toBe(true);
  });
  it("is not offered to a non-S.H.I.E.L.D. identity (Spider-Man), and Rhino keeps the tough status card", () => {
    const start = aspectGame({ deck: "core-spider-man-justice", swap: { "01002": AGENTS } });
    const base = placed(start, AGENTS);
    expect(asked(base.state).some((o) => o.endsWith(ID))).toBe(false);
    expect(toughOf(reveal(base.state, { respond: ID }))).toBe(1);
  });
  it("a non-S.H.I.E.L.D. ally of a Spider-Man seat is no better: still not offered", () => {
    const start = aspectGame({ deck: "core-spider-man-justice", swap: { "01002": AGENTS } });
    const base = placed(placed(start, AGENTS).state, "01058"); // Daredevil
    expect(asked(base.state).some((o) => o.endsWith(ID))).toBe(false);
  });
});

describe("50016.command-team-action: exhaust and remove 1 command counter, ready an ally", () => {
  const ACTION = "50016.command-team-action";
  const stage = (command = 3) => {
    const team = placed(aspectGame(), COMMAND_TEAM, { command });
    const fury = placed(team.state, FURY_ALLY);
    return { team: team.id, fury: fury.id, state: patchInstance(fury.state, fury.id, { exhausted: true }) };
  };
  it("costs 2 and enters play with 3 command counters, ready", () => {
    const { state, id, handBefore } = playIt(aspectGame(), COMMAND_TEAM, 2);
    expect(inPlayArea(state, id)).toBe(true);
    expect(counters(state, id)).toEqual({ command: 3 });
    expect(inst(state, id).exhausted).toBe(false);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 3);
  });
  it("readies an exhausted ally: Command Team exhausts, 3 command counters become 2", () => {
    const { state, team, fury } = stage();
    const after = drive(run(state, use(P1, team, ACTION)), { target: fury });
    expect(inst(after, fury).exhausted).toBe(false);
    expect(inst(after, team).exhausted).toBe(true);
    expect(counters(after, team)).toEqual({ command: 2 });
  });
  it("readies any ally, another player's included", () => {
    const base = aspectGame({ players: 2 });
    const team = placed(base, COMMAND_TEAM, { command: 3 });
    const jj = placed(team.state, "01059", {}, P2);
    const staged = patchInstance(jj.state, jj.id, { exhausted: true });
    const after = drive(run(staged, use(P1, team.id, ACTION)), { target: jj.id });
    expect(inst(after, jj.id).exhausted).toBe(false);
  });
  it("the last command counter removed discards Command Team (Uses, RRG 1.8 p. 46)", () => {
    const { state, team, fury } = stage(1);
    const after = drive(run(state, use(P1, team, ACTION)), { target: fury });
    expect(inst(after, fury).exhausted).toBe(false);
    expect(inDiscard(after, team)).toBe(true);
    expect(inPlayArea(after, team)).toBe(false);
  });
  it("cannot be used while exhausted", () => {
    const { state, team } = stage();
    expect(() => run(patchInstance(state, team, { exhausted: true }), use(P1, team, ACTION))).toThrow();
  });
  it("works in hero form too (no form restriction)", () => {
    const team = placed(hero(), COMMAND_TEAM, { command: 3 });
    const fury = placed(team.state, FURY_ALLY);
    const staged = patchInstance(fury.state, fury.id, { exhausted: true });
    const after = drive(run(staged, use(P1, team.id, ACTION)), { target: fury.id });
    expect(inst(after, fury.id).exhausted).toBe(false);
  });
});

/** Answers target/option/card prompts from `answers` in order (an id or a label prefix); other prompts as `firstLegal`. */
const queue = (...answers: readonly string[]): Picker => {
  const rest = [...answers];
  return (s) => {
    const choice = s.pendingChoice!;
    if (rest.length === 0) return firstLegal(s);
    if (choice.prompt.kind === "chooseTriggers") {
      const wanted = rest[0]!.startsWith("respond:") ? rest[0]!.slice(8) : undefined;
      const hit = wanted ? choice.options.find((o) => (o.optionId as string).endsWith(wanted)) : undefined;
      if (!hit) return firstLegal(s);
      rest.shift();
      return [hit.optionId];
    }
    if (rest[0]!.startsWith("respond:")) return firstLegal(s);
    const hit = choice.options.find(
      (o) => o.optionId === rest[0] || o.optionId === `hand:${rest[0]}` || o.label.startsWith(rest[0]!),
    );
    if (!hit) return firstLegal(s);
    rest.shift();
    return [hit.optionId];
  };
};
const driveQueue = (s: GameState, ...answers: readonly string[]): GameState =>
  settle(s, queue(...answers), undefined, DEPS);
/** Discards hand cards down to 5 so a staged extra card does not force a discard-down prompt. */
const trimHand = (s: GameState): GameState => ({
  ...s,
  players: s.players.map((p) =>
    p.playerId === P1 ? { ...p, hand: p.hand.slice(0, 5), discard: [...p.discard, ...p.hand.slice(5)] } : p,
  ),
});
const statusesOf = (s: GameState, id: InstanceId) => inst(s, id).statuses;

describe("50017.the-circe-action: choose a player, that player puts an ally into play from their hand", () => {
  const ACTION = "50017.the-circe-action";
  const DAREDEVIL = "01058";
  it("enters play with 2 deploy counters; costs 6", () => {
    const { state, id } = playIt(aspectGame(), CIRCE, 6);
    expect(counters(state, id)).toEqual({ deploy: 2 });
    expect(inPlayArea(state, id)).toBe(true);
  });
  it("another player is chosen and picks their own ally: it enters play for free under their control; Circe exhausts, 2 deploy to 1", () => {
    const circe = placed(aspectGame({ players: 2 }), CIRCE, { deploy: 2 });
    const hand = moveToHand(circe.state, P2, DAREDEVIL);
    const handBefore = playerOf(hand.state, P2).hand.length;
    const after = driveQueue(run(hand.state, use(P1, circe.id, ACTION)), "p2", hand.ids[0]!);
    expect(inPlayArea(after, hand.ids[0]!, P2)).toBe(true);
    expect(inst(after, hand.ids[0]!).controllerId).toBe(P2);
    expect(playerOf(after, P2).hand).toHaveLength(handBefore - 1); // nothing was paid
    expect(counters(after, circe.id)).toEqual({ deploy: 1 });
    expect(inst(after, circe.id).exhausted).toBe(true);
  });
  it("choosing yourself puts one of your own allies into play", () => {
    const circe = placed(aspectGame(), CIRCE, { deploy: 2 });
    const hand = moveToHand(circe.state, P1, FURY_ALLY);
    const after = driveQueue(run(hand.state, use(P1, circe.id, ACTION)), "p1", hand.ids[0]!);
    expect(inPlayArea(after, hand.ids[0]!)).toBe(true);
  });
  it("only allies in that player's hand are offered (an event is not)", () => {
    const circe = placed(aspectGame(), CIRCE, { deploy: 2 });
    const hand = moveToHand(circe.state, P1, FURY_ALLY, "50004"); // On the Double, an event
    const asked = settle(
      run(hand.state, use(P1, circe.id, ACTION)),
      queue("p1"),
      (s) => s.pendingChoice?.prompt.kind === "chooseCards",
      DEPS,
    );
    const offered = asked.pendingChoice!.options.map((o) => o.optionId);
    expect(offered).toContain(hand.ids[0]!);
    expect(offered).not.toContain(hand.ids[1]!);
  });
  it("the player has no ally in hand: nothing enters play, the cost is still paid", () => {
    const circe = placed(aspectGame({ players: 2 }), CIRCE, { deploy: 2 });
    const bare: GameState = {
      ...circe.state,
      players: circe.state.players.map((p) => (p.playerId === P2 ? { ...p, hand: [] } : p)),
    };
    const after = driveQueue(run(bare, use(P1, circe.id, ACTION)), "p2");
    expect(playerOf(after, P2).playArea).toHaveLength(playerOf(bare, P2).playArea.length);
    expect(counters(after, circe.id)).toEqual({ deploy: 1 });
  });
  it("the last deploy counter removed discards The Circe", () => {
    const circe = placed(aspectGame(), CIRCE, { deploy: 1 });
    const hand = moveToHand(circe.state, P1, FURY_ALLY);
    const after = driveQueue(run(hand.state, use(P1, circe.id, ACTION)), "p1", hand.ids[0]!);
    expect(inDiscard(after, circe.id)).toBe(true);
    expect(inPlayArea(after, hand.ids[0]!)).toBe(true);
  });
  it("cannot be used while exhausted", () => {
    const circe = placed(aspectGame(), CIRCE, { deploy: 2 });
    expect(() => run(patchInstance(circe.state, circe.id, { exhausted: true }), use(P1, circe.id, ACTION))).toThrow();
  });
});

describe("50018.the-bellerophon-action: choose a player, 3 damage to the villain and each minion engaged with them, tough first", () => {
  const ACTION = "50018.the-bellerophon-action";
  const SHOCKER = "01103"; // hp 3
  const SANDMAN = "01102"; // hp 4
  const TOUGH1 = { stunned: 0, confused: 0, tough: 1 };
  /** Two players; P1 engaged with a tough Shocker, P2 with a tough Sandman, the villain tough too. */
  const stage = () => {
    const bell = placed(aspectGame({ players: 2 }), BELLEROPHON, { missile: 3 });
    let s = engaged(bell.state, SANDMAN, "m-shocker", P1, TOUGH1);
    s = engaged(s, SANDMAN, "m-sandman", P2, TOUGH1);
    s = patchInstance(s, villainOf(s), { statuses: TOUGH1 });
    return { state: s, bell: bell.id, shocker: "m-shocker" as InstanceId, sandman: "m-sandman" as InstanceId };
  };
  it("enters play with 3 missile counters; costs 6", () => {
    const { state, id } = playIt(aspectGame(), BELLEROPHON, 6);
    expect(counters(state, id)).toEqual({ missile: 3 });
  });
  it("choosing P1: tough status cards leave the villain and P1's minion first, so 3 damage lands on both; P2's minion is untouched", () => {
    const { state, bell, shocker, sandman } = stage();
    const before = inst(state, villainOf(state)).damage;
    const after = driveQueue(run(state, use(P1, bell, ACTION)), "p1");
    expect(statusesOf(after, villainOf(after)).tough).toBe(0);
    expect(inst(after, villainOf(after)).damage).toBe(before + 3);
    expect(inst(after, shocker).damage).toBe(3);
    expect(statusesOf(after, shocker).tough).toBe(0);
    expect(inst(after, sandman).damage).toBe(0);
    expect(statusesOf(after, sandman).tough).toBe(1);
    expect(counters(after, bell)).toEqual({ missile: 2 });
    expect(inst(after, bell).exhausted).toBe(true);
  });
  it("choosing P2: P2's Sandman loses tough and takes 3 (4 hp left at 3 damage); P1's Shocker is untouched", () => {
    const { state, bell, shocker, sandman } = stage();
    const after = driveQueue(run(state, use(P1, bell, ACTION)), "p2");
    expect(statusesOf(after, sandman).tough).toBe(0);
    expect(inst(after, sandman).damage).toBe(3);
    expect(inst(after, shocker).damage).toBe(0);
    expect(statusesOf(after, shocker).tough).toBe(1);
    expect(statusesOf(after, villainOf(after)).tough).toBe(0);
  });
  it("with no tough status cards anywhere it still deals the 3 damage", () => {
    const bell = placed(engaged(aspectGame(), SANDMAN, "m-sandman"), BELLEROPHON, { missile: 3 });
    const after = driveQueue(run(bell.state, use(P1, bell.id, ACTION)), "p1");
    expect(inst(after, "m-sandman" as InstanceId).damage).toBe(3);
    expect(inst(after, villainOf(after)).damage).toBe(3);
  });
  it("a minion whose hit points the 3 damage reaches is defeated (Shocker, 3 hp)", () => {
    const bell = placed(engaged(aspectGame(), SHOCKER, "m-shocker"), BELLEROPHON, { missile: 3 });
    const after = driveQueue(run(bell.state, use(P1, bell.id, ACTION)), "p1");
    expect(playerOf(after, P1).playArea).not.toContain("m-shocker");
  });
  it("with no minion engaged only the villain is hit", () => {
    const bell = placed(aspectGame(), BELLEROPHON, { missile: 1 });
    const after = driveQueue(run(bell.state, use(P1, bell.id, ACTION)), "p1");
    expect(inst(after, villainOf(after)).damage).toBe(3);
    expect(inDiscard(after, bell.id)).toBe(true); // the last missile counter
  });
});

describe("50019.the-douglass-action: remove 2 threat from each scheme, ignoring crisis icons", () => {
  const ACTION = "50019.the-douglass-action";
  it("enters play with 3 operation counters; costs 6", () => {
    const { state, id } = playIt(aspectGame(), DOUGLASS, 6);
    expect(counters(state, id)).toEqual({ operation: 3 });
  });
  it("main 5 to 3, Crowd Control (crisis) 4 to 2, Breakin' & Takin' 3 to 1; counters 3 to 2, exhausted", () => {
    const douglass = placed(aspectGame(), DOUGLASS, { operation: 3 });
    const crowd = encounterCardInVillainArea(douglass.state, "01108", 4);
    const breakin = encounterCardInVillainArea(crowd.state, "01107", 3);
    const staged = patchInstance(breakin.state, schemeOf(breakin.state), { threat: 5 });
    const after = drive(run(staged, use(P1, douglass.id, ACTION)));
    expect(inst(after, schemeOf(after)).threat).toBe(3);
    expect(inst(after, crowd.id).threat).toBe(2);
    expect(inst(after, breakin.id).threat).toBe(1);
    expect(counters(after, douglass.id)).toEqual({ operation: 2 });
    expect(inst(after, douglass.id).exhausted).toBe(true);
  });
  it("a scheme with less than 2 threat goes to 0, and a side scheme that reaches 0 is defeated", () => {
    const douglass = placed(aspectGame(), DOUGLASS, { operation: 3 });
    const breakin = encounterCardInVillainArea(douglass.state, "01107", 1);
    const staged = patchInstance(breakin.state, schemeOf(breakin.state), { threat: 1 });
    const after = drive(run(staged, use(P1, douglass.id, ACTION)));
    expect(inst(after, schemeOf(after)).threat).toBe(0);
    expect(after.villainArea).not.toContain(breakin.id);
  });
  it("the main scheme loses threat even while a crisis side scheme is in play (compare: a basic thwart is refused)", () => {
    const douglass = placed(aspectGame(), DOUGLASS, { operation: 3 });
    const crowd = encounterCardInVillainArea(douglass.state, "01108", 4);
    const staged = patchInstance(crowd.state, schemeOf(crowd.state), { threat: 4 });
    const after = drive(run(staged, use(P1, douglass.id, ACTION)));
    expect(inst(after, schemeOf(after)).threat).toBe(2);
  });
  it("the last operation counter removed discards The Douglass", () => {
    const douglass = placed(aspectGame(), DOUGLASS, { operation: 1 });
    const after = drive(run(douglass.state, use(P1, douglass.id, ACTION)));
    expect(inDiscard(after, douglass.id)).toBe(true);
  });
});

describe("50020.the-pericles-action: a status card of your choice to a hero or villain, and to an ally or minion", () => {
  const ACTION = "50020.the-pericles-action";
  const stage = (form: "hero" | "alterEgo" = "hero") => {
    const pericles = placed(form === "hero" ? hero() : aspectGame(), PERICLES, { supply: 2 });
    const fury = placed(pericles.state, FURY_ALLY);
    const s = engaged(fury.state, "01103", "m-shocker");
    return { state: s, pericles: pericles.id, fury: fury.id, shocker: "m-shocker" as InstanceId };
  };
  it("enters play with 2 supply counters; costs 6", () => {
    const { state, id } = playIt(aspectGame(), PERICLES, 6);
    expect(counters(state, id)).toEqual({ supply: 2 });
  });
  it("stun the hero, then give the ally a tough status card: supply 2 to 1, exhausted", () => {
    const { state, pericles, fury } = stage();
    const hid = identityOf(state);
    const after = driveQueue(run(state, use(P1, pericles, ACTION)), hid, "Stunned", fury, "Tough");
    expect(statusesOf(after, hid)).toEqual({ stunned: 1, confused: 0, tough: 0 });
    expect(statusesOf(after, fury)).toEqual({ stunned: 0, confused: 0, tough: 1 });
    expect(counters(after, pericles)).toEqual({ supply: 1 });
    expect(inst(after, pericles).exhausted).toBe(true);
  });
  it("confuse the villain and stun a minion", () => {
    const { state, pericles, shocker } = stage();
    const after = driveQueue(run(state, use(P1, pericles, ACTION)), villainOf(state), "Confused", shocker, "Stunned");
    expect(statusesOf(after, villainOf(after))).toEqual({ stunned: 0, confused: 1, tough: 0 });
    expect(statusesOf(after, shocker)).toEqual({ stunned: 1, confused: 0, tough: 0 });
  });
  it("in alter-ego form the first target can only be the villain (no hero is in play)", () => {
    const { state, pericles } = stage("alterEgo");
    const asked = settle(
      run(state, use(P1, pericles, ACTION)),
      queue(),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      DEPS,
    );
    expect(asked.pendingChoice!.options.map((o) => o.optionId)).toEqual([villainOf(state)]);
  });
  it("the first target cannot be an ally or minion, the second cannot be the hero or villain", () => {
    const { state, pericles, fury, shocker } = stage();
    const first = settle(
      run(state, use(P1, pericles, ACTION)),
      queue(),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      DEPS,
    );
    expect(first.pendingChoice!.options.map((o) => o.optionId).sort()).toEqual(
      [identityOf(state), villainOf(state)].sort(),
    );
    const second = settle(
      run(state, use(P1, pericles, ACTION)),
      queue(villainOf(state), "Tough"),
      (s) =>
        s.pendingChoice?.prompt.kind === "chooseTarget" && s.pendingChoice.options.some((o) => o.optionId === fury),
      DEPS,
    );
    expect(second.pendingChoice!.options.map((o) => o.optionId).sort()).toEqual([fury, shocker].sort());
  });
  it("with no ally or minion in play it cannot be used (guard for the two-required-targets engine gap)", () => {
    const pericles = placed(hero(), PERICLES, { supply: 2 });
    expect(() => run(pericles.state, use(P1, pericles.id, ACTION))).toThrow();
  });
  it("the last supply counter removed discards The Pericles", () => {
    const { state, pericles, fury } = stage();
    const staged = patchInstance(state, pericles, { counters: { supply: 1 } });
    const after = driveQueue(run(staged, use(P1, pericles, ACTION)), villainOf(state), "Stunned", fury, "Stunned");
    expect(inDiscard(after, pericles)).toBe(true);
  });
});

describe("50021.dum-dum-dugan-interrupt: exhaust up to 3 S.H.I.E.L.D. cards you control for +1 to that power each", () => {
  const ID = "50021.dum-dum-dugan-interrupt";
  const COMMAND = COMMAND_TEAM;
  /** Dugan, three S.H.I.E.L.D. supports and a Front Organization in play, Maria in hero form. */
  const stage = () => {
    const dugan = placed(hero(), DUGAN);
    const team = placed(dugan.state, COMMAND, { command: 3 });
    const iliad = placed(team.state, ILIAD, { mission: 3 });
    const staff = placed(iliad.state, STAFF, { staff: 3 });
    const org = placed(staff.state, FRONT_ORG);
    return { state: org.state, dugan: dugan.id, team: team.id, iliad: iliad.id, staff: staff.id, org: org.id };
  };
  const attack = (s: GameState, dugan: InstanceId) =>
    ({ type: "basicAttack", playerId: P1, attackerInstanceId: dugan, targetInstanceId: villainOf(s) }) as const;
  const thwart = (s: GameState, dugan: InstanceId) =>
    ({ type: "basicThwart", playerId: P1, thwarterInstanceId: dugan, schemeInstanceId: schemeOf(s) }) as const;

  it("costs 5 and enters play ready", () => {
    const { state, id } = playIt(aspectGame(), DUGAN, 5);
    expect(inPlayArea(state, id)).toBe(true);
  });
  it("declined: a basic attack deals his 3 ATK and he takes 2 consequential damage", () => {
    const { state, dugan } = stage();
    const after = drive(run(state, attack(state, dugan)));
    expect(inst(after, villainOf(after)).damage).toBe(3);
    expect(inst(after, dugan).damage).toBe(2);
  });
  it("exhausting 3 S.H.I.E.L.D. supports adds +3: a basic attack deals 6", () => {
    const { state, dugan, team, iliad, staff, org } = stage();
    const after = drive(run(state, attack(state, dugan)), { respond: ID, target: [team, iliad, staff] });
    expect(inst(after, villainOf(after)).damage).toBe(6);
    for (const id of [team, iliad, staff]) expect(inst(after, id).exhausted, id).toBe(true);
    expect(inst(after, org).exhausted).toBe(false); // not S.H.I.E.L.D.
  });
  it("exhausting 1 adds +1: a basic attack deals 4", () => {
    const { state, dugan, team, iliad } = stage();
    const after = drive(run(state, attack(state, dugan)), { respond: ID, target: [team] });
    expect(inst(after, villainOf(after)).damage).toBe(4);
    expect(inst(after, team).exhausted).toBe(true);
    expect(inst(after, iliad).exhausted).toBe(false);
  });
  it("also raises a basic thwart (+2 for two cards: 3 THW becomes 5)", () => {
    const { state, dugan, team, iliad } = stage();
    const staged = patchInstance(state, schemeOf(state), { threat: 9 });
    const after = drive(run(staged, thwart(staged, dugan)), { respond: ID, target: [team, iliad] });
    expect(inst(after, schemeOf(after)).threat).toBe(4);
    expect(inst(after, dugan).damage).toBe(3); // thwart consequential damage 3
  });
  it("any S.H.I.E.L.D. card you control counts, an ally included, but not a card without the trait", () => {
    const { state, dugan, org } = stage();
    const fury = placed(state, FURY_ALLY);
    const asked = settle(
      run(fury.state, attack(fury.state, dugan)),
      picker({ respond: ID }),
      (s) => s.pendingChoice?.prompt.kind !== "chooseTriggers" && s.pendingChoice?.prompt.kind !== "declareDefender",
      DEPS,
    );
    const offered = asked.pendingChoice!.options.map((o) => o.optionId as string);
    expect(offered).toContain(fury.id);
    expect(offered).not.toContain(org);
  });
  it("your S.H.I.E.L.D. identity is a legal pick too: exhausting Maria Hill adds +1", () => {
    const dugan = placed(hero(), DUGAN);
    const maria = identityOf(dugan.state);
    const after = drive(run(dugan.state, attack(dugan.state, dugan.id)), { respond: ID, target: [maria] });
    expect(inst(after, maria).exhausted).toBe(true);
    expect(inst(after, villainOf(after)).damage).toBe(4);
  });
  it("a non-S.H.I.E.L.D. identity (Spider-Man) is no pick: with nothing else to exhaust the interrupt is not offered", () => {
    const start = aspectGame({ deck: "core-spider-man-justice", swap: { "01002": DUGAN } });
    const dugan = placed(withForm(start, { heroForm: 0 }), DUGAN);
    const asked = settle(
      run(dugan.state, attack(dugan.state, dugan.id)),
      picker(),
      (s) => s.pendingChoice?.prompt.kind === "chooseTriggers",
      DEPS,
    );
    expect(asked.pendingChoice).toBeFalsy();
    expect(inst(asked, villainOf(asked)).damage).toBe(3);
  });
  it("with every S.H.I.E.L.D. card already exhausted the interrupt is not offered", () => {
    const dugan = placed(hero(), DUGAN);
    const staged = patchInstance(dugan.state, identityOf(dugan.state), { exhausted: true });
    const asked = settle(
      run(staged, attack(staged, dugan.id)),
      picker(),
      (s) => s.pendingChoice?.prompt.kind === "chooseTriggers",
      DEPS,
    );
    expect(asked.pendingChoice).toBeFalsy();
    expect(inst(asked, villainOf(asked)).damage).toBe(3);
  });
});

describe("50022.grant-ward: cannot defend; Forced Response after you reveal a treachery", () => {
  const TREACHERY = "01105"; // "I'm Tough!"
  const MINION = "01101"; // Hydra Mercenary
  /** Ends the turn with a filler (the villain's boost) and then `codes` on top of the encounter deck. */
  const reveal = (state: GameState, codes: readonly string[], ...answers: readonly string[]) =>
    settle(run(stackEncounterDeck(state, "01186", ...codes), endTurn(P1)), queue(...answers), undefined, DEPS);
  const removed = (s: GameState, id: InstanceId) => s.removedFromGame.includes(id);

  it("costs 0 and enters play ready", () => {
    const { state, id } = playIt(aspectGame(), WARD, 0);
    expect(inPlayArea(state, id)).toBe(true);
  });
  it("cannot be declared as a defender, while another ally can", () => {
    const ward = placed(hero(), WARD);
    const fury = placed(ward.state, FURY_ALLY);
    const asked = settle(
      run(fury.state, endTurn(P1)),
      queue(),
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      DEPS,
    );
    const offered = asked.pendingChoice!.options.map((o) => o.optionId as string);
    expect(offered).toContain(fury.id);
    expect(offered).not.toContain(ward.id);
  });
  it("spending a [mental] resource keeps her: no damage, still in play", () => {
    const ward = placed(aspectGame(), WARD);
    const mental = moveToHand(trimHand(ward.state), P1, VICTORIA); // prints [mental]
    const before = inst(mental.state, identityOf(mental.state)).damage;
    const after = reveal(mental.state, [TREACHERY], "Spend", mental.ids[0]!);
    expect(inPlayArea(after, ward.id)).toBe(true);
    expect(removed(after, ward.id)).toBe(false);
    expect(inst(after, identityOf(after)).damage).toBe(before);
    expect(inDiscard(after, mental.ids[0]!)).toBe(true);
  });
  it("not spending: you take damage equal to her ATK (2) and she is removed from the game", () => {
    const ward = placed(aspectGame(), WARD);
    const after = reveal(ward.state, [TREACHERY], "Do not");
    expect(inst(after, identityOf(after)).damage).toBe(2);
    expect(removed(after, ward.id)).toBe(true);
    expect(inPlayArea(after, ward.id)).toBe(false);
    expect(inDiscard(after, ward.id)).toBe(false);
  });
  it("with no [mental] resource in hand she cannot be saved: damage and removal", () => {
    const ward = placed(aspectGame(), WARD);
    const empty: GameState = {
      ...ward.state,
      players: ward.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)),
    };
    const after = reveal(empty, [TREACHERY]);
    expect(inst(after, identityOf(after)).damage).toBe(2);
    expect(removed(after, ward.id)).toBe(true);
  });
  it("a revealed minion (not a treachery) does not trigger her", () => {
    const ward = placed(aspectGame(), WARD);
    const after = reveal(ward.state, [MINION], "Do not");
    expect(inPlayArea(after, ward.id)).toBe(true);
    expect(inst(after, identityOf(after)).damage).toBe(0);
  });
  it("a treachery revealed to another player does not trigger her (only 'you')", () => {
    const ward = placed(aspectGame({ players: 2 }), WARD);
    // Filler for the villain's boost, a minion for P1, then the treachery for P2.
    const after = reveal(ward.state, [MINION, TREACHERY], "Do not");
    expect(inPlayArea(after, ward.id)).toBe(true);
    expect(inst(after, identityOf(after)).damage).toBe(0);
  });
});

describe("50023.melinda-may-response: after she uses a basic power, look at the top encounter card, you may discard it", () => {
  const ID = "50023.melinda-may-response";
  const TOP = "01104";
  const stage = () => {
    const may = placed(hero(), MAY);
    return { state: stackEncounterDeck(may.state, TOP), may: may.id };
  };
  const topOf = (s: GameState): string | undefined => {
    const pile = Object.values(s.encounterDecks)[0]!;
    const first = pile.deck[0];
    return first ? (s.instances[first]!.cardId as string) : undefined;
  };
  const discardedCodes = (s: GameState): string[] =>
    Object.values(s.encounterDecks)
      .flatMap((d) => d.discard)
      .map((i) => s.instances[i]!.cardId as string);
  const attack = (s: GameState, may: InstanceId) =>
    ({ type: "basicAttack", playerId: P1, attackerInstanceId: may, targetInstanceId: villainOf(s) }) as const;

  it("costs 4 and enters play ready", () => {
    const { state, id } = playIt(aspectGame(), MAY, 4);
    expect(inPlayArea(state, id)).toBe(true);
  });
  it("discarding: the top card goes to the encounter discard pile and the next card is on top", () => {
    const { state, may } = stage();
    const next = topOf(stackEncounterDeck(state, "01105", TOP));
    const after = settle(run(state, attack(state, may)), queue(`respond:${ID}`, "Discard"), undefined, DEPS);
    void next;
    expect(discardedCodes(after)).toContain(TOP);
    expect(topOf(after)).not.toBe(TOP);
  });
  it("keeping it: the card stays on top, nothing is discarded", () => {
    const { state, may } = stage();
    const before = discardedCodes(state).length;
    const after = settle(run(state, attack(state, may)), queue(`respond:${ID}`, "Leave"), undefined, DEPS);
    expect(topOf(after)).toBe(TOP);
    expect(discardedCodes(after)).toHaveLength(before);
  });
  it("is a response: declining it looks at nothing and the deck is unchanged", () => {
    const { state, may } = stage();
    const after = drive(run(state, attack(state, may)));
    expect(topOf(after)).toBe(TOP);
  });
  it("also after a basic thwart", () => {
    const { state, may } = stage();
    const thwarted = run(patchInstance(state, schemeOf(state), { threat: 4 }), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: may,
      schemeInstanceId: schemeOf(state),
    });
    const after = settle(thwarted, queue(`respond:${ID}`, "Discard"), undefined, DEPS);
    expect(discardedCodes(after)).toContain(TOP);
  });
  it("another character's basic power does not trigger her", () => {
    const { state } = stage();
    const maria = identityOf(state);
    const asked = settle(
      run(state, attack(state, maria as InstanceId)),
      queue(),
      (s) => s.pendingChoice?.prompt.kind === "chooseTriggers",
      DEPS,
    );
    expect(asked.pendingChoice).toBeFalsy();
    void ID;
  });
});

describe("50024.super-spies-action: place a total of 3 all-purpose counters and/or threat tokens", () => {
  const SUIT = "50035a";
  const COUNTER_SUPPORT = "Place an all-purpose counter on a S.H.I.E.L.D. support";
  const THREAT_SUPPORT = "Place a threat token on a S.H.I.E.L.D. support";
  const COUNTER_SUIT = "Place an all-purpose counter on a suit form upgrade";
  const THREAT_SUIT = "Place a threat token on a suit form upgrade";
  /** Maria in hero form with Nick Fury (ally) in play, Iliad (3 mission), Support Staff (3 staff), the suit and Front Organization. */
  const stage = () => {
    const base = withForm(aspectGame({ swap: { "50003": SUIT } }), { heroForm: 0 });
    const fury = placed(base, FURY_ALLY);
    const iliad = placed(fury.state, ILIAD, { mission: 3 });
    const staff = placed(iliad.state, STAFF, { staff: 3 });
    const suit = placed(staff.state, SUIT);
    const org = placed(suit.state, FRONT_ORG);
    const given = moveToHand(org.state, P1, SPIES);
    return { state: given.state, spies: given.ids[0]!, iliad: iliad.id, staff: staff.id, suit: suit.id, org: org.id };
  };
  const cast = (s: GameState, id: InstanceId, ...answers: readonly string[]) =>
    settle(run(s, play(P1, id, [])), queue(...answers), undefined, DEPS);

  it("is a cost-0 hero action event: the event is discarded after resolving", () => {
    const { state, spies, iliad } = stage();
    const after = cast(state, spies, COUNTER_SUPPORT, iliad, COUNTER_SUPPORT, iliad, COUNTER_SUPPORT, iliad);
    expect(inDiscard(after, spies)).toBe(true);
  });
  it("3 counters on The Iliad: 3 mission counters become 6", () => {
    const { state, spies, iliad } = stage();
    const after = cast(state, spies, COUNTER_SUPPORT, iliad, COUNTER_SUPPORT, iliad, COUNTER_SUPPORT, iliad);
    expect(counters(after, iliad)).toEqual({ mission: 6 });
  });
  it("2 counters and 1 threat: Iliad 4, Staff 4 (each takes its own type), 1 threat on the suit", () => {
    const { state, spies, iliad, staff, suit } = stage();
    const after = cast(state, spies, COUNTER_SUPPORT, iliad, COUNTER_SUPPORT, staff, THREAT_SUIT, suit);
    expect(counters(after, iliad)).toEqual({ mission: 4 });
    expect(counters(after, staff)).toEqual({ staff: 4 });
    expect(inst(after, suit).threat).toBe(1);
  });
  it("3 threat tokens on the suit form upgrade: 3 threat, and the main scheme is untouched", () => {
    const { state, spies, suit } = stage();
    const before = inst(state, schemeOf(state)).threat;
    const after = cast(state, spies, THREAT_SUIT, suit, THREAT_SUIT, suit, THREAT_SUIT, suit);
    expect(inst(after, suit).threat).toBe(3);
    expect(inst(after, schemeOf(after)).threat).toBe(before);
  });
  it("tokens may also go on the other card kind: a threat token on a support, an all-purpose counter on the suit", () => {
    const { state, spies, iliad, suit } = stage();
    const after = cast(state, spies, THREAT_SUPPORT, iliad, COUNTER_SUIT, suit, THREAT_SUPPORT, iliad);
    expect(inst(after, iliad).threat).toBe(2);
    expect(counters(after, suit)).toEqual({ allPurpose: 1 });
  });
  it("a support without the S.H.I.E.L.D. trait (Front Organization) is never offered as a target", () => {
    const { state, spies, org } = stage();
    const asked = settle(
      run(state, play(P1, spies, [])),
      queue(COUNTER_SUPPORT),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      DEPS,
    );
    expect(asked.pendingChoice!.options.map((o) => o.optionId)).not.toContain(org);
  });
  it("with only a suit form upgrade in play the support options are not offered", () => {
    const base = withForm(aspectGame({ swap: { "50003": SUIT } }), { heroForm: 0 });
    const fury = placed(base, FURY_ALLY);
    const suit = placed(fury.state, SUIT);
    const given = moveToHand(suit.state, P1, SPIES);
    const asked = settle(
      run(given.state, play(P1, given.ids[0]!, [])),
      queue(),
      (s) => s.pendingChoice?.prompt.kind === "chooseOption",
      DEPS,
    );
    const labels = asked.pendingChoice!.options.map((o) => o.label);
    expect(labels).toEqual([COUNTER_SUIT, THREAT_SUIT]);
  });
  it("Team-Up: cannot be played without Nick Fury in play (Maria Hill is the identity)", () => {
    const base = withForm(aspectGame(), { heroForm: 0 });
    const given = moveToHand(base, P1, SPIES);
    expect(() => run(given.state, play(P1, given.ids[0]!, []))).toThrow();
  });
  it("Team-Up: playable once Nick Fury is in play", () => {
    const base = withForm(aspectGame(), { heroForm: 0 });
    const fury = placed(base, FURY_ALLY);
    const iliad = placed(fury.state, ILIAD, { mission: 3 });
    const given = moveToHand(iliad.state, P1, SPIES);
    const after = cast(
      given.state,
      given.ids[0]!,
      COUNTER_SUPPORT,
      iliad.id,
      COUNTER_SUPPORT,
      iliad.id,
      COUNTER_SUPPORT,
      iliad.id,
    );
    expect(counters(after, iliad.id)).toEqual({ mission: 6 });
  });
  it("Hero Action: cannot be played in alter-ego form", () => {
    const base = aspectGame();
    const fury = placed(base, FURY_ALLY);
    const given = moveToHand(fury.state, P1, SPIES);
    expect(() => run(given.state, play(P1, given.ids[0]!, []))).toThrow();
  });
});
