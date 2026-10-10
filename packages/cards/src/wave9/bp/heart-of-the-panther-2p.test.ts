import { CORE_CARDS, BP_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  createGame,
  type Command,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
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
  settle,
} from "../../testing/harness.js";
import { WAVE9_CARDS } from "../cards.js";
import { BP_DEPS, bpSeat } from "./testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Two-player game, Black Panther (Shuri, the Black Panther hero pack's `bp-justice` precon) as P1 and Core's Black
 * Panther (T'Challa, `core-black-panther-protection`) as P2, against Core's Rhino (standard), seed 1:
 * docs/phase7-wave9.md section 8.4 item 61. Heart of the Panther 51025 prints:
 *
 *   Team-Up (Black Panther/T'Challa and Black Panther/Shuri). Max 1 per deck.
 *   Hero Action: Search your deck and discard pile for a Black Panther upgrade and put it into play. Resolve the
 *   "Special" ability on up to 4 Black Panther upgrades you control in any order.
 *
 * The game is played through the engine's real commands, one decision at a time. Only `moveToHand` (the cards a turn
 * needs) is seeded, and P2's deck has one Core ally swapped for a copy of Heart so that both heroes can play it (deck
 * legality is unchecked, as in every `bp` test that borrows a card). The command log (play commands and every
 * `resolveChoice`) is recorded, and the last test replays it on a fresh game and expects the same state and events.
 *
 * - Team-Up (RRG 1.8 "Team-Up", p. 43): a friendly character titled "Black Panther/T'Challa" and one titled "Black
 *   Panther/Shuri" must both be in play, whoever controls them. Both identities always are in a game of these two, so
 *   either player may play it; the game also shows the Hero Action half (hero form only) and a non-active player.
 * - "Up to 4" (owner's wave 3 Q16): at least one Special when one can resolve; only upgrades the player controls.
 */
const HEART = "51025";
const ENERGY = "51027";
const GENIUS = "51028";
const BEADS = "51010";
const CLAWS = "51011";
const BITES = "51012";
const SUIT = "51013";
const GENIUS_CORE = "01048"; // Core Tactical Genius: Special (thwart): remove 1 threat from a scheme (2 as the final step)
const CORE_CLAWS = "01047"; // Core Panther Claws: Special (attack): 2 damage to an enemy (4 as the final step)
const STRENGTH = "51029";
const POWER_OF_PROTECTION = "01079"; // Core resource card

const SWAPPED_OUT = "01075"; // Black Widow, the ally P2's copy of Heart replaces

interface Sim {
  state: GameState;
  events: GameEvent[];
  /** The replay log: every command applied and every seeded hand (state surgery), in order. */
  commands: Step[];
}
type Step =
  | { readonly command: Command }
  | { readonly threat: number }
  | { readonly give: readonly string[]; readonly player: PlayerId };
interface Asked {
  readonly kind: string;
  readonly slot: string | null;
  readonly player: PlayerId;
  readonly codes: readonly string[];
  readonly min: number;
  readonly max: number;
}
interface Plan {
  /** Card codes, each consumed by the first target/card prompt offering it (an instance id also matches). */
  readonly prefer?: readonly string[];
  /** A card or target prompt that offers none of `prefer` takes every offer up to its maximum instead of the fewest. */
  readonly all?: boolean;
  /** For an `orderSpecials` prompt: the codes of the upgrades, first to last. */
  readonly order?: readonly string[];
  /** For a `choosePlayer` or `chooseTarget` prompt: instance or player ids preferred. */
  readonly player?: PlayerId;
}

const codeIn = (s: GameState, id: string): string => (s.instances[id as InstanceId]?.cardId as string) ?? id;

function makeConfig(): GameSetupConfig {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const tchalla = coreScenario("rhino", {
    players: [{ starterDeckId: "core-black-panther-protection" }],
    seed: 1,
    modularSetIds: [],
  }).players[0]!;
  let swapped = false;
  const deck = tchalla.deck.map((id) => {
    if (!swapped && (id as string) === SWAPPED_OUT) {
      swapped = true;
      return cardId(HEART);
    }
    return id;
  });
  if (!swapped) throw new Error("Black Widow is not in T'Challa's deck");
  return { ...base, requireLegalDecks: false, players: [bpSeat(), { ...tchalla, deck }] };
}

function open(): Sim {
  const created = createGame(makeConfig(), BP_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return {
    state: settle(created.state, firstLegal, (s) => s.step.phase === "player", BP_DEPS),
    events: [],
    commands: [],
  };
}

/**
 * Applies `commands`, then answers every prompt by `plan`, recording each prompt and each command (the replay log).
 * Throws when the engine rejects a command: a rejection is asserted with `rejected` instead.
 */
function act(sim: Sim, plan: Plan, ...commands: readonly Command[]): { events: GameEvent[]; asked: Asked[] } {
  const events: GameEvent[] = [];
  const asked: Asked[] = [];
  const apply = (command: Command) => {
    const r = applyCommand(sim.state, command, BP_DEPS);
    if (!r.ok) throw new Error(`${command.type} rejected: ${r.error.code}: ${r.error.message}`);
    sim.commands.push({ command });
    sim.state = r.state;
    events.push(...r.events);
  };
  const prefer = [...(plan.prefer ?? [])];
  const settleAll = () => {
    for (let guard = 0; sim.state.pendingChoice && !sim.state.outcome; guard++) {
      if (guard > 200) throw new Error("choices did not settle");
      const s = sim.state;
      const choice = s.pendingChoice!;
      const offered = choice.options.map((o) => o.optionId as string);
      asked.push({
        kind: choice.prompt.kind,
        slot: "slot" in choice.prompt ? ((choice.prompt as { slot?: string }).slot ?? null) : null,
        player: choice.playerId as PlayerId,
        codes: offered.map((o) => codeIn(s, o)),
        min: choice.minSelections,
        max: choice.maxSelections,
      });
      let selected: readonly string[];
      switch (choice.prompt.kind) {
        case "declareDefender":
          selected = ["decline"];
          break;
        case "orderSpecials": {
          const rank = (o: string) => {
            const at = plan.order?.indexOf(codeIn(s, o.split(":")[0]!)) ?? -1;
            return at < 0 ? 99 : at;
          };
          selected = [...offered].sort((a, b) => rank(a) - rank(b));
          break;
        }
        case "chooseTarget":
        case "chooseCards":
        case "choosePlayer": {
          const hit = prefer.findIndex((want) => offered.some((o) => o === want || codeIn(s, o) === want));
          if (hit >= 0) {
            const want = prefer.splice(hit, 1)[0]!;
            selected = [offered.find((o) => o === want || codeIn(s, o) === want)!];
          } else if (plan.player && offered.includes(plan.player)) {
            selected = [plan.player];
          } else if (plan.all) {
            selected = offered.slice(0, choice.maxSelections);
          } else {
            selected = firstLegal(s);
          }
          break;
        }
        case "chooseOption": {
          // The Specials' own discard options (Panther Claws, Spider Bites ...) are declined: the upgrade stays.
          const keep = choice.options.find((o) => /^do not|^no\b|^decline/i.test(o.label));
          selected = keep ? [keep.optionId] : firstLegal(s);
          break;
        }
        default:
          selected = firstLegal(s);
      }
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: selected,
      });
    }
  };
  settleAll();
  for (const command of commands) {
    apply(command);
    settleAll();
  }
  sim.events.push(...events);
  return { events, asked };
}

