import { NCRAWLER_CARDS, NCRAWLER_STARTER_DECKS, VNM_CARDS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
  type TargetQuery,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { driveEvents, driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { NIGHTCRAWLER_EVENTS, NIGHTCRAWLER_EVENTS_DRAFTS, NIGHTCRAWLER_EVENTS_SKIPPED } from "./events.js";
import { NIGHTCRAWLER_IDENTITY } from "./identity.js";
import { NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nightcrawler's signature events (48007 to 48011), docs/phase7-wave8.md section 7.4, 3.72, 3.39. His real Protection
 * precon (`nightcrawler-protection`) against Rhino (Core, standard, no modular set), built through `coreScenario`; the
 * engine gets this module's registry with the identity's and the supports module's (Bamf!) on top of every earlier wave.
 * Nightcrawler: THW 2, ATK 1, DEF 3, 9 hit points. Sandman (01102, ELITE minion, ATK 3, 4 hit points) and Mercenary
 * (01101, ATK 1, 3 hit points) are the minions; Breakin' & Takin' (01107) is the side scheme, the main scheme is given 7 threat. Boost cards: Breakin' & Takin'
 * (01107, 2 icons, also a side scheme), Advance (01186, 0 icons). Only a villain is dealt a boost card, so a minion's attack has none.
 *
 * Teleport Drop (48008) is skipped in the module (no way to name the host of the copy its cost discards). The
 * unregistered draft is exercised in the last block: it runs everything but the cost.
 */
const PORT_PUNCH = "48007";
const TELEPORT_DROP = "48008";
const SCOUT = "48009";
const PORT_AWAY = "48010";
const TALLY = "48011";
const BAMF = "48006";
const REFS = [
  "48007.port-and-punch-action",
  "48009.scout-ahead-action",
  "48010.port-away-action",
  "48011.tally-ho-response",
];
const BAMF_REF = "48006.bamf-interrupt";
const TALLY_REF = "48011.tally-ho-response";

const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE7_ABILITIES,
    NIGHTCRAWLER_IDENTITY,
    NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES,
    NIGHTCRAWLER_EVENTS,
  ),
};
const DRAFT_DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE7_ABILITIES,
    NIGHTCRAWLER_IDENTITY,
    NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES,
    NIGHTCRAWLER_EVENTS,
    NIGHTCRAWLER_EVENTS_DRAFTS,
  ),
};
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...VNM_CARDS, ...NCRAWLER_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const PRECON = NCRAWLER_STARTER_DECKS.find((d) => d.id === "nightcrawler-protection")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));

const SANDMAN = "01102";
const MERCENARY = "01101";
const BREAKIN = "01107";
const ADVANCE = "01186";
const BREAKIN_SCHEME = "01107";
/** Cards a test stages by name: never used as payment or filler. */
const KIT = new Set([PORT_PUNCH, TELEPORT_DROP, SCOUT, PORT_AWAY, TALLY, BAMF]);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const count = (codes: readonly string[], code: string): number => codes.filter((c) => c === code).length;
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;
const bamfsOn = (s: GameState, enemy: InstanceId): number =>
  inst(s, enemy).attachments.filter((a) => codeOf(s, a) === BAMF).length;
const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as { resourceIcons?: Record<string, number> };
  return Object.values(card.resourceIcons ?? {}).reduce((a, b) => a + b, 0);
};
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;

type Seat = { readonly kind: "nc" | "core"; readonly extra: readonly string[] };
const NC = (...extra: string[]): Seat => ({ kind: "nc", extra });
/** Spider-Man (Justice precon): a Core hero, given Nightcrawler cards by name (`requireLegalDecks: false`). */
const SM = (...extra: string[]): Seat => ({ kind: "core", extra });

/** The seats against Rhino, through setup, in alter-ego form as setup leaves everyone. */
function setupGame(seats: readonly Seat[], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = seats.map((seat) => {
    const base =
      seat.kind === "nc"
        ? { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }
        : coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed, modularSetIds: [] })
            .players[0]!;
    return { ...base, deck: [...base.deck, ...seat.extra.map((code) => cardId(code))] };
  });
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Hero form for every seat. */
const heroGame = (seats: readonly Seat[] = [NC()], seed = 1): GameState =>
  seats.reduce<GameState>((s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), setupGame(seats, seed));
/** Spider-Man is seat 1 and Nightcrawler seat 2, both in hero form. */
const TWO = (...ncExtra: string[]): readonly Seat[] => [SM(), NC(...ncExtra)];

/** Surgery: a minion from the encounter deck into this player's play area, engaged and faceup. */
function engage(
  state: GameState,
  code: string,
  p: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const id = pile.deck.find((i) => codeOf(state, i) === code) ?? pile.discard.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const deckId = activeEncounterDeckId(state);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((pl) => (pl.playerId === p ? { ...pl, playArea: [...pl.playArea, id] } : pl)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, engagedWith: p, faceup: true, controllerId: null },
      },
    },
  };
}
/** "Increase the amount of damage [target] takes from each attack by 1" (the Cyclops ally's rule), as a scenario rule. */
const plusOneFromAttacks = (s: GameState, target: TargetQuery): GameState => ({
  ...s,
  scenarioRules: {
    ...s.scenarioRules,
    rules: [...(s.scenarioRules.rules ?? []), { kind: "increaseDamageTaken", target, amount: 1, fromAttack: true }],
  },
});
/** Fixture: this game's copy of the card gains Retaliate `value`. */
const withRetaliate = (s: GameState, code: string, value: number): GameState => {
  const card = s.cardPool[cardId(code)] as AnyCard & { keywords: readonly unknown[] };
  const keywords = [...card.keywords, { name: "retaliate", value }];
  return { ...s, cardPool: { ...s.cardPool, [code]: { ...card, keywords } as AnyCard } };
};
/** Rhino's next activation is stunned away. */
const rhinoStunned = (s: GameState): GameState =>
  patchInstance(s, s.activeVillainId!, { statuses: { ...inst(s, s.activeVillainId!).statuses, stunned: 1 } });
