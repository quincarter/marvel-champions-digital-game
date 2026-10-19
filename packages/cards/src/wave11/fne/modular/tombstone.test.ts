import { PLAYABLE_CARDS } from "@mc/content";
import {
  activeEncounterDeck,
  characterProfile,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { attachToHost, engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { inPlayFromDeck } from "../../../wave7/next_evol/superpower-testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_MODULAR_TOMBSTONE as REGISTRY, FNE_MODULAR_TOMBSTONE_SKIPPED as SKIPPED } from "./tombstone.js";

vi.setConfig({ testTimeout: 180_000 });

const COLD = "60195";
const MARBLE = "60196";
const BEETLE = "60197";
const TOMBSTONE = "60198";
const HIT_LIST = "60199";
const ADVANCE = "01186";
const SANDMAN = "01102";
const BLACK_CAT = "01002";
const REFS = [
  "60195.cold-as-ice-constant",
  "60195.cold-as-ice-forced-response",
  "60196.hard-as-marble-constant",
  "60196.hard-as-marble-forced-response",
  "60197.when-revealed",
  "60198.boost",
  "60199.hit-list-forced-response",
];
/** Core encounter cards with no boost icon and no boost ability: blank boost cards. */
const BLANKS = ["01187", "01187", "01104", "01104", "01105", "01105"];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const encounterDiscard = (s: GameState): InstanceId[] => [...activeEncounterDeck(s).discard];
const heroDamage = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
const statuses = (s: GameState, id: InstanceId) => inst(s, id).statuses;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

/** `boosts` blank boost cards on top of the encounter deck (one per activation), then the cards dealt to the players. */
const stack = (s: GameState, boosts: number, ...dealt: readonly string[]): GameState =>
  stackEncounterDeck(s, ...BLANKS.slice(0, boosts), ...dealt);

/** Core Spider-Man (and Captain Marvel with `players: 2`) against Rhino, with the Tombstone set added to the encounter deck. */
function newGame(players = 1, form: "hero" | "alterEgo" = "alterEgo"): GameState {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...base, encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["tombstone"], PLAYABLE_CARDS)] },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  for (let n = 0; n < players; n++) {
    s = withForm(s, form === "hero" ? { heroForm: 0 } : "alterEgo", n === 0 ? P1 : P2);
  }
  return s;
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Answers a prompt offering `id` by picking it; every other prompt as `declines`. */
const picks =
  (...ids: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const wanted = choice.options.filter((o) => ids.includes(o.optionId)).map((o) => o.optionId);
    return wanted.length > 0 ? wanted : declines(s);
  };