/** The engine's refusal of `command` in the current state, or null if it would be accepted. */
const rejected = (sim: Sim, command: Command): string | null => {
  const r = applyCommand(sim.state, command, BP_DEPS);
  return r.ok ? null : r.error.code;
};

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const ins = (sim: Sim, id: InstanceId) => inst(sim.state, id);
const code = (sim: Sim, id: InstanceId): string => inst(sim.state, id).cardId as string;
const handOf = (sim: Sim, c: string, p: PlayerId): InstanceId[] =>
  playerOf(sim.state, p).hand.filter((i) => code(sim, i) === c);
const inPlay = (sim: Sim, c: string): InstanceId[] => cardsInPlay(sim.state).filter((i) => code(sim, i) === c);
const give = (sim: Sim, player: PlayerId, ...codes: string[]): InstanceId[] => {
  const r = moveToHand(sim.state, player, ...codes);
  sim.state = r.state;
  sim.commands.push({ give: codes, player });
  return [...r.ids];
};
const villainOf = (sim: Sim): InstanceId => sim.state.activeVillainId!;
const damageOf = (sim: Sim, id: InstanceId): number => inst(sim.state, id).damage;
const changeForm = (player: PlayerId): Command => ({ type: "changeForm", playerId: player });
const nameOf = (c: string): string => [...BP_CARDS, ...CORE_CARDS].find((x) => (x.id as string) === c)!.name;

