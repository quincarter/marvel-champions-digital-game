import { PLAYABLE_CARDS } from "@mc/content";
import { characterProfile, createGame, keywordTotal, playCostOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { buildCrossHeroDeck } from "../../../testing/cross-hero.js";
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
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";
import { WAVE11_DEPS as DEPS } from "../../index.js";
import {
  FNE_ASPECT_BASIC_PROTECTION as REGISTRY,
  FNE_ASPECT_BASIC_PROTECTION_SKIPPED as SKIPPED,
} from "./protection.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `fne/aspect-basic/protection` (docs/phase7-wave11.md section 8.4 line 11), 60038 to 60054. Every card is
 * played from the deck of a Core hero (Black Panther, the Protection precon, with the card added to his deck; definition
 * of done 4b) against Core's Rhino. Cards are staged into play by surgery; every ability is then used through the
 * engine's own commands.
 */
const INNATE_REFLEXES = "60038";
const ARMY_OF_ONE = "60048";
const GET_THEIR_ATTENTION = "60049";
const IN_HARMS_WAY = "60050";
const THE_BEST_OFFENSE = "60052";
const RONIN = "60053";
const STAND_ALONE = "60054";
const SHOCKER = "01103"; // Core minion
const ALLY = "56041"; // Patriot, an ally from another set
const ENERGY = "01088"; // Core resource: one energy
const ADVANCE = "01186"; // Core treachery, boost 0

/** Every ref this module registers (the reprint alias included). */
const REFS = [
  "60038.innate-reflexes-constant",
  "60048.army-of-one-constant",
  "60048.army-of-one-action",
  "60049.get-their-attention-constant",
  "60050.in-harms-way-constant",
  "60050.in-harms-way-constant-2",
  "60051.powerful-punch-constant",
  "60052.the-best-offense-constant",
  "60052.the-best-offense-constant-2",
  "60053.ronin-constant",
  "60054.stand-alone-interrupt",
];

function coreGame(code: string, twoPlayers = false): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-black-panther-protection" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    {
      ...config,
      players: [
        buildCrossHeroDeck(PLAYABLE_CARDS, "core-black-panther-protection", code),
        ...(twoPlayers
          ? [coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 }).players[0]!]
          : []),
      ],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(`${code}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const first = withForm(opened, { heroForm: 0 });
  return twoPlayers ? withForm(first, { heroForm: 0 }, P2) : first;
}

const hero = (s: GameState): InstanceId => identityOf(s, P1);
const profile = (s: GameState) => characterProfile(s, hero(s), DEPS)!;
const attached = (s: GameState, code: string) => stagedInPlay(s, code, { attach: true });
const inHand = (s: GameState, code: string) => {
  const given = moveToHand(s, P1, code);
  return { state: given.state, id: given.ids[0]! };
};
/** Surgery: one of P1's deck cards turned into an ally and put into play under P1's control. */
const withAlly = (s: GameState): GameState => {
  const spare = playerOf(s, P1).deck[0]!;
  return stagedInPlay(patchInstance(s, spare, { cardId: ALLY as never }), ALLY).state;
};
/** Surgery: `n` deck cards turned into Energy resources and put in hand. */
const withEnergy = (s: GameState, n: number) => {
  const turned = playerOf(s, P1)
    .deck.slice(0, n)
    .reduce((state, id) => patchInstance(state, id, { cardId: ENERGY as never }), s);
  return moveToHand(turned, P1, ...Array.from({ length: n }, () => ENERGY));
};
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

/** Takes the named options (or accepts every optional trigger) among the pending ones, else the first legal answer. */
const taking =
  (wanted: readonly string[], keep: readonly string[] = []): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "payForCard") {
      // Option ids read `hand:<instance>`: the kept cards pay.
      return ids.filter((i) => keep.includes(i.replace("hand:", ""))).slice(0, choice.maxSelections);
    }
    if (choice.prompt.kind === "discardDownToHandSize") {
      return ids.filter((i) => !keep.includes(i)).slice(0, choice.minSelections);
    }
    const hit =
      choice.prompt.kind === "declareDefender"
        ? ids.filter((i) => wanted.includes(i))
        : ids.filter((i) => wanted.some((w) => i.endsWith(w)));
    if (hit.length > 0) return hit.slice(0, choice.maxSelections);
    return firstLegal(s);
  };
const drive = (s: GameState, pick: Picker, ...commands: Parameters<typeof runWith>[2][]): GameState =>
  settle(runWith(DEPS, s, ...commands), pick, undefined, DEPS);

/** Ends the turn: the villain attacks the hero (Advance stacked as the boost), with the windows offered recorded. */
function villainAttack(
  s: GameState,
  take: readonly string[],
  keep: readonly string[] = [],
  /** Trigger windows to decline before the first one that is taken. */
  skip = 0,
): { state: GameState; windows: string[][]; defenders: string[][] } {
  const windows: string[][] = [];
  const defenders: string[][] = [];
  const pick: Picker = (state) => {
    const choice = state.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "declareDefender") defenders.push(ids);
    if (choice.prompt.kind === "chooseTriggers") {
      windows.push(ids);
      if (windows.length <= skip) return [];
    }
    return taking(take, keep)(state);
  };
  const stacked = stackEncounterDeck(s, ADVANCE, ADVANCE);
  const ends = stacked.players.map((p) => endTurn(p.playerId));
  return { windows, defenders, state: drive(stacked, pick, ...ends) };
}

describe("wave 11 fne/aspect-basic/protection", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts every ref of 60038 to 60054, so nothing is skipped", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
  });

  it("aliases each reprint to its original's script, and the printed text is the original's", () => {
    const ALIASES: readonly (readonly [string, string])[] = [
      ["60051.powerful-punch-constant", "32014.powerful-punch-constant"],
    ];
    const text = (code: string): string => {
      const card = PLAYABLE_CARDS.find((c) => (c.id as string) === code) as unknown as { text?: { current: string } };
      return (card.text?.current ?? "").replace(/\s+/g, " ").trim();
    };
    for (const [ref, source] of ALIASES) {
      expect(REGISTRY[ref], ref).toBe(WAVE10_ABILITIES[source]);
      expect(text(ref.split(".")[0]!), ref).not.toBe("");
      expect(text(ref.split(".")[0]!), ref).toBe(text(source.split(".")[0]!));
    }
  });

  it("60038.innate-reflexes-constant: your hero gets +1 DEF", () => {
    const start = coreGame(INNATE_REFLEXES);
    const before = profile(start);
    const after = profile(attached(start, INNATE_REFLEXES).state);
    expect(after.def).toBe(before.def + 1);
    expect(after.atk).toBe(before.atk);
  });

  it("60052.the-best-offense-constant / -2: +1 DEF, and THW and ATK read as the DEF, ignoring their modifiers", () => {
    const start = coreGame(THE_BEST_OFFENSE);
    const before = profile(start);
    const after = profile(attached(start, THE_BEST_OFFENSE).state);
    expect(after.def).toBe(before.def + 1);
    expect(after.thw).toBe(after.def);
    expect(after.atk).toBe(after.def);
  });

  it("60053.ronin-constant: +1 DEF and retaliate 1 only while you control no allies", () => {
    const start = coreGame(RONIN);
    const before = profile(start);
    const alone = attached(start, RONIN);
    expect(profile(alone.state).def).toBe(before.def + 1);
    const base = keywordTotal(start, hero(start), "retaliate", DEPS); // Black Panther has retaliate 1 of his own
    expect(keywordTotal(alone.state, hero(alone.state), "retaliate", DEPS)).toBe(base + 1);
    const allied = withAlly(alone.state);
    expect(profile(allied).def).toBe(before.def);
    expect(keywordTotal(allied, hero(allied), "retaliate", DEPS)).toBe(base);
  });

  it("60048.army-of-one-constant / -action: costs 1 more per ally, and readies your hero", () => {
    const start = inHand(coreGame(ARMY_OF_ONE), ARMY_OF_ONE);
    expect(playCostOf(start.state, P1, start.id, DEPS)!.current).toBe(1);
    const ally = withAlly(start.state);
    expect(playCostOf(ally, P1, start.id, DEPS)!.current).toBe(2);

    const energy = inHand(start.state, ENERGY);
    const tired = patchInstance(energy.state, hero(energy.state), { exhausted: true });
    const after = drive(tired, firstLegal, play(P1, start.id, [energy.id]));
    expect(playerOf(after, P1).discard).toContain(start.id);
    expect(inst(after, hero(after)).exhausted).toBe(false);
  });

  it("60050.in-harms-way-constant / -2: costs 1 more per ally; X damage and X threat removed, X = DEF", () => {
    const start = inHand(coreGame(IN_HARMS_WAY), IN_HARMS_WAY);
    expect(playCostOf(start.state, P1, start.id, DEPS)!.current).toBe(3);
    expect(playCostOf(withAlly(start.state), P1, start.id, DEPS)!.current).toBe(4);

    const given = withEnergy(start.state, 3);
    const hand = given.ids;
    const x = profile(given.state).def;
    const threat = patchInstance(given.state, given.state.mainScheme.instanceId, { threat: x + 5 });
    const after = drive(threat, taking([villainOf(threat)]), play(P1, start.id, hand.slice(0, 3)));
    expect(inst(after, villainOf(after)).damage).toBe(x);
    expect(mainThreat(after)).toBe(5);
  });

  it("60049.get-their-attention-constant: when an enemy initiates an attack, remove 3 threat from a scheme", () => {
    const start = inHand(coreGame(GET_THEIR_ATTENTION), GET_THEIR_ATTENTION);
    const energy = withEnergy(start.state, 2);
    const keep = [start.id, ...energy.ids];
    const threat = patchInstance(energy.state, energy.state.mainScheme.instanceId, { threat: 4 });
    const control = villainAttack(threat, [], keep);
    const used = villainAttack(threat, ["60049.get-their-attention-constant"], keep);
    expect(used.windows.flat().some((o) => o.endsWith("60049.get-their-attention-constant"))).toBe(true);
    expect(mainThreat(used.state)).toBe(mainThreat(control.state) - 3);
  });

  it("60054.stand-alone-interrupt: with no allies, exhaust to ready your hero before the defender is declared", () => {
    // The "(before any defender is declared)" parenthetical is reminder text with no effect (RRG 1.8 "Reminder Text", p. 36).
    // Rhino attacks first and the hero defends (and exhausts); a Shocker engaged with the hero attacks next.
    const upgrade = attached(coreGame(STAND_ALONE), STAND_ALONE);
    const base = engageMinion(upgrade.state, SHOCKER, "m-shocker");
    const heroId = hero(base);
    const used = villainAttack(base, ["60054.stand-alone-interrupt", heroId], [], 1);
    const control = villainAttack(base, [heroId], [], 99);
    const last = (r: { defenders: string[][] }) => r.defenders[r.defenders.length - 1]!;
    // Still exhausted from the first defense, the hero is not offered against the Shocker: no defender prompt at all.
    expect(control.defenders).toHaveLength(1);
    expect(used.defenders).toHaveLength(2);
    expect(used.windows.flat().some((o) => o.endsWith("60054.stand-alone-interrupt"))).toBe(true);
    expect(last(used)).toContain(heroId);
    expect(inst(used.state, upgrade.id).exhausted).toBe(true);

    const blocked = villainAttack(withAlly(base), ["60054.stand-alone-interrupt", heroId], [], 1);
    expect(last(blocked)).not.toContain(heroId); // only the ally can defend now
    expect(inst(blocked.state, upgrade.id).exhausted).toBe(false);
  });

  it("60049.get-their-attention-constant: also answers an attack on another player", () => {
    const start = inHand(coreGame(GET_THEIR_ATTENTION, true), GET_THEIR_ATTENTION);
    const energy = withEnergy(start.state, 2);
    const keep = [start.id, ...energy.ids];
    const threat = patchInstance(energy.state, energy.state.mainScheme.instanceId, { threat: 4 });
    const control = villainAttack(threat, [], keep, 99);
    // Decline at the attack on P1, take it at the attack on P2.
    const used = villainAttack(threat, ["60049.get-their-attention-constant"], keep, 1);
    expect(used.windows.length).toBeGreaterThanOrEqual(2);
    expect(mainThreat(used.state)).toBe(mainThreat(control.state) - 3);
  });

  it("60048 / 60050: another player's ally does not raise the cost", () => {
    const start = inHand(coreGame(ARMY_OF_ONE, true), ARMY_OF_ONE);
    const theirs = withAlly(start.state);
    const ally = Object.keys(theirs.instances).find((i) => theirs.instances[i as InstanceId]!.cardId === ALLY)!;
    const moved = patchInstance(theirs, ally as InstanceId, { controllerId: P2 });
    expect(playCostOf(moved, P1, start.id, DEPS)!.current).toBe(1);
  });
});