describe("registry", () => {
  it("registers every printed ref of the five cards; nothing is skipped", () => {
    const printed = [COLD, MARBLE, BEETLE, TOMBSTONE, HIT_LIST].flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Cold as Ice 60195", () => {
  it("is +2 SCH data on an attachment for the highest printed hit points minion", () => {
    expect(data(COLD).statModifiers).toEqual({ sch: 2 });
    expect(data(COLD).attachesTo).toMatchObject({ kind: "superlative", among: "minion", measure: "printedHp" });
  });

  it("60195.cold-as-ice-constant: revealed, it attaches to the highest printed hit points minion and gives it a tough card", () => {
    const a = engageMinion(newGame(), TOMBSTONE);
    const b = engageMinion(a.state, SANDMAN);
    const before = characterProfile(b.state, a.id, WAVE11_DEPS)!.sch;
    const run = driveEventsPicking(WAVE11_DEPS, stack(b.state, 1, COLD), declines, endTurn(P1));
    const cold = idsOf(run.state, COLD)[0]!;
    expect(inst(run.state, cold).attachedTo).toBe(a.id);
    expect(statuses(run.state, a.id).tough).toBe(1);
    expect(statuses(run.state, b.id).tough).toBe(0);
    expect(characterProfile(run.state, a.id, WAVE11_DEPS)!.sch).toBe(before + 2);
    expect(encounterDiscard(run.state)).not.toContain(cold);
  });

  it("60195.cold-as-ice-constant: with no minion in play it gains surge and the next card is revealed", () => {
    const run = driveEventsPicking(WAVE11_DEPS, stack(newGame(), 1, COLD, SANDMAN), declines, endTurn(P1));
    const cold = idsOf(run.state, COLD)[0]!;
    expect(inst(run.state, cold).attachedTo).toBeNull();
    expect(encounterDiscard(run.state)).toContain(cold);
    const sandman = idsOf(run.state, SANDMAN).filter((i) => inst(run.state, i).engagedWith === P1);
    expect(sandman).toHaveLength(1);
  });

  it("60195.cold-as-ice-forced-response: after the attached minion schemes, the first player's identity is confused and Cold as Ice is discarded", () => {
    // Tombstone is engaged with P2; P1 is the first player, so P1 (not the scheming minion's target) is confused.
    const m = engageMinion(newGame(2), TOMBSTONE, P2);
    const attached = attachToHost(m.state, COLD, m.id);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stack(attached.state, 2, ADVANCE, ADVANCE),
      declines,
      endTurn(P1),
      endTurn(P2),
    );
    expect(ofType(run.events, "schemeResolved").map((e) => e.enemyInstanceId)).toContain(m.id);
    expect(statuses(run.state, identityOf(run.state, P1)).confused).toBe(1);
    expect(statuses(run.state, identityOf(run.state, P2)).confused).toBe(0);
    expect(encounterDiscard(run.state)).toContain(attached.id);
    expect(inst(run.state, m.id).attachments).toEqual([]);
  });

  it("60195.cold-as-ice-forced-response: does not trigger when the attached minion attacks", () => {
    const m = engageMinion(newGame(1, "hero"), TOMBSTONE);
    const attached = attachToHost(m.state, COLD, m.id);
    const run = driveEventsPicking(WAVE11_DEPS, stack(attached.state, 1, ADVANCE), declines, endTurn(P1));
    expect(
      ofType(run.events, "enemyActivated").filter((e) => e.enemyInstanceId === m.id && e.activation === "attack"),
    ).toHaveLength(1);
    expect(statuses(run.state, identityOf(run.state)).confused).toBe(0);
    expect(inst(run.state, m.id).attachments).toEqual([attached.id]);
  });
});

describe("Hard as Marble 60196", () => {
  it("is +2 ATK data", () => {
    expect(data(MARBLE).statModifiers).toEqual({ atk: 2 });
  });

  it("60196.hard-as-marble-constant: revealed, it attaches to the highest printed hit points minion with a tough card", () => {
    const a = engageMinion(newGame(), TOMBSTONE);
    const b = engageMinion(a.state, SANDMAN);
    const before = characterProfile(b.state, a.id, WAVE11_DEPS)!.atk;
    const run = driveEventsPicking(WAVE11_DEPS, stack(b.state, 1, MARBLE), declines, endTurn(P1));
    const marble = idsOf(run.state, MARBLE)[0]!;
    expect(inst(run.state, marble).attachedTo).toBe(a.id);
    expect(statuses(run.state, a.id).tough).toBe(1);
    expect(statuses(run.state, b.id).tough).toBe(0);
    expect(characterProfile(run.state, a.id, WAVE11_DEPS)!.atk).toBe(before + 2);
  });

  it("60196.hard-as-marble-constant: with no minion in play it gains surge", () => {
    const run = driveEventsPicking(WAVE11_DEPS, stack(newGame(), 1, MARBLE, SANDMAN), declines, endTurn(P1));
    const marble = idsOf(run.state, MARBLE)[0]!;
    expect(inst(run.state, marble).attachedTo).toBeNull();
    expect(encounterDiscard(run.state)).toContain(marble);
    expect(idsOf(run.state, SANDMAN).filter((i) => inst(run.state, i).engagedWith === P1)).toHaveLength(1);
  });

  it("60196.hard-as-marble-forced-response: after the attached minion attacks the identity, it is stunned and the card is discarded", () => {
    const m = engageMinion(newGame(1, "hero"), TOMBSTONE);
    const attached = attachToHost(m.state, MARBLE, m.id);
    const run = driveEventsPicking(WAVE11_DEPS, stack(attached.state, 1, ADVANCE), declines, endTurn(P1));
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(1);
    expect(encounterDiscard(run.state)).toContain(attached.id);
    expect(inst(run.state, m.id).attachments).toEqual([]);
  });

  it("60196.hard-as-marble-forced-response: does not trigger when the attached minion schemes", () => {
    const m = engageMinion(newGame(), TOMBSTONE);
    const attached = attachToHost(m.state, MARBLE, m.id);
    const run = driveEventsPicking(WAVE11_DEPS, stack(attached.state, 1, ADVANCE), declines, endTurn(P1));
    expect(ofType(run.events, "schemeResolved").map((e) => e.enemyInstanceId)).toContain(m.id);
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(0);
    expect(inst(run.state, m.id).attachments).toEqual([attached.id]);
  });

  /** Rhino is stunned so the only attack this villain phase is Tombstone's, defended by Black Cat. */
  function catDefends(extra: Parameters<typeof patchInstance>[2]) {
    const ally = inPlayFromDeck(newGame(1, "hero"), P1, BLACK_CAT);
    const m = engageMinion(ally.state, TOMBSTONE);
    const attached = attachToHost(m.state, MARBLE, m.id);
    const rigged = patchInstance(
      patchInstance(attached.state, villainOf(attached.state), { statuses: { stunned: 1, confused: 0, tough: 0 } }),
      ally.id,
      extra,
    );
    const run = driveEventsPicking(WAVE11_DEPS, stack(rigged, 0, ADVANCE, ADVANCE), picks(ally.id), endTurn(P1));
    return { run, ally: ally.id, marble: attached.id };
  }

  it("60196.hard-as-marble-forced-response: stuns the defending ally, not the identity", () => {
    const { run, ally, marble } = catDefends({ statuses: { stunned: 0, confused: 0, tough: 1 } });
    expect(playerOf(run.state, P1).playArea).toContain(ally);
    expect(statuses(run.state, ally).stunned).toBe(1);
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(0);
    expect(encounterDiscard(run.state)).toContain(marble);
  });

  it("60196.hard-as-marble-forced-response: an ally the attack defeats is left alone; the card is still discarded", () => {
    const { run, ally, marble } = catDefends({});
    expect(playerOf(run.state, P1).discard).toContain(ally);
    expect(statuses(run.state, ally).stunned).toBe(0);
    expect(statuses(run.state, identityOf(run.state)).stunned).toBe(0);
    expect(encounterDiscard(run.state)).toContain(marble);
  });
});

describe("Beetle 60197", () => {
  it("is villainous (data)", () => {
    expect(data(BEETLE).keywords).toContainEqual({ name: "villainous" });
  });

  /** The deck and discard pile with `moved` codes in the discard pile and every attachment not in `keep` removed. */
  function withAttachments(s: GameState, keep: readonly string[], discarded: readonly string[]): GameState {
    const piles = activeEncounterDeck(s);
    const isAttachment = (i: InstanceId) => (s.cardPool as any)[codeOf(s, i)]?.type === "attachment";
    const removed = [...piles.deck, ...piles.discard].filter((i) => isAttachment(i) && !keep.includes(codeOf(s, i)));
    const toDiscard = piles.deck.filter((i) => discarded.includes(codeOf(s, i)));
    const key = Object.keys(s.encounterDecks).find((k) => s.encounterDecks[k]!.deck.includes(piles.deck[0]!))!;
    return {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [key]: {
          deck: piles.deck.filter((i) => !removed.includes(i) && !toDiscard.includes(i)),
          discard: [...piles.discard.filter((i) => !removed.includes(i)), ...toDiscard],
        },
      },
    };
  }

  /** A real reveal of Beetle by `P1`; records every search prompt (its player and offered cards). */
  function reveal(s: GameState, pick: (offered: readonly string[]) => readonly string[], players = 1) {
    const prompts: { player: PlayerId; offered: string[] }[] = [];
    const picker: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind !== "chooseCards") return declines(st);
      prompts.push({ player: choice.playerId, offered: choice.options.map((o) => o.optionId) });
      return pick(choice.options.map((o) => o.optionId));
    };
    const cmds = players === 1 ? [endTurn(P1)] : [endTurn(P1), endTurn(P2)];
    return { prompts, run: driveEventsPicking(WAVE11_DEPS, s, picker, ...cmds) };
  }

  it("60197.when-revealed: offers the attachments of both piles that can attach to a minion, attaches the chosen one, shuffles", () => {
    const s = newGame();
    const [cold] = idsOf(s, COLD);
    const [marble] = idsOf(s, MARBLE);
    const rigged = withAttachments(s, [COLD, MARBLE], [MARBLE]);
    expect(encounterDiscard(rigged)).toContain(marble);
    const { run, prompts } = reveal(stack(rigged, 1, BEETLE), (offered) => offered.filter((o) => o === marble));
    // Only the two minion attachments, one from the deck and one from the discard pile.
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.offered.sort()).toEqual([cold, marble].sort());
    const beetle = idsOf(run.state, BEETLE)[0]!;
    expect(inst(run.state, marble!).attachedTo).toBe(beetle);
    expect(inst(run.state, beetle).attachments).toEqual([marble]);
    expect(inst(run.state, beetle).engagedWith).toBe(P1);
    expect(inst(run.state, cold!).attachedTo).toBeNull();
    expect(encounterDiscard(run.state)).not.toContain(marble);
    expect(ofType(run.events, "deckShuffled").length).toBeGreaterThan(0);
    // Attached by a search, not revealed: no tough status card, and Marble's +2 ATK applies to Beetle.
    expect(statuses(run.state, beetle).tough).toBe(0);
    expect(characterProfile(run.state, beetle, WAVE11_DEPS)!.atk).toBe(3);
  });

  it("60197.when-revealed: the attachment goes on Beetle even when another minion has more hit points", () => {
    const tomb = engageMinion(newGame(), TOMBSTONE);
    const [cold] = idsOf(tomb.state, COLD);
    const rigged = withAttachments(tomb.state, [COLD], []);
    const { run } = reveal(stack(rigged, 1, BEETLE), (offered) => offered.filter((o) => o === cold));
    const beetle = idsOf(run.state, BEETLE)[0]!;
    expect(inst(run.state, cold!).attachedTo).toBe(beetle);
    expect(inst(run.state, tomb.id).attachments).toEqual([]);
    expect(statuses(run.state, tomb.id).tough).toBe(0);
    expect(statuses(run.state, beetle).tough).toBe(0);
    expect(characterProfile(run.state, beetle, WAVE11_DEPS)!.sch).toBe(3);
  });

  it("60197.when-revealed: the player chooses (the other matching attachment stays where it was)", () => {
    const s = newGame();
    const [cold] = idsOf(s, COLD);
    const [marble] = idsOf(s, MARBLE);
    const rigged = withAttachments(s, [COLD, MARBLE], []);
    const { run } = reveal(stack(rigged, 1, BEETLE), (offered) => offered.filter((o) => o === cold));
    const beetle = idsOf(run.state, BEETLE)[0]!;
    expect(inst(run.state, cold!).attachedTo).toBe(beetle);
    expect(inst(run.state, marble!).attachedTo).toBeNull();
  });

  it("60197.when-revealed: with no attachment that can attach to a minion, Beetle just enters play", () => {
    const rigged = withAttachments(newGame(), [], []);
    const { run, prompts } = reveal(stack(rigged, 1, BEETLE), (offered) => offered.slice(0, 1));
    expect(prompts).toHaveLength(0);
    const beetle = idsOf(run.state, BEETLE)[0]!;
    expect(inst(run.state, beetle).engagedWith).toBe(P1);
    expect(inst(run.state, beetle).attachments).toEqual([]);
    expect(run.state.pendingChoice).toBeFalsy();
  });

  it("60197.when-revealed: revealed by the second player, it engages them and they choose", () => {
    const s = newGame(2);
    const [cold] = idsOf(s, COLD);
    const rigged = withAttachments(s, [COLD], []);
    const { run, prompts } = reveal(
      stack(rigged, 2, ADVANCE, BEETLE),
      (offered) => offered.filter((o) => o === cold),
      2,
    );
    const beetle = idsOf(run.state, BEETLE)[0]!;
    expect(inst(run.state, beetle).engagedWith).toBe(P2);
    expect(playerOf(run.state, P2).playArea).toContain(beetle);
    expect(prompts.map((p) => p.player)).toEqual([P2]);
    expect(inst(run.state, cold!).attachedTo).toBe(beetle);
  });
});