describe("Heart of the Panther 51025: Shuri (P1) and Core's T'Challa (P2), standard Rhino, seed 1", () => {
  const sim = open();
  const me1 = () => identityOf(sim.state, P1);
  const me2 = () => identityOf(sim.state, P2);
  let heart1: InstanceId;
  let heart2: InstanceId;
  let round1P1: { events: GameEvent[]; asked: Asked[] };
  let round1P2: { events: GameEvent[]; asked: Asked[] };
  let round2P1: { events: GameEvent[]; asked: Asked[] };
  let claws2: InstanceId;
  let genius2: InstanceId;

  it("setup: both identities are in play (the Team-Up names), 40-card decks, each hero holds a copy of Heart in its deck", () => {
    expect(sim.state.players.map((p) => p.playerId)).toEqual([P1, P2]);
    expect(code(sim, me1())).toBe("51001a");
    expect(code(sim, me2())).toBe("01040a");
    expect(playerOf(sim.state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(sim.state, P2).identity.form).toBe("alterEgo");
    // Shuri's precon holds its one Heart (the swap put a second copy in T'Challa's deck).
    const copies = (p: PlayerId) =>
      [...playerOf(sim.state, p).hand, ...playerOf(sim.state, p).deck].filter((i) => code(sim, i) === HEART);
    expect(copies(P1)).toHaveLength(1);
    expect(copies(P2)).toHaveLength(1);
    expect(sim.state.firstPlayerId).toBe(P1);
    expect(sim.state.pendingChoice).toBeNull();
  });

  it("round 1: Heart is a Hero Action, so the Shuri player cannot play it in alter-ego form even with T'Challa in play", () => {
    heart1 = give(sim, P1, HEART)[0]!;
    const [energy] = give(sim, P1, ENERGY);
    expect(rejected(sim, play(P1, heart1, [energy!]))).not.toBeNull();
    expect(playerOf(sim.state, P1).hand).toContain(heart1);
  });

  it("round 1: a player whose turn it is not cannot play it either (T'Challa, in hand, out of turn)", () => {
    heart2 = give(sim, P2, HEART)[0]!;
    const [power] = give(sim, P2, POWER_OF_PROTECTION);
    expect(rejected(sim, play(P2, heart2, [power!]))).not.toBeNull();
    expect(playerOf(sim.state, P2).hand).toContain(heart2);
  });

  it("round 1, P1 (Shuri, hero): Heart costs 2; the search offers Shuri's four Black Panther upgrades and none of T'Challa's", () => {
    act(sim, {}, changeForm(P1));
    expect(playerOf(sim.state, P1).identity.form).toBe("hero");
    const [energy] = handOf(sim, ENERGY, P1);
    // Black Panther in hero form is the Team-Up's "Black Panther/Shuri", T'Challa's identity (alter ego) the other name.
    round1P1 = act(sim, { prefer: [CLAWS, villainOf(sim)] }, play(P1, heart1, [energy!]));
    const events = round1P1.events;
    expect(ofType(events, "cardPlayed")).toMatchObject([{ cardId: HEART, resourcesPaid: 2 }]);
    const search = round1P1.asked.find((a) => a.kind === "chooseCards")!;
    // "Search your deck and discard pile": the four Black Panther upgrades of Shuri's own piles, one found (min 1, max 1).
    expect([...new Set(search.codes)].sort().map(nameOf)).toEqual([CLAWS, BITES, SUIT].sort().map(nameOf)); // Kimoyo Beads is in the opening hand, out of reach of a search
    expect([search.min, search.max]).toEqual([1, 1]);
    expect(search.player).toBe(P1);
  });

  it("round 1, P1: the found Panther Claws is put into play on Shuri (no cost), the deck is shuffled and Heart goes to the discard pile", () => {
    const claws = inPlay(sim, CLAWS);
    expect(claws).toHaveLength(1);
    expect(ins(sim, claws[0]!).attachedTo).toBe(me1());
    expect(ofType(round1P1.events, "cardPlayed").map((e) => e.cardId)).toEqual([HEART]);
    expect(ofType(round1P1.events, "deckShuffled")).toHaveLength(1);
    expect(playerOf(sim.state, P1).deck).not.toContain(claws[0]);
    expect(playerOf(sim.state, P1).discard).toContain(heart1);
  });

  it("round 1, P1: 'up to 4' Specials, at least one: Shuri controls one Black Panther upgrade, so exactly it resolves (Claws, 2 damage to an enemy)", () => {
    const prompts = round1P1.asked.filter((a) => a.kind === "chooseCards");
    const specials = prompts[prompts.length - 1]!;
    expect(specials.codes).toEqual([CLAWS]);
    expect(specials.min).toBe(1);
    expect(specials.player).toBe(P1);
    // Panther Claws 51011's Special: 2 damage to an enemy.
    expect(ofType(round1P1.events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villainOf(sim), 2],
    ]);
    expect(damageOf(sim, villainOf(sim))).toBe(2);
    expect(inPlay(sim, CLAWS)).toHaveLength(1); // kept: the discard branch is the Special's own option
    expect(sim.state.pendingChoice).toBeNull();
  });

  it("round 1: Shuri ends her turn; T'Challa flips to hero form", () => {
    act(sim, {}, endTurn(P1));
    expect(sim.state.step).toMatchObject({ phase: "player", activePlayerId: P2 });
    act(sim, {}, changeForm(P2));
    expect(playerOf(sim.state, P2).identity.form).toBe("hero");
  });

  it("round 1, P2 (T'Challa, hero): Team-Up lets the T'Challa player play Heart too (Shuri's identity is the other name); first Core's Panther Claws is played for 2", () => {
    const [power1, power2] = give(sim, P2, POWER_OF_PROTECTION, POWER_OF_PROTECTION);
    const [claws] = give(sim, P2, CORE_CLAWS);
    expect(playerOf(sim.state, P2).hand).toContain(heart2);
    const entered = act(sim, {}, play(P2, claws!, [power1!, power2!], { attachToInstanceId: me2() }));
    expect(ofType(entered.events, "cardPlayed")).toMatchObject([{ cardId: CORE_CLAWS }]);
    claws2 = claws!;
    expect(ins(sim, claws2).attachedTo).toBe(me2());
  });

  it("round 1, P2: Heart searches T'Challa's own piles (Tactical Genius and Vibranium Suit, not Shuri's upgrades) and puts Tactical Genius into play", () => {
    // Staging: 3 threat on the main scheme so that Tactical Genius's thwart has something to remove.
    sim.state = patchInstance(sim.state, sim.state.mainScheme.instanceId, { threat: 3 });
    sim.commands.push({ threat: 3 });
    const [power1, power2] = give(sim, P2, POWER_OF_PROTECTION, POWER_OF_PROTECTION);
    // The sequence: Tactical Genius first, Panther Claws last, so Claws is the final step.
    round1P2 = act(
      sim,
      { prefer: [GENIUS_CORE], all: true, order: [GENIUS_CORE, CORE_CLAWS], player: P2 },
      play(P2, heart2, [power1!, power2!]),
    );
    expect(ofType(round1P2.events, "cardPlayed")).toMatchObject([{ cardId: HEART, resourcesPaid: 2 }]);
    const search = round1P2.asked.find((a) => a.kind === "chooseCards")!;
    expect(search.player).toBe(P2);
    // Every offer is a Core Black Panther upgrade of T'Challa's deck or discard pile; none is Shuri's.
    for (const c of search.codes) expect(c.startsWith("01")).toBe(true);
    expect(search.codes).toContain(GENIUS_CORE);
    expect(search.codes).not.toContain(CORE_CLAWS); // already in play
    expect([search.min, search.max]).toEqual([1, 1]);
    genius2 = inPlay(sim, GENIUS_CORE)[0]!;
    expect(ins(sim, genius2).attachedTo).toBe(me2());
    expect(ofType(round1P2.events, "deckShuffled")).toHaveLength(1);
  });

  it("round 1, P2: the Specials prompt offers only the upgrades T'Challa controls (Tactical Genius, Panther Claws; not Shuri's Claws), 1 to 4", () => {
    const prompts = round1P2.asked.filter((a) => a.kind === "chooseCards");
    const specials = prompts[prompts.length - 1]!;
    expect([...specials.codes].sort()).toEqual([CORE_CLAWS, GENIUS_CORE].sort());
    expect(specials.min).toBe(1);
    expect(specials.max).toBe(2);
    expect(inPlay(sim, CLAWS)).toHaveLength(1); // Shuri's Claws is in play, but P1 controls it
    expect(round1P2.asked.some((a) => a.kind === "orderSpecials")).toBe(true);
  });

  it("round 1, P2: both Specials resolved in the chosen order: Tactical Genius removes 1 threat, then Panther Claws as the final step deals 4", () => {
    expect(ofType(round1P2.events, "threatRemoved").map((e) => e.amount)).toEqual([1]);
    expect(inst(sim.state, sim.state.mainScheme.instanceId).threat).toBe(2);
    expect(ofType(round1P2.events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villainOf(sim), 4],
    ]);
    expect(damageOf(sim, villainOf(sim))).toBe(2 + 4);
    expect(sim.state.pendingChoice).toBeNull();
  });

  it("round 1 villain phase: the first-player token passes, so P2 leads round 2; both copies of Heart sit in their owners' discard piles", () => {
    act(sim, {}, endTurn(P2));
    expect(sim.state.round).toBe(2);
    expect(playerOf(sim.state, P1).discard).toContain(heart1);
    expect(playerOf(sim.state, P2).discard).toContain(heart2);
    expect(sim.state.firstPlayerId).toBe(P2);
    expect(sim.state.pendingChoice).toBeNull();
  });

  it("round 2, P2 leads and ends the turn; P1 plays Beads, Bites and the Suit onto Shuri", () => {
    expect(sim.state.step).toMatchObject({ phase: "player", activePlayerId: P2 });
    act(sim, {}, endTurn(P2));
    expect(sim.state.step).toMatchObject({ phase: "player", activePlayerId: P1 });
    heart1 = give(sim, P1, HEART)[0]!; // from the discard pile
    const [energy, genius, strength] = give(sim, P1, ENERGY, GENIUS, STRENGTH);
    const [beads, bites, suit] = give(sim, P1, BEADS, BITES, SUIT);
    for (const [card, paid] of [
      [beads!, energy!],
      [bites!, genius!],
      [suit!, strength!],
    ] as const) {
      const r = act(sim, {}, play(P1, card, [paid], { attachToInstanceId: me1() }));
      expect(ofType(r.events, "cardPlayed")).toMatchObject([{ resourcesPaid: expect.any(Number) }]);
    }
    expect([BEADS, BITES, SUIT, CLAWS].map((c) => inPlay(sim, c).length)).toEqual([1, 1, 1, 1]);
    for (const c of [BEADS, BITES, SUIT, CLAWS]) expect(ins(sim, inPlay(sim, c)[0]!).attachedTo).toBe(me1());
  });

  it("round 2, P1: with all four Black Panther upgrades in play nothing is left to find; the Specials prompt offers all four, 1 to 4, and the order is chosen", () => {
    const [vib] = give(sim, P1, "51006");
    round2P1 = act(sim, { all: true, order: [BITES, SUIT, BEADS, CLAWS], player: P1 }, play(P1, heart1, [vib!]));
    expect(ofType(round2P1.events, "cardPlayed")).toMatchObject([{ cardId: HEART }]);
    const specials = round2P1.asked.filter((a) => a.kind === "chooseCards").pop()!;
    expect([...specials.codes].sort()).toEqual([BEADS, BITES, CLAWS, SUIT].sort());
    expect([specials.min, specials.max]).toEqual([1, 4]);
    expect(specials.player).toBe(P1);
    // Nothing was found: no search prompt (the only chooseCards prompt is the Specials').
    expect(round2P1.asked.filter((a) => a.kind === "chooseCards")).toHaveLength(1);
    const ordering = round2P1.asked.find((a) => a.kind === "orderSpecials")!;
    expect(ordering.codes).toHaveLength(4);
    expect(playerOf(sim.state, P1).discard).toContain(heart1);
    expect(sim.state.pendingChoice).toBeNull();
  });

  it("round 2, P1: the four Specials resolved: Kimoyo Beads (1 threat), Spider Bites and Panther Claws deal damage; the sequence ends with nothing pending", () => {
    expect(ofType(round2P1.events, "threatRemoved").map((e) => e.amount)).toEqual([1]);
    // Order Spider Bites, Vibranium Suit, Kimoyo Beads, Panther Claws: Bites 1 to the villain (no minion is engaged), the Suit
    // moves 1 damage from Shuri to the villain, Beads removes 1 threat, Claws (the BP pack's, no final-step bonus) deals 2.
    expect(ofType(round2P1.events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villainOf(sim), 1],
      [villainOf(sim), 1],
      [villainOf(sim), 2],
    ]);
    expect(ofType(round2P1.events, "damageHealed").map((e) => [e.targetInstanceId, e.amount])).toEqual([[me1(), 1]]);
  });

  it("invariants: no pending prompt, no card in two zones", () => {
    const seen = new Map<string, string[]>();
    const add = (id: string, label: string) => seen.set(id, [...(seen.get(id) ?? []), label]);
    for (const p of sim.state.players) {
      for (const zone of ["hand", "deck", "discard", "playArea", "setAside"] as const)
        for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    }
    expect([...seen].filter(([, labels]) => labels.length > 1)).toEqual([]);
    expect(sim.state.pendingChoice).toBeNull();
  });

  it("replay: the recorded commands on a fresh game give a deep-equal state and event log", () => {
    const again = open();
    for (const step of sim.commands) {
      if ("threat" in step) {
        again.state = patchInstance(again.state, again.state.mainScheme.instanceId, { threat: step.threat });
        continue;
      }
      if ("give" in step) {
        again.state = moveToHand(again.state, step.player, ...step.give).state;
        continue;
      }
      const r = applyCommand(again.state, step.command, BP_DEPS);
      if (!r.ok) throw new Error(`replay rejected ${step.command.type}: ${r.error.message}`);
      again.state = r.state;
      again.events.push(...r.events);
    }
    expect(sim.commands.filter((s) => "command" in s).length).toBeGreaterThan(15);
    expect(again.state).toEqual(sim.state);
    expect(again.events).toEqual(sim.events);
  });
});