/** Breakin' & Takin' (a side scheme with no crisis icon) in play with `threat`; the main scheme is given 7 first. */
const withSideScheme = (s: GameState, threat: number): { readonly state: GameState; readonly id: InstanceId } =>
  encounterCardInVillainArea(patchInstance(s, s.mainScheme.instanceId, { threat: 7 }), BREAKIN_SCHEME, threat);
const withMainThreat = (s: GameState): GameState => patchInstance(s, s.mainScheme.instanceId, { threat: 7 });

/** Plays a copy of `code` from hand attached to `host` (a Bamf!), cost 0. */
function attachBamf(s: GameState, host: InstanceId, p: PlayerId = P1): { state: GameState; id: InstanceId } {
  const given = moveToHand(s, p, BAMF);
  const id = given.ids[0]!;
  const { state } = driveEvents(DEPS, given.state, play(p, id, [], { attachToInstanceId: host }));
  return { state, id };
}

/** Hand cards that pay `cost` (exact icons per card), never a card the test stages by name. */
function payers(s: GameState, p: PlayerId, cost: number, not: readonly InstanceId[] = []): InstanceId[] {
  const out: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(s, p).hand) {
    if (paid >= cost) break;
    if (not.includes(h) || KIT.has(codeOf(s, h)) || iconsOf(s, h) === 0) continue;
    out.push(h);
    paid += iconsOf(s, h);
  }
  if (paid < cost) throw new Error(`not enough resource cards in hand to pay ${cost}`);
  return out;
}
/** Adds resource cards to the hand so a test can pay for several cards (hand size is only enforced at turn end). */
function withResources(s: GameState, n: number, p: PlayerId = P1): GameState {
  const owner = playerOf(s, p);
  const fill = owner.deck
    .filter(
      (id) =>
        iconsOf(s, id) > 0 &&
        !KIT.has(codeOf(s, id)) &&
        !(BY_ID.get(codeOf(s, id)) as { type: string }).type.startsWith("hero"),
    )
    .slice(0, n);
  return {
    ...s,
    players: s.players.map((pl) =>
      pl.playerId === p ? { ...pl, deck: pl.deck.filter((id) => !fill.includes(id)), hand: [...pl.hand, ...fill] } : pl,
    ),
  };
}
/** An event in hand: the state, the card, and the exact cards that pay for it. */
function inHand(
  s: GameState,
  code: string,
  p: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId; readonly pay: InstanceId[] } {
  const given = moveToHand(withResources(s, 3, p), p, code);
  const id = given.ids[0]!;
  const cost = (BY_ID.get(code) as { cost: number }).cost;
  return { state: given.state, id, pay: payers(given.state, p, cost, [id]) };
}

// Pickers: a rule answers the prompt it understands, anything else is declined like `firstLegal`.
type Rule = (s: GameState) => readonly string[] | undefined;
const picker =
  (...rules: readonly Rule[]): Picker =>
  (s) => {
    for (const rule of rules) {
      const answer = rule(s);
      if (answer) return answer;
    }
    return firstLegal(s);
  };
const accept =
  (ref: string): Rule =>
  (s) => {
    if (s.pendingChoice?.prompt.kind !== "chooseTriggers") return undefined;
    const hits = s.pendingChoice.options.filter((o) => o.optionId.includes(ref)).map((o) => o.optionId);
    return hits.length > 0 ? hits : undefined;
  };
const take =
  (...ids: readonly string[]): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice || (choice.prompt.kind !== "chooseCards" && choice.prompt.kind !== "chooseTarget")) return undefined;
    const hits = ids.filter((id) => choice.options.some((o) => o.optionId === id));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : undefined;
  };
const defend =
  (id: InstanceId): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === id)
      ? [id]
      : undefined;
/** Pays a response event's cost (a `payForCard` prompt) with one printed-resource card from the hand. */
const pay =
  (n = 1): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "payForCard") return undefined;
    const ids = choice.options
      .map((o) => o.optionId)
      .filter((o) => {
        const id = o.replace("hand:", "") as InstanceId;
        return !KIT.has(codeOf(s, id)) && iconsOf(s, id) > 0;
      });
    return ids.slice(0, n);
  };
/**
 * Uses Bamf! whenever offered and answers each use with at most one Tally Ho! (the first listed): a response window can
 * offer both copies at once and reopen for the other, which a test of "once per use" must decline.
 */
const bamfThenOneTally = (): Rule => {
  let armed = false;
  return (s) => {
    if (s.pendingChoice?.prompt.kind !== "chooseTriggers") return undefined;
    const options = s.pendingChoice.options.map((o) => o.optionId);
    const bamf = options.find((o) => o.includes(BAMF_REF));
    if (bamf) {
      armed = true;
      return [bamf];
    }
    const tally = options.find((o) => o.includes(TALLY_REF));
    if (tally && armed) {
      armed = false;
      return [tally];
    }
    return [];
  };
};
/** Every prompt kind and option list the picker saw, with the player it was put to. */
function spy(pick: Picker): {
  readonly pick: Picker;
  readonly seen: { kind: string; player: string; options: string[] }[];
} {
  const seen: { kind: string; player: string; options: string[] }[] = [];
  return {
    seen,
    pick: (s) => {
      const c = s.pendingChoice!;
      seen.push({ kind: c.prompt.kind, player: c.playerId as string, options: c.options.map((o) => o.optionId) });
      return pick(s);
    },
  };
}
const offers = (seen: readonly { kind: string; options: string[] }[], ref: string): number =>
  seen.filter((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(ref))).length;

/** Plays the staged event with `pick` answering its choices. */
const playStaged = (
  s: GameState,
  staged: { readonly id: InstanceId; readonly pay: InstanceId[] },
  pick: Picker,
  p: PlayerId = P1,
) => driveEventsPicking(DEPS, s, pick, play(p, staged.id, staged.pay));