describe("Tombstone 60198", () => {
  it("has Quickstrike (data)", () => {
    expect(data(TOMBSTONE).keywords).toContainEqual({ name: "quickstrike" });
  });

  it("60198.boost: gives the villain a tough status card, whichever enemy it boosts", () => {
    const m = engageMinion(newGame(), BEETLE);
    const villain = villainOf(m.state);
    expect(statuses(m.state, villain).tough).toBe(0);
    // Rhino's boost is blank; the Tombstone card boosts the villainous Beetle's scheme (a plain minion draws no boost card).
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(m.state, BLANKS[0]!, TOMBSTONE, ADVANCE),
      declines,
      endTurn(P1),
    );
    const tomb = idsOf(run.state, TOMBSTONE)[0]!;
    expect(ofType(run.events, "boostCardDealt").map((e) => [e.enemyInstanceId, e.instanceId])).toContainEqual([
      m.id,
      tomb,
    ]);
    expect(statuses(run.state, villain).tough).toBe(1);
    expect(statuses(run.state, m.id).tough).toBe(0);
    expect(encounterDiscard(run.state)).toContain(tomb);
  });
});

describe("Hit List 60199", () => {
  it("is 3 threat per hero with Hit List's Forced Response on its own (data)", () => {
    expect(data(HIT_LIST).startingThreat).toEqual({ base: 0, perPlayer: 3 });
  });

  /** Assigns the indirect damage: `toCat` of its points to Black Cat, the rest to the hero. */
  const assigns =
    (cat: InstanceId, toCat: number): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "assignIndirectDamage") return declines(s);
      const ids = choice.options.map((o) => o.optionId);
      const catPoints = ids.filter((o) => o.startsWith(`${cat}#`)).slice(0, toCat);
      const rest = ids.filter((o) => !o.startsWith(`${cat}#`)).slice(0, choice.minSelections - catPoints.length);
      return [...catPoints, ...rest];
    };

  function board(players: number, form: "hero" | "alterEgo", threat: number) {
    const ally = inPlayFromDeck(newGame(players, form), P1, BLACK_CAT);
    const list = encounterCardInVillainArea(ally.state, HIT_LIST, threat);
    return { state: list.state, list: list.id, cat: ally.id };
  }

  it("60199.hit-list-forced-response: an ally defeated by the indirect damage removes 1 threat per hero (2 players: 2)", () => {
    const { state, list, cat } = board(2, "alterEgo", 6);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stack(state, 2, ADVANCE, ADVANCE),
      assigns(cat, 2),
      endTurn(P1),
      endTurn(P2),
    );
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(heroDamage(run.state, P1)).toBe(1);
    expect(inst(run.state, list).threat).toBe(4);
    // The second player is not the first player: nothing hit them.
    expect(heroDamage(run.state, P2)).toBe(0);
  });

  it("60199.hit-list-forced-response: an ally that survives removes no threat", () => {
    const { state, list, cat } = board(2, "alterEgo", 6);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stack(state, 2, ADVANCE, ADVANCE),
      assigns(cat, 1),
      endTurn(P1),
      endTurn(P2),
    );
    expect(playerOf(run.state, P1).playArea).toContain(cat);
    expect(inst(run.state, cat).damage).toBe(1);
    expect(heroDamage(run.state, P1)).toBe(2);
    expect(inst(run.state, list).threat).toBe(6);
  });

  it("60199.hit-list-forced-response: with one hero, a defeated ally removes 1 threat", () => {
    const { state, list, cat } = board(1, "alterEgo", 3);
    const run = driveEventsPicking(WAVE11_DEPS, stack(state, 1, ADVANCE), assigns(cat, 2), endTurn(P1));
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(inst(run.state, list).threat).toBe(2);
  });

  it("60199.hit-list-forced-response: with no ally, the identity takes all 3 and no threat is removed", () => {
    const s = newGame(1, "alterEgo");
    const list = encounterCardInVillainArea(s, HIT_LIST, 3);
    const run = driveEventsPicking(WAVE11_DEPS, stack(list.state, 1, ADVANCE), declines, endTurn(P1));
    expect(heroDamage(run.state)).toBe(3);
    expect(inst(run.state, list.id).threat).toBe(3);
  });
});