describe("registry", () => {
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(NIGHTCRAWLER_EVENTS[id]!)).toEqual([]);
  });
  it("holds exactly the four refs; Teleport Drop is skipped with its reason and only drafted", () => {
    expect(Object.keys(NIGHTCRAWLER_EVENTS).sort()).toEqual([...REFS].sort());
    expect(Object.keys(NIGHTCRAWLER_EVENTS_SKIPPED)).toEqual(["48008.teleport-drop-action"]);
    expect(NIGHTCRAWLER_EVENTS_SKIPPED["48008.teleport-drop-action"]).toMatch(/cost/);
    expect(Object.keys(NIGHTCRAWLER_EVENTS_DRAFTS)).toEqual(["48008.teleport-drop-action"]);
    expect(validateDefinition(NIGHTCRAWLER_EVENTS_DRAFTS["48008.teleport-drop-action"]!)).toEqual([]);
  });
  it("the emitted data: five events with these costs, each one energy icon, Hero Action text where printed", () => {
    const rows = [PORT_PUNCH, TELEPORT_DROP, SCOUT, PORT_AWAY, TALLY].map((code) => {
      const c = BY_ID.get(code) as {
        type: string;
        cost: number;
        resourceIcons: Record<string, number>;
        text: { current: string };
      };
      return [code, c.type, c.cost, c.resourceIcons, c.text.current.split(":")[0]];
    });
    expect(rows).toEqual([
      ["48007", "event", 2, { energy: 1 }, "Hero Action (attack)"],
      ["48008", "event", 2, { energy: 1 }, "Hero Action (attack)"],
      ["48009", "event", 1, { energy: 1 }, "Hero Action (thwart)"],
      ["48010", "event", 0, { energy: 1 }, "Action"],
      ["48011", "event", 1, { energy: 1 }, "Hero Response (defense)"],
    ]);
  });
});

describe("'Port and Punch (48007): 3 damage to an enemy, 3 to each enemy with Bamf! attached", () => {
  /** Rhino and Sandman, a copy on each when asked for. Sandman has no tough status here (surgery skips Toughness). */
  const board = (onRhino: boolean, onSandman: boolean) => {
    const base = heroGame();
    const rhino = base.activeVillainId!;
    const sandman = engage(base, SANDMAN);
    let state = sandman.state;
    if (onRhino) state = attachBamf(state, rhino).state;
    if (onSandman) state = attachBamf(state, sandman.id).state;
    return { state, rhino, sandman: sandman.id };
  };

  it("targeting Rhino (a copy): Rhino takes 3 then 3, Sandman (a copy) 3; the cost is 2 cards and he does not exhaust", () => {
    const { state: s, rhino, sandman } = board(true, true);
    const staged = inHand(s, PORT_PUNCH);
    const handBefore = playerOf(staged.state, P1).hand.length;
    const { state, events } = playStaged(staged.state, staged, picker(take(rhino)));
    expect(damageTo(events, rhino)).toEqual([3, 3]);
    expect(damageTo(events, sandman)).toEqual([3]);
    expect([inst(state, rhino).damage, inst(state, sandman).damage]).toEqual([6, 3]);
    expect(staged.pay).toHaveLength(2);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 3);
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining([staged.id, ...staged.pay]));
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect([bamfsOn(state, rhino), bamfsOn(state, sandman)]).toEqual([1, 1]);
  });

  // Owner ruling, docs/phase7-wave8.md section 4.1 row 47 (Q47 = A; RRG 1.8 "Attack (Player Ability Type)", p. 10): the
  // ability is one attack, so the 3 damage to each enemy with a copy is damage from that attack, like the first 3.
  it("Q47, '+1 damage from each attack' on the villain: Rhino (target, a copy) takes 4 then 4, Sandman (a copy) 3", () => {
    const { state: s, rhino, sandman } = board(true, true);
    const staged = inHand(plusOneFromAttacks(s, { categories: ["villain"] }), PORT_PUNCH);
    const { state, events } = playStaged(staged.state, staged, picker(take(rhino)));
    expect(damageTo(events, rhino)).toEqual([4, 4]);
    expect(damageTo(events, sandman)).toEqual([3]);
    expect([inst(state, rhino).damage, inst(state, sandman).damage]).toEqual([8, 3]);
  });

  it("Q47, the same rule on minions: Sandman, hit only by the second instruction, takes 4; Rhino 3 and 3", () => {
    const { state: s, rhino, sandman } = board(true, true);
    const staged = inHand(plusOneFromAttacks(s, { categories: ["minion"] }), PORT_PUNCH);
    const { state, events } = playStaged(staged.state, staged, picker(take(rhino)));
    expect(damageTo(events, rhino)).toEqual([3, 3]);
    expect(damageTo(events, sandman)).toEqual([4]);
    // Sandman has 4 hit points: the attack defeated him.
    expect(cardsInPlay(state)).not.toContain(sandman);
  });

  it("Q47, retaliate once per surviving enemy attacked: Sandman (Retaliate 2, fixture), hit only by the second instruction, deals 2 once", () => {
    const { state: s, rhino, sandman } = board(true, true);
    const staged = inHand(withRetaliate(s, SANDMAN, 2), PORT_PUNCH);
    const hero = identityOf(staged.state);
    const { state, events } = playStaged(staged.state, staged, picker(take(rhino)));
    expect(damageTo(events, rhino)).toEqual([3, 3]);
    expect(damageTo(events, sandman)).toEqual([3]);
    // One retaliate from Sandman (attacked by the ability, still in play); Rhino has none though hit twice.
    expect(damageTo(events, hero)).toEqual([2]);
    expect(inst(state, hero).damage).toBe(2);
  });

  it("Q47, an enemy the attack defeats does not retaliate: Sandman (Retaliate 2, 4 hit points) targeted with a copy takes 3 + 3", () => {
    const { state: s, sandman } = board(false, true);
    const staged = inHand(withRetaliate(s, SANDMAN, 2), PORT_PUNCH);
    const hero = identityOf(staged.state);
    const { state, events } = playStaged(staged.state, staged, picker(take(sandman)));
    // He survives the first 3 and is defeated by the second: retaliate waits for the whole attack, and he is gone.
    expect(damageTo(events, sandman)).toEqual([3, 3]);
    expect(cardsInPlay(state)).not.toContain(sandman);
    expect(damageTo(events, hero)).toEqual([]);
    expect(inst(state, hero).damage).toBe(0);
  });

  it("targeting Rhino (a copy) with no copy on Sandman: Rhino takes 3 and 3, Sandman 0", () => {
    const { state: s, rhino, sandman } = board(true, false);
    const staged = inHand(s, PORT_PUNCH);
    const { state, events } = playStaged(staged.state, staged, picker(take(rhino)));
    expect(damageTo(events, rhino)).toEqual([3, 3]);
    expect(damageTo(events, sandman)).toEqual([]);
    expect(inst(state, sandman).damage).toBe(0);
  });

  it("targeting Sandman (no copy): he takes 3, and Rhino, which has a copy, takes 3 though it was not the target", () => {
    const { state: s, rhino, sandman } = board(true, false);
    const staged = inHand(s, PORT_PUNCH);
    const { state, events } = playStaged(staged.state, staged, picker(take(sandman)));
    expect(damageTo(events, sandman)).toEqual([3]);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect([inst(state, sandman).damage, inst(state, rhino).damage]).toEqual([3, 3]);
  });

  it("with no copy anywhere only the target takes damage: Sandman 3, Rhino 0", () => {
    const { state: s, rhino, sandman } = board(false, false);
    const staged = inHand(s, PORT_PUNCH);
    const { state, events } = playStaged(staged.state, staged, picker(take(sandman)));
    expect(damageTo(events, sandman)).toEqual([3]);
    expect([inst(state, sandman).damage, inst(state, rhino).damage]).toEqual([3, 0]);
  });

  // Owner ruling Q49 (docs/phase7-wave8.md §4.1; RRG 1.8 "Guard", p. 21): guard is read for every enemy the attack
  // targets, when that enemy would be attacked. The second instruction attacks each enemy with a copy.
  it("Q49, guard: with Mercenary (Guard, 3 hit points) engaged Rhino cannot be the target; the first 3 defeats the Mercenary, so Rhino's copy can then be attacked for 3", () => {
    const base = heroGame();
    const rhino = base.activeVillainId!;
    const merc = engage(base, MERCENARY);
    const a = attachBamf(merc.state, rhino);
    const staged = inHand(a.state, PORT_PUNCH);
    const spied = spy(picker(take(merc.id)));
    const { state, events } = playStaged(staged.state, staged, spied.pick);
    const choice = spied.seen.find((p) => p.kind === "chooseTarget");
    // One legal target: it may be taken without asking.
    if (choice) expect(choice.options).toEqual([merc.id]);
    expect(damageTo(events, merc.id)).toEqual([3]);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect(cardsInPlay(state)).not.toContain(merc.id);
    expect(inst(state, rhino).damage).toBe(3);
    expect(events.filter((e) => e.type === "attackTargetSkipped")).toEqual([]);
  });

  it("Q49, guard: a Mercenary that survives the first 3 (a tough status card) still guards, so Rhino's copy is not attacked and takes nothing", () => {
    const base = heroGame();
    const rhino = base.activeVillainId!;
    const merc = engage(base, MERCENARY);
    const tough = patchInstance(merc.state, merc.id, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const a = attachBamf(tough, rhino);
    const staged = inHand(a.state, PORT_PUNCH);
    const { state, events } = playStaged(staged.state, staged, picker(take(merc.id)));
    expect(cardsInPlay(state)).toContain(merc.id);
    expect(damageTo(events, rhino)).toEqual([]);
    expect(inst(state, rhino).damage).toBe(0);
    expect(bamfsOn(state, rhino)).toBe(1);
    expect(events.flatMap((e) => (e.type === "attackTargetSkipped" ? [e.targetInstanceId] : []))).toEqual([rhino]);
    // Rhino was not attacked: the one attack names the Mercenary alone.
    const attacked = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked"
        ? [e.event.targetInstanceId]
        : [],
    );
    expect(attacked).toEqual([merc.id]);
  });

  it("is refused in alter-ego form (Hero Action)", () => {
    const { state: s } = board(true, true);
    const staged = inHand(withForm(s, "alterEgo"), PORT_PUNCH);
    expect(accepted(staged.state, play(P1, staged.id, staged.pay))).toBe(false);
  });

  it("is refused with only one card to pay (cost 2)", () => {
    const { state: s } = board(true, true);
    const staged = inHand(s, PORT_PUNCH);
    expect(accepted(staged.state, play(P1, staged.id, staged.pay.slice(0, 1)))).toBe(false);
    expect(accepted(staged.state, play(P1, staged.id, staged.pay))).toBe(true);
  });

  it("two players: player 2 punches Rhino; Sandman, engaged with player 1 and holding player 2's copy, takes 3 too", () => {
    const base0 = heroGame(TWO());
    const rhino = base0.activeVillainId!;
    const sandman = engage(base0, SANDMAN, P1);
    const turn2 = driveEvents(DEPS, sandman.state, endTurn(P1)).state;
    const a = attachBamf(turn2, sandman.id, P2);
    const staged = inHand(a.state, PORT_PUNCH, P2);
    const { state, events } = playStaged(staged.state, staged, picker(take(rhino)), P2);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect(damageTo(events, sandman.id)).toEqual([3]);
    expect(inst(state, sandman.id).engagedWith).toBe(P1);
    expect(inst(state, identityOf(state, P1)).damage).toBe(0);
    expect(inst(state, identityOf(state, P2)).exhausted).toBe(false);
  });

  it("a Core hero's seat plays it: Spider-Man (no kit) hits Sandman for 3 and Rhino for 3 (copy on Rhino), by the card, not his ATK", () => {
    const base0 = heroGame([SM(PORT_PUNCH, BAMF), NC()]);
    const rhino = base0.activeVillainId!;
    const sandman = engage(base0, SANDMAN, P1);
    const a = attachBamf(sandman.state, rhino, P1);
    const staged = inHand(a.state, PORT_PUNCH, P1);
    const { state, events } = playStaged(staged.state, staged, picker(take(sandman.id)));
    expect(damageTo(events, sandman.id)).toEqual([3]);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect(inst(state, identityOf(state, P2)).damage).toBe(0);
  });
});

describe("Scout Ahead (48009): remove 3 threat from a scheme; discard a Bamf! from hand for 3 from another", () => {
  const staged1 = (s: GameState) => {
    const given = moveToHand(s, P1, BAMF);
    return { state: given.state, copy: given.ids[0]! };
  };

  it("main scheme and a side scheme (4 threat): main -3, the copy is discarded, the side scheme 4 to 1", () => {
    const base = heroGame();
    const main = base.mainScheme.instanceId;
    const side = withSideScheme(base, 4);
    const { state: s, copy } = staged1(side.state);
    const mainBefore = mainThreat(s);
    expect(mainBefore).toBeGreaterThanOrEqual(3);
    const ev = inHand(s, SCOUT);
    const { state } = playStaged(ev.state, ev, picker(take(main, copy)));
    expect(mainThreat(state)).toBe(mainBefore - 3);
    expect(threatOf(state, side.id)).toBe(1);
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining([copy, ev.id, ...ev.pay]));
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });

  it("the side scheme first: 4 to 1, then with the copy discarded the main scheme loses 3", () => {
    const base = heroGame();
    const side = withSideScheme(base, 4);
    const { state: s, copy } = staged1(side.state);
    const mainBefore = mainThreat(s);
    const ev = inHand(s, SCOUT);
    const { state } = playStaged(ev.state, ev, picker(take(side.id, copy)));
    expect(threatOf(state, side.id)).toBe(1);
    expect(mainThreat(state)).toBe(mainBefore - 3);
    expect(playerOf(state, P1).discard).toContain(copy);
  });

  it("declining the copy: only the first scheme loses 3 and the copy stays in hand", () => {
    const base = heroGame();
    const main = base.mainScheme.instanceId;
    const side = withSideScheme(base, 4);
    const { state: s, copy } = staged1(side.state);
    const mainBefore = mainThreat(s);
    const ev = inHand(s, SCOUT);
    const spied = spy(picker(take(main), (st) => (st.pendingChoice!.prompt.kind === "chooseCards" ? [] : undefined)));
    const { state } = playStaged(ev.state, ev, spied.pick);
    expect(spied.seen.some((p) => p.kind === "chooseCards" && p.options.includes(copy))).toBe(true);
    expect(mainThreat(state)).toBe(mainBefore - 3);
    expect(threatOf(state, side.id)).toBe(4);
    expect(playerOf(state, P1).hand).toContain(copy);
    expect(playerOf(state, P1).discard).not.toContain(copy);
  });

  it("a side scheme with 2 threat loses only 2 (the first removal); the copy is asked for and kept when declined", () => {
    const base = heroGame();
    const side = withSideScheme(base, 2);
    const { state: s, copy } = staged1(side.state);
    const ev = inHand(s, SCOUT);
    const { state } = playStaged(
      ev.state,
      ev,
      picker(take(side.id), (st) => (st.pendingChoice!.prompt.kind === "chooseCards" ? [] : undefined)),
    );
    expect(threatOf(state, side.id)).toBe(0);
    expect(playerOf(state, P1).hand).toContain(copy);
  });

  it("with one scheme in play the copy is not asked for and stays in hand", () => {
    const base = withMainThreat(heroGame());
    const { state: s, copy } = staged1(base);
    const mainBefore = mainThreat(s);
    const ev = inHand(s, SCOUT);
    const spied = spy(picker());
    const { state } = playStaged(ev.state, ev, spied.pick);
    expect(spied.seen.some((p) => p.kind === "chooseCards")).toBe(false);
    expect(mainThreat(state)).toBe(mainBefore - 3);
    expect(playerOf(state, P1).hand).toContain(copy);
  });

  it("with no copy in hand it is not asked for: two schemes, only the first removal", () => {
    const base = heroGame();
    const main = base.mainScheme.instanceId;
    const side = withSideScheme(base, 4);
    const hand = playerOf(side.state, P1).hand.filter((id) => codeOf(side.state, id) === BAMF);
    const noCopy = {
      ...side.state,
      players: side.state.players.map((pl) => ({ ...pl, hand: pl.hand.filter((id) => !hand.includes(id)) })),
    };
    const mainBefore = mainThreat(noCopy);
    const ev = inHand(noCopy, SCOUT);
    const spied = spy(picker(take(main)));
    const { state } = playStaged(ev.state, ev, spied.pick);
    expect(spied.seen.some((p) => p.kind === "chooseCards")).toBe(false);
    expect(mainThreat(state)).toBe(mainBefore - 3);
    expect(threatOf(state, side.id)).toBe(4);
  });

  it("is refused in alter-ego form and when it cannot be paid (cost 1)", () => {
    const base = heroGame();
    const ev = inHand(withForm(base, "alterEgo"), SCOUT);
    expect(accepted(ev.state, play(P1, ev.id, ev.pay))).toBe(false);
    const hero = inHand(base, SCOUT);
    expect(accepted(hero.state, play(P1, hero.id, []))).toBe(false);
    expect(accepted(hero.state, play(P1, hero.id, hero.pay))).toBe(true);
  });

  it("two players: player 2's copy is discarded from player 2's hand, not player 1's", () => {
    const base0 = heroGame(TWO(BAMF));
    const main = base0.mainScheme.instanceId;
    const side = withSideScheme(base0, 4);
    const turn2 = driveEvents(DEPS, side.state, endTurn(P1)).state;
    const given = moveToHand(turn2, P2, BAMF);
    const copy = given.ids[0]!;
    const ev = inHand(given.state, SCOUT, P2);
    const mainBefore = mainThreat(ev.state);
    const { state } = playStaged(ev.state, ev, picker(take(main, copy)), P2);
    expect(mainThreat(state)).toBe(mainBefore - 3);
    expect(threatOf(state, side.id)).toBe(1);
    expect(playerOf(state, P2).discard).toContain(copy);
    expect(count(discardCodes(state, P1), BAMF)).toBe(0);
  });

  it("a Core hero's seat plays it: Spider-Man with a copy in his hand removes 3 and 3", () => {
    const base = heroGame([SM(SCOUT, BAMF), NC()]);
    const main = base.mainScheme.instanceId;
    const side = withSideScheme(base, 4);
    const given = moveToHand(side.state, P1, BAMF);
    const copy = given.ids[0]!;
    const ev = inHand(given.state, SCOUT, P1);
    const mainBefore = mainThreat(ev.state);
    const { state } = playStaged(ev.state, ev, picker(take(main, copy)));
    expect(mainThreat(state)).toBe(mainBefore - 3);
    expect(threatOf(state, side.id)).toBe(1);
    expect(playerOf(state, P1).discard).toContain(copy);
  });
});

describe("'Port Away (48010): discard a Bamf! from hand to change forms and ready your identity", () => {
  const withCopy = (s: GameState, p: PlayerId = P1) => {
    const given = moveToHand(s, p, BAMF);
    return { state: given.state, copy: given.ids[0]! };
  };
  const stagedPA = (s: GameState, p: PlayerId = P1) => {
    const a = withCopy(s, p);
    const b = moveToHand(a.state, p, PORT_AWAY);
    return { state: b.state, copy: a.copy, id: b.ids[0]! };
  };

  it("hero form: the copy is discarded, he is Kurt Wagner and ready again; damage stays; cost 0 pays nothing", () => {
    const base = heroGame();
    const me = identityOf(base);
    const hurt = patchInstance(patchInstance(base, me, { exhausted: true }), me, { damage: 2 });
    const { state: s, copy, id } = stagedPA(hurt);
    const handBefore = playerOf(s, P1).hand.length;
    const { state } = driveEventsPicking(
      DEPS,
      s,
      picker(take(copy)),
      play(P1, id, [], { costChoices: { discard: [copy] } }),
    );
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(inst(state, me).exhausted).toBe(false);
    expect(inst(state, me).damage).toBe(2);
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining([copy, id]));
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 2);
  });

  it("alter-ego form (an Action prints no Hero): he becomes Nightcrawler and is ready", () => {
    const base = withForm(heroGame(), "alterEgo");
    const me = identityOf(base);
    const { state: s, copy, id } = stagedPA(patchInstance(base, me, { exhausted: true }));
    const { state } = driveEventsPicking(
      DEPS,
      s,
      picker(take(copy)),
      play(P1, id, [], { costChoices: { discard: [copy] } }),
    );
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(inst(state, me).exhausted).toBe(false);
    expect(playerOf(state, P1).discard).toContain(copy);
  });

  it("it does not use his one voluntary change: with the change already spent it still plays, and the flag is unchanged", () => {
    const base = heroGame();
    const spent = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, changedFormThisRound: true } })),
    };
    const { state: s, copy, id } = stagedPA(spent);
    expect(accepted(s, toHero())).toBe(false);
    const { state } = driveEventsPicking(
      DEPS,
      s,
      picker(take(copy)),
      play(P1, id, [], { costChoices: { discard: [copy] } }),
    );
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(state, P1).identity.changedFormThisRound).toBe(true);
  });

  it("a fresh round: after it he can still make his own change of form once", () => {
    const { state: s, copy, id } = stagedPA(heroGame());
    const { state } = driveEventsPicking(
      DEPS,
      s,
      picker(take(copy)),
      play(P1, id, [], { costChoices: { discard: [copy] } }),
    );
    expect(playerOf(state, P1).identity.changedFormThisRound).toBe(false);
    expect(accepted(state, toHero())).toBe(true);
  });

  it("with two copies in hand only one is discarded", () => {
    const base = heroGame();
    const a = withCopy(base);
    const hand = playerOf(a.state, P1).hand.filter((i) => codeOf(a.state, i) === BAMF);
    const decked = playerOf(a.state, P1).deck.find((i) => codeOf(a.state, i) === BAMF);
    const two = decked ? moveToHand(a.state, P1, BAMF) : { state: a.state, ids: [] as InstanceId[] };
    const given = moveToHand(two.state, P1, PORT_AWAY);
    const copies = playerOf(given.state, P1).hand.filter((i) => codeOf(given.state, i) === BAMF);
    expect(copies.length).toBeGreaterThanOrEqual(hand.length);
    const { state } = driveEventsPicking(
      DEPS,
      given.state,
      picker(take(copies[0]!)),
      play(P1, given.ids[0]!, [], { costChoices: { discard: [copies[0]!] } }),
    );
    expect(count(discardCodes(state), BAMF)).toBe(1);
    expect(count(handCodes(state), BAMF)).toBe(copies.length - 1);
  });

  it("is refused with no copy in hand (one in the discard pile or the deck does not count)", () => {
    const base = heroGame();
    const stripped = {
      ...base,
      players: base.players.map((pl) => ({ ...pl, hand: pl.hand.filter((id) => codeOf(base, id) !== BAMF) })),
    };
    const given = moveToHand(stripped, P1, PORT_AWAY);
    expect(count(handCodes(given.state), BAMF)).toBe(0);
    expect(accepted(given.state, play(P1, given.ids[0]!, []))).toBe(false);
    const withDiscard = {
      ...given.state,
      players: given.state.players.map((pl) => {
        const deckCopy = pl.deck.find((id) => codeOf(given.state, id) === BAMF)!;
        return { ...pl, deck: pl.deck.filter((id) => id !== deckCopy), discard: [...pl.discard, deckCopy] };
      }),
    };
    expect(accepted(withDiscard, play(P1, given.ids[0]!, []))).toBe(false);
  });

  it("two players: in turn it changes only the player's own identity", () => {
    const base0 = heroGame(TWO(BAMF));
    const tired = patchInstance(base0, identityOf(base0, P1), { exhausted: true });
    const { state: s, copy, id } = stagedPA(tired, P2);
    const turn2 = driveEvents(DEPS, s, endTurn(P1)).state;
    const { state } = driveEventsPicking(
      DEPS,
      turn2,
      picker(take(copy)),
      play(P2, id, [], { costChoices: { discard: [copy] } }),
    );
    expect(playerOf(state, P2).identity.form).toBe("alterEgo");
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(inst(state, identityOf(state, P1)).exhausted).toBe(true);
  });

  it("a Core hero's seat plays it: Spider-Man discards a copy, becomes Peter Parker and is ready", () => {
    const base = heroGame([SM(PORT_AWAY, BAMF), NC()]);
    const me = identityOf(base, P1);
    const { state: s, copy, id } = stagedPA(patchInstance(base, me, { exhausted: true }));
    const { state } = driveEventsPicking(
      DEPS,
      s,
      picker(take(copy)),
      play(P1, id, [], { costChoices: { discard: [copy] } }),
    );
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(inst(state, me).exhausted).toBe(false);
    expect(playerOf(state, P1).discard).toContain(copy);
  });
});

describe("Tally Ho! (48011): after Bamf! makes Nightcrawler the defender, return that copy and deal 3 to the attacker", () => {
  /** A copy on Rhino, Tally Ho! in hand; Rhino's attack has a 2-icon boost card (4 less DEF 3 is 1 damage). */
  const rhinoWithCopy = (extra = 1) => {
    const base0 = withResources(heroGame(), 3);
    const rhino = base0.activeVillainId!;
    const a = attachBamf(base0, rhino);
    const given = moveToHand(a.state, P1, ...Array.from({ length: extra }, () => TALLY));
    return { state: given.state, rhino, copy: a.id, tallies: [...given.ids] };
  };

  it("answers one Bamf! use once: the copy is back in hand, Rhino takes 3, Nightcrawler takes 1, Tally Ho! is spent", () => {
    const { state: s, rhino, copy, tallies } = rhinoWithCopy();
    const base = stackEncounterDeck(s, BREAKIN, ADVANCE);
    const spied = spy(picker(accept(BAMF_REF), accept(TALLY_REF), pay()));
    const { state, events } = driveEventsPicking(DEPS, base, spied.pick, endTurn());
    expect(offers(spied.seen, TALLY_REF)).toBe(1);
    expect(playerOf(state, P1).hand).toContain(copy);
    expect(playerOf(state, P1).discard).not.toContain(copy);
    expect(playerOf(state, P1).discard).toContain(tallies[0]);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect(inst(state, rhino).damage).toBe(3);
    // The attack went on after the response: the 2-icon boost card, less his DEF 3.
    expect(damageTo(events, identityOf(state))).toEqual([1]);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(bamfsOn(state, rhino)).toBe(0);
    // One card paid its cost 1.
    const paid = playerOf(state, P1).discard.filter((id) => id !== copy && id !== tallies[0]);
    expect(paid.length).toBeGreaterThanOrEqual(1);
  });

  it("is a defense-labeled card: he does not exhaust and no retaliate answers the 3 damage (Rhino has none)", () => {
    const { state: s } = rhinoWithCopy();
    const base = stackEncounterDeck(s, BREAKIN, ADVANCE);
    const { state } = driveEventsPicking(DEPS, base, picker(accept(BAMF_REF), accept(TALLY_REF), pay()), endTurn());
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });

  it("declined, the copy stays in the discard pile and Rhino takes no damage", () => {
    const { state: s, rhino, copy } = rhinoWithCopy();
    const base = stackEncounterDeck(s, BREAKIN, ADVANCE);
    const { state, events } = driveEventsPicking(DEPS, base, picker(accept(BAMF_REF)), endTurn());
    expect(playerOf(state, P1).discard).toContain(copy);
    expect(damageTo(events, rhino)).toEqual([]);
    expect(count(handCodes(state), TALLY)).toBe(1);
  });

  it("is not offered when no Bamf! was used: no copy on Rhino, Nightcrawler defends himself", () => {
    const base0 = withResources(heroGame(), 3);
    const given = moveToHand(base0, P1, TALLY);
    const base = stackEncounterDeck(given.state, BREAKIN, ADVANCE);
    const spied = spy(picker(defend(identityOf(base)), accept(TALLY_REF), pay()));
    const { state } = driveEventsPicking(DEPS, base, spied.pick, endTurn());
    expect(offers(spied.seen, TALLY_REF)).toBe(0);
    expect(inst(state, base.activeVillainId!).damage).toBe(0);
    expect(inst(state, identityOf(state)).damage).toBe(1);
  });

  it("is not offered when a copy is present but declined: Bamf! raised no moment", () => {
    const { state: s } = rhinoWithCopy();
    const base = stackEncounterDeck(s, BREAKIN, ADVANCE);
    const spied = spy(picker(defend(identityOf(base)), accept(TALLY_REF), pay()));
    driveEventsPicking(DEPS, base, spied.pick, endTurn());
    expect(offers(spied.seen, TALLY_REF)).toBe(0);
  });

  it("is not offered without a Tally Ho! in hand: Bamf! resolves alone", () => {
    const base0 = heroGame();
    const a = attachBamf(base0, base0.activeVillainId!);
    const base = stackEncounterDeck(a.state, BREAKIN, ADVANCE);
    const spied = spy(picker(accept(BAMF_REF), accept(TALLY_REF), pay()));
    const { state } = driveEventsPicking(DEPS, base, spied.pick, endTurn());
    expect(offers(spied.seen, TALLY_REF)).toBe(0);
    expect(playerOf(state, P1).discard).toContain(a.id);
  });

  it("two Bamf! uses in one villain phase, two Tally Ho!: each use is answered once (Rhino 3, Sandman 3)", () => {
    const base0 = withResources(heroGame(), 4);
    const rhino = base0.activeVillainId!;
    const sandman = engage(base0, SANDMAN);
    const a = attachBamf(sandman.state, rhino);
    const b = attachBamf(a.state, sandman.id);
    const both = moveToHand(b.state, P1, TALLY, TALLY);
    const s = both.state;
    const tallies = [...both.ids];
    expect(new Set(tallies).size).toBe(2);
    const base = stackEncounterDeck(s, BREAKIN, ADVANCE);
    const spied = spy(picker(bamfThenOneTally(), pay()));
    const { state, events } = driveEventsPicking(DEPS, base, spied.pick, endTurn());
    // Each Bamf! use opens a window offering both copies; one is used, and the window reopens for the other (declined).
    expect(events.filter((e) => e.type === "momentRaised")).toHaveLength(2);
    expect(offers(spied.seen, TALLY_REF)).toBeGreaterThanOrEqual(2);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect(damageTo(events, sandman.id)).toEqual([3]);
    expect(inst(state, sandman.id).damage).toBe(3);
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining(tallies));
    expect(count(handCodes(state), BAMF)).toBe(count(handCodes(b.state), BAMF) + 2);
    expect(bamfsOn(state, rhino) + bamfsOn(state, sandman.id)).toBe(0);
  });

  it("two copies of Tally Ho! may both answer the same use: Rhino takes 3 and 3 (each copy is its own response)", () => {
    const { state: s, rhino, copy } = rhinoWithCopy(2);
    const base = stackEncounterDeck(s, BREAKIN, ADVANCE);
    const { state, events } = driveEventsPicking(
      DEPS,
      base,
      picker(accept(BAMF_REF), accept(TALLY_REF), pay(2)),
      endTurn(),
    );
    expect(damageTo(events, rhino)).toEqual([3, 3]);
    // "That copy" is already in hand for the second one: it is returned once and stays there.
    expect(playerOf(state, P1).hand.filter((id) => id === copy)).toHaveLength(1);
  });

  it("two Bamf! uses but one Tally Ho!: it answers the first use only and is offered once", () => {
    const base0 = withResources(heroGame(), 4);
    const rhino = base0.activeVillainId!;
    const sandman = engage(base0, SANDMAN);
    const a = attachBamf(sandman.state, rhino);
    const b = attachBamf(a.state, sandman.id);
    const given = moveToHand(b.state, P1, TALLY);
    const base = stackEncounterDeck(given.state, BREAKIN, ADVANCE);
    const spied = spy(picker(accept(BAMF_REF), accept(TALLY_REF), pay()));
    const { state, events } = driveEventsPicking(DEPS, base, spied.pick, endTurn());
    expect(offers(spied.seen, TALLY_REF)).toBe(1);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect(damageTo(events, sandman.id)).toEqual([]);
    // Rhino's copy came back to hand; Sandman's is in the discard pile.
    expect(playerOf(state, P1).discard.filter((id) => codeOf(state, id) === BAMF)).toEqual([b.id]);
  });

  it("a minion with 3 hit points (Mercenary) is defeated before its damage: the attack ends and he takes 0", () => {
    const base0 = rhinoStunned(withResources(heroGame(), 3));
    const merc = engage(base0, MERCENARY);
    const a = attachBamf(merc.state, merc.id);
    const given = moveToHand(a.state, P1, TALLY);
    const base = stackEncounterDeck(given.state, BREAKIN, ADVANCE);
    const { state, events } = driveEventsPicking(
      DEPS,
      base,
      picker(accept(BAMF_REF), accept(TALLY_REF), pay()),
      endTurn(),
    );
    expect(damageTo(events, merc.id)).toEqual([3]);
    expect(cardsInPlay(state)).not.toContain(merc.id);
    expect(damageTo(events, identityOf(state))).toEqual([]);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(playerOf(state, P1).hand).toContain(a.id);
  });

  it("two players: player 1's Tally Ho! is not offered for player 2's Bamf!; player 2's is, and hurts Rhino", () => {
    const base0 = withResources(heroGame([SM(TALLY), NC(TALLY, BAMF)]), 3, P2);
    const rhino = base0.activeVillainId!;
    const given1 = moveToHand(base0, P1, TALLY);
    const turn2 = driveEvents(DEPS, given1.state, endTurn(P1)).state;
    const a = attachBamf(turn2, rhino, P2);
    const given2 = moveToHand(a.state, P2, TALLY);
    // Rhino attacks Spider-Man first (2-icon boost), then Nightcrawler (0 icons).
    const base = stackEncounterDeck(given2.state, BREAKIN, ADVANCE, ADVANCE);
    const spied = spy(picker(accept(BAMF_REF), accept(TALLY_REF), pay(), defend(identityOf(base, P2))));
    const { state, events } = driveEventsPicking(DEPS, base, spied.pick, endTurn(P2));
    const talliesOffered = spied.seen.filter(
      (p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(TALLY_REF)),
    );
    expect(talliesOffered.map((p) => p.player)).toEqual(["p2"]);
    expect(talliesOffered[0]!.options.some((o) => o.startsWith(`${given1.ids[0]}:`))).toBe(false);
    expect(damageTo(events, rhino)).toEqual([3]);
    expect(playerOf(state, P2).hand).toContain(a.id);
    expect(playerOf(state, P1).hand).toContain(given1.ids[0]);
  });
});

describe("Teleport Drop (48008): skipped, drafted without its cost", () => {
  const draftBoard = () => {
    const base0 = withResources(heroGame(), 3);
    const rhino = base0.activeVillainId!;
    const a = attachBamf(base0, rhino);
    const ev = moveToHand(a.state, P1, TELEPORT_DROP);
    return { state: ev.state, rhino, copy: a.id, id: ev.ids[0]!, pay: payers(ev.state, P1, 2, [ev.ids[0]!]) };
  };

  it("the registry does not hold it: with the real registry the card does nothing (no damage, the copy stays)", () => {
    const { state: s, rhino, copy, id, pay: cards } = draftBoard();
    const { state, events } = driveEventsPicking(DEPS, s, picker(take(rhino)), play(P1, id, cards));
    expect(damageTo(events, rhino)).toEqual([]);
    expect(bamfsOn(state, rhino)).toBe(1);
    expect(inst(state, copy).attachedTo).toBe(rhino);
  });

  it("the draft runs the rest: the copy is discarded, Rhino takes 8 and is stunned", () => {
    const { state: s, rhino, copy, id, pay: cards } = draftBoard();
    const { state, events } = driveEventsPicking(DRAFT_DEPS, s, picker(take(rhino)), play(P1, id, cards));
    expect(damageTo(events, rhino)).toEqual([8]);
    expect(inst(state, rhino).statuses.stunned).toBe(1);
    expect(playerOf(state, P1).discard).toContain(copy);
    expect(bamfsOn(state, rhino)).toBe(0);
  });

  it("the draft needs an enemy with a copy: with none it cannot be played", () => {
    const base0 = withResources(heroGame(), 3);
    const ev = moveToHand(base0, P1, TELEPORT_DROP);
    const cards = payers(ev.state, P1, 2, [ev.ids[0]!]);
    expect(applyCommand(ev.state, play(P1, ev.ids[0]!, cards), DRAFT_DEPS).ok).toBe(false);
  });

  it.fails("pinned gap: as printed the discard is the cost (cost.discardCards), the draft discards in its effects", () => {
    const draft = NIGHTCRAWLER_EVENTS_DRAFTS["48008.teleport-drop-action"]!;
    expect(draft.cost?.discardCards).toBeDefined();
  });
});
